# GAME DESIGN DOCUMENT — THẦN MỆNH: HẬU DUỆ VĂN LANG

## 0. Tầm nhìn

- **Pitch:** Một thanh niên làng Lạc Thủy được Vua Hùng thứ 18 chọn tiếp nhận Thiên Mệnh Ấn. Anh chiến đấu với yêu quái để bảo vệ dân làng và lên đường đến Phong Châu.
- **Cảm xúc:** Sảng khoái khi chiến đấu, thân thuộc khi quay về làng, huyền bí khi thần lực thức tỉnh.
- **Trụ cột:** (1) Combo rõ nhịp, (2) thần lực diện rộng, (3) NPC có công dụng rõ ràng, (4) fantasy Việt Nam.
- **Thiết bị mục tiêu:** Android/iPhone trình duyệt ngang, máy tính; game xuất HTML5.
- **Giới hạn:** Single-player offline-first, không tài khoản/backend, không multiplayer, 10–15 phút gameplay.

## 1. Core loop

1. Nhận nhiệm vụ từ trưởng làng.
2. Đi qua cổng làng sang Rừng Trúc.
3. Diệt Mộc Tinh/Ma Trơi để có XP, tiền đồng.
4. Dùng combo 3 đòn (J), né (Space), Địa Chấn (Q), Hỏa Trảm (E).
5. Đạt 6 mạng hạ gục để gọi boss; đánh Hổ Yêu (giai đoạn 2 khi HP còn 50%).
6. Về làng, tương tác trưởng làng, nhận thưởng, mở đoạn kết chương.
7. Mua nâng cấp giáo ở thợ rèn, hồi phục ở bà mo; chơi lại nếu muốn.

## 2. Combat metrics để tune

| Cơ chế | Giá trị demo | Tiêu chí kiểm thử |
|---|---|---|
| Di chuyển | 190 px/s | Chạy qua màn hình trong vài giây |
| Combo | 3 đòn, 100/120/170% ATK | Nhấn J liên tục thấy 3 nhịp khác nhau |
| Cửa sổ combo | 690ms | Chờ quá lâu trở về đòn 1 |
| Né | 190ms, 540 px/s | Né khi báo trước đòn quái |
| CD né | 1200ms | Không né liên tục vô hạn |
| Địa Chấn | 3x ATK, bán kính 153px, 30 MP, CD 5s | Làm sạch cụm quái gần |
| Hỏa Trảm | 2.25x ATK, đường thẳng 280px, 20 MP, CD 3s | Quét quái nằm trên một đường |
| Hồi MP | 7.5/giây | Có thời gian chờ giữa các lượt dùng kỹ năng |
| Mộc Tinh | HP 43, ATK 8, tốc độ 66 | Quái áp sát chậm |
| Ma Trơi | HP 29, ATK 6, tốc độ 88 | Quái nhanh, ít máu |
| Hổ Yêu | HP 285, ATK 19, tốc độ 76 | Boss có telegraph |
| Boss phase 2 | <=50% HP, +30% tốc độ, đập vòng mỗi đòn thứ hai | Cần đổi nhịp né |

Phân biệt hai quái thường trong MVP chủ yếu bằng thông số; AI tấn công hiện là chung. Nên bổ sung AI bắn xa cho Ma Trơi ở bước tiếp theo.

## 3. NPC đa chức năng

| NPC | Chức năng MVP | Sau MVP |
|---|---|---|
| Trưởng làng | Nhiệm vụ, cốt truyện, trả thưởng | Tuyến truyện rẽ nhánh, danh vọng |
| Thợ rèn | Nâng cấp giáo bằng tiền, trò chuyện | Mua/bán, nguyên liệu, trang bị, sửa đồ |
| Bà Mo | Hồi HP/MP, giải thích thần lực | Cây kỹ năng, đổi điểm thiên mệnh, buff |

Định hướng dữ liệu về sau: mỗi NPC có `id`, `dialogues`, `services[]`, `conditions[]`, `schedule`, `relationships`.

## 4. Enemy AI states

```
Idle → Chase (thấy người chơi trong tầm) → Telegraph (báo đòn)
                     ↑                            ↓
                     └──────── Cooldown ← Attack/Hit
                                   ↓
                              HP <= 0 → Dead → Reward
```

Boss chuyển sang `Enraged` khi còn 50% máu. Sang phase 2, tăng tốc và xen kẽ đập vòng tròn lớn, đòi hỏi né đúng thời điểm.

## 5. Điều kiện thắng/thua

- Hoàn thành: `quest=complete` sau khi đủ 6 quái, boss chết và báo trưởng làng.
- Gục ngã: khi HP=0, mất tối đa 10 tiền đồng, hồi ở làng. Nhiệm vụ vẫn lưu.
- Tăng cấp: đạt ngưỡng XP sẽ tăng chỉ số tấn công, max HP/MP, hồi đầy.
- Lưu: `localStorage` với khóa phiên bản v1, tránh phá dữ liệu khi bổ sung tính năng.

