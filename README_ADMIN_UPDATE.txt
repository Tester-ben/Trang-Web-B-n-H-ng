ADMIN UPDATE - THE STYLE HUB

Đã cập nhật:
1. Thêm link ADMIN nằm cạnh ACCOUNT trên header các trang chính.
2. Link ADMIN mở tab mới: admin.html.
3. Trang admin yêu cầu mật khẩu trước khi vào quản lý.
   Mật khẩu mặc định: admin123
4. Admin có thể bấm "Xác nhận đơn hàng" để đổi trạng thái đơn từ:
   "Đang chờ xác nhận" -> "Đang giao".
5. Trang account của khách sẽ đọc trạng thái mới từ localStorage và tự cập nhật khi admin xác nhận ở tab khác.
6. Sửa lỗi cú pháp admin.html cũ và sửa dữ liệu đơn hàng để Admin không bị N/A.

Lưu ý:
- Đây là project HTML/CSS/JS chạy bằng localStorage, nên chức năng Admin/password chỉ phù hợp demo frontend.
- Nếu đưa web lên hosting thật, cần backend/database để admin bảo mật thật và trạng thái đơn đồng bộ giữa nhiều máy.
