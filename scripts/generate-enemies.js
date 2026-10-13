import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/enemies');
const designs = [
  ['moc-tinh-con', 'bamboo'], ['ma-troi-u-am', 'wisp'], ['soi-rung-hac-am', 'wolf'],
  ['dia-yeu-canh-truc', 'snake'], ['thuy-quai-tam-ngu', 'fish'], ['dia-dia-khong-lo', 'leech'],
  ['bo-cap-dam-lay', 'scorpion'], ['thach-hau-cuong-bao', 'ape'], ['dieu-sat-tan-vien', 'eagle'],
  ['thach-binh-co', 'stone'], ['hac-an-ve-si', 'guard'], ['u-linh-cung-thu', 'archer'],
  ['bach-trao-ho-ma', 'tiger'], ['giao-long-thuy-than', 'dragon'],
  ['thach-giap-nguu-ma', 'bull'], ['am-anh-quy-vuong', 'demon'],
];
const catalog = fs.readFileSync(path.join(root, 'src/data/contentCatalog.ts'), 'utf8');
const roster = name => [...catalog.split('export const ' + name + ':')[1].split(']);')[0].matchAll(/\bid: '([^']+)'/g)].map(match => match[1]);
const common = roster('COMMON_ENEMIES'), elites = roster('ELITES');
if (common.length !== 12 || elites.length !== 4 || designs.length !== 16
  || new Set(designs.map(([id]) => id)).size !== 16
  || [...common, ...elites].some(id => !designs.some(([designId]) => id === designId))) throw new Error('Enemy design roster differs from canonical catalog');
const hex = {
  ink: '172A2B', jade: '203B34', green: '497459', moss: '81995D', skin: 'C6A66B',
  bark: '8A6248', earth: '684A39', cream: 'E8C991', bronze: 'CBA968', gold: 'E9C36B',
  cloth: 'E8D8B4', bright: 'F5D88A', purple: '654A88', blue: '5CB9D5',
  water: '173D3A', teal: '315E55', stone: '87918B', rock: '39464A', void: '352C2C', fire: 'F28B45',
};
const palette = Object.fromEntries(Object.entries(hex).map(([name, value]) => [name, [
  parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255,
]]));

