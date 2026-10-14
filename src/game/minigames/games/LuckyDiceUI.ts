/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * LuckyDiceUI — Bàn Chơi Xúc Xắc May Mắn
 * 
 * Vận hành bởi Lão Đồng Xúc:
 * - 2 Nút chọn lớn: TÀI (11–17) và XỈU (4–10).
 * - Bát lắc xúc xắc đồng Văn Lang với animation rung lắc ~1s (click để skip).
 * - Mở 3 mặt xúc xắc, tính tổng, phân định Thắng/Thua hoặc Bộ Ba Đồng Số.
 * - Cấp phần thưởng FestivalPoints và nút Chơi Ván Mới.
 */

import Phaser from 'phaser';
import {
  type DiceChoice,
  type MinigamePublicSession,
  type LuckyDicePublicState,
} from '../MinigameTypes';
import { minigameClient } from '../MinigameClient';
import { MINIGAME_TEXTURE_KEYS, MINIGAME_PALETTE } from '../MinigameArtwork';
import { uiTokens, uiTypography } from '../../ui/design-tokens';

export class LuckyDiceUI {
  private container: Phaser.GameObjects.Container;
  private currentSession: MinigamePublicSession | null = null;
  private selectedChoice: DiceChoice | null = null;
  private skipAnimation: boolean = false;
  private isShaking: boolean = false;
  private isProcessingAction: boolean = false;

