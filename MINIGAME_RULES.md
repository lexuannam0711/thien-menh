# HỆ THỐNG LUẬT CHƠI & PHẦN THƯỞNG NPC MINIGAMES
## DỰ ÁN: THẦN MỆNH — HẬU DUỆ VĂN LANG (PHIÊN BẢN 1.0.0)

> **Mục tiêu:** Cung cấp tài liệu quy chuẩn toàn diện về luật chơi, cơ cấu tính điểm, phân tích xác suất toán học và chính sách phần thưởng phi tiền tệ cho 3 NPC Lễ Hội tại Làng Lạc Thủy: **Thầy Thẻ Lạc (7321)**, **Lão Đồng Xúc (Xúc Xắc May Mắn)**, và **Nàng Họa Linh (Nhìn Hình Đoán Thú)**.

---

## 1. NGUYÊN TẮC CỐT LÕI & CHÍNH SÁCH PHI TIỀN TỆ

Tất cả các trò chơi dân gian lễ hội trong *Thần Mệnh: Hậu Duệ Văn Lang* được xây dựng với mục đích giải trí văn minh, kết nối cộng đồng và tái hiện không khí lễ hội thời các Vua Hùng:

1. **Tuyệt đối không cá cược tiền thật:** Không có bất kỳ cơ chế nạp tiền, rút tiền, đổi voucher hay quy đổi thành tiền mặt hoặc tài sản ngoài đời thực.
2. **Không mua bán lượt chơi:** Mỗi người chơi nhận được lượt chơi miễn phí định kỳ mỗi ngày. Game không bán lượt, không ép mua lượt và không liên kết với các loại tiền tệ nạp tiền (Premium Currency).
3. **Phần thưởng phi tiền mặt (FestivalPoints):** Điểm lễ hội chỉ có giá trị vinh danh, tích lũy huy hiệu hội làng và đổi các vật phẩm lưu niệm cosmetic không thể giao dịch trên thị trường.
4. **Không giao dịch giữa người chơi (No P2P Trading):** Điểm thưởng và lượt chơi được gắn chặt với tài khoản định danh Supabase Auth của chính chủ, không thể chuyển nhượng hoặc trao đổi qua lại.
5. **Không cơ chế gây nghiện hoặc suýt trúng lừa đảo (Anti-Near-Miss):** Xác suất được tính toán khách quan bằng bộ sinh số ngẫu nhiên mật mã (CSPRNG), công khai minh bạch tỷ lệ trúng thưởng lý thuyết.

---

## 2. LUẬT CHƠI CHI TIẾT 3 TRÒ CHƠI DÂN GIAN

```
                                  HỘI LÀNG LẠC THỦY
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  THẦY THẺ LẠC                     LÃO ĐỒNG XÚC                    NÀNG HỌA LINH
   Trò: "7321"              Trò: "Xúc Xắc May Mắn"            Trò: "Nhìn Hình Đoán Thú"
   (Thẻ Bài 52 Lá)                (3 Viên Xúc Xắc 3d6)               (6 Linh Vật Bách Việt)
```

---

### 2.1. TRÒ CHƠI 1: “7321” (THẦY THẺ LẠC QUẢN LÝ)

*“Thử vận may với những lá thẻ Văn Lang chứ? Hãy nhớ: tham thêm một lá có thể mất cả lượt!”*

#### A. Khái Niệm & Bộ Bài
- Sử dụng **1 bộ bài Tây tiêu chuẩn 52 lá**, không sử dụng thẻ bài Joker.
- Bộ bài được xáo trộn ngẫu nhiên trên máy chủ bằng thuật toán **Fisher-Yates Shuffle** kết hợp nguồn ngẫu nhiên an toàn mật mã (`node:crypto.randomInt`).
- Tên gọi **7321** phản ánh quy tắc kết hợp số cổ truyền với mục tiêu điểm số tối cao là **21 điểm**.

