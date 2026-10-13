# Thần Mệnh — Graphics QA and Acceptance Gates

## Current verdict / evidence boundary

### Foreground sequential audits, process cleanup, and browser verification — October 13, 2026

- Enforced user directive: zero background processes. Terminated lingering stress PID 379844 and Chrome child tree without corrupting partial report artifacts.
- Executed sequential foreground audit suites:
  - Hero & VFX: check-sprites, check-combat-vfx -> PASS.
  - World & NPCs: check-environments, check-npcs, check-enemies, check-environment-atmosphere -> PASS.
  - UI & Equipment: check-equipment, check-icons, check-rpg-visual, check-scene-presentation, check-player-status -> PASS.
  - Controls: check-graphics-stress-control, check-equipment-browser-control, check-campaign-control -> PASS.
  - Browser regressions: scripts/check-browser.cjs and scripts/check-equipment-browser.cjs verified PASS against preview port 4187 (bundle index-CdV_jToi.js).
- Full suite npm run check:all passes 100% (20/20 test suites).
- Production status: 30-minute endurance stress marked INCOMPLETE/STOPPED per directive; Graphics 1.0 gates 1-5 remain OPEN pending human art sign-off and device proof.

### Stress harness dead zone repair, headless stability, and fresh smoke receipt — October 13, 2026

- Staged test scripts/check-graphics-stress-control.cjs failure investigated and resolved:
  - combatStep input dead zone reduced from >5px to >1px: previously waypoints within 5px of obstacles generated zero keyboard input, trapping player movement in combat loop (observed in historical stress at nearest=258.4).
  - Fixture coordinates in check-graphics-stress-control.cjs aligned with grid to x in [34..36], y in [264..266], finding deterministically reachable waypoints within old dead zone (dx <= 5, dy <= 5, hypot > 1).
  - Added --disable-gpu to headless Chrome launcher arguments in scripts/check-graphics-stress.cjs, matching check-campaign.cjs and check-browser.cjs. Subsequent short smokes completed; no crash log establishes D3D11 reset as the cause, no controlled comparison proves this flag fixes disconnects, and these runs do not validate hardware GPU performance.
  - Skill and dodge input cadences tightened to every 32 iterations when within 150px melee distance. The nominal delay alone totals 4.8s; CDP/input/observation overhead makes actual cadence longer. Actual accepted action counts remain the gate.
- Suite check-graphics-stress-control.cjs passes 100% (fixture, metrics, active elapsed, scene coverage, actual input cleanup).
- Full suite npm run check:all passes 100% across all 20 test suites, producing fresh production bundle dist/assets/index-CdV_jToi.js (194d5a8fbe2323cb902d6236f6b89a3c41156988bcbfee9b5492523727d996d6), served on port 4187.
- Smoke stress verification executed on fresh bundle (artifacts/graphics-stress-smoke-cdv/report.json):
  - verdict: "SMOKE", elapsedMs: 143112.64 (~2.4 min), continuous: true, errors: 0, assetFailures: 0, failures: 0.
  - Low preset: activeMs: 20018.2, hits: 27, incomingDamage: 172, skills: 4, basics: 31, dodges: 4, transitions: 4.
  - Medium preset: activeMs: 20097.4, hits: 21, incomingDamage: 204, skills: 4, basics: 28, dodges: 4, transitions: 4.
  - High preset: activeMs: 20047.4, hits: 27, incomingDamage: 117, skills: 5, basics: 36, dodges: 5, transitions: 4.
  - Total transitions: 12 (meets >= 10 requirement).
- Full 30-minute endurance remains required under the autonomous directive; short SMOKE receipts do not replace it. Graphics 1.0 remains OPEN (Gates 1-5, physical device testing, Stage B/C/D world art).

### Touch sizing and reduced-motion source repair — October 13, 2026

- Three independent source REDs reproduced: R/T/F radius32 gives42.67CSSpx at the target640x360landscape; feedback creates seven extra tweens despite reduced motion; button feedback scales the interactive circle below its base44CSSpx target. Minimum fix in src/game/ui/TouchControls.ts: three radii33, live app/OS reduced-motion guard after unchanged action callbacks, text-only feedback tween so circle hit targets never shrink. Joystick, positions, seven action mappings and enabled gate remain unchanged.
- Focused command node scripts/check-graphics.cjs --touch-only exits0 after these fixes. Tests cover all seven targets, normal feedback, live app/OS preference combinations, continuing actions under reduced motion, disabled actions and circle target exclusion from tweens. Source/check hashes and RED/GREEN evidence: artifacts/graphics-qa/2026-10-13/touch-controls-source-red-green.json. Base sizing proof assumes available landscape canvas dimensions>=640x360; no smaller/portrait/device guarantee.
- The source patch is not included in the historical DAgfL7dU served bundle. No build/full compiler/browser run during exclusive stress; source input snapshot now also differs in TouchControls.ts. Preserve active measured harness and old dist; fresh source build/full checks plus640x360/844x390browser interactions are PENDING after stress settlement. Byte-pin/signal-cleanup controls remain intentionally RED until that measured runtime file can be patched.

### Queued checker repair and source drift — October 13, 2026

- New independent RED controls are staged in scripts/check-graphics-stress-control.cjs. Missing browserBundleSha256 currently returns PASS instead of FAILED at line22; coordinator reproduced exit1. Matching-hash fixture, mismatching/absent browser hashes, exact paused-script source verification before observer access, and signal-terminated profile cleanup regressions are present. The asynchronous regressions are not yet executed because the first RED stops the suite. No claim that current check:all is GREEN after these staged controls.
- Runtime harness remains unchanged while original stress PID203552 is live. Process start is 2026-10-13 05:48:34 Asia/Saigon; fresh observation at06:06:34 confirmed CPU activity and no final report. No duplicate browser/measurement, cancellation, build or runtime-harness edit was performed. After positive terminal proof, hash the exact paused browser-executed script before obtaining observer references, require equality in verdict, recognize signalCode during owned cleanup, then run RED/GREEN controls and a separately identified smoke measurement.
- Current source no longer equals the equipment candidate snapshot: MenuScene.ts, GameState.ts and Hud.ts changed independently after the earlier139/139 equality check. Current served DAgfL7dU still matches125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69. Preserve others' edits; current campaign/stress receipts apply only to that frozen bundle, not the newer source. A distinct post-measurement build and acceptance record are required.
- Source/dist hashes for all74delivered PNGs still match the candidate texture inventory; six current editable generator hashes independently recorded in artifacts/graphics-qa/2026-10-13/generator-source-provenance-DAgfL7dU.json and ASSET_LICENSES.md. Contributor rights, premium artistic approval and device/performance gates remain OPEN.

