/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Authoritative Snapshot Adapter (M3 Client Online Boundary)
 *
 * Client-side adapter for server-authoritative world snapshots:
 * - Consumes validated snapshots and server events without treating client state as authority.
 * - Enforces deep immutability on all remote state caches.
 * - Provides an interpolation buffer and interpolation-friendly immutable snapshot queries.
 * - Exposes minimal remote player and enemy/monster state subscriptions.
 * - Guarantees fail-closed offline safety, listener isolation, and clean disconnect reset.
 */

import {
  type ServerSnapshotMessage,
  type ServerPlayerState,
  type ServerMonsterState,
  type ServerProjectileState,
  type ServerGameplayEvent,
  type ServerRejectMessage,
  validateServerMessage,
  deepFreeze,
} from './protocol';

export interface InterpolationSnapshot extends ServerSnapshotMessage {
  readonly clientReceiveTime: number;
}

export interface InterpolationPair {
  readonly from: Readonly<InterpolationSnapshot> | null;
  readonly to: Readonly<InterpolationSnapshot> | null;
  readonly alpha: number;
}

export interface InterpolatedEntityPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facing: 'left' | 'right';
  readonly state: string;
  readonly hp: number;
  readonly maxHp: number;
}

export interface SnapshotAdapterOptions {
  readonly bufferCapacity?: number;
  readonly interpolationDelayMs?: number;
}

export function interpolatePosition(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  alpha: number
): { x: number; y: number } {
  const clampedAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  return {
    x: fromX + (toX - fromX) * clampedAlpha,
    y: fromY + (toY - fromY) * clampedAlpha,
  };
}

export class SnapshotAdapter {
  private readonly bufferCapacity: number;
  private readonly interpolationDelayMs: number;

  private buffer: InterpolationSnapshot[] = [];
  private currentSnapshot: Readonly<InterpolationSnapshot> | null = null;
  private prevSnapshot: Readonly<InterpolationSnapshot> | null = null;

  private playerMap = new Map<string, Readonly<ServerPlayerState>>();
  private monsterMap = new Map<string, Readonly<ServerMonsterState>>();

  // Listeners with strict listener isolation
  private snapshotListeners = new Set<(snapshot: Readonly<InterpolationSnapshot> | null) => void>();
  private remotePlayersListeners = new Set<(players: readonly Readonly<ServerPlayerState>[]) => void>();
  private singlePlayerListeners = new Map<string, Set<(player: Readonly<ServerPlayerState> | null) => void>>();
  private enemiesListeners = new Set<(enemies: readonly Readonly<ServerMonsterState>[]) => void>();
  private singleEnemyListeners = new Map<string, Set<(enemy: Readonly<ServerMonsterState> | null) => void>>();
  private eventListeners = new Set<(event: ServerGameplayEvent) => void>();
  private rejectListeners = new Set<(reject: ServerRejectMessage) => void>();

  constructor(options: SnapshotAdapterOptions = {}) {
    this.bufferCapacity = Math.max(2, Math.min(64, options.bufferCapacity ?? 16));
    this.interpolationDelayMs = Math.max(0, options.interpolationDelayMs ?? 50);
  }

  // ============================================================================
  // PUBLIC ACCESSORS (Strictly Read-Only / Server-Authoritative)
  // ============================================================================

  get isAuthoritative(): boolean {
    // Client state is NEVER authoritative. Server is always the single source of truth.
    return false;
  }

  get latestSnapshot(): Readonly<InterpolationSnapshot> | null {
    return this.currentSnapshot;
  }

  get previousSnapshot(): Readonly<InterpolationSnapshot> | null {
    return this.prevSnapshot;
  }

  get serverTick(): number {
    return this.currentSnapshot?.serverTick ?? 0;
  }

  get lastSnapshotTime(): number {
    return this.currentSnapshot?.serverTimestamp ?? 0;
  }

  getSnapshotBuffer(): readonly Readonly<InterpolationSnapshot>[] {
    return Object.freeze([...this.buffer]);
  }

  getRemotePlayer(id: string): Readonly<ServerPlayerState> | null {
    return this.playerMap.get(id) ?? null;
  }

  getAllRemotePlayers(): readonly Readonly<ServerPlayerState>[] {
    return Object.freeze(Array.from(this.playerMap.values()));
  }

