import Phaser from 'phaser';
import { BALANCE, PALETTE, W, H, UI_DEPTH } from '../../data/config';
import { Player } from '../entities/Player';
import { CombatSystem } from '../systems/CombatSystem';
import { gameState, getPlayerStats } from '../systems/GameState';
import { actor, button, label, paintVillage } from '../ui/art';
import { Hud, toast } from '../ui/Hud';
import { loadGameAssets, createGameAnimations, SPRITE_KEYS } from '../assets/assetLoader';
import { VILLAGE_BARRIERS } from '../world/WorldBounds';
import { addItem } from '../rpg/InventorySystem';
import { equipItem } from '../rpg/EquipmentSystem';
import { applyProgressToSave, claimQuest, progressFromSave, resetQuestForChapter, startQuest, startNpcQuests, claimNpcQuests, getNpcQuests, chapterQuestsReady } from '../rpg/QuestSystem';
import {
  RpgMenuModel,
  RPG_MENU_TABS,
  type RpgMenuTab,
} from '../ui/RpgMenuModel';
import { PauseOverlay } from '../ui/PauseOverlay';
import { audioManager } from '../audio/AudioManager';
import { getChapter } from '../../data/contentCatalog';
import { getChapterWorldConfig } from '../world/ChapterWorld';
import { getVillageNpcs } from '../world/NpcRoster';
import { addAtmosphere } from '../rendering/Atmosphere';
import { loadNpcArtwork, createNpcAnimations, NPC_ARTWORK_BY_ID } from '../assets/npcArtwork';
import { loadIconArtwork, ICON_TEXTURE_KEY, ITEM_ICON_FRAMES, SKILL_ICON_FRAMES } from '../assets/iconArtwork';
import { getEquippedWeaponOrDefault } from '../../data/weapons';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { DIVINE_POWERS, getSkillsByDivinePower, type DivinePowerId, type SkillDefinition } from '../../data/skills';

type NpcInfo = ReturnType<typeof getVillageNpcs>[number];
interface Choice { title: string; select: () => void; }

export class VillageScene extends Phaser.Scene {
  private player!: Player;
  private hud!: Hud;
  private combat!: CombatSystem;
  private overlay: Phaser.GameObjects.Container | null = null;
  private tabContentContainer: Phaser.GameObjects.Container | null = null;
  private menuModel: RpgMenuModel | null = null;
  private currentTab: RpgMenuTab = 'inventory';
  private skillPage = 0;
  private shopPage = 0;
  private sellPage = 0;
  private craftingPage = 0;
  private inventoryPage = 0;
  private equipmentPage = 0;
  private questPage = 0;
  private isRpgMenuOpen = false;
  private headerStatsText: Phaser.GameObjects.Text | null = null;
  private tabButtons: Phaser.GameObjects.Container[] = [];
  private pause!: PauseOverlay;
  private skillTooltipBox: Phaser.GameObjects.Container | null = null;

  private npcs: NpcInfo[] = [];
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();

  constructor() { super('Village'); }

  preload(): void {
    loadGameAssets(this);
    loadNpcArtwork(this);
    loadIconArtwork(this);
  }

  create(data?: { notice?: string }): void {
    createGameAnimations(this);
    createNpcAnimations(this);
    this.npcSprites = new Map();
    this.events.once('shutdown', () => { this.npcSprites = new Map(); });
    this.pause = new PauseOverlay(this, () => !this.overlay);
    audioManager.startMusic('village');
    this.overlay = null;
    this.tabContentContainer = null;
    this.isRpgMenuOpen = false;
    paintVillage(this);
    addAtmosphere(this, true);

    // Tạo các NPC trong làng với tương tác nhấn F hoặc bấm chuột
    this.npcs = getVillageNpcs(gameState.data.chapter);
    this.npcs.forEach((npc) => {
      this.drawNpc(npc);
      this.add.text(npc.x, npc.y + 25, 'F: NÓI', {
        fontSize: '12px',
        color: '#fff3cb',
        backgroundColor: '#1c392a',
      }).setOrigin(0.5).setDepth(110);
      this.add.zone(npc.x, npc.y, 78, 90).setInteractive({ useHandCursor: true })
        .setDepth(100).on('pointerdown', () => {
          if (!this.overlay && Phaser.Math.Distance.Between(this.player.x, this.player.y,
            npc.x, npc.y) < 118) this.interact(npc.name);
          else if (!this.overlay) toast(this, 'Đến gần NPC để trò chuyện.');
        });
    });

    this.combat = new CombatSystem(this, () => []);
    const fromForest = gameState.data.quest !== 'new' && Boolean(data?.notice);
    this.player = new Player(this, fromForest ? 820 : 406, 347, {
      basic: (step, direction) => this.combat.basic(this.player, step, direction),
      skill: (skill, damage, direction) => this.combat.skill(this.player, skill, damage, direction),
      interact: () => this.interactClosest(),
      dead: animationMs => this.onDeath(animationMs),
    }, () => Boolean(this.overlay) || this.pause.isOpen(), VILLAGE_BARRIERS);

    this.hud = new Hud(this, 'Làng Lạc Thủy · Khu an toàn');

    // Nút mở Menu RPG trên màn hình
    const menuBtn = button(
      this,
      865,
      80,
      148,
      'HÀNH TRANG [B]',
      () => {
        if (this.isRpgMenuOpen) this.closeRpgMenu();
        else if (!this.overlay) this.openRpgMenu();
      },
      0x385a4c,
    );
    menuBtn.setDepth(UI_DEPTH + 5);

    // Thiết lập phím tắt mở/đóng Menu RPG
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const code = event.code;
      if (code === 'KeyB') {
        if (this.isRpgMenuOpen) this.closeRpgMenu();
        else if (!this.overlay) this.openRpgMenu();
      } else if (code === 'KeyI') {
        if (this.isRpgMenuOpen && this.currentTab === 'inventory') this.closeRpgMenu();
        else if (!this.overlay || this.isRpgMenuOpen) this.openRpgMenu('inventory');
      } else if (code === 'KeyM') {
        if (this.isRpgMenuOpen) this.closeRpgMenu();
        else if (!this.overlay) this.openRpgMenu();
      } else if (code === 'Escape') {
        if (this.isRpgMenuOpen) this.closeRpgMenu();
        else if (this.overlay) this.closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    if (data?.notice) this.time.delayedCall(250, () => toast(this, data.notice!));

    this.events.once('shutdown', () => {
      this.pause.destroy();
      window.removeEventListener('keydown', onKeyDown);
      gameState.save();
    });
  }

  update(_time: number, delta: number): void {
    if (this.player.isDead || this.overlay || this.pause.isOpen()) return;
    gameState.tickPlaytime(delta);
    this.player.update(delta);
    this.hud.refresh();

    // Cổng sang Rừng Trúc phía Đông
    if (this.player.x > 912 && this.player.y > 193 && this.player.y < 344) {
      if (gameState.data.quest === 'new') {
        this.player.view.x = 885;
        toast(this, 'Hãy nhận nhiệm vụ từ trưởng làng trước.');
      } else {
        gameState.save();
        this.scene.start('Forest', { chapter: gameState.data.chapter });
      }
    }
  }

  private interactClosest(): void {
    let best: NpcInfo | null = null;
    let bestDistance = 110;
    for (const npc of this.npcs) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (distance < bestDistance) { bestDistance = distance; best = npc; }
    }
    if (best) this.interact(best.name);
    else toast(this, 'Lại gần một người dân và nhấn F.');
  }