### Independent continuation audit — October 13, 2026

- Current equipment candidate independently revalidated: all 139 recorded input hashes match disk; HTTP200 production entry remains index-DAgfL7dU.js; served bytes hash to 125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69. This is checkpoint equality, not continuous browser-response provenance.
- Both candidate campaign receipts independently inspected: four chapters/four defeated bosses, 32 distinct completed and rewarded quests, three naturally entered/rewarded dungeons covering nine floors, and save/reload. There are 31 reward transactions, not 31 quests: a transaction can claim multiple quests. Normal receipt is unboosted/uninstrumented; coverage receipt is unboosted/instrumented. Evidence: artifacts/campaign-snapshots/index-DAgfL7dU/campaign-acceptance.json and campaign-coverage-acceptance.json.
- Combined mapped coverage reports 9,597/11,052 observed source lines (86.83%) and 674/813 observed mapped V8 functions (82.90%). No unmapped sources or missing sourcesContent reported. This denominator excludes unobserved/tree-shaken/type-only code; not conventional branch coverage, full-repository coverage, or independent proof of the ECC 80% requirement. Evidence: artifacts/coverage-DAgfL7dU/combined-source-coverage.json.
- Sustained stress is an existing live measurement, not restarted here: PID203552, started 2026-10-13 05:48:34 Asia/Saigon, output artifacts/graphics-qa/2026-10-13/stress-30-current. No final report existed at this checkpoint; all results remain PENDING. Preserve candidate and measured harness while that exact process is live. Do not infer completion from elapsed wall time or output-directory existence.
- Independent static review found three acceptance limits: stress verdict requires positive frames but does not gate frame-time or heap-growth budgets; before/after endpoint fetch hashes do not verify browser-executed response bytes; non-Windows signal-terminated Chrome can retain exitCode=null and be misclassified as alive during cleanup. Incoming-damage gating is present in both verdict and combat loop. Current Windows measurement must not be edited/restarted for these findings; after settlement, bind actual browser-loaded bytes and correct signal-exit cleanup with RED/GREEN controls. A stress PASS can establish only the declared seeded endurance/input coverage, never Gate5 device/GPU/performance or absence of leaks.
- Equipment02 receipt remains PASS without runtime/asset errors. Existing hero-equipped-idle capture inspected: world armor/charm are visible; a single idle image does not close action timing, premium artistic approval, all-scene readability, or physical-device gates. No game source, asset, measured harness, or production bundle changed during this audit.

### Equipment candidate freeze — October 13, 2026

- Candidate index-DAgfL7dU.js, SHA256125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69, served HTTP200 on4187 with identical disk/served bytes. npm run check:all session27564 exited0 after integration RED exposed the scene-preload mock missing equipmentArtwork; one-line real module dependency restored GREEN. No game-source changes after this build. Manifest: artifacts/graphics-qa/2026-10-13/candidate-DAgfL7dU.json.
- Independent source review accepted weapon texture+directional animation+all-frame fallback, safe no-write omission, equipment frame/transform/order and lifecycle invariants. Coordinator16player groups, sprites, graphics, scene presentation, stress controls and mapper/browser pure controls PASS. Real equipment/browser fixtures, natural campaign/coverage rerun and long stress still PENDING on this candidate.
- Current74PNG assets total796,377compressed bytes; largest edge2016px; all74source/dist PNGs match. Hypothetical base RGBA8 storage69,015,552bytes (65.82MiB), NOT actual GPU residency/upload/mipmaps/device/leak proof. Inventory: artifacts/graphics-qa/2026-10-13/texture-memory-inventory-DAgfL7dU.json. Historical68PNG/D71 receipts below remain unchanged.
- Freeze applies only to this equipment integration checkpoint; full graphics master-prompt work remains IN PROGRESS. Physical-device/GPU, premium-art/legal approval and outstanding scene/combat/accessibility work are not closed by this build.
- Equipment browser02 exited0/PASS on unchanged DAgfL7dU: six legitimate equipped/unequipped save fixtures for hero/axe/sword,36real WASD/basic/dodge actions,262observations and42screenshots; actual canonical pose frames advance, overlays match current frames/transforms and relative child order; six PNG responses200, no runtime/asset errors. Owned Chrome160048 exited0 and exact profile removed. Idle sword and axe attack captures inspected; NOT artist/device/GPU acceptance. Receipt: artifacts/graphics-qa/2026-10-13/equipment-browser-02/report.json.
- Browser01 FAILED a checker-only adjacent-order assumption: legitimate name-label child separates hero from fitted overlays. Relative hero/armor/charm ordering is the real invariant; RED/GREEN corrected without game-source changes. Browser-checker review also required exact canonical animation/frame membership and at least two advancing action frames; pure negatives now reject frozen/wrong frames. Historic browser01 receipt retained; Chrome166360 exited/profile removed. Latest pure controls passed after these checker-only edits; original check:all27564 predates them, candidate game bundle unchanged.
- Existing browser fixture session43010 exited0/PASS on DAgfL7dU: graphics/audio settings reload, mobile overflow/touchR, RPG pagination/NPC quests/water skill/save cooldown, three weapon shops, all three funded dungeons and prior-area revisit. Equipment02 images/receipt were independently cross-reviewed by gameplay coordinator: all36actions advance at least two canonical frames within the same exact animation; no actionable findings. Coordinator Chrome profiles/PIDs are gone. Candidate handed off for serial natural campaign/coverage rerun; exclusive long stress not started.

