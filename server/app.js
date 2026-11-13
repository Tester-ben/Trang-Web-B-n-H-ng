/* =============================================================================
   THE STYLE HUB — REST API + phục vụ website tĩnh (không phụ thuộc thư viện ngoài)
   Tài liệu API: docs/API.md
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const { RateLimiter } = require('./rate-limit');
const { INTERACTION_TYPES } = require('./db');
const engine = require('../recommender/engine');
const sentiment = require('../recommender/sentiment-vi');

const VERSION = '2.0.0';
const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
// Thư mục/tệp KHÔNG phục vụ ra web (mã máy chủ, dữ liệu, kiểm thử...).
const BLOCKED_TOP = new Set(['server', 'tests', 'tools', 'evaluation', 'streamlit_app', 'docs', 'node_modules', 'package.json', 'package-lock.json', 'firebase.database.rules.json']);
const CLIENT_EVENT_TYPES = INTERACTION_TYPES.filter((t) => t !== 'purchase'); // lượt mua chỉ ghi qua /api/orders
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DAY = 86400000;

function cleanText(value, max) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, max);
}
function maskName(name) {
    const n = cleanText(name, 60);
    if (n.length <= 2) return n ? n[0] + '*' : 'Khách hàng';
    return n[0] + '***' + n[n.length - 1];
}
function publicUser(u) { return u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null; }

function httpError(status, message, code) { const e = new Error(message); e.status = status; e.code = code; return e; }

function sendJson(res, status, body, extraHeaders) {
    const data = JSON.stringify(body);
    res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data) }, extraHeaders || {}));
    res.end(data);
}

function readJson(req, limit) {
    return new Promise((resolve, reject) => {
        const type = String(req.headers['content-type'] || '');
        if (!/application\/json/i.test(type)) return reject(httpError(415, 'Chỉ chấp nhận Content-Type: application/json'));
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > limit) { reject(httpError(413, 'Dữ liệu gửi lên quá lớn')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => {
            if (!chunks.length) return resolve({});
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                resolve(body && typeof body === 'object' ? body : {});
            } catch (_) { reject(httpError(400, 'JSON không hợp lệ')); }
        });
        req.on('error', reject);
    });
}

function validateQuiz(input) {
    if (!input || typeof input !== 'object') return null;
    const L = engine.LABELS;
    const pick = (arr, dict, max) => (Array.isArray(arr) ? arr : []).map(String).filter((x, i, a) => dict[x] && a.indexOf(x) === i).slice(0, max);
    const quiz = {
        gender: ['men', 'women', 'kids'].includes(input.gender) ? input.gender : undefined,
        styles: pick(input.styles, L.style, 3),
        colors: pick(input.colors, L.color, 3),
        types: pick(input.types, L.type, 4),
        budget: engine.PRICE_TIERS.includes(input.budget) ? input.budget : undefined
    };
    const empty = !quiz.gender && !quiz.styles.length && !quiz.colors.length && !quiz.types.length && !quiz.budget;
    return empty ? null : quiz;
}

function createApp(ctx) {
    const { store, catalog, service, config } = ctx;
    const root = path.resolve(config.staticRoot);
    const limiter = new RateLimiter();
    const corsOrigins = new Set(config.corsOrigins || []);

    const clientIp = (req) => {
        if (config.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
        return req.socket.remoteAddress || 'unknown';
    };
    const rate = (req, bucket, limit, windowMs, key) => {
        const k = bucket + ':' + (key || clientIp(req));
        if (!limiter.allow(k, limit, windowMs)) {
            const e = httpError(429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau.', 'RATE_LIMITED');
            e.retryAfter = limiter.retryAfter(k);
            throw e;
        }
    };
    const currentUser = (req) => {
        const header = String(req.headers.authorization || '');
        if (!header.startsWith('Bearer ')) return null;
        const payload = auth.verifyToken(header.slice(7).trim(), config.tokenSecret);
        if (!payload) return { invalid: true };
        const user = store.getUserById(payload.sub);
        if (!user || user.isDemo) return { invalid: true };
        return user;
    };
    const requireUser = (req) => {
        const u = currentUser(req);
        if (!u || u.invalid) throw httpError(401, 'Bạn cần đăng nhập (token không hợp lệ hoặc đã hết hạn).', 'UNAUTHORIZED');
        return u;
    };
    const optionalUser = (req) => { const u = currentUser(req); return u && !u.invalid ? u : null; };
    const productOr404 = (id) => {
        if (!PRODUCT_ID_RE.test(String(id || '')) || !catalog[id]) throw httpError(404, 'Không tìm thấy sản phẩm.', 'PRODUCT_NOT_FOUND');
        return id;
    };
    const issueToken = (user) => auth.signToken({ sub: user.id, role: user.role }, config.tokenSecret, config.tokenTtlSeconds);

    /* ---------------------- Các route API ---------------------- */
    const routes = [];
    const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

    route('GET', /^\/api\/health$/, () => ({ ok: true, service: 'stylehub-api', version: VERSION, store: store.kind, time: new Date().toISOString() }));

    route('POST', /^\/api\/auth\/register$/, async (req) => {
        rate(req, 'register', 10, 60 * 60000);
        const body = await readJson(req, 8 * 1024);
        const email = auth.normalizeEmail(body.email);
        const password = String(body.password || '');
        const name = cleanText(body.name, 80) || email.split('@')[0];
        if (!auth.isValidEmail(email)) throw httpError(400, 'Email không hợp lệ.', 'INVALID_EMAIL');
        if (password.length < 6 || password.length > 128) throw httpError(400, 'Mật khẩu phải có từ 6 đến 128 ký tự.', 'INVALID_PASSWORD');
        if (store.getUserByEmail(email)) throw httpError(409, 'Email này đã được đăng ký.', 'EMAIL_EXISTS');
        let user;
        try { user = store.createUser({ email, name, passwordHash: auth.hashPassword(password), role: 'customer' }); } catch (e) {
            if (/UNIQUE/i.test(String(e.message))) throw httpError(409, 'Email này đã được đăng ký.', 'EMAIL_EXISTS');
            throw e;
        }
        return { status: 201, body: { ok: true, token: issueToken(user), user: publicUser(user) } };
    });

    route('POST', /^\/api\/auth\/login$/, async (req) => {
        rate(req, 'login', 10, 60000);
        const body = await readJson(req, 8 * 1024);
        const email = auth.normalizeEmail(body.email);
        rate(req, 'login-email', 10, 15 * 60000, email);
        const user = store.getUserByEmail(email);
        if (!user || user.isDemo || !auth.verifyPassword(String(body.password || ''), user.passwordHash)) {
            throw httpError(401, 'Email hoặc mật khẩu không đúng.', 'INVALID_CREDENTIALS');
        }
        return { ok: true, token: issueToken(user), user: publicUser(user) };
    });

    route('GET', /^\/api\/auth\/me$/, (req) => ({ ok: true, user: publicUser(requireUser(req)) }));

    route('POST', /^\/api\/events$/, async (req) => {
        const user = requireUser(req);
        rate(req, 'events', 240, 60000, 'u' + user.id);
        const body = await readJson(req, 64 * 1024);
        const list = Array.isArray(body.events) ? body.events : [body];
        if (list.length > 100) throw httpError(400, 'Tối đa 100 sự kiện mỗi lần gửi.');
        const now = Date.now();
        const accepted = [], rejected = [];
        const batchViews = new Map(); // chống trùng lượt xem cả trong cùng một lô gửi lên
        list.forEach((e, index) => {
            const productId = String((e && e.productId) || '');
            const type = String((e && e.type) || '');
            if (!PRODUCT_ID_RE.test(productId) || !catalog[productId]) return rejected.push({ index, reason: 'unknown_product' });
            if (!CLIENT_EVENT_TYPES.includes(type)) return rejected.push({ index, reason: 'invalid_type' });
            let value = e.value === undefined || e.value === null || e.value === '' ? undefined : Number(e.value);
            if (value !== undefined && !Number.isFinite(value)) return rejected.push({ index, reason: 'invalid_value' });
            if (type === 'rating' && (value === undefined || !Number.isInteger(value) || value < 0 || value > 5)) return rejected.push({ index, reason: 'invalid_rating' });
            if (type === 'cart') value = Math.max(1, Math.min(20, Math.round(value || 1)));
            if (type === 'wishlist') value = value === 0 ? 0 : 1;
            if (type === 'rec_impression' || type === 'rec_click') value = Math.max(0, Math.min(50, Math.round(value || 0)));
            let ts = Number(e.ts);
            if (!Number.isFinite(ts) || ts > now + 5 * 60000 || ts < now - 90 * DAY) ts = now;
            ts = Math.min(ts, now);
            if (type === 'view') {
                const last = Math.max(store.lastInteractionAt(user.id, productId, 'view'), batchViews.get(productId) || 0);
                if (last && Math.abs(ts - last) < 30000) return rejected.push({ index, reason: 'duplicate_view' });
                batchViews.set(productId, ts);
            }
            accepted.push({ userId: user.id, productId, type, value, context: cleanText(e.context, 60) || null, createdAt: ts });
        });
        if (accepted.length) {
            store.addInteractions(accepted);
            if (accepted.some((e) => e.type !== 'rec_impression' && e.type !== 'rec_click')) service.markDirty();
        }
        return { ok: true, accepted: accepted.length, rejected };
    });

    route('POST', /^\/api\/orders$/, async (req) => {
        const user = requireUser(req);
        rate(req, 'orders', 20, 60 * 60000, 'u' + user.id);
        const body = await readJson(req, 32 * 1024);
        const orderId = String(body.orderId || '');
        if (!ORDER_ID_RE.test(orderId)) throw httpError(400, 'Mã đơn hàng không hợp lệ.');
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map((it) => ({
            productId: String((it && (it.productId || it.key || it.id)) || ''),
            quantity: Math.max(1, Math.min(20, Math.round(Number(it && (it.quantity || it.qty)) || 1))),
            size: cleanText(it && it.size, 12),
            price: Math.max(0, Math.min(1e10, Math.round(Number(it && (it.price || it.priceNum)) || 0)))
        })).filter((it) => PRODUCT_ID_RE.test(it.productId) && catalog[it.productId]);
        if (!items.length) throw httpError(400, 'Đơn hàng không có sản phẩm hợp lệ.');
        const total = Math.max(0, Math.min(1e12, Math.round(Number(body.total) || items.reduce((s, it) => s + it.price * it.quantity, 0))));
        const result = store.createOrder({ id: orderId, userId: user.id, total, items, createdAt: Date.now() });
        if (!result.created && !result.sameOwner) throw httpError(409, 'Mã đơn hàng đã tồn tại.');
        service.markDirty();
        return { status: result.created ? 201 : 200, body: { ok: true, created: result.created, items: items.length } };
    });

    route('GET', /^\/api\/recommendations$/, (req, url) => {
        rate(req, 'recs', 240, 60000);
        const user = optionalUser(req);
        const q = url.searchParams;
        const context = q.get('context') === 'product' ? 'product' : 'home';
        const productId = context === 'product' ? productOr404(q.get('productId')) : undefined;
        const limit = Math.max(1, Math.min(24, Number(q.get('limit')) || 8));
        let quiz = null;
        if (q.get('quiz')) { try { quiz = validateQuiz(JSON.parse(q.get('quiz').slice(0, 1500))); } catch (_) { quiz = null; } }
        if (!quiz && user) quiz = store.getQuiz(user.id);
        const recent = String(q.get('recent') || '').split(',').slice(0, 10).map((part) => {
            const [id, ts] = part.split(':');
            return catalog[id] ? { item: id, ts: Number(ts) || Date.now() } : null;
        }).filter(Boolean);
        const exclude = String(q.get('exclude') || '').split(',').filter((id) => catalog[id]).slice(0, 200);
        // strategy=social: CHỈ User-based CF — "khách có gu giống bạn đã mua / đánh giá cao" (đúng yêu cầu đề tài).
        const social = q.get('strategy') === 'social';
        let items = service.recommend(user ? user.id : null, {
            context, productId, limit, quiz: quiz || undefined, recent: recent.length ? recent : undefined, exclude,
            diversify: social ? false : q.get('diversify') !== '0', weights: social ? { ucf: 1 } : undefined, excludeInteracted: social
        });
        if (social) items = items.filter((x) => x.explanation && x.explanation.type === 'ucf');
        const st = service.stats();
        return { ok: true, source: 'server', personalized: !!user, context, strategy: social ? 'social' : 'hybrid', items, meta: { activeUsers: st.activeUsers, interactions: st.interactions, communityConfidence: st.communityConfidence, mfTrained: st.mfTrained } };
    });

    route('GET', /^\/api\/recommendations\/outfit$/, (req, url) => {
        rate(req, 'recs', 240, 60000);
        const user = optionalUser(req);
        const productId = productOr404(url.searchParams.get('productId'));
        const per = Math.max(1, Math.min(3, Number(url.searchParams.get('perCategory')) || 1));
        return { ok: true, productId, items: service.outfit(productId, user ? user.id : null, per) };
    });

    // Công khai: chỉ số đếm theo sản phẩm (bán chạy / đánh giá cao) cho chatbot và trang chủ — không có thông tin cá nhân.
    route('GET', /^\/api\/products\/popular$/, (req, url) => {
        rate(req, 'recs', 240, 60000);
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 200));
        return { ok: true, source: 'server', items: service.popularStats(limit), meta: { activeUsers: service.stats().activeUsers } };
    });

    route('GET', /^\/api\/products\/([A-Za-z0-9_-]{1,80})\/reviews$/, (req, url, m) => {
        const productId = productOr404(m[1]);
        const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 10));
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        const viewer = optionalUser(req);
        const reviews = store.listReviews(productId, limit, offset).map((r) => ({
            id: r.id, rating: r.rating, comment: r.comment, sentiment: r.sentiment, sentimentLabel: r.sentimentLabel,
            verifiedPurchase: r.verifiedPurchase, createdAt: r.createdAt, updatedAt: r.updatedAt,
            author: maskName(r.userName), isDemo: r.isDemo, mine: !!viewer && viewer.id === r.userId
        }));
        return {
            ok: true, productId, stats: store.reviewStats(productId), reviews,
            canReview: viewer ? store.hasPurchased(viewer.id, productId) : false,
            myReview: viewer ? store.getReview(viewer.id, productId) : null
        };
    });

    route('POST', /^\/api\/products\/([A-Za-z0-9_-]{1,80})\/reviews$/, async (req, url, m) => {
        const user = requireUser(req);
        const productId = productOr404(m[1]);
        rate(req, 'reviews', 10, 60 * 60000, 'u' + user.id);
        const body = await readJson(req, 8 * 1024);
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5.', 'INVALID_RATING');
        const comment = cleanText(body.comment, 1000);
        if (!store.hasPurchased(user.id, productId)) throw httpError(403, 'Chỉ khách đã mua sản phẩm này mới có thể đánh giá.', 'NOT_PURCHASED');
        const s = comment ? sentiment.analyze(comment) : { score: null, label: 'neutral' };
        const review = store.upsertReview({ userId: user.id, productId, rating, comment, sentiment: s.score, sentimentLabel: s.label, verified: true });
        service.markDirty();
        return { status: 201, body: { ok: true, review: Object.assign({}, review, { author: maskName(review.userName), userName: undefined }) } };
    });

    route('DELETE', /^\/api\/products\/([A-Za-z0-9_-]{1,80})\/reviews$/, (req, url, m) => {
        const user = requireUser(req);
        const productId = productOr404(m[1]);
        const deleted = store.deleteReview(user.id, productId);
        service.markDirty();
        return { ok: true, deleted };
    });

    route('GET', /^\/api\/profile\/style-dna$/, (req) => {
        const user = requireUser(req);
        const quiz = store.getQuiz(user.id);
        return { ok: true, quiz, dna: service.styleDNA(user.id, quiz) };
    });

    route('PUT', /^\/api\/profile\/quiz$/, async (req) => {
        const user = requireUser(req);
        const body = await readJson(req, 4 * 1024);
        const quiz = validateQuiz(body.quiz || body);
        if (!quiz) throw httpError(400, 'Câu trả lời quiz không hợp lệ.', 'INVALID_QUIZ');
        store.saveQuiz(user.id, quiz);
        service.markDirty();
        return { ok: true, quiz };
    });

    route('DELETE', /^\/api\/profile\/history$/, (req) => {
        const user = requireUser(req);
        const deleted = store.deleteHistory(user.id);
        service.markDirty();
        return { ok: true, deleted };
    });

    route('GET', /^\/api\/admin\/stats$/, (req) => {
        const user = requireUser(req);
        if (user.role !== 'admin') throw httpError(403, 'Chỉ quản trị viên được xem thống kê.', 'FORBIDDEN');
        return { ok: true, store: store.kind, stats: store.stats(), model: service.stats(), topProducts: service.topPopular(10), evaluation: readEvaluation(true) };
    });

    route('GET', /^\/api\/admin\/evaluation$/, (req) => {
        const user = requireUser(req);
        if (user.role !== 'admin') throw httpError(403, 'Chỉ quản trị viên được xem kết quả thực nghiệm.', 'FORBIDDEN');
        return { ok: true, evaluation: readEvaluation(false) };
    });

    function readEvaluation(summaryOnly) {
        const file = path.join(root, 'evaluation', 'results', 'latest.json');
        if (!fs.existsSync(file)) return null;
        try {
            const r = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!summaryOnly) return r;
            const main = {};
            Object.entries(r.main || {}).forEach(([name, m]) => { main[name] = { ndcg10: m.n10.mean, recall10: m.r10.mean, hr10: m.hr10.mean, coverage10: m.coverage10.mean, ild10: m.ild10.mean }; });
            return { generatedAt: r.generatedAt, dataKind: r.dataKind, config: r.config, main, significance: r.significance, defaultWeights: r.defaultWeights, coldWeights: r.coldWeights };
        } catch (_) { return null; }
    }

    /* ---------------------- Phục vụ file tĩnh ---------------------- */
    function serveStatic(req, res, pathname) {
        let rel;
        try { rel = decodeURIComponent(pathname); } catch (_) { return sendText(res, 400, 'Bad request'); }
        if (rel === '/' || rel === '') rel = '/index.html';
        const segments = rel.split('/').filter(Boolean);
        // Ngoại lệ duy nhất trong thư mục bị chặn: kết quả thực nghiệm tổng hợp (không chứa dữ liệu cá nhân).
        const isEvaluationResult = segments.length === 3 && segments[0] === 'evaluation' && segments[1] === 'results' && /^[a-z0-9-]+\.json$/.test(segments[2]);
        if (!segments.length || segments.some((s) => s.startsWith('.') || s.includes('\\') || s.includes('\0')) || (BLOCKED_TOP.has(segments[0]) && !isEvaluationResult)) return sendText(res, 404, 'Not found');
        const file = path.resolve(root, ...segments);
        if (!file.startsWith(root + path.sep)) return sendText(res, 404, 'Not found');
        const type = MIME[path.extname(file).toLowerCase()];
        if (!type) return sendText(res, 404, 'Not found');
        fs.stat(file, (err, st) => {
            if (err || !st.isFile()) return sendText(res, 404, 'Not found');
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
            if (req.method === 'HEAD') return res.end();
            fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
        });
    }
    function sendText(res, status, text) {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(text);
    }

    function setSecurityHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }
    function applyCors(req, res) {
        const origin = req.headers.origin;
        if (origin && corsOrigins.has(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Max-Age', '600');
        }
    }

    async function handle(req, res) {
        setSecurityHeaders(res);
        let url;
        try { url = new URL(req.url, 'http://localhost'); } catch (_) { return sendText(res, 400, 'Bad request'); }
        if (url.pathname.startsWith('/api/')) {
            applyCors(req, res);
            if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
            try {
                const matched = routes.filter((r) => r.pattern.test(url.pathname));
                if (!matched.length) throw httpError(404, 'Không tìm thấy API.', 'NOT_FOUND');
                const r = matched.find((x) => x.method === req.method);
                if (!r) throw httpError(405, 'Phương thức không được hỗ trợ.', 'METHOD_NOT_ALLOWED');
                const result = await r.handler(req, url, url.pathname.match(r.pattern));
                if (result && result.status && result.body) return sendJson(res, result.status, result.body);
                return sendJson(res, 200, result);
            } catch (e) {
                const status = e.status || 500;
                if (status >= 500 && !ctx.silent) console.error('[api]', e);
                return sendJson(res, status, { ok: false, code: e.code || (status >= 500 ? 'SERVER_ERROR' : 'ERROR'), message: status >= 500 ? 'Lỗi máy chủ, vui lòng thử lại.' : e.message },
                    e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : undefined);
            }
        }
        if (!config.serveStatic) return sendText(res, 404, 'Not found');
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
        return serveStatic(req, res, url.pathname);
    }

    handle.close = () => limiter.stop();
    return handle;
}

module.exports = { createApp, validateQuiz, maskName, cleanText, VERSION };
