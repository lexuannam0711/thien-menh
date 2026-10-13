# Thần Mệnh — Visual Style Guide

## Verified foundation versus proposed standard

October 12, 2026 initial snapshot; concurrent sprite/preset work may supersede contracts. Recheck loader and exports before production.

| Property | Observed | Production rule / open verification |
|---|---|---|
| Engine | Phaser 4.2.1 in package.json | Installed Phaser 4 APIs/types; no assumed Phaser 3 shader compatibility |
| Viewport | config.ts: 960×540 | Preserve visibility; evaluate integer letterboxing without clipping safe areas |
| Filter/scale | main.ts: FIT, AUTO, pixelArt true, antialias false | Nearest sprites; browser-check fractional scaling and camera shimmer |
| Camera | No explicit follow/bounds/roundPixels setup found initially | Fixed spaces do not prove scrolling-camera correctness; test when maps expand |
| Terrain | Graphics primitives, no authored tile atlas | Proposed 32×32 tiles; preserve collision/portal coordinates |
| Hero | 48×48, sprite (0,-6), default center origin, depth 30+y/10 | Initial compatibility 48×48; 48×64 only with loader/anchor review |
| Monsters | Mộc 48×48; Ma 32×32; per-kind tint/scale | Unique silhouettes and matched apparent pixel density |
| Boss | Hổ 96×96; others radius-driven Graphics | Proposed 96–160px frames per body/arena; collider radius is not PNG size |
| Text | Arial/system sans-serif with outline | Vietnamese glyph coverage; decoration never reduces clarity |

Proposed sizes are starting briefs, not delivered assets. Directional worker may replace legacy four-frame layout with metadata; do not hard-code old offsets in new art.

## Palette tokens

| Family | Colors | Use |
|---|---|---|
| Village | #81995D, #C6A66B, #8A6248, #684A39, #E8C991 | Rice, straw, earth, wood, morning |
| Forest | #203B34, #497459, #728857, #654A88, #172A2B | Canopy, bamboo, moss, corruption, shadow |
| Divine | #E9C36B, #F28B45, #5CB9D5, #B8A16A | Sacred gold, fire, water, earth |
| Bronze UI | #3A302C, #CBA968, #E8D8B4, #F5D88A | Panel, border, text, focus/selection |
| Swamp extension | #173D3A, #315E55, #5CB9D5 | Proposed water, foliage, spirit accent |
| Mountain extension | #39464A, #87918B, #B8A16A | Proposed stone, mist, sacred trim |
| Capital extension | #352C2C, #CBA968, #654A88 | Proposed bronze ceremony versus void |

Target palette does not imply current PALETTE constants match. Tune ramps in scene exposure; avoid uncontrolled hue changes. Friendly FX and hostile warnings differ by shape as well as hue.

## Export/integration contract

1. Brief specifies ID, category, scene, dimensions, pixel scale, palette, directions/states/frame count, format, priority, owner and provenance.
2. Preserve editable source; lowercase descriptive IDs linked to content IDs. Keep runtime keys stable until integrating owner migrates references.
3. Transparent PNG, stable canvas/feet anchor, no stray edges. Explicitly declare centered offsets versus feet origin; never silently change them.
4. Atlas trim retains source size/pivot; extrude edges and pad against bleed. Proposed 2px gutter requires exporter/loader verification.
5. Metadata declares ordered frames, rate/repeat, interruptions, collider anchor. Visual reach follows gameplay geometry, never secretly changes it.
6. Shared loader, real state/direction call sites, feet-based depth, shadow behind actor, warning below feet, impact above bodies, HUD above all.
7. Test scene/restart/return, update measured inventory/provenance/five-gate records; only then FINAL.

No sprite/atlas metadata file existed at initial audit. Later same-day source refresh found spriteManifest.ts with four directions, explicit pose ranges/rates and feet values; loader consumes dimensions/ranges. Entity-origin use still needs review. Current sheets now extend to 3264px width; test device texture limits/memory and choose packing strategy after measurement. Atlas packing, regional lazy loading and compression remain tasks. Never rerun an older generator over directional worker exports.

## Lighting/presentation

Upper-left material highlights; contact shadows below feet. Prefer baked light, region ambient, restrained local overlays/additive glow before shaders. Existing ellipse shadows/tints are fallback, not complete lighting approval.

Low/Medium/High may reduce fog, weather, ambient animation, glow and decorative particles, never warnings or essential hit feedback. Reduced shake applies across player/enemy/boss/scene callers. Coordinator owns presets; QA owns browser/device proof.
