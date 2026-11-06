# Kết quả thực nghiệm hệ gợi ý — THE STYLE HUB

> Tự động sinh bởi `npm run evaluate` lúc 2026-11-06T05:00:20.187Z. Không sửa tay — chạy lại lệnh để cập nhật.

**Nguồn dữ liệu: MÔ PHỎNG** (600 người dùng × 197 sản phẩm thật, 120 ngày, 3 seed, ρ = 0.5). Dữ liệu được sinh bởi `evaluation/simulate.js` theo mô hình độ hữu dụng có cả phần thuộc tính (content) và phần "gu cụm" ẩn (collaborative). Kết quả chứng minh cài đặt đúng và so sánh tương đối giữa thuật toán **dưới giả định của bộ mô phỏng**; cần đánh giá lại trên dữ liệu thật bằng `npm run evaluate -- --data=server`.

## 1. Giao thức

- Tách theo thời gian: validation (train < ngày 90, đánh giá [90,105)), test (train < ngày 105, đánh giá [105,120)). Không dùng dữ liệu tương lai.
- Mục tiêu (ground truth): sản phẩm được **mua** hoặc **đánh giá ≥ 4 sao** trong cửa sổ đánh giá, bỏ các sản phẩm người dùng đã mua trước đó.
- Mỗi thuật toán trả về đủ K = 10 sản phẩm (chỗ trống lấp bằng độ phổ biến). Độ đo: Precision/Recall/NDCG@K, HitRate@10, MRR@10, Coverage@10, ILD@10 (đa dạng), Novelty@10 (độ mới).
- Trọng số hybrid được tinh chỉnh bằng grid search (bước 0.2 → 0.1 → 0.05) tối đa NDCG@10 trên **validation**, sau đó mới chạy trên **test**.

## 2. So sánh thuật toán (tập test, trung bình ± độ lệch chuẩn giữa các seed)

| Thuật toán | P@5 (%) | R@5 (%) | NDCG@5 | P@10 (%) | R@10 (%) | NDCG@10 | HR@10 (%) | MRR@10 | Coverage@10 (%) | ILD@10 | Novelty@10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ngẫu nhiên | 0.65 | 1.95 | 0.013 | 0.88 | 5.30 | **0.025** ± 0.007 | 8.78 | 0.022 | 100.00 | 0.816 | 4.57 |
| Phổ biến (Popularity) | 6.82 | 23.33 | 0.162 | 5.71 | 38.64 | **0.216** ± 0.059 | 50.77 | 0.191 | 15.74 | 0.792 | 2.85 |
| Thuật toán cũ (v1) | 3.20 | 11.40 | 0.078 | 2.51 | 16.74 | **0.098** ± 0.005 | 23.64 | 0.092 | 83.42 | 0.443 | 4.36 |
| Content-based (TF-IDF) | 4.66 | 16.62 | 0.121 | 4.15 | 27.83 | **0.161** ± 0.012 | 36.55 | 0.149 | 87.14 | 0.383 | 4.34 |
| Xem gần đây (session) | 5.08 | 16.97 | 0.121 | 4.27 | 28.39 | **0.162** ± 0.009 | 37.85 | 0.146 | 95.77 | 0.391 | 4.17 |
| User-based CF (k-NN) | 10.25 | 35.15 | 0.279 | 7.45 | 49.30 | **0.330** ± 0.044 | 61.79 | 0.322 | 54.48 | 0.755 | 3.31 |
| Item-based CF (k-NN) | 7.76 | 26.79 | 0.180 | 6.39 | 43.46 | **0.240** ± 0.027 | 55.09 | 0.206 | 54.31 | 0.748 | 3.36 |
| Matrix Factorization (BPR) | 9.79 | 33.96 | 0.254 | 7.09 | 48.43 | **0.306** ± 0.044 | 60.77 | 0.286 | 67.17 | 0.745 | 3.42 |
| Hybrid v2 (trọng số ban đầu) | 8.94 | 30.23 | 0.240 | 6.56 | 44.13 | **0.290** ± 0.029 | 56.34 | 0.285 | 85.11 | 0.534 | 3.74 |
| Hybrid v2 (tinh chỉnh) | 10.80 | 37.55 | 0.285 | 7.54 | 51.12 | **0.334** ± 0.037 | 64.37 | 0.322 | 55.67 | 0.734 | 3.29 |
| Hybrid v2 (tinh chỉnh) + MMR | 10.25 | 35.18 | 0.276 | 6.86 | 46.25 | **0.315** ± 0.040 | 59.08 | 0.312 | 54.82 | 0.812 | 3.32 |

Số người dùng được đánh giá mỗi seed: 147, 151, 133. Lưu ý: "Thuật toán cũ (v1)" ở đây được đánh giá trong điều kiện **có lợi** — nó được thấy hành vi của toàn bộ người dùng như thể cùng một trình duyệt; trong website cũ, nó chỉ thấy các tài khoản trên cùng trình duyệt (xem mục 7).

