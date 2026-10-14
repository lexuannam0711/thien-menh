/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * MinigameOverlay — Modal Host & Input Isolation System
 * 
 * Tính năng chính:
 * 1. Modal hiển thị trên World Scene với nền tối bán trong suốt (alpha 0.78),
 *    khung viền hoa văn đồng Đông Sơn và đinh tán góc hoàng kim.
 * 2. Header hiển thị Chân dung NPC, Tên NPC và Tên trò chơi:
 *    - "7321" (Thầy Thẻ Lạc)
 *    - "Xúc Xắc May Mắn" (Lão Đồng Xúc)
 *    - "Nhìn Hình Đoán Thú" (Nàng Họa Linh)
 * 3. 4 Tabs chức năng:
 *    - [BÀN CHƠI]
 *    - [LUẬT CHƠI]
 *    - [PHẦN THƯỞNG]
 *    - [LỊCH SỬ]
 * 4. Cách ly Input (Input Isolation):
 *    - Đẩy InputContext.MODAL vào InputContextManager: Khóa WASD di chuyển và 1..4 kỹ năng.
 *    - Chặn click chuột trái xuyên qua UI xuống game world bên dưới.
 *    - Phím Esc hoặc nút Đóng [X] đóng modal an toàn và phục hồi toàn bộ quyền điều khiển.
 */

import Phaser from 'phaser';
import { H, UI_DEPTH, W } from '../../data/config';
import {
  type MinigameId,
  type MinigamePublicSession,
  MINIGAME_NPCS,
  getNpcForMinigame,
} from './MinigameTypes';
import { ensureMinigameTextures, MINIGAME_PALETTE, MINIGAME_TEXTURE_KEYS } from './MinigameArtwork';
import { minigameClient } from './MinigameClient';
import { SevenThreeTwoOneUI } from './games/SevenThreeTwoOneUI';
import { LuckyDiceUI } from './games/LuckyDiceUI';
import { AnimalGuessUI } from './games/AnimalGuessUI';
import { MinigameRewardsUI } from './MinigameRewardsUI';
import { MinigameHistoryUI } from './MinigameHistoryUI';
import { InputContext, type InputContextManager } from '../input/InputContext';
import { uiTokens, uiTypography } from '../ui/design-tokens';

export type MinigameOverlayTab = 'gameplay' | 'rules' | 'rewards' | 'history' | 'game';

export interface MinigameOverlayOptions {
  scene: Phaser.Scene;
  contextManager?: InputContextManager;
  onClose?: () => void;
}

export class MinigameOverlay {
  private scene: Phaser.Scene;
  private contextManager?: InputContextManager;
  private onCloseCallback?: () => void;
  private currentNpcId?: string;

  private overlayContainer: Phaser.GameObjects.Container | null = null;
  private currentTab: MinigameOverlayTab = 'gameplay';
  private currentGameId: MinigameId = '7321';
  private remainingPlays: number = 3;

  // Sub-UIs
  private game7321UI: SevenThreeTwoOneUI | null = null;
  private luckyDiceUI: LuckyDiceUI | null = null;
  private animalGuessUI: AnimalGuessUI | null = null;
  private rewardsUI: MinigameRewardsUI | null = null;
  private historyUI: MinigameHistoryUI | null = null;
  private rulesContainer: Phaser.GameObjects.Container | null = null;

