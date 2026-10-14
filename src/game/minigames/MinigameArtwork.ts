/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * MinigameArtwork: Procedural Texture Generator
 * 
 * Phong cách Ancient Bronze & Đông Sơn Palette:
 * - Vàng đồng: #c6a66b, #e8c991, #e5c158
 * - Nâu đồng: #8a6248, #5a3c26
 * - Xanh ngọc cổ: #497459, #2b4938
 * - Viền & nền tối: #172a2b, #0f1d1e, #0c1718
 * 
 * Tạo textures procedurally chất lượng cao:
 * 1. Lá bài 7321 (Mặt trước tre/đồng, mặt sau trống đồng & chim Lạc)
 * 2. Xúc xắc 6 mặt & Bát lắc xúc xắc (bát đồng Đông Sơn)
 * 3. 6 Linh vật Bách Việt: Bầu, Cua, Cá, Cọp, Gà, Nai
 * 4. 3 Chân dung NPC: Thầy Thẻ Lạc, Lão Đồng Xúc, Nàng Họa Linh
 */

import type Phaser from 'phaser';

export const MINIGAME_PALETTE = {
  goldBronze: '#c6a66b',
  goldLight: '#e8c991',
  goldBright: '#f3c66f',
  brownBronze: '#8a6248',
  brownDark: '#5a3c26',
  jadeAntique: '#497459',
  jadeDark: '#233d2f',
  darkBorder: '#172a2b',
  bgDark: '#0e1a1b',
  surfaceCard: '#24322e',
  surfaceBamboo: '#dfd2b5',
  redVermilion: '#c93b2b',
  whiteIvory: '#f8f4ea',
};

// Texture Keys
export const MINIGAME_TEXTURE_KEYS = {
  // Cards
  cardFront: 'minigame_card_front',
  cardBack: 'minigame_card_back',
  suitSpades: 'minigame_suit_spades',
  suitHearts: 'minigame_suit_hearts',
  suitDiamonds: 'minigame_suit_diamonds',
  suitClubs: 'minigame_suit_clubs',
  // Dice
  dice1: 'minigame_dice_1',
  dice2: 'minigame_dice_2',
  dice3: 'minigame_dice_3',
  dice4: 'minigame_dice_4',
  dice5: 'minigame_dice_5',
  dice6: 'minigame_dice_6',
  diceCup: 'minigame_dice_cup',
  dicePlate: 'minigame_dice_plate',
  // Animals
  animalBau: 'minigame_animal_bau',
  animalCua: 'minigame_animal_cua',
  animalCa: 'minigame_animal_ca',
  animalCop: 'minigame_animal_cop',
  animalGa: 'minigame_animal_ga',
  animalNai: 'minigame_animal_nai',
  symbolSlot: 'minigame_symbol_slot',
  symbolSlotSelected: 'minigame_symbol_slot_selected',
  // NPCs
  npcThayTheLac: 'minigame_npc_thay_the_lac',
  npcLaoDongXuc: 'minigame_npc_lao_dong_xuc',
  npcNangHoaLinh: 'minigame_npc_nang_hoa_linh',
  // Header bar
  headerPattern: 'minigame_header_pattern',
} as const;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Tạo canvas texture thông qua Phaser TextureManager hoặc fallback HTMLCanvas
 */
function createOrGetCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; refresh: () => void } | null {
  if (scene.textures && typeof scene.textures.exists === 'function' && scene.textures.exists(key)) {
    return null;
  }

  if (scene.textures && typeof scene.textures.createCanvas === 'function') {
    const canvasTex = scene.textures.createCanvas(key, width, height);
    if (!canvasTex) return null;
    return {
      canvas: canvasTex.canvas,
      ctx: canvasTex.context,
      refresh: () => canvasTex.update(),
    };
  }

  // Fallback cho headless runner hoặc môi trường DOM đơn giản
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return {
      canvas,
      ctx,
      refresh: () => {
        if (scene.textures && typeof scene.textures.addCanvas === 'function') {
          scene.textures.addCanvas(key, canvas);
        }
      },
    };
  }

  return null;
}

