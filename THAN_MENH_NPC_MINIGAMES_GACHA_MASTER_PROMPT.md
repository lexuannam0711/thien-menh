# MASTER PROMPT — THẦN MỆNH: HẬU DUỆ VĂN LANG
## NPC MINIGAMES & GACHA REWARD SYSTEM — ONLINE MULTIPLAYER / SUPABASE

> **Chỉ thị triển khai cho AI Coding Agents.** Mục tiêu là đưa vào game **3 NPC tương tác, mỗi NPC vận hành một mini game hoàn chỉnh**, kết nối tài khoản Supabase và tiến trình nhân vật online, có giao diện PC/mobile nhất quán với phong cách Văn Lang. Phải triển khai mã nguồn chạy thật, không dừng ở tài liệu, mockup hoặc UI giả.
>
> **Giới hạn sản phẩm:** Đây là mini game giải trí bằng **lượt chơi/vé ảo không mua bằng tiền thật**, phần thưởng **chỉ có giá trị trong trò chơi**, không rút tiền, đổi tiền, chuyển nhượng để quy đổi giá trị hoặc kết nối giao dịch tiền thật. Không thiết kế cơ chế cá cược tiền thật. Phân loại độ tuổi và kiểm tra quy định phát hành tại khu vực mục tiêu trước khi ra mắt.

---

## 01. VAI TRÒ VÀ MỆNH LỆNH

Bạn là **Autonomous Game Feature Studio**, một nhóm agents gồm Game Director, Game Systems Architect, Phaser UI Engineer, Multiplayer Backend Engineer, Supabase Database/Security Engineer, Minigame Designer, Pixel Artist, QA & Performance Engineer.

Nhiệm vụ: **phân tích repository Thần Mệnh đang có, thiết kế, lập trình, tích hợp, kiểm thử và hoàn thiện 3 trò chơi do 3 NPC khác nhau quản lý**:

1. **“7321”** — trò thẻ bài lấy cảm hứng từ cơ chế rút/dừng và mục tiêu điểm số của blackjack.
2. **“Xúc Xắc May Mắn”** — trò dự đoán kết quả 3 xúc xắc lấy cảm hứng từ tài/xỉu.
3. **“Nhìn Hình Đoán Thú”** — trò dự đoán biểu tượng lấy cảm hứng từ bầu cua Việt Nam.

Đầu ra phải là một tính năng hoàn chỉnh có thể dùng trong phiên bản online, gồm NPC, hội thoại, menu, gameplay từng mini game, âm thanh/animation, luật chơi, kết quả, phần thưởng, lịch sử và lưu dữ liệu an toàn.

**Không chỉ cung cấp kế hoạch.** Khi có quyền đối với repository và các công cụ cần thiết, hãy thực thi theo từng nhánh có thể kiểm thử, tích hợp và xác thực kết quả. Không giả nhận tính năng đã hoạt động nếu chưa chạy thử.

## 02. NGUYÊN TẮC KHÔNG ĐƯỢC THAY ĐỔI

- Tên game: **Thần Mệnh: Hậu Duệ Văn Lang**.
- Thể loại cốt lõi: **2D top-down Hack & Slash Action RPG**.
- Engine client: **Phaser 4 + TypeScript + Vite** theo phiên bản thực tế trong repository.
- Online: **Supabase Auth + PostgreSQL + RLS** và game server authoritative hiện có (ưu tiên Colyseus nếu repository đã sử dụng).
- Phong cách: **Premium Vietnamese Mythological Pixel Art**, họa tiết đồng Đông Sơn, UI gọn và dễ nhìn.
- Mini game là hoạt động phụ từ NPC, **không thay đổi combat, camera, map, quest chính và nhịp game RPG**.
- Giữ PC: WASD di chuyển, **chuột trái tấn công** trong gameplay, **1–4 kỹ năng**, F tương tác, Esc đóng menu/tạm dừng. Khi modal mini game nhận focus, pointer/keyboard phải chuyển đúng sang UI, không tấn công xuyên qua modal.
- Hỗ trợ PC, Android, iPhone, tablet; ưu tiên landscape, responsive, touch, safe area.
- Không dùng tiền thật, tiền mã hóa, đổi thưởng vật chất, liên kết thanh toán, chuyển nhượng giải thưởng để đổi tiền.
- Không ép mua lượt, không nút mua lại gây áp lực, không cơ chế gần-trúng lừa đảo; công bố luật, khả năng trúng và giới hạn thưởng dễ hiểu.

## 03. PHÂN CHIA TRÁCH NHIỆM AGENTS

| Agent | Trách nhiệm | Bàn giao |
|---|---|---|
| Game Director | Khóa yêu cầu, điều phối, cắt task | Backlog + acceptance gates |
| Minigame Designer | Luật, payout phi tiền mặt, cân bằng | `MINIGAME_RULES.md`, cấu hình |
| Phaser/UI Engineer | NPC tương tác, 3 UI minigame, responsive | Scene/overlay/components |
| Backend Engineer | Session, state machine, authoritative resolver | API/Room handlers, validators |
| Supabase Engineer | Schema, RLS, migrations, giao dịch | SQL migrations, security tests |
| Art/Audio Engineer | Thẻ bài, xúc xắc, icon, animation, SFX | Assets tối ưu H5 |
| QA/Performance | Test logic, tính xác suất, retry, input | Test suite, QA report |

