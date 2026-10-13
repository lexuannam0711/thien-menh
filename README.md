# Thần Mệnh: Hậu Duệ Văn Lang

HTML5 2D Hack & Slash Action RPG, development build targeting `1.0.0`. Phaser 4.2.1 + TypeScript + Vite. Procedural art/audio; no backend required. Catalog completeness does not prove playable-content completeness.

## Run

```bash
npm install
npm run dev
npm run check:all
npm run preview -- --host 127.0.0.1
npm run check:browser
npm run check:campaign
npm run build
```

Serve `dist/` from a static HTTPS host. Save uses browser `localStorage`; audio unlocks after user interaction.
Browser checks require Node.js 22+ and Chrome/Chromium; run production preview first. They use an isolated profile, not the user's browser session.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | Joystick |
| Combo | J | CHÉM |
| Dodge | Space | NÉ |
| Equipped skills 1–4 | Q / E / R / T | Q / E / R / T |
| Interact | F | F / NPC tap |
| Pause | P / Escape | — |

## Campaign

Village → chapter area → enemies → boss → return → next chapter. Four chapters lead to Victory and Ending. Village includes NPC dialogue, quests, inventory, equipment, skills, shop and crafting.

## Project docs

`GAME_VISION.md`, `GAME_DESIGN.md`, `TECHNICAL_ARCHITECTURE.md`, `CONTENT_BIBLE.md`, `ART_DIRECTION.md`, `ROADMAP.md`, `TASK_BACKLOG.md`, `PROGRESS.md`, `QA_REPORT.md`, `RELEASE_CHECKLIST.md`, `CHANGELOG.md`, `DEPLOYMENT.md`, `PLAY_GUIDE.md`, `KNOWN_LIMITATIONS.md`, `CREDITS.md`.

## Acceptance boundary

Automated subsystem and browser checks do not establish release readiness. Runtime integration and natural production campaign progression now pass. Remaining gates include representative difficulty/pacing, measured coverage, real devices and FPS/heap/30-minute stability; see `RELEASE_CHECKLIST.md`.

October 13, 2026: `npm run check:campaign` exit 0 on current equipment candidate `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`. Fresh save, no boosts/gameplay setters, four chapters, 32 rewarded quests/35 exact payout receipts, four bosses, three naturally unlocked dungeons/nine floors/items, Ending/credits and strict save/reload passed. Evidence: `artifacts/campaign-acceptance.json`, `artifacts/campaign-ending.png`; prior D71 receipt preserved in `artifacts/campaign-snapshots/index-D71EOpKB/`.

The read-only-observer automated route takes about thirteen minutes, not representative human pacing or difficulty. The current uninstrumented run witnessed two natural deaths/revivals. Separate instrumented campaign/UI measured mapped union coverage 86.83% lines/82.90% observed functions; full relevant-source/branch coverage, real devices and sustained stability remain separate gates.
