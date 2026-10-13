'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const nextWaypoint = require('./campaign-navigation.cjs');
const presets = ['low', 'medium', 'high'];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function options(env) {
  const raw = env.THAN_MENH_URL || 'http://127.0.0.1:4187/';
  const url = new URL(raw);
  assert.ok(/^http:\/\/127\.0\.0\.1(?::\d+)?\//.test(raw) && url.hostname === '127.0.0.1' && !url.username && !url.password && !url.hash, 'Invalid URL: explicit http://127.0.0.1 only');
  const minutes = Number(env.STRESS_MINUTES || 30);
  const maxMinutes = Number(env.STRESS_MAX_MINUTES || 90);
  assert.ok(Number.isInteger(minutes) && minutes >= 1 && minutes <= 30, 'Invalid duration: integer 1..30 minutes');
  assert.ok(Number.isInteger(maxMinutes) && maxMinutes >= minutes && maxMinutes <= 90, 'Invalid deadline: duration..90 minutes');
  const bundleSha256 = env.STRESS_BUNDLE_SHA256 || '194d5a8fbe2323cb902d6236f6b89a3c41156988bcbfee9b5492523727d996d6';
  assert.ok(/^[a-f0-9]{64}$/.test(bundleSha256), 'Invalid bundle SHA256');
  return { url: url.href, minutes, maxMinutes, bundleSha256, output: path.resolve(env.STRESS_OUTPUT || 'artifacts/graphics-stress-' + Date.now()) };
}

function account(previous, current) {
  for (const sample of [previous, current]) for (const metric of ['time', 'sceneTime', 'hp', 'enemies', 'nearest', 'heap', 'dom', 'display', 'frameCount']) assert.ok(Number.isFinite(sample[metric]) && sample[metric] >= 0, 'missing metric ' + metric);
  const elapsed = current.time - previous.time;
  assert.ok(elapsed >= 0, 'clock reversed');
  if (previous.key === current.key) assert.ok(current.sceneTime >= previous.sceneTime, 'scene clock reversed');
  const active = sample => sample.key === 'Forest' && presets.includes(sample.preset) && sample.hp > 0 && sample.enemies > 0 && sample.nearest <= 150 && sample.visible === true && sample.paused === false && sample.overlay === false && sample.combat === true;
  if (elapsed > 2000 || !active(previous) || !active(current) || current.preset !== previous.preset || current.sceneTime <= previous.sceneTime || current.frameCount === 0) return 0;
  return Math.min(elapsed, current.sceneTime - previous.sceneTime);
}

function verdict(report) {
  if (!report || !Number.isInteger(report.minutes) || report.minutes < 1 || report.minutes > 30 || !report.presets || ![report.errors, report.assetFailures, report.failures].every(Array.isArray)) return 'FAILED';
  if (!Number.isFinite(report.elapsedMs) || report.elapsedMs < 0 || report.continuous !== true || report.errors.length || report.assetFailures.length || report.failures.length || !/^[a-f0-9]{64}$/.test(report.bundleBefore) || report.bundleBefore !== report.bundleAfter || report.browserBundleSha256 !== report.bundleBefore) return 'FAILED';
  const required = report.minutes * 60000 / 3;
  const covered = presets.every(name => {
    const preset = report.presets[name];
    return preset && Array.isArray(preset.transitions) && ['activeMs', 'incomingDamage', 'hits', 'combatWindows', 'skills', 'basics', 'dodges', 'frames'].every(metric => Number.isFinite(preset[metric])) && preset.activeMs >= required && preset.hits >= 20 && preset.incomingDamage > 0 && preset.combatWindows >= Math.min(20, Math.ceil(required / 30000)) && preset.skills >= 3 && preset.basics >= 3 && preset.dodges >= 3 && preset.frames > 0 && ['Village>Forest', 'Forest>Village'].every(edge => preset.transitions.includes(edge));
  });
  const transitions = presets.reduce((count, name) => count + (Array.isArray(report.presets[name]?.transitions) ? report.presets[name].transitions.length : 0), 0);
  if (!covered || transitions < 10 || report.elapsedMs < report.minutes * 60000) return 'INCOMPLETE';
  return report.minutes === 30 ? 'PASS' : 'SMOKE';
}

function classify(error) {
  const message = error.message || String(error);
  if (/deadline/i.test(message)) return 'deadline';
  if (/metric/i.test(message)) return 'missing-metrics';
  if (/clock/i.test(message)) return 'clock';
  if (/route|movement|navigation/i.test(message)) return 'navigation';
  if (/coverage|combat|scene|quality/i.test(message)) return 'coverage';
  return 'harness';
}

async function localFetch(url, origin) {
  assert.equal(new URL(url).origin, origin, 'URL outside preview origin');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, 'HTTP failure: ' + url + ' ' + response.status);
  return response.text();
}