#### B. Cách Tính Điểm Từng Lá Bài
- **Lá Át (Ace - A):** Tính linh hoạt **1 điểm hoặc 11 điểm** tùy theo hướng có lợi nhất cho người chơi mà không làm tổng điểm vượt quá 21 (Soft Hand / Hard Hand).
  - *Ví dụ 1:* A + 9 = 20 điểm (Soft 20).
  - *Ví dụ 2:* A + 9 + 5 = 15 điểm (Át tự động lùi về 1 điểm: 1 + 9 + 5 = 15).
  - *Ví dụ 3:* A + A = 12 điểm (11 + 1 = 12).
- **Lá Hình (10, J, Q, K):** Đồng giá trị **10 điểm**.
- **Lá Số (2 đến 9):** Điểm số bằng đúng giá trị in trên mặt lá bài.

#### C. Quy Trình Ván Bài
1. **Phát bài khởi đầu (Initial Deal):**
   - Người chơi được chia **2 lá bài ngửa** (`playerHand`).
   - Nhà cái (Dealer - Thầy Thẻ Lạc) được chia **2 lá bài**: 1 lá bài ngửa (`d1`) và 1 lá bài úp bí mật (`hidden: true` - `d2`). Người chơi hoàn toàn không thể biết trước lá bài úp của nhà cái.
2. **Xử lý 21 Tự Nhiên (Natural 21):**
   - Nếu 2 lá bài đầu tiên của người chơi gồm 1 lá Át và 1 lá 10 điểm (A + 10/J/Q/K), người chơi đạt **Natural 21**.
   - Nếu nhà cái cũng có Natural 21: Ván đấu kết thúc với kết quả **Hòa Tự Nhiên (Tie)**.
   - Nếu chỉ người chơi có Natural 21: Người chơi **Thắng Ngay Lập Tức (Thần Mệnh Thắng)** mà không cần bốc thêm bài.
3. **Lượt của Người Chơi (Player Turn):**
   - Người chơi có 2 lựa chọn thao tác:
     - **Rút Thẻ (`HIT`):** Rút thêm 1 lá bài từ cọc bài chung.
     - **Dừng Thẻ (`STAND`):** Giữ nguyên số điểm hiện có và chuyển lượt cho nhà cái.
   - **Quắc Bài (Bust):** Nếu sau khi rút bài, tổng điểm của người chơi vượt quá 21 điểm, người chơi bị **Quắc bài** và xử Thua ngay lập tức. Nhà cái thắng mà không cần lật lá bài úp hay rút bài.
4. **Lượt của Nhà Cái (Dealer Turn):**
   - Khi người chơi chọn **Dừng Thẻ** (và chưa quắc bài), nhà cái chính thức lật lá bài úp thứ hai.
   - **Quy tắc Soft 17:** Nhà cái bắt buộc phải tự động rút thêm bài nếu tổng điểm dưới 17 (`dealerScore.total < 17`). Nhà cái bắt buộc phải **Dừng Rút** ngay khi tổng điểm đạt từ 17 trở lên (`dealerScore.total >= 17`).
   - Nếu nhà cái rút bài vượt quá 21 điểm: Nhà cái bị **Quắc (Dealer Bust)** và người chơi giành chiến thắng.
5. **So Sánh Điểm Chung Cuộc:**
   - Khi cả hai bên đều không bị quắc bài, điểm số hai bên được đối chiếu:
     - Điểm Người Chơi > Điểm Nhà Cái: **Người Chơi Thắng**.
     - Điểm Người Chơi < Điểm Nhà Cái: **Nhà Cái Thắng (Người Chơi Thua)**.
     - Điểm Người Chơi = Điểm Nhà Cái: **Hòa (Push / Tie)**.

---

### 2.2. TRÒ CHƠI 2: “XÚC XẮC MAY MẮN” (LÃO ĐỒNG XÚC QUẢN LÝ)

*“Ba viên xúc xắc, một lần dự đoán. Chọn theo cách của ngươi!”*

