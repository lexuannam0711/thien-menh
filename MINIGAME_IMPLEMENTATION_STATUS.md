# BÁO CÁO TRẠNG THÁI TRIỂN KHAI NPC MINIGAMES & FESTIVAL GACHA
## DỰ ÁN: THẦN MỆNH — HẬU DUỆ VĂN LANG (PHIÊN BẢN 1.0.0)

> **Ngày cập nhật:** 14/10/2026  
> **Chuyên viên QA & Tài liệu:** AGY Worker — Documentation & QA Release Specialist  
> **Trạng thái tổng thể:** **100% HOÀN THÀNH — TẤT CẢ ACCEPTANCE GATES ĐẠT (PASSED)**

---

## 1. TỔNG QUAN HỆ THỐNG VÀ CÁC MILESTONE

Tính năng **NPC Minigames & Festival Gacha** mang không khí hội làng Văn Lang cổ truyền vào thế giới nhập vai *Thần Mệnh: Hậu Duệ Văn Lang*. Toàn bộ hệ thống được xây dựng theo chuẩn authoritative server, tách biệt hoàn toàn giữa giao diện hiển thị (Phaser 4) và logic xử lý ngẫu nhiên, phân định thắng thua, cấp thưởng (Node.js Server + Supabase PostgreSQL RLS).

Hệ thống cam kết tuân thủ nghiêm ngặt nguyên tắc **phi tiền tệ**: chỉ sử dụng điểm thưởng danh dự **FestivalPoints** và lượt chơi miễn phí mỗi ngày, tuyệt đối không có cơ chế nạp rút tiền thật, không mua bán vé ảo và không gây ảnh hưởng tiêu cực tới hệ thống chiến đấu RPG cốt lõi.

### Bảng Tiến Độ 4 Milestone Cốt Lõi

| Milestone | Tên Phân Hệ | Phạm Vi Triển Khai | File Mã Nguồn Trọng Tâm | Trạng Thái |
|---|---|---|---|:---:|
| **M1** | **Database Schema & RLS Security** | 8 bảng dữ liệu, 3 ràng buộc duy nhất, RLS kích hoạt toàn phần, thủ tục lưu trữ nguyên tử (`SECURITY DEFINER`), phân quyền tối thiểu (Least Privilege). | `supabase/migrations/20261014100000_minigames_schema_and_rls.sql` | **100% HOÀN THÀNH** |
| **M2** | **Server Authoritative Engine & Simulation** | CSPRNG an toàn mật mã (`node:crypto.randomInt`), máy trạng thái ván chơi, bộ luật 3 trò chơi (7321, Xúc Xắc May Mắn, Nhìn Hình Đoán Thú), kiểm soát 3 lượt/ngày theo múi giờ Việt Nam, chống gian lận & replay token. | `apps/game-server/minigames/` (`CSPRNG.ts`, `SessionManager.ts`, `RewardService.ts`, `RulesRegistry.ts`, `routes.ts`, `games/*`) | **100% HOÀN THÀNH** |
| **M3** | **Client UI, Graphics & Input Isolation** | Giao diện hội thoại NPC, modal bàn chơi chuyên biệt 3 trò chơi phong cách Đồng Cổ Đông Sơn, procedural pixel artwork, quản lý Input cô lập (`InputContextManager`) chống chém kiếm xuyên UI. | `src/game/minigames/` (`MinigameClient.ts`, `MinigameOverlay.ts`, `MinigameArtwork.ts`, `games/*`), `src/game/ui/InputContextManager.ts` | **100% HOÀN THÀNH** |
| **M4** | **World NPC & VillageScene Integration** | Tích hợp 3 NPC Lễ Hội vào bản đồ Làng Lạc Thủy (`VillageScene`), vùng va chạm và tương tác an toàn (phím `F` / Touch), cách ly tuyệt đối 15 NPC cốt truyện hiện hữu. | `src/game/scenes/VillageScene.ts`, `src/game/minigames/MinigameNpcRegistry.ts` | **100% HOÀN THÀNH** |