function validateIntervals(intervals) {
  assert.ok(Array.isArray(intervals) && intervals.every(interval => Number.isFinite(interval) && interval > 0), 'missing metric frame interval');
}

function isBaselineFavicon(entry, url) {
  return entry.url === new URL('/favicon.ico', url).href && entry.status === 404 && entry.type === 'Other' && entry.initiator?.type === 'other';
}

function connect(socket, report) {
  let sequence = 0;
  const pending = new Map();
  const pauses = [];
  const requests = new Map();
  const baselineRequests = new Set();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Debugger.paused') pauses.push(message.params);
    if (message.method === 'Network.requestWillBeSent') requests.set(message.params.requestId, message.params.initiator);
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry;
      const baseline = entry.source === 'network' && /status of 404/.test(entry.text) && baselineRequests.has(entry.networkRequestId);
      (baseline ? report.baselineWarnings : report.errors).push(entry);
    }
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      const entry = message.params.response;
      const baseline = isBaselineFavicon({ ...entry, type: message.params.type, initiator: requests.get(message.params.requestId) }, report.url);
      if (baseline) baselineRequests.add(message.params.requestId);
      (baseline ? report.baselineWarnings : report.assetFailures).push(entry);
    }
    if (message.method === 'Network.responseReceived') requests.delete(message.params.requestId);
    if (message.method === 'Network.loadingFailed') report.assetFailures.push(message.params);
    if (message.method === 'Page.frameNavigated' && report.measured && !message.params.frame.parentId) report.continuous = false;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timeout);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  socket.addEventListener('close', () => { for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new Error('Owned Chrome socket closed')); } pending.clear(); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (socket.readyState !== 1) { reject(new Error('Owned Chrome socket closed')); return; }
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, pauses };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function observe(send, objectId, functionDeclaration) {
  const result = await send('Runtime.callFunctionOn', { objectId, functionDeclaration, returnByValue: true });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function attachObserver(send, pauses, bundle, bundleUrl) {
  const construction = /new ([\w$]+)\.Game\([\w$]+\);?\s*$/.exec(bundle);
  const saveLoad = [...bundle.matchAll(/([\w$]+)\.load\(\);/g)].at(-1);
  const quality = /([\w$]+)\.getState\(\)\.quality/.exec(bundle);
  assert.ok(construction && saveLoad && quality, 'Observer entry references missing');
  const location = bundle.slice(0, construction.index).split('\n');
  await send('Debugger.enable');
  await send('Debugger.setBreakpointByUrl', { url: bundleUrl, lineNumber: location.length - 1, columnNumber: location.at(-1).length });
  await send('Page.reload');
  for (let attempt = 0; attempt < 100 && !pauses.length; attempt++) await delay(100);
  assert.equal(pauses.length, 1, 'Observer setup pause missing');
  const { scriptSource } = await send('Debugger.getScriptSource', { scriptId: pauses[0].callFrames[0].location.scriptId });
  const browserBundleSha256 = createHash('sha256').update(scriptSource).digest('hex');
  assert.equal(browserBundleSha256, createHash('sha256').update(bundle).digest('hex'), 'Browser-executed script SHA256 mismatch');
  const callFrameId = pauses[0].callFrames[0].callFrameId;
  const reference = async expression => {
    const result = await send('Debugger.evaluateOnCallFrame', { callFrameId, expression });
    assert.ok(result.result.objectId && !result.exceptionDetails, 'Observer reference missing');
    return result.result.objectId;
  };
  const prototype = await reference(construction[1] + '.Game.prototype');
  const state = await reference(saveLoad[1]);
  const settings = await reference(quality[1]);
  await send('Debugger.resume'); await send('Debugger.disable'); await delay(1000);
  const games = await send('Runtime.queryObjects', { prototypeObjectId: prototype });
  return { games: games.objects.objectId, state, settings, browserBundleSha256 };
}

const sceneReader = function() {
  if (this.length !== 1) throw new Error('Expected one continuous production game');
  const scene = this[0].scene.getScenes(true)[0];
  if (!scene) return { key: 'Loading', sceneTime: 0, player: null, paused: false, overlay: false, enemies: [], display: this[0].scene.getScenes(false).reduce((count, entry) => count + entry.children.list.length, 0) };
  const player = scene.player;
  const observer = window.__graphicsStressObserver;
  const enemies = (scene.enemies || []).map(enemy => {
    if (!observer.ids.has(enemy)) observer.ids.set(enemy, ++observer.sequence);
    return { id: observer.ids.get(enemy), x: enemy.x, y: enemy.y, hp: enemy.hp, alive: enemy.isAlive };
  }).filter(enemy => enemy.alive);
  return { key: scene.sys.settings.key, sceneTime: scene.time.now, player: player ? { x: player.x, y: player.y, dead: player.isDead, barriers: player.barriers, lastAttack: player.lastAttack, dodgeReadyAt: player.dodgeReadyAt } : null,
    paused: Boolean(scene.pause?.isOpen() || scene.time.paused), overlay: Boolean(scene.overlay), enemies,
    display: this[0].scene.getScenes(false).reduce((count, entry) => count + entry.children.list.reduce(function visit(total, child) { return total + 1 + (Array.isArray(child.list) ? child.list.reduce(visit, 0) : 0); }, 0), 0) };
}.toString();

function fixture() {
  const quests = Object.fromEntries(['hunt-ho-yeu', 'main-c1-02-mo-duong-rung-truc', 'main-c1-03-tru-ma-troi'].map(questId => [questId, { questId, stage: 'active', counts: {}, flags: {}, rewardClaimed: false }]));
  return { version: 1, hp: 10000, mp: 10000, maxHp: 10000, maxMp: 10000, attack: 12, level: 1, xp: 0, gold: 0, chapter: 1, kills: 0, quest: 'active', bossDead: true, storyFlags: {}, checkpoint: 'village-gate', playtimeSeconds: 0, upgrades: 0,
    rpg: { inventory: { capacity: 24, slots: [] }, equipment: { slots: {} }, quests } };
}

function movementSegments(dx, dy, duration) {
  assert.ok([dx, dy, duration].every(Number.isFinite) && duration >= 0, 'Invalid movement metric');
  const distance = Math.hypot(dx, dy);
  if (!distance) return [];
  const horizontal = dx > 0 ? 'KeyD' : 'KeyA';
  const vertical = dy > 0 ? 'KeyS' : 'KeyW';
  return [{ codes: [horizontal, vertical], duration: Math.min(Math.abs(dx), Math.abs(dy)) / distance * duration * Math.SQRT2 },
    { codes: [Math.abs(dx) > Math.abs(dy) ? horizontal : vertical], duration: Math.abs(Math.abs(dx) - Math.abs(dy)) / distance * duration }].filter(segment => segment.duration > 0);
}

function inputs(send) {
  const key = (code, type) => send('Input.dispatchKeyEvent', { type, code, key: code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code, windowsVirtualKeyCode: code === 'Space' ? 32 : code === 'Escape' ? 27 : code === 'Home' ? 36 : code === 'Enter' ? 13 : code.startsWith('Arrow') ? ({ ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 })[code] : code.charCodeAt(3) });
  const press = async (code, duration = 60) => { await key(code, 'keyDown'); try { await delay(duration); } finally { await key(code, 'keyUp'); } };
  const move = async (dx, dy) => {
    for (const { codes, duration } of movementSegments(dx, dy, Math.max(20, Math.min(80, Math.hypot(dx, dy) / 190 * 1000)))) {
      for (const code of codes) await key(code, 'keyDown');
      try { await delay(duration); } finally { for (const code of codes) await key(code, 'keyUp'); }
    }
  };
  const click = async (x, y) => {
    const bounds = await evaluate(send, 'document.querySelector("canvas").getBoundingClientRect().toJSON()');
    const pointer = { x: bounds.x + x * bounds.width / 960, y: bounds.y + y * bounds.height / 540, button: 'left', clickCount: 1 };
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { ...pointer, type });
    await delay(120);
  };
  return { key, press, move, click };
}

