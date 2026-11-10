# THE STYLE HUB — Hệ gợi ý sản phẩm thời trang trực tuyến

**Đề tài:** Hệ gợi ý sản phẩm thời trang dựa trên hành vi mua sắm, đánh giá và sự tương đồng sở thích giữa người dùng.

Bản **v2** (nhánh `improve-fashion-recommender`) nâng cấp từ một website tĩnh có bộ gợi ý chạy trong trình duyệt thành một **hệ gợi ý lai (Hybrid)** đầy đủ:

- **Backend** gom hành vi của mọi người dùng về một nơi, nhờ đó Collaborative Filtering hoạt động thật trên nhiều thiết bị.
- **Năm thuật toán thành phần** được tinh chỉnh bằng thực nghiệm có số liệu.
- **Đánh giá sau mua** kèm phân tích cảm xúc tiếng Việt.
- **Giải thích gợi ý (XAI)**, **quiz Style DNA** cho người dùng mới và **gợi ý phối đồ**.
- **Ứng dụng Streamlit (Python)** trình diễn hệ gợi ý, dùng chung bộ máy với website: [`streamlit_app/`](streamlit_app/README.md), xem ngay trong trang Admin (mục *Hệ gợi ý (Streamlit)*).
- **96 bài kiểm thử tự động**.

| Kết quả chính (thực nghiệm offline, dữ liệu **mô phỏng**, 3 seed) | Thuật toán cũ (v1) | **Hybrid v2** |
|---|---|---|
| NDCG@10 | 0,098 | **0,335** (+243%, p < 0,001) |
| Recall@10 | 16,7% | **51,2%** |
| HitRate@10 (≥ 1 gợi ý đúng trong 10) | 23,6% | **64,4%** |
| Độ đa dạng ILD@10 | 0,443 | **0,743** (0,796 khi bật MMR) |
| Người dùng mới — NDCG@10 | 0,059 | **0,242** (switching + quiz) |
| Độ chính xác phân tích cảm xúc (tập held-out) | — | **82,5%** |

> Dữ liệu thực nghiệm là **mô phỏng**, sinh từ danh mục 197 sản phẩm thật theo mô hình có công bố (`evaluation/simulate.js`). Danh mục dùng cho thực nghiệm được chụp cố định trong `evaluation/catalog-snapshot.json`, nên website thêm/xóa sản phẩm sau đó vẫn tái lập đúng số liệu đã báo cáo. Kết quả chứng minh cài đặt đúng và cho phép so sánh tương đối. Khi có khách hàng thật, chạy lại bằng `npm run evaluate -- --data=server`. Chi tiết, kiểm định thống kê và hạn chế: [`docs/KET_QUA_THUC_NGHIEM.md`](docs/KET_QUA_THUC_NGHIEM.md).

---

## 1. Kiến trúc

```
┌──────────────────────── Trình duyệt ─────────────────────────┐
│ index / product-detail / account / danh mục (HTML + JS cũ)    │
│  ├─ stylehub-recommendations.js  ← API cũ giữ nguyên          │
│  ├─ stylehub-api.js        (liên kết tài khoản, hàng đợi sự   │
│  │                          kiện, đồng bộ lịch sử cục bộ)      │
│  ├─ stylehub-reviews.js    (đánh giá sau mua + cảm xúc AI)     │
│  ├─ stylehub-style-dna.js  (quiz cold-start, hồ sơ phong cách) │
│  └─ recommender/engine.js  (CÙNG thuật toán với máy chủ —      │
│                             dùng khi không có backend)         │
└───────────────▲───────────────────────────┬──────────────────┘
                │ JSON /api/*  (Bearer token)│ sự kiện: view, cart, wishlist,
                │                            │ rating, order, review, impression/click
┌───────────────┴──────── Node.js server/ (không thư viện ngoài) ┐
│ app.js  REST API · auth scrypt + token HMAC · rate limit · CORS │
│ recommender-service.js → recommender/engine.js (Hybrid v2)      │
│ db.js   SQLite (node:sqlite) | JSON dự phòng — schema.sql       │
└─────────────────────────────────────────────────────────────────┘
evaluation/  thực nghiệm offline (mô phỏng, độ đo, grid search, kiểm định)
streamlit_app/  ứng dụng Streamlit (Python) → bridge.js → recommender/engine.js (cùng bộ máy với website)
tests/       96 kiểm thử: engine, cảm xúc, bảo mật, danh mục, chatbot, API, cầu nối Streamlit, E2E
```

