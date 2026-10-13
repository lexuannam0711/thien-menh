# MASTER PROMPT — THẦN MỆNH: HẬU DUỆ VĂN LANG
## CROSS-PLATFORM INPUT SYSTEM + PREMIUM COMPACT UI/UX
**Mục tiêu:** Xây dựng và tích hợp trọn vẹn hệ điều khiển PC (chuột + bàn phím), cảm ứng mobile/tablet, khả năng cấu hình phím và thiết kế lại UI/UX rõ ràng, gọn, đẹp, nhất quán trên mọi nền tảng của game H5.

> **Đây là chỉ thị triển khai, không phải yêu cầu viết đề xuất.** Nếu có repository và công cụ, hãy trực tiếp đọc code, chỉnh sửa, chạy build, kiểm thử, sửa lỗi và bàn giao phần triển khai. Không tạo lại toàn bộ game khi có thể kế thừa hệ thống hiện tại.

---

## 0. GOAL & PHẠM VI KHÔNG ĐƯỢC ĐỔI

- **Game:** Thần Mệnh: Hậu Duệ Văn Lang.
- **Thể loại:** **2D top-down Hack & Slash Action RPG** thời gian thực; **không** đổi thành 3D, isometric, side-scroller, auto-battle hoặc turn-based.
- **Bối cảnh mỹ thuật:** Văn Lang giả tưởng / thần thoại Việt Nam; phong cách pixel art có độ hoàn thiện cao; UI dùng cảm hứng đồng cổ, gỗ, hoa văn Đông Sơn tiết chế.
- **Công nghệ chính:** Phaser 4 + TypeScript + Vite; ưu tiên tái sử dụng repository hiện có, không thay engine.
- **Nền tảng:** Desktop browser (Windows/macOS/Linux), Android Chrome, iPhone Safari, tablet có cảm ứng; hỗ trợ thay đổi kích thước trình duyệt và các chế độ input hỗn hợp (laptop màn hình cảm ứng, tablet có chuột/bàn phím).
- **Kết quả bắt buộc:** **Input thật hoạt động trong game**, HUD và các giao diện thật được tích hợp, điều khiển có thể tùy biến, không xung đột UI/Gameplay, bố cục đẹp và **gọn, dễ nhìn, dễ bấm, ít che màn hình**.
- **Không chấp nhận là kết quả cuối:** tài liệu-only, concept-only, ảnh mockup, Figma-only, button không có handler, animation giả, hoặc UI đẹp nhưng không dùng được.

## 1. VAI TRÒ CỦA AGENTS

Bạn hoạt động như đội sản xuất có điều phối:

1. **Input Architect / Gameplay Engineer:** input abstraction, keyboard, mouse, pointer/touch, combo và skill dispatch.
2. **UX Director:** interaction model PC/mobile/tablet, information architecture, user journeys và kiểm tra tính dễ dùng.
3. **UI Visual Designer:** visual system, layout, typography tiếng Việt, icon, states, HUD và menu.
4. **Phaser UI Engineer:** UI scenes, layout, components, scaling, graphics và các tích hợp thực tế.
5. **Accessibility & Mobile Specialist:** chạm đa điểm, screen sizes, safe areas, visibility, focus và hỗ trợ sử dụng linh hoạt.
6. **QA & Performance Agent:** regression, input tests, UI tests, screenshot QA và đo FPS.
7. **Orchestrator:** giao việc, giải quyết dependency, tích hợp và nghiệm thu.

Nếu môi trường không có multi-agent thì một agent chính lần lượt đảm nhiệm các vai trò; **không giả vờ** có sub-agents hay background execution.

## 2. AUDIT SOURCE CODE HIỆN TẠI TRƯỚC KHI VIẾT MỚI

Đọc trước:

- `src/game/entities/Player.ts` — di chuyển/đánh/combo/né/kỹ năng.
- `src/game/ui/TouchControls.ts` — joystick và các nút chạm.
- `src/game/ui/Hud.ts` — HP/MP/EXP, tiền, nhiệm vụ.
- `src/game/ui/art.ts` — art placeholder / UI primitives.
- `src/game/scenes/MenuScene.ts`, `VillageScene.ts`, `ForestScene.ts`, `VictoryScene.ts` — scene, NPC, HUD và giao diện.
- `src/game/systems/GameState.ts`, `CombatSystem.ts`, `src/data/config.ts`, `src/style.css`, `src/main.ts`, `package.json`.

Các đường dẫn trên là **source ban đầu đã biết**. Nếu repository đã được refactor, hãy phát hiện vị trí mới thay vì tạo file trùng.

Kiểm kê: keybindings cũ (WASD/J/Space/Q/E/F), nơi đăng ký sự kiện, render layer, thứ tự pointer event, lưu setting, scene cleanup, canvas scaling, layout camera, và thiết bị có touch/mouse.

