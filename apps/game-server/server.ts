import { MapSchema, Schema, type } from "@colyseus/schema";
import { Room, Server, WebSocketTransport, type Client } from "@colyseus/colyseus";
import express, { type Request, type Response } from "express";
import { createMinigameRouter } from "./minigames/routes.js";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { CharacterRepository, type CharacterProgressWrite } from "./characterRepository.js";

export const ROOM_NAME = "than-menh.v1";
export const TICK_RATE = 25;
const MAX_INTENT_AXIS = 1;
const MAX_SPEED = 6;
const MAX_COMBO = 3;
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_MP = 100;
const ENEMY_MAX_HP = 120;
const ATTACK_COOLDOWN_TICKS = 8;
const SKILL_COOLDOWN_TICKS = 20;
const DODGE_COOLDOWN_TICKS = 15;
const DODGE_TICKS = 5;

export type MoveIntent = { type: "move"; x: number; y: number };
export type AttackIntent = { type: "attack"; seq: number; comboIndex: number; targetEntityId?: string };
export type CastSkillIntent = { type: "cast_skill"; seq: number; skillId: string; targetEntityId?: string };
export type DodgeIntent = { type: "dodge"; seq: number; directionX: number; directionY: number };
export type CombatIntent = AttackIntent | CastSkillIntent | DodgeIntent;
export type AuthClaims = JWTPayload & { sub: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARTY_ACTIONS = ["create", "invite", "accept", "decline", "leave", "kick", "transfer_leader", "disband"] as const;
export type PartyAction = typeof PARTY_ACTIONS[number];
export type PartyIntent = { action: PartyAction; requestId: string; targetUserId?: string; partyId?: string };

export function validatePartyIntent(value: unknown): PartyIntent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.some((key) => !["action", "requestId", "targetUserId", "partyId"].includes(key))) return null;
  if (!(PARTY_ACTIONS as readonly string[]).includes(input.action as string)) return null;
  if (typeof input.requestId !== "string" || input.requestId.length < 1 || input.requestId.length > 64 || !/^[A-Za-z0-9:_-]+$/.test(input.requestId)) return null;
  if (input.targetUserId !== undefined && (typeof input.targetUserId !== "string" || !UUID.test(input.targetUserId))) return null;
  if (input.partyId !== undefined && (typeof input.partyId !== "string" || input.partyId.length < 1 || input.partyId.length > 64 || !/^[A-Za-z0-9-]+$/.test(input.partyId))) return null;
  const action = input.action as PartyAction;
  if (["invite", "kick", "transfer_leader"].includes(action) && input.targetUserId === undefined) return null;
  if (["accept", "decline"].includes(action) && input.partyId === undefined) return null;
  return { action, requestId: input.requestId, ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}), ...(input.partyId ? { partyId: input.partyId } : {}) };
}

