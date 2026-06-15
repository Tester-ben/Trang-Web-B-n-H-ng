THE STYLE HUB - ADMIN ACCEPT / DELETE UPDATE

Đã cập nhật admin.html và stylehub-orders-api.js:

1. Admin có nút Chấp nhận đơn hàng.
   - Khi bấm, status đơn đổi thành: Đang giao.
   - Bên account.html của khách sẽ thấy trạng thái Đang giao nếu cùng kết nối Firebase.

2. Admin có nút Xóa đơn.
   - Khi bấm, đơn bị xóa khỏi Firebase Realtime Database.
   - Sau khi xóa, admin không còn thấy đơn đó.

3. File stylehub-orders-api.js đã được gắn Firebase config của project TheStyleHub.

Cách test:
- Khách đặt đơn mới từ máy/trình duyệt khác.
- Admin mở admin.html, nhập mật khẩu admin123.
- Bấm Chấp nhận đơn hàng.
- Khách mở account.html hoặc reload trang account để thấy trạng thái Đang giao.