async function domClick(send, selector) {
  const bounds = await evaluate(send, '(() => { const node = document.querySelector(' + JSON.stringify(selector) + '); if (!node) throw Error("Missing DOM control"); const rect = node.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()');
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { ...bounds, type, button: 'left', clickCount: 1 });
  await delay(150);
}

async function waitScene(context, key) {
  for (let attempt = 0; attempt < 100; attempt++) { context.guard(); if ((await context.readScene()).key === key) return; await delay(100); }
  throw new Error('Scene coverage: did not reach ' + key);
}

async function switchPreset(context, name) {
  const { send, input } = context;
  await input.press('Escape');
  assert.equal((await context.readScene()).paused, true, 'pauseMenu did not open');
  await input.click(480, 350); await waitScene(context, 'Menu');
  await domClick(send, '#dock-help-btn'); await domClick(send, '#graphics-quality');
  await input.press('Home');
  for (let index = 0; index < presets.indexOf(name); index++) await input.press('ArrowDown');
  await input.press('Enter');
  assert.equal(await evaluate(send, 'document.querySelector("#graphics-quality").value'), name, 'DOM quality mismatch');
  assert.equal(await observe(send, context.refs.settings, 'function(){return this.getState().quality;}'), name, 'Real quality mismatch');
  await domClick(send, '#modal-close-btn'); await input.click(480, 332); await waitScene(context, 'Village');
  context.name = name; context.previous = null;
}

