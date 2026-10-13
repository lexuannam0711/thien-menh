const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-rpg-menu-'));
try {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/game/ui/rpgMenuSelfCheck.ts',
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--outDir', output,
  ], { cwd: root, stdio: 'inherit' });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  require(path.join(output, 'game', 'ui', 'rpgMenuSelfCheck.js')).runRpgMenuSelfCheck();
  const ts = require('typescript');
  const javascript = ts.transpileModule(fs.readFileSync('src/game/scenes/VillageScene.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const sceneModule = { exports: {} };
  new Function('require', 'exports', javascript)(id => id === 'phaser' ? { Scene: class {} } : {}, sceneModule.exports);
  const paused = { player: { isDead: false }, pause: { isOpen: () => true }, overlay: null, isRpgMenuOpen: false };
  sceneModule.exports.VillageScene.prototype.openRpgMenu.call(paused);
  assert.equal(paused.isRpgMenuOpen, false, 'Pause cannot open RPG menu');
  const handlerBody = javascript.match(/const onKeyDown = \(event\) => \{([\s\S]*?)\n        \};/);
  assert.ok(handlerBody, 'Village keyboard handler found');
  const handler = new Function('event', handlerBody[1]);
  const keyboard = { isRpgMenuOpen: false, overlay: null, openRpgMenu() { this.isRpgMenuOpen = true; }, closeRpgMenu() { this.isRpgMenuOpen = false; } };
  handler.call(keyboard, { code: 'KeyB', repeat: false });
  assert.equal(keyboard.isRpgMenuOpen, true);
  handler.call(keyboard, { code: 'KeyB', repeat: true });
  assert.equal(keyboard.isRpgMenuOpen, true, 'Key repeat cannot toggle RPG menu');
  const menuJavascript = ts.transpileModule(fs.readFileSync('src/game/scenes/MenuScene.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const menuModule = { exports: {} };
  let actions = [];
  const dependencies = {
    phaser: { Scene: class {} },
    '../systems/GameState': { gameState: { reset: () => actions.push('reset') } },
    '../audio/AudioManager': { audioManager: { playCue: () => actions.push('sound'), unlock: () => actions.push('unlock') } },
  };
  new Function('require', 'exports', menuJavascript)(id => dependencies[id] ?? {}, menuModule.exports);
  const menu = { cleanup: () => actions.push('cleanup'), scene: { start: key => actions.push(key) } };
  const previousWindow = global.window;
  try {
    let prompts = 0;
    global.window = { confirm: message => { prompts++; assert.match(message, /tiến trình/i); return false; } };
    menuModule.exports.MenuScene.prototype.restartGame.call(menu);
    assert.equal(prompts, 1, 'Restart requests confirmation');
    assert.deepEqual(actions, [], 'Cancelled restart preserves save, scene and input');
    global.window.confirm = () => true;
    menuModule.exports.MenuScene.prototype.restartGame.call(menu);
    assert.deepEqual(actions, ['sound', 'unlock', 'cleanup', 'reset', 'Village']);
    actions = [];
    global.window.confirm = () => { throw new Error('Dialog unavailable'); };
    assert.throws(() => menuModule.exports.MenuScene.prototype.restartGame.call(menu), /Dialog unavailable/);
    assert.deepEqual(actions, [], 'Unavailable confirmation cannot erase save');
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
  {
    const buttons = [];
    const labels = [];
    const mockState = { hasSave: true, loadError: null, saveError: null };
    const mockDependencies = {
      phaser: { Scene: class {} },
      '../../data/config': { W: 960, H: 540, PALETTE: { bronze: 0x8a7042 } },
      '../ui/art': {
        button: (scene, x, y, w, text) => { buttons.push(text); return { list: [0, 1, 2, 3, 4, {}] }; },
        label: (scene, x, y, text) => { labels.push(text); return {}; },
      },
      '../systems/GameState': { gameState: mockState },
      '../ui/SettingsModel': { settingsModel: { syncSound() {}, isMuted: () => false, getMuteLabel: () => 'Mute', getQuality: () => 'high' }, CONTROLS_GUIDE: [] },
      '../audio/AudioManager': { audioManager: { loadFromStorage() {}, syncFromSettings() {}, startMusic() {} } },
      '../rendering/GraphicsSettings': { graphicsSettings: {} },
    };
    const freshMenuModule = { exports: {} };
    new Function('require', 'exports', menuJavascript)(id => mockDependencies[id] ?? {}, freshMenuModule.exports);
    const mockScene = {
      sound: {},
      add: {
        rectangle: () => ({ setStrokeStyle: () => ({ setFillStyle: () => ({ setVisible: () => ({ setDepth: () => ({}) }) }) }) }),
        circle: () => ({ setStrokeStyle: () => ({ setDepth: () => ({}) }) }),
      },
      events: { once() {} },
      setupAccessibleDom() {},
      setupKeyboardShortcuts() {},
      announceLive() {},
    };
    const labelMatch = menuJavascript.match(/gameState\.hasSave \? '([^']+)' : '([^']+)'/);
    assert.ok(labelMatch, 'Menu button labels found');
    const [continueLabel, startLabel] = [labelMatch[1], labelMatch[2]];
    freshMenuModule.exports.MenuScene.prototype.create.call(mockScene);
    assert.ok(buttons.includes(continueLabel), 'Has save renders continue label');

    buttons.length = 0;
    labels.length = 0;
    mockState.hasSave = false;
    mockState.loadError = 'STORAGE_LOAD_ERROR';
    freshMenuModule.exports.MenuScene.prototype.create.call(mockScene);
    assert.ok(buttons.includes(startLabel), 'No save renders start label');
    assert.ok(labels.includes('STORAGE_LOAD_ERROR'), 'Displays storageWarning when loadError is present');
  }
  console.log('RPG menu and restart confirmation self-check: PASS');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
