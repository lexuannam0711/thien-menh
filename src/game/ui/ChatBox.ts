/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * ChatBox UI Component (M6 Social & UI/UX Boundary)
 *
 * Giao diện khung chat phong cách Văn Lang:
 * - Nền đồng mờ (bronze dark), chữ vàng hoàng đồng và trắng ngà.
 * - Đặt cố định ở góc dưới-trái màn hình, không che khuất vùng combat trung tâm.
 * - 2 chế độ hiển thị:
 *   + Thu gọn (Collapsed): Chỉ hiển thị 3-4 dòng tin gần nhất, gọn gàng.
 *   + Mở rộng (Expanded): Mở đầy đủ danh sách tin, thanh chuyển kênh và ô nhập tin nhắn.
 * - Quản lý Focus & Cách ly phím nhập liệu (Input Isolation):
 *   + Khi input được focus: cờ `isInputFocused = true` và `isFocused() = true`.
 *     Chặn nổi bọt phím (stopPropagation/stopImmediatePropagation) để các phím
 *     WASD và kỹ năng 1-4 không truyền vào Phaser / InputManager khi đang gõ chat.
 *   + Khi bấm Enter: gửi tin nhắn và blur input.
 *   + Khi bấm Escape: hủy/blur input mà không gửi.
 * - Hỗ trợ các kênh: 'local' (Cục bộ), 'party' (Tổ đội), 'system' (Hệ thống).
 * - Cung cấp method mount(), unmount(), destroy(), isFocused(), expand(), collapse().
 * - Dọn dẹp triệt để DOM và listeners khi destroy().
 */

import { uiTokens } from './design-tokens';
import {
  ChatManager,
  type ChatMessage,
  type ChatChannel,
  type ChatManagerOptions,
} from '../online/chatManager';

export interface ChatBoxOptions {
  container?: HTMLElement | null;
  chatManager?: ChatManager | null;
  multiplayer?: any;
  collapsed?: boolean;
  maxVisibleMessages?: number;
  collapsedVisibleCount?: number;
  onFocusChange?: (focused: boolean) => void;
}

export class ChatBox {
  private element: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private tabsContainerEl: HTMLElement | null = null;
  private toggleBtnEl: HTMLElement | null = null;
  private messagesContainerEl: HTMLElement | null = null;
  private inputAreaEl: HTMLElement | null = null;
  private channelBtnEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private sendBtnEl: HTMLElement | null = null;

  private container: HTMLElement | null = null;
  private isMountedState = false;
  private isCollapsedState = false;
  private isInputFocusedState = false;

  private readonly chatManager: ChatManager;
  private readonly options: ChatBoxOptions;
  private readonly maxVisibleMessages: number;
  private readonly collapsedVisibleCount: number;

  private currentChannel: 'local' | 'party' = 'local';
  private activeTab: 'all' | 'local' | 'party' | 'system' = 'all';

  private cleanupFns: Array<() => void> = [];
  private readonly handleWindowKeyDown: (event: KeyboardEvent) => void;

