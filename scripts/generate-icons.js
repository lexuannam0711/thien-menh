import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/icons');
const palette = {
  ink: '#172a2b', dark: '#352c2c', bronze: '#cba968', gold: '#e9c36b', cream: '#e8d8b4',
  green: '#497459', moss: '#81995d', jade: '#203b34', teal: '#315e55', blue: '#5cb9d5',
  purple: '#654a88', stone: '#87918b', rock: '#39464a', red: '#684a39', fire: '#f28b45',
};
function canonical(filename, name) {
  const result = {};
  new Function('exports', ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(result);
  return result[name].map(entry => entry.id);
}
function canvas() {
  const pixels = Buffer.alloc(32 * 32 * 4);
  function pixel(column, row, color) {
    if (column < 2 || row < 2 || column >= 30 || row >= 30) throw new Error('Icon gutter exceeded');
    const offset = (row * 32 + column) * 4;
    pixels[offset] = parseInt(palette[color].slice(1, 3), 16);
    pixels[offset + 1] = parseInt(palette[color].slice(3, 5), 16);
    pixels[offset + 2] = parseInt(palette[color].slice(5, 7), 16);
    pixels[offset + 3] = 255;
  }
  function shape(predicate, color, outline = true) {
    const points = [];
    for (let row = 3; row < 29; row++) for (let column = 3; column < 29; column++) {
      if (predicate(column, row)) points.push([column, row]);
    }
    if (outline) for (const [column, row] of points) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) pixel(column + dx, row + dy, 'ink');
    }
    for (const [column, row] of points) pixel(column, row, color);
  }
  function polygon(points, color, outline = true) {
    shape((column, row) => {
      let inside = false;
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const [currentX, currentY] = points[index], [previousX, previousY] = points[previous];
        if ((currentY > row) !== (previousY > row)
          && column < (previousX - currentX) * (row - currentY) / (previousY - currentY) + currentX) inside = !inside;
      }
      return inside;
    }, color, outline);
  }
  function ellipse(centerX, centerY, radiusX, radiusY, color, outline = true) {
    shape((column, row) => ((column - centerX) / radiusX) ** 2 + ((row - centerY) / radiusY) ** 2 <= 1, color, outline);
  }
  function line(startX, startY, endX, endY, color, thickness = 1) {
    const length = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
    for (let step = 0; step <= length; step++) {
      const column = Math.round(startX + (endX - startX) * step / (length || 1));
      const row = Math.round(startY + (endY - startY) * step / (length || 1));
      for (let dx = 0; dx < thickness; dx++) for (let dy = 0; dy < thickness; dy++) pixel(column + dx, row + dy, color);
    }
  }
  function rect(left, top, width, height, color, outline = true) {
    shape((column, row) => column >= left && column < left + width && row >= top && row < top + height, color, outline);
  }
  return { pixels, pixel, polygon, ellipse, line, rect };
}
const designs = {
  'herbal-balm': art => {
    art.polygon([[9,14],[21,14],[24,19],[23,26],[8,26],[7,20]], 'bronze');
    art.rect(10,12,11,3,'red'); art.rect(11,19,9,5,'cream',false);
    art.line(16,22,16,7,'green',2);
    art.polygon([[16,12],[9,9],[10,5],[14,7]],'moss');
    art.polygon([[17,10],[20,4],[25,5],[23,9]],'green');
    art.line(10,18,10,24,'gold'); art.pixel(18,21,'green');
  },
  'spirit-tea': art => {
    art.ellipse(15,25,9,2,'bronze');
    art.ellipse(24,18,4,4,'gold'); art.ellipse(24,18,2,2,'ink',false);
    art.polygon([[6,15],[23,15],[21,24],[10,24]],'cream');
    art.ellipse(14,15,8,2,'teal'); art.line(9,19,19,19,'bronze');
    art.line(13,5,11,8,'blue'); art.line(11,8,14,11,'blue');
    art.line(19,4,17,7,'moss'); art.line(17,7,19,10,'moss');
    art.pixel(10,21,'gold'); art.pixel(19,21,'gold');
  },
  'bronze-spear': art => {
    art.line(7,26,21,11,'ink',3); art.line(8,26,22,11,'red');
    art.polygon([[19,13],[19,8],[27,3],[26,11],[22,15]],'bronze');
    art.line(21,11,26,5,'gold'); art.line(19,13,23,14,'cream');
    art.line(15,18,18,20,'gold'); art.line(9,24,11,25,'bronze');
    art.polygon([[19,14],[24,17],[25,21],[20,18]],'red');
  },
  'battle-axe': art => {
    art.line(9,26,19,7,'ink',3); art.line(10,26,20,7,'red',2);
    art.polygon([[14,8],[21,5],[26,7],[28,15],[24,18],[18,15],[13,13]],'bronze');
    art.polygon([[24,7],[26,8],[27,14],[24,17],[23,15]],'cream',false);
    art.line(15,10,21,8,'gold'); art.line(17,12,21,13,'teal');
    art.line(10,24,13,24,'gold'); art.pixel(20,10,'gold');
  },
  'lac-sword': art => {
    art.polygon([[10,22],[11,17],[24,4],[27,4],[27,8],[15,21]],'bronze');
    art.line(13,18,25,6,'cream'); art.line(16,18,25,9,'teal');
    art.line(8,19,17,26,'ink',2); art.line(8,19,17,26,'gold');
    art.line(7,26,12,21,'ink',3); art.line(8,26,13,21,'red');
    art.ellipse(7,27,2,1,'gold');
  },
  'bamboo-armor': art => {
    art.polygon([[8,6],[12,6],[13,10],[19,10],[20,6],[24,6],[27,13],[23,16],[23,27],[9,27],[9,16],[5,13]],'red');
    art.rect(10,12,12,13,'green',false);
    for (const column of [11,14,17,20]) art.line(column,12,column,24,'moss');
    for (const row of [15,20,24]) art.line(10,row,21,row,'bronze');
    art.line(7,10,10,11,'gold'); art.line(23,10,25,11,'gold');
    art.rect(14,25,4,2,'gold',false);
  },
  'jade-charm': art => {
    art.line(15,4,11,9,'red',2); art.line(16,4,21,11,'red');
    art.ellipse(16,17,8,9,'green'); art.ellipse(16,17,5,6,'moss',false);
    art.ellipse(16,17,2,3,'ink',false); art.line(12,12,15,10,'cream');
    art.line(17,23,22,21,'teal'); art.line(15,27,12,28,'bronze');
    art.line(17,27,20,28,'bronze'); art.pixel(22,16,'gold');
  },
  'spirit-stone': art => {
    art.polygon([[9,25],[6,17],[12,5],[21,8],[26,19],[20,26]],'purple');
    art.polygon([[12,6],[16,15],[7,17]],'blue',false);
    art.polygon([[16,15],[21,9],[25,19],[20,24]],'teal',false);
    art.line(12,7,15,13,'cream'); art.line(15,15,11,23,'stone');
    art.line(24,5,24,9,'gold'); art.line(22,7,26,7,'gold');
  },
  'bronze-scrap': art => {
    art.polygon([[5,13],[9,7],[16,10],[15,19],[8,20]],'bronze');
    art.polygon([[17,16],[24,11],[28,17],[25,25],[17,26],[15,22]],'bronze');
    art.line(8,10,12,11,'gold'); art.line(7,15,12,17,'teal');
    art.line(19,18,24,15,'gold'); art.line(21,23,24,22,'teal');
    art.polygon([[18,6],[22,4],[23,8],[20,10]],'gold');
  },
  'earth-shockwave': art => {
    art.polygon([[5,17],[8,26],[24,26],[27,17]],'bronze');
    art.line(10,21,22,21,'red'); art.ellipse(16,15,11,6,'gold');
    art.ellipse(16,15,8,4,'red',false); art.ellipse(16,15,5,3,'bronze',false);
    art.line(12,15,20,15,'cream'); art.line(16,12,16,18,'cream');
    art.line(5,7,9,10,'stone',2); art.line(26,6,23,10,'stone',2);
    art.line(14,4,16,7,'rock',2); art.pixel(7,24,'gold'); art.pixel(24,24,'gold');
  },
  'stone-armor': art => {
    art.polygon([[7,6],[13,4],[16,7],[20,4],[25,7],[27,18],[22,25],[16,28],[9,24],[5,17]],'rock');
    art.polygon([[8,8],[14,7],[14,16],[8,17]],'stone',false);
    art.polygon([[18,8],[24,9],[24,17],[18,16]],'stone',false);
    art.polygon([[10,20],[15,18],[21,20],[16,26]],'bronze',false);
    art.line(9,9,12,8,'cream'); art.line(20,9,23,10,'cream');
    art.line(16,9,16,21,'ink'); art.pixel(16,24,'gold');
  },
  'mountain-cleave': art => {
    art.polygon([[4,26],[9,12],[13,6],[16,16],[19,8],[28,26]],'rock');
    art.polygon([[7,23],[13,8],[14,16],[11,23]],'stone',false);
    art.polygon([[20,10],[25,23],[19,21]],'stone',false);
    art.polygon([[16,9],[14,19],[18,20],[14,27],[20,19],[17,17],[19,9]],'gold');
    art.line(6,25,10,25,'bronze'); art.line(23,25,26,25,'bronze');
    art.line(11,12,12,10,'cream');
  },
  'flame-beam': art => {
    art.polygon([[6,26],[7,20],[12,18],[15,8],[18,13],[26,3],[25,13],[21,16],[24,19],[15,22],[12,27]],'red');
    art.polygon([[8,24],[14,19],[17,13],[18,17],[24,8],[20,19],[14,21],[11,25]],'fire',false);
    art.line(10,23,22,11,'gold',2); art.line(11,23,18,16,'cream');
    art.pixel(5,15,'fire'); art.pixel(26,23,'gold'); art.pixel(21,5,'fire');
  },
  'blazing-dash': art => {
    art.polygon([[13,5],[21,5],[20,15],[26,21],[27,25],[15,25],[11,20],[13,15]],'red');
    art.polygon([[14,7],[19,7],[18,16],[23,21],[17,21],[14,18]],'bronze',false);
    art.line(16,9,18,9,'gold'); art.line(16,12,18,12,'gold');
    art.line(16,23,25,23,'fire');
    art.polygon([[4,13],[11,12],[9,16],[5,16]],'fire');
    art.line(4,21,9,21,'gold',2); art.line(7,7,10,7,'cream');
  },
  'sun-burst': art => {
    for (let ray = 0; ray < 12; ray++) {
      const angle = ray * Math.PI / 6;
      art.line(Math.round(16 + Math.cos(angle) * 9), Math.round(16 + Math.sin(angle) * 9),
        Math.round(16 + Math.cos(angle) * 12), Math.round(16 + Math.sin(angle) * 12), 'bronze');
    }
    art.ellipse(16,16,8,8,'red'); art.ellipse(16,16,6,6,'fire',false);
    art.polygon([[16,10],[18,14],[22,16],[18,18],[16,22],[14,18],[10,16],[14,14]],'gold',false);
    art.ellipse(16,16,2,2,'cream',false);
  },
  'tidal-surge': art => {
    art.polygon([[4,25],[4,18],[9,12],[14,8],[21,6],[26,9],[27,14],[22,16],[18,14],[21,12],[16,13],[13,18],[19,21],[28,22],[27,26]],'teal');
    art.polygon([[5,24],[9,16],[16,10],[22,8],[25,10],[20,10],[13,16],[11,21],[22,24]],'blue',false);
    art.line(17,9,22,8,'cream',2); art.line(6,24,11,23,'cream');
    art.line(16,25,25,25,'blue'); art.pixel(26,18,'blue');
  },
  'dragon-vortex': art => {
    art.polygon([[8,8],[17,4],[23,8],[27,6],[25,13],[21,15],[19,11],[13,10],[9,14],[10,21],[17,24],[23,20],[22,16],[27,18],[26,25],[18,28],[8,25],[4,18]],'teal');
    art.line(7,17,9,23,'blue',2); art.line(11,25,19,26,'blue');
    art.line(11,8,17,6,'blue',2); art.line(19,8,23,10,'blue');
    art.polygon([[18,5],[18,3],[21,4],[22,8]],'bronze');
    art.pixel(22,10,'cream'); art.pixel(23,10,'red');
    art.line(24,13,28,14,'gold'); art.line(24,12,27,11,'cream');
    art.line(13,12,16,14,'bronze'); art.line(15,23,18,21,'bronze');
  },
  'sacred-spring': art => {
    art.ellipse(16,25,12,3,'teal'); art.ellipse(16,25,8,1,'blue',false);
    art.polygon([[16,4],[22,13],[21,18],[16,21],[11,18],[10,13]],'blue');
    art.line(13,13,15,8,'cream'); art.line(15,18,18,18,'teal');
    art.polygon([[6,23],[7,18],[12,22],[16,23],[20,21],[25,18],[26,23],[22,26],[10,26]],'moss');
    art.line(9,23,13,24,'gold'); art.line(20,24,23,22,'green');
  },
  'spear-thrust': art => {
    art.polygon([[4,23],[19,11],[19,8],[28,4],[25,13],[22,13],[7,27]],'bronze');
    art.line(7,24,25,7,'gold'); art.line(9,23,18,15,'red');
    art.polygon([[3,11],[12,11],[12,9],[17,13],[12,17],[12,15],[4,15]],'stone');
    art.line(5,12,11,12,'cream'); art.line(20,22,26,17,'blue',2);
    art.pixel(25,20,'cream');
  },
  'axe-whirlwind': art => {
    art.polygon([[5,10],[9,5],[19,3],[25,6],[28,11],[26,14],[24,9],[18,6],[10,7]],'stone');
    art.polygon([[4,20],[6,24],[15,28],[23,26],[27,22],[26,19],[22,24],[14,25],[7,22]],'teal');
    art.line(9,23,18,10,'ink',3); art.line(10,23,19,10,'red');
    art.polygon([[12,12],[18,8],[23,10],[24,17],[20,20],[16,17],[12,16]],'bronze');
    art.line(22,11,23,16,'cream'); art.line(14,13,18,11,'gold');
    art.line(9,6,16,4,'blue'); art.line(17,26,23,24,'blue');
  },
  'lac-blade-dance': art => {
    art.polygon([[5,8],[14,4],[24,7],[27,11],[24,12],[21,9],[14,7],[8,10]],'blue');
    art.polygon([[4,22],[10,27],[20,28],[26,22],[24,20],[19,25],[11,24],[6,20]],'teal');
    art.polygon([[10,23],[12,17],[24,6],[25,11],[16,21]],'bronze');
    art.line(13,18,23,9,'cream'); art.line(9,19,17,25,'gold',2);
    art.line(9,26,13,22,'red',2); art.line(5,16,9,14,'gold');
    art.line(26,15,28,17,'cream'); art.pixel(22,26,'gold');
  },
};
const items = canonical('src/data/items.ts', 'ITEMS');
const skills = canonical('src/data/skills.ts', 'SKILLS');
const ids = [...items, ...skills];
if (new Set(ids).size !== ids.length || Object.keys(designs).length !== ids.length
  || ids.some(id => !Object.hasOwn(designs, id))) throw new Error('Canonical icon designs must match items and skills exactly');