// ============================================================================
// PAINTERS
// ============================================================================

function paintCardBack(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 1. Nền thẻ đồng cổ sẫm
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#1c2f2b');
  bgGrad.addColorStop(0.5, '#2b443c');
  bgGrad.addColorStop(1, '#152421');
  ctx.fillStyle = bgGrad;
  drawRoundedRect(ctx, 2, 2, w - 4, h - 4, 8);
  ctx.fill();

  // 2. Viền đồng kép
  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, 3, 3, w - 6, h - 6, 7);
  ctx.stroke();

  ctx.strokeStyle = MINIGAME_PALETTE.brownBronze;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 7, 7, w - 14, h - 14, 5);
  ctx.stroke();

  // 3. Mặt trời Đông Sơn trung tâm (Ngôi sao 12 cánh)
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);

  // Vòng hào quang
  ctx.fillStyle = 'rgba(232, 201, 145, 0.15)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = MINIGAME_PALETTE.goldLight;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Ngôi sao 12 cánh
  ctx.fillStyle = MINIGAME_PALETTE.goldBright;
  ctx.beginPath();
  const points = 12;
  const rOuter = 20;
  const rInner = 8;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const r = i % 2 === 0 ? rOuter : rInner;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Tâm mặt trời
  ctx.fillStyle = MINIGAME_PALETTE.brownDark;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // 4. Chim Lạc bay ngược chiều kim đồng hồ quanh mặt trời
  ctx.strokeStyle = MINIGAME_PALETTE.goldLight;
  ctx.fillStyle = MINIGAME_PALETTE.goldLight;
  ctx.lineWidth = 1.2;
  for (let b = 0; b < 4; b++) {
    ctx.save();
    ctx.rotate((b * Math.PI) / 2);
    // Vẽ cánh chim Lạc cách điệu
    ctx.beginPath();
    ctx.moveTo(0, -31);
    ctx.bezierCurveTo(9, -34, 15, -28, 20, -22);
    ctx.bezierCurveTo(14, -23, 7, -27, 0, -28);
    ctx.fill();
    ctx.restore();
  }

  // Vòng tròn họa tiết răng cưa ngoài
  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // 4 đinh tán đồng ở 4 góc
  ctx.fillStyle = MINIGAME_PALETTE.goldBright;
  const corners = [
    [10, 10],
    [w - 10, 10],
    [10, h - 10],
    [w - 10, h - 10],
  ];
  for (const [px, py] of corners) {
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCardFront(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Mặt thẻ tre / giấy dó cổ
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#fdfbf5');
  grad.addColorStop(0.5, '#f4ece1');
  grad.addColorStop(1, '#e7dcce');
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, 2, 2, w - 4, h - 4, 8);
  ctx.fill();

  // Viền đồng cổ
  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 3, 3, w - 6, h - 6, 7);
  ctx.stroke();

  // Viền chỉ phụ bên trong
  ctx.strokeStyle = 'rgba(138, 98, 72, 0.4)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 6, 6, w - 12, h - 12, 5);
  ctx.stroke();

  // Vân tre / thớ giấy mờ
  ctx.fillStyle = 'rgba(198, 166, 107, 0.08)';
  for (let i = 12; i < h - 12; i += 7) {
    ctx.fillRect(8, i, w - 16, 1);
  }
}

