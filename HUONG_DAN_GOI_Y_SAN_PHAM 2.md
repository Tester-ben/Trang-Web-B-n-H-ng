> **Tài liệu của phiên bản cũ (v1)** — thuật toán và cách chạy đã được thay bằng Hybrid v2. Xem `README.md` và `docs/BAO_CAO_NANG_CAP.md`.

# Bổ sung hệ gợi ý sản phẩm thời trang

## Phạm vi thay đổi

Đổi “Sản Phẩm Liên Quan” thành “Gợi Ý Dành Cho Bạn” ngay trong trang chi tiết sản phẩm. Giữ khung lưới, hình ảnh, đường dẫn, nút yêu thích, trạng thái tồn kho và CSS gốc. Thêm dòng giải thích gợi ý và lựa chọn đánh giá mức độ yêu thích sản phẩm đang xem từ 1 đến 5 sao, không phải đánh giá xác thực sau mua hàng.

Không sửa thuật toán giỏ hàng, thanh toán, đăng nhập, quản trị, Firebase, chatbot, tìm kiếm và bộ lọc. Các trang danh mục, trang chủ và tài khoản chỉ thêm tham chiếu module gợi ý để ghi nhận thay đổi giỏ hàng; không thêm khu vực giao diện mới tại các trang đó.

## Cách chạy và thử

Giải nén toàn bộ ZIP. Giữ cách chạy website trước đây. Nếu dùng VS Code: mở thư mục, dùng Live Server để mở index.html. Hoặc trong thư mục chứa index.html chạy `python -m http.server 8000`, mở http://localhost:8000. Nên dùng cùng một địa chỉ/port trong suốt quá trình thử để giữ dữ liệu trình duyệt.

1. Mở một sản phẩm và kéo xuống “Gợi Ý Dành Cho Bạn”. Khách mới nhận gợi ý theo sản phẩm đang xem.
2. Xem thêm vài sản phẩm cùng phong cách, bấm yêu thích hoặc thêm vào giỏ như bình thường. Mở lại trang chi tiết để xem danh sách gợi ý được xếp hạng lại.
3. Chọn mức độ yêu thích 1–5 sao trong khu vực gợi ý. Mức 4–5 tăng tín hiệu phù hợp; mức 1–2 giảm sở thích với các đặc trưng tương tự. Chọn “Chưa đánh giá” để bỏ đánh giá riêng này.
4. Nút trái tim trên sản phẩm gợi ý vẫn thêm/xóa khỏi danh sách yêu thích. Bấm ảnh hoặc tên vẫn vào trang chi tiết như trước.
5. Đăng nhập tài khoản khác để kiểm tra hồ sơ độc lập. Khách chưa đăng nhập sử dụng hồ sơ guest riêng.
6. Để kiểm tra gợi ý cộng tác, cần ít nhất hai tài khoản đã tương tác với cùng sản phẩm và một tài khoản có đơn hàng được lưu trong website. Hệ thống ưu tiên các sản phẩm trong đơn của tài khoản tương tự. Không tự tạo đơn mẫu hay người dùng giả. Không cần đặt đơn thật chỉ để kiểm tra.

## Mô hình để giải thích đề tài

Đây là hệ gợi ý lai (hybrid recommender), kết hợp content-based filtering và user-based collaborative filtering; không phải Random Forest và không phải mô hình đã huấn luyện bằng tập dữ liệu lớn.

Tín hiệu cá nhân:
- Xem sản phẩm: trọng số 1 mỗi lượt, có giới hạn chống lặp nhanh
- Thêm số lượng sản phẩm vào giỏ: trọng số 3 mỗi lần ghi nhận
- Yêu thích hiện tại: trọng số 5
- Sản phẩm trong đơn đã đặt, không bị hủy/hoàn: trọng số 7; đây chưa phải xác minh thanh toán thành công
- Đánh giá sở thích: (số sao − 3) × 4; đánh giá 1–2 sao ghi đè thành tín hiệu âm

Lượt xem và tín hiệu thêm giỏ giảm một nửa sau 30 ngày, hết hiệu lực sau 90 ngày. Tối đa 200 sản phẩm cho mỗi loại hành vi, giới hạn tần suất để không tăng điểm vô hạn bằng tải lại trang. Số lượng trong giỏ không được xem là số lần mua.

