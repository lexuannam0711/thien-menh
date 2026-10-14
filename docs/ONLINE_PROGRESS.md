# Thần Mệnh Online 1.0 — M0–M9 Progress Matrix & Gate Verification

- **Tài liệu tham chiếu:** `THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md` (Mục 14, 18, 19), `docs/ONLINE_M0_AGY_ARCHITECTURE.md`, `docs/ONLINE_M1_DATABASE.md`.
- **Trạng thái thực thi hiện tại:** Wave 1/Wave 2 Post-Minigames Baseline Audit.
- **Phạm vi file sở hữu:** `docs/ONLINE_PROGRESS.md` & `docs/QA_MULTIPLAYER.md` (Chỉ đọc ngoài 2 tài liệu này; bảo toàn dirty state hiện hữu).
- **Phân loại bằng chứng (Evidence Taxonomy):**
  - `Code Present`: Mã nguồn, schema SQL hoặc adapter đã tồn tại trong repository kèm đường dẫn/dòng cụ thể.
  - `Locally Tested`: Đã xác thực bằng lệnh kiểm thử cục bộ/tĩnh (được ghi rõ worker run hay coordinator run).
  - `Remotely Unverified`: Chưa có hạ tầng từ xa (Supabase project, Colyseus cloud/VPS WSS, multi-device networking).
  - `Missing`: Tính năng hoặc liên kết giữa các module chưa được triển khai.

---

## 1. BẢNG TỔNG HỢP TIẾN ĐỘ CỔNG KIỂM SOÁT M0–M9 (MILESTONE GATES)

| Milestone | Tên Milestone | Code Present | Locally Tested | Remotely Unverified | Missing / Gaps | Trạng thái cổng (Gate Verdict) |
|---|---|---|---|---|---|---|
| **M0** | Architecture & Offline Baseline | `src/game/*`, `package.json` | `check:save`, `check:rpg`, `check:player-status`, `check:controls`, `build` | Không yêu cầu | Visual/gameplay baseline chưa được xác minh độc lập trong vòng này | **PARTIAL (focused offline checks pass)** |
| **M1** | Supabase Auth & Character Schema | `src/game/online/auth.ts`, `supabase/migrations/20261014000000_m1_profiles_and_characters.sql`, `src/game/scenes/MenuScene.ts` | `check-auth.cjs`, `check-m1-schema.cjs` | Live Supabase DB push, real Email OTP/OAuth | Client runtime character query/selection (`MenuScene.ts:431` dùng pseudo `char-${userId}`) | **PARTIAL / BLOCKED ON RUNTIME CHAR SELECTION & LIVE DB** |
| **M2** | Colyseus Authoritative Server & Room Connection | `apps/game-server/server.ts`, `src/game/online/protocol.ts`, `src/game/online/multiplayer.ts`, `src/game/online/remotePlayerRenderer.ts`, `src/game/scenes/VillageScene.ts` | `check-network-contract.cjs`, `check-game-server.cjs`, `check-village-multiplayer.cjs`, `check-multiplayer-e2e.cjs` (2 SDK clients kết nối WebSocket thật qua JWKS, sync vị trí) | Production WSS, Internet latency/jitter | Two-browser Playwright harness; gameplay scenes (`ForestScene`, `DungeonScene`) chưa nối WSS | **PARTIAL / LOCALLY VERIFIED (E2E 2-client SDK verified; Remote WSS unverified)** |
| **M3** | Server-Authoritative Combat & Sync | `apps/game-server/server.ts:104-134`, `src/game/online/snapshotAdapter.ts`, `src/game/online/protocol.ts`, `src/game/systems/CombatSystem.ts` (intent dispatch, không mang trường cấm) | `check-network-contract.cjs`, `check-game-server.cjs`, `check-combat-multiplayer.cjs`, `check-multiplayer-e2e.cjs` (quái nhận sát thương tất định 10 HP và chặn fake damage 999999/fake gold 50000) | Multi-client network combat sync qua live internet server | Co-op boss instanced room chưa nối; Forest/Dungeon scenes chưa chạy server AI 25Hz | **PARTIAL / LOCALLY VERIFIED (Authoritative combat intent & anti-cheat verified)** |
| **M4** | Party System & Instanced Boss Battles | `apps/game-server/server.ts:34-83` (`PartyRegistry`), `src/game/online/partyAdapter.ts`, `src/game/ui/PartyHUD.ts` | `check-game-server.cjs` (5-user party flow), `check-party-hud.cjs` (4/4 suites), `check-multiplayer-e2e.cjs` (đồng bộ party state giữa 2 client) | 4-client boss co-op qua mạng Internet thật, reconnect grace period | In-game instanced boss room transfer, wipe/revive multiplayer logic | **PARTIAL / LOCALLY VERIFIED (Party state machine & PartyHUD verified; Boss instancing unverified)** |
| **M5** | Persistent RPG, Inventory & Economy | `supabase/migrations/20261014010000_m5_character_progress.sql`, `apps/game-server/characterRepository.ts`, `apps/game-server/server.ts:193-233`, minigames schema/engine | `check-m5-persistence.cjs`, `check-m5-runtime.cjs`, `check-minigames-db.cjs`, `check-minigames-engine.cjs` | Live DB transaction under load, cross-device persistence | Server persistence transport qua WSS (`check-online-transport.cjs` lỗi UUID guard; pending this wave) | **PENDING THIS WAVE / IN PROGRESS (NOT DONE)** |
| **M6** | Online HUD, Social UX & Controls Mapping | `src/game/ui/screens/ControlsSettings.ts`, `TouchControls.ts`, `NetworkBadge.ts`, `PartyHUD.ts`, `ChatBox.ts`, `chatManager.ts`, `Hud.ts` | `check:controls` (8/8), `check-party-hud.cjs` (4/4), `check-hud-multiplayer.cjs` (3/3), `check-chat-system.cjs` (9/9), `check:minigames-client` (5/5) | Mobile low-end network UX qua 4G/Wifi thật, multi-user chat spam load test | Mobile virtual keyboard viewport handling trên iOS Safari; live production ping indicator | **PARTIAL / LOCALLY VERIFIED (NetworkBadge, PartyHUD, ChatBox DOM isolation verified)** |
| **M7** | Full Narrative Campaign & 4 Mythological Bosses | 4 chương cốt truyện, 4 boss thần thoại (`ForestScene`, `DungeonScene`, `VillageScene`, `BossSystem`) | `check:rpg` (5/5 boss suites), `check:campaign-control` | 4-player online campaign co-op | Server-side quest sync khi party lệch chapter, party loot distribution | **OFFLINE VERIFIED / ONLINE CO-OP PENDING** |
| **M8** | Load Testing, Security & Operations | Rate limiting (`server.ts:91-125`), CSPRNG 100k roll simulation (`check-minigames-engine.cjs`) | `check-minigames-engine.cjs` (Suite 4), `check-game-server.cjs` | 100–500 headless bot load test, packet loss injection, staging failover | Prometheus/Grafana observability, automated backup restore drill, staging deploy | **BLOCKED / NOT STARTED** |
| **M9** | Production Release Candidate (Online 1.0) | Production client build (`dist/`), game-server build (`dist/game-server/`) | `npm run build`, `npm run server:typecheck` | HTTPS/WSS hosting, production secrets, DNS | 12/12 DoD verification sign-off, live playthrough approval, release runbook | **NOT RELEASE READY** |

