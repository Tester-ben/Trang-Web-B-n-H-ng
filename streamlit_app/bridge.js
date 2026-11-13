#!/usr/bin/env node
/* =============================================================================
   Cầu nối Python (Streamlit) <-> hệ gợi ý của website.
   Ứng dụng Streamlit (streamlit_app/app.py) gửi MỘT yêu cầu JSON qua stdin và nhận
   MỘT kết quả JSON qua stdout. Mọi gợi ý được tính bằng CHÍNH recommender/engine.js
   mà website và thực nghiệm offline dùng, nên kết quả khớp với web và báo cáo.

   Yêu cầu:
     { "cmd": "bootstrap", "source": {...} }                 danh mục, khách hàng, thống kê
     { "cmd": "user", "source": {...}, "userId": "...", "limit": 8 }
     { "cmd": "quiz", "source": {...}, "quiz": {...}, "limit": 8 }
     { "cmd": "product", "source": {...}, "productId": "...", "limit": 8 }
     { "cmd": "sentiment", "text": "...", "stars": 4 }
   source = { "kind": "sim", "users": 300, "seed": 7 }      dữ liệu mô phỏng (evaluation/simulate.js)
          | { "kind": "server" }                            dữ liệu thật của backend (server/data)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const engine = require(path.join(ROOT, 'recommender', 'engine'));
const sentiment = require(path.join(ROOT, 'recommender', 'sentiment-vi'));
const { loadCatalog, loadAttributes } = require(path.join(ROOT, 'recommender', 'load-catalog'));

const NEW_CUSTOMER = '__khach_moi__';
const DEPARTMENT_LABELS = { mens: 'Nam', womens: 'Nữ', kids: 'Trẻ em', shoes: 'Giày', sale: 'Sale' };

function departmentOf(id) {
    const key = String(id).toLowerCase();
    if (key.startsWith('womens')) return 'womens';
    if (key.startsWith('kids')) return 'kids';
    if (key.startsWith('shoe')) return 'shoes';
    if (key.startsWith('sale')) return 'sale';
    return 'mens';
}

function serverDataFile() {
    const dir = process.env.STYLEHUB_DATA_DIR || path.join(ROOT, 'server', 'data');
    for (const name of ['stylehub.db', 'stylehub.json']) {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) return file;
    }
    return null;
}

/** Nạp danh mục + sự kiện theo nguồn dữ liệu và dựng mô hình (có tính tất định). */
function buildContext(source) {
    const catalog = loadCatalog(ROOT);
    const attributes = loadAttributes(ROOT);
    const kind = source && source.kind === 'server' ? 'server' : 'sim';
    let events = [], users = [], now = Date.now(), info;
    if (kind === 'server') {
        const file = serverDataFile();
        if (!file) throw new Error('Chưa có dữ liệu máy chủ (server/data/stylehub.db). Hãy chạy "npm start" và dùng website, hoặc "npm run seed:demo" để tạo dữ liệu demo.');
        const { exportEvents } = require(path.join(ROOT, 'server', 'db'));
        events = exportEvents(file).filter((e) => catalog[e.item] && Number.isFinite(e.ts)).sort((a, b) => a.ts - b.ts);
        if (!events.length) throw new Error('Dữ liệu máy chủ chưa có lượt tương tác nào.');
        now = events[events.length - 1].ts + 1;
        const byUser = new Map();
        for (const e of events) {
            const u = byUser.get(e.user) || { id: String(e.user), demo: !!e.demo };
            byUser.set(e.user, u);
        }
        users = Array.from(byUser.values());
        const rel = path.relative(ROOT, file);
        info = { kind, label: 'Dữ liệu từ máy chủ của website', file: rel.startsWith('..') ? file : rel, demoUsers: users.filter((u) => u.demo).length };
    } else {
        const { simulate } = require(path.join(ROOT, 'evaluation', 'simulate'));
        const nUsers = Math.max(20, Math.min(1000, Number(source && source.users) || 300));
        const seed = Math.max(1, Math.floor(Number(source && source.seed) || 7));
        const sim = simulate({ catalog, attributes, seed, nUsers });
        events = sim.events;
        now = sim.now;
        users = sim.users.map((u) => ({ id: u.id, gender: u.gender, cluster: u.cluster, quiz: u.quiz }));
        info = { kind, label: 'Dữ liệu mô phỏng', users: nUsers, seed, days: sim.meta.days, rho: sim.meta.rho };
    }
    const model = engine.createModel({ catalog, attributes, events, now });
    return { catalog, attributes, events, users, now, model, info };
}