Nhánh nội dung dùng danh mục, thương hiệu, loại trang phục, nhóm màu, một số phong cách và khoảng giá; đặc trưng suy ra từ dữ liệu sản phẩm hiện có, không phân tích ảnh. Tính cosine similarity giữa hồ sơ sở thích và đặc trưng sản phẩm.

Nhánh cộng tác tính cosine similarity trên các sản phẩm có tín hiệu dương của hai tài khoản, giảm độ tin cậy khi chỉ có ít sản phẩm chung. Gợi ý các sản phẩm người tương tự đã đặt, chưa có tín hiệu dương của người đang xem. Không dùng hồ sơ guest làm hàng xóm và không hiển thị tên/email người khác.

Điểm xếp hạng = 0,65 × điểm nội dung + 0,35 × điểm cộng tác đã chuẩn hóa. Các trọng số là cấu hình ban đầu, chưa được tối ưu bằng dữ liệu thực nghiệm. Khi chưa có người tương tự, điểm cộng tác bằng 0 và thứ tự dựa vào nội dung. Lấy tối đa 4 sản phẩm, loại sản phẩm đang xem, hết hàng, đã đặt hoặc đã đánh giá 1–2 sao. Không điền sản phẩm không phù hợp chỉ để đủ 4 thẻ.

## Giới hạn cần trình bày đúng

Dữ liệu gợi ý nằm trong localStorage của cùng trình duyệt, cùng origin, riêng theo tài khoản. Module không gửi lịch sử xem/đánh giá lên Firebase và không thay đổi việc đồng bộ đơn hàng có sẵn. Gợi ý cộng tác chỉ sử dụng hồ sơ và đơn hàng hiện có trên trình duyệt; không phải gợi ý đa thiết bị trên toàn bộ khách hàng của sàn.

Để triển khai thật cần backend lưu sự kiện, phân quyền dữ liệu, xử lý sự đồng ý của người dùng và dịch vụ tính gợi ý. Phần đó không nằm trong bản bổ sung này nhằm giữ nguyên luồng hoạt động hiện tại.

Theo dõi giỏ hàng dùng so sánh dữ liệu sau thao tác và khi rời trang. Thay đổi xảy ra ngoài giao diện hoặc sau tác vụ bất đồng bộ kéo dài có thể chỉ được ghi nhận ở lần thao tác kế tiếp. Xóa dữ liệu trình duyệt sẽ xóa hồ sơ. Quyền lưu dữ liệu bị chặn sẽ khiến đánh giá không được lưu.

## Tệp bổ sung/chỉnh sửa

- stylehub-recommendations.js: module độc lập
- product-detail.html: thay tên, thay cách lấy danh sách gợi ý, giữ thẻ sản phẩm gốc và thêm lý do
- stylehub-common.js: lắng nghe sự kiện để gắn lại nút yêu thích và nhãn tồn kho sau khi gợi ý đổi
- index.html, account.html, collections.html, mens.html, womens.html, kids.html, shoes.html, sale.html: thêm thẻ script cho module

## Kiểm tra đã thực hiện

Đạt kiểm tra thuật toán: khách mới, xếp hạng theo sở thích, gợi ý từ đơn của tài khoản tương tự, tách tài khoản, bỏ đánh giá, loại đã mua/hết hàng/không thích, bỏ đơn hủy, tín hiệu giỏ hàng, dữ liệu JSON hỏng.

Đạt kiểm tra DOM với dữ liệu sản phẩm thực: 4 thẻ, nút trái tim và nhãn tồn kho gốc, lưu đánh giá, bấm yêu thích, theo dõi thêm giỏ. Kiểm tra cú pháp 48 script nội tuyến trong HTML và module mới đã đạt.

Chưa kiểm tra trực quan trên Chrome/mobile do môi trường không có trình duyệt chạy được. Không thực hiện giao dịch, gửi email hay ghi dữ liệu lên Firebase để thử. Luồng thanh toán/backend giữ nguyên mã gốc nhưng chưa được kiểm thử đầu-cuối trong môi trường này.