function paintDiceFace(ctx: CanvasRenderingContext2D, size: number, value: number): void {
  // Thân xúc xắc: bo góc nhẹ, viền ngà pha đồng
  const pad = 3;
  const s = size - pad * 2;
  const r = 10;

  const grad = ctx.createLinearGradient(pad, pad, pad + s, pad + s);
  grad.addColorStop(0, '#fbf8ee');
  grad.addColorStop(0.7, '#ece3cf');
  grad.addColorStop(1, '#d5c4a7');
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, pad, pad, s, s, r);
  ctx.fill();

  ctx.strokeStyle = MINIGAME_PALETTE.brownBronze;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, pad, pad, s, s, r);
  ctx.stroke();

  // Chấm xúc xắc (Pip)
  const drawPip = (px: number, py: number, isRed = false, radius = 5.5) => {
    ctx.save();
    // Vòng bóng đổ nhẹ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(px + 0.8, py + 1.2, radius, 0, Math.PI * 2);
    ctx.fill();

    // Màu chính
    const dotGrad = ctx.createRadialGradient(px - 1, py - 1, 1, px, py, radius);
    if (isRed) {
      dotGrad.addColorStop(0, '#e64230');
      dotGrad.addColorStop(1, '#9e1f13');
    } else {
      dotGrad.addColorStop(0, '#2d4739');
      dotGrad.addColorStop(1, '#14271e');
    }
    ctx.fillStyle = dotGrad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    // Vành vàng kim viền chấm
    ctx.strokeStyle = isRed ? MINIGAME_PALETTE.goldBright : MINIGAME_PALETTE.goldBronze;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const c = size / 2;
  const l = size * 0.3;
  const rPos = size * 0.7;

  if (value === 1) {
    // Chấm đỏ lớn ở tâm kiểu truyền thống Á Đông
    drawPip(c, c, true, 8.5);
  } else if (value === 2) {
    drawPip(l, l, false);
    drawPip(rPos, rPos, false);
  } else if (value === 3) {
    drawPip(l, l, false);
    drawPip(c, c, false);
    drawPip(rPos, rPos, false);
  } else if (value === 4) {
    // Chấm 4 thường có màu son đỏ may mắn
    drawPip(l, l, true);
    drawPip(rPos, l, true);
    drawPip(l, rPos, true);
    drawPip(rPos, rPos, true);
  } else if (value === 5) {
    drawPip(l, l, false);
    drawPip(rPos, l, false);
    drawPip(c, c, true);
    drawPip(l, rPos, false);
    drawPip(rPos, rPos, false);
  } else if (value === 6) {
    const m = c;
    drawPip(l, l, false);
    drawPip(l, m, false);
    drawPip(l, rPos, false);
    drawPip(rPos, l, false);
    drawPip(rPos, m, false);
    drawPip(rPos, rPos, false);
  }
}

function paintDiceCup(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Bát lắc xúc xắc đồng Văn Lang úp ngược
  ctx.save();
  const cx = w / 2;
  const cy = h / 2;

  // Bóng đổ dưới bát
  ctx.fillStyle = 'rgba(10, 20, 18, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, h - 8, w * 0.42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân bát úp (vòm chuông đồng)
  const cupGrad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  cupGrad.addColorStop(0, '#5a3d24');
  cupGrad.addColorStop(0.3, '#c9a46a');
  cupGrad.addColorStop(0.5, '#edd9aa');
  cupGrad.addColorStop(0.7, '#a9804b');
  cupGrad.addColorStop(1, '#48301c');

  ctx.fillStyle = cupGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 36, h - 14);
  ctx.quadraticCurveTo(cx - 40, cy, cx - 22, 18);
  ctx.quadraticCurveTo(cx, 10, cx + 22, 18);
  ctx.quadraticCurveTo(cx + 40, cy, cx + 36, h - 14);
  ctx.closePath();
  ctx.fill();

  // Viền vàng kim thân bát
  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Núm tay cầm trên đỉnh bát
  ctx.fillStyle = MINIGAME_PALETTE.goldBright;
  ctx.beginPath();
  ctx.arc(cx, 13, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MINIGAME_PALETTE.brownDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Vành chân bát
  ctx.fillStyle = cupGrad;
  ctx.beginPath();
  ctx.ellipse(cx, h - 14, 38, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Dải hoa văn Đông Sơn giữa thân bát
  ctx.strokeStyle = MINIGAME_PALETTE.brownDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy + 4);
  ctx.lineTo(cx + 30, cy + 4);
  ctx.moveTo(cx - 28, cy + 12);
  ctx.lineTo(cx + 28, cy + 12);
  ctx.stroke();

  ctx.restore();
}