function tools(pixels, role, direction, frame) {
  const state = frame < 4 ? 'idle' : frame < 10 ? 'walk' : frame < 15 ? 'attack' : frame < 18 ? 'hit' : 'death';
  const phase = frame - ({ idle: 0, walk: 4, attack: 10, hit: 15, death: 18 }[state]);
  const gait = state === 'walk' ? [0, 2, 1, 0, -2, -1][phase] : state === 'idle' ? [0, 1, 2, 1][phase] : 0;
  const reach = state === 'attack' ? [-2, -1, 4, 2, 0][phase] : 0;
  const bob = state === 'idle' ? [0, -1, 0, 1][phase] : state === 'walk' ? [0, -1, -2, 0, -1, -2][phase] : state === 'hit' ? -phase : 0;
  const collapse = state === 'death' ? [1, 0.88, 0.72, 0.5, 0.32, 0.18][phase] : 1;
  const upright = ['bamboo', 'ape', 'stone', 'guard', 'archer', 'demon'].includes(role);
  function point(horizontal, vertical) {
    let column = horizontal - 24, row = vertical - 24;
    if (!upright) {
      if (direction === 1) [column, row] = [-row, column];
      else if (direction === 2) [column, row] = [row, -column];
      else if (direction === 3) [column, row] = [-column, -row];
    } else {
      if (direction === 1) column = -column * 0.72 - 1;
      else if (direction === 2) column = column * 0.72 + 1;
      else if (direction === 3) column = -column;
    }
    const recoil = state === 'hit' ? [2, -1, 0][phase] : 0;
    return [Math.round(24 + column + recoil), Math.round(41 - (17 - row - bob) * collapse)];
  }
  function dot(column, row, color) {
    if (column >= 2 && column < 46 && row >= 2 && row < 42) pixels.set(palette[color], (row * 48 + column) * 4);
  }
  function fillEllipse(horizontal, vertical, radiusX, radiusY, color) {
    for (let row = Math.floor(vertical - radiusY); row <= vertical + radiusY; row++) {
      for (let column = Math.floor(horizontal - radiusX); column <= horizontal + radiusX; column++) {
        if (((column - horizontal) / radiusX) ** 2 + ((row - vertical) / radiusY) ** 2 <= 1) dot(...point(column, row), color);
      }
    }
  }
  function oval(horizontal, vertical, radiusX, radiusY, color, highlight) {
    fillEllipse(horizontal, vertical, radiusX + 1, radiusY + 1, 'ink');
    fillEllipse(horizontal, vertical, radiusX, radiusY, color);
    if (highlight) fillEllipse(horizontal - radiusX / 3, vertical - radiusY / 3, Math.max(1, radiusX / 2), Math.max(1, radiusY / 3), highlight);
  }
  function stroke(fromX, fromY, toX, toY, width, color) {
    const steps = Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)));
    for (let step = 0; step <= steps; step++) fillEllipse(fromX + (toX - fromX) * step / Math.max(1, steps), fromY + (toY - fromY) * step / Math.max(1, steps), width / 2, width / 2, color);
  }
  function line(fromX, fromY, toX, toY, width, color) {
    stroke(fromX, fromY, toX, toY, width + 2, 'ink'); stroke(fromX, fromY, toX, toY, width, color);
  }
  function polygon(points, color) {
    const top = Math.min(...points.map(point => point[1])), bottom = Math.max(...points.map(point => point[1]));
    for (let row = top; row <= bottom; row++) {
      const crosses = points.flatMap(([column, vertical], index) => {
        const [nextColumn, nextVertical] = points[(index + 1) % points.length];
        return (vertical <= row && nextVertical > row) || (nextVertical <= row && vertical > row)
          ? [column + (row - vertical) * (nextColumn - column) / (nextVertical - vertical)] : [];
      }).sort((left, right) => left - right);
      for (let index = 0; index + 1 < crosses.length; index += 2) for (let column = Math.ceil(crosses[index]); column <= crosses[index + 1]; column++) dot(...point(column, row), color);
    }
    points.forEach(([column, row], index) => { const next = points[(index + 1) % points.length]; stroke(column, row, ...next, 1, 'ink'); });
  }
  function eye(horizontal, vertical) {
    if (!upright || direction !== 3) { fillEllipse(horizontal, vertical, 1, 1, 'fire'); dot(...point(horizontal, vertical - 1), 'bright'); }
  }
  return { oval, line, polygon, eye, dot: (horizontal, vertical, color) => dot(...point(horizontal, vertical), color), fillEllipse, gait, reach, phase, state, direction };
}