  // Header display references
  private dailyPlaysText: Phaser.GameObjects.Text | null = null;
  private tabButtons: Map<MinigameOverlayTab, { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = new Map();

  // Keyboard handler for Esc and Input Isolation
  private readonly onKeyDown: (event: KeyboardEvent) => void;

  constructor(
    optionsOrScene: MinigameOverlayOptions | Phaser.Scene,
    initialGameId?: MinigameId,
    npcId?: string,
    extraOptions?: Partial<MinigameOverlayOptions>
  ) {
    let options: MinigameOverlayOptions;
    if (optionsOrScene && ('add' in (optionsOrScene as any) || 'sys' in (optionsOrScene as any))) {
      // Nhận diện chuẩn Phaser.Scene (có GameObjectFactory và ScenePlugin)
      options = {
        scene: optionsOrScene as Phaser.Scene,
        contextManager: extraOptions?.contextManager,
        onClose: extraOptions?.onClose,
      };
    } else if (optionsOrScene && 'scene' in (optionsOrScene as any)) {
      // Nhận diện đối tượng cấu hình MinigameOverlayOptions
      options = optionsOrScene as MinigameOverlayOptions;
    } else {
      options = {
        scene: optionsOrScene as Phaser.Scene,
        contextManager: extraOptions?.contextManager,
        onClose: extraOptions?.onClose,
      };
    }

    if (initialGameId) {
      this.currentGameId = initialGameId;
    }
    if (npcId) {
      this.currentNpcId = npcId;
    }

    this.scene = options.scene;
    this.contextManager = options.contextManager ?? this.findContextManager();
    this.onCloseCallback = options.onClose;

    this.onKeyDown = (event: KeyboardEvent) => {
      if (!this.isOpen()) return;

      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      // Khóa các phím kỹ năng 1..4 và phím di chuyển không cho lọt xuống thế giới
      const blockedKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
      if (blockedKeys.includes(event.code)) {
        event.stopPropagation();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown, true);
    }
  }

  private findContextManager(): InputContextManager | undefined {
    const sceneAny = this.scene as any;
    if (sceneAny.inputManager?.contextManager) {
      return sceneAny.inputManager.contextManager;
    }
    if (sceneAny.player?.inputManager?.contextManager) {
      return sceneAny.player.inputManager.contextManager;
    }
    return undefined;
  }

  public isOpen(): boolean {
    return this.overlayContainer !== null;
  }

  public getCurrentGameId(): MinigameId {
    return this.currentGameId;
  }

  public getActiveTab(): MinigameOverlayTab {
    return this.currentTab;
  }

  public getRemainingDailyPlays(): number {
    return this.remainingPlays;
  }

  /**
   * Mở Minigame Modal với gameId chỉ định ('7321' | 'lucky_dice' | 'animal_guess')
   */
  public open(gameId?: MinigameId, initialTab: MinigameOverlayTab = 'gameplay'): void {
    if (this.isOpen()) {
      this.close();
    }

    if (gameId) {
      this.currentGameId = gameId;
    }
    const resolvedTab: MinigameOverlayTab = initialTab === 'game' ? 'gameplay' : initialTab;
    this.currentTab = resolvedTab;

    // 1. Nạp textures procedural nếu chưa có
    ensureMinigameTextures(this.scene);

    // 2. Cách ly Input: Push context MODAL
    if (this.contextManager) {
      this.contextManager.push(InputContext.MODAL);
    }

    // 3. Xây dựng Modal Frame & Layout
    this.buildModal();

    // 4. Khởi tạo bàn chơi tương ứng
    this.switchTab(resolvedTab);

    // 5. Đồng bộ lượt chơi từ backend hoặc offline client
    this.fetchDailyLimit();
  }

  /**
   * Đóng Minigame Modal an toàn và hoàn trả quyền điều khiển
   */
  public close(): void {
    if (!this.overlayContainer) return;

    // 1. Giải phóng Sub-UIs
    if (this.game7321UI) {
      this.game7321UI.destroy();
      this.game7321UI = null;
    }
    if (this.luckyDiceUI) {
      this.luckyDiceUI.destroy();
      this.luckyDiceUI = null;
    }
    if (this.animalGuessUI) {
      this.animalGuessUI.destroy();
      this.animalGuessUI = null;
    }
    if (this.rewardsUI) {
      this.rewardsUI.destroy();
      this.rewardsUI = null;
    }
    if (this.historyUI) {
      this.historyUI.destroy();
      this.historyUI = null;
    }
    if (this.rulesContainer) {
      this.rulesContainer.destroy(true);
      this.rulesContainer = null;
    }

    // 2. Phục hồi Input Context
    if (this.contextManager) {
      this.contextManager.pop(InputContext.MODAL);
    }

    // 3. Tiêu hủy container modal
    this.overlayContainer.destroy(true);
    this.overlayContainer = null;
    this.tabButtons.clear();

    // 4. Gọi callback kết thúc
    this.onCloseCallback?.();
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown, true);
    }
    this.close();
  }

  private buildModal(): void {
    const depth = UI_DEPTH + 100;
    this.overlayContainer = this.scene.add.container(0, 0);
    this.overlayContainer.setDepth(depth);
    this.overlayContainer.setData('isUI', true);

    // 1. Nền tối bán trong suốt (Backdrop) chặn click xuyên qua game world
    const backdrop = this.scene.add
      .rectangle(W / 2, H / 2, W * 1.5, H * 1.5, 0x071110, 0.82)
      .setInteractive();
    backdrop.setData('isUI', true);
    backdrop.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
    });
    this.overlayContainer.add(backdrop);

    // 2. Khung viền đồng cổ Đông Sơn (Ancient Bronze Panel)
    const panelW = 760;
    const panelH = 460;
    const panelX = W / 2 - panelW / 2;
    const panelY = H / 2 - panelH / 2;
    const r = 12;

    const frameGraphics = this.scene.add.graphics();
    // Nền panel chính
    frameGraphics.fillStyle(0x1a2624, 0.98);
    frameGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, r);

    // Viền chính vàng đồng
    frameGraphics.lineStyle(2.5, 0xc6a66b, 0.95);
    frameGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, r);

    // Viền chỉ phụ bên trong
    const pad = 6;
    frameGraphics.lineStyle(1, 0x8a6248, 0.5);
    frameGraphics.strokeRoundedRect(panelX + pad, panelY + pad, panelW - pad * 2, panelH - pad * 2, r - 3);

    // 4 đinh tán đồng ở 4 góc
    const rivet = 16;
    frameGraphics.fillStyle(0xf3c66f, 0.9);
    frameGraphics.fillCircle(panelX + rivet, panelY + rivet, 3.5);
    frameGraphics.fillCircle(panelX + panelW - rivet, panelY + rivet, 3.5);
    frameGraphics.fillCircle(panelX + rivet, panelY + panelH - rivet, 3.5);
    frameGraphics.fillCircle(panelX + panelW - rivet, panelY + panelH - rivet, 3.5);

    // Đường gạch ngang phân cách Header
    frameGraphics.lineStyle(1.5, 0x8a6248, 0.7);
    frameGraphics.beginPath();
    frameGraphics.moveTo(panelX + 20, panelY + 60);
    frameGraphics.lineTo(panelX + panelW - 20, panelY + 60);
    // Đường gạch ngang phân cách Tab Bar
    frameGraphics.moveTo(panelX + 20, panelY + 100);
    frameGraphics.lineTo(panelX + panelW - 20, panelY + 100);
    frameGraphics.strokePath();

    this.overlayContainer.add(frameGraphics);

    // 3. Header: Chân dung NPC, Tên NPC và Tên Trò Chơi
    const npcInfo = getNpcForMinigame(this.currentGameId);

    // Portrait icon
    const avatar = this.scene.add.image(panelX + 46, panelY + 30, npcInfo.portraitKey)
      .setDisplaySize(44, 44);
    this.overlayContainer.add(avatar);

    // Game Title & NPC Name
    const titleText = this.scene.add.text(
      panelX + 78,
      panelY + 20,
      `${npcInfo.gameTitle.toUpperCase()}  ·  ${npcInfo.npcName}`,
      {
        fontFamily: uiTypography.fontFamilies.display,
        fontSize: '17px',
        color: MINIGAME_PALETTE.goldBright,
        fontStyle: 'bold',
      }
    ).setOrigin(0, 0.5);
    this.overlayContainer.add(titleText);

    // Tagline
    const subtitle = this.scene.add.text(panelX + 78, panelY + 42, npcInfo.tagline, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      color: '#CBD1CB',
    }).setOrigin(0, 0.5);
    this.overlayContainer.add(subtitle);

    // Lượt chơi hôm nay (indicator)
    this.dailyPlaysText = this.scene.add.text(
      panelX + panelW - 80,
      panelY + 30,
      `Lượt hôm nay: ${this.remainingPlays}/3`,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '12px',
        color: MINIGAME_PALETTE.goldLight,
        fontStyle: 'bold',
      }
    ).setOrigin(1, 0.5);
    this.overlayContainer.add(this.dailyPlaysText);

    // Nút Đóng [X] góc trên bên phải
    const closeBtn = this.createCloseButton(panelX + panelW - 32, panelY + 30);
    this.overlayContainer.add(closeBtn);

    // 4. Tab Bar (BÀN CHƠI | LUẬT CHƠI | PHẦN THƯỞNG | LỊCH SỬ)
    this.buildTabBar(panelX, panelY + 68, panelW);
  }

  private buildTabBar(panelX: number, tabY: number, panelW: number): void {
    const tabs: Array<{ id: MinigameOverlayTab; label: string }> = [
      { id: 'gameplay', label: 'BÀN CHƠI' },
      { id: 'rules', label: 'LUẬT CHƠI' },
      { id: 'rewards', label: 'PHẦN THƯỞNG' },
      { id: 'history', label: 'LỊCH SỬ' },
    ];

    const tabWidth = 140;
    const tabHeight = 26;
    const spacing = 10;
    const totalWidth = tabs.length * tabWidth + (tabs.length - 1) * spacing;
    const startX = panelX + (panelW - totalWidth) / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + spacing);
      const isSelected = this.currentTab === tab.id;

      const bg = this.scene.add.rectangle(
        x,
        tabY + 12,
        tabWidth,
        tabHeight,
        isSelected ? 0x2e463c : 0x182421
      )
        .setStrokeStyle(1.2, isSelected ? 0xf3c66f : 0x8a6248)
        .setInteractive({ useHandCursor: true });
      bg.setData('isUI', true);

      const txt = this.scene.add.text(x, tabY + 12, tab.label, {
        fontFamily: uiTypography.fontFamilies.display,
        fontSize: '11px',
        color: isSelected ? MINIGAME_PALETTE.goldBright : '#CBD1CB',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5, 0.5);

      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        this.switchTab(tab.id);
      });

      this.overlayContainer?.add([bg, txt]);
      this.tabButtons.set(tab.id, { bg, text: txt });
    });
  }

  public switchTab(tab: MinigameOverlayTab): void {
    const resolvedTab: MinigameOverlayTab = tab === 'game' ? 'gameplay' : tab;
    this.currentTab = resolvedTab;

    // Cập nhật phong cách các nút Tab
    for (const [id, btn] of this.tabButtons.entries()) {
      const active = id === resolvedTab || (id === 'gameplay' && tab === 'game');
      btn.bg.setFillStyle(active ? 0x2e463c : 0x182421);
      btn.bg.setStrokeStyle(1.2, active ? 0xf3c66f : 0x8a6248);
      btn.text.setColor(active ? MINIGAME_PALETTE.goldBright : '#CBD1CB');
    }

    // Ẩn tất cả sub-views
    this.hideAllSubViews();

    if (resolvedTab === 'gameplay') {
      this.showGameplayView();
    } else if (resolvedTab === 'rules') {
      this.showRulesView();
    } else if (resolvedTab === 'rewards') {
      this.showRewardsView();
    } else if (resolvedTab === 'history') {
      this.showHistoryView();
    }
  }

  private hideAllSubViews(): void {
    if (this.game7321UI) this.game7321UI.setVisible(false);
    if (this.luckyDiceUI) this.luckyDiceUI.setVisible(false);
    if (this.animalGuessUI) this.animalGuessUI.setVisible(false);
    if (this.rewardsUI) this.rewardsUI.setVisible(false);
    if (this.historyUI) this.historyUI.setVisible(false);
    if (this.rulesContainer) this.rulesContainer.setVisible(false);
  }

  private showGameplayView(): void {
    if (this.currentGameId === '7321') {
      if (!this.game7321UI) {
        this.game7321UI = new SevenThreeTwoOneUI(this.scene, (session) => {
          this.onSessionUpdated(session);
        });
        this.overlayContainer?.add(this.game7321UI.getContainer());
        this.game7321UI.startNewGame();
      } else {
        this.game7321UI.setVisible(true);
      }
    } else if (this.currentGameId === 'lucky_dice') {
      if (!this.luckyDiceUI) {
        this.luckyDiceUI = new LuckyDiceUI(this.scene, (session) => {
          this.onSessionUpdated(session);
        });
        this.overlayContainer?.add(this.luckyDiceUI.getContainer());
        this.luckyDiceUI.startNewGame();
      } else {
        this.luckyDiceUI.setVisible(true);
      }
    } else if (this.currentGameId === 'animal_guess') {
      if (!this.animalGuessUI) {
        this.animalGuessUI = new AnimalGuessUI(this.scene, (session) => {
          this.onSessionUpdated(session);
        });
        this.overlayContainer?.add(this.animalGuessUI.getContainer());
        this.animalGuessUI.startNewGame();
      } else {
        this.animalGuessUI.setVisible(true);
      }
    }
  }

  private showRulesView(): void {
    if (!this.rulesContainer) {
      this.rulesContainer = this.scene.add.container(0, 0);
      this.overlayContainer?.add(this.rulesContainer);
      this.renderRulesContent();
    }
    this.rulesContainer.setVisible(true);
  }

  private renderRulesContent(): void {
    if (!this.rulesContainer) return;
    this.rulesContainer.removeAll(true);

    const startY = 160;

    const title = this.scene.add.text(480, startY, `LUẬT CHƠI CHI TIẾT — ${MINIGAME_NPCS[this.currentGameId].gameTitle.toUpperCase()}`, {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.rulesContainer.add(title);

    let rulesText = '';
    if (this.currentGameId === '7321') {
      rulesText =
        '1. MỤC TIÊU: Đạt tổng điểm các lá bài gần 21 nhất có thể mà không vượt quá 21 điểm (Quắc).\n' +
        '2. TÍNH ĐIỂM: Lá 2–10 tính đúng số điểm. Các lá J, Q, K tính 10 điểm.\n' +
        '   - Lá Ách (Ace) tự động tính tối ưu 1 hoặc 11 điểm (ưu tiên cao nhất không bị quắc).\n' +
        '3. BẮT ĐẦU: Bạn và Nhà cái nhận 2 lá bài. Bạn thấy 2 lá của mình và 1 lá ngửa của Nhà cái.\n' +
        '4. HÀNH ĐỘNG:\n' +
        '   - Rút Thẻ (HIT): Rút thêm 1 lá từ bộ bài cổ.\n' +
        '   - Dừng Bài (STAND): Giữ nguyên điểm số hiện tại và chuyển lượt sang Nhà cái.\n' +
        '5. NHÀ CÁI: Tự động rút thẻ đến khi đạt từ 17 điểm trở lên.\n' +
        '6. SO ĐIỂM: Điểm cao hơn thắng (+15 FestivalPoints). Hòa điểm (+5 pts). Quắc (+5 pts tham gia).\n' +
        '   - Natural 21 điểm ngay 2 lá đầu được tính thắng ưu tiên tuyệt đối!';
    } else if (this.currentGameId === 'lucky_dice') {
      rulesText =
        '1. MỤC TIÊU: Dự đoán tổng điểm của 3 viên xúc xắc đồng Văn Lang sáu mặt (1..6).\n' +
        '2. LỰA CHỌN:\n' +
        '   - XỈU: Tổng 3 viên xúc xắc từ 4 đến 10 điểm (Trừ bộ ba đồng số).\n' +
        '   - TÀI: Tổng 3 viên xúc xắc từ 11 đến 17 điểm (Trừ bộ ba đồng số).\n' +
        '3. BỘ BA ĐỒNG SỐ (HÒA ĐẶC BIỆT): Khi cả 3 viên cùng ra 1 số (1-1-1, 2-2-2, ... 6-6-6).\n' +
        '   - Đây là biến cố linh thiêng đặc biệt, không thuộc Tài hay Xỉu (+5 FestivalPoints).\n' +
        '4. PHẦN THƯỞNG:\n' +
        '   - Đoán đúng Tài/Xỉu: +10 FestivalPoints.\n' +
        '   - Không đúng hoặc Bộ ba: +5 FestivalPoints điểm tham gia.';
    } else {
      rulesText =
        '1. MỤC TIÊU: Dự đoán 1 trong 6 linh vật cổ xuất hiện trên 3 viên linh hình Bách Việt:\n' +
        '   - BẦU (Hồ lô)  ·  CUA (Thần giáp)  ·  CÁ (Ngư Lạc)\n' +
        '   - CỌP (Mãnh hổ)  ·  GÀ (Thần kê)  ·  NAI (Hươu sao)\n' +
        '2. CƠ CHẾ: Chọn 1 biểu tượng tin cậy rồi nhấn [Xác Nhận & Mở Linh Hình].\n' +
        '3. TÍNH KẾT QUẢ: 3 viên linh hình được gieo ngẫu nhiên độc lập (mỗi mặt xác suất 1/6).\n' +
        '   - Trúng 1 linh hình: Nhận 8 FestivalPoints.\n' +
        '   - Trúng 2 linh hình: Nhận 20 FestivalPoints.\n' +
        '   - Trúng 3 linh hình: Nhận 45 FestivalPoints (Thưởng cực đại!).\n' +
        '   - Không trúng: Nhận 5 FestivalPoints tham gia hợp lệ.\n' +
        '4. MINH BẠCH: Xác suất trúng ít nhất một linh vật là ~42.13% (1 - (5/6)^3).';
    }

    const box = this.scene.add.graphics();
    box.fillStyle(0x182622, 0.9);
    box.fillRoundedRect(190, startY + 20, 580, 240, 8);
    box.lineStyle(1.2, 0x497459, 0.7);
    box.strokeRoundedRect(190, startY + 20, 580, 240, 8);
    this.rulesContainer.add(box);

    const contentText = this.scene.add.text(210, startY + 36, rulesText, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11.5px',
      color: '#E8EFEA',
      lineSpacing: 6,
    });
    this.rulesContainer.add(contentText);
  }

  private showRewardsView(): void {
    if (!this.rewardsUI) {
      this.rewardsUI = new MinigameRewardsUI(this.scene, this.currentGameId);
      this.overlayContainer?.add(this.rewardsUI.getContainer());
    } else {
      this.rewardsUI.setVisible(true);
    }
  }

  private showHistoryView(): void {
    if (!this.historyUI) {
      this.historyUI = new MinigameHistoryUI(this.scene, this.currentGameId);
      this.overlayContainer?.add(this.historyUI.getContainer());
    } else {
      this.historyUI.setVisible(true);
      this.historyUI.refresh();
    }
  }

  private async fetchDailyLimit(): Promise<void> {
    try {
      const res = await minigameClient.list();
      if (res.ok && res.games) {
        const game = res.games.find((g) => g.id === this.currentGameId);
        if (game) {
          this.remainingPlays = game.remainingDailyPlays ?? 3;
          this.updateDailyPlaysBadge();
        }
      }
    } catch {
      // Giữ giá trị cục bộ
    }
  }

  private onSessionUpdated(session: MinigamePublicSession): void {
    this.remainingPlays = session.remainingDailyPlays;
    this.updateDailyPlaysBadge();
  }

  private updateDailyPlaysBadge(): void {
    if (this.dailyPlaysText) {
      this.dailyPlaysText.setText(`Lượt hôm nay: ${this.remainingPlays}/3`);
      this.dailyPlaysText.setColor(this.remainingPlays > 0 ? MINIGAME_PALETTE.goldLight : '#E86D63');
    }
  }

  private createCloseButton(x: number, y: number): Phaser.GameObjects.Container {
    const cont = this.scene.add.container(x, y);

    const circle = this.scene.add.circle(0, 0, 15, 0x24322e)
      .setStrokeStyle(1.5, 0xc6a66b)
      .setInteractive({ useHandCursor: true });
    circle.setData('isUI', true);

    const xText = this.scene.add.text(0, 0, '✕', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([circle, xText]);

    circle.on('pointerover', () => {
      circle.setFillStyle(0x732924);
      xText.setColor('#FFFFFF');
    });

    circle.on('pointerout', () => {
      circle.setFillStyle(0x24322e);
      xText.setColor(MINIGAME_PALETTE.goldBright);
    });

    circle.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      this.close();
    });

    return cont;
  }
}
