# Kế hoạch phát triển — Thần Mệnh: Hậu Duệ Văn Lang

## Mục tiêu phát hành

Vertical slice HTML5 chơi trọn vẹn 10–15 phút trên desktop và mobile landscape:

`Menu → Làng → nhận nhiệm vụ → Rừng Trúc → 6 quái → Hổ Yêu 2 phase → về làng → trả nhiệm vụ → Victory`.

Không mở rộng backend, tài khoản, multiplayer hoặc leaderboard trước khi vòng chơi cốt lõi đạt acceptance.

## Trạng thái đầu vào

- `master` hiện giữ vertical slice playable, build PASS.
- Worker commits chưa merge: `b3ea1ff` save; `6e6bdaa` combat; `c5a93cc` procedural art.
- Ba worker build PASS; chưa có browser/mobile/save-reload/FPS proof.
- Asset procedural đã tích hợp vào scene hiện tại; animation registry đã được mở rộng.

## Luật phối hợp

- Admin duyệt merge trước khi nhập worker branch vào `master`.
- Codex sở hữu gameplay/system/test; Antigravity sở hữu art/animation/VFX/UI visual.
- Mỗi worker sửa path riêng; không sửa cùng file trong cùng wave.
- Worker commit local, không push, không deploy.
- Sau `worker_done`, coordinator review diff + chạy acceptance rồi release terminal.
- Build xanh không được xem là proof browser, mobile, persistence hoặc gameplay.

## Wave 0 — Tích hợp nền tảng

**Owner:** Coordinator + Codex

**Thứ tự:** `p0-save → p1-combat → p1-art`.

**Acceptance:** `master` sạch; `npm run build` PASS; `git diff --check` PASS; save malformed/out-of-range/version cũ không crash; combat callback không breaking; art factory có primitive fallback.

## Wave 1 — Combat feel

**Owner:** Codex

**Files:** `Player.ts`, `Enemy.ts`, `CombatSystem.ts`, `Hud.ts`, `config.ts`.

- Chốt combo 3 đòn, cửa sổ `689/690/691 ms`.
- Hit-once theo target cho từng attack instance.
- Tách combat clock khỏi cooldown clock.
- Dodge i-frame, cooldown, hướng và giới hạn map.
- Hit-stop, hit flash, damage number, knockback, stagger.
- HP bar quái/boss, cooldown/MP HUD.
- Giới hạn VFX/screen shake trên mobile.

**Self-check:** combo không kẹt; một hit không damage lặp; hit-stop không kéo cooldown; quái chết không attack/reward lần hai; dodge không kích hoạt chồng.

## Wave 2 — FSM, ranged enemy, boss

**Owner:** Codex

**Tạo:** `src/data/enemies.ts`, `EnemyAISystem.ts`, `Boss.ts`, `Projectile.ts`.

- Mộc Tinh: `Idle → Chase → Telegraph → Attack → Recovery → Hit → Dead`.
- Ma Trơi: giữ khoảng cách, bắn projectile, telegraph/cooldown riêng.
- Hổ Yêu: phase 1 cận chiến; phase 2 dưới 50% HP, tốc độ/AOE/recovery khác biệt.
- Projectile/VFX dọn khi scene shutdown; XP/gold idempotent; không allocation lớn trong `update()`.

## Wave 3 — Collision và scene lifecycle

**Owner:** Codex

**Tạo:** `src/game/world/CollisionGrid.ts`, `TransitionZones.ts`, `src/data/spawns.ts`.

**Sửa:** `VillageScene.ts`, `ForestScene.ts`, `Player.ts`, `TouchControls.ts`.

- Collision tường/vật cản, camera bounds, portal rõ ràng.
- Dọn timer/listener/collider khi đổi scene.
- Reset pointer ở `pointercancel`, `blur`, `visibilitychange`.
- Không spawn trùng sau restart.

**Acceptance:** chuyển scene 10 lần không nhân listener; không xuyên tường/ra map; joystick không kẹt; chết/quay làng không mất save.

## Wave 4 — NPC, quest, RPG

**Owner:** Codex

**Tạo:** `src/data/npcs.ts`, `items.ts`, `quests.ts`, `NPCSystem.ts`, `QuestSystem.ts`, `InventorySystem.ts`, `EquipmentSystem.ts`.

- NPC data-driven: dialogue, service, condition, quest IDs.
- Quest states: `Locked`, `Available`, `Active`, `Completed`, `RewardClaimed`.
- Trưởng làng giao/trả quest; Thợ rèn nâng cấp; Bà Mo hồi HP/MP.
- Inventory stack không âm; equipment thay đổi stats qua một nguồn tính toán.

**Acceptance:** dialogue đổi đúng; reward một lần; reload không reset quest; gold/XP/HP/MP luôn hợp lệ.

## Wave 5 — Art và animation

**Owner:** Antigravity; Codex tích hợp runtime

- Player 4 hướng: `idle`, `run`, `attack1`, `attack2`, `attack3`, `dodge`, `hurt`, `death`.
- Mộc Tinh, Ma Trơi, Hổ Yêu: idle/run/attack/hit/death.
- NPC: Trưởng làng, Thợ rèn, Bà Mo.
- VFX: slash, fire, earth, impact, telegraph, projectile.
- Props: nhà sàn, tre, ruộng, cổng làng, trống đồng, đền, đá, bụi cây.
- Palette: đất/nâu làng; xanh sẫm/tím rừng; đồng/vàng thần lực; đỏ hỏa kỹ.

**Contract:** nearest-neighbor; frame/origin/hitbox ổn định; procedural hoặc tự vẽ; texture cache theo key; primitive fallback luôn hoạt động; không generate texture trong `update()`.

**Integration:** bootstrap asset generation ở scene lifecycle; cập nhật `src/game/ui/art.ts`; dọn resource khi shutdown.

## Wave 6 — UI/UX mobile

**Owner:** Antigravity + Codex

- HUD rõ HP/MP/XP/gold/quest.
- Skill button hiển thị cooldown/MP.
- Multi-touch joystick + combat.
- Landscape hint; pause khi background.
- Font tiếng Việt đúng encoding.
- Modal không che boss telegraph.
- Audio chỉ bắt đầu sau user gesture.

## Wave 7 — Browser vertical slice

**Owner:** QA/Coordinator

Chạy thật trên Chromium desktop, Android Chromium, iPhone Safari landscape:

1. Menu → Village → nhận quest.
2. Village → Forest → collision.
3. Combo, dodge, Q, E.
4. Hạ 6 quái; boss phase 1 → phase 2 → chết.
5. Về làng → trả quest → Victory.
6. Reload giữ save; reset save có xác nhận.
7. Console không có lỗi nghiêm trọng.

Mỗi mục ghi thiết bị, build, thời điểm và kết quả; chưa chạy ghi `unverified`.

## Wave 8 — Release/performance

- `npm run build`, `npm run preview`.
- Texture atlas/cache; object pool projectile/VFX.
- Giảm allocation trong `update()`.
- Đo FPS/heap trên thiết bị yếu.
- Kiểm tra 30 phút gameplay liên tục.
- Theo dõi bundle warning hiện tại `1,400.88 kB` minified.
- Chỉ tuyên bố release-ready sau browser + mobile + persistence proof.

## Definition of Done

- Core loop hoàn chỉnh từ Menu đến Victory.
- Combat, AI, NPC, quest, save có acceptance evidence.
- Asset tự vẽ/procedural đủ actor, animation, VFX, props.
- Desktop và mobile landscape đã chạy thật.
- Build sạch; lỗi còn lại được ghi rõ.
- Không push/deploy nếu Admin chưa yêu cầu.