type PartyRecord = { leaderId: string; members: Set<string>; invites: Map<string, { partyId: string; leaderId: string }> };
export class PartyRegistry {
  private parties = new Map<string, PartyRecord>();
  private users = new Map<string, string>();
  handle(userId: string, intent: PartyIntent): { ok: boolean; partyId?: string; code?: string } {
    const current = this.users.get(userId);
    if (intent.action === "create") {
      if (current) return { ok: false, code: "ALREADY_IN_PARTY" };
      const partyId = randomUUID(); this.parties.set(partyId, { leaderId: userId, members: new Set([userId]), invites: new Map() }); this.users.set(userId, partyId!); return { ok: true, partyId: partyId! };
    }
    const partyId = intent.partyId ?? current;
    const party = partyId ? this.parties.get(partyId) : undefined;
    if (intent.action === "accept") {
      if (!party) return { ok: false, code: "UNKNOWN_PARTY" };
      if (!party.invites.has(userId)) return { ok: false, code: "NOT_INVITED" };
      if (current || party.members.size >= 4) return { ok: false, code: current ? "ALREADY_IN_PARTY" : "PARTY_FULL" };
      party.invites.delete(userId); party.members.add(userId); this.users.set(userId, partyId!); return { ok: true, partyId: partyId! };
    }
    if (intent.action === "decline") { if (!party || !party.invites.delete(userId)) return { ok: false, code: "NOT_INVITED" }; return { ok: true, partyId }; }
    if (!party) return { ok: false, code: "NOT_IN_PARTY" };
    if (intent.action === "leave") { if (!party.members.delete(userId)) return { ok: false, code: "NOT_IN_PARTY" }; this.users.delete(userId); if (!party.members.size) this.parties.delete(partyId!); else if (party.leaderId === userId) party.leaderId = [...party.members][0]; return { ok: true, partyId }; }
    if (!party.members.has(userId)) return { ok: false, code: "NOT_IN_PARTY" };
    if (intent.action === "invite") { if (party.leaderId !== userId) return { ok: false, code: "LEADER_ONLY" }; const target = intent.targetUserId!; if (this.users.has(target) || party.members.has(target)) return { ok: false, code: "TARGET_IN_PARTY" }; party.invites.set(target, { partyId: partyId!, leaderId: userId }); return { ok: true, partyId }; }
    if (party.leaderId !== userId) return { ok: false, code: "LEADER_ONLY" };
    const target = intent.targetUserId;
    if (intent.action === "kick") { if (!target || !party.members.delete(target)) return { ok: false, code: "TARGET_NOT_MEMBER" }; this.users.delete(target); return { ok: true, partyId }; }
    if (intent.action === "transfer_leader") { if (!target || !party.members.has(target)) return { ok: false, code: "TARGET_NOT_MEMBER" }; party.leaderId = target; return { ok: true, partyId }; }
    if (intent.action === "disband") { for (const member of party.members) this.users.delete(member); this.parties.delete(partyId!); return { ok: true, partyId: partyId! }; }
    return { ok: false, code: "MALFORMED" };
  }
  canJoin(userId: string, partyId: string) { const party = this.parties.get(partyId); return !!party && party.members.has(userId); }
  snapshot(userId: string) { const partyId = this.users.get(userId); const party = partyId ? this.parties.get(partyId) : undefined; const invites = [...this.parties.values()].flatMap((p) => p.invites.get(userId) ? [p.invites.get(userId)!] : []); return { type: "party_snapshot" as const, partyId: partyId ?? null, leaderId: party?.leaderId ?? null, members: party ? [...party.members] : [], invites }; }
  recipients(partyId: string) { const party = this.parties.get(partyId); return party ? [...party.members, ...party.invites.keys()] : []; }
  recipientsForUser(userId: string) { const partyId = this.users.get(userId); return partyId ? this.recipients(partyId) : [userId]; }
}

export function extractBearer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^Bearer ([^\s]+)$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function validateMoveIntent(value: unknown): MoveIntent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.type !== "move" || typeof input.x !== "number" || typeof input.y !== "number") return null;
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return null;
  if (Math.abs(input.x) > MAX_INTENT_AXIS || Math.abs(input.y) > MAX_INTENT_AXIS) return null;
  return { type: "move", x: input.x, y: input.y };
}

function safeId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{1,64}$/.test(value) ? value : undefined;
}

export function validateCombatIntent(value: unknown): CombatIntent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (["damage", "gold", "hp", "mp", "maxHp", "authority"].some((key) => key in input)) return null;
  if (!Number.isInteger(input.seq) || (input.seq as number) < 0 || (input.seq as number) > 2 ** 31 - 1) return null;
  const target = input.targetEntityId === undefined ? undefined : safeId(input.targetEntityId);
  if (input.targetEntityId !== undefined && !target) return null;
  if (input.type === "attack") {
    if (!Number.isInteger(input.comboIndex) || (input.comboIndex as number) < 0 || (input.comboIndex as number) > MAX_COMBO) return null;
    return { type: "attack", seq: input.seq as number, comboIndex: input.comboIndex as number, ...(target ? { targetEntityId: target } : {}) };
  }
  if (input.type === "cast_skill") {
    if (!safeId(input.skillId) || (input.skillId as string).length > 32) return null;
    return { type: "cast_skill", seq: input.seq as number, skillId: input.skillId as string, ...(target ? { targetEntityId: target } : {}) };
  }
  if (input.type === "dodge") {
    if (typeof input.directionX !== "number" || typeof input.directionY !== "number" || !Number.isFinite(input.directionX) || !Number.isFinite(input.directionY)) return null;
    if (Math.abs(input.directionX) > 1 || Math.abs(input.directionY) > 1) return null;
    return { type: "dodge", seq: input.seq as number, directionX: input.directionX, directionY: input.directionY };
  }
  return null;
}

