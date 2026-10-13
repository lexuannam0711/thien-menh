# Thần Mệnh — Asset Provenance Register

## Current editable-source checkpoint — October 13, 2026

All 74 candidate PNG hashes independently match both public and dist copies of index-DAgfL7dU. Six current editable producers cover all delivered families: 11 actor/weapon/boss sheets, 16 enemy sheets, 10 environment sheets, 30 NPC sprites/portraits, one icon atlas, six fitted equipment sheets. Exact generator SHA256 values and the existing per-PNG inventory reference are retained in `artifacts/graphics-qa/2026-10-13/generator-source-provenance-DAgfL7dU.json`. No generator was rerun during the sustained measurement; source attribution is not deterministic regeneration evidence or proof of historical contributor rights.

| Delivered family | Current editable source | Delivered PNGs | Rights status |
|---|---|---:|---|
| Actors/weapons/bosses | scripts/generate-sprites.js | 11 | Contributor attestation OPEN |
| Common/elite enemies | scripts/generate-enemies.js | 16 | Contributor attestation OPEN |
| Regional environment kits | scripts/generate-environments.js | 10 | Contributor attestation OPEN |
| NPC sprites/portraits | scripts/generate-npcs.js | 30 | Contributor attestation OPEN |
| Canonical item/skill icon atlas | scripts/generate-icons.js | 1 | Contributor attestation OPEN |
| Fitted armor/charm layers | scripts/generate-equipment.js | 6 | Contributor attestation OPEN; derived hero artwork |

Source provenance is traceable for this checkpoint. Legal clearance, asset-level approval and final art acceptance remain separate; this record grants no license and closes no unresolved ownership issue. Earlier active-worker and procedural-placeholder statements below remain historical, not the current delivery inventory.

## Coordinator producer refresh — October 12, 2026

`hero_axe.png`, `hero_sword.png`, `thuongluong.png`, `thachtuong.png`, `hacan.png` are original offline exports from the current project-owned `scripts/generate-sprites.js` painters, using Node stdlib and manifest metadata. No external pack, paid API or image-generation service used. Existing hero/Hổ atlas repacking preserves logical source pixels. Exact hashes: `artifacts/graphics-qa/2026-10-12/sprite-manifest-evidence-v2.json`; editable source is the generator. Contributor attestation and final legal/art sign-off remain OPEN; implementation provenance is not a new license grant. NPC sprites/portraits are a separate active offline producer task, not yet accepted in this record.

## Scope and approval boundary

October13 fitted equipment batch: scripts/generate-equipment.js creates six transparent canonical bamboo-armor/jade-charm overlays in public/assets/equipment using existing project hero pixels as fitted masks, original lamellar/jade material coordinates and Node stdlib PNG/zlib only. No external pack, paid API, remote generation or new dependency. Editable source, canonical input hashes and deterministic regeneration are checked by scripts/check-equipment.cjs; coordinator inspected artifacts/graphics-qa/2026-10-13/equipment-before-after.png. These are derived from the project hero artwork, so its contributor-rights attestation still applies; no new license grant, legal clearance or premium art approval is claimed. Runtime/browser/device integration is a separate gate.

Canonical item/skill icons: scripts/generate-icons.js exports21 original offline transparent32px frames in public/assets/icons/rpg-icons.png using Node stdlib only. No external pack, paid API, font, network service or new dependency. Atlas/source regeneration and canonical metadata verified; exact hash in artifacts/graphics-qa/2026-10-12/icon-manifest-evidence.json. Contributor rights attestation and final legal/art approval remain OPEN.

Enemy/environment producers settled: `scripts/generate-enemies.js` and `scripts/generate-environments.js` are original offline coordinate/material painters, stdlib PNG exports, no external pack/API. Coordinator reduced authored floor contrast after live review; current hashes in `enemy-environment-evidence.json` identify this refined output. Editable sources and provenance do not substitute contributor rights attestation or art-director approval.

NPC producer settled: `scripts/generate-npcs.js` exports fifteen original offline role-specific sprites and busts in `public/assets/npcs/`; no downloaded art/API/dependency added. `src/game/assets/npcArtwork.ts` supplies deterministic loader/animation metadata; coordinator integration and PNG/runtime checks pass. Exact hashes: `artifacts/graphics-qa/2026-10-12/npc-manifest-evidence.json`. Rights attestation and final legal/art approval remain open. Earlier active-task statement above is historical.