Nếu không có chức năng tạo subagents, một agent thực hiện lần lượt các vai trò; không giả vờ đã gọi nhiều agents. Không thao tác dữ liệu production hoặc thực hiện deployment công khai khi chưa có quyền và phê duyệt thích hợp.

## 04. TRẢI NGHIỆM NGƯỜI CHƠI / GAME LOOP

1. Người chơi đăng nhập Supabase và vào **Làng Lạc Thủy**.
2. Khi tiến gần NPC, hiển thị tên NPC và tooltip **F / Chạm để tương tác**.
3. Mở lời thoại: **Tìm hiểu luật**, **Chơi**, **Xem phần thưởng**, **Lịch sử**, **Rời đi**.
4. Chọn mini game. Client yêu cầu **tạo phiên hợp lệ trên server**; server xác nhận danh tính, lượt còn lại, điều kiện mở khóa.
5. Client hiển thị bàn chơi. Người chơi thao tác; backend quyết định trạng thái và kết quả hợp lệ.
6. Hiển thị kết quả rõ ràng (thắng, thua, hòa, sự kiện đặc biệt), giải thích cách tính.
7. Server cập nhật lượt và phần thưởng **đúng một lần**, lưu bản ghi kiểm toán.
8. Người chơi đóng mini game, quay lại bản đồ đúng vị trí, tiếp tục nhiệm vụ/đánh quái không mất trạng thái.

Tránh chuyển toàn bộ world scene khi chỉ cần modal/overlay độc lập. Phải xử lý mất focus, đổi tab, tắt popup, disconnect, reconnect và reload.

## 05. THIẾT KẾ 3 NPC (GIỮ TÊN GAME ĐÚNG YÊU CẦU)

### NPC 1 — **Thầy Thẻ Lạc** / Game: **7321**

- Vai trò: Người giữ trò chơi thẻ cổ, mặc áo vải tối và mang hộp thẻ đồng/tre.
- Vị trí: Một bàn nhỏ gần sân làng, tránh chặn đường đi/quest.
- Hiệu ứng: Lá thẻ lật mặt, âm thanh tre/đồng, đốm sáng khi đạt điểm cao.
- Thoại ví dụ: “Thử vận may với những lá thẻ Văn Lang chứ? Hãy nhớ: tham thêm một lá có thể mất cả lượt!”
- Services: `dialogue`, `rules`, `play_7321`, `rewards`, `history`.

### NPC 2 — **Lão Đồng Xúc** / Game: **Xúc Xắc May Mắn**

- Vai trò: Người chủ sạp xúc xắc gỗ/đồng.
- Vị trí: Góc chợ hoặc mái hiên quán dân làng.
- Hiệu ứng: Bát/đĩa lắc, 3 xúc xắc quay, rung gọn khi mở kết quả.
- Thoại ví dụ: “Ba viên xúc xắc, một lần dự đoán. Chọn theo cách của ngươi!”
- Services: `dialogue`, `rules`, `play_dice`, `rewards`, `history`.

### NPC 3 — **Nàng Họa Linh** / Game: **Nhìn Hình Đoán Thú**

- Vai trò: Nghệ nhân vẽ linh vật trên thẻ gỗ.
- Vị trí: Gần khu tranh dân gian/sạp hàng, phù hợp thế giới fantasy của game.
- Hiệu ứng: Sáu biểu tượng rõ hình, 3 viên xúc xắc biểu tượng, thẻ đoán sáng nhẹ.
- Thoại ví dụ: “Hãy chọn hình mà ngươi tin sẽ xuất hiện. Ba viên linh hình sẽ trả lời!”
- Services: `dialogue`, `rules`, `play_animals`, `rewards`, `history`.

**Lưu ý lore:** Đây là hoạt động game giả tưởng lấy cảm hứng từ trò chơi hiện đại/dân gian, không tuyên bố blackjack, tài xỉu hoặc bầu cua đã tồn tại thời Hùng Vương.

## 06. LUẬT CHƠI MINI GAME 1 — “7321”

**Tính chất:** Trò chơi thẻ bài đối kháng với nhà chia máy, mang cảm giác blackjack. Tên hiển thị bắt buộc là **7321**. Vì chưa có luật độc lập khác cho tên “7321”, sử dụng **luật mặc định lấy mục tiêu 21 điểm**; toàn bộ cấu hình phải data-driven để chủ dự án có thể đổi luật sau này mà không viết lại engine.

### Luật mặc định