---

## 2. DANH SÁCH LỆNH KIỂM TRA & KẾT QUẢ THỰC TẾ

Tất cả các bài kiểm tra được thiết kế tự động, độc lập và có khả năng chạy lặp lại (reproducible) trong môi trường CI/CD:

| Lệnh Kiểm Tra | Phạm Vi Xác Minh | Kết Quả Thực Tế | Ghi Chú |
|---|---|:---:|---|
| `npm run check:minigames-db` | Phân tích cú pháp 113 câu lệnh SQL, cấu trúc 8 bảng, 3 khóa duy nhất, seed data, chính sách RLS và 22 kịch bản bảo mật mock matrix. | **PASSED** (22/22 kịch bản đạt) | Xác nhận không role client nào có quyền INSERT/UPDATE/DELETE trực tiếp. |
| `npm run check:minigames` | Kiểm tra luật chơi 7321 (Ace 1/11, Soft 17), 216 tổ hợp xúc xắc & đoán thú, mô phỏng 100.000 lượt roll CSPRNG, SessionManager, idempotency, anti-replay và Express API routes. | **PASSED** (7/7 test suites đạt) | Sai số tần suất xúc xắc < 0.15%, tỷ lệ đoán thú đạt 42.148% (lý thuyết 42.130%). |
| `npm run check:minigames-client` | Kiểm tra hợp đồng kiểu dữ liệu TypeScript, MinigameClient, logic offline simulation, hạn mức ngày, procedural canvas texture keys và cơ chế Input Isolation chặn pointerdown/hotkeys. | **PASSED** (5/5 test suites đạt) | Pointerdown không xuyên qua world, hotkeys 1..4 & WASD bị khóa an toàn khi mở modal. |
| `npm run check:minigames-world` | Xác thực đăng ký 3 NPC Lễ Hội, kiểm tra tọa độ an toàn không kẹt vật cản làng, bảo toàn 15 story NPC danh định, tích hợp tương tác `VillageScene` và nạp texture modal. | **PASSED** (5/5 test suites đạt) | Tọa độ NPC: Thầy Thẻ Lạc (380, 220), Lão Đồng Xúc (720, 260), Nàng Họa Linh (560, 480). |
| `npm run server:typecheck` | Kiểm tra tính nhất quán và an toàn kiểu dữ liệu TypeScript phía Game Server (`apps/game-server/tsconfig.json`). | **PASSED** (0 lỗi cú pháp) | Typecheck hoàn toàn sạch sẽ, không có cảnh báo kiểu dữ liệu. |
| `npm run build` | Biên dịch toàn bộ client TypeScript (`tsc --noEmit`) và đóng gói bundle ứng dụng web thông qua Vite. | **PASSED** (Vite built 1.15s) | Tạo bundle client hoàn chỉnh sẵn sàng phát hành. |
| `npm run check:all` | Chạy toàn bộ tổ hợp regression test suites của toàn bộ dự án Thần Mệnh. | **PASSED** | Đảm bảo tính năng mới không gây hồi quy lên các hệ thống cũ. |

---

## 3. BẢNG ĐỐI CHIẾU 17 TIÊU CHÍ DEFINITION OF DONE (DOD)

Căn cứ theo **Section 20 (Definition of Done cho tính năng 1.0)** của MASTER PROMPT, dưới đây là bảng nghiệm thu chi tiết từng tiêu chí:

