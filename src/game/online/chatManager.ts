/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * ChatManager (M6 Social & Social Safety Boundary)
 *
 * Quản lý logic hệ thống chat trong game:
 * - Danh sách tin nhắn lưu trữ tối đa 50-100 tin gần nhất (tiết kiệm RAM).
 * - Lọc nội dung độc hại: loại bỏ thẻ HTML, chặn script injection.
 * - Chống lộ dữ liệu nhạy cảm (PII): ẩn email và JWT/Bearer access tokens.
 * - Giới hạn tần suất gửi tin (Rate Limiting): tối đa 3 tin trong 5 giây.
 *   Nếu vượt quá, từ chối gửi và phát cảnh báo "Bạn thao tác quá nhanh, vui lòng chờ...".
 * - Tương thích với MultiplayerAdapter hoặc hoạt động độc lập (offline/room channel).
 * - Hỗ trợ đăng ký và hủy lắng nghe sự kiện tin nhắn mới (onMessage).
 */

export type ChatChannel = 'local' | 'party' | 'system';

export interface ChatMessage {
  readonly id: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly text: string;
  readonly channel: ChatChannel;
  readonly timestamp: number;
}

export interface ChatManagerOptions {
  maxMessages?: number;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  senderId?: string;
  senderName?: string;
  multiplayer?: any;
  nowFn?: () => number;
}

export class ChatManager {
  private messages: ChatMessage[] = [];
  private readonly maxMessages: number;
  private readonly rateLimitMax: number;
  private readonly rateLimitWindowMs: number;

  private senderId: string;
  private senderName: string;
  private multiplayer: any = null;
  private readonly nowFn: () => number;

  private sentTimestamps: number[] = [];
  private messageListeners = new Set<(message: ChatMessage) => void>();
  private networkCleanupFns: Array<() => void> = [];

  constructor(options: ChatManagerOptions = {}) {
    this.maxMessages = Math.max(10, Math.min(options.maxMessages ?? 100, 200));
    this.rateLimitMax = options.rateLimitMax ?? 3;
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? 5000;
    this.senderId = options.senderId || 'player-local';
    this.senderName = options.senderName || 'Chiến Binh';
    this.nowFn = options.nowFn || (() => Date.now());

    if (options.multiplayer) {
      this.setMultiplayer(options.multiplayer);
    }
  }

  // ============================================================================
  // SENDER & MULTIPLAYER CONFIGURATION
  // ============================================================================

  public setSender(id: string, name: string): void {
    if (typeof id === 'string' && id.trim()) {
      this.senderId = id.trim();
    }
    if (typeof name === 'string' && name.trim()) {
      this.senderName = this.sanitizeText(name.trim());
    }
  }

  public getSender(): { id: string; name: string } {
    return { id: this.senderId, name: this.senderName };
  }

  public setMultiplayer(adapter: any): void {
    this.clearNetworkSubscriptions();
    this.multiplayer = adapter;

    if (!adapter) return;

    // Lắng nghe sự kiện chat từ adapter nếu có
    if (typeof adapter.onChatMessage === 'function') {
      const unsub = adapter.onChatMessage((msg: unknown) => {
        this.receiveMessage(msg);
      });
      if (typeof unsub === 'function') {
        this.networkCleanupFns.push(unsub);
      }
    } else if (adapter.room && typeof adapter.room.onMessage === 'function') {
      try {
        adapter.room.onMessage('chat_message', (msg: unknown) => {
          this.receiveMessage(msg);
        });
      } catch {
        // Fail-safe nếu room chưa sẵn sàng
      }
    }
  }

  // ============================================================================
  // SANITIZATION & SECURITY (Karpathy Guidelines: Surgical, robust, zero hallucination)
  // ============================================================================

  /**
   * Lọc ký tự độc hại, chặn script injection, gỡ bỏ HTML tags và ẩn thông tin PII.
   */
  public sanitizeText(raw: string): string {
    if (typeof raw !== 'string') return '';

    let clean = raw;

    // 1. Loại bỏ script tags và nội dung bên trong script
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // 2. Loại bỏ style tags và nội dung bên trong style
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // 3. Loại bỏ toàn bộ thẻ HTML còn lại
    clean = clean.replace(/<[^>]*>/g, '');

    // 4. Chặn các pseudo-protocols và inline event handlers
    clean = clean.replace(/javascript\s*:/gi, '');
    clean = clean.replace(/\bon\w+\s*=/gi, '');

    // 5. Chống lộ PII: Ẩn Email
    clean = clean.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL ĐÃ ẨN]');

