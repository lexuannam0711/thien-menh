# Thần Mệnh Online — M0 Codex Audit

- **Ngày audit:** 2026-10-14
- **Phạm vi:** `package.json`, gameplay systems/entities/scenes, UI/input, self-check scripts, các master prompt; read-only ngoài file report này.
- **Current milestone:** **M0 — audit/baseline offline.** Repo hiện vẫn là Phaser client single-player; chưa có M1 Auth, M2 authoritative room, hay M3 server combat.

## Implemented evidence (hiện trạng thực tế)

### Client/runtime

- `package.json:6-37` có Vite + TypeScript + Phaser `4.2.1`; scripts là build và local self-checks. Không có `@supabase/supabase-js`, Colyseus, WebSocket client/server, backend workspace, migration, RLS policy hay server process.
- `src/game/systems/GameState.ts:136-201` giữ singleton state trong browser; `load()`/`save()` đọc ghi `localStorage` key `than-menh-van-lang-mvp-v1` (`:30`, `:142-167`). `earn()` cộng gold/XP, level, HP/MP, attack rồi save (`:181-197`). Đây là save offline phía client, không phải persistent trusted storage.
- `src/game/entities/Player.ts:226-290` đọc InputManager/keyboard/touch, tự tính tốc độ và gọi `moveInWorld`, rồi đặt trực tiếp vị trí Phaser (`:275-283`). `attack()` khóa combo/cooldown cục bộ và phát `actions.basic` (`:345-364`); `useSkill()` tự chạy `castEquippedSkill`, trừ MP/cooldown, cập nhật `gameState` và gọi `actions.skill` (`:387-420`); `hit()` tự trừ HP trong `gameState` (`:465-485`).
- `src/game/systems/CombatSystem.ts:24-96` là combat authority hiện tại của client: tính critical/damage/range/knockback, kiểm tra khoảng cách/dot, gọi `Enemy.damage()`/`BossSystem.damageBoss()`. Không có request intent hoặc server reconciliation.
- `src/game/entities/Enemy.ts:113-245` chạy AI/movement/windup/charge/ranged/ambush trên render update; enemy gọi `player.hit()` trực tiếp (`:151-188`). `damage()` trừ HP, áp knockback, death và callback reward (`:265-282`).
- `src/game/scenes/ForestScene.ts:148-225`, `DungeonScene.ts:85-145`, `VillageScene.ts:150-368` tick player/enemy/projectile/boss và ghi quest/reward vào `gameState`; scene callbacks tạo `Enemy`/`CombatSystem`, không có room/session boundary.
- UI/input tồn tại và đã kiểm tra: `src/game/input/*`, `src/game/ui/TouchControls.ts`, `src/game/ui/screens/ControlsSettings.ts`; chúng tạo local action events, chưa gửi network intents.

### Prompt alignment

`THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md:37-56,64-95` yêu cầu Phaser client chỉ input/render, Supabase Auth cho identity, Colyseus/Node authoritative game server, PostgreSQL persistence, Realtime chỉ presence/social. Roadmap M0/M1/M2/M3 nằm ở `:478-510`; report format/DoD ở `:686-695` và `:638-652`.

## Client/server boundary cần chuyển

| Hiện tại trên client | Authority đích | Files/modules cần tách hoặc thay thế |
|---|---|---|
| Vị trí, tốc độ, collision, dodge/i-frame (`Player.ts:262-283,366-377`) | Game server tick + movement validator | `Player.ts`, `WorldBounds.ts`, `InputManager.ts`; thêm shared input schema và server movement validator |
| Combo, cooldown, critical, hitbox, damage (`CombatSystem.ts:27-96`, `Player.ts:345-420`) | Server CombatAuthority | `CombatSystem.ts`, `SkillCombat.ts`, `data/weapons.ts`, `data/skills.ts`; client chỉ gửi `attack/cast_skill` intent và render ack |
| Enemy AI, projectile, boss state (`Enemy.ts:113-245`, scenes update) | Server WorldSimulation/EnemyAI | `Enemy.ts`, `Projectile.ts`, `BossSystem.ts`, Forest/Dungeon scene loops |
| HP/MP, death, kill credit, quest, XP/gold/loot (`Player.ts:465-485`, `GameState.ts:181-197`, scene callbacks) | Server + transactional persistence | `GameState.ts`, `QuestSystem.ts`, scene callbacks; Supabase schema/RLS/repository/migrations chưa tồn tại |
| Browser save (`GameState.ts:142-167`) | Server checkpoint/profile/inventory | `GameState.ts` becomes cache/reconciler; new Auth/session/persistence modules |
| Keyboard/touch/UI feedback | Client presentation; server validates intent | `src/game/input/*`, `src/game/ui/*` remain presentation/input adapters; add network status/reconciliation UI |

## Tests and actual results

Commands run locally, no dev server:

