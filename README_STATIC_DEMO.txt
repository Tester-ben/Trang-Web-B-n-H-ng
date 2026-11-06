THE STYLE HUB - GHI CHÚ CHẾ ĐỘ TĨNH (cập nhật cho v2)
=====================================================

Tài liệu chính: README.md (cách chạy, kiến trúc, thuật toán, kịch bản demo).

Website có 2 chế độ:

1. Chế độ máy chủ (khuyến nghị để demo):  npm start  -> http://localhost:3000
   - Hệ gợi ý Hybrid v2 trên dữ liệu tập trung của mọi người dùng (Collaborative Filtering đa thiết bị).
   - Đánh giá sau mua được xác minh qua đơn hàng; quản trị đăng nhập bằng tài khoản role admin
     (tạo bằng: npm run create-admin -- email@vi-du.com MatKhauManh123).

2. Chế độ tĩnh (Live Server / mở file HTML):
   - Mọi tính năng gợi ý vẫn chạy bằng recommender/engine.js trong trình duyệt, dữ liệu ở localStorage.
   - Collaborative Filtering chỉ dùng được giữa các tài khoản trên CÙNG trình duyệt.
   - Mật khẩu admin demo: admin123 (chỉ để trình diễn; mã nguồn chỉ lưu bản băm PBKDF2,
     kiểm tra phía trình duyệt KHÔNG phải bảo mật thật).

Lưu ý đính chính bản ghi chú cũ:
- Các trang VẪN nạp Firebase (stylehub-orders-api.js) để đồng bộ đơn hàng, tồn kho, sản phẩm admin
  và tin nhắn hỗ trợ khi có mạng; khi không kết nối được thì dùng localStorage.
- Đơn của khách chỉ được truy vấn theo email của chính khách (không tải đơn của người khác).
- Mật khẩu tài khoản khách không còn lưu dạng chữ (băm PBKDF2-SHA256, tự chuyển đổi tài khoản cũ).