**Bảo toàn gameplay:** combo 3 đòn, kỹ năng Địa Chấn và Hỏa Trảm, né, tương tác NPC, đánh boss, nhiệm vụ, save và tiến trình game phải còn hoạt động sau nâng cấp. **Thay đổi keybinding mặc định từ Q/E/R/T cũ sang 1/2/3/4**, có migration an toàn cho settings đã lưu; không đổi bản chất hoặc chỉ số kỹ năng.

## 3. BỘ ĐIỀU KHIỂN PC — BẮT BUỘC

### 3.1. Default keymap chính thức

| Hành động | Điều khiển mặc định | Quy tắc |
|---|---|---|
| Di chuyển | **W A S D** hoặc **↑ ← ↓ →** | Di chuyển 8 hướng; normalize vector đi chéo để không chạy nhanh hơn |
| **Tấn công thường / nối combo** | **Chuột trái (LMB)** | Click hoặc bấm giữ theo quy tắc combo rõ ràng; không vô tình bấm vào UI để đánh |
| Tấn công thay thế | **J** | Giữ tương thích bản code trước, có thể remap |
| Né / lướt | **Space** | Cooldown và i-frame như gameplay hiện có |
| Né bằng chuột (tùy chọn) | **Chuột phải (RMB)** | Cho phép bật/tắt/remap; chỉ chặn context menu khi đang dùng trên vùng game |
| Kỹ năng 1 — Địa Chấn | **1** | MP, cooldown, tooltip, hotkey label `1` |
| Kỹ năng 2 — Hỏa Trảm | **2** | MP, cooldown, tooltip, hotkey label `2` |
| Kỹ năng 3 (khi mở khóa) | **3** | Slot rỗng/ẩn hoặc khóa đúng trạng thái khi chưa có kỹ năng |
| Kỹ năng 4 / Ultimate (khi có) | **4** | Không tạo kỹ năng giả chỉ để lấp ô |
| Tương tác NPC, nhặt đồ | **F** | Chỉ hoạt động khi ở trong tầm; có prompt ngữ cảnh |
| Túi đồ | **I** hoặc **Tab** | Ngăn Tab gây tác dụng browser không mong muốn chỉ khi có lý do và canvas focused; duy trì khả năng keyboard navigation khi menu mở |
| Nhiệm vụ | **L** | Mở/đóng Journal nếu tính năng hiện hữu |
| Nhân vật / trang bị | **C** | Mở panel nếu hiện hữu |
| Cây kỹ năng | **K** | Mở panel nếu hiện hữu |
| Bản đồ | **M** | Mở/đóng nếu có map UI |
| Tạm dừng / đóng panel | **Esc** | Ưu tiên đóng modal trên cùng, sau đó pause |
| Vật phẩm nhanh | **5–8** | Dành riêng cho vật phẩm; chỉ hiển thị/tác dụng với quick slots đã triển khai, có thể remap |

**Quy tắc chính thức:** Hàng số **1/2/3/4** dành riêng cho bốn slot kỹ năng, theo thứ tự trái → phải trên HUD. **5/6/7/8** dành cho vật phẩm dùng nhanh (chỉ khi được triển khai). **Q/E/R/T không còn là phím kỹ năng mặc định**; chỉ dùng nếu người chơi chủ động gán lại ở Settings. WASD luôn phục vụ di chuyển, không dùng W làm skill. Khi chỉ có hai kỹ năng thật, ô 3/4 hiển thị khóa gọn hoặc ẩn hợp lý, không tạo kỹ năng giả. Đổi phím phải cập nhật nhãn HUD, tooltip, hướng dẫn, dữ liệu lưu và bản đồ sự kiện input một cách đồng bộ. Khi bắt key số, xử lý rõ `Digit1`–`Digit8` và chính sách `Numpad1`–`Numpad8` trên PC; không phát động gameplay khi đang nhập văn bản hoặc chỉnh phím.

### 3.1a. Tương thích keybindings và migration

- Mapping mặc định chính thức: `SKILL_1 = Digit1`, `SKILL_2 = Digit2`, `SKILL_3 = Digit3`, `SKILL_4 = Digit4`; `QUICK_ITEM_1..4 = Digit5..Digit8`. Sử dụng `KeyboardEvent.code` hoặc cơ chế tương đương được Phaser hỗ trợ sau khi kiểm tra API thật.
- Với `Numpad1..8`, hỗ trợ nếu cách phát hiện phím ổn định và không xung đột với navigation/Num Lock; định nghĩa rõ trong Settings.
- Nếu người chơi đã lưu custom keymap, không âm thầm ghi đè: nâng schema, kiểm tra xung đột, ưu tiên giữ thao tác người dùng tự gán; chỉ áp dụng mặc định mới cho cấu hình chưa tùy biến hoặc có quy tắc migration đã được kiểm thử.
- Cập nhật tooltip, hướng dẫn tân thủ, phím hiển thị ở HUD, settings, QA và test automation.
- Input số chỉ kích hoạt kỹ năng khi context `Gameplay` hợp lệ, không kích hoạt khi đang chọn số lượng vật phẩm hoặc nhập liệu.