function paintDicePlate(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;

  // Đĩa đồng đặt xúc xắc
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, w * 0.46, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  const plateGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.45);
  plateGrad.addColorStop(0, '#2d443c');
  plateGrad.addColorStop(0.7, '#1b2f28');
  plateGrad.addColorStop(1, '#0e1d17');
  ctx.fillStyle = plateGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.45, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vành đĩa vàng đồng
  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Vòng chỉ phụ bên trong
  ctx.strokeStyle = MINIGAME_PALETTE.goldLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.36, h * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// 6 Linh vật
function paintAnimalBau(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Quả bầu hồ lô
  const cx = w / 2;
  const cy = h / 2;

  // Nền bầu vàng hổ phách
  const grad = ctx.createRadialGradient(cx - 4, cy - 2, 5, cx, cy, 26);
  grad.addColorStop(0, '#f9dc79');
  grad.addColorStop(0.6, '#df9b2d');
  grad.addColorStop(1, '#8f5711');

  ctx.fillStyle = grad;

  // Bầu dưới lớn
  ctx.beginPath();
  ctx.arc(cx, cy + 10, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MINIGAME_PALETTE.brownDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bầu trên nhỏ
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cuống bầu
  ctx.strokeStyle = '#436d40';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.quadraticCurveTo(cx + 4, cy - 29, cx + 8, cy - 26);
  ctx.stroke();

  // Nơ lụa son thắt eo hồ lô
  ctx.fillStyle = MINIGAME_PALETTE.redVermilion;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 1);
  ctx.lineTo(cx - 10, cy + 3);
  ctx.lineTo(cx - 4, cy + 3);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 1);
  ctx.lineTo(cx + 10, cy + 3);
  ctx.lineTo(cx + 4, cy + 3);
  ctx.closePath();
  ctx.fill();
}

