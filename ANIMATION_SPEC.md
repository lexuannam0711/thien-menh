# Thần Mệnh — Animation Specification

## Current coordinator contract — October 12, 2026

NPCs: fifteen down-facing sheets, idle4 at4FPS repeating, dialogue4 at6FPS finite; completion restores idle. Stable NPC ID selects service portraits independently of display titles. Feet42 in48px sprites aligns to existing actor ground/shadow; gameplay markers and interaction zones stay unchanged. Boss impact retains locked telegraph direction/origin through hitbox and pose selection, then removes the resolved warning; four boss regressions test both untelegraphed misses and warned hits.

Hero spear/axe/sword each provide 272 real frames across the original fourteen states and four directions. Logical frame index remains direction × 68 + state.start + offset; physical atlas packing is 42 columns, so it is no longer four physical rows. All three render at 2016×336; padded frames are not loaded. Equipment selection drives both texture and animation prefix. Player death locks movement/attacks/skills/world interactions; save/penalty occurs immediately, scene exit after the 333.33ms death sequence. VictoryScene plays the equipped variant victory pose.

Hổ has 96 frames in 21 physical columns; idle/chase/windup/impact/stagger/hurt/death now bind to directional poses, with windup/transition falling back to attack. Thuồng Luồng/Thạch Tướng/Hắc Ấn each have 132 frames: per direction idle4/walk6/windup4/attack6/hit3/death6/transition4, FPS 5/8/10/14/14/12/8. Telegraph facing is frozen for windup; completed attacks restart the impact pose, not locomotion. Boss death shows all frames before fading. Registration, frame ranges and mocked state priorities PASS; seeded browser screenshots show all four bosses. These are animation foundations, not premium choreography/art approval.

Historical observations below remain baseline evidence, not current missing-playback claims.

## Initial observed contract

October 12, 2026 baseline before directional worker settlement. Four physical frames per sheet; loader registers generic cycles for hero/moctinh/matroi/hoyer. Availability filtering avoids invalid indices but can hide incomplete exports: verify intended counts, not merely absence of exception.

| Suffix/key | Indices in playback order | FPS / repeat | Proof boundary |
|---|---|---|---|
| _idle | 0 | 1 / once | One pose |
| _walk | 0,1,2,1 | 6 / loop | Four entries, three unique source frames |
| _run | 0,1,2,3,2,1 | 10 / loop | Six entries, four unique poses |
| _attack | 2,3,2 | 12 / once | Generic reused attack |
| _hit | 3,2 | 12 / once | Generic pose reuse |
| _death | 3,2,1,0 | 8 / once | Reverse cycle, not authored death |
| matroi_float | 0,1,2,3 | 7 / loop | Legacy registration |
| hoyer_stalk / hoyer_pounce | 0,1,2,1 / 2,3,2 | 6 loop / 8 once | Legacy registrations |

Registration is not playback proof. Initial Player calls idle/walk/attack and flipX; dodge scales container, hurt flickers, skill dispatches VFX, death switches scene. Enemy actions reuse role animations, death fades/shrinks. Boss sprite creation exists; dedicated sprite state playback not found in initial Boss audit. Re-audit call sites after directional worker settlement.

## Current directional manifest refresh

Later same-day source/disk inspection found new spriteManifest.ts and sheets: hero 68 frames per direction (272 total); each creature 24 per direction (96 total). Four rows down/left/right/up; manifest frame indices use row × columns + pose.start. Loader registers direction-specific keys and legacy down-facing aliases; physical frames and metadata exist, not browser approval.

| Hero state | Actual count per direction | FPS / repeat |
|---|---|---|
| idle | 4 | 6 / loop |
| walk / run | 6 / 6 | 9 / 14, loop |
| attack1 / attack2 / attack3 | 5 / 5 / 6 | 18 / once |
| dodge | 4 | 16 / once |
| hit / death | 3 / 6 | 14 / 18, once |
| earth / fire / water | 5 each | 12 / once |
| victory / interaction | 4 each | 8 / once |

Creature states: idle 4 at 5 FPS loop; walk 6 at 8 loop; attack 5 at 14 once; hit 3 at 14 once; death 6 at 24 once. These are generic sets for moctinh/matroi/hoyer, not specialized boss mechanics or all sixteen enemy silhouettes.

