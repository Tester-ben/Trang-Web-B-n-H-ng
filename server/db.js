/* =============================================================================
   Lớp lưu trữ cho backend THE STYLE HUB
   - Mặc định: SQLite qua module có sẵn `node:sqlite` (Node >= 22.13), file server/data/stylehub.db
   - Dự phòng: JSON file (server/data/stylehub.json) khi Node chưa có node:sqlite hoặc STYLEHUB_STORE=json
   Hai bản cài đặt có cùng giao diện; tests/server.test.js chạy trên cả hai.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

function loadSqlite() {
    // Ẩn cảnh báo "SQLite is an experimental feature" để log gọn; các cảnh báo khác giữ nguyên.
    const original = process.emitWarning;
    process.emitWarning = function (warning, ...rest) {
        if (String(warning && warning.message ? warning.message : warning).includes('SQLite')) return;
        return original.call(process, warning, ...rest);
    };
    try { return require('node:sqlite'); } catch (_) { return null; } finally { process.emitWarning = original; }
}

const INTERACTION_TYPES = ['view', 'cart', 'wishlist', 'unwishlist', 'purchase', 'rating', 'rec_impression', 'rec_click'];

/* ------------------------------------------------------------------ */
/* SQLite                                                              */
/* ------------------------------------------------------------------ */
class SqliteStore {
    constructor(file, sqlite) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        this.kind = 'sqlite';
        this.file = file;
        this.db = new sqlite.DatabaseSync(file);
        this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
        const version = this.db.prepare('PRAGMA user_version').get().user_version;
        if (version < 1) {
            this.db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
            this.db.exec('PRAGMA user_version = 1');
        }
        this.q = {};
    }
    stmt(sql) { return this.q[sql] || (this.q[sql] = this.db.prepare(sql)); }
    tx(fn) {
        this.db.exec('BEGIN');
        try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
    close() { try { this.db.close(); } catch (_) { /* đã đóng */ } }

    // ---- users ----
    createUser(u) {
        const r = this.stmt('INSERT INTO users (email, name, password_hash, role, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(u.email, u.name, u.passwordHash, u.role || 'customer', u.isDemo ? 1 : 0, u.createdAt || Date.now());
        return this.getUserById(Number(r.lastInsertRowid));
    }
    getUserByEmail(email) { return mapUser(this.stmt('SELECT * FROM users WHERE email = ?').get(email)); }
    getUserById(id) { return mapUser(this.stmt('SELECT * FROM users WHERE id = ?').get(id)); }
    updateUser(id, patch) {
        if (patch.passwordHash) this.stmt('UPDATE users SET password_hash = ? WHERE id = ?').run(patch.passwordHash, id);
        if (patch.role) this.stmt('UPDATE users SET role = ? WHERE id = ?').run(patch.role, id);
        if (patch.name) this.stmt('UPDATE users SET name = ? WHERE id = ?').run(patch.name, id);
        return this.getUserById(id);
    }
    demoUserIds() { return this.stmt('SELECT id FROM users WHERE is_demo = 1').all().map((r) => r.id); }
    deleteDemoData() { return this.tx(() => this.stmt('DELETE FROM users WHERE is_demo = 1').run().changes); }

    // ---- interactions ----
    addInteractions(list) {
        const ins = this.stmt('INSERT INTO interactions (user_id, product_id, type, value, context, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        return this.tx(() => {
            list.forEach((e) => ins.run(e.userId, e.productId, e.type, e.value === undefined ? null : e.value, e.context || null, e.createdAt));
            return list.length;
        });
    }
    lastInteractionAt(userId, productId, type) {
        const r = this.stmt('SELECT MAX(created_at) AS t FROM interactions WHERE user_id = ? AND product_id = ? AND type = ?').get(userId, productId, type);
        return r && r.t ? Number(r.t) : 0;
    }
    deleteHistory(userId) {
        return this.tx(() => {
            const n = this.stmt("DELETE FROM interactions WHERE user_id = ? AND type NOT IN ('purchase')").run(userId).changes;
            this.stmt('DELETE FROM style_profiles WHERE user_id = ?').run(userId);
            return n;
        });
    }
    listInteractions() {
        return this.stmt("SELECT user_id, product_id, type, value, created_at FROM interactions WHERE type NOT IN ('rec_impression', 'rec_click')").all()
            .map((r) => ({ user: String(r.user_id), item: r.product_id, type: r.type, value: r.value === null ? undefined : r.value, ts: Number(r.created_at) }));
    }

    // ---- orders ----
    createOrder(o) {
        return this.tx(() => {
            const existing = this.stmt('SELECT id, user_id FROM orders WHERE id = ?').get(o.id);
            if (existing) return { created: false, sameOwner: Number(existing.user_id) === Number(o.userId) };
            this.stmt('INSERT INTO orders (id, user_id, total, status, created_at) VALUES (?, ?, ?, ?, ?)').run(o.id, o.userId, o.total || 0, o.status || 'pending', o.createdAt);
            const insItem = this.stmt('INSERT OR REPLACE INTO order_items (order_id, product_id, size, quantity, price) VALUES (?, ?, ?, ?, ?)');
            const insEvent = this.stmt('INSERT INTO interactions (user_id, product_id, type, value, context, created_at) VALUES (?, ?, ?, ?, ?, ?)');
            o.items.forEach((it) => {
                insItem.run(o.id, it.productId, it.size || '', it.quantity || 1, it.price || 0);
                insEvent.run(o.userId, it.productId, 'purchase', it.quantity || 1, 'order:' + o.id, o.createdAt);
            });
            return { created: true };
        });
    }
    hasPurchased(userId, productId) {
        const r = this.stmt("SELECT 1 AS ok FROM interactions WHERE user_id = ? AND product_id = ? AND type = 'purchase' LIMIT 1").get(userId, productId);
        return !!r;
    }

    // ---- reviews ----
    upsertReview(r) {
        const now = r.updatedAt || Date.now();
        this.stmt(`INSERT INTO reviews (user_id, product_id, rating, comment, sentiment, sentiment_label, verified_purchase, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, product_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment,
                   sentiment = excluded.sentiment, sentiment_label = excluded.sentiment_label,
                   verified_purchase = excluded.verified_purchase, updated_at = excluded.updated_at`)
            .run(r.userId, r.productId, r.rating, r.comment || '', r.sentiment, r.sentimentLabel, r.verified ? 1 : 0, r.createdAt || now, now);
        return this.getReview(r.userId, r.productId);
    }
    getReview(userId, productId) {
        return mapReview(this.stmt('SELECT r.*, u.name AS user_name, u.is_demo FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.user_id = ? AND r.product_id = ?').get(userId, productId));
    }
    deleteReview(userId, productId) { return this.stmt('DELETE FROM reviews WHERE user_id = ? AND product_id = ?').run(userId, productId).changes; }
    listReviews(productId, limit, offset) {
        return this.stmt('SELECT r.*, u.name AS user_name, u.is_demo FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?')
            .all(productId, limit, offset).map(mapReview);
    }
    reviewStats(productId) {
        const rows = this.stmt('SELECT rating, COUNT(*) AS n FROM reviews WHERE product_id = ? GROUP BY rating').all(productId);
        return statsFromRows(rows);
    }
    listReviewEvents() {
        return this.stmt('SELECT user_id, product_id, rating, sentiment, updated_at FROM reviews').all()
            .map((r) => ({ user: String(r.user_id), item: r.product_id, type: 'review', value: r.rating, sentiment: r.sentiment === null ? undefined : r.sentiment, ts: Number(r.updated_at) }));
    }

    // ---- style profiles ----
    saveQuiz(userId, quiz) {
        this.stmt('INSERT INTO style_profiles (user_id, quiz_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET quiz_json = excluded.quiz_json, updated_at = excluded.updated_at')
            .run(userId, JSON.stringify(quiz), Date.now());
    }
    getQuiz(userId) {
        const r = this.stmt('SELECT quiz_json FROM style_profiles WHERE user_id = ?').get(userId);
        return r ? safeJson(r.quiz_json) : null;
    }
    listQuizzes() {
        const out = {};
        this.stmt('SELECT user_id, quiz_json FROM style_profiles').all().forEach((r) => { const q = safeJson(r.quiz_json); if (q) out[String(r.user_id)] = { quiz: q }; });
        return out;
    }

    // ---- thống kê ----
    stats() {
        const one = (sql, ...a) => this.stmt(sql).get(...a);
        const users = one('SELECT COUNT(*) AS total, SUM(is_demo) AS demo, SUM(CASE WHEN role = \'admin\' THEN 1 ELSE 0 END) AS admins FROM users');
        const byType = {};
        this.stmt('SELECT i.type, u.is_demo, COUNT(*) AS n FROM interactions i JOIN users u ON u.id = i.user_id GROUP BY i.type, u.is_demo').all()
            .forEach((r) => { byType[r.type] = byType[r.type] || { real: 0, demo: 0 }; byType[r.type][r.is_demo ? 'demo' : 'real'] += Number(r.n); });
        const ctr = {};
        this.stmt("SELECT COALESCE(context, 'unknown') AS context, type, COUNT(*) AS n FROM interactions WHERE type IN ('rec_impression', 'rec_click') GROUP BY context, type").all()
            .forEach((r) => { const c = String(r.context).split(':')[0]; ctr[c] = ctr[c] || { impressions: 0, clicks: 0 }; ctr[c][r.type === 'rec_click' ? 'clicks' : 'impressions'] += Number(r.n); });
        const reviews = one('SELECT COUNT(*) AS n, AVG(rating) AS avg, SUM(verified_purchase) AS verified FROM reviews');
        const sentiment = {};
        this.stmt('SELECT COALESCE(sentiment_label, \'neutral\') AS label, COUNT(*) AS n FROM reviews GROUP BY label').all().forEach((r) => { sentiment[r.label] = Number(r.n); });
        const activeUsers = one("SELECT COUNT(DISTINCT user_id) AS n FROM interactions WHERE type NOT IN ('rec_impression', 'rec_click')").n;
        const orders = one('SELECT COUNT(*) AS n FROM orders').n;
        const quizzes = one('SELECT COUNT(*) AS n FROM style_profiles').n;
        return {
            users: { total: Number(users.total || 0), demo: Number(users.demo || 0), admins: Number(users.admins || 0), active: Number(activeUsers || 0) },
            interactions: byType, recommendationCtr: ctr, orders: Number(orders || 0), quizzes: Number(quizzes || 0),
            reviews: { total: Number(reviews.n || 0), average: reviews.avg ? Number(Number(reviews.avg).toFixed(2)) : null, verified: Number(reviews.verified || 0), sentiment }
        };
    }
}

