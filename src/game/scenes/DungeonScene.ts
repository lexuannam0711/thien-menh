import Phaser from 'phaser';
import { ENEMIES, getEnemyKillTargets } from '../../data/config';
import { getDungeon, type ContentDungeon } from '../../data/contentCatalog';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { CombatSystem } from '../systems/CombatSystem';
import { gameState, getPlayerStats } from '../systems/GameState';
import { recordQuestKills } from '../rpg/QuestSystem';
import { dungeonEntryError, getDungeonFloor, getDungeonFloorEnemies, clearDungeonFloor, claimDungeonReward } from '../rpg/DungeonSystem';
import { Hud, toast } from '../ui/Hud';
import { label } from '../ui/art';
import { PauseOverlay } from '../ui/PauseOverlay';
import { audioManager } from '../audio/AudioManager';
import { loadGameAssets, createGameAnimations } from '../assets/assetLoader';
import { paintEnvironment } from '../rendering/Environment';

export class DungeonScene extends Phaser.Scene {
  private dungeon!: ContentDungeon;
  private player!: Player;
  private combat!: CombatSystem;
  private hud!: Hud;
  private pause!: PauseOverlay;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private floor = 0;
  private cleared = false;
  private roomTitle!: Phaser.GameObjects.Text;
  private doorLabel!: Phaser.GameObjects.Text;
  private areaChapter = 1;

  constructor() { super('Dungeon'); }

  preload(): void { loadGameAssets(this); }

