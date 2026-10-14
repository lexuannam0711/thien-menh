/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * NetworkBadge UI Component
 *
 * Huy hiệu mạng hiển thị trạng thái kết nối nhẹ nhàng, thanh lịch theo mỹ thuật Văn Lang:
 * - Nền đồng thau cổ, chữ vàng/xanh ngọc, viền đồng.
 * - online / connected: '🟢 Trực tuyến' kèm latency ms (vd: '42ms').
 * - connecting / reconnecting: '🟡 Đang kết nối lại...'.
 * - offline / disconnected: '⚪ Ngoại tuyến' (không làm phiền người chơi).
 *
 * Nhận vào container hoặc tự động gắn vào #app / document.body.
 * Lắng nghe multiplayer.onStateChange để tự cập nhật giao diện.
 * Cung cấp mount(), unmount(), destroy(), update(state).
 */

import { uiTokens } from './design-tokens';
import type { MultiplayerAdapter, MultiplayerConnectionState, ConnectionStatus } from '../online/multiplayer';

export type NetworkBadgeStatus = ConnectionStatus | 'online';

export interface NetworkBadgeOptions {
  container?: HTMLElement | null;
  multiplayer?: Pick<MultiplayerAdapter, 'onStateChange'> | null;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline' | 'custom';
  initialStatus?: ConnectionStatus;
  initialLatency?: number;
}

export class NetworkBadge {
  private element: HTMLElement | null = null;
  private iconEl: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private latencyEl: HTMLElement | null = null;

  private container: HTMLElement | null = null;
  private isMountedState = false;

  private currentStatus: ConnectionStatus = 'offline';
  private currentLatency = 0;
  private currentFullState: MultiplayerConnectionState | null = null;

  private unsubscribeMultiplayer: (() => void) | null = null;

