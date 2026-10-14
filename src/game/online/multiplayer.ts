/**
 * TrÃ² chÆ¡i: Tháº§n Má»‡nh â€” Háº­u Duá»‡ VÄƒn Lang
 * Multiplayer Client Adapter (M2 Client Online Boundary)
 *
 * Adapter phÃ²ng chÆ¡i qua WebSocket vá»›i nguyÃªn táº¯c Fail-Closed:
 * - KhÃ´ng cÃ³ dependency báº¯t buá»™c lÃªn server tháº­t khi cháº¡y offline (hoáº¡t Ä‘á»™ng an toÃ n khi thiáº¿u VITE_GAME_SERVER_URL).
 * - Validate toÃ n bá»™ gÃ³i tin xuáº¥t (outgoing intents) trÆ°á»›c khi gá»­i qua máº¡ng.
 * - Bounded payload (giá»›i háº¡n kÃ­ch thÆ°á»›c gÃ³i tin).
 * - Theo dÃµi tráº¡ng thÃ¡i káº¿t ná»‘i cháº·t cháº½ (ConnectionState).
 * - Xá»­ lÃ½ snapshots, rejects, server events tá»« server cÃ³ tháº©m quyá»n (authoritative).
 * - Tuyá»‡t Ä‘á»‘i khÃ´ng coi client state lÃ  tháº©m quyá»n; chá»‰ lÆ°u trá»¯ báº£n sao Ä‘á»c tá»« snapshot server.
 * - KhÃ´ng log token, secret hay thÃ´ng tin nháº¡y cáº£m.
 */

import { Client, type Room } from 'colyseus.js';

import {
  type ClientIntent,
  type ServerMessage,
  type ServerSnapshotMessage,
  type ServerRejectMessage,
  type ServerEventMessage,
  type ServerGameplayEvent,
  type ServerPlayerState,
  type ServerMonsterState,
  PROTOCOL_VERSION,
  MAX_MESSAGE_BYTES,
  validateClientIntent,
  deserializeServerMessage,
  createRoomJoinIntent,
  createMoveInputIntent,
  createAttackIntent,
  createCastSkillIntent,
  createDodgeIntent,
  createInteractIntent,
  deepFreeze,
} from './protocol';

export type ConnectionStatus =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface MultiplayerConnectionState {
  readonly status: ConnectionStatus;
  readonly roomId: string | null;
  readonly characterId: string | null;
  readonly latencyMs: number;
  readonly serverTick: number;
  readonly lastSnapshotTime: number;
  readonly message: string;
  readonly configured: boolean;
}

export interface GameServerConfig {
  readonly serverUrl: string;
}

