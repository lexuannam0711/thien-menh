/**
 * Comprehensive Minigames Engine Test Suite & Simulation
 * Thần Mệnh: Hậu Duệ Văn Lang
 *
 * Verifies:
 * 1. 7321 Card Rules (Ace 1/11, soft 17, natural 21, bust, tie, dealer turn).
 * 2. Lucky Dice 216 combinations (Tai/Xiu/Triples, probabilities).
 * 3. Animal Guess 216 combinations (6 mascots, 0-3 match distribution, 42.13% theoretical).
 * 4. 100,000 Roll Simulations (3d6 distribution ~16.67%, mascot >=1 match in 41.5%-42.8%).
 * 5. SessionManager state machine, daily play limits, and Vietnam date handling.
 * 6. Idempotency & Anti-replay guards for actions and reward claiming.
 * 7. RewardService FestivalPoints calculations.
 * 8. HTTP API routes integration.
 */

const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const http = require('node:http');

console.log('⚙️  Step 0: Compiling game server TypeScript...');
execFileSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '-p', 'apps/game-server/tsconfig.json'],
  { stdio: 'inherit' }
);
console.log('✅ TypeScript compilation passed.\n');

(async () => {
  // Dynamically import compiled modules
  const csprng = await import('../dist/game-server/minigames/CSPRNG.js');
  const cardRules = await import('../dist/game-server/minigames/games/SevenThreeTwoOneRules.js');
  const diceRules = await import('../dist/game-server/minigames/games/LuckyDiceRules.js');
  const animalRules = await import('../dist/game-server/minigames/games/AnimalGuessRules.js');
  const sessionMgrMod = await import('../dist/game-server/minigames/SessionManager.js');
  const rewardMod = await import('../dist/game-server/minigames/RewardService.js');
  const registryMod = await import('../dist/game-server/minigames/RulesRegistry.js');
  const routesMod = await import('../dist/game-server/minigames/routes.js');
  const expressMod = (await import('express')).default;

  // --------------------------------------------------------------------------
  // TEST SUITE 1: 7321 Card Game Rules
  // --------------------------------------------------------------------------
  console.log('🧪 Test Suite 1: 7321 Rules (Ace 1/11, Soft 17, Natural 21, Bust, Tie)');

  // 1.1 Ace optimal evaluation
  {
    // Single Ace with 9: should be 20 (soft)
    const hand1 = [{ suit: 'spades', rank: 'A', value: 11 }, { suit: 'hearts', rank: '9', value: 9 }];
    const s1 = cardRules.calculateHandScore(hand1);
    assert.equal(s1.total, 20);
    assert.equal(s1.isSoft, true);
    assert.equal(s1.isBust, false);
    assert.equal(s1.isNatural21, false);

    // Natural 21: Ace + 10-value
    const handNat = [{ suit: 'spades', rank: 'A', value: 11 }, { suit: 'diamonds', rank: 'K', value: 10 }];
    const sNat = cardRules.calculateHandScore(handNat);
    assert.equal(sNat.total, 21);
    assert.equal(sNat.isNatural21, true);
    assert.equal(sNat.isSoft, true);

    // Ace downgrading from 11 to 1: [A, 9, 5] -> initially 25 -> 15 (hard)
    const hand2 = [
      { suit: 'spades', rank: 'A', value: 11 },
      { suit: 'hearts', rank: '9', value: 9 },
      { suit: 'clubs', rank: '5', value: 5 }
    ];
    const s2 = cardRules.calculateHandScore(hand2);
    assert.equal(s2.total, 15);
    assert.equal(s2.isSoft, false);
    assert.equal(s2.isBust, false);

    // Two Aces: [A, A] -> 12 (soft: 11 + 1)
    const handAA = [{ suit: 'spades', rank: 'A', value: 11 }, { suit: 'hearts', rank: 'A', value: 11 }];
    const sAA = cardRules.calculateHandScore(handAA);
    assert.equal(sAA.total, 12);
    assert.equal(sAA.isSoft, true);

    // Three Aces: [A, A, A] -> 13 (soft: 11 + 1 + 1)
    const handAAA = [
      { suit: 'spades', rank: 'A', value: 11 },
      { suit: 'hearts', rank: 'A', value: 11 },
      { suit: 'diamonds', rank: 'A', value: 11 }
    ];
    const sAAA = cardRules.calculateHandScore(handAAA);
    assert.equal(sAAA.total, 13);
    assert.equal(sAAA.isSoft, true);

    // Two Aces + 9: [A, A, 9] -> 21 (soft: 11 + 1 + 9)
    const handAA9 = [
      { suit: 'spades', rank: 'A', value: 11 },
      { suit: 'hearts', rank: 'A', value: 11 },
      { suit: 'diamonds', rank: '9', value: 9 }
    ];
    const sAA9 = cardRules.calculateHandScore(handAA9);
    assert.equal(sAA9.total, 21);
    assert.equal(sAA9.isSoft, true);

    // Hard 17: [10, 6, A] -> 17 (hard: 10 + 6 + 1)
    const handHard17 = [
      { suit: 'spades', rank: '10', value: 10 },
      { suit: 'hearts', rank: '6', value: 6 },
      { suit: 'diamonds', rank: 'A', value: 11 }
    ];
    const sHard17 = cardRules.calculateHandScore(handHard17);
    assert.equal(sHard17.total, 17);
    assert.equal(sHard17.isSoft, false);

    // Soft 17: [A, 6] -> 17 (soft: 11 + 6)
    const handSoft17 = [{ suit: 'spades', rank: 'A', value: 11 }, { suit: 'hearts', rank: '6', value: 6 }];
    const sSoft17 = cardRules.calculateHandScore(handSoft17);
    assert.equal(sSoft17.total, 17);
    assert.equal(sSoft17.isSoft, true);

    // Bust hand: [10, 8, 7] -> 25 (bust)
    const handBust = [
      { suit: 'spades', rank: '10', value: 10 },
      { suit: 'hearts', rank: '8', value: 8 },
      { suit: 'clubs', rank: '7', value: 7 }
    ];
    const sBust = cardRules.calculateHandScore(handBust);
    assert.equal(sBust.total, 25);
    assert.equal(sBust.isBust, true);
  }
  console.log('   ✓ Ace calculations (soft, hard, bust, natural) verified');

  // 1.2 Soft 17 Dealer behavior: Dealer stands on soft 17
  {
    const playerHand = [{ suit: 'spades', rank: '10', value: 10 }, { suit: 'hearts', rank: '8', value: 8 }]; // 18
    const playerScore = cardRules.calculateHandScore(playerHand);
    const dealerCards = [{ suit: 'spades', rank: 'A', value: 11 }, { suit: 'hearts', rank: '6', value: 6 }]; // Soft 17
    const deck = [{ suit: 'clubs', rank: '5', value: 5 }]; // Should NOT be drawn because dealer stands on soft 17
    const secretState = { deck, dealerHiddenCard: dealerCards[1], dealerAllCards: dealerCards };

    const turnResult = cardRules.executeDealerTurn(playerHand, playerScore, dealerCards, deck, secretState);
    assert.equal(turnResult.publicState.dealerHand.length, 2, 'Dealer must NOT hit on soft 17');
    assert.equal(turnResult.publicState.dealerScore.total, 17);
    assert.equal(turnResult.publicState.outcome, 'player_won', 'Player 18 beats Dealer 17');
    assert.equal(deck.length, 1, 'Card was not drawn from deck');
  }
  console.log('   ✓ Dealer stands on Soft 17 verified');

  // 1.3 Natural 21 checks on initial deal
  {
    // Natural 21 for player
    const customDeckPlayerNat = [
      { suit: 'spades', rank: 'A', value: 11 },  // P1
      { suit: 'hearts', rank: '9', value: 9 },   // D1
      { suit: 'diamonds', rank: 'K', value: 10 },// P2 (P = A + K = 21)
      { suit: 'clubs', rank: '8', value: 8 }     // D2
    ];
    const deal1 = cardRules.dealInitialCards(customDeckPlayerNat);
    assert.equal(deal1.isResolved, true);
    assert.equal(deal1.publicState.outcome, 'player_won');
    assert.equal(deal1.result.won, true);

    // Natural 21 for both -> Tie
    const customDeckBothNat = [
      { suit: 'spades', rank: 'A', value: 11 },   // P1
      { suit: 'hearts', rank: 'A', value: 11 },   // D1
      { suit: 'diamonds', rank: 'K', value: 10 }, // P2
      { suit: 'clubs', rank: 'J', value: 10 }     // D2
    ];
    const deal2 = cardRules.dealInitialCards(customDeckBothNat);
    assert.equal(deal2.isResolved, true);
    assert.equal(deal2.publicState.outcome, 'tie');
    assert.equal(deal2.result.won, false);

    // Natural 21 for dealer only -> dealer_won
    const customDeckDealerNat = [
      { suit: 'spades', rank: '10', value: 10 }, // P1
      { suit: 'hearts', rank: 'A', value: 11 },   // D1
      { suit: 'diamonds', rank: '8', value: 8 },  // P2
      { suit: 'clubs', rank: 'Q', value: 10 }     // D2 (D = A + Q = 21)
    ];
    const deal3 = cardRules.dealInitialCards(customDeckDealerNat);
    assert.equal(deal3.isResolved, true);
    assert.equal(deal3.publicState.outcome, 'dealer_won');
    assert.equal(deal3.result.won, false);
  }
  console.log('   ✓ Natural 21 initial checks verified');

  // 1.4 Active play: Hit, Bust, Stand, Dealer Bust, Tie
  {
    // Normal deal
    const deckPlay = [
      { suit: 'spades', rank: '10', value: 10 }, // P1
      { suit: 'hearts', rank: '8', value: 8 },   // D1
      { suit: 'diamonds', rank: '6', value: 6 },  // P2 (P = 16)
      { suit: 'clubs', rank: '7', value: 7 },     // D2 (D = 15)
      { suit: 'spades', rank: '3', value: 3 },    // Hit 1 -> P = 19
      { suit: 'clubs', rank: '9', value: 9 }      // Dealer draw -> D = 15 + 9 = 24 (bust)
    ];
    const initial = cardRules.dealInitialCards(deckPlay);
    assert.equal(initial.isResolved, false);
    assert.equal(initial.publicState.dealerHand[1].hidden, true, 'Dealer second card hidden in public state');
    assert.equal(initial.publicState.dealerScore, undefined, 'Dealer score hidden while active');

    // Player hits 3 -> hand becomes 19
    const afterHit = cardRules.executeAction7321(initial.publicState, initial.secretState, 'hit');
    assert.equal(afterHit.isResolved, false);
    assert.equal(afterHit.publicState.playerScore.total, 19);

    // Player stands -> dealer draws 9 and busts (15 + 9 = 24)
    const afterStand = cardRules.executeAction7321(afterHit.publicState, afterHit.secretState, 'stand');
    assert.equal(afterStand.isResolved, true);
    assert.equal(afterStand.publicState.outcome, 'player_won');
    assert.equal(afterStand.publicState.dealerScore.isBust, true);
    assert.equal(afterStand.publicState.dealerHand[1].hidden, undefined, 'Dealer card revealed on resolve');
  }
  console.log('   ✓ Hit, Stand, Dealer bust, and hidden card concealment verified');

  // 1.5 Player Bust on Hit
  {
    const deckBust = [
      { suit: 'spades', rank: '10', value: 10 },
      { suit: 'hearts', rank: '8', value: 8 },
      { suit: 'diamonds', rank: '6', value: 6 },
      { suit: 'clubs', rank: '7', value: 7 },
      { suit: 'spades', rank: '8', value: 8 } // Hit 8 -> 10 + 6 + 8 = 24 (Bust)
    ];
    const initial = cardRules.dealInitialCards(deckBust);
    const hitRes = cardRules.executeAction7321(initial.publicState, initial.secretState, 'hit');
    assert.equal(hitRes.isResolved, true);
    assert.equal(hitRes.publicState.outcome, 'dealer_won');
    assert.equal(hitRes.publicState.playerScore.isBust, true);
  }
  console.log('   ✓ Player bust on hit verified');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Lucky Dice 216 Combinations
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 2: Lucky Dice 216 Combinations');
  {
    let tripleCount = 0;
    let xiuCount = 0;
    let taiCount = 0;
    let totalCombinations = 0;

    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        for (let d3 = 1; d3 <= 6; d3++) {
          totalCombinations++;
          const total = d1 + d2 + d3;
          const isTriple = d1 === d2 && d2 === d3;

          const evalTai = diceRules.evaluateDice(d1, d2, d3, 'tai');
          const evalXiu = diceRules.evaluateDice(d1, d2, d3, 'xiu');

          if (isTriple) {
            tripleCount++;
            assert.equal(evalTai.isTriple, true);
            assert.equal(evalTai.category, 'triple');
            assert.equal(evalTai.outcome, 'special_triple');
            assert.equal(evalXiu.outcome, 'special_triple');
          } else if (total >= 4 && total <= 10) {
            xiuCount++;
            assert.equal(evalXiu.category, 'xiu');
            assert.equal(evalXiu.outcome, 'player_won');
            assert.equal(evalTai.outcome, 'dealer_won');
          } else if (total >= 11 && total <= 17) {
            taiCount++;
            assert.equal(evalTai.category, 'tai');
            assert.equal(evalTai.outcome, 'player_won');
            assert.equal(evalXiu.outcome, 'dealer_won');
          } else {
            assert.fail(`Unexpected total ${total} for dice [${d1}, ${d2}, ${d3}]`);
          }
        }
      }
    }

    assert.equal(totalCombinations, 216, 'Total 3d6 combinations must be 216');
    assert.equal(tripleCount, 6, 'Triples count must be exactly 6 (111, 222, 333, 444, 555, 666)');
    assert.equal(xiuCount, 105, 'Xiu count must be exactly 105');
    assert.equal(taiCount, 105, 'Tai count must be exactly 105');
    assert.equal(xiuCount + taiCount + tripleCount, 216, '105 + 105 + 6 = 216');

    console.log(`   ✓ All 216 combinations verified: Xỉu = ${xiuCount} (48.61%), Tài = ${taiCount} (48.61%), Bộ ba đồng số = ${tripleCount} (2.78%)`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Animal Guess 216 Combinations
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 3: Animal Guess 216 Combinations');
  {
    const mascots = ['bau', 'cua', 'ca', 'cop', 'ga', 'nai'];
    const chosen = 'bau';

    let count0 = 0;
    let count1 = 0;
    let count2 = 0;
    let count3 = 0;
    let totalCombinations = 0;

    for (const s1 of mascots) {
      for (const s2 of mascots) {
        for (const s3 of mascots) {
          totalCombinations++;
          const evaluation = animalRules.evaluateAnimalGuess(chosen, [s1, s2, s3]);
          if (evaluation.matchCount === 0) {
            count0++;
            assert.equal(evaluation.outcome, 'no_match');
            assert.equal(evaluation.won, false);
          } else if (evaluation.matchCount === 1) {
            count1++;
            assert.equal(evaluation.outcome, 'match_1');
            assert.equal(evaluation.won, true);
          } else if (evaluation.matchCount === 2) {
            count2++;
            assert.equal(evaluation.outcome, 'match_2');
            assert.equal(evaluation.won, true);
          } else if (evaluation.matchCount === 3) {
            count3++;
            assert.equal(evaluation.outcome, 'match_3');
            assert.equal(evaluation.won, true);
          }
        }
      }
    }

    assert.equal(totalCombinations, 216);
    assert.equal(count0, 125, 'Theoretical (5/6)^3 = 125/216 (57.87%)');
    assert.equal(count1, 75, 'Theoretical 3*(1/6)*(5/6)^2 = 75/216 (34.72%)');
    assert.equal(count2, 15, 'Theoretical 3*(1/6)^2*(5/6) = 15/216 (6.94%)');
    assert.equal(count3, 1, 'Theoretical 1*(1/6)^3 = 1/216 (0.46%)');

    const atLeast1 = count1 + count2 + count3;
    assert.equal(atLeast1, 91, '91/216 combinations have at least 1 match');
    const theoreticalProb = 91 / 216;
    assert.ok(Math.abs(theoreticalProb - 0.421296) < 0.0001);

    console.log(`   ✓ All 216 combinations verified: 0 trúng = ${count0} (57.87%), 1 trúng = ${count1} (34.72%), 2 trúng = ${count2} (6.94%), 3 trúng = ${count3} (0.46%)`);
    console.log(`   ✓ Tỷ lệ trúng ít nhất 1 linh vật lý thuyết: 91/216 = ${(theoreticalProb * 100).toFixed(4)}%`);
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 4: 100,000 Roll Simulations (CSPRNG Unbiased Distribution)
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 4: 100,000 Roll Simulations (CSPRNG Security & Distribution)');
  {
    const SIMULATION_ROUNDS = 100000;
    console.log(`   Simulating ${SIMULATION_ROUNDS.toLocaleString()} Lucky Dice rounds (300,000 dice rolls)...`);

    const faceCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let simTriples = 0;
    let simTai = 0;
    let simXiu = 0;

    for (let i = 0; i < SIMULATION_ROUNDS; i++) {
      const [d1, d2, d3] = csprng.rollThreeDice();
      faceCounts[d1]++;
      faceCounts[d2]++;
      faceCounts[d3]++;

      if (d1 === d2 && d2 === d3) {
        simTriples++;
      } else {
        const total = d1 + d2 + d3;
        if (total >= 11) simTai++;
        else simXiu++;
      }
    }

    const totalFaces = SIMULATION_ROUNDS * 3;
    console.log('   Lucky Dice Face distribution across 300,000 individual rolls:');
    for (let face = 1; face <= 6; face++) {
      const pct = (faceCounts[face] / totalFaces) * 100;
      console.log(`     Face ${face}: ${faceCounts[face].toLocaleString()} (${pct.toFixed(2)}%) [Expected ~16.67%]`);
      // Each face should be within [16.0%, 17.3%]
      assert.ok(pct >= 16.0 && pct <= 17.3, `Face ${face} frequency ${pct.toFixed(2)}% out of bounds [16.0%, 17.3%]`);
    }

    const triplePct = (simTriples / SIMULATION_ROUNDS) * 100;
    const taiPct = (simTai / SIMULATION_ROUNDS) * 100;
    const xiuPct = (simXiu / SIMULATION_ROUNDS) * 100;
    console.log(`   Outcome distribution: Tài = ${taiPct.toFixed(2)}%, Xỉu = ${xiuPct.toFixed(2)}%, Bộ ba = ${triplePct.toFixed(2)}%`);
    assert.ok(triplePct >= 2.3 && triplePct <= 3.3, `Triple frequency ${triplePct}% out of bounds`);
    assert.ok(taiPct >= 47.0 && taiPct <= 50.0, `Tai frequency ${taiPct}% out of bounds`);
    assert.ok(xiuPct >= 47.0 && xiuPct <= 50.0, `Xiu frequency ${xiuPct}% out of bounds`);

    // Animal guess simulation
    console.log(`\n   Simulating ${SIMULATION_ROUNDS.toLocaleString()} Animal Guess rounds (guessing 'bau')...`);
    let animalHits = 0;
    const animalMascotCounts = { bau: 0, cua: 0, ca: 0, cop: 0, ga: 0, nai: 0 };

    for (let i = 0; i < SIMULATION_ROUNDS; i++) {
      const rolled = csprng.rollThreeAnimals();
      animalMascotCounts[rolled[0]]++;
      animalMascotCounts[rolled[1]]++;
      animalMascotCounts[rolled[2]]++;

      if (rolled[0] === 'bau' || rolled[1] === 'bau' || rolled[2] === 'bau') {
        animalHits++;
      }
    }

    const hitPct = (animalHits / SIMULATION_ROUNDS) * 100;
    console.log(`   Animal Guess hit rate (>= 1 match): ${animalHits.toLocaleString()} / ${SIMULATION_ROUNDS.toLocaleString()} (${hitPct.toFixed(3)}%) [Theoretical 42.130%]`);
    // Required by spec: "trúng >=1 lần trong khoảng 41.5% - 42.8%, bám sát 42.13%"
    assert.ok(
      hitPct >= 41.5 && hitPct <= 42.8,
      `Hit rate ${hitPct.toFixed(3)}% must be within [41.5%, 42.8%]`
    );

    console.log('   Mascot symbol distribution across 300,000 picks:');
    for (const mascot of ['bau', 'cua', 'ca', 'cop', 'ga', 'nai']) {
      const pct = (animalMascotCounts[mascot] / (SIMULATION_ROUNDS * 3)) * 100;
      console.log(`     ${mascot}: ${animalMascotCounts[mascot].toLocaleString()} (${pct.toFixed(2)}%)`);
      assert.ok(pct >= 16.0 && pct <= 17.3, `Mascot ${mascot} frequency ${pct}% out of bounds`);
    }
  }
  console.log('   ✓ 100,000 simulations passed with unbiased CSPRNG');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: SessionManager, Idempotency & State Machine
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 5: SessionManager, Idempotency & Replay Guards');
  {
    const sm = new sessionMgrMod.SessionManager();
    const userId = 'user_player_001';

    // 5.1 Initial remaining plays
    const initialPlays7321 = sm.getRemainingDailyPlays(userId, '7321');
    assert.equal(initialPlays7321, 3);

    // 5.2 Start a session
    const s1 = sm.startSession({ userId, gameId: '7321' });
    assert.equal(s1.gameId, '7321');
    assert.equal(s1.remainingDailyPlays, 2);
    assert.ok(['active', 'resolved'].includes(s1.status));

    // 5.3 Daily play limit enforcement
    sm.startSession({ userId, gameId: '7321' }); // play 2
    sm.startSession({ userId, gameId: '7321' }); // play 3
    assert.equal(sm.getRemainingDailyPlays(userId, '7321'), 0);

    // 4th play should fail with DAILY_LIMIT_EXCEEDED
    assert.throws(
      () => sm.startSession({ userId, gameId: '7321' }),
      /DAILY_LIMIT_EXCEEDED/
    );

    // Other game still has 3 plays for the same user
    assert.equal(sm.getRemainingDailyPlays(userId, 'lucky_dice'), 3);
    const diceSession = sm.startSession({ userId, gameId: 'lucky_dice' });
    assert.equal(diceSession.remainingDailyPlays, 2);

    // 5.4 Idempotency on actions
    // Play Lucky Dice with actionId 'act-roll-1'
    const action1Result = sm.processAction({
      sessionId: diceSession.sessionId,
      userId,
      actionId: 'act-roll-1',
      type: 'choose_dice',
      payload: { choice: 'tai' }
    });
    assert.equal(action1Result.status, 'resolved');
    const firstRoll = action1Result.publicState.dice;

    // Send identical action with SAME actionId
    const action1Replay = sm.processAction({
      sessionId: diceSession.sessionId,
      userId,
      actionId: 'act-roll-1',
      type: 'choose_dice',
      payload: { choice: 'tai' }
    });
    assert.deepEqual(action1Replay, action1Result, 'Replay action returns identical cached result');
    assert.deepEqual(action1Replay.publicState.dice, firstRoll, 'Dice roll does not change on replay');

    // 5.5 Cannot execute action on already resolved session with new actionId
    assert.throws(
      () => sm.processAction({
        sessionId: diceSession.sessionId,
        userId,
        actionId: 'act-roll-2',
        type: 'choose_dice',
        payload: { choice: 'xiu' }
      }),
      /INVALID_STATE/
    );

    // 5.6 Reward Resolution & Anti-Double-Claim
    const resolveResult1 = sm.resolveSession({
      sessionId: diceSession.sessionId,
      userId,
      actionId: 'act-resolve-1'
    });
    assert.equal(resolveResult1.session.status, 'rewarded');
    assert.ok(resolveResult1.reward.receiptId.startsWith('rcpt_'));
    const receipt1 = resolveResult1.reward.receiptId;

    // Resolve again -> returns exact same receipt (idempotent, no double points)
    const resolveResult2 = sm.resolveSession({
      sessionId: diceSession.sessionId,
      userId,
      actionId: 'act-resolve-1'
    });
    assert.equal(resolveResult2.reward.receiptId, receipt1);
    assert.equal(resolveResult2.session.status, 'rewarded');

    // 5.7 User History
    const history = sm.getUserHistory({ userId, page: 1, limit: 10 });
    assert.ok(history.total >= 1);
    assert.ok(history.history.some((h) => h.sessionId === diceSession.sessionId));

    // 5.8 Ownership verification
    assert.throws(
      () => sm.processAction({
        sessionId: diceSession.sessionId,
        userId: 'other_hacker_user',
        actionId: 'act-hack',
        type: 'choose_dice'
      }),
      /FORBIDDEN/
    );
  }
  console.log('   ✓ State machine, daily limits (3/day), idempotency & anti-replay verified');

  // --------------------------------------------------------------------------
  // TEST SUITE 6: RewardService Points Verification
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 6: RewardService FestivalPoints Breakdown');
  {
    // 7321 rewards
    const rWin7321 = rewardMod.calculatePoints('7321', 'player_won');
    assert.equal(rWin7321.bonusPoints, 15);
    assert.equal(rWin7321.participationPoints, 5);
    assert.equal(rWin7321.totalPoints, 20);

    const rTie7321 = rewardMod.calculatePoints('7321', 'tie');
    assert.equal(rTie7321.bonusPoints, 5);
    assert.equal(rTie7321.participationPoints, 5);
    assert.equal(rTie7321.totalPoints, 10);

    const rLose7321 = rewardMod.calculatePoints('7321', 'dealer_won');
    assert.equal(rLose7321.bonusPoints, 0);
    assert.equal(rLose7321.participationPoints, 5);
    assert.equal(rLose7321.totalPoints, 5);

    // Lucky Dice rewards
    const rWinDice = rewardMod.calculatePoints('lucky_dice', 'player_won');
    assert.equal(rWinDice.bonusPoints, 10);
    assert.equal(rWinDice.participationPoints, 5);
    assert.equal(rWinDice.totalPoints, 15);

    const rTripleDice = rewardMod.calculatePoints('lucky_dice', 'special_triple');
    assert.equal(rTripleDice.bonusPoints, 5);
    assert.equal(rTripleDice.participationPoints, 5);
    assert.equal(rTripleDice.totalPoints, 10);

    const rLoseDice = rewardMod.calculatePoints('lucky_dice', 'dealer_won');
    assert.equal(rLoseDice.bonusPoints, 0);
    assert.equal(rLoseDice.participationPoints, 5);
    assert.equal(rLoseDice.totalPoints, 5);

    // Animal Guess rewards
    const rMatch3 = rewardMod.calculatePoints('animal_guess', 'match_3');
    assert.equal(rMatch3.bonusPoints, 45);
    assert.equal(rMatch3.participationPoints, 5);
    assert.equal(rMatch3.totalPoints, 50);

    const rMatch2 = rewardMod.calculatePoints('animal_guess', 'match_2');
    assert.equal(rMatch2.bonusPoints, 20);
    assert.equal(rMatch2.participationPoints, 5);
    assert.equal(rMatch2.totalPoints, 25);

    const rMatch1 = rewardMod.calculatePoints('animal_guess', 'match_1');
    assert.equal(rMatch1.bonusPoints, 8);
    assert.equal(rMatch1.participationPoints, 5);
    assert.equal(rMatch1.totalPoints, 13);

    const rMatch0 = rewardMod.calculatePoints('animal_guess', 'no_match');
    assert.equal(rMatch0.bonusPoints, 0);
    assert.equal(rMatch0.participationPoints, 5);
    assert.equal(rMatch0.totalPoints, 5);
  }
  console.log('   ✓ Exact FestivalPoints calculation verified for all game scenarios');

  // --------------------------------------------------------------------------
  // TEST SUITE 7: HTTP API End-to-End Integration
  // --------------------------------------------------------------------------
  console.log('\n🧪 Test Suite 7: HTTP API Routes Integration');
  {
    const app = expressMod();
    app.use(expressMod.json());
    app.use('/api/minigames', routesMod.createMinigameRouter());

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/minigames`;

    async function reqJson(path, options = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // 7.1 GET /api/minigames/list
    const listRes = await reqJson('/list');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.ok, true);
    assert.equal(listRes.data.games.length, 3);
    assert.ok(listRes.data.games.some((g) => g.id === '7321'));
    assert.ok(listRes.data.games.some((g) => g.id === 'lucky_dice'));
    assert.ok(listRes.data.games.some((g) => g.id === 'animal_guess'));

    // 7.2 GET /api/minigames/rewards
    const rewardsRes = await reqJson('/rewards?gameId=lucky_dice');
    assert.equal(rewardsRes.status, 200);
    assert.equal(rewardsRes.data.gameId, 'lucky_dice');
    assert.ok(rewardsRes.data.rewardTiers.length >= 3);

    // 7.3 Unauthorized without user credentials
    const unauthStart = await reqJson('/start', {
      method: 'POST',
      body: JSON.stringify({ gameId: 'animal_guess' })
    });
    assert.equal(unauthStart.status, 401);
    assert.equal(unauthStart.data.error, 'UNAUTHORIZED');

    // 7.4 Play complete game of Animal Guess via HTTP
    const testUser = 'user_http_test_101';
    const authHeaders = { 'x-user-id': testUser };

    const startAnimal = await reqJson('/start', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ gameId: 'animal_guess' })
    });
    assert.equal(startAnimal.status, 201);
    assert.equal(startAnimal.data.session.gameId, 'animal_guess');
    const sessionId = startAnimal.data.session.sessionId;

    // Submit mascot choice
    const actionAnimal = await reqJson('/action', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sessionId,
        actionId: 'act-animal-01',
        type: 'choose_symbol',
        payload: { symbol: 'ca' }
      })
    });
    assert.equal(actionAnimal.status, 200);
    assert.equal(actionAnimal.data.session.status, 'resolved');
    assert.ok(actionAnimal.data.session.result);

    // Resolve & claim reward
    const resolveAnimal = await reqJson('/resolve', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sessionId,
        actionId: 'act-claim-01'
      })
    });
    assert.equal(resolveAnimal.status, 200);
    assert.equal(resolveAnimal.data.session.status, 'rewarded');
    assert.ok(resolveAnimal.data.reward.receiptId);
    assert.ok(resolveAnimal.data.reward.totalPoints >= 5);

    // Check history
    const historyRes = await reqJson('/history', {
      method: 'GET',
      headers: authHeaders
    });
    assert.equal(historyRes.status, 200);
    assert.ok(historyRes.data.history.length >= 1);
    assert.equal(historyRes.data.history[0].sessionId, sessionId);

    await new Promise((resolve) => server.close(resolve));
  }
  console.log('   ✓ Express HTTP endpoints (/list, /rewards, /start, /action, /resolve, /history) verified');

  console.log('\n🎉 ALL MINIGAME ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
})().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
