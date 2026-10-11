import Phaser from 'phaser';
import { H, PALETTE, W } from '../../data/config';

export function label(scene: Phaser.Scene, x: number, y: number, text: string,
  fontSize = 17, color = PALETTE.cream, align: 'left' | 'center' = 'left'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: 'Arial, sans-serif', fontSize: `${fontSize}px`, color,
    fontStyle: fontSize >= 20 ? 'bold' : 'normal',
    stroke: '#19352f', strokeThickness: 2,
    align, lineSpacing: 6,
  }).setOrigin(align === 'center' ? 0.5 : 0, 0.5);
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number,
  text: string, action: () => void, fill = 0x87623d): Phaser.GameObjects.Container {
  const box = scene.add.rectangle(0, 0, width, 44, fill)
    .setStrokeStyle(2, PALETTE.bronze).setInteractive({ useHandCursor: true });
  const textObj = label(scene, 0, 0, text, 17, '#fff3d6', 'center');
  const container = scene.add.container(x, y, [box, textObj]);
  box.on('pointerover', () => box.setFillStyle(0xab824f));
  box.on('pointerout', () => box.setFillStyle(fill));
  box.on('pointerdown', () => action());
  return container;
}

function tree(scene: Phaser.Scene, x: number, y: number, n = 1): void {
  const trunk = scene.add.rectangle(x, y + 13, 12 * n, 27 * n, 0x58422f);
  const crown = scene.add.circle(x, y - 6 * n, 22 * n, 0x2d6749)
    .setStrokeStyle(2, 0x244635);
  scene.add.circle(x - 9 * n, y - 12 * n, 10 * n, 0x407b53);
  trunk.setDepth(20 + y / 10);
  crown.setDepth(21 + y / 10);
}

function house(scene: Phaser.Scene, x: number, y: number, width: number): void {
  scene.add.ellipse(x, y + 33, width + 20, 28, 0x263d2e, 0.42);
  scene.add.rectangle(x, y + 5, width, 61, 0xd3b887).setStrokeStyle(2, 0x5f4936);
  const roof = scene.add.graphics();
  roof.fillStyle(0x86503b);
  roof.fillPoints([
    new Phaser.Math.Vector2(x - width / 2 - 13, y - 20),
    new Phaser.Math.Vector2(x, y - 67),
    new Phaser.Math.Vector2(x + width / 2 + 13, y - 20),
  ], true);
  roof.lineStyle(3, 0x4e3932);
  roof.strokePoints([
    new Phaser.Math.Vector2(x - width / 2 - 13, y - 20),
    new Phaser.Math.Vector2(x, y - 67),
    new Phaser.Math.Vector2(x + width / 2 + 13, y - 20),
  ], true);
  scene.add.rectangle(x, y + 18, 26, 36, 0x66503a);
  scene.add.rectangle(x - width / 3, y + 2, 17, 21, 0x638381);
}

export function paintVillage(scene: Phaser.Scene): void {
  scene.add.rectangle(W / 2, H / 2, W, H, 0x6a8957);
  scene.add.rectangle(480, 281, 960, 95, 0xb6a070);
  scene.add.rectangle(485, 285, 960, 10, 0xc4ae7f);
  scene.add.rectangle(250, 360, 200, 260, 0x8fa766);
  scene.add.rectangle(240, 365, 180, 236, 0x719b59);
  for (let i = 0; i < 8; i++) {
    scene.add.rectangle(157 + i * 21, 370, 3, 220, 0xdacb80, 0.42);
  }
  for (const [x, y, width] of [[190, 175, 135], [435, 178, 135], [690, 164, 146]]) {
    house(scene, x, y, width);
  }
  for (const [x, y] of [[54, 115], [60, 420], [832, 120], [781, 462], [906, 451], [550, 468]]) {
    tree(scene, x, y);
  }
  scene.add.circle(710, 430, 58, 0x588b89).setStrokeStyle(5, 0xb6bd80);
  scene.add.circle(728, 421, 17, 0x89b3a0, 0.6);
  const gate = scene.add.rectangle(935, 267, 43, 145, 0x3f6f47, 0.7)
    .setStrokeStyle(3, PALETTE.gold);
  gate.setDepth(1);
  label(scene, 844, 202, '→ RỪNG TRÚC', 18, '#fff0bb');
  label(scene, 40, 40, 'LÀNG LẠC THỦY', 24, '#fff1c8');
  label(scene, 40, 72, 'Nơi bình yên trước trận chiến', 14, '#edf2ce');
}

export function paintForest(scene: Phaser.Scene): void {
  scene.add.rectangle(W / 2, H / 2, W, H, 0x234836);
  for (let i = 0; i < 20; i++) {
    const x = 25 + (i * 149) % 940;
    const y = 80 + (i * 113) % 430;
    scene.add.ellipse(x, y, 80, 45, 0x31573d, 0.6);
  }
  for (let i = 0; i < 14; i++) {
    const x = 35 + (i * 173) % 920;
    const y = 110 + (i * 139) % 380;
    if (x < 210 && Math.abs(y - 270) < 95) continue;
    tree(scene, x, y, 0.65);
  }
  for (let i = 0; i < 17; i++) {
    const x = 32 + (i * 97) % 900;
    const y = 92 + (i * 61) % 420;
    scene.add.rectangle(x, y, 4, 29, 0x7ba570, 0.75);
    scene.add.rectangle(x + 4, y - 8, 4, 24, 0x62975e, 0.7);
  }
  scene.add.ellipse(500, 280, 860, 310, 0x647651, 0.32);
  scene.add.rectangle(26, 265, 52, 145, 0x9d8d62, 0.55)
    .setStrokeStyle(3, PALETTE.gold);
  label(scene, 20, 173, '← VỀ LÀNG', 17, '#fff0bb');
  label(scene, 40, 42, 'RỪNG TRÚC U MINH', 24, '#fff1c8');
  label(scene, 40, 73, 'Dấu vết yêu khí bao phủ rừng thiêng', 14, '#cad7a6');
}

export function actor(scene: Phaser.Scene, x: number, y: number, color: number,
  name: string, radius = 21, crown = false): Phaser.GameObjects.Container {
  const shadow = scene.add.ellipse(0, radius * 0.85, radius * 2, 13, 0x112b26, 0.65);
  const body = scene.add.circle(0, 0, radius, color).setStrokeStyle(3, 0x243c31);
  const face = scene.add.circle(0, -radius * 0.25, radius * 0.57, 0xecc79b);
  const eyes = scene.add.rectangle(-radius * 0.2, -radius * 0.2, 3, 3, 0x182c2c);
  const eyes2 = scene.add.rectangle(radius * 0.2, -radius * 0.2, 3, 3, 0x182c2c);
  const parts: Phaser.GameObjects.GameObject[] = [shadow, body, face, eyes, eyes2];
  if (crown) {
    parts.push(scene.add.triangle(0, -radius * 1.22, -11, 6, 0, -13, 11, 6, PALETTE.gold));
  }
  const caption = label(scene, 0, -radius - 23, name, 13, '#fff5d2', 'center');
  parts.push(caption);
  const obj = scene.add.container(x, y, parts);
  obj.setDepth(30 + y / 10);
  return obj;
}

export function floatText(scene: Phaser.Scene, x: number, y: number, value: string,
  color = '#fef2be'): void {
  const textObj = label(scene, x, y, value, 20, color, 'center').setDepth(1500);
  scene.tweens.add({ targets: textObj, y: y - 36, alpha: 0, duration: 670,
    onComplete: () => textObj.destroy() });
}
