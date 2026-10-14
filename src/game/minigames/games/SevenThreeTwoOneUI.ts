/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * SevenThreeTwoOneUI — Bàn Chơi Thẻ Bài 7321
 * 
 * Đối kháng với Thầy Thẻ Lạc:
 * - Vùng Bài Nhà Cái (Dealer) với lá bài úp bí mật.
 * - Vùng Bài Của Bạn (Player) với tính điểm tối ưu Ách (Ace 1/11).
 * - Nút Rút (HIT), Dừng (STAND), Bỏ qua animation.
 * - Bảng kết quả Thắng/Hòa/Quắc/Natural 21 và thưởng FestivalPoints.
 */

import Phaser from 'phaser';
import {
  type Card,
  type PublicCard,
  type MinigamePublicSession,
  type SevenThreeTwoOnePublicState,
} from '../MinigameTypes';
import { minigameClient } from '../MinigameClient';
import { MINIGAME_TEXTURE_KEYS, MINIGAME_PALETTE } from '../MinigameArtwork';
import { uiTokens, uiTypography } from '../../ui/design-tokens';

export class SevenThreeTwoOneUI {
  private container: Phaser.GameObjects.Container;
  private currentSession: MinigamePublicSession | null = null;
  private skipAnimation: boolean = false;
  private isProcessingAction: boolean = false;

  // Visual display elements
  private dealerCardsContainer!: Phaser.GameObjects.Container;
  private playerCardsContainer!: Phaser.GameObjects.Container;
  private dealerScoreText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private statusMessageText!: Phaser.GameObjects.Text;
  private actionButtonsContainer!: Phaser.GameObjects.Container;
  private resultBannerContainer!: Phaser.GameObjects.Container;

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

  public getCurrentSession(): MinigamePublicSession | null {
    return this.currentSession;
  }