#### A. Khái Niệm & Dụng Cụ
- Sử dụng **3 viên xúc xắc đồng** 6 mặt cân đối (ký hiệu $d_1, d_2, d_3$).
- Mỗi viên xúc xắc có các chấm từ 1 đến 6. Máy chủ tạo số ngẫu nhiên độc lập cho từng viên xúc xắc bằng CSPRNG.
- Tổng điểm của 3 viên xúc xắc dao động từ **3 đến 18 điểm**.

#### B. Luật Đoán & Phân Định Cửa
Người chơi đưa ra một dự đoán duy nhất trước khi lắc bát:
1. **Cửa XỈU:** Tổng điểm 3 viên xúc xắc từ **4 đến 10 điểm**, **loại trừ Bộ Ba Đồng Số**.
2. **Cửa TÀI:** Tổng điểm 3 viên xúc xắc từ **11 đến 17 điểm**, **loại trừ Bộ Ba Đồng Số**.
3. **BỘ BA ĐỒNG SỐ (Trường Hợp Hòa Đặc Biệt):**
   - Cả 3 viên xúc xắc cùng xuất hiện một mặt giống nhau: `1-1-1` (tổng 3), `2-2-2` (tổng 6), `3-3-3` (tổng 9), `4-4-4` (tổng 12), `5-5-5` (tổng 15), hoặc `6-6-6` (tổng 18).
   - **Quy định công bằng:** Bộ Ba Đồng Số **không thuộc cửa Tài và không thuộc cửa Xỉu**. Khi xảy ra kết quả này, phiên chơi được tính là **Hòa Đặc Biệt (Special Triple)**. Toàn bộ người chơi dự đoán Tài hay Xỉu đều nhận điểm tham gia an ủi và không bị tính là thua trắng.

#### C. Không Gian Xác Suất Toán Học (216 Tổ Hợp Độc Lập)
Với 3 con xúc xắc 6 mặt, tổng số tổ hợp khả dĩ là $6 \times 6 \times 6 = 216$ biến cố:

| Nhóm Kết Quả | Danh Sách Tổ Hợp / Phân Bố Tổng Điểm | Số Tổ Hợp | Tỷ Lệ Lý Thuyết (%) |
|---|---|:---:|:---:|
| **XỈU** | Tổng 4 (3), 5 (6), 6 (9 trừ 2-2-2=8), 7 (15), 8 (21), 9 (24 trừ 3-3-3=23), 10 (27) | **105** | **48.6111%** |
| **TÀI** | Tổng 11 (27), 12 (24 trừ 4-4-4=23), 13 (21), 14 (15), 15 (9 trừ 5-5-5=8), 16 (6), 17 (3) | **105** | **48.6111%** |
| **BỘ BA ĐỒNG SỐ** | `1-1-1`, `2-2-2`, `3-3-3`, `4-4-4`, `5-5-5`, `6-6-6` | **6** | **2.7778%** |
| **TỔNG CỘNG** | **Toàn bộ không gian mẫu 3d6** | **216** | **100.0000%** |

---

### 2.3. TRÒ CHƠI 3: “NHÌN HÌNH ĐOÁN THÚ” (NÀNG HỌA LINH QUẢN LÝ)

*“Hãy chọn hình mà ngươi tin sẽ xuất hiện. Ba viên linh hình sẽ trả lời!”*

#### A. Khái Niệm & Biểu Tượng Văn Lang
Trò chơi tái hiện nét đẹp tranh dân gian Đông Hồ và văn hóa Bách Việt, chuẩn hóa cơ chế dự đoán biểu tượng linh thú:
1. **Bầu:** Trái bầu hồ lô đựng linh dược, biểu trưng cho sự trường thọ, tích tụ sinh khí trời đất.
2. **Cua:** Cua đồng sông Hồng với đôi càng vững chãi, biểu trưng cho sự kiên cường, dẻo dai.
3. **Cá:** Cá chép sông Thao vượt thác, biểu trưng cho ý chí vươn lên và tài lộc dồi dào.
4. **Cọp:** Mãnh hổ vùng Bạch Hạc oai linh, biểu trưng cho sức mạnh chiến binh và uy phong chấn giữ làng.
5. **Gà:** Gà trống chín cựa thần thoại dâng lễ vật, biểu trưng cho sự dũng cảm và tinh thần khởi sắc.
6. **Nai:** Tuần lộc hiền hòa trên đỉnh Ba Vì, biểu trưng cho sự bình an, hòa thuận và nhân ái.

