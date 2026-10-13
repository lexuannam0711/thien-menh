# Thần Mệnh — Progress

## Status

Not achieved. Full game 1.0 gates remain pending. Natural input-driven Chapters 1–4, all 32 quest rewards, four bosses, three dungeons/nine floors, Ending and save/reload PASS on the frozen production snapshot. Representative pacing, real devices, coverage and 30-minute stability remain unverified.

## October 13 save-safety integration (IN_REVIEW)

- Fresh `npm run check:all` exited 0 and reproduced candidate `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`, before the save-safety changes below.
- Shared Menu restart lacked confirmation on all three input paths. Actual-method regression reproduced RED then passed GREEN after adding native confirmation before any side effects.
- Malformed, unsupported-version and unreadable storage previously allowed autosave overwrite. Actual storage regression reproduced RED then passed GREEN; original bytes now remain untouched until explicit reset. Quota/write failure preserves session progress and exposes Menu/HUD warnings; successful retry clears the write warning. Focused checks and TypeScript `--noEmit` pass.
- Source now differs from the frozen candidate. Release rebuild, current-source whole-suite run and production browser acceptance remain required; prior campaign/coverage receipts do not accept these edits.
- Exclusive seeded 30-minute active-combat stress is running on frozen DAgfL7dU (preview 4187; exec sessions 33465/96961). One owned headless Chrome profile; cleanup is built into the harness. No longstress PASS claimed. Re-poll the live handle before restarting or deciding it stopped.
- Isolated native V8 RPG-menu coverage evidence: `artifacts/unit-coverage/rpg-menu.json`. Hash-checked JS/map/source; missing runtime modules and test-source scope explicit. Branch coverage remains UNMEASURED; do not mix this compilation's offsets with production bundle offsets.

## Implemented source

- Graphics enemy/environment slice: sixteen canonical sprite identities (1,536 frames), five authored terrain/prop kits (80 frames), unchanged actor hitboxes/collision/portals, missing-texture fallback. Combined producer checks/build/seeded browser PASS at `BrXQkeHs`; post-snapshot floor-readability/dungeon-label/cache fixes focused GREEN. VFX/icons integration active; final combined build/browser still pending.

- NPC graphics slice (October 12, 2026): fifteen canonical role sprites/portraits, finite dialogue animation, stable-ID service portraits, retained interaction zones. NPC PNG/loader tests and refreshed build/browser checks PASS; live chief portrait capture inspected. Review locked boss-telegraph impact and dead-menu-entry bugs resolved with focused regressions. Sixteen-enemy bespoke art and five authored regional kits remain in progress; full graphics1.0 not accepted.

- Graphics technical slice (October 12, 2026): three equipped hero weapon sheets, four boss sprite bindings, death/victory playback, presets/reduced motion, accessible settings, 1,692 distinct frames in eleven ≤2048px atlases. Build/self-checks/seeded browser fixtures PASS before the active NPC portrait integration. Premium art approval, bespoke sixteen-enemy visuals, authored world kits, complete UI and real-device performance remain OPEN. Exact graphics evidence: `GRAPHICS_QA.md`.

- 15 named NPCs: Wired through `NpcRoster.ts` (`getVillageNpcs`) across chapter hubs in `VillageScene.ts` with dialogue, quest start/claim flows, and shop/smithing services.
- 16 runtime enemies: 12 common enemies and four elites configured in `config.ts` (`ENEMIES`) with canonical stats, four AI roles (`melee`, `ranged`, `charge`, `ambush`), and chapter wave pools in `ChapterWorld.ts`.
- 32 runtime quests in `src/data/quests.ts`: 16 main (including the legacy campaign hunt) and 16 side quests. World interactions, inventory-guarded rewards and chapter gating are integrated. Historical quests retain interactions and target spawns; the chief accepts old rewards when the original giver is absent.
- Three dungeons: `DungeonScene.ts` runs 2/3/4 combat floors, chapter-local enemies and a final elite. Reusable keys, level/area gates, cleared-floor persistence and atomic once-only rewards use `DungeonSystem.ts`.
- Combat runtime: Three weapons (spear, axe, sword) with combo-step damage/knockback/speed scaling and shared crafting recipes; four equipped skill slots (Q/E/R/T) with MP costs, cooldowns, geometric hit detection, and status effects (`burn`, `slow`, `stun`).

## Completed validation evidence (Coordinator verified)

- `npm run check:all`: PASS (covers production build, save normalization, boss/RPG self-checks, content/audio integrity, RPG-menu transactions, graphics, sprites).
- `npm run build`: PASS (~1.63MB single chunk warning).
- `git diff --check`: PASS.
- `npm run check:browser`: PASS on production preview (NPC acceptance, skills, touch, reload, funded shop/equip; all nine actual dungeon combat floors, three elites and reward receipt using level-20/attack-1000/key-unlocked fixtures).
- Quest regression: PASS (reproduced RED then confirmed GREEN; covers legacy `bossDead` backfill, previous chapter ready reward submission, pause action lock, chapter advance blocking accepted active/return side quests).

## October 12 integration: audio, revisits and playtime

