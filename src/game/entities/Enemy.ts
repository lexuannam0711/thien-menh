import Phaser from 'phaser';
import { ENEMIES, EnemyKind } from '../../data/config';
import { actor, floatText, label } from '../ui/art';
import { Player } from './Player';
import { SPRITE_KEYS } from '../assets/assetLoader';
import { ENEMY_ARTWORK_BY_ID } from '../assets/enemyArtwork';
import { canPlayLocomotion, facingDirection, type SpriteDirection } from '../assets/spriteManifest';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { Projectile } from './Projectile';
import type { SkillStatusEffect } from '../../data/skills';

export class Enemy {
  readonly view: Phaser.GameObjects.Container;
  private hp: number;
  private readonly maxHp: number;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly warning: Phaser.GameObjects.Arc;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private spritePrefix: string | null = null;
  private visualState = 'idle';
  private facing: SpriteDirection = 'down';
  private readyAt = 0;
  private windupEndAt = 0;
  private windup = false;
  private alive = true;
  private enraged = false;
  private attackCount = 0;
  private attackRadius = 0;
  private rangedWindupEndAt = 0;
  private rangedWindup = false;
  private stunRemainingMs = 0;
  private slowRemainingMs = 0;
  private burnRemainingMs = 0;
  private burnTickMs = 0;
  private burnDamage = 0;
  private activeTime = 0;
  private chargeRemainingMs = 0;
  private chargeX = 0;
  private chargeY = 0;
  private chargeHit = false;
  private chargeDistance = 0;
  private ambushX = 0;
  private ambushY = 0;

  constructor(private scene: Phaser.Scene, public readonly kind: EnemyKind,
    x: number, y: number, private onDeath: (enemy: Enemy) => void,
    private readonly spawnProjectile?: (projectile: Projectile) => void) {
    if (!Object.hasOwn(ENEMIES, kind)) throw new Error('Unknown enemy kind: ' + kind);
    const stats = ENEMIES[kind];
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.attackRadius = stats.range + 22;

    const candidate = ENEMY_ARTWORK_BY_ID[kind];
    const artwork = candidate && scene.textures.exists(candidate.spriteKey) ? candidate : null;
    const spriteKey = artwork?.spriteKey ?? (kind === 'ho-yeu' ? SPRITE_KEYS.hoyer :
      stats.role === 'melee' ? SPRITE_KEYS.moctinh :
      stats.role === 'ranged' ? SPRITE_KEYS.matroi :
      stats.role === 'charge' ? SPRITE_KEYS.wolf : SPRITE_KEYS.spider);

    if (spriteKey && scene.textures.exists(spriteKey)) {
      const shadow = scene.add.ellipse(0, stats.radius * 0.85, stats.radius * 2.2, 12, 0x112b26, 0.65);
      this.sprite = scene.add.sprite(0, kind === 'ho-yeu' ? -8 : 0, spriteKey, 0);
      if (artwork) {
        this.spritePrefix = artwork.animationPrefix;
        const scale = stats.scale * 48 / artwork.size;
        this.sprite.setScale(scale);
        this.sprite.setY(stats.radius * 0.85 - (artwork.feet - artwork.size / 2) * scale);
      } else if (kind !== 'ho-yeu') this.sprite.setScale(stats.scale);
      this.playPose('idle');
      const name = label(scene, 0, -stats.radius - 23, stats.name, 13, '#fff5d2', 'center');
      this.view = scene.add.container(x, y, [shadow, this.sprite, name]);
      this.view.setDepth(30 + y / 10);
    } else {
      this.view = actor(scene, x, y, stats.color, stats.name,
        stats.radius, kind === 'ho-yeu');
      const silhouette = stats.role === 'charge'
        ? scene.add.triangle(0, 0, -stats.radius, stats.radius, stats.radius, stats.radius, 0, -stats.radius, stats.color)
        : stats.role === 'ambush'
          ? scene.add.ellipse(0, 0, stats.radius * 2.6, stats.radius * 0.8, stats.color)
          : stats.role === 'ranged'
            ? scene.add.circle(0, 0, stats.radius * 0.7, stats.color)
            : scene.add.rectangle(0, 0, stats.radius * 1.6, stats.radius * 1.6, stats.color);
      this.view.add(silhouette.setStrokeStyle(stats.elite ? 4 : 2, stats.elite ? 0xffdf87 : 0x23382c));
    }
    if (stats.elite) this.view.add(scene.add.circle(0, 0, stats.radius + 5, stats.color, 0)
      .setStrokeStyle(3, 0xffdf87, 0.85));

    const bg = scene.add.rectangle(0, stats.radius + 17, stats.radius * 2.3, 7, 0x2b2f2c);
    this.hpFill = scene.add.rectangle(-stats.radius * 1.15, stats.radius + 17,
      stats.radius * 2.3, 5, kind === 'ho-yeu' ? 0xffc06c : 0xf57670).setOrigin(0, 0.5);
    this.warning = scene.add.circle(0, 0, stats.range + 8, 0xc0392b, 0.18)
      .setStrokeStyle(2.5, 0xff7961, 0.95).setVisible(false);
    this.view.addAt(this.warning, 0);
    this.view.add([bg, this.hpFill]);
  }