---

## 2. CHI TIẾT BẰNG CHỨNG TỪNG MILESTONE (M0–M9)

### M0 — Architecture Baseline & Offline Single-Player Audit
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Xác lập baseline mã nguồn offline của game (Phaser 4 + TS + Vite); đảm bảo toàn bộ hệ thống gameplay, combat, save `localStorage` và controls hoạt động ổn định; thiết lập kiến trúc ranh giới cho phiên bản online.
- **Bằng chứng mã nguồn (Code Present):**
  - `src/game/systems/GameState.ts:10-198` (offline save singleton `than-menh-van-lang-mvp-v1`).
  - `src/game/entities/Player.ts:226-485`, `src/game/systems/CombatSystem.ts:24-96`.
  - `docs/ONLINE_M0_AGY_ARCHITECTURE.md:1-550` & `docs/ONLINE_M0_CODEX_AUDIT.md:1-96`.
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `npm run check:save` — **PASS** (chuẩn hóa save và chống overwrite).
  - `npm run check:rpg` — **PASS** (5/5 boss suites, quest, dungeon checks).
  - `npm run check:player-status` — **PASS** (17 assertions về trạng thái, equipment, animation fallback).
  - `npm run check:controls` — **PASS** (8/8 master QA suites về controls, settings, touch).
  - `npm run build` — **PASS** (Vite production build thành công, 173 modules transformed).
- **Giới hạn & Chưa kiểm chứng (External Limits):** Không có rủi ro; M0 là baseline offline hoàn chỉnh.
- **Đánh giá cổng:** **PASS**.

---