  getMonster(id: string): Readonly<ServerMonsterState> | null {
    return this.monsterMap.get(id) ?? null;
  }

  getAllMonsters(): readonly Readonly<ServerMonsterState>[] {
    return Object.freeze(Array.from(this.monsterMap.values()));
  }

  // ============================================================================
  // INTERPOLATION HELPERS
  // ============================================================================

  getInterpolationPair(renderTime?: number): InterpolationPair {
    if (this.buffer.length === 0) {
      return Object.freeze({ from: null, to: null, alpha: 1 });
    }
    if (this.buffer.length === 1) {
      return Object.freeze({ from: this.buffer[0], to: this.buffer[0], alpha: 1 });
    }

    const targetTime = renderTime !== undefined ? renderTime : (Date.now() - this.interpolationDelayMs);

    const earliest = this.buffer[0];
    if (targetTime <= earliest.serverTimestamp) {
      return Object.freeze({ from: earliest, to: this.buffer[1] ?? earliest, alpha: 0 });
    }

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const s0 = this.buffer[i];
      const s1 = this.buffer[i + 1];
      if (targetTime >= s0.serverTimestamp && targetTime <= s1.serverTimestamp) {
        const span = s1.serverTimestamp - s0.serverTimestamp;
        const alpha = span > 0 ? (targetTime - s0.serverTimestamp) / span : 1;
        return Object.freeze({ from: s0, to: s1, alpha: Math.max(0, Math.min(1, alpha)) });
      }
    }

