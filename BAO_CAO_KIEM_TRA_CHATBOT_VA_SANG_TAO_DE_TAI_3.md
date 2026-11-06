# THE STYLE HUB — Kết quả kiểm tra chatbot và đề xuất sáng tạo cho đề tài 3

**Phạm vi:** Bản web THE_STYLE_HUB_THANH_HIEU_UNG_MOI_SCROLL_2_CHIEU, sau khi xóa hoàn toàn dải Style Journal/Style Notes ở trang chủ. Báo cáo dựa trên kiểm tra mã nguồn và bài thử logic JavaScript độc lập trong Node.js. **Chưa xác minh** dịch vụ Firebase thực tế, gửi/nhận tin từ admin và các thao tác trực quan ở trình duyệt (môi trường thử chặn việc mở trang). Không thực hiện đơn hàng thật.

## Đã thực hiện trong ZIP này

- `index.html`: xóa toàn bộ `<section class="sh-style-notes">` và nội dung phía trong. Giữ nguyên banner, danh mục, các nút điều hướng, gợi ý theo lượt xem, hiệu ứng lật outfit và cuộn 2 chiều.
- `stylehub-premium-home.css`: loại bỏ các khai báo riêng của Style Notes trên desktop, tablet và mobile.
- `stylehub-premium-home.js`: loại bỏ hoàn toàn bộ đếm, timer chuyển câu và các listener của Style Notes; giữ nguyên xử lý cuộn và flip.
- Không sửa `stylehub-ai-chat.js`, hệ thống gợi ý, dữ liệu sản phẩm, tài khoản, giỏ hàng, tồn kho hay thanh toán. Đây là đợt **kiểm tra** chatbot, chưa phải đợt **nâng cấp** chatbot.

## 1) Kiểm tra chatbot — Kết quả thực tế

### Những gì đã có trong code

- Widget nổi, mở/đóng, kéo thả và lưu vị trí; lịch sử lưu tối đa 100 tin nhắn (`stylehub-ai-chat.js`).
- Tư vấn theo câu hỏi/từ khóa (`inferIntent`, `inferCategory`, `buildReply`), liệt kê sản phẩm từ `product-data.js`, nút thêm vào giỏ (`addToCart`).
- Tư vấn size theo bảng trọng lượng/chiều cao được khai báo sẵn, size giày theo bảng cố định.
- Chuyển một số yêu cầu hỗ trợ sang Firebase Realtime Database, nếu không kết nối được thì ghi vào localStorage.
- **Chưa tìm thấy lệnh gọi mô hình ngôn ngữ/LLM** trong file chatbot đang được trang chủ nạp. Tên “Stylist AI” hiện mô tả trợ lý theo quy tắc, không phải chatbot AI sinh câu trả lời tự nhiên.

### Lỗi/hạn chế có bằng chứng từ bài thử logic

