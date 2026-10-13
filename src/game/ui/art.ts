import Phaser from 'phaser';
import { H, PALETTE, W } from '../../data/config';
import { paintEnvironment } from '../rendering/Environment';
import { VILLAGE_BARRIERS } from '../world/WorldBounds';

export function label(scene: Phaser.Scene, x: number, y: number, text: string,
  fontSize = 17, color = PALETTE.cream, align: 'left' | 'center' = 'left'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: 'Arial, sans-serif', fontSize: `${fontSize}px`, color,
    fontStyle: fontSize >= 20 ? 'bold' : 'normal',
    stroke: '#10251f', strokeThickness: 3,
    align, lineSpacing: 6,
  }).setOrigin(align === 'center' ? 0.5 : 0, 0.5);
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number,
  text: string, action: () => void, fill = 0x87623d): Phaser.GameObjects.Container {
  const box = scene.add.rectangle(0, 0, width, 44, fill)
    .setStrokeStyle(2, PALETTE.bronze).setInteractive({ useHandCursor: true });
  // Subtle bronze corner rivets
  const r1 = scene.add.circle(-width / 2 + 6, -16, 2, 0xf6d365);
  const r2 = scene.add.circle(width / 2 - 6, -16, 2, 0xf6d365);
  const r3 = scene.add.circle(-width / 2 + 6, 16, 2, 0xf6d365);
  const r4 = scene.add.circle(width / 2 - 6, 16, 2, 0xf6d365);
  const textObj = label(scene, 0, 0, text, 17, '#fff3d6', 'center');
  const container = scene.add.container(x, y, [box, r1, r2, r3, r4, textObj]);
  box.on('pointerover', () => box.setFillStyle(0xab824f));
  box.on('pointerout', () => box.setFillStyle(fill));
  box.on('pointerdown', () => action());
  return container;
}

/**
 * Draws a segmented bamboo stalk cluster with realistic nodes and drooping leaves.
 */
function bambooCluster(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  g.setDepth(20 + y / 10);

  // 3-4 bamboo stalks
  const stalks = [-7, 0, 8];
  stalks.forEach((sx, idx) => {
    const height = (55 + idx * 8) * scale;
    const width = 5 * scale;
    const stalkX = x + sx * scale;
    const stalkY = y - height + 10 * scale;

    // Stem base & segments
    g.fillStyle(0x3b6e41, 1);
    g.fillRect(stalkX - width / 2, stalkY, width, height);

    // Bamboo nodes (đốt tre)
    const nodeCount = 5;
    for (let i = 1; i < nodeCount; i++) {
      const ny = stalkY + (height / nodeCount) * i;
      g.fillStyle(0x1e3b23, 1);
      g.fillRect(stalkX - width / 2 - 1, ny - 1, width + 2, 2.5);
      g.fillStyle(0x6ca367, 0.8);
      g.fillRect(stalkX - width / 2, ny + 1.5, width, 1.5);
    }

    // Leaf tufts branching off nodes
    g.fillStyle(0x528e4e, 0.9);
    for (let i = 0; i < 3; i++) {
      const ly = stalkY + (height / 3.5) * i;
      const dir = (idx + i) % 2 === 0 ? 1 : -1;
      g.fillTriangle(
        stalkX, ly,
        stalkX + dir * 14 * scale, ly - 5 * scale,
        stalkX + dir * 6 * scale, ly + 2 * scale
      );
    }
  });

  // Base tuft
  scene.add.ellipse(x, y + 10 * scale, 24 * scale, 8 * scale, 0x1a3321, 0.5)
    .setDepth(19 + y / 10);
}

/**
 * Draws an authentic Văn Lang stilt house with boat-shaped curved roof (Nhà sàn mái cong hình thuyền).
 */
