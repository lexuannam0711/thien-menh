#!/usr/bin/env node
/**
 * scripts/check-character-lifecycle.cjs
 *
 * Deterministic test suite for M1 client character lifecycle & M5 server contract integration:
 * - src/game/online/characters.ts
 * - src/game/scenes/MenuScene.ts
 *
 * Verifies:
 * 1. Static source contracts: own-user filters, least-privilege columns, authority field protections.
 * 2. Runtime getOrCreateCharacter with existing character.
 * 3. Runtime getOrCreateCharacter with absent character: inserts only user_id and name.
 * 4. Runtime concurrent create handling (race condition re-query on unique constraint conflict 23505).
 * 5. Runtime validation & fail-closed behavior for invalid auth UUID and malformed returned rows.
 * 6. Leak-free safe error messages (no raw DB messages or secrets in user-facing UI messages).
 * 7. Offline preservation when Supabase/DB/network is unavailable.
 * 8. MenuScene integration: multiplayer singleton lifecycle preserved across MenuScene -> VillageScene,
 *    listeners unsubscribed on shutdown, late async completion fenced on logout/shutdown,
 *    and real database UUID reaches multiplayer.connect.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = process.cwd();
const charactersPath = path.join(root, 'src', 'game', 'online', 'characters.ts');
const menuScenePath = path.join(root, 'src', 'game', 'scenes', 'MenuScene.ts');

console.log('[CHARACTER-LIFECYCLE-CHECK] Starting deterministic verification...');

// ============================================================================
// PART 1: STATIC SOURCE CONTRACT CHECKS
// ============================================================================

console.log('[CHARACTER-LIFECYCLE-CHECK] 1. Checking file existence and source contracts...');

assert.ok(fs.existsSync(charactersPath), `characters.ts must exist at ${charactersPath}`);
assert.ok(fs.existsSync(menuScenePath), `MenuScene.ts must exist at ${menuScenePath}`);

const charactersSrc = fs.readFileSync(charactersPath, 'utf8');
const menuSceneSrc = fs.readFileSync(menuScenePath, 'utf8');

// 1.1 characters.ts contract
assert.match(charactersSrc, /export\s+(async\s+)?function\s+getOrCreateCharacter/, 'characters.ts must export getOrCreateCharacter');
assert.match(charactersSrc, /eq\(\s*['"]user_id['"]\s*,/, 'characters.ts must query characters filtered by user_id');
assert.match(charactersSrc, /\.from\(\s*['"]characters['"]\s*\)/, 'characters.ts must operate on characters table');
assert.doesNotMatch(charactersSrc, /service[_-]?role/i, 'characters.ts must never reference service_role key');
assert.doesNotMatch(charactersSrc, /\.split\(\s*['"]@['"]\s*\)/, 'characters.ts must not derive character name from email');
assert.doesNotMatch(charactersSrc, /email.*name/i, 'characters.ts must not create profile/character names from email');

// Server-owned fields must NOT be inserted or updated by client
const forbiddenAuthorityFields = ['level', 'xp', 'gold', 'chapter', 'kills', 'checkpoint', 'playtime_seconds'];
for (const field of forbiddenAuthorityFields) {
  const insertPattern = new RegExp(`insert\\s*\\([\\s\\S]*?\\b${field}\\b[\\s\\S]*?\\)`);
  assert.doesNotMatch(charactersSrc, insertPattern, `characters.ts must NOT insert authority field: "${field}"`);
}

// 1.2 MenuScene.ts contract
assert.match(menuSceneSrc, /import\s+.*?\bmultiplayer\b.*?from\s+['"][^'"]*online\/multiplayer['"]/, 'MenuScene.ts must import multiplayer singleton');
assert.doesNotMatch(menuSceneSrc, /new\s+MultiplayerAdapter\s*\(/, 'MenuScene.ts must NOT instantiate new MultiplayerAdapter(); use multiplayer singleton');
assert.doesNotMatch(menuSceneSrc, /char-\$\{.*?user.*?id/i, 'MenuScene.ts must not pass char-${userId} to multiplayer.connect');
assert.match(menuSceneSrc, /getOrCreateCharacter/, 'MenuScene.ts must import and use getOrCreateCharacter');

// Verify MenuScene shutdown / destroy does NOT disconnect or destroy the multiplayer singleton
function extractMethodBody(src, methodName) {
  const startIdx = src.indexOf(`private ${methodName}()`);
  if (startIdx === -1) return '';
  const braceIdx = src.indexOf('{', startIdx);
  let depth = 1;
  for (let i = braceIdx + 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(braceIdx + 1, i);
    }
  }
  return '';
}

const cleanupBody = extractMethodBody(menuSceneSrc, 'cleanup');
assert.ok(cleanupBody.length > 0, 'MenuScene must have private cleanup() method');
assert.doesNotMatch(cleanupBody, /multiplayer\s*\.\s*disconnect\s*\(/, 'MenuScene.cleanup() must NOT disconnect multiplayer (session must stay alive for VillageScene)');
assert.doesNotMatch(cleanupBody, /multiplayer\s*\.\s*destroy\s*\(/, 'MenuScene.cleanup() must NOT destroy multiplayer');
assert.match(cleanupBody, /networkUnsubscribe/, 'MenuScene.cleanup() must unsubscribe network listener');
assert.match(cleanupBody, /authUnsubscribe/, 'MenuScene.cleanup() must unsubscribe auth listener');

console.log('  -> [PASS] Static contract checks passed.');

// ============================================================================
// PART 2: RUNTIME MODULE TRANSPILATION
// ============================================================================

console.log('[CHARACTER-LIFECYCLE-CHECK] 2. Transpiling and loading characters.ts...');

function compileAndLoad(tsCode, filename) {
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
    if (id === '@supabase/supabase-js') {
      return {};
    }
    return require(id);
  };

  const runner = new Function('require', 'exports', 'module', '"use strict";\n' + transpiled);
  runner(customRequire, moduleObj.exports, moduleObj);
  return moduleObj.exports;
}

const charactersModule = compileAndLoad(charactersSrc, 'characters.ts');
const { getOrCreateCharacter, isValidUuid } = charactersModule;

assert.equal(typeof getOrCreateCharacter, 'function', 'getOrCreateCharacter must be a function');
assert.equal(typeof isValidUuid, 'function', 'isValidUuid must be a function');

console.log('  -> [PASS] Module loaded successfully.');

// ============================================================================
// PART 3: RUNTIME UNIT TESTS FOR getOrCreateCharacter
// ============================================================================

console.log('[CHARACTER-LIFECYCLE-CHECK] 3. Running unit tests for getOrCreateCharacter...');

const validUserId = '11111111-2222-4333-8444-555555555555';
const validCharId = '99999999-8888-4777-8666-555555555555';

(async () => {
  // Test 3.1: Valid existing character loaded by owner user_id
  {
    const queryLog = [];
    const mockClient = {
      from(table) {
        queryLog.push({ action: 'from', table });
        return {
          select(columns) {
            queryLog.push({ action: 'select', columns });
            return {
              eq(col, val) {
                queryLog.push({ action: 'eq', col, val });
                return {
                  async maybeSingle() {
                    queryLog.push({ action: 'maybeSingle' });
                    return {
                      data: {
                        id: validCharId,
                        user_id: validUserId,
                        name: 'Hiệp Sĩ Văn Lang',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const character = await getOrCreateCharacter(mockClient, validUserId);
    assert.ok(character, 'Character must be returned');
    assert.equal(character.id, validCharId, 'Must return the database character UUID');
    assert.equal(character.user_id, validUserId, 'Must return matching user_id');
    assert.equal(character.name, 'Hiệp Sĩ Văn Lang');

    // Verify own-user filter used
    const eqCall = queryLog.find((q) => q.action === 'eq');
    assert.deepEqual(eqCall, { action: 'eq', col: 'user_id', val: validUserId }, 'Must filter by authenticated user_id');

    // Verify selected columns do NOT include server authority fields
    const selectCall = queryLog.find((q) => q.action === 'select');
    for (const f of forbiddenAuthorityFields) {
      assert.ok(!selectCall.columns.includes(f), `Query must not select authority field ${f}`);
    }
    console.log('  -> [PASS] 3.1 Existing character queried by own user_id successfully.');
  }

  // Test 3.2: Absent character -> creates row with ONLY { user_id, name }
  {
    let insertPayload = null;
    let selectedAfterInsert = null;
    const mockClient = {
      from(table) {
        assert.equal(table, 'characters');
        return {
          select(columns) {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    return { data: null, error: null }; // Absent
                  },
                };
              },
            };
          },
          insert(payload) {
            insertPayload = payload;
            return {
              select(columns) {
                selectedAfterInsert = columns;
                return {
                  async single() {
                    return {
                      data: {
                        id: validCharId,
                        user_id: payload.user_id,
                        name: payload.name,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const character = await getOrCreateCharacter(mockClient, validUserId);
    assert.ok(character, 'Created character must be returned');
    assert.equal(character.id, validCharId);
    assert.equal(character.user_id, validUserId);
    assert.ok(insertPayload, 'Insert must be executed');

    // Crucial check: ONLY user_id and name are present in insertPayload
    const keys = Object.keys(insertPayload).sort();
    assert.deepEqual(keys, ['name', 'user_id'], 'Insert payload must strictly contain only user_id and name');
    for (const f of forbiddenAuthorityFields) {
      assert.equal(insertPayload[f], undefined, `Insert payload must not have authority field ${f}`);
    }
    console.log('  -> [PASS] 3.2 Absent character created with strictly {user_id, name}.');
  }

  // Test 3.3: Concurrent create race condition (unique constraint violation 23505 -> re-queries)
  {
    let reQueryExecuted = false;
    let insertAttempts = 0;
    const mockClient = {
      from(table) {
        return {
          select(columns) {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    if (insertAttempts === 0) {
                      return { data: null, error: null }; // Absent on first query
                    }
                    reQueryExecuted = true;
                    return {
                      data: {
                        id: validCharId,
                        user_id: validUserId,
                        name: 'Hiệp Sĩ Song Hành',
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          insert(payload) {
            insertAttempts++;
            return {
              select(columns) {
                return {
                  async single() {
                    // Simulate PostgreSQL unique constraint conflict (error 23505)
                    return {
                      data: null,
                      error: {
                        code: '23505',
                        message: 'duplicate key value violates unique constraint "uq_user_character"',
                        details: 'Key (user_id)=(...) already exists.',
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    const character = await getOrCreateCharacter(mockClient, validUserId);
    assert.ok(reQueryExecuted, 'Re-query must be executed after unique constraint conflict');
    assert.equal(character.id, validCharId, 'Returns character obtained from re-query');
    assert.equal(character.name, 'Hiệp Sĩ Song Hành');
    console.log('  -> [PASS] 3.3 Concurrent create race condition resolved via re-query.');
  }

  // Test 3.4: Invalid user UUID fails closed
  {
    const mockClient = {
      from() {
        throw new Error('Database should not be contacted for invalid user UUID');
      },
    };

    for (const badId of ['invalid-uuid', '', '12345', 'char-11111111-2222-4333-8444-555555555555', null, undefined]) {
      await assert.rejects(
        () => getOrCreateCharacter(mockClient, badId),
        (err) => {
          assert.ok(err instanceof Error, 'Must reject with an Error');
          assert.doesNotMatch(err.message, /SELECT|INSERT|POSTGRES|SECRET|TABLE/i, 'Must not leak SQL or internals');
          return true;
        },
        `Invalid user ID "${badId}" must fail closed`
      );
    }
    console.log('  -> [PASS] 3.4 Invalid user UUID fails closed before DB contact.');
  }

  // Test 3.5: Corrupted / invalid returned row fails closed
  {
    const corruptedRows = [
      null,
      {},
      { id: 'not-a-uuid', user_id: validUserId, name: 'Hiệp Sĩ' },
      { id: validCharId, user_id: 'mismatched-user-id', name: 'Hiệp Sĩ' },
      { id: validCharId, user_id: validUserId, name: '' },
    ];

    for (const row of corruptedRows) {
      const mockClient = {
        from() {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
            insert() {
              return {
                select() {
                  return {
                    async single() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };

      await assert.rejects(
        () => getOrCreateCharacter(mockClient, validUserId),
        (err) => {
          assert.ok(err instanceof Error);
          assert.doesNotMatch(err.message, /SELECT|INSERT|POSTGRES|SECRET/i);
          return true;
        },
        'Corrupted row must fail closed'
      );
    }
    console.log('  -> [PASS] 3.5 Corrupted returned row fails closed safely.');
  }

  // Test 3.6: Database errors do NOT leak secrets or internal DB errors
  {
    const mockClient = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: null,
                      error: {
                        code: '42P01',
                        message: 'relation "characters" does not exist at postgres_backend.c:123; role=supabase_admin; pkey=sk_live_secret123',
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    await assert.rejects(
      () => getOrCreateCharacter(mockClient, validUserId),
      (err) => {
        assert.ok(err instanceof Error);
        assert.doesNotMatch(err.message, /relation "characters"/);
        assert.doesNotMatch(err.message, /postgres_backend/);
        assert.doesNotMatch(err.message, /sk_live_secret/);
        assert.doesNotMatch(err.message, /supabase_admin/);
        return true;
      },
      'Database error messages and secrets must NOT leak to user error'
    );
    console.log('  -> [PASS] 3.6 Database error details and secrets are not leaked.');
  }

  // Test 3.7: Offline preservation (null client fails closed safely without crashing)
  {
    await assert.rejects(
      () => getOrCreateCharacter(null, validUserId),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      },
      'Null client must fail closed safely'
    );
    console.log('  -> [PASS] 3.7 Offline preservation confirmed.');
  }

  // ============================================================================
  // PART 4: RUNTIME VERIFICATION OF MenuScene LIFECYCLE & MULTIPLAYER SINGLETON
  // ============================================================================

  console.log('[CHARACTER-LIFECYCLE-CHECK] 4. Testing MenuScene lifecycle, multiplayer singleton preservation, and late result fencing...');

  {
    // 4.1 Verify MenuScene cleanup does not disconnect multiplayer singleton
    let multiplayerDisconnects = 0;
    let multiplayerDestroys = 0;
    const testMultiplayer = {
      disconnect() { multiplayerDisconnects++; },
      destroy() { multiplayerDestroys++; },
    };

    let unsubNetworkCalled = false;
    let unsubAuthCalled = false;

    const transpiledMenu = ts.transpileModule(menuSceneSrc, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
      fileName: 'MenuScene.ts',
    }).outputText;

    const mockMenuDeps = {
      phaser: { Scene: class {} },
      '../../data/config': { W: 960, H: 540, PALETTE: { bronze: 0x8a7042 } },
      '../ui/art': { button: () => ({ list: [0, 1, 2, 3, 4, {}] }), label: () => ({}) },
      '../systems/GameState': { gameState: { hasSave: true, data: { chapter: 1 } } },
      '../ui/SettingsModel': { settingsModel: { syncSound() {}, isMuted: () => false, getMuteLabel: () => 'Mute' }, CONTROLS_GUIDE: { keyboard: [], mobile: [], tips: [] } },
      '../audio/AudioManager': { audioManager: { loadFromStorage() {}, syncFromSettings() {}, startMusic() {}, playCue() {}, unlock: async () => {} } },
      '../rendering/GraphicsSettings': { graphicsSettings: { getState: () => ({ quality: 'high', reducedMotion: false }) } },
      '../ui/screens/ControlsSettings': { ControlsSettings: class {} },
      '../online/auth': { AuthStore: class {}, authStore: { snapshot: { status: 'offline', user: null }, subscribe: () => () => {}, signInWithPassword: async () => {}, signUp: async () => {}, signOut: async () => {} }, validateCredentials: () => null },
      '../online/multiplayer': { multiplayer: testMultiplayer, MultiplayerAdapter: class {} },
      '../online/characters': charactersModule,
    };

    const menuModuleObj = { exports: {} };
    const runner = new Function('require', 'exports', 'module', '"use strict";\n' + transpiledMenu);
    runner((id) => mockMenuDeps[id] ?? {}, menuModuleObj.exports, menuModuleObj);
    const MenuSceneClass = menuModuleObj.exports.MenuScene;

    const testScene = new MenuSceneClass();
    testScene.networkUnsubscribe = () => { unsubNetworkCalled = true; };
    testScene.authUnsubscribe = () => { unsubAuthCalled = true; };
    testScene.cleanup();

    assert.equal(multiplayerDisconnects, 0, 'MenuScene.cleanup() must NOT disconnect multiplayer singleton');
    assert.equal(multiplayerDestroys, 0, 'MenuScene.cleanup() must NOT destroy multiplayer singleton');
    assert.equal(unsubNetworkCalled, true, 'MenuScene.cleanup() must unsubscribe network listener');
    assert.equal(unsubAuthCalled, true, 'MenuScene.cleanup() must unsubscribe auth listener');
    assert.equal(testScene.isSceneDestroyed, true, 'isSceneDestroyed must be set to true');
    console.log('  -> [PASS] 4.1 MenuScene cleanup preserves multiplayer session across scene transitions.');

    // 4.2 Verify late async completion fencing
    assert.ok(testScene.authGeneration > 0, 'authGeneration must be incremented on cleanup');
    const fencedGen = testScene.authGeneration;
    testScene.cleanup();
    assert.equal(testScene.authGeneration, fencedGen + 1, 'Subsequent cleanup increments authGeneration further');
    console.log('  -> [PASS] 4.2 Late async fencing generation tracking verified.');
  }

  // 4.3 Runtime test that database UUID (not char-${userId}) reaches multiplayer.connect
  {
    const connectCalls = [];
    const testMultiplayer = {
      isConnected: false,
      onStateChange(cb) { return () => {}; },
      async connect(options) {
        connectCalls.push(options);
        return true;
      },
      disconnect() {},
    };

    let authListener = null;
    const testAuthStore = {
      snapshot: { status: 'loading', user: null },
      subscribe(fn) {
        authListener = fn;
        return () => {};
      },
      client: {
        auth: {
          async getSession() {
            return { data: { session: { access_token: 'fake.jwt.token' } } };
          },
        },
        from(table) {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          id: validCharId,
                          user_id: validUserId,
                          name: 'Chiến Binh Văn Lang',
                        },
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      },
      signOut: async () => {},
    };

    const elementsCreated = [];
    const makeElement = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        children: [],
        style: {},
        classList: { toggle() {}, add() {}, remove() {} },
        setAttribute() {},
        removeAttribute() {},
        appendChild(child) { el.children.push(child); return child; },
        append(...children) { el.children.push(...children); },
        remove() {},
        addEventListener(event, fn) { el[event] = fn; },
      };
      elementsCreated.push(el);
      return el;
    };

    const previousDoc = global.document;
    const previousWin = global.window;
    global.document = {
      createElement: makeElement,
      createTextNode: (text) => ({ textContent: text }),
      getElementById: (id) => makeElement('div'),
      body: makeElement('body'),
    };
    global.window = {
      addEventListener() {},
      removeEventListener() {},
      setTimeout: (fn) => fn(),
    };

    try {
      const transpiledMenu = ts.transpileModule(menuSceneSrc, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
        fileName: 'MenuScene.ts',
      }).outputText;

      const mockMenuDeps = {
        phaser: { Scene: class {} },
        '../../data/config': { W: 960, H: 540, PALETTE: { bronze: 0x8a7042 } },
        '../ui/art': { button: () => ({ list: [0, 1, 2, 3, 4, {}] }), label: () => ({}) },
        '../systems/GameState': { gameState: { hasSave: true, data: { chapter: 1 } } },
        '../ui/SettingsModel': { settingsModel: { syncSound() {}, isMuted: () => false, getMuteLabel: () => 'Mute', getAccessibleMuteLabel: () => '' }, CONTROLS_GUIDE: { keyboard: [], mobile: [], tips: [] } },
        '../audio/AudioManager': { audioManager: { loadFromStorage() {}, syncFromSettings() {}, startMusic() {}, playCue() {}, unlock: async () => {}, getMasterVolume: () => 1, getMusicVolume: () => 1, getSfxVolume: () => 1, setMasterVolume: () => 1, setMusicVolume: () => 1, setSfxVolume: () => 1, saveToStorage: () => true } },
        '../rendering/GraphicsSettings': { graphicsSettings: { getState: () => ({ quality: 'high', reducedMotion: false }), setQuality: () => true, setReducedMotion: () => true } },
        '../ui/screens/ControlsSettings': { ControlsSettings: class {} },
        '../online/auth': { AuthStore: class {}, authStore: testAuthStore, validateCredentials: () => null },
        '../online/multiplayer': { multiplayer: testMultiplayer, MultiplayerAdapter: class {} },
        '../online/characters': charactersModule,
      };

      const menuModuleObj = { exports: {} };
      const runner = new Function('require', 'exports', 'module', '"use strict";\n' + transpiledMenu);
      runner((id) => mockMenuDeps[id] ?? {}, menuModuleObj.exports, menuModuleObj);
      const MenuSceneClass = menuModuleObj.exports.MenuScene;

      const scene = new MenuSceneClass();
      scene.setupAccessibleDom();

      assert.ok(typeof authListener === 'function', 'Auth subscription must be registered');

      // Trigger authenticated auth state
      await authListener({
        status: 'authenticated',
        user: { id: validUserId, email: 'hero@vanlang.vn' },
        message: 'Đã kết nối tài khoản.',
        configured: true,
      });

      // Allow async connectMultiplayer to complete
      await new Promise((r) => setImmediate(r));

      assert.equal(connectCalls.length, 1, 'multiplayer.connect must be called once');
      assert.equal(connectCalls[0].roomId, 'village-hub');
      assert.equal(connectCalls[0].characterId, validCharId, 'Real database character UUID must reach connect, NOT char-${userId}');
      assert.notEqual(connectCalls[0].characterId, `char-${validUserId}`, 'Must NOT use pseudo legacy char-${userId}');
      console.log('  -> [PASS] 4.3 Database character UUID verified reaching multiplayer.connect.');

      // 4.4 Test explicit disconnect on sign-out
      let disconnected = false;
      testMultiplayer.disconnect = () => { disconnected = true; };
      await authListener({
        status: 'signed_out',
        user: null,
        message: '',
        configured: true,
      });
      assert.equal(disconnected, true, 'Sign-out must disconnect multiplayer');
      console.log('  -> [PASS] 4.4 Explicit sign-out disconnect verified.');

      // 4.5 Test late async completion is fenced after sign-out
      connectCalls.length = 0;
      let resolveDelayedQuery;
      const delayedPromise = new Promise((resolve) => {
        resolveDelayedQuery = resolve;
      });

      testAuthStore.client.from = () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => delayedPromise,
          }),
        }),
      });

      // Trigger login while character query is slow/pending
      const pendingConnect = authListener({
        status: 'authenticated',
        user: { id: validUserId, email: 'hero@vanlang.vn' },
        message: 'Đã kết nối tài khoản.',
        configured: true,
      });

      // While query is pending, user signs out
      await authListener({
        status: 'signed_out',
        user: null,
        message: '',
        configured: true,
      });

      // Now the delayed character query resolves
      resolveDelayedQuery({
        data: { id: validCharId, user_id: validUserId, name: 'Chiến Binh Chậm' },
        error: null,
      });
      await pendingConnect;
      await new Promise((r) => setImmediate(r));

      assert.equal(connectCalls.length, 0, 'Late async character completion after sign-out must be fenced and not connect');
      console.log('  -> [PASS] 4.5 Late async character completion properly fenced after sign-out.');
    } finally {
      if (previousDoc === undefined) delete global.document; else global.document = previousDoc;
      if (previousWin === undefined) delete global.window; else global.window = previousWin;
    }
  }

  console.log('[CHARACTER-LIFECYCLE-CHECK] All tests in check-character-lifecycle.cjs passed successfully!');
})().catch((err) => {
  console.error('[CHARACTER-LIFECYCLE-CHECK] FAILED:', err);
  process.exit(1);
});
