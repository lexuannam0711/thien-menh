const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const { Client } = require('colyseus.js');

function nextMessage(room, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Timed out waiting for ' + type)); }, 5000);
    const unsubscribe = room.onMessage(type, message => {
      if (!predicate(message)) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(message);
    });
  });
}

async function main() {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'apps/game-server/tsconfig.json'], { stdio: 'inherit' });
  const { SignJWT, generateKeyPair, exportJWK } = await import('jose');
  const { createGameServer, ROOM_NAME, WorldState, PlayerState, EnemyState } = await import('../dist/game-server/server.js');
  const { Encoder } = await import('@colyseus/schema');
  const state = new WorldState();
  state.players.set('fixture-player', new PlayerState());
  state.enemies.set('training:0', new EnemyState());
  const encoder = new Encoder(state);
  assert.ok(encoder.encodeAll().length > 0, 'actual schema state must initialize');
  state.players.set('wire-player', new PlayerState());
  assert.ok(encoder.encode().length > 0, 'server schema patches must encode after join');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'local-transport-check', alg: 'RS256', use: 'sig' };
  const jwks = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(resolve => jwks.listen(0, '127.0.0.1', resolve));
  const authUrl = 'http://127.0.0.1:' + jwks.address().port;
  const envKeys = ['SUPABASE_URL', 'SUPABASE_JWT_JWKS_URL', 'SUPABASE_JWT_AUDIENCE'];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  process.env.SUPABASE_URL = authUrl;
  process.env.SUPABASE_JWT_JWKS_URL = authUrl + '/auth/v1/.well-known/jwks.json';
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  const server = createGameServer();
  const rooms = [];
  try {
    await server.listen(0, '127.0.0.1');
    const endpoint = 'http://127.0.0.1:' + server.transport.server.address().port;
    const leaderId = '11111111-1111-4111-8111-111111111111';
    const memberId = '22222222-2222-4222-8222-222222222222';
    const tokens = await Promise.all([leaderId, memberId].map(userId => new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setSubject(userId)
      .setIssuer(authUrl + '/auth/v1').setAudience('authenticated')
      .setIssuedAt().setExpirationTime('2m').sign(privateKey)));
    await assert.rejects(() => new Client(endpoint).joinOrCreate(ROOM_NAME), 'unauthenticated join must fail');
    for (const token of tokens) {
      const room = await new Client(endpoint).joinOrCreate(ROOM_NAME, {
        authorization: 'Bearer ' + token, roomId: 'village-hub', characterId: 'forged-client-character',
      });
      rooms.push(room);
      room.onMessage('reject', () => {});
      room.onMessage('event', () => {});
      room.onMessage('party_snapshot', () => {});
      room.onMessage('party_reject', () => {});
      room.onMessage('snapshot', () => {});
    }
    assert.equal(rooms[0].roomId, rooms[1].roomId, 'both users join same authoritative room');
    const initial = await nextMessage(rooms[1], 'snapshot', message => message.players.length === 2);
    assert.deepEqual(initial.players.map(player => player.id).sort(), [leaderId, memberId]);
    rooms[0].send('intent', { type: 'move', x: 1, y: 0 });
    await nextMessage(rooms[1], 'snapshot', message => message.players.find(player => player.id === leaderId).x > 0);
    rooms[0].send('intent', { type: 'move', x: 0, y: 0 });
    const damage = nextMessage(rooms[1], 'snapshot', message => message.monsters[0].hp < initial.monsters[0].hp);
    rooms[0].send('intent', { type: 'attack', seq: 1, comboIndex: 1 });
    const damaged = await damage;
    assert.equal(damaged.monsters[0].hp, initial.monsters[0].hp - 12);
    const forgedReject = nextMessage(rooms[0], 'reject', message => message.code === 'MALFORMED');
    rooms[0].send('intent', { type: 'attack', seq: 2, comboIndex: 1, damage: 99999 });
    await forgedReject;
    const stable = nextMessage(rooms[1], 'snapshot', message => message.serverTick > damaged.serverTick + 10);
    rooms[0].send('intent', { type: 'attack', seq: 1, comboIndex: 1 });
    assert.equal((await stable).monsters[0].hp, damaged.monsters[0].hp, 'replay cannot deal damage again');
    const created = nextMessage(rooms[0], 'party_snapshot', message => message.members.includes(leaderId));
    rooms[0].send('party_intent', { action: 'create', requestId: 'create-1' });
    const party = await created;
    const invited = nextMessage(rooms[1], 'party_snapshot', message => message.invites.some(invite => invite.partyId === party.partyId));
    rooms[0].send('party_intent', { action: 'invite', requestId: 'invite-1', targetUserId: memberId });
    await invited;
    const accepted = nextMessage(rooms[0], 'party_snapshot', message => message.members.length === 2);
    rooms[1].send('party_intent', { action: 'accept', requestId: 'accept-1', partyId: party.partyId });
    await accepted;
    const cleared = nextMessage(rooms[1], 'party_snapshot', message => message.partyId === null);
    rooms[0].send('party_intent', { action: 'kick', requestId: 'kick-1', targetUserId: memberId });
    await cleared;
    console.log('Online transport check: PASS (real JWT/JWKS, two SDK clients, movement, combat, replay, party)');
  } finally {
    await Promise.allSettled(rooms.map(room => room.leave(true)));
    await server.gracefullyShutdown(false);
    await new Promise(resolve => jwks.close(resolve));
    for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
}

const watchdog = setTimeout(() => { console.error('Online transport check: global timeout'); process.exit(1); }, 30000);
main().catch(error => { console.error('Online transport check: FAIL', error.stack || error.message); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