function stiltHouse(scene: Phaser.Scene, x: number, y: number, width: number, variant: 'leader' | 'smith' | 'shaman' = 'leader'): void {
  const g = scene.add.graphics();
  const depth = 20 + y / 10;
  g.setDepth(depth);

  // 1. Ground shadow
  scene.add.ellipse(x, y + 36, width + 30, 24, 0x162c22, 0.45).setDepth(depth - 1);

  // 2. Wooden stilts (Cột nhà sàn)
  const stiltCount = 5;
  const stiltHeight = 32;
  const platformY = y + 4;
  g.fillStyle(0x422d1e, 1);
  for (let i = 0; i < stiltCount; i++) {
    const sx = x - width / 2 + (width / (stiltCount - 1)) * i;
    g.fillRect(sx - 2.5, platformY, 5, stiltHeight);
  }

  // Bamboo access ladder on the right
  const ladderX = x + width / 2 - 10;
  g.lineStyle(2, 0x5a4128, 1);
  g.lineBetween(ladderX, platformY, ladderX + 10, platformY + stiltHeight);
  g.lineBetween(ladderX + 6, platformY, ladderX + 16, platformY + stiltHeight);
  for (let s = 1; s <= 3; s++) {
    const rY = platformY + s * 8;
    g.lineBetween(ladderX + s * 2, rY, ladderX + s * 2 + 6, rY);
  }

  // 3. Wooden living platform & woven bamboo walls
  g.fillStyle(0x735534, 1);
  g.fillRect(x - width / 2 - 4, platformY - 2, width + 8, 5); // sàn nhà
  g.fillStyle(0xcaa368, 1); // vách nứa đan
  g.fillRect(x - width / 2, platformY - 34, width, 32);
  g.lineStyle(1.5, 0x5b3f26, 0.6);
  // Cross-hatch woven pattern
  for (let w = -width / 2 + 10; w < width / 2; w += 16) {
    g.lineBetween(x + w, platformY - 34, x + w + 8, platformY - 2);
    g.lineBetween(x + w + 8, platformY - 34, x + w, platformY - 2);
  }

  // Doorway
  g.fillStyle(0x352317, 1);
  g.fillRect(x - 12, platformY - 28, 24, 26);

  // 4. Boat-shaped curved roof (Mái cong hình thuyền Đông Sơn)
  // Eaves curve upwards high on both ends like a canoe
  const roofPeakY = platformY - 68;
  const eaveY = platformY - 42;
  const eaveExtend = width / 2 + 22;

  g.fillStyle(0x824b2b, 1); // Lớp tranh rạ sẫm
  g.beginPath();
  g.moveTo(x - eaveExtend, eaveY - 8); // mỏ neo cong vút trái
  g.lineTo(x, roofPeakY);
  g.lineTo(x + eaveExtend, eaveY - 8); // mỏ neo cong vút phải
  g.lineTo(x + width / 2 + 8, eaveY + 6);
  g.lineTo(x, eaveY - 12);
  g.lineTo(x - width / 2 - 8, eaveY + 6);
  g.closePath();
  g.fillPath();

  // Roof ridge highlight & bird finials (Mỏ chim Lạc cách điệu ở hai đầu hồi)
  g.lineStyle(3, 0x482618, 1);
  g.strokePath();

  // Chim Lạc roof finial horns
  g.fillStyle(0xd9b362, 1);
  g.fillTriangle(
    x - eaveExtend, eaveY - 8,
    x - eaveExtend - 6, eaveY - 18,
    x - eaveExtend + 4, eaveY - 10
  );
  g.fillTriangle(
    x + eaveExtend, eaveY - 8,
    x + eaveExtend + 6, eaveY - 18,
    x + eaveExtend - 4, eaveY - 10
  );

  // Distinct house props based on variant
  if (variant === 'smith') {
    // Furnace & stone anvil under the stilt
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(x - 28, platformY + 12, 14, 18); // đe đá
    g.fillStyle(0xd95d39, 0.8);
    g.fillCircle(x - 21, platformY + 8, 4); // lửa lò rèn
  } else if (variant === 'shaman') {
    // Hanging mystical bronze bells & herbs
    g.fillStyle(0xbfa159, 1);
    g.fillCircle(x - 16, eaveY + 4, 3);
    g.fillCircle(x + 16, eaveY + 4, 3);
  }
}

/**
 * Draws the central Ngọc Lũ Đông Sơn bronze drum plaza.
 */
function drawDongSonPlaza(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  const g = scene.add.graphics();
  g.setDepth(2);

  // Outer bronze rim & patinated verdigris ground ring
  g.fillStyle(0x274a3b, 0.7);
  g.fillCircle(x, y, radius + 10);
  g.fillStyle(0x7c5a2c, 0.9);
  g.fillCircle(x, y, radius);
  g.lineStyle(3, PALETTE.bronze, 1);
  g.strokeCircle(x, y, radius);

  // Concentric circle bands
  g.lineStyle(2, 0xd4af37, 0.75);
  g.strokeCircle(x, y, radius * 0.78);
  g.strokeCircle(x, y, radius * 0.52);
  g.strokeCircle(x, y, radius * 0.28);

  // Saw-tooth geometric band (Họa tiết răng cưa)
  const sawRadius = radius * 0.65;
  const teeth = 24;
  g.lineStyle(1.5, 0xf6d365, 0.85);
  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2;
    const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a3 = ((i + 1) / teeth) * Math.PI * 2;
    g.lineBetween(
      x + Math.cos(a1) * (sawRadius - 5), y + Math.sin(a1) * (sawRadius - 5),
      x + Math.cos(a2) * (sawRadius + 5), y + Math.sin(a2) * (sawRadius + 5)
    );
    g.lineBetween(
      x + Math.cos(a2) * (sawRadius + 5), y + Math.sin(a2) * (sawRadius + 5),
      x + Math.cos(a3) * (sawRadius - 5), y + Math.sin(a3) * (sawRadius - 5)
    );
  }

  // 14-ray solar starburst at the center (Ngôi sao 14 cánh Ngọc Lũ)
  const rays = 14;
  const innerR = radius * 0.09;
  const outerR = radius * 0.25;
  g.fillStyle(0xffe68b, 0.95);
  for (let i = 0; i < rays; i++) {
    const a1 = (i / rays) * Math.PI * 2;
    const aMid = ((i + 0.5) / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    g.fillTriangle(
      x + Math.cos(a1) * innerR, y + Math.sin(a1) * innerR,
      x + Math.cos(aMid) * outerR, y + Math.sin(aMid) * outerR,
      x + Math.cos(a2) * innerR, y + Math.sin(a2) * innerR
    );
  }

  // Stylized Lac Birds (Chim Lạc bay ngược chiều kim đồng hồ)
  const birdOrbit = radius * 0.88;
  g.fillStyle(0xf8df88, 0.85);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const bx = x + Math.cos(angle) * birdOrbit;
    const by = y + Math.sin(angle) * birdOrbit;
    const wingAngle = angle - Math.PI / 2;
    g.fillTriangle(
      bx, by,
      bx + Math.cos(wingAngle) * 11, by + Math.sin(wingAngle) * 11,
      bx + Math.cos(wingAngle + 2.5) * 6, by + Math.sin(wingAngle + 2.5) * 6
    );
  }
}