/* ------------------------------------------------------------------ */
/* JSON (dự phòng)                                                      */
/* ------------------------------------------------------------------ */
class JsonStore {
    constructor(file) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        this.kind = 'json';
        this.file = file;
        this.data = { seq: { users: 0, interactions: 0, reviews: 0 }, users: [], interactions: [], orders: [], orderItems: [], reviews: [], profiles: {} };
        if (fs.existsSync(file)) {
            try { Object.assign(this.data, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (_) { /* file hỏng -> bắt đầu rỗng, giữ bản cũ */ fs.copyFileSync(file, file + '.corrupt-' + Date.now()); }
        }
        this.timer = null;
    }
    persist() {
        if (this.timer) return;
        this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 50);
        if (this.timer.unref) this.timer.unref();
    }
    flush() {
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data));
        fs.renameSync(tmp, this.file);
    }
    close() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.flush(); }
    tx(fn) { const r = fn(); this.persist(); return r; }

    createUser(u) {
        if (this.data.users.some((x) => x.email === u.email)) { const e = new Error('UNIQUE constraint failed: users.email'); e.code = 'ERR_SQLITE_ERROR'; throw e; }
        const user = { id: ++this.data.seq.users, email: u.email, name: u.name, password_hash: u.passwordHash, role: u.role || 'customer', is_demo: u.isDemo ? 1 : 0, created_at: u.createdAt || Date.now() };
        this.data.users.push(user);
        this.persist();
        return mapUser(user);
    }
    getUserByEmail(email) { return mapUser(this.data.users.find((u) => u.email === email)); }
    getUserById(id) { return mapUser(this.data.users.find((u) => u.id === Number(id))); }
    updateUser(id, patch) {
        const u = this.data.users.find((x) => x.id === Number(id));
        if (!u) return null;
        if (patch.passwordHash) u.password_hash = patch.passwordHash;
        if (patch.role) u.role = patch.role;
        if (patch.name) u.name = patch.name;
        this.persist();
        return mapUser(u);
    }
    demoUserIds() { return this.data.users.filter((u) => u.is_demo).map((u) => u.id); }
    deleteDemoData() {
        const demo = new Set(this.demoUserIds());
        const n = demo.size;
        this.data.users = this.data.users.filter((u) => !demo.has(u.id));
        this.data.interactions = this.data.interactions.filter((e) => !demo.has(e.user_id));
        this.data.reviews = this.data.reviews.filter((r) => !demo.has(r.user_id));
        const demoOrders = new Set(this.data.orders.filter((o) => demo.has(o.user_id)).map((o) => o.id));
        this.data.orders = this.data.orders.filter((o) => !demoOrders.has(o.id));
        this.data.orderItems = this.data.orderItems.filter((i) => !demoOrders.has(i.order_id));
        demo.forEach((id) => { delete this.data.profiles[id]; });
        this.persist();
        return n;
    }
    addInteractions(list) {
        list.forEach((e) => this.data.interactions.push({ id: ++this.data.seq.interactions, user_id: e.userId, product_id: e.productId, type: e.type, value: e.value === undefined ? null : e.value, context: e.context || null, created_at: e.createdAt }));
        this.persist();
        return list.length;
    }
    lastInteractionAt(userId, productId, type) {
        let t = 0;
        for (const e of this.data.interactions) if (e.user_id === userId && e.product_id === productId && e.type === type && e.created_at > t) t = e.created_at;
        return t;
    }
    deleteHistory(userId) {
        const before = this.data.interactions.length;
        this.data.interactions = this.data.interactions.filter((e) => e.user_id !== userId || e.type === 'purchase');
        delete this.data.profiles[userId];
        this.persist();
        return before - this.data.interactions.length;
    }
    listInteractions() {
        return this.data.interactions.filter((e) => e.type !== 'rec_impression' && e.type !== 'rec_click')
            .map((r) => ({ user: String(r.user_id), item: r.product_id, type: r.type, value: r.value === null ? undefined : r.value, ts: r.created_at }));
    }
    createOrder(o) {
        const existing = this.data.orders.find((x) => x.id === o.id);
        if (existing) return { created: false, sameOwner: existing.user_id === o.userId };
        this.data.orders.push({ id: o.id, user_id: o.userId, total: o.total || 0, status: o.status || 'pending', created_at: o.createdAt });
        o.items.forEach((it) => {
            this.data.orderItems.push({ order_id: o.id, product_id: it.productId, size: it.size || '', quantity: it.quantity || 1, price: it.price || 0 });
            this.data.interactions.push({ id: ++this.data.seq.interactions, user_id: o.userId, product_id: it.productId, type: 'purchase', value: it.quantity || 1, context: 'order:' + o.id, created_at: o.createdAt });
        });
        this.persist();
        return { created: true };
    }
    hasPurchased(userId, productId) { return this.data.interactions.some((e) => e.user_id === userId && e.product_id === productId && e.type === 'purchase'); }
    upsertReview(r) {
        const now = r.updatedAt || Date.now();
        let row = this.data.reviews.find((x) => x.user_id === r.userId && x.product_id === r.productId);
        if (!row) { row = { id: ++this.data.seq.reviews, user_id: r.userId, product_id: r.productId, created_at: r.createdAt || now }; this.data.reviews.push(row); }
        Object.assign(row, { rating: r.rating, comment: r.comment || '', sentiment: r.sentiment, sentiment_label: r.sentimentLabel, verified_purchase: r.verified ? 1 : 0, updated_at: now });
        this.persist();
        return this.getReview(r.userId, r.productId);
    }
    getReview(userId, productId) {
        const r = this.data.reviews.find((x) => x.user_id === userId && x.product_id === productId);
        if (!r) return null;
        const u = this.data.users.find((x) => x.id === r.user_id) || {};
        return mapReview(Object.assign({ user_name: u.name, is_demo: u.is_demo }, r));
    }
    deleteReview(userId, productId) {
        const before = this.data.reviews.length;
        this.data.reviews = this.data.reviews.filter((x) => !(x.user_id === userId && x.product_id === productId));
        this.persist();
        return before - this.data.reviews.length;
    }
    listReviews(productId, limit, offset) {
        return this.data.reviews.filter((r) => r.product_id === productId).sort((a, b) => b.created_at - a.created_at).slice(offset, offset + limit)
            .map((r) => { const u = this.data.users.find((x) => x.id === r.user_id) || {}; return mapReview(Object.assign({ user_name: u.name, is_demo: u.is_demo }, r)); });
    }
    reviewStats(productId) {
        const counts = {};
        this.data.reviews.filter((r) => r.product_id === productId).forEach((r) => { counts[r.rating] = (counts[r.rating] || 0) + 1; });
        return statsFromRows(Object.keys(counts).map((k) => ({ rating: Number(k), n: counts[k] })));
    }
    listReviewEvents() {
        return this.data.reviews.map((r) => ({ user: String(r.user_id), item: r.product_id, type: 'review', value: r.rating, sentiment: r.sentiment === null ? undefined : r.sentiment, ts: r.updated_at }));
    }
    saveQuiz(userId, quiz) { this.data.profiles[userId] = { quiz, updated_at: Date.now() }; this.persist(); }
    getQuiz(userId) { return this.data.profiles[userId] ? this.data.profiles[userId].quiz : null; }
    listQuizzes() { const out = {}; Object.keys(this.data.profiles).forEach((id) => { out[String(id)] = { quiz: this.data.profiles[id].quiz }; }); return out; }
    stats() {
        const demo = new Set(this.demoUserIds());
        const byType = {}, ctr = {}, sentiment = {};
        this.data.interactions.forEach((e) => {
            byType[e.type] = byType[e.type] || { real: 0, demo: 0 };
            byType[e.type][demo.has(e.user_id) ? 'demo' : 'real']++;
            if (e.type === 'rec_impression' || e.type === 'rec_click') {
                const c = String(e.context || 'unknown').split(':')[0];
                ctr[c] = ctr[c] || { impressions: 0, clicks: 0 };
                ctr[c][e.type === 'rec_click' ? 'clicks' : 'impressions']++;
            }
        });
        this.data.reviews.forEach((r) => { const l = r.sentiment_label || 'neutral'; sentiment[l] = (sentiment[l] || 0) + 1; });
        const active = new Set(this.data.interactions.filter((e) => e.type !== 'rec_impression' && e.type !== 'rec_click').map((e) => e.user_id)).size;
        const ratings = this.data.reviews.map((r) => r.rating);
        return {
            users: { total: this.data.users.length, demo: demo.size, admins: this.data.users.filter((u) => u.role === 'admin').length, active },
            interactions: byType, recommendationCtr: ctr, orders: this.data.orders.length, quizzes: Object.keys(this.data.profiles).length,
            reviews: { total: ratings.length, average: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : null, verified: this.data.reviews.filter((r) => r.verified_purchase).length, sentiment }
        };
    }
}

