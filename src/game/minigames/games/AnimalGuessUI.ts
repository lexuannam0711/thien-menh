/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * AnimalGuessUI — Bàn Chơi Nhìn Hình Đoán Thú
 * 
 * Vận hành bởi Nàng Họa Linh:
 * - Lưới 2x3 ô chọn 6 linh vật: Bầu, Cua, Cá, Cọp, Gà, Nai.
 * - Linh vật được chọn có viền vàng đồng sáng rực (highlight glow).
 * - Nút Xác Nhận & Mở Linh Hình.
 * - 3 ô mở linh hình kết quả, badge "Trúng 1/2/3 hình" và cộng điểm FestivalPoints.
 */

import Phaser from 'phaser';
import {
  type AnimalSymbol,
  type MinigamePublicSession,
  type AnimalGuessPublicState,
  ANIMAL_SYMBOLS,
  ANIMAL_DEFINITIONS,
} from '../MinigameTypes';
import { minigameClient } from '../MinigameClient';
import { MINIGAME_TEXTURE_KEYS, MINIGAME_PALETTE } from '../MinigameArtwork';
import { uiTokens, uiTypography } from '../../ui/design-tokens';

export class AnimalGuessUI {
  private container: Phaser.GameObjects.Container;
  private currentSession: MinigamePublicSession | null = null;
  private selectedSymbol: AnimalSymbol | null = null;
  private skipAnimation: boolean = false;
  private isProcessingAction: boolean = false;

