/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Remote Player Renderer (M5 Social Hub & Multiplayer Presence)
 *
 * Quản lý và dựng hình các người chơi từ xa (remote players) trong instance thế giới:
 * - Dựng visual Container gồm Sprite nhân vật (SPRITE_KEYS.hero), bóng chân (shadow), và nhãn tên (nameplate #ffea9f).
 * - Cập nhật vị trí mượt mà thông qua Authoritative Snapshot Interpolation (multiplayer.interpolatePlayer).
 * - Đồng bộ hướng nhìn (facing flipX) và animation theo trạng thái authoritative (idle, walk, attack, dodge, hit, dead).
 * - Tự động thêm người chơi mới vào phòng và dọn dẹp game object khi người chơi rời phòng.
 * - Tuân thủ nguyên tắc fail-closed: hoạt động an toàn, im lặng khi không có kết nối mạng.
 * - Dọn dẹp triệt để (destroy) giải phóng bộ nhớ khi chuyển scene hoặc ngắt kết nối.
 */

import Phaser from 'phaser';
import { multiplayer, type MultiplayerAdapter } from './multiplayer';
import { type ServerPlayerState } from './protocol';
import { SPRITE_KEYS } from '../assets/assetLoader';

export interface RemotePlayerVisual {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.GameObject;
  readonly nameplate: Phaser.GameObjects.Text;
  readonly shadow?: Phaser.GameObjects.Ellipse | Phaser.GameObjects.GameObject;
  lastX: number;
  lastY: number;
  facing: 'left' | 'right';
  state: string;
}

export class RemotePlayerRenderer {
  private readonly scene: Phaser.Scene;
  private readonly adapter: MultiplayerAdapter;
  private readonly remotePlayers = new Map<string, RemotePlayerVisual>();
  private isDestroyed = false;

  constructor(scene: Phaser.Scene, adapter: MultiplayerAdapter = multiplayer) {
    this.scene = scene;
    this.adapter = adapter;
  }

  // ============================================================================
  // ACCESSORS & STATUS
  // ============================================================================

  get count(): number {
    return this.remotePlayers.size;
  }

  getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }

  hasPlayer(id: string): boolean {
    return this.remotePlayers.has(id);
  }

  getPlayerContainer(id: string): Phaser.GameObjects.Container | undefined {
    return this.remotePlayers.get(id)?.container;
  }

  getPlayerVisual(id: string): Readonly<RemotePlayerVisual> | undefined {
    return this.remotePlayers.get(id);
  }

  // ============================================================================
  // TICK & UPDATE LOOP
  // ============================================================================

  /**
   * Cập nhật toàn bộ visual của remote players trong scene:
   * 1. Kiểm tra trạng thái kết nối mạng (fail-closed an toàn nếu offline).
   * 2. Nhận snapshot remote players mới nhất từ adapter.
   * 3. Despawn người chơi đã rời phòng.
   * 4. Spawn người chơi mới tham gia phòng.
   * 5. Nội suy tọa độ x, y mượt mà, cập nhật facing (flipX) và animation.
   */
  update(_delta: number): void {
    if (this.isDestroyed) return;

    // Fail-closed offline safety: nếu adapter chưa kết nối, dọn dẹp visual thừa và không ném lỗi
    if (!this.adapter || !this.adapter.isConnected) {
      if (this.remotePlayers.size > 0) {
        this.clearAll();
      }
      return;
    }

    const currentPlayers = this.adapter.getAllRemotePlayers();
    const currentIds = new Set(currentPlayers.map((p) => p.id));

    // 1. Despawn remote players đã rời phòng
    for (const [id, visual] of this.remotePlayers.entries()) {
      if (!currentIds.has(id)) {
        try {
          visual.container.destroy();
        } catch {
          // Listener isolation / safe destroy
        }
        this.remotePlayers.delete(id);
      }
    }

    // 2. Spawn người chơi mới hoặc cập nhật người chơi hiện tại
    for (const playerState of currentPlayers) {
      let visual = this.remotePlayers.get(playerState.id);
      if (!visual) {
        visual = this.createRemotePlayerVisual(playerState);
        this.remotePlayers.set(playerState.id, visual);
      }

      // Nội suy vị trí từ SnapshotAdapter (hoặc fallback về tọa độ snapshot trực tiếp)
      const interp = this.adapter.interpolatePlayer(playerState.id);
      const targetX = interp ? interp.x : playerState.x;
      const targetY = interp ? interp.y : playerState.y;
      const facing = interp ? interp.facing : (playerState.facing || 'right');
      const state = interp ? interp.state : (playerState.state || 'idle');

      // Cập nhật vị trí & độ sâu (ground depth)
      visual.container.setPosition(targetX, targetY);
      visual.container.setDepth(30 + targetY / 10);

      // Cập nhật hướng nhìn (flipX)
      const sprite = visual.sprite as any;
      if (typeof sprite.setFlipX === 'function') {
        sprite.setFlipX(facing === 'left');
      }

      // Cập nhật animation nhân vật
      this.syncAnimation(visual, state, facing);

      // Cập nhật tên nếu có thay đổi
      if (playerState.name && typeof visual.nameplate.setText === 'function') {
        visual.nameplate.setText(playerState.name);
      }

      visual.lastX = targetX;
      visual.lastY = targetY;
      visual.facing = facing;
      visual.state = state;
    }
  }

  // ============================================================================
  // VISUAL CREATION & FACTORY
  // ============================================================================

  private createRemotePlayerVisual(player: ServerPlayerState): RemotePlayerVisual {
    const x = player.x;
    const y = player.y;

    // 1. Bóng chân nhân vật (shadow ellipse)
    let shadow: Phaser.GameObjects.GameObject | undefined;
    if (typeof this.scene.add?.ellipse === 'function') {
      shadow = this.scene.add.ellipse(0, 16, 36, 12, 0x112b26, 0.65);
    }

    // 2. Sprite nhân vật (sử dụng SPRITE_KEYS.hero hoặc fallback an toàn)
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.GameObject;
    const heroKey = SPRITE_KEYS?.hero ?? 'hero_sprite';
    const texturesExist = Boolean(this.scene.textures?.exists?.(heroKey));

    if (texturesExist && typeof this.scene.add?.sprite === 'function') {
      const spr = this.scene.add.sprite(0, -6, heroKey, 0);
      if (this.scene.anims?.exists?.('hero_idle_down')) {
        spr.play('hero_idle_down');
      } else if (this.scene.anims?.exists?.('hero_idle')) {
        spr.play('hero_idle');
      }
      sprite = spr;
    } else if (typeof this.scene.add?.sprite === 'function') {
      sprite = this.scene.add.sprite(0, -6, heroKey);
      if ((sprite as any).play) {
        try {
          (sprite as any).play('hero_idle_down');
        } catch {
          // Fallback safe if anim key not present
        }
      }
    } else if (typeof this.scene.add?.rectangle === 'function') {
      sprite = this.scene.add.rectangle(0, -6, 24, 36, 0x4d8db1);
    } else {
      sprite = {
        x: 0,
        y: -6,
        setFlipX: () => {},
        play: () => {},
        destroy: () => {},
      } as any;
    }

    // 3. Nhãn tên người chơi (nameplate #ffea9f, nền mờ, căn giữa)
    let nameplate: Phaser.GameObjects.Text;
    const displayName = player.name || `Người chơi ${player.id.slice(0, 4)}`;
    if (typeof this.scene.add?.text === 'function') {
      nameplate = this.scene.add.text(0, -38, displayName, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#ffea9f',
        backgroundColor: 'rgba(20, 25, 22, 0.65)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
    } else {
      nameplate = {
        text: displayName,
        setOrigin: () => nameplate,
        setText: (t: string) => { (nameplate as any).text = t; return nameplate; },
        destroy: () => {},
      } as any;
    }

    // 4. Tổ hợp vào Container
    const children: Phaser.GameObjects.GameObject[] = [];
    if (shadow) children.push(shadow);
    if (sprite) children.push(sprite);
    if (nameplate) children.push(nameplate);

    let container: Phaser.GameObjects.Container;
    if (typeof this.scene.add?.container === 'function') {
      container = this.scene.add.container(x, y, children);
      container.setDepth(30 + y / 10);
    } else {
      container = {
        x,
        y,
        depth: 30 + y / 10,
        setPosition: (px: number, py: number) => { container.x = px; container.y = py; return container; },
        setDepth: (d: number) => { container.depth = d; return container; },
        destroy: () => {
          shadow?.destroy?.();
          (sprite as any)?.destroy?.();
          nameplate?.destroy?.();
        },
      } as any;
    }

    const visual: RemotePlayerVisual = {
      id: player.id,
      container,
      sprite,
      nameplate,
      shadow,
      lastX: x,
      lastY: y,
      facing: player.facing || 'right',
      state: player.state || 'idle',
    };

    return visual;
  }

  // ============================================================================
  // ANIMATION SYNC
  // ============================================================================

  private syncAnimation(visual: RemotePlayerVisual, state: string, facing: 'left' | 'right'): void {
    const sprite = visual.sprite as any;
    if (typeof sprite.play !== 'function' || !this.scene.anims?.exists) return;

    let animState = 'idle';
    if (state === 'walk' || state === 'run') {
      animState = 'walk';
    } else if (state === 'attack') {
      animState = 'attack1';
    } else if (state === 'dodge') {
      animState = 'dodge';
    } else if (state === 'hit') {
      animState = 'hit';
    } else if (state === 'dead') {
      animState = 'death';
    }

    // Thứ tự ưu tiên anim:
    // 1. hero_{animState}_{facing}
    // 2. hero_{animState}_down
    // 3. hero_{animState}
    // 4. hero_idle_down
    // 5. hero_idle
    const prefix = 'hero';
    const candidates = [
      `${prefix}_${animState}_${facing}`,
      `${prefix}_${animState}_down`,
      `${prefix}_${animState}`,
      `${prefix}_idle_down`,
      `${prefix}_idle`,
    ];

    let targetKey: string | null = null;
    for (const key of candidates) {
      if (this.scene.anims.exists(key)) {
        targetKey = key;
        break;
      }
    }

    if (targetKey) {
      const currentKey = sprite.anims?.currentAnim?.key;
      if (currentKey !== targetKey) {
        try {
          sprite.play(targetKey, true);
        } catch {
          // safe fallback
        }
      }
    }
  }

  // ============================================================================
  // TEARDOWN & CLEANUP
  // ============================================================================

  private clearAll(): void {
    for (const visual of this.remotePlayers.values()) {
      try {
        visual.container.destroy();
      } catch {
        // safe destroy
      }
    }
    this.remotePlayers.clear();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.clearAll();
  }
}
