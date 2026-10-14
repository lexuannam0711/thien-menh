/**
 * Comprehensive Minigames Client & UI QA Test Suite
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra toàn diện 5 ma trận:
 * 1. MinigameTypes contracts & NPC metadata (3 trò, 6 linh vật, status, outcomes).
 * 2. MinigameClient & Authoritative Offline Simulation Engine (7321, Lucky Dice, Animal Guess).
 * 3. Daily play limit enforcement (3 plays/day) & personal history ledger.
 * 4. MinigameArtwork procedural texture generation & idempotency.
 * 5. Input Isolation & Modal barrier (WASD, hotkeys 1..4, pointer click-through).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THẦN MỆNH: MINIGAMES CLIENT, GAMEPLAY & INPUT ISOLATION QA');
console.log('================================================================\n');

function transpileCode(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
}

const moduleCache = new Map();

function loadModule(filePath, customDependencies = {}, customGlobals = {}) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const transpiled = transpileCode(fullPath);
  const moduleResult = { exports: {} };
  const context = {
    exports: moduleResult.exports,
    module: moduleResult,
    require: (id) => {
      if (customDependencies[id]) return customDependencies[id];
      try {
        return require(id);
      } catch {
        return {};
      }
    },
    ...customGlobals,
  };
  vm.runInNewContext(transpiled, context);
  return moduleResult.exports;
}

// --------------------------------------------------------------------------
// SUITE 1: Contracts, Types & NPC Metadata
// --------------------------------------------------------------------------
console.log('--- Suite 1: Contracts, Types & NPC Metadata ---');
{
  const typesMod = loadModule('src/game/minigames/MinigameTypes.ts');

  // 1.1 Card suits & ranks
  assert.equal(typesMod.CARD_SUITS.length, 4, '4 card suits');
  assert.ok(typesMod.CARD_SUITS.includes('spades'));
  assert.ok(typesMod.CARD_SUITS.includes('hearts'));
  assert.ok(typesMod.CARD_SUITS.includes('diamonds'));
  assert.ok(typesMod.CARD_SUITS.includes('clubs'));
  assert.equal(typesMod.CARD_RANKS.length, 13, '13 card ranks 2..A');

  // 1.2 6 Animal symbols
  assert.equal(typesMod.ANIMAL_SYMBOLS.length, 6, '6 animal symbols');
  const expectedSymbols = ['bau', 'cua', 'ca', 'cop', 'ga', 'nai'];
  for (const sym of expectedSymbols) {
    assert.ok(typesMod.ANIMAL_SYMBOLS.includes(sym), `Symbol ${sym} must be present`);
    const def = typesMod.ANIMAL_DEFINITIONS[sym];
    assert.ok(def, `Definition for ${sym} must exist`);
    assert.ok(def.nameVi && def.nameVi.length > 0, `${sym} must have Vietnamese name`);
    assert.ok(def.subtitle && def.subtitle.length > 0, `${sym} must have subtitle`);
    assert.ok(typeof def.color === 'number', `${sym} must have numeric color`);
    assert.ok(typeof def.hex === 'string', `${sym} must have hex color`);
  }

  // 1.3 3 Canonical NPCs
  assert.equal(Object.keys(typesMod.MINIGAME_NPCS).length, 3, '3 minigame NPCs');

  const npc7321 = typesMod.getNpcForMinigame('7321');
  assert.equal(npc7321.npcName, 'Thầy Thẻ Lạc');
  assert.equal(npc7321.gameTitle, '7321');
  assert.equal(npc7321.npcId, 'npc_thay_the_lac');

  const npcDice = typesMod.getNpcForMinigame('lucky_dice');
  assert.equal(npcDice.npcName, 'Lão Đồng Xúc');
  assert.equal(npcDice.gameTitle, 'Xúc Xắc May Mắn');
  assert.equal(npcDice.npcId, 'npc_lao_dong_xuc');

  const npcAnimal = typesMod.getNpcForMinigame('animal_guess');
  assert.equal(npcAnimal.npcName, 'Nàng Họa Linh');
  assert.equal(npcAnimal.gameTitle, 'Nhìn Hình Đoán Thú');
  assert.equal(npcAnimal.npcId, 'npc_nang_hoa_linh');

  console.log('✓ Suite 1: Contracts, Types & NPC Metadata Passed');
}

// --------------------------------------------------------------------------
// SUITE 2: MinigameClient & Authoritative Simulation Engine
// --------------------------------------------------------------------------
console.log('\n--- Suite 2: MinigameClient & Authoritative Simulation Engine ---');
(async () => {
  const typesMod = loadModule('src/game/minigames/MinigameTypes.ts');
  const clientMod = loadModule('src/game/minigames/MinigameClient.ts', {
    './MinigameTypes': typesMod,
  });

  const { MinigameClient } = clientMod;
  const client = new MinigameClient({ forceOffline: true, userId: 'test_hero_van_lang' });

  // 2.1 Game List & Metadata
  const listRes = await client.list();
  assert.ok(listRes.ok, 'List request must succeed');
  assert.equal(listRes.games.length, 3, 'Must return 3 games');
  for (const g of listRes.games) {
    assert.equal(g.dailyLimit, 3, `${g.id} has daily limit 3`);
    assert.equal(g.remainingDailyPlays, 3, `${g.id} initial remaining plays 3`);
    assert.ok(g.rewardTiers.length > 0, `${g.id} must have reward tiers`);
  }

  // 2.2 Rewards endpoint
  const rewards7321 = await client.rewards('7321');
  assert.ok(rewards7321.ok);
  assert.equal(rewards7321.gameId, '7321');
  assert.ok(rewards7321.rewardTiers.length >= 3);

  // 2.3 Game 1: 7321 Flow (Deal -> Hit -> Stand -> Resolve)
  console.log('  Testing 7321 gameplay flow...');
  const start7321 = await client.start('7321', 'npc_thay_the_lac');
  assert.ok(start7321.ok, '7321 session start');
  const s7321 = start7321.session;
  assert.equal(s7321.gameId, '7321');
  assert.equal(s7321.remainingDailyPlays, 2, 'Remaining plays decremented to 2');

  const pState7321 = s7321.publicState;
  assert.equal(pState7321.playerHand.length, 2, 'Player receives 2 initial cards');
  assert.equal(pState7321.dealerHand.length, 2, 'Dealer receives 2 cards');
  assert.ok(pState7321.dealerHand[1].hidden === true, 'Dealer second card is hidden');
  assert.ok(pState7321.playerScore.total >= 4 && pState7321.playerScore.total <= 21);

  if (s7321.status === 'active') {
    // Perform hit
    const hitRes = await client.action(s7321.sessionId, { type: 'hit' });
    assert.ok(hitRes.ok);
    const hitState = hitRes.session.publicState;
    assert.equal(hitState.playerHand.length, 3, 'Hit adds a 3rd card to player');

    if (hitRes.session.status === 'active') {
      // Perform stand
      const standRes = await client.action(s7321.sessionId, { type: 'stand' });
      assert.ok(standRes.ok);
      assert.equal(standRes.session.status, 'rewarded', 'Session rewarded after stand');
      const finalState = standRes.session.publicState;
      assert.equal(finalState.turn, 'resolved');
      assert.ok(finalState.dealerScore, 'Dealer score calculated');
      assert.ok(finalState.dealerScore.total >= 17 || finalState.dealerScore.isBust, 'Dealer stands on >= 17');
      assert.ok(standRes.session.reward, 'FestivalPoints reward receipt issued');
      assert.ok(standRes.session.reward.totalPoints >= 5, 'At least 5 points awarded');
    }
  }

  // 2.4 Game 2: Lucky Dice Flow (Tai / Xiu)
  console.log('  Testing Lucky Dice gameplay flow...');
  const startDice = await client.start('lucky_dice', 'npc_lao_dong_xuc');
  assert.ok(startDice.ok);
  const sDice = startDice.session;
  assert.equal(sDice.gameId, 'lucky_dice');
  assert.equal(sDice.status, 'active');

  const rollRes = await client.action(sDice.sessionId, { type: 'choose_dice', choice: 'tai' });
  assert.ok(rollRes.ok);
  assert.equal(rollRes.session.status, 'rewarded');
  const diceState = rollRes.session.publicState;
  assert.ok(Array.isArray(diceState.dice) && diceState.dice.length === 3, 'Must have 3 dice values');
  for (const d of diceState.dice) {
    assert.ok(d >= 1 && d <= 6, `Dice value ${d} must be 1..6`);
  }
  const sum = diceState.dice[0] + diceState.dice[1] + diceState.dice[2];
  assert.equal(diceState.total, sum, 'Total must match sum of 3 dice');
  if (diceState.dice[0] === diceState.dice[1] && diceState.dice[1] === diceState.dice[2]) {
    assert.equal(diceState.isTriple, true, 'Triple detected');
    assert.equal(diceState.category, 'triple');
    assert.equal(diceState.outcome, 'special_triple');
  } else if (sum >= 11) {
    assert.equal(diceState.category, 'tai');
    assert.equal(diceState.outcome, 'player_won');
  } else {
    assert.equal(diceState.category, 'xiu');
    assert.equal(diceState.outcome, 'dealer_won');
  }
  assert.ok(rollRes.session.reward);
  assert.ok(rollRes.session.reward.totalPoints >= 5);

  // 2.5 Game 3: Animal Guess Flow (Bầu Cua Việt Nam)
  console.log('  Testing Animal Guess gameplay flow...');
  const startAnimal = await client.start('animal_guess', 'npc_nang_hoa_linh');
  assert.ok(startAnimal.ok);
  const sAnimal = startAnimal.session;
  assert.equal(sAnimal.gameId, 'animal_guess');

  const guessRes = await client.action(sAnimal.sessionId, { type: 'choose_symbol', symbol: 'ga' });
  assert.ok(guessRes.ok);
  assert.equal(guessRes.session.status, 'rewarded');
  const animState = guessRes.session.publicState;
  assert.equal(animState.chosenSymbol, 'ga');
  assert.equal(animState.rolledSymbols.length, 3, 'Rolled 3 animal symbols');
  for (const s of animState.rolledSymbols) {
    assert.ok(typesMod.ANIMAL_SYMBOLS.includes(s), `Rolled symbol ${s} is valid`);
  }
  const matchExpected = animState.rolledSymbols.filter((s) => s === 'ga').length;
  assert.equal(animState.matchCount, matchExpected, 'Match count matches rolled occurrences');
  if (matchExpected === 1) assert.equal(animState.outcome, 'match_1');
  else if (matchExpected === 2) assert.equal(animState.outcome, 'match_2');
  else if (matchExpected === 3) assert.equal(animState.outcome, 'match_3');
  else assert.equal(animState.outcome, 'no_match');

  assert.ok(guessRes.session.reward);
  assert.ok(guessRes.session.reward.totalPoints >= 5);

  console.log('✓ Suite 2: MinigameClient & Authoritative Simulation Engine Passed');

  // --------------------------------------------------------------------------
  // SUITE 3: Daily Play Limit Enforcement & Personal History Ledger
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Daily Play Limit & History Ledger ---');
  {
    // Consume remaining plays for 7321 (1 used above, need 2 more)
    await client.start('7321');
    await client.start('7321');

    // 4th play must be rejected
    let errorThrown = false;
    try {
      await client.start('7321');
    } catch (err) {
      errorThrown = true;
      assert.ok(err.message.includes('DAILY_LIMIT_EXCEEDED'), 'Must throw DAILY_LIMIT_EXCEEDED');
    }
    assert.ok(errorThrown, '4th start must be blocked by daily limit');

    // Personal History Check
    const histAll = await client.history();
    assert.ok(histAll.ok);
    assert.ok(histAll.items.length >= 3, 'At least 3 sessions in history');

    const hist7321 = await client.history('7321');
    assert.ok(hist7321.ok);
    assert.ok(hist7321.items.every((it) => it.gameId === '7321'), 'History filter by gameId');

    console.log('✓ Suite 3: Daily Play Limit & History Ledger Passed');
  }

  // --------------------------------------------------------------------------
  // SUITE 4: MinigameArtwork Procedural Texture Generation & Idempotency
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: MinigameArtwork Procedural Textures ---');
  {
    const artworkMod = loadModule('src/game/minigames/MinigameArtwork.ts');
    const { ensureMinigameTextures, MINIGAME_TEXTURE_KEYS } = artworkMod;

    const textureStore = new Map();

    const mockContext = {
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      arcTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      ellipse: () => {},
      fill: () => {},
      stroke: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
    };

    const mockScene = {
      textures: {
        exists: (key) => textureStore.has(key),
        createCanvas: (key, w, h) => {
          if (textureStore.has(key)) return null;
          const texObj = {
            key,
            width: w,
            height: h,
            canvas: {},
            context: mockContext,
            update: () => texObj,
          };
          textureStore.set(key, texObj);
          return texObj;
        },
      },
    };

    // First call: registers all textures
    ensureMinigameTextures(mockScene);

    const requiredKeys = [
      MINIGAME_TEXTURE_KEYS.cardFront,
      MINIGAME_TEXTURE_KEYS.cardBack,
      MINIGAME_TEXTURE_KEYS.suitSpades,
      MINIGAME_TEXTURE_KEYS.suitHearts,
      MINIGAME_TEXTURE_KEYS.suitDiamonds,
      MINIGAME_TEXTURE_KEYS.suitClubs,
      MINIGAME_TEXTURE_KEYS.dice1,
      MINIGAME_TEXTURE_KEYS.dice2,
      MINIGAME_TEXTURE_KEYS.dice3,
      MINIGAME_TEXTURE_KEYS.dice4,
      MINIGAME_TEXTURE_KEYS.dice5,
      MINIGAME_TEXTURE_KEYS.dice6,
      MINIGAME_TEXTURE_KEYS.diceCup,
      MINIGAME_TEXTURE_KEYS.dicePlate,
      MINIGAME_TEXTURE_KEYS.animalBau,
      MINIGAME_TEXTURE_KEYS.animalCua,
      MINIGAME_TEXTURE_KEYS.animalCa,
      MINIGAME_TEXTURE_KEYS.animalCop,
      MINIGAME_TEXTURE_KEYS.animalGa,
      MINIGAME_TEXTURE_KEYS.animalNai,
      MINIGAME_TEXTURE_KEYS.symbolSlot,
      MINIGAME_TEXTURE_KEYS.symbolSlotSelected,
      MINIGAME_TEXTURE_KEYS.npcThayTheLac,
      MINIGAME_TEXTURE_KEYS.npcLaoDongXuc,
      MINIGAME_TEXTURE_KEYS.npcNangHoaLinh,
    ];

    for (const key of requiredKeys) {
      assert.ok(textureStore.has(key), `Texture key '${key}' must be generated`);
    }

    const countAfterFirst = textureStore.size;
    assert.ok(countAfterFirst >= 25, `Expected >= 25 textures, got ${countAfterFirst}`);

    // Idempotent test: Second call must not duplicate or error
    ensureMinigameTextures(mockScene);
    assert.equal(textureStore.size, countAfterFirst, 'Second call must be idempotent without creating extra textures');

    console.log('✓ Suite 4: MinigameArtwork Procedural Textures Passed');
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Input Isolation & Modal Barrier
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Input Isolation & Modal Barrier ---');
  {
    const inputContextMod = loadModule('src/game/input/InputContext.ts');
    const { InputContextManager, InputContext } = inputContextMod;

    const gameActionMod = loadModule('src/game/input/GameAction.ts');
    const inputBindingsMod = loadModule('src/game/input/InputBindings.ts');
    const inputSettingsMod = loadModule('src/game/input/InputSettings.ts', {
      './GameAction': gameActionMod,
      './InputBindings': inputBindingsMod,
    });
    const kbAdapterMod = loadModule('src/game/input/KeyboardMouseAdapter.ts', {
      './GameAction': gameActionMod,
      './InputBindings': inputBindingsMod,
      './InputSettings': inputSettingsMod,
    });
    const touchAdapterMod = loadModule('src/game/input/TouchAdapter.ts', {
      './GameAction': gameActionMod,
      './InputSettings': inputSettingsMod,
    });

    const inputManagerMod = loadModule('src/game/input/InputManager.ts', {
      './GameAction': gameActionMod,
      './InputContext': inputContextMod,
      './InputSettings': inputSettingsMod,
      './KeyboardMouseAdapter': kbAdapterMod,
      './TouchAdapter': touchAdapterMod,
    });

    const { InputManager } = inputManagerMod;
    const { KeyboardMouseAdapter } = kbAdapterMod;
    const { DEFAULT_KEY_BINDINGS } = inputBindingsMod;
    const { DEFAULT_PC_SETTINGS } = inputSettingsMod;

    // 5.1 Context Manager stack priority
    const ctxMgr = new InputContextManager('GAMEPLAY');
    assert.equal(ctxMgr.current, 'GAMEPLAY');
    assert.equal(ctxMgr.isGameplayAllowed(), true, 'Gameplay allowed in GAMEPLAY context');

    ctxMgr.push(InputContext.MODAL);
    assert.equal(ctxMgr.current, 'MODAL', 'Context changes to MODAL when modal opens');
    assert.equal(ctxMgr.isGameplayAllowed(), false, 'Gameplay BLOCKED when modal is open');

    // 5.2 InputManager behavior under MODAL context
    const inputMgr = new InputManager();
    // Simulate game in MODAL context
    inputMgr.contextManager.push(InputContext.MODAL);

    // Simulate keydown WASD and hotkeys 1..4 in keyboard adapter
    inputMgr.keyboardMouseAdapter.simulateKeyDown('KeyW');
    inputMgr.keyboardMouseAdapter.simulateKeyDown('KeyD');
    inputMgr.keyboardMouseAdapter.simulateKeyDown('Digit1');
    inputMgr.keyboardMouseAdapter.simulatePointerDown(0, 480, 270); // LMB click

    const inputFrame = inputMgr.update(16);

    // Assert: Movement vector MUST be zero
    assert.equal(inputFrame.moveX, 0, 'WASD moveX must be 0 when modal is open');
    assert.equal(inputFrame.moveY, 0, 'WASD moveY must be 0 when modal is open');

    // Assert: Combat actions (SKILL_1, ATTACK, ROLL) MUST NOT be present
    assert.ok(!inputFrame.pressed.has('ATTACK'), 'ATTACK action must be blocked in modal');
    assert.ok(!inputFrame.pressed.has('SKILL_1'), 'SKILL_1 must be blocked in modal');
    assert.ok(!inputFrame.held.has('ATTACK'), 'Held ATTACK must be blocked in modal');

    // 5.3 Pointer over UI depth test
    let modalOpen = true;
    const mockUIHitTest = (pointer) => modalOpen;
    const kbAdapter = new KeyboardMouseAdapter(null, DEFAULT_KEY_BINDINGS, DEFAULT_PC_SETTINGS);
    kbAdapter.setCustomUIHitTest(mockUIHitTest);

    // Pointer down on modal UI
    kbAdapter.simulatePointerDown(0, 500, 300);
    const kbFrame = kbAdapter.update();
    assert.ok(!kbFrame.pressed.has('ATTACK'), 'Pointer click on modal UI cannot trigger world attack');

    // 5.4 Escape Key / Close Modal restoration
    const escResult = inputMgr.contextManager.handleEscape();
    assert.ok(escResult.handled, 'Escape handles closing the MODAL context');
    assert.equal(escResult.closedContext, 'MODAL');
    assert.equal(inputMgr.contextManager.current, 'GAMEPLAY', 'Context restored to GAMEPLAY');
    assert.equal(inputMgr.contextManager.isGameplayAllowed(), true, 'Gameplay restored after modal close');

    // Once restored to GAMEPLAY, movement & attack are allowed again
    modalOpen = false;
    inputMgr.keyboardMouseAdapter.simulatePointerUp(0, 480, 270);
    inputMgr.update(16); // clear release frame
    inputMgr.keyboardMouseAdapter.simulatePointerDown(0, 480, 270);
    const restoredFrame = inputMgr.update(16);
    assert.ok(restoredFrame.pressed.has('ATTACK'), 'World attack restored after modal close');

    inputMgr.keyboardMouseAdapter.destroy();
    kbAdapter.destroy();

    console.log('✓ Suite 5: Input Isolation & Modal Barrier Passed');
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('ALL MINIGAMES CLIENT & UI SUITES PASSED (5/5)');
  console.log('================================================================');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ QA TEST FAILED:');
  console.error(err);
  process.exit(1);
});