### Sustained stress preflight checkpoint — October 13, 2026

- Smoke06 exited0 with SMOKE: elapsed327.291s; Low45.230s/40hits/333incoming damage, Medium47.118s/43hits/287incoming damage, High70.457s/59hits/658incoming damage; each preset recorded at least3actual basics/skills/dodges and four actual portal transitions (12total). No fatal runtime/network/asset errors, continuous page, matching frozen bundle and measured harness hashes. Owned Chrome136524 exited; its exact temporary profile is absent. Evidence: artifacts/graphics-qa/2026-10-13/stress-smoke-06/report.json. This is NOT the required30-minute acceptance.
- Final stress review identified missing incomingDamage acceptance gating. Coordinator RED proved an absent metric incorrectly returned PASS; GREEN now requires finite positive incomingDamage and keeps combat running until observed. Smoke06 already contains positive incoming damage in all presets, but its historical harness hash remains unchanged; the corrected source awaits independent review and full runtime measurement.
- Equipment integration worker settled; coordinator check-player-status (12groups) and tsc --noEmit PASS. Armor/charm children mirror hero frames/transforms with canonical weapon sheets and idempotent cleanup. Independent source review pending; frozen D71 does not include this integration. Gameplay explicitly released its exclusive coverage CPU/browser window; long stress now waits only for final source-review settlement. Historical HOLD/active notes below describe earlier checkpoints.
- Subsequent coordination decision supersedes the planned D71 long run: settle equipment/partial-weapon fallback, build one new candidate, run real equipment/browser fixtures, rerun natural campaign/coverage on that exact candidate, then exclusive long stress. D71 campaign/SMOKE remain historical-only evidence for the prior snapshot. This candidate freeze does not close the full master-prompt premium-art/device/accessibility/other-scene obligations.
- Stress now accepts an explicit STRESS_BUNDLE_SHA256 pin (lowercase64), checks served bytes before Chrome launch, and still checks entry/bundle/harness stability after measurement. Default pin remains D71 for historical baseline; coordinator must provide the new candidate hash. Runnable controls cover missing/nonfinite/nonpositive incoming damage both in verdict and combat loop. Coverage mapper selfcheck is registered in check:campaign-control.

- Frozen D71EOpKB is served on coordinator-owned4187; served and disk SHA256501549219ba7dd50b84d0d7c6c9e77da416ca2ad23e628acd8e9402646749bd6 match. No shared build/game-source change for this preflight. Graphics1.0 remains IN PROGRESS.
- Smoke01 FAILED before measurement: missing fixture version1 caused canonical save normalization to use defaults. Smoke02 FAILED during genuine native loading with no active scene. Exact automatic favicon404 is recorded separately as a known baseline warning; all other runtime/network/asset errors remain fatal. Both failures retained under artifacts/graphics-qa/2026-10-13/stress-smoke-01 and stress-smoke-02.
- Smoke03 FAILED at bounded301.768s deadline: Low20.052s and Medium10.282s active, High0s; runtime errors/game-asset failures empty. Positive actual attack/skill/dodge/hit and portal evidence is partial, not a30-minute pass. Owned Chrome93848 exited and temp profile removed. Distant enemies were the main excluded samples; active-time gates were not weakened.
- Coordinator RED/GREEN fixes enforce4187, version1 canonical normalization, requested versus actual normalized fixture, finite positive rAF intervals, strict continuous/duration/hash/metric guards and inactive loading. Combat controller now holds real WASD through its attack cycle, limits skill/dodge inputs to nearby enemies and releases keys on error; focused controls PASS. Smoke04 and independent corrected-source review are pending.
- Long metrics remain HOLD until gameplay-owned instrumented coverage Chrome/CPU window closes explicitly. Concurrent short smoke validates controls only; rAF scheduling/heap samples are not native GPU FPS, device acceptance, leak absence or premium-art approval.
- Fitted canonical bamboo-armor/jade-charm asset worker is settled: six2016x336RGBA8 overlays,1632frames,51,183fitted pixels, deterministic regeneration and exact transparent/body/face/weapon masks checked. Coordinator reran check-equipment and inspected equipment-before-after.png: actual lamellar vest/body charm, not UI stickers. Runtime integration is separately active; no current browser/device/premium-art acceptance for these additions. Frozen D71 does not include them.

### Natural full-campaign acceptance — October 13, 2026

- Gameplay-owned6239 terminal exit0 on frozen D71EOpKB; current artifacts/campaign-acceptance.json independently audited against canonical quests.ts and bundle bytes:32exact quest IDs completed/reward-claimed, four chapters/boss flags, three naturally keyed dungeons/nine floors/rewards, unboosted/input-driven/save-reload flags and matching SHA256.
- Independently checked every receipt against authored reward data:31batches contain35quest payouts/32unique IDs, including legacy hunt reward once per chapter; each gold/XP/item aggregate is exact. Gameplay harness verified actual save hydration with only documented playtime second rounding.
- Ending screenshot artifacts/campaign-ending.png inspected: final text/credits/menu visible. Receipt elapsed611.992s, active playtime596.824793s, level38/gold8073/deaths0. This proves one automated unboosted route, NOT human3–5h pacing, death recovery runtime, graphics premium quality, mobile or sustained performance. Latest marker transient guards were focused-tested after this successful run; they are not retrospectively runtime-proven.
- No owned campaign Chrome survivors were reported at this campaign settlement. Later graphics stress preflight uses its own4187 preview/Chrome; see current checkpoint above. Measured30minute stress has NOT run or passed. Full graphics overhaul remains IN PROGRESS.

### Texture inventory checkpoint — October 13, 2026