export function paintVillage(scene: Phaser.Scene): void {
  if (paintEnvironment(scene, 'village', VILLAGE_BARRIERS)) {
    drawDongSonPlaza(scene, 480, 310, 78);
    label(scene, 914, 220, 'RỪNG TRÚC →', 16, '#ffe79a').setOrigin(1, 0.5);
    return;
  }
  // Rich tropical earth & lush grassy ground
  scene.add.rectangle(W / 2, H / 2, W, H, 0x4f7042).setDepth(0);

  // Red alluvial soil path (Đất phù sa)
  const path = scene.add.graphics().setDepth(1);
  path.fillStyle(0x9a7b53, 1);
  path.fillRect(0, 245, W, 120);
  path.fillStyle(0xb59567, 0.7);
  path.fillRect(0, 260, W, 90);

  // Central Đông Sơn Drum Plaza
  drawDongSonPlaza(scene, 480, 310, 78);

  // Green crop fields / gardens
  scene.add.rectangle(230, 420, 240, 160, 0x67874f).setDepth(1);
  const gardenLines = scene.add.graphics().setDepth(1);
  gardenLines.lineStyle(2, 0x54723e, 0.6);
  for (let i = 0; i < 7; i++) {
    gardenLines.lineBetween(120, 350 + i * 20, 340, 350 + i * 20);
  }

  // 3 Traditional Stilt Houses
  stiltHouse(scene, 190, 160, 130, 'leader'); // Nhà Trưởng Làng
  stiltHouse(scene, 480, 155, 125, 'smith');  // Nhà Thợ Rèn
  stiltHouse(scene, 750, 160, 120, 'shaman'); // Nhà Bà Mo

  // Bamboo clusters framing the village
  bambooCluster(scene, 55, 130, 1.2);
  bambooCluster(scene, 45, 430, 1.1);
  bambooCluster(scene, 620, 450, 1.0);
  bambooCluster(scene, 905, 455, 1.2);
  bambooCluster(scene, 895, 120, 1.0);

  // Lotus pond (Ao sen ngọc bích)
  const pond = scene.add.graphics().setDepth(2);
  pond.fillStyle(0x2d6159, 1);
  pond.fillEllipse(760, 425, 120, 70);
  pond.lineStyle(3, 0x477d6e, 0.9);
  pond.strokeEllipse(760, 425, 120, 70);
  // Lotus pads
  pond.fillStyle(0x569651, 0.9);
  pond.fillCircle(735, 420, 9);
  pond.fillCircle(780, 435, 8);
  pond.fillCircle(755, 440, 7);
  // Pink lotus flower
  pond.fillStyle(0xf0809b, 1);
  pond.fillCircle(775, 425, 4);

  // Village Gate to Forest (Cổng tre làng Lạc Thủy)
  const gate = scene.add.graphics().setDepth(25);
  gate.fillStyle(0x3e5e33, 0.95);
  gate.fillRect(925, 205, 30, 175);
  gate.lineStyle(3, PALETTE.gold, 1);
  gate.strokeRect(925, 205, 30, 175);
  label(scene, 914, 220, 'RỪNG TRÚC →', 16, '#ffe79a').setOrigin(1, 0.5);
}

import { getChapterWorldConfig, type ChapterWorldConfig } from '../world/ChapterWorld';

/**
 * Draws water reeds and cattails for swamp areas.
 */
function swampReedCluster(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  g.setDepth(20 + y / 10);
  const stalks = [-6, 0, 7];
  stalks.forEach((sx, idx) => {
    const height = (46 + idx * 7) * scale;
    const stalkX = x + sx * scale;
    const stalkY = y - height + 8 * scale;
    g.lineStyle(2.5 * scale, 0x366347, 1);
    g.lineBetween(stalkX, y + 6 * scale, stalkX + (idx - 1) * 4 * scale, stalkY);
    // Cattail head (bông lau/sậy nâu)
    g.fillStyle(0x5a3d28, 1);
    g.fillRoundedRect(stalkX + (idx - 1) * 4 * scale - 2 * scale, stalkY, 4 * scale, 14 * scale, 2 * scale);
  });
  // Water mud tuft base
  scene.add.ellipse(x, y + 8 * scale, 22 * scale, 7 * scale, 0x143329, 0.6).setDepth(19 + y / 10);
}

/**
 * Draws floating lotus pads with small blossom accents for swamp/water areas.
 */
function lotusPadCluster(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  g.setDepth(2);
  g.fillStyle(0x1e5a42, 0.95);
  g.fillCircle(x, y, 14 * scale);
  g.lineStyle(1.5, 0x2f7d5e, 0.9);
  g.strokeCircle(x, y, 14 * scale);
  // Notch cut in lily pad
  g.fillStyle(0x0f2924, 1);
  g.fillTriangle(x, y, x + 15 * scale, y - 6 * scale, x + 15 * scale, y + 6 * scale);
  // Little lotus blossom
  g.fillStyle(0xeb7b9b, 1);
  g.fillCircle(x - 5 * scale, y - 4 * scale, 3.5 * scale);
}

/**
 * Draws a sacred mountain megalith stele (vách thạch bích) for mountain areas.
 */
