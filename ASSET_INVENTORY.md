# Thần Mệnh — Asset Inventory

## Canonical icon atlas — October 12, 2026

Original transparent32px frames: nine ITEMS + twelve SKILLS, atlas160×160px/3,476bytes, decoded102,400RGBAbytes including padding. Source scripts/generate-icons.js, metadata src/game/assets/iconArtwork.ts, executable scripts/check-icons.cjs. SHA256 aa276b2ae00035f65d5d752fc78dca22b0dcf591bb7418cc653fd338eb664031; canonical ID coverage, silhouette uniqueness and deterministic regeneration verified. Village menus bind this atlas; browser/mobile readability not yet accepted.

## NPC runtime refresh — October 12, 2026

Subsequent enemy/environment slice: `public/assets/enemies/` holds sixteen canonical four-facing sheets (1,536frames/188,470bytes); `public/assets/environments/` holds five ground/path/detail/water/stone/rune kits plus eight-prop sheets per region (80frames/31,208bytes after combat-floor contrast refinement). Editable sources `generate-enemies.js` and `generate-environments.js`, metadata `enemyArtwork.ts` and `environmentArtwork.ts`, exact hashes `artifacts/graphics-qa/2026-10-12/enemy-environment-evidence.json`. Current bindings are Enemy.ts, shared loader and five art.ts branches plus DungeonScene; original role-family atlases remain fallbacks, not current identity art.

Fifteen canonical IDs now have authored down-facing idle4/dialogue4 sheets and 96px busts; 30 PNGs total 24,919 bytes. Runtime VillageScene uses sprites with explicit feet alignment and stable-ID service portraits. `scripts/generate-npcs.js` is the editable offline source; `scripts/check-npcs.cjs` checks canonical identity coverage, distinct silhouettes/frames, PNG integrity and idempotent loader/animation metadata. Exact hashes in `artifacts/graphics-qa/2026-10-12/npc-manifest-evidence.json`; contacts/live chief capture inspected, premium approval remains open. Earlier procedural-NPC descriptions below are historical.

## Current coordinator delivery — weapons and all bosses

October 12, 2026: **eleven sheets, 1,692 distinct frames, 511,990 encoded bytes**, measured after both sprite tasks settled. Decoded RGBA estimate including atlas padding: **31,303,680 bytes (29.85 MiB)**; not actual GPU/peak process allocation. Exact PNG hashes and counts: `artifacts/graphics-qa/2026-10-12/sprite-manifest-evidence-v2.json`. Earlier snapshots below are historical.

| Runtime file | PNG dimensions | Frames | Encoded bytes |
|---|---|---|---|
| hero.png / hero_axe.png / hero_sword.png | 2016×336 each | 272 each | 46,680 / 49,037 / 44,718 |
| moctinh.png / wolf.png / spider.png | 1152×192 each | 96 each | 21,863 / 12,479 / 21,470 |
| matroi.png | 768×128 | 96 | 10,947 |
| hoyer.png | 2016×480 | 96 | 32,606 |
| thuongluong.png / thachtuong.png / hacan.png | 2016×672 each | 132 each | 90,815 / 87,577 / 93,798 |

All physical dimensions now ≤2048. Logical direction strides remain independent of physical row-major packing; loader endFrame excludes blank padding. Three equipped hero weapon silhouettes, visible death/victory playback and all four Boss ID bindings exist. Hổ uses shared enemy poses; new bosses add windup/transition. Initial portraits/NPC sprite production is a separate active task, not included in these totals. Five enemy role-family sheets are still not sixteen bespoke species. Art approval, environment/UI replacement and real-device memory/performance remain OPEN.

## Audit and status vocabulary

October 12, 2026 initial source/disk snapshot. Read loader, generator, entities, painters, catalogs, UI and existing docs. Worktree already dirty; this worker changes documentation only. Concurrent directional sprite/preset work requires refresh before acceptance. No asset is FINAL merely because a file exists.

**Disk/source verified**: inspected bytes/code. **Integration pending proof**: loader/call site exists, gameplay not observed here. **Catalog only**: content definition, not playable art. **Planned**: not produced. FINAL requires gates 1–5 in `GRAPHICS_QA.md`.

## Intermediate four-sheet snapshot — superseded by settled batch below