### 3.2. Chuột và cảm giác Hack & Slash

- LMB là đòn đánh thường, không bị ảnh hưởng bởi sự kiện pointer được UI tiêu thụ.
- Thiết kế **input buffering** và quy tắc giữ chuột: mặc định click nối combo, có thể bật chế độ giữ để tự lặp đòn trong Settings; không tạo tấn công vô hạn vượt attack recovery.
- Khi dùng chuột, định hướng đòn đánh **ưu tiên theo vị trí con trỏ nếu cơ chế hiện tại hỗ trợ aiming theo chuột**; nếu source đang đánh theo hướng nhân vật thì giữ default cũ và cung cấp option aim mode hoặc nâng cấp một cách có kiểm thử. Không âm thầm thay combat semantics.
- Tọa độ aim phải chuyển đổi đúng `screen/canvas -> camera/world`; không nhầm khi zoom, pan, letterbox hoặc thay đổi DPI.
- Phân biệt `pointerdown`, `pointerup`, click, drag, hold; giải phóng đúng khi cửa sổ mất focus.
- Chặn context menu **chỉ trên gameplay canvas** khi RMB được map thành hành động. Không can thiệp toàn trang không cần thiết.
- Scroll wheel mặc định không đổi kỹ năng nếu chưa thiết kế; chỉ thêm nếu có cơ chế chuyển slot an toàn.
- Trỏ chuột qua UI: tooltip, hover, focus rõ; nhấn UI sẽ không đánh quái xuyên qua UI.
- Không khóa pointer bằng Pointer Lock nếu không cần cho game top-down.

### 3.3. Keyboard UX & rebinding

- Có màn hình **Settings → Controls**: hiển thị, đổi phím, khôi phục mặc định.
- Kiểm tra xung đột hai hành động có cùng phím; cảnh báo rõ và cho phép hoán đổi hoặc từ chối.
- Không ghi keybinding invalid hoặc làm mất phím thoát menu.
- Có sẵn profile PC Keyboard + Mouse, có thể thêm keyboard-only; gamepad chỉ khi đã triển khai thực tế.
- Lưu mapping theo schema version; giữ map cũ khi migration.
- Không trigger hành động gameplay khi chat/text input, modal, remapping capture hoặc màn hình menu đang được focus.
- Xử lý key repeat, simultaneous keys và tình huống nhấn/thả nhiều nút nhanh.

## 4. ĐIỀU KHIỂN MOBILE — ĐẸP, GỌN, DỄ NHÌN, DỄ BẤM

### 4.1. Mobile landscape mặc định

- **Bên trái dưới:** joystick ảo, vị trí có thể cố định hoặc floating theo setting.
- **Bên phải dưới:** nút **Đánh** lớn nhất, **Né** nhỏ hơn, 2–4 nút skill theo trạng thái mở khóa.
- **Nút F/tương tác:** chỉ xuất hiện khi có NPC/vật thể trong tầm; nhấn đủ vùng; tránh che nút đánh.
- **Bình máu / quick item:** vị trí gọn, không tranh vùng thao tác; chỉ hiện khi có vật phẩm dùng được.
- **Không đưa ký tự 1/2/3/4 làm nhãn chính trên điện thoại**; dùng icon kỹ năng và trạng thái cooldown, tooltip tùy hoàn cảnh.
- **Đa chạm thực:** cùng lúc giữ joystick + giữ/chạm Attack + dùng skill/dodge; mỗi pointer có owner và lifecycle độc lập.
- Không để vuốt joystick kích hoạt kỹ năng hoặc ngược lại; không trigger khi vuốt từ ngoài button vào nếu thiết kế không cho phép.
- Các nút ưu tiên hit area ít nhất khoảng **44–48 CSS px** ở mật độ hiển thị phù hợp; Attack có thể **56–72 CSS px** tùy thiết bị; phải kiểm tra thực tế, không cố định cho mọi máy.
- Visual footprint có thể nhỏ hơn touch hit area nhưng không để các hit area ẩn chồng lên nhau.
- Button opacity tùy chỉnh trong Settings; giữ độ nhận biết cao, không làm các nút gần như vô hình.
- Có preset **Left-handed** (đảo vị trí joystick và attack cluster) và **Right-handed**.
- Cho phép chỉnh **Control Scale**, **Button Opacity**, **Joystick Position**, **Button Spacing**; lưu và reset layout.

### 4.2. Tablet / hybrid

