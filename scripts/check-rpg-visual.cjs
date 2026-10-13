const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = process.cwd();

const { execFileSync } = require('node:child_process');
const os = require('node:os');

function createMockScene(texturesList = ['hero_sprite', 'hero_axe_sprite', 'hero_sword_sprite', 'rpg-icons']) {
  const objects = [];
  const events = {
    once() {},
    on() {},
  };
  const anims = {
    exists: (key) => true,
    create: () => {},
    generateFrameNumbers: () => [],
  };
  const existingTextures = new Set(texturesList);
  const textures = {
    exists: (key) => existingTextures.has(key),
    get: (key) => ({ has: () => true }),
  };

  class MockGameObject {
    constructor(type, args) {
      this.type = type;
      this.args = args;
      this.x = args[0] ?? 0;
      this.y = args[1] ?? 0;
      this.width = args[2] ?? 0;
      this.height = args[3] ?? 0;
      this.text = typeof args[2] === 'string' ? args[2] : (args[3] ?? '');
      this.visible = true;
      this.style = {};
      this.originX = 0;
      this.originY = 0;
      this.depth = 0;
      this.interactive = false;
      this.listeners = {};
      this.isDestroyed = false;
      this.list = [];
      this.currentAnim = null;
    }
    setOrigin(ox, oy = ox) { this.originX = ox; this.originY = oy; return this; }
    setDepth(d) { this.depth = d; return this; }
    setStrokeStyle() { return this; }
    setFillStyle() { return this; }
    setScale(s) { this.scale = s; return this; }
    setInteractive(config) { this.interactive = true; this.inputConfig = config; return this; }
    on(event, fn) { this.listeners[event] = fn; return this; }
    setText(t) { this.text = t; return this; }
    setWordWrapWidth(w) { this.wordWrapWidth = w; return this; }
    play(anim) { this.currentAnim = anim; return this; }
    destroy() { this.isDestroyed = true; }
    add(items) { this.list.push(...(Array.isArray(items) ? items : [items])); return this; }
    removeAll() { this.list.forEach(i => i.destroy?.()); this.list = []; return this; }
  }

  const add = {
    rectangle: (x, y, w, h, fill, alpha) => {
      const obj = new MockGameObject('rectangle', [x, y, w, h, fill, alpha]);
      objects.push(obj);
      return obj;
    },
    circle: (x, y, r, fill, alpha) => {
      const obj = new MockGameObject('circle', [x, y, r * 2, r * 2, fill, alpha]);
      objects.push(obj);
      return obj;
    },
    text: (x, y, txt, style) => {
      const obj = new MockGameObject('text', [x, y, txt, style]);
      obj.style = style;
      objects.push(obj);
      return obj;
    },
    image: (x, y, key, frame) => {
      const obj = new MockGameObject('image', [x, y, key, frame]);
      objects.push(obj);
      return obj;
    },
    sprite: (x, y, key) => {
      const obj = new MockGameObject('sprite', [x, y, key]);
      objects.push(obj);
      return obj;
    },
    container: (x, y, children = []) => {
      const obj = new MockGameObject('container', [x, y]);
      obj.list = [...children];
      objects.push(obj);
      return obj;
    },
    graphics: () => {
      const obj = new MockGameObject('graphics', []);
      obj.lineStyle = () => obj;
      obj.lineBetween = () => obj;
      obj.fillStyle = () => obj;
      obj.fillCircle = () => obj;
      obj.strokeCircle = () => obj;
      objects.push(obj);
      return obj;
    },
  };

  return {
    objects,
    add,
    textures,
    anims,
    events,
    time: { delayedCall: (ms, fn) => fn() },
    cameras: { main: { shake: () => {} } },
  };
}