Remeasured later in the same October 12 audit, before worker settlement/acceptance. `spriteManifest.ts` now supplies four rows in direction order down/left/right/up, explicit state ranges and feet metadata; shared loader consumes it. Generated PNGs remain procedural art candidates, not final approved art. Current total: **560 physical frames, 109,748 encoded bytes**; decoded RGBA estimate **7,323,648 bytes (6.984375 MiB)**, not measured GPU allocation. This is substantially larger than initial baseline and requires mobile texture-size/memory review (hero width 3264px).

| Current file | Measured PNG | Frame size | Layout / physical frames | Encoded bytes |
|---|---|---|---|---|
| hero.png | 3264×192 | 48×48 | 68 columns × 4 / 272 | 45,346 |
| moctinh.png | 1152×192 | 48×48 | 24 columns × 4 / 96 | 21,863 |
| matroi.png | 768×128 | 32×32 | 24 columns × 4 / 96 | 10,947 |
| hoyer.png | 2304×384 | 96×96 | 24 columns × 4 / 96 | 31,592 |

Hero now has fourteen manifest states: idle/walk/run/attack1/attack2/attack3/dodge/hit/death/earth/fire/water/victory/interaction. Other three each have idle/walk/attack/hit/death. Player source binds directional locomotion, three combos, dodge, element casts, interaction and hit/death; Enemy source binds directional role-shared movement/attacks/hurt/death. `victory` is registered but no Player victory playback call found. Boss.ts still creates Hổ frame 0 without dedicated sprite playback; other bosses stay procedural. Feet metadata 42/42/28/84 is present but no setOrigin/feet-consumer found in entity search; in-game anchor review remains necessary.

Current full hero sheet preview inspected, no gameplay visual approval. `scripts/check-sprites.cjs` now exists; its checks and all source bindings must pass review after worker settlement. See ANIMATION_SPEC.md for actual frame/FPS mapping. Remaining world/NPC/boss/equipment/UI scope below is unchanged.

### Intermediate extension before documentation settlement

Latest validation **FAIL**: check-sprites.cjs reports spider duplicate poses/directions, 92 unique frame hashes versus 96 expected; six-sheet delivery is not accepted. Measured physical counts below remain valid, but physical frames are not all distinct poses. Coordinator/sprite owner notified; refresh after fix.

Two additional real files now measured: wolf.png 1152×192, 48×48 frames, 24×4=96 frames, 12,479 bytes; spider.png same dimensions/count, 20,557 bytes. Manifest includes both with enemy poses/feet=42; loader keys wolf_sprite/spider_sprite; Enemy charge uses wolf, ambush uses spider. Latest six-sheet total **752 physical frames / 142,784 encoded bytes / estimated 9,093,120 decoded RGBA bytes (8.671875 MiB)**. These are four role-family sheets plus hero/tiger, not sixteen unique common/elite species. Worker settlement and art/runtime acceptance still required; coordinator refreshes future revisions.

Concurrent gameplay foundation also changed: NpcRoster.ts selects village NPCs plus current chapter-area NPCs from fifteen named entries; VillageScene now calls getVillageNpcs and routes quest/service dialogs. Source supports six actors in chapter 1 and seven in chapters 2–4, all still procedural actor shapes; this supersedes the initial three-only runtime snapshot. It is not proof of fifteen approved sprites/portraits or separate regional placement. ForestScene QuestInteractions creates circular labelled quest flags; dungeon-related objective markers do not constitute three authored playable dungeon maps.

## Settled coordinator batch — October 12, 2026

Sprite worker settled successfully; coordinator independently reran PNG/manifest/actor checks: PASS. The spider duplicate-frame defect is fixed through visible pose changes, not accepted by lowering the assertion. Six PNGs contain **752 distinct frames**, **143,570 encoded bytes**, approximately **8.672 MiB decoded RGBA** before driver overhead. Art-quality/mobile acceptance remains OPEN.

| Settled PNG | Dimensions | Frame size / count | Bytes |
|---|---|---|---|
| hero.png | 3264×192 | 48×48 / 272 | 45,219 |
| moctinh.png | 1152×192 | 48×48 / 96 | 21,863 |
| matroi.png | 768×128 | 32×32 / 96 | 10,947 |
| hoyer.png | 2304×384 | 96×96 / 96 | 31,592 |
| wolf.png | 1152×192 | 48×48 / 96 | 12,479 |
| spider.png | 1152×192 | 48×48 / 96 | 21,470 |

