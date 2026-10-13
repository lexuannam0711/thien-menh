import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets/environments');
const check = process.argv.includes('--check');
const colors = {
  ink: '#172A2B', wood: '#684A39', bark: '#8A6248', straw: '#C6A66B', cream: '#E8C991',
  grass: '#81995D', leaf: '#497459', jade: '#203B34', moss: '#728857', violet: '#654A88',
  teal: '#315E55', water: '#173D3A', blue: '#5CB9D5', rock: '#39464A', stone: '#87918B',
  gold: '#B8A16A', bronze: '#CBA968', dark: '#352C2C', fire: '#F28B45', sacred: '#E9C36B',
  white: '#E8D8B4', soil: '#39432C', canopy: '#162C21', marsh: '#0F2924', granite: '#23282B', court: '#24181C',
};
const regions = ['village', 'forest', 'swamp', 'mountain', 'citadel'];
const grounds = ['soil', 'canopy', 'marsh', 'granite', 'court'];
const palette = Object.fromEntries([...Object.entries(colors).map(([name, hex]) => [name, [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255,
]]), ...grounds.flatMap(ground => [-8, -4, 4, 8, 12].map((offset, index) => [ground + '-' + index, [
  ...[1, 3, 5].map(start => Math.max(0, Math.min(255, parseInt(colors[ground].slice(start, start + 2), 16) + offset))), 255,
]]))]);
const materials = [
  ['wood', 'bark', 'straw', 'cream', 'grass'], ['jade', 'leaf', 'moss', 'grass', 'bark'],
  ['ink', 'water', 'teal', 'stone', 'blue'], ['rock', 'stone', 'gold', 'white', 'moss'],
  ['dark', 'wood', 'gold', 'bronze', 'cream'],
];

function canvas(size) {
  const pixels = Buffer.alloc(size * size * 4);
  function dot(column, row, color) {
    column = Math.round(column); row = Math.round(row);
    const inside = size === 128 ? column >= 8 && column < 120 && row >= 8 && row <= 112 : column >= 0 && row >= 0 && column < size && row < size;
    if (inside) pixels.set(palette[color], (row * size + column) * 4);
  }
  function rect(left, top, width, height, color) {
    for (let row = top; row < top + height; row++) for (let column = left; column < left + width; column++) dot(column, row, color);
  }
  function line(left, top, right, bottom, color, thickness = 1) {
    const steps = Math.max(Math.abs(right - left), Math.abs(bottom - top), 1);
    for (let step = 0; step <= steps; step++) rect(Math.round(left + (right - left) * step / steps), Math.round(top + (bottom - top) * step / steps), thickness, thickness, color);
  }
  function poly(points, color) {
    const top = Math.min(...points.map(point => point[1])), bottom = Math.max(...points.map(point => point[1]));
    for (let row = top; row <= bottom; row++) {
      const crossings = points.flatMap((point, index) => {
        const next = points[(index + 1) % points.length];
        return (point[1] <= row && next[1] > row) || (next[1] <= row && point[1] > row)
          ? [point[0] + (row - point[1]) * (next[0] - point[0]) / (next[1] - point[1])] : [];
      }).sort((left, right) => left - right);
      for (let index = 0; index < crossings.length; index += 2) rect(Math.ceil(crossings[index]), row, Math.floor(crossings[index + 1]) - Math.ceil(crossings[index]) + 1, 1, color);
    }
    points.forEach((point, index) => line(point[0], point[1], points[(index + 1) % points.length][0], points[(index + 1) % points.length][1], color));
  }
  function oval(centerX, centerY, radiusX, radiusY, color) {
    for (let row = centerY - radiusY; row <= centerY + radiusY; row++) for (let column = centerX - radiusX; column <= centerX + radiusX; column++) {
      if ((column - centerX) ** 2 / radiusX ** 2 + (row - centerY) ** 2 / radiusY ** 2 <= 1) dot(column, row, color);
    }
  }
  return { pixels, dot, rect, line, poly, oval };
}