- Dùng bố cục touch cân đối với kích thước màn hình lớn hơn; không phóng các nút quá lớn như mobile.
- Tablet kết nối chuột hoặc bàn phím phải xử lý được **mixed input**; không chỉ dựa vào user-agent để chọn controls.
- Tự phát hiện **pointer capabilities**, keyboard usage và last active device, nhưng không giật chuyển layout khi người chơi vô tình chạm màn hình.
- Cho phép override `Auto / Desktop / Touch` trong settings nếu cần.

### 4.3. Portrait và màn hình đặc biệt

- **Landscape là trải nghiệm thiết kế chính.** Khi portrait, hiển thị hướng dẫn xoay ngang đẹp, có nút fullscreen nếu khả thi và không ngăn người chơi điều hướng khỏi màn hình.
- Nếu yêu cầu hỗ trợ portrait thật, thiết kế layout chuyên biệt thay vì ép co HUD landscape; chỉ đánh dấu hoàn thành khi đã test.
- Hỗ trợ các khu vực `safe-area-inset-*`, camera cutout, rounded corners và browser toolbars.
- Không đặt nút quan trọng sát mép khiến dễ kích hoạt gesture hệ điều hành.

## 5. THIẾT KẾ LẠI TOÀN BỘ UI/UX THEO TRIẾT LÝ COMPACT

**Thiết kế mục tiêu:** *Premium Ancient Bronze Fantasy UI* — lấy cảm hứng đồng Đông Sơn, nền than tối, vàng đồng, điểm xanh ngọc/thần lực. Có chiều sâu nhưng **ưu tiên dễ đọc hơn trang trí**.

### 5.1. 10 nguyên tắc UI

1. **Gameplay first:** vùng giữa màn hình thông thoáng, không phủ các panel lớn khi chiến đấu.
2. **Hierarchy:** ưu tiên HP, MP, cooldown, boss telegraph, tương tác, mục tiêu nhiệm vụ.
3. **Compact, not tiny:** giảm khoảng thừa và chi tiết rườm rà, không giảm chữ xuống mức khó đọc.
4. **Contextual disclosure:** nút/tooltip chỉ hiện khi cần, skill chưa có không chiếm diện tích vô lý.
5. **Adaptive HUD:** PC, tablet, phone không dùng đúng một layout phóng/thu máy móc.
6. **Consistency:** một token system cho radius, spacing, type, icon, shadow, stroke, color.
7. **Readability:** text đầy đủ dấu tiếng Việt; tương phản đủ cao; không dùng font pixel quá nhỏ cho nội dung dài.
8. **Combat clarity:** không che vùng báo trước đòn, HP boss hoặc vị trí của nhân vật.
9. **Accessible input:** hình/label + tooltip/cooldown, không chỉ dựa vào màu.
10. **Low-cost effects:** chuyển động UI tinh tế (120–220 ms gợi ý), tránh blur hoặc shader nặng trên mobile.

### 5.2. Thiết kế HUD cụ thể

**Desktop / PC**
- Góc trên trái: thanh HP + MP xếp gọn, level gần avatar nhỏ; hiển thị EXP kín đáo.
- Góc trên phải: nút menu, icon bản đồ (nếu có), quest tracker dạng thu gọn và có thể mở rộng.
- Mép dưới (giữa hoặc phải): quickbar bốn ô kỹ năng gán **1/2/3/4**, hiển thị nhãn số rõ, icon, MP/cooldown; vật phẩm **5/6/7/8** nếu tồn tại nên nằm cụm riêng gọn hơn; **không thêm nút đánh và nút né lớn lên PC** vì đã có chuột và phím.
- Ngữ cảnh NPC: badge `F — Nói chuyện` gần NPC hoặc vị trí dễ nhìn, tự ẩn khi ra khỏi tầm.
- Boss: một thanh boss HP gọn ở phía trên trung tâm, không đè HUD.

**Phone landscape**
- HP/MP ngắn gọn góc trên trái.
- Quest chỉ hiển thị một mục tiêu ngắn hoặc icon mở rộng, không có khung nhiều dòng thường trực.
- Joystick ở trái dưới; attack/skill/dodge ở phải dưới; giữ khoảng trống ở giữa màn hình.
- Các nút thừa như Inventory, Map, Settings nằm trong một cụm menu nhỏ có thể mở; không rải 6–8 icon dọc cạnh màn hình.
- Boss HP và cảnh báo ưu tiên hơn các icon phụ.

**Tablet**
- Dùng biến thể trung gian: ưu tiên touch controls ở hai mép, HUD tối giản tương tự desktop, có panel có thể mở rộng.

### 5.3. Các màn hình cần nâng cấp