October 12, 2026 local source audit. This register records observed production origin and missing evidence; it does not invent authorship, permission, external license or legal clearance. No external art downloaded, generated remotely or purchased by this documentation worker. No credential/secret changes.

Existing CREDITS.md says visuals/audio are project-created procedural work and no third-party font/sprite/sample pack added. That statement supports origin tracing, not a blanket license verification. Final provenance owner must confirm authorship/rights and preserve source history for each delivery.

## Current assets

| Asset / family | Observed producer / source | Permission evidence and disposition |
|---|---|---|
| hero.png | scripts/generate-sprites.js hero pixel function | Local generated output; creator/ownership attestation pending; improve/replace, not FINAL |
| moctinh.png | Same generator Mộc pixel function | Same pending provenance sign-off; not FINAL |
| matroi.png | Same generator Ma pixel function | Same pending provenance sign-off; not FINAL |
| hoyer.png | Same generator Hổ pixel function | Same pending provenance sign-off; not FINAL |
| wolf.png | Same generator wolfPose function | Original offline generated charge-role art; no downloaded pack; ownership sign-off pending |
| spider.png | Same generator spiderPose function | Original offline generated ambush-role art; no downloaded pack; ownership sign-off pending |
| Procedural world/NPC shapes | src/game/ui/art.ts, VillageScene.ts | Source-created drawing; source contributor history/ownership review pending |
| Procedural bosses | src/game/entities/Boss.ts createProceduralBossArt | Source-created drawing; no separate external pack found; not approved premium boss art |
| Combat/atmosphere FX | CombatSystem.ts, entities, rendering/Atmosphere.ts | Source-created effects; review source contributor provenance with asset batch |
| Canvas/DOM UI | art.ts, Hud/TouchControls/PauseOverlay/MenuScene, style.css | Source-created panels; no exported font asset found |
| Font rendering | Arial/sans-serif system-font request | No bundled font file found; any later embedded font needs explicit source/license record |
| Phaser renderer | Installed node_modules/phaser/package.json declares MIT, version 4.2.1 | Dependency declaration checked locally; preserve dependency notices through existing project release workflow |

No generated image/API service was used in this worker's task. Initial and later directional generator implementations are visible local code; later generator imports spriteManifest.ts and exports four-direction sheets. Current PNGs measured in ASSET_INVENTORY.md are attributed to this updated producer only at source/disk level, pending contributor attestation and settlement. Future edits must refresh producer records, not inherit older attribution silently.

## Future production record

Latest offline additions: wolf.png and spider.png produced by updated generate-sprites.js/manifest family painters; source and measured outputs exist, no external pack attribution asserted. Both inherit the same pending contributor/permission attestation, not an invented final license. Coordinator screenshots are QA artifacts of the current game, not new approved game assets.

Every delivered PNG/atlas/portrait/icon/tile/VFX/font includes:

- Asset/content ID, runtime path and revision/hash; editable source and producing script/tool/version.
- Creator/contributor, creation date, source source-pack/location if any; original versus derived work.
- Permission/license identifier, retained license text/proof location, attribution requirements and modifications; reviewer/status.
- Generated-image service/model only if actually used, generation record and permitted-use evidence; human pixel/animation cleanup recorded separately. Concept export remains CONCEPT.
- Third-party components/reference transformations explicitly separated from project-created elements; uncertain origin blocks FINAL.

Inventory dimensions/status live in ASSET_INVENTORY.md; this register owns origin/permission evidence, not duplicate asset counts.

## Intake/release checklist

1. Inspect provenance before runtime integration; reject unknown-origin or incompatible-permission packs. Paid purchases/external-account changes require explicit approval outside this task.
2. Preserve license text and editable source in the project's agreed asset/doc structure; do not invent a top-level folder without owner agreement.
3. Record derived changes and attribution; reference mood boards do not grant rights to copy a protected sprite or logo. Vietnamese motifs are design inspiration, not proof of historical authenticity or permission for a particular reference image.
4. Review final packed atlases for accidental untracked third-party fragments; verify inventory and credits agree with delivered files.
5. Provenance reviewer closes each pending entry, then production gate in GRAPHICS_QA.md can pass. Unresolved ownership/license evidence is a release blocker, not a reason to fabricate a license.