- Một bộ bài chuẩn 52 lá, không joker; xáo bộ bài **trên server** bằng RNG phù hợp.
- Lá 2–10 = đúng số; J/Q/K = 10; A = 1 hoặc 11 theo hướng tối ưu không quá 21.
- Mỗi bên nhận 2 lá; người chơi thấy 2 lá của mình và 1 lá dealer. Lá dealer còn lại giữ kín cho đến khi kết thúc thao tác.
- Người chơi chọn **Rút** (`HIT`) hoặc **Dừng** (`STAND`), có thể xem điểm hiện tại.
- Điểm trên 21 = **Quắc (bust)**; nếu chưa quắc, dealer tự rút đến ngưỡng cấu hình (mặc định **17**, đứng trên soft 17).
- So điểm khi cả hai không quắc; điểm cao hơn thắng; bằng nhau hòa. Natural 21 với hai lá đầu là trạng thái đặc biệt, xử lý ưu tiên rõ trong code.
- Không triển khai split/double/insurance trong phiên đầu; chỉ bổ sung nếu được duyệt về phạm vi và có test.
- Mỗi lượt chỉ sinh một deck/order và giữ nguyên xuyên suốt; client không được tự tạo lá bài hay gửi tổng điểm.
- UI hiển thị **Luật chơi** và tooltip A = 1 hoặc 11; không được làm sai quy tắc soft hand.

### State machine

`CREATED → DEALT → PLAYER_TURN → DEALER_TURN → RESOLVED → REWARDED`.

Các trường hợp kết thúc sớm (ví dụ natural, bust) phải chuyển trạng thái hợp lệ và không thể bị gọi tiếp action cũ. Một session chỉ có **một kết quả chung cuộc**, mỗi action có `actionId` để chống submit trùng.

### UI

- Mặt bàn thẻ đồng/tre, hai vùng “Bài của bạn” và “Bài đối thủ”.
- Điểm hiển thị lớn, trạng thái “Đang chọn / Đã dừng / Quắc / Thắng / Hòa”.
- Nút **Rút**, **Dừng**, **Luật**, **Thoát** đủ lớn cho cảm ứng.
- Hiệu ứng phát bài ngắn, cho phép bỏ qua animation; không khóa input sai khi mạng chậm.

## 07. LUẬT CHƠI MINI GAME 2 — “XÚC XẮC MAY MẮN”

**Tính chất:** Dự đoán tổng 3 viên xúc xắc sáu mặt, lấy cảm hứng từ tài/xỉu nhưng không có cược tiền thật.

### Luật mặc định

- Kết quả gồm `d1`, `d2`, `d3`, mỗi viên độc lập đều có giá trị 1..6; server là nơi tạo số.
- **Xỉu:** tổng từ 4 đến 10, **trừ bộ ba đồng số**.
- **Tài:** tổng từ 11 đến 17, **trừ bộ ba đồng số**.
- **Bộ ba đồng số:** là kết quả đặc biệt, không thuộc Tài/Xỉu; công bố trước cách tính và giải thưởng tương ứng. Trong phiên đầu, coi là lượt **Hòa đặc biệt** và không cấp thưởng thắng dự đoán Tài/Xỉu; việc hoàn lượt nếu có phải được quy định trong cấu hình, không xử lý tùy tiện.
- Người chơi chọn **Tài** hoặc **Xỉu**, sau đó nhấn **Lắc xúc xắc**.
- Chỉ một lựa chọn và một lần tạo kết quả hợp lệ cho một session. Không được cho client chọn lại sau khi nhìn thấy roll.
- Không tạo kết quả “suýt trúng” giả để kích thích chơi liên tục.

### UI

- Bảng chọn Tài/Xỉu lớn, dễ phân biệt bằng cả chữ và icon.
- Bát xúc xắc ở giữa, lắc ~1–2 giây bằng animation có thể bỏ qua.
- Sau khi server đã chốt, hiển thị đủ 3 mặt, tổng, kết quả và giải thích.
- Nút **Chơi lượt mới** chỉ kích hoạt nếu còn lượt theo quy tắc.

### Kết quả

`choice`, `dice[3]`, `total`, `isTriple`, `category`, `outcome`, `rewardReceiptId` (nếu có).

## 08. LUẬT CHƠI MINI GAME 3 — “NHÌN HÌNH ĐOÁN THÚ”

**Tính chất:** Trò đoán biểu tượng theo cơ chế bầu cua nhưng không đổi tiền/cá cược. Sáu biểu tượng mặc định:

1. **Bầu**
2. **Cua**
3. **Cá**
4. **Cọp**
5. **Gà**
6. **Nai**

Bầu là biểu tượng đồ vật truyền thống, nên giữ tên mini game “Nhìn Hình Đoán Thú” theo yêu cầu dù bộ biểu tượng có cả Bầu.

### Luật mặc định

- Người chơi chọn **một biểu tượng** trong sáu biểu tượng; có thể đổi lựa chọn trước khi xác nhận.
- Server tạo **3 kết quả độc lập**, mỗi kết quả thuộc sáu biểu tượng với xác suất bằng nhau.
- Nếu biểu tượng đã chọn xuất hiện **1/2/3 lần**, cấp phần thưởng theo bậc cấu hình; **0 lần** không có thưởng thắng, nhưng có thể có thưởng tham gia đã công bố.
- Luật này là phiên bản **dự đoán 1 biểu tượng** phù hợp H5, không phải mô phỏng nhiều ô đặt cược tiền như truyền thống.
- Công bố xác suất trúng ít nhất một lần, xấp xỉ **42,13%** với 3 xúc xắc công bằng, và bảng thưởng tương ứng. Công thức: `1 - (5/6)^3`.
- Kết quả hiển thị đủ 3 biểu tượng; không thao túng biểu tượng theo lựa chọn người chơi.

### UI

