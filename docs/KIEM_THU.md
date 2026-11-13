# Phương pháp kiểm thử và kết quả

Chạy toàn bộ:

```bash
npm test
```

Lệnh trên tương đương `node --test "tests/*.test.js"` và không cần cài thư viện.

Kết quả tại thời điểm bàn giao: **106/106 đạt** (Node 22, Chromium headless có sẵn trong môi trường kiểm thử).

## 1. Kim tự tháp kiểm thử

| Tầng | File | Số test | Nội dung chính |
|---|---|---|---|
| Đơn vị — thuật toán | `tests/engine.test.js` | 19 | Suy luận thuộc tính; ma trận ưu tiên (giới hạn lượt xem, "không thích" ghi đè, bỏ yêu thích, loại sự kiện lỗi/tương lai); UserKNN dùng cả đánh giá ≥ 4★; chuẩn hóa = 1; lọc hàng đã mua/hết hàng/không ảnh/không thích; giải thích trung thực và gắn nhãn demo; cold-start + quiz; ngữ cảnh sản phẩm; MMR tăng ILD; BPR tái lập được và học được (AUC > 0,8); phối đồ đúng giới tính; Style DNA; switching + phiên đang mở; chặn giới tính; trọng số khớp `tuned-weights.json`; ảnh chụp danh mục của thực nghiệm còn nguyên |
| Đơn vị — cảm xúc | `tests/sentiment.test.js` | 5 | Phủ định, nhấn mạnh, "thì… nhưng"; không dấu và âm tiết nhập nhằng; câu hỏi có/không; emoji; độ chính xác dev ≥ 90% và held-out ≥ 75% (đo được 82,5%) |
| Đơn vị — bảo mật | `tests/security.test.js` | 27 | Vector chuẩn SHA-256/HMAC/PBKDF2; băm/kiểm tra mật khẩu; chuyển đổi tài khoản chữ thường; làm sạch sản phẩm; truy vấn đơn theo email với Firebase giả; mã nguồn không còn `admin123`; nhận diện sản phẩm ngừng kinh doanh (sản phẩm admin `custom-*` không bị ảnh hưởng) |
| Dữ liệu — danh mục | `tests/catalog.test.js` | 1 | Mọi thẻ sản phẩm viết sẵn trong các trang HTML khớp `product-data.js` (tên, giá — trang Sale so giá đã giảm, thương hiệu, ảnh) |
| Đơn vị — chatbot | `tests/chatbot.test.js` | 33 | So khớp theo từ; lọc ngân sách; luồng size giày; thêm giỏ đúng size; trạng thái gửi hỗ trợ; xử lý đầy bộ nhớ; thoát HTML; **câu hỏi ngoài phạm vi** (phép tính "1 + 1 =" không bị hiểu là ngân sách, "bạn là ai", thời tiết, giờ, câu lạc đề, câu hỏi nhạy cảm không bị chuyển cho nhân viên); **câu hỏi thông tin shop** (địa chỉ cửa hàng, giờ mở cửa, hotline, thanh toán, mã giảm giá, theo dõi / hủy đơn, đánh giá, wishlist, tài khoản, cách đặt hàng, giới thiệu shop — trả lời ngay, không lấn sang tìm sản phẩm / giao hàng, không làm đứt luồng tư vấn size); **câu hỏi xếp hạng** ("áo được nhiều người mua", "bán chạy", "đánh giá cao", "đẹp") xếp theo số khách đã mua / điểm sao thật, ghi số liệu trên từng mẫu, nói rõ khi chưa đủ dữ liệu hoặc khi số liệu là dữ liệu demo |
| Tích hợp — API | `tests/server.test.js` | 13 | Chạy trên **cả SQLite và JSON**: health, file tĩnh, chặn đọc mã/dữ liệu (kể cả `%2e%2e`); đăng ký/đăng nhập/token/415; **CF đa thiết bị** (A nhận sản phẩm B đã mua và B chấm 5★, không nhận đồ của C khác gu, `strategy=social`); đánh giá chỉ khi đã mua, cảm xúc, chống chèn HTML, ẩn danh; quiz, xóa lịch sử, thống kê admin, CORS; rate limit đăng nhập; dữ liệu demo không đăng nhập được và luôn gắn nhãn |
| Tích hợp — Streamlit | `tests/streamlit-bridge.test.js` | 2 | Cầu nối Python ↔ hệ gợi ý (`streamlit_app/bridge.js`): danh mục, gợi ý cá nhân có tính tất định, quiz khách mới ưu tiên đúng giới tính, sản phẩm tương tự và phối đồ, công thức r_eff; báo lỗi rõ khi lệnh sai, sản phẩm không có, chưa có dữ liệu máy chủ |
| Đầu-cuối — trình duyệt | `tests/browser-e2e.test.js` | 6 | Chế độ tĩnh (gợi ý, phối đồ, chặn đánh giá, đánh giá hợp gu, trang chủ phản ánh lượt xem, quiz) và chế độ máy chủ (đăng ký → đăng nhập → liên kết → gợi ý từ máy chủ → đặt hàng → đánh giá có cảm xúc); khách cũ còn sản phẩm đã gỡ trong BAG/giỏ đặt lại/lịch sử chat, link cũ tới sản phẩm đó và sản phẩm admin đồng bộ muộn từ Firebase; đặt hàng từ BAG rồi bấm hoàn tất (pháo hoa) không lỗi JS; mục Admin "Hệ gợi ý (Streamlit)" báo rõ khi ứng dụng chưa chạy và chỉ nhận địa chỉ http(s); khu giày trang chủ dạng vòng cung lấy giày từ danh mục, xoay bằng phím/bánh xe, bấm size mở trang sản phẩm với size chọn sẵn. Tự bỏ qua nếu chưa cài Playwright |

