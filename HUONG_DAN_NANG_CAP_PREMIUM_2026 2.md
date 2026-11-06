# THE STYLE HUB — Premium Home & Gợi ý 5 sao (30/10/2026)

## Những gì đã nâng cấp

### 1. Trang chủ (`index.html`)
- Banner thời trang kiểu editorial; chữ lớn, phủ màu gradient sang trọng và nút xem bộ sưu tập nổi bật.
- Hiệu ứng **parallax chiều sâu (3D nhẹ bằng CSS/JavaScript)** khi di chuột trên banner. Đây không phải mô hình WebGL 3D vật thể; ưu tiên chạy mượt, không tải thư viện 3D ngoài.
- Dải thông điệp chuyển động bên dưới banner; các khối MENS/WOMENS có hiệu ứng nghiêng nhẹ, zoom khi hover và thông tin lookbook trên ảnh.
- Thêm khu “Được chọn cho bạn” lấy sản phẩm từ `product-data.js` và xếp hạng qua `stylehub-recommendations.js`, có ảnh, tên, giá và liên kết chi tiết sản phẩm. Sử dụng gợi ý ban đầu khi trình duyệt chưa ghi nhận sở thích.
- Thêm hiệu ứng xuất hiện khi cuộn trang, làm mới tiêu đề BUSINESS CASUAL, SHOES, dải giày chạy tự động.
- Giao diện tự co giãn trên màn hình nhỏ. Thiết bị cảm ứng không bật hiệu ứng nghiêng theo chuột.
- Tôn trọng tùy chọn giảm chuyển động (Reduce Motion) của hệ điều hành.

### 2. Gợi ý trong trang chi tiết sản phẩm (`product-detail.html`)
- Tiêu đề và phần mô tả dễ nhìn hơn, nền màu kem, hiệu ứng đổ bóng tinh tế.
- Bỏ cách hiển thị ô đánh giá quá đơn giản: thay bằng **cụm 5 ngôi sao bấm được**.
- Vẫn giữ ô chọn danh sách làm cách đánh giá thứ hai, thêm nút **Xóa đánh giá**.
- Điểm 1–5 sao và thao tác xóa vẫn dùng chính hàm `track(id, 'rating', ...)` hiện có. Không thay đổi thuật toán xếp hạng của hệ gợi ý.
- Hiển thị thông báo lưu, phục hồi mức sao của tài khoản khi quay lại; thiết kế lại thẻ sản phẩm liên quan.
- Cần hiểu đây là **đánh giá sở thích**, không phải đánh giá mua hàng đã được xác thực.

## Chức năng được giữ nguyên

Các trang danh mục MENS, WOMENS, KIDS, SALE, SHOES, tài khoản, quản trị, giỏ hàng, thanh toán, thông báo, tìm kiếm, chatbot, bộ dữ liệu `product-data.js` và các dịch vụ Firebase / EmailJS **không bị sửa mã nguồn** trong đợt nâng cấp này. Nút và đường dẫn chuyển trang cũ vẫn sử dụng URL của dự án. Chỉ chỉnh 3 tệp gốc `index.html`, `product-detail.html`, `stylehub-recommendations.js` và thêm 3 tệp giao diện.

## Các tệp được bổ sung
- `stylehub-premium-home.css`: toàn bộ giao diện trang chủ mới.
- `stylehub-premium-home.js`: hiệu ứng chuyển động và các thẻ sản phẩm gợi ý ở trang chủ.
- `stylehub-premium-recommendations.css`: giao diện mới của phần gợi ý chi tiết.

## Cách chạy trên VS Code
1. Giải nén toàn bộ ZIP, mở thư mục `Trang-Web-B-n-H-ng-main` trong VS Code.
2. Chuột phải vào `index.html`, chọn **Open with Live Server**. Hoặc mở Terminal trong thư mục, chạy `python -m http.server 8000` rồi mở `http://localhost:8000/index.html`.
3. Mở trang chủ, rê chuột lên ảnh banner / bộ sưu tập để thấy hiệu ứng 3D nhẹ; cuộn xuống để xem dải sản phẩm gợi ý.
4. Vào một chi tiết sản phẩm, cuộn tới “Gợi ý dành riêng cho bạn”, chọn từ 1–5 sao, tải lại trang để kiểm tra lưu sở thích, thử nút Xóa đánh giá.
5. Dùng F12 > Device Toolbar để xem giao diện điện thoại. Nếu trình duyệt đang lưu CSS/JS cũ, nhấn **Ctrl + Shift + R** để tải lại.

## Kiểm tra và giới hạn
- Đã kiểm tra cú pháp script mới và script nhúng trên 2 trang đã chỉnh.
- Đã kiểm tra DOM trong Chromium với màn hình 1440px và 390px, 4 sản phẩm được render từ danh mục hiện có, 5 nút sao hoạt động, lưu localStorage và xóa đánh giá, không tràn ngang; menu điện thoại vẫn đóng/mở được.
- Môi trường kiểm tra chặn điều hướng mạng và tải hình ảnh từ bên thứ ba; ảnh/video nguyên bản vẫn dùng các URL gốc. **Chưa thử hết các luồng mua hàng, thanh toán hoặc Firebase/EmailJS trên website thật**. Nên kiểm tra lại những luồng này trong trình duyệt của bạn.
- Dữ liệu sở thích vẫn nằm trong localStorage theo logic gốc. Để ghi nhớ qua các thiết bị cần backend, hiện chưa có trong phiên bản này.