- Lưới 2×3 biểu tượng rõ, đồng nhất pixel art và nhãn tiếng Việt.
- Trạng thái selected có viền vàng đồng + icon xác nhận, không chỉ đổi màu.
- Nút **Xác nhận lựa chọn** và **Mở linh hình**.
- Hiệu ứng lật/mở kết quả ngắn; badge “Trúng 1/2/3 hình” dễ đọc.

## 09. HỆ THỐNG LƯỢT CHƠI & PHẦN THƯỞNG (KHÔNG CÁ CƯỢC)

Thiết kế một hệ thống `MinigameTicket` / `FestivalToken` riêng, **không phải tiền thật, không có cơ chế mua bằng tiền thật, không thể chuyển đổi thành tài sản bên ngoài game**.

- Lượt mặc định: gợi ý 3 lượt miễn phí/ngày cho **mỗi mini game**, có thể điều chỉnh qua cấu hình cân bằng.
- Reset lượt theo **ngày lịch Việt Nam (Asia/Ho_Chi_Minh)**, tính toán trên server; lưu timestamp UTC.
- Cho phép nhận vé thông qua nhiệm vụ/hoạt động chơi game đã duyệt; **không bán vé** hoặc liên kết premium currency.
- Phần thưởng: XP mức nhỏ, nguyên liệu thường, huy hiệu sưu tầm, vật phẩm cosmetic không giao dịch, hoặc điểm lễ hội không mua bán.
- Không cấp vật phẩm cực hiếm không giới hạn làm phá hỏng cân bằng PvE online.
- Áp trần phần thưởng/ngày/người chơi; có biểu đồ xác suất thưởng **đúng với cấu hình thực tế**.
- Không có cơ chế thua rồi mắc nợ, không trừ cấp độ/trang bị, không có giá trị âm.
- Không có cash-out, chuyển nhượng phần thưởng để giao dịch tiền thật, cược PvP, liên kết ví tiền, thanh toán hoặc đấu giá kiếm tiền.
- Tránh cơ chế thúc ép tâm lý như đếm ngược mua lượt, thông báo “sắp trúng”, giả lập độ hiếm, chuỗi near-miss có chủ ý hoặc spam khuyến khích quay lại.

### Ví dụ cấu hình thưởng (chỉ là giá trị khởi đầu cần cân bằng)

- Tham gia hợp lệ: `5 FestivalPoints` (nếu chính sách lượt cho phép).
- Thắng 7321: `15 FestivalPoints`; hòa `5`; thua `0` ngoài thưởng tham gia nếu có.
- Đúng Tài/Xỉu: `10 FestivalPoints`; bộ ba đặc biệt: `5`, công bố là thưởng đặc biệt không phải thắng.
- Nhìn Hình Đoán Thú: trúng 1/2/3 biểu tượng: `8 / 20 / 45 FestivalPoints`.

Phải phân tích **expected reward per attempt** cho mỗi trò và điều chỉnh sao cho không bị farm vô hạn hoặc lệch cực lớn giữa ba NPC. Không dùng cùng lúc hai loại thưởng tham gia một cách vô tình.

## 10. KIẾN TRÚC CLIENT, SERVER, DATABASE

### Phân định thẩm quyền

**Phaser client**: UI, animation, nhập lựa chọn, mở NPC, hiển thị trạng thái; **không** quyết định kết quả hoặc cập nhật phần thưởng.

**Authoritative minigame service**: xác thực session, điều kiện tham gia, trạng thái vòng chơi, RNG, xác định thắng/thua, chống action trùng, rate limit và kết quả.

**Supabase PostgreSQL**: giữ lịch sử, lượt, kết quả, bảng thưởng, ledger/cộng vật phẩm, phục hồi sau disconnect; toàn bộ giao dịch liên quan thưởng phải nguyên tử/idempotent.

Ưu tiên tích hợp vào **Colyseus backend đã có** hoặc một dịch vụ backend Node/TypeScript hiện có. Có thể dùng authenticated HTTP endpoints cho những lượt ngắn; **không bắt buộc tạo room WebSocket mới cho mọi lượt solo**. Chỉ dùng realtime transport nếu thực sự có nhu cầu đồng bộ animation hoặc nhiều người xem cùng một bàn. Phải xác định triển khai thực tế sau khi audit repository.

### Giao thức đề xuất

- `minigame.list` / `GET /minigames`: metadata công khai và trạng thái mở khóa.
- `minigame.start({ gameId, npcId, requestId })` → session ID, state public, lượt còn lại.
- `minigame.action({ sessionId, actionId, type, payload })` → state mới từ server.
- `minigame.resolve({ sessionId, actionId })` → kết quả chung cuộc nếu trò yêu cầu.
- `minigame.history({ page })` → lịch sử chỉ của người chơi.
- `minigame.rewards({ gameId })` → bảng phần thưởng và xác suất.

Tên endpoint minh họa; khớp API thực tế của dự án. Mỗi request phải kiểm tra ownership và action/version hợp lệ.

### Authentication

- Dùng JWT access token của Supabase Auth.
- Backend xác minh chữ ký/claims theo cơ chế Supabase đang sử dụng, hoặc gọi Auth server phù hợp.
- Bind `auth.uid` / user ID đã xác thực với character đang chơi.
- Không tin user ID, character ID hay số tiền client tự gửi.
- Khi refresh token, không làm mất session đã kết thúc hoặc cấp thưởng lại.