export function calculateDamage(intent: AttackIntent | CastSkillIntent): number {
  if (intent.type === "attack") return 10 + intent.comboIndex * 2;
  return intent.skillId === "flame" ? 24 : intent.skillId === "water" ? 18 : 12;
}

export function createReject(intentType: string, code: string, reason: string, seq?: number) {
  return { type: "reject" as const, ...(seq === undefined ? {} : { seq }), intentType, code, reason, serverTimestamp: Date.now() };
}

function jwksUrl(): URL {
  const explicit = process.env.SUPABASE_JWT_JWKS_URL?.trim();
  if (explicit) return new URL(explicit);
  const base = process.env.SUPABASE_URL?.trim();
  if (!base) throw new Error("SUPABASE_JWT_JWKS_URL or SUPABASE_URL is required");
  return new URL(`${base.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`);
}

export function createJwtVerifier() {
  const audience = process.env.SUPABASE_JWT_AUDIENCE?.trim();
  if (!audience) throw new Error("SUPABASE_JWT_AUDIENCE is required");
  const issuer = process.env.SUPABASE_URL?.trim()
    ? `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`
    : undefined;
  const keys = createRemoteJWKSet(jwksUrl());
  return async (authorization: unknown): Promise<AuthClaims> => {
    const token = extractBearer(authorization);
    if (!token) throw new Error("missing bearer token");
    const result = await jwtVerify(token, keys, { audience, ...(issuer ? { issuer } : {}) });
    if (typeof result.payload.sub !== "string" || !UUID.test(result.payload.sub)) throw new Error("token subject missing");
    return result.payload as AuthClaims;
  };
}

export class PlayerState extends Schema {
  @type("string") userId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = PLAYER_MAX_HP;
  @type("number") maxHp = PLAYER_MAX_HP;
  @type("number") mp = PLAYER_MAX_MP;
  @type("number") maxMp = PLAYER_MAX_MP;
  @type("number") attackCooldownUntil = 0;
  @type("number") dodgeCooldownUntil = 0;
  @type("number") dodgeUntil = 0;
  @type("string") state = "idle";
}

export class EnemyState extends Schema {
  @type("string") id = "training:0";
  @type("number") x = 4;
  @type("number") y = 0;
  @type("number") hp = ENEMY_MAX_HP;
  @type("number") maxHp = ENEMY_MAX_HP;
  @type("string") state = "idle";
  @type("string") targetPlayerId = "";
}

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
}

type Session = { userId: string; characterId?: string; progress?: import("./characterRepository.js").CharacterProgress; progressBusy?: boolean; intent: MoveIntent; lastSeq: number };
type ProgressRepository = Pick<CharacterRepository, "load" | "save">;
const PROGRESS_CHANNEL = "character_progress";

export function validateCharacterId(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value : undefined;
}

export function validateCharacterProgressRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const requestId = typeof input.requestId === "string" && /^[A-Za-z0-9:_-]{1,64}$/.test(input.requestId) ? input.requestId : "";
  if ((input.type === "load" || input.type === "save") && Object.keys(input).length === 2 && requestId) return { type: input.type, requestId };
  return null;
}

