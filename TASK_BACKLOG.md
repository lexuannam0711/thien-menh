# Thần Mệnh — Task Backlog

## Done
- P1: Actual equipped-weapon reach, damage, knockback and attack timing for spear/axe/sword; shared recipes connected to crafting transactions.
- P1: Skill pagination and Q/E/R/T equipment/casting, healing/status effects, persistent power/cooldown/loadout validation.
- P1: In-game credits and chapter-specific leader/HUD dialogue.
- P0: Validate and clamp localStorage save data.
- P1: Reset touch input on pointer cancellation, window blur, tab visibility loss, and scene shutdown.
- P1: Register guarded idle, run, walk, attack, hit, and death animations for all existing sprite sheets.
- P1: Runtime integration of 15 NPCs, 12 common enemies/four elites, 32 quest definitions, three dungeons/nine floors and four bosses.
- P0: Explicit campaign chapter on village portal; native actual-method RED/GREEN and natural post-dungeon transition to chapter 2 passed.
- P1: `npm run check:campaign` PASS on `index-D71EOpKB.js`: fresh save, all four chapters, 32 rewarded quests/35 exact payout receipts, four bosses, nine naturally unlocked dungeon floors/items, Ending/credits, save hydration, HTTP assets and stable hash. Accepted artifact and Ending image independently inspected.

## Next
- P0 IN_REVIEW: Confirm all Menu reset paths; preserve unreadable/unsupported saves; show storage failures in Menu/HUD. RED/GREEN focused tests and typecheck pass; production integration follows frozen-candidate stress. Dependencies: close stress browser, archive its receipt, rebuild, browser confirmation/storage acceptance, campaign rerun.
- P1 IN_PROGRESS: Native RPG-menu unit coverage collector/control added. Runtime/test evidence must remain separate; full-source/branch coverage is not established.
- P1: Measured 30-minute active gameplay/transition stability and frame/heap trends; graphics coordinator owns one-browser stress harness. Native device/GPU acceptance stays separate.
- P1: Verify representative difficulty and 3–5-hour narrative pacing; omniscient automated route is not human playtest evidence.
- P1: Resolve full relevant-source/branch coverage denominator against >=80%; measured mapped union is 87.10% lines/82.92% observed functions, not full-repo proof. Unbundled runtime `src/data/npcs.ts` remains outside the map.
- P1: Equipped skills Q/E/R/T, all 12 skill menu entries, healing/status effects and save/power persistence: integrated; production browser regression passes.
- P1: Add focused RPG self-check: PASS; save normalization self-check: PASS.
- P1: Add collision grid and explicit portal bounds. (implemented)
- P1: Separate ranged enemy projectile lifecycle from scene updates. (implemented)
- P2: Wire data-driven quests, NPC services, inventory, and equipment. foundation, persistence, and Village quest integration implemented
- P1: Release content catalog/runtime: 4 chapters, 5 areas, 3 dungeons, 15 NPCs, 12 common enemies, 4 elites, 16 main quests including legacy hunt and 16 side quests. (implemented)
- P1: Add procedural WebAudio cues, unlock handling, mute persistence hook, and bounded concurrency. (implemented)
- P1: Integrate combat/menu/victory audio cues. (implemented)
- P1: Generalize quest progression and legacy save mapping. (implemented)
- P1: Reset legacy campaign quest when advancing to a new chapter. (implemented; regression self-check)
- P2: Run Chromium production smoke and mobile emulation: partial; real-device acceptance remains open.
- P3: Measure bundle, FPS, heap, and 30-minute stability.

## Evidence
- Current equipment snapshot `index-DAgfL7dU.js`: natural campaign session 57518 exit 0, two natural deaths/revivals; separate instrumented campaign/UI exit 0. Mapped union 9597/11052 lines (86.83%) and 674/813 observed functions (82.90%); reports `artifacts/coverage-DAgfL7dU/`. D71 receipts are historical; both snapshot archives preserved. Exclusive final-snapshot stress released after verified cleanup.
- `npm run build`: PASS.
- `npm run check:save`: PASS.
- Content catalog self-check: PASS.
- Audio self-check: PASS.
- `npm run check:rpg`: PASS.
- `git diff --check`: PASS.
- Production preview desktop/mobile-emulated fixtures: PASS. Corrected natural full-content campaign exit 0; artifact/hash/reward/reload audited. Separate instrumented campaign exit 0 with three natural deaths/revivals; mapped campaign/UI coverage 87.10% lines/82.92% observed functions. Representative pacing, full-source/branch coverage, real devices and performance remain open.







