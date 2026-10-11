import Phaser from 'phaser';
import { H, PALETTE, W } from '../../data/config';

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
  label(scene, 810, 220, '→ RỪNG TRÚC', 18, '#ffe79a');

  // Title header banner
  const banner = scene.add.rectangle(170, 52, 270, 56, 0x142c26, 0.85)
    .setStrokeStyle(2, PALETTE.bronze).setDepth(200);
  banner.setAlpha(0.92);
  label(scene, 50, 40, 'LÀNG LẠC THỦY', 22, '#ffeed0').setDepth(201);
  label(scene, 50, 68, 'Bản làng thanh bình thời Hùng Vương', 13, '#c9dcb9').setDepth(201);
}

export function paintForest(scene: Phaser.Scene): void {
  // Deep primeval jungle floor (Rừng đại ngàn u uất)
  scene.add.rectangle(W / 2, H / 2, W, H, 0x162c21).setDepth(0);

  // Miasma / fog floor ripples
  for (let i = 0; i < 24; i++) {
    const x = 30 + (i * 157) % 920;
    const y = 80 + (i * 117) % 430;
    scene.add.ellipse(x, y, 90, 50, 0x224231, 0.55).setDepth(1);
  }

  // Segmented bamboo groves everywhere
  for (let i = 0; i < 18; i++) {
    const x = 30 + (i * 179) % 910;
    const y = 90 + (i * 137) % 400;
    if (x < 220 && Math.abs(y - 270) < 95) continue; // Keep entrance clear
    bambooCluster(scene, x, y, 0.7 + (i % 4) * 0.15);
  }

  // Ancient Demonic Altar Clearing (Tế đàn yêu khí của Hổ Yêu U Minh)
  const altar = scene.add.graphics().setDepth(2);
  altar.fillStyle(0x213a2d, 0.85);
  altar.fillCircle(750, 280, 85);
  altar.lineStyle(2, 0x7c4987, 0.7); // Tím ma mị
  altar.strokeCircle(750, 280, 85);
  altar.lineStyle(1.5, 0x9b59b6, 0.6);
  altar.strokeCircle(750, 280, 55);

  // Ancient runic stones around altar
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2;
    const sx = 750 + Math.cos(angle) * 72;
    const sy = 280 + Math.sin(angle) * 72;
    scene.add.rectangle(sx, sy, 12, 18, 0x4a5d52).setDepth(20 + sy / 10)
      .setStrokeStyle(1.5, 0xa569bd, 0.7);
  }

  // Gate return to village
  const returnGate = scene.add.graphics().setDepth(25);
  returnGate.fillStyle(0x274938, 0.95);
  returnGate.fillRect(10, 205, 30, 175);
  returnGate.lineStyle(3, PALETTE.bronze, 1);
  returnGate.strokeRect(10, 205, 30, 175);
  label(scene, 48, 220, '← VỀ LÀNG', 17, '#ffe79a');

  // Title header banner
  const banner = scene.add.rectangle(195, 52, 320, 56, 0x142c26, 0.85)
    .setStrokeStyle(2, PALETTE.bronze).setDepth(200);
  banner.setAlpha(0.92);
  label(scene, 50, 40, 'RỪNG TRÚC U MINH', 22, '#ffeed0').setDepth(201);
  label(scene, 50, 68, 'Yêu khí bao phủ — Sào huyệt Hổ Yêu', 13, '#c9dcb9').setDepth(201);
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
