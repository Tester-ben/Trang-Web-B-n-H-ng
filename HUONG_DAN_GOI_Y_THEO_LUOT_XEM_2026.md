# Sửa gợi ý trang chủ theo lịch sử xem (bản 2026)

## Nguyên nhân lỗi cũ
`stylehub-premium-home.js` tìm mã `tee-*`, nhưng danh mục không có nhóm mã này. Nó rơi về `kids-1` (hoodie trẻ em) làm seed cố định và sinh nhiều hoodie, dù khách đang xem áo thun.

## Thay đổi
- Trang chủ gọi `StyleHubRecommendations.recommendHome(4)`, không dùng sản phẩm seed cố định.
- Đọc đúng lượt xem sản phẩm từ trang `product-detail.html?id=...` qua localStorage (trên đúng trình duyệt và địa chỉ web).
- Lượt xem gần đây được ưu tiên: ví dụ xem 2–3 áo thun, gợi ý ưu tiên áo thun cùng loại, không yêu cầu yêu thích/đánh giá.
- Cân bằng thêm tín hiệu giỏ hàng, yêu thích và đơn hàng, trừ nhẹ sản phẩm đã xem để khám phá mẫu mới.
- Khách chưa có lịch sử sẽ thấy nhiều loại trang phục, không bị toàn hoodie.
- Khi quay lại trang chủ từ lịch sử trình duyệt, gợi ý được cập nhật.
- Giữ nguyên hiệu ứng lật 3D, slide cuộn, liên kết, tim, giỏ hàng và các tệp trang khác.

## Cách thử
1. Mở cùng một URL Live Server (ví dụ `http://127.0.0.1:5500`). Không đổi qua cổng khác.
2. Vào danh mục, mở chi tiết 3 mẫu áo có từ “Tee” / “T-Shirt” trong tên, lần lượt mỗi mẫu một lần. Chỉ mở ảnh danh sách/hov​​er không được tính là xem chi tiết.
3. Quay lại trang chủ / làm mới trang; mục “Được chọn cho bạn” sẽ ưu tiên nhóm Tee.
4. Lịch sử riêng theo tài khoản đã đăng nhập hoặc khách `guest` và lưu trong trình duyệt hiện tại. Xóa localStorage / dùng ẩn danh khiến hệ thống chưa có lịch sử.

## Giới hạn
Đây là hệ gợi ý cá nhân hóa chạy tại trình duyệt (content-based + tín hiệu cộng tác nếu có), không phải mô hình AI đã được huấn luyện. Hệ thống không theo dõi việc chỉ ngắm ảnh mà chưa bấm mở trang chi tiết; 2–3 lượt xem là tín hiệu khởi đầu, đề xuất còn phụ thuộc kho sản phẩm và các hành vi cũ.