  private drawNpc(npc: NpcInfo): void {
    const art = NPC_ARTWORK_BY_ID[npc.id];
    if (!art || !this.textures.exists(art.spriteKey)) {
      actor(this, npc.x, npc.y, npc.color, npc.name, 19);
      return;
    }
    const shadow = this.add.ellipse(0, 19, 34, 10, 0x112b26, 0.65);
    const sprite = this.add.sprite(0, 19 - art.feet + art.size / 2, art.spriteKey).play(art.idleAnimation);
    sprite.on('animationcomplete', () => sprite.play(art.idleAnimation));
    this.npcSprites = new Map([...this.npcSprites, [npc.id, sprite]]);
    const caption = label(this, 0, -42, npc.name, 13, '#fff5d2', 'center');
    this.add.container(npc.x, npc.y, [shadow, sprite, caption]).setDepth(30 + npc.y / 10);
  }

  private npcPortrait(npcId: string): Phaser.GameObjects.Image | null {
    const npc = this.npcs.find(entry => entry.id === npcId);
    if (!npc) return null;
    const art = NPC_ARTWORK_BY_ID[npc.id];
    if (!art || !this.textures.exists(art.portraitKey)) return null;
    this.npcSprites.get(npc.id)?.play(art.dialogueAnimation);
    return this.add.image(192, 207, art.portraitKey);
  }

  private rpgIcon(x: number, y: number, id: string): Phaser.GameObjects.Image | null {
    const frame = ITEM_ICON_FRAMES[id] ?? SKILL_ICON_FRAMES[id];
    if (frame === undefined || !this.textures.exists(ICON_TEXTURE_KEY)) return null;
    return this.add.image(x, y, ICON_TEXTURE_KEY, frame).setScale(0.5);
  }

  private interact(name: string): void {
    if (this.player.isDead || this.overlay) return;
    const npc = this.npcs.find(entry => entry.name === name);
    if (npc && ['village-chief', 'village-smith', 'village-healer'].includes(npc.id)) {
      this.modal(npc.name, npc.dialogues[0], [
        { title: npc.id === 'village-chief' ? 'Sứ mệnh của chương' : npc.id === 'village-smith' ? 'Rèn đúc & trang bị' : 'Hồi phục & thần lực', select: () => {
          this.closeModal();
          if (npc.id === 'village-chief') this.leader();
          else if (npc.id === 'village-smith') this.smith();
          else this.shaman();
        } },
        { title: 'Nhận nhiệm vụ / Báo cáo', select: () => { this.closeModal(); this.npcQuests(npc.id); } },
        ...(npc.id === 'village-chief' && gameState.data.chapter > 1 ? [{ title: 'Quay lại vùng đã khám phá', select: () => {
          this.closeModal();
          this.modal(npc.name, 'Hành trình hiện tại được giữ nguyên. Chọn vùng cũ để khám phá hoặc hoàn tất nhiệm vụ còn lại.', [
            ...Array.from({ length: gameState.data.chapter - 1 }, (_, index) => ({ title: getChapterWorldConfig(index + 1).name, select: () => {
              this.closeModal(); gameState.save(); this.scene.start('Forest', { chapter: index + 1 });
            } })),
            { title: 'Ở lại làng', select: () => this.closeModal() },
          ]);
        } }] : []),
        { title: 'Rời đi', select: () => this.closeModal() },
      ]);
      return;
    }
    if (npc) this.npcQuests(npc.id);
  }

  private npcQuests(npcId: string): void {
    const npc = this.npcs.find(entry => entry.id === npcId);
    if (!npc) return;
    const tasks = getNpcQuests(gameState.data, npcId);
    const ready = tasks.filter(quest => gameState.data.rpg.quests[quest.id]?.stage === 'return').length;
    const choices: Choice[] = [
      { title: 'Nhận các nhiệm vụ đang có (' + tasks.length + ')', select: () => {
        gameState.data = startNpcQuests(gameState.data, npcId);
        gameState.save(); this.closeModal();
        toast(this, 'Đã nhận nhiệm vụ. Mở Nhật Ký để xem mục tiêu.');
      } },
      { title: 'Báo cáo & nhận thưởng (' + ready + ')', select: () => {
        const result = claimNpcQuests(gameState.data, npcId);
        gameState.data = result.save;
        gameState.earn(result.gold, result.xp);
        this.closeModal();
        toast(this, result.blocked > 0 ? 'Kho đồ đầy; nhiệm vụ chưa nhận thưởng được giữ lại.' : 'Đã báo cáo ' + result.claimed + ' nhiệm vụ.');
      } },
    ];
    if (npc.services.includes('shop') || npc.services.includes('smith')) choices.push({ title: 'Cửa hàng / Chế tác', select: () => {
      this.closeModal(); this.openRpgMenu(npc.services.includes('smith') ? 'crafting' : 'shop');
    } });
    else if (npc.services.includes('skill_trainer')) choices.push({ title: 'Học & trang bị thần lực', select: () => { this.closeModal(); this.openRpgMenu('skills'); } });
    else if (npc.services.includes('healer')) choices.push({ title: 'Hồi phục', select: () => { this.closeModal(); this.shaman(); } });
    choices.push({ title: 'Rời đi', select: () => this.closeModal() });
    this.modal(npc.name, npc.role + '\n' + npc.dialogues[0], choices);
  }

  // =============================================================
  // Hệ Thống Đối Thoại NPC (Bảo Toàn Logic Hiện Có)
  // =============================================================

  private leader(): void {
    const s = gameState.data;
    const progress = progressFromSave(s);
    const chapter = getChapter(s.chapter)!;
    const world = getChapterWorldConfig(s.chapter);
    if (s.quest === 'new') {
      this.modal('TRƯỞNG LÀNG LẠC',
        chapter.title + '\n' + chapter.objective + '\nHạ 6 quái rồi đánh bại ' + world.bossName + '.', [
          { title: 'Nhận nhiệm vụ', select: () => {
            const chapterProgress = s.quest === 'new' ? resetQuestForChapter(progress) : progress;
            gameState.data = applyProgressToSave(s, startQuest(chapterProgress)); gameState.save(); this.closeModal();
            toast(this, 'Đã nhận nhiệm vụ: ' + chapter.title);
          } },
          { title: 'Để sau', select: () => this.closeModal() },
        ], 'village-chief');
    } else if (s.quest === 'active') {
      this.modal('TRƯỞNG LÀNG LẠC',
        `Con đã hạ ${Math.min(s.kills, BALANCE.requiredKills)}/${BALANCE.requiredKills} quái.\n` +
          world.bossName + ' sẽ xuất hiện sau khi yêu khí được thanh tẩy.', [
            { title: 'Con đã hiểu', select: () => this.closeModal() },
          ], 'village-chief');
    } else if (s.quest === 'return') {
      this.modal('TRƯỞNG LÀNG LẠC',
        'Con đã đánh bại ' + world.bossName + '!\n' + (s.chapter < 4 ? 'Hãy nhận thưởng rồi tiếp tục bảo vệ Văn Lang.' : 'Văn Lang đã thoát khỏi Hắc Ấn. Hãy nhận thưởng và chứng kiến đoạn kết.'), [
          { title: 'Báo cáo & nhận thưởng', select: () => {
            const claimed = claimQuest(progress);
            if (!claimed) { this.closeModal(); return; }
            let nextSave = applyProgressToSave(s, claimed.progress);
            for (const item of claimed.reward.items) {
              const added = addItem(nextSave.rpg.inventory, item.itemId, item.quantity);
              if (added.remainder > 0) { toast(this, 'Kho đồ đầy, không thể nhận hết phần thưởng.'); return; }
              nextSave = { ...nextSave, rpg: { ...nextSave.rpg, inventory: added.state } };
            }
            gameState.data = nextSave;
            gameState.earn(claimed.reward.gold, claimed.reward.xp);
            this.closeModal();
            if (chapterQuestsReady(gameState.data)) this.scene.start('Victory');
            else toast(this, 'Hãy nộp nhiệm vụ đã nhận và thu bảo vật dungeon đã mở trước khi đi tiếp.');
          } },
          { title: 'Để con chuẩn bị', select: () => this.closeModal() },
        ], 'village-chief');
    } else if (chapterQuestsReady(s)) {
      this.modal('TRƯỞNG LÀNG LẠC', 'Các nhiệm vụ chính đã hoàn tất. Hành trình của Thiên Mệnh đang chờ con.', [
        { title: 'Tiếp tục hành trình', select: () => { this.closeModal(); this.scene.start('Victory'); } },
        { title: 'Để con chuẩn bị', select: () => this.closeModal() },
      ], 'village-chief');
    } else {
      this.modal('TRƯỞNG LÀNG LẠC',
        'Hãy nộp nhiệm vụ đã nhận và thu bảo vật dungeon đã mở để không mất phần thưởng khi đổi chương.', [
          { title: 'Đã hiểu', select: () => this.closeModal() },
        ], 'village-chief');
    }
  }

