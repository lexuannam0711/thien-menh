import Phaser from 'phaser';
import { BALANCE, H, W } from '../../data/config';
import { actor, floatText, label } from '../ui/art';
import { gameState } from '../systems/GameState';
import { TouchControls } from '../ui/TouchControls';
import { SPRITE_KEYS } from '../assets/assetLoader';

interface PlayerActions {
  basic: (step: number, direction: Phaser.Math.Vector2) => void;
  earth: () => void;
  flame: (direction: Phaser.Math.Vector2) => void;
  interact: () => void;
  dead: () => void;
}

export class Player {
  readonly view: Phaser.GameObjects.Container;
  readonly direction = new Phaser.Math.Vector2(1, 0);
  readonly controls: TouchControls;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private attackAt = 0;
  private lastAttack = -3000;
  private combo = 0;
  private dodgeReadyAt = 0;
  private dodgeEndAt = 0;
  private invulnerableUntil = 0;
  private earthReadyAt = 0;
  private flameReadyAt = 0;
  private locked: () => boolean;

  constructor(private scene: Phaser.Scene, x: number, y: number,
    private actions: PlayerActions, locked: () => boolean) {
    this.locked = locked;

    if (scene.textures.exists(SPRITE_KEYS.hero)) {
      const shadow = scene.add.ellipse(0, 16, 36, 12, 0x112b26, 0.65);
      this.sprite = scene.add.sprite(0, -6, SPRITE_KEYS.hero, 0);
      const name = label(scene, 0, -38, 'THIÊN MỆNH', 13, '#fff5d2', 'center');
      this.view = scene.add.container(x, y, [shadow, this.sprite, name]);
      this.view.setDepth(30 + y / 10);
    } else {
      this.view = actor(scene, x, y, 0x4d8db1, 'THIÊN MỆNH', 22, true);
    }

    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys({
        up: 'W', down: 'S', left: 'A', right: 'D',
        up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
        attack: 'J', dodge: 'SPACE', earth: 'Q', flame: 'E', interact: 'F',
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    this.controls = new TouchControls(scene, (action) => {
      if (action === 'attack') this.attack();
      if (action === 'dodge') this.dodge();
      if (action === 'earth') this.earth();
      if (action === 'flame') this.flame();
      if (action === 'interact') this.actions.interact();
    }, () => !locked());
  }

  get x(): number { return this.view.x; }
  get y(): number { return this.view.y; }
  get isDodging(): boolean { return this.scene.time.now < this.dodgeEndAt; }
  get canBeHit(): boolean { return this.scene.time.now >= this.invulnerableUntil; }

  update(delta: number): void {
    if (this.locked()) return;
    const time = this.scene.time.now;
    const key = this.keys;
    if (key) {
      if (Phaser.Input.Keyboard.JustDown(key.attack)) this.attack();
      if (Phaser.Input.Keyboard.JustDown(key.dodge)) this.dodge();
      if (Phaser.Input.Keyboard.JustDown(key.earth)) this.earth();
      if (Phaser.Input.Keyboard.JustDown(key.flame)) this.flame();
      if (Phaser.Input.Keyboard.JustDown(key.interact)) this.actions.interact();
    }
    let vx = (Number(Boolean(key?.right.isDown || key?.right2.isDown)) -
      Number(Boolean(key?.left.isDown || key?.left2.isDown)));
    let vy = (Number(Boolean(key?.down.isDown || key?.down2.isDown)) -
      Number(Boolean(key?.up.isDown || key?.up2.isDown)));
    vx += this.controls.direction.x;
    vy += this.controls.direction.y;
    const length = Math.hypot(vx, vy);
    if (length > 0.08 && !this.isDodging) this.direction.set(vx / length, vy / length);
    const moving = length > 0.08 || this.isDodging;
    const speed = this.isDodging ? 540 : BALANCE.speed;
    const moveDirX = this.isDodging ? this.direction.x : length ? vx / length : 0;
    const moveDirY = this.isDodging ? this.direction.y : length ? vy / length : 0;
    this.view.x = Phaser.Math.Clamp(this.view.x + moveDirX * speed * delta / 1000, 33, W - 28);
    this.view.y = Phaser.Math.Clamp(this.view.y + moveDirY * speed * delta / 1000, 99, H - 32);
    this.view.setDepth(30 + this.view.y / 10);
    if (this.sprite) {
      if (time > this.attackAt) {
        if (moving) this.sprite.play('hero_walk', true);
        else this.sprite.play('hero_idle', true);
      }
      if (length > 0.08) this.sprite.setFlipX(this.direction.x < 0);
    }
    // Mild breathing / walking bounce; no sprite sheet needed in this prototype.
    this.view.setScale(this.isDodging ? 0.89 : 1 + (moving ? Math.sin(time / 80) * 0.04 : 0));
    const s = gameState.data;
    s.mp = Math.min(s.maxMp, s.mp + delta / 1000 * 7.5);
  }

  attack(): void {
    if (this.locked()) return;
    const time = this.scene.time.now;
    if (time < this.attackAt || this.isDodging) return;
    this.combo = time - this.lastAttack <= BALANCE.comboWindowMs ? (this.combo % 3) + 1 : 1;
    this.lastAttack = time;
    this.attackAt = time + [0, 250, 295, 380][this.combo];
    if (this.sprite) {
      this.sprite.play('hero_attack', true);
    }
    this.actions.basic(this.combo, this.direction.clone());
  }

  dodge(): void {
    const time = this.scene.time.now;
    if (this.locked() || time < this.dodgeReadyAt) return;
    this.dodgeReadyAt = time + BALANCE.dodgeCooldownMs;
    this.dodgeEndAt = time + BALANCE.dodgeDurationMs;
    this.invulnerableUntil = this.dodgeEndAt + 60;
    floatText(this.scene, this.x, this.y - 34, 'LƯỚT', '#d0f0ea');
  }

  earth(): void {
    const now = this.scene.time.now;
    const s = gameState.data;
    if (this.locked() || now < this.earthReadyAt || s.mp < BALANCE.earthCost) return;
    s.mp -= BALANCE.earthCost;
    this.earthReadyAt = now + BALANCE.earthCooldownMs;
    this.actions.earth();
  }

  flame(): void {
    const now = this.scene.time.now;
    const s = gameState.data;
    if (this.locked() || now < this.flameReadyAt || s.mp < BALANCE.flameCost) return;
    s.mp -= BALANCE.flameCost;
    this.flameReadyAt = now + BALANCE.flameCooldownMs;
    this.actions.flame(this.direction.clone());
  }

  hit(damage: number): void {
    if (!this.canBeHit) return;
    const s = gameState.data;
    s.hp = Math.max(0, s.hp - damage);
    this.invulnerableUntil = this.scene.time.now + 550;
    floatText(this.scene, this.x, this.y - 45, `-${damage}`, '#ff827c');
    this.scene.cameras.main.shake(85, 0.0025);
    this.scene.tweens.add({ targets: this.view, alpha: 0.33, yoyo: true, repeat: 2, duration: 85,
      onComplete: () => this.view.setAlpha(1) });
    if (s.hp <= 0) this.actions.dead();
  }
}