function paintAnimalCua(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Cua đồng đỏ son
  const cx = w / 2;
  const cy = h / 2;

  // Mai cua
  const grad = ctx.createRadialGradient(cx, cy - 2, 4, cx, cy, 20);
  grad.addColorStop(0, '#ea5e4b');
  grad.addColorStop(0.7, '#be2918');
  grad.addColorStop(1, '#69150c');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 20, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#440e08';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2 Càng to
  ctx.fillStyle = '#be2918';
  // Càng trái
  ctx.beginPath();
  ctx.arc(cx - 19, cy - 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Kẹp trái
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 15);
  ctx.lineTo(cx - 20, cy - 22);
  ctx.lineTo(cx - 16, cy - 16);
  ctx.closePath();
  ctx.fill();

  // Càng phải
  ctx.beginPath();
  ctx.arc(cx + 19, cy - 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Kẹp phải
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy - 16);
  ctx.lineTo(cx + 20, cy - 22);
  ctx.lineTo(cx + 24, cy - 15);
  ctx.closePath();
  ctx.fill();

  // 2 Mắt tròn nổi
  ctx.fillStyle = MINIGAME_PALETTE.whiteIvory;
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 12, 3, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 12, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintAnimalCa(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Cá chép sông Hồng ngọc lam
  const cx = w / 2;
  const cy = h / 2;

  const grad = ctx.createLinearGradient(cx - 20, cy, cx + 20, cy);
  grad.addColorStop(0, '#53b4cf');
  grad.addColorStop(0.5, '#2e7c98');
  grad.addColorStop(1, '#134759');
  ctx.fillStyle = grad;

  // Thân cá uốn cong
  ctx.beginPath();
  ctx.moveTo(cx + 20, cy);
  ctx.quadraticCurveTo(cx, cy - 16, cx - 18, cy);
  ctx.quadraticCurveTo(cx, cy + 16, cx + 20, cy);
  ctx.fill();
  ctx.strokeStyle = MINIGAME_PALETTE.goldLight;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Đuôi cá rẽ quạt vàng kim
  ctx.fillStyle = '#e8be5b';
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy);
  ctx.lineTo(cx + 28, cy - 12);
  ctx.quadraticCurveTo(cx + 24, cy, cx + 28, cy + 12);
  ctx.closePath();
  ctx.fill();

  // Vây lưng
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 12);
  ctx.lineTo(cx + 8, cy - 18);
  ctx.lineTo(cx + 12, cy - 8);
  ctx.closePath();
  ctx.fill();

  // Mắt cá
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - 10, cy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx - 11, cy - 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintAnimalCop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Mãnh Hổ hoàng kim
  const cx = w / 2;
  const cy = h / 2;

  // Mặt hổ
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 22);
  grad.addColorStop(0, '#f9ba48');
  grad.addColorStop(0.7, '#d67e1a');
  grad.addColorStop(1, '#783c07');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#431e03';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2 Tai hổ
  ctx.fillStyle = '#d67e1a';
  ctx.beginPath();
  ctx.arc(cx - 14, cy - 14, 6, 0, Math.PI * 2);
  ctx.arc(cx + 14, cy - 14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Vằn trán chữ Vương (王) phong cách dũng mãnh
  ctx.strokeStyle = '#221104';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Ngang 1
  ctx.moveTo(cx - 8, cy - 10);
  ctx.lineTo(cx + 8, cy - 10);
  // Ngang 2
  ctx.moveTo(cx - 6, cy - 6);
  ctx.lineTo(cx + 6, cy - 6);
  // Ngang 3
  ctx.moveTo(cx - 7, cy - 2);
  ctx.lineTo(cx + 7, cy - 2);
  // Dọc giữa
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy - 1);
  ctx.stroke();

  // 2 Mắt hổ rực lửa
  ctx.fillStyle = '#ffea78';
  ctx.beginPath();
  ctx.arc(cx - 7, cy + 3, 3, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy + 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx - 7, cy + 3, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy + 3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Mũi & ria
  ctx.fillStyle = '#44140b';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 7);
  ctx.lineTo(cx - 3, cy + 10);
  ctx.lineTo(cx + 3, cy + 10);
  ctx.closePath();
  ctx.fill();
}