| Mức độ | Kịch bản | Thực tế quan sát được | Khuyến nghị |
|---|---|---|---|
| Cao | “Cho tôi xem áo thun nữ dưới 200.000đ” | Gợi ý các sản phẩm có giá khoảng 2.150.000–3.250.000đ | Phân tích hạn mức giá; lọc cứng trước khi xếp hạng; nếu không có hàng, thông báo không có kết quả thay vì gợi ý sai |
| Cao | “Tư vấn size giày nam” → “42” | Sau câu đầu, chatbot đòi chiều cao/cân nặng thay vì tiếp tục size giày | Tách state tư vấn giày khỏi quần áo; xử lý câu trả lời ngắn theo ngữ cảnh |
| Cao | “size 42” | Code chấp nhận số 42, nhưng hàm `shoeNumberSize` ép về tối đa 36 cho bảng giày nam đang dùng | Đối chiếu bảng size sản phẩm đang bán, dùng đúng hệ đơn vị; không tự ép cỡ không tồn tại thành cỡ khác |
| Cao | Từ chat nhấn thêm giày vào giỏ | `addToCart` gán mặc định `size: "M"` cho sản phẩm mới | Mở lựa chọn size/biến thể trước khi thêm; từ chối size chưa được chọn |
| Vừa | “Phí shipping như nào?” | Trả lại lời chào vì `t.includes("hi")` khớp trong chữ `shipping` | Dùng nhận diện từ độc lập và nhóm câu hỏi giao hàng/chính sách |
| Cao | Firebase không kết nối | Tin hỗ trợ lưu cục bộ nhưng UI có thể nói “Shop đã nhận được tin nhắn” | Phân biệt trạng thái `sent`, `pending`, `local-only`; không xác nhận shop đã nhận nếu chưa lưu trên máy chủ |
| Vừa | Xem áo hoodie chung chung | Gợi ý đầu tiên có thể là hoodie trẻ em | Hỏi/đọc ngữ cảnh nhóm tuổi, giới tính; bổ sung điều kiện chọn đúng phân khúc |
| Vừa | Lịch sử chat/ảnh dài | `localStorage` có quota và dễ bị đầy; `saveMessages` không catch lỗi quota | Giới hạn dung lượng, xử lý lỗi lưu, thông báo cho người dùng |

**Giới hạn kết luận:** Bảng trên dựa trên hàm trong mã nguồn, không đánh giá khả năng giao tiếp với Firebase thật hoặc tin nhắn admin trên mạng.

## 2) Vấn đề chính đối với đề tài 3 — Gợi ý từ người có sở thích tương tự

Trong `stylehub-recommendations.js`:

- Content-based: tạo thuộc tính từ tên/nhóm hàng/thương hiệu/màu sắc/giá; dùng cosine similarity giữa hồ sơ sở thích và sản phẩm.
- Collaborative: lọc các khóa `stylehub_preferences_v1_*` trong **localStorage cùng trình duyệt**, tính độ giống của hai tài khoản rồi tham khảo sản phẩm đã đặt của người kia.
- Điểm kết hợp tại trang chi tiết: `0.65 * content + 0.35 * social`.
- Trang chủ đã có thêm ưu tiên các loại sản phẩm mà khách vừa xem.

**Hạn chế quan trọng:** Chưa có bộ dữ liệu hành vi tập trung của nhiều người dùng. Khách A dùng điện thoại và khách B dùng máy khác không tự trở thành “người dùng tương tự” với nhau. Khi demo chỉ 1 tài khoản / 1 trình duyệt, nhánh collaborative có thể luôn bằng 0.

**Nên ưu tiên hơn mọi hiệu ứng trang trí:** thu thập lịch sử hành vi từ nhiều tài khoản có sự đồng ý của người dùng, lưu trên backend có phân quyền; tính tương đồng trên dữ liệu thật hoặc dữ liệu mẫu được công bố rõ ràng cho mục đích thử nghiệm; đánh giá chất lượng gợi ý trên tập dữ liệu tách riêng. Không sử dụng người mua giả mà lại giới thiệu là khách thật.

## 3) Đề xuất tính năng sáng tạo theo mức độ ưu tiên

