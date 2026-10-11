import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Simple CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcTarget = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcTarget);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, getPixel) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced

  // Raw scanlines with filter byte 0x00 at start of each line
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

// --- 1. HERO SPRITESHEET (192 x 48, 4 frames of 48x48) ---
// Colors:
const cSkin = [216, 171, 122, 255];
const cLoin = [158, 56, 43, 255];
const cBronze = [212, 175, 55, 255];
const cShaft = [90, 61, 36, 255];
const cHair = [30, 24, 20, 255];
const cGold = [246, 211, 101, 255];
const cDark = [40, 30, 25, 255];

const heroPng = createPng(192, 48, (x, y) => {
  const frame = Math.floor(x / 48);
  const fx = x % 48;
  const fy = y;

  const bob = (frame === 1) ? -1 : (frame === 2 ? 1 : 0);
  const cy = fy - bob;

  // Head (around fx=24, cy=14, radius 6)
  const dHead = Math.hypot(fx - 24, cy - 14);
  if (dHead <= 6) {
    if (cy <= 10) return cHair; // Top hair
    if (cy === 13 && (fx === 22 || fx === 26)) return cDark; // Eyes
    return cSkin;
  }
  // Feather headband (cy=8 to 11)
  if (fx >= 22 && fx <= 26 && cy >= 4 && cy <= 10) return cGold;
  if (Math.abs(fx - 24) <= 7 && cy === 10) return cBronze;

  // Torso (fx 18-30, cy 20-32)
  if (fx >= 19 && fx <= 29 && cy >= 20 && cy <= 32) {
    if (cy >= 27) return cLoin; // Woven loincloth
    // Bronze chest medallion
    if (Math.hypot(fx - 24, cy - 23) <= 3) return cBronze;
    return cSkin;
  }

  // Arms & Legs
  if (cy >= 33 && cy <= 42) {
    // Legs
    const legL = (frame === 1) ? 20 : (frame === 2 ? 18 : 20);
    const legR = (frame === 1) ? 28 : (frame === 2 ? 26 : 28);
    if ((fx >= legL - 2 && fx <= legL + 1) || (fx >= legR - 1 && fx <= legR + 2)) {
      if (cy >= 40) return cBronze; // Greaves
      return cSkin;
    }
  }

  // Spear
  if (frame === 3) {
    // Thrust forward
    if (cy >= 22 && cy <= 24 && fx >= 14 && fx <= 44) {
      if (fx >= 38) return cGold; // Glowing spear head
      return cShaft;
    }
  } else {
    // Held upright
    if (fx === 33 && cy >= 6 && cy <= 42) {
      if (cy <= 12) return cGold; // Spear head
      return cShaft;
    }
  }

  return [0, 0, 0, 0];
});

fs.writeFileSync(path.join(outDir, 'hero.png'), heroPng);
console.log('✓ Created public/assets/sprites/hero.png');

// --- 2. MỘC TINH SPRITESHEET (192 x 48, 4 frames of 48x48) ---
const cBark = [73, 99, 56, 255];
const cBarkDark = [37, 54, 27, 255];
const cMossEye = [114, 242, 109, 255];
const cThorn = [48, 71, 35, 255];

const moctinhPng = createPng(192, 48, (x, y) => {
  const frame = Math.floor(x / 48);
  const fx = x % 48;
  const fy = y;
  const sway = (frame === 1) ? -1 : (frame === 2 ? 1 : 0);

  // Main gnarly tree trunk (fx 16-32, fy 12-42)
  if (fx >= 17 + sway && fx <= 31 + sway && fy >= 14 && fy <= 42) {
    // Eyes
    if ((fy === 22 || fy === 23) && (fx === 21 + sway || fx === 27 + sway)) return cMossEye;
    // Bark texture lines
    if ((fx + fy) % 5 === 0) return cBarkDark;
    return cBark;
  }
  // Thorny branch arms
  if (fy >= 20 && fy <= 26) {
    if (frame === 3) {
      // Claw strike
      if ((fx >= 6 && fx <= 17) || (fx >= 31 && fx <= 44)) return cThorn;
    } else {
      if ((fx >= 10 && fx <= 17) || (fx >= 31 && fx <= 38)) return cThorn;
    }
  }
  // Foliage crown (fy 6-14, fx 18-30)
  if (Math.hypot(fx - (24 + sway), fy - 12) <= 8) return [44, 74, 37, 255];

  return [0, 0, 0, 0];
});