function catalogRows(ctx) {
    return Object.keys(ctx.catalog).map((id) => {
        const p = ctx.catalog[id];
        const a = ctx.model.attributes[id] || {};
        const images = Array.isArray(p.images) ? p.images : [];
        const dept = departmentOf(id);
        return {
            id, name: p.name || id, brand: p.brand || a.brand || '', price: p.price || '', priceNum: Number(p.priceNum) || 0,
            image: p.mainImg || images[0] || '', imageAlt: images[1] || '',
            department: dept, departmentLabel: DEPARTMENT_LABELS[dept],
            gender: a.gender, category: a.category, type: a.type, colors: a.colors || [], styles: a.styles || [], priceTier: a.priceTier
        };
    });
}

function formatRecs(list) {
    return list.map((r) => ({
        id: r.id, score: r.score, reason: r.reason,
        type: r.explanation ? r.explanation.type : 'explore',
        shares: r.explanation ? r.explanation.shares || {} : {},
        evidence: r.explanation ? r.explanation.evidence || {} : {}
    }));
}

function countsByUser(events) {
    const counts = new Map();
    for (const e of events) {
        const c = counts.get(e.user) || { view: 0, cart: 0, wishlist: 0, purchase: 0, rating: 0 };
        if (c[e.type] !== undefined) c[e.type] += 1;
        else if (e.type === 'review') c.rating += 1;
        counts.set(e.user, c);
    }
    return counts;
}

const handlers = {
    bootstrap(req) {
        const ctx = buildContext(req.source);
        const counts = countsByUser(ctx.events);
        return {
            source: ctx.info,
            engineVersion: engine.VERSION,
            stats: ctx.model.stats(),
            weights: engine.DEFAULTS.weights,
            labels: { gender: engine.LABELS.gender, category: engine.LABELS.category, type: engine.LABELS.type, color: engine.LABELS.color, style: engine.LABELS.style, price: engine.LABELS.price },
            priceTiers: engine.PRICE_TIERS,
            personas: engine.PERSONA,
            catalog: catalogRows(ctx),
            users: ctx.users.map((u) => Object.assign({}, u, { counts: counts.get(u.id) || {} })),
            events: ctx.events.length
        };
    },

    user(req) {
        const ctx = buildContext(req.source);
        const userId = String(req.userId || '');
        const limit = Math.max(1, Math.min(24, Number(req.limit) || 8));
        const history = ctx.events.filter((e) => String(e.user) === userId)
            .sort((a, b) => b.ts - a.ts).slice(0, 40)
            .map((e) => ({ item: e.item, type: e.type, value: e.value === undefined ? null : e.value, text: e.text || null, sentiment: e.sentiment === undefined ? null : e.sentiment, ts: e.ts }));
        const neighbors = ctx.model.userNeighbors(userId).slice(0, 8).map((n) => ({ user: n.user, sim: Number(n.sim.toFixed(4)), common: n.common }));
        return {
            userId,
            dna: ctx.model.styleDNA(userId),
            history,
            neighbors,
            recommendations: formatRecs(ctx.model.recommend(userId, { limit, context: 'home' }))
        };
    },

    quiz(req) {
        const ctx = buildContext(req.source);
        const limit = Math.max(1, Math.min(24, Number(req.limit) || 8));
        const quiz = req.quiz || {};
        return {
            dna: ctx.model.styleDNA(NEW_CUSTOMER, quiz),
            recommendations: formatRecs(ctx.model.recommend(NEW_CUSTOMER, { limit, context: 'home', quiz }))
        };
    },

    product(req) {
        const ctx = buildContext(req.source);
        const productId = String(req.productId || '');
        if (!Object.prototype.hasOwnProperty.call(ctx.catalog, productId)) throw new Error('Không có sản phẩm ' + productId);
        const limit = Math.max(1, Math.min(24, Number(req.limit) || 8));
        const viewer = req.userId ? String(req.userId) : NEW_CUSTOMER;
        return {
            productId,
            similar: formatRecs(ctx.model.recommend(viewer, { limit, context: 'product', productId })),
            outfit: ctx.model.outfit(productId, req.userId ? viewer : null, { perCategory: 2 })
        };
    },

    sentiment(req) {
        const result = sentiment.analyze(String(req.text || ''));
        const stars = Number(req.stars);
        const mix = engine.DEFAULTS.sentimentMix;
        return {
            score: result.score, label: result.label, labelVi: sentiment.labelVi ? sentiment.labelVi(result.label) : result.label,
            matches: result.matches || [], mix,
            stars: Number.isFinite(stars) ? stars : null,
            effective: Number.isFinite(stars) ? engine.effectiveRating(stars, result.score, mix) : null
        };
    }
};

function main() {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => {
        let out;
        try {
            const req = JSON.parse(input || '{}');
            const handler = handlers[req.cmd];
            if (!handler) throw new Error('Lệnh không hợp lệ: ' + req.cmd);
            out = { ok: true, data: handler(req) };
        } catch (error) {
            out = { ok: false, error: error && error.message ? error.message : String(error) };
        }
        process.stdout.write(JSON.stringify(out));
    });
}

if (require.main === module) main();
module.exports = { handlers, buildContext };
