# API backend THE STYLE HUB (v2)

Cơ sở: cùng origin với website (mặc định `http://localhost:3000`). Mọi phản hồi là JSON `{ ok: boolean, ... }`; lỗi trả `{ ok: false, code, message }` với mã HTTP tương ứng. Xác thực bằng header `Authorization: Bearer <token>` (token HMAC-SHA256, hạn 7 ngày). Thân yêu cầu POST/PUT phải có `Content-Type: application/json`.

| Phương thức & đường dẫn | Xác thực | Mô tả |
|---|---|---|
| `GET /api/health` | — | `{ ok, service: "stylehub-api", version, store }` — website dùng để phát hiện backend |
| `POST /api/auth/register` | — | `{ email, password (6–128), name }` → `201 { token, user }`; `409` nếu email đã có |
| `POST /api/auth/login` | — | `{ email, password }` → `{ token, user: { id, email, name, role } }`; `401` sai thông tin; `429` quá 10 lần/phút |
| `GET /api/auth/me` | bắt buộc | `{ user }` |
| `POST /api/events` | bắt buộc | `{ events: [{ productId, type, value?, ts?, context? }] }` (≤ 100). `type`: `view`, `cart`, `wishlist` (value 1/0), `unwishlist`, `rating` (0–5, 0 = xóa), `rec_impression`, `rec_click` (value = thứ hạng). Lượt xem trùng trong 30 giây bị bỏ. Lượt **mua** chỉ ghi qua `/api/orders`. → `{ accepted, rejected: [{ index, reason }] }` |
| `POST /api/orders` | bắt buộc | `{ orderId, items: [{ productId, quantity, size, price }], total }` → `201`; gửi lại cùng mã đơn → `200 { created: false }` |
| `GET /api/recommendations` | tùy chọn | Tham số: `context=home\|product`, `productId` (khi product), `limit` (≤ 24), `strategy=social` (chỉ User-based CF, loại sản phẩm đã tương tác), `quiz` (JSON, cho khách chưa đăng nhập), `recent=id:ts,...` (sản phẩm vừa xem của khách), `exclude=id,...`, `diversify=0`. → `{ personalized, strategy, items: [{ id, score, reason, explanation: { type, text, evidence, shares } }], meta }` |
| `GET /api/recommendations/outfit?productId=&perCategory=` | tùy chọn | `{ items: [{ id, category, score, reason }] }` |
| `GET /api/products/:id/reviews?limit=&offset=` | tùy chọn | `{ stats: { count, average, distribution }, reviews: [{ rating, comment, sentimentLabel, sentiment, verifiedPurchase, author (ẩn danh), isDemo, mine }], canReview, myReview }` |
| `POST /api/products/:id/reviews` | bắt buộc | `{ rating (1–5), comment (≤ 1000) }` → `201`; `403 NOT_PURCHASED` nếu chưa mua. Thẻ HTML bị loại bỏ; điểm cảm xúc tính tự động |
| `DELETE /api/products/:id/reviews` | bắt buộc | Xóa đánh giá của chính mình |
| `GET /api/profile/style-dna` | bắt buộc | `{ quiz, dna: { persona, types, colors, styles, prices, interactions, fromQuiz, confidence } }` |
| `PUT /api/profile/quiz` | bắt buộc | `{ quiz: { gender, styles[], colors[], types[], budget } }` (giá trị ngoài từ vựng bị bỏ) |
| `DELETE /api/profile/history` | bắt buộc | Xóa hành vi (trừ lượt mua) và quiz của chính mình |
| `GET /api/admin/stats` | admin | Thống kê người dùng (thật/demo), tương tác theo loại, CTR theo vị trí gợi ý, đánh giá & phân bố cảm xúc, độ thưa ma trận, sản phẩm xu hướng, tóm tắt thực nghiệm |
| `GET /api/admin/evaluation` | admin | Toàn bộ `evaluation/results/latest.json` |

Giới hạn tần suất: đăng ký 10/giờ/IP, đăng nhập 10/phút/IP và 10/15 phút/email, sự kiện 240/phút/người dùng, đơn hàng 20/giờ, đánh giá 10/giờ, gợi ý 240/phút/IP. Vượt giới hạn → `429` kèm `Retry-After`.

Ví dụ:

```bash
curl -s "http://localhost:3000/api/recommendations?context=product&productId=hoodies-1&limit=4"
```

```json
{ "ok": true, "source": "server", "personalized": false, "context": "product", "strategy": "hybrid",
  "items": [{ "id": "hoodies-7", "score": 0.7755,
              "reason": "Tương tự sản phẩm đang xem: áo hoodie · màu xanh dương · đồ nam",
              "explanation": { "type": "ctx", "shares": { "ctx": 90, "pop": 10 } } }] }
```
