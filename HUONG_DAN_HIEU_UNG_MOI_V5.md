# THE STYLE HUB — Hiệu ứng trang chủ V5

## Thay đổi
- Thay thanh chữ chạy ngang màu đen bằng **Style Notes** màu kem, các câu chuyển cảnh mờ/trượt nhẹ theo nhịp 4,3 giây, kèm số thứ tự và vạch tiến trình.
- Cuộn **xuống và lên đều chạy lại hiệu ứng reveal**, do hiệu ứng tính trực tiếp từ vị trí thành phần trong viewport; bỏ cờ `data-sh-slide-seen` gây chỉ chạy 1 lần.
- Trên điện thoại: bố cục mới tự thu gọn; với tùy chọn hệ thống giảm chuyển động, chữ đứng yên và các phần không bị ẩn.
- Giữ nguyên phần sản phẩm gợi ý theo lượt xem, nút yêu thích, lật outfit 3D, ảnh/video, trang con, giỏ hàng, thanh toán.

## Chạy thử
1. Mở thư mục dự án bằng VS Code. Chạy `index.html` qua Live Server.
2. Nhấn `Ctrl + Shift + R` để tránh CSS/JS cache cũ.
3. Cuộn xuống qua bộ sưu tập, khu BUSINESS CASUAL, gợi ý sản phẩm; cuộn lên ngược lại rồi xuống: các khu vực phải tiếp tục xuất hiện mượt.
4. Kiểm tra thanh Style Notes đổi lời nhắn sau vài giây, hover thẻ sản phẩm để lật, mở giỏ hàng và xem chi tiết như trước.

## Chỗ chỉnh
- `index.html`: markup Style Notes, version CSS/JS.
- `stylehub-premium-home.css`: style và responsive, scroll-reveal.
- `stylehub-premium-home.js`: hoạt ảnh đổi thông điệp và scroll-reveal 2 chiều.