function paintAnimalGa(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Thần Kê oai vệ
  const cx = w / 2;
  const cy = h / 2;

  // Đầu & cổ gà
  const grad = ctx.createLinearGradient(cx - 15, cy, cx + 15, cy);
  grad.addColorStop(0, '#f9b543');
  grad.addColorStop(0.6, '#d8581e');
  grad.addColorStop(1, '#9b2410');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(cx - 3, cy + 4, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4e140a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Mào gà đỏ chót vươn cao
  ctx.fillStyle = '#d22316';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 13, 6, 0, Math.PI * 2);
  ctx.arc(cx, cy - 16, 7, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy - 13, 5, 0, Math.PI * 2);
  ctx.fill();

  // Mỏ gà vàng nhọn
  ctx.fillStyle = '#f6c944';
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 22, cy + 4);
  ctx.lineTo(cx + 10, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#684507';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Yếm gà đỏ
  ctx.fillStyle = '#d22316';
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + 12, 4, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Mắt gà tinh anh
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + 3, cy + 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx + 4, cy + 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintAnimalNai(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Hươu sao trường thọ
  const cx = w / 2;
  const cy = h / 2;

  // Đầu nai
  const grad = ctx.createLinearGradient(cx, cy - 10, cx, cy + 18);
  grad.addColorStop(0, '#b88258');
  grad.addColorStop(0.7, '#885632');
  grad.addColorStop(1, '#502e16');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(cx, cy + 18);
  ctx.lineTo(cx - 12, cy - 2);
  ctx.quadraticCurveTo(cx - 10, cy - 14, cx, cy - 14);
  ctx.quadraticCurveTo(cx + 10, cy - 14, cx + 12, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#321b0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gạc hươu thanh thoát
  ctx.strokeStyle = '#edd3ab';
  ctx.lineWidth = 2.5;
  // Gạc trái
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 13);
  ctx.lineTo(cx - 16, cy - 24);
  ctx.moveTo(cx - 12, cy - 18);
  ctx.lineTo(cx - 8, cy - 23);
  ctx.stroke();
  // Gạc phải
  ctx.beginPath();
  ctx.moveTo(cx + 7, cy - 13);
  ctx.lineTo(cx + 16, cy - 24);
  ctx.moveTo(cx + 12, cy - 18);
  ctx.lineTo(cx + 8, cy - 23);
  ctx.stroke();

  // Đốm sao trắng ngà
  ctx.fillStyle = '#f8ecd5';
  ctx.beginPath();
  ctx.arc(cx - 4, cy + 2, 2, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy + 5, 2, 0, Math.PI * 2);
  ctx.arc(cx - 2, cy + 9, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // 2 Mắt nai hiền từ
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx - 7, cy - 1, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy - 1, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintSymbolSlot(ctx: CanvasRenderingContext2D, size: number, selected: boolean): void {
  const pad = 2;
  const s = size - pad * 2;
  const r = 10;

  if (selected) {
    // Vầng sáng hoàng kim rực rỡ
    ctx.shadowColor = '#f3c66f';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#2d453b';
    drawRoundedRect(ctx, pad, pad, s, s, r);
    ctx.fill();

    ctx.strokeStyle = '#f3c66f';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, pad, pad, s, s, r);
    ctx.stroke();

    // Viền sáng kép bên trong
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, pad + 3, pad + 3, s - 6, s - 6, r - 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#1c2b27';
    drawRoundedRect(ctx, pad, pad, s, s, r);
    ctx.fill();

    ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, pad, pad, s, s, r);
    ctx.stroke();
  }
}

// 3 NPC Portraits
function paintNpcPortrait(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: 'thay_the' | 'lao_dong' | 'nang_hoa'
): void {
  // Nền tròn đồng
  const cx = w / 2;
  const cy = h / 2;
  const rad = Math.min(w, h) / 2 - 3;

  ctx.fillStyle = '#182b25';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = MINIGAME_PALETTE.goldBronze;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (type === 'thay_the') {
    // Thầy Thẻ Lạc: Khăn đóng, áo chàm cổ, tay cầm thẻ bài
    ctx.fillStyle = '#3a584c';
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 16, 0, Math.PI * 2); // Thân áo
    ctx.fill();

    ctx.fillStyle = '#f3dbb7';
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 12, 0, Math.PI * 2); // Khuôn mặt
    ctx.fill();

    // Khăn đóng tối
    ctx.fillStyle = '#1c2420';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 14, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thẻ bài cầm tay
    ctx.fillStyle = MINIGAME_PALETTE.goldLight;
    ctx.fillRect(cx + 8, cy - 4, 8, 14);
    ctx.strokeStyle = MINIGAME_PALETTE.brownDark;
    ctx.strokeRect(cx + 8, cy - 4, 8, 14);
  } else if (type === 'lao_dong') {
    // Lão Đồng Xúc: Râu tóc hoa râm, cười đôn hậu
    ctx.fillStyle = '#65442e';
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ecd1af';
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 12, 0, Math.PI * 2);
    ctx.fill();

    // Râu dài bạc
    ctx.fillStyle = '#e8ebed';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 1);
    ctx.lineTo(cx, cy + 14);
    ctx.lineTo(cx + 8, cy + 1);
    ctx.closePath();
    ctx.fill();

    // Khăn quấn đầu
    ctx.fillStyle = '#8f6848';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 13, 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Nàng Họa Linh: Nữ nghệ nhân búi tóc cài trâm ngọc, tay cầm cọ vẽ
    ctx.fillStyle = '#2a5b6c';
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fae1c3';
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 11, 0, Math.PI * 2);
    ctx.fill();

    // Tóc đen búi cao
    ctx.fillStyle = '#181a1c';
    ctx.beginPath();
    ctx.arc(cx, cy - 16, 7, 0, Math.PI * 2);
    ctx.fill();

    // Trâm cài ngọc đỏ
    ctx.strokeStyle = MINIGAME_PALETTE.goldBright;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 16);
    ctx.lineTo(cx + 10, cy - 16);
    ctx.stroke();
    ctx.fillStyle = '#df3525';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 16, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 4 Suits