function terrain(region, frame) {
  const image = canvas(32), { dot, rect, line, poly, oval } = image;
  const [shade, middle, light, highlight, foliage] = materials[region];
  rect(0, 0, 32, 32, grounds[region]);
  if (frame <= 1) {
    if (frame === 1) rect(2, 2, 28, 28, grounds[region] + '-4');
    for (let detail = 0; detail < 5; detail++) {
      const column = 4 + (detail * 7 + region * 3) % 23;
      const row = 4 + (detail * 11 + frame * 5) % 23;
      line(column, row, column + 2, row + (detail % 2), grounds[region] + '-' + detail);
    }
    return image.pixels;
  }
  for (let row = 3; row < 29; row += 4) for (let column = 3; column < 29; column += 4) {
    const variation = (column * 7 + row * 11 + frame * 13 + region * 19) % 5;
    dot(column, row, [shade, middle, light, highlight, foliage][variation]);
    if (variation === 0) dot(column + 1, row, shade);
  }
  if (frame === 2) {
    poly([[3, 13], [11, 10], [18, 14], [28, 11], [28, 28], [3, 28]], region === 2 ? 'water' : shade);
    line(3, 12, 11, 9, light); line(12, 10, 18, 13, middle); line(19, 13, 28, 10, highlight);
  } else if (frame === 3) {
    if (region === 0) for (let column = 6; column < 27; column += 6) { line(column, 26, column + 2, 10, 'grass'); line(column + 2, 10, column + 5, 14, 'straw', 2); }
    if (region === 1) { line(5, 27, 12, 12, 'bark', 2); line(12, 12, 26, 9, 'wood', 2); line(12, 13, 24, 23, 'jade', 2); }
    if (region === 2) { oval(10, 13, 7, 4, 'leaf'); oval(23, 22, 5, 3, 'teal'); line(9, 13, 13, 11, 'moss'); }
    if (region === 3) { poly([[7, 26], [12, 5], [19, 12], [25, 26]], 'rock'); line(12, 6, 17, 17, 'stone'); }
    if (region === 4) { rect(6, 6, 20, 20, 'dark'); for (let offset = 0; offset < 4; offset++) { line(8 + offset * 4, 8, 8 + offset * 4, 23, 'gold'); } }
  } else if (frame === 4) {
    if (region === 0) { rect(5, 8, 22, 15, 'wood'); for (let column = 6; column < 27; column += 4) line(column, 9, column, 22, 'straw'); }
    if (region === 1) { poly([[6, 26], [10, 5], [15, 12], [24, 7], [26, 25]], 'violet'); line(9, 23, 17, 15, 'jade', 2); }
    if (region === 2) { oval(17, 16, 10, 6, 'water'); line(9, 15, 24, 15, 'blue'); dot(12, 20, 'stone'); }
    if (region === 3) { rect(6, 6, 19, 19, 'stone'); line(8, 7, 18, 14, 'rock'); line(18, 14, 13, 24, 'rock'); }
    if (region === 4) { poly([[6, 15], [16, 4], [26, 15], [16, 27]], 'violet'); poly([[12, 16], [17, 9], [20, 16], [16, 22]], 'dark'); }
  } else if (frame === 5) {
    rect(3, 3, 26, 26, region === 2 ? 'water' : 'jade');
    for (let row = 6; row < 28; row += 6) { const shift = (row / 6 + region) % 3; line(4 + shift, row, 13 + shift, row, 'teal'); line(19 - shift, row + 2, 26 - shift, row + 2, region === 2 ? 'blue' : 'leaf'); }
    dot(9 + region, 10, 'stone'); dot(23 - region, 24, 'moss');
  } else if (frame === 6) {
    poly([[6, 23], [5 + region, 11], [17, 5 + region], [26, 14], [24, 26]], shade);
    poly([[7, 12], [17, 6 + region], [24, 14], [15, 18]], light);
    line(8, 12, 16, 8 + region, highlight); line(16, 18, 22, 24, middle);
  } else {
    oval(16, 16, 11, 11, shade); oval(16, 16, 9, 9, middle); oval(16, 16, 7, 7, grounds[region]);
    for (let offset = 0; offset < 4; offset++) {
      const axis = 7 + offset * 6; line(axis, 14, axis + 2, 18, light);
    }
    poly([[16, 9], [20, 16], [16, 23], [12, 16]], highlight); dot(16, 16, foliage);
  }
  return image.pixels;
}