## 11. DATABASE SCHEMA ĐỀ XUẤT (MIGRATIONS)

Các bảng/quan hệ (điều chỉnh khớp schema hiện tại, tránh trùng):

- `minigame_definitions`: `game_id`, `title`, `rules_version`, `enabled`, `daily_limit`, `config_json`, `updated_at`.
- `minigame_npcs`: `npc_id`, `game_id`, `world_map`, `spawn_point`, `unlock_condition`.
- `minigame_daily_usage`: `user_id`, `game_id`, `local_date`, `plays_used`, `updated_at`, unique `(user_id, game_id, local_date)`.
- `minigame_sessions`: `id`, `user_id`, `character_id`, `game_id`, `rules_version`, `status`, `public_state`, `secret_state_ref`, `attempt_reserved`, `created_at`, `expires_at`, `resolved_at`, `result_json`, `reward_receipt_id`, `version`.
- `minigame_actions`: `id`, `session_id`, `user_id`, `action_id`, `action_type`, `payload_hash`, `created_at`, unique `(session_id, action_id)`.
- `minigame_reward_ledger`: `id`, `session_id`, `user_id`, `character_id`, `reward_type`, `amount`, `source`, `created_at`, unique key cho mỗi loại reward được cấp trên mỗi session.
- `minigame_reward_catalog`: bảng phần thưởng/version/config minh bạch.
- `minigame_audit_events`: điều tra hành vi bất thường, retention có giới hạn; không ghi JWT/bí mật RNG dưới dạng public.

Không lưu secret state qua một `jsonb` cho phép người chơi SELECT. Secret state cần nằm trong schema/table bị khóa quyền truy cập client hoặc lưu ở backend an toàn.

### Giao dịch nguyên tử

- `start`: lock/check hạn mức và reserve/consume attempt theo chính sách, tạo session, tránh trùng request.
- `resolve`: row lock phiên, kiểm tra trạng thái, tính kết quả trên server, insert ledger, cập nhật tài khoản/kho đồ và đánh dấu rewarded **trong một transaction**.
- Nếu request bị gửi lại sau thành công, trả **cùng một kết quả**.
- Nếu disconnect trước khi server chốt, cho phép phục hồi state hoặc hoàn lượt đúng chính sách; không nhận thưởng hai lần.
- Không thực hiện read → modify → write trên client cho phần thưởng.
- Viết migrations có khả năng rollback và test bằng tài khoản/role giả lập.

## 12. RNG, CÔNG BẰNG VÀ ĐỘ TIN CẬY

- Dùng nguồn **cryptographically secure RNG phía server** (`node:crypto.randomInt` hoặc phương án tương đương được kiểm chứng), không dùng `Math.random()` client để chốt thưởng.
- Shuffle 7321 bằng Fisher–Yates và RNG unbiased.
- Dice/bầu cua: mỗi mặt có xác suất đúng 1/6, lấy mẫu độc lập.
- Thiết lập luật, odds và reward trước phiên; giữ nguyên `rules_version` cho session đang chạy.
- Không thay đổi RNG theo lịch sử thắng/thua, số ngày đăng nhập, profile người chơi hoặc số điểm còn lại.
- Nếu áp dụng **commit–reveal** cho minh bạch: commit trước khi người chơi hành động, chỉ reveal seed/nonce sau khi kết thúc, và kiểm chứng khả năng tái lập; không tiết lộ bài dealer sớm. Commit–reveal chỉ chứng minh tính nhất quán với commit, không tự chứng minh lựa chọn seed ban đầu công bằng.
- Viết mô phỏng ít nhất 100.000 lượt đối với trò xúc xắc và linh vật để so tần suất thực tế với phân phối lý thuyết; không dùng kết quả mô phỏng để khẳng định hệ thống không thể gian lận.

## 13. AN NINH & CHỐNG GIAN LẬN

- Supabase **RLS bật** trên bảng chứa dữ liệu người dùng; chỉ chủ tài khoản đọc thông tin của mình, không được tự sửa kết quả, ledger, vé.
- Server-side/privileged DB operations dùng quyền tối thiểu, chỉ khi cần. **Service role secret không bao giờ đưa vào trình duyệt hoặc commit repo**.
- RPC ưu tiên `SECURITY INVOKER`; nếu bắt buộc `SECURITY DEFINER`, đặt `search_path` an toàn, schema-qualify relation, giới hạn `EXECUTE` và audit kỹ quyền.
- Mọi action dùng schema validation (Zod hoặc tương đương), kiểm tra state/version, rate limit, replay/idempotency guard.
- Chặn replay reward, request nhiều tab, double click, retry, session fixation, user sửa `gameId/npcId`, sửa request payload, thay `result` client.
- Không cho người chơi tăng lượt bằng chỉnh đồng hồ hệ thống hoặc đổi múi giờ.
- Không log token, session secret, seed chưa reveal, hoặc dữ liệu cá nhân không cần thiết.
- Cân nhắc privacy, retention, anti-abuse và yêu cầu độ tuổi khi phát hành tính năng ngẫu nhiên theo luật khu vực.

## 14. UI/UX — PHONG CÁCH VĂN LANG ĐỒNG NHẤT