function mountainStele(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  const depth = 20 + y / 10;
  g.setDepth(depth);
  const w = 18 * scale;
  const h = 42 * scale;
  // Shadow
  scene.add.ellipse(x, y + 4, w + 12, 10, 0x171a1c, 0.6).setDepth(depth - 1);
  // Stone body
  g.fillStyle(0x40474b, 1);
  g.fillRect(x - w / 2, y - h, w, h);
  g.lineStyle(2, 0x626c71, 0.9);
  g.strokeRect(x - w / 2, y - h, w, h);
  // Carved ancient rune glyph lines
  g.lineStyle(1.5, 0xd4af37, 0.7);
  g.lineBetween(x - 4 * scale, y - h + 10 * scale, x + 4 * scale, y - h + 10 * scale);
  g.lineBetween(x, y - h + 8 * scale, x, y - h + 24 * scale);
  g.lineBetween(x - 5 * scale, y - h + 20 * scale, x + 5 * scale, y - h + 20 * scale);
}

/**
 * Draws a mountain temple stone lantern with warm fire glow.
 */
function templeLantern(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  const depth = 20 + y / 10;
  g.setDepth(depth);
  // Stone pedestal & pillar
  g.fillStyle(0x383e42, 1);
  g.fillRect(x - 6 * scale, y - 28 * scale, 12 * scale, 28 * scale);
  // Light box
  g.fillStyle(0x272c2f, 1);
  g.fillRect(x - 10 * scale, y - 42 * scale, 20 * scale, 16 * scale);
  // Glowing golden lamp fire
  g.fillStyle(0xf6d365, 0.95);
  g.fillCircle(x, y - 34 * scale, 5 * scale);
  // Little glow ring
  g.fillStyle(0xfff1aa, 0.35);
  g.fillCircle(x, y - 34 * scale, 11 * scale);
  // Pagoda roof cap
  g.fillStyle(0x4f585d, 1);
  g.fillTriangle(x - 14 * scale, y - 42 * scale, x, y - 52 * scale, x + 14 * scale, y - 42 * scale);
}

/**
 * Draws an imperial citadel crimson battle banner (cờ lệnh hoàng thành).
 */
function citadelBanner(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  const depth = 20 + y / 10;
  g.setDepth(depth);
  // Bronze flagpole
  g.fillStyle(0x735534, 1);
  g.fillRect(x - 2 * scale, y - 60 * scale, 4 * scale, 62 * scale);
  g.fillStyle(0xd4af37, 1);
  g.fillTriangle(x - 4 * scale, y - 60 * scale, x, y - 68 * scale, x + 4 * scale, y - 60 * scale);
  // Crimson cloth pennant
  g.fillStyle(0xb82736, 0.95);
  g.beginPath();
  g.moveTo(x + 2 * scale, y - 58 * scale);
  g.lineTo(x + 28 * scale, y - 48 * scale);
  g.lineTo(x + 2 * scale, y - 36 * scale);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.5, 0xf6d365, 0.85);
  g.strokePath();
}

/**
 * Draws an imperial bronze ceremonial brazier with leaping flames.
 */
function bronzeBrazier(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const g = scene.add.graphics();
  const depth = 20 + y / 10;
  g.setDepth(depth);
  // Bronze tripod bowl
  g.fillStyle(0x5a3e26, 1);
  g.fillRect(x - 12 * scale, y - 22 * scale, 24 * scale, 14 * scale);
  g.fillStyle(0x996d3d, 1);
  g.fillRect(x - 14 * scale, y - 24 * scale, 28 * scale, 4 * scale);
  // Legs
  g.fillRect(x - 10 * scale, y - 8 * scale, 4 * scale, 8 * scale);
  g.fillRect(x + 6 * scale, y - 8 * scale, 4 * scale, 8 * scale);
  // Fire
  g.fillStyle(0xe24b2b, 0.95);
  g.fillTriangle(x - 9 * scale, y - 24 * scale, x, y - 38 * scale, x + 9 * scale, y - 24 * scale);
  g.fillStyle(0xf6d365, 0.95);
  g.fillTriangle(x - 5 * scale, y - 24 * scale, x, y - 34 * scale, x + 5 * scale, y - 24 * scale);
}

/**
 * Vẽ cổng dịch chuyển an toàn trở về làng cho bất kỳ chương nào.
 */
function drawCommonChapterPortal(scene: Phaser.Scene, config: ChapterWorldConfig): void {
  const p = config.portal;
  const pal = config.theme.palette;
  const returnGate = scene.add.graphics().setDepth(25);
  returnGate.fillStyle(pal.gateFill, 0.95);
  returnGate.fillRect(p.x, p.y, p.width, p.height);
  returnGate.lineStyle(3, pal.gateBorder, 1);
  returnGate.strokeRect(p.x, p.y, p.width, p.height);
  label(scene, p.x + 38, p.y + 15, p.label, 17, '#ffe79a');
}

/**
 * BỐ CỤC CHƯƠNG 1: Rừng Trúc U Minh (Bamboo Forest Presentation).
 */