  private buildLayout(): void {
    // 1. Thông báo trạng thái bàn chơi (Status banner ở đỉnh)
    this.statusMessageText = this.scene.add.text(480, 155, 'Đang chuẩn bị ván bài...', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldLight,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.statusMessageText);

    // 2. Khu vực Bài Nhà Cái
    const dealerLabel = this.scene.add.text(200, 182, 'BÀI NHÀ CÁI (THẦY THẺ LẠC)', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '13px',
      color: '#CBD1CB',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(dealerLabel);

    this.dealerScoreText = this.scene.add.text(760, 182, 'Điểm: ?', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldLight,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.container.add(this.dealerScoreText);

    this.dealerCardsContainer = this.scene.add.container(0, 0);
    this.container.add(this.dealerCardsContainer);

    // Đường gân phân cách giữa 2 vùng bài
    const sepGraphics = this.scene.add.graphics();
    sepGraphics.lineStyle(1, 0x8a6248, 0.4);
    sepGraphics.beginPath();
    sepGraphics.moveTo(190, 275);
    sepGraphics.lineTo(770, 275);
    sepGraphics.strokePath();
    this.container.add(sepGraphics);

    // 3. Khu vực Bài Của Bạn
    const playerLabel = this.scene.add.text(200, 295, 'BÀI CỦA BẠN (DŨNG SĨ VĂN LANG)', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(playerLabel);

    this.playerScoreText = this.scene.add.text(760, 295, 'Điểm: 0', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.container.add(this.playerScoreText);

    this.playerCardsContainer = this.scene.add.container(0, 0);
    this.container.add(this.playerCardsContainer);

    // 4. Container Nút Hành Động (HIT / STAND / SKIP ANIMATION)
    this.actionButtonsContainer = this.scene.add.container(0, 0);
    this.container.add(this.actionButtonsContainer);

    // 5. Container Kết quả ván chơi
    this.resultBannerContainer = this.scene.add.container(0, 0);
    this.container.add(this.resultBannerContainer);

    this.renderActionControls();
  }

  public async startNewGame(): Promise<void> {
    if (this.isProcessingAction) return;
    this.isProcessingAction = true;
    this.statusMessageText.setText('Đang xáo bộ thẻ cổ Văn Lang...');

    try {
      const res = await minigameClient.start('7321', 'npc_thay_the_lac');
      if (res.ok && res.session) {
        this.currentSession = res.session;
        this.updateFromSession(res.session);
        this.onSessionUpdated?.(res.session);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      this.statusMessageText.setText(`Không thể bắt đầu: ${msg}`);
    } finally {
      this.isProcessingAction = false;
    }
  }

  public updateFromSession(session: MinigamePublicSession): void {
    this.currentSession = session;
    const state = session.publicState as SevenThreeTwoOnePublicState;

    if (!state) return;

    // Cập nhật thẻ bài nhà cái
    this.renderCards(this.dealerCardsContainer, state.dealerHand, 230, true);

    // Cập nhật điểm nhà cái
    if (state.dealerScore) {
      const d = state.dealerScore;
      this.dealerScoreText.setText(`Điểm: ${d.total}${d.isBust ? ' (Quắc)' : ''}`);
      this.dealerScoreText.setColor(d.isBust ? '#E86D63' : MINIGAME_PALETTE.goldLight);
    } else {
      this.dealerScoreText.setText('Điểm: ? (Còn 1 thẻ úp)');
      this.dealerScoreText.setColor(MINIGAME_PALETTE.goldLight);
    }

    // Cập nhật thẻ bài người chơi
    this.renderCards(this.playerCardsContainer, state.playerHand, 345, false);

    // Cập nhật điểm người chơi
    const p = state.playerScore;
    if (p) {
      let desc = `Điểm: ${p.total}`;
      if (p.isNatural21) desc += ' (Natural 21!)';
      else if (p.isSoft) desc += ' (Mềm - Ách = 11)';
      else if (p.isBust) desc += ' (Quắc!)';

      this.playerScoreText.setText(desc);
      this.playerScoreText.setColor(p.isBust ? '#E86D63' : p.isNatural21 ? '#8BC49B' : MINIGAME_PALETTE.goldBright);
    }

    // Cập nhật thông điệp hướng dẫn
    if (state.message) {
      this.statusMessageText.setText(state.message);
    }

    // Cập nhật vùng điều khiển hoặc kết quả
    if (session.status === 'rewarded' || session.status === 'resolved' || state.turn === 'resolved') {
      this.renderResolvedBanner(session);
    } else {
      this.renderActionControls();
    }
  }

  private renderCards(
    container: Phaser.GameObjects.Container,
    cards: PublicCard[],
    centerY: number,
    isDealer: boolean
  ): void {
    container.removeAll(true);
    if (!cards || cards.length === 0) return;

    const cardWidth = 56;
    const cardHeight = 78;
    const spacing = 64;
    const totalWidth = (cards.length - 1) * spacing + cardWidth;
    const startX = 480 - totalWidth / 2 + cardWidth / 2;

    cards.forEach((card, index) => {
      const x = startX + index * spacing;
      const isHidden = 'hidden' in card && card.hidden === true;

      const cardCont = this.scene.add.container(x, centerY);

      if (isHidden) {
        // Mặt sau thẻ bài Đông Sơn
        const back = this.scene.add.image(0, 0, MINIGAME_TEXTURE_KEYS.cardBack)
          .setDisplaySize(cardWidth, cardHeight);
        cardCont.add(back);

        const question = this.scene.add.text(0, 0, '?', {
          fontFamily: uiTypography.fontFamilies.display,
          fontSize: '20px',
          color: MINIGAME_PALETTE.goldBright,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);
        cardCont.add(question);
      } else {
        const fullCard = card as Card;
        // Mặt trước thẻ tre/đồng
        const front = this.scene.add.image(0, 0, MINIGAME_TEXTURE_KEYS.cardFront)
          .setDisplaySize(cardWidth, cardHeight);
        cardCont.add(front);

        // Ký hiệu Rank (số / chữ)
        const isRedSuit = fullCard.suit === 'hearts' || fullCard.suit === 'diamonds';
        const rankColor = isRedSuit ? '#c93b2b' : '#1c2a26';

        const rankText = this.scene.add.text(-18, -26, fullCard.rank, {
          fontFamily: uiTypography.fontFamilies.display,
          fontSize: '15px',
          color: rankColor,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);
        cardCont.add(rankText);

        // Biểu tượng chất bài
        let suitKey: string = MINIGAME_TEXTURE_KEYS.suitSpades;
        if (fullCard.suit === 'hearts') suitKey = MINIGAME_TEXTURE_KEYS.suitHearts;
        else if (fullCard.suit === 'diamonds') suitKey = MINIGAME_TEXTURE_KEYS.suitDiamonds;
        else if (fullCard.suit === 'clubs') suitKey = MINIGAME_TEXTURE_KEYS.suitClubs;

        const suitIcon = this.scene.add.image(10, 16, suitKey).setDisplaySize(20, 20);
        cardCont.add(suitIcon);

        // Chất nhỏ góc trên đối xứng
        const smallSuit = this.scene.add.image(-18, -12, suitKey).setDisplaySize(11, 11);
        cardCont.add(smallSuit);
      }

      // Animation phát thẻ ngắn nếu không chọn skip
      if (!this.skipAnimation) {
        cardCont.setAlpha(0).setScale(0.8);
        this.scene.tweens.add({
          targets: cardCont,
          alpha: 1,
          scale: 1,
          duration: 160,
          delay: index * 60,
          ease: 'Cubic.easeOut',
        });
      }

      container.add(cardCont);
    });
  }

  private renderActionControls(): void {
    this.resultBannerContainer.removeAll(true);
    this.actionButtonsContainer.removeAll(true);

    const btnY = 412;

    // Nút RÚT THẺ (HIT)
    const hitBtn = this.createButton(
      370,
      btnY,
      140,
      38,
      'RÚT THẺ (HIT)',
      () => this.onHit(),
      0x274936,
      0x8bc49b
    );
    this.actionButtonsContainer.add(hitBtn);

    // Nút DỪNG BÀI (STAND)
    const standBtn = this.createButton(
      530,
      btnY,
      140,
      38,
      'DỪNG (STAND)',
      () => this.onStand(),
      0x5a3c26,
      0xc6a66b
    );
    this.actionButtonsContainer.add(standBtn);

    // Nút toggle Bỏ qua diễn hoạt
    const skipLabel = this.skipAnimation ? 'Diễn hoạt: [TẮT]' : 'Diễn hoạt: [BẬT]';
    const skipBtn = this.createButton(
      700,
      btnY,
      120,
      32,
      skipLabel,
      () => {
        this.skipAnimation = !this.skipAnimation;
        this.renderActionControls();
      },
      0x1c2a26,
      0xCBD1CB
    );
    this.actionButtonsContainer.add(skipBtn);
  }

  private renderResolvedBanner(session: MinigamePublicSession): void {
    this.actionButtonsContainer.removeAll(true);
    this.resultBannerContainer.removeAll(true);

    const state = session.publicState as SevenThreeTwoOnePublicState;
    const res = session.result;
    const reward = session.reward;

    const bannerY = 412;

    // Xác định màu sắc kết quả
    let outcomeText = 'VÁN BÀI KẾT THÚC';
    let outcomeColor = MINIGAME_PALETTE.goldBright;

    if (res?.won) {
      outcomeText = state?.playerScore?.isNatural21 ? 'NATURAL 21 ĐỈNH CAO — THẮNG LỚN!' : 'BẠN ĐÃ CHIẾN THẮNG!';
      outcomeColor = '#8BC49B';
    } else if (res?.outcome === 'tie') {
      outcomeText = 'HÒA ĐIỂM VỚI THẦY THẺ LẠC!';
      outcomeColor = MINIGAME_PALETTE.goldLight;
    } else if (state?.playerScore?.isBust) {
      outcomeText = 'QUẮC BÀI — VƯỢT QUÁ 21 ĐIỂM!';
      outcomeColor = '#E86D63';
    } else {
      outcomeText = 'NHÀ CÁI ĐÃ CHIẾN THẮNG!';
      outcomeColor = '#E86D63';
    }

    const titleText = this.scene.add.text(380, bannerY - 10, outcomeText, {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '15px',
      color: outcomeColor,
      fontStyle: 'bold',
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(titleText);

    // Phần thưởng
    const rewardPts = reward?.totalPoints ?? 5;
    const rewardDesc = `+${rewardPts} FestivalPoints ${res?.won ? '(10 thắng + 5 tham gia)' : '(5 điểm tham gia)'}`;
    const rewardText = this.scene.add.text(380, bannerY + 12, rewardDesc, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12px',
      color: MINIGAME_PALETTE.goldLight,
      align: 'left',
    }).setOrigin(0.5, 0.5);
    this.resultBannerContainer.add(rewardText);

    // Nút CHƠI VÁN MỚI
    const remaining = session.remainingDailyPlays;
    const playAgainBtn = this.createButton(
      640,
      bannerY,
      170,
      38,
      remaining > 0 ? `VÁN MỚI (${remaining} lượt)` : 'HẾT LƯỢT HÔM NAY',
      () => {
        if (remaining > 0) {
          this.startNewGame();
        }
      },
      remaining > 0 ? 0x274936 : 0x263330,
      remaining > 0 ? 0x8bc49b : 0x73807D
    );
    this.resultBannerContainer.add(playAgainBtn);
  }

  private async onHit(): Promise<void> {
    if (!this.currentSession || this.isProcessingAction) return;
    this.isProcessingAction = true;
    this.statusMessageText.setText('Đang rút thêm thẻ...');

    try {
      const res = await minigameClient.action(this.currentSession.sessionId, { type: 'hit' });
      if (res.ok && res.session) {
        this.updateFromSession(res.session);
        this.onSessionUpdated?.(res.session);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi rút thẻ';
      this.statusMessageText.setText(msg);
    } finally {
      this.isProcessingAction = false;
    }
  }

  private async onStand(): Promise<void> {
    if (!this.currentSession || this.isProcessingAction) return;
    this.isProcessingAction = true;
    this.statusMessageText.setText('Bạn dừng bài. Thầy Thẻ Lạc đang mở thẻ bí mật...');

    try {
      const res = await minigameClient.action(this.currentSession.sessionId, { type: 'stand' });
      if (res.ok && res.session) {
        this.updateFromSession(res.session);
        this.onSessionUpdated?.(res.session);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi dừng bài';
      this.statusMessageText.setText(msg);
    } finally {
      this.isProcessingAction = false;
    }
  }

  private createButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    fillColor = 0x243033,
    strokeColor = 0x8e754a
  ): Phaser.GameObjects.Container {
    const cont = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, w, h, fillColor)
      .setStrokeStyle(1.8, strokeColor)
      .setInteractive({ useHandCursor: true });

    const txt = this.scene.add.text(0, 0, text, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([bg, txt]);

    bg.on('pointerover', () => {
      bg.setFillStyle(fillColor + 0x111111);
      txt.setColor(MINIGAME_PALETTE.goldBright);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(fillColor);
      txt.setColor(uiTokens.colors.text);
    });

    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onClick();
    });

    return cont;
  }
}