- **Main Menu:** New Game / Continue / Settings / Credits rõ ràng, tránh quá nhiều CTA.
- **Pause Menu:** Resume / Controls / Settings / Save / Exit (các hành động chỉ xuất hiện khi thật sự được hỗ trợ).
- **Settings → Controls:** remapping PC, tùy chỉnh mobile, reset, xem phím tắt; có preview bố cục.
- **Inventory:** tối ưu grid, trang bị/tooltip; đóng/mở nhanh và đóng gameplay input khi đang thao tác.
- **Equipment & Character:** thông tin gọn, có icon rõ; không ngập text.
- **Skill Tree:** node dễ chạm, zoom/pan riêng không xung đột joystick, mô tả skill khi chọn.
- **Quest Journal:** phân cấp quest chính/phụ, mục tiêu hiện tại, nút theo dõi.
- **NPC Dialogue / Shop / Crafting:** panel tập trung, button có states và phản hồi xác nhận.
- **Game Over / Victory:** kết quả rõ, nút tiếp tục/thử lại hợp lý.
- **Loading / Orientation Overlay:** đẹp, nhẹ, đúng branding.

Chỉ thiết kế màn hình thực sự có tính năng hoặc được roadmap phát triển; panel chưa có nghiệp vụ không được giả vờ hoạt động.

## 6. DESIGN SYSTEM — TOKENS CÓ THỂ ÁNH XẠ TỚI FIGMA VÀ CODE

Dùng các token semantic làm nguồn thống nhất; tinh chỉnh màu sau khi kiểm tra trong gameplay:

```ts
export const uiTokens = {
  colors: {
    bg: '#171E21',
    surface: '#243033',
    surfaceRaised: '#303F42',
    border: '#8E754A',
    accent: '#D8B675',
    text: '#F5EBDD',
    textMuted: '#CBD1CB',
    danger: '#E86D63',
    mana: '#64B5DD',
    success: '#8BC49B',
    disabled: '#73807D',
  },
  spacing: [4, 8, 12, 16, 20, 24],
  radius: { sm: 6, md: 10, lg: 14 },
  motionMs: { fast: 120, normal: 180, slow: 240 },
} as const;
```

- Typography có scale theo thiết bị; font hỗ trợ đầy đủ tiếng Việt, phân biệt chữ/tiêu đề/number label. Chữ cỡ nhỏ phải đọc được trên DPI mobile thực tế.
- Thiết kế reusable states: Default, Hover, Focus, Pressed, Disabled, Loading, Cooldown, Active, Selected, Locked.
- Thành phần cần dùng lại: `ActionButton`, `SkillButton`, `VirtualJoystick`, `StatusBar`, `SmallIconButton`, `Tooltip`, `Modal`, `QuestTracker`, `NPCPrompt`, `SettingsRow`, `Slider`, `KeyCapture`, `Toast`, `ItemSlot`.
- Vẽ theo đồ họa game's style nhưng icon cần nhận diện nhanh ở 24–32px và nhỏ hơn khi test.
- Không dùng quá nhiều hoa văn Đông Sơn trên UI: chỉ dùng làm motif nhẹ ở viền và panel lớn.
- Kiểm tra tương phản văn bản theo ngưỡng tham khảo **4.5:1 cho chữ thường** và **3:1 cho tín hiệu đồ họa quan trọng** khi áp dụng phù hợp; xác nhận bằng screenshot và kiểm tra thực tế.
- Các nút quan trọng không chỉ được phân biệt bằng màu (phải có hình + icon/label/feedback).

### Handoff với Figma (nếu được kết nối và có quyền)

- Kiểm tra design file/team library hiện có trước khi tạo mới; không tự tạo nhiều file trùng.
- Tạo các frame thực tế: Desktop gameplay 1920×1080, Desktop 1366×768, Tablet landscape 1024×768, Mobile landscape 844×390 và 740×360; có thể bổ sung theo kết quả testing.
- Xây dựng **design tokens, editable components và variants**, không chỉ raster screenshot dán vào Figma.
- Đối chiếu Figma thiết kế với screenshot runtime, chuyển token/component specs sang Phaser UI.
- Nếu không có Figma tool hoặc quyền chỉnh sửa, tiếp tục triển khai trực tiếp trong source, không để thiếu Figma chặn chức năng gameplay.

## 7. KIẾN TRÚC INPUT VÀ UI ĐỀ XUẤT

Chỉ tạo những module thật sự cần sau audit. Ví dụ:

```text
src/
  game/
    input/
      GameAction.ts
      InputManager.ts
      InputContext.ts
      KeyboardMouseAdapter.ts
      TouchAdapter.ts
      InputBindings.ts
      InputSettings.ts
    ui/
      design-tokens.ts
      ResponsiveLayout.ts
      SafeArea.ts
      Hud.ts
      TouchControls.ts
      components/
        ActionButton.ts
        SkillButton.ts
        NPCPrompt.ts
        KeyCapture.ts
      screens/
        ControlsSettings.ts
        PauseMenu.ts
    entities/
      Player.ts
    scenes/
      VillageScene.ts
      ForestScene.ts
```

