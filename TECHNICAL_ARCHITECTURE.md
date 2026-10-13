# Thần Mệnh — Technical Architecture

## Stack

Phaser 4.2.1, TypeScript 5.9, Vite 8.3. Production output: `dist/`.

## Runtime

`src/main.ts` boots Phaser scenes: Menu, Village, Forest, Victory, Ending, GameOver. Game state is normalized at the boundary in `src/game/systems/GameState.ts`. Combat, boss, quest, inventory, equipment, audio and touch input are isolated modules.

## Verification

`npm run check:all` runs typecheck/build plus save, RPG, content/audio and RPG-menu self-checks. Browser/device/performance gates require the target runtime and are reported separately.