export function paintBambooForest(scene: Phaser.Scene, config: ChapterWorldConfig): void {
  if (paintEnvironment(scene, 'forest', config.barriers, config.arenaCenter)) {
    drawCommonChapterPortal(scene, config);
    return;
  }
  // 1. Nền rừng nguyên sinh u uất
  scene.add.rectangle(W / 2, H / 2, W, H, config.theme.palette.groundColor).setDepth(0);

  // 2. Chướng khí lượn sóng trên nền đất
  for (let i = 0; i < 24; i++) {
    const x = 30 + (i * 157) % 920;
    const y = 80 + (i * 117) % 430;
    scene.add.ellipse(x, y, 90, 50, config.theme.palette.groundDetailColor, 0.55).setDepth(1);
  }

  // 3. Rặng trúc rậm rạp (chừa thông thoáng lối vào và đấu trường trùm)
  for (let i = 0; i < 18; i++) {
    const x = 30 + (i * 179) % 910;
    const y = 90 + (i * 137) % 400;
    if (x < 220 && Math.abs(y - 270) < 95) continue;
    if (Math.hypot(x - config.arenaCenter.x, y - config.arenaCenter.y) < 105) continue;
    bambooCluster(scene, x, y, 0.7 + (i % 4) * 0.15);
  }

  // 4. Tế đàn yêu khí của Hổ Yêu U Minh
  const arena = config.arenaCenter;
  const altar = scene.add.graphics().setDepth(2);
  altar.fillStyle(config.theme.palette.arenaFloorColor, 0.85);
  altar.fillCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(2, config.theme.palette.arenaRuneColor, 0.75);
  altar.strokeCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(1.5, config.theme.palette.arenaAccentColor, 0.65);
  altar.strokeCircle(arena.x, arena.y, arena.radius * 0.65);

  // Runic stones xung quanh tế đàn
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2;
    const sx = arena.x + Math.cos(angle) * (arena.radius - 12);
    const sy = arena.y + Math.sin(angle) * (arena.radius - 12);
    scene.add.rectangle(sx, sy, 12, 18, 0x4a5d52).setDepth(20 + sy / 10)
      .setStrokeStyle(1.5, config.theme.palette.arenaAccentColor, 0.7);
  }

  // 5. Cổng dịch chuyển & Tiêu đề biểu ngữ
  drawCommonChapterPortal(scene, config);
}

/**
 * BỐ CỤC CHƯƠNG 2: Đầm Thiêng Ba Vì (Swamp & Water Cues Presentation).
 */
export function paintSwampWater(scene: Phaser.Scene, config: ChapterWorldConfig): void {
  if (paintEnvironment(scene, 'swamp', config.barriers, config.arenaCenter)) {
    drawCommonChapterPortal(scene, config);
    return;
  }
  // 1. Nền nước đầm lầy u uất sâu thẳm
  scene.add.rectangle(W / 2, H / 2, W, H, config.theme.palette.groundColor).setDepth(0);

  // 2. Những gợn sóng nước & xoáy bùn đầm lầy
  for (let i = 0; i < 26; i++) {
    const x = 25 + (i * 151) % 920;
    const y = 85 + (i * 113) % 430;
    const color = i % 2 === 0 ? config.theme.palette.groundDetailColor : 0x1d4d44;
    scene.add.ellipse(x, y, 105, 54, color, 0.62).setDepth(1);
  }

  // Làn sương ẩm bảng lảng mặt nước
  for (let i = 0; i < 10; i++) {
    const x = 50 + (i * 211) % 890;
    const y = 100 + (i * 163) % 400;
    scene.add.ellipse(x, y, 140, 42, 0x19433e, 0.35).setDepth(1);
  }

  // 3. Tín hiệu đầm lầy: Bụi sậy & Cụm lá sen khổng lồ
  for (let i = 0; i < 16; i++) {
    const x = 35 + (i * 181 + 20) % 910;
    const y = 95 + (i * 139 + 30) % 395;
    if (x < 220 && Math.abs(y - 270) < 95) continue;
    if (Math.hypot(x - config.arenaCenter.x, y - config.arenaCenter.y) < 105) continue;

    if (i % 2 === 0) {
      swampReedCluster(scene, x, y, 0.8 + (i % 3) * 0.2);
    } else {
      lotusPadCluster(scene, x, y, 0.85 + (i % 3) * 0.15);
    }
  }

  // 4. Tế Đàn Xoáy Nước Thuồng Luồng Nhiễm Tà
  const arena = config.arenaCenter;
  const altar = scene.add.graphics().setDepth(2);
  altar.fillStyle(config.theme.palette.arenaFloorColor, 0.9);
  altar.fillCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(2.5, config.theme.palette.arenaRuneColor, 0.85);
  altar.strokeCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(1.8, config.theme.palette.arenaAccentColor, 0.7);
  altar.strokeCircle(arena.x, arena.y, arena.radius * 0.68);
  altar.strokeCircle(arena.x, arena.y, arena.radius * 0.38);

  // Trụ đá rồng chìm dưới nước bao quanh tế đàn
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2;
    const sx = arena.x + Math.cos(angle) * (arena.radius - 12);
    const sy = arena.y + Math.sin(angle) * (arena.radius - 12);
    scene.add.rectangle(sx, sy, 14, 18, 0x1f4640).setDepth(20 + sy / 10)
      .setStrokeStyle(1.5, config.theme.palette.arenaAccentColor, 0.75);
  }

  // 5. Cổng bến nước & Biểu ngữ
  drawCommonChapterPortal(scene, config);
}

/**
 * BỐ CỤC CHƯƠNG 3: Núi Tản Viên (Mountain & Temple Cues Presentation).
 */