- Inventory snapshot before equipment additions:68PNG assets,760,063compressed bytes, largest edge2016px; all68inventoried PNGs equal their frozen D71EOpKB dist counterparts byte-for-byte. At hypothetical RGBA8 base level these dimensions total52,758,528bytes (50.31MiB), including31,303,680sprite bytes and16,908,288enemy-atlas bytes. New six equipment overlays are outside this snapshot and frozen build.
- This is NOT GPU residency, upload timing, device capability or memory-leak proof. Driver copies/mipmaps/runtime canvases and which textures are actually uploaded remain unmeasured. Small download size must not be confused with small GPU footprint. Asset-group totals, largest atlases and manifest hash: artifacts/graphics-qa/2026-10-13/texture-memory-inventory.json.
- Continuous graphics stress preflight remains active; no30-minute run/PASS yet. Natural campaign6239 is now independently accepted as recorded above; the original inventory checkpoint preceded its receipt. No game-source changes or rebuild during the frozen campaign snapshot.

### Fade/status acceptance checkpoint — October 13, 2026

- Three native fade lifecycle defects corrected through RED/GREEN: synchronous cancellation assignment, forced foreign-fade ownership, stale cleanup erasing a replacement preload cycle. Final cleanup is idempotent and identity-guarded; native Phaser Fade/EventEmitter regressions and coordinator review PASS. No native method patch, gameplay timer, input or scene-authority changes. Entry remains120ms/at most12% alpha.
- Static persistent shield polygon follows actual Player shieldRemainingMs; canonical stone-armor remains6000ms. Distinct double-ring compatibility follows existing skillInvulnerabilityMs but no canonical skill currently grants it. No invented dash/heal buff, no added status tween/timer; recast/expiry/position/depth/pause/death/shutdown checks PASS. Independent read-only status review reports no HIGH/MEDIUM findings.
- npm run check:all session63919 exit0, including registered seven-group check:player-status and all previous checks. Frozen shared build index-D71EOpKB.js, SHA256501549219ba7dd50b84d0d7c6c9e77da416ca2ad23e628acd8e9402646749bd6;1,665.60kB JS/gzip447.93kB, large-chunk warning retained.
- Seeded native browser72585 exit0 on4187: actual shield cost/cooldown assertions passed and shield-active/moved/expired captures inspected: polygon tracks hero then vanishes. Extended settings/UI/input/asset/dungeon/revisit/reload checks also PASS. Owned Chrome closed by harness. Evidence/source/capture hashes: artifacts/graphics-qa/2026-10-13/fade-shield-evidence.json.
- Gameplay coordinator reports campaign50578 terminated exit1 after unhandled player death in the marker-navigation harness, not a proven game bug. Marker death/retry source regression passed; fresh natural6239 now runs against the same frozen bundle. Full campaign remains PENDING. Neither graphics1.0/device/stress/legal/accessibility gates nor full campaign are declared PASS. Historical snapshots below retain their own proof limits.
- This source-wave workers settled/released; reclaimable worker list is empty. Earlier AGY ctx_d1d6b56f3f4a remains release_unknown after fresh retry: recorded terminal no longer resolves, process closure unproven. Three previously user-owned retained resources remain untouched. Owned4187 preview stopped; graphics Chrome survivor query returned none.

### Resume checkpoint — October 13, 2026

- Gameplay coordinator reports natural session53606 crossed all four chapters, 32 quest reward flags, four bosses, three dungeons/nine floors, exact authored payouts and Ending. Terminal exit1: reload comparison differed only by documented playtimeSeconds rounding (551.9263433331638 to552). Corrected harness needs a fresh full run; no campaign PASS artifact yet. These are coordinator-reported gates, not independent graphics campaign acceptance.
- Dist hold explicitly released after53606 terminated. Next shared build waits for fade-lifecycle and persistent-player-status source settlement/review; previous CHXA1yNw browser receipts remain historical and do not prove those pending changes.
- Fresh focused UI/local-atmosphere/combat-VFX checks and git diff --check PASS at this checkpoint. Physical devices, visual approval, full accessibility, 30-minute stress and graphics1.0 remain OPEN.

### Shared portal/loading snapshot — October 13, 2026

- Explicit campaign hold release authorized shared build after natural P0 evidence: returning from chapter1Dungeon left reused Forest scene data atchapter1 after save advanced chapter2. Village portal now passes current chapter explicitly; actual-update regression reproduced RED then GREEN forchapters2/3/4. Natural full-campaign acceptance remains separate.
- npm run check:all PASS on shared index-CHXA1yNw.js (1,664.16kB JS/gzip447.51kB; large-chunk warning). Includes build/typecheck, save/RPG/content/audio/menu, graphics/sprites/NPC/enemies/environments/icons/VFX/local-atmosphere/UI/scene-presentation and focused campaign-control/navigation/dungeon/reward helpers. Heavy check:campaign is registered but NOT automatically run by check:all.
- Extended browser PASS on this shared bundle: icons/authored HTTP200, settings/input/equip/save/revisit and seeded dungeon2/3/4floors; native network-throttled loading panel screenshot inspected, then panel completed and village interaction continued. Screenshot/profile root artifacts/graphics-qa/2026-10-13/shared-final/. Preview4187 and owned Chrome stopped after validation.
- Native world preload panel and entryFade are bounded120ms/12% opacity and use actual Phaser Fade tests; cached/pending/late-queued/scene reuse/cleanup/reduced-motion/Low checks PASS. Menu/Victory/Ending transition coverage remains outside this slice.
- Independent read-only review then reproduced twoMEDIUM race/ownership defects: synchronous fade-start reduced-motion cleanup can precede cancellation assignment; forced replacement fade can be modified/reset by entry presentation. Source-only followup dispatched, NOT resolved/accepted yet. Shared bundle held unchanged for natural53606; its fullcheck/browser evidence does not cover future source corrections.
- SHA256 shared JS: c5dd9b3ef7becb73fc2c2ed14a564b6ef0467f2847c7be93cb02d146e083c031. Complete premium graphics1.0, physical devices, stress30minute, full UI access/armor/status presentation and legal/art approval remain OPEN.

### UI branches and atmosphere review settlement — October 13, 2026