export interface RoomConnectOptions {
  readonly roomId: string;
  readonly characterId: string;
  readonly token?: string;
  readonly serverUrl?: string;
}

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: any) => any) | null;
  onmessage: ((event: any) => any) | null;
  onerror: ((event: any) => any) | null;
  onclose: ((event: any) => any) | null;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export function readGameServerConfig(
  env: Record<string, unknown> = ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {})
): GameServerConfig | null {
  const url = typeof env.VITE_GAME_SERVER_URL === 'string' ? env.VITE_GAME_SERVER_URL.trim() : '';
  if (!url || !/^(ws|wss):\/\//i.test(url)) return null;
  return Object.freeze({ serverUrl: url });
}

export class MultiplayerAdapter {
  private config: GameServerConfig | null;
  private room: Room | null = null;

  private connState: MultiplayerConnectionState;
  private seqCounter = 0;
  private sentTimestamps = new Map<number, number>();

  // Authoritative server state (Read-only on client)
  private currentSnapshot: Readonly<ServerSnapshotMessage> | null = null;
  private playerMap = new Map<string, Readonly<ServerPlayerState>>();
  private monsterMap = new Map<string, Readonly<ServerMonsterState>>();

  // Metrics
  private rejectedCount = 0;
  private lastServerReject: Readonly<ServerRejectMessage> | null = null;

  // Listeners
  private stateListeners = new Set<(state: MultiplayerConnectionState) => void>();
  private snapshotListeners = new Set<(snapshot: ServerSnapshotMessage) => void>();
  private rejectListeners = new Set<(reject: ServerRejectMessage) => void>();
  private eventListeners = new Set<(event: ServerGameplayEvent) => void>();
  private errorListeners = new Set<(error: string) => void>();

  constructor(
    config: GameServerConfig | null = readGameServerConfig(),
    _socketFactory?: WebSocketFactory
  ) {
    this.config = config;
    this.connState = Object.freeze({
      status: config ? 'disconnected' : 'offline',
      roomId: null,
      characterId: null,
      latencyMs: 0,
      serverTick: 0,
      lastSnapshotTime: 0,
      message: config
        ? 'Cháº¿ Ä‘á»™ máº¡ng sáºµn sÃ ng káº¿t ná»‘i.'
        : 'Cháº¿ Ä‘á»™ máº¡ng táº¡m táº¯t: chÆ°a cáº¥u hÃ¬nh VITE_GAME_SERVER_URL. Äang cháº¡y cháº¿ Ä‘á»™ Offline an toÃ n.',
      configured: !!config,
    });
  }

  // ============================================================================
  // PUBLIC ACCESSORS (Strictly Read-Only / Server-Authoritative)
  // ============================================================================

  get state(): Readonly<MultiplayerConnectionState> {
    return this.connState;
  }

  get isConfigured(): boolean {
    return this.connState.configured;
  }

  get isConnected(): boolean {
    return this.connState.status === 'connected' && this.room !== null;
  }

  get isAuthoritative(): boolean {
    // Client is NEVER authoritative. Server is always the single source of truth.
    return false;
  }

  get latestSnapshot(): Readonly<ServerSnapshotMessage> | null {
    return this.currentSnapshot;
  }

  get serverTick(): number {
    return this.connState.serverTick;
  }

  get rejectedIntentsCount(): number {
    return this.rejectedCount;
  }

  get lastReject(): Readonly<ServerRejectMessage> | null {
    return this.lastServerReject;
  }

  getRemotePlayer(id: string): Readonly<ServerPlayerState> | null {
    return this.playerMap.get(id) ?? null;
  }

  getAllRemotePlayers(): readonly Readonly<ServerPlayerState>[] {
    return Object.freeze(Array.from(this.playerMap.values()));
  }

  getAllMonsters(): readonly Readonly<ServerMonsterState>[] {
    return Object.freeze(Array.from(this.monsterMap.values()));
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Connect to a game server room.
   * Fail-closed: If no server URL is provided or available, returns false gracefully.
   */
  async connect(options: RoomConnectOptions): Promise<boolean> {
    const targetUrl = options.serverUrl || this.config?.serverUrl;
    if (!targetUrl) { this.setConnectionState({ status: 'offline', message: 'Kh?ng th? k?t n?i: thi?u URL m?y ch? (VITE_GAME_SERVER_URL). Ti?p t?c ch?i offline.' }); return false; }
    this.closeRoom();
    this.setConnectionState({ status: 'connecting', roomId: options.roomId, characterId: options.characterId, message: `?ang k?t n?i t?i ph?ng ${options.roomId}...` });
    try {
      const client = new Client(targetUrl.replace(/\/+$/, ''));
      const room = await client.joinOrCreate('than-menh.v1', { authorization: options.token ? `Bearer ${options.token}` : undefined, roomId: options.roomId, characterId: options.characterId });
      this.room = room;
      room.onMessage('snapshot', (message: unknown) => this.handleIncomingMessage(message));
      room.onMessage('reject', (message: unknown) => this.handleIncomingMessage(message));
      room.onMessage('event', (message: unknown) => this.handleIncomingMessage(message));
      room.onError((code: number, message?: string) => this.notifyError(`L?i k?t n?i m?y ch? (${code}): ${message}`));
      room.onLeave((code: number, _reason?: string) => { this.room = null; this.setConnectionState({ status: 'disconnected', message: `?? ng?t k?t n?i m?y ch? (${code}).` }); if (code !== 1000) this.notifyError(`M?t k?t n?i m?y ch?: m? ${code}`); });
      this.setConnectionState({ status: 'connected', message: `?? k?t n?i ph?ng ${options.roomId}.` }); return true;
    } catch { this.room = null; this.setConnectionState({ status: 'error', message: 'Kh?ng th? thi?t l?p k?t n?i t?i m?y ch?.' }); return false; }
  }

  disconnect(code = 1000, reason = 'Client disconnect'): void {
    this.closeRoom(code, reason);
    this.setConnectionState({
      status: 'disconnected',
      roomId: null,
      characterId: null,
      message: 'ÄÃ£ chá»§ Ä‘á»™ng ngáº¯t káº¿t ná»‘i.',
    });
  }

  destroy(): void {
    this.disconnect();
    this.stateListeners.clear();
    this.snapshotListeners.clear();
    this.rejectListeners.clear();
    this.eventListeners.clear();
    this.errorListeners.clear();
    this.playerMap.clear();
    this.monsterMap.clear();
    this.currentSnapshot = null;
  }

  // ============================================================================
  // OUTGOING INTENTS (Validated, bounded, fail-closed)
  // ============================================================================

  sendIntent(intent: ClientIntent): boolean {
    if (!this.isConnected || !this.room) {
      return false;
    }
    return this.dispatchRawIntent(intent);
  }

  sendMove(moveX: number, moveY: number, aimWorldX?: number, aimWorldY?: number): boolean {
    const seq = ++this.seqCounter;
    this.sentTimestamps.set(seq, Date.now());
    const intent = createMoveInputIntent(seq, moveX, moveY, aimWorldX, aimWorldY);
    return this.sendIntent(intent);
  }

  sendAttack(comboIndex = 0, targetEntityId?: string, aimWorldX?: number, aimWorldY?: number): boolean {
    const seq = ++this.seqCounter;
    this.sentTimestamps.set(seq, Date.now());
    const intent = createAttackIntent(seq, comboIndex, aimWorldX, aimWorldY, targetEntityId);
    return this.sendIntent(intent);
  }

  sendCastSkill(skillId: string, targetEntityId?: string, targetX?: number, targetY?: number): boolean {
    const seq = ++this.seqCounter;
    this.sentTimestamps.set(seq, Date.now());
    const intent = createCastSkillIntent(seq, skillId, targetEntityId, targetX, targetY);
    return this.sendIntent(intent);
  }

  sendDodge(directionX: number, directionY: number): boolean {
    const seq = ++this.seqCounter;
    this.sentTimestamps.set(seq, Date.now());
    const intent = createDodgeIntent(seq, directionX, directionY);
    return this.sendIntent(intent);
  }

  sendInteract(targetId: string, interactionType?: string): boolean {
    const seq = ++this.seqCounter;
    this.sentTimestamps.set(seq, Date.now());
    const intent = createInteractIntent(seq, targetId, interactionType);
    return this.sendIntent(intent);
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  onStateChange(listener: (state: MultiplayerConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.connState);
    return () => this.stateListeners.delete(listener);
  }

  onSnapshot(listener: (snapshot: ServerSnapshotMessage) => void): () => void {
    this.snapshotListeners.add(listener);
    if (this.currentSnapshot) listener(this.currentSnapshot);
    return () => this.snapshotListeners.delete(listener);
  }

  onReject(listener: (reject: ServerRejectMessage) => void): () => void {
    this.rejectListeners.add(listener);
    return () => this.rejectListeners.delete(listener);
  }

  onEvent(listener: (event: ServerGameplayEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onError(listener: (error: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  // ============================================================================
  // INTERNAL HANDLERS
  // ============================================================================

  private dispatchRawIntent(intent: ClientIntent): boolean {
    const validation = validateClientIntent(intent);
    if (!validation.ok || !validation.value || !this.room) { if (this.room) this.notifyError(`Client intent validation failed: ${validation.error}`); return false; }
    const value = validation.value;
    let serverIntent: Record<string, unknown>;
    switch (value.type) { case 'move_input': serverIntent = { type: 'move', x: value.moveX, y: value.moveY }; break; case 'attack': case 'cast_skill': case 'dodge': serverIntent = { ...value }; break; default: this.notifyError('Intent type is not supported by the game server.'); return false; }
    try { this.room.send('intent', serverIntent); return true; } catch { this.notifyError('Failed to send intent.'); return false; }
  }

  private handleIncomingMessage(rawData: unknown): void {
    const serialized = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
    if (!serialized) return;
    const result = deserializeServerMessage(serialized);
    if (!result.ok || !result.value) {
      this.notifyError(`Malformed server packet: ${result.error}`);
      return;
    }

    const message: ServerMessage = result.value;
    switch (message.type) {
      case 'snapshot':
        this.applySnapshot(message);
        break;
      case 'reject':
        this.applyReject(message);
        break;
      case 'event':
        this.applyEvent(message);
        break;
    }
  }

  private applySnapshot(snapshot: ServerSnapshotMessage): void {
    this.currentSnapshot = snapshot;

    // Measure RTT latency if ackSeq matches an outstanding input
    const sentTime = this.sentTimestamps.get(snapshot.ackSeq);
    let latency = this.connState.latencyMs;
    if (sentTime) {
      latency = Math.max(0, Date.now() - sentTime);
      // Clean up old tracked sequences
      for (const k of this.sentTimestamps.keys()) {
        if (k <= snapshot.ackSeq) this.sentTimestamps.delete(k);
      }
    }

    // Update authoritative caches
    this.playerMap.clear();
    for (const player of snapshot.players) {
      this.playerMap.set(player.id, player);
    }

    this.monsterMap.clear();
    for (const monster of snapshot.monsters) {
      this.monsterMap.set(monster.id, monster);
    }

    this.setConnectionState({
      serverTick: snapshot.serverTick,
      latencyMs: latency,
      lastSnapshotTime: snapshot.serverTimestamp,
    });

    for (const listener of this.snapshotListeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener isolation
      }
    }
  }

  private applyReject(reject: ServerRejectMessage): void {
    this.rejectedCount++;
    this.lastServerReject = reject;

    for (const listener of this.rejectListeners) {
      try {
        listener(reject);
      } catch {
        // Listener isolation
      }
    }
  }

  private applyEvent(eventMsg: ServerEventMessage): void {
    for (const listener of this.eventListeners) {
      try {
        listener(eventMsg.event);
      } catch {
        // Listener isolation
      }
    }
  }

  private closeRoom(_code = 1000, _reason = 'Client disconnect'): void {
    if (!this.room) return;
    const room = this.room; this.room = null;
    try { void room.leave(true); } catch { /* ignore room close failure */ }
  }

  private setConnectionState(next: Partial<MultiplayerConnectionState>): void {
    this.connState = deepFreeze({ ...this.connState, ...next });
    for (const listener of this.stateListeners) {
      try {
        listener(this.connState);
      } catch {
        // Listener isolation
      }
    }
  }

  private notifyError(message: string): void {
    // Redact sensitive patterns if any
    const safeMessage = message.replace(/(token|Bearer)\s*[:=]\s*['"]?[a-zA-Z0-9._-]+['"]?/gi, '$1=[REDACTED]');
    for (const listener of this.errorListeners) {
      try {
        listener(safeMessage);
      } catch {
        // Listener isolation
      }
    }
  }
}

export const MultiplayerClient = MultiplayerAdapter;
export const multiplayer = new MultiplayerAdapter();