function bamboo(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(21, 31, 16 - gait, 40, 3, 'bark'); line(27, 31, 33 + gait, 39, 3, 'earth');
  line(19, 24, 10, 32 + reach, 3, 'bark'); line(28, 23, 36 + gait, 30 + reach, 2, 'green');
  polygon([[18, 31], [19, 16], [25, 11], [30, 16], [28, 34]], 'green');
  line(23, 29, 24, 15, 3, 'moss'); line(19, 23, 29, 23, 1, 'bark');
  polygon([[23, 13], [14 - gait, 5], [19, 14]], 'green'); polygon([[25, 12], [32 + gait, 7], [30, 16]], 'moss');
  line(24, 12, 24, 6, 2, 'bronze'); oval(24, 18, 5, 4, 'earth', 'bark'); eye(22, 18); eye(26, 18);
  polygon([[17, 37], [11, 40], [20, 40]], 'bark');
}
function wisp(art) {
  const { oval, polygon, line, eye, gait, reach, phase } = art;
  polygon([[15, 30], [17, 15], [20 + gait, 5], [23, 14], [30, 8 + phase], [29, 19], [36, 21], [32, 32]], 'purple');
  polygon([[18, 30], [21, 15], [24 + gait, 11], [26, 24], [33, 24], [28, 33]], 'blue');
  oval(23, 26 + reach, 6, 6, 'teal', 'blue'); oval(23, 29 + reach, 3, 3, 'cloth', 'bright');
  eye(20, 25 + reach); eye(26, 25 + reach);
  line(20, 34, 17 - gait, 39, 2, 'purple'); line(27, 33, 31 + phase % 2, 36, 2, 'blue');
}
function wolf(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(23, 18, 15, 9, 3, 'rock'); line(15, 9, 10 + gait, 13, 2, 'purple');
  for (const [column, row, sign] of [[16, 23, 1], [31, 23, -1], [18, 32, -1], [30, 32, 1]]) line(column, row, column + sign * gait, row + 7, 3, 'rock');
  oval(24, 26, 8, 10, 'rock', 'purple'); polygon([[18, 21], [24, 14], [32, 23], [25, 29]], 'void');
  polygon([[17, 31], [16, 24], [22, 30]], 'rock'); polygon([[27, 29], [32, 24], [32, 34]], 'rock');
  oval(25, 34 + reach, 6, 4, 'rock', 'stone'); oval(25, 38 + reach, 3, 2, 'void', 'stone');
  eye(21, 34 + reach); eye(29, 34 + reach); line(21, 37 + reach, 21, 39 + reach, 1, 'cloth');
}
function snake(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(14, 10, 11 + gait, 19, 3, 'green'); line(11 + gait, 19, 27, 19, 5, 'jade');
  line(27, 19, 30 - gait, 28, 5, 'green'); line(30 - gait, 28, 20, 31, 5, 'moss');
  line(20, 31, 23 + gait, 36 + reach, 5, 'green');
  polygon([[18, 32 + reach], [23, 29 + reach], [29, 34 + reach], [24, 39 + reach]], 'moss');
  polygon([[19, 15], [25, 8], [24, 19]], 'green'); eye(21, 34 + reach); eye(26, 35 + reach);
  line(24, 38 + reach, 22, 40 + reach, 1, 'fire'); oval(28, 22, 2, 2, 'bronze', 'gold');
}
function fish(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  polygon([[24, 18], [15 - gait, 8], [32, 8 + gait], [26, 20]], 'teal');
  polygon([[18, 23], [8, 21 - gait], [12, 31], [21, 32]], 'blue');
  polygon([[29, 23], [38, 18 + gait], [40, 30], [28, 33]], 'teal');
  oval(24, 27, 10, 10, 'water', 'teal'); polygon([[23, 26], [21, 15], [27, 19], [27, 27]], 'bronze');
  oval(24, 34 + reach, 9, 5, 'teal', 'blue'); oval(24, 36 + reach, 6, 2, 'void');
  for (const column of [20, 23, 26, 29]) line(column, 35 + reach, column, 37 + reach, 1, 'cloth');
  eye(18, 31 + reach); eye(30, 31 + reach);
}
function leech(art) {
  const { oval, line, eye, gait, reach } = art;
  line(21, 9, 28 + gait, 15, 5, 'water'); line(28 + gait, 15, 27, 28, 8, 'jade');
  oval(23, 26, 8, 11, 'jade', 'moss');
  for (let row = 15; row < 33; row += 4) line(18, row, 29, row + 1, 1, 'green');
  oval(22 - gait, 34 + reach, 7, 6, 'earth', 'bark'); oval(22 - gait, 35 + reach, 4, 3, 'void');
  for (const column of [19, 22, 25]) line(column - gait, 32 + reach, column - gait, 34 + reach, 1, 'cloth');
  eye(17, 30); line(26, 12, 31, 11, 1, 'moss');
}
function scorpion(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  for (let row = 22; row <= 31; row += 4) {
    line(18, row, 10 - gait, row + 3, 1, 'bronze'); line(30, row, 37 + gait, row + 2, 1, 'bark');
  }
  line(25, 22, 33, 15, 4, 'earth'); line(33, 15, 29, 7, 4, 'bronze');
  polygon([[29, 7], [23, 7], [23, 12], [27, 10]], 'fire');
  oval(24, 27, 8, 8, 'void', 'earth'); line(19, 24, 29, 24, 1, 'bronze');
  line(18, 31, 12, 35 + reach, 3, 'earth'); line(29, 31, 36, 34 + reach, 3, 'bronze');
  polygon([[12, 30 + reach], [7, 35 + reach], [10, 40 + reach], [15, 36 + reach], [14, 34 + reach]], 'earth');
  polygon([[35, 30 + reach], [40, 34 + reach], [37, 39 + reach], [32, 36 + reach]], 'bronze');
  eye(22, 32); eye(26, 32);
}
function ape(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(29, 31, 35, 33, 2, 'rock'); line(35, 33, 37 + gait, 26, 2, 'stone');
  line(20, 31, 17 - gait, 40, 4, 'rock'); line(27, 31, 30 + gait, 39, 4, 'rock');
  line(17, 23, 10, 34 + reach, 5, 'rock'); line(30, 23, 38, 31 + reach, 5, 'stone');
  oval(24, 27, 9, 9, 'rock', 'stone'); oval(24, 28, 5, 6, 'bark', 'skin');
  oval(24, 16, 7, 6, 'rock', 'stone'); oval(24, 18, 5, 3, 'earth', 'skin'); eye(21, 16); eye(26, 16);
  polygon([[19, 12], [24, 7], [29, 12]], 'purple'); oval(37, 33 + reach, 4, 4, 'rock', 'stone');
}
function eagle(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  polygon([[21, 22], [8, 12 - gait], [5, 20], [10, 22], [7, 26], [18, 31]], 'bronze');
  polygon([[27, 22], [39, 10 + gait], [43, 19], [37, 22], [41, 25], [28, 31]], 'earth');
  for (const column of [10, 14, 18]) line(column, 18, column + 5, 26, 1, 'gold');
  polygon([[20, 20], [18, 9], [24, 14], [29, 8], [28, 23]], 'bronze');
  oval(24, 26, 5, 8, 'earth', 'bronze'); oval(24, 33 + reach, 4, 4, 'cloth', 'gold');
  polygon([[23, 35 + reach], [24, 40 + reach], [28, 35 + reach]], 'bronze'); eye(22, 32 + reach);
  line(21, 32, 18 - gait, 36, 1, 'gold'); line(27, 32, 31 + gait, 37, 1, 'gold');
}
function stone(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(20, 32, 18 - gait, 40, 5, 'rock'); line(28, 32, 31 + gait, 40, 5, 'stone');
  polygon([[15, 19], [32, 19], [34, 32], [28, 36], [18, 35]], 'rock');
  polygon([[16, 20], [30, 21], [28, 31], [19, 31]], 'stone');
  line(16, 21, 10, 30 + reach, 5, 'stone'); line(31, 22, 36, 30 + reach, 4, 'rock');
  line(36, 32 + reach, 38, 15 + reach, 2, 'earth'); oval(38, 14 + reach, 4, 5, 'rock', 'stone');
  polygon([[18, 17], [18, 9], [28, 8], [30, 17]], 'stone'); line(22, 9, 24, 17, 1, 'rock');
  eye(21, 14); eye(26, 14); oval(24, 25, 3, 3, 'bronze', 'gold');
  line(23, 23, 25, 27, 1, 'earth');
}
function guard(art) {
  const { oval, line, polygon, eye, gait, reach, direction } = art;
  polygon([[17, 19], [31, 18], [35, 38], [24, 35], [13, 39]], 'purple');
  line(21, 31, 18 - gait, 40, 3, 'void'); line(28, 31, 31 + gait, 40, 3, 'rock');
  oval(24, 25, 8, 8, 'void', 'earth'); line(17, 22, 31, 22, 2, 'bronze'); line(18, 29, 30, 29, 2, 'bronze');
  line(17, 23, 12, 30, 3, 'void'); line(31, 23, 35, 29 + reach, 3, 'earth');
  line(36, 36 + reach, 38, 14 + reach, 2, 'bronze');
  polygon([[38, 14 + reach], [42, 19 + reach], [40, 30 + reach], [36, 28 + reach]], 'stone');
  oval(24, 13, 6, 5, 'void', 'bronze'); polygon([[22, 9], [29, 4], [27, 12]], 'purple');
  if (direction !== 3) { line(20, 14, 28, 14, 1, 'purple'); eye(23, 14); }
}
function archer(art) {
  const { oval, line, polygon, eye, gait, reach, direction } = art;
  polygon([[21, 12], [29, 18], [28, 35], [31 + gait, 39], [22, 37], [17 - gait, 40], [15, 28]], 'purple');
  polygon([[22, 16], [27, 18], [26, 33], [20, 35]], 'void');
  oval(23, 14, 4, 4, 'void', 'teal'); eye(22, 14);
  line(16, 19, 13, 34, 3, 'earth');
  for (const column of [14, 16, 18]) line(column, 13, column - 2, 23, 1, 'bronze');
  line(25, 23, 31 + reach, 24, 2, 'stone');
  line(32, 13, 39 + reach, 24, 2, 'bronze'); line(39 + reach, 24, 32, 36, 2, 'bronze');
  line(32, 13, 32 + reach, 36, 1, 'cloth'); line(25, 25, 40 + reach, 25, 1, 'gold');
  if (direction === 3) polygon([[18, 15], [28, 12], [29, 27], [23, 29]], 'teal');
}
function tiger(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(25, 15, 34, 10, 3, 'cloth'); line(34, 10, 36 + gait, 17, 2, 'bronze');
  for (const [column, row, sign] of [[14, 24, 1], [33, 23, -1], [15, 32, -1], [32, 32, 1]]) {
    line(column, row, column + sign * gait, row + 7, 5, 'cloth');
    for (let claw = 0; claw < 3; claw++) line(column + sign * gait - 2 + claw * 2, row + 6, column + sign * gait - 2 + claw * 2, row + 8, 1, 'bright');
  }
  oval(24, 25, 11, 11, 'cloth', 'bright');
  for (const row of [18, 23, 28]) { line(15, row, 21, row + 3, 2, 'void'); line(33, row, 28, row + 2, 2, 'earth'); }
  polygon([[16, 32], [14, 25], [22, 29]], 'cloth'); polygon([[28, 29], [34, 25], [33, 34]], 'cloth');
  oval(24, 34 + reach, 9, 5, 'cloth', 'bright'); oval(24, 37 + reach, 4, 2, 'earth');
  eye(19, 33 + reach); eye(29, 33 + reach); line(18, 36 + reach, 17, 39 + reach, 1, 'bright');
  oval(24, 30, 2, 2, 'bronze', 'gold');
}
function dragon(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(12, 9, 11 + gait, 18, 5, 'teal'); line(11 + gait, 18, 29, 17, 6, 'water');
  line(29, 17, 34 - gait, 25, 7, 'teal'); line(34 - gait, 25, 24, 31, 7, 'blue');
  for (const [column, row] of [[15, 17], [24, 17], [32, 23]]) polygon([[column, row], [column - 3, row - 7], [column + 3, row - 3]], 'bronze');
  line(24, 31, 18, 37, 5, 'teal'); oval(18, 35 + reach, 7, 5, 'teal', 'blue');
  line(13, 31, 9, 24, 2, 'gold'); line(22, 30, 25, 23, 2, 'bronze');
  line(13, 36 + reach, 7, 37 + reach, 1, 'cloth'); line(22, 36 + reach, 29, 38 + reach, 1, 'cloth');
  eye(15, 34 + reach); eye(22, 34 + reach); polygon([[15, 39 + reach], [18, 35 + reach], [21, 39 + reach]], 'bright');
  line(30, 27, 39, 31 + gait, 2, 'bronze'); line(39, 31 + gait, 41, 35, 1, 'gold');
}
function bull(art) {
  const { oval, line, polygon, eye, gait, reach } = art;
  line(24, 15, 18 + gait, 8, 2, 'rock'); oval(18 + gait, 8, 2, 2, 'purple');
  for (const [column, row, sign] of [[15, 21, 1], [32, 21, -1], [14, 32, -1], [32, 32, 1]]) line(column, row, column + sign * gait, row + 7, 5, 'rock');
  oval(24, 24, 12, 10, 'rock', 'stone');
  for (const [column, row] of [[18, 18], [26, 18], [16, 26], [27, 26]]) polygon([[column - 3, row], [column + 4, row - 2], [column + 5, row + 4], [column, row + 5]], 'stone');
  line(17, 30, 10, 26 + reach, 3, 'bronze'); line(10, 26 + reach, 11, 20 + reach, 2, 'gold');
  line(31, 30, 38, 25 + reach, 3, 'bronze'); line(38, 25 + reach, 37, 20 + reach, 2, 'gold');
  oval(24, 34 + reach, 8, 6, 'rock', 'stone'); oval(24, 38 + reach, 5, 2, 'earth', 'bronze');
  eye(19, 33 + reach); eye(29, 33 + reach); line(23, 31, 25, 35, 1, 'purple');
}
function demon(art) {
  const { oval, line, polygon, eye, gait, reach, direction } = art;
  polygon([[18, 20], [10, 13 - gait], [7, 30], [14, 28], [13, 39], [22, 35]], 'void');
  polygon([[29, 19], [39, 10 + gait], [42, 28], [35, 27], [37, 38], [28, 35]], 'purple');
  polygon([[19, 19], [29, 18], [32, 34], [26, 40], [23, 35], [17, 40], [16, 30]], 'void');
  line(18, 23, 10, 30 + reach, 3, 'purple'); line(30, 22, 38, 31 + reach, 3, 'rock');
  for (const column of [8, 11, 35, 38]) line(column, 30 + reach, column - 2, 35 + reach, 1, 'gold');
  oval(24, 14, 5, 5, 'void', 'purple');
  line(19, 12, 15, 6, 2, 'bronze'); line(29, 12, 33, 5, 2, 'gold');
  polygon([[20, 8], [24, 4], [28, 8]], 'bronze');
  if (direction !== 3) { eye(22, 14); eye(27, 14); }
  oval(24, 25, 4, 4, 'bronze', 'gold'); line(21, 25, 27, 25, 1, 'purple'); line(24, 22, 24, 28, 1, 'void');
}
const renderers = { bamboo, wisp, wolf, snake, fish, leech, scorpion, ape, eagle, stone, guard, archer, tiger, dragon, bull, demon };

function sheet(role, size) {
  const width = size * 24, height = size * 4, pixels = Buffer.alloc(width * height * 4);
  for (let direction = 0; direction < 4; direction++) for (let frame = 0; frame < 24; frame++) {
    const local = Buffer.alloc(48 * 48 * 4);
    renderers[role](tools(local, role, direction, frame));
    for (let row = 2; row < size * 7 / 8; row++) for (let column = 2; column < size - 2; column++) {
      const source = (Math.floor(row * 48 / size) * 48 + Math.floor(column * 48 / size)) * 4;
      local.copy(pixels, ((direction * size + row) * width + frame * size + column) * 4, source, source + 4);
    }
  }
  return { width, height, pixels };
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
for (const [id, role] of designs) {
  const data = png(sheet(role, elites.includes(id) ? 64 : 48));
  fs.writeFileSync(path.join(output, id + '.png'), data); bytes += data.length;
}
console.log('Original offline enemy artwork: 12 common 48px + 4 elite 64px, 16 sheets, 1536 frames, ' + bytes + ' bytes.');