- Native equipped spear/axe/sword previews and earth/flame/water branch nodes/connections implemented without new progression prerequisites. Header/title and passive-card overlap corrected; passive summaries derive actual data. Existing equip/unlock/action coordinates preserved. Armor/accessory world layers remain missing, explicitly disclosed rather than claimed complete.
- Read-only UI review found stale tooltip on menu replacement and22px node target. Regression now exercises actual tooltip callbacks, menu replacement destruction, exact canonical9frames and native50×50hit areas with50px node spacing. Existing small visible node art retained. Focused VM, noEmit and native hover/tab-switch captures PASS. Physical touch and keyboard/screen-reader node navigation remain unproven.
- Two atmosphere MEDIUM findings reproduced RED: application setters left28generic/local tweens atLow, repaint retained old static art. Shared settings subscription and owned static-object teardown now GREEN;30region/quality/motion combinations plus real setters, failed persistence, invalid input, unrelated-object preservation, native media preference and shutdown/repaint checks PASS. Generic/local caps remain separately measured; no claim of device FPS.
- Isolated build index-Bvn4PVWq.js:1,662.25kB JS/gzip446.87kB; large-chunk warning remains. Fresh extended browser regression PASS, icons HTTP200, all authored sheets loaded, settings/mobile/input/equip/seeded dungeon/revisit/save checks PASS. New screenshots in artifacts/graphics-qa/2026-10-13/current-ui-final/ and native-ui-focus/ show header/card fixes, tooltip teardown and all three equipped previews. This snapshot predates the active world-loader/entry-transition slice.
- Shared dist/index-BrXQkeHs.js remains campaign-owned; source validation uses dedicated temporary outDir/4187 only. Full npm run check:all not rerun because its build would overwrite that held snapshot; standalone graphics/UI/atmosphere checks and isolated build are distinct evidence.
- Active loading/entry-transition worker: ctx_f963329d63ec, initially turn_start_unobserved with unsent composer; exact Enter-only recovery confirmed live working. No new source acceptance claimed until settlement. UI followup review ctx_4236a1f4097e resolved both findings, verified native Phaser hit-area coordinates and canonical frames; worker settled/released. Earlier AGY cleanup ctx_d1d6b56f3f4a remains release_unknown after runtime restart; no broad terminal close or claim of process exit.
- Full section19/21 overhaul remains OPEN: premium artistic approval, complete visual armor/accessory/upgrade states, persistent skill/status cues, moving-dash trails, controlled hit-stop, full UI accessibility, transition coverage, native desktop/Android/iOS performance/stress/30minute evidence, and contributor/legal sign-off are not established by these checks.

### Combat VFX and canonical icons — October 12, 2026

- Coordinator independently verified eight CombatSystem VM groups: distinct spear/axe/sword geometry, canonical twelve-skill silhouettes, four area elements, authoritative range/lane geometry, quality/reduced-motion budgets, lifetime/shutdown cleanup, real positive melee/skill damage and status authority. Oversized skillEffect reproduced RED, extracted into area/directional/self helpers, GREEN with every CombatSystem method below50lines. No gameplay balance changes.
- Independent read-only review confirmed MEDIUM melee hitbox/streak mismatch. Positive-damage regression reproduced RED across real weapon fixtures; faint authoritative cone outline now matches unchanged damage threshold/range while preserving distinct weapon streaks. GREEN checks include all three weapons/combos, enemy/boss hits and misses outside the sector. Browser visibility of that outline remains pending.
- Original32px atlas: nine item icons + twelve skill icons,160×160px,3,476bytes; SHA256 aa276b2ae00035f65d5d752fc78dca22b0dcf591bb7418cc653fd338eb664031. CRC/transparency/gutters/distinct silhouettes/canonical frozen maps/idempotent loader/retry/deterministic regeneration PASS. Village inventory/equipment/skills/shop/crafting bind canonical IDs with missing-texture fallback.
- Fresh noEmit typecheck, check:graphics, check:sprites and git diff --check PASS. Focused VFX/icon/UI/atmosphere gates are wired into check:all; that full command has NOT been rerun on this snapshot because its build would overwrite campaign-owned dist. Subsequent October13 review/validation supersedes these historical pending states.
- Campaign coordinator holds production dist index-164OzDIt.js. Current source validation does not overwrite that build. Fresh browser capture/readability and integrated build remain pending; earlier browser screenshots do not prove current icons/VFX.
- Regional local-light/water/foliage implementation newly dispatched, not accepted. Equipment preview, actual skill-tree nodes/connections, persistent status cues, moving-dash trails, controlled hit-stop, native-device/FPS/30minute/premium/legal gates remain OPEN.


### Enemy/environment runtime slice — October 12, 2026

- Settled producers: sixteen canonical enemy sheets (twelve common48px, four elite64px), 1,536 frames, 188,470 PNG bytes; five authored region kits, ten sheets, 80 terrain/prop frames. Runtime binds canonical IDs/aliases rather than role-family reskins; size/feet align with shadows.
- Five region painters and three dungeons now use authored terrain/props with procedural missing-texture fallbacks. Existing collision arrays/portal geometry/gameplay preserved; prop ground depth matches actor occlusion contract. Contact sheets inspected; no premium artistic acceptance implied.
- Production build `index-BrXQkeHs.js` PASS; JS1,653.02 kB/gzip443.37 kB warning. Browser PASS with all sixteen enemy/ten environment PNG requests HTTP200 plus NPC/weapon/dungeon/settings regression. This snapshot predates subsequent terrain/label/cache and VFX/icon changes; final combined build/browser remains pending.
- Live village capture showed excessive floor contrast. RED pixel assertion followed by lower-contrast ground/path regeneration: environment PNGs now31,208bytes, exact hashes in `enemy-environment-evidence.json`. Review P2 dungeon labels below terrain reproduced by actual mocked create, fixed with explicit label/click-target depths. Cached base atlas reloads now skipped; focused graphics/sprites GREEN.
- VFX and icon producers active on disjoint paths. Full graphics1.0, whole-game80% coverage, hardware/mobile/FPS/30-minute stability and legal/art approval remain OPEN.