  // Visual components
  private statusMessageText!: Phaser.GameObjects.Text;
  private gridContainer!: Phaser.GameObjects.Container;
  private revealContainer!: Phaser.GameObjects.Container;
  private actionControlsContainer!: Phaser.GameObjects.Container;
  private resultBannerContainer!: Phaser.GameObjects.Container;
  private slotCards: Map<AnimalSymbol, { container: Phaser.GameObjects.Container; frame: Phaser.GameObjects.Image }> = new Map();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSessionUpdated?: (session: MinigamePublicSession) => void
  ) {
    this.container = this.scene.add.container(0, 0);
    this.buildLayout();
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public destroy(): void {
    this.container.destroy(true);
  }

  public setSkipAnimation(skip: boolean): void {
    this.skipAnimation = skip;
  }

  public isAnimationSkipped(): boolean {
    return this.skipAnimation;
  }

  public getSelectedSymbol(): AnimalSymbol | null {
    return this.selectedSymbol;
  }

  public getCurrentSession(): MinigamePublicSession | null {
    return this.currentSession;
  }

  private buildLayout(): void {
    // 1. Dòng thông điệp trạng thái ở đỉnh
    this.statusMessageText = this.scene.add.text(480, 155, 'Hãy chọn 1 trong 6 linh thú Văn Lang dưới đây.', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldLight,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.statusMessageText);

    // 2. Lưới 2x3 ô chọn 6 linh vật (Y = 175 .. 330)
    this.gridContainer = this.scene.add.container(0, 0);
    this.container.add(this.gridContainer);
    this.buildGrid();

    // 3. Vùng hiển thị 3 ô mở linh hình kết quả (ẩn khi đang chọn, hiện khi mở thưởng)
    this.revealContainer = this.scene.add.container(0, 0);
    this.container.add(this.revealContainer);

    // 4. Container nút bấm điều khiển
    this.actionControlsContainer = this.scene.add.container(0, 0);
    this.container.add(this.actionControlsContainer);

    // 5. Container thông báo kết quả
    this.resultBannerContainer = this.scene.add.container(0, 0);
    this.container.add(this.resultBannerContainer);

    this.renderActionControls();
  }

  private buildGrid(): void {
    this.gridContainer.removeAll(true);
    this.slotCards.clear();

    const startX = 260;
    const spacingX = 110;
    const row1Y = 208;
    const row2Y = 285;

    ANIMAL_SYMBOLS.forEach((sym, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = startX + col * spacingX;
      const y = row === 0 ? row1Y : row2Y;

      const info = ANIMAL_DEFINITIONS[sym];
      const slotCont = this.scene.add.container(x, y);

      // Khung viền slot (normal / selected)
      const isSelected = this.selectedSymbol === sym;
      const slotFrame = this.scene.add.image(
        0,
        0,
        isSelected ? MINIGAME_TEXTURE_KEYS.symbolSlotSelected : MINIGAME_TEXTURE_KEYS.symbolSlot
      )
        .setDisplaySize(92, 70)
        .setInteractive({ useHandCursor: true });

      // Hình vẽ linh vật
      let texKey: string = MINIGAME_TEXTURE_KEYS.animalBau;
      if (sym === 'cua') texKey = MINIGAME_TEXTURE_KEYS.animalCua;
      else if (sym === 'ca') texKey = MINIGAME_TEXTURE_KEYS.animalCa;
      else if (sym === 'cop') texKey = MINIGAME_TEXTURE_KEYS.animalCop;
      else if (sym === 'ga') texKey = MINIGAME_TEXTURE_KEYS.animalGa;
      else if (sym === 'nai') texKey = MINIGAME_TEXTURE_KEYS.animalNai;

      const icon = this.scene.add.image(0, -6, texKey).setDisplaySize(42, 42);

      // Tên linh vật tiếng Việt
      const nameText = this.scene.add.text(0, 22, info.nameVi.toUpperCase(), {
        fontFamily: uiTypography.fontFamilies.display,
        fontSize: '11px',
        color: isSelected ? MINIGAME_PALETTE.goldBright : '#CBD1CB',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      slotCont.add([slotFrame, icon, nameText]);

      slotFrame.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        this.selectSymbol(sym);
      });

      this.gridContainer.add(slotCont);
      this.slotCards.set(sym, { container: slotCont, frame: slotFrame });
    });
  }

  public selectSymbol(symbol: AnimalSymbol): void {
    if (this.isProcessingAction) return;
    this.selectedSymbol = symbol;

    // Cập nhật lại khung viền selection
    for (const [sym, slot] of this.slotCards.entries()) {
      const isSel = sym === symbol;
      slot.frame.setTexture(
        isSel ? MINIGAME_TEXTURE_KEYS.symbolSlotSelected : MINIGAME_TEXTURE_KEYS.symbolSlot
      );
      const nameTxt = slot.container.getAt(2) as Phaser.GameObjects.Text;
      if (nameTxt) {
        nameTxt.setColor(isSel ? MINIGAME_PALETTE.goldBright : '#CBD1CB');
      }
    }

    const info = ANIMAL_DEFINITIONS[symbol];
    this.statusMessageText.setText(`Đã chọn: ${info.nameVi} (${info.subtitle}). Nhấn để mở linh hình!`);
    this.renderActionControls();
  }

  public async startNewGame(): Promise<void> {
    if (this.isProcessingAction) return;
    this.isProcessingAction = true;
    this.selectedSymbol = null;
    this.statusMessageText.setText('Nàng Họa Linh đang chuẩn bị ba thẻ linh hình...');
    this.revealContainer.removeAll(true);
    this.buildGrid();

    try {
      const res = await minigameClient.start('animal_guess', 'npc_nang_hoa_linh');
      if (res.ok && res.session) {
        this.currentSession = res.session;
        this.renderActionControls();
        this.onSessionUpdated?.(res.session);
        this.statusMessageText.setText('Hãy chọn 1 linh thú Văn Lang bạn tin sẽ xuất hiện.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu ván';
      this.statusMessageText.setText(msg);
    } finally {
      this.isProcessingAction = false;
    }
  }

  public updateFromSession(session: MinigamePublicSession): void {
    this.currentSession = session;
    const state = session.publicState as AnimalGuessPublicState;

    if (!state) return;

    if (state.chosenSymbol) {
      this.selectSymbol(state.chosenSymbol);
    }

    if (state.rolledSymbols && (session.status === 'resolved' || session.status === 'rewarded')) {
      this.renderRevealedSymbols(state.rolledSymbols, state.chosenSymbol);
      this.renderResolvedBanner(session);
    } else {
      this.revealContainer.removeAll(true);
      this.renderActionControls();
    }

    if (state.message) {
      this.statusMessageText.setText(state.message);
    }
  }

  private renderActionControls(): void {
    this.actionControlsContainer.removeAll(true);
    this.resultBannerContainer.removeAll(true);

    const btnY = 385;
    const canConfirm = Boolean(this.selectedSymbol && !this.isProcessingAction);

    const confirmBtn = this.createActionButton(
      480,
      btnY,
      270,
      44,
      this.selectedSymbol
        ? `XÁC NHẬN & MỞ LINH HÌNH [${ANIMAL_DEFINITIONS[this.selectedSymbol].nameVi.toUpperCase()}]`
        : 'HÃY CHỌN 1 LINH VẬT TRÊN LƯỚI',
      () => {
        if (canConfirm) this.onConfirmReveal();
      },
      canConfirm ? 0x274936 : 0x212b28,
      canConfirm ? 0x8bc49b : 0x73807d,
      canConfirm
    );
    this.actionControlsContainer.add(confirmBtn);

    // Hướng dẫn xác suất minh bạch ở dưới
    const oddsNotice = this.scene.add.text(
      480,
      425,
      'Xác suất trúng ít nhất một linh hình là ~42.13% · Thưởng lên tới 45 FestivalPoints',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: MINIGAME_PALETTE.goldLight,
        align: 'center',
      }
    ).setOrigin(0.5, 0.5);
    this.actionControlsContainer.add(oddsNotice);
  }

  private async onConfirmReveal(): Promise<void> {
    if (!this.selectedSymbol || !this.currentSession || this.isProcessingAction) return;

    this.isProcessingAction = true;
    this.statusMessageText.setText('Nàng Họa Linh đang gieo 3 viên linh hình...');

    try {
      const res = await minigameClient.action(this.currentSession.sessionId, {
        type: 'choose_symbol',
        symbol: this.selectedSymbol,
      });

      if (res.ok && res.session) {
        this.currentSession = res.session;
        const state = res.session.publicState as AnimalGuessPublicState;

        if (state.rolledSymbols) {
          await this.renderRevealedSymbols(state.rolledSymbols, this.selectedSymbol);
        }

        this.renderResolvedBanner(res.session);
        this.onSessionUpdated?.(res.session);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi mở linh hình';
      this.statusMessageText.setText(msg);
    } finally {
      this.isProcessingAction = false;
    }
  }

  private async renderRevealedSymbols(
    rolled: [AnimalSymbol, AnimalSymbol, AnimalSymbol],
    chosen?: AnimalSymbol
  ): Promise<void> {
    this.revealContainer.removeAll(true);

    const startX = 660;
    const spacingX = 80;
    const revealY = 246;

    // Tiêu đề 3 viên kết quả
    const resLabel = this.scene.add.text(startX + spacingX, 185, '3 VIÊN LINH HÌNH KẾT QUẢ', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '12px',
      color: MINIGAME_PALETTE.goldLight,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.revealContainer.add(resLabel);

    for (let i = 0; i < rolled.length; i++) {
      const sym = rolled[i];
      const isMatch = sym === chosen;
      const x = startX + i * spacingX;

      const slotCont = this.scene.add.container(x, revealY);

      // Khung viền (vàng sáng nếu trúng biểu tượng chọn)
      const frame = this.scene.add.image(
        0,
        0,
        isMatch ? MINIGAME_TEXTURE_KEYS.symbolSlotSelected : MINIGAME_TEXTURE_KEYS.symbolSlot
      ).setDisplaySize(72, 72);

      let texKey: string = MINIGAME_TEXTURE_KEYS.animalBau;
      if (sym === 'cua') texKey = MINIGAME_TEXTURE_KEYS.animalCua;
      else if (sym === 'ca') texKey = MINIGAME_TEXTURE_KEYS.animalCa;
      else if (sym === 'cop') texKey = MINIGAME_TEXTURE_KEYS.animalCop;
      else if (sym === 'ga') texKey = MINIGAME_TEXTURE_KEYS.animalGa;
      else if (sym === 'nai') texKey = MINIGAME_TEXTURE_KEYS.animalNai;

      const icon = this.scene.add.image(0, -6, texKey).setDisplaySize(38, 38);
      const name = this.scene.add.text(0, 20, ANIMAL_DEFINITIONS[sym].nameVi.toUpperCase(), {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '10px',
        color: isMatch ? MINIGAME_PALETTE.goldBright : '#CBD1CB',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      slotCont.add([frame, icon, name]);

      if (!this.skipAnimation) {
        slotCont.setScale(0).setAlpha(0);
        this.scene.tweens.add({
          targets: slotCont,
          scale: 1,
          alpha: 1,
          duration: 250,
          delay: i * 120,
          ease: 'Back.easeOut',
        });
      }

      this.revealContainer.add(slotCont);
    }
  }

  private renderResolvedBanner(session: MinigamePublicSession): void {
    this.actionControlsContainer.removeAll(true);
    this.resultBannerContainer.removeAll(true);

    const state = session.publicState as AnimalGuessPublicState;
    const res = session.result;
    const reward = session.reward;
    const matches = state.matchCount ?? 0;

    const bannerY = 405;

    let bannerTitle = 'KẾT QUẢ MỞ LINH HÌNH';
    let bannerColor = MINIGAME_PALETTE.goldBright;

    if (matches === 3) {
      bannerTitle = 'TRÚNG CẢ 3 LINH VẬT — THẦN LINH CHIẾU CỐ!';
      bannerColor = '#8BC49B';
    } else if (matches === 2) {
      bannerTitle = 'TRÚNG 2 LINH VẬT XUẤT SẮC!';
      bannerColor = '#8BC49B';
    } else if (matches === 1) {
      bannerTitle = 'CHÚC MỪNG — TRÚNG 1 LINH VẬT CÁT TƯỜNG!';
      bannerColor = MINIGAME_PALETTE.goldLight;
    } else {
      bannerTitle = 'CHƯA TRÚNG LINH HÌNH LẦN NÀY!';
      bannerColor = '#E86D63';
    }

    const titleText = this.scene.add.text(380, bannerY - 12, bannerTitle, {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '15px',
      color: bannerColor,
      fontStyle: 'bold',
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(titleText);

    const rewardPts = reward?.totalPoints ?? 5;
    const rewardDesc = `+${rewardPts} FestivalPoints ${
      matches > 0 ? `(${reward?.bonusPoints} điểm trúng + 5 tham gia)` : '(5 điểm tham gia)'
    }`;
    const rewardText = this.scene.add.text(380, bannerY + 12, rewardDesc, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldLight,
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(rewardText);

    // Nút VÁN MỚI
    const remaining = session.remainingDailyPlays;
    const playAgainBtn = this.createActionButton(
      640,
      bannerY,
      170,
      40,
      remaining > 0 ? `VÁN MỚI (${remaining} lượt)` : 'HẾT LƯỢT HÔM NAY',
      () => {
        if (remaining > 0) {
          this.startNewGame();
        }
      },
      remaining > 0 ? 0x274936 : 0x212b28,
      remaining > 0 ? 0x8bc49b : 0x73807d,
      remaining > 0
    );
    this.resultBannerContainer.add(playAgainBtn);
  }

  private createActionButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    fillColor: number,
    strokeColor: number,
    enabled: boolean
  ): Phaser.GameObjects.Container {
    const cont = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, w, h, fillColor)
      .setStrokeStyle(1.8, strokeColor);

    if (enabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        onClick();
      });
    }

    const txt = this.scene.add.text(0, 0, text, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12.5px',
      color: enabled ? uiTokens.colors.text : uiTokens.colors.disabled,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([bg, txt]);
    return cont;
  }
}
