# Báo cáo nâng cấp hệ gợi ý — từ v1 lên v2

Nhánh: `improve-fashion-recommender`, tách từ `main` tại commit `1016e7e`. Nhánh `main` **không bị sửa**.

Tài liệu này đối chiếu từng vấn đề nêu trong bản đánh giá phản biện với cách khắc phục, kèm bằng chứng kiểm chứng (test hoặc số liệu).

## 1. Vấn đề về đúng đề tài và thuật toán

| # | Vấn đề ở v1 (vị trí) | Cách khắc phục ở v2 | Kiểm chứng |
|---|---|---|---|
| 1 | CF chỉ đọc `localStorage` của **một trình duyệt** (`stylehub-recommendations.js:103`), nên người dùng ở thiết bị khác không bao giờ trở thành "người tương tự" | Thêm backend `server/` lưu hành vi tập trung (SQLite). `stylehub-api.js` tự liên kết tài khoản khi đăng nhập, gửi sự kiện theo lô và đồng bộ lịch sử cũ một lần | `tests/server.test.js` "CF đa thiết bị". Thực nghiệm mục 7: NDCG@10 của UserKNN bằng 0 khi chỉ có 3–10 người dùng, đạt 0,257 khi có 150 người |
| 2 | Hàng xóm chỉ đóng góp **hàng đã mua**, bỏ qua đánh giá tích cực (dòng 110) | `userCFScores` dùng mọi tương tác dương của hàng xóm (mua, đánh giá ≥ 4★, yêu thích, giỏ, xem) theo trọng số. Lời giải thích nêu rõ loại bằng chứng | Test "UserKNN … đã MUA hoặc ĐÁNH GIÁ TÍCH CỰC". API `strategy=social` trả về sản phẩm người tương tự chấm 5★ |
| 3 | Chuẩn hóa sai `Math.max(1, …)` (dòng 112) | `normalizeMap` chia cho giá trị lớn nhất thật; mọi thành phần đều nằm trong [0, 1] | Test: điểm cộng tác cao nhất = 1 |
| 4 | Nhãn "Người có sở thích tương tự đã mua" xuất hiện cả khi đóng góp ≈ 0 (dòng 116) | `explain()` chọn thành phần đóng góp **lớn nhất**, kèm bằng chứng đếm được. Nút "Vì sao bạn thấy sản phẩm này?" hiển thị tỉ lệ từng thành phần. Bằng chứng chỉ từ tài khoản demo được ghi "(dữ liệu demo)" | Test "Giải thích trung thực", "Dữ liệu demo được ghi rõ" |
| 5 | Trọng số chọn tay (0,65/0,35; 1/3/5/7) | Grid search thô → mịn (bước 0,2 → 0,1 → 0,05) trên validation theo thời gian, lấy trung bình 3 seed. Kết quả ghi ở `recommender/tuned-weights.json` | NDCG@10: trọng số đặt tay 0,251, sau tinh chỉnh 0,335 (p < 0,001). Test khẳng định engine dùng đúng trọng số đã tinh chỉnh |
| 6 | Đặc trưng nội dung bằng regex: "T-Shirt" bị gắn cả `tee` lẫn `shirt`, không có IDF, tên đội bóng bị hiểu thành màu | Bảng thuộc tính có cấu trúc cho toàn bộ danh mục (`recommender/product-attributes.js`, sinh bởi `tools/`, sửa tay qua `attribute-overrides.json`) + TF-IDF có trọng số theo nhóm | Test suy luận thuộc tính; test bảng thuộc tính khớp toàn bộ danh mục |
| 7 | Trang chủ dễ lặp lại sản phẩm vừa xem; heuristic "loại vừa xem" cứng | Có thành phần session (tương tự sản phẩm vừa xem, không tự so khớp), tăng trọng số khi đang trong phiên ≤ 30 phút, hệ số 0,9 cho sản phẩm chỉ mới xem (chọn bằng ablation), popularity trừ phần của chính người dùng | Ablation mục 5 trong `KET_QUA_THUC_NGHIEM.md`. E2E: trang chủ hiện "Vì bạn vừa xem…" |
| 8 | Không có hệ thống đánh giá sản phẩm sau mua | `stylehub-reviews.js` + API `/api/products/:id/reviews`: chỉ khách **đã mua** mới đánh giá được, có điểm cảm xúc tiếng Việt, ẩn danh tên, cho xóa đánh giá của mình. Đánh giá là đầu vào của mô hình (`r_eff`) | `tests/server.test.js` (403 khi chưa mua). E2E mua → đánh giá → "Tích cực" |
| 9 | Không có đánh giá định lượng | `evaluation/`: tách theo thời gian, 11 thuật toán (gồm bản port thuật toán cũ), P/R/NDCG/HR/MRR, Coverage, ILD, Novelty, kiểm định hoán vị, cold-start, ablation, độ nhạy ρ, quy mô cộng đồng | `docs/KET_QUA_THUC_NGHIEM.md` (sinh tự động, tái lập được nhờ seed cố định) |