### NPC integration and review fixes — October 12, 2026

- Fifteen canonical NPC identities, 120 idle/dialogue sprite frames and fifteen 96px portraits: 30 PNGs, 24,919 encoded bytes. Exact dimensions/SHA256 in `artifacts/graphics-qa/2026-10-12/npc-manifest-evidence.json`; portrait contact sheet and live chief dialogue manually inspected. Region backgrounds still procedural; no premium artistic approval implied.
- `npm run check:all`: PASS after NPC integration, including new `check:npcs`, typecheck/build and existing gameplay suites. Bundle 1,649.04 kB JS / 441.76 kB gzip warning remains. Whole-game coverage not measured.
- Production `npm run check:browser`: fresh PASS, all 30 NPC PNGs HTTP200, live chief portrait capture plus previous weapon/dungeon/settings regressions. First attempt failed seeded-shop purchase; unchanged rerun passed. Fixed-delay browser fixture reliability remains an open limitation, not silently accepted as deterministic proof.
- Read-only reviewer HIGH locked-telegraph impact defect reproduced RED (boss damages target behind its warning), fixed by preserving warning direction/origin through hitbox and impact pose, then clearing it. Four boss fixtures now verify misses behind and hits inside warned areas. MEDIUM NPC infinite dialogue fixed with finite action animation; service portraits now use stable NPC IDs rather than display titles. Dead menu-entry guard also verified.
- NPC/reviewer dispatches settled and released. Separate enemy artwork and followup review dispatched; startup observation initially unknown, not completion or evidence of process exit. Full section19/21 graphics acceptance remains OPEN.

### Latest coordinator validation — weapon/boss slice, October 12, 2026

- `npm run check:all`: PASS after boss sprite task settlement; typecheck/build/save/RPG/boss/quest/dungeon/content/audio/world/enemy AI/RPG menu/graphics/sprites. Bundle warning persists: 1,640.96 kB JS, 439.61 kB gzip. An earlier in-flight sprite-check ReferenceError was reported to its owner, corrected, and rerun; not accepted as PASS.
- `npm run check:browser`: PASS production preview on 127.0.0.1:4186. Eleven sprite PNGs HTTP200; native Tab/modal wrap/inert/background/mobile bounds/settings persistence; actual three-weapon purchases/equips/attack captures; NPC quest/skill regressions; funded fixtures completed all combat floors/elite/reward for the three dungeons. Fixtures do not prove natural campaign pacing or a full unseeded playthrough.
- 1,692 distinct frames, eleven sheets, all dimensions ≤2048; exact measurements/hashes in `artifacts/graphics-qa/2026-10-12/sprite-manifest-evidence-v2.json`. Boss contact sheet and chapter-2 live screenshot manually inspected: distinct pixel-art boss replacing procedural circle. Three weapon screenshots added. No premium art approval implied.
- Death save/delay ordering, dead Player action/world pointer lockout, lethal-tick portal bypass, all Boss ID bindings/telegraph facing and hurt/death priorities checked with executable VM assertions. Review HIGH portal bypass and MEDIUM pointer bypass resolved RED/GREEN.
- Updated bounded profile: four one-second headless/disable-gpu samples, about 60 rAF/s, p95 16.7–16.8ms, JS heap 19.0–36.4MB. Not native FPS, GPU budget, mobile or 30-minute stability. GraphicsSettings-only coverage remains 96.23%; whole-game 80% coverage not measured.
- NPC art worker active; its outputs and current Village integration await settlement/build/browser. Current technical foundation is accepted only within these boundaries; full graphics 1.0 remains NOT ACCEPTED. Earlier worker tables/six-sheet counts below are historical.

**Coordinator refresh, October 12, 2026:** foundation delivered, full graphics 1.0 remains NOT ACCEPTED. All three dispatched tasks settled; documentation/review terminals released, sprite terminal retained by Orca user-ownership boundary. Original dirty worktree preserved; no commit, push, install, paid generation or deployment.

- Six transparent directional sheets: 752 distinct frames; PNG CRC/dimensions/transparency/frame ranges/registration/Player and Enemy priority tests PASS. Spider duplicate-frame regression resolved.
- Graphics self-check: settings corruption/blocked storage/immutability/presets, live OS reduced-motion changes, atmosphere teardown, slash-local coordinates and superseded-toast cleanup PASS. V8 precise coverage for GraphicsSettings only: 51/53 lines (96.23%), 10/10 functions; artifacts/graphics-qa/2026-10-12/graphics-settings-coverage.json. Not whole-game coverage.
- Rendering fixes: roundPixels, contextual quest labels, HP/MP values, non-overlapping boss HUD, local-origin slash scaling, one live toast. Low/Medium/High budgets retain essential attack geometry and warnings.
- Review findings addressed: native Tab navigation, modal wrap in both directions, inert background, visible screen-reader navigation focus, OS motion changes during a scene, all camera-shake gates.
- Runtime evidence and exact final command results are appended after the final coordinator browser run. Earlier worker evidence below is historical and does not override the settled refresh.

October 12, 2026: **graphics 1.0 NOT ACCEPTED**. This documentation worker performed read-only source/disk inspection, previewed hero/Hổ PNGs and ran focused checks listed below. No game browser screenshots/video, real-device run, FPS, frame-time, heap or GPU metric collected here. Existing QA_REPORT.md records earlier checks; those do not become newly verified results. Source/procedural foundations and concepts are not final assets.

| Check actually run by documentation worker | Result / proof boundary |
|---|---|
| npm run check:graphics | PASS: settings validation/storage/immutability/preset/reduced-motion budgets, not rendered scene performance |
| node scripts/check-sprites.cjs | Initial four-sheet PASS; latest six-sheet rerun FAIL: spider duplicate poses/directions, 92 distinct hashes versus 96 expected, scripts/check-sprites.cjs:56. Escalated to coordinator/sprite owner; no source fix by this worker |
| node node_modules/typescript/bin/tsc --noEmit | PASS: current source typecheck; no production bundle generated by this worker |
| git diff --check scoped to nine owned markdown paths | PASS for tracked diff; untracked documents separately checked below |
| Node assert documentation check | PASS: nine headers/UTF-8/whitespace/nonempty specs, all phases 0–9, five gates, local markdown references |

