/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Network Protocol Contract (M2 Client Online Boundary)
 *
 * Định nghĩa hợp đồng mạng versioned, bất biến (immutable) giữa Client và Server.
 * Nguyên tắc bất di bất dịch:
 * - Server là thẩm quyền duy nhất (Server Authoritative).
 * - Client chỉ gửi ý định hành động (Intents) không chứa thẩm quyền (HP, MP, Damage, Gold, Kills,...).
 * - Toàn bộ dữ liệu được validate chặt chẽ, giới hạn dung lượng (bounded payload), fail-closed.
 */

export const PROTOCOL_VERSION = '1.0.0';
export const PROTOCOL_IDENTIFIER = 'than-menh.m2.v1';
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_STRING_LENGTH = 128;
export const MAX_ROOM_ID_LENGTH = 64;
export const MAX_ENTITY_ID_LENGTH = 64;
export const MAX_SKILL_ID_LENGTH = 32;

export const FORBIDDEN_CLIENT_AUTHORITY_FIELDS: readonly string[] = Object.freeze([
  'hp',
  'mp',
  'maxHp',
  'maxMp',
  'damage',
  'gold',
  'xp',
  'level',
  'kills',
  'isDead',
  'godMode',
  'authority',
  'serverTick',
  'grantGold',
  'grantXp',
  'grantItem',
]);

export type RejectCode =
  | 'MALFORMED'
  | 'OVERSIZED'
  | 'UNKNOWN_INTENT'
  | 'UNAUTHORIZED'
  | 'VERSION_MISMATCH'
  | 'OUT_OF_BOUNDS'
  | 'ON_COOLDOWN'
  | 'INSUFFICIENT_MP'
  | 'INVALID_TARGET'
  | 'STUNNED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export const REJECT_CODES: readonly RejectCode[] = Object.freeze([
  'MALFORMED',
  'OVERSIZED',
  'UNKNOWN_INTENT',
  'UNAUTHORIZED',
  'VERSION_MISMATCH',
  'OUT_OF_BOUNDS',
  'ON_COOLDOWN',
  'INSUFFICIENT_MP',
  'INVALID_TARGET',
  'STUNNED',
  'RATE_LIMITED',
  'SERVER_ERROR',
]);

// ============================================================================
// 1. CLIENT INTENTS (Client -> Server)
// Unauthoritative requests submitted by clients
// ============================================================================

export interface RoomJoinIntent {
  readonly type: 'room_join';
  readonly protocolVersion: string;
  readonly roomId: string;
  readonly characterId: string;
  readonly token?: string;
  readonly clientTimestamp: number;
}

export interface MoveInputIntent {
  readonly type: 'move_input';
  readonly seq: number;
  readonly moveX: number; // -1.0 to 1.0
  readonly moveY: number; // -1.0 to 1.0
  readonly aimWorldX?: number;
  readonly aimWorldY?: number;
  readonly clientTimestamp: number;
}

export interface AttackIntent {
  readonly type: 'attack';
  readonly seq: number;
  readonly comboIndex: number; // 0, 1, 2, 3
  readonly aimWorldX?: number;
  readonly aimWorldY?: number;
  readonly targetEntityId?: string;
  readonly clientTimestamp: number;
}

export interface CastSkillIntent {
  readonly type: 'cast_skill';
  readonly seq: number;
  readonly skillId: string;
  readonly targetEntityId?: string;
  readonly targetX?: number;
  readonly targetY?: number;
  readonly clientTimestamp: number;
}

export interface DodgeIntent {
  readonly type: 'dodge';
  readonly seq: number;
  readonly directionX: number; // -1.0 to 1.0
  readonly directionY: number; // -1.0 to 1.0
  readonly clientTimestamp: number;
}

export interface InteractIntent {
  readonly type: 'interact';
  readonly seq: number;
  readonly targetId: string;
  readonly interactionType?: string;
  readonly clientTimestamp: number;
}

export type ClientIntent =
  | RoomJoinIntent
  | MoveInputIntent
  | AttackIntent
  | CastSkillIntent
  | DodgeIntent
  | InteractIntent;