export function paintMountainTemple(scene: Phaser.Scene, config: ChapterWorldConfig): void {
  if (paintEnvironment(scene, 'mountain', config.barriers, config.arenaCenter)) {
    drawCommonChapterPortal(scene, config);
    return;
  }
  // 1. Nền đá phiến non cao hùng vĩ
  scene.add.rectangle(W / 2, H / 2, W, H, config.theme.palette.groundColor).setDepth(0);

  // 2. Vách đá gồ ghề & Mây mù đỉnh thiêng
  for (let i = 0; i < 24; i++) {
    const x = 30 + (i * 163) % 920;
    const y = 80 + (i * 127) % 430;
    const color = i % 2 === 0 ? config.theme.palette.groundDetailColor : 0x3d4447;
    scene.add.rectangle(x, y, 95, 52, color, 0.65).setDepth(1);
  }

  // Dải mây trắng mỏng ngang đỉnh Ba Vì
  for (let i = 0; i < 12; i++) {
    const x = 40 + (i * 197) % 900;
    const y = 90 + (i * 149) % 410;
    scene.add.ellipse(x, y, 160, 36, 0x475155, 0.3).setDepth(1);
  }

  // 3. Tín hiệu núi non & đền thờ: Vách thạch bích, Đèn đá Sơn Thần
  for (let i = 0; i < 16; i++) {
    const x = 35 + (i * 177 + 25) % 910;
    const y = 95 + (i * 137 + 35) % 390;
    if (x < 220 && Math.abs(y - 270) < 95) continue;
    if (Math.hypot(x - config.arenaCenter.x, y - config.arenaCenter.y) < 105) continue;

    if (i % 2 === 0) {
      mountainStele(scene, x, y, 0.85 + (i % 3) * 0.15);
    } else {
      templeLantern(scene, x, y, 0.85 + (i % 3) * 0.15);
    }
  }

  // 4. Đàn Bàn Thạch Thạch Tướng Cổ
  const arena = config.arenaCenter;
  const altar = scene.add.graphics().setDepth(2);
  altar.fillStyle(config.theme.palette.arenaFloorColor, 0.9);
  altar.fillCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(3, config.theme.palette.arenaRuneColor, 0.9);
  altar.strokeCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(1.8, config.theme.palette.arenaAccentColor, 0.8);
  altar.strokeCircle(arena.x, arena.y, arena.radius * 0.62);

  // Họa tiết thái dương 8 tia bàn thạch ở giữa
  const rays = 8;
  const innerR = arena.radius * 0.12;
  const outerR = arena.radius * 0.42;
  altar.fillStyle(0xf6d365, 0.85);
  for (let i = 0; i < rays; i++) {
    const a1 = (i / rays) * Math.PI * 2;
    const aMid = ((i + 0.5) / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    altar.fillTriangle(
      arena.x + Math.cos(a1) * innerR, arena.y + Math.sin(a1) * innerR,
      arena.x + Math.cos(aMid) * outerR, arena.y + Math.sin(aMid) * outerR,
      arena.x + Math.cos(a2) * innerR, arena.y + Math.sin(a2) * innerR,
    );
  }

  // Trụ đá thiêng cổ kính xung quanh
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2;
    const sx = arena.x + Math.cos(angle) * (arena.radius - 12);
    const sy = arena.y + Math.sin(angle) * (arena.radius - 12);
    scene.add.rectangle(sx, sy, 14, 20, 0x4f575c).setDepth(20 + sy / 10)
      .setStrokeStyle(1.8, config.theme.palette.arenaRuneColor, 0.85);
  }

  // 5. Cổng đường đèo & Biểu ngữ
  drawCommonChapterPortal(scene, config);
}

/**
 * BỐ CỤC CHƯƠNG 4: Hoàng Thành Phong Châu (Phong Châu / Final Arena Cues Presentation).
 */