function paintSuitSpades(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.fillStyle = '#1c2a26';
  ctx.beginPath();
  ctx.moveTo(c, 3);
  ctx.bezierCurveTo(c + 10, 10, c + 14, 18, c + 7, 22);
  ctx.bezierCurveTo(c + 2, 23, c + 1, 20, c, 18);
  ctx.bezierCurveTo(c - 1, 20, c - 2, 23, c - 7, 22);
  ctx.bezierCurveTo(c - 14, 18, c - 10, 10, c, 3);
  ctx.fill();

  // Chân giáo bích
  ctx.beginPath();
  ctx.moveTo(c - 2, 18);
  ctx.lineTo(c - 5, 27);
  ctx.lineTo(c + 5, 27);
  ctx.lineTo(c + 2, 18);
  ctx.closePath();
  ctx.fill();
}

function paintSuitHearts(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.fillStyle = MINIGAME_PALETTE.redVermilion;
  ctx.beginPath();
  ctx.moveTo(c, 9);
  ctx.bezierCurveTo(c, 3, c - 12, 3, c - 12, 11);
  ctx.bezierCurveTo(c - 12, 18, c - 4, 23, c, 27);
  ctx.bezierCurveTo(c + 4, 23, c + 12, 18, c + 12, 11);
  ctx.bezierCurveTo(c + 12, 3, c, 3, c, 9);
  ctx.fill();
}

function paintSuitDiamonds(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.fillStyle = MINIGAME_PALETTE.redVermilion;
  ctx.beginPath();
  ctx.moveTo(c, 3);
  ctx.lineTo(c + 11, c);
  ctx.lineTo(c, size - 3);
  ctx.lineTo(c - 11, c);
  ctx.closePath();
  ctx.fill();
}