  private smith(): void {
    const s = gameState.data;
    const price = BALANCE.smithCost * (s.upgrades + 1);
    this.modal('THỢ RÈN ĐÚC',
      `Đồ đồng cần được tôi luyện!\nSức tấn công hiện tại: ${s.attack}. Tiền đồng: ${s.gold}.\nNâng giáo +${BALANCE.smithAttackGain} công, giá ${price} đồng.`, [
        { title: `Nâng cấp giáo (${price} đồng)`, select: () => {
          if (s.gold < price) { this.closeModal(); toast(this, 'Chưa đủ tiền đồng, hãy săn quái.'); return; }
          s.gold -= price;
          s.attack += BALANCE.smithAttackGain;
          s.upgrades += 1;
          gameState.save();
          this.closeModal();
          toast(this, `Giáo đồng được nâng cấp! Công: ${s.attack}`);
        } },
        { title: 'Mua Giáo Văn Lang (60 đồng)', select: () => {
          const purchased = addItem(s.rpg.inventory, 'bronze-spear', 1);
          if (s.gold < 60 || purchased.remainder > 0) { this.closeModal(); toast(this, 'Không đủ tiền hoặc kho đồ đầy.'); return; }
          const equipped = equipItem(purchased.state, s.rpg.equipment, 'bronze-spear');
          if (!equipped) { this.closeModal(); toast(this, 'Không thể trang bị giáo.'); return; }
          const nextSave = { ...s, gold: s.gold - 60, rpg: { ...s.rpg, inventory: equipped.inventory, equipment: equipped.equipment } };
          const caps = getPlayerStats(nextSave);
          gameState.data = { ...nextSave, hp: Math.min(nextSave.hp, caps.maxHp), mp: Math.min(nextSave.mp, caps.maxMp) };
          gameState.save();
          this.closeModal();
          toast(this, 'Đã trang bị Giáo Văn Lang.');
        } },
        { title: 'Trò chuyện', select: () => {
          this.closeModal();
          this.modal('THỢ RÈN ĐÚC',
            'Hoa văn trên cây giáo này giống họa tiết trên trống đồng. Hãy dùng nó để giữ yên bản làng.', [
              { title: 'Cảm ơn bác', select: () => this.closeModal() },
            ], 'village-smith');
        } },
        { title: 'Rời đi', select: () => this.closeModal() },
      ], 'village-smith');
  }

  private shaman(): void {
    const s = gameState.data;
    this.modal('BÀ MO',
      `Thiên Mệnh Ấn sáng khi con đối mặt nguy hiểm.\nMáu: ${Math.ceil(s.hp)}/${getPlayerStats(s).maxHp} · Thần lực: ${Math.ceil(s.mp)}/${getPlayerStats(s).maxMp}.`, [
        { title: 'Hồi phục hoàn toàn (8 đồng)', select: () => {
          if (s.gold < 8) { this.closeModal(); toast(this, 'Cần 8 đồng để chuẩn bị thảo dược.'); return; }
          s.gold -= 8;
          s.hp = getPlayerStats(s).maxHp;
          s.mp = getPlayerStats(s).maxMp;
          gameState.save(); this.closeModal();
          toast(this, 'Linh dược đã hồi phục máu và thần lực.');
        } },
        { title: 'Hỏi về thần lực', select: () => {
          this.closeModal();
          this.modal('BÀ MO', 'Q: Địa Chấn gây sát thương quanh người.\nE: Hỏa Trảm tấn công theo hướng nhìn.\nCần giữ thần lực cho lúc quái vây đông.', [
            { title: 'Đã hiểu', select: () => this.closeModal() },
          ], 'village-healer');
        } },
        { title: 'Rời đi', select: () => this.closeModal() },
      ], 'village-healer');
  }