### M1 — Supabase Auth, Profiles & Quản lý Nhân vật
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Người dùng đăng ký/đăng nhập qua Supabase Auth; schema database có bảng `profiles` và `characters`; kích hoạt RLS deny-by-default; người dùng A không thể đọc/sửa dữ liệu riêng của người dùng B.
- **Bằng chứng mã nguồn (Code Present):**
  - Client Auth Store: `src/game/online/auth.ts:1-108` (`signUp`, `signInWithPassword`, `signOut`, `refreshSession`, fail-closed khi thiếu `VITE_SUPABASE_URL`).
  - Auth UI: `src/game/scenes/MenuScene.ts:273-500` (panel đăng ký/đăng nhập/đăng xuất mỹ thuật Đồng Cổ, validation email/mật khẩu).
  - Migration SQL: `supabase/migrations/20261014000000_m1_profiles_and_characters.sql:1-250` (tables `profiles`, `characters`; triggers `trg_enforce_character_client_immutability`, `trg_enforce_character_initial_defaults`; RLS policies).
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-auth.cjs` — **PASS** (xác thực config guard, immutable state hooks, menu validation).
  - `node scripts/check-m1-schema.cjs` — **PASS** (61 câu lệnh SQL, triggers, RLS policies, 12/12 test cases trong mock access matrix).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - `MenuScene.ts:431` gán cứng `characterId = currentAuth.user?.id ? 'char-' + currentAuth.user.id : 'char-hero-1'`. Chưa có runtime API truy vấn danh sách nhân vật từ `public.characters` hoặc màn hình tạo nhân vật mới chuẩn UUID.
  - Chưa có kết nối Supabase từ xa (không có file `.env.local` chứa credentials thật, không có live migration execution).
- **Đánh giá cổng:** **PARTIAL / BLOCKED ON RUNTIME CHAR SELECTION & LIVE DB**.

---

### M2 — Kết nối Authoritative Server Colyseus & Phòng Chơi Đồng Bộ
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Khởi tạo Colyseus backend; xác thực JWT bằng JWKS trên `onAuth()`; 2 trình duyệt riêng biệt đăng nhập 2 tài khoản, cùng vào `village-hub`, nhìn thấy nhau di chuyển và nội suy mượt mà; server từ chối giả mạo `userId`.
- **Bằng chứng mã nguồn (Code Present):**
  - Colyseus Server: `apps/game-server/server.ts:1-387` (`PlayerRoom`, `WorldState`, `PlayerState`, `createJwtVerifier()` dùng `jose`).
  - Client Protocol & Adapter: `src/game/online/protocol.ts:1-781` (`PROTOCOL_VERSION = '1.0.0'`, `FORBIDDEN_CLIENT_AUTHORITY_FIELDS`, `validateClientIntent`), `src/game/online/multiplayer.ts:1-710` (`MultiplayerAdapter`, Colyseus SDK wrapper, fail-closed offline).
  - Remote Player Rendering & Village Sync: `src/game/online/remotePlayerRenderer.ts:1-260` (`RemotePlayerRenderer`, interpolation, sprite animation, name tag), `src/game/scenes/VillageScene.ts:1-320` (tích hợp `MultiplayerAdapter`, quản lý remote player spawn/update/despawn lifecycle, fallback an toàn).
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-network-contract.cjs` — **PASS** (10/10 anti-cheat rejection, snapshot parsing, disconnect cleanup).
  - `node scripts/check-game-server.cjs` — **PASS** (JWT verifier rejection, intent bounding, party registry).
  - `node scripts/check-village-multiplayer.cjs` — **PASS** (3/3 suites: export integrity, runtime simulation mock Phaser/adapter, VillageScene integration & offline fallback).
  - `node scripts/check-multiplayer-e2e.cjs` — **PASS** (5/5 suites: 2 SDK clients kết nối WebSocket thật qua JWKS, sync vị trí, presence 2 người chơi đồng bộ trên phòng `village-hub`).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Chưa có test harness tự động hóa 2 trình duyệt thật (Playwright/Puppeteer two-browser E2E headless/headful).
  - Chưa cấu hình WSS production trên server process thật có domain/reverse proxy.
  - Các scene gameplay khác (`ForestScene.ts`, `DungeonScene.ts`) chưa nối đầy đủ multiplayer adapter như `VillageScene.ts`.
- **Đánh giá cổng:** **PARTIAL / LOCALLY VERIFIED (E2E 2-client SDK & Village integration PASS; Two-browser harness & Remote WSS unverified)**.

---