async function walk(context, target, expected) {
  const initial = (await context.readScene()).key;
  for (let attempt = 0; attempt < 500; attempt++) {
    context.guard(); const scene = await context.readScene();
    if (scene.key === 'GameOver') { context.report.deaths++; await context.input.click(480, 300); await waitScene(context, 'Village'); return false; }
    if (scene.key !== initial) { assert.equal(scene.key, expected, 'Unexpected scene transition'); return true; }
    assert.ok(scene.player, 'Navigation player unavailable');
    if (scene.player.dead) { await delay(100); continue; }
    const waypoint = nextWaypoint(scene.player, target, scene.player.barriers, 0);
    await context.input.move(waypoint.x - scene.player.x, waypoint.y - scene.player.y); await context.sample(false);
  }
  throw new Error('Movement stalled: ' + JSON.stringify({ target, player: (await context.readScene()).player }));
}

async function transition(context, key) {
  const before = (await context.readScene()).key;
  let walked = false;
  for (let attempt = 0; attempt < 3 && !walked; attempt++) {
    walked = await walk(context, key === 'Forest' ? { x: 928, y: 270 } : { x: 42, y: 270 }, key);
    if (!walked && key === 'Village') break;
  }
  const after = (await context.readScene()).key;
  if (walked && before !== after) context.report.presets[context.name].transitions.push(before + '>' + after);
  assert.equal(after, key, 'Scene coverage missing ' + key);
  context.previous = null;
}

async function initializeFrames(send) {
  await evaluate(send, '(() => { const observer = {last:null,intervals:[],ids:new WeakMap(),sequence:0}; window.__graphicsStressObserver = observer; function tick(now) { if(observer.last !== null) observer.intervals.push(now-observer.last); observer.last=now; requestAnimationFrame(tick); } requestAnimationFrame(tick); })()');
}