Exact SHA-256 inventory: artifacts/graphics-qa/2026-10-12/sprite-manifest-evidence.json. Runtime browser must load all six PNGs with HTTP 200; check-browser.cjs enforces this. Shared role families are not sixteen bespoke creature designs. Hero artwork still displays a spear regardless of equipped gameplay weapon; Boss Hổ is not fully animated; hero death/victory visibility remains unfinished.

## Historical initial raster baseline

PNG IHDR dimensions measured directly; frames calculated against `assetLoader.ts`. All single-row four-frame generated sheets; 2,821 bytes combined. Decoded RGBA estimate: 232 KiB before GPU/driver overhead, not measured GPU memory.

| File / ID | PNG size | Frame size / count | Bytes | Key / owner | Disposition |
|---|---|---|---|---|---|
| public/assets/sprites/hero.png / hero | 192×48 | 48×48 / 4 | 594 | hero_sprite; Player in Village/Forest | Improve/replace: directional states and weapons |
| public/assets/sprites/moctinh.png / moctinh | 192×48 | 48×48 / 4 | 648 | moctinh_sprite; melee-role Enemy | Improve Mộc; do not count reuse as every melee species |
| public/assets/sprites/matroi.png / matroi | 128×32 | 32×32 / 4 | 345 | matroi_sprite; ranged-role Enemy | Improve Ma; other ranged silhouettes missing |
| public/assets/sprites/hoyer.png / hoyer | 384×96 | 96×96 / 4 | 1,234 | hoyer_sprite; legacy Enemy and Boss ho-yeu | Improve/replace feline directions/phases/attacks/death |

Producer: `scripts/generate-sprites.js`, local PNG encoding with Node filesystem/zlib. Transparent runtime PNGs exist; animation ranges hard-coded in loader, not sidecar metadata. Hero/Hổ sheet previews inspected; standalone previews do not prove in-game alignment or premium quality. No exported tileset, environment atlas, NPC portrait, equipment overlay or item icon file found in public/assets at initial audit.

## Runtime/procedural inventory

| System | Observed code | Missing production content/evidence |
|---|---|---|
| Preload | VillageScene/ForestScene call loadGameAssets and createGameAnimations | Browser load-error/missing-texture check; directional metadata integration |
| Player | Sprite preferred, actor fallback; initially hero_attack shared across combos, flipX only | Four facings, full authored action set, equipment body/weapon changes |
| Enemy | Current Enemy.ts selects Mộc for melee, Ma for ranged, Hổ for legacy ho-yeu; charge/ambush primitive silhouettes | Sixteen distinct common/elite identities, per-kind sprite bindings |
| Boss | Only spriteKey hoyer resolves raster; three others createProceduralBossArt | Unique sheets and state playback; boss phases/attacks/deaths |
| NPC | Three local village roles via actor, clickable zones, text dialogues | Twelve remaining catalog NPCs; fifteen final sprites/portraits/role actions |
| World | art.ts: paintVillage, paintBambooForest, paintSwampWater, paintMountainTemple, paintPhongChauArena | Authored terrain/props, full capital scale, ambient animation, depth approval |
| Combat | Graphics arcs/lines/shockwave, tweened sparks/text, camera shake | Bespoke weapon/skill FX, measured budgets, reduced motion, clock-safe hit-stop |
| UI | Shapes/bronze rivets/canvas labels; HTML controls/settings modal | Ornament/icons/portraits, actual mobile typography/layout approval |

Keep fallback for development/load failure. Important placeholder presentation must be replaced for release; inventory does not authorize deleting code.

Mid-audit coordinator foundation now source-verified: `src/game/rendering/GraphicsSettings.ts` persists Low/Medium/High and reduced motion; ambient counts 0/10/24, combat spark counts 1/4/8. Reduced motion/OS preference sets both counts to zero and shake budget false. `Atmosphere.ts` creates bounded motes with shutdown cleanup; MenuScene provides accessible select/checkbox and storage-failure feedback. This adds procedural atmosphere/settings, not final regional lighting. Coordinator reported graphics self-check/build PASS; documentation worker separately runs the focused check. All camera paths are not yet proven gated.

## Scene and world inventory

Six registered classes in main.ts: MenuScene, VillageScene, ForestScene, VictoryScene, EndingScene, GameOverScene; keys Menu, Village, Forest, Victory, Ending, GameOver. Four combat chapters reuse ForestScene with ChapterWorld config/painters; not four independent regional scenes.

