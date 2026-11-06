# THE STYLE HUB — Trang chủ Flip Outfit + Smooth Slide

## Cải tiến (chỉ `index.html`)

- Khu **Được chọn cho bạn** tự tạo thẻ sản phẩm từ `database` và đề xuất hiện có, không tạo sản phẩm ảo.
- **Máy tính:** rê chuột lên sản phẩm sẽ lật 3D sang ảnh thứ hai của chính sản phẩm (`images[1]` như cách dùng `.img-hover` trong `collections.html`). Rời chuột sẽ lật lại.
- **Điện thoại/máy tính bảng:** chạm nút `↻ XEM MẶT SAU` và `↶ MẶT TRƯỚC` để đổi hướng. Chạm tên/ảnh vẫn mở đúng trang sản phẩm.
- Nếu sản phẩm không có ảnh thứ hai, hệ thống không hiển thị lật. Nếu ảnh phụ không tải được, tự vô hiệu hóa lật để tránh mặt sau trống.
- **Cuộn slide theo tiến độ:** các khu danh mục, lookbook, sản phẩm gợi ý, shoes... xuất hiện dần theo vị trí cuộn, với dịch chuyển dọc và lệch nhẹ hai bên. Không ép cuộn 1 màn hình/1 section làm hỏng thao tác mua hàng.
- Tôn trọng cài đặt giảm chuyển động (`prefers-reduced-motion`).
- Giữ nguyên bản đã **xóa chữ trên banner**, parallax/tilt, giỏ hàng, yêu thích, tài khoản, admin, thanh toán, điều hướng.

## Chạy

Giải nén ZIP, mở thư mục trong VS Code, nhấp chuột phải `index.html` > Open with Live Server. Nhấn `Ctrl + Shift + R` để loại bỏ CSS/JS cache cũ.

**Lưu ý:** Ảnh sản phẩm lấy từ website ngoài nên cần Internet. Đây là hiệu ứng lật giữa hai ảnh thật có sẵn chứ không phải dựng một bộ trang phục 3D từ một ảnh 2D.
