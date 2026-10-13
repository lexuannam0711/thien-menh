import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/npcs');
const colors = {
  ink: '#172A2B', dark: '#352C2C', skin: '#C6A66B', light: '#E8C991', shade: '#8A6248',
  bronze: '#CBA968', gold: '#E9C36B', cream: '#E8D8B4', white: '#F5D88A',
  green: '#497459', moss: '#81995D', jade: '#203B34', teal: '#315E55',
  blue: '#5CB9D5', purple: '#654A88', stone: '#87918B', rock: '#39464A', red: '#684A39', fire: '#F28B45',
};
const designs = [
  ['village-chief', 'chief', 'red', 17, 0],
  ['village-smith', 'smith', 'rock', 21, 1],
  ['village-healer', 'healer', 'green', 16, 2],
  ['ngu-ong-ba-vi', 'fisher', 'teal', 17, 3],
  ['tho-san-tan-vien', 'hunter', 'jade', 16, 4],
  ['dao-si-truc-lam', 'monk', 'moss', 15, 5],
  ['tien-nu-dam-sen', 'lotus', 'purple', 18, 6],
  ['thuy-toc-lao-nhan', 'aquatic', 'teal', 19, 7],
  ['thuong-nhan-van-lang', 'trader', 'red', 22, 8],
  ['tu-si-tan-vien', 'priest', 'cream', 18, 9],
  ['chien-tuong-son-cuoc', 'stone', 'rock', 23, 10],
  ['linh-y-nui-cao', 'holy', 'cream', 16, 11],
  ['quan-thi-ve-phong-chau', 'soldier', 'red', 20, 12],
  ['te-tu-hoang-cung', 'keeper', 'purple', 20, 13],
  ['ky-nhan-khong-lo', 'envoy', 'blue', 19, 14],
];
const canonical = [...fs.readFileSync(path.join(root, 'src/data/contentCatalog.ts'), 'utf8')
  .split('export const NAMED_NPCS:')[1].split(']);')[0].matchAll(/\bid: '([^']+)'/g)].map(match => match[1]);
if (canonical.length !== 15 || designs.length !== canonical.length || designs.some(([id]) => !canonical.includes(id))) {
  throw new Error('NPC designs must match all fifteen canonical IDs');
}
const palette = Object.fromEntries(Object.entries(colors).map(([name, hex]) => [name, [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255,
]]));

function canvas(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  function dot(column, row, color) {
    column = Math.round(column); row = Math.round(row);
    if (column >= 2 && row >= 2 && column < width - 2 && row < height - 2) pixels.set(palette[color], (row * width + column) * 4);
  }
  function rect(left, top, span, depth, color) {
    for (let row = top; row < top + depth; row++) for (let column = left; column < left + span; column++) dot(column, row, color);
  }
  function line(left, top, right, bottom, color, thickness = 1) {
    const steps = Math.max(Math.abs(right - left), Math.abs(bottom - top), 1);
    for (let step = 0; step <= steps; step++) rect(Math.round(left + (right - left) * step / steps), Math.round(top + (bottom - top) * step / steps), thickness, thickness, color);
  }
  function poly(points, color) {
    const top = Math.ceil(Math.min(...points.map(point => point[1])));
    const bottom = Math.floor(Math.max(...points.map(point => point[1])));
    for (let row = top; row <= bottom; row++) {
      const crossings = [];
      for (let index = 0; index < points.length; index++) {
        const first = points[index], second = points[(index + 1) % points.length];
        if ((first[1] <= row && second[1] > row) || (second[1] <= row && first[1] > row)) {
          crossings.push(first[0] + (row - first[1]) * (second[0] - first[0]) / (second[1] - first[1]));
        }
      }
      crossings.sort((first, second) => first - second);
      for (let index = 0; index < crossings.length; index += 2) {
        for (let column = Math.ceil(crossings[index]); column <= Math.floor(crossings[index + 1]); column++) dot(column, row, color);
      }
    }
  }
  return { width, height, pixels, dot, rect, line, poly };
}

