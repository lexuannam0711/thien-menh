import Phaser from 'phaser';
import { BALANCE, UI_DEPTH } from '../../data/config';
import { gameState, getPlayerStats } from '../systems/GameState';
import { getChapterWorldConfig } from '../world/ChapterWorld';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from './design-tokens';
import { ResponsiveLayout } from './ResponsiveLayout';
import { SkillButton, type SkillInfo } from './components/SkillButton';
import { getSkill, type SkillDefinition } from '../../data/skills';
import { graphicsSettings } from '../rendering/GraphicsSettings';

/**
 * Hud Component — Thần Mệnh: Hậu Duệ Văn Lang
 *
 * Tái cấu trúc theo phong cách Premium Ancient Bronze Fantasy:
 * - Cụm Trạng thái Góc Trên-Trái: Thanh Máu & Năng lượng gọn gàng, viền đồng Đông Sơn,
 *   huy hiệu Cấp độ (Lv.N) và Tiền vàng (N đồng), không che khuất giữa màn hình.
 * - Bảng Nhiệm vụ Góc Trên-Phải: Tự co giãn theo ResponsiveLayout, hỗ trợ toggle thu gọn [ - ] / [ + ],
 *   cảnh báo trạng thái lưu khi cần.
 * - Thanh Kỹ năng Desktop Mép Dưới: 4 slot dùng SkillButton với nhãn 1, 2, 3, 4,
 *   cooldown radial sweep, MP cost warning, tooltip chiêu, ẩn tự động trên Mobile.
 * - Thanh Máu Boss Góc Trên-Giữa: Viền đồng cổ, tên boss, % máu, tự ẩn khi boss chết.
 * - Toast tiện ích sắc nét, chuẩn tokens.
 */
export class Hud {
  private layout: ResponsiveLayout;

  // --- Cụm Trạng thái Góc Trên-Trái (Top-Left Status) ---
  private statusContainer: Phaser.GameObjects.Container;
  private statusBg: Phaser.GameObjects.Graphics;
  private health: Phaser.GameObjects.Rectangle;
  private mana: Phaser.GameObjects.Rectangle;
  private healthLabel: Phaser.GameObjects.Text;
  private manaLabel: Phaser.GameObjects.Text;
  private levelBadgeBg: Phaser.GameObjects.Graphics;
  private levelLabel: Phaser.GameObjects.Text;
  private goldLabel: Phaser.GameObjects.Text;
  private statLabel: Phaser.GameObjects.Text;

  // --- Bảng Nhiệm vụ Góc Trên-Phải (Top-Right Quest Tracker) ---
  private questContainer: Phaser.GameObjects.Container;
  private questBg: Phaser.GameObjects.Graphics;
  private questTitle: Phaser.GameObjects.Text;
  private questToggleBtn: Phaser.GameObjects.Text;
  private questLabel: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Text;
  private isQuestCollapsed = false;

  // --- Thanh Kỹ năng Desktop Mép Dưới (Desktop Skillbar) ---
  private skillbarContainer: Phaser.GameObjects.Container;
  private skillbarBg: Phaser.GameObjects.Graphics;
  private skillButtons: SkillButton[] = [];