Latest source/disk refresh independently measured 560 physical frames in four directional sheets (hero 272, creatures 96 each), 109,748 encoded bytes, plus spriteManifest.ts and directional Player/Enemy callers. This supersedes the historical four-frame baseline; it does not close victory playback, dedicated Boss animation, equipment visuals, other content or device gates. Source was changing concurrently; coordinator must verify settled revision before accepting.

Coordinator reported build/graphics-check PASS for preset foundation; settings and atmosphere source independently inspected here. Actual presets: Low/Medium/High ambient 0/10/24, sparks 1/4/8; reduced motion/OS preference zeroes both and disables shake budget. Latest source search found eleven shake call sites guarded by cameraShake across Player, Enemy, Boss, BossSystem, ForestScene and CombatSystem; this is static evidence, **not runtime proof of all camera/motion behavior**. UI says settings apply next play session; verify entry/reload behavior. Sprite worker output remains subject to inventory refresh and state-call-site review.

## Findings and priority

### Latest coordinator evidence, separately attributed

Coordinator reports desktop/mobile-emulated settings save/reload/overflow and keyboard Tab/focus trap checks PASS, graphics/build checks PASS, four seeded boss fixtures captured; final browser rerun after latest HUD spacing/sprite edits remains pending. Coordinator reports fixes for dialog focus/inert background, screen-reader clipping and runtime OS reduced-motion atmosphere transitions, with Atmosphere mock self-check PASS. These are reported integration checks, not this worker's browser run and not real Android/iOS or art-quality approval.

Artifact files independently found on disk under `artifacts/graphics-qa/2026-10-12/`: settings-desktop.png, settings-mobile.png, menu-desktop.png, village-desktop.png, village-mobile.png, chapter-1-boss-fixture.png, chapter-2-boss-fixture.png, chapter-3-boss-fixture.png, chapter-4-boss-fixture.png. This worker inspected chapter-2 fixture image: procedural circular serpent body, labelled circular quest markers and overlapping top text are visible in that capture. It predates final HUD spacing change; require replacement capture rather than assume current UI still has that defect. Seeded boss screenshots are not full-campaign/phase/animation evidence.

Latest six-sheet extension source/disk verified: wolf/spider 96 frames each, total 752 frames; role-family charge/ambush now use raster sheets. NpcRoster source now selects chapter-dependent catalog NPCs as procedural village actors; QuestInteractions creates labelled objective markers, not authored dungeon maps. Update acceptance against current settled source; initial findings below remain historical baselines where stated.

| ID / priority | Source evidence | Remaining task / acceptance |
|---|---|---|
| GFX-01 high | Initial four-frame sheets superseded by 560 directional frames and manifest, measured later in this audit | Review all state/feet/lifetime bindings and actual gameplay; no browser approval, victory/boss playback gaps remain |
| GFX-02 high | Boss.ts binds raster only for Hổ; other bodies procedural | Three distinct boss sheets, all attack/phase/death animations; recorded encounter proof |
| GFX-03 high | Latest Enemy.ts shares Mộc/Ma/wolf/spider sheets by four roles | Twelve common/four elite identities, per-ID bindings and gameplay spawn proof |
| GFX-04 high | Initial three NPCs now expanded by chapter-dependent NpcRoster, all primitive actors | Fifteen final sprites/portraits, intended placement and every interaction proof |
| GFX-05 high | art.ts paints five regions using Graphics; dungeons only catalog | Authored regional/dungeon kits, real routes, collision/depth review; no important placeholder |
| GFX-06 high | Player now calls attack1/2/3 directional poses; no equipped weapon layers found | Three actual equipped world weapons and distinct reach/timing/trails; pose registration alone insufficient |
| GFX-07 medium | Skills use common area/line effects; item/portrait/atlas exports absent initially | Twelve skill presentations, all current item icons, coherent panels/tree and atlas metadata |
| GFX-08 high | No current graphics-specific device/profile evidence | Capture desktop/Android/iOS, presets, stress, transitions, memory and 30-minute stability |
| GFX-09 medium | FIT scaling; no explicit follow/bounds/roundPixels initially | Pixel shimmer/bleed/anchor/mobile safe-area review; expanded-map camera tests |
| GFX-10 resolved | Intermediate spider distinct-frame assertion failed 92 !== 96 | Sprite owner fixed poses; coordinator final six-sheet self-check PASS. Artistic approval remains separate |

No source changed to fix these findings in this task. Gameplay owner must resolve catalog-only integration dependencies; art cannot manufacture a playable route through a concept image.

## Section 19 — Complete Definition of Done matrix

All rows remain OPEN unless specific dated evidence is recorded. PARTIAL means source foundation, not passed acceptance.

| Group / exact obligation | Present evidence | Required remaining evidence |
|---|---|---|
| Character: complete hero sprite, primary animation, distinct weapon groups, no frame alignment errors | Four-frame historical sheet; Player/weapon data bindings | Full action/facing/weapon playthrough, stable feet/contact sheets, no frame jumps |
| Enemies/Bosses: sprites/animations, unique bosses, matching attack effects, clear phases | Roster/role/boss attack/phase code; reused sheets/primitive bodies | Every common/elite plus four bosses, all attacks/two phases/deaths; unique silhouettes and warnings |
| Environment: cohesive areas, no important placeholder maps, collision/depth correct, unique atmosphere | Five procedural painters/barrier configs and coordinator fixture screenshots | Authored five-region/three-dungeon walkthroughs; markers are not dungeon maps; front/back occlusion and unobstructed portals |
| Combat VFX: combo slash, clear hit, skills, damage feedback, no important occlusion | Graphics arcs/shockwave/text/telegraphs source | Weapon/skill-specific footage, dense combat, exact contact/direction/geometry, HUD/touch visibility |
| UI: consistent main screens, mobile usable, Vietnamese glyphs, no severe overflow, readable important info | Existing canvas/DOM panels and controls | Every screen/state in UI_DESIGN_SYSTEM.md on desktop/touch, long strings/contrast/safe area/focus |
| Technical: build success, no important missing texture, no known severe leak, no VFX gameplay regression, implemented presets work, target-environment results | Coordinator build report; worker graphics model check PASS; source budgets | Fresh settled build, browser console/load errors, timing/input regressions, transition/stress memory, real devices/presets |
| Production: clear provenance, no unlicensed assets, updated Art Bible/inventory, baseline screenshots, QA report, adding-assets instructions | Nine graphics docs and generator/source paths | Provenance sign-off per delivered asset, approved runtime baselines, completed evidence/defect log, tested export checklist |

