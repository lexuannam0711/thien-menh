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
    if (hit) this.scene.cameras.main.shake(combo === 3 ? 80 : 50, combo === 3 ? 0.003 : 0.0015);
  }

  earth(player: Player): void {
    const radius = 153;
    this.dongSonShockwave(player.x, player.y, radius);
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
    this.scene.cameras.main.shake(120, 0.005);
  }

  flame(player: Player, dir: Phaser.Math.Vector2): void {
    const endX = player.x + dir.x * 280;
    const endY = player.y + dir.y * 280;
    
    // Multi-layer cinnabar flame beam
    const trail = this.scene.add.graphics().setDepth(800);
    // Outer flame aura (đỏ chu sa)
    trail.lineStyle(40, 0xc0392b, 0.45);
    trail.lineBetween(player.x, player.y, endX, endY);
    // Mid fiery flame (cam lửa)
    trail.lineStyle(22, 0xe67e22, 0.85);
    trail.lineBetween(player.x, player.y, endX, endY);
    // Inner solar core (vàng rực)
    trail.lineStyle(8, 0xfff3a1, 0.98);
    trail.lineBetween(player.x, player.y, endX, endY);

    // Flying ember particles along the beam
    for (let p = 1; p <= 6; p++) {
      const px = player.x + dir.x * (45 * p) + (Math.random() - 0.5) * 20;
      const py = player.y + dir.y * (45 * p) + (Math.random() - 0.5) * 20;
      const ember = this.scene.add.circle(px, py, 3.5, 0xffe066, 0.9).setDepth(801);
      this.scene.tweens.add({
        targets: ember, alpha: 0, scale: 0.2, duration: 240,
        onComplete: () => ember.destroy()
      });
    }

    this.scene.tweens.add({ targets: trail, alpha: 0, duration: 280,
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
    const spread = combo === 3 ? 1.45 : 1.12;
    const start = centerAngle - spread;
    const end = centerAngle + spread;
    const radius = combo === 3 ? 105 : 85;

    // Outer aura
    g.lineStyle(combo === 3 ? 24 : 16, combo === 3 ? 0xe67e22 : 0xb8883b, 0.55);
    g.beginPath();
    g.arc(x, y, radius, start, end, false);
    g.strokePath();

    // Sharp inner cutting edge
    g.lineStyle(combo === 3 ? 9 : 6, combo === 3 ? 0xfff2a3 : 0xffeed0, 0.95);
    g.beginPath();
    g.arc(x, y, radius + 2, start, end, false);
    g.strokePath();

    // Spark particles at swing tip
    const tipAngle = end;
    const tipX = x + Math.cos(tipAngle) * radius;
    const tipY = y + Math.sin(tipAngle) * radius;
    const spark = this.scene.add.circle(tipX, tipY, combo === 3 ? 6 : 4, PALETTE.gold, 0.9)
      .setDepth(901);
    this.scene.tweens.add({ targets: spark, scale: 0, duration: 160, onComplete: () => spark.destroy() });

    this.scene.tweens.add({ targets: g, alpha: 0, scale: 1.18,
      duration: 185, onComplete: () => g.destroy() });
  }

  private dongSonShockwave(x: number, y: number, maxRadius: number): void {
    const shockContainer = this.scene.add.container(x, y).setDepth(850);
    const g = this.scene.add.graphics();
    shockContainer.add(g);

    // Draw central Đông Sơn solar star burst (Ngôi sao 12 cánh rực sáng)
    const rays = 12;
    g.fillStyle(0xffe27a, 0.9);
    for (let i = 0; i < rays; i++) {
      const a1 = (i / rays) * Math.PI * 2;
      const aMid = ((i + 0.5) / rays) * Math.PI * 2;
      const a2 = ((i + 1) / rays) * Math.PI * 2;
      g.fillTriangle(
        Math.cos(a1) * 8, Math.sin(a1) * 8,
        Math.cos(aMid) * 28, Math.sin(aMid) * 28,
        Math.cos(a2) * 8, Math.sin(a2) * 8
      );
    }

    // Outer concentric ring
    const ring = this.scene.add.circle(x, y, 16, 0xd4af37, 0.25)
      .setStrokeStyle(8, 0xf6d365, 0.9).setDepth(851);

    this.scene.tweens.add({
      targets: ring, scale: maxRadius / 16, alpha: 0, duration: 420,
      onComplete: () => ring.destroy()
    });

    this.scene.tweens.add({
      targets: shockContainer, scale: 1.8, alpha: 0, duration: 400,
      onComplete: () => shockContainer.destroy()
    });
  }
}