**Hai chế độ chạy:**

| | Chế độ máy chủ (khuyến nghị để demo) | Chế độ tĩnh (Live Server, GitHub Pages) |
|---|---|---|
| Lệnh | `npm start` → mở http://localhost:3000 | mở `index.html` bằng Live Server |
| Dữ liệu gợi ý | Tập trung, mọi người dùng, mọi thiết bị | `localStorage` của một trình duyệt |
| Collaborative Filtering | Đầy đủ (UserKNN, ItemKNN, BPR) | Chỉ giữa các tài khoản trên cùng trình duyệt |
| Đánh giá sau mua | Máy chủ xác minh qua đơn hàng | Xác minh qua lịch sử đơn trên trình duyệt |

Website tự phát hiện backend qua `GET /api/health`. Nếu không có backend, mọi tính năng vẫn chạy bằng engine trong trình duyệt và không báo lỗi.

## 2. Cài đặt và chạy

Yêu cầu: **Node.js ≥ 22.13** (dùng module có sẵn `node:sqlite`; Node cũ hơn tự chuyển sang lưu JSON). **Không cần `npm install`**, dự án không có dependency.

```bash
npm start
```

Mở http://localhost:3000. Dữ liệu được lưu trong `server/data/` (đã nằm trong `.gitignore`).

Tạo tài khoản quản trị (để xem trang `admin.html` ở chế độ máy chủ và trang `research-dashboard.html`):

```bash
npm run create-admin -- admin@vi-du.com MatKhauManh123
```

Tạo cộng đồng **demo** để trình diễn Collaborative Filtering khi chưa có khách thật. Tài khoản demo **không đăng nhập được** và mọi lời giải thích dựa trên chúng đều ghi "(dữ liệu demo)":

```bash
npm run seed:demo -- --users=150
```

Xóa toàn bộ dữ liệu demo:

```bash
npm run seed:demo -- --reset --users=0
```

Các lệnh khác:

```bash
npm test
```

```bash
npm run evaluate
```

```bash
npm run attributes
```

- `npm test`: 96 kiểm thử. Bộ E2E tự bỏ qua nếu máy chưa có Playwright.
- `npm run evaluate`: thực nghiệm offline (khoảng 1 phút). Lệnh này sinh lại `docs/KET_QUA_THUC_NGHIEM.md` và `recommender/tuned-weights.json`.
- `npm run attributes`: sinh lại bảng thuộc tính sản phẩm sau khi sửa `tools/attribute-overrides.json`.

Biến môi trường: `PORT`, `HOST`, `STYLEHUB_DATA_DIR`, `STYLEHUB_ADMIN_EMAIL`/`STYLEHUB_ADMIN_PASSWORD`, `STYLEHUB_CORS_ORIGINS`, `STYLEHUB_STORE=json`, `STYLEHUB_TRUST_PROXY=1` (xem đầu `server/server.js`).

### Ứng dụng Streamlit (Python)

Ứng dụng trình diễn hệ gợi ý bằng **Streamlit** nằm trong [`streamlit_app/`](streamlit_app/README.md): gợi ý cho từng khách hàng kèm lời giải thích, quiz khách mới, sản phẩm tương tự và phối đồ, kết quả thực nghiệm, phân tích cảm xúc. Cần Python 3.9+ (lệnh cài kèm sẵn Node.js qua pip). Chạy từ thư mục gốc:

```bash
pip install -r streamlit_app/requirements.txt
```

```bash
streamlit run streamlit_app/app.py
```

Trình duyệt mở http://localhost:8501. Ứng dụng cũng hiện ngay trong **trang Admin → mục "Hệ gợi ý (Streamlit)"**: trên máy tự dùng `http://localhost:8501`; khi đã đưa lên Streamlit Community Cloud thì dán link `https://….streamlit.app` vào ô địa chỉ của mục này (hoặc đặt sẵn ở hằng `STREAMLIT_DEFAULT_URL` trong `admin.html`).

