# Thần Mệnh — QA Report

## October 13 source save-safety regression

- Historical baseline: `npm run check:all` exit 0 reproduced DAgfL7dU before these edits. Current candidate evidence is recorded below.
- Shared Menu restart: cancellation preserves save/scene/input; confirmation executes one reset; unavailable dialog cannot reset. Actual-method test reproduced RED then GREEN.
- Storage: malformed JSON, unsupported schema, invalid root and denied reads preserve original bytes; explicit reset restores writes. Missing save does not resurrect prior in-memory progress. Quota failure preserves in-memory data/stored bytes, including failed reset; successful retry clears warning. Menu/HUD expose warnings; HUD restores location text after recovery. Focused save/menu tests and typecheck PASS.
- Source changes are now built into production bundle `index-CdV_jToi.js` (SHA-256 `194d5a8fbe2323cb902d6236f6b89a3c41156988bcbfee9b5492523727d996d6`). Rebuild passes `check:all`, browser dialogs/storage checks pass on preview port 4187, and fresh campaign playthrough passes.
- Native RPG-menu unit coverage: `npm run check:unit-coverage-control` exit 0. Runtime mapped lines 3409/4104 (83.07%), observed functions 129/202 (63.86%); self-check evidence retained separately. Two emitted modules unobserved. Exact hashes/scope/exclusions: `artifacts/unit-coverage/rpg-menu.json`. Branches UNMEASURED; full-source/branch >=80% gate remains open.

## Automated

Coordinator validation: `npm run check:all` passed on October 12, 2026. It covers production build, save normalization, boss/RPG self-checks, content/audio integrity, RPG-menu transactions, graphics and sprite checks. A bundle chunk warning (~1.63MB) is expected due to the single un-split Phaser entry point.

Regression suite covers legacy quest reset and deterministic advancement through Chapters 1–4. Chapter advancement now strictly blocks accepted active/return side quests to prevent stranded rewards (unaccepted new side quests remain optional). Verified fixes include legacy `bossDead` backfill, previous-chapter ready reward submission, and pause action lock. Quest regression RED was reproduced and resolved to GREEN. Audio self-check covers ten music contexts plus pause/resume/cleanup.

## Runtime smoke & browser checks

Coordinator validation: `npm run check:browser` passed on production preview. In addition to canvas rendering, skill pagination, unequip/equip, water casting with R, exclusive Escape handling, cooldown/divine-power reload persistence, and mobile-emulated touch R, the suite verifies actual NPC board acceptance and campaign hunt acceptance through the live canvas and funded shop/inventory fixtures.

Production build and all focused checks passed after integration. Crafting recipes are wired through a shared registry in RpgMenuModel; all three weapons (spear, axe, sword) can be crafted and equipped in model transactions.

Proof boundary: These automated checks establish fixture, model, and headless self-check boundaries. They are NOT proof of a complete campaign playthrough, real device performance, or long-term stability.

## Playable-content audit

Source implementation status:
- NPCs: All 15 named NPCs from `contentCatalog` are wired into runtime through `NpcRoster.ts` (`getVillageNpcs`), appearing across chapter hubs with dialogue, quest start/turn-in transactions, and shop/smithing services in `VillageScene.ts`.
- Enemies & Elites: All 12 common enemies and four elites are defined in `config.ts` (`ENEMIES`) with canonical stats, colors, scales, and four AI roles (`melee`, `ranged`, `charge`, `ambush`). `ChapterWorld.ts` assigns them to weighted wave pools per chapter, and `Enemy.ts` executes role-specific mechanics (warning cones, ranged projectiles, charge dashes, ambush blinks, elite multipliers) and status effects (`burn`, `slow`, `stun`).
- Quests: `src/data/quests.ts` is runtime authority: 32 definitions, 16 main including the legacy hunt and 16 side. `QuestSystem.ts` and `QuestInteractions.ts` handle kills, markers, rewards and chapter gating. Historical active quests retain interactions/target spawns; the chief settles old rewards when the original giver is absent.
- Dungeons: `DungeonScene.ts` and `DungeonSystem.ts` implement all three catalogued dungeons, 2/3/4 combat floors, a final elite, reusable key/level/area gates, persisted cleared floors and atomic once-only item rewards. Accepted side quests and started dungeons block advancement until rewards are settled.
- Weapons & Skills: Three weapon archetypes (spear, axe, sword) drive attack speed, reach, knockback, combo multipliers, and crafting transactions. Four skill slots (Q/E/R/T) consume data-driven MP/cooldowns with status effects, healing, and geometric hit testing.

