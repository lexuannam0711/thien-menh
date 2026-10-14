/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Multiplayer Client Adapter (M2 & M3 Client Online Boundary)
 *
 * Adapter phòng chơi qua WebSocket với nguyên tắc Fail-Closed:
 * - Không có dependency bắt buộc lên server thật khi chạy offline (hoạt động an toàn khi thiếu VITE_GAME_SERVER_URL).
 * - Validate toàn bộ gói tin xuất (outgoing intents) trước khi gửi qua mạng.
 * - Bounded payload (giới hạn kích thước gói tin).
 * - Theo dõi trạng thái kết nối chặt chẽ (ConnectionState).
 * - Xử lý snapshots, rejects, server events từ server có thẩm quyền (authoritative).
 * - Tuyệt đối không coi client state là thẩm quyền; chỉ lưu trữ bản sao đọc từ snapshot server.
 * - Không log token, secret hay thông tin nhạy cảm.
 * - Tích hợp Authoritative Snapshot Adapter (M3) với interpolation buffer và remote-player/enemy subscriptions.
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

import {
  SnapshotAdapter,
  AuthoritativeSnapshotAdapter,
  type InterpolationSnapshot,
  type InterpolationPair,
  type InterpolatedEntityPosition,
  type SnapshotAdapterOptions,
} from './snapshotAdapter';

