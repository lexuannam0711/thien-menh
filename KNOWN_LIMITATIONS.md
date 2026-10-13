# Giới hạn đã biết

- `npm run check:campaign` exit 0 trên snapshot trang bị mới `index-DAgfL7dU.js`, SHA-256 `125fab15da0089e67f2d97262488bfd8a9037625515296dab2edd81f02c5ee69`: save mới, không boost/setter, bốn chương, 32 nhiệm vụ nhận thưởng/35 receipt payout chính xác, bốn boss, ba dungeon/chín tầng/bảo vật, Ending/credits và save/reload. Độ khó đại diện và thời lượng 3–5 giờ chưa đạt bằng chứng. Chưa đạt bản 1.0.
- Softlock đổi chương sau dungeon đã sửa và đi qua đúng vùng tự nhiên. Lượt nghiệm thu mới xác nhận cả ba chìa khóa/cấp/chín tầng/thưởng, hash ổn định, HTTP asset 200 và hydrate chỉ khác đúng làm tròn giây theo thiết kế. Artifact: `artifacts/campaign-acceptance.json`, ảnh: `artifacts/campaign-ending.png`.
- Lượt nghiệm thu mới không instrumentation hoàn tất sau 788.418 giây, chứng kiến hai lần chết/hồi sinh tự nhiên. Lượt coverage riêng cùng bundle hoàn tất sau 698.005 giây, hai lần chết/hồi sinh; không dùng thời gian automation/instrumentation làm bằng chứng cân bằng, pacing hoặc hiệu năng. Receipt D71 cũ được bảo toàn trong `artifacts/campaign-snapshots/index-D71EOpKB/`.
- Chưa có bằng chứng runtime trên Android Chromium, iPhone Safari, hoặc thiết bị yếu trong workspace này.
- Chưa đo FPS, heap, và phiên chơi liên tục 30 phút.
- Coverage V8 hợp nhất campaign/UI trên DAgfL7dU: 9597/11052 dòng ánh xạ (86.83%), 674/813 hàm quan sát được ánh xạ (82.90%). Chưa xác nhận coverage toàn repo/branch >=80%: chỉ 53 file app trong sourcemap, không đếm CSS, test/self-check và `src/data/npcs.ts` không được bundle; dòng chỉ chạy một phần vẫn tính hit. Artifact: `artifacts/coverage-DAgfL7dU/combined-source-coverage.json`.
- Asset là procedural, không thay thế production art pack riêng.
- Audio là WebAudio procedural; không có bản thu âm thanh/nhạc nền ngoài.
- Ba kênh âm lượng và lưu thời gian chơi đã kiểm chứng; chưa đánh giá nghe thực tế hoặc xác nhận nhịp chơi 3–5 giờ. Quay lại dungeon cũ chỉ có bằng chứng fixture tăng cấp/sức công.
- Bundle Vite còn cảnh báo kích thước chunk lớn.
