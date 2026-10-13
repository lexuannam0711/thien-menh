# Thần Mệnh — VFX Design

## Source baseline, not final effects

October 12, 2026 initial audit: CombatSystem draws slash arcs and sparks using Graphics/tweens; directional skills use a thick line, area skills share dongSonShockwave; enemy damage floats text and flickers/fades; Player emits dodge text, damage feedback and shake. Boss owns shape telegraphs/hazards and phase notices. These are working code paths, not browser-approved premium FX. No hit-stop implementation found initially. Coordinator is adding preset budgets; verify settled source before treating those controls as implemented.

## Visual grammar

Same-day coordinator foundation verified in source: GraphicsSettings budgets ambient 0/10/24, slash sparks 1/4/8 for Low/Medium/High, zero for reduced motion/OS preference; Atmosphere adds bounded motes/cleanup. Latest search found eleven guarded shake sites; coordinator reports later Atmosphere OS-transition/shutdown mock check PASS. Runtime/device coverage and bespoke regional atmosphere remain pending.

- Friendly earth: bronze/gold radial drum geometry, dust and ground cracks. Fire: orange tapered arcs and embers. Water: cyan flowing curves, aura and splash. Physical bronze: pale edge and brief warm sparks.
- Hostile corruption: violet/void mass with unmistakable warning outline, directional geometry and icon/text where needed. Color alone cannot communicate danger.
- Telegraph below actor feet; readable edge above terrain; impact at actual contact point. Keep hero silhouette, enemy windup, touch controls and HUD clear.
- FX never owns damage, cooldown, invulnerability or save state. Existing gameplay geometry/timestamps remain authority; decorative radius/trail must not imply a false reach.

## Combat and weapon tasks

| ID / family | Production task | Acceptance capture |
|---|---|---|
| combo-1/2/3 | Separate attack arc/trail, impact flash/sparks, hit reaction and numbers; heavy third visually distinct | Each step in four directions against one and many targets; hit-once/timing unchanged |
| spear | Narrow thrust streak, pointed contact, bronze trail aligned to data reach | Equipped Giáo, all combo steps, no sword-shaped misleading arc |
| axe | Broad weighted sweep, recoil/dust and heavier impact | Equipped Rìu, all steps, anticipation matches weapon attack timing |
| sword | Curved bronze blade trail, separate rhythm/contact | Equipped Kiếm Lạc, all steps, not spear FX recolor |
| dodge | Brief directional afterimage/dust; preserve feet and i-frame cue | Diagonal/touch dodge, pause/restart, no ghost trail |
| hit-feedback | Target-local flash/sparks, knockback/stagger response, readable normal/crit/heal text | Multiple hits, boss armor/shield, death; bounded text/effect counts |
| hit-stop | Short bounded visual impact with explicit combat/cooldown clock contract | Input queued/released correctly; cooldown and boss windup do not drift |
| camera | Small/heavy/skill/boss tiers; global reduced-shake option | Every caller respects setting; no cumulative shake on busy combat |

Block/miss FX only if gameplay supports those outcomes; do not invent damage semantics. Pool or reuse effect objects when profiling justifies it; bounded effects and shutdown cleanup are mandatory even before pooling.

## Complete skill presentation backlog

| Skill IDs | Required distinct presentation |
|---|---|
| earth-shockwave / Địa Chấn | Expanding sacred earth ring, rocks/dust, crack decal, drum-inspired glow |
| stone-armor | Ground-rising stone shell/shield, readable remaining protection, clean expire |
| mountain-cleave | Directed fissure/sacred edge, visible endpoint/impact, no misleading circular area |
| flame-beam / Hỏa Trảm family | Fire slash/beam, orange trail, ember and impact sparks |
| blazing-dash | Moving flame trail on actual path, begin/end cue; no invented displacement |
| sun-burst | Charge/area cue, solar radial burst, short recovery glow |
| tidal-surge / Thủy Linh family | Flowing wave, blue aura, contact splash and clear direction |
| dragon-vortex | Rotating water silhouette/edge, bounded spray; hazard geometry visible |
| sacred-spring | Healing water pulse and positive number distinct from damage |
| spear-thrust / axe-whirlwind / lac-blade-dance | Weapon-specific thrust, weighted rotation and blade rhythm tied to existing skill definitions |

Ultimate-style finishers may add charge, silhouette highlight, area warning, large impact and controlled shake; never hide enemy attacks. Distinct audio cue is an integration dependency, not proof of authored visual completion.

## Boss presentation contracts

| Boss | FX obligations / readability risk |
|---|---|
| Hổ Yêu | Claw arc, lunge path, rage aura, roar wave, clone cue and dissolution; aura cannot hide next pounce |
| Thuồng Luồng | Corrupted water spit, tail/wave sweep, submerge ripple, whirlpool edge, barrage and dive splash; shallow/safe ground remains readable |
| Thạch Tướng | Impact ring/dust, boulder trail, fissure cross, armor glow/break and earthquake; cracks distinguish danger from decoration |
| Hắc Ấn | Void beam/bolts, teleport arrival, eclipse ring, interruptible channel progress, rift hazards and transformation; strongest warning survives darkness |

Use boss definition shapes circle/cone/line/ring/rect and actual windup/recovery durations. Phase entry/death must clear expired warnings/projectiles, not leak or double-hit.

## Atmosphere and quality ownership

Village smoke/leaves/dust/water; forest falling leaves/fog/canopy/yêu khí; swamp mist/ripple/reflection; mountain waterfall/cloud; capital braziers/ritual glow. Weather only where content warrants it. Contact shadows for hero/NPC/enemy, local lights and regional ambient exposure require scene QA.

Low removes/reduces decorative fog/weather/glow/particles; Medium uses moderate density; High richer bounded atmosphere. All preserve telegraph geometry, important impact and cooldown readability. Exact limits come from coordinator's implemented budgets and measured device runs, not arbitrary claimed FPS.

For each effect record lifetime, peak concurrent objects, texture/atlas, blend/depth, preset behavior, reduced-motion behavior and shutdown disposal. Acceptance: repeated map transitions and dense enemies plus boss, three presets, desktop and real Android/iOS; log FPS/frame-time/heap/texture data in GRAPHICS_QA.md. None measured here.