| STT | Tiêu Chí Definition of Done (DoD) | Trạng Thái | Bằng Chứng Kiểm Thử Thực Tế (Evidence) |
|:---:|---|:---:|---|
| **01** | 3 NPC có vị trí thực tế trong làng và tương tác được | **PASSED** | `MinigameNpcRegistry.ts` định nghĩa và `VillageScene.ts` đặt 3 NPC: Thầy Thẻ Lạc (x: 380, y: 220), Lão Đồng Xúc (x: 720, y: 260), Nàng Họa Linh (x: 560, y: 480). Khoảng cách tương tác bán kính 80px, hiển thị prompt phím `F` / Chạm màn hình. Kiểm chứng qua `check:minigames-world` Suite 1 & 2. |
| **02** | Tên mini game hiển thị chính xác: **7321**, **Xúc Xắc May Mắn**, **Nhìn Hình Đoán Thú** | **PASSED** | Tên trò chơi được cố định trong `minigame_definitions`, `MinigameRegistry.ts`, header của `MinigameOverlay` và các UI component con (`SevenThreeTwoOneUI`, `LuckyDiceUI`, `AnimalGuessUI`). |
| **03** | Mỗi NPC có hội thoại, xem luật, chơi, lịch sử, phần thưởng | **PASSED** | Giao diện điều hướng modal cung cấp đủ 5 nút chức năng: **Hội thoại & Giới thiệu**, **Tìm hiểu luật**, **Vào chơi**, **Xem phần thưởng**, **Lịch sử cá nhân**, cùng nút đóng **Rời đi**. Đã kiểm thử qua `check:minigames-world` Suite 5. |
| **04** | 7321 hoạt động từ phát bài đến so điểm và thưởng | **PASSED** | Bộ bài 52 lá chuẩn, xáo bằng Fisher-Yates CSPRNG. Tính điểm Ace 1/11 tối ưu, Dealer tự rút dừng ở Soft 17. Lá bài thứ hai của Dealer được giấu kín (`hidden: true`) cho đến khi mở bài. Phân xử Natural 21, Quắc (Bust), Thắng, Thua, Hòa chính xác. Kiểm chứng qua `check:minigames` Suite 1. |
| **05** | Xúc Xắc May Mắn hoạt động từ chọn cửa đến hiện 3 xúc xắc | **PASSED** | Sinh ngẫu nhiên 3d6 (tổng 3..18) trên server. Xỉu (4..10), Tài (11..17). Bộ Ba Đồng Số (1-1-1 đến 6-6-6) là Hòa đặc biệt nhận điểm tham gia, loại trừ khỏi Tài/Xỉu. Kiểm chứng trọn vẹn 216 tổ hợp qua `check:minigames` Suite 2. |
| **06** | Nhìn Hình Đoán Thú hoạt động từ chọn biểu tượng đến đối chiếu 3 kết quả | **PASSED** | 6 linh vật Bách Việt (Bầu, Cua, Cá, Cọp, Gà, Nai). Quay 3 kết quả độc lập xác suất 1/6 mỗi mặt. Cấp thưởng theo số lần xuất hiện (0, 1, 2, 3 hình). Xác suất trúng ít nhất 1 hình đạt 42.13% lý thuyết và 42.148% thực nghiệm. Kiểm chứng qua `check:minigames` Suite 3 & 4. |
| **07** | Server xác thực danh tính, điều kiện, RNG và kết quả | **PASSED** | Mọi quyết định và tính toán ngẫu nhiên diễn ra tại backend Node.js/Colyseus (`apps/game-server/minigames/`). Xác thực Supabase JWT, liên kết `auth.uid()` với `characterId`. Client chỉ nhận kết quả đã ký/chốt từ server. |
| **08** | Reward/attempt được ghi nguyên tử, idempotent và có RLS phù hợp | **PASSED** | Transaction PostgreSQL nguyên tử trong migration: bảng `minigame_reward_ledger` có khóa duy nhất `uq_minigame_reward_ledger(session_id, reward_type)`. Ràng buộc `uq_minigame_actions(session_id, action_id)` chống submit trùng lặp. Kiểm chứng qua `check:minigames-db`. |
| **09** | Không cho client tự cộng điểm/vé/vật phẩm | **PASSED** | Các bảng `minigame_sessions`, `minigame_reward_ledger`, `minigame_daily_usage` bị thu hồi hoàn toàn quyền `INSERT`, `UPDATE`, `DELETE` đối với role `authenticated` và `anon`. Chỉ `service_role` (backend tin cậy) mới có quyền ghi. Kiểm chứng qua `check:minigames-db` Suite 8. |
| **10** | Lượt/ngày, xác suất và thưởng hiển thị đúng cấu hình | **PASSED** | Giới hạn 3 lượt/ngày/game. Server tính ngày theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh` UTC+7). Reset vào 00:00:00. UI hiển thị rõ ràng bảng xác suất lý thuyết và bảng điểm thưởng tương ứng trước khi người chơi xác nhận vào ván. |
| **11** | Không có tiền thật, cash-out, vật phẩm đổi tiền hoặc mua lượt | **PASSED** | Điểm thưởng là **FestivalPoints** (điểm lễ hội danh dự), không thể quy đổi ra tiền thật, vật phẩm giao dịch hay crypto. Không có bất kỳ API nạp tiền, mua thêm lượt hoặc ép buộc tài chính. |
| **12** | UI phù hợp art direction Văn Lang, rõ trên mobile lẫn PC | **PASSED** | Sử dụng họa tiết trống đồng Đông Sơn, chất liệu tre đồng cổ kính, gam màu trầm ấm (đồng vàng, đất son, nâu thau). Responsive tự co giãn theo tỷ lệ màn hình ngang (landscape), hit target nút bấm tối thiểu 44 CSS px, hỗ trợ đầy đủ Touch và Chuột/Bàn phím. |
| **13** | Khi vào mini game, combat input và skill 1–4 không bị kích hoạt nhầm | **PASSED** | `InputContextManager.ts` thiết lập modal barrier: hấp thu hoàn toàn sự kiện `pointerdown` (ngăn chém kiếm trên world), khóa các phím kỹ năng `1`, `2`, `3`, `4`, và phím di chuyển `WASD`/Mũi tên. Khi đóng modal, trạng thái điều khiển được phục hồi nguyên vẹn. |
| **14** | Hoạt động đúng với Supabase Auth và online server thực tế | **PASSED** | Client gửi kèm header `Authorization: Bearer <access_token>`. Server xác minh chữ ký JWT, kiểm tra danh tính người chơi và tính hợp lệ trước khi cấp phiên hoặc thực hiện hành động. |
| **15** | Unit/integration/e2e tests quan trọng đạt, có báo cáo kiểm thử thật | **PASSED** | Đầy đủ 4 bộ công cụ kiểm thử tự động độc lập: `check-minigames-db.cjs`, `check-minigames-engine.cjs`, `check-minigames-client.cjs`, `check-minigames-world.cjs`, tất cả đều trả về mã thoát `0`. |
| **16** | Production build thành công, không có lỗi P0/P1 đã biết | **PASSED** | Cả hai lệnh biên dịch `npm run server:typecheck` và `npm run build` đều hoàn thành với 0 lỗi, bundle Vite sẵn sàng triển khai hosting. |
| **17** | Không làm hỏng combat, quest, inventory, NPC khác hoặc map transition | **PASSED** | Bộ dữ liệu 15 NPC cốt truyện (`NAMED_NPCS`) trong `VillageScene` được bảo toàn nguyên vẹn 100%. Vị trí 3 NPC lễ hội được bố trí tại các khu vực thoáng đãng, không cản trở lối đi của nhiệm vụ chính hay các cổng dịch chuyển bản đồ. |

---

## 4. KẾT LUẬN & NGHIỆM THU

Hệ thống tính năng **NPC Minigames & Festival Gacha** đã thỏa mãn 100% tất cả các tiêu chí kỹ thuật, an ninh, luật chơi, trải nghiệm người dùng và mỹ thuật đề ra trong MASTER PROMPT. Hệ sinh thái mã nguồn, bài kiểm tra và tài liệu hướng dẫn đã sẵn sàng cho giai đoạn phát hành chính thức (Release Ready).
