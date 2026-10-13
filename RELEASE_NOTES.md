# Thần Mệnh — Hậu Duệ Văn Lang 1.0.0

## Included

- Four-chapter Vietnamese mythology campaign architecture with four boss encounters.
- Data-driven quests (32 definitions: 16 main including legacy hunt, 16 side), 15 named NPCs across chapter hubs, 16 canonical runtime enemies (12 common, four elites) with four AI roles (`melee`, `ranged`, `charge`, `ambush`).
- Three playable multi-floor dungeons: key/level/area entry gates, nine combat rooms, final elites, persisted cleared floors, atomic once-only rewards.
- Data-driven weapon combat (three weapon archetypes with combo steps, reach, knockback, and crafting), four equipped skill slots (Q/E/R/T) with status effects (`burn`, `slow`, `stun`), inventory, equipment, economy, and upgrade flow.
- Procedural art, combat feedback, mobile touch controls, accessibility help, settings, save/load, ending, and credits.
- Procedural WebAudio music motifs across ten contexts plus unlock-safe cues, mute persistence, pause/resume and bounded concurrency.

- Independent master/music/SFX settings with persisted sliders and live channel gains.
- Chief travel menu revisits discovered regions and dungeons without resetting the campaign chapter.
- Active gameplay time persists across saves; pauses and hidden tabs are excluded. RPG menu cannot open through pause; repeating menu keys are ignored.

## Verification

Coordinator validation passed on October 12, 2026:
- `npm run check:all` (build, save, rpg, content-audio, rpg-menu, graphics, sprites)
- `npm run check:browser` (production preview including NPC board and campaign hunt acceptance)
- `git diff --check`

October 13, 2026: `npm run check:campaign` exit 0 on current equipment candidate `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`. Fresh-save input-driven production progression passes four chapters, 32 quest rewards/35 exact payouts, four bosses, nine natural dungeon floors/items, Ending/credits, authored asset responses, stable hash and save/reload; two natural deaths/revivals observed. Artifact and Ending image independently inspected. Prior D71 evidence archived. Mapped campaign/UI union coverage 86.83% lines/82.90% observed functions is not full-repo/branch acceptance.

Proof boundary: The natural read-only-observer automated route takes about ten minutes. It establishes progression, not representative human pacing/difficulty, real-device usability or 30-minute stability.

## Known limits / Release boundaries

- Release status is **Not achieved** for Full Game 1.0.
- Production browser fixtures cleared all three dungeons and claimed rewards. Level-20/attack-1000/key-unlocked fixtures do not prove natural key acquisition, unboosted balance or pacing.
- Natural four-chapter production progression and save hydration pass; representative quest pacing, 3–5-hour target and difficulty curves remain unverified.
- Real-device mobile testing (physical Android Chromium and iPhone Safari) remains unverified (only headless Chrome emulation was tested).
- FPS profiling, heap memory trends, and 30-minute continuous stability runs require dedicated target environment execution.
- Bundle-size warning remains; no code-splitting was added because this release has one Phaser entry point.