  // --- Thanh Máu Boss Góc Trên-Giữa (Boss Health Bar) ---
  private bossContainer: Phaser.GameObjects.Container;
  private bossBg: Phaser.GameObjects.Graphics;
  private bossNameLabel: Phaser.GameObjects.Text;
  private bossHpFill: Phaser.GameObjects.Rectangle;
  private bossHpLabel: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private readonly place: string) {
    const width = scene.cameras?.main?.width ?? 960;
    const height = scene.cameras?.main?.height ?? 540;
    this.layout = new ResponsiveLayout(width, height);

    // =========================================================================
    // 1. CỤM TRẠNG THÁI GÓC TRÊN-TRÁI (TOP-LEFT STATUS)
    // =========================================================================
    const topLeft = this.layout.getAnchor('TOP_LEFT', 12, 12);
    this.statusContainer = scene.add.container(topLeft.x, topLeft.y).setDepth(UI_DEPTH);

    // Nền panel đồng cổ (236 x 48 px — siêu gọn gàng so với 360x69 cũ)
    this.statusBg = scene.add.graphics();
    this.renderStatusFrame();
    this.statusContainer.add(this.statusBg);

    // Huy hiệu cấp độ (Avatar medallion)
    this.levelBadgeBg = scene.add.graphics();
    this.renderLevelBadgeFrame();
    this.statusContainer.add(this.levelBadgeBg);

    this.levelLabel = scene.add.text(22, 24, 'Lv.1', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: uiTokens.colors.gold,
    }).setOrigin(0.5, 0.5);
    this.statusContainer.add(this.levelLabel);

    // Thanh Huyết (HP)
    const hpBg = scene.add.rectangle(44, 8, 124, 12, 0x2d1717).setOrigin(0, 0);
    this.health = scene.add.rectangle(44, 8, 124, 12, uiNumericColors.danger).setOrigin(0, 0);
    this.healthLabel = scene.add.text(48, 8, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.statusContainer.add([hpBg, this.health, this.healthLabel]);

    // Thanh Linh (MP)
    const mpBg = scene.add.rectangle(44, 24, 124, 11, 0x15222b).setOrigin(0, 0);
    this.mana = scene.add.rectangle(44, 24, 124, 11, uiNumericColors.mana).setOrigin(0, 0);
    this.manaLabel = scene.add.text(48, 24, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.statusContainer.add([mpBg, this.mana, this.manaLabel]);

    // Tiền vàng (Gold display)
    this.goldLabel = scene.add.text(176, 24, '0 đ', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: uiTokens.colors.gold,
      stroke: '#101518',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.statusContainer.add(this.goldLabel);

    // Label dự phòng cho tương thích test cũ
    this.statLabel = scene.add.text(22, 42, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '10px',
      color: uiTokens.colors.textMuted,
    }).setVisible(false);
    this.statusContainer.add(this.statLabel);

    // =========================================================================
    // 2. BẢNG NHIỆM VỤ GÓC TRÊN-PHẢI (TOP-RIGHT QUEST TRACKER)
    // =========================================================================
    const topRight = this.layout.getAnchor('TOP_RIGHT', -12, 12);
    this.questContainer = scene.add.container(topRight.x - 290, topRight.y).setDepth(UI_DEPTH);

    this.questBg = scene.add.graphics();
    this.questContainer.add(this.questBg);

    this.questTitle = scene.add.text(10, 8, '📜 NHIỆM VỤ', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: uiTokens.colors.gold,
    });
    this.questContainer.add(this.questTitle);

    this.questToggleBtn = scene.add.text(256, 7, '[ - ]', {
      fontFamily: uiTypography.fontFamilies.mono,
      fontSize: '12px',
      fontStyle: 'bold',
      color: uiTokens.colors.accent,
    }).setInteractive({ useHandCursor: true });

    this.questToggleBtn.on('pointerdown', () => this.toggleQuest());
    this.questToggleBtn.on('pointerover', () => this.questToggleBtn.setColor(uiTokens.colors.gold));
    this.questToggleBtn.on('pointerout', () => this.questToggleBtn.setColor(uiTokens.colors.accent));
    this.questContainer.add(this.questToggleBtn);

    this.questLabel = scene.add.text(10, 25, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      color: uiTokens.colors.text,
      wordWrap: { width: 270 },
    });
    this.questContainer.add(this.questLabel);

    this.zone = scene.add.text(10, 42, place, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '10px',
      color: uiTokens.colors.success,
    });
    this.questContainer.add(this.zone);

    this.renderQuestTrackerFrame();

    // =========================================================================
    // 3. THANH KỸ NĂNG DESKTOP (BOTTOM-CENTER SKILLBAR)
    // =========================================================================
    const bottomCenter = this.layout.getAnchor('BOTTOM_CENTER', 0, -14);
    this.skillbarContainer = scene.add.container(bottomCenter.x, bottomCenter.y).setDepth(UI_DEPTH);

    // Máng nền viền đồng
    this.skillbarBg = scene.add.graphics();
    this.renderSkillbarFrame();
    this.skillbarContainer.add(this.skillbarBg);

    // 4 Slots kỹ năng (1, 2, 3, 4)
    const slotOffsets = [-84, -28, 28, 84];
    const hotkeyLabels = ['1', '2', '3', '4'];
    const slotKeys: ('slot-1' | 'slot-2' | 'slot-3' | 'slot-4')[] = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];

    for (let i = 0; i < 4; i++) {
      const btn = new SkillButton(scene, {
        x: slotOffsets[i],
        y: 0,
        size: 50,
        slotIndex: i,
        showHotkey: true,
        onPress: () => {
          scene.events.emit('player:cast-skill', slotKeys[i]);
        },
      });
      this.skillButtons.push(btn);
      this.skillbarContainer.add(btn);
    }

    // Tự động ẩn thanh kỹ năng desktop nếu là thiết bị cảm ứng thuần / mobile
    if (this.layout.isMobile()) {
      this.skillbarContainer.setVisible(false);
    }

    // =========================================================================
    // 4. THANH MÁU BOSS GÓC TRÊN-GIỮA (TOP-CENTER BOSS HEALTH BAR)
    // =========================================================================
    const topCenter = this.layout.getAnchor('TOP_CENTER', 0, 16);
    this.bossContainer = scene.add.container(topCenter.x, topCenter.y).setDepth(UI_DEPTH + 10).setVisible(false);

    this.bossBg = scene.add.graphics();
    this.bossContainer.add(this.bossBg);

    this.bossNameLabel = scene.add.text(0, -12, 'TRÙM HUYỀN THOẠI', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '12px',
      fontStyle: 'bold',
      color: uiTokens.colors.gold,
      stroke: '#101518',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    this.bossContainer.add(this.bossNameLabel);

    const bossHpBg = scene.add.rectangle(-190, 4, 380, 12, 0x2e1919).setOrigin(0, 0);
    this.bossHpFill = scene.add.rectangle(-190, 4, 380, 12, uiNumericColors.danger).setOrigin(0, 0);
    this.bossHpLabel = scene.add.text(0, 10, '100%', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.bossContainer.add([bossHpBg, this.bossHpFill, this.bossHpLabel]);
    this.renderBossBarFrame();

    // Tự động giải phóng khi Scene shutdown
    scene.events.once('shutdown', () => this.destroy());

    this.refresh();
  }

  // =========================================================================
  // FRAME RENDERING
  // =========================================================================

  private renderStatusFrame(): void {
    const g = this.statusBg;
    g.clear();
    const w = 236;
    const h = 48;
    const r = uiTokens.radius.md; // 10px

    // Nền tối đồng cổ
    g.fillStyle(uiNumericColors.bg, 0.92);
    g.fillRoundedRect(0, 0, w, h, r);

    // Viền đồng
    g.lineStyle(1.5, uiNumericColors.border, 0.9);
    g.strokeRoundedRect(0, 0, w, h, r);

    // Đinh tán góc phong cách Đông Sơn
    g.fillStyle(uiNumericColors.gold, 0.7);
    g.fillCircle(4, 4, 1.5);
    g.fillCircle(w - 4, 4, 1.5);
    g.fillCircle(4, h - 4, 1.5);
    g.fillCircle(w - 4, h - 4, 1.5);
  }

  private renderLevelBadgeFrame(): void {
    const g = this.levelBadgeBg;
    g.clear();
    const cx = 22;
    const cy = 24;
    const rad = 15;

    g.fillStyle(uiNumericColors.surfaceRaised, 0.95);
    g.fillCircle(cx, cy, rad);
    g.lineStyle(1.5, uiNumericColors.gold, 0.9);
    g.strokeCircle(cx, cy, rad);
  }

  private renderQuestTrackerFrame(): void {
    const g = this.questBg;
    g.clear();
    const w = this.isQuestCollapsed ? 130 : 290;
    const h = this.isQuestCollapsed ? 30 : 58;
    const r = uiTokens.radius.sm; // 6px

    g.fillStyle(uiNumericColors.bg, 0.92);
    g.fillRoundedRect(0, 0, w, h, r);
    g.lineStyle(1.5, uiNumericColors.border, 0.85);
    g.strokeRoundedRect(0, 0, w, h, r);
  }

  private renderSkillbarFrame(): void {
    const g = this.skillbarBg;
    g.clear();
    const w = 236;
    const h = 58;
    const r = uiTokens.radius.md;

    g.fillStyle(uiNumericColors.bg, 0.82);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(1.5, uiNumericColors.border, 0.75);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  private renderBossBarFrame(): void {
    const g = this.bossBg;
    g.clear();
    const w = 410;
    const h = 38;
    const r = uiTokens.radius.sm;

    g.fillStyle(0x19211c, 0.92);
    g.fillRoundedRect(-w / 2, -18, w, h, r);

    // Viền vàng đồng đôi sang trọng
    g.lineStyle(2, uiNumericColors.gold, 0.95);
    g.strokeRoundedRect(-w / 2, -18, w, h, r);

    g.lineStyle(1, uiNumericColors.border, 0.6);
    g.strokeRoundedRect(-w / 2 + 3, -15, w - 6, h - 6, r);
  }

  // =========================================================================
  // QUEST TRACKER TOGGLE
  // =========================================================================

  public toggleQuest(): void {
    this.setQuestCollapsed(!this.isQuestCollapsed);
  }

  public setQuestCollapsed(collapsed: boolean): void {
    this.isQuestCollapsed = collapsed;
    const topRight = this.layout.getAnchor('TOP_RIGHT', -12, 12);
    const w = this.isQuestCollapsed ? 130 : 290;
    this.questContainer.setPosition(topRight.x - w, topRight.y);

    this.renderQuestTrackerFrame();

    if (this.isQuestCollapsed) {
      this.questToggleBtn.setText('[ + ]').setPosition(96, 7);
      this.questLabel.setVisible(false);
      this.zone.setVisible(false);
    } else {
      this.questToggleBtn.setText('[ - ]').setPosition(256, 7);
      this.questLabel.setVisible(true);
      this.zone.setVisible(true);
    }
  }

  public isQuestCollapsedState(): boolean {
    return this.isQuestCollapsed;
  }

  // =========================================================================
  // BOSS HEALTH BAR
  // =========================================================================

  public setBossHealth(bossName: string | null, currentHp = 0, maxHp = 100): void {
    if (!bossName || currentHp <= 0 || maxHp <= 0) {
      this.bossContainer.setVisible(false);
      return;
    }

    this.bossContainer.setVisible(true);
    this.bossNameLabel.setText(bossName.toUpperCase());
    const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
    this.bossHpFill.setScale(ratio, 1);
    this.bossHpLabel.setText(`${Math.ceil(currentHp)}/${maxHp} (${Math.round(ratio * 100)}%)`);
  }

  public isBossBarVisible(): boolean {
    return this.bossContainer.visible;
  }

  // =========================================================================
  // SKILLBAR REFRESH & GETTERS
  // =========================================================================

  public getSkillButton(index: number): SkillButton | undefined {
    return this.skillButtons[index];
  }

  public updateSkillCooldown(slotKey: 'slot-1' | 'slot-2' | 'slot-3' | 'slot-4', remainingMs: number, totalMs: number): void {
    const slotIdx = slotKey === 'slot-1' ? 0 : slotKey === 'slot-2' ? 1 : slotKey === 'slot-3' ? 2 : 3;
    const btn = this.skillButtons[slotIdx];
    if (btn) {
      btn.setCooldown(remainingMs, totalMs);
    }
  }

  // =========================================================================
  // DATA REFRESH CYCLE
  // =========================================================================

  public refresh(): void {
    const s = gameState.data;
    const world = typeof getChapterWorldConfig === 'function' ? getChapterWorldConfig(s.chapter) : { bossName: 'Boss' };
    const caps = typeof getPlayerStats === 'function' ? getPlayerStats(s) : { maxHp: s.maxHp || 100, maxMp: s.maxMp || 50 };

    // 1. Cập nhật Huyết và Linh
    const hpRatio = Math.max(0, Math.min(1, s.hp / (caps.maxHp || 1)));
    const mpRatio = Math.max(0, Math.min(1, s.mp / (caps.maxMp || 1)));
    this.health?.setScale(hpRatio, 1);
    this.mana?.setScale(mpRatio, 1);
    this.healthLabel?.setText(`HUYẾT ${Math.ceil(s.hp)}/${caps.maxHp}`);
    this.manaLabel?.setText(`LINH ${Math.ceil(s.mp)}/${caps.maxMp}`);

    // 2. Cấp độ và Tiền vàng
    this.levelLabel?.setText(`Lv.${s.level}`);
    this.goldLabel?.setText(`${s.gold} đ`);
    this.statLabel?.setText(`Lv.${s.level}\n${s.gold} đồng`);

    // 3. Nhiệm vụ và Cảnh báo lưu trữ
    const questMsg = s.quest === 'new'
      ? 'Gặp trưởng làng để nhận nhiệm vụ'
      : s.quest === 'active'
      ? `Săn quái: ${Math.min(s.kills, BALANCE?.requiredKills ?? 8)}/${BALANCE?.requiredKills ?? 8} | Boss: ${s.bossDead ? 'đã hạ' : 'chưa hạ'}`
      : s.quest === 'return'
      ? `Đã hạ ${world.bossName}! Về báo trưởng làng`
      : 'Nhiệm vụ hoàn thành!';
    this.questLabel?.setText(questMsg);

    const storageWarning = gameState.loadError || gameState.saveError;
    this.zone?.setText(storageWarning ? 'CHƯA LƯU — tiến trình mới chỉ được giữ trong phiên chơi này.' : this.place)
      ?.setColor(storageWarning ? '#ffe0a3' : '#a3c9a8');

    // 4. Thanh Kỹ năng Desktop
    if (Array.isArray(this.skillButtons)) {
      const slotKeys: ('slot-1' | 'slot-2' | 'slot-3' | 'slot-4')[] = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
      const now = Date.now();

      for (let i = 0; i < 4; i++) {
        const slotKey = slotKeys[i];
        const btn = this.skillButtons[i];
        if (!btn) continue;

        const skillId = s.rpg?.skills?.equippedSlots?.[slotKey];
        const skillDef: SkillDefinition | undefined = (skillId && typeof getSkill === 'function') ? getSkill(skillId) : undefined;

        if (skillDef) {
          const elementColor =
            skillDef.element === 'earth' ? 0x877349 :
            skillDef.element === 'flame' ? 0xc4744c :
            skillDef.element === 'water' ? 0x397f99 : 0x66558a;

          const info: SkillInfo = {
            id: skillDef.id,
            name: skillDef.vietnameseName || skillDef.name,
            description: skillDef.description,
            hotkey: `${i + 1}`,
            mpCost: skillDef.cost?.mp ?? 0,
            cooldownMs: skillDef.cooldownMs ?? 0,
            iconColor: elementColor,
          };

          btn.setSkill(info);
          btn.setLocked(false);
          btn.setMp(s.mp);

          const cooldownUntil = s.rpg?.skills?.cooldownUntil?.[skillDef.id] ?? 0;
          const remaining = Math.max(0, cooldownUntil - now);
          btn.setCooldown(remaining, skillDef.cooldownMs ?? 1);
        } else {
          // Slot trống hoặc chưa mở khóa
          btn.setSkill(null);
          btn.setLocked(true, i === 2 ? 3 : 5);
        }
      }
    }
  }

  public destroy(): void {
    if (this.scene) {
      this.scene.tweens?.killTweensOf(this.statusContainer);
      this.scene.tweens?.killTweensOf(this.questContainer);
      this.scene.tweens?.killTweensOf(this.skillbarContainer);
      this.scene.tweens?.killTweensOf(this.bossContainer);
    }
    this.statusContainer.destroy(true);
    this.questContainer.destroy(true);
    this.skillbarContainer.destroy(true);
    this.bossContainer.destroy(true);
  }
}

/**
 * Toast tiện ích phong cách cổ xưa Văn Lang:
 * Viền đồng cổ, nền tối bề mặt nổi, hỗ trợ chữ tiếng Việt sắc nét.
 */
export function toast(scene: Phaser.Scene, text: string, color = '#f9e9bd'): void {
  const previous = scene.children.getByName('status-toast');
  if (previous) {
    scene.tweens.killTweensOf(previous);
    previous.destroy();
  }

  const toastWidth = Math.min(680, Math.max(220, text.length * 9 + 44));
  const toastHeight = 36;
  const radius = uiTokens.radius.md;

  const bg = scene.add.graphics();
  bg.fillStyle(uiNumericColors.bg, 0.95);
  bg.fillRoundedRect(-toastWidth / 2, -toastHeight / 2, toastWidth, toastHeight, radius);
  bg.lineStyle(1.5, uiNumericColors.gold, 0.9);
  bg.strokeRoundedRect(-toastWidth / 2, -toastHeight / 2, toastWidth, toastHeight, radius);

  const textObj = scene.add.text(0, 0, text, {
    fontFamily: uiTypography.fontFamilies.body,
    fontSize: '13px',
    fontStyle: 'bold',
    color: color,
    align: 'center',
  }).setOrigin(0.5, 0.5);

  const screenWidth = scene.cameras?.main?.width ?? 960;
  const container = scene.add
    .container(screenWidth / 2, 115, [bg, textObj])
    .setName('status-toast')
    .setDepth(UI_DEPTH + 100);

  const prefersReduced =
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    Boolean(graphicsSettings.getState().reducedMotion);

  if (prefersReduced) {
    scene.time.delayedCall(2400, () => container.destroy(true));
  } else {
    container.setAlpha(0).setScale(0.96);
    scene.tweens.add({
      targets: container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: uiTokens.motionMs.fast,
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: container,
          alpha: 0,
          scaleX: 0.96,
          scaleY: 0.96,
          delay: 2000,
          duration: uiTokens.motionMs.normal,
          ease: 'Quad.easeIn',
          onComplete: () => container.destroy(true),
        });
      },
    });
  }
}