### M3 — Chiến đấu Server-Authoritative (PvE Combat Sync)
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Logic va chạm, tầm đánh, combo timing, cooldown, tính toán sát thương chuyển lên server; Enemy AI chạy trên server tick 25Hz; 2 người chơi cùng đánh 1 quái và máu quái giảm đồng bộ; gói tin sát thương giả từ client bị server hủy bỏ.
- **Bằng chứng mã nguồn (Code Present):**
  - Server Combat Authority: `apps/game-server/server.ts:104-134` (`validateCombatIntent` chặn `damage/gold/hp/mp`, `calculateDamage` tính sát thương tất định, `createReject`).
  - Snapshot Adapter: `src/game/online/snapshotAdapter.ts:1-553` (`AuthoritativeSnapshotAdapter`, `interpolatePosition`, deep immutability, listener isolation).
  - Client Combat Intent Dispatch: `src/game/systems/CombatSystem.ts` (khi kết nối online, dispatch intent đánh thường `attack` và kỹ năng `cast_skill` qua `MultiplayerAdapter`, không trừ máu cục bộ, tuyệt đối không gửi các trường cấm `damage`, `gold`, `hp`, `mp`; hỗ trợ fallback an toàn khi mất kết nối).
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-network-contract.cjs` — **PASS** (Suite 9: Authoritative snapshot consumption, client authority claims rejected with UNAUTHORIZED).
  - `node scripts/check-game-server.cjs` — **PASS** (forged damage rejected, combo bounds enforced, dodge bounds enforced, deterministic damage calculation).
  - `node scripts/check-combat-multiplayer.cjs` — **PASS** (3/3 suites: offline direct combat mode, online authoritative intent dispatch không mang trường cấm, fail-safe handling & error resilience).
  - `node scripts/check-multiplayer-e2e.cjs` — **PASS** (Test Case 3 & 4: quái nhận sát thương tất định 10 HP từ 120 -> 110 HP phát broadcast tới cả 2 client; chặn fake damage `999999` và fake gold `50000` với mã MALFORMED, bảo vệ HP quái).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Quái vật và Boss ở scene hầm ngục/rừng rậm (`DungeonScene`, `ForestScene`) chưa hoàn toàn đồng bộ với server AI tick 25Hz qua internet; chưa có boss instanced room co-op.
- **Đánh giá cổng:** **PARTIAL / LOCALLY VERIFIED (Authoritative combat contract, intent dispatch & anti-cheat PASS; Co-op dungeon boss unverified)**.

---

### M4 — Hệ thống Tổ đội (Party) & Phân vùng Trùm (Boss Instancing)
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Giao thức mời, chấp nhận, từ chối, rời, kick, chuyển trưởng nhóm, giải tán tổ đội (tối đa 4 thành viên); phân vùng instance riêng cho boss; đồng bộ máu boss; cơ chế hồi sinh và reconnect grace period.
- **Bằng chứng mã nguồn (Code Present):**
  - Server Party Registry: `apps/game-server/server.ts:34-83` (`PartyRegistry` quản lý invite/accept/kick/disband, chặn quá 4 thành viên với mã `PARTY_FULL`).
  - Client Party Adapter: `src/game/online/partyAdapter.ts:1-350` (`PartyAdapter`, `MAX_PARTY_MEMBERS = 4`, state transitions bất biến).
  - In-Game Party HUD: `src/game/ui/PartyHUD.ts:1-280` (hiển thị danh sách tối đa 4 thành viên, chỉ số HP bar, level, icon leader, modal mời/chấp nhận/từ chối tổ đội, responsive DOM container).
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-game-server.cjs` — **PASS** (kịch bản 5 users: tạo party, invite, accept, từ chối non-member kick, chặn thành viên thứ 5 với `PARTY_FULL`, transfer leader, disband).
  - `node scripts/check-network-contract.cjs` — **PASS** (Suite 10: PartyAdapter contract, fail-closed validation, deepFreeze immutability).
  - `node scripts/check-party-hud.cjs` — **PASS** (4/4 suites: render NetworkBadge, cập nhật snapshot party và thanh máu thành viên, modal mời/chấp nhận/từ chối, dọn dẹp sạch DOM không rò rỉ listener).
  - `node scripts/check-multiplayer-e2e.cjs` — **PASS** (Test Case 5: Client A tạo party, gửi lời mời sang Client B, Client B chấp nhận; cả 2 client đồng bộ party state: Leader Lạc Tướng, 2 thành viên).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Chưa có phân vùng boss instancing đa phòng (Colyseus dynamic room creation cho từng party).
  - Chưa kiểm thử 4 người chơi co-op đánh boss thực tế qua mạng internet.
- **Đánh giá cổng:** **PARTIAL / LOCALLY VERIFIED (Party core logic, PartyHUD UI & 2-client sync PASS; Boss instancing unverified)**.

---