function props(region, frame) {
  const image = canvas(128), { dot, rect, line, poly, oval } = image;
  const [shade, middle, light, highlight, foliage] = materials[region];
  const base = (left, width, top = 105) => { rect(left, top, width, 8 + 105 - top, shade); line(left + 1, top, left + width - 2, top, light); };
  const block = (left, top, width, height) => { rect(left, top, width, height, shade); rect(left + 2, top + 2, width - 5, height - 4, middle); line(left + 3, top + 2, left + width - 4, top + 2, highlight); };
  if (frame === 0) {
    if (region === 0) {
      rect(29, 67, 6, 46, 'wood'); rect(94, 67, 6, 46, 'wood'); rect(31, 67, 2, 45, 'bark'); rect(26, 88, 76, 7, 'wood');
      rect(32, 45, 64, 43, 'bark'); for (let column = 36; column < 94; column += 7) line(column, 48, column, 85, 'wood');
      poly([[12, 33], [32, 43], [64, 18], [96, 43], [114, 30], [105, 60], [23, 60]], 'wood');
      poly([[16, 35], [33, 45], [64, 23], [95, 45], [110, 34], [103, 55], [26, 55]], 'straw');
      for (let offset = 0; offset < 7; offset++) line(34 + offset * 8, 45 - Math.min(offset, 6 - offset) * 5, 30 + offset * 10, 55, 'cream');
      rect(55, 66, 18, 22, 'wood'); line(60, 89, 51, 111, 'bark', 3); line(75, 89, 83, 111, 'bark', 3);
      for (let row = 95; row < 112; row += 5) line(58 - (row - 95) / 4, row, 77 + (row - 95) / 4, row, 'straw');
    } else if (region === 1) {
      for (const left of [24, 32, 91, 99]) { rect(left, 33, 5, 80, 'jade'); rect(left + 1, 33, 2, 79, 'leaf'); for (let row = 40; row < 108; row += 14) line(left, row, left + 4, row, 'moss'); }
      line(29, 38, 63, 18, 'jade', 8); line(63, 18, 98, 38, 'jade', 8); line(30, 39, 65, 24, 'moss', 2); line(65, 24, 98, 39, 'leaf', 2);
      for (let left = 40; left < 89; left += 12) poly([[left, 27], [left + 13, 16], [left + 8, 31], [left - 4, 37]], 'grass');
      rect(52, 39, 27, 13, 'wood'); line(54, 42, 75, 42, 'straw'); poly([[62, 44], [67, 41], [72, 47], [64, 48]], 'moss');
    } else if (region === 2) {
      base(19, 90, 103); block(26, 32, 17, 71); block(85, 46, 17, 57);
      poly([[20, 31], [41, 19], [72, 23], [85, 38], [58, 40], [42, 35]], 'rock'); line(28, 28, 70, 27, 'stone');
      block(47, 57, 28, 31); poly([[49, 59], [60, 54], [70, 66], [61, 75], [53, 68]], 'teal');
      for (let row = 42; row < 99; row += 15) { line(29, row, 39, row, 'teal'); line(89, row + 7, 98, row + 7, 'water'); }
      oval(64, 101, 44, 6, 'water'); line(22, 99, 46, 99, 'blue'); line(74, 104, 105, 104, 'teal');
      poly([[93, 90], [104, 78], [108, 98]], 'leaf');
    } else if (region === 3) {
      base(18, 92, 105); block(25, 100, 78, 5); block(31, 95, 66, 5); block(39, 47, 50, 48);
      poly([[15, 47], [31, 43], [64, 19], [97, 43], [114, 47], [104, 57], [24, 57]], 'rock');
      poly([[26, 44], [64, 24], [102, 44], [98, 48], [30, 48]], 'stone'); line(31, 44, 96, 44, 'gold');
      rect(57, 64, 16, 30, 'rock'); line(58, 64, 70, 64, 'gold');
      for (const left of [42, 80]) { rect(left, 58, 5, 35, 'stone'); line(left, 63, left + 4, 63, 'gold'); }
      poly([[64, 32], [69, 39], [64, 44], [59, 39]], 'white');
    } else {
      for (const left of [24, 87]) { block(left, 39, 17, 74); rect(left + 4, 47, 8, 51, 'bronze'); for (let row = 52; row < 96; row += 12) poly([[left + 5, row], [left + 11, row + 4], [left + 5, row + 8]], 'wood'); }
      poly([[13, 27], [29, 33], [48, 22], [64, 14], [80, 22], [99, 33], [114, 27], [105, 48], [23, 48]], 'dark');
      poly([[18, 30], [31, 36], [64, 19], [97, 36], [109, 30], [101, 43], [27, 43]], 'bronze');
      line(28, 38, 99, 38, 'cream'); poly([[51, 31], [60, 25], [78, 27], [65, 30], [72, 35], [60, 33]], 'wood');
      for (const left of [43, 68]) { block(left, 53, 17, 60); rect(left + 4, 62, 8, 27, 'gold'); line(left + 5, 65, left + 10, 65, 'cream'); }
    }
  } else if (frame === 1) {
    if (region === 1) {
      for (let index = 0; index < 5; index++) { const left = 33 + index * 12, top = 16 + index % 3 * 7; rect(left, top, 5, 113 - top, 'jade'); rect(left + 1, top, 2, 113 - top, 'leaf'); for (let row = top + 10; row < 106; row += 15) line(left, row, left + 4, row, 'moss'); poly([[left, top + 14], [left - 17, top + 2], [left - 5, top + 19]], 'grass'); poly([[left + 3, top + 27], [left + 24, top + 13], [left + 11, top + 31]], 'moss'); }
    } else if (region === 2) {
      poly([[48, 112], [53, 64], [39, 38], [43, 28], [62, 59], [72, 39], [76, 15], [83, 14], [81, 45], [70, 76], [74, 112]], 'ink');
      line(55, 105, 61, 64, 'teal', 4); line(62, 63, 77, 42, 'stone', 2); line(58, 58, 44, 34, 'water', 3);
      for (let index = 0; index < 4; index++) oval(43 + index * 12, 98 + index % 2 * 7, 12, 3, 'leaf');
    } else if (region === 3) {
      poly([[43, 112], [57, 72], [59, 33], [68, 29], [72, 83], [83, 112]], 'rock'); line(61, 39, 61, 100, 'stone', 3);
      for (const [left, top, width] of [[45, 25, 34], [33, 44, 51], [25, 64, 69]]) { poly([[left, top + 13], [left + width / 2, top - 9], [left + width, top + 13]], 'jade'); line(left + 5, top + 11, left + width - 6, top + 11, 'moss', 2); }
      line(46, 91, 83, 75, 'bark', 3); line(62, 88, 90, 82, 'leaf', 2);
    } else {
      const offset = region === 0 ? 0 : 7;
      poly([[47 + offset, 112], [52, 68], [42, 45], [49, 40], [62, 58], [75, 38], [81, 46], [70, 75], [79 - offset, 112]], 'wood');
      line(57, 71, 57, 105, 'bark', 4);
      for (const [left, top, radius] of region === 0 ? [[37, 45, 25], [68, 29, 30], [88, 49, 23]] : [[36, 41, 17], [60, 28, 21], [83, 43, 18], [66, 53, 19]]) {
        oval(left, top, radius, radius - 8, 'jade'); oval(left - 3, top - 4, radius - 4, radius - 12, 'leaf'); line(left - 10, top - 8, left + 4, top - 8, 'grass', 3);
      }
      if (region === 4) { rect(63, 68, 8, 21, 'bronze'); line(64, 72, 69, 72, 'cream'); }
    }
  } else if (frame === 2) {
    const width = 40 + region * 7; base(64 - width / 2, width, 108);
    if (region === 0) for (let left = 41; left < 90; left += 8) { line(left, 110, left - 6, 65, 'grass', 2); line(left - 6, 65, left + 4, 76, 'straw', 3); line(left - 5, 72, left + 2, 82, 'cream', 2); }
    if (region === 1) for (let index = 0; index < 7; index++) { const left = 40 + index * 7; poly([[left, 110], [left - 14, 81 - index % 2 * 10], [left + 1, 97], [left + 15, 79], [left + 4, 110]], index % 2 ? 'leaf' : 'moss'); line(left, 107, left + 7, 91, 'grass'); }
    if (region === 2) { oval(63, 103, 27, 7, 'leaf'); line(63, 98, 63, 88, 'teal', 2); for (const [left, top] of [[52, 86], [63, 79], [74, 86]]) poly([[left, top - 9], [left + 9, top + 8], [left, top + 13], [left - 9, top + 8]], 'cream'); oval(63, 93, 6, 3, 'gold'); }
    if (region === 3) { for (const [left, top] of [[36, 98], [54, 86], [77, 99]]) { poly([[left, 110], [left + 6, top - 14], [left + 14, 110]], 'rock'); line(left + 6, top - 12, left + 9, 106, 'stone', 2); } line(42, 101, 78, 107, 'moss', 3); }
    if (region === 4) { block(32, 93, 63, 17); for (let left = 42; left < 92; left += 11) { line(left, 94, left - 6, 72, 'gold', 2); poly([[left - 9, 78], [left - 15, 66], [left - 3, 68]], 'bronze'); } }
  } else if (frame === 3) {
    const width = 54 + region * 6; base(64 - width / 2, width, 105);
    block(43 - region, 86 - region * 2, 42 + region * 2, 19 + region * 2);
    if (region === 0) { oval(64, 81, 23, 8, 'wood'); oval(64, 77, 23, 8, 'bronze'); oval(64, 76, 16, 5, 'straw'); for (let left = 46; left < 85; left += 8) line(left, 78, left + 2, 84, 'cream'); }
    if (region === 1) { block(54, 46, 22, 40); poly([[57, 56], [64, 50], [71, 56], [64, 66]], 'violet'); line(55, 75, 40, 87, 'moss', 3); line(73, 72, 90, 87, 'leaf', 3); }
    if (region === 2) { block(48, 63, 32, 19); oval(64, 66, 14, 7, 'blue'); oval(64, 66, 9, 4, 'water'); line(51, 92, 77, 92, 'teal'); }
    if (region === 3) { poly([[46, 79], [55, 36], [73, 36], [82, 79]], 'rock'); poly([[54, 62], [64, 42], [73, 62]], 'gold'); line(60, 65, 67, 65, 'white'); }
    if (region === 4) { oval(64, 65, 29, 11, 'dark'); oval(64, 61, 27, 11, 'bronze'); oval(64, 60, 21, 8, 'wood'); for (let left = 48; left < 83; left += 8) poly([[left, 61], [left + 4, 56], [left + 7, 62]], 'cream'); }
  } else if (frame === 4) {
    const left = 56 - region * 2; base(left - 6, 24 + region * 4, 108);
    block(left, region === 3 ? 66 : 77, 10 + region * 3, region === 3 ? 42 : 31);
    if (region === 0) { rect(58, 64, 9, 27, 'wood'); poly([[53, 72], [56, 48], [63, 58], [68, 43], [74, 71]], 'fire'); poly([[58, 68], [62, 54], [68, 69]], 'cream'); }
    if (region === 1) { rect(55, 54, 19, 25, 'wood'); rect(58, 57, 13, 18, 'gold'); line(64, 57, 64, 76, 'jade', 2); poly([[49, 53], [64, 43], [80, 53]], 'moss'); }
    if (region === 2) { poly([[49, 75], [53, 51], [62, 36], [61, 57], [75, 47], [76, 73]], 'teal'); poly([[54, 72], [60, 47], [69, 72]], 'blue'); line(62, 83, 63, 102, 'stone', 2); }
    if (region === 3) { block(48, 42, 32, 28); rect(53, 47, 22, 16, 'gold'); rect(62, 47, 3, 16, 'rock'); poly([[41, 41], [64, 29], [88, 41]], 'stone'); }
    if (region === 4) { poly([[38, 75], [44, 61], [84, 61], [90, 75], [80, 86], [47, 86]], 'bronze'); poly([[47, 63], [50, 44], [58, 53], [65, 30], [71, 51], [82, 40], [80, 63]], 'fire'); poly([[56, 63], [65, 43], [75, 63]], 'sacred'); }
  } else if (frame === 5) {
    base(26 + region * 3, 69 - region * 4, 106);
    if (region === 0) { block(31, 70, 11, 36); block(84, 83, 11, 23); for (let row = 75; row < 97; row += 10) line(35, row, 88, row + 9, 'bark', 4); line(42, 81, 79, 87, 'straw'); }
    if (region === 1) { poly([[33, 105], [37, 50], [53, 39], [61, 57], [56, 82], [82, 76], [94, 105]], 'jade'); line(39, 97, 46, 54, 'bark', 4); line(51, 81, 87, 87, 'moss', 3); poly([[53, 43], [55, 65], [47, 60]], 'violet'); }
    if (region === 2) { block(39, 42, 21, 64); block(69, 72, 20, 34); poly([[35, 39], [43, 27], [64, 37], [62, 48]], 'stone'); line(43, 58, 55, 62, 'water', 3); line(45, 70, 54, 69, 'blue'); oval(65, 103, 26, 4, 'teal'); }
    if (region === 3) { poly([[35, 106], [43, 62], [41, 37], [57, 23], [75, 39], [78, 70], [93, 106]], 'rock'); poly([[48, 39], [60, 30], [69, 40], [65, 57], [52, 56]], 'stone'); line(56, 42, 62, 44, 'gold'); line(61, 59, 56, 80, 'ink', 2); }
    if (region === 4) { block(40, 36, 25, 70); poly([[69, 106], [74, 48], [90, 61], [86, 106]], 'dark'); poly([[70, 96], [77, 60], [82, 85], [77, 102]], 'violet'); for (let row = 43; row < 98; row += 16) line(44, row, 59, row, 'bronze', 3); }
  } else if (frame === 6) {
    if (region === 0) { for (const left of [36, 86]) block(left, 57, 7, 56); line(38, 60, 88, 60, 'bark', 6); line(39, 61, 87, 61, 'straw'); for (let left = 45; left < 85; left += 10) block(left, 67, 4, 35); }
    if (region === 1) { for (const left of [31, 91]) { block(left, 62, 6, 51); line(left, 72, left + 5, 72, 'moss'); } line(34, 63, 94, 44, 'bark', 4); for (let left = 44; left < 92; left += 9) line(left, 63, left + 3, 94, 'jade', 4); }
    if (region === 2) { block(28, 59, 16, 54); block(86, 73, 14, 40); poly([[23, 59], [37, 48], [60, 56], [67, 68], [45, 71]], 'rock'); line(29, 60, 49, 63, 'stone'); line(91, 82, 96, 88, 'blue'); }
    if (region === 3) { block(30, 49, 16, 64); block(83, 49, 16, 64); block(25, 34, 79, 15); line(29, 35, 98, 35, 'gold'); for (const left of [34, 87]) line(left, 58, left + 7, 58, 'white', 3); }
    if (region === 4) { for (const left of [27, 91]) { block(left, 39, 11, 74); poly([[left - 6, 38], [left + 5, 21], [left + 17, 38]], 'bronze'); } block(38, 46, 53, 14); line(42, 49, 86, 49, 'cream'); for (let left = 44; left < 89; left += 11) block(left, 62, 5, 44); }
  } else {
    if (region === 0) { block(39, 77, 49, 36); for (let left = 44; left < 85; left += 8) line(left, 80, left, 109, 'straw'); line(42, 82, 83, 108, 'wood', 3); line(83, 82, 42, 108, 'cream', 2); }
    if (region === 1) { poly([[42, 81], [59, 70], [88, 82], [86, 112], [41, 112]], 'jade'); for (let row = 87; row < 109; row += 7) line(44, row, 84, row, 'moss', 2); line(47, 79, 55, 107, 'bark', 3); line(72, 77, 78, 109, 'grass', 2); }
    if (region === 2) { oval(64, 88, 24, 14, 'ink'); rect(40, 88, 49, 25, 'water'); oval(64, 91, 24, 9, 'teal'); line(47, 89, 76, 84, 'stone', 3); line(48, 107, 84, 107, 'leaf', 2); }
    if (region === 3) { poly([[37, 89], [57, 72], [91, 82], [91, 112], [38, 112]], 'rock'); poly([[40, 88], [57, 76], [86, 84], [67, 94]], 'stone'); line(45, 98, 85, 98, 'gold', 3); line(67, 94, 67, 110, 'white'); }
    if (region === 4) { block(34, 73, 60, 40); rect(37, 77, 54, 9, 'bronze'); rect(40, 89, 48, 17, 'gold'); poly([[60, 91], [69, 95], [63, 104], [55, 99]], 'wood'); line(43, 91, 43, 102, 'cream'); line(84, 91, 84, 102, 'cream'); }
  }
  for (let row = 9; row <= 112; row++) for (let column = 9; column < 119; column++) {
    const offset = (row * 128 + column) * 4;
    if (!image.pixels[offset + 3]) continue;
    const grain = region === 0 ? column % 9 === 0 && row % 7 < 2
      : region === 1 ? row % 14 === 0 && column % 5 < 2
      : region === 2 ? row % 9 < 2 && (column + row * 2) % 23 < 3
      : region === 3 ? (column * 3 + row * 7) % 47 < 2
      : column % 11 === 0 && row % 11 < 2;
    if (grain) dot(column, row, materials[region][(column + row + frame) % 5]);
  }
  return image.pixels;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(frames, size) {
  const width = size * frames.length, header = Buffer.alloc(13), raw = Buffer.alloc(size * (width * 4 + 1));
  header.writeUInt32BE(width); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  for (let row = 0; row < size; row++) frames.forEach((pixels, frame) => pixels.copy(raw, row * (width * 4 + 1) + 1 + frame * size * 4, row * size * 4, (row + 1) * size * 4));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
if (!check) fs.mkdirSync(output, { recursive: true });
for (const [region, name] of regions.entries()) for (const [kind, size, draw] of [['terrain', 32, terrain], ['props', 128, props]]) {
  const bytes = png(Array.from({ length: 8 }, (_, frame) => draw(region, frame)), size);
  const filename = path.join(output, name + '-' + kind + '.png');
  if (check) {
    if (!fs.existsSync(filename) || !fs.readFileSync(filename).equals(bytes)) throw new Error('Non-deterministic or stale environment: ' + filename);
  } else fs.writeFileSync(filename, bytes);
  console.log(name + '-' + kind + '.png ' + bytes.length + ' bytes' + (check ? ' verified' : ''));
}