## 6. Milestone
## 8. Roadmap triển khai 2026-10-12

Phạm vi: chương 1 single-player fantasy Văn Lang, chơi 10–15 phút; giữ scene hiện có. Checklist là việc cần thực hiện, không phải bằng chứng hoàn tất.

| Mốc | Owner / file | Deliverable | Acceptance |
|---|---|---|---|
| P0 | Codex: GameState.ts, utils/SaveCodec.ts | Save version, validation số hữu hạn/range/quest, migration, bảo vệ save hỏng/tương lai, xử lý quota/denied storage | Fixtures save hợp lệ/hỏng/cũ/tương lai; lỗi write không phá save cũ; build |
| P1 | Codex: Player.ts, Enemy.ts, CombatSystem.ts, config.ts, Hud.ts | Combo 100/120/170%, cửa sổ 690ms; windup/active/recovery, input buffer; hit một lần/mục tiêu; hit-stop hiển thị, knockback, stagger, flash, damage number, cooldown UI | Timing/geometry checks; browser combo/Q/E/né, cooldown không kéo dài bởi hit-stop |
| P2 | Codex: Enemy.ts, data/enemies.ts, EnemyFSM.ts khi cần | Một nguồn FSM; Mộc Tinh cận chiến, Ma Trơi giữ khoảng cách/bắn; boss phase 50%, vồ/quét/slam | FSM tests; dead không attack, reward một lần, ra khỏi telegraph tránh được hit |
| P3 | Coordinator: VillageScene.ts, ForestScene.ts, world/CollisionGrid.ts | Collision, portal, spawn/camera bounds; map Tiled JSON production | Né không xuyên vật cản; portal hai chiều; 20 lần đổi scene không tăng listener |
| P4 | Codex: data/npcs.ts, data/quests.ts, NPCSystem.ts, QuestSystem.ts | Dialogue/Quest/Upgrade/Healing, hội thoại theo state; Locked/Available/Active/Completed/RewardClaimed | Nhận quest, sáu kill, boss, quay làng claim; reload không nhận lặp |
| P5 | Codex: data/items.ts, InventorySystem.ts, EquipmentSystem.ts, StatsSystem.ts | Stack, consumable, shop, weapon/armor/accessory; upgrade/crafting và skill tree nhỏ; stats tính tập trung | Không âm item/gold; equip không nhân buff; migration giữ tiến trình |
| P6 | Antigravity: game/assets/*; coordinator nối renderer | Tự vẽ sprite/props/VFX/UI/animation; preview sheet, metadata, fallback primitive | Frame bounds, texture keys, screenshot làng/rừng/combat; asset thiếu không crash |
| P7 | Coordinator + reviewer | Vertical slice từ save mới đến Victory, pause Esc, death/checkpoint/reload, cân bằng 10–15 phút | Chơi hết không sửa state; đo thời lượng, console sạch, không soft-lock |
| P8 | QA + coordinator: main.ts, TouchControls.ts, release assets | Landscape/safe-area, multitouch, background pause, audio sau gesture, offline cache | Production build; PC Chrome, Android Chrome, iPhone Safari thực; offline reload |

### Dependency và phân công

P0 trước P1; P1 trước P2; P3 trước P4; P4 trước P5. Art P6 sản xuất song song P1/P2, tích hợp sau review. P2/P3/P4/P5/P6 cùng đạt mới nghiệm thu P7, rồi P8. Không hai worker cùng sửa một file; build nặng nối tiếp. Wave sau tối đa hai worker triển khai để giảm tải máy. Coordinator giữ scene integration và acceptance; Codex sở hữu domain/tests; Antigravity sở hữu art source mới. Review diff thực và chạy acceptance trước release worker. Không commit/merge/push/deploy tiếp nếu chưa được Admin duyệt cụ thể.

### Hợp đồng asset và animation

- Palette: đồng #a57738/#dfb15b, lúa #7fa958, gỗ #6e4a28, rừng #1c3a2b, yêu khí #77558f, lửa #ef8c4a. Nhà sàn, tre, ruộng, trống đồng, chim Lạc là cảm hứng fantasy; không trình bày hư cấu là lịch sử.
- Player/NPC frame 32x48, Mộc Tinh 40x48, Ma Trơi 32x32, boss 80x80; tile 16x16. Origin chân (0.5, 0.9), collision radius riêng. Scale nguyên, nearest filtering.
- Key: hero-idle-down, hero-run-down, hero-attack1-down, hero-attack2-down, hero-attack3-down, hero-dodge-down, hero-hurt-down, hero-death-down. Bốn hướng down/up/left/right. Enemy prefix moc-tinh/ma-troi/ho-yeu. VFX: vfx-slash, vfx-impact, vfx-earth, vfx-flame.
- Idle 2 frame/4fps; run 4 frame/10fps; attack 4 frame; dodge 3; hurt 2; death 4. Combat clock quyết định hit frame, không dùng animation callback làm nguồn damage/cooldown thứ hai.
- Antigravity vẽ frame/props; Codex tạo procedural Canvas texture và metadata. Ưu tiên player/enemy, sau đó slash/Q/E/impact, NPC, nhà sàn/tre/lúa/suối và UI đồng/gỗ. Mỗi lô có preview sheet; atlas chưa import không được coi là đã tích hợp.
- Không download asset không rõ license, không job trả phí/dependency mới khi chưa duyệt. Fallback tối thiểu: texture tự tạo, thiếu thì primitive hiện tại. Không xây loader ba tầng khi chưa cần atlas ngoài.

### Test và proof boundaries

- TDD domain: combo boundary 689/690/691ms, mỗi active window hit một lần, phía sau không trúng cone; thiếu MP; cooldown boundary; dodge i-frame; stagger/death; boss 50%; claim reward một lần; inventory không âm; migration và malformed save.
- Baseline chưa có test script. Bắt đầu bằng assert self-check cho module thuần, không thêm framework khi chưa cần. Target coverage domain 80% trở lên; chỉ công bố nếu đo được. Unit không thay thế scene integration/browser E2E.
- Lệnh hiện có: npm run build chạy tsc --noEmit và Vite. npm test chỉ dùng sau khi script thực sự tồn tại. Bàn giao từng task phải ghi runner/output, không ghi test giả định là pass.
- Integration: payout + kill/boss marker lưu cùng transaction; không persist reward trước marker. Death/transition không thực thi hai lần trong cùng frame. Write storage lỗi phải giữ dữ liệu cũ.
- Browser: Menu → Village → nhận quest → Forest → combo/Q/E/né → boss hai phase → Village → claim → Victory. Reload từng checkpoint; thu console errors, screenshot/video; không chỉnh localStorage để giả hoàn thành gameplay.
- Touch: giữ joystick cùng attack/né/skill; thả ngoài canvas, pointercancel, blur/background rồi trở lại không kẹt. Emulation không thay thế Android/iPhone thật.
- Visual: preview mọi frame, bốn hướng và weapon đúng; chân khớp collision; VFX không che telegraph; HUD đọc được ở 640x360 và landscape mobile. Admin duyệt art trước khi gọi là đẹp/hoàn chỉnh.
- Performance: mục tiêu 60fps máy đủ mạnh, đo frame-time p95 thiết bị yếu; không hứa 60fps mọi máy. Ban đầu cap 7 enemy thường + 1 boss, VFX có TTL/cap. Đo heap sau 20 scene transitions. Cảnh báo chunk >500kB cần đo, không tự động split.
- Offline: localStorage chỉ lưu state, không bảo đảm reload mất mạng. P8 cache app shell/assets có version; kiểm update/rollback và offline reload sau lần tải đầu.
- Bàn giao: ownership diff, lệnh/output, browser/device đã kiểm, phần chưa kiểm; chạy npm run dev, hoặc npm run build rồi npm run preview. Không chứng nhận production chỉ từ build xanh.


**M1 — Vertical slice (đã có mã mẫu):** scene + di chuyển + đánh + boss + NPC + quest + save.

**M2 — Feel chiến đấu:** animation tám hướng hoặc bốn hướng; 5 frame hitstop, stagger, knockback cân bằng, âm thanh vũ khí và impact; hitbox khớp frame animation.

**M3 — Art và bản đồ:** vẽ sprite sheet nhân vật/quái; tilemap Tiled; vật cản và vùng tương tác; quy hoạch làng có nhận diện văn hóa Đông Sơn.

**M4 — RPG systems:** quest data-driven, kho đồ, chế đồ, trang bị, kỹ năng, 5 NPC trở lên; boss thêm kỹ năng và âm thanh cảnh báo.

**M5 — Phát hành H5:** tối ưu atlas/texture, giảm draw calls, cân FPS trên máy yếu, test touchscreen, âm thanh sau tương tác, xử lý resize và background tab, build release, deploy.

## 7. Chạy thử và kiểm tra MVP

- [ ] Vào Menu rồi tới làng.
- [ ] Lại gần Trưởng làng, F để nhận nhiệm vụ.
- [ ] Đi sang phải qua cổng, thấy Rừng Trúc.
- [ ] WASD và joystick đều di chuyển; J có combo; Q/E giảm MP; Space né.
- [ ] Đòn chém theo hướng chỉ trúng quái trong phạm vi; Q trúng vòng; E trúng đường thẳng.
- [ ] Quái đuổi và tấn công khi áp sát, có vùng báo trước.
- [ ] Hạ 6 quái gọi boss; boss dưới 50% HP vào phase 2.
- [ ] Hạ boss, quay lại làng nhận thưởng, thấy màn hình hoàn thành.
- [ ] F tương tác với Thợ rèn/Bà Mo để nâng cấp/hồi phục.
- [ ] Reload trang rồi kiểm tra tiền, cấp, nhiệm vụ vẫn lưu.
- [ ] iPhone/Android landscape chạy được, đa chạm không xung đột.

Các ô đánh dấu là **checklist kiểm thử**, không phải kết quả kiểm thử đã thực hiện.
