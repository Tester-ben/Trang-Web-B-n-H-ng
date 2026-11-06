-- =============================================================================
-- THE STYLE HUB — Lược đồ CSDL (SQLite) cho hệ gợi ý
-- Được server/db.js tự áp dụng khi khởi động (PRAGMA user_version = 1).
-- =============================================================================

-- Người dùng. is_demo = 1: tài khoản mô phỏng do `npm run seed:demo` tạo (không đăng nhập được),
-- luôn được ghi rõ "(dữ liệu demo)" khi xuất hiện trong lời giải thích gợi ý.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,              -- scrypt$N$r$p$salt$hash
    role          TEXT    NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    is_demo       INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
);

-- Hành vi người dùng (dữ liệu cho Collaborative/Content-based filtering).
-- rating: đánh giá "hợp gu" 1..5 (0 = xóa); rec_impression/rec_click: đo CTR của khu gợi ý.
CREATE TABLE IF NOT EXISTS interactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  TEXT    NOT NULL,
    type        TEXT    NOT NULL CHECK (type IN ('view', 'cart', 'wishlist', 'unwishlist', 'purchase', 'rating', 'rec_impression', 'rec_click')),
    value       REAL,
    context     TEXT,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_product ON interactions(product_id, type);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);

-- Đơn hàng (nguồn xác minh "đã mua" cho đánh giá sản phẩm).
CREATE TABLE IF NOT EXISTS orders (
    id          TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total       INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
    order_id    TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  TEXT    NOT NULL,
    size        TEXT    NOT NULL DEFAULT '',
    quantity    INTEGER NOT NULL DEFAULT 1,
    price       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (order_id, product_id, size)
);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Đánh giá sản phẩm sau mua: sao + bình luận + điểm cảm xúc tiếng Việt.
CREATE TABLE IF NOT EXISTS reviews (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id        TEXT    NOT NULL,
    rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment           TEXT    NOT NULL DEFAULT '',
    sentiment         REAL,
    sentiment_label   TEXT,
    verified_purchase INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, created_at);

-- Hồ sơ phong cách từ quiz "Style DNA" (giải quyết cold-start).
CREATE TABLE IF NOT EXISTS style_profiles (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    quiz_json  TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
);