Build/package version 1.0.0 is not graphics acceptance. Any important unfinished group blocks a whole-overhaul completion claim.

## Section 21 — Five gates for every asset group

| Gate | Reviewer / concrete check | Required artifact / pass rule |
|---|---|---|
| 1 Artistic Quality | Art Director: premium cluster work, Vietnamese identity, silhouette/palette/density/material/light consistency | Normal-size scene comparison/contact sheet with signed rationale; no important primitive/recolor placeholder |
| 2 Technical Quality | Pipeline/animation owner: dimensions/format/frame range/origin/transparency/atlas padding | Measured PNG/atlas+metadata validation, frame-by-frame anchor check; no missing/cut/bleeding frames |
| 3 Gameplay Readability | Gameplay/QA: character/enemy/warning/damage/UI visible in dense combat | Video all directions/weapons/skills/boss phases at small display, shape/color accessibility; exact geometry readable |
| 4 Integration Quality | Integration owner: real loader/entity/scene/UI/state/transitions | Actual gameplay capture and browser logs, restart/reload/return/Ending proof; no visual-demo substitution |
| 5 Performance Quality | Rendering/device QA: budget, frame-time/memory/lifecycle/presets | Device/build/preset profile and sustained stress, no known severe leak/crash; measured suitable-device 60 FPS target, stable weaker-device play |

Gate record per asset group: ID/revision, source/provenance, scene/build/device, reviewer/date, artifact path, result and blocker. All five must PASS before FINAL; a concept can only pass concept review, not this release gate.

## Capture matrix and repeatable protocol

Use isolated test save/browser profile; never alter personal save silently. Build/serve locally, then capture actual game. Existing check:browser requires production preview and local Chrome/Chromium/Node 22+; inspect its current coverage before assigning results. It does not cover every art group.

| Capture set | Required cases |
|---|---|
| Menu/end states | Menu/New/Continue/Settings/Credits; Pause, GameOver, Victory, Ending; loading/fade/reload |
| World | Village, forest, swamp, mountain, capital, three dungeon routes; daylight/ambient/occlusion/collision |
| Combat | Every common/elite; hero idle/run/11 states/four directions; all three weapon combos; twelve skills; many targets |
| Boss | Four entrances, all attacks, phase 1/2 transition, channel/interrupt/hazard, defeat/reset |
| RPG UI | Inventory/equipment/tree/journal/dialogue/shop/crafting; empty/full/locked/insufficient-resource/long-text states |
| Mobile | Real Android Chrome and iOS Safari landscape/safe inset, small viewport, portrait fallback, touch combinations/cancel/blur |
| Regression | Same viewport/save/seed/preset on before/after build; missing texture, shifted UI, scale/palette drift |

Record timestamp, exact code/dirty snapshot, actual viewport and DPR, OS/browser/device/GPU where available, renderer, preset/motion, route/save fixture, artifact path and observations. Baseline paths are pending; do not list nonexistent screenshots as evidence. Compare stable scenes and capture animation video separately; screenshot alone cannot verify timing.

## Performance protocol and unmeasured table

1. Warm up same scenario; sample 60 seconds normal travel, dense enemies plus boss/FX, and open RPG panel at Low/Medium/High.
2. Collect FPS and frame-time distribution (median/p95/p99), object/draw-call counts where tooling exposes them, texture dimensions/estimated bytes and real memory metrics where available. Do not call estimated RGBA bytes measured GPU memory.
3. Repeat scene enter/return/restart ten times; inspect retained listeners/tweens/objects/heap trend with comparable sampling. Run sustained combat/travel for thirty minutes; record crash/jank/device heat observations.
4. Repeat on suitable desktop, representative Android and iOS, weaker mobile where available. Document unavailable metrics/devices explicitly; quality target is not invented universal hardware guarantee.

| Environment | Presets | FPS/frame times | Memory/transition trend | Status |
|---|---|---|---|---|
| Desktop browser | Low/Medium/High | NOT MEASURED | NOT MEASURED | Pending |
| Real Android | Low/Medium/High | NOT MEASURED | NOT MEASURED | Pending |
| Real iOS | Low/Medium/High | NOT MEASURED | NOT MEASURED | Pending |
| Weaker mobile/stress | Low first, then supported presets | NOT MEASURED | NOT MEASURED | Pending |

Acceptance targets: aim 60 FPS on suitable hardware; stable input/warnings on weaker devices; no severe persistent memory growth or texture crash. Set device-specific numeric budgets after baseline measurement, then re-run the same scenarios; do not tune pass thresholds retrospectively to hide regressions.

## Next gate

Final coordinator handoff reports roundPixels enabled, boss HUD moved to y=94 with duplicate boss label removed, quest labels shown only near player (90px) to reduce overlap. Earlier fixture screenshots precede these changes; coordinator owns final browser rerun, inventory refresh and evidence updates after sprite settlement. No wait on source worker is required to accept this nine-document delivery; unresolved sprite regression and full production gates remain explicit.

Follow Stage A in GRAPHICS_ROADMAP.md: settle sprite/preset outputs, refresh inventory, validate build/graphics contracts, capture first real baseline. No documentation-only pass unlocks full-world FINAL. Existing gameplay release checks remain separate gates.
