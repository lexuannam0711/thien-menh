import Phaser from 'phaser';
import { Player } from './Player';

export class Projectile {
  private alive = true;
  private readonly view: Phaser.GameObjects.Arc;

  constructor(
    private readonly scene: Phaser.Scene,
    private x: number,
    private y: number,
    private readonly target: Player,
    private readonly damage: number,
    private readonly speed = 240,
  ) {
    this.view = scene.add.circle(x, y, 8, 0xbcecf0, 0.95)
      .setStrokeStyle(2, 0x4d9da5, 1)
      .setDepth(850);
  }

  update(delta: number): void {
    if (!this.alive) return;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 18) {
      this.target.hit(this.damage);
      this.destroy();
      return;
    }
    const travel = Math.min(distance, this.speed * delta / 1000);
    this.x += dx / distance * travel;
    this.y += dy / distance * travel;
    this.view.setPosition(this.x, this.y);
    if (this.x < -30 || this.x > 990 || this.y < 60 || this.y > 570) this.destroy();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.view.destroy();
  }

  get isAlive(): boolean { return this.alive; }
}