export {
  SnapshotAdapter,
  AuthoritativeSnapshotAdapter,
  type InterpolationSnapshot,
  type InterpolationPair,
  type InterpolatedEntityPosition,
  type SnapshotAdapterOptions,
};

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

  // Authoritative server state adapter (M3 vertical slice)
  private readonly snapshotAdapterInstance: SnapshotAdapter;

  // Metrics
  private rejectedCount = 0;
  private lastServerReject: Readonly<ServerRejectMessage> | null = null;

  // Listeners
  private stateListeners = new Set<(state: MultiplayerConnectionState) => void>();
  private rejectListeners = new Set<(reject: ServerRejectMessage) => void>();
  private eventListeners = new Set<(event: ServerGameplayEvent) => void>();
  private errorListeners = new Set<(error: string) => void>();

  constructor(
    config: GameServerConfig | null = readGameServerConfig(),
    _socketFactory?: WebSocketFactory,
    snapshotOptions?: SnapshotAdapterOptions
  ) {
    this.config = config;
    this.snapshotAdapterInstance = new SnapshotAdapter(snapshotOptions);
    this.connState = Object.freeze({
      status: config ? 'disconnected' : 'offline',
      roomId: null,
      characterId: null,
      latencyMs: 0,
      serverTick: 0,
      lastSnapshotTime: 0,
      message: config
        ? 'Chế độ mạng sẵn sàng kết nối.'
        : 'Chế độ mạng tạm tắt: chưa cấu hình VITE_GAME_SERVER_URL. Đang chạy chế độ Offline an toàn.',
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

  get latestSnapshot(): Readonly<InterpolationSnapshot> | null {
    return this.snapshotAdapterInstance.latestSnapshot;
  }

  get previousSnapshot(): Readonly<InterpolationSnapshot> | null {
    return this.snapshotAdapterInstance.previousSnapshot;
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

  get snapshotAdapter(): SnapshotAdapter {
    return this.snapshotAdapterInstance;
  }

  get snapshots(): SnapshotAdapter {
    return this.snapshotAdapterInstance;
  }

  getRemotePlayer(id: string): Readonly<ServerPlayerState> | null {
    return this.snapshotAdapterInstance.getRemotePlayer(id);
  }

  getAllRemotePlayers(): readonly Readonly<ServerPlayerState>[] {
    return this.snapshotAdapterInstance.getAllRemotePlayers();
  }

  getAllMonsters(): readonly Readonly<ServerMonsterState>[] {
    return this.snapshotAdapterInstance.getAllMonsters();
  }

  getSnapshotBuffer(): readonly Readonly<InterpolationSnapshot>[] {
    return this.snapshotAdapterInstance.getSnapshotBuffer();
  }

  getInterpolationPair(renderTime?: number): InterpolationPair {
    return this.snapshotAdapterInstance.getInterpolationPair(renderTime);
  }

  interpolatePlayer(id: string, alphaOrRenderTime?: number): InterpolatedEntityPosition | null {
    return this.snapshotAdapterInstance.interpolatePlayer(id, alphaOrRenderTime);
  }

  interpolateMonster(id: string, alphaOrRenderTime?: number): InterpolatedEntityPosition | null {
    return this.snapshotAdapterInstance.interpolateMonster(id, alphaOrRenderTime);
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
    if (!targetUrl) {
      this.setConnectionState({
        status: 'offline',
        message: 'Missing game server URL (VITE_GAME_SERVER_URL). Offline mode continues.',
      });
      return false;
    }
    this.closeRoom();
    this.setConnectionState({
      status: 'connecting',
      roomId: options.roomId,
      characterId: options.characterId,
      message: `Connecting to room ${options.roomId}...`,
    });
    try {
      const client = new Client(targetUrl.replace(/\/+$/, ''));
      const room = await client.joinOrCreate('than-menh.v1', {
        authorization: options.token ? `Bearer ${options.token}` : undefined,
        roomId: options.roomId,
        characterId: options.characterId,
      });
      this.room = room;
      room.onMessage('snapshot', (message: unknown) => this.handleIncomingMessage(message));
      room.onMessage('reject', (message: unknown) => this.handleIncomingMessage(message));
      room.onMessage('event', (message: unknown) => this.handleIncomingMessage(message));
      room.onError((code: number, message?: string) =>
        this.notifyError(`Game server connection error (${code}): ${message}`)
      );
      room.onLeave((code: number, _reason?: string) => {
        this.room = null;
        this.snapshotAdapterInstance.clear();
        this.setConnectionState({
          status: 'disconnected',
          serverTick: 0,
          lastSnapshotTime: 0,
          message: `Disconnected from game server (${code}).`,
        });
        if (code !== 1000) this.notifyError(`Lost game server connection: code ${code}`);
      });
      this.setConnectionState({ status: 'connected', message: `Connected to room ${options.roomId}.` });
      return true;
    } catch {
      this.room = null;
      this.snapshotAdapterInstance.clear();
      this.setConnectionState({ status: 'error', message: 'Unable to establish game server connection.' });
      return false;
    }
  }

  disconnect(code = 1000, reason = 'Client disconnect'): void {
    this.closeRoom(code, reason);
    this.snapshotAdapterInstance.clear();
    this.setConnectionState({
      status: 'disconnected',
      roomId: null,
      characterId: null,
      serverTick: 0,
      lastSnapshotTime: 0,
      message: 'Disconnected from game server.',
    });
  }

  destroy(): void {
    this.disconnect();
    this.stateListeners.clear();
    this.rejectListeners.clear();
    this.eventListeners.clear();
    this.errorListeners.clear();
    this.snapshotAdapterInstance.destroy();
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

  onSnapshot(listener: (snapshot: Readonly<ServerSnapshotMessage> | null) => void): () => void {
    return this.snapshotAdapterInstance.onSnapshot(listener as any);
  }

  onRemotePlayers(listener: (players: readonly Readonly<ServerPlayerState>[]) => void): () => void {
    return this.snapshotAdapterInstance.onRemotePlayers(listener);
  }

  onRemotePlayer(id: string, listener: (player: Readonly<ServerPlayerState> | null) => void): () => void {
    return this.snapshotAdapterInstance.onRemotePlayer(id, listener);
  }

  onEnemies(listener: (enemies: readonly Readonly<ServerMonsterState>[]) => void): () => void {
    return this.snapshotAdapterInstance.onEnemies(listener);
  }

  onEnemy(id: string, listener: (enemy: Readonly<ServerMonsterState> | null) => void): () => void {
    return this.snapshotAdapterInstance.onEnemy(id, listener);
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
  // INTERNAL / MESSAGE HANDLERS
  // ============================================================================

  handleIncomingMessage(rawData: unknown): void {
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

  private dispatchRawIntent(intent: ClientIntent): boolean {
    const validation = validateClientIntent(intent);
    if (!validation.ok || !validation.value || !this.room) {
      if (this.room) this.notifyError(`Client intent validation failed: ${validation.error}`);
      return false;
    }
    const value = validation.value;
    let serverIntent: Record<string, unknown>;
    switch (value.type) {
      case 'move_input':
        serverIntent = { type: 'move', x: value.moveX, y: value.moveY };
        break;
      case 'attack':
      case 'cast_skill':
      case 'dodge':
        serverIntent = { ...value };
        break;
      default:
        this.notifyError('Intent type is not supported by the game server.');
        return false;
    }
    try {
      this.room.send('intent', serverIntent);
      return true;
    } catch {
      this.notifyError('Failed to send intent.');
      return false;
    }
  }

  private applySnapshot(snapshot: ServerSnapshotMessage): void {
    // Measure RTT latency if ackSeq matches an outstanding input
    const sentTime = this.sentTimestamps.get(snapshot.ackSeq);
    let latency = this.connState.latencyMs;
    if (sentTime) {
      latency = Math.max(0, Date.now() - sentTime);
      for (const k of this.sentTimestamps.keys()) {
        if (k <= snapshot.ackSeq) this.sentTimestamps.delete(k);
      }
    }

    this.snapshotAdapterInstance.applySnapshot(snapshot);

    this.setConnectionState({
      serverTick: snapshot.serverTick,
      latencyMs: latency,
      lastSnapshotTime: snapshot.serverTimestamp,
    });
  }

  private applyReject(reject: ServerRejectMessage): void {
    this.rejectedCount++;
    this.lastServerReject = reject;
    this.snapshotAdapterInstance.applyReject(reject);

    for (const listener of this.rejectListeners) {
      try {
        listener(reject);
      } catch {
        // Listener isolation
      }
    }
  }

  private applyEvent(eventMsg: ServerEventMessage): void {
    this.snapshotAdapterInstance.applyEvent(eventMsg);

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
    const room = this.room;
    this.room = null;
    try {
      void room.leave(true);
    } catch {
      /* ignore room close failure */
    }
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
    const safeMessage = message.replace(
      /(token|Bearer|authorization)\s*[:=]\s*['"]?[a-zA-Z0-9._-]+['"]?/gi,
      '$1=[REDACTED]'
    );
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
