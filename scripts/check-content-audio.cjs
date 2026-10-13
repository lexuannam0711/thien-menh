const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-content-audio-'));
try {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/data/contentSelfCheck.ts',
    'src/game/audio/audioSelfCheck.ts',
    'src/game/world/chapterWorldSelfCheck.ts',
    'src/game/world/enemyRosterSelfCheck.ts',
    'src/game/entities/Enemy.ts',
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--outDir', output,
  ], { cwd: root, stdio: 'inherit' });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  require(path.join(output, 'data', 'contentSelfCheck.js')).runContentSelfCheck();
  require(path.join(output, 'game', 'audio', 'audioSelfCheck.js')).runAudioSelfCheck();
  require(path.join(output, 'game', 'world', 'chapterWorldSelfCheck.js')).runChapterWorldSelfCheck();
  require(path.join(output, 'game', 'world', 'enemyRosterSelfCheck.js')).runEnemyRosterSelfCheck();
  const enemyModule = { exports: {} };
  let projectileCount = 0;
  const imports = {
    phaser: { Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } },
    '../../data/config': require(path.join(output, 'data', 'config.js')),
    '../ui/art': { floatText() {} },
    '../assets/assetLoader': { SPRITE_KEYS: {} },
    '../assets/spriteManifest': require(path.join(output, 'game', 'assets', 'spriteManifest.js')),
    '../assets/enemyArtwork': { ENEMY_ARTWORK_BY_ID: {} },
    '../rendering/GraphicsSettings': require(path.join(output, 'game', 'rendering', 'GraphicsSettings.js')),
    './Projectile': { Projectile: class {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(output, 'game', 'entities', 'Enemy.js'), 'utf8'), {
    exports: enemyModule.exports,
    require(id) { assert(Object.hasOwn(imports, id), 'Unexpected Enemy import: ' + id); return imports[id]; },
  });
  const Enemy = enemyModule.exports.Enemy;
  const visual = () => ({ x: 300, y: 270, alpha: 1, visible: false,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(value) { this.visible = value; return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setScale() { return this; }, setRotation() { return this; }, setDepth() { return this; },
  });
  const enemy = kind => Object.assign(Object.create(Enemy.prototype), {
    kind, hp: 100, maxHp: 100, alive: true, activeTime: 0, readyAt: 0,
    windup: false, rangedWindup: false, chargeRemainingMs: 0, chargeDistance: 0,
    chargeX: 0, chargeY: 0, chargeHit: false, attackCount: 0,
    stunRemainingMs: 0, slowRemainingMs: 0, burnRemainingMs: 0, burnTickMs: 0, burnDamage: 0,
    view: visual(), warning: visual(), hpFill: visual(), sprite: null,
    scene: { tweens: { add() {} } }, onDeath() {}, spawnProjectile() { projectileCount++; },
  });
  let damage = 0;
  const player = { x: 500, y: 270, hit(amount) { damage += amount; } };
  const ranged = enemy('ma-troi-u-am');
  ranged.update(100, 1, player);
  assert(ranged.rangedWindup && ranged.warning.visible && projectileCount === 0, 'Ranged telegraph');
  ranged.update(999999, 0, player);
  ranged.update(999999, 100, player);
  assert.equal(projectileCount, 0, 'Scene time cannot bypass active-delta windup');
  ranged.update(1000000, 420, player);
  assert.equal(projectileCount, 1, 'Ranged shot after telegraph');
  const retreat = enemy('ma-troi-u-am');
  retreat.update(0, 100, { ...player, x: 350 });
  assert(retreat.x < 300, 'Ranged retreats at close range');
  const charge = enemy('soi-rung-hac-am');
  charge.update(0, 1, player);
  assert(charge.windup && charge.warning.visible && charge.x === 300, 'Charge telegraph');
  charge.update(0, 650, player);
  charge.update(0, 400, player);
  assert(charge.x > 450 && damage > 0, 'Charge sweeps player without tunneling');
  const hits = damage;
  charge.update(0, 100, player);
  assert.equal(damage, hits, 'Charge hits once per dash');
  const ambush = enemy('dia-yeu-canh-truc');
  ambush.update(0, 1, player);
  assert(ambush.windup && ambush.warning.visible && ambush.x === 300, 'Ambush telegraph');
  ambush.update(0, 700, { ...player, x: 700 });
  assert.equal(ambush.x, 500, 'Ambush uses locked target, allows dodging');
  assert.equal(damage, hits, 'Dodged ambush does not hit');
  const elite = enemy('giao-long-thuy-than');
  elite.update(0, 1, player);
  elite.update(0, 799, player);
  assert.equal(projectileCount, 1, 'Elite special keeps longer telegraph');
  elite.update(0, 1, player);
  assert.equal(projectileCount, 4, 'Elite telegraphed volley');
  for (const kind of ['bach-trao-ho-ma', 'thach-giap-nguu-ma', 'am-anh-quy-vuong']) {
    const special = enemy(kind);
    const before = damage;
    special.update(0, 1, player);
    assert(special.windup && special.warning.visible, 'Elite special telegraph: ' + kind);
    special.update(0, 899, player);
    assert.equal(damage, before, 'No elite damage before telegraph: ' + kind);
    special.update(0, 1, player);
    special.update(0, 500, player);
    assert(damage > before, 'Elite special resolves: ' + kind);
    assert(!special.isBoss, 'Elite is not a boss: ' + kind);
  }
  const burning = enemy('moc-tinh-con');
  burning.applyStatus('burn', 2500, 25);
  burning.applyStatus('slow', 3000, 0);
  burning.update(999999, 0, player);
  assert.equal(burning.burnRemainingMs, 2500, 'Paused delta preserves burn');
  assert.equal(burning.slowRemainingMs, 3000, 'Paused delta preserves slow');
  burning.update(0, 2500, { ...player, x: 900 });
  assert.equal(burning.hp, 90, 'Burn ticks twice, excludes expired delta');
  const stunned = enemy('soi-rung-hac-am');
  stunned.update(0, 1, player);
  stunned.applyStatus('stun', 1000, 0);
  assert(!stunned.windup && !stunned.warning.visible, 'Stun cancels telegraph');
  stunned.update(999999, 0, player);
  assert.equal(stunned.stunRemainingMs, 1000, 'Paused delta preserves stun');
  stunned.update(0, 500, player);
  assert.equal(stunned.x, 300, 'Stun prevents movement');
  const normal = enemy('moc-tinh-con');
  const slowed = enemy('moc-tinh-con');
  slowed.applyStatus('slow', 1000, 0);
  normal.update(0, 100, player);
  slowed.update(0, 100, player);
  assert(Math.abs((normal.x - 300) / 2 - (slowed.x - 300)) < 1e-8, 'Slow halves movement');
  console.log('Enemy AI self-check: PASS (spacing, telegraphs, charge sweep, ambush dodge, all 4 elite specials, burn/stun/slow, active-delta pause)');
  console.log('Content and audio self-checks: PASS');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