### Hướng hình ảnh

**Ancient Bronze Festival UI**: đồng cổ, gỗ, giấy dó giả tưởng, hoa văn Đông Sơn dùng tiết chế, chữ tiếng Việt rõ, không biến game thành giao diện casino hiện đại.

- Modal hoặc overlay nằm trên world scene, nền tối nhẹ, NPC portrait và tên trò ở header.
- Panel rõ ba khu: **Luật / Bàn chơi / Kết quả & phần thưởng**.
- Không mở popup chồng popup; back/close rõ, có xác nhận khi thoát giữa phiên nếu có rủi ro mất lượt.
- Trạng thái loading/network/reconnect bằng nội dung dễ hiểu, không spinner vô hạn.
- Kết quả từng lượt hiển thị **đã xác nhận bởi server** trước khi hiện phần thưởng.
- Có số lượt hôm nay, đồng hồ reset minh bạch và tooltip quyền riêng tư nếu có lịch sử.
- Ánh sáng/animation vừa phải, hỗ trợ reduced motion và skip animation.
- Icon rõ ở kích thước nhỏ; không chỉ dùng màu để phân biệt trạng thái.

### PC

- F/chuột trái trên nút tương tác NPC để mở.
- Khi modal có focus: chuột trái nhấn UI, **không ra lệnh đánh thường lên world**; WASD và phím kỹ năng 1–4 bị khóa hoặc xử lý theo chế độ UI đã định nghĩa.
- Enter/Space xác nhận nút khi phù hợp; Esc đóng/hủy theo state; Tab chuyển focus; click ngoài overlay không tự mất phiên.
- Khi đóng trả lại đúng input context, không kẹt phím tấn công hay joystick.

### Mobile & tablet

- Landscape responsive với safe area, màn hình nhỏ không tràn nút, hit target tối thiểu khoảng 44 CSS px khi khả thi.
- Chạm một lần để chọn, nút xác nhận riêng để tránh chọn nhầm.
- Thiết kế UI bảng chơi có thể thu gọn, hỗ trợ tablet, tỷ lệ 16:9/19.5:9 và màn nhỏ.
- Ẩn điều khiển combat khi modal hoạt động; khôi phục nguyên trạng khi đóng.

### Màn hình bắt buộc

1. Tooltip NPC / bảng lựa chọn dịch vụ.
2. Mini game lobby/luật.
3. Bàn 7321 (deal/hit/stand).
4. Bàn Xúc Xắc May Mắn.
5. Bàn Nhìn Hình Đoán Thú.
6. Kết quả và thưởng.
7. Hết lượt / cooldown.
8. Lịch sử cá nhân (không public dữ liệu nhạy cảm).
9. Error/retry/reconnect.

## 15. ASSET & ANIMATION PRODUCTION

Tạo các asset thực sự có thể tích hợp vào Phaser; nếu chưa có asset hợp lệ, dùng art code-based có chất lượng thay vì gán hình nguồn không rõ bản quyền.

- 3 NPC portrait và sprite top-down, idle/interaction.
- Bàn game 7321, mặt sau thẻ/mặt thẻ, bộ icon chất liệu đồng/tre.
- Xúc xắc sáu mặt (sprite/atlas) và bát/đĩa.
- Sáu biểu tượng Bầu/Cua/Cá/Cọp/Gà/Nai rõ ràng, thống nhất.
- Kết quả win/lose/draw, hiệu ứng huy hiệu lễ hội, SFX lật bài/lắc xúc xắc/mở linh hình.
- Atlas/spritesheet metadata, origin, texture filtering và sprite layering đúng chuẩn pixel art.
- Mỗi asset có nguồn gốc/giấy phép, không dùng ảnh tham khảo làm art commercial khi chưa có quyền.

## 16. KIẾN TRÚC SOURCE ĐỀ XUẤT

Giữ nguyên cấu trúc project nếu có module tương đương; chỉ tạo cái còn thiếu.

```text
src/game/
  minigames/
    MinigameRegistry.ts
    MinigameClient.ts
    MinigameOverlay.ts
    MinigameRewardsUI.ts
    MinigameHistoryUI.ts
    games/
      SevenThreeTwoOneUI.ts
      LuckyDiceUI.ts
      AnimalGuessUI.ts
    assets/
      minigame-ui/
  entities/
    NPC.ts
  systems/
    NPCServiceSystem.ts
  ui/
    InputContextManager.ts

server/
  minigames/
    MinigameService.ts
    SessionManager.ts
    RewardService.ts
    CSPRNG.ts
    RulesRegistry.ts
    games/
      SevenThreeTwoOneRules.ts
      LuckyDiceRules.ts
      AnimalGuessRules.ts
    validators/
    tests/

supabase/migrations/
  *_minigames_tables.sql
  *_minigames_rls.sql
  *_minigames_functions.sql
```

Nếu `server/` đã có cấu trúc chuẩn riêng, hòa vào đó; không tạo backend thứ hai chỉ vì prompt đề xuất đường dẫn.

### TypeScript contracts gợi ý

