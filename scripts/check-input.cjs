/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * scripts/check-input.cjs: Script kiểm thử tự động, tất định cho hệ thống Input Abstraction.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-input-'));

try {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(
    process.execPath,
    [
      tsc,
      'src/game/input/inputSelfCheck.ts',
      '--target',
      'ES2022',
      '--module',
      'commonjs',
      '--moduleResolution',
      'node',
      '--skipLibCheck',
      '--esModuleInterop',
      '--rootDir',
      'src',
      '--outDir',
      output,
    ],
    { cwd: root, stdio: 'inherit' }
  );

  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');

  const { runInputSelfCheck } = require(path.join(output, 'game', 'input', 'inputSelfCheck.js'));
  const passed = runInputSelfCheck();
  assert.equal(passed, true, 'Input subsystem self-check must return true');

  // Kiểm tra bổ sung trực tiếp từ module đã biên dịch
  const { DEFAULT_KEY_BINDINGS } = require(path.join(output, 'game', 'input', 'InputBindings.js'));
  assert.equal(DEFAULT_KEY_BINDINGS.SKILL_1.includes('Digit1'), true, 'Skill 1 default must be Digit1');
  assert.equal(DEFAULT_KEY_BINDINGS.ATTACK.includes('MouseLeft'), true, 'Attack default must be MouseLeft');

  const { InputContextManager } = require(path.join(output, 'game', 'input', 'InputContext.js'));
  const ctx = new InputContextManager('GAMEPLAY');
  assert.equal(ctx.isGameplayAllowed(), true, 'Context manager starts in gameplay');
  ctx.push('MODAL');
  assert.equal(ctx.isGameplayAllowed(), false, 'Modal blocks gameplay');
  const escRes = ctx.handleEscape();
  assert.equal(escRes.handled, true, 'Escape closes top modal');
  assert.equal(ctx.peek(), 'GAMEPLAY', 'Context returns to gameplay');

  console.log('Input subsystem and architecture self-check: PASS');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