#### B. Quy Trình Dự Đoán 1 Biểu Tượng
1. Người chơi chọn **đúng 1 linh vật** trong 6 linh vật đại diện.
2. Nhấn nút **Mở Linh Hình**.
3. Máy chủ gieo ngẫu nhiên **3 viên xúc xắc linh hình độc lập**. Mỗi viên có 6 mặt linh vật với xác suất xuất hiện đồng đều $1/6$ (~16.67%).
4. Đếm số lần linh vật đã chọn xuất hiện trong 3 viên xúc xắc:
   - **Trúng 0 lần (Không trúng):** Nhận điểm tham gia lễ hội an ủi.
   - **Trúng 1 lần:** Nhận điểm thưởng bậc 1.
   - **Trúng 2 lần:** Nhận điểm thưởng bậc 2 (Xuất sắc).
   - **Trúng 3 lần:** Nhận điểm thưởng bậc 3 (Tuyệt phẩm Thần Mệnh).

#### C. Phân Tích Xác Suất Nhị Thức (Binomial Distribution)
Gọi $X$ là số lần xuất hiện của linh vật đã chọn trong 3 viên xúc xắc ($n = 3, p = 1/6, q = 5/6$):

$$\mathbb{P}(X = k) = \binom{3}{k} \left(\frac{1}{6}\right)^k \left(\frac{5}{6}\right)^{3-k}$$

| Số Lần Trúng ($k$) | Công Thức Toán Học | Số Tổ Hợp (/216) | Tỷ Lệ Lý Thuyết (%) |
|:---:|---|:---:|:---:|
| **0 Lần** | $\binom{3}{0} \times (1/6)^0 \times (5/6)^3 = 125/216$ | **125** | **57.8704%** |
| **1 Lần** | $\binom{3}{1} \times (1/6)^1 \times (5/6)^2 = 75/216$ | **75** | **34.7222%** |
| **2 Lần** | $\binom{3}{2} \times (1/6)^2 \times (5/6)^1 = 15/216$ | **15** | **6.9444%** |
| **3 Lần** | $\binom{3}{3} \times (1/6)^3 \times (5/6)^0 = 1/216$ | **1** | **0.4630%** |
| **TỔNG CỘNG** | **Toàn bộ 216 khả năng gieo 3 linh hình** | **216** | **100.0000%** |

> **Xác suất trúng ít nhất một lần ($X \ge 1$):**
> $$\mathbb{P}(X \ge 1) = 1 - \mathbb{P}(X = 0) = 1 - \left(\frac{5}{6}\right)^3 = 1 - \frac{125}{216} = \frac{91}{216} \approx \mathbf{42.1296\%} \quad (\approx \mathbf{42.13\%})$$

---

## 3. CƠ CẤU PHẦN THƯỞNG PHI TIỀN TỆ (FESTIVAL POINTS)

### 3.1. Bảng Điểm Thưởng Chi Tiết

Mỗi lượt tham gia hợp lệ được bảo đảm tối thiểu **5 Điểm Tham Gia (Participation Points)**. Khi đạt kết quả tốt, người chơi nhận thêm **Điểm Thưởng (Bonus Points)**:

