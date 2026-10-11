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