function histogram(intervals) {
  const edges = [8.34, 16.67, 25, 33.34, 50, 100, Infinity];
  return edges.map((upper, index) => ({ upperMs: Number.isFinite(upper) ? upper : null, count: intervals.filter(value => value > (index ? edges[index - 1] : 0) && value <= upper).length }));
}

function distributions(samples, metric) {
  const values = samples.map(sample => sample[metric]).filter(Number.isFinite);
  if (!values.length) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const window = Math.max(1, Math.floor(values.length / 4));
  const mean = entries => entries.reduce((total, value) => total + value, 0) / entries.length;
  return { count: values.length, min: sorted[0], p50: sorted[Math.floor((sorted.length - 1) * 0.5)], p95: sorted[Math.floor((sorted.length - 1) * 0.95)], p99: sorted[Math.floor((sorted.length - 1) * 0.99)], max: sorted.at(-1), firstQuarterMean: mean(values.slice(0, window)), lastQuarterMean: mean(values.slice(-window)), deltaQuarterMean: mean(values.slice(-window)) - mean(values.slice(0, window)) };
}

function damageEvidence(previous, scene, save) {
  if (!previous || previous.key !== scene.key || scene.sceneTime <= previous.sceneTime) return { hits: 0, incoming: 0 };
  const hits = previous.enemyDetails.filter(enemy => !scene.enemies.some(current => current.id === enemy.id) || scene.enemies.find(current => current.id === enemy.id).hp < enemy.hp).length;
  return { hits, incoming: Math.max(0, previous.hp - save.hp) };
}

function recorder(context) {
  let recentHit = -Infinity;
  return async combatInput => {
    const scene = await context.readScene();
    const save = await observe(context.send, context.refs.state, 'function(){return this.data;}');
    if (context.name) assert.equal(await observe(context.send, context.refs.settings, 'function(){return this.getState().quality;}'), context.name, 'Live quality mismatch');
    const metrics = await context.send('Performance.getMetrics');
    const heap = metrics.metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value;
    const page = await evaluate(context.send, '({visible:document.visibilityState === "visible",dom:document.querySelectorAll("*").length,intervals:window.__graphicsStressObserver.intervals.splice(0)})');
    validateIntervals(page.intervals);
    const time = performance.now() - context.started;
    const nearest = scene.player && scene.enemies.length ? Math.min(...scene.enemies.map(enemy => Math.hypot(enemy.x - scene.player.x, enemy.y - scene.player.y))) : 100000;
    const previous = context.previous;
    const comparable = previous?.key === scene.key && scene.sceneTime > previous.sceneTime;
    const { hits, incoming } = damageEvidence(previous, scene, save);
    if (hits || incoming) recentHit = time;
    const sample = { time, sceneTime: scene.sceneTime, key: scene.key, preset: context.name, hp: save.hp, mp: save.mp, maxHp: save.maxHp, maxMp: save.maxMp, enemies: scene.enemies.length, nearest, paused: scene.paused, overlay: scene.overlay, visible: page.visible, heap, dom: page.dom, display: scene.display, frameCount: page.intervals.length, combat: Boolean(combatInput && time - recentHit <= 5000), enemyDetails: scene.enemies, player: scene.player, cooldowns: save.rpg.skills.cooldownUntil };
    if (!context.name) return sample;
    const preset = context.report.presets[context.name];
    const active = previous ? account(previous, sample) : 0;
    preset.basics += Number(Boolean(comparable && scene.player?.lastAttack > previous.player?.lastAttack));
    preset.dodges += Number(Boolean(comparable && scene.player?.dodgeReadyAt > previous.player?.dodgeReadyAt));
    preset.skills += Number(Boolean(comparable && Object.entries(sample.cooldowns).some(([id, until]) => until > (previous.cooldowns[id] || 0))));
    preset.hits += hits; preset.incomingDamage += incoming; preset.activeMs += active; preset.frames += active ? page.intervals.length : 0;
    if (active && (hits || incoming)) preset.windows.add(Math.floor(preset.activeMs / 30000));
    preset.combatWindows = preset.windows.size;
    preset.intervals.push(...(active ? page.intervals : []));
    context.report.samples.push({ ...sample, activeMs: active, enemyDetails: undefined, player: undefined, cooldowns: undefined });
    context.previous = sample;
    return sample;
  };
}