function paintSuitClubs(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.fillStyle = '#1c2a26';
  // 3 cánh tròn lá trúc
  ctx.beginPath();
  ctx.arc(c, 9, 6, 0, Math.PI * 2);
  ctx.arc(c - 6, 17, 6, 0, Math.PI * 2);
  ctx.arc(c + 6, 17, 6, 0, Math.PI * 2);
  ctx.fill();

  // Thân cuống
  ctx.beginPath();
  ctx.moveTo(c - 2, 17);
  ctx.lineTo(c - 5, 27);
  ctx.lineTo(c + 5, 27);
  ctx.lineTo(c + 2, 17);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// MAIN ENTRY: ensureMinigameTextures
// ============================================================================

/**
 * Nạp toàn bộ procedural canvas textures phục vụ 3 minigames.
 * An toàn, idempotent, kiểm tra cache trước khi sinh.
 */
export function ensureMinigameTextures(scene: Phaser.Scene): void {
  if (!scene) return;

  // 1. Thẻ bài 7321 (Front & Back)
  const back = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.cardBack, 72, 100);
  if (back) {
    paintCardBack(back.ctx, 72, 100);
    back.refresh();
  }

  const front = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.cardFront, 72, 100);
  if (front) {
    paintCardFront(front.ctx, 72, 100);
    front.refresh();
  }

  // 4 Chất bài
  const spades = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.suitSpades, 32, 32);
  if (spades) {
    paintSuitSpades(spades.ctx, 32);
    spades.refresh();
  }

  const hearts = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.suitHearts, 32, 32);
  if (hearts) {
    paintSuitHearts(hearts.ctx, 32);
    hearts.refresh();
  }

  const diamonds = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.suitDiamonds, 32, 32);
  if (diamonds) {
    paintSuitDiamonds(diamonds.ctx, 32);
    diamonds.refresh();
  }

  const clubs = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.suitClubs, 32, 32);
  if (clubs) {
    paintSuitClubs(clubs.ctx, 32);
    clubs.refresh();
  }

  // 2. Xúc xắc 1..6
  const diceKeys = [
    MINIGAME_TEXTURE_KEYS.dice1,
    MINIGAME_TEXTURE_KEYS.dice2,
    MINIGAME_TEXTURE_KEYS.dice3,
    MINIGAME_TEXTURE_KEYS.dice4,
    MINIGAME_TEXTURE_KEYS.dice5,
    MINIGAME_TEXTURE_KEYS.dice6,
  ];
  for (let i = 0; i < 6; i++) {
    const dice = createOrGetCanvas(scene, diceKeys[i], 64, 64);
    if (dice) {
      paintDiceFace(dice.ctx, 64, i + 1);
      dice.refresh();
    }
  }

  // Bát lắc & Đĩa xúc xắc
  const cup = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.diceCup, 96, 96);
  if (cup) {
    paintDiceCup(cup.ctx, 96, 96);
    cup.refresh();
  }

  const plate = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.dicePlate, 128, 80);
  if (plate) {
    paintDicePlate(plate.ctx, 128, 80);
    plate.refresh();
  }

  // 3. Sáu Linh Vật
  const animals = [
    { key: MINIGAME_TEXTURE_KEYS.animalBau, painter: paintAnimalBau },
    { key: MINIGAME_TEXTURE_KEYS.animalCua, painter: paintAnimalCua },
    { key: MINIGAME_TEXTURE_KEYS.animalCa, painter: paintAnimalCa },
    { key: MINIGAME_TEXTURE_KEYS.animalCop, painter: paintAnimalCop },
    { key: MINIGAME_TEXTURE_KEYS.animalGa, painter: paintAnimalGa },
    { key: MINIGAME_TEXTURE_KEYS.animalNai, painter: paintAnimalNai },
  ];
  for (const { key, painter } of animals) {
    const slot = createOrGetCanvas(scene, key, 72, 72);
    if (slot) {
      painter(slot.ctx, 72, 72);
      slot.refresh();
    }
  }

  // Khung ô linh vật (Normal & Selected)
  const normSlot = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.symbolSlot, 84, 84);
  if (normSlot) {
    paintSymbolSlot(normSlot.ctx, 84, false);
    normSlot.refresh();
  }

  const selSlot = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.symbolSlotSelected, 84, 84);
  if (selSlot) {
    paintSymbolSlot(selSlot.ctx, 84, true);
    selSlot.refresh();
  }

  // 4. Ba Chân dung NPC
  const npcThay = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.npcThayTheLac, 64, 64);
  if (npcThay) {
    paintNpcPortrait(npcThay.ctx, 64, 64, 'thay_the');
    npcThay.refresh();
  }

  const npcLao = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.npcLaoDongXuc, 64, 64);
  if (npcLao) {
    paintNpcPortrait(npcLao.ctx, 64, 64, 'lao_dong');
    npcLao.refresh();
  }

  const npcNang = createOrGetCanvas(scene, MINIGAME_TEXTURE_KEYS.npcNangHoaLinh, 64, 64);
  if (npcNang) {
    paintNpcPortrait(npcNang.ctx, 64, 64, 'nang_hoa');
    npcNang.refresh();
  }
}