**So với thuật toán cũ:** NDCG@10 0.098 → 0.334 (+241.6%), Recall@10 16.74% → 51.12%, HitRate@10 23.64% → 64.37%, độ đa dạng ILD@10 0.443 → 0.734. Đánh đổi: độ phủ danh mục Coverage@10 83.42% → 55.67% (bản cũ phủ rộng vì gần như chỉ dựa vào nội dung nhưng độ chính xác thấp).

Hybrid tinh chỉnh **ngang bằng** thành phần đơn lẻ tốt nhất ở cấu hình mặc định (khác biệt không có ý nghĩa thống kê, xem bảng dưới); lợi thế của hybrid nằm ở **độ bền** khi bản chất dữ liệu thay đổi (mục 6), khi ít người dùng (mục 7) và với người dùng mới (mục 4). Trọng số giữa các thành phần cộng tác (ucf/icf/mf) dao động giữa các seed vì chúng mang thông tin tương tự nhau (đa cộng tuyến); tổng trọng số nhóm cộng tác luôn chiếm phần lớn.

### Kiểm định ý nghĩa thống kê (paired permutation test, 10.000 hoán vị, NDCG@10 theo từng người dùng, gộp các seed)

| So sánh | Chênh lệch TB NDCG@10 | p-value |
|---|---|---|
| Hybrid v2 (tinh chỉnh) vs User-based CF (k-NN) (đơn lẻ tốt nhất) | +0.0039 | 0.5517 |
| Hybrid v2 (tinh chỉnh) vs Thuật toán cũ (v1) | +0.2349 | < 0.001 |
| Hybrid v2 (tinh chỉnh) vs Hybrid v2 (trọng số ban đầu) | +0.0440 | < 0.001 |

### Trọng số hybrid sau tinh chỉnh (theo từng seed) và giá trị mặc định đưa vào engine

| Seed | session | cb | ucf | icf | mf | pop | NDCG@10 (validation) |
|---|---|---|---|---|---|---|---|
| 1 | 0.05 | 0.00 | 0.45 | 0.05 | 0.35 | 0.10 | 0.377 |
| 2 | 0.10 | 0.00 | 0.45 | 0.00 | 0.45 | 0.00 | 0.368 |
| 3 | 0.00 | 0.20 | 0.20 | 0.20 | 0.00 | 0.40 | 0.377 |
| **Mặc định người dùng cũ (trung bình)** | 0.05 | 0.07 | 0.37 | 0.08 | 0.27 | 0.17 | |
| cold-start seed 1 | 0.00 | 0.00 | 0.50 | 0.20 | 0.30 | 0.00 | 0.327 |
| cold-start seed 2 | 0.00 | 0.25 | 0.15 | 0.00 | 0.00 | 0.60 | 0.289 |
| cold-start seed 3 | 0.00 | 0.00 | 0.80 | 0.10 | 0.10 | 0.00 | 0.376 |
| **Mặc định người dùng mới (≤ 2 tương tác, có quiz)** | 0.00 | 0.08 | 0.48 | 0.10 | 0.13 | 0.20 | |

Ký hiệu: session = tương tự sản phẩm vừa xem, cb = content-based, ucf = user-based CF, icf = item-based CF, mf = BPR, pop = xu hướng.

## 3. Đánh đổi chính xác – đa dạng (MMR, validation seed 1)

| λ | NDCG@10 | ILD@10 | Coverage@10 (%) |
|---|---|---|---|
| 1 | 0.377 | 0.743 | 58.88 |
| 0.9 | 0.370 | 0.773 | 57.87 |
| 0.8 | 0.370 | 0.802 | 57.36 |
| 0.7 (chọn) | 0.373 | 0.822 | 58.88 |
| 0.6 | 0.357 | 0.844 | 59.39 |
| 0.5 | 0.346 | 0.862 | 57.36 |

Quy tắc chọn: λ cho độ đa dạng cao nhất mà NDCG@10 giảm không quá 2% so với λ = 1.

## 4. Người dùng mới (cold-start: ≤ 2 tương tác dương trước thời điểm test)

| Thuật toán | NDCG@10 | HR@10 (%) | Recall@10 (%) |
|---|---|---|---|
| Phổ biến (Popularity) | 0.162 | 44.41 | 27.92 |
| Thuật toán cũ (v1) | 0.059 | 16.09 | 11.22 |
| Content-based (không quiz) | 0.187 | 43.62 | 28.15 |
| Content-based + quiz Style DNA | 0.144 | 32.05 | 23.49 |
| Hybrid (trọng số người dùng cũ, không switching) | 0.205 | 50.94 | 32.81 |
| Hybrid switching (không quiz) | 0.204 | 51.02 | 32.71 |
| Hybrid switching + quiz Style DNA | 0.241 | 56.78 | 38.97 |

