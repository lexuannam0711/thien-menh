# Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform "Thần Mệnh: Hậu Duệ Văn Lang" into a visually complete game featuring authentic Đông Sơn / Văn Lang fantasy aesthetics, upgraded procedural graphics, combat VFX, and an offline-first sprite asset loader pipeline.

**Architecture:** A 3-tier fallback architecture where game entities and scenes prefer Tier 1 sprite sheet animations from `public/assets/sprites/` if available, gracefully falling back to Tier 2 procedural vector art in `src/game/ui/art.ts`, backed by Tier 3 primitive geometric safeguards.

**Tech Stack:** TypeScript, Phaser 4.2.1, Vite 8.3.4, HTML5 Canvas 2D.

---

### Task 1: Upgraded Procedural Art & Scenery (`src/game/ui/art.ts`)

**Files:**
- Modify: `src/game/ui/art.ts`

- [ ] **Step 1: Update art.ts with authentic Đông Sơn patterns and structures**
  - Implement `drawDrumPattern()` for the central village plaza with 14-point solar starburst and concentric geometric bands.
  - Implement `drawStiltHouse()` with boat-shaped curved thatch roof (mái cong hình thuyền), stilts, and woven bamboo walls.
  - Implement `drawBamboo()` with segmented nodes and clustered leaves.
  - Implement `drawActorVanLang()` supporting:
    - Hero: Feather headband, bronze spear, woven loincloth.
    - Trưởng làng: Elder robe, bird staff.
    - Thợ rèn: Bronze hammer, leather apron.
    - Bà Mo: Shaman beads, bronze bell.
    - Mộc Tinh: Gnarled tree bark with thorny vines and glowing eyes.
    - Ma Trơi: Cyan-jade floating wisp with flame trails.
    - Hổ Yêu: Menacing striped tiger silhouette with bronze chest plate and claws.
- [ ] **Step 2: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: PASS

---

### Task 2: Combat VFX & Telegraph Warning Polish (`CombatSystem.ts`, `Enemy.ts`)

**Files:**
- Modify: `src/game/systems/CombatSystem.ts`
- Modify: `src/game/entities/Enemy.ts`

- [ ] **Step 1: Polish slash arcs, shockwaves, and flame beams in CombatSystem.ts**
  - Slash: Multi-layered golden-bronze crescent arc with trailing sparks.
  - Earth (Q): Expanding Trống Đồng solar disc with concentric shockwave rings.
  - Flame (E): Cinnabar flame beam with ember particles and core bright highlight.
- [ ] **Step 2: Polish enemy telegraph indicator in Enemy.ts**
  - Replace solid red circle with saw-tooth pulsing warning ring.
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: PASS

---

### Task 3: Pixel Art Sprite Generator & Asset Loader (`scripts/generate-sprites.js`, `src/game/assets/assetLoader.ts`)

**Files:**
- Create: `scripts/generate-sprites.js`
- Create: `src/game/assets/assetLoader.ts`
- Create: `public/assets/sprites/` (directory and generated PNGs)

- [ ] **Step 1: Create standalone PNG sprite generator in Node.js**
  - Generate pixel art spritesheets:
    - `public/assets/sprites/hero.png` (48x48 frames: idle, walk, attack)
    - `public/assets/sprites/moctinh.png` (48x48 frames: idle, walk, attack)
    - `public/assets/sprites/matroi.png` (32x32 frames: float, dash)
    - `public/assets/sprites/hoyer.png` (96x96 frames: idle, stalk, slam)
- [ ] **Step 2: Run generator script to produce sprite assets**
  Run: `node scripts/generate-sprites.js`
  Expected: PNG spritesheets created in `public/assets/sprites/`
- [ ] **Step 3: Implement assetLoader.ts in Phaser**
  - Add `loadGameAssets(scene: Phaser.Scene)` and `createGameAnimations(scene: Phaser.Scene)`
  - Register animations if sprites are loaded.
- [ ] **Step 4: Verify TypeScript compilation**
  Run: `npm run build`
  Expected: PASS

---

### Task 4: Connect Entities and Scenes to Sprite System with Fallback (`Player.ts`, `Enemy.ts`, `VillageScene.ts`, `ForestScene.ts`)

**Files:**
- Modify: `src/game/scenes/VillageScene.ts`
- Modify: `src/game/scenes/ForestScene.ts`
- Modify: `src/game/entities/Player.ts`
- Modify: `src/game/entities/Enemy.ts`

- [ ] **Step 1: Preload assets in VillageScene and ForestScene**
  - Call `loadGameAssets()` in `preload()` of scenes.
  - Call `createGameAnimations()` in `create()`.
- [ ] **Step 2: Wire sprite rendering and fallback in Player and Enemy**
  - If spritesheet animation exists, attach sprite and play animation.
  - Otherwise, maintain procedural container rendering.
- [ ] **Step 3: Verify TypeScript compilation and runtime preview**
  Run: `npm run build`
  Expected: PASS with 0 errors.
