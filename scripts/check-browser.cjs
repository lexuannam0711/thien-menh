const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const url = process.env.THAN_MENH_URL || 'http://127.0.0.1:4173/';
const chrome = [process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean).find(candidate => fs.existsSync(candidate));
if (!chrome) throw new Error('Chrome/Chromium not found; set CHROME_BIN.');
if (typeof WebSocket === 'undefined') throw new Error('Browser checks require Node.js 22+ with WebSocket support.');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-browser-'));
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--user-data-dir=' + profile, '--window-size=960,640', url],
{ windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', error => { launchError = error; });
let socket;
let send;
let stage = 'startup';

async function run() {
  const coverageEnabled = process.env.THAN_MENH_COVERAGE === '1';
  const coverage = [];
  let takeCoverage;
  const response = await fetch(url);
  assert.equal(response.status, 200, 'Production preview must be running: npm run preview -- --host 127.0.0.1');
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error('Chrome exited before DevTools became available.');
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; }
    catch { await delay(100); }
  }
  assert.ok(port, 'Chrome DevTools startup timed out');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const target = targets.find(entry => entry.type === 'page');
  assert.ok(target, 'Chrome page target missing');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  const spriteResponses = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.responseReceived' && /\/assets\/(sprites|npcs|enemies|environments)\//.test(message.params.response.url)) {
      const response = message.params.response;
      spriteResponses.set(new URL(response.url).pathname.split('/').at(-1), response.status);
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timeout);
    message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result);
  });
  send = async (method, params = {}) => {
    if (method === 'Page.reload' && takeCoverage) await takeCoverage();
    return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
    });
  };
  await send('Runtime.enable');
  await send('Network.enable');
  let bundleUrl;
  let bundle;
  let sourceMap;
  let bundleSha256;
  if (coverageEnabled) {
    assert.ok(!process.env.THAN_MENH_SCREENSHOTS, 'Coverage instrumentation cannot produce performance artifacts; unset THAN_MENH_SCREENSHOTS');
    const bundlePath = (await response.text()).match(/src="([^" ]+\.js)"/)?.[1];
    assert.ok(bundlePath, 'Production bundle URL missing');
    bundleUrl = new URL(bundlePath, url).href;
    bundle = await (await fetch(bundleUrl)).text();
    bundleSha256 = createHash('sha256').update(bundle).digest('hex');
    const mapping = await fetch(bundleUrl + '.map');
    assert.equal(mapping.status, 200, 'Coverage requires an isolated source-map build');
    sourceMap = await mapping.json();
    await send('Profiler.enable');
    await send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    takeCoverage = async () => coverage.push(...(await send('Profiler.takePreciseCoverage')).result.filter(entry => entry.url === bundleUrl));
    await send('Page.reload');
  }
  stage = 'menu';
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const press = async (code, key, keyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode });
    await delay(80);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode });
    await delay(80);
  };
  const click = async (x, y) => {
    const bounds = await evaluate('document.querySelector("canvas").getBoundingClientRect().toJSON()');
    const pointer = { x: bounds.x + x * bounds.width / 960, y: bounds.y + y * bounds.height / 540, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { ...pointer, type: 'mousePressed' });
    await send('Input.dispatchMouseEvent', { ...pointer, type: 'mouseReleased' });
    await delay(100);
  };
  for (let attempt = 0; attempt < 100 && !await evaluate('!!document.querySelector("button")'); attempt++) await delay(100);
  assert.deepEqual(await evaluate('({width:document.querySelector("canvas")?.width,height:document.querySelector("canvas")?.height})'), { width: 960, height: 540 });
  assert.ok(!await evaluate('document.body.innerText.includes("(MVP)")'), 'Release page exposes MVP branding');
  stage = 'graphics-settings';
  const capture = async name => {
    if (!process.env.THAN_MENH_SCREENSHOTS) return;
    fs.mkdirSync(process.env.THAN_MENH_SCREENSHOTS, { recursive: true });
    const image = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.env.THAN_MENH_SCREENSHOTS, name + '.png'), Buffer.from(image.data, 'base64'));
  };
  await capture('menu-desktop');
  await evaluate('document.activeElement.blur()');
  await press('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.tagName'), 'BUTTON', 'Native Tab cannot reach accessible menu');
  assert.equal(await evaluate('getComputedStyle(document.activeElement.closest(".sr-only")).clip'), 'auto', 'Focused menu control remains clipped');
  await evaluate('document.getElementById("dock-help-btn").click()');
  await evaluate('Array.from(document.querySelectorAll("#controls-modal button, #controls-modal input, #controls-modal select")).at(-1).focus()');
  await press('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.id'), 'modal-close-btn', 'Modal focus escapes forward');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
  assert.equal(await evaluate('document.activeElement.textContent'), 'ĐÃ HIỂU / ĐÓNG', 'Modal focus escapes backward');
  assert.equal(await evaluate('document.getElementById("graphics-quality").getAttribute("aria-label")'), 'Chất lượng đồ họa');
  for (const [channel, value] of [['master', 65], ['music', 30], ['sfx', 80]]) {
    await evaluate('(() => { const input = document.getElementById("audio-' + channel + '-volume"); input.value = ' + value + '; input.dispatchEvent(new Event("input")); })()');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("than-menh-audio-settings-v1")).' + channel + 'Volume'), value / 100, channel + ' volume not persisted');
  }
  for (const quality of ['low', 'high', 'medium']) {
    await evaluate('(() => { const select = document.getElementById("graphics-quality"); select.value = ' + JSON.stringify(quality) + '; select.dispatchEvent(new Event("change")); })()');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("than-menh-graphics-v1")).quality'), quality);
  }
  await evaluate('document.getElementById("graphics-reduced-motion").click()');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("than-menh-graphics-v1")).reducedMotion'), true);
  await capture('settings-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Settings overflow mobile viewport');
  assert.ok(await evaluate('(() => { const bounds = document.querySelector(".controls-modal-dialog").getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight; })()'), 'Mobile settings dialog clipped outside viewport');
  await capture('settings-mobile');
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.reload');
  await delay(800);
  await evaluate('document.getElementById("dock-help-btn").click()');
  for (const [channel, value] of [['master', '65'], ['music', '30'], ['sfx', '80']]) {
    assert.equal(await evaluate('document.getElementById("audio-' + channel + '-volume").value'), value, channel + ' volume lost on reload');
  }
  assert.equal(await evaluate('document.getElementById("graphics-quality").value'), 'medium');
  assert.equal(await evaluate('document.getElementById("graphics-reduced-motion").checked'), true);
  await press('Escape', 'Escape', 27);
  await evaluate('document.querySelector("button").click()');
  stage = 'skills';
  await delay(2000);
  await capture('village-desktop');
  for (const name of fs.readdirSync(path.join(process.cwd(), 'public/assets/npcs')).filter(name => name.endsWith('.png'))) {
    assert.equal(spriteResponses.get(name), 200, name + ' runtime NPC artwork not loaded');
  }
  for (const family of ['enemies', 'environments']) {
    for (const name of fs.readdirSync(path.join(process.cwd(), 'public/assets', family)).filter(name => name.endsWith('.png'))) {
      assert.equal(spriteResponses.get(name), 200, name + ' runtime authored artwork not loaded');
    }
  }
  for (const name of ['hero', 'hero_axe', 'hero_sword', 'moctinh', 'matroi', 'hoyer', 'wolf', 'spider', 'thuongluong', 'thachtuong', 'hacan']) {
    assert.equal(spriteResponses.get(name + '.png'), 200, name + ' runtime spritesheet not loaded');
  }
  await press('KeyB', 'b', 66);
  await click(405, 85);
  await click(855, 245);
  await click(855, 245);
  await click(760, 295);
  const readSave = () => evaluate('JSON.parse(localStorage.getItem("than-menh-van-lang-mvp-v1"))');
  assert.equal((await readSave()).rpg.skills.equippedSlots['slot-3'], undefined, 'Unequip failed');
  await click(760, 295);
  assert.equal((await readSave()).rpg.skills.equippedSlots['slot-3'], 'tidal-surge', 'Pagination and water equip failed');
  await press('Escape', 'Escape', 27);
  stage = 'cast';
  await press('KeyR', 'r', 82);
  const castSave = await readSave();
  const expiry = castSave.rpg.skills.cooldownUntil['tidal-surge'];
  assert.ok(castSave.mp < castSave.maxMp && expiry > Date.now(), 'Water R did not cast; Escape may have opened pause');
  await press('KeyB', 'b', 66);
  stage = 'divine-selection';
  await click(405, 85);
  await click(855, 207);
  assert.equal((await readSave()).rpg.skills.activeDivinePower, 'water', 'Divine selection failed');
  await press('Escape', 'Escape', 27);
  await send('Page.reload');
  stage = 'reload';
  await delay(800);
  await evaluate('document.querySelector("button").click()');
  await delay(300);
  await press('KeyR', 'r', 82);
  const reloaded = await readSave();
  assert.equal(reloaded.rpg.skills.equippedSlots['slot-3'], 'tidal-surge');
  assert.equal(reloaded.rpg.skills.cooldownUntil['tidal-surge'], expiry, 'Reload bypassed cooldown');
  assert.equal(reloaded.rpg.skills.activeDivinePower, 'water', 'Divine selection lost on reload');
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  stage = 'touch';
  await capture('village-mobile');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 4 });
  await delay(Math.max(150, expiry - Date.now() + 100));
  const touchBounds = await evaluate('document.querySelector("canvas").getBoundingClientRect().toJSON()');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBounds.x + 780 * touchBounds.width / 960, y: touchBounds.y + 276 * touchBounds.height / 540 }] });
  await delay(80);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await readSave()).rpg.skills.cooldownUntil['tidal-surge'] > expiry, 'Touch R did not cast');
  stage = 'seeded-shop';
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  const funded = { ...reloaded, gold: 1000, level: 3 };
  await evaluate('localStorage.setItem("than-menh-van-lang-mvp-v1", ' + JSON.stringify(JSON.stringify(funded)) + ')');
  await send('Page.reload');
  await delay(800);
  await evaluate('document.querySelector("button").click()');
  await delay(800);
  await press('KeyB', 'b', 66);
  await capture('seeded-shop-open');
  assert.deepEqual(errors, [], 'Runtime error before shop: ' + JSON.stringify(errors));
  await click(695, 85);
  await capture('seeded-shop-tab');
  await click(400, 295);
  await click(400, 345);
  await click(400, 395);
  const shopping = await readSave();
  for (const weaponId of ['bronze-spear', 'battle-axe', 'lac-sword']) {
    assert.ok(shopping.rpg.inventory.slots.some(slot => slot.itemId === weaponId && slot.quantity === 1), weaponId + ' unavailable through shop UI');
  }
  assert.ok(shopping.gold < funded.gold, 'Shop did not deduct fixture funds');
  await click(115, 85);
  for (const weaponId of ['bronze-spear', 'battle-axe', 'lac-sword']) {
    const inventory = (await readSave()).rpg.inventory.slots;
    const index = inventory.findIndex(slot => slot.itemId === weaponId);
    assert.ok(index >= 0, weaponId + ' missing before equip');
    await click(index % 2 === 0 ? 285 : 565, 168 + Math.floor(index / 2) * 54);
    assert.equal((await readSave()).rpg.equipment.slots.weapon, weaponId, weaponId + ' inventory equip failed');
    await press('Escape', 'Escape', 27);
    await press('KeyJ', 'j', 74);
    await capture('weapon-' + weaponId);
    await delay(400);
    await press('KeyB', 'b', 66);
    await click(115, 85);
  }
  stage = 'seeded-full-inventory';
  const fullInventory = { ...funded, rpg: { ...funded.rpg, equipment: { slots: {} }, inventory: { capacity: 24, slots: [...Array.from({ length: 16 }, () => ({ itemId: 'bronze-spear', quantity: 1 })), { itemId: 'lac-sword', quantity: 1 }] } } };
  const loadFullInventory = async () => {
    await evaluate('localStorage.setItem("than-menh-van-lang-mvp-v1", ' + JSON.stringify(JSON.stringify(fullInventory)) + ')');
    await send('Page.reload');
    await delay(800);
    await evaluate('document.querySelector("button").click()');
    await delay(800);
    await press('KeyB', 'b', 66);
  };
  await loadFullInventory();
  await click(380, 435);
  await click(380, 435);
  await click(285, 168);
  assert.equal((await readSave()).rpg.equipment.slots.weapon, 'lac-sword', 'Inventory index 16 unreachable');
  await loadFullInventory();
  await click(265, 85);
  for (let page = 0; page < 4; page++) await click(780, 435);
  await click(825, 175);
  assert.equal((await readSave()).rpg.equipment.slots.weapon, 'lac-sword', 'Equipment list index 16 unreachable');
  stage = 'npc-quest-acceptance';
  await press('Escape', 'Escape', 27);
  for (const [code, key, keyCode] of [['KeyA', 'a', 65], ['KeyW', 'w', 87]]) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode });
  }
  await delay(600);
  for (const [code, key, keyCode] of [['KeyA', 'a', 65], ['KeyW', 'w', 87]]) {
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode });
  }
  await press('KeyF', 'f', 70);
  await capture('npc-chief-dialogue');
  await click(480, 349);
  await click(480, 297);
  assert.equal((await readSave()).rpg.quests['main-c1-02-mo-duong-rung-truc']?.stage, 'active', 'NPC quest board did not accept real quest');
  await press('KeyF', 'f', 70);
  await click(480, 297);
  await click(480, 297);
  assert.equal((await readSave()).quest, 'active', 'NPC campaign mission acceptance failed');
  const holdKey = async (code, keyCode, duration) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: keyCode });
    await delay(duration);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: keyCode });
    await delay(120);
  };
  stage = 'seeded-shield-presentation';
  const shieldFixture = { ...funded, mp: funded.maxMp, rpg: { ...funded.rpg, skills: { ...funded.rpg.skills,
    unlockedSkillIds: [...new Set([...funded.rpg.skills.unlockedSkillIds, 'stone-armor'])],
    equippedSlots: { ...funded.rpg.skills.equippedSlots, 'slot-1': 'stone-armor' }, cooldownUntil: {} } } };
  await evaluate('localStorage.setItem("than-menh-van-lang-mvp-v1", ' + JSON.stringify(JSON.stringify(shieldFixture)) + ')');
  await send('Page.reload');
  await delay(800);
  await evaluate('document.querySelector("button").click()');
  await delay(800);
  await press('KeyQ', 'q', 81);
  const shieldSave = await readSave();
  assert.equal(shieldSave.mp, shieldFixture.mp - 25, 'Shield cast did not consume actual skill cost');
  assert.ok(shieldSave.rpg.skills.cooldownUntil['stone-armor'] > Date.now(), 'Shield cast did not establish cooldown');
  await capture('shield-active');
  await holdKey('KeyD', 68, 350);
  await capture('shield-moved');
  await delay(6500);
  await capture('shield-expired');
  console.log('Seeded native shield cast/movement/expiry captures: inspect images; not full campaign or device proof');
  for (const [chapter, areaChapter, dungeonId, floorCount] of [[1, 1, 'dong-am-hon', 2], [2, 2, 'thuy-cung-phe-tich', 3], [4, 4, 'dia-cung-co-loa', 4], [4, 1, 'dong-am-hon', 2]]) {
    stage = 'dungeon-' + dungeonId;
    const fixture = { ...funded, chapter, level: 20, attack: 1000, hp: 999, maxHp: 999, mp: 999, maxMp: 999, quest: 'complete', bossDead: true,
      storyFlags: { ['dungeon-key:' + dungeonId]: true }, rpg: { ...funded.rpg, quests: {}, equipment: { slots: {} }, inventory: { capacity: 24, slots: [] },
        skills: { ...funded.rpg.skills, unlockedSkillIds: ['earth-shockwave', 'sun-burst'], equippedSlots: { 'slot-1': 'earth-shockwave', 'slot-2': 'sun-burst' }, cooldownUntil: {} } } };
    await evaluate('localStorage.setItem("than-menh-van-lang-mvp-v1", ' + JSON.stringify(JSON.stringify(fixture)) + ')');
    await send('Page.reload');
    await delay(800);
    await evaluate('document.querySelector("button").click()');
    await delay(800);
    if (areaChapter !== chapter) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
      await delay(600);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 });
      await press('KeyF', 'f', 70);
      await click(480, 401);
      await click(480, 297);
      await delay(300);
      await holdKey('KeyW', 87, 400);
      await holdKey('KeyD', 68, 350);
    } else {
      await holdKey('KeyW', 87, 400);
      await holdKey('KeyD', 68, 2900);
      await holdKey('KeyW', 87, 300);
      await holdKey('KeyD', 68, 350);
    }
    await press('KeyF', 'f', 70);
    await delay(300);
    for (let floor = 0; floor < floorCount; floor++) {
      stage = 'dungeon-' + dungeonId + '-floor-' + floor;
      await holdKey('KeyD', 68, 1000);
      for (let attempt = 0; attempt < 8 && !(await readSave()).storyFlags['dungeon-floor:' + dungeonId + ':' + floor]; attempt++) {
        await press('KeyQ', 'q', 81);
        await press('KeyE', 'e', 69);
        await press('KeyJ', 'j', 74);
        await delay(800);
        if (!(await readSave()).storyFlags['dungeon-floor:' + dungeonId + ':' + floor]) await holdKey('KeyD', 68, 350);
      }
      assert.equal((await readSave()).storyFlags['dungeon-floor:' + dungeonId + ':' + floor], true, 'Dungeon floor not cleared: ' + dungeonId + ':' + floor);
      await holdKey('KeyW', 87, 800);
      await holdKey('KeyA', 65, 200);
      await click(480, 140);
      await press('KeyF', 'f', 70);
      await delay(300);
    }
    assert.equal((await readSave()).storyFlags['dungeon-reward:' + dungeonId], true, 'Dungeon reward not claimed: ' + dungeonId);
    assert.ok((await readSave()).rpg.inventory.slots.length > 0, 'Dungeon reward inventory empty');
    assert.equal((await readSave()).chapter, chapter, 'Dungeon revisit changed campaign chapter');
    assert.ok((await readSave()).playtimeSeconds > (fixture.playtimeSeconds ?? 0), 'Active dungeon playtime not saved');
    if (areaChapter !== chapter) {
      const beforePause = (await readSave()).playtimeSeconds;
      await press('KeyP', 'p', 80);
      await delay(1500);
      await click(480, 350);
      const pausedTime = (await readSave()).playtimeSeconds;
      assert.ok(pausedTime - beforePause < 1, 'Pause counted idle playtime');
      await evaluate('document.querySelector("button").click()');
      await delay(800);
      await delay(1200);
      await press('KeyP', 'p', 80);
      await press('KeyB', 'b', 66);
      await click(480, 350);
      const resumedTime = (await readSave()).playtimeSeconds;
      assert.ok(resumedTime - pausedTime >= 1, 'Playtime did not resume');
      await send('Page.reload');
      await delay(800);
      assert.equal((await readSave()).playtimeSeconds, resumedTime, 'Playtime lost on reload');
    }
    console.log('Dungeon browser fixture: PASS (' + dungeonId + ', ' + floorCount + ' actual combat floors, elite, reward; campaign ' + chapter + ', area ' + areaChapter + ')');
  }
  if (process.env.THAN_MENH_SCREENSHOTS) {
    await send('Performance.enable');
    const profiles = [];
    const hold = async (code, keyCode, duration) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: keyCode });
      await delay(duration);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: keyCode });
    };
    for (const chapter of [1, 2, 3, 4]) {
      stage = 'seeded-chapter-' + chapter;
      const fixture = { ...funded, chapter, quest: 'active', kills: 8, bossDead: false, hp: 999, maxHp: 999 };
      await evaluate('localStorage.setItem("than-menh-van-lang-mvp-v1", ' + JSON.stringify(JSON.stringify(fixture)) + ')');
      await send('Page.reload');
      await delay(800);
      await evaluate('document.querySelector("button").click()');
      await delay(800);
      await hold('ArrowUp', 38, 150);
      await hold('ArrowRight', 39, 3100);
      await delay(1200);
      await capture('chapter-' + chapter + '-boss-fixture');
      const frames = await evaluate('new Promise(resolve => { const intervals = []; let first; let previous; function sample(time) { first ??= time; if (previous !== undefined) intervals.push(time - previous); previous = time; if (time - first < 1000) { requestAnimationFrame(sample); return; } const sorted = [...intervals].sort((first, second) => first - second); resolve({ frames: intervals.length, durationMs: time - first, fps: intervals.length * 1000 / (time - first), p95FrameMs: sorted[Math.floor(sorted.length * .95)] }); } requestAnimationFrame(sample); })');
      const metrics = await send('Performance.getMetrics');
      profiles.push({ chapter, ...frames, jsHeapUsedBytes: metrics.metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value });
      assert.equal((await readSave()).chapter, chapter, 'Chapter fixture normalization changed region');
    }
    fs.writeFileSync(path.join(process.env.THAN_MENH_SCREENSHOTS, 'headless-profile.json'), JSON.stringify({
      url, viewport: '960x640 browser, 960x540 logical canvas', renderer: 'headless Chrome --disable-gpu',
      quality: 'medium', reducedMotion: true, sample: 'one-second rAF per seeded boss encounter',
      limitation: 'Not native FPS/GPU/mobile/stress/30-minute acceptance. Frame scheduling only.', profiles,
    }, null, 2));
  }
  assert.deepEqual(errors, [], 'Browser runtime exceptions');
  if (coverageEnabled) {
    await takeCoverage();
    await send('Profiler.stopPreciseCoverage');
    assert.ok(coverage.length > 0, 'No matching bundle coverage captured');
    assert.equal(createHash('sha256').update(await (await fetch(bundleUrl)).text()).digest('hex'), bundleSha256, 'Production bundle changed during coverage');
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync('artifacts/browser-coverage-raw.json', JSON.stringify({ code: bundle, sourceMap, coverage, instrumented: true, fixtureBased: true, bundleSha256 }));
  }
  console.log('Browser checks: PASS (graphics/audio settings save/reload, mobile settings overflow, canvas, RPG pagination, NPC quests, water equip/cast, Escape, save/reload cooldown/power, mobile touch R, three-weapon shop, three funded dungeons, prior-area revisit, persisted playtime)');
}

run().catch(async error => {
  console.error(error);
  console.error('Browser stage:', stage);
  process.exitCode = 1;
  if (send && socket?.readyState === WebSocket.OPEN) {
    try {
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const screenshotPath = profile + '-failure.png';
      fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      console.error('Failure screenshot:', screenshotPath);
    } catch (captureError) { console.error('Screenshot failed:', captureError.message); }
  }
}).finally(async () => {
  if (send && socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch { }
  }
  socket?.close();
  await delay(300);
  if (browser.exitCode === null && !launchError) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else browser.kill();
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (error) { if (attempt === 19) { console.error('Chrome profile cleanup failed:', error.message); process.exitCode = 1; } else await delay(100); }
  }
});
