import { MapSchema, Schema, type } from "@colyseus/schema";
import { Room, Server, WebSocketTransport, type Client } from "@colyseus/colyseus";
import type { Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

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
    if (typeof result.payload.sub !== "string" || !result.payload.sub) throw new Error("token subject missing");
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

type Session = { userId: string; intent: MoveIntent; lastSeq: number };

export class PlayerRoom extends Room<{ state: WorldState }> {
  maxClients = 64;
  private sessions = new Map<string, Session>();

  onCreate() {
    this.setState(new WorldState());
    this.state.enemies.set("training:0", new EnemyState());
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs), 1000 / TICK_RATE);
    this.onMessage("intent", (client, message) => {
      const move = validateMoveIntent(message);
      if (move) { const session = this.sessions.get(client.sessionId); if (session) session.intent = move; return; }
      const combat = validateCombatIntent(message);
      if (combat) this.handleCombat(client, combat);
      else this.reject(client, (message && typeof message === "object" && "type" in message) ? String((message as { type?: unknown }).type) : "unknown", "MALFORMED", "invalid combat intent");
    });
  }

  async onAuth(_client: Client, options: unknown): Promise<AuthClaims> {
    const authorization = options && typeof options === "object"
      ? (options as Record<string, unknown>).authorization
      : undefined;
    return createJwtVerifier()(authorization);
  }

  onJoin(client: Client, _options: unknown, auth: AuthClaims) {
    const player = new PlayerState();
    player.userId = auth.sub;
    this.state.players.set(client.sessionId, player);
    this.sessions.set(client.sessionId, { userId: auth.sub, intent: { type: "move", x: 0, y: 0 }, lastSeq: -1 });
  }

  onLeave(client: Client) {
    this.sessions.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
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
    express: (app) => { app.get("/health", (_req: Request, res: Response) => { res.status(200).json({ ok: true, room: ROOM_NAME }); }); },
    greet: false,
  });
  server.define(ROOM_NAME, PlayerRoom);
  return server;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number(process.env.PORT ?? 2567);
  createGameServer().listen(port).then(() => console.log(`game-server listening on ${port}`));
}