    // 6. Chống lộ PII: Ẩn JWT / Access Tokens (chuỗi base64 có 2 dấu chấm phân tách dạng eyJ...)
    clean = clean.replace(/\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]+\b/g, '[TOKEN ĐÃ ẨN]');

    // 7. Chống lộ PII: Ẩn Bearer tokens
    clean = clean.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [TOKEN ĐÃ ẨN]');

    // 8. Chống lộ PII: Ẩn token/key dạng key=value hoặc key: value
    clean = clean.replace(/\b(token|access_token|refresh_token|secret|apiKey|api_key)\s*[:=]\s*[A-Za-z0-9._~+/-]{8,}/gi, '$1=[TOKEN ĐÃ ẨN]');

    // 9. Giới hạn độ dài tối đa 200 ký tự để bounded payload
    if (clean.length > 200) {
      clean = clean.slice(0, 200);
    }

    // 10. Thu gọn khoảng trắng thừa
    return clean.replace(/\s+/g, ' ').trim();
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  /**
   * Kiểm tra xem người chơi có bị giới hạn tần suất gửi tin nhắn không.
   * Tối đa 3 tin trong 5 giây.
   */
  public checkRateLimit(now: number = this.nowFn()): boolean {
    const windowStart = now - this.rateLimitWindowMs;
    this.sentTimestamps = this.sentTimestamps.filter((t) => t > windowStart);
    return this.sentTimestamps.length < this.rateLimitMax;
  }

  // ============================================================================
  // MESSAGE SENDING & RECEIVING
  // ============================================================================

  /**
   * Gửi tin nhắn từ người chơi hiện tại.
   * Trả về true nếu gửi thành công, false nếu bị chặn hoặc không hợp lệ.
   */
  public sendMessage(text: string, channel: ChatChannel = 'local'): boolean {
    const sanitized = this.sanitizeText(text);
    if (!sanitized) {
      return false;
    }

    const now = this.nowFn();

    // Kiểm tra Rate limit
    if (!this.checkRateLimit(now)) {
      this.addSystemMessage('Bạn thao tác quá nhanh, vui lòng chờ...');
      return false;
    }

    this.sentTimestamps.push(now);

    const message: ChatMessage = Object.freeze({
      id: `${this.senderId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: this.senderId,
      senderName: this.senderName,
      text: sanitized,
      channel: channel === 'system' ? 'local' : channel, // Client không được gửi trực tiếp channel system
      timestamp: now,
    });

    // Thêm vào danh sách tin nhắn nội bộ
    this.storeMessage(message);

    // Gửi qua multiplayer adapter nếu có
    if (this.multiplayer) {
      try {
        if (typeof this.multiplayer.sendChatMessage === 'function') {
          this.multiplayer.sendChatMessage(message);
        } else if (this.multiplayer.room && typeof this.multiplayer.room.send === 'function') {
          this.multiplayer.room.send('chat_message', message);
        }
      } catch {
        // Fail-safe: vẫn giữ tin nhắn cục bộ
      }
    }

    this.emitMessage(message);
    return true;
  }

  /**
   * Tiếp nhận tin nhắn từ mạng hoặc nguồn bên ngoài.
   */
  public receiveMessage(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false;

    const data = raw as Partial<ChatMessage>;
    if (typeof data.text !== 'string' || !data.text.trim()) return false;

    const channel: ChatChannel =
      data.channel === 'party' ? 'party' : data.channel === 'system' ? 'system' : 'local';

    const id = typeof data.id === 'string' && data.id.trim()
      ? data.id.trim()
      : `msg-${this.nowFn()}-${Math.random().toString(36).slice(2, 8)}`;

    // Tránh trùng lặp tin nhắn (deduplication)
    if (this.messages.some((m) => m.id === id)) {
      return false;
    }

    const sanitized = this.sanitizeText(data.text);
    if (!sanitized) return false;

    const senderName = this.sanitizeText(typeof data.senderName === 'string' ? data.senderName : 'Chiến Binh');
    const senderId = typeof data.senderId === 'string' && data.senderId.trim() ? data.senderId.trim() : 'unknown';
    const timestamp = typeof data.timestamp === 'number' && Number.isFinite(data.timestamp) ? data.timestamp : this.nowFn();

    const message: ChatMessage = Object.freeze({
      id,
      senderId,
      senderName: senderName || 'Chiến Binh',
      text: sanitized,
      channel,
      timestamp,
    });

    this.storeMessage(message);
    this.emitMessage(message);
    return true;
  }

  /**
   * Thêm một thông báo hệ thống (kênh system). Không áp dụng rate limit.
   */
  public addSystemMessage(text: string): ChatMessage {
    const sanitized = this.sanitizeText(text);
    const now = this.nowFn();
    const message: ChatMessage = Object.freeze({
      id: `system-${now}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: 'system',
      senderName: 'Hệ thống',
      text: sanitized || text,
      channel: 'system',
      timestamp: now,
    });

    this.storeMessage(message);
    this.emitMessage(message);
    return message;
  }

  // ============================================================================
  // STORAGE & SUBSCRIPTIONS
  // ============================================================================

  private storeMessage(msg: ChatMessage): void {
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  private emitMessage(msg: ChatMessage): void {
    for (const listener of this.messageListeners) {
      try {
        listener(msg);
      } catch {
        // Isolation: lỗi trong listener của UI không làm sập ChatManager
      }
    }
  }

  /**
   * Lấy danh sách tin nhắn hiện tại, có thể lọc theo kênh.
   */
  public getMessages(channel?: ChatChannel): readonly ChatMessage[] {
    if (!channel) {
      return [...this.messages];
    }
    return this.messages.filter((m) => m.channel === channel);
  }

  /**
   * Lấy tin nhắn mới nhất hoặc null.
   */
  public getLastMessage(): ChatMessage | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
  }

  /**
   * Đăng ký nhận tin nhắn mới.
   */
  public onMessage(callback: (message: ChatMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Xóa toàn bộ tin nhắn đã lưu.
   */
  public clear(): void {
    this.messages = [];
  }

  private clearNetworkSubscriptions(): void {
    for (const unsub of this.networkCleanupFns) {
      try {
        unsub();
      } catch {
        // Safe isolation
      }
    }
    this.networkCleanupFns = [];
  }

  /**
   * Hủy và dọn dẹp ChatManager.
   */
  public destroy(): void {
    this.clearNetworkSubscriptions();
    this.messageListeners.clear();
    this.messages = [];
    this.sentTimestamps = [];
    this.multiplayer = null;
  }
}
