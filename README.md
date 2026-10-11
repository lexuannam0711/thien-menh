# THẦN MỆNH: HẬU DUỆ VĂN LANG — Hack & Slash RPG H5 (MVP)

Prototype game Action RPG 2D thời Văn Lang **hư cấu**, xây dựng bằng Phaser 4 + TypeScript + Vite. **Đồ họa vẽ bằng code**, không cần tải sprite/tài nguyên có bản quyền.

## Chạy game

1. Cài Node.js 22.12+ (hoặc phiên bản Node đáp ứng yêu cầu Vite).
2. Giải nén dự án, mở terminal tại thư mục chứa `package.json`.
3. Chạy:

```bash
npm install
npm run dev
```

4. Mở URL do Vite thông báo (thường là `http://localhost:5173`).
5. Để đóng gói lên host tĩnh: `npm run build`; thư mục xuất ra là `dist/`.

## Điều khiển

| Hành động | Bàn phím | Điện thoại |
|---|---|---|
| Di chuyển | WASD / phím mũi tên | Joystick bên trái |
| Chém combo 3 đòn | J (nhấn liên tiếp) | CHÉM |
| Né (có miễn sát thương ngắn) | Space | NÉ |
| Địa Chấn (AOE, 30 MP) | Q | Q |
| Hỏa Trảm (theo hướng, 20 MP) | E | E |
| Tương tác NPC gần nhất | F | F / chạm NPC khi đứng gần |

**Điện thoại**: nên xoay ngang. Đã thiết lập nhiều điểm chạm cho joystick và nút kỹ năng.

## Vòng chơi hiện tại

1. Ở làng Lạc Thủy, đến gần Trưởng làng và nhấn F để nhận nhiệm vụ.
2. Đi đến cổng phía đông (bên phải màn hình), sang Rừng Trúc.
3. Hạ 6 quái **Mộc Tinh / Ma Trơi**, dùng tiền đồng để nâng giáo ở Thợ rèn hoặc hồi phục ở Bà Mo.
4. **Hổ Yêu U Minh** xuất hiện sau khi đạt mốc 6 quái. Hạ boss.
5. Quay về bằng cổng phía tây, nói chuyện Trưởng làng để nhận thưởng và kết thúc chương 1.

Game tự lưu vào localStorage: HP/MP, tiền, cấp, công, nhiệm vụ và boss. Nút “Chơi lại từ đầu” ở Menu xóa tiến trình của demo.

## Cấu trúc

```
src/
├── data/config.ts                 # Cân bằng, hệ số, bảng quái
├── game/entities/Player.ts        # Điều khiển, combo, né, kỹ năng, chỉ số
├── game/entities/Enemy.ts         # AI truy đuổi, báo trước đòn, HP, chết
├── game/systems/CombatSystem.ts   # Hitbox hình quạt/đường thẳng/vòng tròn
├── game/systems/GameState.ts      # Dữ liệu nhân vật & localStorage
├── game/scenes/MenuScene.ts       # Màn hình menu
├── game/scenes/VillageScene.ts    # Làng, NPC đa chức năng
├── game/scenes/ForestScene.ts     # Chiến trường, spawn quái/boss
├── game/scenes/VictoryScene.ts    # Kết chương
├── game/ui/TouchControls.ts       # Joystick ảo & phím H5
├── game/ui/Hud.ts                 # HP/MP, tiền, nhiệm vụ, toast
└── game/ui/art.ts                 # Đồ họa placeholder bằng Phaser primitives
```

## Ranh giới MVP

**Đã có trong code**: chơi hai khu, 3 NPC tương tác (trưởng làng có quest, thợ rèn nâng cấp, bà mo hồi phục), combo 3 đòn, né, 2 kỹ năng, 2 quái + 1 boss có báo trước đòn đánh, HP/MP/XP/level/tiền đồng, save tiến trình, điều khiển cảm ứng, màn hình hoàn thành.

**Chưa có**: spritesheet và animation nhân vật thật, tilemap Tiled, vật cản vật lý, pathfinding, mạng/backend, tài khoản, bảng xếp hạng, nhiều quest và chuỗi combo cao cấp (animation cancel, hit-stop), âm thanh. Đây là prototype gameplay, không phải bản game phát hành thương mại.

### Việc nên làm tiếp theo

1. Đổi `art.ts` sang pixel art 32/48px, dùng spritesheet cho đòn chém.
2. Xuất map Tiled định dạng JSON, thêm lớp va chạm bằng Arcade Physics.
3. Chuyển nội dung NPC và quest sang file JSON, có điều kiện theo tiến trình.
4. Thêm animation states `idle/run/attack1/attack2/attack3/dodge/hit/death`.
5. Thiết kế vòng chơi 10–15 phút, kiểm thử trên điện thoại màn hình nhỏ.

## Ghi chú

- Phaser: https://phaser.io/download/phaser4
- Hướng dẫn Vite: https://vite.dev/guide/
- Nội dung về thần lực, yêu khí và nhân vật là sáng tạo fantasy lấy cảm hứng từ lịch sử/truyền thuyết Việt Nam.
