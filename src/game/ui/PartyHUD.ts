/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * PartyHUD UI Component
 *
 * Giao diện tổ đội (Party HUD) cho trải nghiệm co-op 2-4 người:
 * - Hiển thị danh sách thành viên hiện tại: Tên, biểu tượng vương miện 👑 cho Leader,
 *   thanh HP (màu xanh lá/đỏ cảnh báo), trạng thái kết nối.
 * - Popup/Notification lời mời tổ đội khi nhận onInviteReceived:
 *   + Hiển thị: "Người chơi [X] mời bạn tham gia tổ đội."
 *   + Nút [ĐỒNG Ý] gọi multiplayer.sendPartyAccept(inviteId).
 *   + Nút [TỪ CHỐI] gọi multiplayer.sendPartyDecline(inviteId).
 * - Nút [RỜI ĐỘI] gọi multiplayer.sendPartyLeave() khi đang ở trong party.
 * - Phím tắt 'P' hoặc nút [ - ] / [ + ] để thu nhỏ/mở rộng không che khuất màn hình combat.
 * - Đăng ký partyAdapter.onStateChange, onInviteReceived, onEvent.
 * - Dọn dẹp sạch sẽ toàn bộ DOM elements, listeners, keydown handlers khi destroy().
 */

import { uiTokens } from './design-tokens';
import type { PartyState, ServerPartySnapshot, ServerPartyInvite, ServerPartyEvent } from '../online/partyAdapter';
import type { MultiplayerAdapter } from '../online/multiplayer';

export interface PartyMemberDisplay {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly isLeader: boolean;
  readonly isOnline: boolean;
  readonly level?: number;
  readonly connectionStatus?: string;
}

export interface PartyInviteData {
  readonly partyId: string;
  readonly leaderId?: string;
  readonly senderName?: string;
  readonly from?: string;
  readonly inviteId?: string;
}

export interface PartyHUDOptions {
  container?: HTMLElement | null;
  multiplayer?: any;
  partyAdapter?: any;
  collapsed?: boolean;
}

export class PartyHUD {
  private element: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private toggleBtnEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private memberListEl: HTMLElement | null = null;
  private leaveBtnEl: HTMLElement | null = null;

  private inviteModalEl: HTMLElement | null = null;

  private container: HTMLElement | null = null;
  private isMountedState = false;
  private isCollapsedState = false;

  private multiplayer: any = null;
  private partyAdapter: any = null;

  private currentMembers: PartyMemberDisplay[] = [];
  private currentLeaderId: string | null = null;
  private currentPartyId: string | null = null;

  private cleanupFns: Array<() => void> = [];
  private readonly handleKeydown: (event: KeyboardEvent) => void;