  constructor(options?: ChatBoxOptions | HTMLElement | null, containerArg?: HTMLElement | null) {
    let opts: ChatBoxOptions = {};

    if (options) {
      if (typeof (options as HTMLElement).nodeType === 'number' || (options as any).appendChild) {
        opts = { container: options as HTMLElement };
      } else {
        opts = { ...(options as ChatBoxOptions) };
        if (containerArg && !opts.container) {
          opts.container = containerArg;
        }
      }
    }

    this.options = opts;
    this.container = opts.container ?? null;
    this.isCollapsedState = opts.collapsed ?? false;
    this.maxVisibleMessages = opts.maxVisibleMessages ?? 50;
    this.collapsedVisibleCount = opts.collapsedVisibleCount ?? 4;

    // Khởi tạo ChatManager nếu chưa truyền vào
    if (opts.chatManager) {
      this.chatManager = opts.chatManager;
    } else {
      const mgrOpts: ChatManagerOptions = {};
      if (opts.multiplayer) {
        mgrOpts.multiplayer = opts.multiplayer;
      }
      this.chatManager = new ChatManager(mgrOpts);
    }

    this.createElement();
    this.setupChatManagerSubscription();

    // Lắng nghe sự kiện phím toàn cục trên window
    this.handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (!this.isInputFocusedState) {
          const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
          const tagName = activeEl?.tagName?.toLowerCase();
          // Không cướp phím nếu đang gõ trên input/textarea khác
          if (tagName === 'input' || tagName === 'textarea' || activeEl?.isContentEditable) {
            return;
          }
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          this.expand();
          this.focusInput();
        }
      } else if (event.key === 'Escape') {
        if (this.isInputFocusedState) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          this.cancel();
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleWindowKeyDown);
    }

    // Tự động mount nếu có container chỉ định
    if (this.container) {
      this.mount(this.container);
    }
  }

  // ============================================================================
  // PUBLIC ACCESSORS & LIFECYCLE API
  // ============================================================================

  public getManager(): ChatManager {
    return this.chatManager;
  }

  public get isInputFocused(): boolean {
    return this.isInputFocusedState;
  }

  public isFocused(): boolean {
    return this.isInputFocusedState;
  }

  public isCollapsed(): boolean {
    return this.isCollapsedState;
  }

  public isExpanded(): boolean {
    return !this.isCollapsedState;
  }

  public isMounted(): boolean {
    return this.isMountedState;
  }

  public getElement(): HTMLElement | null {
    return this.element;
  }

  public mount(parent?: HTMLElement | null): void {
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
    this.render();
  }

  public unmount(): void {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.isMountedState = false;
  }

  public destroy(): void {
    // 1. Gỡ window listener
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleWindowKeyDown);
    }

    // 2. Gỡ bỏ các callback subscription
    for (const unsub of this.cleanupFns) {
      try {
        unsub();
      } catch {
        // Safe isolation
      }
    }
    this.cleanupFns = [];

    // 3. Unmount DOM
    this.unmount();

    this.isInputFocusedState = false;
    this.element = null;
    this.headerEl = null;
    this.titleEl = null;
    this.tabsContainerEl = null;
    this.toggleBtnEl = null;
    this.messagesContainerEl = null;
    this.inputAreaEl = null;
    this.channelBtnEl = null;
    this.inputEl = null;
    this.sendBtnEl = null;
    this.container = null;
  }

  // ============================================================================
  // EXPAND / COLLAPSE / FOCUS API
  // ============================================================================

  public expand(): void {
    this.isCollapsedState = false;
    this.updateModeStyles();
    this.renderMessages();
  }

  public collapse(): void {
    this.isCollapsedState = true;
    this.blurInput();
    this.updateModeStyles();
    this.renderMessages();
  }

  public toggle(): void {
    if (this.isCollapsedState) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  public focusInput(): void {
    if (this.inputEl) {
      if (typeof this.inputEl.focus === 'function') {
        this.inputEl.focus();
      }
      this.setInputFocus(true);
    }
  }

  public blurInput(): void {
    if (this.inputEl) {
      if (typeof this.inputEl.blur === 'function') {
        this.inputEl.blur();
      }
      this.setInputFocus(false);
    }
  }

  public setChannel(channel: 'local' | 'party'): void {
    this.currentChannel = channel;
    if (this.channelBtnEl) {
      this.channelBtnEl.textContent = channel === 'party' ? '[Tổ đội]' : '[Cục bộ]';
      this.channelBtnEl.style.color =
        channel === 'party' ? uiTokens.colors.mana : uiTokens.colors.success;
    }
  }

  public submit(): void {
    if (!this.inputEl) return;
    const text = (this.inputEl.value || '').trim();
    if (text.length > 0) {
      this.chatManager.sendMessage(text, this.currentChannel);
      this.inputEl.value = '';
    }
    this.blurInput();
  }

  public cancel(): void {
    this.blurInput();
  }

  // ============================================================================
  // INTERNAL DOM CREATION & STYLING (VĂN LANG AESTHETICS)
  // ============================================================================

  private createElement(): void {
    if (typeof document === 'undefined') return;

    // 1. Root Container (.tm-chatbox)
    const root = document.createElement('div');
    root.className = 'tm-chatbox';
    root.id = 'tm-chatbox';

    Object.assign(root.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      width: '360px',
      maxWidth: 'calc(100vw - 32px)',
      background: 'rgba(27, 38, 36, 0.90)', // Nền đồng mờ Văn Lang
      border: `1px solid ${uiTokens.colors.border}`,
      borderRadius: `${uiTokens.radius.md}px`,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.65), inset 0 0 10px rgba(216, 182, 117, 0.12)',
      color: uiTokens.colors.text,
      fontFamily: "'Cinzel', 'Noto Serif', 'Noto Sans', 'Segoe UI', sans-serif",
      fontSize: '12px',
      lineHeight: '1.4',
      zIndex: '1500',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      userSelect: 'text',
    });

    // Mở rộng khi click vào khung chat đang thu gọn
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName?.toLowerCase() === 'button' ||
        target?.tagName?.toLowerCase() === 'input'
      ) {
        return;
      }
      if (this.isCollapsedState) {
        this.expand();
        this.focusInput();
      }
    });

    // 2. Header (.tm-chatbox-header)
    const header = document.createElement('div');
    header.className = 'tm-chatbox-header';
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: 'rgba(18, 24, 26, 0.75)',
      borderBottom: `1px solid rgba(142, 117, 74, 0.4)`,
      userSelect: 'none',
    });

    const title = document.createElement('div');
    title.className = 'tm-chatbox-title';
    title.textContent = '📜 TRÒ CHUYỆN';
    Object.assign(title.style, {
      color: uiTokens.colors.gold,
      fontWeight: 'bold',
      fontSize: '12px',
      letterSpacing: '0.8px',
      cursor: 'pointer',
    });
    title.addEventListener('click', () => this.toggle());

    // Tabs chuyển kênh (.tm-chatbox-tabs)
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tm-chatbox-tabs';
    Object.assign(tabsContainer.style, {
      display: 'flex',
      gap: '4px',
    });

    const tabs: Array<{ id: 'all' | 'local' | 'party' | 'system'; label: string }> = [
      { id: 'all', label: 'Tất cả' },
      { id: 'local', label: 'Cục bộ' },
      { id: 'party', label: 'Tổ đội' },
      { id: 'system', label: 'Hệ thống' },
    ];

    for (const tab of tabs) {
      const tabBtn = document.createElement('button');
      tabBtn.className = `tm-chatbox-tab ${this.activeTab === tab.id ? 'active' : ''}`;
      tabBtn.setAttribute('data-tab', tab.id);
      tabBtn.textContent = tab.label;
      Object.assign(tabBtn.style, {
        background: this.activeTab === tab.id ? 'rgba(216, 182, 117, 0.25)' : 'transparent',
        border: 'none',
        borderRadius: '3px',
        color: this.activeTab === tab.id ? uiTokens.colors.gold : uiTokens.colors.textMuted,
        padding: '2px 6px',
        fontSize: '11px',
        cursor: 'pointer',
      });

      tabBtn.addEventListener('click', (e) => {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        this.setActiveTab(tab.id);
      });

      tabsContainer.appendChild(tabBtn);
    }

    // Nút thu nhỏ / phóng to (.tm-chatbox-toggle-btn)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tm-chatbox-toggle-btn';
    toggleBtn.textContent = this.isCollapsedState ? '[ + ]' : '[ - ]';
    Object.assign(toggleBtn.style, {
      background: 'transparent',
      border: 'none',
      color: uiTokens.colors.accent,
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: 'pointer',
      padding: '0 4px',
    });
    toggleBtn.addEventListener('click', (e) => {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      this.toggle();
    });

    header.appendChild(title);
    header.appendChild(tabsContainer);
    header.appendChild(toggleBtn);

    // 3. Messages Container (.tm-chatbox-messages)
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'tm-chatbox-messages';
    Object.assign(messagesContainer.style, {
      padding: '8px 10px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      transition: 'height 0.2s ease',
    });

    // 4. Input Area (.tm-chatbox-input-area)
    const inputArea = document.createElement('div');
    inputArea.className = 'tm-chatbox-input-area';
    Object.assign(inputArea.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 10px',
      background: 'rgba(18, 24, 26, 0.85)',
      borderTop: `1px solid rgba(142, 117, 74, 0.4)`,
    });

    // Nút chọn kênh gửi [Cục bộ] / [Tổ đội]
    const channelBtn = document.createElement('button');
    channelBtn.className = 'tm-chatbox-channel-btn';
    channelBtn.textContent = this.currentChannel === 'party' ? '[Tổ đội]' : '[Cục bộ]';
    Object.assign(channelBtn.style, {
      background: 'transparent',
      border: `1px solid rgba(142, 117, 74, 0.5)`,
      borderRadius: '4px',
      color: this.currentChannel === 'party' ? uiTokens.colors.mana : uiTokens.colors.success,
      fontSize: '11px',
      padding: '4px 6px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontWeight: 'bold',
    });
    channelBtn.addEventListener('click', (e) => {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      this.setChannel(this.currentChannel === 'local' ? 'party' : 'local');
    });

    // Ô nhập tin nhắn (.tm-chatbox-input)
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tm-chatbox-input';
    input.placeholder = 'Nhập tin nhắn (Enter để gửi)...';
    input.maxLength = 200;
    Object.assign(input.style, {
      flex: '1',
      background: 'rgba(12, 16, 18, 0.85)',
      border: `1px solid ${uiTokens.colors.border}`,
      borderRadius: '4px',
      color: uiTokens.colors.text,
      fontSize: '12px',
      padding: '5px 8px',
      outline: 'none',
      boxSizing: 'border-box',
    });

    // ========================================================================
    // INPUT ISOLATION: Ngăn chặn triệt để phím WASD / phím số 1-4 bị leak ra ngoài
    // ========================================================================
    const isolateKeyEvent = (e: KeyboardEvent) => {
      if (typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      if (typeof (e as any).stopImmediatePropagation === 'function') {
        (e as any).stopImmediatePropagation();
      }
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      isolateKeyEvent(e);
      if (e.key === 'Enter') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.cancel();
      }
    });

    input.addEventListener('keyup', (e: KeyboardEvent) => {
      isolateKeyEvent(e);
    });

    input.addEventListener('keypress', (e: KeyboardEvent) => {
      isolateKeyEvent(e);
    });

    input.addEventListener('focus', () => {
      this.setInputFocus(true);
      if (this.isCollapsedState) {
        this.expand();
      }
    });

    input.addEventListener('blur', () => {
      this.setInputFocus(false);
    });

    // Nút GỬI (.tm-chatbox-send-btn)
    const sendBtn = document.createElement('button');
    sendBtn.className = 'tm-chatbox-send-btn';
    sendBtn.textContent = 'GỬI';
    Object.assign(sendBtn.style, {
      background: uiTokens.colors.accent,
      border: 'none',
      borderRadius: '4px',
      color: uiTokens.colors.bronzeDark,
      fontSize: '11px',
      fontWeight: 'bold',
      padding: '5px 10px',
      cursor: 'pointer',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
    });
    sendBtn.addEventListener('click', (e) => {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      this.submit();
    });

    inputArea.appendChild(channelBtn);
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    root.appendChild(header);
    root.appendChild(messagesContainer);
    root.appendChild(inputArea);

    this.element = root;
    this.headerEl = header;
    this.titleEl = title;
    this.tabsContainerEl = tabsContainer;
    this.toggleBtnEl = toggleBtn;
    this.messagesContainerEl = messagesContainer;
    this.inputAreaEl = inputArea;
    this.channelBtnEl = channelBtn;
    this.inputEl = input;
    this.sendBtnEl = sendBtn;

    this.updateModeStyles();
  }

  private setInputFocus(focused: boolean): void {
    if (this.isInputFocusedState === focused) return;
    this.isInputFocusedState = focused;

    if (this.inputEl) {
      if (focused) {
        this.inputEl.style.borderColor = uiTokens.colors.accent;
        this.inputEl.style.boxShadow = '0 0 6px rgba(216, 182, 117, 0.4)';
      } else {
        this.inputEl.style.borderColor = uiTokens.colors.border;
        this.inputEl.style.boxShadow = 'none';
      }
    }

    if (this.element) {
      this.element.setAttribute('data-focused', focused ? 'true' : 'false');
    }

    try {
      this.options.onFocusChange?.(focused);
    } catch {
      // Safe isolation
    }
  }

  private updateModeStyles(): void {
    if (!this.element || !this.messagesContainerEl || !this.toggleBtnEl) return;

    if (this.isCollapsedState) {
      this.element.setAttribute('data-mode', 'collapsed');
      this.toggleBtnEl.textContent = '[ + ]';
      this.messagesContainerEl.style.height = '85px';
      this.messagesContainerEl.style.maxHeight = '85px';
      if (this.inputAreaEl) {
        this.inputAreaEl.style.display = 'none';
      }
      if (this.tabsContainerEl) {
        this.tabsContainerEl.style.display = 'none';
      }
    } else {
      this.element.setAttribute('data-mode', 'expanded');
      this.toggleBtnEl.textContent = '[ - ]';
      this.messagesContainerEl.style.height = '180px';
      this.messagesContainerEl.style.maxHeight = '220px';
      if (this.inputAreaEl) {
        this.inputAreaEl.style.display = 'flex';
      }
      if (this.tabsContainerEl) {
        this.tabsContainerEl.style.display = 'flex';
      }
    }
  }

  private setActiveTab(tab: 'all' | 'local' | 'party' | 'system'): void {
    this.activeTab = tab;
    if (this.tabsContainerEl) {
      const tabBtns = this.tabsContainerEl.querySelectorAll('.tm-chatbox-tab');
      for (let i = 0; i < tabBtns.length; i++) {
        const btn = tabBtns[i] as HTMLElement;
        const currentTab = btn.getAttribute('data-tab');
        if (currentTab === tab) {
          btn.style.background = 'rgba(216, 182, 117, 0.25)';
          btn.style.color = uiTokens.colors.gold;
        } else {
          btn.style.background = 'transparent';
          btn.style.color = uiTokens.colors.textMuted;
        }
      }
    }
    this.renderMessages();
  }

  private setupChatManagerSubscription(): void {
    const unsub = this.chatManager.onMessage(() => {
      this.renderMessages();
    });
    this.cleanupFns.push(unsub);
  }

  public render(): void {
    this.updateModeStyles();
    this.renderMessages();
  }

  /**
   * Render danh sách tin nhắn theo tab hiện tại và chế độ hiển thị
   */
  public renderMessages(): void {
    if (!this.messagesContainerEl || typeof document === 'undefined') return;

    // Lấy tin nhắn theo tab
    let list: readonly ChatMessage[] = [];
    if (this.activeTab === 'all') {
      list = this.chatManager.getMessages();
    } else {
      list = this.chatManager.getMessages(this.activeTab);
    }

    // Nếu ở chế độ thu gọn, chỉ lấy collapsedVisibleCount tin gần nhất
    if (this.isCollapsedState) {
      list = list.slice(-this.collapsedVisibleCount);
    } else {
      list = list.slice(-this.maxVisibleMessages);
    }

    // Xóa nội dung cũ
    this.messagesContainerEl.textContent = '';

    if (list.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'tm-chatbox-empty';
      emptyEl.textContent = 'Chưa có tin nhắn nào...';
      Object.assign(emptyEl.style, {
        color: uiTokens.colors.textMuted,
        fontStyle: 'italic',
        fontSize: '11px',
        padding: '4px 0',
      });
      this.messagesContainerEl.appendChild(emptyEl);
      return;
    }

    for (const msg of list) {
      const row = document.createElement('div');
      row.className = `tm-chatbox-msg tm-chatbox-msg-${msg.channel}`;
      row.setAttribute('data-channel', msg.channel);
      Object.assign(row.style, {
        wordBreak: 'break-word',
        lineHeight: '1.35',
        fontSize: '11.5px',
      });

      // Channel tag: [Cục bộ] / [Tổ đội] / [Hệ thống]
      const channelTag = document.createElement('span');
      channelTag.className = 'tm-chatbox-msg-channel';
      let tagText = '[Cục bộ]';
      let tagColor: string = uiTokens.colors.success;

      if (msg.channel === 'party') {
        tagText = '[Tổ đội]';
        tagColor = uiTokens.colors.mana;
      } else if (msg.channel === 'system') {
        tagText = '[Hệ thống]';
        tagColor = uiTokens.colors.gold;
      }

      channelTag.textContent = `${tagText} `;
      Object.assign(channelTag.style, {
        color: tagColor,
        fontWeight: 'bold',
      });

      // Tên người gửi
      const senderSpan = document.createElement('span');
      senderSpan.className = 'tm-chatbox-msg-sender';
      senderSpan.textContent = msg.channel === 'system' ? '' : `${msg.senderName}: `;
      Object.assign(senderSpan.style, {
        color: uiTokens.colors.accent,
        fontWeight: 'bold',
      });

      // Nội dung tin nhắn
      const textSpan = document.createElement('span');
      textSpan.className = 'tm-chatbox-msg-text';
      textSpan.textContent = msg.text;
      Object.assign(textSpan.style, {
        color: msg.channel === 'system' ? uiTokens.colors.gold : uiTokens.colors.text,
      });

      row.appendChild(channelTag);
      if (msg.channel !== 'system') {
        row.appendChild(senderSpan);
      }
      row.appendChild(textSpan);

      this.messagesContainerEl.appendChild(row);
    }

    // Cuộn xuống dòng tin nhắn mới nhất
    try {
      this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
    } catch {
      // Safe fallback
    }
  }
}