function runSuite() {
  console.log('=== Running scripts/check-rpg-visual.cjs ===');

  const villageCode = fs.readFileSync(path.join(root, 'src/game/scenes/VillageScene.ts'), 'utf8');
  const compiledVillage = ts.transpileModule(villageCode, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;

  const sceneExports = {};
  const mockPhaser = { Scene: class {}, Math: { Clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)) },
    Geom: { Rectangle: class { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
      static Contains(rectangle, x, y) { return x >= rectangle.x && x <= rectangle.x + rectangle.width && y >= rectangle.y && y <= rectangle.y + rectangle.height; } } } };
  const mockGameState = {
    data: {
      level: 4,
      hp: 120,
      mp: 80,
      attack: 25,
      gold: 150,
      upgrades: 1,
      kills: 12,
      quest: 'active',
      chapter: 1,
      rpg: {
        inventory: { capacity: 20, slots: [{ itemId: 'battle-axe', quantity: 1 }, { itemId: 'lac-sword', quantity: 1 }, { itemId: 'bamboo-armor', quantity: 1 }] },
        equipment: { slots: { weapon: 'bronze-spear', armor: 'bamboo-armor', accessory: undefined } },
        skills: {
          activeDivinePower: 'earth',
          unlockedSkillIds: ['earth-shockwave', 'flame-beam'],
          equippedSlots: { 'slot-1': 'earth-shockwave', 'slot-2': null, 'slot-3': null, 'slot-4': null },
        },
      },
    },
    save() {},
    tickPlaytime() {},
  };

  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-rpg-vis-'));
  try {
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    execFileSync(process.execPath, [
      tsc,
      'src/game/ui/RpgMenuModel.ts',
      'src/data/weapons.ts',
      'src/data/skills.ts',
      '--target', 'ES2022',
      '--module', 'commonjs',
      '--moduleResolution', 'node',
      '--skipLibCheck',
      '--esModuleInterop',
      '--outDir', output,
    ], { cwd: root, stdio: 'ignore' });
    fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');

    const dependencies = {
      phaser: mockPhaser,
      '../../data/config': { W: 960, H: 540, UI_DEPTH: 2000, PALETTE: { bronze: 0xc9a46a, gold: 0xf3c66f, cream: '#f0e4c5' } },
      '../entities/Player': { Player: class {} },
      '../systems/CombatSystem': { CombatSystem: class {} },
      '../systems/GameState': { gameState: mockGameState, getPlayerStats: () => ({ maxHp: 150, maxMp: 100 }) },
      '../ui/art': {
        label: (scene, x, y, text, fontSize = 17, color = '#f0e4c5', align = 'left') =>
          scene.add.text(x, y, text, { fontSize: `${fontSize}px`, color, align }).setOrigin(align === 'center' ? 0.5 : 0, 0.5),
        button: (scene, x, y, width, text, action, fill = 0x87623d) => {
          const box = scene.add.rectangle(0, 0, width, 44, fill).setInteractive();
          box.on('pointerdown', action);
          const txt = scene.add.text(0, 0, text, {}).setOrigin(0.5, 0.5);
          return scene.add.container(x, y, [box, txt]);
        },
        actor: () => {},
        paintVillage: () => {},
      },
      '../ui/Hud': { Hud: class { refresh() {} }, toast: () => {} },
      '../assets/assetLoader': {
        loadGameAssets: () => {},
        createGameAnimations: () => {},
        SPRITE_KEYS: { hero: 'hero_sprite', hero_axe: 'hero_axe_sprite', hero_sword: 'hero_sword_sprite' },
      },
      '../world/WorldBounds': { VILLAGE_BARRIERS: [] },
      '../rpg/InventorySystem': { addItem: () => {} },
      '../rpg/EquipmentSystem': { equipItem: () => {} },
      '../rpg/QuestSystem': {
        applyProgressToSave: () => {}, claimQuest: () => {}, progressFromSave: () => {},
        resetQuestForChapter: () => {}, startQuest: () => {}, startNpcQuests: () => {},
        claimNpcQuests: () => {}, getNpcQuests: () => [], chapterQuestsReady: () => false,
      },
      '../ui/RpgMenuModel': require(path.join(output, 'game', 'ui', 'RpgMenuModel.js')),
      '../ui/PauseOverlay': { PauseOverlay: class { isOpen() { return false; } } },
      '../audio/AudioManager': { audioManager: { startMusic() {}, playCue() {} } },
      '../../data/contentCatalog': { getChapter: () => ({ title: 'Khởi đầu' }) },
      '../world/ChapterWorld': { getChapterWorldConfig: () => ({}) },
      '../world/NpcRoster': { getVillageNpcs: () => [] },
      '../rendering/Atmosphere': { addAtmosphere: () => {} },
      '../assets/npcArtwork': { loadNpcArtwork: () => {}, createNpcAnimations: () => {}, NPC_ARTWORK_BY_ID: {} },
      '../assets/iconArtwork': {
        loadIconArtwork: () => {}, ICON_TEXTURE_KEY: 'rpg-icons',
        ITEM_ICON_FRAMES: { 'bronze-spear': 2, 'battle-axe': 3, 'lac-sword': 4, 'bamboo-armor': 5, 'jade-charm': 6 },
        SKILL_ICON_FRAMES: {
          'earth-shockwave': 9, 'stone-armor': 10, 'mountain-cleave': 11,
          'flame-beam': 12, 'blazing-dash': 13, 'sun-burst': 14,
          'tidal-surge': 15, 'dragon-vortex': 16, 'sacred-spring': 17,
        },
      },
      '../../data/weapons': require(path.join(output, 'data', 'weapons.js')),
      '../../data/skills': require(path.join(output, 'data', 'skills.js')),
      '../rendering/GraphicsSettings': {
        graphicsSettings: {
          getState: () => ({ quality: 'high', reducedMotion: false }),
          getBudget: () => ({ cameraShake: true, combatSparks: 4, ambientParticles: 10 }),
        },
      },
    };

  const fn = new Function('require', 'exports', compiledVillage);
  fn(id => dependencies[id] ?? {}, sceneExports);

  const VillageScene = sceneExports.VillageScene;
  assert.ok(VillageScene, 'VillageScene exported');

  {
    const scene = Object.create(VillageScene.prototype);
    const starts = [];
    Object.assign(scene, { player: { isDead: false, x: 920, y: 250, update() {} }, overlay: null,
      pause: { isOpen: () => false }, hud: { refresh() {} }, scene: { start: (...args) => starts.push(args) } });
    for (const chapter of [2, 3, 4]) {
      mockGameState.data.chapter = chapter;
      scene.update(0, 16);
      assert.deepEqual(starts.at(-1), ['Forest', { chapter }], 'Village portal reuses stale prior-region scene data');
    }
    mockGameState.data.chapter = 1;
  }

  {
    const harness = createMockScene();
    const scene = Object.create(VillageScene.prototype);
    Object.assign(scene, harness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    scene.openRpgMenu('inventory');

    const titleText = harness.objects.find(o => o.type === 'text' && o.text.includes('HÀNH TRANG') && o.y === 48);
    assert.ok(titleText, 'Header title found at y=48');
    const statsText = harness.objects.find(o => o.type === 'text' && o.text.includes('Lv.') && o.y === 48);
    assert.ok(statsText, 'Header stats found at y=48');

    const statsLeft = statsText.originX === 0.5 ? statsText.x - 120 : statsText.x;
    assert.ok(statsLeft > 320, `Stats text (${statsLeft}) must not overlap title at y=48`);
    scene.closeRpgMenu();
  }

  {
    const harness = createMockScene();
    const scene = Object.create(VillageScene.prototype);
    Object.assign(scene, harness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    scene.openRpgMenu('equipment');

    const previewSprite = harness.objects.find(o => o.type === 'sprite' && o.args[2] === 'hero_sprite');
    assert.ok(previewSprite, 'Hero preview sprite rendered with equipped bronze-spear (hero_sprite)');
    assert.ok(previewSprite.y > 425 && previewSprite.y < 480, 'Preview fits below statsBox without overdraw');
    const equipmentBonuses = harness.objects.filter(object => object.type === 'text' && object.x === 260);
    assert.equal(equipmentBonuses.length, 3, 'Each equipment slot exposes its bonus');
    assert.ok(equipmentBonuses.every(object => object.wordWrapWidth === 85), 'Equipment stats overdraw unequip buttons');

    const honestText = harness.objects.find(o => o.type === 'text' && o.text.includes('nội tại') && (o.text.includes('chưa có lớp hình') || o.text.includes('giáp')));
    assert.ok(honestText, 'Armor/accessory honest presentation text rendered (no world armor layer claimed)');

    mockGameState.data.rpg.equipment.slots.weapon = 'battle-axe';
    scene.refreshRpgMenu();
    const axeSprite = harness.objects.find(o => o.type === 'sprite' && o.args[2] === 'hero_axe_sprite');
    assert.ok(axeSprite, 'Hero preview updates to hero_axe_sprite when axe equipped');

    mockGameState.data.rpg.equipment.slots.weapon = 'lac-sword';
    scene.refreshRpgMenu();
    const swordSprite = harness.objects.find(o => o.type === 'sprite' && o.args[2] === 'hero_sword_sprite');
    assert.ok(swordSprite, 'Hero preview updates to hero_sword_sprite when sword equipped');

    const fallbackHarness = createMockScene(['hero_sprite', 'rpg-icons']); // missing hero_axe_sprite
    const fallbackScene = Object.create(VillageScene.prototype);
    Object.assign(fallbackScene, fallbackHarness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    mockGameState.data.rpg.equipment.slots.weapon = 'battle-axe';
    fallbackScene.openRpgMenu('equipment');
    const fallbackSprite = fallbackHarness.objects.find(o => o.type === 'sprite' && o.args[2] === 'hero_sprite');
    assert.ok(fallbackSprite, 'Missing axe texture gracefully falls back to canonical hero_sprite');

    const emptyHarness = createMockScene([]);
    const emptyScene = Object.create(VillageScene.prototype);
    Object.assign(emptyScene, emptyHarness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    assert.doesNotThrow(() => emptyScene.openRpgMenu('equipment'), 'Missing all textures does not crash equipment tab');
    emptyScene.closeRpgMenu();
  }

  {
    const harness = createMockScene();
    const scene = Object.create(VillageScene.prototype);
    Object.assign(scene, harness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    scene.openRpgMenu('skills');

    const cards = harness.objects.filter(o => o.type === 'rectangle' && o.width === 270 && o.height === 78);
    assert.equal(cards.length, 3, 'Three canonical divine power cards exist');

    const expectedSkills = [
      'earth-shockwave', 'stone-armor', 'mountain-cleave',
      'flame-beam', 'blazing-dash', 'sun-burst',
      'tidal-surge', 'dragon-vortex', 'sacred-spring',
    ];
    const skillImages = harness.objects.filter(o => o.type === 'image' && o.args[2] === 'rpg-icons');
    const branchImages = skillImages.filter(object => object.y === 195);
    assert.deepEqual(branchImages.map(object => object.args[3]).sort((first, second) => first - second),
      expectedSkills.map((id, index) => { assert.equal(dependencies['../assets/iconArtwork'].SKILL_ICON_FRAMES[id], 9 + index); return 9 + index; }),
      'All 9 branch skills use their exact canonical frames');

    const nodeTexts = harness.objects.filter(o => o.type === 'text' && ['E', '✓', '🔒', 'KHÓA', 'MỞ'].some(s => o.text.includes(s)));
    assert.ok(nodeTexts.length >= 3, 'Visual labels for equipped/unlocked/locked exist on branch nodes');

    const interactiveNodes = harness.objects.filter(o => o.interactive && (o.listeners.pointerover || o.listeners.pointerdown));
    assert.ok(interactiveNodes.length >= 9, 'Branch nodes have hover and press feedback listeners');
    const branchNodes = interactiveNodes.filter(object => object.type === 'circle');
    assert.equal(branchNodes.length, 9, 'All canonical branch nodes rendered');
    assert.ok(branchNodes.every(object => object.inputConfig.hitArea.width === 50 && object.inputConfig.hitArea.height === 50),
      'Node hit targets must be 50 logical pixels');
    const hoverNode = interactiveNodes.find(object => typeof object.listeners.pointerover === 'function');
    assert.ok(hoverNode, 'Branch nodes expose hover callback');
    hoverNode.listeners.pointerover();
    const tooltip = scene.skillTooltipBox;
    assert.ok(tooltip, 'Hover must create tooltip');
    scene.openRpgMenu('inventory');
    assert.equal(scene.skillTooltipBox, null, 'Menu replacement leaks tooltip');
    assert.equal(tooltip.isDestroyed, true, 'Old tooltip survives menu replacement');

    const perkTexts = harness.objects.filter(o => o.type === 'text' && o.style && o.style.fontSize === '10px' && o.y === 178);
    assert.equal(perkTexts.length, 3, 'All three passive summaries are rendered');
    perkTexts.forEach(pt => {
      assert.ok(pt.wordWrapWidth <= 260 || pt.text.length <= 45, 'Power perk text wraps or fits within card width');
    });

    scene.closeRpgMenu();
    assert.equal(scene.isRpgMenuOpen, false, 'Menu teardown sets isRpgMenuOpen to false');
    assert.equal(scene.overlay, null, 'Menu teardown cleans up overlay container');
  }

  {
    const reducedHarness = createMockScene();
    const scene = Object.create(VillageScene.prototype);
    dependencies['../rendering/GraphicsSettings'].graphicsSettings.getState = () => ({ quality: 'high', reducedMotion: true });
    Object.assign(scene, reducedHarness, {
      player: { isDead: false },
      pause: { isOpen: () => false },
      hud: { refresh() {} },
    });
    mockGameState.data.rpg.equipment.slots.weapon = 'bronze-spear';
    scene.openRpgMenu('equipment');
    const sprite = reducedHarness.objects.find(o => o.type === 'sprite' && o.args[2] === 'hero_sprite');
    assert.ok(sprite, 'Hero preview sprite rendered under reduced motion');
    assert.equal(sprite.currentAnim, null, 'Under reduced motion, hero preview does not play looping animation');
    scene.closeRpgMenu();
  }
  console.log('scripts/check-rpg-visual.cjs: ALL TESTS PASSED!');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
}

runSuite();