async function screenshot(context, name) {
  const result = await context.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(context.config.output, name + '.png'), Buffer.from(result.data, 'base64'));
}

async function combatStep(context, scene, iteration) {
  const target = [...scene.enemies].sort((first, second) => Math.hypot(first.x - scene.player.x, first.y - scene.player.y) - Math.hypot(second.x - scene.player.x, second.y - scene.player.y))[0];
  const distance = target ? Math.hypot(target.x - scene.player.x, target.y - scene.player.y) : Infinity;
  const waypoint = target && distance > 65 ? nextWaypoint(scene.player, target, scene.player.barriers, 65) : scene.player;
  const codes = [Math.abs(waypoint.x - scene.player.x) > 1 ? (waypoint.x > scene.player.x ? 'KeyD' : 'KeyA') : null, Math.abs(waypoint.y - scene.player.y) > 1 ? (waypoint.y > scene.player.y ? 'KeyS' : 'KeyW') : null].filter(Boolean);
  for (const code of codes) await context.input.key(code, 'keyDown');
  try {
    if (iteration % 12 === 0) await context.input.press('KeyJ');
    if (distance <= 150 && iteration % 32 === 0) await context.input.press(['KeyQ', 'KeyE', 'KeyR'][Math.floor(iteration / 32) % 3]);
    if (distance <= 150 && iteration % 32 === 0) await context.input.press('Space');
    await delay(150);
    return await context.sample(Boolean(target));
  } finally { for (const code of codes) await context.input.key(code, 'keyUp'); }
}

async function combatSession(context, name) {
  await switchPreset(context, name); await transition(context, 'Forest');
  const preset = context.report.presets[name];
  const required = context.config.minutes * 60000 / 3;
  const transitionInterval = Math.min(150000, required / 2);
  let nextTransition = transitionInterval;
  let iteration = 0;
  let lastCombat = performance.now();
  let lastProgress = -1;
  while (preset.activeMs < required || preset.skills < 3 || preset.basics < 3 || preset.dodges < 3 || preset.hits < 20 || !Number.isFinite(preset.incomingDamage) || preset.incomingDamage <= 0) {
    context.guard(); const scene = await context.readScene();
    if (scene.key === 'GameOver') { context.report.deaths++; await context.input.click(480, 300); await waitScene(context, 'Village'); context.previous = null; }
    else if (scene.key === 'Village') await transition(context, 'Forest');
    else {
      assert.equal(scene.key, 'Forest', 'Unexpected combat scene');
      const sample = await combatStep(context, scene, iteration);
      if (sample.combat) lastCombat = performance.now();
      if (performance.now() - lastCombat > 60000) throw new Error('Combat coverage absent for 60 seconds');
    }
    if (preset.activeMs >= nextTransition && preset.activeMs < required) { await transition(context, 'Village'); await transition(context, 'Forest'); nextTransition += transitionInterval; }
    const progress = Math.floor(preset.activeMs / 5000);
    if (progress !== lastProgress) { console.log('Graphics stress ' + name + ': active=' + Math.round(preset.activeMs) + '/' + required + 'ms hits=' + preset.hits + ' transitions=' + preset.transitions.length); lastProgress = progress; }
    iteration++;
  }
  await screenshot(context, name + '-combat'); await transition(context, 'Village');
}