| Ưu tiên | Tính năng | Giá trị khi bảo vệ đồ án | Điểm cần làm thật |
|---|---|---|---|
| P0 | **Gợi ý theo người dùng tương tự trên dữ liệu tập trung** | Đúng trực tiếp yêu cầu đề tài; demo 2 tài khoản khác trình duyệt | Event schema `view/favorite/cart/purchase/rating`, backend phân quyền, tính similarity + Top-K |
| P0 | **So sánh thuật toán & số liệu** | Chứng minh thuật toán hữu ích thay vì “chỉ có giao diện” | Baseline phổ biến, content-based, collaborative, hybrid; Precision@K, Recall@K, HitRate@K, Coverage; trường hợp cold-start |
| P1 | **“Vì sao gợi ý cho tôi?”** | Hiển thị rõ khả năng giải thích AI (XAI) | Nhãn nguồn tín hiệu, ví dụ “Bạn vừa xem 3 áo thun”, “Phù hợp màu đen”; lý do phải đúng dữ liệu |
| P1 | **Chatbot Stylist hiểu câu hỏi + kho hàng thật** | Demo ấn tượng: “tìm áo thun đen nam dưới 1 triệu, size L, còn hàng” | Trích xuất ràng buộc, lọc theo catalog & tồn kho; fallback rõ khi không có hàng; LLM là tùy chọn, cần backend bảo vệ key |
| P1 | **Bảng “Hồ sơ phong cách của tôi”** | Người dùng thấy sở thích hình thành từ hành vi | Top 3 nhóm sản phẩm/màu/mức giá, sửa sở thích và xóa lịch sử; đồng ý lưu dữ liệu |
| P2 | **Phòng phối đồ thông minh** | Sáng tạo và dễ trình diễn | Chọn áo + quần + giày từ hàng thật, quy tắc màu/phong cách/giá/tồn kho; không cần dựng 3D người ảo |
| P2 | **Quiz 30 giây khi khách mới vào** | Giải quyết cold-start khi chưa có lượt xem | 3–5 lựa chọn ngắn, cập nhật hồ sơ, so sánh gợi ý trước/sau quiz |
| P2 | **Tìm sản phẩm bằng ảnh** | Có tiềm năng ấn tượng nếu làm đúng | Embedding thị giác + cosine, chỉ truy hồi sản phẩm có trong catalog, ghi rõ giới hạn; không giả nhận dạng ảnh khi chỉ dùng từ khóa |
| P2 | **Bảng dashboard nghiên cứu** | Tăng chất lượng phần kết quả và demo | Xu hướng hành vi, lượt click vào gợi ý, mua hàng từ gợi ý, so sánh phiên bản A/B trên dữ liệu hợp lệ |

### Combo nên thực hiện nếu thời gian hạn chế

1. **Gợi ý 2 tài khoản khác nhau thật sự + giải thích vì sao được đề xuất** (trọng tâm yêu cầu đề tài).
2. **Chatbot lọc đúng giá/size/tồn kho và liên kết với hồ sơ gợi ý**, sửa lỗi logic đã liệt kê.
3. **Dashboard so sánh 3–4 thuật toán bằng số liệu** và một luồng demo cold-start → xem vài áo thun → gợi ý thay đổi.

Giữ các animation hiện tại như điểm cộng UI/UX, nhưng đừng xem chúng là bằng chứng thuật toán gợi ý tốt.

## 4) Checklist kiểm thử sau khi nâng cấp chatbot

- [ ] Áo thun nam dưới 500.000đ: không có sản phẩm phù hợp thì báo rõ “Chưa có sản phẩm đáp ứng”.
- [ ] Tư vấn giày: “giày nam” → “size 42” → “vừa chân” phải duy trì đúng ngữ cảnh và bảng size.
- [ ] Nút thêm vào giỏ giày yêu cầu chọn cỡ giày hợp lệ, không dùng size M.
- [ ] Hỏi chính sách ship/đổi trả: trả đúng chính sách, không chuyển thành lời chào.
- [ ] Gửi hỗ trợ khi mất mạng: không báo shop đã nhận nếu chỉ lưu cục bộ.
- [ ] Dùng tài khoản A và B trên hai trình duyệt: dữ liệu hành vi phân quyền, gợi ý cộng tác có thể tái hiện từ backend.
- [ ] Xóa lịch sử/hồ sơ sở thích: thay đổi thực sự được lưu và áp dụng lại.
- [ ] Kiểm tra chống XSS/HTML injection trong tin nhắn, kiểm soát file/ảnh gửi, giới hạn số request.

## 5) Cách chạy bản này

Giải nén ZIP → mở thư mục `Trang-Web-B-n-H-ng-main` trong VS Code → mở `index.html` bằng Live Server → Ctrl + Shift + R. Phần Style Journal không còn xuất hiện. Các hiệu ứng cuộn 2 chiều và lật outfit được giữ nguyên.