  get x(): number { return this.view.x; }
  get y(): number { return this.view.y; }
  get isAlive(): boolean { return this.alive; }
  get isBoss(): boolean { return this.kind === 'ho-yeu'; }
  get radius(): number { return ENEMIES[this.kind].radius; }
  get healthFraction(): number { return this.hp / this.maxHp; }

  private playPose(state: string): void {
    if (!this.sprite || (this.visualState === 'death' && state !== 'death')) return;
    this.visualState = state;
    const role = ENEMIES[this.kind].role;
    const prefix = this.spritePrefix ?? (this.isBoss ? 'hoyer' : role === 'ranged' ? 'matroi' : role === 'charge' ? 'wolf' : role === 'ambush' ? 'spider' : 'moctinh');
    this.sprite.setFlipX(false).play(prefix + '_' + state + '_' + this.facing, true);
  }

  update(_time: number, delta: number, player: Player): void {
    if (!this.alive || !Number.isFinite(delta) || delta <= 0) return;
    this.activeTime += delta;
    const time = this.activeTime;
    this.stunRemainingMs = Math.max(0, this.stunRemainingMs - delta);
    this.slowRemainingMs = Math.max(0, this.slowRemainingMs - delta);
    if (this.burnRemainingMs > 0) {
      this.burnTickMs += Math.min(delta, this.burnRemainingMs);
      this.burnRemainingMs = Math.max(0, this.burnRemainingMs - delta);
      while (this.burnTickMs >= 1000 && this.alive) {
        this.burnTickMs -= 1000;
        this.damage(this.burnDamage);
      }
    }
    if (!this.alive || this.stunRemainingMs > 0) return;
    const stats = ENEMIES[this.kind];
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && !this.windup && !this.rangedWindup && this.chargeRemainingMs <= 0) this.facing = facingDirection(dx, dy);
    if (this.isBoss && !this.enraged && this.hp <= this.maxHp * 0.5) {
      this.enraged = true;
      floatText(this.scene, this.x, this.y - 75, 'CUỒNG NỘ!', '#ffad76');
      if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(110, 0.003);
    }
    if (this.chargeRemainingMs > 0) {
      const stepMs = Math.min(delta, this.chargeRemainingMs);
      const speed = (stats.elite ? 680 : 520) * (this.slowRemainingMs > 0 ? 0.5 : 1);
      const startX = this.x;
      const startY = this.y;
      this.view.x = Phaser.Math.Clamp(this.x + this.chargeX * speed * stepMs / 1000, 33, 930);
      this.view.y = Phaser.Math.Clamp(this.y + this.chargeY * speed * stepMs / 1000, 99, 505);
      this.view.setDepth(30 + this.y / 10);
      const travelX = this.x - startX;
      const travelY = this.y - startY;
      const lengthSquared = travelX * travelX + travelY * travelY;
      const projection = lengthSquared === 0 ? 0 : Phaser.Math.Clamp(
        ((player.x - startX) * travelX + (player.y - startY) * travelY) / lengthSquared, 0, 1);
      if (!this.chargeHit && Math.hypot(player.x - startX - travelX * projection,
        player.y - startY - travelY * projection) < stats.radius + 20) {
        player.hit(Math.round(stats.attack * (stats.elite ? 1.25 : 1)));
        this.chargeHit = true;
      }
      this.chargeRemainingMs = Math.max(0, this.chargeRemainingMs - stepMs);
      if (this.chargeRemainingMs === 0) this.readyAt = time + 1500;
      return;
    }
    if (this.rangedWindup) {
      if (time >= this.rangedWindupEndAt) {
        this.rangedWindup = false;
        if (this.visualState !== 'hit' || !this.sprite?.anims.isPlaying) this.playPose('attack');
        this.warning.setVisible(false);
        const shots = stats.elite ? [-28, 0, 28] : [0];
        for (const offset of shots) {
          if (this.spawnProjectile) this.spawnProjectile(new Projectile(this.scene, this.x + offset, this.y, player, stats.attack));
        }
        this.readyAt = time + (stats.elite ? 1800 : 1200);
      }
      return;
    }
    if (this.windup) {
      if (time >= this.windupEndAt) {
        this.windup = false;
        if (this.visualState !== 'hit' || !this.sprite?.anims.isPlaying) this.playPose('attack');
        this.warning.setVisible(false).setPosition(0, 0).setRotation(0);
        if (stats.role === 'charge') {
          this.chargeRemainingMs = this.chargeDistance / (stats.elite ? 680 : 520) * 1000;
          this.chargeHit = false;
          this.view.setAlpha(1);
        } else {
          if (stats.role === 'ambush') {
            this.view.setPosition(this.ambushX, this.ambushY).setAlpha(1).setDepth(30 + this.ambushY / 10);
          }
          if (Math.hypot(player.x - this.x, player.y - this.y) < this.attackRadius) {
            player.hit(stats.attack + (this.enraged ? 4 : 0) + (stats.elite ? Math.round(stats.attack * 0.25) : 0));
          }
          this.readyAt = time + (this.isBoss ? (this.enraged ? 640 : 950) : stats.role === 'ambush' ? 2200 : 1050);
        }
      }
      return;
    }
    if (time >= this.readyAt) {
      if (stats.role === 'ranged' && dist >= 150 && dist <= 360) {
        this.rangedWindup = true;
        this.rangedWindupEndAt = time + (stats.elite ? 800 : 420);
        this.warning.setPosition(0, 0).setRotation(0).setScale(stats.elite ? 1.8 : 1.15).setVisible(true);
        if (this.visualState !== 'hit' || !this.sprite?.anims.isPlaying) this.playPose('attack');
        return;
      }
      const canCharge = stats.role === 'charge' && dist > 0 && dist <= 300;
      const canAmbush = stats.role === 'ambush' && dist <= 240;
      if (canCharge || canAmbush || (stats.role !== 'ranged' && dist < stats.range + (this.enraged ? 64 : 10))) {
        this.windup = true;
        this.attackCount++;
        const slam = this.isBoss && this.enraged && this.attackCount % 2 === 0;
        this.attackRadius = slam ? 112 : stats.range + 22 + (stats.elite ? 20 : 0);
        this.warning.setPosition(0, 0).setRotation(0).setScale(slam ? 1.55 : this.attackRadius / (stats.range + 8)).setVisible(true);
        this.windupEndAt = time + (stats.elite ? 900 : canCharge ? 650 : canAmbush ? 700 : this.isBoss ? (slam ? 730 : 650) : 480);
        if (canCharge) {
          this.chargeX = dx / dist;
          this.chargeY = dy / dist;
          this.chargeDistance = Math.min(dist, 300);
          this.warning.setPosition(dx / 2, dy / 2).setRotation(Math.atan2(dy, dx))
            .setScale(dist / (2 * (stats.range + 8)), (stats.radius + 20) / (stats.range + 8));
        }
        if (canAmbush) {
          this.ambushX = Phaser.Math.Clamp(player.x, 33, 930);
          this.ambushY = Phaser.Math.Clamp(player.y, 99, 505);
          this.warning.setPosition(this.ambushX - this.x, this.ambushY - this.y);
          this.view.setAlpha(0.75);
        }
        if (this.visualState !== 'hit' || !this.sprite?.anims.isPlaying) this.playPose('attack');
        return;
      }
    }
    if (stats.role === 'ambush') this.view.setAlpha(time < this.readyAt || dist > 240 ? 0.4 : 1);
    const movingToward = stats.role === 'ranged' ? (dist > 280 ? 1 : dist < 150 ? -1 : 0) : 1;
    if (dist > 0 && (movingToward < 0 || dist > stats.range * 0.72) && dist < 460 && movingToward !== 0) {
      const speedScale = (dist < 60 ? 0.4 : 1) * movingToward * (this.slowRemainingMs > 0 ? 0.5 : 1);
      const travel = Math.min(stats.speed * (this.enraged ? 1.3 : 1) * Math.abs(speedScale) * delta / 1000, dist);
      this.view.x = Phaser.Math.Clamp(this.x + dx / dist * travel * movingToward, 33, 930);
      this.view.y = Phaser.Math.Clamp(this.y + dy / dist * travel * movingToward, 99, 505);
      this.view.setDepth(30 + this.view.y / 10);
      if (this.sprite) {
        if (canPlayLocomotion(this.visualState, this.sprite.anims.isPlaying)) {
          this.facing = facingDirection(dx * movingToward, dy * movingToward);
          this.playPose('walk');
        }
      }
    } else if (this.sprite && canPlayLocomotion(this.visualState, this.sprite.anims.isPlaying)) {
      this.playPose('idle');
    }
  }

  applyStatus(status: SkillStatusEffect | undefined, duration: number, damage: number): void {
    if (!this.alive || duration <= 0) return;
    if (status === 'stun') {
      this.stunRemainingMs = Math.max(this.stunRemainingMs, duration);
      this.windup = false;
      this.rangedWindup = false;
      this.chargeRemainingMs = 0;
      this.view.setAlpha(1);
      this.warning.setVisible(false);
    }
    if (status === 'slow') this.slowRemainingMs = Math.max(this.slowRemainingMs, duration);
    if (status === 'burn') {
      if (this.burnRemainingMs <= 0) this.burnTickMs = 0;
      this.burnRemainingMs = Math.max(this.burnRemainingMs, duration);
      this.burnDamage = Math.max(1, Math.round(damage / 5));
    }
  }

  damage(amount: number, knockX = 0, knockY = 0): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.playPose(this.hp <= 0 ? 'death' : 'hit');
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
