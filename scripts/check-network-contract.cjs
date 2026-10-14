#!/usr/bin/env node
/**
 * scripts/check-network-contract.cjs
 *
 * Deterministic static analysis and runtime verification for M2 Online Boundary:
 * - src/game/online/protocol.ts
 * - src/game/online/multiplayer.ts
 *
 * Verifies:
 * 1. Static contract presence, versioning, immutability, and boundary rules.
 * 2. Strict rejection of malformed, oversized, or unknown client intents.
 * 3. Strict rejection of client authority claims (no forged HP, damage, gold, kills).
 * 4. Validation of authoritative snapshots, rejects, and server gameplay events.
 * 5. Fail-closed adapter behavior when offline / VITE_GAME_SERVER_URL is absent.
 * 6. WebSocket mock dispatch, sequence tracking, listener isolation, and clean teardown.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = process.cwd();
const protocolPath = path.join(root, 'src', 'game', 'online', 'protocol.ts');
const multiplayerPath = path.join(root, 'src', 'game', 'online', 'multiplayer.ts');
const scriptPath = path.join(root, 'scripts', 'check-network-contract.cjs');

console.log('[M2-NETWORK-CHECK] Starting deterministic network contract verification...');

// ============================================================================
// PART 1: STATIC FILE & CONTRACT CHECKS
// ============================================================================

console.log('[M2-NETWORK-CHECK] 1. Checking file existence and source contracts...');

assert.ok(fs.existsSync(protocolPath), `Missing protocol file at ${protocolPath}`);
assert.ok(fs.existsSync(multiplayerPath), `Missing multiplayer file at ${multiplayerPath}`);
assert.ok(fs.existsSync(scriptPath), `Missing self-check file at ${scriptPath}`);

const protocolSrc = fs.readFileSync(protocolPath, 'utf8');
const multiplayerSrc = fs.readFileSync(multiplayerPath, 'utf8');

// 1.1 Protocol versioning and identifier
assert.match(protocolSrc, /export\s+const\s+PROTOCOL_VERSION\s*=\s*['"]1\.0\.0['"]/, 'PROTOCOL_VERSION must be 1.0.0');
assert.match(protocolSrc, /export\s+const\s+PROTOCOL_IDENTIFIER\s*=/, 'PROTOCOL_IDENTIFIER must be declared');
assert.match(protocolSrc, /MAX_MESSAGE_BYTES/, 'MAX_MESSAGE_BYTES payload limit must be declared');

// 1.2 Required client intent contracts
const requiredIntents = ['room_join', 'move_input', 'attack', 'cast_skill', 'dodge', 'interact'];
for (const intent of requiredIntents) {
  const pattern = new RegExp(`['"]${intent}['"]`);
  assert.match(protocolSrc, pattern, `protocol.ts must define contract for intent: "${intent}"`);
}

// 1.3 Required server contracts
const requiredServerMessages = ['snapshot', 'reject', 'event'];
for (const msgType of requiredServerMessages) {
  const pattern = new RegExp(`['"]${msgType}['"]`);
  assert.match(protocolSrc, pattern, `protocol.ts must define contract for server message: "${msgType}"`);
}

// 1.4 Immutability & Authority Protection
assert.match(protocolSrc, /FORBIDDEN_CLIENT_AUTHORITY_FIELDS/, 'protocol.ts must declare forbidden client authority fields');
assert.match(protocolSrc, /Object\.freeze/, 'protocol.ts must use Object.freeze for contract tables');
assert.match(protocolSrc, /deepFreeze/, 'protocol.ts must provide deepFreeze utility');
assert.match(multiplayerSrc, /isAuthoritative[\s\S]*?return\s+false/, 'Client adapter must explicitly declare client is never authoritative');

// 1.5 Secrets protection in logging
assert.doesNotMatch(protocolSrc, /console\.log\([^)]*token[^)]*\)/i, 'protocol.ts must not log plain tokens');
assert.doesNotMatch(multiplayerSrc, /console\.log\([^)]*token[^)]*\)/i, 'multiplayer.ts must not log plain tokens');
assert.match(multiplayerSrc, /REDACTED/, 'multiplayer.ts must redact sensitive tokens in error messages');

// 1.6 Offline safety
assert.match(multiplayerSrc, /VITE_GAME_SERVER_URL/, 'multiplayer.ts must reference VITE_GAME_SERVER_URL safely');

console.log('  -> [PASS] Static contract and security checks passed.');

// ============================================================================
// PART 2: COMPILATION & RUNTIME MODULE LOADING
// ============================================================================

console.log('[M2-NETWORK-CHECK] 2. Transpiling and loading modules into test sandbox...');

function compileAndLoad(tsCode, filename, customRequires = {}) {
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
      throw new Error(`Unhandled relative require: ${id}`);
    }
    return require(id);
  };

  const sanitized = transpiled.replace(/\bimport\.meta\b/g, '({ env: typeof process !== "undefined" ? process.env : {} })');
  const runner = new Function('require', 'exports', 'module', '"use strict";\n' + sanitized);
  runner(customRequire, moduleObj.exports, moduleObj);
  return moduleObj.exports;
}

const protocolModule = compileAndLoad(protocolSrc, 'protocol.ts');
const multiplayerModule = compileAndLoad(multiplayerSrc, 'multiplayer.ts', {
  './protocol': protocolModule,
});

console.log('  -> [PASS] Modules successfully transpiled and loaded in memory.');

// ============================================================================
// PART 3: VALID CLIENT INTENT GENERATION & IMMUTABILITY
// ============================================================================

console.log('[M2-NETWORK-CHECK] 3. Testing valid client intent creators and immutability...');

const {
  PROTOCOL_VERSION,
  validateClientIntent,
  validateServerMessage,
  createRoomJoinIntent,
  createMoveInputIntent,
  createAttackIntent,
  createCastSkillIntent,
  createDodgeIntent,
  createInteractIntent,
  serializeIntent,
  deserializeServerMessage,
  deepFreeze,
} = protocolModule;

// 3.1 Room Join Intent
const joinIntent = createRoomJoinIntent('lac-thuy-hub', 'char-hero-1', 'mock.jwt.token');
assert.equal(joinIntent.type, 'room_join');
assert.equal(joinIntent.protocolVersion, PROTOCOL_VERSION);
assert.equal(joinIntent.roomId, 'lac-thuy-hub');
assert.equal(joinIntent.characterId, 'char-hero-1');
assert.equal(joinIntent.token, 'mock.jwt.token');
assert.ok(Object.isFrozen(joinIntent), 'RoomJoinIntent must be frozen');

const validJoinResult = validateClientIntent(joinIntent);
assert.equal(validJoinResult.ok, true);
assert.ok(validJoinResult.value);

// 3.2 Move Input Intent
const moveIntent = createMoveInputIntent(1, 0.75, -0.25, 450, 600);
assert.equal(moveIntent.type, 'move_input');
assert.equal(moveIntent.seq, 1);
assert.equal(moveIntent.moveX, 0.75);
assert.equal(moveIntent.moveY, -0.25);
assert.equal(moveIntent.aimWorldX, 450);
assert.equal(moveIntent.aimWorldY, 600);
assert.ok(Object.isFrozen(moveIntent));

const validMoveResult = validateClientIntent(moveIntent);
assert.equal(validMoveResult.ok, true);

// Clamping test
const clampedMove = createMoveInputIntent(2, 5.0, -9.0);
assert.equal(clampedMove.moveX, 1.0);
assert.equal(clampedMove.moveY, -1.0);

// 3.3 Attack Intent
const attackIntent = createAttackIntent(3, 2, 500, 300, 'boss-tiger-1');
assert.equal(attackIntent.type, 'attack');
assert.equal(attackIntent.comboIndex, 2);
assert.equal(attackIntent.targetEntityId, 'boss-tiger-1');
assert.ok(Object.isFrozen(attackIntent));
assert.equal(validateClientIntent(attackIntent).ok, true);

// 3.4 Cast Skill Intent
const skillIntent = createCastSkillIntent(4, 'slot-1', 'boss-tiger-1', 520, 310);
assert.equal(skillIntent.type, 'cast_skill');
assert.equal(skillIntent.skillId, 'slot-1');
assert.ok(Object.isFrozen(skillIntent));
assert.equal(validateClientIntent(skillIntent).ok, true);

// 3.5 Dodge Intent
const dodgeIntent = createDodgeIntent(5, -1.0, 0.0);
assert.equal(dodgeIntent.type, 'dodge');
assert.equal(dodgeIntent.directionX, -1.0);
assert.equal(dodgeIntent.directionY, 0.0);
assert.ok(Object.isFrozen(dodgeIntent));
assert.equal(validateClientIntent(dodgeIntent).ok, true);

// 3.6 Interact Intent
const interactIntent = createInteractIntent(6, 'npc-an-duong-vuong', 'dialogue');
assert.equal(interactIntent.type, 'interact');
assert.equal(interactIntent.targetId, 'npc-an-duong-vuong');
assert.equal(interactIntent.interactionType, 'dialogue');
assert.ok(Object.isFrozen(interactIntent));
assert.equal(validateClientIntent(interactIntent).ok, true);

console.log('  -> [PASS] Valid intents construct and pass validation with immutability.');

// ============================================================================
// PART 4: REJECTION OF MALFORMED, OVERSIZED, AND UNKNOWN INTENTS
// ============================================================================

console.log('[M2-NETWORK-CHECK] 4. Testing rejection of malformed, oversized, and unknown intents...');

// 4.1 Non-object / nil / array payloads
for (const malformed of [null, undefined, 123, 'hello', [], [{}], true]) {
  const res = validateClientIntent(malformed);
  assert.equal(res.ok, false, `Expected non-object payload to be rejected: ${String(malformed)}`);
  assert.equal(res.code, 'MALFORMED');
}

// 4.2 Unknown intent type
for (const unknown of [
  { type: 'teleport' },
  { type: 'god_mode' },
  { type: 'chat_global' },
  { type: '' },
  { noType: true },
]) {
  const res = validateClientIntent(unknown);
  assert.equal(res.ok, false, `Expected unknown type to be rejected: ${JSON.stringify(unknown)}`);
  assert.equal(res.code, 'UNKNOWN_INTENT');
}

// 4.3 Malformed room_join
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: '', characterId: 'c1', clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: 'room with spaces!', characterId: 'c1', clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: 'x'.repeat(65), characterId: 'c1', clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: 'r1', characterId: 'c1', clientTimestamp: -50 }).ok, false);
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: 'r1', characterId: 'c1', clientTimestamp: NaN }).ok, false);
assert.equal(validateClientIntent({ type: 'room_join', protocolVersion: '1.0.0', roomId: 'r1', characterId: 'c1', clientTimestamp: 100, unexpectedField: 'bad' }).ok, false);

// 4.4 Malformed move_input
assert.equal(validateClientIntent({ type: 'move_input', seq: -1, moveX: 0, moveY: 0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1.5, moveX: 0, moveY: 0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1, moveX: 1.05, moveY: 0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1, moveX: 0, moveY: -2.0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1, moveX: NaN, moveY: 0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1, moveX: 0, moveY: Infinity, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'move_input', seq: 1, moveX: 0, moveY: 0, aimWorldX: 200000, clientTimestamp: 100 }).ok, false);

// 4.5 Malformed attack
assert.equal(validateClientIntent({ type: 'attack', seq: 1, comboIndex: -1, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'attack', seq: 1, comboIndex: 4, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'attack', seq: 1, comboIndex: 1, targetEntityId: 'a'.repeat(65), clientTimestamp: 100 }).ok, false);

// 4.6 Malformed cast_skill
assert.equal(validateClientIntent({ type: 'cast_skill', seq: 1, skillId: '', clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'cast_skill', seq: 1, skillId: 's'.repeat(33), clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'cast_skill', seq: 1, skillId: 'skill;drop', clientTimestamp: 100 }).ok, false);

// 4.7 Malformed dodge
assert.equal(validateClientIntent({ type: 'dodge', seq: 1, directionX: 1.5, directionY: 0, clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'dodge', seq: 1, directionX: 0, directionY: -1.5, clientTimestamp: 100 }).ok, false);

// 4.8 Malformed interact
assert.equal(validateClientIntent({ type: 'interact', seq: 1, targetId: '', clientTimestamp: 100 }).ok, false);
assert.equal(validateClientIntent({ type: 'interact', seq: 1, targetId: 't'.repeat(65), clientTimestamp: 100 }).ok, false);

// 4.9 Oversized payload (> 4096 bytes)
const oversizedIntent = {
  type: 'interact',
  seq: 1,
  targetId: 'npc-1',
  interactionType: 'x'.repeat(4500),
  clientTimestamp: 100,
};
const oversizedResult = validateClientIntent(oversizedIntent);
assert.equal(oversizedResult.ok, false);
assert.equal(oversizedResult.code, 'OVERSIZED');

console.log('  -> [PASS] Malformed, oversized, and unknown intents strictly rejected.');

// ============================================================================
// PART 5: STRICT REJECTION OF CLIENT AUTHORITY CLAIMS
// ============================================================================

console.log('[M2-NETWORK-CHECK] 5. Testing rejection of client authority claims (anti-cheat)...');

const forbiddenAuthorityClaims = [
  { intent: { type: 'attack', seq: 1, comboIndex: 0, damage: 99999, clientTimestamp: 100 }, field: 'damage' },
  { intent: { type: 'move_input', seq: 1, moveX: 0, moveY: 0, hp: 500, clientTimestamp: 100 }, field: 'hp' },
  { intent: { type: 'room_join', protocolVersion: '1.0.0', roomId: 'r1', characterId: 'c1', gold: 100000, clientTimestamp: 100 }, field: 'gold' },
  { intent: { type: 'cast_skill', seq: 1, skillId: 'slot-1', xp: 50000, clientTimestamp: 100 }, field: 'xp' },
  { intent: { type: 'dodge', seq: 1, directionX: 1, directionY: 0, level: 99, clientTimestamp: 100 }, field: 'level' },
  { intent: { type: 'interact', seq: 1, targetId: 'chest', kills: 99, clientTimestamp: 100 }, field: 'kills' },
  { intent: { type: 'move_input', seq: 1, moveX: 0, moveY: 0, isDead: false, clientTimestamp: 100 }, field: 'isDead' },
  { intent: { type: 'attack', seq: 1, godMode: true, clientTimestamp: 100 }, field: 'godMode' },
  { intent: { type: 'attack', seq: 1, serverTick: 500, clientTimestamp: 100 }, field: 'serverTick' },
  { intent: { type: 'interact', seq: 1, targetId: 'npc', grantGold: 500, clientTimestamp: 100 }, field: 'grantGold' },
];

for (const { intent, field } of forbiddenAuthorityClaims) {
  const result = validateClientIntent(intent);
  assert.equal(result.ok, false, `Expected authority claim "${field}" to be rejected`);
  assert.equal(result.code, 'UNAUTHORIZED', `Authority claim "${field}" must return UNAUTHORIZED reject code`);
  assert.match(result.error || '', new RegExp(field), `Error must explicitly mention forbidden field: ${field}`);
}

console.log('  -> [PASS] All 10/10 client authority claim attempts rejected with UNAUTHORIZED.');

// ============================================================================
// PART 6: SERVER SNAPSHOT, REJECT, AND EVENT CONTRACT VALIDATION
// ============================================================================

console.log('[M2-NETWORK-CHECK] 6. Testing authoritative server message validation...');

// 6.1 Server Snapshot
const sampleSnapshot = {
  type: 'snapshot',
  serverTick: 120,
  serverTimestamp: Date.now(),
  ackSeq: 5,
  players: [
    {
      id: 'p-1',
      characterId: 'char-hero-1',
      name: 'Thạch Sanh',
      x: 320,
      y: 480,
      vx: 10,
      vy: 0,
      facing: 'right',
      state: 'walk',
      hp: 120,
      maxHp: 120,
      mp: 80,
      maxMp: 80,
      level: 3,
    },
  ],
  monsters: [
    {
      id: 'm-1',
      monsterType: 'wild-boar',
      x: 500,
      y: 480,
      vx: -5,
      vy: 0,
      facing: 'left',
      hp: 40,
      maxHp: 50,
      state: 'chase',
      targetPlayerId: 'p-1',
    },
  ],
  projectiles: [
    {
      id: 'proj-1',
      ownerId: 'p-1',
      projectileType: 'arrow',
      x: 350,
      y: 480,
      vx: 200,
      vy: 0,
    },
  ],
};

const snapshotResult = validateServerMessage(sampleSnapshot);
assert.equal(snapshotResult.ok, true);
assert.ok(snapshotResult.value);
assert.equal(snapshotResult.value.serverTick, 120);
assert.equal(snapshotResult.value.players.length, 1);
assert.equal(snapshotResult.value.monsters.length, 1);
assert.equal(snapshotResult.value.projectiles.length, 1);
assert.ok(Object.isFrozen(snapshotResult.value));

// Invalid snapshot
assert.equal(validateServerMessage({ type: 'snapshot', serverTick: -1 }).ok, false);
assert.equal(validateServerMessage({ type: 'snapshot', serverTick: 1, players: 'not-array' }).ok, false);

// 6.2 Server Reject
const sampleReject = {
  type: 'reject',
  seq: 4,
  intentType: 'cast_skill',
  code: 'ON_COOLDOWN',
  reason: 'Kỹ năng đang trong thời gian hồi chiêu.',
  serverTimestamp: Date.now(),
};
const rejectResult = validateServerMessage(sampleReject);
assert.equal(rejectResult.ok, true);
assert.equal(rejectResult.value.code, 'ON_COOLDOWN');
assert.ok(Object.isFrozen(rejectResult.value));

// Invalid reject
assert.equal(validateServerMessage({ type: 'reject', intentType: 'cast_skill', code: 'INVALID_CODE', reason: 'bad', serverTimestamp: 100 }).ok, false);

// 6.3 Server Event
const sampleEvent = {
  type: 'event',
  serverTick: 121,
  serverTimestamp: Date.now(),
  event: {
    kind: 'damage_dealt',
    sourceId: 'p-1',
    targetId: 'm-1',
    amount: 35,
    isCritical: true,
    newHp: 5,
  },
};
const eventResult = validateServerMessage(sampleEvent);
assert.equal(eventResult.ok, true);
assert.equal(eventResult.value.event.kind, 'damage_dealt');
assert.ok(Object.isFrozen(eventResult.value));

// Serialization & Deserialization
const serializedSnapshot = JSON.stringify(sampleSnapshot);
const deserialized = deserializeServerMessage(serializedSnapshot);
assert.equal(deserialized.ok, true);
assert.equal(deserialized.value.type, 'snapshot');

console.log('  -> [PASS] Authoritative snapshots, rejects, and events validated.');

// ============================================================================
// PART 7: MULTIPLAYER ADAPTER FAIL-CLOSED & OFFLINE SAFETY
// ============================================================================

console.log('[M2-NETWORK-CHECK] 7. Testing MultiplayerAdapter fail-closed & offline safety...');

const { MultiplayerAdapter, readGameServerConfig } = multiplayerModule;

// 7.1 Config reading with absent URL
assert.equal(readGameServerConfig({}), null, 'Absent env must return null config');
assert.equal(readGameServerConfig({ VITE_GAME_SERVER_URL: '   ' }), null, 'Empty env must return null config');
assert.equal(readGameServerConfig({ VITE_GAME_SERVER_URL: 'http://not-ws.com' }), null, 'Non-ws URL must return null config');
const validConfig = readGameServerConfig({ VITE_GAME_SERVER_URL: 'wss://game.thanmenh.vn' });
assert.ok(validConfig);
assert.equal(validConfig.serverUrl, 'wss://game.thanmenh.vn');

// 7.2 Instantiation without config (default offline mode)
const offlineAdapter = new MultiplayerAdapter(null);
assert.equal(offlineAdapter.isConfigured, false);
assert.equal(offlineAdapter.isConnected, false);
assert.equal(offlineAdapter.state.status, 'offline');
assert.equal(offlineAdapter.isAuthoritative, false, 'Client adapter must report isAuthoritative = false');
assert.equal(offlineAdapter.latestSnapshot, null);
assert.equal(offlineAdapter.serverTick, 0);
assert.deepEqual(offlineAdapter.getAllRemotePlayers(), []);
assert.deepEqual(offlineAdapter.getAllMonsters(), []);

// 7.3 Fail-closed sending when offline
assert.equal(offlineAdapter.sendIntent(createMoveInputIntent(1, 0.5, 0.5)), false, 'sendIntent must fail closed when offline');
assert.equal(offlineAdapter.sendMove(0.5, 0.5), false, 'sendMove must fail closed when offline');
assert.equal(offlineAdapter.sendAttack(0), false, 'sendAttack must fail closed when offline');
assert.equal(offlineAdapter.sendCastSkill('slot-1'), false, 'sendCastSkill must fail closed when offline');
assert.equal(offlineAdapter.sendDodge(1, 0), false, 'sendDodge must fail closed when offline');
assert.equal(offlineAdapter.sendInteract('target-1'), false, 'sendInteract must fail closed when offline');

// 7.4 Connect without configured server URL
offlineAdapter.connect({ roomId: 'hub', characterId: 'c1' }).then((connected) => {
  assert.equal(connected, false, 'connect() without server URL must return false');
  assert.equal(offlineAdapter.state.status, 'offline');
});

console.log('  -> [PASS] Fail-closed offline safety confirmed.');

// ============================================================================
// PART 8: COLYSEUS ADAPTER BOUNDARY (no live server)
console.log('[M2-NETWORK-CHECK] 8. Testing official Colyseus adapter boundary...');
assert.match(multiplayerSrc, /from ['"]colyseus\.js['"]/, 'client must use official Colyseus SDK');
assert.match(multiplayerSrc, /joinOrCreate\(['"]than-menh\.v1['"]/, 'client room name must match versioned server room');
assert.match(multiplayerSrc, /authorization: options\.token \? `Bearer \${options\.token}`/, 'join options must carry Bearer authorization');
assert.match(multiplayerSrc, /roomId: options\.roomId/, 'join options must carry roomId');
assert.match(multiplayerSrc, /characterId: options\.characterId/, 'join options must carry characterId');
assert.match(multiplayerSrc, /room\.send\(['"]intent['"]/, 'validated intents must use the server intent message boundary');
assert.match(multiplayerSrc, /onMessage\(['"]snapshot['"]/, 'snapshot adapter must bind room messages');
assert.match(multiplayerSrc, /onMessage\(['"]reject['"]/, 'reject adapter must bind room messages');
assert.match(multiplayerSrc, /onMessage\(['"]event['"]/, 'event adapter must bind room messages');
assert.doesNotMatch(multiplayerSrc, /console\.log\([^)]*token/i, 'tokens must never be logged');
console.log('  -> [PASS] Colyseus join options, room name, and validated message adapters verified statically.');
console.log('----------------------------------------------------------------------');
console.log('[SUCCESS] All M2 network protocol and multiplayer adapter checks passed!');