```ts
type MinigameId = '7321' | 'lucky_dice' | 'animal_guess';
type SessionStatus = 'created' | 'active' | 'resolved' | 'rewarded' | 'cancelled' | 'expired';

type MinigameAction =
  | { type: 'hit' | 'stand' }
  | { type: 'choose_dice'; choice: 'tai' | 'xiu' }
  | { type: 'choose_symbol'; symbol: 'bau' | 'cua' | 'ca' | 'cop' | 'ga' | 'nai' }
  | { type: 'confirm' };

interface MinigamePublicSession {
  sessionId: string;
  gameId: MinigameId;
  status: SessionStatus;
  rulesVersion: string;
  publicState: unknown; // narrow bằng schema theo từng game
  remainingDailyPlays: number;
}
```

Dùng **discriminated unions** và schema validation chi tiết theo trò thay vì `unknown` xuyên hệ thống. Client không được giữ deck bí mật hoặc seed chưa reveal.

## 17. MINIGAME NPC INTEGRATION VÀ QUEST

- Dùng registry `npcId → minigameId`, xác minh khoảng cách tương tác server-side khi hệ thống world có thể cung cấp vị trí đã xác thực.
- Có điều kiện mở khóa hợp lý, nhưng không bắt buộc kết quả thắng ngẫu nhiên để hoàn thành main story.
- Nhiệm vụ phụ có thể là “Gặp ba người giữ trò lễ hội”, “Tham gia mỗi trò một lần”, “Thu thập huy hiệu lễ hội”; **không tạo softlock vì vận xui**.
- Mini game có thể chơi trong khu làng social nhiều người; ban đầu phiên là **riêng từng người**, không phát tán bài bí mật/đáp án sang các client khác.
- Khi người chơi đang chơi mini game: tạm khóa world combat/movement theo phạm vi client và xử lý an toàn nếu đang bị quái tấn công. Không cho mở mini game khi player đang bị combat hoặc chưa ở vị trí NPC hợp lệ nếu thế giới áp dụng kiểm tra đó.
- Không ảnh hưởng party/dungeon session và cơ chế server save đang hoạt động.

## 18. TEST MATRIX — BẮT BUỘC

### Luật chơi

- 7321: Ace 1/11, soft 17, blackjack hai lá, bust, tie, dealer tự rút, rút khi deck cạn (phải có quy tắc an toàn), không nhìn thấy dealer hidden card trước kết thúc.
- Dice: 216 tổ hợp, high/low/triples đúng, không dùng tổng 3/18 nhầm vùng; kết quả không thay đổi giữa retry.
- Animal: 216 tổ hợp, 6 biểu tượng, đếm số trúng 0–3, kiểm tra 42,13% xác suất trúng ít nhất một ở kiểm chứng lý thuyết.

### Security/Concurrency

- JWT không hợp lệ/hết hạn.
- Người chơi A không xem session kín hoặc lịch sử của B.
- Hai tab tạo session đồng thời không vượt lượt ngày.
- Spam nút xác nhận/submit trùng `actionId`.
- Retry sau timeout DB/network trả về cùng session/result.
- Kết quả thưởng chỉ xuất hiện một lần trong ledger.
- Giả request sửa xúc xắc/bài/thưởng không có tác dụng.
- Save/load, disconnect giữa lượt, crash và reconnect.

### UI & Accessibility

- PC: F mở, chuột trái chỉ tương tác UI trong modal, skill hotkeys không kích hoạt bên dưới, Esc xử lý đúng.
- Mobile: đa chạm, safe area, modal không tràn, đóng mở không kẹt input, âm thanh không tự bật trái phép.
- Tiếng Việt không lỗi font/dấu, phân biệt nút disabled, loading và result.
- Reduced motion và mute hoạt động.

### Hiệu năng

- Kiểm tra mở/đóng NPC 50–100 lần không tăng listener/texture bất thường.
- Atlas asset được preload/lazy load có kiểm soát; không khởi tạo Phaser Game thứ hai để vẽ mini game.
- Giữ FPS ổn trên thiết bị kiểm thử mục tiêu; báo thiết bị và số đo thật.

## 19. KẾ HOẠCH TRIỂN KHAI CHO AGENTS

### M0 — Audit & Integration Plan

Đọc source, xác định NPC service, scene, game input, Supabase auth, Colyseus transport, DB schema, reward/inventory hiện tại. Kiểm tra build và tạo task phụ thuộc. Không tạo lại phần đã chạy ổn.

### M1 — Contracts & DB Security

Tạo rules/config registry, types, database migrations, RLS, transaction/idempotency, xác minh Auth, unit tests quyền và chống trùng.

### M2 — NPC + Minigame Shell

Tạo 3 NPC spawn/interact, overlay chung, lobby, luật, trạng thái loading, history/reward views, chuyển input context PC/mobile.

### M3 — 7321 End-to-End

Thực hiện authoritative shuffle/draw/stand/resolve/reward, UI/animation, tests.

### M4 — Xúc Xắc May Mắn End-to-End

Roll 3d6, high/low/triples, animation, tests xác suất và idempotency.

### M5 — Nhìn Hình Đoán Thú End-to-End

6 biểu tượng, chọn/mở 3 kết quả, reward tiers, UI/art và tests.

### M6 — RPG & Social Integration

Daily attempt limits, nhiệm vụ phụ, FestivalPoints, inventory wallet không giao dịch, location checks, telemetry an toàn, đồng bộ multiplayer session.

