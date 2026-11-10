# Ứng dụng Streamlit — THE STYLE HUB

Ứng dụng **Python + Streamlit** trình diễn hệ gợi ý sản phẩm thời trang của đề tài
(gợi ý dựa trên hành vi mua sắm, đánh giá và sự tương đồng sở thích giữa người dùng).

Ứng dụng **không có bản sao thuật toán thứ hai**: mọi gợi ý được tính bằng chính bộ máy của
website (`recommender/engine.js`) qua cầu nối `bridge.js`, nên kết quả khớp với website và với
báo cáo thực nghiệm (`docs/KET_QUA_THUC_NGHIEM.md`).

```
Streamlit (Python, app.py)  ──JSON──▶  node bridge.js  ──▶  recommender/engine.js  (cùng bộ máy với website)
                                                  └──▶  product-data.js, evaluation/simulate.js, server/data
```

## Các trang

| Trang | Nội dung |
|---|---|
| Tổng quan | Số liệu danh mục và dữ liệu hành vi, 7 thành phần của mô hình lai và trọng số, biểu đồ danh mục |
| Gợi ý cho khách hàng | Chọn một khách → Style DNA, danh sách gợi ý kèm lời giải thích, biểu đồ đóng góp của từng thuật toán, lịch sử hành vi, khách hàng có gu tương tự (UserKNN) |
| Khách hàng mới (Style DNA) | Bài toán cold-start: trả lời quiz (giới tính, phong cách, màu, loại, ngân sách) → gợi ý |
| Sản phẩm tương tự & phối đồ | Gợi ý trên trang sản phẩm và gợi ý phối đồ (hợp màu, hợp phong cách, cùng tầm giá) |
| Kết quả thực nghiệm | NDCG@10 các thuật toán, bảng đầy đủ độ đo, kiểm định ý nghĩa thống kê, cold-start, MMR, cảm xúc |
| Phân tích cảm xúc | Nhập bình luận tiếng Việt → điểm cảm xúc và điểm đánh giá hiệu dụng r_eff |

## Chạy trên máy

Cần **Python 3.9+**. Lệnh cài dưới đây cài luôn Node.js (gói `nodejs-wheel-binaries`), không cần cài Node riêng.

```bash
pip install -r streamlit_app/requirements.txt
```

```bash
streamlit run streamlit_app/app.py
```

Chạy lệnh từ **thư mục gốc của dự án** để nhận giao diện màu trong `.streamlit/config.toml`.
Trình duyệt tự mở `http://localhost:8501`.

## Xem trong trang Admin của website

Trang `admin.html` có mục **"Hệ gợi ý (Streamlit)"** ở thanh menu bên trái. Mục này nhúng ứng dụng ngay trong trang Admin:

- Chạy website trên máy (`npm start` hoặc Live Server): mục này tự dùng `http://localhost:8501`. Chỉ cần đang chạy `streamlit run streamlit_app/app.py`.
- Website trên Vercel: đưa ứng dụng lên Streamlit Community Cloud (mục bên dưới), rồi dán link `https://….streamlit.app` vào ô **Địa chỉ ứng dụng Streamlit** và bấm **Lưu & tải lại**. Địa chỉ được lưu trên trình duyệt đó. Muốn mọi máy đều thấy mà không cần nhập, đặt link vào hằng `STREAMLIT_DEFAULT_URL` trong `admin.html`.
- Website tự truyền địa chỉ của nó cho ứng dụng (tham số `?site=`), nên bấm tên sản phẩm trong Streamlit là mở đúng trang sản phẩm.

## Nguồn dữ liệu (thanh bên trái)

- **Mô phỏng (mặc định):** khách hàng và hành vi sinh bởi `evaluation/simulate.js` — cùng bộ mô phỏng
  dùng trong thực nghiệm. Đổi số khách hoặc seed để tạo bộ dữ liệu khác; cùng seed luôn cho cùng kết quả.
- **Máy chủ của website:** đọc hành vi thật mà backend (`npm start`) đã ghi trong `server/data/stylehub.db`.
  Chưa có khách thật thì có thể tạo dữ liệu demo bằng `npm run seed:demo`.
- **Địa chỉ website:** nhập địa chỉ website (ví dụ `http://localhost:3000` hoặc link Vercel) để bấm vào
  tên sản phẩm là mở trang sản phẩm trên web.

## Đưa lên Streamlit Community Cloud (tùy chọn)

1. Vào <https://share.streamlit.io>, đăng nhập bằng GitHub.
2. **Create app** → chọn repository này, nhánh `improve-fashion-recommender`,
   **Main file path:** `streamlit_app/app.py` → **Deploy**.
3. `streamlit_app/requirements.txt` được nhận tự động (gồm cả Node.js cho bộ máy gợi ý).

## Kiểm thử

`tests/streamlit-bridge.test.js` (chạy cùng `npm test`) kiểm tra cầu nối: danh mục, gợi ý cá nhân có tính
tất định, quiz khách mới, sản phẩm tương tự và phối đồ, phân tích cảm xúc, và các thông báo lỗi.
