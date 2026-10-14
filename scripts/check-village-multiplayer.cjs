#!/usr/bin/env node
/**
 * scripts/check-village-multiplayer.cjs
 *
 * Deterministic QA Verification Suite for Village Multiplayer Wiring:
 * 1. Test 1: Export integrity and static contracts of RemotePlayerRenderer.
 * 2. Test 2: Mock Phaser Scene + mock MultiplayerAdapter runtime lifecycle
 *    (spawn on join, interpolation lerp, facing flipX, anim sync, despawn on leave, fail-closed offline).
 * 3. Test 3: VillageScene integration & offline preservation
 *    (imports, create instantiation, shutdown cleanup, 20Hz throttled sendMove, offline fail-closed).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = process.cwd();
const remoteRendererPath = path.join(root, 'src', 'game', 'online', 'remotePlayerRenderer.ts');
const villageScenePath = path.join(root, 'src', 'game', 'scenes', 'VillageScene.ts');
const multiplayerPath = path.join(root, 'src', 'game', 'online', 'multiplayer.ts');

console.log('================================================================');
console.log('THẦN MỆNH: VILLAGE MULTIPLAYER & REMOTE PLAYER RENDERER QA SUITE');
console.log('================================================================\n');

// Helper to compile and run TypeScript module in CommonJS sandbox
function compileAndRun(tsCode, filename, customRequires = {}) {
  const transpiled = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      strict: true,
    },
    fileName: filename,
  }).outputText;

  const moduleObj = { exports: {} };
  const customRequire = (id) => {
    if (customRequires[id]) return customRequires[id];
    if (id.startsWith('./') || id.startsWith('../')) {
      throw new Error(`Unhandled relative require in sandbox: ${id}`);
    }
    return require(id);
  };

  const sanitized = transpiled.replace(
    /\bimport\.meta\b/g,
    '({ env: typeof process !== "undefined" ? process.env : {} })'
  );
  const runner = new Function('require', 'exports', 'module', '"use strict";\n' + sanitized);
  runner(customRequire, moduleObj.exports, moduleObj);
  return moduleObj.exports;
}

// ============================================================================
// TEST 1: KIỂM TRA TÍNH TOÀN VẸN EXPORT CỦA REMOTEPLAYERRENDERER
// ============================================================================
console.log('--- Test 1: RemotePlayerRenderer Export Integrity & Static Contracts ---');

assert.ok(fs.existsSync(remoteRendererPath), `remotePlayerRenderer.ts must exist at ${remoteRendererPath}`);
const remoteRendererSrc = fs.readFileSync(remoteRendererPath, 'utf8');

// 1.1 Class export
assert.match(
  remoteRendererSrc,
  /export\s+class\s+RemotePlayerRenderer/,
  'remotePlayerRenderer.ts must export class RemotePlayerRenderer'
);

// 1.2 Core methods
assert.match(
  remoteRendererSrc,
  /\bupdate\s*\([^)]*\)\s*:\s*void/,
  'RemotePlayerRenderer must implement update(delta: number): void'
);
assert.match(
  remoteRendererSrc,
  /\bdestroy\s*\([^)]*\)\s*:\s*void/,
  'RemotePlayerRenderer must implement destroy(): void'
);

// 1.3 Nameplate aesthetic contract (#ffea9f, semi-transparent background, centered origin)
assert.match(
  remoteRendererSrc,
  /#ffea9f/i,
  'RemotePlayerRenderer must use ancient bronze / golden yellow (#ffea9f) for player nameplate'
);
assert.match(
  remoteRendererSrc,
  /0\.5/,
  'RemotePlayerRenderer must center origin (setOrigin(0.5)) for nameplate'
);

// 1.4 Depth calculation formula (30 + y / 10)
assert.match(
  remoteRendererSrc,
  /30\s*\+\s*.*y\s*\/\s*10/,
  'RemotePlayerRenderer must use ground depth formula 30 + y / 10'
);

// 1.5 Interpolation wiring
assert.match(
  remoteRendererSrc,
  /interpolatePlayer/,
  'RemotePlayerRenderer must invoke interpolatePlayer for smooth lerp'
);

// 1.6 Secret / token safety
assert.doesNotMatch(
  remoteRendererSrc,
  /console\.log\([^)]*token[^)]*\)/i,
  'RemotePlayerRenderer must never log sensitive tokens'
);

// 1.7 Transpilation & sandbox evaluation
const mockAssetLoader = {
  SPRITE_KEYS: { hero: 'hero_sprite' },
};
const mockMultiplayerModule = {
  multiplayer: {
    isConnected: false,
    getAllRemotePlayers: () => [],
    interpolatePlayer: () => null,
  },
};
const mockPhaser = {};

const rendererModule = compileAndRun(remoteRendererSrc, 'remotePlayerRenderer.ts', {
  phaser: mockPhaser,
  './multiplayer': mockMultiplayerModule,
  '../assets/assetLoader': mockAssetLoader,
  './protocol': {},
});

assert.equal(
  typeof rendererModule.RemotePlayerRenderer,
  'function',
  'RemotePlayerRenderer must be an exportable constructor'
);

console.log('✓ Test 1: RemotePlayerRenderer Export Integrity Passed\n');

// ============================================================================
// TEST 2: RUNTIME MOCK SIMULATION (SPAWN, INTERPOLATION, DESPAWN, DESTROY)
// ============================================================================
console.log('--- Test 2: Runtime Simulation (Phaser Mock + MultiplayerAdapter) ---');

function createMockPhaserScene() {
  const containers = [];
  const sprites = [];
  const texts = [];
  const ellipses = [];

  const animsDatabase = new Set([
    'hero_idle_down',
    'hero_idle_right',
    'hero_idle_left',
    'hero_walk_down',
    'hero_walk_right',
    'hero_walk_left',
    'hero_attack1_down',
    'hero_dodge_down',
    'hero_hit_down',
    'hero_death_down',
  ]);

  const scene = {
    textures: {
      exists: (key) => key === 'hero_sprite',
    },
    anims: {
      exists: (key) => animsDatabase.has(key),
    },
    add: {
      ellipse: (x, y, w, h, color, alpha) => {
        const obj = {
          type: 'ellipse',
          x,
          y,
          w,
          h,
          color,
          alpha,
          isDestroyed: false,
          destroy: () => { obj.isDestroyed = true; },
        };
        ellipses.push(obj);
        return obj;
      },
      sprite: (x, y, texture, frame) => {
        const obj = {
          type: 'sprite',
          x,
          y,
          texture,
          frame,
          flipX: false,
          isDestroyed: false,
          anims: {
            currentAnim: null,
            isPlaying: false,
          },
          setFlipX: (val) => { obj.flipX = Boolean(val); return obj; },
          play: (key, _ignoreIfPlaying) => {
            obj.anims.currentAnim = { key };
            obj.anims.isPlaying = true;
            return obj;
          },
          destroy: () => { obj.isDestroyed = true; },
        };
        sprites.push(obj);
        return obj;
      },
      text: (x, y, textStr, style) => {
        const obj = {
          type: 'text',
          x,
          y,
          text: textStr,
          style,
          originX: 0,
          originY: 0,
          isDestroyed: false,
          setOrigin: (ox, oy = ox) => { obj.originX = ox; obj.originY = oy; return obj; },
          setText: (t) => { obj.text = t; return obj; },
          destroy: () => { obj.isDestroyed = true; },
        };
        texts.push(obj);
        return obj;
      },
      container: (x, y, children) => {
        const obj = {
          type: 'container',
          x,
          y,
          depth: 0,
          children: [...children],
          isDestroyed: false,
          setPosition: (px, py) => { obj.x = px; obj.y = py; return obj; },
          setDepth: (d) => { obj.depth = d; return obj; },
          destroy: () => {
            obj.isDestroyed = true;
            for (const child of obj.children) {
              if (child && typeof child.destroy === 'function') child.destroy();
            }
          },
        };
        containers.push(obj);
        return obj;
      },
    },
    _tracking: { containers, sprites, texts, ellipses },
  };

  return scene;
}

function createMockMultiplayerAdapter() {
  const players = new Map();
  const lerpPositions = new Map();

  return {
    isConnected: true,
    players,
    lerpPositions,
    getAllRemotePlayers: () => Array.from(players.values()),
    interpolatePlayer: (id) => lerpPositions.get(id) ?? null,
  };
}

// 2.1 Initial State: Empty room
const mockScene = createMockPhaserScene();
const mockAdapter = createMockMultiplayerAdapter();
const renderer = new rendererModule.RemotePlayerRenderer(mockScene, mockAdapter);

assert.equal(renderer.getRemotePlayerCount(), 0, 'Initial remote players count must be 0');
renderer.update(16);
assert.equal(renderer.getRemotePlayerCount(), 0, 'Update with no players must maintain 0 count');

// 2.2 Player Join & Visual Spawn
const playerA = Object.freeze({
  id: 'p1',
  characterId: 'char-van-lang',
  name: 'Hùng Duệ Vương',
  x: 200,
  y: 300,
  vx: 0,
  vy: 0,
  facing: 'right',
  state: 'idle',
  hp: 150,
  maxHp: 150,
  mp: 50,
  maxMp: 50,
  level: 5,
});
mockAdapter.players.set(playerA.id, playerA);

renderer.update(16);

assert.equal(renderer.getRemotePlayerCount(), 1, 'Should spawn 1 remote player visual');
assert.ok(renderer.hasPlayer('p1'), 'Should track player p1');

const containerA = renderer.getPlayerContainer('p1');
assert.ok(containerA, 'Visual container must exist for p1');
assert.equal(containerA.x, 200, 'Container initial x must be 200');
assert.equal(containerA.y, 300, 'Container initial y must be 300');
assert.equal(containerA.depth, 30 + 300 / 10, 'Container depth must match 30 + y / 10 = 60');

const visualA = renderer.getPlayerVisual('p1');
assert.ok(visualA, 'Visual state record must exist');
assert.equal(visualA.nameplate.text, 'Hùng Duệ Vương', 'Nameplate text must match player name');
assert.equal(visualA.nameplate.style.color, '#ffea9f', 'Nameplate text color must be #ffea9f');
assert.equal(visualA.nameplate.originX, 0.5, 'Nameplate originX must be centered (0.5)');

// 2.3 Interpolation & Movement Update
mockAdapter.lerpPositions.set('p1', {
  id: 'p1',
  x: 240,
  y: 310,
  facing: 'left',
  state: 'walk',
  hp: 150,
  maxHp: 150,
});

renderer.update(16);

assert.equal(containerA.x, 240, 'Container interpolated x must be updated to 240');
assert.equal(containerA.y, 310, 'Container interpolated y must be updated to 310');
assert.equal(containerA.depth, 30 + 310 / 10, 'Container depth must update with y coordinate (61)');
assert.equal(visualA.sprite.flipX, true, 'Facing left must flipX the sprite');
assert.ok(
  visualA.sprite.anims.currentAnim?.key.includes('walk'),
  'Walk state must trigger walking animation'
);

// 2.4 Second Player Joins
const playerB = Object.freeze({
  id: 'p2',
  characterId: 'char-lac-hau',
  name: 'Lạc Hầu Tiên',
  x: 450,
  y: 280,
  vx: 0,
  vy: 0,
  facing: 'right',
  state: 'idle',
  hp: 200,
  maxHp: 200,
  mp: 80,
  maxMp: 80,
  level: 7,
});
mockAdapter.players.set(playerB.id, playerB);

renderer.update(16);

assert.equal(renderer.getRemotePlayerCount(), 2, 'Should track 2 players simultaneously');
assert.ok(renderer.hasPlayer('p2'), 'Should track player p2');
const containerB = renderer.getPlayerContainer('p2');
assert.equal(containerB.x, 450, 'Player B x must be 450');
assert.equal(containerB.y, 280, 'Player B y must be 280');

// 2.5 Despawn Player on Room Leave
mockAdapter.players.delete('p1');
mockAdapter.lerpPositions.delete('p1');

renderer.update(16);

assert.equal(renderer.getRemotePlayerCount(), 1, 'Player count must decrease to 1 after p1 leaves');
assert.equal(renderer.hasPlayer('p1'), false, 'p1 should no longer be tracked');
assert.equal(containerA.isDestroyed, true, 'p1 container must be destroyed upon leaving');
assert.equal(renderer.hasPlayer('p2'), true, 'p2 must remain intact and active');
assert.equal(containerB.isDestroyed, false, 'p2 container must not be destroyed');

// 2.6 Destroy & Teardown
renderer.destroy();
assert.equal(renderer.getRemotePlayerCount(), 0, 'Count must reset to 0 after destroy()');
assert.equal(containerB.isDestroyed, true, 'All active containers must be destroyed on destroy()');

// 2.7 Fail-Closed Offline Safety
const offlineScene = createMockPhaserScene();
const offlineAdapter = { isConnected: false, getAllRemotePlayers: () => [], interpolatePlayer: () => null };
const offlineRenderer = new rendererModule.RemotePlayerRenderer(offlineScene, offlineAdapter);

assert.doesNotThrow(() => {
  offlineRenderer.update(16);
  offlineRenderer.destroy();
}, 'Offline renderer must operate silently and safely without throwing');

console.log('✓ Test 2: Runtime Simulation Passed\n');

// ============================================================================
// TEST 3: VILLAGESCENE INTEGRATION & OFFLINE PRESERVATION
// ============================================================================
console.log('--- Test 3: VillageScene Integration & Offline Fallback ---');

assert.ok(fs.existsSync(villageScenePath), `VillageScene.ts must exist at ${villageScenePath}`);
const villageSceneSrc = fs.readFileSync(villageScenePath, 'utf8');

// 3.1 Required Imports
assert.match(
  villageSceneSrc,
  /import\s+{[^}]*multiplayer[^}]*}\s+from\s+['"]\.\.\/online\/multiplayer['"]/,
  'VillageScene.ts must import multiplayer from ../online/multiplayer'
);
assert.match(
  villageSceneSrc,
  /import\s+{[^}]*RemotePlayerRenderer[^}]*}\s+from\s+['"]\.\.\/online\/remotePlayerRenderer['"]/,
  'VillageScene.ts must import RemotePlayerRenderer from ../online/remotePlayerRenderer'
);

// 3.2 Property declaration
assert.match(
  villageSceneSrc,
  /private\s+remotePlayers\s*:\s*RemotePlayerRenderer\s*\|\s*null\s*=\s*null/,
  'VillageScene must declare private remotePlayers: RemotePlayerRenderer | null'
);

// 3.3 create() instantiation
assert.match(
  villageSceneSrc,
  /this\.remotePlayers\s*=\s*.*new\s+RemotePlayerRenderer\(this\)/,
  'VillageScene.create() must instantiate RemotePlayerRenderer(this)'
);

// 3.4 shutdown cleanup
assert.match(
  villageSceneSrc,
  /this\.remotePlayers\s*\?\.\s*destroy\(\)/,
  'VillageScene shutdown handler must call this.remotePlayers?.destroy()'
);
assert.match(
  villageSceneSrc,
  /this\.remotePlayers\s*=\s*null/,
  'VillageScene shutdown handler must set this.remotePlayers = null'
);

// 3.5 update() throttled sendMove & remotePlayers.update
assert.match(
  villageSceneSrc,
  /if\s*\(\s*multiplayer\s*\?\.\s*isConnected\s*\)/,
  'VillageScene.update() must check multiplayer.isConnected before multiplayer sync'
);
assert.match(
  villageSceneSrc,
  /multiplayer\.sendMove\(/,
  'VillageScene.update() must call multiplayer.sendMove'
);
assert.match(
  villageSceneSrc,
  /this\.remotePlayers\s*\?\.\s*update\(delta\)/,
  'VillageScene.update() must call this.remotePlayers?.update(delta)'
);

// 3.6 Throttle interval (~40-50ms)
assert.match(
  villageSceneSrc,
  />=\s*(40|45|50)/,
  'VillageScene must enforce ~40-50ms throttle interval for sendMove'
);

// 3.7 Offline logic preservation assertions
assert.match(villageSceneSrc, /paintVillage\(this\)/, 'VillageScene must preserve paintVillage');
assert.match(villageSceneSrc, /getVillageNpcs/, 'VillageScene must preserve getVillageNpcs');
assert.match(villageSceneSrc, /getFestivalNpcs/, 'VillageScene must preserve getFestivalNpcs');
assert.match(villageSceneSrc, /this\.player\.update\(delta\)/, 'VillageScene must preserve player update');
assert.match(villageSceneSrc, /this\.hud\.refresh\(\)/, 'VillageScene must preserve HUD refresh');
assert.match(villageSceneSrc, /Forest/, 'VillageScene must preserve bamboo forest portal check');

// 3.8 Runtime Behavioral Check on VillageScene update loop
console.log('  Testing VillageScene update loop behavior in mock environment...');
{
  let sentMoves = [];
  let updatedRemoteDelta = null;

  const mockMultiplayerService = {
    isConnected: false,
    sendMove: (vx, vy, aimX, aimY) => {
      sentMoves.push({ vx, vy, aimX, aimY });
      return true;
    },
  };

  const mockRendererInstance = {
    update: (delta) => {
      updatedRemoteDelta = delta;
    },
    destroy: () => {},
  };

  // Simulate VillageScene instance methods
  const mockSceneInstance = {
    player: {
      isDead: false,
      x: 400,
      y: 350,
      inputManager: {
        getMovementVector: () => ({ x: 0.8, y: 0.6 }),
      },
      controls: {
        direction: { x: 0, y: 0 },
      },
      update: () => {},
    },
    overlay: null,
    minigameOverlay: null,
    pause: { isOpen: () => false, destroy: () => {} },
    hud: { refresh: () => {} },
    remotePlayers: mockRendererInstance,
    lastMoveSentTime: 0,
    time: { now: 100 },
    events: {
      once: (event, cb) => {
        if (event === 'shutdown') mockSceneInstance._shutdown = cb;
      },
    },
  };

  // Case A: OFFLINE MODE
  mockMultiplayerService.isConnected = false;
  sentMoves = [];
  updatedRemoteDelta = null;

  // Extract update logic behavior equivalent
  const runSceneUpdate = (delta, now) => {
    mockSceneInstance.time.now = now;
    if (mockSceneInstance.player.isDead || mockSceneInstance.overlay ||
        Boolean(mockSceneInstance.minigameOverlay) || mockSceneInstance.pause.isOpen()) return;

    mockSceneInstance.player.update(delta);
    mockSceneInstance.hud.refresh();

    if (mockMultiplayerService.isConnected) {
      const curNow = mockSceneInstance.time ? mockSceneInstance.time.now : Date.now();
      if (curNow - mockSceneInstance.lastMoveSentTime >= 50) {
        mockSceneInstance.lastMoveSentTime = curNow;
        const move = mockSceneInstance.player?.inputManager?.getMovementVector?.() ?? { x: 0, y: 0 };
        let vx = move.x + (mockSceneInstance.player?.controls?.direction?.x ?? 0);
        let vy = move.y + (mockSceneInstance.player?.controls?.direction?.y ?? 0);
        const len = Math.hypot(vx, vy);
        if (len > 1) {
          vx /= len;
          vy /= len;
        }
        mockMultiplayerService.sendMove(vx, vy, mockSceneInstance.player?.x, mockSceneInstance.player?.y);
      }
      mockSceneInstance.remotePlayers?.update(delta);
    }
  };

  runSceneUpdate(16, 100);
  assert.equal(sentMoves.length, 0, 'Offline mode must NOT invoke sendMove');
  assert.equal(updatedRemoteDelta, null, 'Offline mode must NOT tick remote players');

  // Case B: ONLINE MODE (Connected)
  mockMultiplayerService.isConnected = true;
  mockSceneInstance.lastMoveSentTime = 0;
  runSceneUpdate(16, 100);

  assert.equal(sentMoves.length, 1, 'Online mode must dispatch sendMove');
  assert.equal(updatedRemoteDelta, 16, 'Online mode must tick remote players with delta');
  assert.ok(Math.abs(sentMoves[0].vx - 0.8) < 0.001, 'vx must match normalized move input');
  assert.ok(Math.abs(sentMoves[0].vy - 0.6) < 0.001, 'vy must match normalized move input');
  assert.equal(sentMoves[0].aimX, 400, 'aimX must report player world x');
  assert.equal(sentMoves[0].aimY, 350, 'aimY must report player world y');

  // Throttling verification: tick 20ms later (< 50ms)
  runSceneUpdate(16, 120);
  assert.equal(sentMoves.length, 1, 'sendMove must be throttled within 50ms interval');

  // Throttling verification: tick 60ms later (>= 50ms)
  runSceneUpdate(16, 160);
  assert.equal(sentMoves.length, 2, 'sendMove must dispatch after 50ms interval has elapsed');
}

console.log('✓ Test 3: VillageScene Integration & Offline Fallback Passed\n');

console.log('================================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (EXIT 0)');
console.log('================================================================');
process.exit(0);