Unverified and missing boundaries:
- Browser dungeon fixtures cleared all nine combat floors, three elites and reward claims through keyboard/canvas inputs on the production build. Fixtures seed level 20, attack 1000 and keys: not proof of natural unlocks, difficulty or pacing.
- Natural input-driven production progression across all four chapters, 32 quest rewards, nine dungeon floors, Ending and save hydration PASS. Narrative pacing and representative difficulty remain unverified.
- Release status is **not achieved** (Full game 1.0 gates incomplete).

## Audio, area revisits and playtime regression

- Production browser: all three volume sliders persist across reload. Headless WebAudio mocks verify music/SFX routing, channel isolation, active-voice gain changes and cleanup. No subjective listening acceptance is implied.
- Additional boosted fixture: campaign chapter 4 travels through chief UI to chapter 1, clears both earlier dungeon floors, claims reward and retains campaign chapter 4. Quest-marker regression verifies chapter-1 flags cannot stamp chapter 2.
- Active playtime increases and persists; browser pause excludes 1.5 seconds idle, resume restarts counting, reload preserves saved value. Save self-check rejects invalid deltas and hidden-document time.
- Read-only cross-review identified pause/menu overlap and repeating menu keys; narrow guards now pass actual-method/handler regression.
- NPC artwork preload requires longer fixture scene-start waits (800ms rather than 300ms); runtime errors are asserted before shop actions.
- Snapshot boundary: the audio/revisit/playtime browser acceptance uses production bundle `index-DK616quX.js`. A later independent environment-art wave is in progress; missing producer modules in that wave are not evidence that the full current checkout passes `check:all`. Gameplay focused checks remain GREEN; the last all-suite GREEN predates that environment integration.

## Mobile emulation

Headless Chrome emulation at `390×844` rendered the canvas and the landscape guidance overlay; a touch event was dispatched without runtime failure. This is fixture/headless smoke evidence and does not replace real Android Chromium or iPhone Safari testing.

## October 13 natural-campaign acceptance

