#!/usr/bin/env node
/* =============================================================================
   Tạo DỮ LIỆU DEMO (mô phỏng) để trình diễn Collaborative Filtering khi website
   chưa có đủ khách hàng thật:   npm run seed:demo  [-- --users=150 --reset]
   - Tài khoản demo có is_demo = 1, email @demo.stylehub.local, KHÔNG đăng nhập được.
   - Mọi lời giải thích dựa hoàn toàn trên người dùng demo đều ghi "(dữ liệu demo)".
   - Xóa toàn bộ dữ liệu demo:   npm run seed:demo -- --reset --users=0
   Hành vi sinh bởi evaluation/simulate.js (cùng bộ mô phỏng dùng trong thực nghiệm).
   ========================================================================== */
'use strict';
const { openStore } = require('./db');
const { loadConfig } = require('./server');
const auth = require('./auth');
const { simulate } = require('../evaluation/simulate');
const { loadCatalog, loadAttributes } = require('../recommender/load-catalog');
const sentiment = require('../recommender/sentiment-vi');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
}));
const nUsers = args.users === undefined ? 150 : Math.max(0, Math.min(2000, Number(args.users) || 0));
const config = loadConfig(process.env);
const store = openStore({ dataDir: config.dataDir, kind: config.storeKind });

try {
    if (args.reset) {
        const removed = store.deleteDemoData();
        console.log('Đã xóa ' + removed + ' tài khoản demo cùng dữ liệu liên quan.');
    } else if (store.demoUserIds().length) {
        console.log('Đã có dữ liệu demo. Dùng --reset để tạo lại.');
        process.exit(0);
    }
    if (nUsers > 0) {
        const catalog = loadCatalog();
        const sim = simulate({ catalog, attributes: loadAttributes(), seed: Number(args.seed) || 2026, nUsers, rho: 0.5 });
        const shift = Date.now() - 60000 - sim.now; // dời thời gian để sự kiện cuối cùng là "vừa xong"
        const hash = auth.unusablePasswordHash();   // không ai biết mật khẩu -> không đăng nhập được
        const idMap = new Map();
        sim.users.forEach((u, i) => {
            const user = store.createUser({ email: 'demo-' + String(i + 1).padStart(4, '0') + '@demo.stylehub.local', name: 'Khách demo ' + (i + 1), passwordHash: hash, role: 'customer', isDemo: true, createdAt: sim.start + shift });
            idMap.set(u.id, user.id);
            if (i % 2 === 0) store.saveQuiz(user.id, u.quiz);
        });
        const interactions = [];
        let orders = 0, reviews = 0;
        sim.events.forEach((e) => {
            const userId = idMap.get(e.user);
            const ts = Math.round(e.ts + shift);
            if (e.type === 'purchase') {
                store.createOrder({ id: 'DEMO-' + userId + '-' + (++orders), userId, total: Number(catalog[e.item].priceNum) || 0, items: [{ productId: e.item, quantity: 1, size: '', price: Number(catalog[e.item].priceNum) || 0 }], createdAt: ts, status: 'completed' });
            } else if (e.type === 'rating' && e.text) {
                const s = sentiment.analyze(e.text);
                store.upsertReview({ userId, productId: e.item, rating: e.value, comment: e.text, sentiment: s.score, sentimentLabel: s.label, verified: true, createdAt: ts, updatedAt: ts });
                reviews++;
            } else {
                interactions.push({ userId, productId: e.item, type: e.type, value: e.value, context: 'demo', createdAt: ts });
            }
        });
        store.addInteractions(interactions);
        console.log('Đã tạo ' + nUsers + ' người dùng demo, ' + interactions.length + ' tương tác, ' + orders + ' đơn mua, ' + reviews + ' đánh giá (lưu trữ: ' + store.kind + ').');
    }
} finally {
    store.close();
}