### 7.1. Input abstraction

Dùng **semantic actions**, không cho Player trực tiếp phụ thuộc đồng thời vào `keyboard`, `mouse` và `touch` handlers rải rác.

Ví dụ event/action model (tùy điều chỉnh theo codebase):

```ts
type GameAction =
  | 'ATTACK'
  | 'DODGE'
  | 'INTERACT'
  | 'PAUSE'
  | 'INVENTORY'
  | 'QUEST_JOURNAL'
  | 'CHARACTER'
  | 'SKILL_TREE'
  | 'MAP'
  | 'QUICK_ITEM_1'
  | 'QUICK_ITEM_2'
  | 'QUICK_ITEM_3'
  | 'QUICK_ITEM_4'
  | 'SKILL_1'
  | 'SKILL_2'
  | 'SKILL_3'
  | 'SKILL_4';

type GameplayInput = {
  moveX: number;
  moveY: number;
  aimWorldX?: number;
  aimWorldY?: number;
  pressed: ReadonlySet<GameAction>;
  held: ReadonlySet<GameAction>;
  released: ReadonlySet<GameAction>;
};
```

Quy tắc:
- Chuyển keyboard/mouse/touch về action chung.
- Gửi vào Player/skill/combat system qua API thống nhất.
- Không tác động trực tiếp từ UI button vào vài hàm gameplay riêng lẻ gây sai state.
- Phân biệt **edge-triggered** (ấn 1 lần) và **continuous** (giữ).
- Normalize movement vector; xử lý diagonal.
- Debounce/repeat theo action, không phụ thuộc browser key repeat.
- Nếu phối hợp nhiều input, quyết định ưu tiên rõ ràng, không nhân đôi action.

### 7.2. Input contexts

Có context hoặc stack ưu tiên:

`Gameplay < NPC Dialogue < Inventory/Shop/Skill Tree < Settings/Key Capture < System Modal`

- Context trên cùng tiêu thụ input trước.
- UI pointer event **không** đi xuyên xuống gameplay.
- Khi mở modal: không tiếp tục chém, dùng skill, di chuyển nếu UI đang chặn; xử lý pause game thích hợp.
- ESC đóng context trên cùng, có quy tắc fallback.
- Khi scene shutdown/change: unregister listeners và clear held keys/pointers.
- Khi blur/visibilitychange/touchcancel: clear held state để tránh nhân vật chạy/đánh không dừng.

### 7.3. Responsive rendering

- Cấu hình game/world camera và UI camera độc lập hoặc UI scene riêng nếu phù hợp; tránh HUD bị zoom cùng world.
- Hạn chế absolute hardcoding position không theo viewport.
- Tính logical viewport, DPR, safe area, layout zones và scale riêng cho UI.
- Cập nhật anchor/reflow khi resize/orientation/fullscreen.
- Không dùng CSS-only visual positions mà bỏ quên hit area thực trong Phaser.
- Phân biệt world-coordinate và screen-coordinate rõ ràng.

### 7.4. Persist settings

- Lưu keybindings, handedness, scale, opacity, reduced motion, display preferences theo schema version.
- Validate khi đọc, fallback an toàn khi lưu hỏng.
- Không xóa hoặc ghi đè `GameState` tiến trình hiện hữu.
- Có **Restore Defaults** riêng cho PC keyboard và mobile layout.

## 8. MICRO-INTERACTIONS & GAME FEEL

- Các nút phản hồi ngay khi press/release, có visual depth và scale nhẹ.
- Kỹ năng hiển thị cooldown ring/progress, MP không đủ, khóa/mở, available; không có trạng thái giả.
- HUD HP/MP tween ngắn có giới hạn, không làm mất đồng bộ giá trị gameplay thật.
- Tooltip desktop hover và touch long-press/press info phù hợp; không lạm dụng tooltip che gameplay.
- Phím/tên kỹ năng hiện trên desktop để học hotkey, icon ưu tiên trên touch.
- Nút F tương tác chỉ bật khi NPC hợp lệ gần đó; trạng thái ưu tiên NPC gần nhất có thể hiểu được.
- UI đóng/mở animation ngắn, không trì hoãn việc thoát khi boss đang đánh.
- Âm thanh click/hit cảm giác phù hợp nếu audio system hiện có; xử lý audio unlock mobile.
- Không bắt game engine chạy nhiều tween hoặc particle UI vô hạn.

## 9. RESPONSIVE & VISUAL QA MATRIX

Kiểm thử tối thiểu:

| Môi trường | Viewport mục tiêu | Điểm kiểm tra |
|---|---:|---|
| Desktop 1080p | 1920×1080 | LMB attack, HUD nhẹ, modal, hover |
| Desktop laptop | 1366×768 | HUD không chồng, skillbar gọn |
| Desktop small | 1280×720 | Text/tooltip không tràn |
| Tablet landscape | 1024×768 | Multi-touch, safe zones, UI scale |
| iPhone landscape tham khảo | 844×390 | Notch/safe area, nút bấm không chồng |
| Android landscape nhỏ | 740×360 | Nút đánh đủ lớn, quest gọn |
| Mobile nhỏ | 640×360 | Combat vẫn quan sát được |
| Portrait | 390×844 | Overlay xoay màn hình, navigation đúng |
| Hybrid touch+mouse | viewport thực | Chuyển input hợp lý, không nhân đôi |

Đây là kích thước kiểm thử tham khảo, không thay thế kiểm thử kích thước thật và vùng hiển thị browser chrome.

### Những case bắt buộc

1. Giữ WASD rồi click liên tiếp LMB: di chuyển và combo đồng thời hợp lệ.
2. Đang di chuyển, nhấn **1/2**: Địa Chấn/Hỏa Trảm dùng đúng MP/CD; nhấn **3/4** khi chưa mở khóa không gây hành động giả hoặc lỗi input.
3. Chạm/nhấn nút UI rồi LMB: **không đánh xuyên UI**.
4. Nhiều ngón: joystick + Attack + Dodge/Skill, không ghost tap.
5. Giữ nút rồi chuyển tab/scene: khi quay lại không bị kẹt input.
6. Resize/fullscreen/device rotation: hit areas vẫn khớp icon.
7. Dùng chuột trái trên NPC dialogue/shop: không chém quái ở background.
8. Mở settings và remap kỹ năng **1** sang phím khác: HUD cập nhật nhãn chính xác; phát hiện xung đột với WASD, 2/3/4 và nhóm vật phẩm 5–8.
9. Chơi bằng keyboard-only: thực hiện được các thao tác nền tảng, thoát modal được.
10. Chuyển giữa desktop/touch modes: không hiển thị đồng thời hai cụm controls vô ích.
11. FPS khi đông quái + nhiều VFX + UI: ghi lại các phép đo thực tế.
12. Font tiếng Việt: kiểm tra dấu, line breaks, tooltip, scaling.
13. Khung boss và cảnh báo vẫn dễ đọc dù HUD/quest hiện.
14. Settings/save không lỗi khi reload hoặc update schema.

## 10. ĐẦU RA VÀ CÁC QUALITY GATES

**Deliverables thực tế:**

- Hệ thống InputManager/unified actions được tích hợp.
- Bộ điều khiển PC mouse/keyboard có thể remap.
- Bộ điều khiển mobile/tablet có multitouch, responsive và settings.
- UI/UX visual system có reusable components và tokens.
- HUD PC/touch được tối ưu riêng, gọn, rõ, có trạng thái skill/cooldown.
- Settings → Controls hoạt động, không chỉ màn hình giả.
- Các màn hình menu/NPC/RPG đang tồn tại được cập nhật theo design system.
- Screenshot runtime trước/sau ở các viewport và bảng issue QA.
- Tài liệu controls & settings, keymap defaults, migration và cách test.
- Build sản xuất được kiểm tra khi môi trường cho phép.

**Không đánh dấu DONE nếu:**
- LMB không tấn công thật hoặc click xuyên qua UI.
- 1/2/3/4 không kích hoạt đúng slot kỹ năng, hoặc đụng với phím vật phẩm nhanh 5–8 hay action khác.
- HUD đẹp nhưng skillbar bấm không đúng hit area.
- Phone joystick và skill không dùng cùng lúc được.
- Các controls vẫn che đáng kể combat hoặc boss telegraph.
- Chữ/tooltip tràn trên màn hình nhỏ.
- UI phụ thuộc viewport cố định.
- Mở/đóng scene tạo listener chồng hoặc input kẹt.
- Không có cơ chế settings/reset khi đã cam kết.
- Báo cáo build/test thành công nhưng thực tế chưa chạy.

**Evidence:** mỗi milestone ghi file đã sửa, test đã chạy, screenshot runtime, lỗi còn lại và những phần chưa kiểm chứng. Nếu chưa có mobile thật, không khẳng định đã test trên iPhone/Android thật.

## 11. ROADMAP TỰ TRIỂN KHAI — KHÔNG DỪNG Ở ĐỀ XUẤT

### M0 — Source audit & baseline
- Audit repository, input/UI hiện tại, take screenshots, ghi keymap và phát hiện lỗi.
- Build baseline hoặc ghi blocker rõ.