export async function handleCharacterProgressRequest(value: unknown, userId: string, characterId: string | undefined, repository?: ProgressRepository, authoritativeProgress?: import("./characterRepository.js").CharacterProgress) {
  const requestId = value && typeof value === "object" && typeof (value as Record<string, unknown>).requestId === "string" && /^[A-Za-z0-9:_-]{1,64}$/.test((value as Record<string, unknown>).requestId as string) ? (value as Record<string, unknown>).requestId as string : "";
  const request = validateCharacterProgressRequest(value);
  const reject = (code: "INVALID_REQUEST" | "UNAVAILABLE" | "NOT_READY" | "NOT_FOUND" | "PERSISTENCE_FAILED") => ({ requestId, type: "rejected" as const, code });
  if (!request) return reject("INVALID_REQUEST");
  if (!characterId || !UUID.test(characterId) || !UUID.test(userId)) return reject("NOT_FOUND");
  if (!repository) return reject("UNAVAILABLE");
  const safeProgress = (progress: unknown) => {
    if (!progress || typeof progress !== "object") return null;
    const p = progress as Record<string, unknown>;
    if (p.id !== characterId || typeof p.id !== "string" || !Number.isInteger(p.level) || (p.level as number) < 1 || (p.level as number) > 99 || !Number.isInteger(p.xp) || (p.xp as number) < 0 || !Number.isInteger(p.gold) || (p.gold as number) < 0 || typeof p.checkpoint !== "string" || p.checkpoint.length > 128 || !Array.isArray(p.inventory)) return null;
    try { if (JSON.stringify(p.inventory).length > 16_384) return null; } catch { return null; }
    if (typeof p.updated_at !== "string" || p.updated_at.length > 64) return null;
    return { id: p.id, level: p.level as number, xp: p.xp as number, gold: p.gold as number, checkpoint: p.checkpoint, inventory: p.inventory, updated_at: p.updated_at };
  };
  try {
    if (request.type === "load") {
      const progress = await repository.load(userId, characterId);
      const safe = safeProgress(progress);
      return safe ? { requestId: request.requestId, type: "loaded" as const, progress: safe } : reject("NOT_FOUND");
    }
    if (!authoritativeProgress) return reject("NOT_READY");
    if (authoritativeProgress.id !== characterId) return reject("NOT_READY");
    const { level, xp, gold, checkpoint, inventory } = authoritativeProgress;
    const write: CharacterProgressWrite = { level, xp, gold, checkpoint, inventory };
    const idempotencyKey = createHash("sha256").update(`${userId}:${characterId}:${request.requestId}`).digest("hex");
    const result = await repository.save(userId, characterId, write, idempotencyKey, authoritativeProgress.updated_at);
    const safe = safeProgress(result.progress);
    return safe ? { requestId: request.requestId, type: "saved" as const, progress: safe } : reject("PERSISTENCE_FAILED");
  } catch {
    return reject("PERSISTENCE_FAILED");
  }
}

export class PlayerRoom extends Room<{ state: WorldState }> {
  maxClients = 64;
  private sessions = new Map<string, Session>();
  private parties = new PartyRegistry();
  private partyRequests = new Map<string, Set<string>>();
  private progressRepository?: CharacterRepository;