  constructor(options?: NetworkBadgeOptions | HTMLElement | Pick<MultiplayerAdapter, 'onStateChange'> | null) {
    let opts: NetworkBadgeOptions = {};

    if (options) {
      if (typeof (options as HTMLElement).nodeType === 'number') {
        opts = { container: options as HTMLElement };
      } else if (typeof (options as Pick<MultiplayerAdapter, 'onStateChange'>).onStateChange === 'function') {
        opts = { multiplayer: options as Pick<MultiplayerAdapter, 'onStateChange'> };
      } else {
        opts = options as NetworkBadgeOptions;
      }
    }

    this.container = opts.container ?? null;
    this.currentStatus = opts.initialStatus ?? 'offline';
    this.currentLatency = opts.initialLatency ?? 0;

    this.createElement(opts.position ?? 'top-right');
    this.applyState(this.currentStatus, this.currentLatency);

    if (opts.multiplayer && typeof opts.multiplayer.onStateChange === 'function') {
      this.unsubscribeMultiplayer = opts.multiplayer.onStateChange((state) => {
        this.update(state);
      });
    }

    // Tự động mount nếu được chỉ định container
    if (this.container) {
      this.mount(this.container);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Gắn element vào DOM container (nếu không truyền sẽ dùng container đã cấu hình, #app hoặc document.body)
   */
  mount(parent?: HTMLElement | null): void {
    if (typeof document === 'undefined') {
      this.isMountedState = true;
      return;
    }

    const targetParent =
      parent ||
      this.container ||
      document.getElementById('app') ||
      document.body;

    if (!targetParent || !this.element) {
      return;
    }

    if (this.element.parentElement !== targetParent) {
      targetParent.appendChild(this.element);
    }

    this.container = targetParent;
    this.isMountedState = true;
  }

  /**
   * Tháo element khỏi DOM cha nhưng giữ nguyên instance
   */
  unmount(): void {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.isMountedState = false;
  }

  /**
   * Dọn dẹp toàn diện: Hủy đăng ký listener multiplayer, tháo DOM element
   */
  destroy(): void {
    if (this.unsubscribeMultiplayer) {
      this.unsubscribeMultiplayer();
      this.unsubscribeMultiplayer = null;
    }

    this.unmount();

    if (this.element) {
      this.element = null;
      this.iconEl = null;
      this.labelEl = null;
      this.latencyEl = null;
    }

    this.container = null;
    this.currentFullState = null;
  }

  /**
   * Cập nhật trạng thái hiển thị
   */
  update(state: MultiplayerConnectionState | Partial<MultiplayerConnectionState> | ConnectionStatus | string): void {
    let status: ConnectionStatus = 'offline';
    let latency = this.currentLatency;

    if (typeof state === 'string') {
      status = this.normalizeStatus(state);
    } else if (state && typeof state === 'object') {
      if ('status' in state && state.status) {
        status = this.normalizeStatus(state.status);
      }
      if (typeof state.latencyMs === 'number') {
        latency = state.latencyMs;
      }
      if ('configured' in state) {
        this.currentFullState = state as MultiplayerConnectionState;
      }
    }

    this.currentStatus = status;
    this.currentLatency = latency;
    this.applyState(status, latency);
  }

  getElement(): HTMLElement | null {
    return this.element;
  }

  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  getLatency(): number {
    return this.currentLatency;
  }

  getState(): Readonly<MultiplayerConnectionState> | null {
    return this.currentFullState;
  }

  isMounted(): boolean {
    return this.isMountedState && Boolean(this.element?.parentElement);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private normalizeStatus(status: string): ConnectionStatus {
    if (status === 'online' || status === 'connected') return 'connected';
    if (status === 'connecting') return 'connecting';
    if (status === 'reconnecting') return 'reconnecting';
    if (status === 'disconnected') return 'disconnected';
    if (status === 'error') return 'error';
    return 'offline';
  }

  private createElement(position: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    const badge = document.createElement('div');
    badge.className = 'tm-network-badge';
    badge.id = 'tm-network-badge';

    // Mỹ thuật Văn Lang: Nền đồng thau cổ, viền đồng, bóng đổ sâu
    Object.assign(badge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: 'rgba(27, 38, 36, 0.92)',
      border: `1px solid ${uiTokens.colors.border}`,
      borderRadius: `${uiTokens.radius.sm}px`,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 0 4px rgba(216, 182, 117, 0.2)',
      fontFamily: "'Cinzel', 'Noto Serif', 'Noto Sans', 'Segoe UI', sans-serif",
      fontSize: '12px',
      fontWeight: '600',
      color: uiTokens.colors.text,
      userSelect: 'none',
      pointerEvents: 'auto',
      zIndex: '2500',
      transition: 'all 0.18s ease-in-out',
      lineHeight: '1.2',
    });

    if (position === 'top-right') {
      Object.assign(badge.style, {
        position: 'fixed',
        top: '12px',
        right: '12px',
      });
    } else if (position === 'top-left') {
      Object.assign(badge.style, {
        position: 'fixed',
        top: '12px',
        left: '12px',
      });
    } else if (position === 'bottom-right') {
      Object.assign(badge.style, {
        position: 'fixed',
        bottom: '12px',
        right: '12px',
      });
    } else if (position === 'bottom-left') {
      Object.assign(badge.style, {
        position: 'fixed',
        bottom: '12px',
        left: '12px',
      });
    }

    const icon = document.createElement('span');
    icon.className = 'tm-network-badge-icon';

    const label = document.createElement('span');
    label.className = 'tm-network-badge-label';

    const latency = document.createElement('span');
    latency.className = 'tm-network-badge-latency';
    Object.assign(latency.style, {
      fontSize: '11px',
      fontWeight: 'bold',
      marginLeft: '2px',
    });

    badge.appendChild(icon);
    badge.appendChild(label);
    badge.appendChild(latency);

    this.element = badge;
    this.iconEl = icon;
    this.labelEl = label;
    this.latencyEl = latency;
  }

  private applyState(status: ConnectionStatus, latency: number): void {
    if (!this.element || !this.iconEl || !this.labelEl || !this.latencyEl) {
      return;
    }

    this.element.setAttribute('data-status', status);

    switch (status) {
      case 'connected': {
        this.iconEl.textContent = '🟢 ';
        this.labelEl.textContent = 'Trực tuyến';
        this.labelEl.style.color = uiTokens.colors.gold;

        if (latency >= 0) {
          this.latencyEl.textContent = ` ${latency}ms`;
          this.latencyEl.style.display = 'inline';
          if (latency < 80) {
            this.latencyEl.style.color = uiTokens.colors.success; // Xanh ngọc
          } else if (latency < 150) {
            this.latencyEl.style.color = uiTokens.colors.gold; // Vàng đồng
          } else {
            this.latencyEl.style.color = uiTokens.colors.danger; // Đỏ cảnh báo
          }
        } else {
          this.latencyEl.textContent = '';
          this.latencyEl.style.display = 'none';
        }
        break;
      }

      case 'connecting':
      case 'reconnecting': {
        this.iconEl.textContent = '🟡 ';
        this.labelEl.textContent = 'Đang kết nối lại...';
        this.labelEl.style.color = uiTokens.colors.gold;
        this.latencyEl.textContent = '';
        this.latencyEl.style.display = 'none';
        break;
      }

      case 'offline':
      case 'disconnected':
      case 'error':
      default: {
        this.iconEl.textContent = '⚪ ';
        this.labelEl.textContent = 'Ngoại tuyến';
        this.labelEl.style.color = uiTokens.colors.textMuted;
        this.latencyEl.textContent = '';
        this.latencyEl.style.display = 'none';
        break;
      }
    }
  }
}