## 2. Vấn đề bảo mật, chất lượng mã và tài liệu

| # | Vấn đề ở v1 | Khắc phục | Kiểm chứng |
|---|---|---|---|
| 10 | Mật khẩu lưu dạng chữ trong `localStorage` (`stylehub-common.js:140-143`, `hub_userData`) | `stylehub-crypto.js`: PBKDF2-HMAC-SHA256 (60.000 vòng, salt riêng), tự chuyển đổi tài khoản cũ khi tải trang hoặc đăng nhập. Máy chủ dùng scrypt | `tests/security.test.js` (vector chuẩn FIPS/RFC 4231/RFC 7914, chuyển đổi tài khoản) |
| 11 | `ADMIN_PASSWORD = "admin123"` trong `admin.html` | Có backend: đăng nhập qua `/api/auth/login`, chỉ nhận `role = admin`, token trong `sessionStorage`. Chế độ tĩnh: so với bản băm và hiển thị rõ "chỉ để demo" | Test bảo mật kiểm tra mã nguồn không còn chuỗi `"admin123"` |
| 12 | `getOrdersByEmail` tải đơn hàng của **mọi khách** về trình duyệt | Truy vấn `orderByChild('userEmail').equalTo(email)`, `account.html` không còn gọi `getAllOrders`, thêm `firebase.database.rules.json` (`.indexOn`, kiểm tra cấu trúc dữ liệu) | Test với Firebase giả lập |
| 13 | XSS: `innerHTML` với tên sản phẩm (`product-detail.html:969`), sản phẩm admin từ Firebase | Dựng thẻ gợi ý bằng DOM/`textContent`; `product-data.js` làm sạch sản phẩm tùy biến; `admin.html` thoát tham số `onclick` (`jsArg`); máy chủ loại thẻ HTML trong bình luận | Test bảo mật; E2E: `<b>` trong bình luận bị loại bỏ |
| 14 | `README_STATIC_DEMO.txt` ghi "đã gỡ Firebase", không đúng với mã thực tế | Viết lại cho đúng hiện trạng; thêm `README.md` đầy đủ | — |
| 15 | `stylehub-ai-chat.js` và `stylehub-ai-pro.js` giống hệt nhau | Gộp còn `stylehub-ai-chat.js`, sửa tham chiếu trong `product-detail.html` | — |
| 16 | Commit `.DS_Store` | Xóa khỏi repo, thêm `.gitignore` | — |
| 17 | 8 lỗi chatbot nêu trong báo cáo cũ (khớp "hi" trong "shipping", lọc giá, size giày, giày bị gán size M, báo "shop đã nhận" khi chưa gửi được, đầy bộ nhớ, ưu tiên đồ trẻ em, XSS) | Sửa toàn bộ trong `stylehub-ai-chat.js`: so khớp theo từ, lọc ngân sách cứng, luồng size giày riêng, phân biệt trạng thái gửi/chờ/cục bộ, xử lý lỗi quota | `tests/chatbot.test.js` (26 test) |
| 17b | Chatbot trả lời sai câu hỏi ngoài phạm vi: "1 + 1 =" bị hiểu là ngân sách "từ 1 triệu" và hiện giày | Dấu "+" chỉ là "trở lên" khi không có số phía sau; thêm lớp xử lý câu hỏi ngoài phạm vi: tính phép tính an toàn (không `eval`), giới thiệu trung thực ("không phải ChatGPT"), giờ/ngày, gợi ý đồ theo thời tiết, từ chối câu hỏi lạc đề kèm danh sách việc làm được, từ chối mật khẩu/dữ liệu khách (không chuyển cho nhân viên), đáp lại câu chửi bới | 3 test mới trong `tests/chatbot.test.js` |
| 18 | Lỗi JS có sẵn ở `sale.html` và `womens.html` (`headerAccountLink` null) | Kiểm tra null trước khi dùng | Quét 17 trang bằng Chromium: không còn lỗi (trừ `email*.html` cần CDN EmailJS) |

## 3. Tính năng mới (điểm sáng tạo)