### M7 — UI Polish & Asset Completion

Thay placeholder, hoàn thiện pixel art, âm thanh, hiệu ứng, bàn chơi, layout PC/tablet/mobile, accessibility.

### M8 — Security, QA & Release Candidate

RLS negative tests, double-submit, reconnect, concurrency, performance, deploy migration staging, end-to-end playthrough và test production build.

Sau mỗi milestone phải còn bản build kiểm thử được; không dừng công việc ở mô tả khi có công cụ triển khai. Nếu môi trường không cho chạy lệnh thì ghi rõ `NOT TESTED`, không tự nhận đã đạt.

## 20. DEFINITION OF DONE CHO TÍNH NĂNG 1.0

Chỉ chấp nhận khi **tất cả** điều kiện sau đạt:

- [ ] 3 NPC có vị trí thực tế trong làng và tương tác được.
- [ ] Tên mini game hiển thị chính xác: **7321**, **Xúc Xắc May Mắn**, **Nhìn Hình Đoán Thú**.
- [ ] Mỗi NPC có hội thoại, xem luật, chơi, lịch sử, phần thưởng.
- [ ] 7321 hoạt động từ phát bài đến so điểm và thưởng.
- [ ] Xúc Xắc May Mắn hoạt động từ chọn cửa đến hiện 3 xúc xắc.
- [ ] Nhìn Hình Đoán Thú hoạt động từ chọn biểu tượng đến đối chiếu 3 kết quả.
- [ ] Server xác thực danh tính, điều kiện, RNG và kết quả.
- [ ] Reward/attempt được ghi nguyên tử, idempotent và có RLS phù hợp.
- [ ] Không cho client tự cộng điểm/vé/vật phẩm.
- [ ] Lượt/ngày, xác suất và thưởng hiển thị đúng cấu hình.
- [ ] Không có tiền thật, cash-out, vật phẩm đổi tiền hoặc mua lượt.
- [ ] UI phù hợp art direction Văn Lang, rõ trên mobile lẫn PC.
- [ ] Khi vào mini game, combat input và skill 1–4 không bị kích hoạt nhầm.
- [ ] Hoạt động đúng với Supabase Auth và online server thực tế.
- [ ] Unit/integration/e2e tests quan trọng đạt, có báo cáo kiểm thử thật.
- [ ] Production build thành công, không có lỗi P0/P1 đã biết.
- [ ] Không làm hỏng combat, quest, inventory, NPC khác hoặc map transition.
- [ ] Có tài liệu rules, schema, FAQ, asset/license và changelog.

## 21. CÁCH BÁO CÁO VÀ BÀN GIAO

Mỗi lần làm việc, cập nhật:

1. `MINIGAME_IMPLEMENTATION_STATUS.md`: phần nào xong/thực sự test.
2. `MINIGAME_RULES.md`: luật và bảng xác suất/phần thưởng đang áp dụng.
3. `MINIGAME_ARCHITECTURE.md`: client/server/data flow, contracts, RNG.
4. `MINIGAME_SECURITY_QA.md`: RLS, exploit cases, test evidence.
5. `CHANGELOG.md` và README khi cần.

Mỗi task phải có owner, files changed, test command/result, blocker và next step. Không cần hỏi chủ dự án từng lựa chọn UX nhỏ. Cần phê duyệt khi phát sinh chi phí, quyền truy cập, thay đổi thể loại, tiền thật/đổi thưởng, thay đổi luật ảnh hưởng pháp lý hoặc phá hủy dữ liệu.

## 22. LỆNH THỰC THI CUỐI CÙNG

**AUTONOMOUS NPC MINIGAMES DEVELOPMENT MODE: ON**

**PROJECT:** Thần Mệnh: Hậu Duệ Văn Lang Online

**TARGET FEATURE:** NPC Festival Minigames 1.0

**MANDATORY NPC GAMES:** `7321`, `Xúc Xắc May Mắn`, `Nhìn Hình Đoán Thú`

**STACK:** Phaser 4 + TypeScript + Vite + Supabase Auth/Postgres/RLS + authoritative backend hiện có.

**START NOW:**

1. Audit repository thực tế trước khi viết mới.
2. Giữ các hệ thống online/combat/NPC/UI hiện hữu.
3. Thiết kế schema & contracts có RLS, idempotency và RNG server.
4. Tích hợp NPC + UI shell.
5. Triển khai lần lượt **7321 → Xúc Xắc May Mắn → Nhìn Hình Đoán Thú** thành các vertical feature hoàn chỉnh, kiểm thử mỗi phần.
6. Hoàn thiện reward progression và nội dung festival phụ, tuyệt đối không nối với tiền thật.
7. Polish pixel art, VFX, SFX, responsive, keyboard/touch.
8. Kiểm thử toàn diện Supabase/Auth/concurrency/reconnect/RLS và regression gameplay.
9. Bàn giao source code, migrations, tài liệu, QA report và production-ready build khi được phép.

**SUCCESS = 3 NPC mini game thực sự hoạt động, đẹp, công bằng, bảo mật, dễ chơi trên PC/mobile và hòa vào thế giới Thần Mệnh Online — không phải 3 ảnh minh họa hay trò client-side có thể sửa kết quả.**
