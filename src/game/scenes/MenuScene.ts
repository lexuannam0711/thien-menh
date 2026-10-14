import Phaser from 'phaser';
import { W, H, PALETTE } from '../../data/config';
import { button, label } from '../ui/art';
import { gameState } from '../systems/GameState';
import { settingsModel, CONTROLS_GUIDE } from '../ui/SettingsModel';
import { audioManager } from '../audio/AudioManager';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { ControlsSettings } from '../ui/screens/ControlsSettings';
import { AuthStore, authStore, validateCredentials, type AuthState } from '../online/auth';
import { multiplayer, type MultiplayerConnectionState } from '../online/multiplayer';
import { getOrCreateCharacter, isValidUuid, CharacterLifecycleError, type CharacterRow } from '../online/characters';

export class MenuScene extends Phaser.Scene {
  private muteButtonText?: Phaser.GameObjects.Text;
  private canvasFocusBox?: Phaser.GameObjects.Rectangle;
  private focusedButtonIndex = -1;
  private domLayer: HTMLElement | null = null;
  private lastFocusedElement: HTMLElement | null = null;
  private isModalOpen = false;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private controlsSettings?: ControlsSettings;
  private authStoreInstance: AuthStore = authStore;
  private authUnsubscribe?: () => void;
  private networkUnsubscribe?: () => void;
  private authGeneration = 0;
  private isSceneDestroyed = false;
  private activeCharacter: CharacterRow | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.isSceneDestroyed = false;
    // 1. Đồng bộ trạng thái âm thanh đã lưu trong localStorage với Phaser sound manager
    settingsModel.syncSound(this.sound);
    audioManager.loadFromStorage();
    audioManager.syncFromSettings({ muted: settingsModel.isMuted() });
    audioManager.startMusic('menu');