### M5 — Tiến trình RPG Bền vững & Giao dịch Kinh tế Idempotent
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Lưu trữ bền vững cấp độ, kinh nghiệm, vàng, checkpoint, hòm đồ vào Supabase; server quản lý giao dịch idempotent chống đúp đồ (`idempotency_key`, `save_character_progress` RPC); reload/login thiết bị khác giữ nguyên dữ liệu.
- **Bằng chứng mã nguồn (Code Present):**
  - Database Migration: `supabase/migrations/20261014010000_m5_character_progress.sql:1-170` (cột `inventory JSONB`, hàm `save_character_progress` với advisory lock `pg_advisory_xact_lock`, trigger chống sửa trộm stats).
  - Server Character Repository: `apps/game-server/characterRepository.ts:1-120` (load/save với scoping strictly `userId` + `characterId`, chỉ gọi RPC, không raw SQL).
  - Room Progress Handler: `apps/game-server/server.ts:193-233` (`handleCharacterProgressRequest`, validate request, SHA-256 idempotency key).
  - Minigames Persistent Economy: `supabase/migrations/20261014100000_minigames_schema_and_rls.sql:1-550`, `apps/game-server/minigames/RewardService.ts:1-180`.
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-m5-persistence.cjs` — **PASS** (static check migration M5 và repository, SQL tokens, transaction locks).
  - `node scripts/check-m5-runtime.cjs` — **PASS** (runtime test-double: unowned character rejected, load scoped to owner, idempotency key derived by server).
  - `node scripts/check-minigames-db.cjs` — **PASS** (113 SQL statements, 8 tables, RLS policies, 22/22 security assertions).
  - `node scripts/check-minigames-engine.cjs` — **PASS** (CSPRNG 100k simulations, daily play limits, replay guards).
- **Giới hạn & Tồn đọng đợt này (Pending this wave):**
  - **Server persistence transport qua WebSocket đang PENDING:** Kiểm thử `scripts/check-online-transport.cjs` chưa hoàn tất qua dây WebSocket do characterId mẫu chưa đúng định dạng UUID. Chưa có kết nối live database Postgres/Supabase để kiểm chứng cross-device load/save.
- **Đánh giá cổng:** **PENDING THIS WAVE / IN PROGRESS (Tuyệt đối không đánh dấu hoàn thành)**.

---

### M6 — Giao diện Online HUD, Trải nghiệm Xã hội & Điều khiển Đa nền tảng
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Cập nhật HUD hiển thị party, ping mạng; chat khu vực có lọc từ khóa/anti-spam; điều khiển song song PC (WASD/1–4/Chuột) và Mobile (Virtual Joystick/Touch Buttons), responsive không che khuất màn hình.
- **Bằng chứng mã nguồn (Code Present):**
  - Hệ thống điều khiển & cài đặt: `src/game/ui/screens/ControlsSettings.ts`, `src/game/ui/TouchControls.ts`, `src/game/input/InputManager.ts`.
  - Màn hình Auth & Trạng thái mạng: `src/game/scenes/MenuScene.ts:273-500` (panel đăng nhập, overlay trạng thái kết nối mạng).
  - Minigames Client UI & World NPCs: `src/game/ui/MinigameOverlay.ts`, `src/game/scenes/VillageScene.ts:180-260`.
  - In-game Social & HUD Components: `src/game/ui/NetworkBadge.ts` (trạng thái online/offline/reconnecting, ping latency), `src/game/ui/PartyHUD.ts` (thanh máu tổ đội), `src/game/ui/ChatBox.ts` (giao diện chat, focus/blur, cách ly hoàn toàn phím di chuyển/kỹ năng WASD và 1-4), `src/game/online/chatManager.ts` (bộ lọc XSS HTML, regex che giấu email/token JWT, rate limiting 3 tin/5s, buffer 50 tin), `src/game/ui/Hud.ts` (tích hợp NetworkBadge và PartyHUD vào HUD chính, quản lý vòng đời mount/unmount).
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `npm run check:controls` — **PASS** (8/8 master test suites: remapping, layout responsive, multi-touch isolation, Vietnamese text integrity).
  - `node scripts/check-chat-system.cjs` — **PASS** (9/9 tests: XSS injection sanitization, PII masking, rate limiting, bounded buffer, ChatBox render, input isolation phím WASD/1-4, Enter/Escape dispatch, DOM cleanup).
  - `node scripts/check-hud-multiplayer.cjs` — **PASS** (3/3 suites: khởi tạo NetworkBadge & PartyHUD trong Hud, vòng đời destroy/shutdown dọn sạch DOM node/listener, an toàn 100% trong môi trường headless).
  - `node scripts/check-party-hud.cjs` — **PASS** (4/4 suites).
  - `node scripts/check-minigames-client.cjs` — **PASS** (5/5 suites: modal barrier, input isolation, daily limits).
  - `node scripts/check-minigames-world.cjs` — **PASS** (5/5 suites: festival NPC registry, barrier bounds, collision safety).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Chưa kiểm thử hiển thị trên thiết bị di động thật (iOS Safari virtual keyboard viewport adjustment khi mở ChatBox).
  - Chưa có live production WSS server để đo ping thời gian thực qua Internet.
- **Đánh giá cổng:** **PARTIAL / LOCALLY VERIFIED (Offline input/settings, PartyHUD, NetworkBadge & Chat System hoàn chỉnh; Mobile physical verification open)**.

---

### M7 — Hoàn thiện Nội dung Trải nghiệm 4 Chương & 4 Boss Thần Thoại
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Toàn bộ cốt truyện 4 chương và 4 boss thần thoại (Lạc Thủy, Đầm Dạ Trạch, Núi Ba Vì, Phong Châu) hoạt động mượt mà trong chế độ chơi mạng; xử lý lệch chapter giữa các thành viên; không bị softlock.
- **Bằng chứng mã nguồn (Code Present):**
  - Cốt truyện & Boss: `src/game/scenes/ForestScene.ts`, `DungeonScene.ts`, `VillageScene.ts`, `src/game/systems/BossSystem.ts`.
  - Dữ liệu nhiệm vụ & trang bị: `src/game/rpg/QuestSystem.ts`, `src/game/data/weapons.ts`, `src/game/data/skills.ts`.
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `npm run check:rpg` — **PASS** (5/5 boss suites: Hổ Yêu, Thuồng Luồng, Thạch Tướng, Hắc Ấn Thần Sa; quest & dungeon logic).
  - `npm run check:campaign-control` — **PASS** (chiến dịch, điều hướng bản đồ, phần thưởng).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Tính năng co-op online cho campaign chưa được kiểm thử; chưa có cơ chế đồng bộ quest state khi 2 người chơi khác chương vào cùng party.
- **Đánh giá cổng:** **OFFLINE VERIFIED / ONLINE CO-OP PENDING**.

---

### M8 — Kiểm thử Tải, Kiểm toán An toàn & Sổ tay Vận hành (Operations)
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Kiểm thử tải mô phỏng 100–500 kết nối đồng thời; kiểm tra mạng kém (packet loss, jitter, latency 80-250ms); kiểm toán bảo mật RLS; xây dựng hệ thống logging/metrics (Prometheus/Grafana); kịch bản backup/restore staging.
- **Bằng chứng mã nguồn (Code Present):**
  - Rate limiting & input bounds trong `apps/game-server/server.ts:91-125`.
  - CSPRNG & Anti-replay simulation trong `apps/game-server/minigames/CSPRNG.ts` và `SessionManager.ts`.
- **Bằng chứng kiểm thử cục bộ (Locally Tested):**
  - `node scripts/check-minigames-engine.cjs` (Suite 4) — **PASS** (100,000 simulations đo phân phối CSPRNG xúc xắc và bầu cua không thiên vị).
  - `node scripts/check-game-server.cjs` — **PASS** (bảo mật JWT bearer, intent bounding, anti-cheat validation).
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Chưa chạy load test 100-500 bot client đồng thời qua WebSocket.
  - Chưa thiết lập hệ thống Prometheus/Grafana giám sát server process.
  - Chưa diễn tập point-in-time restore trên database staging.
- **Đánh giá cổng:** **BLOCKED / NOT STARTED**.

---

### M9 — Phát hành Phiên bản Hoàn chỉnh (Release Candidate 1.0)
- **Mục tiêu & Tiêu chuẩn nghiệm thu:** Đóng gói production frontend + server; cấu hình HTTPS/WSS và secrets production; hoàn tất runbook vận hành; đạt 12/12 tiêu chí của Definition of Done.
- **Bằng chứng mã nguồn (Code Present):**
  - Client Production Build: `npm run build` tạo bundle `dist/` thành công.
  - Server Compilation: `npm run server:typecheck` biên dịch `dist/game-server/` thành công.
- **Phần còn thiếu & Lỗ hổng (Gaps & Missing):**
  - Chưa đạt đủ các cổng nghiệm thu M1–M8.
  - Chưa có chứng chỉ TLS (HTTPS/WSS) và hosting production được phê duyệt.
- **Đánh giá cổng:** **NOT RELEASE READY**.

---

## 3. ĐỐI CHIẾU 12 TIÊU CHÍ DEFINITION OF DONE (ONLINE 1.0)

Theo **Mục 19** trong `THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md`:

| # | Tiêu chí Definition of Done (DoD) | Hiện trạng thực tế | Bằng chứng mã nguồn & Test | Tồn đọng / Lý do chưa thể coi là hoàn thành |
|---|---|---|---|---|
| **1** | Đăng ký/đăng nhập Supabase, tạo nhân vật, logout/relogin thành công | **PARTIAL** | `src/game/online/auth.ts`, `MenuScene.ts:273-500`; `check-auth.cjs` PASS | `MenuScene.ts:431` dùng pseudo characterId; chưa có API truy vấn `characters` table thật từ Supabase; chưa có live instance |
| **2** | Dữ liệu nhân vật và tiến trình lưu đúng, đọc được từ thiết bị/trình duyệt khác | **IN PROGRESS** | Migration `20261014010000_m5_character_progress.sql`, `characterRepository.ts`; `check-m5-runtime.cjs` PASS | Chưa kết nối live Postgres; transport test pending; chưa kiểm chứng đa thiết bị thật |
| **3** | Hai hoặc nhiều người chơi cùng xuất hiện, di chuyển và tương tác trong một khu vực online | **PARTIAL / LOCALLY VERIFIED** | `apps/game-server/server.ts`, `src/game/online/multiplayer.ts`, `remotePlayerRenderer.ts`, `VillageScene.ts`; `check-village-multiplayer.cjs` PASS, `check-multiplayer-e2e.cjs` PASS (Test Case 1 & 2: 2 SDK client kết nối WebSocket thật qua JWKS, presence sync 2 players, di chuyển và nhận snapshot tọa độ đồng bộ) | Chưa có test harness Playwright 2 browser tự động; chưa có production domain WSS hosting; các scene `ForestScene`, `DungeonScene` chưa hoàn tất co-op |
| **4** | Party 2–4 người hình thành, gia nhập instance và chiến đấu với quái/boss cùng nhau | **PARTIAL / LOCALLY VERIFIED** | `PartyRegistry` trong `server.ts:50-83`, `partyAdapter.ts`, `PartyHUD.ts`; `check-game-server.cjs` PASS (5-user party flow), `check-party-hud.cjs` PASS (4/4 suites), `check-multiplayer-e2e.cjs` PASS (Test Case 5: 2 client tạo party, gửi lời mời, chấp nhận, đồng bộ state) | Chưa có dynamic instanced boss room transfer; chưa có bài test 4 client co-op trong instance boss riêng biệt |
| **5** | Tất cả kết quả combat quan trọng được server xác nhận, không thể tự gửi fake gold/damage | **PARTIAL / LOCALLY VERIFIED** | `validateCombatIntent` trong `server.ts:104-125`, `src/game/systems/CombatSystem.ts`; `check-network-contract.cjs` PASS, `check-combat-multiplayer.cjs` PASS (3/3 suites: intent dispatch không mang trường cấm, offline fallback), `check-multiplayer-e2e.cjs` PASS (Test Case 3 & 4: quái nhận 10 damage tất định, chặn fake damage `999999`/fake gold `50000` mã MALFORMED) | Boss và dungeon scenes chưa đồng bộ server AI tick 25Hz qua internet; chưa có testbed giả lập mạng trễ chống lag switch |
| **6** | Có NPC, nhiệm vụ, inventory, trang bị, skill và progression kết nối với persistent storage | **PARTIAL** | Hệ thống RPG offline đầy đủ (`check:rpg` PASS); Minigames persistent schema & engine PASS (`check-minigames-db.cjs`) | Chưa đồng bộ túi đồ và quest của campaign chính từ client lên bảng `characters.inventory` qua server RPC |
| **7** | Hoạt động ổn định khi refresh/reconnect/hết phiên trong các tình huống kiểm thử | **IN PROGRESS** | Session state machine trong `MultiplayerAdapter` và `SessionManager.ts` | Chưa có kiểm thử giả lập ngắt mạng 60s và khôi phục phiên (reconnect grace period) trên browser |
| **8** | UI online gọn, đẹp, dễ nhìn, thao tác tốt trên PC/mobile; không đổi phím 1–4 hoặc thể loại Hack & Slash | **PARTIAL / LOCALLY VERIFIED** | `src/game/ui/NetworkBadge.ts`, `PartyHUD.ts`, `ChatBox.ts`, `chatManager.ts`, `Hud.ts`, `TouchControls.ts`, `ControlsSettings.ts`; `check:controls` (8/8), `check-chat-system.cjs` (9/9), `check-hud-multiplayer.cjs` (3/3), `check-party-hud.cjs` (4/4) | Chưa kiểm tra trên thiết bị di động vật lý (iOS Safari virtual keyboard viewport adjustment khi mở chat); chưa có live latency ping đo từ xa |
| **9** | RLS, privilege isolation, validated protocol và anti-abuse cơ bản đã được kiểm thử | **PARTIAL (static/mock only)** | `check-m1-schema.cjs`, `check-minigames-db.cjs`, `check-network-contract.cjs` | SQL/mock assertions không chứng minh RLS thực thi; cần kiểm tra PostgreSQL/Supabase thật và runtime abuse |
| **10** | Nội dung cốt truyện và các khu vực bắt buộc của bản 1.0 hoạt động trong mô hình online | **PENDING** | 4 chapter và 4 boss hoạt động hoàn hảo ở chế độ offline (`check:rpg`, `check:campaign-control` PASS) | Chưa có gameplay co-op online cho 4 chapter cốt truyện |
| **11** | Build production frontend + backend thành công; cấu hình HTTPS/WSS và dữ liệu phù hợp | **PARTIAL** | `npm run build` PASS, `npm run server:typecheck` PASS | Chưa cấu hình chứng chỉ TLS/WSS và máy chủ triển khai production |
| **12** | Có kết quả QA, load/security test, logging/monitoring, rollback và docs release-ready | **IN PROGRESS** | Tài liệu kiến trúc và QA (`docs/ONLINE_PROGRESS.md`, `docs/QA_MULTIPLAYER.md`) được tạo lập chi tiết | Chưa có load test 500 CCU, dashboard Prometheus/Grafana, kế hoạch rollback thực tế |

---

## 4. NHẬT KÝ LỆNH KIỂM THỬ THỰC TẾ (FOCUSED COMMANDS RUN LOG)

### 4.1. Lệnh do Worker trực tiếp thực thi trong phiên làm việc này:
1. `node scripts/check-auth.cjs` — **PASS**
   - *Kết quả:* `Auth self-check: PASS (config guard, immutable state hooks, menu validation)`.
2. `node scripts/check-m1-schema.cjs` — **PASS**
   - *Kết quả:* 61 statements parsed, triggers verified, 12/12 mock access matrix positive & negative assertions pass.
3. `node scripts/check-network-contract.cjs` — **PASS**
   - *Kết quả:* 10/10 anti-cheat rejections, protocol versioning, authoritative snapshot adapter, party adapter pass.
4. `node scripts/check-game-server.cjs` — **PASS**
   - *Kết quả:* JWT verifier rejection, forged damage rejection, combo/dodge bounds, deterministic damage, 5-user party flow pass.
5. `node scripts/check-m5-persistence.cjs` — **PASS**
   - *Kết quả:* `[M5-PERSISTENCE-CHECK] PASS` (SQL migration tokens, advisory locks, repository checks).
6. `node scripts/check-m5-runtime.cjs` — **PASS**
   - *Kết quả:* `M5 runtime self-check passed` (character ownership filter, save RPC scoping, server-derived idempotency key).
7. `node scripts/check-online-transport.cjs` — **FAILED / COMPATIBILITY REGRESSION**
   - *Kết quả tại bản review đầu:* `invalid character id`; cùng dạng lỗi có thể chặn pseudo-ID hiện hữu của Menu. Đây là regression, không phải acceptance security/persistence. Task hardening phải giữ JWT-authenticated join hoạt động, không bind pseudo-ID vào persistence, giữ fixture transport nguyên vẹn.
8. `node scripts/check-minigames-db.cjs` — **PASS**
   - *Kết quả:* 113 SQL statements, 8 tables, RLS enabled, 22/22 security assertions pass.
9. `node scripts/check-minigames-engine.cjs` — **PASS**
   - *Kết quả:* 100,000 CSPRNG roll simulations, 7321 rules, daily play limit (3/day), session state machine pass.
10. `node scripts/check-minigames-client.cjs` — **PASS**
    - *Kết quả:* 5/5 suites (MinigameClient simulation, procedural textures, modal input barrier pass).
11. `node scripts/check-minigames-world.cjs` — **PASS**
    - *Kết quả:* 5/5 suites (Festival NPC registry, world bounds barrier, collision safety pass).
12. `npm run check:save` — **PASS**
13. `npm run check:rpg` — **PASS** (5/5 boss suites pass).
14. `npm run check:player-status` — **PASS** (17 presentation assertions pass).
15. `npm run check:controls` — **PASS** (8/8 master QA suites pass).
16. `npm run build` — **PASS** (173 modules transformed, bundle JS 2,232.13 kB, chunk warning >500 kB).
17. `npm run server:typecheck` — **PASS** (TypeScript compilation của `apps/game-server/tsconfig.json` sạch sẽ).
18. `node scripts/check-multiplayer-e2e.cjs` — **PASS**
    - *Kết quả:* 5/5 test cases (Room join & presence sync M2, movement sync M2/M3, server-authoritative combat 10 HP M3, anti-cheat fake damage `999999` & fake gold `50000` rejection MALFORMED, party co-op sync M4).
19. `node scripts/check-chat-system.cjs` — **PASS**
    - *Kết quả:* 9/9 tests (XSS sanitization, PII masking email/Bearer token, rate limit 3 tin/5s, buffer 50 tin, ChatBox focus/blur, WASD/1-4 input isolation, Enter/Escape dispatch, DOM cleanup).
20. `node scripts/check-combat-multiplayer.cjs` — **PASS**
    - *Kết quả:* 3/3 suites (offline combat direct damage, online intent dispatch không mang trường cấm, fail-safe error handling & fallback).
21. `node scripts/check-hud-multiplayer.cjs` — **PASS**
    - *Kết quả:* 3/3 suites (khởi tạo NetworkBadge & PartyHUD trong Hud, vòng đời destroy/shutdown dọn sạch DOM node/listener, headless safety).
22. `node scripts/check-village-multiplayer.cjs` — **PASS**
    - *Kết quả:* 3/3 suites (RemotePlayerRenderer export integrity, runtime simulation mock Phaser/adapter, VillageScene integration & offline fallback).
23. `node scripts/check-party-hud.cjs` — **PASS**
    - *Kết quả:* 4/4 suites (NetworkBadge render trạng thái, PartyHUD snapshot & HP bar cập nhật, modal mời/chấp nhận/từ chối, dọn dẹp DOM sạch sẽ).
24. `npm run check:all` — **PASS** (Toàn bộ test suite bao gồm build, offline checks, minigames và 6 bài kiểm thử multiplayer mới chạy liên tục không gãy).

### 4.2. Bằng chứng được xác thực độc lập bởi Coordinator (Attributed Evidence):
- **Kiểm tra biên dịch & Bundle:** `npm run build` PASS (cảnh báo chunk >500KB, bundle 2.23MB).
- **Kiểm tra mã nguồn toàn dự án:** Lệnh `rg` tìm kiếm `multiplayer`, `sendMove`, `sendAttack`, `isAuthoritative` qua toàn bộ thư mục `src/game/scenes/`, `entities/`, `systems/` xác nhận chỉ có `MenuScene.ts` import và khởi tạo `MultiplayerAdapter`. Các scene gameplay (`ForestScene`, `DungeonScene`, `VillageScene`) hoàn toàn chưa nhận snapshot hoặc gửi intent mạng.
- **Kiểm tra Character ID:** `MenuScene.ts:429-431` sử dụng chuỗi giả lập `char-${currentAuth.user.id}` thay vì truy vấn bảng `public.characters`.
- **Kiểm tra môi trường:** Không tìm thấy bất kỳ file `.env*` nào có secrets hoặc công cụ `supabase`/`psql`/`postgres`/`docker` trên máy cục bộ (chỉ kiểm tra sự hiện diện tên file/tiến trình, không đọc bí mật).

---

## 5. GIỚI HẠN KIỂM CHỨNG BÊN NGOÀI (EXPLICIT EXTERNAL-VERIFICATION LIMITS)

Chưa có bằng chứng live Supabase, full browser co-op hoặc production operations trong vòng này. Không suy ra công cụ browser không khả dụng. Các hạng mục sau **không được tuyên bố DONE**:
1. **Không có kết nối Supabase Cloud / Remote PostgreSQL:** Chưa thể kiểm tra live auth qua email OTP, chưa thể push schema migration lên cơ sở dữ liệu thật.
2. **Không có cụm kiểm thử 2 trình duyệt đồng thời (Two-browser E2E):** Chưa có harness tự động mở 2 instance browser độc lập qua mạng để kiểm chứng cảm giác điều khiển, va chạm và triệt tiêu giật lag (rubberbanding).
3. **Chưa có máy chủ WebSocket Production (WSS):** Server Colyseus hiện mới chỉ chạy trong bộ nhớ máy cục bộ hoặc test harness Node.js, chưa có domain, reverse proxy hay chứng chỉ SSL/TLS.
4. **Chưa có tải mô phỏng thực tế (Load / Stress Operations):** Chưa có bài test 100–500 clients đồng thời qua mạng để đo latency P95/P99 và mức tiêu hao CPU/RAM của server tick 25Hz.
5. **Chưa kiểm tra thiết bị di động thật qua mạng Internet:** Hiện tượng đóng băng WebSocket khi tắt màn hình điện thoại hoặc đổi mạng 4G/Wifi chưa được kiểm tra trên thiết bị vật lý.