const columns = Math.ceil(Math.sqrt(ids.length));
const width = columns * 32, height = Math.ceil(ids.length / columns) * 32;
if (width > 2048 || height > 2048) throw new Error('Icon atlas exceeds 2048');
const pixels = Buffer.alloc(width * height * 4);
for (const [frame, id] of ids.entries()) {
  const art = canvas(); designs[id](art);
  for (let row = 0; row < 32; row++) art.pixels.copy(pixels,
    ((Math.floor(frame / columns) * 32 + row) * width + (frame % columns) * 32) * 4, row * 128, (row + 1) * 128);
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
const scanlines = Buffer.alloc(height * (width * 4 + 1));
for (let row = 0; row < height; row++) pixels.copy(scanlines, row * (width * 4 + 1) + 1, row * width * 4, (row + 1) * width * 4);
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const frameMap = (values, start) => values.map((id, index) => '  ' + JSON.stringify(id) + ': ' + (start + index) + ',').join('\n');
const metadata = [
  "import type Phaser from 'phaser';", '',
  "export const ICON_TEXTURE_KEY = 'rpg-icons';", 'export const ICON_FRAME_SIZE = 32;',
  'export const ICON_FRAME_COUNT = ' + ids.length + ';', '',
  'export const ITEM_ICON_FRAMES: Readonly<Record<string, number | undefined>> = Object.freeze({', frameMap(items, 0), '} as const);', '',
  'export const SKILL_ICON_FRAMES: Readonly<Record<string, number | undefined>> = Object.freeze({', frameMap(skills, items.length), '} as const);', '',
  'export function loadIconArtwork(scene: Phaser.Scene): void {',
  '  if (scene.textures.exists(ICON_TEXTURE_KEY)',
  '    || [scene.load.list, scene.load.inflight, scene.load.queue].some(files =>',
  '      [...files].some(file => file.key === ICON_TEXTURE_KEY))) return;',
  "  scene.load.spritesheet(ICON_TEXTURE_KEY, '/assets/icons/rpg-icons.png', {",
  '    frameWidth: ICON_FRAME_SIZE, frameHeight: ICON_FRAME_SIZE, endFrame: ICON_FRAME_COUNT - 1,',
  '  });', '}', '',
].join('\n');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'rpg-icons.png'), png);
fs.writeFileSync(path.join(root, 'src/game/assets/iconArtwork.ts'), metadata);
console.log('Generated ' + ids.length + ' original icons, ' + width + 'x' + height + ', ' + png.length + ' bytes');