Chế độ tĩnh: mở `index.html` bằng Live Server như trước. Mật khẩu admin demo chỉ dùng cho chế độ này: `admin123`, được lưu dạng băm PBKDF2 và không phải bảo mật thật.

## 3. Kịch bản demo khi bảo vệ (khoảng 8 phút)

1. `npm run seed:demo -- --users=150`, rồi `npm start`, mở http://localhost:3000.
2. **Cold-start:** ở trang chủ, khối **"Khám phá phong cách của bạn"** mở quiz Style DNA (5 câu hỏi). Chọn Nữ / Tối giản / Đen / Áo thun, rồi xem "Được chọn cho bạn" đổi ngay theo gu.
3. **Đăng ký và đăng nhập** bằng form có sẵn. Tài khoản tự liên kết với máy chủ (trang Tài khoản → tab *Style Profile* hiện "Hồ sơ phong cách của bạn được đồng bộ trên mọi thiết bị").
4. Xem 3–4 hoodie thể thao. Ở trang chi tiết, mục "Gợi ý dành riêng cho bạn" có lý do cho từng thẻ, và nút **"Vì sao bạn thấy sản phẩm này?"** hiện tỉ lệ đóng góp của từng yếu tố (XAI; rê chuột để xem tên thuật toán). Bên dưới có **"Hoàn thiện set đồ"** (quần + giày, theo quy tắc phối màu).
5. Về trang chủ, hàng **"Khách hàng cùng phong cách cũng chọn"** chỉ dùng User-based CF và ghi bằng chứng cụ thể, ví dụ "3 khách hàng cùng phong cách đã mua (dữ liệu demo)". Hàng này tự ẩn khi chưa tìm được khách hàng tương tự. Đây là phần đáp ứng trực tiếp yêu cầu đề tài.
6. Mở trình duyệt khác hoặc cửa sổ ẩn danh (mô phỏng **thiết bị thứ hai**), đăng nhập cùng tài khoản: gợi ý giống nhau vì dữ liệu nằm trên máy chủ.
7. **Mua hàng rồi đánh giá:** đặt một sản phẩm, quay lại trang sản phẩm, ô đánh giá mở ra. Khi gõ "Áo đẹp, vải mềm", hệ thống phân tích cảm xúc là "Tích cực". Đánh giá có huy hiệu "Đã mua hàng".
8. Đăng nhập admin, vào **Nghiên cứu gợi ý** (`research-dashboard.html`): biểu đồ so sánh thuật toán, cold-start, độ nhạy ρ, cùng số liệu sống (CTR khu gợi ý, phân bố cảm xúc, độ thưa ma trận).
9. **Ứng dụng Streamlit:** `streamlit run streamlit_app/app.py`, rồi mở trang Admin → mục **Hệ gợi ý (Streamlit)** (hoặc http://localhost:8501) → trang *Gợi ý cho khách hàng* (gợi ý + biểu đồ đóng góp từng thuật toán), *Khách hàng mới*, *Kết quả thực nghiệm*.

## 4. Thuật toán (`recommender/engine.js`)

**4.1. Ma trận ưu tiên người dùng × sản phẩm**

Mỗi hành vi được quy thành điểm:

- Xem: 1/lượt, tối đa 5. Thêm giỏ: 3, tối đa 3. Hai loại này giảm một nửa sau 30 ngày và hết hiệu lực sau 90 ngày.
- Yêu thích: 5. Mua: 7. Hai loại này có chu kỳ bán rã 180 ngày.
- Đánh giá sao: (r_eff − 3) × 4. Nếu **r_eff ≤ 2,5** thì ghi đè thành "không thích", sản phẩm bị loại khỏi gợi ý.
- Điểm đánh giá hiệu dụng kết hợp **cảm xúc bình luận**: `r_eff = 0,7·sao + 0,3·(3 + 2·s)`, với s ∈ [−1, 1].

**4.2. Content-based (TF-IDF)**

Mỗi sản phẩm được mô tả bằng thuộc tính **có cấu trúc** (`recommender/product-attributes.js`): loại, nhóm, giới tính, màu, phong cách, chất liệu, form, thương hiệu, khoảng giá. Trọng số đặc trưng = trọng số nhóm × IDF.

Hồ sơ người dùng = Σ điểm ưu tiên × vector sản phẩm, cộng vector quiz. Điểm của sản phẩm = cosine giữa hồ sơ và vector của nó.

**4.3. User-based CF (k-NN)**

Độ tương đồng giữa hai người: `sim(u,v) = cos(log(1+r_u), log(1+r_v)) · min(chung, 4)/4`. Lấy 25 hàng xóm gần nhất. Điểm dự đoán = Σ sim · (r_vi / max r_v) / Σ sim.

Thuật toán dùng **mọi tương tác dương của hàng xóm**: mua, đánh giá ≥ 4★, yêu thích, giỏ, xem. Bản cũ chỉ dùng hàng đã mua và chỉ thấy tài khoản trên cùng trình duyệt.

**4.4. Item-based CF**

Độ tương đồng giữa hai sản phẩm: `sim(i,j) = cos(i,j) · n_ij/(n_ij + 3)`, giữ 30 láng giềng gần nhất. Lời giải thích dạng "thường được chọn cùng X".

**4.5. BPR Matrix Factorization** (Rendle 2009)

16 nhân tố ẩn, 100 epoch, seed cố định. AUC trên dữ liệu kiểm thử > 0,8.

**4.6. Popularity cộng đồng**

Xu hướng có suy giảm theo thời gian, **trừ phần đóng góp của chính người dùng**.

**4.7. Hybrid thích ứng**

`score = Σ_k w_k · ŝ_k`, trong đó ŝ_k là điểm thành phần k đã chuẩn hóa về [0, 1]. Trọng số được điều chỉnh như sau:

- Trọng số CF nhân với độ tin cậy `n/(n+3)` (theo số tương tác của người dùng) và `U/(U+30)` (theo quy mô cộng đồng).
- **Switching:** người dùng ≤ 2 tương tác dùng bộ trọng số cold-start riêng.
- Trọng số được **grid search** trên tập validation (`recommender/tuned-weights.json`).

Quy tắc nghiệp vụ:

- **Chặn giới tính mềm** (×0,35) khi biết chắc giới tính của người dùng.
- Đang trong phiên (≤ 30 phút): trọng số "vừa xem" tối thiểu 0,3.
- Sản phẩm chỉ mới xem: ×0,9. Hệ số này được chọn vì thực nghiệm cho thấy không làm giảm NDCG.

**4.8. Đa dạng hóa và giải thích**

- **MMR (λ = 0,8):** ILD tăng 0,753 → 0,807, NDCG giảm 1,1% trên validation.
- **Giải thích (XAI):** lời giải thích lấy từ thành phần đóng góp nhiều nhất cùng bằng chứng thật (số người đã mua hoặc đánh giá, sản phẩm neo, thuộc tính trùng). Bằng chứng chỉ đến từ tài khoản demo thì được ghi "(dữ liệu demo)".

**4.9. Phối đồ** (`outfit`)

Áo → quần + giày, có xét tương thích giới tính. Điểm = 0,35·hài hòa màu (trung tính / tông-sur-tông / màu nhấn) + 0,25·phong cách + 0,15·giá + 0,25·gu cá nhân.

**4.10. Phân tích cảm xúc tiếng Việt** (`recommender/sentiment-vi.js`)

Dựa trên từ điển, có xử lý phủ định, từ nhấn mạnh, "nhưng", câu hỏi có/không, gõ không dấu và emoji. Đạt 98,8% trên tập dev và **82,5% trên tập held-out** không dùng để chỉnh luật.

## 5. Đánh giá và kiểm thử

- **Thực nghiệm offline:**
  - Tách tập theo thời gian (không rò rỉ dữ liệu tương lai).
  - 11 thuật toán, gồm cả bản port trung thành thuật toán cũ.
  - Độ đo: P/R/NDCG/HR/MRR@K, Coverage, ILD, Novelty.
  - Kiểm định hoán vị cặp với 10.000 hoán vị.
  - Các thí nghiệm phụ: cold-start, ablation cảm xúc, độ nhạy ρ, số lượng người dùng.
  - Kết quả: [`docs/KET_QUA_THUC_NGHIEM.md`](docs/KET_QUA_THUC_NGHIEM.md).
- **Kiểm thử tự động (`npm test`, 96 test):** engine (18), cảm xúc (5), bảo mật (27), danh mục (1), chatbot (26), API trên cả SQLite lẫn JSON (12), cầu nối Streamlit (2), E2E trên Chromium (5). Phương pháp và checklist UAT: [`docs/KIEM_THU.md`](docs/KIEM_THU.md).
- **Danh sách lỗi đã sửa và tính năng mới, có đối chiếu file:** [`docs/BAO_CAO_NANG_CAP.md`](docs/BAO_CAO_NANG_CAP.md). **API:** [`docs/API.md`](docs/API.md).

## 6. Bảo mật

- Mật khẩu: băm **scrypt** trên máy chủ và **PBKDF2-SHA256** trong trình duyệt, tự chuyển đổi tài khoản cũ. Không còn lưu mật khẩu dạng chữ.
- Quản trị: xác thực qua máy chủ, chỉ chấp nhận `role = admin`. Hằng số `admin123` đã bị xóa khỏi mã nguồn.
- Truy vấn đơn hàng giới hạn theo email (`orderByChild`), kèm `firebase.database.rules.json`.
- Chống XSS:
  - Thẻ gợi ý dựng bằng DOM/`textContent`.
  - Sản phẩm do admin nhập được làm sạch.
  - Bình luận bị lọc thẻ HTML.
- Máy chủ có rate limit (đăng nhập, sự kiện, đánh giá), CORS allowlist, header bảo mật, chặn truy cập mã nguồn/dữ liệu qua web, token HMAC hết hạn sau 7 ngày.
- Quyền riêng tư:
  - Tên người đánh giá được ẩn bớt (N\*\*\*h).
  - Nút "Xóa lịch sử gợi ý" xóa hành vi và quiz (giữ đơn hàng).
  - Tài khoản demo được tách bạch với khách thật.

## 7. Cấu trúc thư mục (phần mới)

```
recommender/   engine.js · sentiment-vi.js · product-attributes.js (sinh tự động) · tuned-weights.json · load-catalog.js
server/        server.js · app.js · db.js · schema.sql · auth.js · rate-limit.js · recommender-service.js · seed-demo.js · create-admin.js
evaluation/    simulate.js · legacy-v1.js · metrics.js · run-evaluation.js · results/latest.json
streamlit_app/ app.py (Streamlit) · engine_bridge.py · bridge.js · requirements.txt · README.md (+ .streamlit/config.toml ở thư mục gốc)
tests/         engine · sentiment · security · catalog · chatbot · server · streamlit-bridge · browser-e2e (+ fixtures/)
tools/         generate-product-attributes.js · attribute-overrides.json
docs/          KET_QUA_THUC_NGHIEM.md · BAO_CAO_NANG_CAP.md · KIEM_THU.md · API.md
stylehub-api.js · stylehub-reviews.js · stylehub-style-dna.js · stylehub-recommender-ui.css · research-dashboard.html · stylehub-crypto.js
```

## 8. Hạn chế và hướng phát triển

- Kết quả thực nghiệm hiện dựa trên **dữ liệu mô phỏng**. Cần thu thập dữ liệu thật (có sự đồng ý của khách), rồi tinh chỉnh lại trọng số bằng `npm run evaluate -- --data=server` và chạy A/B test với CTR đã được ghi nhận sẵn.
- Ảnh và tên sản phẩm lấy trực tiếp từ website thương hiệu thật (hotlink). Khi công bố công khai cần thay bằng ảnh có bản quyền.
- Đơn hàng, tồn kho và tin nhắn hỗ trợ vẫn nằm trên Firebase Realtime Database. Muốn bảo vệ quyền đọc theo từng người dùng cần dùng Firebase Auth hoặc chuyển hẳn sang backend này.
- Sản phẩm admin thêm mới (lưu trên Firebase) chưa được máy chủ gợi ý học, vì danh mục phía máy chủ lấy từ `product-data.js`.
- Phân tích cảm xúc dựa trên từ điển. Có thể thay bằng PhoBERT khi có tập bình luận gán nhãn đủ lớn.
