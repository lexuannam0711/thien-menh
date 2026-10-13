import {
  BOSS_IDS,
  BOSSES,
  BossId,
  getBoss,
  getAllBosses,
} from '../../data/bosses';
import { Boss, BossCombatTarget } from '../entities/Boss';
import { BossSystem } from '../systems/BossSystem';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[BossSelfCheck Failure] ${message}`);
  }
}

export function runBossSelfCheck(): true {
  console.log('--- Running Boss Self-Check ---');

  // ==========================================
  // Suite 1: Data Integrity & Immutability
  // ==========================================
  assert(BOSS_IDS.length === 4, 'Must register exactly 4 Vietnamese mythology bosses');
  assert(Object.isFrozen(BOSS_IDS), 'BOSS_IDS array must be frozen');
  assert(Object.isFrozen(BOSSES), 'BOSSES array must be frozen');
  assert(getAllBosses().length === 4, 'getAllBosses() returns 4 bosses');

  const expectedBosses: BossId[] = ['ho-yeu', 'thuong-luong', 'thach-tuong', 'hac-an'];
  for (const id of expectedBosses) {
    const boss = getBoss(id);
    assert(Boolean(boss), `Boss definition for "${id}" must exist`);
    assert(boss?.id === id, `Boss id match for ${id}`);
    assert(Object.isFrozen(boss), `Boss definition "${id}" must be immutable (frozen)`);
    assert(Boolean(boss && boss.maxHp >= 300), `Boss "${id}" maxHp must be balanced for boss fight (>= 300)`);
    assert(Boolean(boss && boss.phases.length >= 2), `Boss "${id}" must have at least 2 phases`);
    assert(Boolean(boss && boss.uniqueMechanics.length >= 2), `Boss "${id}" must have at least 2 unique mechanics`);

    if (boss) {
      // Verify Phase 1 & Phase 2 progression
      const p1 = boss.phases[0];
      const p2 = boss.phases[1];
      assert(p1.hpThresholdPercent === 1.0, `${id} phase 1 must start at 100% HP`);
      assert(p2.hpThresholdPercent <= 0.5, `${id} phase 2 must trigger at <= 50% HP`);
      assert(p2.speedMultiplier > p1.speedMultiplier, `${id} phase 2 speed must be higher`);
      assert(p2.damageMultiplier > p1.damageMultiplier, `${id} phase 2 damage must be higher`);
      assert(p1.attacks.length >= 2, `${id} phase 1 must have multiple distinct attacks`);
      assert(p2.attacks.length >= 2, `${id} phase 2 must have multiple distinct attacks`);

      // Verify telegraphs
      for (const phase of boss.phases) {
        for (const atk of phase.attacks) {
          assert(atk.damage >= 0, `${id} attack ${atk.id} damage >= 0`);
          assert(atk.windupMs >= 300, `${id} attack ${atk.id} must have telegraphed windup (>= 300ms)`);
          assert(atk.recoveryMs >= 350, `${id} attack ${atk.id} must have recovery period (>= 350ms)`);
          assert(Boolean(atk.telegraph.shape), `${id} attack ${atk.id} must specify telegraph shape`);
        }
      }

      // Verify rewards
      assert(boss.reward.xp > 0, `${id} reward xp > 0`);
      assert(boss.reward.gold > 0, `${id} reward gold > 0`);
      assert(boss.reward.itemDrops.length > 0, `${id} reward must drop items`);
    }
  }

  // Verify unique mechanics per mythology
  const hoyeu = getBoss('ho-yeu');
  assert(Boolean(hoyeu?.uniqueMechanics.some((m) => m.id === 'enrage_burst')), 'Hổ Yêu has enrage mechanic');
  assert(Boolean(hoyeu?.uniqueMechanics.some((m) => m.id === 'shadow_clones')), 'Hổ Yêu has shadow clones mechanic');

  const thuongluong = getBoss('thuong-luong');
  assert(Boolean(thuongluong?.uniqueMechanics.some((m) => m.id === 'submerged_evasion')), 'Thuồng Luồng has submerged mechanic');
  assert(Boolean(thuongluong?.uniqueMechanics.some((m) => m.id === 'whirlpool_hazard')), 'Thuồng Luồng has whirlpool hazard mechanic');

  const thachtuong = getBoss('thach-tuong');
  assert(Boolean(thachtuong?.uniqueMechanics.some((m) => m.id === 'stone_shield')), 'Thạch Tướng has stone shield mechanic');
  assert(Boolean(thachtuong?.uniqueMechanics.some((m) => m.id === 'earth_fissures')), 'Thạch Tướng has earth fissure mechanic');

  const hacan = getBoss('hac-an');
  assert(Boolean(hacan?.uniqueMechanics.some((m) => m.id === 'ultimate_channel')), 'Hắc Ấn has ultimate channel mechanic');
  assert(Boolean(hacan?.uniqueMechanics.some((m) => m.id === 'void_teleport')), 'Hắc Ấn has void teleport mechanic');

  console.log('✓ Suite 1: Data Integrity & Immutability Passed');

  // ==========================================
  // Suite 2: Boss Entity & Phase Transitions
  // ==========================================
  let deathTriggered = false;
  let phaseChangeTriggered = false;

  const tiger = new Boss(
    null,
    'ho-yeu',
    400,
    300,
    () => {
      deathTriggered = true;
    },
    undefined,
    () => {
      phaseChangeTriggered = true;
    },
  );

  assert(tiger.isAlive, 'Boss must initially be alive');
  assert(tiger.currentHp === 320, 'Boss starts with full maxHp');
  assert(tiger.phaseIndex === 0, 'Boss starts in phase 1 (index 0)');

  // Deal damage to reach 60% HP (above phase 2 threshold of 50%)
  const res1 = tiger.damage(100);
  assert(res1.hpDamage === 100, 'Damage matches unmitigated attack');
  assert(tiger.currentHp === 220, 'HP correctly subtracted');
  assert(tiger.phaseIndex === 0, 'Still in phase 1 at > 50% HP');
  assert(!phaseChangeTriggered, 'Phase change not yet triggered');

  // Deal damage to cross 50% HP threshold (threshold is 160 HP)
  const res2 = tiger.damage(80);
  assert(res2.triggeredPhaseTransition, 'Crossing 50% HP must trigger phase transition');
  assert(tiger.phaseIndex === 1, 'Boss transitioned to phase 2 (index 1)');
  assert(phaseChangeTriggered, 'onPhaseChange callback executed');
  assert(tiger.currentState === 'transitioning', 'Boss enters transitioning state');

  // Complete phase transition by ticking past transition duration (1300ms)
  const mockTarget: BossCombatTarget = { x: 450, y: 300 };
  tiger.update(2000, 100, mockTarget);
  assert(tiger.currentState === 'idle', 'Boss finishes transition and returns to active state');

  // Phase 2 defense bonus verification (Phase 2 has defenseBonus = 2)
  const hpBefore = tiger.currentHp;
  tiger.damage(20);
  assert(tiger.currentHp === hpBefore - 18, 'Phase 2 defense bonus mitigates 2 damage');

  // Fatal damage test
  tiger.damage(500);
  assert(!tiger.isAlive, 'Fatal damage sets isAlive = false');
  assert(tiger.currentHp === 0, 'HP clamped to 0');
  assert(tiger.currentState === 'dead', 'State is dead');
  assert(deathTriggered, 'Death callback was triggered');

  console.log('✓ Suite 2: Boss Entity & Phase Transitions Passed');

  // ==========================================
  // Suite 3: Unique Boss Mechanics
  // ==========================================
  // 1. Thạch Tướng Stone Shield absorption
  const stoneBoss = new Boss(null, 'thach-tuong', 200, 200);
  stoneBoss.addShield(120);
  assert(stoneBoss.currentShield === 120, 'Stone shield granted 120 points');

  const shieldHpBefore = stoneBoss.currentHp;
  // Attack with 50 damage (mitigated by phase 1 defense of 4 -> 46 damage)
  const shieldRes = stoneBoss.damage(50);
  assert(shieldRes.shieldDamage === 46, 'Shield absorbed all effective damage');
  assert(shieldRes.hpDamage === 0, 'HP was not harmed while shield had capacity');
  assert(stoneBoss.currentHp === shieldHpBefore, 'HP untouched');
  assert(stoneBoss.currentShield === 74, 'Shield decreased to 74');

  // Heavy attack breaking shield: 100 damage (defense 4 -> 96 effective)
  const breakRes = stoneBoss.damage(100);
  assert(breakRes.shieldDamage === 74, 'Remaining shield depleted');
  assert(breakRes.hpDamage === 22, 'Excess damage pierced into HP');
  assert(stoneBoss.currentShield === 0, 'Shield is now 0');

  // 2. Thuồng Luồng Submerged invulnerability
  const waterBoss = new Boss(null, 'thuong-luong', 300, 300);
  waterBoss.setSubmerged(true, 2000);
  assert(waterBoss.currentState === 'submerged', 'Boss is submerged');
  const subHpBefore = waterBoss.currentHp;
  const subRes = waterBoss.damage(80);
  assert(subRes.hpDamage === 0, 'Submerged boss takes 0 damage');
  assert(waterBoss.currentHp === subHpBefore, 'HP untouched during submerge');

  // Surface test
  waterBoss.update(3000, 100, mockTarget);
  assert(waterBoss.currentState !== 'submerged', 'Boss surfaced from water');

  // 3. Hắc Ấn Ultimate Channel Stagger Interruption
  const voidBoss = new Boss(null, 'hac-an', 500, 300);
  const doomsdayAttack = hacan?.phases[1].attacks.find((a) => a.id === 'hac-an-doomsday-channel');
  assert(Boolean(doomsdayAttack), 'Hắc Ấn doomsday attack exists');

  if (doomsdayAttack) {
    // Trigger phase 2
    voidBoss.damage(350);
    voidBoss.update(2000, 100, mockTarget);

    // Directly force channel simulation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (voidBoss as any).startAttack(doomsdayAttack, 2100, mockTarget);
    assert(voidBoss.currentState === 'channeling', 'Boss entered channeling state');

    // Deal heavy damage during channel to trigger stagger interrupt
    voidBoss.damage(70);
    assert(voidBoss.currentState === 'staggered', 'Boss channel was interrupted and staggered');
    assert(voidBoss.activeTelegraph === null, 'Telegraph was cancelled on stagger');
  }

  console.log('✓ Suite 3: Unique Boss Mechanics Passed');

  // ==========================================
  // Suite 4: Telegraph & Hitbox Mathematics
  // ==========================================
  const testBoss = new Boss(null, 'ho-yeu', 500, 300);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBoss = testBoss as any;

  // Circle hitbox check
  const circleAtk = hoyeu?.phases[0].attacks.find((a) => a.telegraph.shape === 'circle');
  assert(Boolean(circleAtk), 'Circle attack exists');

  if (circleAtk) {
    rawBoss.activeTelegraphState = {
      attack: circleAtk,
      originX: 500,
      originY: 300,
      directionX: 1,
      directionY: 0,
    };

    const insideCircleTarget: BossCombatTarget = { x: 550, y: 300 }; // dist = 50 <= 95
    const outsideCircleTarget: BossCombatTarget = { x: 700, y: 300 }; // dist = 200 > 95
    assert(rawBoss.checkHitbox(circleAtk, insideCircleTarget) === true, 'Inside circle is hit');
    assert(rawBoss.checkHitbox(circleAtk, outsideCircleTarget) === false, 'Outside circle misses');
  }

  // Cone hitbox check
  const coneAtk = hoyeu?.phases[0].attacks.find((a) => a.telegraph.shape === 'cone');
  assert(Boolean(coneAtk), 'Cone attack exists');

  if (coneAtk) {
    rawBoss.activeTelegraphState = {
      attack: coneAtk,
      originX: 500,
      originY: 300,
      directionX: 1,
      directionY: 0,
    };

    const inFrontTarget: BossCombatTarget = { x: 550, y: 300 };
    const behindTarget: BossCombatTarget = { x: 450, y: 300 };
    assert(rawBoss.checkHitbox(coneAtk, inFrontTarget) === true, 'In front cone is hit');
    assert(rawBoss.checkHitbox(coneAtk, behindTarget) === false, 'Behind boss cone misses');
  }

  // Dodge i-frame test
  if (circleAtk) {
    let playerHitCalled = false;
    const dodgingPlayer: BossCombatTarget = {
      x: 550,
      y: 300,
      isDodging: true,
      hit: () => {
        playerHitCalled = true;
      },
    };
    rawBoss.currentAttack = circleAtk;
    rawBoss.executeAttackImpact(3000, dodgingPlayer);
    assert(playerHitCalled === false, 'Dodging player receives no damage during i-frames');
  }

  console.log('✓ Suite 4: Telegraph & Hitbox Mathematics Passed');

  // ==========================================
  // Suite 5: Reusable BossSystem & Determinism
  // ==========================================
  function runSimulatedFight(): { finalHp: number; state: string; x: number; y: number } {
    const system = new BossSystem(null);
    const simulatedBoss = system.startEncounter('ho-yeu', 500, 300);

    const simPlayer: BossCombatTarget & { x: number; y: number } = {
      x: 350,
      y: 300,
      isDodging: false,
      hit: () => {},
    };

    let clock = 1000;
    for (let tick = 0; tick < 120; tick++) {
      clock += 50;
      system.update(clock, 50, simPlayer);
      // Player attacks every 10 ticks
      if (tick % 10 === 0) {
        system.damageBoss(25);
      }
    }

    const result = {
      finalHp: simulatedBoss.currentHp,
      state: simulatedBoss.currentState,
      x: Math.round(simulatedBoss.x),
      y: Math.round(simulatedBoss.y),
    };

    system.resetEncounter();
    return result;
  }

  const run1 = runSimulatedFight();
  const run2 = runSimulatedFight();

  assert(run1.finalHp === run2.finalHp, `Deterministic HP match: ${run1.finalHp} === ${run2.finalHp}`);
  assert(run1.state === run2.state, `Deterministic State match: ${run1.state} === ${run2.state}`);
  assert(run1.x === run2.x, `Deterministic X match: ${run1.x} === ${run2.x}`);
  assert(run1.y === run2.y, `Deterministic Y match: ${run1.y} === ${run2.y}`);

  console.log('✓ Suite 5: Deterministic Combat Simulation Passed');
  console.log('--- Boss Self-Check Complete: All 5 Suites Succeeded! ---');

  return true;
}

// Auto-run when executed directly via Node / tsx
const nodeProcess = (
  globalThis as unknown as {
    process?: {
      argv?: string[];
      exit?: (code?: number) => void;
    };
  }
).process;

if (
  nodeProcess?.argv &&
  nodeProcess.argv.some((arg: string) => typeof arg === 'string' && arg.includes('bossSelfCheck'))
) {
  try {
    runBossSelfCheck();
    nodeProcess.exit?.(0);
  } catch (err) {
    console.error(err);
    nodeProcess.exit?.(1);
  }
}