    // 2. Vẽ hình nền và họa tiết mặt Trống đồng Đông Sơn
    this.add.rectangle(W / 2, H / 2, W, H, 0x102b29);
    for (let i = 0; i < 33; i++) {
      const x = (i * 139 + 37) % W;
      const y = (i * 71 + 60) % H;
      this.add.circle(x, y, 2 + i % 4, 0xa6b87d, 0.26);
    }
    this.add.circle(820, 100, 150, 0x4d7853, 0.2);
    const drum = this.add.circle(480, 198, 128, 0x9c7745, 0.16).setStrokeStyle(5, PALETTE.bronze, 0.6);
    drum.setDepth(0);
    this.add.circle(480, 198, 100, 0x14352d, 0).setStrokeStyle(2, PALETTE.bronze, 0.8);
    this.add.circle(480, 198, 55, 0x14352d, 0).setStrokeStyle(2, PALETTE.bronze, 0.8);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      this.add.circle(480 + Math.cos(a) * 80, 198 + Math.sin(a) * 80, 4, PALETTE.bronze, 0.7);
    }

    // 3. Tiêu đề và cốt truyện
    label(this, 480, 147, 'THẦN MỆNH', 51, '#fbe3a2', 'center');
    label(this, 480, 208, 'HẬU DUỆ VĂN LANG', 27, '#e4c58e', 'center');
    label(this, 480, 274, 'Khi thần linh chọn một người phàm bảo vệ đất nước', 18, '#b8cbb2', 'center');
    const storageWarning = gameState.loadError || gameState.saveError;
    if (storageWarning) label(this, 480, 296, storageWarning, 12, '#ffe0a3', 'center');

    // 4. Các nút điều khiển trên Canvas
    // Vòng lấy nét trực quan khi người chơi dùng phím điều hướng trên Canvas
    this.canvasFocusBox = this.add.rectangle(0, 0, 308, 52)
      .setStrokeStyle(3, 0xf3c66f, 1)
      .setFillStyle(0xf3c66f, 0.12)
      .setVisible(false)
      .setDepth(10);

    // Nút Bắt đầu
    button(this, 480, 332, 300, gameState.hasSave ? 'TIẾP TỤC HÀNH TRÌNH' : 'BẮT ĐẦU HÀNH TRÌNH', () => this.startGame());

    // Nút Chơi lại từ đầu
    button(this, 480, 384, 300, 'CHƠI LẠI TỪ ĐẦU', () => this.restartGame(), 0x4f5e54);

    // Hàng nút chức năng Cài đặt: Âm thanh & Hướng dẫn điều khiển
    const muteBtnContainer = button(
      this,
      360,
      436,
      180,
      settingsModel.getMuteLabel(),
      () => this.toggleMute(),
      settingsModel.isMuted() ? 0x5a3e35 : 0x3d6652
    );
    this.muteButtonText = muteBtnContainer.list[5] as Phaser.GameObjects.Text;

    button(this, 580, 436, 220, 'HƯỚNG DẪN ĐIỀU KHIỂN', () => this.openControlsModal(), 0x7a633c);

    // Nhãn hướng dẫn và chân trang
    label(
      this,
      480,
      483,
      'WASD / Cần gạt: di chuyển  ·  Chuột trái / J: đánh  ·  Space: né  ·  Phím 1-4: kỹ năng  ·  F: tương tác',
      13,
      '#c8d6c5',
      'center'
    );
    label(
      this,
      480,
      509,
      'HTML5 — đồ họa dựng bằng mã nguồn  ·  [Tab] chọn nút  ·  [M] âm thanh  ·  [H] hướng dẫn',
      11,
      '#9aab96',
      'center'
    );

    // 5. Khởi tạo lớp giao diện Trợ năng & Cài đặt DOM (Accessible HTML Layer)
    this.setupAccessibleDom();
    if (storageWarning) this.announceLive(storageWarning);

    // 6. Xử lý sự kiện bàn phím trên Canvas
    this.setupKeyboardShortcuts();

    // 7. Dọn dẹp DOM khi chuyển cảnh hoặc hủy Scene
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());
  }

  private startGame(): void {
    audioManager.playCue('ui_confirm');
    void audioManager.unlock();
    this.cleanup();
    this.scene.start('Village');
  }

  private restartGame(): void {
    if (!window.confirm('Chơi lại sẽ xóa toàn bộ tiến trình hiện tại. Bạn có chắc chắn?')) return;
    audioManager.playCue('ui_confirm');
    void audioManager.unlock();
    this.cleanup();
    gameState.reset();
    this.scene.start('Village');
  }

  private toggleMute(): void {
    const isMuted = settingsModel.toggleMute();
    settingsModel.syncSound(this.sound);
    audioManager.setMuted(isMuted);
    audioManager.playCue('ui_click');

    // Cập nhật nhãn nút trên Canvas
    if (this.muteButtonText) {
      this.muteButtonText.setText(settingsModel.getMuteLabel());
    }

    // Cập nhật nhãn và trạng thái trên DOM
    this.updateDomMuteState(isMuted);

    // Thông báo cho bộ đọc màn hình (Screen Reader)
    this.announceLive(
      isMuted
        ? 'Đã tắt âm thanh trò chơi. Nhấn lại để bật.'
        : 'Đã bật âm thanh trò chơi. Nhấn lại để tắt.'
    );
  }

  private updateDomMuteState(isMuted: boolean): void {
    const dockMuteBtn = document.getElementById('dock-mute-btn');
    if (dockMuteBtn) {
      dockMuteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
      dockMuteBtn.setAttribute('aria-label', settingsModel.getAccessibleMuteLabel());
      dockMuteBtn.textContent = isMuted ? '🔇 ÂM THANH: TẮT' : '🔊 ÂM THANH: BẬT';
      dockMuteBtn.classList.toggle('is-muted', isMuted);
      dockMuteBtn.classList.toggle('is-active', !isMuted);
    }

    const modalMuteBtn = document.getElementById('modal-mute-toggle');
    if (modalMuteBtn) {
      modalMuteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
      modalMuteBtn.textContent = isMuted ? 'Đang tắt (Nhấn để bật)' : 'Đang bật (Nhấn để tắt)';
      modalMuteBtn.classList.toggle('is-muted', isMuted);
    }

    const srMuteBtn = document.getElementById('sr-btn-mute');
    if (srMuteBtn) {
      srMuteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
      srMuteBtn.setAttribute('aria-label', settingsModel.getAccessibleMuteLabel());
      srMuteBtn.textContent = settingsModel.getMuteLabel();
    }
  }

  private openControlsModal(): void {
    const modal = document.getElementById('controls-modal');
    if (!modal) return;
    this.isModalOpen = true;
    this.lastFocusedElement = document.activeElement as HTMLElement | null;

    modal.style.display = 'flex';
    modal.removeAttribute('hidden');
    for (const sibling of Array.from(this.domLayer?.children ?? [])) {
      if (sibling !== modal && sibling instanceof HTMLElement) sibling.inert = true;
    }

    const dockHelpBtn = document.getElementById('dock-help-btn');
    if (dockHelpBtn) {
      dockHelpBtn.setAttribute('aria-expanded', 'true');
    }

    // Chuyển tiêu điểm vào nút đóng hộp thoại để tiện truy cập
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.focus();
    }

    this.announceLive('Đã mở bảng Cài đặt và Hướng dẫn điều khiển. Bấm phím Escape để đóng.');
  }

  private closeControlsModal(): void {
    const modal = document.getElementById('controls-modal');
    if (!modal) return;
    this.isModalOpen = false;

    modal.style.display = 'none';
    modal.setAttribute('hidden', '');
    for (const sibling of Array.from(this.domLayer?.children ?? [])) {
      if (sibling instanceof HTMLElement) sibling.inert = false;
    }

    const dockHelpBtn = document.getElementById('dock-help-btn');
    if (dockHelpBtn) {
      dockHelpBtn.setAttribute('aria-expanded', 'false');
    }

    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }

    this.announceLive('Đã đóng bảng hướng dẫn điều khiển.');
  }

  private announceLive(message: string): void {
    const liveRegion = document.getElementById('menu-live-region');
    if (liveRegion) {
      liveRegion.textContent = '';
      window.setTimeout(() => {
        liveRegion.textContent = message;
      }, 50);
    }
  }

  private setupAccessibleDom(): void {
    // Xóa lớp giao diện cũ nếu có
    const existing = document.getElementById('menu-accessible-layer');
    if (existing) existing.remove();

    const appContainer = document.getElementById('app') ?? document.body;
    const container = document.createElement('div');
    container.id = 'menu-accessible-layer';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Giao diện điều khiển và cài đặt Thần Mệnh');

    const isMuted = settingsModel.isMuted();

    // 1. Vùng thông báo động cho bộ đọc màn hình (Live Region)
    const liveRegion = document.createElement('div');
    liveRegion.id = 'menu-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    container.appendChild(liveRegion);

    // 2. Các nút truy cập nhanh dành riêng cho bàn phím & bộ đọc màn hình (Skip / Accessible Actions)
    const srNav = document.createElement('nav');
    srNav.className = 'sr-only';
    srNav.setAttribute('aria-label', 'Điều hướng phím tắt Menu');

    const srStart = document.createElement('button');
    srStart.className = 'sr-only-focusable';
    srStart.type = 'button';
    srStart.textContent = gameState.hasSave ? 'Tiếp tục hành trình (Bấm Enter)' : 'Bắt đầu hành trình (Bấm Enter)';
    srStart.addEventListener('click', () => this.startGame());
    srNav.appendChild(srStart);

    const srRestart = document.createElement('button');
    srRestart.className = 'sr-only-focusable';
    srRestart.type = 'button';
    srRestart.textContent = 'Chơi lại từ đầu (Đặt lại dữ liệu)';
    srRestart.addEventListener('click', () => this.restartGame());
    srNav.appendChild(srRestart);

    const srMute = document.createElement('button');
    srMute.id = 'sr-btn-mute';
    srMute.className = 'sr-only-focusable';
    srMute.type = 'button';
    srMute.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    srMute.setAttribute('aria-label', settingsModel.getAccessibleMuteLabel());
    srMute.textContent = settingsModel.getMuteLabel();
    srMute.addEventListener('click', () => this.toggleMute());
    srNav.appendChild(srMute);

    const srHelp = document.createElement('button');
    srHelp.className = 'sr-only-focusable';
    srHelp.type = 'button';
    srHelp.textContent = 'Mở hướng dẫn điều khiển bàn phím và cảm ứng';
    srHelp.addEventListener('click', () => this.openControlsModal());
    srNav.appendChild(srHelp);

    const srControls = document.createElement('button');
    srControls.className = 'sr-only-focusable';
    srControls.type = 'button';
    srControls.textContent = 'Mở cài đặt điều khiển và gán phím';
    srControls.addEventListener('click', () => this.openControlsSettings());
    srNav.appendChild(srControls);

    container.appendChild(srNav);

    // 3. Thanh công cụ cài đặt nhanh góc trên màn hình (Menu Accessible Dock)
    const dock = document.createElement('header');
    dock.className = 'menu-accessible-dock';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'Thanh công cụ cài đặt nhanh');

    const dockMute = document.createElement('button');
    dockMute.id = 'dock-mute-btn';
    dockMute.type = 'button';
    dockMute.className = `menu-dock-btn ${isMuted ? 'is-muted' : 'is-active'}`;
    dockMute.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    dockMute.setAttribute('aria-label', settingsModel.getAccessibleMuteLabel());
    dockMute.textContent = isMuted ? '🔇 ÂM THANH: TẮT' : '🔊 ÂM THANH: BẬT';
    dockMute.addEventListener('click', () => this.toggleMute());
    dock.appendChild(dockMute);

    const dockControls = document.createElement('button');
    dockControls.id = 'dock-controls-btn';
    dockControls.type = 'button';
    dockControls.className = 'menu-dock-btn';
    dockControls.setAttribute('aria-label', 'Mở bảng Cài đặt Điều khiển và gán phím');
    dockControls.textContent = '🎮 CÀI ĐẶT ĐIỀU KHIỂN';
    dockControls.addEventListener('click', () => this.openControlsSettings());
    dock.appendChild(dockControls);

    const dockHelp = document.createElement('button');
    dockHelp.id = 'dock-help-btn';
    dockHelp.type = 'button';
    dockHelp.className = 'menu-dock-btn';
    dockHelp.setAttribute('aria-haspopup', 'dialog');
    dockHelp.setAttribute('aria-expanded', 'false');
    dockHelp.setAttribute('aria-label', 'Xem hướng dẫn điều khiển bàn phím và cảm ứng di động');
    dockHelp.textContent = '⚙ HƯỚNG DẪN';
    dockHelp.addEventListener('click', () => this.openControlsModal());
    dock.appendChild(dockHelp);

    container.appendChild(dock);

    const authPanel = document.createElement('section');
    authPanel.className = 'menu-auth-panel';
    authPanel.setAttribute('aria-labelledby', 'menu-auth-title');
    const authTitle = document.createElement('h2');
    authTitle.id = 'menu-auth-title';
    authTitle.textContent = 'TÀI KHOẢN (TÙY CHỌN)';
    authPanel.appendChild(authTitle);
    const email = document.createElement('input');
    email.type = 'email'; email.autocomplete = 'email'; email.placeholder = 'Email'; email.setAttribute('aria-label', 'Email');
    const password = document.createElement('input');
    password.type = 'password'; password.autocomplete = 'current-password'; password.placeholder = 'Mật khẩu (tối thiểu 6 ký tự)'; password.setAttribute('aria-label', 'Mật khẩu');
    const authStatus = document.createElement('p');
    authStatus.setAttribute('role', 'status');
    const signIn = document.createElement('button');
    signIn.type = 'button'; signIn.textContent = 'ĐĂNG NHẬP';
    const signUp = document.createElement('button');
    signUp.type = 'button'; signUp.textContent = 'TẠO TÀI KHOẢN';
    const signOut = document.createElement('button');
    signOut.type = 'button'; signOut.textContent = 'ĐĂNG XUẤT'; signOut.hidden = true;
    const submit = (action: 'signIn' | 'signUp'): void => {
      const message = validateCredentials(email.value, password.value);
      if (message) { authStatus.textContent = message; return; }
      void (action === 'signIn' ? this.authStoreInstance.signInWithPassword(email.value, password.value) : this.authStoreInstance.signUp(email.value, password.value));
    };
    signIn.addEventListener('click', () => submit('signIn'));
    signUp.addEventListener('click', () => submit('signUp'));
    signOut.addEventListener('click', () => {
      this.authGeneration++;
      this.activeCharacter = null;
      multiplayer.disconnect();
      void this.authStoreInstance.signOut();
    });
    authPanel.append(email, password, signIn, signUp, signOut, authStatus);
    container.appendChild(authPanel);

    // Bảng trạng thái & điều khiển mạng trực tuyến (chỉ hiển thị khi đã xác thực tài khoản)
    const networkPanel = document.createElement('section');
    networkPanel.className = 'menu-network-panel';
    networkPanel.setAttribute('aria-labelledby', 'menu-network-title');
    networkPanel.hidden = true;

    const networkTitle = document.createElement('h2');
    networkTitle.id = 'menu-network-title';
    networkTitle.textContent = 'MẠNG TRỰC TUYẾN (PHÒNG CHƠI)';
    networkPanel.appendChild(networkTitle);

    const networkStatus = document.createElement('p');
    networkStatus.id = 'menu-network-status';
    networkStatus.setAttribute('role', 'status');
    networkPanel.appendChild(networkStatus);

    const networkControls = document.createElement('div');
    networkControls.className = 'menu-network-controls';

    const connectBtn = document.createElement('button');
    connectBtn.id = 'menu-network-connect-btn';
    connectBtn.type = 'button';
    connectBtn.textContent = 'KẾT NỐI LẠI MÁY CHỦ';

    const disconnectBtn = document.createElement('button');
    disconnectBtn.id = 'menu-network-disconnect-btn';
    disconnectBtn.type = 'button';
    disconnectBtn.textContent = 'NGẮT KẾT NỐI MẠNG';
    disconnectBtn.hidden = true;

    networkControls.append(connectBtn, disconnectBtn);
    networkPanel.appendChild(networkControls);
    container.appendChild(networkPanel);

    const connectMultiplayer = async (userState?: AuthState): Promise<void> => {
      const currentGeneration = ++this.authGeneration;
      const currentAuth = userState ?? this.authStoreInstance.snapshot;
      if (currentAuth.status !== 'authenticated' || !currentAuth.user) return;

      const userId = currentAuth.user.id;
      if (!isValidUuid(userId)) {
        authStatus.textContent = 'Mã tài khoản không hợp lệ. Bạn vẫn có thể chơi offline.';
        return;
      }

      let character = this.activeCharacter;
      if (!character || character.user_id !== userId) {
        try {
          authStatus.textContent = 'Đang tải thông tin nhân vật...';
          character = await getOrCreateCharacter(this.authStoreInstance.client, userId);
        } catch (err) {
          if (this.isSceneDestroyed || this.authGeneration !== currentGeneration) return;
          const msg = err instanceof CharacterLifecycleError ? err.message : 'Không thể tải nhân vật. Bạn vẫn có thể chơi offline.';
          authStatus.textContent = msg;
          networkStatus.textContent = 'Chưa thể kết nối phòng trực tuyến: ' + msg;
          return;
        }
      }

      if (this.isSceneDestroyed || this.authGeneration !== currentGeneration) return;
      this.activeCharacter = character;
      authStatus.textContent = `Đã kết nối tài khoản (${character.name}).`;

      // Token chỉ tồn tại trong bộ nhớ (in-memory variable), tuyệt đối không hiển thị hay ghi log
      let token: string | undefined;
      try {
        if (this.authStoreInstance.client) {
          const { data } = await this.authStoreInstance.client.auth.getSession();
          token = data.session?.access_token ?? undefined;
        }
      } catch {
        // Giữ nguyên undefined và hoạt động fail-closed nếu lỗi phiên
      }

      if (this.isSceneDestroyed || this.authGeneration !== currentGeneration) return;

      const roomId = 'village-hub';
      const characterId = character.id;
      await multiplayer.connect({
        roomId,
        characterId,
        token,
      });

      if (this.isSceneDestroyed || this.authGeneration !== currentGeneration) {
        multiplayer.disconnect();
        return;
      }
    };

    connectBtn.addEventListener('click', () => {
      void connectMultiplayer();
    });

    disconnectBtn.addEventListener('click', () => {
      multiplayer.disconnect();
    });

    const renderNetwork = (netState: MultiplayerConnectionState): void => {
      let statusText: string;
      if (!netState.configured) {
        statusText = 'Chưa cấu hình máy chủ (VITE_GAME_SERVER_URL). Đang chạy chế độ Offline an toàn.';
      } else {
        switch (netState.status) {
          case 'offline':
            statusText = 'Chế độ ngoại tuyến (Offline). Tiếp tục chơi offline an toàn.';
            break;
          case 'connecting':
            statusText = `Đang kết nối tới phòng chơi (${netState.roomId ?? 'village-hub'})...`;
            break;
          case 'connected':
            statusText = `Đã kết nối phòng trực tuyến: ${netState.roomId ?? 'village-hub'} · Độ trễ: ${netState.latencyMs}ms`;
            break;
          case 'reconnecting':
            statusText = 'Đang thử kết nối lại máy chủ...';
            break;
          case 'error':
            statusText = netState.message || 'Lỗi kết nối máy chủ. Bạn vẫn có thể chơi offline.';
            break;
          case 'disconnected':
          default:
            statusText = 'Đã ngắt kết nối máy chủ phòng chơi.';
            break;
        }
      }
      networkStatus.textContent = statusText;

      const isConnected = netState.status === 'connected';
      const isConnecting = netState.status === 'connecting' || netState.status === 'reconnecting';
      connectBtn.disabled = !netState.configured || isConnected || isConnecting;
      connectBtn.hidden = isConnected;
      disconnectBtn.hidden = !isConnected;
      disconnectBtn.disabled = !isConnected;
    };

    this.networkUnsubscribe = multiplayer.onStateChange(renderNetwork);

    const renderAuth = (state: AuthState): void => {
      authStatus.textContent = state.message || (state.status === 'authenticated' ? `Đã đăng nhập: ${state.user?.email ?? 'tài khoản'}` : state.configured ? 'Chưa đăng nhập. Tiến trình vẫn lưu cục bộ khi chơi offline.' : state.message);
      const disabled = !state.configured || state.status === 'loading';
      email.disabled = disabled || state.status === 'authenticated'; password.disabled = disabled || state.status === 'authenticated';
      signIn.disabled = disabled || state.status === 'authenticated'; signUp.disabled = disabled || state.status === 'authenticated'; signOut.hidden = state.status !== 'authenticated';

      if (state.status === 'authenticated') {
        networkPanel.hidden = false;
        void connectMultiplayer(state);
      } else {
        this.authGeneration++;
        this.activeCharacter = null;
        networkPanel.hidden = true;
        multiplayer.disconnect();
      }
    };
    this.authUnsubscribe = this.authStoreInstance.subscribe(renderAuth);

    // 4. Hộp thoại Cài đặt & Hướng dẫn điều khiển (Accessible Modal Dialog)
    const modal = document.createElement('div');
    modal.id = 'controls-modal';
    modal.className = 'controls-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'controls-modal-title');
    modal.style.display = 'none';
    modal.setAttribute('hidden', '');

    // Đóng khi nhấp vào vùng ngoài hộp thoại
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeControlsModal();
    });

    const dialog = document.createElement('div');
    dialog.className = 'controls-modal-dialog';

    // Tiêu đề và nút đóng
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    const modalTitle = document.createElement('h2');
    modalTitle.id = 'controls-modal-title';
    modalTitle.className = 'modal-title';
    modalTitle.textContent = 'CÀI ĐẶT & HƯỚNG DẪN ĐIỀU KHIỂN';
    modalHeader.appendChild(modalTitle);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'modal-close-btn';
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close-btn';
    closeBtn.setAttribute('aria-label', 'Đóng hướng dẫn điều khiển (Phím Escape)');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closeControlsModal());
    modalHeader.appendChild(closeBtn);
    dialog.appendChild(modalHeader);

    // Phần Cài đặt nhanh: Bật/Tắt âm thanh
    const settingsCard = document.createElement('section');
    settingsCard.className = 'modal-section-card';
    settingsCard.setAttribute('aria-labelledby', 'section-sound-title');

    const soundTitle = document.createElement('h3');
    soundTitle.id = 'section-sound-title';
    soundTitle.className = 'modal-section-title';
    soundTitle.textContent = '🔊 Cài Đặt Âm Thanh';
    settingsCard.appendChild(soundTitle);

    const soundRow = document.createElement('div');
    soundRow.className = 'quick-setting-row';

    const soundTextWrap = document.createElement('div');
    const soundLabel = document.createElement('span');
    soundLabel.className = 'quick-setting-label';
    soundLabel.textContent = 'Âm thanh nền và hiệu ứng chiến đấu';
    const soundDesc = document.createElement('span');
    soundDesc.className = 'quick-setting-desc';
    soundDesc.textContent = 'Lưu tự động vào trình duyệt (localStorage), ghi nhớ cho các phiên chơi sau.';
    soundTextWrap.appendChild(soundLabel);
    soundTextWrap.appendChild(soundDesc);
    soundRow.appendChild(soundTextWrap);

    const modalMuteToggle = document.createElement('button');
    modalMuteToggle.id = 'modal-mute-toggle';
    modalMuteToggle.type = 'button';
    modalMuteToggle.className = `quick-setting-toggle ${isMuted ? 'is-muted' : ''}`;
    modalMuteToggle.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    modalMuteToggle.textContent = isMuted ? 'Đang tắt (Nhấn để bật)' : 'Đang bật (Nhấn để tắt)';
    modalMuteToggle.addEventListener('click', () => this.toggleMute());
    soundRow.appendChild(modalMuteToggle);

    settingsCard.appendChild(soundRow);
    const audioStatus = document.createElement('p');
    audioStatus.className = 'controls-desc';
    audioStatus.setAttribute('role', 'status');
    for (const [channel, title, getVolume, setVolume] of [
      ['master', 'Âm lượng tổng', () => audioManager.getMasterVolume(), (volume: number) => audioManager.setMasterVolume(volume)],
      ['music', 'Nhạc nền', () => audioManager.getMusicVolume(), (volume: number) => audioManager.setMusicVolume(volume)],
      ['sfx', 'Hiệu ứng', () => audioManager.getSfxVolume(), (volume: number) => audioManager.setSfxVolume(volume)],
    ] as const) {
      const row = document.createElement('label');
      row.className = 'graphics-setting';
      row.htmlFor = 'audio-' + channel + '-volume';
      row.textContent = title;
      const input = document.createElement('input');
      input.type = 'range';
      input.id = row.htmlFor;
      input.min = '0'; input.max = '100'; input.step = '1';
      input.value = String(Math.round(getVolume() * 100));
      input.setAttribute('aria-label', title);
      const output = document.createElement('output');
      output.htmlFor = input.id;
      output.textContent = input.value + '%';
      input.addEventListener('input', () => {
        input.value = String(Math.round(setVolume(input.valueAsNumber / 100) * 100));
        output.textContent = input.value + '%';
        audioStatus.textContent = audioManager.saveToStorage() ? 'Đã lưu âm lượng.' : 'Âm lượng áp dụng tạm thời; trình duyệt không cho lưu.';
      });
      row.append(input, output);
      settingsCard.appendChild(row);
    }
    settingsCard.appendChild(audioStatus);
    const qualityLabel = document.createElement('label');
    qualityLabel.className = 'graphics-setting';
    qualityLabel.textContent = 'Đồ họa ';
    const quality = document.createElement('select');
    quality.id = 'graphics-quality';
    quality.setAttribute('aria-label', 'Chất lượng đồ họa');
    for (const [value, text] of [['low', 'Thấp'], ['medium', 'Vừa'], ['high', 'Cao']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      quality.appendChild(option);
    }
    quality.value = graphicsSettings.getState().quality;
    const status = document.createElement('p');
    status.className = 'controls-desc';
    status.setAttribute('role', 'status');
    status.textContent = 'Áp dụng cho lượt chơi tiếp theo. Không thay đổi cảnh báo đòn đánh.';
    const reportSave = (saved: boolean) => {
      status.textContent = saved ? 'Đã lưu đồ họa. Áp dụng cho lượt chơi tiếp theo.' : 'Đã áp dụng. Không thể lưu cài đặt trên trình duyệt này.';
    };
    quality.addEventListener('change', () => reportSave(graphicsSettings.setQuality(quality.value)));
    qualityLabel.appendChild(quality);
    settingsCard.appendChild(qualityLabel);
    const motionLabel = document.createElement('label');
    motionLabel.className = 'graphics-setting';
    const motion = document.createElement('input');
    motion.type = 'checkbox';
    motion.id = 'graphics-reduced-motion';
    motion.checked = graphicsSettings.getState().reducedMotion;
    motion.addEventListener('change', () => reportSave(graphicsSettings.setReducedMotion(motion.checked)));
    motionLabel.append(motion, document.createTextNode(' Giảm chuyển động / tắt rung màn hình'));
    settingsCard.appendChild(motionLabel);
    settingsCard.appendChild(status);
    dialog.appendChild(settingsCard);

    // Phần Hướng dẫn bàn phím (PC)
    const kbCard = document.createElement('section');
    kbCard.className = 'modal-section-card';
    kbCard.setAttribute('aria-labelledby', 'section-kb-title');

    const kbTitle = document.createElement('h3');
    kbTitle.id = 'section-kb-title';
    kbTitle.className = 'modal-section-title';
    kbTitle.textContent = '⌨ Thao Tác Bàn Phím (Máy tính & Laptop)';
    kbCard.appendChild(kbTitle);

    const kbList = document.createElement('ul');
    kbList.className = 'controls-grid';
    for (const item of CONTROLS_GUIDE.keyboard) {
      const li = document.createElement('li');
      li.className = 'controls-item';
      const top = document.createElement('div');
      top.className = 'controls-item-top';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'controls-label';
      labelSpan.textContent = item.label;
      const badge = document.createElement('kbd');
      badge.className = 'controls-badge';
      badge.textContent = item.binding;
      top.appendChild(labelSpan);
      top.appendChild(badge);
      const descSpan = document.createElement('span');
      descSpan.className = 'controls-desc';
      descSpan.textContent = item.description;
      li.appendChild(top);
      li.appendChild(descSpan);
      kbList.appendChild(li);
    }
    kbCard.appendChild(kbList);
    dialog.appendChild(kbCard);

    // Phần Hướng dẫn cảm ứng (Mobile / Tablet)
    const mobileCard = document.createElement('section');
    mobileCard.className = 'modal-section-card';
    mobileCard.setAttribute('aria-labelledby', 'section-mobile-title');

    const mobileTitle = document.createElement('h3');
    mobileTitle.id = 'section-mobile-title';
    mobileTitle.className = 'modal-section-title';
    mobileTitle.textContent = '📱 Thao Tác Cảm Ứng (Điện thoại & Máy tính bảng)';
    mobileCard.appendChild(mobileTitle);

    const mobileList = document.createElement('ul');
    mobileList.className = 'controls-grid';
    for (const item of CONTROLS_GUIDE.mobile) {
      const li = document.createElement('li');
      li.className = 'controls-item';
      const top = document.createElement('div');
      top.className = 'controls-item-top';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'controls-label';
      labelSpan.textContent = item.label;
      const badge = document.createElement('span');
      badge.className = 'controls-badge';
      badge.textContent = item.binding;
      top.appendChild(labelSpan);
      top.appendChild(badge);
      const descSpan = document.createElement('span');
      descSpan.className = 'controls-desc';
      descSpan.textContent = item.description;
      li.appendChild(top);
      li.appendChild(descSpan);
      mobileList.appendChild(li);
    }
    mobileCard.appendChild(mobileList);
    dialog.appendChild(mobileCard);

    // Phần Phím tắt & Trợ năng
    const shortcutCard = document.createElement('section');
    shortcutCard.className = 'modal-section-card';
    shortcutCard.setAttribute('aria-labelledby', 'section-shortcut-title');

    const shortcutTitle = document.createElement('h3');
    shortcutTitle.id = 'section-shortcut-title';
    shortcutTitle.className = 'modal-section-title';
    shortcutTitle.textContent = '♿ Phím Tắt Tiện Ích & Hỗ Trợ Trợ Năng';
    shortcutCard.appendChild(shortcutTitle);

    const tipsUl = document.createElement('ul');
    tipsUl.className = 'tips-list';
    for (const tip of CONTROLS_GUIDE.tips) {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsUl.appendChild(li);
    }
    shortcutCard.appendChild(tipsUl);
    dialog.appendChild(shortcutCard);

    // Chân trang modal với nút Đã hiểu và Tùy chỉnh điều khiển
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const openSettingsBtn = document.createElement('button');
    openSettingsBtn.type = 'button';
    openSettingsBtn.className = 'modal-btn-secondary';
    openSettingsBtn.textContent = '🎮 TÙY CHỈNH PHÍM & CẢM ỨNG';
    openSettingsBtn.addEventListener('click', () => {
      this.closeControlsModal();
      this.openControlsSettings();
    });
    footer.appendChild(openSettingsBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'modal-btn-primary';
    confirmBtn.textContent = 'ĐÃ HIỂU / ĐÓNG';
    confirmBtn.addEventListener('click', () => this.closeControlsModal());
    footer.appendChild(confirmBtn);
    dialog.appendChild(footer);

    modal.appendChild(dialog);
    container.appendChild(modal);

    appContainer.appendChild(container);
    this.domLayer = container;
  }

  public openControlsSettings(): void {
    if (!this.controlsSettings && typeof ControlsSettings === 'function') {
      this.controlsSettings = new ControlsSettings(this);
    }
    this.controlsSettings?.open();
    this.announceLive('Đã mở bảng Cài đặt Điều khiển.');
  }

  private setupKeyboardShortcuts(): void {
    const buttonActions = [
      () => this.startGame(),
      () => this.restartGame(),
      () => this.toggleMute(),
      () => this.openControlsModal(),
    ];

    const buttonCoords = [
      { x: 480, y: 332, w: 308 },
      { x: 480, y: 384, w: 308 },
      { x: 360, y: 436, w: 188 },
      { x: 580, y: 436, w: 228 },
    ];

    const updateCanvasFocus = (idx: number): void => {
      this.focusedButtonIndex = idx;
      if (!this.canvasFocusBox) return;
      if (idx < 0 || idx >= buttonCoords.length) {
        this.canvasFocusBox.setVisible(false);
      } else {
        const c = buttonCoords[idx];
        this.canvasFocusBox.setPosition(c.x, c.y).setSize(c.w, 52).setVisible(true);
      }
    };

    this.keydownHandler = (event: KeyboardEvent): void => {
      // Phím Escape ưu tiên đóng ControlsSettings nếu đang mở
      if (this.controlsSettings && this.controlsSettings.isOpen()) {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.controlsSettings.close();
        }
        return;
      }

      // Phím Escape đóng hộp thoại nếu đang mở
      if (event.key === 'Escape') {
        if (this.isModalOpen) {
          event.preventDefault();
          this.closeControlsModal();
        }
        return;
      }

      if (this.isModalOpen) {
        if (event.key === 'Tab') {
          const focusable = Array.from(document.querySelectorAll<HTMLElement>(
            '#controls-modal button, #controls-modal input, #controls-modal select'));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement as HTMLElement))) {
            event.preventDefault();
            first?.focus();
          }
        }
        return;
      }
      if (event.key === 'Tab') { updateCanvasFocus(-1); return; }

      // Phím tắt M: bật/tắt nhanh âm thanh
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        this.toggleMute();
        return;
      }

      // Phím tắt H hoặc C: mở/đóng hướng dẫn
      if (event.key === 'h' || event.key === 'H' || event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        this.openControlsModal();
        return;
      }

      // Điều hướng tiêu điểm trên Canvas bằng phím mũi tên / Tab
      if (event.key === 'ArrowDown') {
        // Chỉ chặn tab nếu tiêu điểm đang không ở trong các nút HTML
        const isDomFocused = document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'BUTTON';
        if (!isDomFocused) {
          event.preventDefault();
          const next = (this.focusedButtonIndex + 1) % buttonActions.length;
          updateCanvasFocus(next);
        }
      } else if (event.key === 'ArrowUp') {
        const isDomFocused = document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'BUTTON';
        if (!isDomFocused) {
          event.preventDefault();
          const prev = this.focusedButtonIndex <= 0 ? buttonActions.length - 1 : this.focusedButtonIndex - 1;
          updateCanvasFocus(prev);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (this.focusedButtonIndex >= 0 && this.focusedButtonIndex < buttonActions.length) {
          const isDomFocused = document.activeElement && document.activeElement.tagName === 'BUTTON';
          if (!isDomFocused) {
            event.preventDefault();
            buttonActions[this.focusedButtonIndex]();
          }
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  private cleanup(): void {
    this.isSceneDestroyed = true;
    this.authGeneration++;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.controlsSettings) {
      this.controlsSettings.destroy(true);
      this.controlsSettings = undefined;
    }
    this.networkUnsubscribe?.();
    this.networkUnsubscribe = undefined;
    this.authUnsubscribe?.();
    this.authUnsubscribe = undefined;
    if (this.domLayer) {
      this.domLayer.remove();
      this.domLayer = null;
    }
  }
}