fs.writeFileSync(path.join(outDir, 'moctinh.png'), moctinhPng);
console.log('✓ Created public/assets/sprites/moctinh.png');

// --- 3. MA TRƠI SPRITESHEET (128 x 32, 4 frames of 32x32) ---
const matroiPng = createPng(128, 32, (x, y) => {
  const frame = Math.floor(x / 32);
  const fx = x % 32;
  const fy = y;

  const floatY = 16 + Math.round(Math.sin((frame / 4) * Math.PI * 2) * 2);
  const d = Math.hypot(fx - 16, fy - floatY);

  if (d <= 3) return [255, 255, 255, 255]; // Pure bright core
  if (d <= 6) return [97, 243, 229, 230]; // Jade cyan inner flame
  if (d <= 10) return [40, 150, 140, 140]; // Outer ghostly aura
  // Wispy flame tail upwards
  if (fx >= 14 && fx <= 18 && fy < floatY && fy >= floatY - 9) {
    return [60, 200, 180, 160];
  }

  return [0, 0, 0, 0];
});

fs.writeFileSync(path.join(outDir, 'matroi.png'), matroiPng);
console.log('✓ Created public/assets/sprites/matroi.png');

// --- 4. HỔ YÊU U MINH SPRITESHEET (384 x 96, 4 frames of 96x96) ---
const cTiger = [212, 135, 55, 255];
const cTigerDark = [42, 20, 7, 255];
const cTigerEye = [255, 59, 48, 255];
const cTigerArmor = [212, 175, 55, 255];

const hoyeuPng = createPng(384, 96, (x, y) => {
  const frame = Math.floor(x / 96);
  const fx = x % 96;
  const fy = y;

  const pounceX = (frame === 3) ? 6 : 0;
  // Body (ellipse around fx=44+pounceX, fy=52, rx=24, ry=16)
  const dx = (fx - (44 + pounceX)) / 24;
  const dy = (fy - 52) / 16;
  if (dx * dx + dy * dy <= 1) {
    // Stripes
    if (Math.floor((fx + fy * 0.5) / 5) % 2 === 0) return cTigerDark;
    // Bronze armor plate on shoulder
    if (fx >= 34 + pounceX && fx <= 48 + pounceX && fy >= 42 && fy <= 50) return cTigerArmor;
    return cTiger;
  }

  // Head (around fx=68+pounceX, fy=42, radius 13)
  const dHead = Math.hypot(fx - (68 + pounceX), fy - 42);
  if (dHead <= 13) {
    if (fx >= 72 + pounceX && fy >= 39 && fy <= 42) return cTigerEye; // Red glowing eyes
    if (fy >= 47 && fx >= 68 + pounceX && fx <= 74 + pounceX) return [240, 240, 240, 255]; // Fangs
    return cTiger;
  }

  // Ears
  if (fy >= 24 && fy <= 32 && (fx === 64 + pounceX || fx === 72 + pounceX)) return [138, 75, 20, 255];

  // Paws & Legs
  if (fy >= 64 && fy <= 78) {
    const leg1 = 30 + pounceX;
    const leg2 = 56 + pounceX;
    if ((fx >= leg1 - 4 && fx <= leg1 + 4) || (fx >= leg2 - 4 && fx <= leg2 + 4)) {
      if (fy >= 74) return [240, 240, 240, 255]; // Sharp white claws
      return cTiger;
    }
  }

  // Tail waving up
  const tailBaseX = 22 + pounceX;
  const tailY = 50 - (fx - tailBaseX);
  if (fx >= tailBaseX - 14 && fx <= tailBaseX && Math.abs(fy - (tailY + 10)) <= 3) {
    return cTigerDark;
  }

  return [0, 0, 0, 0];
});

fs.writeFileSync(path.join(outDir, 'hoyer.png'), hoyeuPng);
console.log('✓ Created public/assets/sprites/hoyer.png');
console.log('All sprite assets generated successfully!');