export type ClientIntentType = ClientIntent['type'];

export const CLIENT_INTENT_TYPES: readonly ClientIntentType[] = Object.freeze([
  'room_join',
  'move_input',
  'attack',
  'cast_skill',
  'dodge',
  'interact',
]);

// ============================================================================
// 2. SERVER AUTHORITATIVE STATE & MESSAGES (Server -> Client)
// ============================================================================

export interface ServerPlayerState {
  readonly id: string;
  readonly characterId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly facing: 'left' | 'right';
  readonly state: 'idle' | 'walk' | 'attack' | 'dodge' | 'skill' | 'hit' | 'dead';
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly level: number;
  readonly activeSkill?: string;
}

export interface ServerMonsterState {
  readonly id: string;
  readonly monsterType: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly facing: 'left' | 'right';
  readonly hp: number;
  readonly maxHp: number;
  readonly state: 'idle' | 'patrol' | 'chase' | 'attack' | 'hit' | 'dead';
  readonly targetPlayerId?: string | null;
}

export interface ServerProjectileState {
  readonly id: string;
  readonly ownerId: string;
  readonly projectileType: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface ServerSnapshotMessage {
  readonly type: 'snapshot';
  readonly serverTick: number;
  readonly serverTimestamp: number;
  readonly ackSeq: number;
  readonly players: readonly ServerPlayerState[];
  readonly monsters: readonly ServerMonsterState[];
  readonly projectiles?: readonly ServerProjectileState[];
}

export interface ServerRejectMessage {
  readonly type: 'reject';
  readonly seq?: number;
  readonly intentType: string;
  readonly code: RejectCode;
  readonly reason: string;
  readonly serverTimestamp: number;
}

export type ServerGameplayEvent =
  | { readonly kind: 'player_joined'; readonly playerId: string; readonly characterId: string; readonly name: string; readonly x: number; readonly y: number }
  | { readonly kind: 'player_left'; readonly playerId: string; readonly reason: string }
  | { readonly kind: 'damage_dealt'; readonly sourceId: string; readonly targetId: string; readonly amount: number; readonly isCritical: boolean; readonly newHp: number }
  | { readonly kind: 'skill_cast'; readonly casterId: string; readonly skillId: string; readonly x: number; readonly y: number }
  | { readonly kind: 'entity_died'; readonly entityId: string; readonly killerId?: string }
  | { readonly kind: 'boss_phase_change'; readonly bossId: string; readonly phase: number; readonly phaseName: string }
  | { readonly kind: 'item_spawned'; readonly dropId: string; readonly itemId: string; readonly x: number; readonly y: number }
  | { readonly kind: 'announcement'; readonly message: string; readonly level: 'info' | 'warn' | 'broadcast' };

export interface ServerEventMessage {
  readonly type: 'event';
  readonly serverTick: number;
  readonly serverTimestamp: number;
  readonly event: ServerGameplayEvent;
}

export type ServerMessage =
  | ServerSnapshotMessage
  | ServerRejectMessage
  | ServerEventMessage;

export type ServerMessageType = ServerMessage['type'];

export const SERVER_MESSAGE_TYPES: readonly ServerMessageType[] = Object.freeze([
  'snapshot',
  'reject',
  'event',
]);

// ============================================================================
// 3. VALIDATION UTILITIES & IMMUTABILITY
// ============================================================================

export interface ValidationResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: string;
  readonly code?: RejectCode;
}

export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    } else if (val !== null && typeof val === 'object') {
      // If container was frozen, its children might not be
      for (const childKey of Object.getOwnPropertyNames(val)) {
        const childVal = (val as Record<string, unknown>)[childKey];
        if (childVal !== null && typeof childVal === 'object' && !Object.isFrozen(childVal)) {
          deepFreeze(childVal);
        }
      }
    }
  }
  return Object.freeze(obj);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedString(value: unknown, minLen: number, maxLen: number): value is string {
  return typeof value === 'string' && value.length >= minLen && value.length <= maxLen;
}

function hasUnknownKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): string | null {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

/**
 * Validates outgoing client intents.
 * Rejects malformed payloads, oversized data, unknown fields, and ANY attempt
 * by client to claim authority (e.g. injecting hp, mp, damage, gold, xp, kills).
 */
export function validateClientIntent(payload: unknown): ValidationResult<ClientIntent> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Intent must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;

  // Check forbidden client authority injection
  for (const forbidden of FORBIDDEN_CLIENT_AUTHORITY_FIELDS) {
    if (forbidden in raw) {
      return {
        ok: false,
        error: `Client intent contains unauthorized authority field: "${forbidden}"`,
        code: 'UNAUTHORIZED',
      };
    }
  }

  const type = raw.type;
  if (typeof type !== 'string' || !(CLIENT_INTENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `Unknown or missing intent type: "${String(type)}"`, code: 'UNKNOWN_INTENT' };
  }

  // Size limit check
  try {
    const serialized = JSON.stringify(raw);
    if (new TextEncoder().encode(serialized).length > MAX_MESSAGE_BYTES) {
      return { ok: false, error: `Intent exceeds maximum size of ${MAX_MESSAGE_BYTES} bytes`, code: 'OVERSIZED' };
    }
  } catch {
    return { ok: false, error: 'Intent failed serialization size check', code: 'MALFORMED' };
  }

  switch (type as ClientIntentType) {
    case 'room_join': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'protocolVersion', 'roomId', 'characterId', 'token', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in room_join: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isBoundedString(raw.protocolVersion, 1, 32)) {
        return { ok: false, error: 'protocolVersion must be a non-empty string <= 32 chars', code: 'MALFORMED' };
      }
      if (!isBoundedString(raw.roomId, 1, MAX_ROOM_ID_LENGTH) || !/^[a-zA-Z0-9_-]+$/.test(raw.roomId)) {
        return { ok: false, error: 'roomId must be an alphanumeric identifier <= 64 chars', code: 'MALFORMED' };
      }
      if (!isBoundedString(raw.characterId, 1, MAX_ENTITY_ID_LENGTH)) {
        return { ok: false, error: 'characterId must be a non-empty string <= 64 chars', code: 'MALFORMED' };
      }
      if (raw.token !== undefined && (typeof raw.token !== 'string' || raw.token.length > 2048)) {
        return { ok: false, error: 'token must be string <= 2048 chars', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: RoomJoinIntent = {
        type: 'room_join',
        protocolVersion: raw.protocolVersion,
        roomId: raw.roomId,
        characterId: raw.characterId,
        ...(raw.token ? { token: raw.token } : {}),
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'move_input': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'seq', 'moveX', 'moveY', 'aimWorldX', 'aimWorldY', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in move_input: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isFiniteNumber(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.seq)) {
        return { ok: false, error: 'seq must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.moveX) || raw.moveX < -1.0 || raw.moveX > 1.0) {
        return { ok: false, error: 'moveX must be a number between -1.0 and 1.0', code: 'OUT_OF_BOUNDS' };
      }
      if (!isFiniteNumber(raw.moveY) || raw.moveY < -1.0 || raw.moveY > 1.0) {
        return { ok: false, error: 'moveY must be a number between -1.0 and 1.0', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.aimWorldX !== undefined && (!isFiniteNumber(raw.aimWorldX) || Math.abs(raw.aimWorldX) > 100000)) {
        return { ok: false, error: 'aimWorldX out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.aimWorldY !== undefined && (!isFiniteNumber(raw.aimWorldY) || Math.abs(raw.aimWorldY) > 100000)) {
        return { ok: false, error: 'aimWorldY out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: MoveInputIntent = {
        type: 'move_input',
        seq: raw.seq,
        moveX: Math.round(raw.moveX * 10000) / 10000,
        moveY: Math.round(raw.moveY * 10000) / 10000,
        ...(raw.aimWorldX !== undefined ? { aimWorldX: raw.aimWorldX } : {}),
        ...(raw.aimWorldY !== undefined ? { aimWorldY: raw.aimWorldY } : {}),
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'attack': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'seq', 'comboIndex', 'aimWorldX', 'aimWorldY', 'targetEntityId', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in attack: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isFiniteNumber(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.seq)) {
        return { ok: false, error: 'seq must be a non-negative integer', code: 'MALFORMED' };
      }
      const combo = raw.comboIndex ?? 0;
      if (!isFiniteNumber(combo) || !Number.isInteger(combo) || combo < 0 || combo > 3) {
        return { ok: false, error: 'comboIndex must be an integer between 0 and 3', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.aimWorldX !== undefined && (!isFiniteNumber(raw.aimWorldX) || Math.abs(raw.aimWorldX) > 100000)) {
        return { ok: false, error: 'aimWorldX out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.aimWorldY !== undefined && (!isFiniteNumber(raw.aimWorldY) || Math.abs(raw.aimWorldY) > 100000)) {
        return { ok: false, error: 'aimWorldY out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.targetEntityId !== undefined && !isBoundedString(raw.targetEntityId, 1, MAX_ENTITY_ID_LENGTH)) {
        return { ok: false, error: 'targetEntityId must be a string <= 64 chars', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: AttackIntent = {
        type: 'attack',
        seq: raw.seq,
        comboIndex: combo,
        ...(raw.aimWorldX !== undefined ? { aimWorldX: raw.aimWorldX } : {}),
        ...(raw.aimWorldY !== undefined ? { aimWorldY: raw.aimWorldY } : {}),
        ...(raw.targetEntityId ? { targetEntityId: raw.targetEntityId } : {}),
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'cast_skill': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'seq', 'skillId', 'targetEntityId', 'targetX', 'targetY', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in cast_skill: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isFiniteNumber(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.seq)) {
        return { ok: false, error: 'seq must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isBoundedString(raw.skillId, 1, MAX_SKILL_ID_LENGTH) || !/^[a-zA-Z0-9_-]+$/.test(raw.skillId)) {
        return { ok: false, error: 'skillId must be an identifier <= 32 chars', code: 'MALFORMED' };
      }
      if (raw.targetEntityId !== undefined && !isBoundedString(raw.targetEntityId, 1, MAX_ENTITY_ID_LENGTH)) {
        return { ok: false, error: 'targetEntityId must be string <= 64 chars', code: 'MALFORMED' };
      }
      if (raw.targetX !== undefined && (!isFiniteNumber(raw.targetX) || Math.abs(raw.targetX) > 100000)) {
        return { ok: false, error: 'targetX out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (raw.targetY !== undefined && (!isFiniteNumber(raw.targetY) || Math.abs(raw.targetY) > 100000)) {
        return { ok: false, error: 'targetY out of valid bounds', code: 'OUT_OF_BOUNDS' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: CastSkillIntent = {
        type: 'cast_skill',
        seq: raw.seq,
        skillId: raw.skillId,
        ...(raw.targetEntityId ? { targetEntityId: raw.targetEntityId } : {}),
        ...(raw.targetX !== undefined ? { targetX: raw.targetX } : {}),
        ...(raw.targetY !== undefined ? { targetY: raw.targetY } : {}),
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'dodge': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'seq', 'directionX', 'directionY', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in dodge: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isFiniteNumber(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.seq)) {
        return { ok: false, error: 'seq must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.directionX) || raw.directionX < -1.0 || raw.directionX > 1.0) {
        return { ok: false, error: 'directionX must be between -1.0 and 1.0', code: 'OUT_OF_BOUNDS' };
      }
      if (!isFiniteNumber(raw.directionY) || raw.directionY < -1.0 || raw.directionY > 1.0) {
        return { ok: false, error: 'directionY must be between -1.0 and 1.0', code: 'OUT_OF_BOUNDS' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: DodgeIntent = {
        type: 'dodge',
        seq: raw.seq,
        directionX: Math.round(raw.directionX * 10000) / 10000,
        directionY: Math.round(raw.directionY * 10000) / 10000,
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'interact': {
      const unknownKey = hasUnknownKeys(raw, ['type', 'seq', 'targetId', 'interactionType', 'clientTimestamp']);
      if (unknownKey) return { ok: false, error: `Unexpected field in interact: "${unknownKey}"`, code: 'MALFORMED' };

      if (!isFiniteNumber(raw.seq) || raw.seq < 0 || !Number.isInteger(raw.seq)) {
        return { ok: false, error: 'seq must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isBoundedString(raw.targetId, 1, MAX_ENTITY_ID_LENGTH)) {
        return { ok: false, error: 'targetId must be string <= 64 chars', code: 'MALFORMED' };
      }
      if (raw.interactionType !== undefined && !isBoundedString(raw.interactionType, 1, 32)) {
        return { ok: false, error: 'interactionType must be string <= 32 chars', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.clientTimestamp) || raw.clientTimestamp <= 0) {
        return { ok: false, error: 'clientTimestamp must be a positive finite number', code: 'MALFORMED' };
      }

      const validated: InteractIntent = {
        type: 'interact',
        seq: raw.seq,
        targetId: raw.targetId,
        ...(raw.interactionType ? { interactionType: raw.interactionType } : {}),
        clientTimestamp: raw.clientTimestamp,
      };
      return { ok: true, value: deepFreeze(validated) };
    }
  }
}

/**
 * Validates incoming server messages (Snapshots, Rejects, Events).
 */
export function validateServerMessage(payload: unknown): ValidationResult<ServerMessage> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Server message must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;
  const type = raw.type;
  if (typeof type !== 'string' || !(SERVER_MESSAGE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `Unknown server message type: "${String(type)}"`, code: 'MALFORMED' };
  }

  switch (type as ServerMessageType) {
    case 'snapshot': {
      if (!isFiniteNumber(raw.serverTick) || raw.serverTick < 0 || !Number.isInteger(raw.serverTick)) {
        return { ok: false, error: 'serverTick must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.serverTimestamp) || raw.serverTimestamp <= 0) {
        return { ok: false, error: 'serverTimestamp must be a positive finite number', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.ackSeq) || raw.ackSeq < 0 || !Number.isInteger(raw.ackSeq)) {
        return { ok: false, error: 'ackSeq must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!Array.isArray(raw.players)) {
        return { ok: false, error: 'players must be an array', code: 'MALFORMED' };
      }
      if (!Array.isArray(raw.monsters)) {
        return { ok: false, error: 'monsters must be an array', code: 'MALFORMED' };
      }

      const players: ServerPlayerState[] = [];
      for (const p of raw.players) {
        if (!p || typeof p !== 'object') return { ok: false, error: 'Invalid player in snapshot', code: 'MALFORMED' };
        const pr = p as Record<string, unknown>;
        if (typeof pr.id !== 'string' || typeof pr.characterId !== 'string' || typeof pr.name !== 'string' ||
            !isFiniteNumber(pr.x) || !isFiniteNumber(pr.y) || !isFiniteNumber(pr.hp) || !isFiniteNumber(pr.maxHp)) {
          return { ok: false, error: 'Malformed player fields in snapshot', code: 'MALFORMED' };
        }
        players.push(Object.freeze({
          id: pr.id,
          characterId: pr.characterId,
          name: pr.name,
          x: pr.x,
          y: pr.y,
          vx: isFiniteNumber(pr.vx) ? pr.vx : 0,
          vy: isFiniteNumber(pr.vy) ? pr.vy : 0,
          facing: pr.facing === 'left' ? 'left' : 'right',
          state: typeof pr.state === 'string' ? pr.state as ServerPlayerState['state'] : 'idle',
          hp: Math.max(0, pr.hp),
          maxHp: Math.max(1, pr.maxHp),
          mp: isFiniteNumber(pr.mp) ? Math.max(0, pr.mp) : 0,
          maxMp: isFiniteNumber(pr.maxMp) ? Math.max(1, pr.maxMp) : 100,
          level: isFiniteNumber(pr.level) ? Math.max(1, pr.level) : 1,
          ...(typeof pr.activeSkill === 'string' ? { activeSkill: pr.activeSkill } : {}),
        }));
      }

      const monsters: ServerMonsterState[] = [];
      for (const m of raw.monsters) {
        if (!m || typeof m !== 'object') return { ok: false, error: 'Invalid monster in snapshot', code: 'MALFORMED' };
        const mr = m as Record<string, unknown>;
        if (typeof mr.id !== 'string' || typeof mr.monsterType !== 'string' ||
            !isFiniteNumber(mr.x) || !isFiniteNumber(mr.y) || !isFiniteNumber(mr.hp) || !isFiniteNumber(mr.maxHp)) {
          return { ok: false, error: 'Malformed monster fields in snapshot', code: 'MALFORMED' };
        }
        monsters.push(Object.freeze({
          id: mr.id,
          monsterType: mr.monsterType,
          x: mr.x,
          y: mr.y,
          vx: isFiniteNumber(mr.vx) ? mr.vx : 0,
          vy: isFiniteNumber(mr.vy) ? mr.vy : 0,
          facing: mr.facing === 'left' ? 'left' : 'right',
          hp: Math.max(0, mr.hp),
          maxHp: Math.max(1, mr.maxHp),
          state: typeof mr.state === 'string' ? mr.state as ServerMonsterState['state'] : 'idle',
          targetPlayerId: typeof mr.targetPlayerId === 'string' ? mr.targetPlayerId : null,
        }));
      }

      let projectiles: ServerProjectileState[] | undefined;
      if (Array.isArray(raw.projectiles)) {
        projectiles = [];
        for (const proj of raw.projectiles) {
          if (!proj || typeof proj !== 'object') continue;
          const pr = proj as Record<string, unknown>;
          if (typeof pr.id === 'string' && typeof pr.ownerId === 'string' && typeof pr.projectileType === 'string' &&
              isFiniteNumber(pr.x) && isFiniteNumber(pr.y)) {
            projectiles.push(Object.freeze({
              id: pr.id,
              ownerId: pr.ownerId,
              projectileType: pr.projectileType,
              x: pr.x,
              y: pr.y,
              vx: isFiniteNumber(pr.vx) ? pr.vx : 0,
              vy: isFiniteNumber(pr.vy) ? pr.vy : 0,
            }));
          }
        }
      }

      const validated: ServerSnapshotMessage = {
        type: 'snapshot',
        serverTick: raw.serverTick,
        serverTimestamp: raw.serverTimestamp,
        ackSeq: raw.ackSeq,
        players: Object.freeze(players),
        monsters: Object.freeze(monsters),
        ...(projectiles ? { projectiles: Object.freeze(projectiles) } : {}),
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'reject': {
      if (typeof raw.intentType !== 'string' || !raw.intentType) {
        return { ok: false, error: 'reject intentType must be a non-empty string', code: 'MALFORMED' };
      }
      if (typeof raw.code !== 'string' || !(REJECT_CODES as readonly string[]).includes(raw.code)) {
        return { ok: false, error: 'reject code must be a valid RejectCode', code: 'MALFORMED' };
      }
      if (typeof raw.reason !== 'string' || raw.reason.length > 256) {
        return { ok: false, error: 'reject reason must be string <= 256 chars', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.serverTimestamp) || raw.serverTimestamp <= 0) {
        return { ok: false, error: 'reject serverTimestamp must be a positive number', code: 'MALFORMED' };
      }

      const validated: ServerRejectMessage = {
        type: 'reject',
        intentType: raw.intentType,
        code: raw.code as RejectCode,
        reason: raw.reason,
        serverTimestamp: raw.serverTimestamp,
        ...(isFiniteNumber(raw.seq) ? { seq: raw.seq } : {}),
      };
      return { ok: true, value: deepFreeze(validated) };
    }

    case 'event': {
      if (!isFiniteNumber(raw.serverTick) || raw.serverTick < 0 || !Number.isInteger(raw.serverTick)) {
        return { ok: false, error: 'serverTick must be a non-negative integer', code: 'MALFORMED' };
      }
      if (!isFiniteNumber(raw.serverTimestamp) || raw.serverTimestamp <= 0) {
        return { ok: false, error: 'serverTimestamp must be a positive number', code: 'MALFORMED' };
      }
      if (!raw.event || typeof raw.event !== 'object' || Array.isArray(raw.event)) {
        return { ok: false, error: 'event payload must be an object', code: 'MALFORMED' };
      }

      const ev = raw.event as Record<string, unknown>;
      if (typeof ev.kind !== 'string') {
        return { ok: false, error: 'event kind must be a string', code: 'MALFORMED' };
      }

      const validated: ServerEventMessage = {
        type: 'event',
        serverTick: raw.serverTick,
        serverTimestamp: raw.serverTimestamp,
        event: deepFreeze(ev as unknown as ServerGameplayEvent),
      };
      return { ok: true, value: deepFreeze(validated) };
    }
  }
}

// ============================================================================
// 4. FACTORY CONSTRUCTORS
// ============================================================================

export function createRoomJoinIntent(roomId: string, characterId: string, token?: string): RoomJoinIntent {
  return deepFreeze({
    type: 'room_join',
    protocolVersion: PROTOCOL_VERSION,
    roomId,
    characterId,
    ...(token ? { token } : {}),
    clientTimestamp: Date.now(),
  });
}

export function createMoveInputIntent(seq: number, moveX: number, moveY: number, aimWorldX?: number, aimWorldY?: number): MoveInputIntent {
  return deepFreeze({
    type: 'move_input',
    seq,
    moveX: Math.max(-1.0, Math.min(1.0, moveX)),
    moveY: Math.max(-1.0, Math.min(1.0, moveY)),
    ...(aimWorldX !== undefined ? { aimWorldX } : {}),
    ...(aimWorldY !== undefined ? { aimWorldY } : {}),
    clientTimestamp: Date.now(),
  });
}

export function createAttackIntent(seq: number, comboIndex = 0, aimWorldX?: number, aimWorldY?: number, targetEntityId?: string): AttackIntent {
  return deepFreeze({
    type: 'attack',
    seq,
    comboIndex: Math.max(0, Math.min(3, comboIndex)),
    ...(aimWorldX !== undefined ? { aimWorldX } : {}),
    ...(aimWorldY !== undefined ? { aimWorldY } : {}),
    ...(targetEntityId ? { targetEntityId } : {}),
    clientTimestamp: Date.now(),
  });
}

export function createCastSkillIntent(seq: number, skillId: string, targetEntityId?: string, targetX?: number, targetY?: number): CastSkillIntent {
  return deepFreeze({
    type: 'cast_skill',
    seq,
    skillId,
    ...(targetEntityId ? { targetEntityId } : {}),
    ...(targetX !== undefined ? { targetX } : {}),
    ...(targetY !== undefined ? { targetY } : {}),
    clientTimestamp: Date.now(),
  });
}

export function createDodgeIntent(seq: number, directionX: number, directionY: number): DodgeIntent {
  return deepFreeze({
    type: 'dodge',
    seq,
    directionX: Math.max(-1.0, Math.min(1.0, directionX)),
    directionY: Math.max(-1.0, Math.min(1.0, directionY)),
    clientTimestamp: Date.now(),
  });
}

export function createInteractIntent(seq: number, targetId: string, interactionType?: string): InteractIntent {
  return deepFreeze({
    type: 'interact',
    seq,
    targetId,
    ...(interactionType ? { interactionType } : {}),
    clientTimestamp: Date.now(),
  });
}

export function serializeIntent(intent: ClientIntent): { ok: true; data: string } | { ok: false; error: string; code: RejectCode } {
  const validated = validateClientIntent(intent);
  if (!validated.ok || !validated.value) {
    return { ok: false, error: validated.error ?? 'Validation failed', code: validated.code ?? 'MALFORMED' };
  }
  try {
    return { ok: true, data: JSON.stringify(validated.value) };
  } catch {
    return { ok: false, error: 'Serialization error', code: 'MALFORMED' };
  }
}

export function deserializeServerMessage(raw: string): ValidationResult<ServerMessage> {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES * 8) {
    return { ok: false, error: 'Oversized or invalid message format', code: 'OVERSIZED' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateServerMessage(parsed);
  } catch {
    return { ok: false, error: 'JSON parse error', code: 'MALFORMED' };
  }
}