export function paintPhongChauArena(scene: Phaser.Scene, config: ChapterWorldConfig): void {
  if (paintEnvironment(scene, 'citadel', config.barriers, config.arenaCenter)) {
    drawCommonChapterPortal(scene, config);
    return;
  }
  // 1. Nền gạch đá hoàng thành cổ kính nhuốm màu chiến trận
  scene.add.rectangle(W / 2, H / 2, W, H, config.theme.palette.groundColor).setDepth(0);

  // 2. Gạch lát sân cung điện & Huyết ấn hắc ám
  const flagstones = scene.add.graphics().setDepth(1);
  flagstones.lineStyle(1.5, config.theme.palette.groundDetailColor, 0.7);
  for (let x = 30; x < W - 20; x += 60) {
    flagstones.lineBetween(x, 100, x, H - 35);
  }
  for (let y = 100; y < H - 30; y += 48) {
    flagstones.lineBetween(30, y, W - 20, y);
  }

  // Tàn tro tà khí lơ lửng từ phong ấn Hắc Ấn
  for (let i = 0; i < 20; i++) {
    const x = 35 + (i * 173) % 910;
    const y = 85 + (i * 131) % 420;
    scene.add.ellipse(x, y, 70, 36, 0x4a1f26, 0.45).setDepth(1);
  }

  // 3. Tín hiệu hoàng thành: Cờ lệnh chim Lạc & Vạc đồng tế tự rực lửa
  for (let i = 0; i < 16; i++) {
    const x = 35 + (i * 183 + 15) % 910;
    const y = 95 + (i * 137 + 35) % 390;
    if (x < 220 && Math.abs(y - 270) < 95) continue;
    if (Math.hypot(x - config.arenaCenter.x, y - config.arenaCenter.y) < 110) continue;

    if (i % 2 === 0) {
      citadelBanner(scene, x, y, 0.85 + (i % 3) * 0.15);
    } else {
      bronzeBrazier(scene, x, y, 0.85 + (i % 3) * 0.15);
    }
  }

  // 4. Đại Trận Đồ Trống Đồng Phong Ấn Hắc Ấn
  const arena = config.arenaCenter;
  const altar = scene.add.graphics().setDepth(2);
  altar.fillStyle(config.theme.palette.arenaFloorColor, 0.95);
  altar.fillCircle(arena.x, arena.y, arena.radius);
  altar.lineStyle(3, config.theme.palette.arenaRuneColor, 0.95);
  altar.strokeCircle(arena.x, arena.y, arena.radius);

  // Vòng răng cưa Đông Sơn huyết chiến
  const sawRadius = arena.radius * 0.72;
  const teeth = 20;
  altar.lineStyle(2, 0xf6d365, 0.85);
  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2;
    const a2 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a3 = ((i + 1) / teeth) * Math.PI * 2;
    altar.lineBetween(
      arena.x + Math.cos(a1) * (sawRadius - 5), arena.y + Math.sin(a1) * (sawRadius - 5),
      arena.x + Math.cos(a2) * (sawRadius + 5), arena.y + Math.sin(a2) * (sawRadius + 5),
    );
    altar.lineBetween(
      arena.x + Math.cos(a2) * (sawRadius + 5), arena.y + Math.sin(a2) * (sawRadius + 5),
      arena.x + Math.cos(a3) * (sawRadius - 5), arena.y + Math.sin(a3) * (sawRadius - 5),
    );
  }

  // Ngôi sao 14 cánh Trống Đồng ở trung tâm
  const rays = 14;
  const innerR = arena.radius * 0.1;
  const outerR = arena.radius * 0.35;
  altar.fillStyle(0xf6d365, 0.95);
  for (let i = 0; i < rays; i++) {
    const a1 = (i / rays) * Math.PI * 2;
    const aMid = ((i + 0.5) / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    altar.fillTriangle(
      arena.x + Math.cos(a1) * innerR, arena.y + Math.sin(a1) * innerR,
      arena.x + Math.cos(aMid) * outerR, arena.y + Math.sin(aMid) * outerR,
      arena.x + Math.cos(a2) * innerR, arena.y + Math.sin(a2) * innerR,
    );
  }

  // 8 Trụ đồng trấn yểm hoàng cung xung quanh tế đàn
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const sx = arena.x + Math.cos(angle) * (arena.radius - 12);
    const sy = arena.y + Math.sin(angle) * (arena.radius - 12);
    scene.add.rectangle(sx, sy, 14, 22, 0x54262b).setDepth(20 + sy / 10)
      .setStrokeStyle(2, config.theme.palette.arenaRuneColor, 0.9);
  }

  // 5. Cổng thành hậu tuyến & Biểu ngữ
  drawCommonChapterPortal(scene, config);
}

/**
 * Điều phối vẽ không gian thế giới theo Chapter ID với khả năng tương thích và fallback tự động.
 */
export function paintChapterArea(scene: Phaser.Scene, chapterId: number | unknown): void {
  const config = getChapterWorldConfig(chapterId);
  switch (config.chapterId) {
    case 2:
      paintSwampWater(scene, config);
      break;
    case 3:
      paintMountainTemple(scene, config);
      break;
    case 4:
      paintPhongChauArena(scene, config);
      break;
    case 1:
    default:
      paintBambooForest(scene, config);
      break;
  }
}

/**
 * Tương thích ngược: paintForest mặc định vẽ Chương 1 Rừng Trúc U Minh.
 */
export function paintForest(scene: Phaser.Scene): void {
  paintChapterArea(scene, 1);
}

/**
 * Draws an authentic procedural character or monster matching Đông Sơn / Văn Lang lore.
 */
