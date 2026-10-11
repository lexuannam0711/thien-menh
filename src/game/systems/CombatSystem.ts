import Phaser from 'phaser';
import { PALETTE } from '../../data/config';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { gameState } from './GameState';

export class CombatSystem {
  constructor(private scene: Phaser.Scene, private enemies: () => Enemy[]) {}

  basic(player: Player, combo: number, dir: Phaser.Math.Vector2): void {
    const s = gameState.data;
    const base = Math.round(s.attack * [0, 1, 1.2, 1.7][combo]);
    this.slashEffect(player.x, player.y, dir, combo);
    let hit = 0;
    for (const enemy of this.enemies()) {
      if (!enemy.isAlive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      const dot = distance ? (dx * dir.x + dy * dir.y) / distance : 1;
      if (distance <= 92 + enemy.radius && dot >= (combo === 3 ? -0.12 : 0.19)) {
        enemy.damage(base, dir.x * (combo === 3 ? 36 : 15), dir.y * (combo === 3 ? 36 : 15));
        hit++;
      }
    }
    if (hit) this.scene.cameras.main.shake(50, 0.0014);
  }

  earth(player: Player): void {
    const radius = 153;
    this.ring(player.x, player.y, radius, 0xdab96a);
    for (const enemy of this.enemies()) {
      if (!enemy.isAlive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius + enemy.radius) {
        const norm = Math.max(1, dist);
        enemy.damage(gameState.data.attack * 3, dx / norm * 54, dy / norm * 54);
      }
    }
    this.scene.cameras.main.shake(110, 0.004);
  }

  flame(player: Player, dir: Phaser.Math.Vector2): void {
    const endX = player.x + dir.x * 280;
    const endY = player.y + dir.y * 280;
    const trail = this.scene.add.graphics().setDepth(800);
    trail.lineStyle(34, 0xef8c4a, 0.60);
    trail.lineBetween(player.x, player.y, endX, endY);
    trail.lineStyle(9, 0xffdb87, 0.95);
    trail.lineBetween(player.x, player.y, endX, endY);
    this.scene.tweens.add({ targets: trail, alpha: 0, duration: 260,
      onComplete: () => trail.destroy() });
    for (const enemy of this.enemies()) {
      if (!enemy.isAlive) continue;
      const ex = enemy.x - player.x;
      const ey = enemy.y - player.y;
      const forward = ex * dir.x + ey * dir.y;
      const side = Math.abs(ex * dir.y - ey * dir.x);
      if (forward >= -15 && forward <= 290 && side <= 32 + enemy.radius) {
        enemy.damage(gameState.data.attack * 2.25 | 0, dir.x * 35, dir.y * 35);
      }
    }
  }

  private slashEffect(x: number, y: number, dir: Phaser.Math.Vector2, combo: number): void {
    const g = this.scene.add.graphics().setDepth(900);
    const centerAngle = Math.atan2(dir.y, dir.x);
    const start = centerAngle - (combo === 3 ? 1.32 : 1.06);
    const end = centerAngle + (combo === 3 ? 1.32 : 1.06);
    g.lineStyle(combo === 3 ? 19 : 13, combo === 3 ? PALETTE.gold : 0xf0ead3, 0.92);
    g.beginPath();
    g.arc(x, y, combo === 3 ? 101 : 83, start, end, false);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, scale: 1.15,
      duration: 175, onComplete: () => g.destroy() });
  }

  private ring(x: number, y: number, radius: number, color: number): void {
    const circle = this.scene.add.circle(x, y, 12, color, 0.18)
      .setStrokeStyle(9, color, 0.9).setDepth(850);
    this.scene.tweens.add({ targets: circle, scale: radius / 12, alpha: 0,
      duration: 380, onComplete: () => circle.destroy() });
  }
}
