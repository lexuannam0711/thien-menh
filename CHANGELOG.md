# Changelog

## Unreleased — 2026-10-13

- Require native confirmation before restarting through canvas, keyboard or accessible menu controls.
- Preserve unreadable/unsupported saves; prevent autosave from replacing them until an explicit new game. Surface recovery warnings in Menu/HUD and failed-write warnings in HUD; successful retries clear write warnings.
- Add isolated RPG-menu native V8 unit coverage evidence. Source-line/function metrics are scoped, not full-source/branch acceptance.
- Document rollback without deleting player storage. Production rebuild and browser acceptance of these changes remain pending while the previous candidate is under exclusive long-duration stress.

## 1.0.0 target — 2026-10-12 (not release-approved)

- Integrated four-chapter campaign, bosses, RPG systems, content catalogs and procedural audio.
- Added pause, game-over, save metadata, release docs and focused self-checks.
- Fixed multi-chapter progression by resetting the legacy campaign quest and testing chapter advancement through Ending.
- Wired existing dodge, damage, enemy-reward and boss SFX at authoritative events.
- Added touch controls, settings/help accessibility layer and static deployment guidance.
- Remaining runtime acceptance gates are documented rather than overstated.
- Wired all four equipped skill slots, water casting, healing and enemy status effects; preserved power selection and empty loadouts across reload.
- Connected spear/axe/sword to actual melee reach, combo damage, knockback and attack timing; exposed all recipes through one crafting registry.
- Added shop/crafting pagination, in-game credits, chapter-aware dialogue and repeatable production-browser regressions.
- Corrected readiness reporting: catalog completeness is not playable-content completeness; NPC/enemy/dungeon/quest integration remains required.