| Trò Chơi | Kết Quả Đạt Được | Điểm Tham Gia | Điểm Thưởng | Tổng Điểm Nhận Được | Tỷ Lệ Xuất Hiện |
|---|---|:---:|:---:|:---:|:---:|
| **7321** | **Thắng Ván Bài** (Điểm cao hơn hoặc Dealer Bust) | 5 | +10 | **15 FestivalPoints** | ~42.4% |
| | **Hòa Ván Bài** (Bằng điểm nhau) | 5 | 0 | **5 FestivalPoints** | ~8.5% |
| | **Thua / Quắc Bài** (Điểm thấp hơn hoặc Bust) | 5 | 0 | **5 FestivalPoints** | ~49.1% |
| **Xúc Xắc May Mắn** | **Đoán Đúng Tài hoặc Xỉu** | 5 | +5 | **10 FestivalPoints** | 48.61% |
| | **Đoán Sai Cửa** | 5 | 0 | **5 FestivalPoints** | 48.61% |
| | **Bộ Ba Đồng Số** (Hòa đặc biệt) | 5 | 0 | **5 FestivalPoints** | 2.78% |
| **Nhìn Hình Đoán Thú** | **Trúng 1 Linh Vật** | 5 | +3 | **8 FestivalPoints** | 34.72% |
| | **Trúng 2 Linh Vật** | 5 | +15 | **20 FestivalPoints** | 6.94% |
| | **Trúng 3 Linh Vật** (Đại Cát) | 5 | +40 | **45 FestivalPoints** | 0.46% |
| | **Không Trúng Linh Vật Nào** | 5 | 0 | **5 FestivalPoints** | 57.87% |

### 3.2. Phân Tích Kỳ Vọng Toán Học (Expected Value - EV Per Attempt)

Hệ thống điểm thưởng được cân bằng cẩn trọng để bảo đảm giá trị kỳ vọng nhận thưởng giữa 3 trò chơi không có sự chênh lệch đột biến, tránh tình trạng người chơi tập trung dồn lượt vào một trò duy nhất:

1. **Trò 7321:**
   $$\mathbb{E}[\text{Points}_{7321}] \approx (0.424 \times 15) + (0.085 \times 5) + (0.491 \times 5) = 6.36 + 0.425 + 2.455 = \mathbf{9.24 \text{ điểm/lượt}}$$
2. **Trò Xúc Xắc May Mắn:**
   $$\mathbb{E}[\text{Points}_{\text{Dice}}] = (0.486111 \times 10) + (0.486111 \times 5) + (0.027778 \times 5) = 4.8611 + 2.4306 + 0.1389 = \mathbf{7.43 \text{ điểm/lượt}}$$
3. **Trò Nhìn Hình Đoán Thú:**
   $$\mathbb{E}[\text{Points}_{\text{Animal}}] = \frac{125 \times 5 + 75 \times 8 + 15 \times 20 + 1 \times 45}{216} = \frac{625 + 600 + 300 + 45}{216} = \frac{1570}{216} \approx \mathbf{7.27 \text{ điểm/lượt}}$$

> **Kết luận cân bằng:** Mức chênh lệch kỳ vọng giữa 3 trò nằm trong biên độ hẹp ($\approx 7.3 - 9.2$ điểm), đảm bảo tính công bằng và khuyến khích người chơi trải nghiệm trọn vẹn cả 3 NPC Lễ Hội.

---

## 4. CƠ CHẾ GIỚI HẠN & LÀM MỚI THEO GIỜ VIỆT NAM

1. **Hạn Mức Hằng Ngày:**
   - Mỗi tài khoản người chơi nhận được **3 lượt chơi miễn phí mỗi ngày** cho từng trò chơi.
   - Tổng cộng mỗi ngày người chơi có tối đa **9 lượt trải nghiệm minigame** trong Làng Lạc Thủy.
2. **Thời Điểm Làm Mới (Daily Reset):**
   - Lượt chơi tự động được làm mới về mức 3 lượt vào đúng **00:00:00 mỗi ngày theo giờ Việt Nam** (Múi giờ chuẩn: `Asia/Ho_Chi_Minh`, tương đương UTC+7).
3. **Nguyên Tắc Máy Chủ Định Đoạt (Server Authoritative Time):**
   - Thời gian làm mới và ngày cục bộ (`local_date`) được tính toán trực tiếp từ đồng hồ máy chủ.
   - Việc người chơi thay đổi ngày giờ máy tính, đổi múi giờ thiết bị cá nhân hoặc can thiệp bộ nhớ đệm trình duyệt hoàn toàn **không có tác dụng** tăng lượt hay qua mặt hệ thống.
