const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { createServer } = require("node:http");
const { Client } = require("colyseus.js");

(async () => {
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "apps/game-server/tsconfig.json"], { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });
  const server = await import("../dist/game-server/server.js");
  const { CharacterRepository } = await import("../dist/game-server/characterRepository.js");
  const userId = "11111111-1111-4111-8111-111111111111";
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  const characterId = "33333333-3333-4333-8333-333333333333";
  const progress = { id: characterId, level: 2, xp: 10, gold: 5, checkpoint: "village", inventory: [], updated_at: "2026-10-15T00:00:00Z" };
  const loadScopes = [];
  let rpcCalls = 0;
  const db = {
    from: (table) => {
      assert.equal(table, "characters");
      const filters = {};
      const query = { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, async maybeSingle() { loadScopes.push(filters); return { data: filters.id === characterId && filters.user_id === userId ? progress : null, error: null }; } };
      return query;
    },
    async rpc(name, args) { rpcCalls++; assert.equal(name, "save_character_progress"); assert.equal(args.p_character_id, characterId); assert.equal(args.p_user_id, userId); assert.equal(args.p_expected_updated_at, progress.updated_at); return { data: { applied: true, progress }, error: null }; }
  };
  const repo = new CharacterRepository(db);
  assert.equal((await repo.load(userId, characterId)).id, characterId);
  assert.deepEqual(loadScopes[0], { id: characterId, user_id: userId }, "load filters owner and character");
  await assert.rejects(() => repo.save(otherUserId, characterId, { level: 2, xp: 10, gold: 5, checkpoint: "village", inventory: [] }, "save-1", progress.updated_at), /Character not found/);
  assert.equal(rpcCalls, 0, "unowned character never reaches persistence RPC");
  await repo.save(userId, characterId, { level: 2, xp: 10, gold: 5, checkpoint: "village", inventory: [] }, "save-contract", progress.updated_at);

  const load = { type: "load", requestId: "load-1" };
  const save = { type: "save", requestId: "save-1" };
  for (const invalid of [
    { ...load, characterId }, { ...load, authority: true }, { type: "delete", requestId: "x" },
    { ...save, userId }, { ...save, level: 3 }, { ...save, extra: 1 },
    { type: "load", requestId: "bad id" }, { type: "save", requestId: "x", level: 1 }
  ]) assert.equal(server.validateCharacterProgressRequest(invalid), null, "invalid or forged request rejected");
  assert.equal(server.validateCharacterProgressRequest(load).type, "load");
  assert.equal(server.validateCharacterProgressRequest(save).type, "save");
  assert.equal(server.validateCharacterProgressRequest({ type: "save", requestId: "x", level: 9 }), null, "client progress fields rejected");
  assert.equal(server.validateCharacterId("char-legacy"), undefined, "legacy character id stays unbound");

  const calls = [];
  let fakeWrites = 0;
  const double = {
    async load(owner, id) { calls.push(["load", owner, id]); return owner === userId && id === characterId ? progress : null; },
    async save(owner, id, write, key, expectedUpdatedAt) { calls.push(["save", owner, id, write, key, expectedUpdatedAt]); if (!await this.load(owner, id)) throw new Error("not owned"); if (expectedUpdatedAt !== progress.updated_at) throw new Error("stale progress"); fakeWrites++; return { applied: true, progress: { ...progress, ...write, updated_at: "2026-10-15T00:01:00Z" } }; }
  };
  const loaded = await server.handleCharacterProgressRequest(load, userId, characterId, double);
  assert.equal(loaded.type, "loaded");
  assert.deepEqual(calls[0], ["load", userId, characterId], "load uses authenticated owner and joined character");
  const rejected = await server.handleCharacterProgressRequest(save, otherUserId, characterId, double, progress);
  assert.equal(rejected.type, "rejected");
  assert.deepEqual(calls.slice(1, 3), [["save", otherUserId, characterId, { level: 2, xp: 10, gold: 5, checkpoint: "village", inventory: [] }, createHash("sha256").update(`${otherUserId}:${characterId}:save-1`).digest("hex"), progress.updated_at], ["load", otherUserId, characterId]], "save lookup stays scoped to authenticated owner");
  const missing = await server.handleCharacterProgressRequest(load, userId, characterId);
  assert.deepEqual(missing, { requestId: "load-1", type: "rejected", code: "UNAVAILABLE" });
  const notReady = await server.handleCharacterProgressRequest(save, userId, characterId, double);
  assert.deepEqual(notReady, { requestId: "save-1", type: "rejected", code: "NOT_READY" });
  const saved = await server.handleCharacterProgressRequest(save, userId, characterId, double, loaded.progress);
  assert.equal(saved.type, "saved", "test-double save succeeds");
  assert.equal(calls.at(-2)[0], "save");
  assert.equal(calls.at(-2)[1], userId);
  assert.equal(calls.at(-2)[2], characterId);
  assert.equal(calls.at(-2)[4], createHash("sha256").update(`${userId}:${characterId}:save-1`).digest("hex"), "idempotency key is server-derived");
  assert.equal(calls.at(-2)[5], progress.updated_at, "expected timestamp is server authoritative");
  assert.equal((await server.handleCharacterProgressRequest(save, userId, characterId, double, { ...progress, updated_at: "stale" })).type, "rejected", "stale version rejected");
  assert.equal(fakeWrites, 1, "stale request causes no write");
  const concurrencySql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261015000000_character_progress_concurrency.sql"), "utf8");
  assert.match(concurrencySql, /p_user_id\s+UUID[\s\S]*p_expected_updated_at\s+TIMESTAMPTZ/i);
  assert.match(concurrencySql, /user_id\s*=\s*p_user_id[\s\S]*FOR UPDATE/i);
  assert.match(concurrencySql, /updated_at\s+IS DISTINCT FROM\s+p_expected_updated_at/i);
  assert.match(concurrencySql, /IS DISTINCT FROM\s+'service_role'/i);
  assert.match(concurrencySql, /REVOKE ALL ON FUNCTION public\.save_character_progress\(UUID, INT, INT, INT, TEXT, JSONB, TEXT\)[^;]*service_role/i);

  const { SignJWT, generateKeyPair, exportJWK } = await import("jose");
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "m5-runtime-check", alg: "RS256", use: "sig" };
  const jwks = createServer((_request, response) => { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ keys: [jwk] })); });
  await new Promise(resolve => jwks.listen(0, "127.0.0.1", resolve));
  const authUrl = `http://127.0.0.1:${jwks.address().port}`;
  const envKeys = ["SUPABASE_URL", "SUPABASE_JWT_JWKS_URL", "SUPABASE_JWT_AUDIENCE"];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  let gameServer;
  let legacyRoom;
  try {
    process.env.SUPABASE_URL = authUrl;
    process.env.SUPABASE_JWT_JWKS_URL = `${authUrl}/auth/v1/.well-known/jwks.json`;
    process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
    gameServer = server.createGameServer();
    await gameServer.listen(0, "127.0.0.1");
    const token = await new SignJWT({ role: "authenticated" }).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setSubject(userId).setIssuer(`${authUrl}/auth/v1`).setAudience("authenticated").setIssuedAt().setExpirationTime("2m").sign(privateKey);
    const endpoint = `http://127.0.0.1:${gameServer.transport.server.address().port}`;
    legacyRoom = await new Client(endpoint).joinOrCreate(server.ROOM_NAME, { authorization: `Bearer ${token}`, characterId: `char-${userId}` });
    const legacyReject = new Promise(resolve => legacyRoom.onMessage("character_progress", resolve));
    legacyRoom.send("character_progress", { type: "load", requestId: "legacy-load" });
    assert.deepEqual(await legacyReject, { requestId: "legacy-load", type: "rejected", code: "NOT_FOUND" }, "legacy SDK join succeeds but progress stays unbound");
  } finally {
    await legacyRoom?.leave(true);
    await gameServer?.gracefullyShutdown(false);
    await new Promise(resolve => jwks.close(resolve));
    for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
  console.log("M5 runtime self-check passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