- New isolated save starts at chapter 1, level 1, gold 0 and attack 12; progression uses real keyboard/mouse inputs only. The debugger observes production objects read-only; no fixtures, stat boosts or direct gameplay calls.
- Harness regressions pass: barrier-aware navigation, vector-correct key timing, GameOver return recovery, exact authored quest gold/XP/item deltas and natural dungeon floor/reward gates.
- Production snapshot `index-BrXQkeHs.js`: natural chapter-1 dungeon cleared both floors, claimed its items, then completed chapter-1 quests. Advancing to chapter 2 exposed a real softlock: village portal reused previous Forest scene data `{chapter: 1}` after dungeon return. Save chapter 2 remained active with zero campaign kills while chapter-1 enemies continued spawning. Evidence: `artifacts/campaign-chapter-stale-data.png`.
- Requested owner fix: village portal must pass the current campaign chapter explicitly. Full four-chapter/dungeon/Ending/save-reload acceptance remains pending the corrected production build and a fresh complete run; no full campaign PASS artifact exists from this failed attempt.
- At that historical snapshot, the harness required all 32 quest rewards, four bosses, all nine natural dungeon floors, save hydration after reload and an unchanged bundle SHA-256 before writing acceptance. Automation did not establish representative difficulty, 3–5-hour pacing or physical-device performance; current headless stress evidence is recorded below.
- Corrected snapshot `index-CHXA1yNw.js`, run 53606: all four chapter checkpoints, all 32 quest reward flags, exact authored quest gold/XP/item payouts, all four bosses, all three natural dungeons/nine floors and Ending passed their runtime assertions. Final checkpoint: level 36, gold 7428, active playtime 551.9263433331638 seconds, zero deaths.
- Overall command exited 1 only at reload comparison: normalized playtime was 552 seconds instead of the raw fractional value. No other save-field difference appeared. This matches the existing `normalizeSave` policy; the corrected harness permits only `Math.round` of this field, still rejects progress/gold/time losses, and passes focused regression. No full campaign PASS artifact was claimed at that historical snapshot until the corrected complete command succeeded.
- Final accepted run 6239: `npm run check:campaign` exit 0 on `/assets/index-D71EOpKB.js`, SHA-256 `501549219ba7dd50b84d0d7c6c9e77da416ca2ad23e628acd8e9402646749bd6`. Fresh save, no boosts/setters, four chapters, 32 completed/rewarded quests, 35 exact payout receipts including all four legacy boss rewards, all four bosses, three naturally unlocked dungeons/nine floors/item rewards, Ending/credits, authored asset HTTP 200, exact save hydration except documented rounding, no runtime exceptions and unchanged bundle hash.
- Main independently audited `artifacts/campaign-acceptance.json`, inspected `artifacts/campaign-ending.png` and confirmed no owned campaign Chrome survives. Elapsed 611.992 seconds; active 596.8247933331285 seconds; level 38, gold 8073, zero deaths. Later transient-scene/post-click-death marker guards have actual-function focused regression, but this zero-death accepted browser run does not prove actual runtime revival.
- Earlier failed attempts are retained as historical debugging evidence, not current acceptance. The accepted fast automated route does not prove human pacing, difficulty, physical devices or native-device stability. Full game 1.0 remains not achieved.

## October 13 historical isolated V8 coverage (DAgfL7dU)

- Hidden sourcemap build preserved production bundle bytes and SHA-256 above; shared `dist/` and canonical uninstrumented campaign receipt were not replaced. Exact generated code and sourcemap equality were checked before combining 4 campaign and 13 browser snapshots.
- Instrumented campaign run 64447 exited 0: new save, real inputs/no boosts, all 32 quest rewards, four bosses, three naturally unlocked dungeons/nine floors, Ending and strict reload. Three natural deaths/revivals observed; elapsed 719.649 seconds, final level 37/gold 7866. Separate receipt: `artifacts/campaign-coverage-acceptance.json`. Instrumentation is not FPS or pacing evidence.
- Instrumented UI fixture run 40266 exited 0; settings, skills, NPC board, inventory/equipment/shop, touch, dungeons and reload checks passed. Fixtures remain explicitly separate from natural progression.
- Mapper selfcheck and syntax GREEN. Campaign mapped lines 8300/10976 (75.62%), observed functions 545/747 (72.96%); UI lines 8439/10976 (76.89%), observed functions 529/756 (69.97%); union lines 9560/10976 (87.10%), observed functions 665/802 (82.92%). Reports: `artifacts/campaign-source-line-coverage.json`, `artifacts/browser-source-line-coverage.json`, `artifacts/combined-source-coverage.json`.
- Denominator is observed mapped generated spans, not an AST census; partial-line hits count, first-range function hits OR across exact offsets, vendor/unmapped functions remain explicit. Sourcemap contains 52 app files; `src/data/npcs.ts`, CSS and ten self-check/test TS files are absent. Full-repo/branch >=80% acceptance remains open.
- Owned coverage browser processes and port 4173 listener verified absent; preview stopped and exact owned temporary build removed. Mapper worker accepted/closed. At this historical snapshot, the exclusive 30-minute stress window was released to the graphics coordinator; no stress PASS was claimed then.

## October 13 historical equipment candidate acceptance (DAgfL7dU)