function actor(image, design, frame, portrait = false) {
  const [, role, robe, breadth, index] = design;
  const talk = frame >= 4, phase = frame % 4;
  const lift = phase === 1 || phase === 2 ? -1 : 0;
  const scale = portrait ? 3 : 1;
  const offsetX = portrait ? 0 : frame * 48;
  const transform = (column, row) => portrait
    ? [48 + (column - 24) * scale, 5 + (row - 3) * scale]
    : [offsetX + column, row + lift];
  const rect = (left, top, width, height, color) => {
    const [column, row] = transform(left, top); image.rect(column, row, width * scale, height * scale, color);
  };
  const line = (left, top, right, bottom, color, thickness = 1) => {
    const [column, row] = transform(left, top), [endX, endY] = transform(right, bottom);
    image.line(column, row, endX, endY, color, thickness * scale);
  };
  const poly = (points, color) => image.poly(points.map(([column, row]) => transform(column, row)), color);
  const left = 24 - Math.floor(breadth / 2), right = left + breadth;
  if (portrait) {
    poly([[7, 45], [8, 32], [15, 27], [33, 27], [40, 32], [41, 45]], 'ink');
    poly([[8, 45], [9, 33], [17, 28], [31, 28], [39, 33], [40, 45]], robe);
  } else {
    image.rect(offsetX + 17, 38, 6, 4, 'ink'); image.rect(offsetX + 26, 38, 6, 4, 'ink');
    image.rect(offsetX + 18, 38, 4, 2, 'shade'); image.rect(offsetX + 27, 38, 4, 2, 'shade');
  }
  poly([[left + 2, 20], [right - 2, 20], [right + 1, 37], [right - 1, 40], [left - 1, 40], [left - 2, 37]], 'ink');
  poly([[left + 3, 21], [right - 3, 21], [right - 1, 38], [left + 1, 38]], robe);
  poly([[left + 3, 22], [22, 22], [20, 37], [left + 1, 38]], 'shade');
  rect(left + 3, 29, breadth - 6, 2, 'bronze');
  line(24, 23, 24, 37, 'gold');
  for (let count = 0; count < 3; count++) rect(left + 4 + count * 4, 35, 2, 1, 'cream');
  poly([[left + 2, 21], [left - 3, 24], [left - 3, 31], [left + 2, 30]], 'ink');
  rect(left - 2, 25, 4, 5, robe); rect(left - 1, 30, 3, 3, 'skin');
  const gesture = talk ? [0, -2, -4, -1][phase] : [0, 0, -1, 1][phase];
  poly([[right - 2, 21], [right + 3, 24 + gesture], [right + 3, 30 + gesture], [right - 1, 30]], 'ink');
  rect(right - 1, 24 + gesture, 4, 5, robe); rect(right, 29 + gesture, 3, 3, 'light');
  rect(19, 10, 11, 12, 'ink'); rect(20, 11, 9, 9, 'skin');
  rect(21, 12, 7, 5, 'light'); rect(20, 17, 2, 3, 'shade');
  rect(21, 14, 2, 1, 'ink'); rect(26, 14, 2, 1, 'ink');
  rect(24, 15, 1, 2, 'shade');
  rect(23, 18, talk && phase % 2 ? 3 : 2, talk && phase % 2 ? 2 : 1, 'red');
  rect(18, 9, 13, 3, 'dark'); rect(18, 12, 2, 5, 'dark'); rect(29, 12, 2, 5, 'dark');
  if (['chief', 'fisher', 'monk', 'aquatic', 'priest', 'keeper'].includes(role)) {
    poly([[21, 19], [28, 19], [27, 25], [24, 27], [22, 24]], 'cream');
    line(24, 21, 24, 25, 'stone');
  }
  switch (role) {
    case 'chief':
      poly([[16, 10], [19, 4], [24, 7], [29, 4], [33, 10]], 'ink');
      poly([[18, 9], [20, 6], [24, 8], [28, 6], [31, 9]], 'bronze');
      rect(22, 7, 4, 3, 'gold'); rect(33, 27 + gesture, 6, 7, 'ink');
      rect(34, 28 + gesture, 4, 5, 'gold'); rect(35, 30 + gesture, 2, 1, 'red'); break;
    case 'smith':
      rect(18, 10, 13, 2, 'fire'); poly([[19, 23], [29, 23], [32, 39], [18, 39]], 'dark');
      rect(22, 24, 5, 9, 'red'); rect(20, 33, 10, 2, 'bronze');
      rect(36, 16 + gesture, 2, 17, 'shade'); rect(32, 15 + gesture, 11, 5, 'ink');
      rect(33, 16 + gesture, 9, 3, 'stone'); rect(34, 16 + gesture, 2, 1, 'cream'); break;
    case 'healer':
      poly([[17, 11], [20, 6], [29, 6], [33, 12]], 'purple'); rect(23, 6, 2, 2, 'gold');
      poly([[5, 28], [15, 28], [14, 37], [7, 37]], 'ink'); rect(7, 29, 7, 6, 'bronze');
      for (let count = 0; count < 3; count++) { line(8 + count * 2, 30, 7 + count * 3, 23, 'green'); rect(6 + count * 3, 25, 3, 2, 'moss'); }
      line(7, 32, 13, 32, 'shade'); break;
    case 'fisher':
      poly([[12, 12], [24, 3], [36, 12]], 'ink'); poly([[14, 11], [24, 5], [34, 11]], 'bronze');
      line(19, 10, 24, 6, 'cream'); line(36, 35, 40, 6, 'shade', 2);
      line(41, 7, 43, 12, 'cream'); line(43, 12, 43, 32, 'cream'); rect(41, 32, 2, 3, 'blue'); break;
    case 'hunter':
      poly([[17, 11], [19, 6], [28, 7], [32, 12]], 'green'); line(30, 9, 33, 4, 'cream', 2);
      poly([[12, 20], [15, 20], [19, 38], [14, 38]], 'red'); line(14, 18, 10, 7, 'shade');
      poly([[38, 12], [42, 18], [43, 26], [40, 35], [38, 37], [40, 26], [40, 19]], 'bronze');
      line(38, 13, 38, 36, 'cream'); line(35, 23, 43, 23, 'shade'); break;
    case 'monk':
      rect(19, 7, 11, 4, 'stone'); rect(23, 5, 4, 3, 'dark');
      rect(31, 27 + gesture, 10, 6, 'ink'); rect(32, 28 + gesture, 8, 4, 'moss');
      for (let count = 0; count < 4; count++) line(33 + count * 2, 28 + gesture, 33 + count * 2, 31 + gesture, 'bronze'); break;
    case 'lotus':
      poly([[17, 12], [15, 7], [22, 10], [24, 4], [27, 10], [34, 7], [31, 12]], 'purple');
      rect(23, 9, 3, 2, 'gold'); line(18, 15, 16, 31, 'dark', 2); line(30, 15, 33, 32, 'dark', 2);
      poly([[14, 38], [18, 30], [24, 39], [30, 30], [34, 38], [30, 40], [18, 40]], 'purple');
      line(36, 32 + gesture, 37, 24 + gesture, 'green');
      poly([[33, 24 + gesture], [34, 21 + gesture], [37, 23 + gesture], [40, 21 + gesture], [41, 25 + gesture], [37, 27 + gesture]], 'cream'); break;
    case 'aquatic':
      poly([[15, 12], [14, 6], [21, 9], [24, 3], [27, 9], [34, 6], [33, 12]], 'blue');
      rect(23, 8, 3, 3, 'gold'); line(9, 36, 9, 10, 'bronze', 2);
      poly([[6, 12], [6, 6], [9, 9], [12, 6], [12, 12]], 'blue');
      for (let count = 0; count < 3; count++) line(18, 32 + count * 2, 28, 33 + count * 2, 'blue'); break;
    case 'trader':
      poly([[16, 11], [19, 6], [30, 6], [33, 11]], 'red'); rect(17, 10, 15, 2, 'bronze');
      rect(7, 20, 8, 16, 'ink'); rect(8, 21, 6, 14, 'shade');
      rect(6, 18, 8, 4, 'cream'); rect(9, 17, 2, 5, 'green');
      poly([[34, 29 + gesture], [41, 28 + gesture], [42, 35 + gesture], [35, 36 + gesture]], 'gold');
      rect(36, 31 + gesture, 4, 2, 'fire'); break;
    case 'priest':
      poly([[18, 11], [19, 4], [23, 6], [25, 3], [29, 6], [31, 11]], 'ink');
      poly([[20, 10], [21, 6], [24, 8], [26, 5], [29, 10]], 'bronze');
      line(8, 37, 8, 14, 'shade', 2); poly([[5, 15], [8, 10], [12, 15], [8, 19]], 'gold');
      poly([[20, 23], [24, 28], [28, 23], [27, 31], [21, 31]], 'bronze'); break;
    case 'stone':
      rect(16, 8, 17, 5, 'rock'); rect(19, 7, 11, 3, 'stone'); rect(23, 7, 3, 3, 'bronze');
      rect(left - 2, 21, 7, 6, 'stone'); rect(right - 4, 21, 7, 6, 'stone');
      for (let count = 0; count < 3; count++) rect(19, 25 + count * 4, 11, 3, 'rock');
      line(23, 25, 25, 32, 'stone'); rect(6, 25, 6, 13, 'ink'); rect(7, 26, 4, 11, 'stone');
      line(8, 28, 10, 33, 'rock'); rect(38, 19 + gesture, 2, 15, 'shade'); rect(36, 17 + gesture, 6, 4, 'bronze'); break;
    case 'holy':
      poly([[17, 16], [17, 7], [24, 4], [31, 7], [33, 16], [29, 12], [24, 9], [20, 12]], 'cream');
      line(18, 9, 17, 30, 'white'); rect(23, 6, 3, 2, 'blue');
      rect(34, 27 + gesture, 6, 7, 'ink'); rect(35, 28 + gesture, 4, 5, 'blue'); rect(36, 25 + gesture, 2, 3, 'bronze');
      line(8, 28, 12, 23, 'cream'); line(8, 28, 12, 29, 'cream'); break;
    case 'soldier':
      poly([[16, 13], [17, 7], [23, 5], [31, 7], [33, 13]], 'ink');
      poly([[18, 12], [19, 8], [24, 6], [29, 8], [31, 12]], 'bronze');
      poly([[23, 6], [26, 3], [30, 4], [28, 7]], 'fire');
      rect(17, 22, 15, 8, 'bronze'); rect(20, 23, 9, 6, 'rock'); line(22, 25, 27, 25, 'gold');
      line(39, 39, 39, 10, 'shade', 2); poly([[37, 11], [39, 4], [42, 11]], 'stone');
      poly([[6, 25], [13, 23], [15, 33], [10, 38], [5, 33]], 'bronze'); line(10, 26, 10, 34, 'gold'); break;
    case 'keeper':
      rect(18, 7, 14, 5, 'ink'); rect(20, 5, 10, 5, 'purple'); rect(19, 9, 12, 2, 'bronze');
      rect(18, 22, 4, 15, 'bronze'); rect(27, 22, 4, 15, 'bronze');
      poly([[5, 27], [14, 25], [15, 34], [6, 36]], 'ink'); rect(7, 28, 6, 6, 'bronze');
      line(8, 29, 12, 29, 'gold'); line(8, 31, 12, 33, 'shade');
      rect(36, 25 + gesture, 2, 9, 'red'); rect(36, 22 + gesture, 2, 3, 'fire'); break;
    case 'envoy':
      poly([[12, 22], [17, 18], [31, 18], [37, 22], [40, 38], [31, 36], [17, 36], [8, 38]], 'ink');
      poly([[13, 22], [18, 20], [30, 20], [36, 23], [38, 36], [29, 34], [19, 34], [10, 36]], 'blue');
      rect(19, 23, 11, 8, 'bronze'); poly([[20, 25], [24, 27], [29, 24], [25, 29]], 'cream');
      rect(18, 8, 14, 4, 'bronze'); line(29, 8, 35, 4, 'cream', 2);
      line(36, 35 + gesture, 40, 19 + gesture, 'stone', 2); line(35, 31 + gesture, 40, 32 + gesture, 'gold'); break;
    default: throw new Error('Unrecognized NPC design: ' + role);
  }
  rect(left + 3 + index % Math.max(1, breadth - 6), 32, 1, 2, 'gold');
  rect(22 + phase, talk ? 28 : 34, 1, 1, talk ? 'cream' : 'gold');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, checksum]);
}
function png(image) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4); header[8] = 8; header[9] = 6;
  const stride = image.width * 4, raw = Buffer.alloc((stride + 1) * image.height);
  for (let row = 0; row < image.height; row++) image.pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(output, { recursive: true });
let bytes = 0;
for (const design of designs) {
  const sheet = canvas(384, 48), portrait = canvas(96, 96);
  for (let frame = 0; frame < 8; frame++) actor(sheet, design, frame);
  actor(portrait, design, 0, true);
  for (const [suffix, image] of [['', sheet], ['-portrait', portrait]]) {
    const data = png(image); bytes += data.length;
    fs.writeFileSync(path.join(output, design[0] + suffix + '.png'), data);
  }
}
console.log('Original offline NPC pixel artwork: 15 sheets, 120 down-facing frames, 15 busts; ' + bytes + ' bytes.');
