import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';

const manifestSource = fs.readFileSync(new URL('../src/game/assets/spriteManifest.ts', import.meta.url), 'utf8');
const { SPRITE_MANIFEST, DIRECTIONS } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(manifestSource)).toString('base64'));
const palette = {
  outline: [24, 29, 36, 255], skin: [217, 159, 109, 255], skinLight: [247, 200, 142, 255], skinDark: [155, 91, 67, 255],
  hair: [37, 35, 44, 255], hairLight: [63, 60, 66, 255], bronze: [172, 108, 47, 255], gold: [233, 185, 83, 255], cream: [255, 231, 151, 255],
  cloth: [40, 117, 123, 255], clothLight: [65, 162, 155, 255], clothDark: [31, 67, 83, 255], red: [180, 60, 64, 255],
  bark: [90, 104, 64, 255], barkLight: [139, 151, 86, 255], barkDark: [48, 64, 47, 255], moss: [64, 122, 72, 255],
  green: [177, 245, 130, 255], ghost: [108, 199, 204, 230], mist: [57, 118, 151, 130], white: [217, 255, 237, 255],
  tiger: [162, 102, 85, 255], tigerLight: [223, 150, 98, 255], stripe: [55, 41, 65, 255], purple: [168, 103, 221, 255],
  earth: [226, 197, 112, 255], fire: [254, 121, 63, 255], water: [86, 206, 227, 255],
};
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}
function png(width, height, pixel) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) raw.set(pixel(column, row), row * (width * 4 + 1) + 1 + column * 4);
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function canvas(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const dot = (horizontal, vertical, color) => {
    const column = Math.round(horizontal), row = Math.round(vertical);
    if (column > 0 && column < size - 1 && row > 0 && row < size - 1) pixels.set(palette[color] ?? color, (row * size + column) * 4);
  };
  const rect = (horizontal, vertical, width, height, color) => {
    for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) dot(horizontal + column, vertical + row, color);
  };
  const ellipse = (horizontal, vertical, width, height, color) => {
    for (let row = Math.floor(vertical - height); row <= vertical + height; row++) {
      for (let column = Math.floor(horizontal - width); column <= horizontal + width; column++) {
        if (((column - horizontal) / width) ** 2 + ((row - vertical) / height) ** 2 <= 1) dot(column, row, color);
      }
    }
  };
  const line = (fromX, fromY, toX, toY, color, thickness = 1) => {
    const steps = Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY))) || 1;
    for (let step = 0; step <= steps; step++) rect(fromX + (toX - fromX) * step / steps, fromY + (toY - fromY) * step / steps, thickness, thickness, color);
  };
  const limb = (fromX, fromY, toX, toY, color, light, thickness = 3) => {
    line(fromX - 1, fromY - 1, toX - 1, toY - 1, 'outline', thickness + 2);
    line(fromX, fromY, toX, toY, color, thickness);
    line(fromX, fromY, toX, toY, light);
  };
  return { pixels, dot, rect, ellipse, line, limb };
}
function heroWeapon(draw, fromX, fromY, toX, toY, weapon) {
  const length = Math.hypot(toX - fromX, toY - fromY) || 1;
  const axisX = (toX - fromX) / length;
  const axisY = (toY - fromY) / length;
  const normalX = -axisY;
  const normalY = axisX;
  const tipX = fromX + (toX - fromX) * 0.8;
  const tipY = fromY + (toY - fromY) * 0.8;
  draw.line(fromX, fromY, tipX, tipY, 'outline', 3);
  draw.line(fromX, fromY, tipX, tipY, 'bronze');
  if (weapon === 'axe') {
    for (const side of [-1, 1]) {
      const bladeX = tipX + normalX * side * 3;
      const bladeY = tipY + normalY * side * 3;
      draw.ellipse(bladeX, bladeY, 4, 4, 'outline');
      draw.ellipse(bladeX, bladeY, 3, 3, 'bronze');
      draw.line(bladeX - axisX * 2, bladeY - axisY * 2, bladeX + axisX * 2, bladeY + axisY * 2, 'gold');
    }
    draw.dot(tipX, tipY, 'cream');
  } else {
    const guardX = fromX + axisX * 7;
    const guardY = fromY + axisY * 7;
    draw.line(guardX, guardY, tipX, tipY, 'outline', 4);
    draw.line(guardX, guardY, tipX, tipY, 'gold', 2);
    draw.line(guardX, guardY, tipX, tipY, 'cream');
    draw.line(guardX - normalX * 3, guardY - normalY * 3, guardX + normalX * 3, guardY + normalY * 3, 'bronze', 2);
    draw.dot(fromX, fromY, 'gold');
  }
}
function heroPose(direction, state, frame, count, weapon = 'spear') {
  const draw = canvas(48);
  const { rect, ellipse, line, limb, dot } = draw;
  const progress = frame / Math.max(1, count - 1);
  const phase = frame * Math.PI * 2 / count;
  const side = direction === 'left' || direction === 'right';
  const facing = direction === 'left' ? -1 : 1;
  const back = direction === 'up';
  const moving = state === 'walk' || state === 'run';
  const striking = state.startsWith('attack');
  const casting = ['earth', 'fire', 'water'].includes(state);
  const crouch = state === 'dodge' ? 4 + frame : state === 'hit' ? 2 : 0;
  const lean = state === 'dodge' ? facing * (frame - 2) : state === 'hit' ? -3 + frame * 2 : state === 'run' ? facing * 2 : striking ? Math.round(Math.sin(progress * Math.PI) * facing * 3) : 0;
  const bob = moving ? Math.round(Math.sin(phase) * 1.5) : state === 'idle' ? [0, -1, 0, 1][frame] : 0;
  const center = 24 + lean;
  const headY = 14 + bob + crouch;
  const stride = moving ? Math.round(Math.sin(phase) * (state === 'run' ? 5 : 3)) : 0;
  if (state === 'death') {
    const sink = frame * 2;
    limb(20, 32 + sink / 2, 14 - frame, 42, 'clothDark', 'cloth', 4);
    limb(27, 33 + sink / 2, 35 + frame, 41, 'skinDark', 'skin', 3);
    ellipse(24, 29 + sink, 8 + frame, 7 - frame / 2, 'outline');
    ellipse(24, 28 + sink, 7 + frame, 5 - frame / 3, 'cloth');
    ellipse(24 + (side ? facing * frame : 0), 23 + sink * 1.3, 6, 5, 'hair');
    if (!back) ellipse(24 + (side ? facing * 3 : 0), 25 + sink * 1.2, side ? 3 : 4, 3, 'skin');
    if (weapon === 'spear') line(9, 42 - frame, 38, 38 + frame / 2, 'bronze', 2);
    else heroWeapon(draw, 9, 42 - frame, 38, 38 + frame / 2, weapon);
    return draw.pixels;
  }
  const weaponAngle = state === 'attack1' ? -2.5 + progress * 3.6 : state === 'attack2' ? 0.8 - progress * 3.8 : state === 'attack3' ? -1.6 + progress * 1.8 : -1.35;
  const weaponX = center + (side ? facing * 4 : back ? -8 : 9);
  const weaponY = 25 + crouch;
  const tipX = striking ? center + facing * Math.cos(weaponAngle) * 19 : weaponX + 3 * facing;
  const tipY = striking ? 25 + Math.sin(weaponAngle) * 19 : 5 + crouch;
  if (striking && frame > 0 && frame < count - 1) {
    const arcColor = state === 'attack3' ? 'cream' : 'gold';
    for (let arc = 0; arc < 5; arc++) {
      const angle = weaponAngle - arc * 0.15 * (state === 'attack2' ? -1 : 1);
      dot(center + facing * Math.cos(angle) * 21, 25 + Math.sin(angle) * 21, arcColor);
    }
  }
  limb(center - 5, 31 + crouch, center - 5 + stride, 40, 'skinDark', 'skin', 3);
  limb(center + 3, 31 + crouch, center + 3 - stride, 40, 'skinDark', 'skinLight', 3);
  rect(center - 6 + stride, 40, 5, 3, 'outline'); rect(center + 2 - stride, 40, 5, 3, 'outline');
  rect(center - 5 + stride, 37, 4, 3, 'bronze'); rect(center + 3 - stride, 37, 3, 3, 'gold');
  limb(center - 6, 22 + crouch, center - 9 - stride, 29 + crouch + (moving ? Math.round(Math.cos(phase) * 2) : 0), 'skinDark', 'skin', 3);
  ellipse(center, 26 + crouch + bob, side ? 6 : 8, 9, 'outline');
  ellipse(center, 25 + crouch + bob, side ? 5 : 7, 8, 'clothDark');
  rect(center - 5, 22 + crouch + bob, side ? 6 : 10, 8, 'cloth');
  rect(center - 4, 22 + crouch + bob, 3, 7, 'clothLight');
  rect(center - 7, 30 + crouch, 14, 2, 'bronze');
  rect(center - 6, 32 + crouch, 12, 3, 'red');
  line(center - 1, 33 + crouch, center + 3 + Math.round(Math.sin(phase) * 2), 38, 'red', 2);
  if (!back) { ellipse(center, 26 + crouch + bob, 3, 3, 'bronze'); dot(center, 25 + crouch + bob, 'cream'); }
  else { line(center - 5, 21 + crouch, center + 4, 30 + crouch, 'gold', 2); }
  ellipse(center, headY, side ? 5 : 6, 6, 'outline');
  ellipse(center, headY - 1, side ? 4 : 5, 5, 'hair');
  if (!back) {
    ellipse(center + (side ? facing * 2 : 0), headY + 2, side ? 3 : 4, 3, 'skin');
    rect(center - (side ? 0 : 3), headY + 1, 2, 1, 'skinLight');
    dot(center + (side ? facing * 3 : -2), headY + 1, 'outline');
    if (!side) dot(center + 2, headY + 1, 'outline');
    if (side) dot(center + facing * 5, headY + 2, 'skinLight');
  } else { line(center - 3, headY, center + 3, headY + 2, 'hairLight'); rect(center - 2, headY + 4, 4, 4, 'hair'); }
  rect(center - 5, headY - 3, 10, 2, 'bronze'); dot(center - 3, headY - 3, 'cream');
  line(center + (back ? -2 : 1), headY - 4, center + 2 + Math.round(Math.sin(phase) * 2), headY - 10 + Math.round(Math.cos(phase)), 'gold', 2);
  dot(center + 2 + Math.round(Math.sin(phase) * 2), headY - 10 + Math.round(Math.cos(phase)), 'cream');
  let handX = striking ? center + facing * Math.cos(weaponAngle) * 8 : weaponX;
  let handY = striking ? 25 + Math.sin(weaponAngle) * 8 : 28 + crouch - (moving ? stride + Math.round(Math.cos(phase) * 2) : 0);
  if (casting || state === 'victory') { handX = center + facing * (5 + frame); handY = 20 - frame * 2; }
  if (state === 'interaction') { handX = center + facing * (9 + frame); handY = 25 - frame; }
  limb(center + (side ? facing * 3 : 5), 23 + crouch, handX, handY, 'skinDark', 'skinLight', 3);
  if (!casting && state !== 'interaction') {
    if (weapon === 'spear') {
      line(weaponX - (striking ? facing * 6 : 0), weaponY + 10, tipX, tipY, 'outline', 3);
      line(weaponX - (striking ? facing * 6 : 0), weaponY + 10, tipX, tipY, 'bronze');
      ellipse(tipX, tipY, striking ? 3 : 2, striking ? 2 : 4, 'gold'); dot(tipX - 1, tipY - 2, 'cream');
    } else heroWeapon(draw, handX, handY + 4, tipX, tipY, weapon);
  } else if (weapon !== 'spear') {
    heroWeapon(draw, center - 10, 35 + crouch, center - 12, 13 + crouch, weapon);
  }
  if (casting) {
    ellipse(handX, handY, 2 + frame / 2, 2 + frame / 2, state);
    dot(handX, handY - 1, 'cream');
    for (let spark = 0; spark < 3; spark++) {
      const angle = phase + spark * 2.1;
      dot(handX + Math.cos(angle) * (5 + frame), handY + Math.sin(angle) * (5 + frame), state);
    }
    if (state === 'earth') rect(center - 8 - frame, 41 - frame, 3, 2 + frame, 'earth');
    if (state === 'fire') line(handX - 2, handY, handX + frame - 1, handY - 5 - frame, 'fire', 2);
    if (state === 'water') line(center - 10, 40, center - 5 + frame * 2, 38 - frame, 'water');
  }
  return draw.pixels;
}
function treePose(direction, state, frame, count) {
  const draw = canvas(48);
  const { ellipse, line, limb, dot, rect } = draw;
  const side = direction === 'left' || direction === 'right';
  const facing = direction === 'left' ? -1 : 1;
  const phase = frame * Math.PI * 2 / count;
  const sway = Math.round(Math.sin(phase) * 2);
  const center = 24 + (state === 'hit' ? frame - 2 : sway) + (state === 'death' && side ? facing * 2 : 0);
  const fallen = state === 'death';
  const height = fallen ? 12 - frame : 17;
  const top = fallen ? 37 : 25 + (state === 'attack' ? 1 + frame % 2 : state === 'walk' ? -1 : 0);
  limb(center - 4, 34, 14 - sway, 41, 'barkDark', 'barkLight', 4);
  limb(center + 3, 34, 33 + sway, 42 - (state === 'walk' ? frame % 3 : 0), 'barkDark', 'bark', 4);
  const reach = state === 'attack' ? frame * 3 : 0;
  limb(center - 7, top - 3, center - 16 - (facing < 0 ? reach : 0), top + 7 - frame, 'barkDark', 'bark', 4);
  limb(center + 6, top - 3, center + 13 + (facing > 0 ? reach : 0), top + 8 - frame, 'barkDark', 'barkLight', 4);
  ellipse(center, top, fallen ? 12 + frame : side ? 7 : 9, height, 'outline');
  ellipse(center, top - 1, fallen ? 11 + frame : side ? 6 : 8, height - 1, 'bark');
  for (let groove = 0; groove < 4; groove++) line(center - 5 + groove * 3, top - height + 3, center - 6 + groove * 3, top + height - 2, 'barkDark');
  line(center - 4, top - 7, center - 1, top - 3, 'green'); line(center - 1, top - 3, center - 4, top + 3, 'moss');
  if (direction !== 'up' && !fallen) {
    rect(center + (side ? facing * 2 : -5), top - 7, 3, 2, 'green');
    if (!side) rect(center + 3, top - 7, 3, 2, 'green');
    line(center - 3 + (side ? facing * 2 : 0), top - 1, center + 3, top + 1, 'outline', 2);
  }
  for (let branch = 0; branch < 3; branch++) {
    const rootX = center - 7 + branch * 7;
    limb(rootX, top - height + 4, rootX - 4 + frame % 3, top - height - 6 + branch * 2, 'barkDark', 'barkLight', 2);
    ellipse(rootX - 5 + frame % 3, top - height - 5 + branch * 2, 4, 2, 'moss');
    dot(rootX - 5, top - height - 6 + branch * 2, 'barkLight');
  }
  if (fallen) { line(12 + frame, 38, 34 - frame, 36, 'green'); rect(9 + frame * 3, 42, 3, 2, 'barkLight'); }
  if (direction === 'up') line(center - 5, top - 11, center + 3, top + 8, 'moss', 2);
  return draw.pixels;
}
function ghostPose(direction, state, frame, count) {
  const draw = canvas(32);
  const { ellipse, line, dot } = draw;
  const phase = frame * Math.PI * 2 / count;
  const facing = direction === 'left' ? -1 : 1;
  const side = direction === 'left' || direction === 'right';
  const center = 16 + (state === 'hit' ? frame - 2 : Math.round(Math.sin(phase))) + (state === 'walk' ? facing * 2 : 0);
  const top = 13 + Math.round(Math.cos(phase)) + (state === 'death' ? frame : state === 'hit' ? -2 - frame : 0);
  ellipse(center, top + 3, 11, 12 - frame / 3, 'mist');
  ellipse(center, top, state === 'death' ? 8 - frame / 2 : 8, 9, 'ghost');
  ellipse(center - 1, top - 1, 5, 6, 'white');
  ellipse(center + 1, top + 1, 4, 5, 'ghost');
  const eyes = direction === 'up' ? top - 4 : top;
  if (direction === 'up') line(center - 3, eyes, center + 3, eyes - 2, 'water');
  else {
    dot(center + (side ? facing * 3 : -3), eyes, 'outline');
    if (!side) dot(center + 3, eyes, 'outline');
    line(center - 1, eyes + 3, center + 1, eyes + 3, 'clothDark');
  }
  for (let flame = 0; flame < 4; flame++) {
    const rootX = center - 6 + flame * 4;
    line(rootX, top + 5, rootX + Math.sin(phase + flame) * 4, 26 - (frame + flame) % 4, 'ghost', 2);
    dot(rootX + Math.sin(phase + flame) * 4, 27 - (frame + flame) % 4, 'white');
  }
  if (state === 'attack') {
    ellipse(center + facing * (6 + frame), top - 5, 2 + frame / 2, 3, 'water');
    dot(center + facing * (6 + frame), top - 6, 'white');
  }
  if (state === 'death') for (let spark = 0; spark < 6; spark++) dot(4 + spark * 4, 8 + (spark * 3 + frame * 2) % 20, 'white');
  return draw.pixels;
}
function tigerPose(direction, state, frame, count) {
  const draw = canvas(48);
  const { ellipse, limb, line, rect, dot } = draw;
  const side = direction === 'left' || direction === 'right';
  const facing = direction === 'left' ? -1 : 1;
  const phase = frame * Math.PI * 2 / count;
  const stride = state === 'walk' ? 1 + Math.round(Math.sin(phase) * 3) : 0;
  const lunge = state === 'attack' ? Math.round(Math.sin(frame / (count - 1) * Math.PI) * 4) : 0;
  const center = 24 + (state === 'hit' ? frame - 2 : side ? facing * lunge : 0);
  const bodyY = state === 'death' ? 33 + frame : 27 + Math.round(Math.sin(phase));
  const headX = side ? center + facing * 11 : center;
  const headY = direction === 'up' ? bodyY - 9 : side ? bodyY - 3 : bodyY + 2;
  line(center - facing * 9, bodyY, center - facing * 17, bodyY - 8 + frame, 'outline', 3);
  line(center - facing * 9, bodyY, center - facing * 17, bodyY - 8 + frame, 'tiger', 2);
  for (let leg = 0; leg < 4; leg++) {
    const legX = center - 9 + leg * 6;
    limb(legX, bodyY + 2, legX + (leg % 2 ? stride : -stride), state === 'death' ? 42 - leg : 41 - leg % 2, 'stripe', 'tigerLight', 3);
    rect(legX + (leg % 2 ? stride : -stride), 40 - leg % 2, 4, 2, 'cream');
  }
  ellipse(center, bodyY, side ? 13 : 10, state === 'death' ? 5 : side ? 8 : 11, 'outline');
  ellipse(center, bodyY - 1, side ? 12 : 9, state === 'death' ? 4 : side ? 7 : 10, 'tiger');
  ellipse(center - 2, bodyY - 4, side ? 9 : 6, 3, 'tigerLight');
  for (let stripe = 0; stripe < 4; stripe++) line(center - 8 + stripe * 5, bodyY - 6, center - 10 + stripe * 5, bodyY + 3, 'stripe', 2);
  line(center - 5, bodyY - 3, center + 2, bodyY - 6, 'purple');
  ellipse(headX, headY, 8, 7, 'outline'); ellipse(headX, headY - 1, 7, 6, 'tigerLight');
  ellipse(headX - 5, headY - 6, 3, 3, 'stripe'); ellipse(headX + 5, headY - 6, 3, 3, 'stripe');
  if (direction !== 'up') {
    ellipse(headX + (side ? facing * 3 : 0), headY + 2, 5, 3, 'cream');
    dot(headX + (side ? facing * 4 : 0), headY + 1, 'stripe');
    rect(headX + (side ? facing : -4), headY - 2, 2, 2, state === 'death' ? 'stripe' : 'purple');
    if (!side) rect(headX + 3, headY - 2, 2, 2, state === 'death' ? 'stripe' : 'purple');
  } else { line(headX - 4, headY - 3, headX, headY + 3, 'stripe', 2); line(headX + 4, headY - 3, headX, headY + 3, 'stripe', 2); }
  if (state === 'attack') for (let claw = 0; claw < 3; claw++) line(headX - 5 + claw * 5, headY + 6, headX - 8 + claw * 5, headY + 10 + frame, 'purple');
  if (state === 'death') dot(center - 9 + frame * 3, bodyY - 5, 'purple');
  return draw.pixels;
}
function wolfPose(direction, state, frame, count) {
  const draw = canvas(48);
  const { ellipse, limb, line, rect, dot } = draw;
  const side = direction === 'left' || direction === 'right';
  const facing = direction === 'left' ? -1 : 1;
  const phase = frame * Math.PI * 2 / count;
  const stride = state === 'walk' ? 1 + Math.round(Math.sin(phase) * 4) : 0;
  const crouch = state === 'attack' ? 3 - frame : state === 'death' ? 5 + frame : 0;
  const center = 24 + (state === 'hit' ? frame - 2 : 0);
  const bodyY = 27 + Math.round(Math.sin(phase)) + crouch;
  const headX = side ? center + facing * 11 : center;
  const headY = direction === 'up' ? bodyY - 10 : side ? bodyY - 7 : bodyY + 2;
  line(center - facing * 9, bodyY, center - facing * 17, bodyY - 8 + frame, 'outline', 4);
  line(center - facing * 9, bodyY, center - facing * 17, bodyY - 8 + frame, 'clothDark', 2);
  for (let leg = 0; leg < 4; leg++) {
    const legX = center - 8 + leg * 5;
    limb(legX, bodyY, legX + (leg % 2 ? stride : -stride), 41 - leg % 2 - (state === 'death' ? frame : 0), 'hair', 'hairLight', 2);
  }
  ellipse(center, bodyY, side ? 11 : 7, state === 'death' ? 4 : 7, 'outline');
  ellipse(center, bodyY - 1, side ? 10 : 6, state === 'death' ? 3 : 6, 'clothDark');
  line(center - 7, bodyY - 4, center + 7, bodyY - 5, 'hairLight', 2);
  ellipse(headX, headY, 6, 6, 'outline'); ellipse(headX, headY, 5, 5, 'hairLight');
  limb(headX - 4, headY - 2, headX - 5, headY - 9, 'hair', 'hairLight', 2);
  limb(headX + 3, headY - 2, headX + 4, headY - 9, 'hair', 'hairLight', 2);
  if (direction !== 'up') {
    ellipse(headX + (side ? facing * 4 : 0), headY + 3, side ? 5 : 3, 2, 'clothLight');
    dot(headX + (side ? facing * 7 : 0), headY + 3, 'outline');
    rect(headX + (side ? facing * 2 : -3), headY, 2, 1, state === 'death' ? 'outline' : 'gold');
    if (!side) rect(headX + 2, headY, 2, 1, state === 'death' ? 'outline' : 'gold');
  } else line(headX - 3, headY - 2, headX + 3, headY, 'clothDark', 2);
  if (state === 'attack') {
    line(headX - 2, headY + 4, headX + 3, headY + 6 + frame, 'outline', 2);
    dot(headX - 1, headY + 5 + frame, 'cream'); dot(headX + 2, headY + 5 + frame, 'cream');
  }
  return draw.pixels;
}
function spiderPose(direction, state, frame, count) {
  const draw = canvas(48);
  const { ellipse, limb, line, rect, dot } = draw;
  const phase = frame * Math.PI * 2 / count;
  const facing = direction === 'left' ? -1 : 1;
  const side = direction === 'left' || direction === 'right';
  const center = 24 + (state === 'hit' ? frame - 2 : 0);
  const top = 26 + (state === 'death' ? frame : Math.round(Math.sin(phase))) + (state === 'walk' ? -2 : state === 'attack' ? 2 : 0);
  const headX = center + (side ? facing * 5 : 0);
  const headY = top + (direction === 'up' ? -6 : side ? 1 : 7);
  for (let leg = 0; leg < 8; leg++) {
    const sign = leg < 4 ? -1 : 1;
    const rootY = top - 6 + leg % 4 * 4;
    const gait = state === 'walk' ? Math.round(Math.sin(phase + leg) * 3) : 0;
    const reach = state === 'attack' && leg % 4 === 3 ? frame * 2 : 0;
    const kneeX = center + sign * (12 + gait - (state === 'death' ? frame : 0));
    limb(center + sign * 4, rootY, kneeX, rootY - 4, 'barkDark', 'moss', 2);
    limb(kneeX, rootY - 4, center + sign * (17 + gait - (state === 'death' ? frame * 2 : 0)), rootY + 7 + reach, 'barkDark', 'barkLight', 2);
  }
  ellipse(center, top - 2, side ? 9 : 7, state === 'death' ? 5 : 9, 'outline');
  ellipse(center, top - 3, side ? 8 : 6, state === 'death' ? 4 : 8, 'barkDark');
  ellipse(center - 2, top - 6, 4, 4, 'moss');
  for (let thorn = 0; thorn < 3; thorn++) line(center - 5 + thorn * 5, top - 8, center - 6 + thorn * 5, top - 13 - frame % 2, 'barkLight', 2);
  ellipse(headX, headY, 5, 4, 'outline'); ellipse(headX, headY - 1, 4, 3, 'bark');
  if (direction !== 'up') {
    rect(headX - 3, headY - 1, 2, 1, state === 'death' ? 'outline' : 'green');
    rect(headX + 2, headY - 1, 2, 1, state === 'death' ? 'outline' : 'green');
    line(headX - 3, headY + 2, headX - 2, headY + 5 + (state === 'attack' ? frame : 0), 'cream');
    line(headX + 3, headY + 2, headX + 2, headY + 5 + (state === 'attack' ? frame : 0), 'cream');
  } else line(headX - 3, headY, headX + 3, headY - 1, 'moss');
  dot(center - 2 + Math.round(Math.cos(phase)), top - 4, 'green');
  return draw.pixels;
}
function bossCanvas(direction, state, frame, count) {
  const draw = canvas(96);
  const progress = frame / Math.max(1, count - 1);
  const phase = frame * Math.PI * 2 / count;
  const side = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  const facing = direction === 'left' ? -1 : 1;
  const sink = state === 'death' ? 8 + frame * 4 : 0;
  const bob = state === 'idle' ? frame - 1 : state === 'walk' ? Math.round(Math.sin(phase) * 3) : 0;
  const recoil = state === 'hit' ? -8 + frame * 3 : 0;
  const crouch = state === 'windup' ? 3 + frame * 2 : state === 'attack' ? -4 + frame : state === 'transition' ? frame : 0;
  const point = (horizontal, vertical) => [48 + facing * (horizontal * (side ? 0.76 : 1) + recoil), 84 + (vertical - 84) * (state === 'death' ? 0.75 - progress * 0.4 : 1) + bob + crouch + sink * 0.2];
  const line = (fromX, fromY, toX, toY, color, thickness = 1) => draw.line(...point(fromX, fromY), ...point(toX, toY), color, thickness);
  const polygon = (vertices, color) => {
    const points = vertices.map(([horizontal, vertical]) => point(horizontal, vertical));
    for (let row = Math.ceil(Math.min(...points.map(vertex => vertex[1]))); row <= Math.max(...points.map(vertex => vertex[1])); row++) {
      const cuts = points.flatMap(([horizontal, vertical], index) => {
        const next = points[(index + 1) % points.length];
        return (vertical <= row && next[1] > row) || (next[1] <= row && vertical > row) ? [horizontal + (row - vertical) * (next[0] - horizontal) / (next[1] - vertical)] : [];
      }).sort((first, second) => first - second);
      for (let index = 0; index + 1 < cuts.length; index += 2) draw.line(Math.ceil(cuts[index]), row, Math.floor(cuts[index + 1]), row, color);
    }
  };
  return { draw, line, polygon, point, progress, phase, side, back };
}
function serpentPose(direction, state, frame, count) {
  const { draw, line, polygon, point, phase, side, back } = bossCanvas(direction, state, frame, count);
  const coil = state === 'windup' ? -frame * 2 : state === 'attack' ? frame * 3 - 5 : state === 'transition' ? -frame * 3 : 0;
  const headX = side ? 17 + coil : back ? -8 : 8;
  const headY = (back ? 30 : side ? 36 : 48) + (state === 'attack' ? frame * 2 : -coil);
  const joints = Array.from({ length: 9 }, (_, index) => [-25 + index * 6 + Math.sin(phase + index * 0.8) * (state === 'walk' ? 6 : 2), 73 - index * 2 + Math.sin(index * 0.8 + phase) * 9]);
  for (let index = 0; index < joints.length - 1; index++) {
    const [horizontal, vertical] = joints[index];
    const next = joints[index + 1];
    const thickness = 3 + index;
    line(horizontal, vertical, ...next, 'outline', thickness + 3);
    line(horizontal + 1, vertical, next[0] + 1, next[1], 'clothDark', thickness);
    line(horizontal + 2, vertical, next[0] + 2, next[1], 'clothLight', 2);
    polygon([[horizontal, vertical - 3], [horizontal - 3, vertical - 13 - index % 3], [horizontal + 5, vertical - 4]], 'water');
    for (let scale = 0; scale < 3; scale++) line(horizontal + scale * 2, vertical + scale % 2, horizontal + scale * 2 + 1, vertical + 3 + scale % 2, 'gold');
  }
  line(20, 60, headX, headY + 8, 'outline', 13);
  line(21, 60, headX + 1, headY + 8, 'cloth', 9);
  for (const sign of [-1, 1]) {
    const clawY = 65 + (state === 'walk' ? Math.round(Math.sin(phase + sign) * 5) : frame);
    line(sign * 13, 59, sign * 23, clawY, 'clothDark', 4);
    for (let claw = 0; claw < 3; claw++) line(sign * 23, clawY, sign * (25 + claw * 2), clawY + 5 - claw, 'cream', 2);
    polygon([[headX + sign * 5, headY], [headX + sign * 18, headY - 8], [headX + sign * 12, headY + 9]], 'clothLight');
    line(headX + sign * 5, headY - 6, headX + sign * 8, headY - 21, 'bronze', 3);
    line(headX + sign * 8, headY - 21, headX + sign * 12, headY - 25, 'cream', 2);
  }
  polygon([[headX - 9, headY - 10], [headX + 6, headY - 12], [headX + 12, headY + 2], [headX + 7, headY + 12], [headX - 8, headY + 8]], 'outline');
  polygon([[headX - 7, headY - 8], [headX + 5, headY - 10], [headX + 9, headY + 2], [headX + 5, headY + 9], [headX - 6, headY + 6]], 'clothLight');
  if (side) {
    polygon([[headX + 1, headY], [headX + 18, headY + 2], [headX + 19, headY + 9], [headX + 4, headY + 10]], 'outline');
    polygon([[headX + 3, headY + 2], [headX + 16, headY + 3], [headX + 17, headY + 7], [headX + 4, headY + 8]], 'clothLight');
    line(headX + 3, headY - 3, headX + 7, headY - 3, 'gold', 2);
    line(headX + 8, headY + 6, headX + 17, headY + 6 + (state === 'attack' ? frame : 0), 'outline', 2);
    line(headX + 12, headY + 7, headX + 13, headY + 11, 'cream', 2);
    line(headX + 13, headY + 5, headX + 23, headY + 2 + frame, 'cream');
  } else if (!back) {
    line(headX - 5, headY - 2, headX - 2, headY - 2, state === 'death' ? 'outline' : 'gold', 2);
    line(headX + 3, headY - 3, headX + 6, headY - 3, 'gold', 2);
    line(headX - 5, headY + 5, headX + 7, headY + 4 + (state === 'attack' ? frame : 0), 'outline', 2);
    line(headX - 3, headY + 5, headX - 2, headY + 9, 'cream', 2);
    line(headX - 8, headY + 5, headX - 18, headY + 1 + frame, 'cream');
  } else for (let ridge = 0; ridge < 3; ridge++) line(headX - 4, headY - 5 + ridge * 4, headX + 5, headY - 6 + ridge * 4, 'clothDark', 2);
  if (state === 'transition' || state === 'attack') for (let spark = 0; spark < frame + 2; spark++) draw.dot(...point(headX + 15 + spark * 2, headY + 11 + spark * 3), 'water');
  return draw.pixels;
}
function stonePose(direction, state, frame, count) {
  const { draw, line, polygon, phase, side, back } = bossCanvas(direction, state, frame, count);
  const block = (horizontal, vertical, width, height) => {
    polygon([[horizontal + 3, vertical], [horizontal + width - 3, vertical], [horizontal + width, vertical + 4], [horizontal + width - 1, vertical + height], [horizontal, vertical + height - 3]], 'outline');
    polygon([[horizontal + 4, vertical + 2], [horizontal + width - 4, vertical + 2], [horizontal + width - 2, vertical + 5], [horizontal + width - 3, vertical + height - 2], [horizontal + 2, vertical + height - 4]], 'hairLight');
    line(horizontal + 4, vertical + 3, horizontal + width - 5, vertical + 3, 'ghost', 2);
    line(horizontal + 4, vertical + 6, horizontal + 7, vertical + height - 5, 'outline');
  };
  for (const sign of [-1, 1]) {
    const stride = state === 'walk' ? Math.round(Math.sin(phase) * 5) * sign : 0;
    block(sign < 0 ? -18 : 3, 62 + stride, 15, 15);
    block(sign < 0 ? -20 : 2, 77 + stride * 0.4, 19, 8);
    const lift = state === 'windup' ? -frame * 5 : state === 'attack' ? -18 + frame * 6 : state === 'transition' ? -10 - frame * 3 : frame;
    const shoulderX = sign * (side ? 19 : 24);
    const elbowX = sign * (27 + (state === 'attack' ? frame : 0));
    line(shoulderX, 38, elbowX, 53 + lift, 'outline', 10);
    line(shoulderX + 1, 38, elbowX + 1, 53 + lift, 'bronze', 6);
    block(shoulderX - 8, 30, 16, 17);
    block(elbowX - 7, 49 + lift, 15, 18);
    block(elbowX - 8, 65 + lift, 17, 10);
    for (let finger = 0; finger < 3; finger++) line(elbowX - 5 + finger * 5, 69 + lift, elbowX - 5 + finger * 5, 74 + lift, 'outline');
  }
  block(-19, 29, 39, 34); block(-14, 59, 29, 9); block(-12, 13, 25, 19);
  if (side) {
    block(8, 16, 10, 15);
    line(12, 22, 18, 22, state === 'death' ? 'bronze' : 'gold', 2);
    polygon([[4, 38], [15, 42], [13, 55], [5, 57]], 'bronze');
    line(8, 42, 12, 48, 'gold', 2); line(12, 42, 8, 48, 'gold', 2);
    line(-13, 34, -13, 56, 'outline', 3);
  } else if (!back) {
    polygon([[-12, 38], [0, 33], [12, 38], [9, 55], [0, 59], [-9, 55]], 'bronze');
    polygon([[-8, 40], [0, 37], [8, 40], [5, 52], [0, 55], [-5, 52]], 'outline');
    const rune = state === 'transition' ? 'water' : state === 'death' ? 'bronze' : 'gold';
    line(-4, 42, 4, 48, rune, 2); line(4, 42, -4, 48, rune, 2);
    line(0, 40 - frame % 3, 0, 52 + frame % 3, rune, 2);
    line(-8, 22, -3, 22, rune, 2); line(3, 22, 8, 22, rune, 2);
    line(-6, 28, 6, 28, 'outline', 2);
  } else {
    line(-13, 38, 12, 38, 'bronze', 3); line(-10, 48, 10, 48, 'outline', 2);
    for (let plate = 0; plate < 3; plate++) block(-5, 33 + plate * 8, 10, 7);
  }
  if (state === 'death') for (let crack = 0; crack <= frame; crack++) line(-15 + crack * 5, 30 + crack * 4, -11 + crack * 5, 40 + crack * 5, 'outline', 2);
  return draw.pixels;
}
function shamanPose(direction, state, frame, count) {
  const { draw, line, polygon, phase, side, back } = bossCanvas(direction, state, frame, count);
  const sway = state === 'walk' ? Math.round(Math.sin(phase) * 5) : frame - 1;
  const reach = state === 'windup' ? -frame * 4 : state === 'attack' ? frame * 3 - 4 : state === 'transition' ? -frame * 2 : 0;
  const staffX = side ? 25 : 31;
  line(staffX, 78, staffX + reach * 0.5, 16 + reach, 'outline', 4);
  line(staffX + 1, 78, staffX + 1 + reach * 0.5, 16 + reach, 'bronze', 2);
  polygon([[staffX - 6 + reach * 0.5, 17 + reach], [staffX - 4 + reach * 0.5, 10 + reach], [staffX + 4 + reach * 0.5, 10 + reach], [staffX + 7 + reach * 0.5, 17 + reach], [staffX + reach * 0.5, 23 + reach]], 'hair');
  line(staffX - 3 + reach * 0.5, 12 + reach, staffX + 4 + reach * 0.5, 12 + reach, 'purple', 2);
  line(staffX + reach * 0.5, 13 + reach, staffX + reach * 0.5, 18 + reach, state === 'death' ? 'bronze' : 'water', 2);
  polygon([[-11, 33], [10, 33], [16, 61], [23 + sway, 83], [8, 80], [0, 85], [-12, 81], [-22 + sway, 84], [-16, 57]], 'outline');
  polygon([[-9, 35], [8, 35], [13, 62], [18 + sway, 79], [3, 80], [-16 + sway, 80], [-12, 57]], 'hair');
  for (let fold = 0; fold < 5; fold++) line(-9 + fold * 4, 42, -15 + fold * 7 + sway, 78, fold % 2 ? 'hairLight' : 'clothDark', 2);
  line(-10, 51, 10, 51, 'bronze', 3);
  for (const sign of [-1, 1]) {
    const handX = sign < 0 ? -24 - reach * 0.4 : staffX;
    const handY = sign < 0 ? 53 + reach : 45 + reach;
    polygon([[sign * 9, 35], [handX - 5, handY - 9], [handX + 5, handY + 4], [sign * 11, 55]], 'clothDark');
    line(sign * 11, 39, handX, handY, 'hairLight', 3);
    line(handX - 2, handY, handX + 2, handY, 'skinLight', 3);
  }
  polygon([[-13, 20], [-10, 8], [-4, 15], [0, 7], [5, 15], [12, 8], [14, 23], [9, 32], [-9, 32]], 'outline');
  line(-10, 18, 11, 18, 'bronze', 3);
  for (const sign of [-1, 1]) { line(sign * 9, 17, sign * 18, 8 + frame, 'purple', 2); line(sign * 9, 18, sign * 16, 35 + frame, 'bronze', 2); }
  if (side) {
    polygon([[1, 20], [10, 21], [16, 27], [10, 28], [10, 33], [4, 36], [0, 30]], 'cream');
    line(6, 25, 11, 25, 'outline', 2); line(9, 32, 12, 32, 'red');
    line(-5, 23, -5, 42, 'purple', 2);
    line(5, 55, 7, 75, 'bronze', 2);
  } else if (!back) {
    polygon([[-8, 20], [8, 20], [7, 31], [0, 37], [-7, 31]], 'cream');
    line(-6, 25, -2, 24, 'outline', 2); line(2, 24, 6, 25, 'outline', 2);
    line(0, 25, -1, 30, 'bronze', 2); line(-3, 32, 3, 32, 'red');
    line(0, 55, 0, 74, 'bronze', 2); line(-4, 65, 4, 61, 'purple', 2);
  } else {
    polygon([[-8, 21], [8, 21], [9, 33], [-8, 33]], 'hair');
    for (let braid = 0; braid < 3; braid++) line(-5 + braid * 5, 23, -8 + braid * 7, 45 + braid * 3, 'purple', 2);
    polygon([[-7, 57], [0, 52], [7, 57], [0, 67]], 'bronze');
  }
  if (state === 'attack' || state === 'transition') for (let spark = 0; spark < frame + 2; spark++) line(-28 + spark * 4, 35 + reach - spark * 3, -26 + spark * 4, 33 + reach - spark * 3, 'purple', 2);
  return draw.pixels;
}
const painters = { hero: heroPose, hero_axe: (...args) => heroPose(...args, 'axe'), hero_sword: (...args) => heroPose(...args, 'sword'), moctinh: treePose, matroi: ghostPose, hoyer: tigerPose, wolf: wolfPose, spider: spiderPose, thuongluong: serpentPose, thachtuong: stonePose, hacan: shamanPose };
const directory = path.resolve('public/assets/sprites');
fs.mkdirSync(directory, { recursive: true });
for (const [name, sheet] of Object.entries(SPRITE_MANIFEST)) {
  const logicalSize = ['thuongluong', 'thachtuong', 'hacan'].includes(name) ? 96 : name === 'matroi' ? 32 : 48;
  const scale = sheet.size / logicalSize;
  const frames = DIRECTIONS.flatMap(direction => Object.entries(sheet.poses).flatMap(([state, pose]) =>
    Array.from({ length: pose.count }, (_, frame) => painters[name](direction, state, frame, pose.count))));
  const atlasColumns = sheet.atlasColumns ?? sheet.columns;
  const image = png(sheet.size * atlasColumns, sheet.size * Math.ceil(frames.length / atlasColumns), (horizontal, vertical) => {
    const index = Math.floor(vertical / sheet.size) * atlasColumns + Math.floor(horizontal / sheet.size);
    if (index >= frames.length) return [0, 0, 0, 0];
    const column = Math.floor(horizontal % sheet.size / scale);
    const row = Math.floor(vertical % sheet.size / scale);
    const offset = (row * logicalSize + column) * 4;
    return frames[index].subarray(offset, offset + 4);
  });
  fs.writeFileSync(path.join(directory, name + '.png'), image);
  console.log(name + ': ' + frames.length + ' frames, four directions, ' + image.length + ' bytes');
}