- Current frozen bundle `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`. Graphics coordinator supplied check:all exit 0, equipment/browser fixture exit 0. Main independently reviewed equipment02 receipt and regrouped all 36 actions: every action advances at least two canonical frames within the same animation; relative overlay order permits the legitimate player label. Functional overlay acceptance is not physical-device or art approval.
- Main uninstrumented campaign session 57518 exited 0: new save/no boosts, all 32 rewarded quests/35 exact payout receipts, four bosses, three naturally unlocked dungeons/nine floors/items, Ending/credits, strict reload, asset responses and unchanged bundle hash. Elapsed 788.418 seconds, two natural deaths/revivals, level 37/gold 7966. Ending image independently inspected. Current canonical campaign files refer to DAgfL7dU; previous D71 artifacts are preserved byte-exact in `artifacts/campaign-snapshots/index-D71EOpKB/`.
- Hidden-map build byte-identical to current production. Instrumented campaign session 79586 exit 0, elapsed 698.005 seconds, two deaths/revivals, level 37/gold 7919. Instrumented browser fixture session 68070 exit 0; actual settings/skills/shop/dungeon/revisit/reload checks passed. Neither instrumented duration establishes FPS/pacing.
- Exact code/map/SHA equality was verified before combining four campaign and thirteen browser epochs. Historical DAgfL7dU mapped coverage: campaign 8321/11052 lines (75.29%) and 554/758 observed functions (73.09%); browser 8506/11052 lines (76.96%) and 539/767 functions (70.27%); union 9597/11052 lines (86.83%) and 674/813 functions (82.90%). Reports live under `artifacts/coverage-DAgfL7dU/`; 53 app files mapped. Earlier denominator limitations still apply. Receipts/raw/PNG are preserved under `artifacts/campaign-snapshots/index-DAgfL7dU/`.
- Exact owned coverage preview session 87938 stopped; port 4173 listener and campaign/browser processes verified absent. Temporary build `than-menh-coverage-build-6QHPkG` verified beneath OS temp then removed. Main CPU/browser window closed. At that historical snapshot, no longstress PASS had been recorded.

## October 13 production candidate acceptance (`index-CdV_jToi.js`)

- Current production bundle: `dist/assets/index-CdV_jToi.js`, SHA-256 `194d5a8fbe2323cb902d6236f6b89a3c41156988bcbfee9b5492523727d996d6`.
- Quality gates: `npm run check:all` PASS (20/20 checks); `npm run check:unit-coverage-control` PASS (native RPG-menu unit lines 3409/4104 = 83.07%, functions 129/202 = 63.86%).
- Browser fixture: `scripts/check-browser.cjs` on preview port 4187 PASS exit 0 (audio/graphics settings persistence, mobile touch viewport emulation, shop/inventory, 3 dungeons/9 floors/elites/rewards, area revisit, reload).
- Natural unboosted campaign: `scripts/check-campaign.cjs` PASS exit 0 on `index-CdV_jToi.js`. Elapsed 604.227 seconds, 1 natural death, 32 quest rewards / 35 payouts, 4 bosses, 3 dungeons / 9 floors, Ending scene and credits, strict reload verified. Artifacts preserved in `artifacts/campaign-acceptance.json`, `artifacts/campaign-ending.png`, and `artifacts/campaign-snapshots/index-CdV_jToi/`.
- 30-minute headless graphics stress test: PASS via `scripts/check-graphics-stress.cjs` on the candidate bundle. Low/Medium/High each completed 600s active combat; 0 runtime errors, 0 asset failures, 0 deaths; bundle hash remained exact. The receipt also records four baseline `favicon.ico` HTTP 404 warnings. This is not native-device FPS, memory or stability proof. Receipt: `artifacts/graphics-stress-current-30m/report.json`.

## Not verified / Pending gates

1. Representative unboosted combat balance; natural dungeon key/level/floor/reward progression is observed.
2. Representative narrative pacing, difficulty and the 3–5-hour target; production campaign progression itself passes.
3. Real phone testing (physical Android Chromium and iPhone Safari).
4. Native-device FPS profiling and representative real-device stability remain open; controlled headless 30-minute stress passed.
5. Full relevant-source/branch coverage >=80%; mapped observed metrics alone do not establish this gate.