  private modal(title: string, dialogue: string, choices: Choice[], npcId = this.npcs.find(entry => entry.name === title)?.id): void {
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x081917, 0.75)
      .setInteractive();
    const frame = this.add.rectangle(480, 273, 750, 412, 0x1b3a32)
      .setStrokeStyle(3, PALETTE.bronze);
    const heading = label(this, 480, 139, title, 26, '#ffdda2', 'center');
    const portrait = npcId ? this.npcPortrait(npcId) : null;
    const body = label(this, portrait ? 540 : 480, 205, dialogue, 18, '#f5ead2', 'center')
      .setWordWrapWidth(portrait ? 500 : 685);
    const items: Phaser.GameObjects.GameObject[] = [backdrop, frame, heading, body];
    if (portrait) items.push(portrait);
    choices.forEach((choice, index) => {
      const item = button(this, 480, 297 + index * 52, 455, choice.title, choice.select,
        index === 0 ? 0x8c653d : 0x385a4c);
      items.push(item);
    });
    this.overlay = this.add.container(0, 0, items).setDepth(UI_DEPTH + 100);
  }

  private closeModal(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
  }

  // =============================================================
  // Hệ Thống Menu RPG Toàn Diện (In-game RPG Menu)
  // =============================================================

  public openRpgMenu(initialTab: RpgMenuTab = 'inventory'): void {
    if (this.player.isDead || this.pause.isOpen()) return;
    if (this.overlay && !this.isRpgMenuOpen) return;
    if (this.overlay) {
      this.hideSkillNodeTooltip();
      this.overlay.destroy(true);
      this.overlay = null;
    }

    this.isRpgMenuOpen = true;
    this.currentTab = initialTab;
    this.menuModel = new RpgMenuModel(gameState.data, () => {
      gameState.save();
      this.hud.refresh();
    });

    const items: Phaser.GameObjects.GameObject[] = [];

    // Nền tối mờ toàn màn hình ngăn chặn thao tác bên dưới
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x081917, 0.88).setInteractive();
    items.push(backdrop);

    // Khung viền đồng hoa văn Văn Lang
    const frame = this.add.rectangle(480, 270, 880, 480, 0x122722)
      .setStrokeStyle(3, PALETTE.bronze);
    const innerBorder = this.add.rectangle(480, 270, 868, 468, 0x000000, 0)
      .setStrokeStyle(1, 0x8a7042, 0.5);
    items.push(frame, innerBorder);

    const titleText = label(this, 55, 48, 'THẦN MỆNH — HÀNH TRANG', 18, '#ffdda2');
    items.push(titleText);

    const s = gameState.data;
    this.headerStatsText = label(
      this,
      590,
      48,
      `Lv.${s.level} · HP ${Math.ceil(s.hp)}/${getPlayerStats(s).maxHp} · MP ${Math.ceil(s.mp)}/${getPlayerStats(s).maxMp} · ${s.gold}đ`,
      12,
      '#d7e8d5',
      'center',
    );
    items.push(this.headerStatsText);

    // Nút đóng góc trên bên phải
    const closeTopBtn = button(this, 875, 48, 70, '✕ ĐÓNG', () => this.closeRpgMenu(), 0x8c4335);
    items.push(closeTopBtn);

    // Hàng nút chọn Thẻ (Tabs)
    this.tabButtons = [];
    const startX = 115;
    const tabSpacing = 146;
    RPG_MENU_TABS.forEach((tab, index) => {
      const tabX = startX + index * tabSpacing;
      const isSelected = tab.id === this.currentTab;
      const tabBtn = button(
        this,
        tabX,
        86,
        138,
        tab.label,
        () => this.switchTab(tab.id),
        isSelected ? 0x946b38 : 0x25473a,
      );
      this.tabButtons.push(tabBtn);
      items.push(tabBtn);
    });

    // Đường kẻ phân cách
    const divider = this.add.rectangle(480, 112, 850, 2, 0x3d5d4e);
    items.push(divider);

    // Vùng chứa nội dung của thẻ đang chọn
    this.tabContentContainer = this.add.container(0, 0, []);
    items.push(this.tabContentContainer);

    // Thanh chân trang (Footer)
    const hintText = label(
      this,
      55,
      486,
      'Phím tắt: [B] / [I] / [ESC] để đóng mở menu và trở về bản làng',
      12,
      '#9cb399',
    );
    const returnBtn = button(
      this,
      800,
      486,
      200,
      'TRỞ LẠI BẢN LÀNG',
      () => this.closeRpgMenu(),
      0x385a4c,
    );
    items.push(hintText, returnBtn);

    this.overlay = this.add.container(0, 0, items).setDepth(UI_DEPTH + 100);
    this.renderTabContent();
  }

  public closeRpgMenu(): void {
    if (!this.isRpgMenuOpen) return;
    this.hideSkillNodeTooltip();
    this.overlay?.destroy(true);
    this.overlay = null;
    this.tabContentContainer = null;
    this.headerStatsText = null;
    this.tabButtons = [];
    this.menuModel = null;
    this.isRpgMenuOpen = false;
    this.hud.refresh();
  }

  private switchTab(tabId: RpgMenuTab): void {
    this.hideSkillNodeTooltip();
    this.currentTab = tabId;
    // Cập nhật màu sắc cho các nút tab
    RPG_MENU_TABS.forEach((tab, index) => {
      const btn = this.tabButtons[index];
      if (btn && btn.list[0]) {
        const box = btn.list[0] as Phaser.GameObjects.Rectangle;
        box.setFillStyle(tab.id === this.currentTab ? 0x946b38 : 0x25473a);
      }
    });
    this.renderTabContent();
  }

  private refreshRpgMenu(): void {
    this.hideSkillNodeTooltip();
    const s = gameState.data;
    if (this.headerStatsText) {
      this.headerStatsText.setText(
        `Lv.${s.level} · HP ${Math.ceil(s.hp)}/${getPlayerStats(s).maxHp} · MP ${Math.ceil(s.mp)}/${getPlayerStats(s).maxMp} · ${s.gold}đ`,
      );
    }
    this.hud.refresh();
    this.renderTabContent();
  }

  private renderTabContent(): void {
    if (!this.tabContentContainer || !this.menuModel) return;
    this.tabContentContainer.removeAll(true);

    const items: Phaser.GameObjects.GameObject[] = [];

    switch (this.currentTab) {
      case 'inventory':
        this.renderInventoryTab(items);
        break;
      case 'equipment':
        this.renderEquipmentTab(items);
        break;
      case 'skills':
        this.renderSkillsTab(items);
        break;
      case 'quests':
        this.renderQuestsTab(items);
        break;
      case 'shop':
        this.renderShopTab(items);
        break;
      case 'crafting':
        this.renderCraftingTab(items);
        break;
    }

    this.tabContentContainer.add(items);
  }

  // -------------------------------------------------------------
  // Thẻ 1: Kho Đồ
  // -------------------------------------------------------------
  private renderInventoryTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getInventoryView();

    items.push(
      label(
        this,
        60,
        130,
        `TÚI ĐỒ NHÂN VẬT — Sức chứa: ${view.usedSlots}/${view.capacity} ô`,
        16,
        '#ffdda2',
      ),
    );

    if (view.slots.length === 0) {
      items.push(
        label(
          this,
          60,
          175,
          'Kho đồ hiện đang trống.\nHãy ghé thăm tab Cửa Hàng để mua sắm đan dược hoặc săn quái tại Rừng Trúc.',
          14,
          '#b2c6b4',
        ),
      );
    } else {
      // Hiển thị danh sách vật phẩm trong kho đồ thành 2 cột
      const inventoryPages = Math.ceil(view.slots.length / 8);
      this.inventoryPage = Math.min(this.inventoryPage, inventoryPages - 1);
      items.push(button(this, 180, 435, 100, 'TRƯỚC', () => {
        this.inventoryPage = (this.inventoryPage + inventoryPages - 1) % inventoryPages;
        this.refreshRpgMenu();
      }), label(this, 280, 435, (this.inventoryPage + 1) + '/' + inventoryPages, 12, '#f9e9bd', 'center'),
      button(this, 380, 435, 100, 'SAU', () => {
        this.inventoryPage = (this.inventoryPage + 1) % inventoryPages;
        this.refreshRpgMenu();
      }));
      view.slots.slice(this.inventoryPage * 8, this.inventoryPage * 8 + 8).forEach((slot, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const colX = col === 0 ? 190 : 470;
        const rowY = 168 + row * 54;

        const cardBg = this.add.rectangle(colX, rowY, 260, 46, 0x18372d)
          .setStrokeStyle(1, 0x486b5b);
        items.push(cardBg);

        const itName = slot.item?.name ?? slot.itemId;
        const icon = this.rpgIcon(colX - 112, rowY + 11, slot.itemId);
        if (icon) items.push(icon);
        const nameText = label(this, colX - 120, rowY - 8, `${itName} x${slot.quantity}`, 13, '#fbe3a2').setWordWrapWidth(185);
        const descText = label(
          this,
          colX - 98,
          rowY + 11,
          slot.item?.kind === 'consumable'
            ? 'Đan dược'
            : slot.item?.kind === 'weapon'
            ? 'Vũ khí (+công)'
            : slot.item?.kind === 'armor'
            ? 'Giáp (+máu)'
            : slot.item?.kind === 'accessory'
            ? 'Ngọc bội (+MP/Tốc)'
            : 'Nguyên liệu',
          11,
          '#a3bca4',
        );
        items.push(nameText, descText);

        if (slot.item?.kind === 'consumable') {
          const useBtn = button(this, colX + 95, rowY, 52, 'DÙNG', () => {
            const res = model.useItem(slot.itemId);
            toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
            this.refreshRpgMenu();
          }, 0x3d6652);
          items.push(useBtn);
        } else if (slot.item?.slot) {
          const equipBtn = button(this, colX + 95, rowY, 52, 'MẶC', () => {
            const res = model.equip(slot.itemId);
            toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
            this.refreshRpgMenu();
          }, 0x87623d);
          items.push(equipBtn);
        }
      });
    }

    // Bảng chỉ số nhân vật bên phải
    const s = gameState.data;
    const statBox = this.add.rectangle(760, 280, 240, 310, 0x16342b)
      .setStrokeStyle(2, PALETTE.bronze);
    items.push(statBox);

    items.push(label(this, 760, 145, 'CHỈ SỐ BẢN THÂN', 15, '#ffdda2', 'center'));
    const statLines = [
      `Cấp độ: Lv.${s.level}`,
      `Sinh lực: ${Math.ceil(s.hp)}/${getPlayerStats(s).maxHp}`,
      `Thần lực: ${Math.ceil(s.mp)}/${getPlayerStats(s).maxMp}`,
      `Sức công: ${s.attack}`,
      `Tiền đồng: ${s.gold}`,
      `Cấp rèn giáo: +${s.upgrades}`,
      `Yêu thú đã diệt: ${s.kills}`,
    ];
    statLines.forEach((line, idx) => {
      items.push(label(this, 660, 185 + idx * 32, line, 13, '#e5efe2'));
    });
  }

  // -------------------------------------------------------------
  // Thẻ 2: Trang Bị
  // -------------------------------------------------------------
  private renderEquipmentTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getEquipmentView();

    items.push(label(this, 60, 130, 'TRANG BỊ ĐANG MẶC TRÊN NGƯỜI', 16, '#ffdda2'));

    const slotsData: {
      slot: 'weapon' | 'armor' | 'accessory';
      title: string;
      item?: { id: string; name: string; stats?: { attack?: number; maxHp?: number; maxMp?: number; speed?: number } };
      y: number;
    }[] = [
      { slot: 'weapon', title: 'Vũ khí', item: view.weapon, y: 175 },
      { slot: 'armor', title: 'Giáp trụ', item: view.armor, y: 245 },
      { slot: 'accessory', title: 'Phụ kiện', item: view.accessory, y: 315 },
    ];

    slotsData.forEach((sData) => {
      const box = this.add.rectangle(245, sData.y, 370, 56, 0x18372d)
        .setStrokeStyle(1, 0x486b5b);
      items.push(box);

      const title = label(this, 75, sData.y - 12, sData.title, 12, '#9ab39d');
      const name = label(
        this,
        75,
        sData.y + 10,
        sData.item ? sData.item.name : '(Trống)',
        14,
        sData.item ? '#ffdda2' : '#738a78',
      );
      items.push(title, name);
      const icon = sData.item ? this.rpgIcon(65, sData.y + 10, sData.item.id) : null;
      if (icon) items.push(icon);

      let statDesc = '';
      if (sData.item?.stats) {
        if (sData.item.stats.attack) statDesc = `+${sData.item.stats.attack} Công`;
        if (sData.item.stats.maxHp) statDesc = `+${sData.item.stats.maxHp} HP`;
        if (sData.item.stats.maxMp) statDesc = `+${sData.item.stats.maxMp} MP, +${sData.item.stats.speed ?? 0} Tốc`;
      }
      const statLabel = label(this, 260, sData.y + 10, statDesc, 11, '#a4cca5').setWordWrapWidth(85);
      items.push(statLabel);

      if (sData.item) {
        const unequipBtn = button(this, 385, sData.y, 65, 'THÁO', () => {
          const res = model.unequip(sData.slot);
          toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
          this.refreshRpgMenu();
        }, 0x5a3e35);
        items.push(unequipBtn);
      }
    });

    // Thống kê tổng hợp từ trang bị
    const statsBox = this.add.rectangle(245, 395, 370, 52, 0x132e25)
      .setStrokeStyle(1, PALETTE.bronze);
    items.push(statsBox);
    const sumStat = `Tổng hiệu quả: +${view.stats.attack ?? 0} Công · +${view.stats.maxHp ?? 0} HP · +${view.stats.maxMp ?? 0} MP · +${view.stats.speed ?? 0} Tốc`;
    items.push(label(this, 245, 395, sumStat, 12, '#e6f3df', 'center'));

    this.renderEquipmentPreview(items, view);

    // Cột bên phải: Trang bị có sẵn trong kho đồ
    items.push(label(this, 480, 130, 'TRANG BỊ TRONG TÚI ĐỒ (CÓ THỂ MẶC)', 16, '#ffdda2'));

    if (view.equippableInventoryItems.length === 0) {
      items.push(
        label(
          this,
          480,
          180,
          'Không có trang bị nào trong kho đồ.\nHãy ghé qua Cửa Hàng hoặc rèn đúc tại Lò Rèn.',
          13,
          '#b2c6b4',
        ),
      );
    } else {
      const equipmentPages = Math.ceil(view.equippableInventoryItems.length / 4);
      this.equipmentPage = Math.min(this.equipmentPage, equipmentPages - 1);
      items.push(button(this, 570, 435, 100, 'TRƯỚC', () => {
        this.equipmentPage = (this.equipmentPage + equipmentPages - 1) % equipmentPages;
        this.refreshRpgMenu();
      }), label(this, 675, 435, (this.equipmentPage + 1) + '/' + equipmentPages, 12, '#f9e9bd', 'center'),
      button(this, 780, 435, 100, 'SAU', () => {
        this.equipmentPage = (this.equipmentPage + 1) % equipmentPages;
        this.refreshRpgMenu();
      }));
      view.equippableInventoryItems.slice(this.equipmentPage * 4, this.equipmentPage * 4 + 4).forEach((eqItem, idx) => {
        const y = 175 + idx * 60;
        const card = this.add.rectangle(675, y, 390, 50, 0x18372d)
          .setStrokeStyle(1, 0x486b5b);
        items.push(card);

        const nText = label(this, 500, y - 9, eqItem.item.name, 14, '#fbe3a2');
        const icon = this.rpgIcon(485, y + 10, eqItem.itemId);
        if (icon) items.push(icon);
        let bonus = '';
        if (eqItem.item.stats?.attack) bonus = `+${eqItem.item.stats.attack} Công`;
        if (eqItem.item.stats?.maxHp) bonus = `+${eqItem.item.stats.maxHp} HP`;
        if (eqItem.item.stats?.maxMp) bonus = `+${eqItem.item.stats.maxMp} MP`;
        const bText = label(this, 500, y + 10, bonus, 11, '#97b89a');
        items.push(nText, bText);

        const eqBtn = button(this, 825, y, 70, 'MẶC', () => {
          const res = model.equip(eqItem.itemId);
          toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
          this.refreshRpgMenu();
        }, 0x87623d);
        items.push(eqBtn);
      });
    }
  }

  // -------------------------------------------------------------
  // Thẻ 3: Kỹ Năng & Thần Lực
  // -------------------------------------------------------------
  private renderSkillsTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getSkillsView();

    items.push(label(this, 60, 130, 'THẦN LỰC HỘ MỆNH (CHỌN 1 TRONG 3 HỆ THẦN LỰC)', 15, '#ffdda2'));

    // 3 thẻ thần lực
    view.divinePowers.forEach((power, idx) => {
      const cardX = 195 + idx * 285;
      const cardY = 185;
      const isActive = view.activeDivinePower?.id === power.id;

      const card = this.add.rectangle(cardX, cardY, 270, 78, isActive ? 0x27493b : 0x18362d)
        .setStrokeStyle(2, isActive ? PALETTE.bronze : 0x3d5f50);
      items.push(card);

      const title = label(this, cardX - 125, cardY - 24, power.vietnameseName, 13, isActive ? '#ffdda2' : '#e0eee1');
      const perk = label(this, cardX - 125, cardY - 7, this.powerPerkSummary(power), 10, '#9fbe9f');
      perk.setWordWrapWidth(240);
      items.push(title, perk);

      this.renderBranchOverview(items, power, cardX, cardY);

      if (isActive) {
        items.push(label(this, cardX + 75, cardY + 22, '✓ ĐANG CHỌN', 12, '#8fe19a', 'center'));
      } else {
        const chooseBtn = button(this, cardX + 75, cardY + 22, 90, 'CHỌN HỆ', () => {
          const res = model.selectDivinePower(power.id);
          toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
          this.refreshRpgMenu();
        }, 0x3d6652);
        items.push(chooseBtn);
      }
    });

    // Phần dưới: Kỹ năng chiến đấu
    items.push(label(this, 60, 245, 'DANH SÁCH BÍ TRUYỀN KỸ NĂNG', 15, '#ffdda2'));

    const pages = Math.ceil(view.skills.length / 3);
    this.skillPage = Math.max(0, Math.min(this.skillPage, pages - 1));
    const previous = button(this, 715, 245, 65, 'TRƯỚC', () => {
      this.skillPage = (this.skillPage + pages - 1) % pages;
      this.refreshRpgMenu();
    }, 0x385a4c);
    const next = button(this, 855, 245, 65, 'SAU', () => {
      this.skillPage = (this.skillPage + 1) % pages;
      this.refreshRpgMenu();
    }, 0x385a4c);
    items.push(previous, next, label(this, 785, 245, (this.skillPage + 1) + '/' + pages, 12, '#f9e9bd', 'center'));
    view.skills.slice(this.skillPage * 3, this.skillPage * 3 + 3).forEach((skEntry, index) => {
      const rowY = 295 + index * 56;
      items.push(this.add.rectangle(480, rowY, 840, 48, 0x18372d).setStrokeStyle(1, 0x486b5b));
      const icon = this.rpgIcon(66, rowY + 10, skEntry.skill.id);
      if (icon) items.push(icon);
      items.push(label(this, 80, rowY - 9, skEntry.skill.vietnameseName, 14, '#fbe3a2'));
      items.push(label(this, 80, rowY + 10, 'MP: ' + skEntry.skill.cost.mp + ' · Hồi: ' + skEntry.skill.cooldownMs / 1000 + 's · Cấp ' + skEntry.skill.requiredLevel, 11, '#a7c1a8'));
      if (skEntry.isUnlocked) {
        (['slot-1', 'slot-2', 'slot-3', 'slot-4'] as const).forEach((slot, slotIndex) => {
          const equipped = view.equippedSlots[slot]?.id === skEntry.skill.id;
          const equip = button(this, 620 + slotIndex * 70, rowY, 60, ['Q', 'E', 'R', 'T'][slotIndex], () => {
            const result = equipped ? model.unequipSkillAction(slot) : model.equipSkillAction(slot, skEntry.skill.id);
            toast(this, result.message, result.success ? '#f9e9bd' : '#ff8585');
            this.refreshRpgMenu();
          }, equipped ? 0x87623d : 0x385a4c);
          items.push(equip);
        });
      } else if (skEntry.canUnlock) {
        items.push(button(this, 780, rowY, 150, 'MỞ (' + skEntry.skill.unlockCostGold + 'đ)', () => {
          const result = model.unlockSkillAction(skEntry.skill.id);
          toast(this, result.message, result.success ? '#f9e9bd' : '#ff8585');
          this.refreshRpgMenu();
        }, 0x87623d));
      } else {
        items.push(label(this, 780, rowY, skEntry.unlockReason ?? 'Chưa đủ điều kiện', 12, '#e08f87', 'center'));
      }
    });
  }

  // -------------------------------------------------------------
  // Thẻ 4: Nhật Ký Nhiệm Vụ
  // -------------------------------------------------------------
  private renderQuestsTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getQuestsView();

    items.push(
      label(
        this,
        60,
        130,
        'NHẬT KÝ — CHƯƠNG ' + view.currentChapter + ': ' + getChapter(view.currentChapter)!.title,
        16,
        '#ffdda2',
      ),
    );

    const questPages = Math.max(1, Math.ceil(view.quests.length / 3));
    this.questPage = Math.min(this.questPage, questPages - 1);
    items.push(button(this, 360, 435, 100, 'TRƯỚC', () => {
      this.questPage = (this.questPage + questPages - 1) % questPages;
      this.refreshRpgMenu();
    }), label(this, 480, 435, (this.questPage + 1) + '/' + questPages, 12, '#f9e9bd', 'center'),
    button(this, 600, 435, 100, 'SAU', () => {
      this.questPage = (this.questPage + 1) % questPages;
      this.refreshRpgMenu();
    }));
    view.quests.slice(this.questPage * 3, this.questPage * 3 + 3).forEach((q, idx) => {
      const y = 175 + idx * 76;
      const box = this.add.rectangle(480, y, 840, 68, 0x18372d)
        .setStrokeStyle(1, q.stage === 'return' ? 0xe2b45e : 0x486b5b);
      items.push(box);

      const title = label(this, 80, y - 18, `${q.title} [${q.stageLabel}]`, 15, '#ffdda2');
      const desc = label(this, 80, y + 2, q.description, 12, '#cbd8cc');
      items.push(title, desc);

      const objTexts = q.objectives.map((o) => `${o.text}: ${o.current}/${o.required}`).join('  ·  ');
      const objs = label(this, 80, y + 20, `Mục tiêu: ${objTexts}`, 11, '#97b899');
      items.push(objs);

      const rewardDesc = `Thưởng: ${q.rewardGold} đồng · ${q.rewardXp} XP`;
      const rew = label(this, 720, y, rewardDesc, 13, '#f5d376', 'center');
      items.push(rew);
    });
  }

  // -------------------------------------------------------------
  // Thẻ 5: Cửa Hàng
  // -------------------------------------------------------------
  private renderShopTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getShopView();

    items.push(
      label(
        this,
        60,
        130,
        `TIỆM TẠP HÓA BẢN LÀNG — Tiền hiện có: ${view.playerGold} đồng`,
        16,
        '#ffdda2',
      ),
    );

    // Cột bên trái: Mua vật phẩm
    items.push(label(this, 60, 160, 'HÀNG HÓA BÀY BÁN', 14, '#e1f0e2'));
    const shopPages = Math.max(1, Math.ceil(view.items.length / 5));
    this.shopPage = Math.min(this.shopPage, shopPages - 1);
    items.push(button(this, 140, 445, 100, 'TRƯỚC', () => {
      this.shopPage = (this.shopPage + shopPages - 1) % shopPages;
      this.refreshRpgMenu();
    }), label(this, 260, 445, (this.shopPage + 1) + '/' + shopPages, 12, '#f9e9bd', 'center'),
    button(this, 380, 445, 100, 'SAU', () => {
      this.shopPage = (this.shopPage + 1) % shopPages;
      this.refreshRpgMenu();
    }));
    view.items.slice(this.shopPage * 5, this.shopPage * 5 + 5).forEach((shItem, idx) => {
      const rowY = 195 + idx * 50;
      const card = this.add.rectangle(260, rowY, 400, 44, 0x18372d)
        .setStrokeStyle(1, 0x486b5b);
      items.push(card);

      const name = label(this, 80, rowY - 7, shItem.item.name, 13, '#fbe3a2');
      const icon = this.rpgIcon(66, rowY + 11, shItem.item.id);
      if (icon) items.push(icon);
      const priceText = label(this, 80, rowY + 11, `Giá: ${shItem.price} đồng`, 11, '#9fbe9f');
      items.push(name, priceText);

      const canBuy = shItem.canAfford && shItem.hasInventorySpace;
      const buyBtn = button(this, 400, rowY, 68, 'MUA', () => {
        const res = model.buyItem(shItem.item.id, 1);
        toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
        this.refreshRpgMenu();
      }, canBuy ? 0x3d6652 : 0x5a4e48);
      items.push(buyBtn);
    });

    // Cột bên phải: Bán đồ cũ lấy tiền
    items.push(label(this, 500, 160, 'BÁN VẬT PHẨM TRONG TÚI (50% GIÁ)', 14, '#e1f0e2'));
    if (view.sellableItems.length === 0) {
      items.push(label(this, 500, 200, 'Túi đồ hiện không có vật phẩm nào để bán.', 13, '#9cb39d'));
    } else {
      const sellPages = Math.max(1, Math.ceil(view.sellableItems.length / 5));
      this.sellPage = Math.min(this.sellPage, sellPages - 1);
      items.push(button(this, 580, 445, 100, 'TRƯỚC', () => {
        this.sellPage = (this.sellPage + sellPages - 1) % sellPages;
        this.refreshRpgMenu();
      }), label(this, 700, 445, (this.sellPage + 1) + '/' + sellPages, 12, '#f9e9bd', 'center'),
      button(this, 820, 445, 100, 'SAU', () => {
        this.sellPage = (this.sellPage + 1) % sellPages;
        this.refreshRpgMenu();
      }));
      view.sellableItems.slice(this.sellPage * 5, this.sellPage * 5 + 5).forEach((sellIt, idx) => {
        const rowY = 195 + idx * 50;
        const card = this.add.rectangle(700, rowY, 400, 44, 0x18372d)
          .setStrokeStyle(1, 0x486b5b);
        items.push(card);

        const name = label(this, 520, rowY - 7, `${sellIt.item.name} x${sellIt.quantity}`, 13, '#fbe3a2');
        const icon = this.rpgIcon(506, rowY + 11, sellIt.itemId);
        if (icon) items.push(icon);
        const priceText = label(this, 520, rowY + 11, `Thu mua: +${sellIt.sellPrice} đồng/cái`, 11, '#9fbe9f');
        items.push(name, priceText);

        const sellBtn = button(this, 840, rowY, 68, 'BÁN', () => {
          const res = model.sellItem(sellIt.itemId, 1);
          toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
          this.refreshRpgMenu();
        }, 0x87623d);
        items.push(sellBtn);
      });
    }
  }

  // -------------------------------------------------------------
  // Thẻ 6: Chế Tác & Nâng Cấp
  // -------------------------------------------------------------
  private renderCraftingTab(items: Phaser.GameObjects.GameObject[]): void {
    const model = this.menuModel!;
    const view = model.getCraftingView();

    // Phần trên: Lò rèn vũ khí
    items.push(label(this, 60, 130, 'LÒ RÈN VŨ KHÍ BẢN LÀNG — TÔI LUYỆN GIÁO ĐỒNG', 16, '#ffdda2'));

    const smithBox = this.add.rectangle(480, 178, 840, 60, 0x1e3f34)
      .setStrokeStyle(2, PALETTE.bronze);
    items.push(smithBox);

    const upgradeDesc = `Cấp rèn hiện tại: +${view.weaponUpgrades}  ·  Sức công: ${view.currentAttack}  ·  Chi phí nâng cấp: ${view.upgradeCost} đồng (+${BALANCE.smithAttackGain} công)`;
    items.push(label(this, 80, 178, upgradeDesc, 13, '#f8edd4'));

    const upgradeBtn = button(this, 800, 178, 140, 'RÈN NÂNG CẤP', () => {
      const res = model.upgradeWeapon();
      toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
      this.refreshRpgMenu();
    }, view.canUpgradeWeapon ? 0x946b38 : 0x5a4e48);
    items.push(upgradeBtn);

    // Phần dưới: Công thức chế tạo
    items.push(label(this, 60, 230, 'CÔNG THỨC CHẾ TẠO TRANG BỊ & ĐAN DƯỢC', 16, '#ffdda2'));

    const craftingPages = Math.max(1, Math.ceil(view.recipes.length / 3));
    this.craftingPage = Math.min(this.craftingPage, craftingPages - 1);
    items.push(button(this, 360, 435, 100, 'TRƯỚC', () => {
      this.craftingPage = (this.craftingPage + craftingPages - 1) % craftingPages;
      this.refreshRpgMenu();
    }), label(this, 480, 435, (this.craftingPage + 1) + '/' + craftingPages, 12, '#f9e9bd', 'center'),
    button(this, 600, 435, 100, 'SAU', () => {
      this.craftingPage = (this.craftingPage + 1) % craftingPages;
      this.refreshRpgMenu();
    }));
    view.recipes.slice(this.craftingPage * 3, this.craftingPage * 3 + 3).forEach((rView, idx) => {
      const rowY = 275 + idx * 52;
      const card = this.add.rectangle(480, rowY, 840, 46, 0x18372d)
        .setStrokeStyle(1, 0x486b5b);
      items.push(card);

      const name = label(this, 80, rowY - 8, rView.recipe.name, 14, '#ffdda2');
      const icon = this.rpgIcon(66, rowY + 11, rView.recipe.outputItemId);
      if (icon) items.push(icon);
      const matReqs = rView.materialStatus
        .map((m) => `${m.name}: ${m.available}/${m.required}`)
        .join(', ');
      const desc = label(
        this,
        80,
        rowY + 11,
        `Yêu cầu: ${matReqs} · ${rView.recipe.goldCost} đồng. ${rView.recipe.description}`,
        11,
        '#a7c1a8',
      );
      items.push(name, desc);

      const craftBtn = button(this, 810, rowY, 110, 'CHẾ TẠO', () => {
        const res = model.craft(rView.recipe.id);
        toast(this, res.message, res.success ? '#f9e9bd' : '#ff8585');
        this.refreshRpgMenu();
      }, rView.canCraft ? 0x3d6652 : 0x5a4e48);
      items.push(craftBtn);
    });
  }

  private renderEquipmentPreview(
    items: Phaser.GameObjects.GameObject[],
    view: ReturnType<RpgMenuModel['getEquipmentView']>,
  ): void {
    const previewBox = this.add.rectangle(245, 452, 370, 46, 0x142b23)
      .setStrokeStyle(1, 0x3d5f50);
    items.push(previewBox);

    const weapon = getEquippedWeaponOrDefault(view.weapon?.id, gameState.data.level);
    const reqType = weapon.weaponType;
    const requested = reqType === 'axe' ? 'hero_axe' : reqType === 'sword' ? 'hero_sword' : 'hero';
    const textureKey = this.textures?.exists(SPRITE_KEYS[requested])
      ? SPRITE_KEYS[requested]
      : (this.textures?.exists(SPRITE_KEYS.hero) ? SPRITE_KEYS.hero : null);

    if (textureKey) {
      const sprite = this.add.sprite(88, 452, textureKey).setScale(0.85);
      const animKey = (this.textures?.exists(SPRITE_KEYS[requested]) ? requested : 'hero') + '_idle_down';
      const isReduced = graphicsSettings.getState().reducedMotion ||
        (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!isReduced && this.anims?.exists(animKey)) {
        sprite.play(animKey);
      }
      items.push(sprite);
    } else {
      items.push(this.add.rectangle(88, 452, 28, 28, 0x1e3e32).setStrokeStyle(1, PALETTE.bronze));
    }

    const typeName = reqType === 'axe' ? 'Rìu' : reqType === 'sword' ? 'Kiếm' : 'Giáo';
    items.push(label(this, 112, 442, `Hình chiếu: ${weapon.vietnameseName} (${typeName})`, 12, '#ffe09c'));
    items.push(label(this, 112, 460, 'Giáp/bội: chỉ số nội tại, chưa có lớp hình', 11, '#9fbe9f'));
  }

  private powerPerkSummary(power: (typeof DIVINE_POWERS)[number]): string {
    const bonus = power.passiveBonus;
    return [bonus.attackPercent && 'Công +' + bonus.attackPercent + '%',
      bonus.defensePercent && 'Đỡ đòn +' + bonus.defensePercent + '%',
      bonus.maxHpBonus && 'HP +' + bonus.maxHpBonus, bonus.maxMpBonus && 'MP +' + bonus.maxMpBonus,
      bonus.cooldownReductionPercent && 'Hồi chiêu -' + bonus.cooldownReductionPercent + '%',
      bonus.moveSpeedPercent && 'Tốc +' + bonus.moveSpeedPercent + '%'].filter(Boolean).join(' · ');
  }

  private renderBranchOverview(
    items: Phaser.GameObjects.GameObject[],
    power: (typeof DIVINE_POWERS)[number],
    cardX: number,
    cardY: number,
  ): void {
    const branchSkills = getSkillsByDivinePower(power.id as DivinePowerId);
    if (!branchSkills || branchSkills.length === 0) return;

    const xs = [cardX - 104, cardX - 54, cardX - 4];
    const ny = cardY + 10;

    const g = this.add.graphics();
    g.lineStyle(2, 0x416553, 0.8);
    g.lineBetween(xs[0] + 11, ny, xs[1] - 11, ny);
    g.lineBetween(xs[1] + 11, ny, xs[2] - 11, ny);
    items.push(g);

    branchSkills.forEach((skill, sIdx) => {
      this.renderSkillNode(items, skill, xs[sIdx], ny, power.id as DivinePowerId);
    });
  }

  private renderSkillNode(
    items: Phaser.GameObjects.GameObject[],
    skill: SkillDefinition,
    nx: number,
    ny: number,
    powerId: DivinePowerId,
  ): void {
    const model = this.menuModel!;
    const view = model.getSkillsView();
    const skEntry = view.skills.find(e => e.skill.id === skill.id);
    const isEquipped = skEntry?.isEquipped ?? false;
    const isUnlocked = skEntry?.isUnlocked ?? false;

    const strokeColor = isEquipped ? PALETTE.gold : (isUnlocked ? 0x8fe19a : 0x556e62);
    const fillColor = isEquipped ? 0x87623d : (isUnlocked ? 0x224a3a : 0x142b22);
    const nodeBg = this.add.circle(nx, ny, 11, fillColor)
      .setStrokeStyle(isEquipped ? 2 : 1, strokeColor)
      .setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-14, -14, 50, 50),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    items.push(nodeBg);

    const icon = this.rpgIcon(nx, ny, skill.id);
    if (icon) {
      icon.setScale(0.38);
      items.push(icon);
    }

    const stateLabel = isEquipped ? 'E' : (isUnlocked ? '✓' : '🔒');
    const badge = label(this, nx + 7, ny + 7, stateLabel, 9, isEquipped ? '#ffe09c' : (isUnlocked ? '#8fe19a' : '#c99'));
    badge.setDepth(UI_DEPTH + 110);
    items.push(badge);

    nodeBg.on('pointerover', () => {
      nodeBg.setFillStyle(isEquipped ? 0xab824f : 0x2d5f4b);
      this.showSkillNodeTooltip(skill, skEntry, powerId, nx, ny);
    });
    nodeBg.on('pointerout', () => {
      nodeBg.setFillStyle(fillColor);
      this.hideSkillNodeTooltip();
    });
    nodeBg.on('pointerdown', () => {
      const statusText = isEquipped ? 'Đã trang bị' : (isUnlocked ? 'Đã mở khóa' : (skEntry?.unlockReason ?? 'Chưa đủ điều kiện'));
      toast(this, `${skill.vietnameseName}: ${statusText}`);
    });
  }

  private showSkillNodeTooltip(
    skill: SkillDefinition,
    skEntry: ReturnType<RpgMenuModel['getSkillsView']>['skills'][number] | undefined,
    powerId: DivinePowerId,
    nx: number,
    ny: number,
  ): void {
    this.hideSkillNodeTooltip();
    const branchName = powerId === 'earth' ? 'Sơn Tinh' : powerId === 'flame' ? 'Nhật Thần' : 'Lạc Long';
    const status = skEntry?.isEquipped ? 'ĐÃ GẮN' : (skEntry?.isUnlocked ? 'ĐÃ MỞ' : `KHÓA (${skill.unlockCostGold}đ)`);
    const header = `${skill.vietnameseName} [${branchName} · ${status}]`;
    const details = `Cấp ${skill.requiredLevel} · MP: ${skill.cost.mp} · Hồi: ${skill.cooldownMs / 1000}s`;

    const bg = this.add.rectangle(0, 0, 260, 76, 0x0f241d, 0.95).setStrokeStyle(1, PALETTE.bronze);
    const line1 = label(this, -120, -18, header, 11, '#ffdda2').setWordWrapWidth(240);
    const line2 = label(this, -120, 22, details, 10, '#c7dcc5');

    const tipX = Phaser.Math.Clamp(nx, 170, 790);
    const tipY = ny - 60;
    this.skillTooltipBox = this.add.container(tipX, tipY, [bg, line1, line2]).setDepth(UI_DEPTH + 150);
  }

  private hideSkillNodeTooltip(): void {
    if (this.skillTooltipBox) {
      this.skillTooltipBox.destroy(true);
      this.skillTooltipBox = null;
    }
  }

  private onDeath(animationMs: number): void {
    gameState.data.hp = getPlayerStats(gameState.data).maxHp;
    gameState.data.mp = getPlayerStats(gameState.data).maxMp;
    gameState.save();
    this.time.delayedCall(animationMs, () => this.scene.restart({ notice: 'Được đưa trở về làng để dưỡng thương.' }));
  }
}