| Region / chapter | Current presentation | Required production kit |
|---|---|---|
| lang-lac-thuy / village | VillageScene + paintVillage | Stilt houses, rice, fence, path, landing/well, tree, smith/healer houses, household props |
| rung-truc-u-minh / 1 | ForestScene + paintBambooForest | Bamboo/path/moss/root kit, corruption, canopy, Hổ arena |
| dam-thieng / 2 | ForestScene + paintSwampWater | Shore/water/lotus/submerged wood/ruins, ripple/reflection, serpent arena |
| nui-tan-vien / 3 | ForestScene + paintMountainTemple | Cliff/path/waterfall/cloud/temple/statue kit, stone arena |
| phong-chau / 4 | ForestScene + paintPhongChauArena | Capital/court/citizen/soldier/brazier/standards, ritual arena |

Three catalog dungeons: dong-am-hon, thuy-cung-phe-tich, dia-cung-co-loa. No dedicated dungeon scene/route found; art and playable integration remain. Chapter barriers exist; collision code does not prove correct decorative occlusion.

## Creature/NPC obligations

contentCatalog.ts defines twelve common enemies, four elites; current config.ts exposes their runtime stat/role roster plus three legacy aliases. Earlier QA_REPORT.md saying only two runtime common enemies is stale relative to source. Stat support does not prove unique art or browser-tested spawns.

| Region | Common IDs requiring individual silhouettes | Elite ID |
|---|---|---|
| Forest | moc-tinh-con, ma-troi-u-am, soi-rung-hac-am, dia-yeu-canh-truc | bach-trao-ho-ma |
| Swamp | thuy-quai-tam-ngu, dia-dia-khong-lo, bo-cap-dam-lay | giao-long-thuy-than |
| Mountain | thach-hau-cuong-bao, dieu-sat-tan-vien, thach-binh-co | thach-giap-nguu-ma |
| Capital | hac-an-ve-si, u-linh-cung-thu | am-anh-quy-vuong |

Bosses: ho-yeu, thuong-luong, thach-tuong, hac-an; two data-defined phases each. Collider radii in bosses.ts: 38/46/52/46 logical pixels, not PNG dimensions. Only Hổ has a PNG, 96×96 frames; others are Graphics bodies with no exported frame count. Telegraph/mechanic definitions do not prove animation completion; action obligations in ANIMATION_SPEC.md/VFX_DESIGN.md.

Fifteen named NPC IDs by region:

- Village: village-chief, village-smith, village-healer, ngu-ong-ba-vi.
- Forest: tho-san-tan-vien, dao-si-truc-lam.
- Swamp: tien-nu-dam-sen, thuy-toc-lao-nhan, thuong-nhan-van-lang.
- Mountain: tu-si-tan-vien, chien-tuong-son-cuoc, linh-y-nui-cao.
- Capital: quan-thi-ve-phong-chau, te-tu-hoang-cung, ky-nhan-khong-lo.

At initial audit only first three roles were instantiated. Latest NpcRoster source expands chapter-dependent village rosters as noted above; all fifteen still need unique final sprites/portraits, complete interaction proof and intended world placement review.

## Equipment/items/skills

Nine item IDs in items.ts: herbal-balm, spirit-tea, bronze-spear, battle-axe, lac-sword, bamboo-armor, jade-charm, spirit-stone, bronze-scrap. No dedicated exported icons at initial audit. Produce weapon/armor/accessory/potion/material icons; quest-item/rare-item coverage follows actual content wiring, not invented counts. Weapon equip changes data-driven combat, not an approved hero overlay set.

Twelve skill definitions: earth-shockwave, stone-armor, mountain-cleave; flame-beam, blazing-dash, sun-burst; tidal-surge, dragon-vortex, sacred-spring; spear-thrust, axe-whirlwind, lac-blade-dance. Twelve distinct icon/presentation briefs, not three recolored circles. Three divine families need tree nodes/connections and equip/cooldown states.

## New-asset record

Record ID/content ID, category/description, file, measured dimensions/frame count, pixel scale/palette, direction/state mapping, editable source, intended scene, priority, producer/license, loader key/entity binding, collider/anchor, gate evidence and status. Concepts remain CONCEPT, never FINAL. Refresh this initial table after other workers settle; retain historical values as baseline rather than treating them as current.