- Independent master/music/SFX sliders persist and restore after reload; mock WebAudio checks prove separate channel routing and live gain updates.
- Chief travel picker revisits prior areas without changing campaign chapter. Browser cleared chapter-1 dungeon while campaign remained chapter 4; origin-area quest flags and default wrong-area rejection pass focused regressions.
- Active scene playtime is saved; hidden tabs, pause, death and village modal guards exclude idle updates. Browser pause/resume/save/reload assertions passed; this counter does not establish campaign pacing.
- Review fixes prevent RPG opening through pause and ignore repeating menu keys; focused regression reproduced RED then passed GREEN.
- Separate environment-art integration is still active. Latest whole-checkout acceptance must wait for its producer modules; do not treat earlier `check:all` evidence as acceptance of that unfinished wave.

## Open evidence / Pending gates

- Latest accepted equipment candidate is `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`: natural campaign exit 0, all content/reload/hash gates, two natural deaths/revivals. Separate instrumented campaign/UI exit 0; union mapped coverage 86.83% lines/82.90% observed functions across 53 app sources. D71 evidence below is historical and preserved in `artifacts/campaign-snapshots/index-D71EOpKB/`; current canonical campaign files refer to DAgfL7dU. Final-snapshot exclusive longstress released after verified browser/preview/temp cleanup; full 1.0 remains unaccepted.

- October 13 isolated coverage: same production bytes/hash, campaign and UI fixture runs exit 0, union mapped lines 9560/10976 (87.10%) and observed mapped functions 665/802 (82.92%). Instrumented campaign witnessed three natural deaths/revivals; canonical uninstrumented receipt unchanged. Full relevant-source/branch denominator remains open. Coverage browser/preview/temp build and mapper worker closed; graphics coordinator received exclusive stress window.

- October 13 accepted campaign: `npm run check:campaign` exit 0 on `index-D71EOpKB.js`, SHA-256 `501549219ba7dd50b84d0d7c6c9e77da416ca2ad23e628acd8e9402646749bd6`. Fresh save, no boosts or gameplay setters, all 32 completed rewards, 35 exact payout receipts (legacy hunt repeated across four chapters), four boss flags, all nine natural dungeon floors/items, Ending/credits and strict save hydration with documented time rounding.
- Independent artifact audit PASS: `artifacts/campaign-acceptance.json`; Ending inspected in `artifacts/campaign-ending.png`. Elapsed 611.992 seconds, active playtime 596.8247933331285 seconds, level 38, gold 8073, zero deaths. Owned campaign Chrome closed automatically; reviewer closed. This is not representative human pacing or actual runtime death/revival proof.

- October 13 natural-run evidence: chapter-1 dungeon both floors and item reward cleared without boosted fixtures; exact authored quest gold/XP/item receipts passed. Full run exposed a chapter-2 stale-region softlock after dungeon return (`artifacts/campaign-chapter-stale-data.png`). Village portal owner supplied explicit current-chapter data; coordinator reran actual-method visual regression GREEN. Corrected production build and complete fresh campaign remain pending; full 1.0 is not accepted.
- Corrected snapshot `index-CHXA1yNw.js`, run 53606: all 32 quest reward flags, exact authored gold/XP/item payouts, four bosses, all nine natural dungeon floors/rewards and Ending passed assertions. Final level 36, gold 7428, playtime 551.9263433331638 seconds, zero deaths. Overall exit 1 only at intentional save-time normalization (552 seconds); the corrected strict-rounding harness self-check is GREEN. Final campaign PASS artifact still requires a complete rerun.

- Dungeon natural acquisition: all three keys/level gates, nine floors and item rewards have unboosted input-driven proof. Representative difficulty/pacing remain pending; an omniscient automated runner is not player-balance acceptance.
- Whole interactive campaign: input-driven production end-to-end/hash/reload acceptance PASS. Narrative pacing, 3–5-hour target and representative difficulty remain unverified.
- Real-device mobile acceptance: Physical Android Chromium and iPhone Safari testing not run (only headless mobile emulation recorded).
- Performance and stability: FPS, heap allocation trends, and 30-minute sustained gameplay stability not measured.

## October 13 update: Save Safety, Combat Input Buffering & Inventory Polish

- Save & Menu UX:
  - `MenuScene.ts`: window.confirm dialog on "Choi lai tu dau"; dynamic button label "TIEP TUC HANH TRINH" vs "BAT DAU HANH TRINH" based on `gameState.hasSave`; storage warning text rendered on load/save errors.
  - `GameState.ts`: corrupt save protection without overwrite until explicit restart; tracks `loadError`, `saveError`, `hasSave`.
  - `Hud.ts`: warning notification banner when storage operations fail.
- Combat & Locomotion:
  - `Player.ts`: input buffering (`attackBufferMs: 150`); `dodge()` resets `attackAt = 0` and cancels buffered attacks; `useSkill()` guards against casting while `isDodging` to prevent frozen locomotion slides with invulnerability.
  - `scripts/check-player-status.cjs`: regression tests for dodge/hit clearing buffer, dodge resetting attack cooldown, dodge blocking skills.
- Inventory UI:
  - `VillageScene.ts`: safe fallback for category/sort indexes; `nameText` word-wrap set to 185px to prevent item name overlapping USE/EQUIP buttons.
  - `scripts/check-rpg-menu.cjs`: regression tests for MenuScene continue/start label and storage error presentation.
- Validation:
  - `npm run build`: PASS.
  - `npm run check:unit-coverage-control`: PASS.
  - `npm run check:all`: 20/20 PASS.