  constructor(options?: PartyHUDOptions | any, containerArg?: HTMLElement | null) {
    let opts: PartyHUDOptions = {};

    if (options) {
      if (typeof (options as HTMLElement).nodeType === 'number' || (options as any).appendChild) {
        opts = { container: options as HTMLElement };
      } else if (
        !('container' in options) &&
        !('multiplayer' in options) &&
        !('partyAdapter' in options) &&
        (options.party ||
          options.partyAdapter ||
          options.sendPartyLeave ||
          options.leaveParty ||
          options.onPartyChange ||
          options.onStateChange)
      ) {
        opts = { multiplayer: options, container: containerArg };
      } else {
        opts = { ...options };
        if (containerArg && !opts.container) {
          opts.container = containerArg;
        }
      }
    }

    this.container = opts.container ?? null;
    this.isCollapsedState = opts.collapsed ?? false;
    this.multiplayer = opts.multiplayer ?? null;
    this.partyAdapter = opts.partyAdapter ?? (this.multiplayer?.party || this.multiplayer?.partyAdapter || null);

    this.createElement();
    this.setupAdapterSubscriptions();

    // Lắng nghe phím tắt 'P' để toggle HUD
    this.handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'p' || event.key === 'P' || event.code === 'KeyP') {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
          return;
        }
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        this.toggle();
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleKeydown);
    }

    // Tự động mount nếu có container
    if (this.container) {
      this.mount(this.container);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

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

  unmount(): void {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.closeInviteModal();
    this.isMountedState = false;
  }

  destroy(): void {
    // 1. Gỡ bỏ keydown listener
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleKeydown);
    }

    // 2. Gỡ bỏ tất cả subscription từ adapter
    for (const unsub of this.cleanupFns) {
      try {
        unsub();
      } catch {
        // isolation
      }
    }
    this.cleanupFns = [];

    // 3. Tháo gỡ DOM elements
    this.closeInviteModal();
    this.unmount();

    this.element = null;
    this.headerEl = null;
    this.titleEl = null;
    this.toggleBtnEl = null;
    this.bodyEl = null;
    this.memberListEl = null;
    this.leaveBtnEl = null;
    this.container = null;
    this.multiplayer = null;
    this.partyAdapter = null;
    this.currentMembers = [];
  }

  toggle(): boolean {
    this.isCollapsedState = !this.isCollapsedState;
    if (this.bodyEl) {
      this.bodyEl.style.display = this.isCollapsedState ? 'none' : 'block';
    }
    if (this.toggleBtnEl) {
      this.toggleBtnEl.textContent = this.isCollapsedState ? '[ + ]' : '[ - ]';
      this.toggleBtnEl.setAttribute('aria-expanded', String(!this.isCollapsedState));
    }
    return !this.isCollapsedState;
  }

  isCollapsed(): boolean {
    return this.isCollapsedState;
  }

  isMounted(): boolean {
    return this.isMountedState && Boolean(this.element?.parentElement);
  }

  getElement(): HTMLElement | null {
    return this.element;
  }

  getInviteModalElement(): HTMLElement | null {
    return this.inviteModalEl;
  }

  getMembers(): readonly PartyMemberDisplay[] {
    return this.currentMembers;
  }

  /**
   * Cập nhật và hiển thị danh sách tổ đội
   */
  renderParty(state: any): void {
    if (!state) {
      this.currentPartyId = null;
      this.currentLeaderId = null;
      this.currentMembers = [];
      this.updateView();
      return;
    }

    let rawMembers: any[] = [];
    let leaderId: string | null = null;
    let partyId: string | null = null;

    if (Array.isArray(state)) {
      rawMembers = state;
      leaderId = state.find((m) => m?.isLeader)?.id || (state[0]?.id ?? null);
    } else if (typeof state === 'object') {
      rawMembers = state.members || [];
      leaderId = state.leaderId || null;
      partyId = state.partyId || null;
    }

    this.currentPartyId = partyId;
    this.currentLeaderId = leaderId;

    const normalizedMembers: PartyMemberDisplay[] = rawMembers.map((m, index) => {
      if (typeof m === 'string') {
        const remotePlayer = this.multiplayer?.getRemotePlayer?.(m);
        const isLeader = m === leaderId;
        const name = remotePlayer?.name || `Chiến Binh ${m.slice(0, 4)}`;
        const hp = typeof remotePlayer?.hp === 'number' ? remotePlayer.hp : 100;
        const maxHp = typeof remotePlayer?.maxHp === 'number' ? remotePlayer.maxHp : 100;
        return {
          id: m,
          name,
          hp,
          maxHp,
          isLeader,
          isOnline: remotePlayer ? remotePlayer.state !== 'dead' : true,
          connectionStatus: 'online',
        };
      }

      const id = String(m.id || m.characterId || `member-${index}`);
      const isLeader = Boolean(m.isLeader || (leaderId && id === leaderId));
      return {
        id,
        name: m.name || `Thành viên ${index + 1}`,
        hp: typeof m.hp === 'number' ? m.hp : 100,
        maxHp: typeof m.maxHp === 'number' ? m.maxHp : 100,
        isLeader,
        isOnline: m.isOnline !== undefined ? Boolean(m.isOnline) : true,
        level: m.level,
        connectionStatus: m.connectionStatus || (m.isOnline !== false ? 'online' : 'offline'),
      };
    });

    this.currentMembers = normalizedMembers;
    this.updateView();
  }

  /**
   * Hiển thị popup / thông báo lời mời tổ đội
   */
  showInviteModal(invite: any): void {
    if (!invite || typeof document === 'undefined') return;

    this.closeInviteModal();

    const inviteId = invite.inviteId || invite.partyId || invite.id || '';
    const senderName =
      invite.senderName ||
      invite.from ||
      (invite.leaderId ? `Người chơi ${invite.leaderId}` : 'Người chơi khác');

    const modal = document.createElement('div');
    modal.className = 'tm-party-invite-modal';
    modal.id = 'tm-party-invite-modal';

    Object.assign(modal.style, {
      position: 'fixed',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(23, 30, 33, 0.96)',
      border: `2px solid ${uiTokens.colors.border}`,
      borderRadius: `${uiTokens.radius.md}px`,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7), inset 0 0 8px rgba(216, 182, 117, 0.25)',
      padding: '14px 20px',
      minWidth: '280px',
      maxWidth: '400px',
      color: uiTokens.colors.text,
      fontFamily: "'Cinzel', 'Noto Serif', 'Noto Sans', sans-serif",
      textAlign: 'center',
      zIndex: '3000',
      userSelect: 'none',
      animation: 'tmFadeIn 0.2s ease-out',
    });

    const title = document.createElement('div');
    title.className = 'tm-party-invite-title';
    title.textContent = '📜 LỜI MỜI TỔ ĐỘI';
    Object.assign(title.style, {
      color: uiTokens.colors.gold,
      fontWeight: 'bold',
      fontSize: '13px',
      marginBottom: '6px',
      letterSpacing: '1px',
    });

    const msg = document.createElement('div');
    msg.className = 'tm-party-invite-msg';
    msg.textContent = `Người chơi ${senderName} mời bạn tham gia tổ đội.`;
    Object.assign(msg.style, {
      fontSize: '12px',
      lineHeight: '1.4',
      marginBottom: '14px',
      color: uiTokens.colors.text,
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'tm-party-invite-actions';
    Object.assign(btnRow.style, {
      display: 'flex',
      justifyContent: 'center',
      gap: '12px',
    });

    // Nút [ĐỒNG Ý]
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'tm-party-accept-btn';
    acceptBtn.textContent = 'ĐỒNG Ý';
    Object.assign(acceptBtn.style, {
      padding: '6px 16px',
      background: 'rgba(139, 196, 155, 0.2)',
      border: `1px solid ${uiTokens.colors.success}`,
      color: uiTokens.colors.success,
      borderRadius: `${uiTokens.radius.sm}px`,
      fontWeight: 'bold',
      fontSize: '11px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    });
    acceptBtn.onclick = () => {
      this.dispatchAccept(inviteId);
      this.closeInviteModal();
    };

    // Nút [TỪ CHỐI]
    const declineBtn = document.createElement('button');
    declineBtn.className = 'tm-party-decline-btn';
    declineBtn.textContent = 'TỪ CHỐI';
    Object.assign(declineBtn.style, {
      padding: '6px 16px',
      background: 'rgba(232, 109, 99, 0.2)',
      border: `1px solid ${uiTokens.colors.danger}`,
      color: uiTokens.colors.danger,
      borderRadius: `${uiTokens.radius.sm}px`,
      fontWeight: 'bold',
      fontSize: '11px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    });
    declineBtn.onclick = () => {
      this.dispatchDecline(inviteId);
      this.closeInviteModal();
    };

    btnRow.appendChild(acceptBtn);
    btnRow.appendChild(declineBtn);

    modal.appendChild(title);
    modal.appendChild(msg);
    modal.appendChild(btnRow);

    const mountParent = this.container || document.getElementById('app') || document.body;
    if (mountParent) {
      mountParent.appendChild(modal);
    }

    this.inviteModalEl = modal;
  }

  closeInviteModal(): void {
    if (this.inviteModalEl) {
      if (this.inviteModalEl.parentElement) {
        this.inviteModalEl.parentElement.removeChild(this.inviteModalEl);
      }
      this.inviteModalEl = null;
    }
  }

  handlePartyEvent(event: any): void {
    if (!event) return;
    if (event.kind === 'invite_received' || event.type === 'invite_received') {
      this.showInviteModal(event);
    }
  }

  // ============================================================================
  // PRIVATE METHODS & CONTRACT DISPATCHERS
  // ============================================================================

  private dispatchAccept(inviteId: string): void {
    if (this.multiplayer) {
      if (typeof this.multiplayer.sendPartyAccept === 'function') {
        this.multiplayer.sendPartyAccept(inviteId);
      } else if (typeof this.multiplayer.acceptPartyInvite === 'function') {
        this.multiplayer.acceptPartyInvite(inviteId);
      }
    }
  }

  private dispatchDecline(inviteId: string): void {
    if (this.multiplayer) {
      if (typeof this.multiplayer.sendPartyDecline === 'function') {
        this.multiplayer.sendPartyDecline(inviteId);
      } else if (typeof this.multiplayer.declinePartyInvite === 'function') {
        this.multiplayer.declinePartyInvite(inviteId);
      }
    }
  }

  private dispatchLeave(): void {
    if (this.multiplayer) {
      if (typeof this.multiplayer.sendPartyLeave === 'function') {
        this.multiplayer.sendPartyLeave();
      } else if (typeof this.multiplayer.leaveParty === 'function') {
        this.multiplayer.leaveParty();
      }
    }
  }

  private setupAdapterSubscriptions(): void {
    const target = this.partyAdapter || this.multiplayer;
    if (!target) return;

    // 1. onStateChange / onPartyChange
    if (typeof target.onStateChange === 'function') {
      const unsub = target.onStateChange((state: any) => this.renderParty(state));
      if (typeof unsub === 'function') this.cleanupFns.push(unsub);
    } else if (typeof target.onPartyChange === 'function') {
      const unsub = target.onPartyChange((state: any) => this.renderParty(state));
      if (typeof unsub === 'function') this.cleanupFns.push(unsub);
    }

    // 2. onInviteReceived
    if (typeof target.onInviteReceived === 'function') {
      const unsub = target.onInviteReceived((invite: any) => this.showInviteModal(invite));
      if (typeof unsub === 'function') this.cleanupFns.push(unsub);
    }

    // 3. onEvent / onPartyEvent
    if (typeof target.onEvent === 'function') {
      const unsub = target.onEvent((event: any) => this.handlePartyEvent(event));
      if (typeof unsub === 'function') this.cleanupFns.push(unsub);
    } else if (typeof target.onPartyEvent === 'function') {
      const unsub = target.onPartyEvent((event: any) => this.handlePartyEvent(event));
      if (typeof unsub === 'function') this.cleanupFns.push(unsub);
    }
  }

  private createElement(): void {
    if (typeof document === 'undefined') return;

    const hud = document.createElement('div');
    hud.className = 'tm-party-hud';
    hud.id = 'tm-party-hud';

    Object.assign(hud.style, {
      position: 'fixed',
      top: '72px',
      left: '12px',
      width: '210px',
      background: 'rgba(27, 38, 36, 0.92)',
      border: `1px solid ${uiTokens.colors.border}`,
      borderRadius: `${uiTokens.radius.md}px`,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5), inset 0 0 6px rgba(216, 182, 117, 0.15)',
      fontFamily: "'Cinzel', 'Noto Serif', 'Noto Sans', 'Segoe UI', sans-serif",
      color: uiTokens.colors.text,
      userSelect: 'none',
      zIndex: '2400',
      transition: 'all 0.2s ease',
      overflow: 'hidden',
    });

    // Header bar
    const header = document.createElement('div');
    header.className = 'tm-party-header';
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: 'rgba(36, 48, 51, 0.85)',
      borderBottom: `1px solid rgba(142, 117, 74, 0.4)`,
      cursor: 'pointer',
    });
    header.onclick = () => this.toggle();

    const title = document.createElement('span');
    title.className = 'tm-party-title';
    title.textContent = '⚔️ TỔ ĐỘI (0/4)';
    Object.assign(title.style, {
      fontSize: '11px',
      fontWeight: 'bold',
      color: uiTokens.colors.gold,
      letterSpacing: '0.5px',
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tm-party-toggle-btn';
    toggleBtn.textContent = this.isCollapsedState ? '[ + ]' : '[ - ]';
    toggleBtn.setAttribute('aria-label', 'Thu nhỏ / mở rộng tổ đội');
    toggleBtn.setAttribute('aria-expanded', String(!this.isCollapsedState));
    Object.assign(toggleBtn.style, {
      background: 'transparent',
      border: 'none',
      color: uiTokens.colors.accent,
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
      padding: '0 2px',
    });
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggle();
    };

    header.appendChild(title);
    header.appendChild(toggleBtn);

    // Body container
    const body = document.createElement('div');
    body.className = 'tm-party-body';
    Object.assign(body.style, {
      padding: '8px',
      display: this.isCollapsedState ? 'none' : 'block',
    });

    // Member list
    const memberList = document.createElement('div');
    memberList.className = 'tm-party-member-list';
    Object.assign(memberList.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });

    // Leave button
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'tm-party-leave-btn';
    leaveBtn.textContent = 'RỜI ĐỘI';
    Object.assign(leaveBtn.style, {
      display: 'none',
      width: '100%',
      marginTop: '8px',
      padding: '5px 0',
      background: 'rgba(232, 109, 99, 0.18)',
      border: `1px solid ${uiTokens.colors.border}`,
      color: uiTokens.colors.text,
      borderRadius: `${uiTokens.radius.sm}px`,
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.15s ease',
    });
    leaveBtn.onclick = () => this.dispatchLeave();

    body.appendChild(memberList);
    body.appendChild(leaveBtn);

    hud.appendChild(header);
    hud.appendChild(body);

    this.element = hud;
    this.headerEl = header;
    this.titleEl = title;
    this.toggleBtnEl = toggleBtn;
    this.bodyEl = body;
    this.memberListEl = memberList;
    this.leaveBtnEl = leaveBtn;

    this.updateView();
  }

  private updateView(): void {
    if (!this.titleEl || !this.memberListEl || !this.leaveBtnEl) {
      return;
    }

    const count = this.currentMembers.length;
    this.titleEl.textContent = `⚔️ TỔ ĐỘI (${count}/4)`;

    // Xóa danh sách cũ
    while (this.memberListEl.firstChild) {
      this.memberListEl.removeChild(this.memberListEl.firstChild);
    }

    if (count === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'tm-party-empty';
      emptyNotice.textContent = 'Chưa vào tổ đội (Phím P để ẩn)';
      Object.assign(emptyNotice.style, {
        fontSize: '11px',
        color: uiTokens.colors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '6px 0',
      });
      this.memberListEl.appendChild(emptyNotice);
      this.leaveBtnEl.style.display = 'none';
      return;
    }

    // Hiển thị nút rời đội khi có thành viên
    this.leaveBtnEl.style.display = 'block';

    for (const member of this.currentMembers) {
      const card = document.createElement('div');
      card.className = 'tm-party-member-card';
      card.setAttribute('data-member-id', member.id);
      Object.assign(card.style, {
        background: 'rgba(48, 63, 66, 0.55)',
        border: '1px solid rgba(142, 117, 74, 0.35)',
        borderRadius: `${uiTokens.radius.sm}px`,
        padding: '5px 7px',
      });

      // Hàng 1: Vương miện (nếu leader), Tên, Trạng thái mạng
      const topRow = document.createElement('div');
      topRow.className = 'tm-party-member-top';
      Object.assign(topRow.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        fontWeight: 'bold',
        marginBottom: '4px',
      });

      const nameContainer = document.createElement('div');
      nameContainer.style.display = 'flex';
      nameContainer.style.alignItems = 'center';
      nameContainer.style.gap = '4px';

      if (member.isLeader) {
        const crown = document.createElement('span');
        crown.className = 'tm-party-leader-crown';
        crown.textContent = '👑';
        crown.title = 'Trưởng Nhóm';
        nameContainer.appendChild(crown);
      }

      const nameText = document.createElement('span');
      nameText.className = 'tm-party-member-name';
      nameText.textContent = member.name;
      nameText.style.color = member.isLeader ? uiTokens.colors.gold : uiTokens.colors.text;
      nameContainer.appendChild(nameText);

      const netStatus = document.createElement('span');
      netStatus.className = 'tm-party-member-net';
      netStatus.textContent = member.isOnline ? '🟢' : '⚪';
      netStatus.title = member.isOnline ? 'Trực tuyến' : 'Ngoại tuyến';

      topRow.appendChild(nameContainer);
      topRow.appendChild(netStatus);

      // Hàng 2: Thanh máu (HP Bar)
      const hpPercent = Math.max(0, Math.min(100, Math.round((member.hp / Math.max(1, member.maxHp)) * 100)));
      const isHpLow = hpPercent <= 30;

      const hpBarOuter = document.createElement('div');
      hpBarOuter.className = 'tm-party-hp-outer';
      Object.assign(hpBarOuter.style, {
        position: 'relative',
        height: '8px',
        background: '#241212',
        border: '1px solid rgba(142, 117, 74, 0.4)',
        borderRadius: '3px',
        overflow: 'hidden',
      });

      const hpBarFill = document.createElement('div');
      hpBarFill.className = 'tm-party-hp-fill';
      Object.assign(hpBarFill.style, {
        height: '100%',
        width: `${hpPercent}%`,
        background: isHpLow ? uiTokens.colors.danger : uiTokens.colors.success,
        transition: 'width 0.2s ease',
      });

      hpBarOuter.appendChild(hpBarFill);

      const hpLabel = document.createElement('div');
      hpLabel.className = 'tm-party-hp-label';
      hpLabel.textContent = `${member.hp}/${member.maxHp}`;
      Object.assign(hpLabel.style, {
        fontSize: '9px',
        color: uiTokens.colors.textMuted,
        textAlign: 'right',
        marginTop: '2px',
      });

      card.appendChild(topRow);
      card.appendChild(hpBarOuter);
      card.appendChild(hpLabel);

      this.memberListEl.appendChild(card);
    }
  }
}