Player calls directional states for three combo attacks/dodge/element casts/interaction/hit/death and locomotion; Enemy calls directional role-shared states. Death playback starts before existing fade/scene change: full visual lifetime still needs browser review. Hero victory has no playback call found; Boss Hổ remains frame-0 presentation with no dedicated sprite state playback found. Manifest feet values 42/42/28/84 are not yet a proven entity-origin contract. Reconcile callbacks/origins, capture normal-size gameplay, then evaluate each gate; never claim FINAL from registered states alone.

## Target hero production set

Final same-day refresh adds wolf/spider sheets and manifest entries, each sharing the 24-frame-per-direction enemy state set (96 frames each); total six sheets 752 physical frames. Charge/ambush now bind these role families, not per-species final art. Player death calls actions.dead immediately after starting death pose: do not claim a visible full death cinematic. This is an integration gap despite exported death frames.

Four directions first: down/up/left/right with direction-specific silhouette and weapon placement. Eight directions optional after four-direction coverage/device readability. Mirror only symmetric bodies; asymmetric weapon/insignia must not silently swap hands.

| State | Proposed unique frames per direction | Synchronization/acceptance |
|---|---|---|
| Idle | 4 | Stable feet/weapon; authored breathing, not container pulse alone |
| Run | 6 | Foot contact follows movement; no anchor slide on idle/run transition |
| Attack 1 | 6 | Anticipation/contact/recovery; actual attack direction |
| Attack 2 | 6 | Separate pose/arc; preserve combo window |
| Attack 3 | 8 | Heavy anticipation/contact/recovery, no input lock regression |
| Dodge | 4 | Body/trail follows stored direction and actual i-frame interval |
| Skill cast | 6 | Earth/fire/water distinction; layer specific choreography as needed |
| Hurt | 3 | Interrupt only where gameplay allows; restore tint/alpha |
| Death | 8 | Clear collapse/resolve before GameOver; no post-death attacks |
| Victory | 6 | Distinct celebration and bounded next-chapter/Ending transition |
| Interaction | 4 | Face NPC; no blocked input after dialogue closes |

Proposed briefs total 244 unique hero frames for four directions if independently authored; **not delivered counts**. Approve counts with art/gameplay owners and record actual metadata. Never stretch four physical frames into eleven completed actions. Three weapon families need coherent attack poses/layers across all combo steps, existing weapons.ts timing and matching body/weapon anchors. Reuse body frames only where silhouette/timing remain correct.

## Monsters/bosses/NPCs

Every common/elite ID in ASSET_INVENTORY.md needs idle, locomotion, anticipation, attack, recovery, hurt, death; four facings when relevant. Branch melee, floating projectile cast, quadruped charge and ambush emergence require different poses. Elite silhouette and cues, not only size/tint.

| Boss | Specialized states beyond movement/hurt/death |
|---|---|
| Hổ Yêu | Claw, pounce, frenzy, roar, clone cue, rage transition |
| Thuồng Luồng | Tail sweep, spit, submerge/emerge, whirlpool, barrage, dive/crush, surge |
| Thạch Tướng | Slam, boulder, stomp, shield, cross-fissure, earthquake, crack transition |
| Hắc Ấn | Beam, teleport/reappearance, bolts, eruption, interruptible channel, rift, form transition |

Definitions have windup/recovery durations and two phases each. Animation events may mark VFX, never become independent damage clocks. Danger precedes active frame; phase visuals cannot hide player or next attack.

Fifteen NPCs: idle, interaction/gesture, role task; walking only when behavior exists. Portrait expression changes where dialogue uses them. No animated-town claim before placement/interaction wiring.

## Handoff and verification

Each state records texture/key, direction, ordered indices, unique count, FPS/repeat, feet/origin, event markers, interrupts, destination and weapon offset. Validate indices/counts against PNG/atlas; run existing graphics self-check after sprite worker settles.

- Contact sheet: anatomy/palette/anchor consistency, no cut edges/stray pixels.
- Gameplay: all facings; combo 1–3 for every weapon; dodge/cast/hurt/death/interact/victory.
- Boss: all attacks, both phases, death/reset; no lock or hidden warning.
- Geometry: feet match unchanged collider; no body-scaled hitbox; obstacle/depth walk-through.
- Lifecycle: pause/reload/transition leaves no stale tweens, layers, direction or input.

No browser animation test by this documentation worker. Model self-checks do not approve timing/foot sliding; open evidence in GRAPHICS_QA.md.
