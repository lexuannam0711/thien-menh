# Thần Mệnh — Release Checklist

- [x] Version `1.0.0` target and production build configuration.
- [x] Release notes, deployment guide, play guide, known limitations and credits authored.
- [x] Save normalization and focused subsystem checks (Coordinator verified PASS).
- [x] Equipped skill slots and water casting, persisted loadouts/powers, three-weapon shop/equip browser regression (Coordinator verified PASS).
- [x] Three-weapon crafting transactions and data-driven melee calculations in focused checks (Coordinator verified PASS).
- [x] Menu, village, forest, victory, ending, pause and game-over scenes registered.
- [x] No external secrets, backend or paid service required.
- [x] Runtime content integration: 15 named NPCs, 12 common enemies, four elites, 32 quest definitions (16 main including legacy hunt, 16 side).
- [x] Automated test suite & browser acceptance (`npm run check:all` and `npm run check:browser` including NPC board and campaign hunt verified by coordinator).
- [x] Three dedicated multi-floor dungeon scenes; browser fixtures cleared all nine floors, final elites and rewards.
- [x] Natural dungeon unlock/level acquisition, nine combat floors and item rewards observed on new-save production playthrough.
- [ ] Representative unboosted difficulty and pacing verified.
- [x] Independent master/music/SFX settings persist after reload; isolated channel routing passes mocks.
- [x] Prior-area travel preserves campaign progress; earlier dungeon clear/reward browser fixture passes.
- [x] Active playtime persists; pause/resume/reload browser and hidden-tab save checks pass.
- [ ] Representative interactive/human release-build campaign playthrough (end-to-end Chapters 1–4 progression and pacing verified beyond the automated route).
- [x] Natural production Chapters 1–4, all 32 quest rewards/35 exact payout receipts, four bosses, nine dungeon floors/items, Ending and credits PASS on current bundle `index-CdV_jToi.js` (604.2s, 1 death, 32 quest rewards, all 9 dungeon floors, reload PASS; snapshot preserved in artifacts).
- [x] Corrected campaign command exit 0; artifact/hash independently audited, strict save/reload and authored asset responses PASS.
- [ ] Representative human playthrough, difficulty and 3–5-hour pacing acceptance; automated route takes about ten minutes.
- [ ] Mobile/touch acceptance on representative real phones (physical Android Chromium and iPhone Safari).
- [x] Controlled headless 30-minute graphics stress: Low/Medium/High each 600s active combat, 0 runtime errors/asset failures/deaths; exact bundle hash preserved in `artifacts/graphics-stress-current-30m/report.json`. The receipt records four baseline `favicon.ico` HTTP 404 warnings. Native-device FPS/stability remains open.
- [x] Historical DAgfL7dU mapped V8 campaign/UI coverage measured: lines 9597/11052 (86.83%), observed mapped functions 674/813 (82.90%); exact code/map/hash matched. This is not current CdV_jToi coverage.
- [x] Current CdV_jToi uninstrumented fresh-save campaign witnessed natural death, all quests/dungeons/Ending and reload; historical D71/DAgf instrumented and uninstrumented receipts remain preserved separately.
- [ ] Full relevant-source/branch coverage >=80%; RPG-menu mapped line coverage is 83.07%, but branch coverage remains unmeasured and excluded runtime/self-check sources prevent closing this full-repository gate.

Release status: **Not achieved — Full game 1.0 gates pending (natural campaign/dungeon balance, real devices, performance/stability).** The package version is a target, not release acceptance.
