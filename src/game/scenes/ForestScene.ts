import Phaser from 'phaser';
import { BALANCE, ENEMIES, EnemyKind, UI_DEPTH } from '../../data/config';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { CombatSystem } from '../systems/CombatSystem';
import { gameState } from '../systems/GameState';
import { label, paintForest, floatText } from '../ui/art';
import { Hud, toast } from '../ui/Hud';

export class ForestScene extends Phaser.Scene {
  private player!: Player;
  private hud!: Hud;
  private combat!: CombatSystem;
  private enemies: Enemy[] = [];
  private bossSpawned = false;
  private bossText: Phaser.GameObjects.Text | null = null;

  constructor() { super('Forest'); }

  create(): void {
    paintForest(this);
    this.enemies = [];
    this.bossSpawned = false;
    this.player = new Player(this, 138, 270, {
      basic: (step, direction) => this.combat.basic(this.player, step, direction),
      earth: () => this.combat.earth(this.player),
      flame: (direction) => this.combat.flame(this.player, direction),
      interact: () => toast(this, 'Hãy quay về làng để gặp NPC.'),
      dead: () => this.onDeath(),
    }, () => false);
    this.combat = new CombatSystem(this, () => this.enemies);
    this.hud = new Hud(this, 'Rừng Trúc · Đánh thường J / Né Space / Q / E');
    if (gameState.data.quest === 'active') {
      this.spawn('moc-tinh', 490, 238);
      this.spawn('ma-troi', 650, 338);
      this.spawn('moc-tinh', 790, 190);
    }
    this.time.addEvent({ delay: 3600, loop: true, callback: () => {
      if (gameState.data.quest === 'active' && this.enemies.filter(e => e.isAlive && !e.isBoss).length < 7) {
        const kind: EnemyKind = Math.random() < 0.54 ? 'moc-tinh' : 'ma-troi';
        this.spawnRandom(kind);
      }
    } });
    this.events.once('shutdown', () => gameState.save());
    toast(this, 'Dọn sạch yêu khí rồi hạ Hổ Yêu U Minh!');
  }

  update(time: number, delta: number): void {
    this.player.update(delta);
    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    this.enemies = this.enemies.filter(e => e.isAlive);
    this.hud.refresh();
    if (this.player.x <= 56 && this.player.y >= 195 && this.player.y <= 345) {
      gameState.save();
      this.scene.start('Village', { notice: 'Đã trở về làng Lạc Thủy.' });
      return;
    }
    if (gameState.data.quest === 'active' && gameState.data.kills >= BALANCE.requiredKills &&
        !gameState.data.bossDead && !this.bossSpawned) {
      this.bossSpawned = true;
      this.spawn('ho-yeu', 752, 278);
      toast(this, 'NGUY HIỂM! Hổ Yêu U Minh đã xuất hiện.', '#ffd37b');
      this.bossText = label(this, 479, 93, 'HỔ YÊU U MINH · BOSS', 21, '#ffb874', 'center')
        .setDepth(UI_DEPTH + 5);
    }
    if (this.bossText && gameState.data.bossDead) {
      this.bossText.destroy();
      this.bossText = null;
    }
  }

  private spawnRandom(kind: EnemyKind): void {
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(265, 899);
      const y = Phaser.Math.Between(128, 480);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 180) {
        this.spawn(kind, x, y);
        return;
      }
    }
  }

  private spawn(kind: EnemyKind, x: number, y: number): void {
    const enemy = new Enemy(this, kind, x, y, (dead) => this.onEnemyKilled(dead));
    this.enemies.push(enemy);
  }

  private onEnemyKilled(enemy: Enemy): void {
    const stats = ENEMIES[enemy.kind];
    const leveled = gameState.earn(stats.reward, stats.xp);
    floatText(this, enemy.x, enemy.y - 72, `+${stats.reward} đồng  +${stats.xp} XP`, '#ffe7ad');
    if (leveled) toast(this, `LÊN CẤP ${gameState.data.level}! Máu và thần lực được hồi đầy.`);
    if (enemy.isBoss) {
      gameState.data.bossDead = true;
      gameState.data.quest = 'return';
      this.cameras.main.shake(230, 0.007);
      toast(this, 'Hổ Yêu đã bị tiêu diệt! Trở về báo trưởng làng.', '#fff1b4');
    } else if (gameState.data.quest === 'active') {
      gameState.data.kills++;
      if (gameState.data.kills === BALANCE.requiredKills) {
        toast(this, 'Yêu khí tụ lại... Có thứ gì đang thức tỉnh!', '#ffd587');
      }
    }
    gameState.save();
  }

  private onDeath(): void {
    const s = gameState.data;
    const penalty = Math.min(10, s.gold);
    s.gold -= penalty;
    s.hp = s.maxHp;
    s.mp = s.maxMp;
    gameState.save();
    this.scene.start('Village', { notice: `Bạn gục ngã, mất ${penalty} đồng và được đưa về làng.` });
  }
}
