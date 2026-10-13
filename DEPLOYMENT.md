# Triển khai HTML5

1. Cài Node.js phiên bản hỗ trợ npm lockfile của dự án.
2. Chạy `npm install`.
3. Chạy `npm run check:all`.
4. Chạy `npm run build`.
5. Phục vụ thư mục `dist/` bằng HTTPS hoặc static host.

Không cần backend. Save dùng `localStorage`. Audio cần user gesture trên trình duyệt mobile.

## Rollback

1. Trước khi triển khai, giữ nguyên một bản đóng gói `dist/` đã nghiệm thu, version, SHA-256 của bundle và báo cáo QA tương ứng. Không thay thế bản này bằng build đang phát triển.
2. Khi cần khôi phục, triển khai lại toàn bộ bản đóng gói trước đó bằng thao tác thay phiên bản nguyên tử của static host; không trộn HTML và asset từ hai build. Phát hành công khai vẫn cần chủ dự án phê duyệt.
3. Giữ nguyên hostname, HTTPS và khóa `than-menh-van-lang-mvp-v1`. Không xóa `localStorage` để khắc phục lỗi ứng dụng. Chỉ rollback tới build đọc được save schema hiện tại; bản lưu khác phiên bản phải được bảo toàn.
4. Kiểm tra tải asset, Menu, tiếp tục hành trình, đổi vùng và save/reload trên bản vừa khôi phục. Ghi version, hash, kết quả và lỗi còn lại vào báo cáo QA.
