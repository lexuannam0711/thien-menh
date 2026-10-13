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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-campaign-'));
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--user-data-dir=' + profile, '--window-size=960,640', url],
{ windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', error => { launchError = error; });
let socket;
let send;
let stage = 'startup';
let failureState;

async function run() {
  const coverageEnabled = process.env.THAN_MENH_COVERAGE === '1';
  const coverage = [];
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
  const debugPauses = [];
  const spriteResponses = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Debugger.paused') debugPauses.push(message.params);
    if (message.method === 'Network.responseReceived' && /\/assets\/(sprites|npcs|enemies|environments|icons)\//.test(message.params.response.url)) {
      const response = message.params.response;
      spriteResponses.set(new URL(response.url).pathname, response.status);
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timeout);
    message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result);
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Network.enable');

  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const press = async (code, keyCode, duration = 70) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: keyCode });
    await delay(duration);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: keyCode });
    await delay(30);
  };
  const click = async (x, y) => {
    const bounds = await evaluate('document.querySelector("canvas").getBoundingClientRect().toJSON()');
    const pointer = { x: bounds.x + x * bounds.width / 960, y: bounds.y + y * bounds.height / 540, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { ...pointer, type: 'mousePressed' });
    await send('Input.dispatchMouseEvent', { ...pointer, type: 'mouseReleased' });
    await delay(120);
  };
  stage = 'read-only-production-observer';
  const html = await response.text();
  const bundlePath = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(bundlePath, 'Production bundle URL missing');
  const bundleUrl = new URL(bundlePath, url).href;
  const bundle = await (await fetch(bundleUrl)).text();
  const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
  let sourceMap;
  if (coverageEnabled) {
    const mapping = await fetch(bundleUrl + '.map');
    assert.equal(mapping.status, 200, 'Coverage requires an isolated source-map build');
    sourceMap = await mapping.json();
    await send('Profiler.enable');
    await send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  }
  const takeCoverage = async () => {
    if (coverageEnabled) coverage.push(...(await send('Profiler.takePreciseCoverage')).result.filter(entry => entry.url === bundleUrl));
  };
  const construction = /new ([\w$]+)\.Game\([\w$]+\);?\s*$/.exec(bundle);
  const saveLoad = [...bundle.matchAll(/([\w$]+)\.load\(\);/g)].at(-1);
  assert.ok(construction && saveLoad, 'Read-only observer cannot locate production entry point');
  const location = bundle.slice(0, construction.index).split('\n');
  await send('Debugger.enable');
  await send('Debugger.setBreakpointByUrl', { url: bundleUrl, lineNumber: location.length - 1, columnNumber: location.at(-1).length });
  await send('Page.reload');
  for (let attempt = 0; attempt < 100 && debugPauses.length === 0; attempt++) await delay(100);
  assert.equal(debugPauses.length, 1, 'Production entry point did not pause');
  const callFrameId = debugPauses[0].callFrames[0].callFrameId;
  const prototype = await send('Debugger.evaluateOnCallFrame', { callFrameId, expression: construction[1] + '.Game.prototype' });
  const state = await send('Debugger.evaluateOnCallFrame', { callFrameId, expression: saveLoad[1] });
  assert.ok(prototype.result.objectId && state.result.objectId, 'Observer references missing');
  await send('Debugger.resume');
  await send('Debugger.disable');
  await delay(1000);
  const games = await send('Runtime.queryObjects', { prototypeObjectId: prototype.result.objectId });
  const readSave = async () => (await send('Runtime.callFunctionOn', { objectId: state.result.objectId,
    functionDeclaration: 'function() { return this.data; }', returnByValue: true })).result.value;
  const readScene = async () => (await send('Runtime.callFunctionOn', { objectId: games.objects.objectId, returnByValue: true,
    functionDeclaration: `function() {
      if (this.length !== 1) throw new Error('Expected one production game');
      const scene = this[0].scene.getScenes(true)[0];
      if (!scene) return { key: null };
      const texts = [];
      const visit = (node, parentX = 0, parentY = 0) => {
        if (typeof node.text === 'string') texts.push({ text: node.text, x: parentX + (node.x || 0), y: parentY + (node.y || 0) });
        if (Array.isArray(node.list)) for (const child of node.list) visit(child, parentX + (node.x || 0), parentY + (node.y || 0));
      };
      for (const child of scene.children.list) visit(child);
      const boss = scene.bossSystem?.boss;
      return { key: scene.sys.settings.key, areaChapter: scene.areaChapter, time: scene.time.now, player: scene.player ? { x: scene.player.x, y: scene.player.y, dead: scene.player.isDead, direction: scene.player.direction, barriers: scene.player.barriers } : null,
        npcs: scene.npcs || [], markers: scene.questMarkers || [], dungeon: scene.dungeon ? { id: scene.dungeon.id, floor: scene.floor } : null, overlay: Boolean(scene.overlay), pause: Boolean(scene.pause?.isOpen()), texts,
        enemies: (scene.enemies || []).filter(enemy => enemy.isAlive).map(enemy => ({ kind: enemy.kind, x: enemy.x, y: enemy.y, hp: enemy.hp, windup: enemy.windup })),
        boss: boss ? { id: boss.definition.id, x: boss.x, y: boss.y, hp: boss.hp, state: boss.state, telegraph: boss.activeTelegraph } : null };
    }` })).result.value;
  failureState = async () => ({ bundlePath, bundleSha256, save: await readSave(), scene: await readScene() });
  const initial = await readSave();
  assert.equal(initial.chapter, 1);
  assert.equal(initial.level, 1);
  assert.equal(initial.gold, 0);
  assert.equal(initial.attack, 12);
  assert.equal(initial.playtimeSeconds, 0);
  await evaluate('document.querySelector("button").click()');
  for (let attempt = 0; attempt < 100 && (await readScene()).key !== 'Village'; attempt++) await delay(100);
  assert.equal((await readScene()).key, 'Village');
  const nextWaypoint = require('./campaign-navigation.cjs');
  const ts = require('typescript');
  const questModule = { exports: {} };
  new Function('exports', ts.transpileModule(fs.readFileSync('src/data/quests.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(questModule.exports);
  const quests = questModule.exports.QUESTS;
  const catalogModule = { exports: {} };
  new Function('exports', ts.transpileModule(fs.readFileSync('src/data/contentCatalog.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(catalogModule.exports);
  const clearNaturalDungeon = require('./campaign-dungeon.cjs');
  const assertQuestRewards = require('./campaign-rewards.cjs');
  const startedAt = Date.now();
  const deadline = startedAt + Number(process.env.THAN_MENH_CAMPAIGN_SECONDS || 1800) * 1000;
  assert.ok(Number.isFinite(deadline) && deadline > startedAt, 'Campaign deadline must be positive and finite');
  let deaths = 0;
  const chapters = [];
  const dungeons = [];
  const rewardReceipts = [];
  const move = async (dx, dy, duration) => {
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const horizontal = dx > 0 ? ['KeyD', 68] : ['KeyA', 65];
    const vertical = dy > 0 ? ['KeyS', 83] : ['KeyW', 87];
    const diagonalTime = Math.min(Math.abs(dx), Math.abs(dy)) / distance * duration * Math.SQRT2;
    const cardinalTime = Math.abs(Math.abs(dx) - Math.abs(dy)) / distance * duration;
    for (const [keys, milliseconds] of [[diagonalTime > 0 ? [horizontal, vertical] : [], diagonalTime],
      [[Math.abs(dx) > Math.abs(dy) ? horizontal : vertical], cardinalTime]]) {
      if (milliseconds <= 0) continue;
      for (const [code, keyCode] of keys) await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: keyCode });
      try { await delay(milliseconds); }
      finally {
        for (const [code, keyCode] of keys) await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: keyCode });
      }
    }
    await delay(25);
  };
  const waitScene = async key => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const scene = await readScene();
      if (scene.key === key) return;
      if (key === 'Village' && scene.key === 'GameOver') { deaths++; await click(480, 300); }
      await delay(100);
    }
    throw new Error('Scene did not start: ' + key);
  };
  const moveTo = async (target, tolerance = 45) => {
    const key = (await readScene()).key;
    for (let attempt = 0; attempt < 200 && Date.now() < deadline; attempt++) {
      const scene = await readScene();
      if (scene.key !== key || scene.player?.dead) return false;
      const player = scene.player;
      if (Math.hypot(target.x - player.x, target.y - player.y) <= tolerance) return true;
      const waypoint = nextWaypoint(player, target, player.barriers, tolerance);
      const dx = waypoint.x - player.x; const dy = waypoint.y - player.y;
      await move(dx, dy, Math.max(20, Math.min(80, Math.hypot(dx, dy) / 190 * 1000)));
    }
    throw new Error('Movement stalled: ' + JSON.stringify({ target, scene: await readScene() }));
  };
  const choose = async prefix => {
    const scene = await readScene();
    const entry = scene.texts.find(entry => entry.y >= 280 && entry.text.startsWith(prefix));
    assert.ok(entry, 'Missing choice ' + prefix + ': ' + JSON.stringify(scene.texts));
    await click(entry.x, entry.y);
  };
  const npcMenu = async npcId => {
    const npc = (await readScene()).npcs.find(npc => npc.id === npcId);
    assert.ok(npc, 'NPC unavailable: ' + npcId);
    await moveTo(npc, 75);
    await click(npc.x, npc.y);
  };
  const questBoard = async (npcId, claim = false) => {
    await npcMenu(npcId);
    if (['village-chief', 'village-smith', 'village-healer'].includes(npcId)) await choose('Nhận nhiệm vụ / Báo cáo');
    const before = claim ? await readSave() : null;
    await choose(claim ? 'Báo cáo & nhận thưởng' : 'Nhận các nhiệm vụ đang có');
    if (claim) rewardReceipts.push(assertQuestRewards(before, await readSave(), quests));
  };
  const pendingKills = save => Object.values(save.rpg.quests).some(progress => {
    const quest = quests.find(quest => quest.id === progress.questId);
    return quest && quest.id !== 'hunt-ho-yeu' && progress.stage === 'active' && quest.objectives.some(objective => objective.kind === 'kill' && (progress.counts[objective.id] || 0) < objective.required);
  });
  let lastStatus = 0;
  const combatStep = async () => {
    const scene = await readScene();
    const save = await readSave();
    if (scene.key === 'GameOver') { deaths++; await click(480, 300); await waitScene('Village'); return; }
    if (!scene.player || scene.player.dead) { await delay(300); return; }
    const boss = scene.boss?.hp > 0 ? scene.boss : null;
    const targets = [...scene.enemies, ...(boss ? [boss] : [])].sort((first, second) => Math.hypot(first.x - scene.player.x, first.y - scene.player.y) - Math.hypot(second.x - scene.player.x, second.y - scene.player.y));
    const target = targets[0];
    if (!target) { await delay(400); return; }
    const dx = target.x - scene.player.x; const dy = target.y - scene.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 115) {
      const waypoint = nextWaypoint(scene.player, target, scene.player.barriers, 95);
      const stepX = waypoint.x - scene.player.x;
      const stepY = waypoint.y - scene.player.y;
      await move(stepX, stepY, Math.min(80, Math.hypot(stepX, stepY) / 190 * 1000));
    }
    else if (boss?.telegraph && boss.telegraph.endAt - (scene.time || 0) < 300) {
      await move(-dy || 1, dx || 1, 30); await press('Space', 32);
    } else {
      await move(dx, dy, 22);
      await press('KeyJ', 74);
      for (const [slot, code, keyCode] of [['slot-1', 'KeyQ', 81], ['slot-2', 'KeyE', 69], ['slot-3', 'KeyR', 82]]) {
        const skillId = save.rpg.skills.equippedSlots[slot];
        if (save.mp > 30 && (save.rpg.skills.cooldownUntil[skillId] || 0) <= Date.now()) await press(code, keyCode);
      }
      if (distance < 90) await move(-dx, -dy, 170);
    }
    if (Date.now() - lastStatus > 10000) {
      lastStatus = Date.now();
      console.log('Campaign combat', JSON.stringify({ chapter: save.chapter, area: scene.areaChapter, level: save.level, hp: save.hp, kills: save.kills, boss: scene.boss?.hp, deaths, pending: Object.values(save.rpg.quests).filter(quest => quest.stage === 'active').length }));
    }
  };
  const interactMarker = async marker => {
    while (Date.now() < deadline) {
      const progress = (await readSave()).rpg.quests[marker.questId];
      if (progress?.stage !== 'active') return;
      const scene = await readScene();
      if (scene.key === 'GameOver' || scene.player?.dead) { await combatStep(); continue; }
      if (scene.key === 'Village') {
        await moveTo({ x: 926, y: 270 }, 8); await waitScene('Forest'); continue;
      }
      if (scene.key !== 'Forest' || !scene.player) { await delay(100); continue; }
      if (!await moveTo({ x: marker.x + 20, y: marker.y }, 18)) continue;
      await click(marker.x, marker.y);
      const after = await readScene();
      if (after.key !== 'Forest' || !after.player || after.player.dead) continue;
      assert.equal((await readSave()).rpg.quests[marker.questId].stage, 'return', 'Flag did not finish: ' + marker.flag);
      return;
    }
    throw new Error('Marker exceeded deadline: ' + marker.flag);
  };
  for (let chapter = 1; chapter <= 4; chapter++) {
    stage = 'natural-chapter-' + chapter;
    assert.equal((await readSave()).chapter, chapter);
    const npcs = (await readScene()).npcs.map(npc => npc.id);
    await npcMenu('village-chief'); await choose('Sứ mệnh của chương'); await choose('Nhận nhiệm vụ');
    for (const npcId of npcs) await questBoard(npcId);
    while (Date.now() < deadline) {
      const save = await readSave();
      const scene = await readScene();
      if (scene.key === 'Forest') assert.equal(scene.areaChapter, chapter, 'Village portal resumed a stale area');
      if (scene.key === 'Village') { await moveTo({ x: 926, y: 270 }, 8); await waitScene('Forest'); }
      else if (scene.key === 'GameOver' || scene.player?.dead) await combatStep();
      else if (save.bossDead && !pendingKills(save)) break;
      else await combatStep();
    }
    assert.ok(Date.now() < deadline, 'Natural campaign exceeded deadline');
    const bossId = ['ho-yeu', 'thuong-luong', 'thach-tuong', 'hac-an'][chapter - 1];
    assert.equal((await readSave()).storyFlags['boss:' + bossId], true, 'Natural boss did not die');
    const dungeon = catalogModule.exports.DUNGEONS.find(entry => entry.id === ({ 1: 'dong-am-hon', 2: 'thuy-cung-phe-tich', 4: 'dia-cung-co-loa' })[chapter]);
    if (dungeon) {
      dungeons.push(await clearNaturalDungeon(dungeon, { readSave, readScene, moveTo, press, combatStep, waitScene, deadline }));
      console.log('Natural dungeon PASS', JSON.stringify(dungeons.at(-1)));
    }
    for (const marker of (await readScene()).markers) {
      await interactMarker(marker);
    }
    await moveTo({ x: 45, y: 270 }, 8); await waitScene('Village');
    for (const npcId of npcs) await questBoard(npcId, true);
    for (const quest of quests.filter(quest => quest.category === 'main' && quest.id !== 'hunt-ho-yeu' && quest.chapter === chapter)) {
      const progress = (await readSave()).rpg.quests[quest.id];
      assert.equal(progress?.stage, 'complete', 'Main quest incomplete: ' + quest.id);
      assert.equal(progress.rewardClaimed, true, 'Main reward not claimed: ' + quest.id);
    }
    await npcMenu('village-chief'); await choose('Sứ mệnh của chương');
    const chiefBefore = await readSave();
    await choose('Báo cáo & nhận thưởng'); await waitScene('Victory');
    const checkpoint = await readSave(); chapters.push({ chapter, level: checkpoint.level, gold: checkpoint.gold, playtimeSeconds: checkpoint.playtimeSeconds, bossId });
    rewardReceipts.push(assertQuestRewards(chiefBefore, checkpoint, quests));
    assert.equal(checkpoint.rpg.quests['hunt-ho-yeu'].stage, 'complete', 'Campaign boss reward incomplete');
    assert.equal(checkpoint.rpg.quests['hunt-ho-yeu'].rewardClaimed, true, 'Campaign boss reward unclaimed');
    console.log('Natural chapter PASS', JSON.stringify(chapters.at(-1)));
    await click(320, 450); await waitScene(chapter === 4 ? 'Ending' : 'Village');
  }
  const finalSave = await readSave();
  const finalScene = await readScene();
  failureState = async () => ({ bundlePath, bundleSha256, save: finalSave, scene: finalScene, capturedBeforeReload: true });
  assert.equal((await readScene()).key, 'Ending');
  assert.equal(finalSave.chapter, 4);
  for (const quest of quests.filter(quest => quest.category === 'main')) {
    assert.equal(finalSave.rpg.quests[quest.id]?.stage, 'complete', 'Final main incomplete: ' + quest.id);
    assert.equal(finalSave.rpg.quests[quest.id].rewardClaimed, true, 'Final main reward unclaimed: ' + quest.id);
  }
  for (const bossId of ['ho-yeu', 'thuong-luong', 'thach-tuong', 'hac-an']) assert.equal(finalSave.storyFlags['boss:' + bossId], true);
  assert.equal(dungeons.length, 3, 'Every natural dungeon must be accepted');
  for (const quest of quests) {
    assert.equal(finalSave.rpg.quests[quest.id]?.stage, 'complete', 'Final quest incomplete: ' + quest.id);
    assert.equal(finalSave.rpg.quests[quest.id].rewardClaimed, true, 'Final quest reward unclaimed: ' + quest.id);
  }
  const endingScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await takeCoverage();
  stage = 'natural-campaign-save-reload';
  debugPauses.length = 0;
  await send('Debugger.enable');
  await send('Debugger.setBreakpointByUrl', { url: bundleUrl, lineNumber: location.length - 1, columnNumber: location.at(-1).length });
  await send('Page.reload');
  for (let attempt = 0; attempt < 100 && debugPauses.length === 0; attempt++) await delay(100);
  assert.equal(debugPauses.length, 1, 'Reload observer did not pause');
  const restored = await send('Debugger.evaluateOnCallFrame', { callFrameId: debugPauses[0].callFrames[0].callFrameId, expression: saveLoad[1] + '.data', returnByValue: true });
  assert.deepEqual(restored.result.value, { ...finalSave, playtimeSeconds: Math.round(finalSave.playtimeSeconds) }, 'Natural campaign save hydration changed progress beyond documented second rounding');
  await send('Debugger.resume');
  await send('Debugger.disable');
  await delay(1000);
  assert.equal(await evaluate('Boolean(document.querySelector("button"))'), true, 'Menu missing after reload');
  assert.deepEqual(errors, [], 'Production runtime exceptions');
  assert.ok(spriteResponses.size > 0, 'No authored asset responses observed');
  for (const [asset, status] of spriteResponses) assert.equal(status, 200, 'Authored asset failed: ' + asset);
  assert.equal(createHash('sha256').update(await (await fetch(bundleUrl)).text()).digest('hex'), bundleSha256, 'Production bundle changed during campaign');
  await takeCoverage();
  if (coverageEnabled) {
    await send('Profiler.stopPreciseCoverage');
    assert.ok(coverage.length > 0, 'No matching bundle coverage captured');
  }
  fs.mkdirSync('artifacts', { recursive: true });
  const artifact = coverageEnabled ? 'campaign-coverage' : 'campaign';
  fs.writeFileSync('artifacts/' + artifact + '-ending.png', Buffer.from(endingScreenshot.data, 'base64'));
  fs.writeFileSync('artifacts/' + artifact + '-acceptance.json', JSON.stringify({ generatedAt: new Date().toISOString(), bundlePath, bundleSha256, instrumented: coverageEnabled, boosted: false, inputDriven: true, saveReload: true, elapsedSeconds: (Date.now() - startedAt) / 1000, deaths, chapters, dungeons, rewardReceipts, finalSave, limitation: 'Read-only debugger observes actor positions; automated tester is not representative of player skill or3–5h pacing. Real devices and30min stability separate.' }, null, 2));
  if (coverageEnabled) fs.writeFileSync('artifacts/campaign-coverage-raw.json', JSON.stringify({ code: bundle, sourceMap, coverage }));
  console.log('Natural campaign: PASS (new save,4chapters,all quests,bosses,3 natural dungeons,Ending)');
}
run().catch(async error => {
  console.error(error);
  console.error('Browser stage:', stage);
  process.exitCode = 1;
  if (send && socket?.readyState === WebSocket.OPEN) {
    try {
      if (failureState) {
        fs.mkdirSync('artifacts', { recursive: true });
        fs.writeFileSync('artifacts/campaign-failure.json', JSON.stringify({ generatedAt: new Date().toISOString(), stage, error: error.message, ...await failureState() }, null, 2));
      }
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
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()), 'Refusing cleanup outside temporary directory');
  assert.ok(path.basename(profile).startsWith('than-menh-campaign-'), 'Refusing cleanup of unowned profile');
  for (let attempt = 0; attempt < 20; attempt++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (error) { if (attempt === 19) { console.error('Chrome profile cleanup failed:', error.message); process.exitCode = 1; } else await delay(100); }
  }
});