1. **Hybrid thích ứng 6 thành phần:** content-based TF-IDF, UserKNN, ItemKNN, BPR, session, xu hướng. Trọng số tự điều chỉnh theo độ tin cậy dữ liệu của từng người dùng và quy mô cộng đồng; hybrid dạng switching cho người dùng mới.
2. **Hàng "Khách hàng cùng phong cách cũng chọn":** thể hiện trực tiếp yêu cầu đề tài, chỉ dùng User-based CF, loại sản phẩm đã xem, ghi bằng chứng ("3 khách hàng cùng phong cách đã mua"), tự ẩn khi chưa có khách hàng tương tự.
3. **XAI "Vì sao bạn thấy sản phẩm này?":** tỉ lệ đóng góp từng yếu tố bằng ngôn ngữ thân thiện với khách; rê chuột vào từng dòng để thấy tên thuật toán.
4. **Quiz Style DNA** cho người dùng mới. NDCG@10 của người dùng mới tăng từ 0,203 lên 0,242 so với khi không có quiz, và gấp 4,1 lần thuật toán cũ.
5. **Hồ sơ phong cách** (persona, biểu đồ loại/màu/phong cách/giá, độ tin cậy) và nút **xóa lịch sử gợi ý** cho quyền riêng tư.
6. **Phối đồ (Complete the look):** quy tắc màu trung tính / tông-sur-tông / màu nhấn, tương thích phong cách và giá, cộng gu cá nhân.
7. **Đánh giá sau mua kèm cảm xúc AI:** xem trước cảm xúc ngay khi gõ, phân bố cảm xúc theo sản phẩm.
8. **Bảng nghiên cứu** `research-dashboard.html`: biểu đồ thực nghiệm (có tooltip, bảng số liệu, kiểm định bảng màu cho người mù màu) và số liệu vận hành (CTR theo vị trí gợi ý, phân bố cảm xúc, độ thưa ma trận).
9. **Đo CTR thật:** ghi lượt hiển thị và lượt nhấp của từng khu gợi ý, sẵn sàng cho A/B test.
10. **Cộng đồng demo minh bạch:** `npm run seed:demo` tạo tài khoản mô phỏng không đăng nhập được, luôn gắn nhãn "dữ liệu demo".
11. **Ứng dụng Streamlit (Python)** `streamlit_app/`: trình diễn gợi ý cá nhân kèm biểu đồ đóng góp từng thuật toán, quiz khách mới, sản phẩm tương tự và phối đồ, kết quả thực nghiệm, phân tích cảm xúc. Gọi chung bộ máy `recommender/engine.js` qua `bridge.js` nên kết quả khớp website và báo cáo; đọc được dữ liệu mô phỏng hoặc dữ liệu thật của backend. Ứng dụng được nhúng vào trang Admin (mục *Hệ gợi ý (Streamlit)*), website tự truyền địa chỉ của nó để bấm tên sản phẩm là mở đúng trang sản phẩm.

## 4. Tự đánh giá lại theo thang điểm phản biện

| Tiêu chí | Tối đa | v1 | v2 (ước lượng) | Ghi chú |
|---|---|---|---|---|
| Đúng đề tài, thuật toán gợi ý | 3,0 | 1,6 | 2,7 | CF đa thiết bị, dùng cả mua lẫn đánh giá tích cực, hybrid tinh chỉnh |
| Kiến trúc, backend, CSDL | 2,0 | 0,6 | 1,6 | Backend REST + SQLite có schema; trừ điểm vì đơn hàng vẫn ở Firebase |
| Thực nghiệm, số liệu | 1,5 | 0,2 | 1,2 | Đầy đủ độ đo, kiểm định; trừ điểm vì dữ liệu mô phỏng |
| Frontend, UX | 1,5 | 1,3 | 1,4 | XAI, quiz, phối đồ, đánh giá |
| Chất lượng mã, bảo mật | 1,0 | 0,4 | 0,8 | Hết mật khẩu chữ, XSS, 97 test; HTML inline cũ chưa tách |
| Tài liệu, tính trung thực | 1,0 | 0,8 | 0,9 | README, API, báo cáo sinh tự động, nêu rõ hạn chế |
| **Tổng** | **10** | **4,9** | **≈ 8,6** | Để đạt ≥ 9: thu thập dữ liệu thật và đánh giá lại; chuyển đơn hàng về backend |

## 5. Những gì chưa làm (nêu rõ khi bảo vệ)

- Chưa có dữ liệu khách hàng thật. Mọi con số thực nghiệm đến từ bộ mô phỏng có công bố giả định.
- Ảnh và tên sản phẩm vẫn lấy trực tiếp từ website thương hiệu thật (hotlink).
- Đơn hàng, tồn kho và hỗ trợ vẫn dùng Firebase. Bảo vệ quyền đọc theo người dùng cần Firebase Auth.
- Mã HTML/JS inline lớn của các trang cũ chưa được tách module (đã giữ nguyên để tránh hỏng luồng mua hàng).
- Sản phẩm admin thêm mới chưa được máy chủ gợi ý học.