  onCreate() {
    this.setState(new WorldState());
    const url = process.env.SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url && serviceKey) {
      try { this.progressRepository = new CharacterRepository(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })); }
      catch { this.progressRepository = undefined; }
    }
    this.state.enemies.set("training:0", new EnemyState());
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs), 1000 / TICK_RATE);
    this.onMessage("intent", (client, message) => {
      const move = validateMoveIntent(message);
      if (move) { const session = this.sessions.get(client.sessionId); if (session) session.intent = move; return; }
      const combat = validateCombatIntent(message);
      if (combat) this.handleCombat(client, combat);
      else this.reject(client, (message && typeof message === "object" && "type" in message) ? String((message as { type?: unknown }).type) : "unknown", "MALFORMED", "invalid combat intent");
    });
    this.onMessage("party_intent", (client, message) => this.handleParty(client, message));
    this.onMessage(PROGRESS_CHANNEL, (client, message) => {
      const session = this.sessions.get(client.sessionId);
      if (!session) { client.send(PROGRESS_CHANNEL, { requestId: "", type: "rejected", code: "INVALID_REQUEST" }); return; }
      const request = validateCharacterProgressRequest(message);
      if (session.progressBusy) { client.send(PROGRESS_CHANNEL, { requestId: request?.requestId ?? "", type: "rejected", code: "BUSY" }); return; }
      session.progressBusy = true;
      void handleCharacterProgressRequest(message, session.userId, session.characterId, this.progressRepository, session.progress)
        .then((response) => {
          if (this.sessions.get(client.sessionId) !== session) return;
          if (response.type === "loaded" || response.type === "saved") session.progress = response.progress;
          client.send(PROGRESS_CHANNEL, response);
        }).finally(() => { if (this.sessions.get(client.sessionId) === session) session.progressBusy = false; });
    });
  }

  async onAuth(_client: Client, options: unknown): Promise<AuthClaims> {
    const authorization = options && typeof options === "object"
      ? (options as Record<string, unknown>).authorization
      : undefined;
    return createJwtVerifier()(authorization);
  }

  onJoin(client: Client, options: unknown, auth: AuthClaims) {
    const characterId = options && typeof options === "object" ? (options as Record<string, unknown>).characterId : undefined;
    const boundCharacterId = validateCharacterId(characterId);
    const partyId = options && typeof options === "object" ? (options as Record<string, unknown>).partyId : undefined;
    if (partyId !== undefined && (typeof partyId !== "string" || !this.parties.canJoin(auth.sub, partyId))) throw new Error("unauthorized party");
    const player = new PlayerState();
    player.userId = auth.sub;
    this.state.players.set(client.sessionId, player);
    this.sessions.set(client.sessionId, { userId: auth.sub, ...(boundCharacterId ? { characterId: boundCharacterId } : {}), intent: { type: "move", x: 0, y: 0 }, lastSeq: -1 });
  }

  onLeave(client: Client) {
    const session = this.sessions.get(client.sessionId);
    if (session) { const result = this.parties.handle(session.userId, { action: "leave", requestId: `leave:${client.sessionId}` }); if (result.partyId) this.sendPartySnapshots(result.partyId); }
    this.sessions.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private handleParty(client: Client, value: unknown) {
    const intent = validatePartyIntent(value); const session = this.sessions.get(client.sessionId);
    if (!intent || !session) { client.send("party_reject", { type: "party_reject", requestId: "", code: "MALFORMED" }); return; }
    let seen = this.partyRequests.get(client.sessionId); if (!seen) { seen = new Set(); this.partyRequests.set(client.sessionId, seen); }
    if (seen.has(intent.requestId)) return; seen.add(intent.requestId); if (seen.size > 256) seen.delete(seen.values().next().value!);
    const notify = new Set(this.parties.recipientsForUser(session.userId));
    const result = this.parties.handle(session.userId, intent);
    if (!result.ok) { client.send("party_reject", { type: "party_reject", requestId: intent.requestId, code: result.code ?? "REJECTED" }); return; }
    if (result.partyId) { if (intent.action !== "create") for (const userId of this.parties.recipients(result.partyId)) notify.add(userId); this.sendPartyUsers(notify); } else client.send("party_snapshot", this.parties.snapshot(session.userId));
  }

  private sendPartyUsers(users: Set<string>) {
    for (const [sessionId, session] of this.sessions) if (users.has(session.userId)) this.clients.find((c) => c.sessionId === sessionId)?.send("party_snapshot", this.parties.snapshot(session.userId));
  }

  private sendPartySnapshots(partyId: string) {
    const recipients = new Set(this.parties.recipients(partyId));
    for (const [sessionId, session] of this.sessions) if (recipients.has(session.userId)) this.clients.find((c) => c.sessionId === sessionId)?.send("party_snapshot", this.parties.snapshot(session.userId));
  }

  private reject(client: Client, intentType: string, code: string, reason: string, seq?: number) {
    const session = this.sessions.get(client.sessionId);
    if (seq !== undefined && session && seq <= session.lastSeq) return;
    if (seq !== undefined && session) session.lastSeq = seq;
    client.send("reject", createReject(intentType, code, reason, seq));
  }

  private handleCombat(client: Client, intent: CombatIntent) {
    const session = this.sessions.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    const enemy = this.state.enemies.get("training:0");
    if (!session || !player || !enemy) return;
    if (intent.seq <= session.lastSeq) { this.reject(client, intent.type, "MALFORMED", "duplicate sequence", intent.seq); return; }
    session.lastSeq = intent.seq;
    const targetId = "targetEntityId" in intent ? intent.targetEntityId : undefined;
    if (targetId && targetId !== enemy.id) { this.reject(client, intent.type, "INVALID_TARGET", "unknown target", intent.seq); return; }
    if (intent.type === "dodge") {
      if (this.tickCount < player.dodgeCooldownUntil) { this.reject(client, intent.type, "ON_COOLDOWN", "dodge cooldown", intent.seq); return; }
      player.dodgeCooldownUntil = this.tickCount + DODGE_COOLDOWN_TICKS; player.dodgeUntil = this.tickCount + DODGE_TICKS; player.state = "dodge";
      return;
    }
    if (this.tickCount < player.attackCooldownUntil) { this.reject(client, intent.type, "ON_COOLDOWN", "attack cooldown", intent.seq); return; }
    if (intent.type === "cast_skill" && player.mp < 10) { this.reject(client, intent.type, "INSUFFICIENT_MP", "insufficient mp", intent.seq); return; }
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > 6) { this.reject(client, intent.type, "OUT_OF_BOUNDS", "target out of range", intent.seq); return; }
    const amount = calculateDamage(intent); enemy.hp = Math.max(0, enemy.hp - amount); enemy.targetPlayerId = client.sessionId; enemy.state = enemy.hp === 0 ? "dead" : "hit";
    if (intent.type === "cast_skill") player.mp -= 10;
    player.attackCooldownUntil = this.tickCount + (intent.type === "cast_skill" ? SKILL_COOLDOWN_TICKS : ATTACK_COOLDOWN_TICKS); player.state = intent.type === "cast_skill" ? "skill" : "attack";
    this.broadcast("event", { type: "event", serverTick: this.tickCount, serverTimestamp: Date.now(), event: { kind: "damage_dealt", sourceId: client.sessionId, targetId: enemy.id, amount, isCritical: false, newHp: enemy.hp } });
  }

  private tickCount = 0;

  private tick(deltaMs: number) {
    this.tickCount += 1;
    const dt = Math.min(deltaMs, 100) / 1000;
    for (const [sessionId, session] of this.sessions) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      player.x += session.intent.x * MAX_SPEED * dt;
      player.y += session.intent.y * MAX_SPEED * dt;
      player.state = this.tickCount < player.dodgeUntil ? "dodge" : session.intent.x || session.intent.y ? "walk" : "idle";
    }
    const players = [...this.state.players.values()].map((p) => ({ id: p.userId, characterId: p.userId, name: p.userId, x: p.x, y: p.y, vx: 0, vy: 0, facing: "right" as const, state: p.state as "idle", hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, level: 1 }));
    const monsters = [...this.state.enemies.values()].map((e) => ({ id: e.id, monsterType: "training", x: e.x, y: e.y, vx: 0, vy: 0, facing: "left" as const, hp: e.hp, maxHp: e.maxHp, state: e.state as "idle", targetPlayerId: e.targetPlayerId || null }));
    this.broadcast("snapshot", { type: "snapshot", serverTick: this.tickCount, serverTimestamp: Date.now(), ackSeq: 0, players, monsters });
  }
}

export function createGameServer() {
  const server = new Server({
    transport: new WebSocketTransport(),
    express: (app) => {
      app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id");
        if (req.method === "OPTIONS") {
          res.sendStatus(204);
          return;
        }
        next();
      });
      app.use(express.json());
      app.get("/health", (_req: Request, res: Response) => { res.status(200).json({ ok: true, room: ROOM_NAME }); });
      let verifier: ReturnType<typeof createJwtVerifier> | undefined;
      try {
        if (process.env.SUPABASE_JWT_AUDIENCE) {
          verifier = createJwtVerifier();
        }
      } catch {
        // Verifier unavailable
      }
      app.use("/api/minigames", createMinigameRouter(verifier));
    },
    greet: false,
  });
  server.define(ROOM_NAME, PlayerRoom);
  return server;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number(process.env.PORT ?? 2567);
  createGameServer().listen(port).then(() => console.log(`game-server listening on ${port}`));
}
