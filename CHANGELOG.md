# Changelog

## NPC Minigames & Festival Tokens 1.0.0 — 2026-10-14

### Added
- **3 NPC Lễ Hội Dân Gian tại Làng Lạc Thủy (`VillageScene`):**
  - **Thầy Thẻ Lạc** (x: 380, y: 220): Quản lý trò thẻ bài cổ truyền **7321**.
  - **Lão Đồng Xúc** (x: 720, y: 260): Quản lý trò gieo xúc xắc **Xúc Xắc May Mắn**.
  - **Nàng Họa Linh** (x: 560, y: 480): Quản lý trò đoán linh vật Bách Việt **Nhìn Hình Đoán Thú**.
  - Vị trí tọa độ được bố trí thông thoáng, vùng tương tác bán kính 80px qua phím `F` / Chạm màn hình, bảo toàn nguyên vẹn 15 NPC cốt truyện danh định.
- **3 Minigames Dân Gian Hoàn Chỉnh:**
  - **7321:** Sử dụng bộ bài 52 lá chuẩn, xáo bằng Fisher-Yates CSPRNG. Tính điểm Ace 1/11 tối ưu, Dealer tự rút dừng ở Soft 17, giấu kín lá bài thứ hai của dealer (`hidden: true`), hỗ trợ Natural 21, rút (`HIT`), dừng (`STAND`) và quắc (`BUST`).
  - **Xúc Xắc May Mắn:** Gieo 3d6 (tổng 3..18) độc lập. Dự đoán Tài (11..17), Xỉu (4..10). Bộ Ba Đồng Số (1-1-1 đến 6-6-6) là Hòa đặc biệt nhận điểm tham gia, loại trừ khỏi Tài/Xỉu. Kiểm chứng trọn vẹn 216 tổ hợp (105 Tài, 105 Xỉu, 6 Bộ ba).
  - **Nhìn Hình Đoán Thú:** Dự đoán 1 trong 6 linh vật Bách Việt (Bầu, Cua, Cá, Cọp, Gà, Nai) với 3 viên xúc xắc quay độc lập (tỷ lệ trúng ít nhất một con lý thuyết 91/216 = 42.1296%).
- **Cơ Chế Thưởng Phi Tiền Tệ & Giới Hạn Lễ Hội:**
  - Hệ thống điểm danh dự **FestivalPoints**: Không quy đổi tiền thật, không mua bán vé ảo, không chuyển nhượng P2P, không cash-out.
  - Hạn mức 3 lượt chơi miễn phí mỗi ngày cho từng trò chơi (`daily_limit = 3`), tự động làm mới vào 00:00:00 theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh` UTC+7).
- **Giao Diện & Trải Nghiệm Người Dùng (Ancient Bronze Festival UI):**
  - Bộ visual họa tiết trống đồng Đông Sơn, màu nâu đồng/đất son ấm áp, responsive landscape trên PC lẫn Mobile.
  - Bộ phát sinh hình ảnh canvas theo thủ tục (`MinigameArtwork.ts`) cho thẻ bài, mặt xúc xắc 1..6 và 6 biểu tượng linh vật.
  - Hệ thống cô lập điều khiển (`InputContextManager`): Thiết lập modal barrier hấp thu hoàn toàn sự kiện `pointerdown` (ngăn chém kiếm xuyên UI xuống world) và khóa phím kỹ năng 1..4 / phím di chuyển WASD khi đang mở minigame.
- **Kiến Trúc & An Ninh Authoritative Server:**
  - Migration Supabase PostgreSQL gồm 8 bảng dữ liệu cốt lõi, bật RLS toàn phần, cấm hoàn toàn quyền `INSERT`, `UPDATE`, `DELETE` từ phía client.
  - Máy chủ authoritative Node.js/Express quản lý máy trạng thái ván chơi, xác thực danh tính JWT Supabase và sử dụng CSPRNG `node:crypto.randomInt`.
  - Cơ chế Idempotency token (`actionId`, `requestId`) chống gửi trùng lặp (double-click/replay) và ghi sổ cái phần thưởng nguyên tử (`minigame_reward_ledger`).

### Verified & QA
- Hoàn thành kiểm thử 100% qua 4 bộ test suites tự động:
  - `npm run check:minigames-db`: Đạt 22/22 kịch bản ma trận bảo mật và phân quyền RLS.
  - `npm run check:minigames`: Đạt 7/7 suites, bao gồm mô phỏng thực tế 100.000 lượt CSPRNG (xúc xắc phân phối đều ~16.67%, đoán thú đạt 42.148% so với lý thuyết 42.130%).
  - `npm run check:minigames-client`: Đạt 5/5 suites kiểm thử MinigameClient, gameplay flow và Input Isolation.
  - `npm run check:minigames-world`: Đạt 5/5 suites kiểm thử vị trí NPC, va chạm an toàn và tích hợp VillageScene.
- Nghiệm thu đạt 17/17 tiêu chí Definition of Done (DoD) trong Section 20 của MASTER PROMPT.
- Biên dịch production thành công: `npm run server:typecheck` và `npm run build` không có lỗi.
- Đầy đủ 4 tài liệu kỹ thuật chuẩn mực: `MINIGAME_IMPLEMENTATION_STATUS.md`, `MINIGAME_RULES.md`, `MINIGAME_ARCHITECTURE.md`, `MINIGAME_SECURITY_QA.md`.

## Unreleased — 2026-10-13

- Require native confirmation before restarting through canvas, keyboard or accessible menu controls.
- Preserve unreadable/unsupported saves; prevent autosave from replacing them until an explicit new game. Surface recovery warnings in Menu/HUD and failed-write warnings in HUD; successful retries clear write warnings.
- Add isolated RPG-menu native V8 unit coverage evidence. Source-line/function metrics are scoped, not full-source/branch acceptance.
- Document rollback without deleting player storage. Production rebuild and browser acceptance of these changes remain pending while the previous candidate is under exclusive long-duration stress.

## 1.0.0 target — 2026-10-12 (not release-approved)

- Integrated four-chapter campaign, bosses, RPG systems, content catalogs and procedural audio.
- Added pause, game-over, save metadata, release docs and focused self-checks.
- Fixed multi-chapter progression by resetting the legacy campaign quest and testing chapter advancement through Ending.
- Wired existing dodge, damage, enemy-reward and boss SFX at authoritative events.
- Added touch controls, settings/help accessibility layer and static deployment guidance.
- Remaining runtime acceptance gates are documented rather than overstated.
- Wired all four equipped skill slots, water casting, healing and enemy status effects; preserved power selection and empty loadouts across reload.
- Connected spear/axe/sword to actual melee reach, combo damage, knockback and attack timing; exposed all recipes through one crafting registry.
- Added shop/crafting pagination, in-game credits, chapter-aware dialogue and repeatable production-browser regressions.
- Corrected readiness reporting: catalog completeness is not playable-content completeness; NPC/enemy/dungeon/quest integration remains required.