- `npm run build` — **PASS**, `tsc --noEmit` + Vite production build; 70 modules transformed, generated JS 1,730.75 kB (gzip 465.69 kB). Vite emitted chunk warning (>500 kB), not a failure.
- `npm run check:save` — **PASS** (`Save normalization and overwrite protection self-check`).
- `npm run check:rpg` — **PASS** (RPG, boss, quest, dungeon checks; 5 boss suites shown passed).
- `npm run check:player-status` — **PASS** (status/equipment/death/cleanup suites).
- `npm run check:controls` — **PASS** (8 controls/settings/UI/input suites).

Not run: browser/device smoke, two-client networking, Supabase/Auth/RLS tests, server tests, load/latency/reconnect/security tests, production deployment checks. No test proves multiplayer readiness.

## Build status

**Green baseline for current offline client.** Build is not evidence of online readiness. Existing untracked `THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md` was preserved; no source/dependency changes made. Vite chunk-size warning should be tracked before release but is not an M0 blocker.

## Security review

- **Critical architectural risk:** client is authoritative for movement, combat, HP/MP, cooldown, enemy AI, rewards, quest progression and save. A modified browser bundle can forge these values; `GameState.normalizeSave()` bounds malformed data but cannot establish trust (`GameState.ts:74-133`).
- **Persistence/economy risk:** `localStorage` is user-editable and `earn()` writes gold/XP locally (`GameState.ts:158-197`); it cannot support secure cross-device progression or anti-duplication.
- **Missing auth boundary:** no Supabase package/config/session/JWT verification is present (`package.json`, `src/` search); user identity and character ownership are undefined.
- **Missing network validation:** no versioned typed protocol, payload limits, sequence/idempotency, origin checks, rate limiting, reconnect policy, or server-side authorization is present. These are required by prompt sections 02, 03, 08.
- **Secret posture:** no secrets were inspected or printed; no privileged key path was found in the inspected client tree. Future Supabase secret/service credentials must remain server-only.

## Blockers and exact work for M1–M3

### M1 — Supabase Auth + profile

**Blockers:** no Supabase dependency/config, auth UI/session lifecycle, migrations, profile/character schema, RLS, or server identity verifier. Must define public env handling, token refresh/logout, ownership policies, and negative authorization tests before claiming M1. Candidate new modules: `src/online/auth/*`, `supabase/migrations/*`, server-side verifier/repository (location not yet present).

**Gate:** two accounts; A cannot read/update B profile; reload/logout/relogin preserves only authorized state.

### M2 — authoritative room

**Blockers:** no backend package/process, Colyseus dependency, room classes, JWT join verification, shared schema, remote-player renderer, prediction/reconciliation, WSS/reconnect policy. Existing scene loops are local (`ForestScene.ts:148-157`, `DungeonScene.ts:85-90`). Must choose/pin compatible server/client versions and add two-browser test harness.

**Gate:** two authenticated users join same room, see each other’s server-owned identity and movement; forged `userId` ignored; reconnect does not duplicate actor.

### M3 — multiplayer combat

**Blockers:** all combat/AI/outcomes are synchronous local calls (`CombatSystem.ts:44-64,83-94`; `Enemy.ts:151-188,265-277`). Need server tick, validated intent protocol (`move`, `attack`, `cast_skill`, `dodge`, `interact`), authoritative hitbox/damage/HP/cooldown/i-frame/enemy AI/loot, client reconciliation and deterministic two-client tests. Existing VFX/audio can stay client-side after server event acknowledgment.

**Gate:** two clients damage one server enemy with valid results; forged damage/gold/position has no effect; cooldown/i-frame cannot be bypassed; death/loot/quest event is idempotent.

## Next highest-priority work

1. Freeze this M0 baseline and write the minimal protocol/authority contract from actual fields in `GameState`, `Player`, `Enemy`, `CombatSystem`.
2. Add M1 auth/profile schema + RLS and server token verification in a separate backend-owned path; keep current offline save as migration fallback until server state is proven.
3. Implement M2 room join/state sync with two-client tests before moving any combat logic.
4. Port M3 simulation in slices (movement, then enemy/combat, then rewards), with server rejection/reconciliation tests and no client-trusted economy.

## Release gate status

- M0 source audit/baseline: **PASS for this report**; existing offline gameplay build/checks green.
- M1 Auth/profile: **BLOCKED / not started**.
- M2 authoritative networking: **BLOCKED / not started**.
- M3 server combat: **BLOCKED / not started**.
- Online 1.0 release: **NOT RELEASE-READY**; prompt requires M1–M9 gates, two-client/browser/mobile/security/load/persistence evidence not present.

## Scope and git evidence

Before audit: `git status --short --branch` showed `## master...origin/master` plus only untracked `THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md`. This task created/edited only `docs/ONLINE_M0_CODEX_AUDIT.md`; the master prompt and all pre-existing files were preserved. Re-run `git status --short` and `git diff --check` after this report to verify ownership and whitespace.