    const latest = this.buffer[this.buffer.length - 1];
    const prev = this.buffer[this.buffer.length - 2] ?? latest;
    return Object.freeze({ from: prev, to: latest, alpha: 1 });
  }

  interpolatePlayer(id: string, alphaOrRenderTime?: number): InterpolatedEntityPosition | null {
    const player = this.playerMap.get(id);
    if (!player) return null;

    let fromPlayer: Readonly<ServerPlayerState> | undefined = player;
    let toPlayer: Readonly<ServerPlayerState> | undefined = player;
    let alpha = 1;

    if (alphaOrRenderTime !== undefined && alphaOrRenderTime >= 0 && alphaOrRenderTime <= 1) {
      alpha = alphaOrRenderTime;
      fromPlayer = this.prevSnapshot?.players.find((p) => p.id === id) ?? player;
      toPlayer = this.currentSnapshot?.players.find((p) => p.id === id) ?? player;
    } else {
      const pair = this.getInterpolationPair(alphaOrRenderTime);
      fromPlayer = pair.from?.players.find((p) => p.id === id) ?? toPlayer;
      toPlayer = pair.to?.players.find((p) => p.id === id) ?? fromPlayer;
      alpha = pair.alpha;
    }

    if (!fromPlayer && !toPlayer) return null;
    const base = toPlayer ?? fromPlayer!;
    const start = fromPlayer ?? toPlayer!;
    const pos = interpolatePosition(start.x, start.y, base.x, base.y, alpha);

    return Object.freeze({
      id: base.id,
      x: pos.x,
      y: pos.y,
      facing: base.facing,
      state: base.state,
      hp: base.hp,
      maxHp: base.maxHp,
    });
  }

  interpolateMonster(id: string, alphaOrRenderTime?: number): InterpolatedEntityPosition | null {
    const monster = this.monsterMap.get(id);
    if (!monster) return null;

    let fromMonster: Readonly<ServerMonsterState> | undefined = monster;
    let toMonster: Readonly<ServerMonsterState> | undefined = monster;
    let alpha = 1;

    if (alphaOrRenderTime !== undefined && alphaOrRenderTime >= 0 && alphaOrRenderTime <= 1) {
      alpha = alphaOrRenderTime;
      fromMonster = this.prevSnapshot?.monsters.find((m) => m.id === id) ?? monster;
      toMonster = this.currentSnapshot?.monsters.find((m) => m.id === id) ?? monster;
    } else {
      const pair = this.getInterpolationPair(alphaOrRenderTime);
      fromMonster = pair.from?.monsters.find((m) => m.id === id) ?? toMonster;
      toMonster = pair.to?.monsters.find((m) => m.id === id) ?? fromMonster;
      alpha = pair.alpha;
    }

    if (!fromMonster && !toMonster) return null;
    const base = toMonster ?? fromMonster!;
    const start = fromMonster ?? toMonster!;
    const pos = interpolatePosition(start.x, start.y, base.x, base.y, alpha);

    return Object.freeze({
      id: base.id,
      x: pos.x,
      y: pos.y,
      facing: base.facing,
      state: base.state,
      hp: base.hp,
      maxHp: base.maxHp,
    });
  }

  // ============================================================================
  // INGESTION (Authoritative Server State Only)
  // ============================================================================

  applySnapshot(rawSnapshot: unknown, receiveTime = Date.now()): Readonly<InterpolationSnapshot> | null {
    let snapshot: ServerSnapshotMessage;
    if (
      rawSnapshot &&
      typeof rawSnapshot === 'object' &&
      (rawSnapshot as any).type === 'snapshot' &&
      Array.isArray((rawSnapshot as any).players)
    ) {
      const validation = validateServerMessage(rawSnapshot);
      if (!validation.ok || !validation.value || validation.value.type !== 'snapshot') {
        return null;
      }
      snapshot = validation.value;
    } else {
      return null;
    }

    const immutableSnapshot: InterpolationSnapshot = deepFreeze({
      type: 'snapshot' as const,
      serverTick: snapshot.serverTick,
      serverTimestamp: snapshot.serverTimestamp,
      clientReceiveTime: receiveTime,
      ackSeq: snapshot.ackSeq,
      players: snapshot.players,
      monsters: snapshot.monsters,
      projectiles: snapshot.projectiles,
    });

    this.prevSnapshot = this.currentSnapshot;
    this.currentSnapshot = immutableSnapshot;

    this.buffer.push(immutableSnapshot);
    if (this.buffer.length > this.bufferCapacity) {
      this.buffer.shift();
    }

    this.playerMap.clear();
    for (const p of immutableSnapshot.players) {
      this.playerMap.set(p.id, p);
    }

    this.monsterMap.clear();
    for (const m of immutableSnapshot.monsters) {
      this.monsterMap.set(m.id, m);
    }

    const playersList = this.getAllRemotePlayers();
    const monstersList = this.getAllMonsters();

    for (const listener of this.snapshotListeners) {
      try {
        listener(immutableSnapshot);
      } catch {
        // Listener isolation
      }
    }

    for (const listener of this.remotePlayersListeners) {
      try {
        listener(playersList);
      } catch {
        // Listener isolation
      }
    }

    for (const [id, listeners] of this.singlePlayerListeners) {
      const p = this.playerMap.get(id) ?? null;
      for (const listener of listeners) {
        try {
          listener(p);
        } catch {
          // Listener isolation
        }
      }
    }

    for (const listener of this.enemiesListeners) {
      try {
        listener(monstersList);
      } catch {
        // Listener isolation
      }
    }

    for (const [id, listeners] of this.singleEnemyListeners) {
      const m = this.monsterMap.get(id) ?? null;
      for (const listener of listeners) {
        try {
          listener(m);
        } catch {
          // Listener isolation
        }
      }
    }

    return immutableSnapshot;
  }

  applyEvent(eventMsgOrPayload: unknown): void {
    let event: ServerGameplayEvent | null = null;
    if (eventMsgOrPayload && typeof eventMsgOrPayload === 'object') {
      const raw = eventMsgOrPayload as Record<string, unknown>;
      if (raw.type === 'event' && raw.event && typeof raw.event === 'object') {
        const val = validateServerMessage(raw);
        if (val.ok && val.value && val.value.type === 'event') {
          event = val.value.event;
        }
      } else if (typeof raw.kind === 'string') {
        event = raw as unknown as ServerGameplayEvent;
      }
    }

    if (!event) return;
    const frozenEvent = deepFreeze(event);

    if (frozenEvent.kind === 'player_left') {
      this.playerMap.delete(frozenEvent.playerId);
      const singleListeners = this.singlePlayerListeners.get(frozenEvent.playerId);
      if (singleListeners) {
        for (const l of singleListeners) {
          try {
            l(null);
          } catch {
            // Listener isolation
          }
        }
      }
      const updatedPlayers = this.getAllRemotePlayers();
      for (const l of this.remotePlayersListeners) {
        try {
          l(updatedPlayers);
        } catch {
          // Listener isolation
        }
      }
    }

    for (const listener of this.eventListeners) {
      try {
        listener(frozenEvent);
      } catch {
        // Listener isolation
      }
    }
  }

  applyReject(rejectMsg: unknown): void {
    if (!rejectMsg || typeof rejectMsg !== 'object') return;
    const val = validateServerMessage(rejectMsg);
    if (!val.ok || !val.value || val.value.type !== 'reject') return;
    const frozenReject = deepFreeze(val.value);

    for (const listener of this.rejectListeners) {
      try {
        listener(frozenReject);
      } catch {
        // Listener isolation
      }
    }
  }

  clear(): void {
    this.buffer = [];
    this.currentSnapshot = null;
    this.prevSnapshot = null;
    this.playerMap.clear();
    this.monsterMap.clear();

    for (const listener of this.snapshotListeners) {
      try {
        listener(null);
      } catch {
        // Listener isolation
      }
    }

    for (const listener of this.remotePlayersListeners) {
      try {
        listener([]);
      } catch {
        // Listener isolation
      }
    }

    for (const [, listeners] of this.singlePlayerListeners) {
      for (const listener of listeners) {
        try {
          listener(null);
        } catch {
          // Listener isolation
        }
      }
    }

    for (const listener of this.enemiesListeners) {
      try {
        listener([]);
      } catch {
        // Listener isolation
      }
    }

    for (const [, listeners] of this.singleEnemyListeners) {
      for (const listener of listeners) {
        try {
          listener(null);
        } catch {
          // Listener isolation
        }
      }
    }
  }

  destroy(): void {
    this.clear();
    this.snapshotListeners.clear();
    this.remotePlayersListeners.clear();
    this.singlePlayerListeners.clear();
    this.enemiesListeners.clear();
    this.singleEnemyListeners.clear();
    this.eventListeners.clear();
    this.rejectListeners.clear();
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  onSnapshot(listener: (snapshot: Readonly<InterpolationSnapshot> | null) => void): () => void {
    this.snapshotListeners.add(listener);
    if (this.currentSnapshot) {
      try {
        listener(this.currentSnapshot);
      } catch {
        // Listener isolation
      }
    }
    return () => this.snapshotListeners.delete(listener);
  }

  onRemotePlayers(listener: (players: readonly Readonly<ServerPlayerState>[]) => void): () => void {
    this.remotePlayersListeners.add(listener);
    try {
      listener(this.getAllRemotePlayers());
    } catch {
      // Listener isolation
    }
    return () => this.remotePlayersListeners.delete(listener);
  }

  onRemotePlayer(id: string, listener: (player: Readonly<ServerPlayerState> | null) => void): () => void {
    let set = this.singlePlayerListeners.get(id);
    if (!set) {
      set = new Set();
      this.singlePlayerListeners.set(id, set);
    }
    set.add(listener);
    try {
      listener(this.getRemotePlayer(id));
    } catch {
      // Listener isolation
    }
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.singlePlayerListeners.delete(id);
      }
    };
  }

  onEnemies(listener: (enemies: readonly Readonly<ServerMonsterState>[]) => void): () => void {
    this.enemiesListeners.add(listener);
    try {
      listener(this.getAllMonsters());
    } catch {
      // Listener isolation
    }
    return () => this.enemiesListeners.delete(listener);
  }

  onEnemy(id: string, listener: (enemy: Readonly<ServerMonsterState> | null) => void): () => void {
    let set = this.singleEnemyListeners.get(id);
    if (!set) {
      set = new Set();
      this.singleEnemyListeners.set(id, set);
    }
    set.add(listener);
    try {
      listener(this.getMonster(id));
    } catch {
      // Listener isolation
    }
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.singleEnemyListeners.delete(id);
      }
    };
  }

  onEvent(listener: (event: ServerGameplayEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onReject(listener: (reject: ServerRejectMessage) => void): () => void {
    this.rejectListeners.add(listener);
    return () => this.rejectListeners.delete(listener);
  }
}

export const AuthoritativeSnapshotAdapter = SnapshotAdapter;
