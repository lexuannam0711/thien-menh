# Design Spec: Thần Mệnh - Visual Overhaul (Procedural & Asset Integration)

**Date:** 2026-10-12  
**Status:** Approved  
**Topic:** Visual & Animation Overhaul (Đông Sơn / Văn Lang Fantasy)

---

## 1. Objectives & Scope
1. **Procedural Aesthetics (Tier 2 & 3)**:
   - Replace primitive geometric circles and plain rectangles with culturally authentic Đông Sơn / Văn Lang visual representations rendered procedurally in Phaser:
     - Nhà sàn mái cong hình thuyền (boat-shaped curved roof stilt houses).
     - Sân Trống Đồng Ngọc Lũ (solar starburst 14 rays, concentric circles, saw-tooth borders, Lac bird motifs).
     - Rừng Trúc U Minh (segmented bamboo canes, demonic altar, atmospheric forest ground).
     - Procedural characters: Hero "Thiên Mệnh" with feather headdress and bronze spear; Mộc Tinh with thorny bark; Ma Trơi with ethereal jade-cyan wisp; Hổ Yêu with menacing tiger stripes.
     - Combat VFX: Bronze slash arcs, Trống Đồng shockwave (Q), flame ray (E), and saw-tooth telegraph indicators.
2. **Asset Pipeline & Fallback Architecture (Tier 1)**:
   - Create asset directory `public/assets/sprites/`.
   - Provide standalone pixel art sprite generator script that generates PNG spritesheets for Hero, Mộc Tinh, Ma Trơi, and Hổ Yêu.
   - Implement preload and fallback logic in game scenes ensuring 100% crash-free execution if static assets are loading or missing.
3. **Compatibility & Performance**:
   - Zero copyrighted assets.
   - Phaser 4.2.1 and Vite 8.3.4 compatible.
   - 60 FPS performance on mobile and desktop.

---

## 2. Architecture & File Decomposition
- `src/game/ui/art.ts`:
  - Enhanced procedural drawing methods: `drawDongSonDrum()`, `drawStiltHouse()`, `drawBambooGrove()`, `drawActorVanLang()`.
  - Exported procedural rendering pipeline integrated into `paintVillage()`, `paintForest()`, and `actor()`.
- `src/game/systems/CombatSystem.ts`:
  - Polished VFX: `slashEffect()` with curved crescent arcs and sparks, `earth()` with Trống Đồng shockwave, `flame()` with multi-layered cinnabar flame trail.
- `src/game/entities/Enemy.ts`:
  - Telegraph indicator styled with saw-tooth concentric patterns.
- `src/game/assets/assetLoader.ts`:
  - Texture registration and animation creation for spritesheets with graceful fallback.
- `scripts/generate-sprites.js`:
  - Node.js generator script rendering pixel art frames into PNG files for `public/assets/sprites/`.

---

## 3. Verification & Acceptance
- `npm run build` succeeds with zero TypeScript errors.
- Visual inspection confirms distinct Đông Sơn aesthetic elements in Village and Forest scenes.