async function launch(config, report) {
  assert.ok(typeof WebSocket !== 'undefined', 'Node.js 22+ WebSocket required');
  const chrome = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(candidate => fs.existsSync(candidate));
  assert.ok(chrome, 'Chrome missing: set CHROME_BIN; no install attempted');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-graphics-stress-'));
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile, '--window-size=960,640', config.url], { windowsHide: true, stdio: 'ignore' });
  let launchError; browser.on('error', error => { launchError = error; });
  report.browserPid = browser.pid; report.profile = profile;
  const context = { config, report, browser, profile };
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError;
      assert.equal(browser.exitCode, null, 'Chrome exited during startup');
      try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await delay(100); }
    }
    assert.ok(/^\d+$/.test(port), 'DevTools startup timeout');
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json', { signal: AbortSignal.timeout(10000) })).json();
    const target = targets.find(entry => entry.type === 'page' && entry.url === config.url);
    assert.ok(target, 'Own preview page missing');
    assert.equal(new URL(target.webSocketDebuggerUrl).hostname, '127.0.0.1', 'DevTools URL not local');
    context.socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('DevTools open timeout')), 10000); context.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true }); context.socket.addEventListener('error', reject, { once: true }); });
    Object.assign(context, connect(context.socket, report)); return context;
  } catch (error) { await cleanup(context); throw error; }
}

