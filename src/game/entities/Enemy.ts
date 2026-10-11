import Phaser from 'phaser';
import { ENEMIES, EnemyKind } from '../../data/config';
import { actor, floatText } from '../ui/art';
import { Player } from './Player';

export class Enemy {
  readonly view: Phaser.GameObjects.Container;
  private hp: number;
  private readonly maxHp: number;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly warning: Phaser.GameObjects.Arc;
  private readyAt = 0;
  private windupEndAt = 0;
  private windup = false;
  private alive = true;
  private enraged = false;
  private attackCount = 0;
  private attackRadius = 0;

  constructor(private scene: Phaser.Scene, public readonly kind: EnemyKind,
    x: number, y: number, private onDeath: (enemy: Enemy) => void) {
    const stats = ENEMIES[kind];
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.attackRadius = stats.range + 22;
    this.view = actor(scene, x, y, stats.color, stats.name,
      stats.radius, kind === 'ho-yeu');
    const bg = scene.add.rectangle(0, stats.radius + 17, stats.radius * 2.3, 7, 0x2b2f2c);
    this.hpFill = scene.add.rectangle(-stats.radius * 1.15, stats.radius + 17,
      stats.radius * 2.3, 5, kind === 'ho-yeu' ? 0xffc06c : 0xf57670).setOrigin(0, 0.5);
    this.warning = scene.add.circle(0, 0, stats.range + 8, 0xec715d, 0.11)
      .setStrokeStyle(2, 0xff9877, 0.9).setVisible(false);
    this.view.addAt(this.warning, 0);
    this.view.add([bg, this.hpFill]);
  }

  get x(): number { return this.view.x; }
  get y(): number { return this.view.y; }
  get isAlive(): boolean { return this.alive; }
  get isBoss(): boolean { return this.kind === 'ho-yeu'; }
  get radius(): number { return ENEMIES[this.kind].radius; }
  get healthFraction(): number { return this.hp / this.maxHp; }

  update(time: number, delta: number, player: Player): void {
    if (!this.alive) return;
    const stats = ENEMIES[this.kind];
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.isBoss && !this.enraged && this.hp <= this.maxHp * 0.5) {
      this.enraged = true;
      floatText(this.scene, this.x, this.y - 75, 'CUỒNG NỘ!', '#ffad76');
      this.scene.cameras.main.shake(110, 0.003);
    }
    if (this.windup) {
      if (time >= this.windupEndAt) {
        this.windup = false;
        this.warning.setVisible(false);
        if (dist < this.attackRadius) {
          player.hit(stats.attack + (this.enraged ? 4 : 0));
        }
        this.readyAt = time + (this.isBoss ? (this.enraged ? 640 : 950) : 1050);
      }
      return;
    }
    if (dist < stats.range + (this.enraged ? 64 : 10) && time >= this.readyAt) {
      this.windup = true;
      this.attackCount++;
      const slam = this.isBoss && this.enraged && this.attackCount % 2 === 0;
      this.attackRadius = slam ? 112 : stats.range + 22;
      this.warning.setScale(slam ? 1.55 : 1);
      this.windupEndAt = time + (this.isBoss ? (slam ? 730 : 650) : 480);
      this.warning.setVisible(true);
      return;
    }
    if (dist > stats.range * 0.72 && dist < 460) {
      const speedScale = (dist < 60 ? 0.4 : 1);
      this.view.x += dx / dist * stats.speed * (this.enraged ? 1.3 : 1) * speedScale * delta / 1000;
      this.view.y += dy / dist * stats.speed * (this.enraged ? 1.3 : 1) * speedScale * delta / 1000;
      this.view.setDepth(30 + this.view.y / 10);
    }
  }

  damage(amount: number, knockX = 0, knockY = 0): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hpFill.setScale(this.hp / this.maxHp, 1);
    floatText(this.scene, this.x, this.y - 40, String(amount), '#ffe68b');
    this.view.x = Phaser.Math.Clamp(this.view.x + knockX, 33, 930);
    this.view.y = Phaser.Math.Clamp(this.view.y + knockY, 99, 505);
    this.scene.tweens.add({ targets: this.view, alpha: 0.58, duration: 75,
      yoyo: true, onComplete: () => this.view.setAlpha(1) });
    if (this.hp <= 0) {
      this.alive = false;
      this.onDeath(this);
      this.warning.setVisible(false);
      this.scene.tweens.add({ targets: this.view, alpha: 0, scale: 0.2,
        duration: 245, onComplete: () => this.view.destroy() });
    }
  }
}