Kiểm thử thủ công đã chạy thêm trên Chromium cho cả 17 trang HTML ở viewport 1280px và 390px. Kết quả: không có lỗi JS (riêng `email.html`/`emailjs-test.html` cần CDN EmailJS), không tràn ngang trên mobile.

## 2. Đánh giá chất lượng gợi ý (offline)

Lệnh `npm run evaluate` chạy quy trình sau:

- Tách dữ liệu theo **thời gian**: validation để tinh chỉnh, test để báo cáo.
- So sánh 11 thuật toán bằng P/R/NDCG@5,10, HitRate@10, MRR@10, Coverage@10, ILD@10, Novelty@10.
- Kiểm định hoán vị cặp (10.000 hoán vị) trên NDCG@10 theo từng người dùng.

Thí nghiệm phụ:

- Người dùng mới, cắt lịch sử của 30% người dùng.
- Ablation cảm xúc.
- Ablation hệ số cho sản phẩm "chỉ mới xem".
- Độ nhạy ρ (tỉ trọng tương quan ẩn giữa người dùng).
- Quy mô cộng đồng.

Kết quả và hạn chế: `docs/KET_QUA_THUC_NGHIEM.md`. Với dữ liệu thật, chạy:

```bash
npm run evaluate -- --data=server
```

## 3. Hiệu năng (đo trên môi trường kiểm thử, 150 người dùng demo, khoảng 5.200 tương tác)

| Thao tác | Thời gian |
|---|---|
| Dựng lại mô hình (gồm huấn luyện BPR 100 epoch) | 130–170 ms, chỉ khi có dữ liệu mới, tối đa 1 lần/3 giây |
| `GET /api/recommendations` khi mô hình đã có | 2–3 ms |
| Engine trong trình duyệt (vài người dùng cục bộ) | < 20 ms mỗi lần dựng |
| Toàn bộ `npm run evaluate` (3 seed × 600 người dùng + các thí nghiệm) | khoảng 50 giây |

## 4. Kiểm thử bảo mật đã thực hiện

| Mối đe dọa | Ca kiểm thử |
|---|---|
| Lộ mật khẩu | Không còn mật khẩu dạng chữ trong `localStorage`; máy chủ băm scrypt, so sánh thời gian cố định |
| Dò mật khẩu | 11 lần đăng nhập sai liên tiếp → `429` + `Retry-After` |
| Token giả | Sửa 1 ký tự token → `401` |
| XSS | Tên sản phẩm admin chứa HTML, bình luận chứa `<img onerror>`/`<b>` → hiển thị như văn bản thường hoặc bị loại |
| Truy cập trái phép | Khách hàng gọi `/api/admin/stats` → `403`; tài khoản demo không đăng nhập được |
| Duyệt thư mục / đọc mã nguồn | `/server/db.js`, `/.git/config`, `/package.json`, `/%2e%2e/...` → `404` |
| CSRF / CORS | Chỉ origin trong danh sách được cấp CORS; API chỉ nhận JSON và token Bearer (không cookie) |

## 5. Kế hoạch kiểm thử với người dùng thật (UAT, đề xuất cho báo cáo)

1. **Người tham gia:** 15–30 sinh viên, mỗi người làm quiz, duyệt 10 phút, đặt 1 đơn demo và viết 1 đánh giá.
2. **Đo khách quan** (đã có sẵn trong hệ thống): CTR từng khu gợi ý (`/api/admin/stats`), tỉ lệ thêm giỏ từ gợi ý, phân bố cảm xúc.
3. **Đo chủ quan:**
   - Bảng hỏi SUS (10 câu, thang 1–5).
   - 3 câu Likert: "gợi ý phù hợp với gu", "lời giải thích dễ hiểu", "phối đồ hợp lý".
4. **A/B test:**
   - Chia người dùng theo `id` chẵn/lẻ: nhóm A dùng Hybrid v2, nhóm B dùng Popularity.
   - So sánh CTR bằng kiểm định hai tỉ lệ (z-test).
   - Hệ thống đã ghi `rec_impression`/`rec_click` kèm ngữ cảnh.
5. **Tiêu chí chấp nhận:**
   - CTR của Hybrid cao hơn Popularity có ý nghĩa (p < 0,05).
   - Điểm SUS ≥ 68.
   - Không phát sinh lỗi JS trong phiên dùng thử.