function stopOwned(browser) {
  if (browser.exitCode !== null || browser.signalCode || !browser.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else browser.kill('SIGTERM');
}

function setDeadline(context) {
  const stop = classification => {
    context.report.failures.push({ classification, message: classification + ' stopped owned Chrome' });
    stopOwned(context.browser); context.socket.close();
  };
  context.watchdog = setTimeout(() => stop('deadline'), Math.max(1, context.deadline - performance.now()));
  context.interrupt = () => stop('interrupted');
  process.once('SIGINT', context.interrupt); process.once('SIGTERM', context.interrupt);
}

async function cleanup(context) {
  const { browser, profile, socket } = context;
  clearTimeout(context.watchdog);
  if (context.interrupt) { process.removeListener('SIGINT', context.interrupt); process.removeListener('SIGTERM', context.interrupt); }
  if (socket?.readyState === 1 && context.send) { try { await context.send('Browser.close'); } catch (error) { context.report.cleanupWarning = error.message; } }
  socket?.close();
  for (let attempt = 0; attempt < 30 && browser.exitCode === null && !browser.signalCode; attempt++) await delay(100);
  if (browser.exitCode === null && !browser.signalCode && browser.pid) {
    stopOwned(browser);
    for (let attempt = 0; attempt < 30 && browser.exitCode === null && !browser.signalCode; attempt++) await delay(100);
  }
  assert.ok(path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('than-menh-graphics-stress-'), 'Unsafe profile cleanup');
  if (browser.exitCode !== null || browser.signalCode) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  else throw new Error('Owned Chrome still alive; profile retained');
}

async function run(config) {
  const report = { fixture: 'seeded common-enemy pressure; not boss/natural campaign; normal attack/default skills; 10000 HP/MP; active quest + bossDead; actual outgoing/incoming damage evidence; slowed real input cadence', minutes: config.minutes, url: config.url, continuous: true, measured: false, elapsedMs: 0, errors: [], baselineWarnings: [], requestedFixture: fixture(), normalizedFixture: null, assetFailures: [], failures: [], samples: [], sceneChanges: [], deaths: 0, presets: Object.fromEntries(presets.map(name => [name, { activeMs: 0, hits: 0, incomingDamage: 0, basics: 0, skills: 0, dodges: 0, frames: 0, combatWindows: 0, windows: new Set(), intervals: [], transitions: [] }])), limits: 'rAF intervals, JS heap, DOM/display samples only; not native GPU FPS, memory-leak absence, natural campaign or device proof' };
  const origin = new URL(config.url).origin;
  fs.mkdirSync(config.output, { recursive: true });
  let context; let bundleUrl;
  try {
    const html = await localFetch(config.url, origin);
    bundleUrl = new URL(html.match(/src="([^"]+\.js)"/)?.[1] || '', config.url).href;
    assert.ok(/\/assets\/index-[\w-]+\.js$/.test(bundleUrl), 'Frozen production entry mismatch');
    const bundle = await localFetch(bundleUrl, origin);
    report.bundleUrl = bundleUrl; report.bundleBefore = createHash('sha256').update(bundle).digest('hex');
    assert.equal(report.bundleBefore, config.bundleSha256, 'Frozen production bundle SHA256 mismatch'); report.harnessBefore = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
    context = await launch(config, report);
    for (const method of ['Runtime.enable', 'Network.enable', 'Log.enable', 'Page.enable', 'Performance.enable']) await context.send(method);
    await evaluate(context.send, 'localStorage.setItem("than-menh-van-lang-mvp-v1",' + JSON.stringify(JSON.stringify(fixture())) + ')');
    context.refs = await attachObserver(context.send, context.pauses, bundle, bundleUrl);
    report.browserBundleSha256 = context.refs.browserBundleSha256;
    const seeded = report.normalizedFixture = await observe(context.send, context.refs.state, 'function(){return this.data;}');
    for (const [field, value] of Object.entries({ hp: 10000, mp: 10000, attack: 12, quest: 'active', bossDead: true })) assert.equal(seeded[field], value, 'Seed fixture rejected: ' + field);
    assert.deepEqual(seeded.rpg.skills.unlockedSkillIds, ['earth-shockwave', 'flame-beam', 'tidal-surge'], 'Seed must retain normal default skills');
    context.readScene = async () => {
      const scene = await observe(context.send, context.refs.games, sceneReader);
      if (report.measured && context.lastScene !== scene.key) report.sceneChanges.push({ time: performance.now() - context.started, from: context.lastScene, to: scene.key, preset: context.name || null, liveEnemies: scene.enemies.length, display: scene.display });
      context.lastScene = scene.key;
      return scene;
    };
    context.input = inputs(context.send);
    context.guard = () => assert.ok(performance.now() < context.deadline, 'deadline exceeded');
    context.deadline = performance.now() + config.maxMinutes * 60000;
    await initializeFrames(context.send); await waitScene(context, 'Menu'); await context.input.click(480, 332); await waitScene(context, 'Village');
    report.maxMinutes = config.maxMinutes; report.observerSetupReloads = 1;
    report.browserVersion = await context.send('Browser.getVersion');
    context.started = performance.now(); report.measured = true; context.sample = recorder(context); setDeadline(context);
    for (const name of presets) await combatSession(context, name);
  } catch (error) {
    report.failures.push({ classification: classify(error), message: error.message, stack: error.stack });
    if (context?.send) { try { await screenshot(context, 'failure'); } catch (captureError) { report.captureError = captureError.message; } }
  } finally {
    if (context?.started) report.elapsedMs = performance.now() - context.started;
    report.harnessAfter = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
    if (report.harnessBefore && report.harnessBefore !== report.harnessAfter) report.failures.push({ classification: 'harness', message: 'Measured harness source changed' });
    if (context) clearTimeout(context.watchdog);
    if (bundleUrl) { try { const html = await localFetch(config.url, origin); assert.equal(new URL(html.match(/src="([^"]+\.js)"/)?.[1] || '', config.url).href, bundleUrl, 'Production entry changed'); report.bundleAfter = createHash('sha256').update(await localFetch(bundleUrl, origin)).digest('hex'); } catch (error) { report.failures.push({ classification: 'bundle', message: error.message }); } }
    if (context) { try { await cleanup(context); } catch (error) { report.failures.push({ classification: 'cleanup', message: error.message }); } }
    for (const name of presets) { const preset = report.presets[name]; preset.frameIntervals = { histogram: histogram(preset.intervals), distribution: distributions(preset.intervals.map(interval => ({ interval })), 'interval') }; delete preset.intervals; delete preset.windows; preset.trends = Object.fromEntries(['heap', 'dom', 'display', 'enemies'].map(metric => [metric, distributions(report.samples.filter(sample => sample.preset === name), metric)])); }
    report.verdict = verdict(report); fs.writeFileSync(path.join(config.output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Graphics stress: ' + report.verdict + ' ' + path.join(config.output, 'report.json'));
    if (report.verdict !== 'PASS' && report.verdict !== 'SMOKE') process.exitCode = 1;
  }
}

module.exports = { options, account, verdict, classify, sceneReader, fixture, histogram, validateIntervals, isBaselineFavicon, combatStep, movementSegments, damageEvidence, connect, launch, cleanup, evaluate, observe, attachObserver, inputs };
if (require.main === module) run(options(process.env)).catch(error => { console.error(error.message); process.exitCode = 1; });