Giao thức: chọn ngẫu nhiên 30% người dùng có mục tiêu trong cửa sổ test, cắt lịch sử của họ còn 0 hoặc 2 sự kiện đầu tiên rồi huấn luyện lại. Số người dùng mới được đánh giá mỗi seed: 66, 63, 57. Câu trả lời quiz mô phỏng có nhiễu 20%. "Switching" = người dùng ≤ 2 tương tác dùng bộ trọng số cold-start tinh chỉnh riêng trên validation.

## 5. Ablation: điều chỉnh điểm đánh giá bằng cảm xúc bình luận

| Cấu hình | NDCG@10 | Recall@10 (%) |
|---|---|---|
| Hybrid v2 — có điều chỉnh theo cảm xúc (μ = 0.3) | 0.334 | 51.12 |
| Hybrid v2 — chỉ dùng số sao (μ = 0) | 0.332 | 51.09 |

## 6. Độ nhạy theo cơ chế sinh dữ liệu (ρ = tỉ trọng "gu cụm" ẩn; seed 1)

| ρ | Phổ biến | Thuật toán cũ (v1) | Content-based | User-based CF | Item-based CF | BPR | Hybrid v2 (trọng số mặc định) | Hybrid v2 (tinh chỉnh theo ρ) |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.144 | 0.130 | 0.171 | 0.257 | 0.186 | 0.208 | 0.260 | 0.250 |
| 0.25 | 0.263 | 0.128 | 0.163 | 0.345 | 0.254 | 0.322 | 0.353 | 0.341 |
| 0.5 | 0.223 | 0.100 | 0.149 | 0.331 | 0.231 | 0.273 | 0.334 | 0.335 |
| 0.75 | 0.218 | 0.114 | 0.145 | 0.445 | 0.337 | 0.411 | 0.434 | 0.440 |
| 1 | 0.193 | 0.103 | 0.088 | 0.439 | 0.346 | 0.368 | 0.427 | 0.439 |

Giá trị là NDCG@10. ρ = 0: sở thích hoàn toàn giải thích được bằng thuộc tính (Content-based có lợi); ρ = 1: chỉ có tương quan ẩn giữa người dùng (Collaborative có lợi).

Trọng số tối ưu tìm được cho từng ρ (cho thấy hỗn hợp tối ưu dịch chuyển theo bản chất dữ liệu — lý do phải tinh chỉnh lại trên dữ liệu thật):

| ρ | session | cb | ucf | icf | mf | pop |
|---|---|---|---|---|---|---|
| 0 | 0.10 | 0.10 | 0.20 | 0.00 | 0.60 | 0.00 |
| 0.25 | 0.00 | 0.10 | 0.15 | 0.00 | 0.75 | 0.00 |
| 0.5 | 0.05 | 0.00 | 0.45 | 0.05 | 0.35 | 0.10 |
| 0.75 | 0.00 | 0.20 | 0.60 | 0.00 | 0.20 | 0.00 |
| 1 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 |

## 7. Ảnh hưởng của số lượng người dùng (vì sao cần dữ liệu tập trung trên máy chủ)

| Số người dùng | Được đánh giá | Thuật toán cũ (v1) | Content-based | User-based CF | Hybrid v2 (trọng số mặc định) |
|---|---|---|---|---|---|
| 3 | 0 | n/a | n/a | n/a | n/a |
| 10 | 0 | n/a | n/a | n/a | n/a |
| 50 | 9 | 0.094 | 0.155 | 0.111 | 0.115 |
| 150 | 30 | 0.093 | 0.156 | 0.261 | 0.279 |
| 300 | 75 | 0.123 | 0.151 | 0.352 | 0.373 |
| 600 | 147 | 0.100 | 0.149 | 0.331 | 0.334 |

Giá trị là NDCG@10 trên test. Bản cũ chỉ thấy các tài khoản trên **cùng một trình duyệt** (thường 1–3 người) nên phần cộng tác gần như không hoạt động; backend mới gom hành vi của mọi người dùng.

## Hạn chế

- Dữ liệu mô phỏng phản ánh giả định của người xây dựng bộ sinh; thứ hạng thuật toán có thể khác trên dữ liệu thật (xem thí nghiệm độ nhạy ρ).
- Bình luận mô phỏng được sinh từ các mẫu câu cùng phong cách với từ điển cảm xúc nên hiệu quả của bước cảm xúc ở đây có thể bị đánh giá cao; độ chính xác thật của module cảm xúc đo trên tập held-out là 82.5%.
- Đánh giá offline đo khả năng dự đoán hành vi tương lai, chưa thay thế được A/B test với người dùng thật (hệ thống đã ghi nhận impression/click để đo CTR khi triển khai).