/* ------------------------------------------------------------------ */
function mapUser(r) {
    if (!r) return null;
    return { id: Number(r.id), email: r.email, name: r.name, passwordHash: r.password_hash, role: r.role, isDemo: !!r.is_demo, createdAt: Number(r.created_at) };
}
function mapReview(r) {
    if (!r) return null;
    return {
        id: Number(r.id), userId: Number(r.user_id), productId: r.product_id, rating: Number(r.rating), comment: r.comment || '',
        sentiment: r.sentiment === null || r.sentiment === undefined ? null : Number(r.sentiment), sentimentLabel: r.sentiment_label || 'neutral',
        verifiedPurchase: !!r.verified_purchase, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
        userName: r.user_name || 'Khách hàng', isDemo: !!r.is_demo
    };
}
function statsFromRows(rows) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let n = 0, sum = 0;
    rows.forEach((r) => { distribution[r.rating] = Number(r.n); n += Number(r.n); sum += Number(r.rating) * Number(r.n); });
    return { count: n, average: n ? Number((sum / n).toFixed(2)) : null, distribution };
}
function safeJson(text) { try { return JSON.parse(text); } catch (_) { return null; } }

function openStore(options) {
    const o = options || {};
    const dataDir = o.dataDir || path.join(__dirname, 'data');
    const wantJson = (o.kind || process.env.STYLEHUB_STORE) === 'json';
    const sqlite = wantJson ? null : loadSqlite();
    if (sqlite) return new SqliteStore(o.file || path.join(dataDir, 'stylehub.db'), sqlite);
    return new JsonStore(o.jsonFile || path.join(dataDir, 'stylehub.json'));
}

/** Xuất sự kiện (có cờ demo) cho thực nghiệm offline: npm run evaluate -- --data=server */
function exportEvents(dbPath) {
    const isJson = /\.json$/i.test(dbPath);
    if (!fs.existsSync(dbPath)) throw new Error('Không tìm thấy CSDL: ' + dbPath + ' (chạy server để thu thập dữ liệu trước).');
    const store = isJson ? new JsonStore(dbPath) : new SqliteStore(dbPath, loadSqlite());
    try {
        const demo = new Set(store.demoUserIds().map(String));
        return store.listInteractions().concat(store.listReviewEvents()).map((e) => Object.assign(e, { demo: demo.has(e.user) }));
    } finally { if (!isJson) store.close(); }
}

module.exports = { openStore, exportEvents, INTERACTION_TYPES, SqliteStore, JsonStore };