  create(data?: { dungeonId?: unknown; chapter?: unknown }): void {
    const chapter = data?.chapter === undefined ? gameState.data.chapter : data.chapter;
    if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > gameState.data.chapter) {
      this.scene.start('Forest');
      return;
    }
    this.areaChapter = chapter;
    const id = typeof data?.dungeonId === 'string' ? data.dungeonId : '';
    const error = dungeonEntryError(gameState.data, id, this.areaChapter);
    const dungeon = getDungeon(id);
    if (error || !dungeon) { this.scene.start('Forest', { chapter: this.areaChapter }); return; }
    this.dungeon = dungeon;
    this.enemies = [];
    this.projectiles = [];
    createGameAnimations(this);
    this.pause = new PauseOverlay(this);
    audioManager.startMusic(this.areaChapter === 2 ? 'swamp' : 'forest');
    const color = this.areaChapter === 2 ? 0x173741 : this.areaChapter === 4 ? 0x30283e : 0x2b3329;
    this.add.rectangle(480, 290, 960, 500, color);
    this.add.rectangle(480, 300, 870, 360, color).setStrokeStyle(6, 0x73624b);
    paintEnvironment(this, this.areaChapter === 2 ? 'swamp' : this.areaChapter === 4 ? 'citadel' : 'forest', [],
      { x: 480, y: 300, radius: 150 });
    for (const x of [240, 720]) for (const y of [160, 380]) {
      this.add.circle(x, y, 24, 0x101d20).setStrokeStyle(3, 0xaa8c5d);
      this.add.circle(x, y, 8, 0xe4bc6b);
    }
    label(this, 110, 260, 'RA NGOÀI', 15, '#e7d4ad', 'center').setDepth(110);
    this.roomTitle = label(this, 480, 102, '', 15, '#ffe6b1', 'center').setDepth(110);
    this.doorLabel = label(this, 480, 163, '', 14, '#ffe6b1', 'center').setDepth(110);
    this.add.rectangle(480, 140, 90, 30, 0x887149).setDepth(100).setStrokeStyle(2, 0xdcc487)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.interact());
    this.player = new Player(this, 330, 300, {
      basic: (step, direction) => this.combat.basic(this.player, step, direction),
      skill: (skill, damage, direction) => this.combat.skill(this.player, skill, damage, direction),
      interact: () => this.interact(),
      dead: animationMs => this.onDeath(animationMs),
    }, () => this.pause.isOpen());
    this.combat = new CombatSystem(this, () => this.enemies);
    this.hud = new Hud(this, dungeon.name + ' · Tầng cuối: ' + ENEMIES[dungeon.eliteId as keyof typeof ENEMIES].name);
    this.events.once('shutdown', () => {
      this.pause.destroy();
      for (const projectile of this.projectiles) projectile.destroy();
      this.projectiles = [];
      gameState.save();
    });
    this.startFloor();
    toast(this, 'Dọn sạch từng tầng; đến cửa phía trên và nhấn F. Lối ra ở bên trái.');
  }

  update(time: number, delta: number): void {
    if (!this.player || this.player.isDead || this.pause.isOpen()) return;
    gameState.tickPlaytime(delta);
    this.player.update(delta);
    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    for (const projectile of this.projectiles) projectile.update(delta);
    if (this.player.isDead) return;
    this.enemies = this.enemies.filter(enemy => enemy.isAlive);
    this.projectiles = this.projectiles.filter(projectile => projectile.isAlive);
    if (!this.cleared && this.enemies.length === 0) {
      gameState.data = clearDungeonFloor(gameState.data, this.dungeon.id, this.floor, this.areaChapter);
      gameState.save();
      this.cleared = true;
      this.doorLabel.setText(this.floor + 1 < this.dungeon.floorCount ? 'SANG TẦNG TIẾP · F' : 'NHẬN BẢO VẬT · F');
      toast(this, 'Tầng đã sạch yêu khí. Đến cửa phía trên.');
    }
    this.hud.refresh();
    if (this.player.x < 170 && this.player.y > 210 && this.player.y < 325) this.scene.start('Forest', { chapter: this.areaChapter });
  }

  private startFloor(): void {
    this.floor = getDungeonFloor(gameState.data, this.dungeon.id);
    this.cleared = this.floor === this.dungeon.floorCount;
    this.enemies = [];
    this.roomTitle.setText(this.dungeon.name + ' · ' + (this.cleared ? 'ĐÃ THANH TẨY' : 'TẦNG ' + (this.floor + 1) + '/' + this.dungeon.floorCount));
    this.doorLabel.setText(this.cleared ? 'NHẬN BẢO VẬT · F' : 'CỬA BỊ PHONG ẤN');
    if (this.cleared) return;
    getDungeonFloorEnemies(this.dungeon.id, this.floor).forEach((kind, index) => {
      const enemy = new Enemy(this, kind, 570 + index * 90, 230 + index * 65, dead => {
        gameState.data = recordQuestKills(gameState.data, getEnemyKillTargets(dead.kind));
        const stats = ENEMIES[dead.kind];
        gameState.earn(stats.reward, stats.xp);
        gameState.save();
      }, projectile => this.projectiles.push(projectile));
      this.enemies.push(enemy);
    });
  }

  private interact(): void {
    if (this.player.isDead || this.pause.isOpen() || Math.hypot(this.player.x - 480, this.player.y - 140) > 85) return;
    if (!this.cleared) { toast(this, 'Hãy dọn sạch quái trước khi mở phong ấn.'); return; }
    if (getDungeonFloor(gameState.data, this.dungeon.id) < this.dungeon.floorCount) {
      for (const projectile of this.projectiles) projectile.destroy();
      this.projectiles = [];
      this.player.view.setPosition(330, 300);
      this.startFloor();
      return;
    }
    const result = claimDungeonReward(gameState.data, this.dungeon.id, this.areaChapter);
    if (result.blocked) { toast(this, 'Kho đầy. Bảo vật được giữ lại; dọn kho rồi quay lại.'); return; }
    gameState.data = result.save;
    gameState.save();
    this.scene.start('Forest', { chapter: this.areaChapter });
  }

  private onDeath(animationMs: number): void {
    const save = gameState.data;
    const stats = getPlayerStats(save);
    gameState.data = { ...save, gold: Math.max(0, save.gold - 10), hp: stats.maxHp, mp: stats.maxMp };
    gameState.save();
    this.time.delayedCall(animationMs, () => this.scene.start('GameOver'));
  }
}