### M1 — PC Combat Controls
- LMB Attack, J fallback, WASD/arrows, kỹ năng **1/2/3/4**, vật phẩm nhanh **5/6/7/8**, Space, F, ESC.
- Input context, pointer event isolation, blur cleanup, cursor/world transform.
- Test combo và boss trên PC.

### M2 — Adaptive Input & Mobile Controls
- Unified InputManager + TouchAdapter.
- Multi-touch, cancel lifecycle, left-handed preset, device mode và safes.
- Test responsive và input conflict.

### M3 — Compact Visual Design System
- Tạo tokens, shared UI components, UI states.
- Nếu có Figma: xây editable frames/components và review.
- Chuyển design system sang Phaser UI, giữ pixel art/style Văn Lang.

### M4 — HUD Overhaul
- Desktop HUD gọn, mobile joystick/skillpad gọn, boss bar, quest collapsed.
- Cooldown, disabled/locked states, context NPC prompt.

### M5 — Settings & Menus Overhaul
- Controls rebinding + touch layout settings.
- Menu, Pause, Dialogue, inventory/skill/shop nếu có, consistency và navigation.

### M6 — QA, Performance, Release-ready
- Screenshot/regression matrix, keyboard/touch tests, save tests.
- Fix lỗi, polish, optimize, cập nhật docs, `npm run build`.

Agents có thể làm một số phần song song nếu không xung đột nhưng phải tích hợp/test theo dependency; không coi bản demo UI là hoàn tất.

## 12. CÁCH VẬN HÀNH VỚI FIGMA / GAME STUDIO NẾU CÔNG CỤ SẴN CÓ

- **Figma:** dùng cho design audit, editable responsive frames, tokens, components/variants, prototype hành vi, bàn giao specs. Không thay thế việc code vào Phaser.
- **Game Studio / Game Development Studio:** chỉ dùng các chức năng thực sự được kết nối và được cấp quyền; hỗ trợ audit, build, visual debugging và performance nếu có. Không giả mạo tool, artifact hay test.
- **Coding agent:** chịu trách nhiệm cuối cùng với source thật, browser runtime và fix regressions.
- **Quyền hạn:** không tự chi tiền, tải/gắn asset thương mại, xóa dữ liệu, chạy đo GPU/phần cứng hay phát hành công khai khi các thao tác đó yêu cầu phê duyệt riêng.
- Nếu một connector không có sẵn, tiếp tục những phần có thể thực hiện trực tiếp, ghi blocker thay vì ngừng toàn bộ dự án.

## 13. BÁO CÁO THỰC THI BẮT BUỘC

Sau mỗi nhóm thay đổi, trả về:

1. **Audit/Baseline:** phát hiện liên quan source hiện tại.
2. **Implemented:** điều khiển và UI cụ thể đã hoạt động.
3. **Files changed:** đường dẫn và mô tả.
4. **Design decisions:** lý do lựa chọn và xử lý xung đột.
5. **Tests actually run:** lệnh, viewport, thiết bị, kết quả.
6. **Screenshots/visual QA:** bằng chứng trước/sau nếu có.
7. **Build status:** PASS/FAIL/NOT RUN.
8. **Known issues:** thiếu sót, ưu tiên và ảnh hưởng.
9. **Next action:** task tiếp theo theo dependency; tiếp tục trong giới hạn môi trường làm việc.

Không cần hỏi người dùng về những lựa chọn nhỏ có thể tự giải quyết hợp lý. Chỉ hỏi khi thay đổi định hướng game, có chi phí, yêu cầu quyền mới hoặc gặp blocker thực sự.

---

# FINAL EXECUTION DIRECTIVE

**PROJECT:** THẦN MỆNH: HẬU DUỆ VĂN LANG

**MODE:** AUTONOMOUS CROSS-PLATFORM INPUT + PREMIUM COMPACT UI/UX IMPLEMENTATION

**FINAL GOAL:** PC sử dụng **chuột trái để tấn công**, WASD di chuyển, **1/2/3/4 cho bốn ô kỹ năng** phù hợp tiến độ mở khóa, **5/6/7/8 cho vật phẩm nhanh** khi có, Space né, F tương tác, hệ phím có thể chỉnh; mobile/tablet có **joystick + nút Attack/Dodge/Skills gọn, đẹp, đa chạm và điều chỉnh được**; tất cả menu/HUD rõ ràng, ít chiếm màn hình, thống nhất mỹ thuật Văn Lang và hoạt động thật trên Phaser H5.

**START NOW:** Đọc repository; kiểm tra `Player.ts`, `TouchControls.ts`, `Hud.ts`, scenes; audit layout/input; ưu tiên triển khai LMB Attack và input abstraction, sau đó adaptive controls và UI overhaul. Test từng phần, sửa regression, cập nhật docs và chỉ báo hoàn thành khi source thực sự tích hợp và được kiểm chứng. **Do not stop at planning, Figma, screenshots, or mockups.**