  // Visual components
  private statusMessageText!: Phaser.GameObjects.Text;
  private cupImage!: Phaser.GameObjects.Image;
  private plateImage!: Phaser.GameObjects.Image;
  private diceContainer!: Phaser.GameObjects.Container;
  private choiceButtonsContainer!: Phaser.GameObjects.Container;
  private resultBannerContainer!: Phaser.GameObjects.Container;
  private shakeTween: Phaser.Tweens.Tween | null = null;

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
    if (this.shakeTween) {
      this.shakeTween.stop();
      this.shakeTween = null;
    }
    this.container.destroy(true);
  }

  public setSkipAnimation(skip: boolean): void {
    this.skipAnimation = skip;
  }

  public isAnimationSkipped(): boolean {
    return this.skipAnimation;
  }

  public getSelectedChoice(): DiceChoice | null {
    return this.selectedChoice;
  }

  public getCurrentSession(): MinigamePublicSession | null {
    return this.currentSession;
  }

  private buildLayout(): void {
    // 1. Dòng thông báo trạng thái
    this.statusMessageText = this.scene.add.text(480, 155, 'Chọn TÀI hoặc XỈU rồi nhấn Lắc Xúc Xắc.', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldLight,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.statusMessageText);

    // 2. Khu vực Bát và Đĩa xúc xắc (Trung tâm bàn chơi)
    const tableCenterX = 480;
    const tableCenterY = 250;

    // Đĩa đồng
    this.plateImage = this.scene.add.image(tableCenterX, tableCenterY + 28, MINIGAME_TEXTURE_KEYS.dicePlate)
      .setDisplaySize(180, 110);
    this.container.add(this.plateImage);

    // Container 3 viên xúc xắc nằm trên đĩa
    this.diceContainer = this.scene.add.container(0, 0);
    this.container.add(this.diceContainer);

    // Bát lắc úp lên trên xúc xắc
    this.cupImage = this.scene.add.image(tableCenterX, tableCenterY, MINIGAME_TEXTURE_KEYS.diceCup)
      .setDisplaySize(140, 140)
      .setInteractive({ useHandCursor: true });
    
    // Cho phép bấm vào bát để bỏ qua animation lắc ngay lập tức
    this.cupImage.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      if (this.isShaking) {
        this.finishShakeEarly();
      }
    });
    this.container.add(this.cupImage);

    // 3. Container nút chọn TÀI / XỈU
    this.choiceButtonsContainer = this.scene.add.container(0, 0);
    this.container.add(this.choiceButtonsContainer);

    // 4. Container kết quả ván chơi
    this.resultBannerContainer = this.scene.add.container(0, 0);
    this.container.add(this.resultBannerContainer);

    this.renderChoiceControls();
  }

  public async startNewGame(): Promise<void> {
    if (this.isProcessingAction || this.isShaking) return;
    this.isProcessingAction = true;
    this.selectedChoice = null;
    this.statusMessageText.setText('Lão Đồng Xúc đang chuẩn bị ba viên xúc xắc...');
    this.cupImage.setVisible(true).setPosition(480, 250).setAlpha(1);
    this.diceContainer.removeAll(true);

    try {
      const res = await minigameClient.start('lucky_dice', 'npc_lao_dong_xuc');
      if (res.ok && res.session) {
        this.currentSession = res.session;
        this.renderChoiceControls();
        this.onSessionUpdated?.(res.session);
        this.statusMessageText.setText('Hãy chọn TÀI (11–17) hoặc XỈU (4–10) rồi lắc xúc xắc.');
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
    const state = session.publicState as LuckyDicePublicState;

    if (!state) return;

    if (state.choice) {
      this.selectedChoice = state.choice;
    }

    if (state.dice && (session.status === 'resolved' || session.status === 'rewarded')) {
      // Đã mở bát
      this.cupImage.setVisible(false);
      this.renderDice(state.dice);
      this.renderResolvedBanner(session);
    } else {
      this.cupImage.setVisible(true);
      this.renderChoiceControls();
    }

    if (state.message) {
      this.statusMessageText.setText(state.message);
    }
  }

  private renderChoiceControls(): void {
    this.choiceButtonsContainer.removeAll(true);
    this.resultBannerContainer.removeAll(true);

    const btnY = 385;

    // Nút XỈU (4–10)
    const isXiuSelected = this.selectedChoice === 'xiu';
    const xiuBtn = this.createChoiceButton(
      340,
      btnY,
      170,
      50,
      'XỈU  (4 — 10)',
      'Tổng điểm từ 4 đến 10',
      isXiuSelected,
      () => {
        this.selectedChoice = 'xiu';
        this.renderChoiceControls();
      },
      0x1c3a32,
      0x497459
    );
    this.choiceButtonsContainer.add(xiuBtn);

    // Nút TÀI (11–17)
    const isTaiSelected = this.selectedChoice === 'tai';
    const taiBtn = this.createChoiceButton(
      620,
      btnY,
      170,
      50,
      'TÀI  (11 — 17)',
      'Tổng điểm từ 11 đến 17',
      isTaiSelected,
      () => {
        this.selectedChoice = 'tai';
        this.renderChoiceControls();
      },
      0x4a341e,
      0xc6a66b
    );
    this.choiceButtonsContainer.add(taiBtn);

    // Nút LẮC XÚC XẮC (Xác nhận lựa chọn)
    const canRoll = Boolean(this.selectedChoice && !this.isProcessingAction && !this.isShaking);
    const rollBtn = this.createActionButton(
      480,
      442,
      220,
      38,
      this.selectedChoice ? `LẮC XÚC XẮC (${this.selectedChoice.toUpperCase()})` : 'CHỌN TÀI HOẶC XỈU ĐỂ LẮC',
      () => {
        if (canRoll) this.onRoll();
      },
      canRoll ? 0x274936 : 0x212b28,
      canRoll ? 0x8bc49b : 0x73807d,
      canRoll
    );
    this.choiceButtonsContainer.add(rollBtn);
  }

  private async onRoll(): Promise<void> {
    if (!this.selectedChoice || !this.currentSession || this.isProcessingAction || this.isShaking) {
      return;
    }

    this.isProcessingAction = true;
    this.isShaking = true;
    this.statusMessageText.setText('Đang lắc xúc xắc trong bát đồng...');

    // Nếu không skip animation, thực hiện animation rung lắc bát
    if (!this.skipAnimation) {
      await this.playShakerAnimation();
    }

    try {
      const res = await minigameClient.action(this.currentSession.sessionId, {
        type: 'choose_dice',
        choice: this.selectedChoice,
      });

      if (res.ok && res.session) {
        this.currentSession = res.session;
        const state = res.session.publicState as LuckyDicePublicState;

        // Mở bát tiết lộ 3 viên xúc xắc
        await this.liftCupAnimation();

        if (state.dice) {
          this.renderDice(state.dice);
        }

        this.renderResolvedBanner(res.session);
        this.onSessionUpdated?.(res.session);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lắc xúc xắc';
      this.statusMessageText.setText(msg);
      this.cupImage.setPosition(480, 250);
    } finally {
      this.isProcessingAction = false;
      this.isShaking = false;
    }
  }

  private playShakerAnimation(): Promise<void> {
    return new Promise((resolve) => {
      const originX = 480;
      const originY = 250;

      this.shakeTween = this.scene.tweens.add({
        targets: this.cupImage,
        x: { from: originX - 6, to: originX + 6 },
        y: { from: originY - 3, to: originY + 3 },
        angle: { from: -4, to: 4 },
        duration: 70,
        yoyo: true,
        repeat: 10, // ~1s
        onComplete: () => {
          this.cupImage.setPosition(originX, originY).setAngle(0);
          this.shakeTween = null;
          resolve();
        },
      });
    });
  }

  private finishShakeEarly(): void {
    if (this.shakeTween) {
      this.shakeTween.stop();
      this.shakeTween = null;
      this.cupImage.setPosition(480, 250).setAngle(0);
    }
  }

  private liftCupAnimation(): Promise<void> {
    return new Promise((resolve) => {
      if (this.skipAnimation) {
        this.cupImage.setVisible(false);
        resolve();
        return;
      }

      this.scene.tweens.add({
        targets: this.cupImage,
        y: 160,
        alpha: 0,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.cupImage.setVisible(false);
          resolve();
        },
      });
    });
  }

  private renderDice(dice: [number, number, number]): void {
    this.diceContainer.removeAll(true);
    const spacing = 58;
    const startX = 480 - spacing;
    const diceY = 265;

    dice.forEach((val, idx) => {
      const dx = startX + idx * spacing;
      const diceTexKey = `minigame_dice_${val}`;

      const diceImg = this.scene.add.image(dx, diceY, diceTexKey).setDisplaySize(48, 48);

      if (!this.skipAnimation) {
        diceImg.setScale(0).setAngle(Phaser.Math.Between(-30, 30));
        this.scene.tweens.add({
          targets: diceImg,
          scale: 48 / 64,
          angle: 0,
          duration: 250,
          delay: idx * 80,
          ease: 'Back.easeOut',
        });
      } else {
        diceImg.setDisplaySize(48, 48);
      }

      this.diceContainer.add(diceImg);
    });
  }

  private renderResolvedBanner(session: MinigamePublicSession): void {
    this.choiceButtonsContainer.removeAll(true);
    this.resultBannerContainer.removeAll(true);

    const state = session.publicState as LuckyDicePublicState;
    const res = session.result;
    const reward = session.reward;
    const dice = state.dice ?? [1, 1, 1];
    const total = state.total ?? dice[0] + dice[1] + dice[2];

    const bannerY = 405;

    // Header kết quả
    let outcomeTitle = 'KẾT QUẢ VÁN';
    let outcomeColor = MINIGAME_PALETTE.goldBright;

    if (state.isTriple) {
      outcomeTitle = `BỘ BA ĐỒNG SỐ (${dice[0]}-${dice[1]}-${dice[2]}) — HÒA ĐẶC BIỆT!`;
      outcomeColor = MINIGAME_PALETTE.goldLight;
    } else if (res?.won) {
      outcomeTitle = `DỰ ĐOÁN CHÍNH XÁC: ${state.category?.toUpperCase()} (${total} ĐIỂM)!`;
      outcomeColor = '#8BC49B';
    } else {
      outcomeTitle = `KẾT QUẢ: ${state.category?.toUpperCase()} (${total} ĐIỂM) — CHÚC MAY MẮN LẦN SAU!`;
      outcomeColor = '#E86D63';
    }

    const titleText = this.scene.add.text(380, bannerY - 12, outcomeTitle, {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '15px',
      color: outcomeColor,
      fontStyle: 'bold',
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(titleText);

    // Phần thưởng
    const rewardPts = reward?.totalPoints ?? 5;
    const rewardDesc = `+${rewardPts} FestivalPoints ${res?.won ? '(10 điểm thắng)' : '(5 điểm tham gia)'}`;
    const rewardText = this.scene.add.text(380, bannerY + 12, rewardDesc, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldLight,
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(rewardText);

    // Nút CHƠI VÁN MỚI
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

  private createChoiceButton(
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    subtitle: string,
    selected: boolean,
    onClick: () => void,
    fillColor: number,
    strokeColor: number
  ): Phaser.GameObjects.Container {
    const cont = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, w, h, selected ? fillColor + 0x1a1a1a : fillColor)
      .setStrokeStyle(selected ? 3 : 1.8, selected ? 0xf3c66f : strokeColor)
      .setInteractive({ useHandCursor: true });

    const txtTitle = this.scene.add.text(0, -8, title, {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '15px',
      color: selected ? MINIGAME_PALETTE.goldBright : uiTokens.colors.text,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    const txtSub = this.scene.add.text(0, 12, subtitle, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      color: selected ? MINIGAME_PALETTE.goldLight : uiTokens.colors.textMuted,
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([bg, txtTitle, txtSub]);

    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onClick();
    });

    return cont;
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
      fontSize: '13px',
      color: enabled ? uiTokens.colors.text : uiTokens.colors.disabled,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([bg, txt]);
    return cont;
  }
}