export function actor(scene: Phaser.Scene, x: number, y: number, color: number,
  name: string, radius = 21, crown = false): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];

  // Ground shadow
  const shadow = scene.add.ellipse(0, radius * 0.88, radius * 2.2, 13, 0x112b26, 0.65);
  parts.push(shadow);

  if (name === 'THIÊN MỆNH') {
    // === DŨNG SĨ VĂN LANG THIÊN MỆNH ===
    // Muscular body with woven loincloth (khố)
    const body = scene.add.rectangle(0, -2, 22, 28, 0xc49a6c).setStrokeStyle(2, 0x3d2719);
    const loincloth = scene.add.rectangle(0, 9, 20, 14, 0x9e382b).setStrokeStyle(1.5, 0x5a1812);
    // Bronze arm guards (Hộ uyển đồng)
    const armL = scene.add.rectangle(-13, -2, 6, 16, 0xb8883b);
    const armR = scene.add.rectangle(13, -2, 6, 16, 0xb8883b);
    // Face & Eyes
    const head = scene.add.circle(0, -18, 12, 0xd8ab7a).setStrokeStyle(2, 0x3d2719);
    const eyes = scene.add.rectangle(-4, -18, 3, 3, 0x16221c);
    const eyes2 = scene.add.rectangle(4, -18, 3, 3, 0x16221c);
    // Văn Lang Feather Headdress (Khăn quấn lông chim Lạc)
    const headband = scene.add.rectangle(0, -26, 18, 4, 0xb8883b);
    const feather = scene.add.triangle(0, -35, -5, 8, 0, -10, 5, 8, 0xf6d365);
    // Bronze Spear in hand (Ngọn giáo đồng Đông Sơn)
    const spearShaft = scene.add.rectangle(16, -10, 3, 44, 0x5a3d24);
    const spearHead = scene.add.triangle(16, -34, -5, 8, 0, -8, 5, 8, 0xd4af37)
      .setStrokeStyle(1, 0xfff0aa);
    parts.push(body, loincloth, armL, armR, head, eyes, eyes2, headband, feather, spearShaft, spearHead);
  } else if (name === 'Trưởng làng') {
    // === TRƯỞNG LÀNG LẠC ===
    const robe = scene.add.rectangle(0, 2, 26, 32, 0x8a6237).setStrokeStyle(2, 0x48321a);
    const head = scene.add.circle(0, -18, 12, 0xd1a97d).setStrokeStyle(2, 0x48321a);
    const beard = scene.add.triangle(0, -8, -6, 0, 0, 10, 6, 0, 0xe0d6c3);
    const staff = scene.add.rectangle(15, -4, 3, 46, 0x4b311f);
    const staffBird = scene.add.triangle(15, -28, -6, 4, 0, -6, 6, 4, 0xd4af37);
    parts.push(robe, head, beard, staff, staffBird);
  } else if (name === 'Thợ rèn') {
    // === THỢ RÈN ĐÚC ĐỒNG ===
    const body = scene.add.rectangle(0, 0, 28, 32, 0xb58055).setStrokeStyle(2, 0x422616);
    const apron = scene.add.rectangle(0, 4, 22, 24, 0x4a3423);
    const head = scene.add.circle(0, -18, 13, 0xcb9569).setStrokeStyle(2, 0x422616);
    const hammerShaft = scene.add.rectangle(17, -2, 3, 28, 0x3d291d);
    const hammerHead = scene.add.rectangle(17, -16, 12, 8, 0x6e787d);
    parts.push(body, apron, head, hammerShaft, hammerHead);
  } else if (name === 'Bà Mo') {
    // === BÀ MO THẢO MỘC ===
    const robe = scene.add.rectangle(0, 2, 24, 34, 0x4e3d67).setStrokeStyle(2, 0x2e1f42);
    const scarf = scene.add.circle(0, -16, 13, 0x765899);
    const head = scene.add.circle(0, -17, 11, 0xd4a784);
    const bell = scene.add.circle(14, 2, 6, 0xd4af37).setStrokeStyle(1.5, 0x82641c);
    parts.push(robe, scarf, head, bell);
  } else if (name === 'Mộc Tinh') {
    // === MỘC TINH (TRE MA / ĐẠI THỤ YÊU) ===
    const trunk = scene.add.rectangle(0, 0, 26, 34, 0x496338).setStrokeStyle(2, 0x25361b);
    const thornsL = scene.add.triangle(-15, -6, 0, -4, -10, 0, 0, 4, 0x304723);
    const thornsR = scene.add.triangle(15, -6, 0, -4, 10, 0, 0, 4, 0x304723);
    // Glowing emerald eyes
    const eyeL = scene.add.rectangle(-5, -6, 4, 4, 0x72f26d);
    const eyeR = scene.add.rectangle(5, -6, 4, 4, 0x72f26d);
    const crownLeaves = scene.add.triangle(0, -22, -14, 8, 0, -12, 14, 8, 0x2c4a25);
    parts.push(trunk, thornsL, thornsR, eyeL, eyeR, crownLeaves);
  } else if (name === 'Ma Trơi') {
    // === MA TRƠI (LINH HỎA U LINH) ===
    const outerFlame = scene.add.circle(0, -4, radius + 2, 0x38b3a7, 0.4);
    const innerFlame = scene.add.circle(0, -4, radius * 0.75, 0x61f3e5, 0.75);
    const core = scene.add.circle(0, -4, radius * 0.35, 0xffffff, 0.95);
    parts.push(outerFlame, innerFlame, core);
  } else if (name.includes('Hổ Yêu') || crown) {
    // === HỔ YÊU U MINH (BOSS MÃNH HỔ DỊ HÌNH) ===
    const tigerBody = scene.add.ellipse(0, 0, 58, 38, 0xd48737).setStrokeStyle(3, 0x4d280e);
    // Tiger stripes (Vệt vằn hắc ám)
    const s1 = scene.add.rectangle(-12, -4, 4, 20, 0x2a1407);
    const s2 = scene.add.rectangle(0, -6, 4, 22, 0x2a1407);
    const s3 = scene.add.rectangle(12, -4, 4, 20, 0x2a1407);
    // Fierce head & glowing demonic eyes
    const tigerHead = scene.add.circle(22, -8, 16, 0xba6f27).setStrokeStyle(2, 0x4d280e);
    const eye = scene.add.circle(27, -10, 4, 0xff3b30);
    const ear1 = scene.add.triangle(18, -24, -4, 6, 0, -4, 4, 6, 0x8a4b14);
    const ear2 = scene.add.triangle(28, -24, -4, 6, 0, -4, 4, 6, 0x8a4b14);
    // Bronze shoulder plate (Giáp vai đồng bảo hộ)
    const bronzeArmor = scene.add.ellipse(-4, -10, 22, 12, 0xd4af37, 0.85)
      .setStrokeStyle(1.5, 0x6e4a28);
    parts.push(tigerBody, s1, s2, s3, tigerHead, ear1, ear2, eye, bronzeArmor);
  } else {
    // Fallback circular actor
    const body = scene.add.circle(0, 0, radius, color).setStrokeStyle(3, 0x243c31);
    const face = scene.add.circle(0, -radius * 0.25, radius * 0.57, 0xecc79b);
    parts.push(body, face);
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
