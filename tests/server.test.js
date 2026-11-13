'use strict';
/* Kiểm thử tích hợp REST API (chạy trên cả SQLite và JSON) — node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { start, loadConfig, ensureAdmin } = require('../server/server');

const STORES = ['sqlite', 'json'];

async function boot(kind, extra) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylehub-test-'));
    const config = Object.assign(loadConfig({}), { port: 0, host: '127.0.0.1', dataDir, storeKind: kind, tokenSecret: 'test-secret-' + kind, corsOrigins: ['http://localhost:5500'] }, extra || {});
    // communityKappa = 0: tắt giảm trọng số CF theo quy mô cộng đồng để kiểm thử với vài người dùng.
    const s = await start(config, { silent: true, serviceOptions: { minRebuildMs: 0, engineOptions: { communityKappa: 0, mf: { enabled: false } } } });
    const api = async (method, url, body, token, headers) => {
        const res = await fetch(s.url + url, {
            method,
            headers: Object.assign({}, body !== undefined ? { 'Content-Type': 'application/json' } : {}, token ? { Authorization: 'Bearer ' + token } : {}, headers || {}),
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (_) { /* không phải JSON */ }
        return { status: res.status, body: json, text, headers: res.headers };
    };
    return { s, api, dataDir, config, close: async () => { await s.close(); fs.rmSync(dataDir, { recursive: true, force: true }); } };
}

for (const kind of STORES) {
    test(`[${kind}] health, phục vụ file tĩnh và chặn truy cập mã máy chủ`, async () => {
        const t = await boot(kind);
        try {
            const h = await t.api('GET', '/api/health');
            assert.equal(h.status, 200);
            assert.equal(h.body.ok, true);
            assert.equal(h.body.store, kind);
            const index = await t.api('GET', '/');
            assert.equal(index.status, 200);
            assert.match(index.text, /<html/i);
            assert.equal(index.headers.get('x-content-type-options'), 'nosniff');
            assert.equal((await t.api('GET', '/recommender/engine.js')).status, 200);
            for (const blocked of ['/server/db.js', '/server/data/.token-secret', '/.git/config', '/tests/server.test.js', '/package.json', '/%2e%2e/package.json', '/evaluation/run-evaluation.js', '/streamlit_app/app.py', '/.streamlit/config.toml']) {
                assert.equal((await t.api('GET', blocked)).status, 404, blocked);
            }
            assert.equal((await t.api('GET', '/api/khong-ton-tai')).status, 404);
        } finally { await t.close(); }
    });

    test(`[${kind}] đăng ký / đăng nhập / token`, async () => {
        const t = await boot(kind);
        try {
            const reg = await t.api('POST', '/api/auth/register', { email: 'An@Example.com', password: 'secret123', name: 'An' });
            assert.equal(reg.status, 201);
            assert.ok(reg.body.token);
            assert.equal(reg.body.user.email, 'an@example.com');
            assert.equal(reg.body.user.passwordHash, undefined, 'không bao giờ trả hash mật khẩu');
            assert.equal((await t.api('POST', '/api/auth/register', { email: 'an@example.com', password: 'secret123' })).status, 409);
            assert.equal((await t.api('POST', '/api/auth/register', { email: 'not-an-email', password: 'secret123' })).status, 400);
            assert.equal((await t.api('POST', '/api/auth/register', { email: 'b@example.com', password: '123' })).status, 400);
            assert.equal((await t.api('POST', '/api/auth/login', { email: 'an@example.com', password: 'sai-mat-khau' })).status, 401);
            const login = await t.api('POST', '/api/auth/login', { email: 'an@example.com', password: 'secret123' });
            assert.equal(login.status, 200);
            const me = await t.api('GET', '/api/auth/me', undefined, login.body.token);
            assert.equal(me.body.user.role, 'customer');
            assert.equal((await t.api('GET', '/api/auth/me', undefined, login.body.token + 'x')).status, 401);
            assert.equal((await t.api('POST', '/api/auth/login', 'không phải object')).status, 401, 'body không phải object -> coi như rỗng');
            const raw = await fetch(t.s.url + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
            assert.equal(raw.status, 415, 'chỉ nhận JSON');
        } finally { await t.close(); }
    });

    test(`[${kind}] CF đa thiết bị: người dùng tương tự được gợi ý sản phẩm người kia đã mua / đánh giá cao`, async () => {
        const t = await boot(kind);
        try {
            const A = (await t.api('POST', '/api/auth/register', { email: 'a@test.vn', password: 'secret123', name: 'A' })).body.token;
            const B = (await t.api('POST', '/api/auth/register', { email: 'b@test.vn', password: 'secret123', name: 'B' })).body.token;
            const C = (await t.api('POST', '/api/auth/register', { email: 'c@test.vn', password: 'secret123', name: 'C' })).body.token;
            const now = Date.now();
            // B (thiết bị 2): xem + mua bộ đồ thể thao, chấm 5 sao "hợp gu" cho một mẫu khác.
            await t.api('POST', '/api/events', { events: ['hoodies-1', 'hoodies-7', 'bottoms-8'].map((id, i) => ({ productId: id, type: 'view', ts: now - 5000 * (i + 1) })) }, B);
            await t.api('POST', '/api/orders', { orderId: 'B-001', items: [{ productId: 'hoodies-1' }, { productId: 'hoodies-7' }, { productId: 'bottoms-8' }] }, B);
            await t.api('POST', '/api/events', { events: [{ productId: 'shoe-14', type: 'rating', value: 5 }] }, B);
            // C: gu công sở, khác hẳn.
            await t.api('POST', '/api/orders', { orderId: 'C-001', items: [{ productId: 'dress-2' }, { productId: 'dress-5' }] }, C);
            // A (thiết bị 1): xem/yêu thích 2 mẫu giống B.
            const ev = await t.api('POST', '/api/events', { events: [
                { productId: 'hoodies-1', type: 'view' }, { productId: 'hoodies-7', type: 'view' },
                { productId: 'hoodies-1', type: 'wishlist', value: 1 }, { productId: 'hoodies-7', type: 'cart', value: 1 },
                { productId: 'tops-1', type: 'view' },
                { productId: 'khong-ton-tai', type: 'view' }, { productId: 'tops-2', type: 'purchase' }, { productId: 'hoodies-1', type: 'view' }
            ] }, A);
            assert.equal(ev.body.accepted, 5);
            assert.deepEqual(ev.body.rejected.map((r) => r.reason).sort(), ['duplicate_view', 'invalid_type', 'unknown_product']);
            const recs = await t.api('GET', '/api/recommendations?context=home&limit=12&diversify=0', undefined, A);
            assert.equal(recs.status, 200);
            assert.equal(recs.body.personalized, true);
            const ids = recs.body.items.map((x) => x.id);
            const bought = recs.body.items.find((x) => x.id === 'bottoms-8');
            assert.ok(bought, 'sản phẩm B đã mua phải được gợi ý cho A: ' + ids.join(','));
            const loved = recs.body.items.find((x) => x.id === 'shoe-14');
            assert.ok(loved, 'sản phẩm B chấm 5 sao phải được gợi ý cho A');
            assert.ok(recs.body.items.some((x) => x.explanation.type === 'ucf' && /khách hàng cùng phong cách/.test(x.reason)), JSON.stringify(recs.body.items.map((x) => x.reason)));
            assert.ok(ids.indexOf('bottoms-8') < (ids.indexOf('dress-2') < 0 ? 99 : ids.indexOf('dress-2')), 'đồ của người có gu khác (C) xếp sau');
            const social = await t.api('GET', '/api/recommendations?context=home&strategy=social&limit=8', undefined, A);
            assert.equal(social.body.strategy, 'social');
            assert.ok(social.body.items.length >= 2);
            assert.ok(social.body.items.every((x) => x.explanation.type === 'ucf' && /khách hàng cùng phong cách/.test(x.reason)));
            assert.ok(social.body.items.some((x) => x.id === 'bottoms-8') && social.body.items.some((x) => x.id === 'shoe-14'));
            assert.ok(!social.body.items.some((x) => x.id === 'dress-2'), 'không lấy đồ của người khác gu');
            assert.ok(!social.body.items.some((x) => ['hoodies-1', 'hoodies-7', 'tops-1'].includes(x.id)), 'không gợi ý lại sản phẩm A đã xem');
            // Khách chưa đăng nhập vẫn nhận gợi ý từ dữ liệu cộng đồng + sản phẩm vừa xem.
            const guest = await t.api('GET', '/api/recommendations?context=home&limit=4&recent=hoodies-9:' + (now - 1000));
            assert.equal(guest.body.personalized, false);
            assert.ok(guest.body.items.length > 0);
            const product = await t.api('GET', '/api/recommendations?context=product&productId=hoodies-1&limit=4');
            assert.ok(product.body.items.every((x) => x.id !== 'hoodies-1'));
            assert.equal((await t.api('GET', '/api/recommendations?context=product&productId=xyz')).status, 404);
            const outfit = await t.api('GET', '/api/recommendations/outfit?productId=hoodies-1', undefined, A);
            assert.deepEqual([...new Set(outfit.body.items.map((x) => x.category))].sort(), ['bottom', 'footwear']);
        } finally { await t.close(); }
    });

    test(`[${kind}] đánh giá sản phẩm: chỉ khách đã mua, có phân tích cảm xúc, chống chèn HTML`, async () => {
        const t = await boot(kind);
        try {
            const A = (await t.api('POST', '/api/auth/register', { email: 'rv@test.vn', password: 'secret123', name: 'Nguyễn Văn Bình' })).body.token;
            const denied = await t.api('POST', '/api/products/tops-11/reviews', { rating: 5, comment: 'Đẹp' }, A);
            assert.equal(denied.status, 403);
            assert.equal(denied.body.code, 'NOT_PURCHASED');
            assert.equal((await t.api('POST', '/api/orders', { orderId: 'ORD-1', items: [{ productId: 'tops-11', quantity: 1, size: 'L', price: 2150000 }] }, A)).status, 201);
            assert.equal((await t.api('POST', '/api/orders', { orderId: 'ORD-1', items: [{ productId: 'tops-11' }] }, A)).status, 200, 'gửi lại cùng mã đơn -> không nhân đôi');
            const posted = await t.api('POST', '/api/products/tops-11/reviews', { rating: 5, comment: '<img src=x onerror=alert(1)>Áo đẹp lắm, vải mềm' }, A);
            assert.equal(posted.status, 201);
            assert.equal(posted.body.review.comment, 'Áo đẹp lắm, vải mềm');
            assert.equal(posted.body.review.sentimentLabel, 'positive');
            assert.equal(posted.body.review.verifiedPurchase, true);
            assert.equal((await t.api('POST', '/api/products/tops-11/reviews', { rating: 9 }, A)).status, 400);
            const list = await t.api('GET', '/api/products/tops-11/reviews', undefined, A);
            assert.equal(list.body.stats.count, 1);
            assert.equal(list.body.stats.average, 5);
            assert.equal(list.body.reviews[0].author, 'N***h', 'ẩn danh tên người đánh giá');
            assert.equal(list.body.reviews[0].mine, true);
            assert.equal(list.body.canReview, true);
            const anon = await t.api('GET', '/api/products/tops-11/reviews');
            assert.equal(anon.body.reviews[0].mine, false);
            assert.equal((await t.api('DELETE', '/api/products/tops-11/reviews', undefined, A)).body.deleted, 1);
        } finally { await t.close(); }
    });

    test(`[${kind}] quiz Style DNA, xóa lịch sử, thống kê quản trị, CORS`, async () => {
        const t = await boot(kind);
        try {
            const A = (await t.api('POST', '/api/auth/register', { email: 'q@test.vn', password: 'secret123' })).body.token;
            assert.equal((await t.api('PUT', '/api/profile/quiz', { quiz: { gender: 'alien' } }, A)).status, 400);
            const quiz = await t.api('PUT', '/api/profile/quiz', { quiz: { gender: 'women', styles: ['minimal', 'xxx'], colors: ['black'], types: ['tee'], budget: 'mid' } }, A);
            assert.deepEqual(quiz.body.quiz.styles, ['minimal']);
            const dna = await t.api('GET', '/api/profile/style-dna', undefined, A);
            assert.equal(dna.body.dna.fromQuiz, true);
            assert.ok(dna.body.dna.persona);
            const recs = await t.api('GET', '/api/recommendations?context=home&limit=4', undefined, A);
            assert.ok(recs.body.items.length > 0);
            await t.api('POST', '/api/events', { events: [{ productId: 'womens-3', type: 'view' }] }, A);
            assert.ok((await t.api('DELETE', '/api/profile/history', undefined, A)).body.deleted >= 1);
            assert.equal((await t.api('GET', '/api/profile/style-dna', undefined, A)).body.quiz, null);
            assert.equal((await t.api('GET', '/api/admin/stats', undefined, A)).status, 403);
            ensureAdmin(t.s.store, 'admin@test.vn', 'AdminPass123');
            const admin = (await t.api('POST', '/api/auth/login', { email: 'admin@test.vn', password: 'AdminPass123' })).body;
            assert.equal(admin.user.role, 'admin');
            const stats = await t.api('GET', '/api/admin/stats', undefined, admin.token);
            assert.equal(stats.status, 200);
            assert.ok(stats.body.stats.users.total >= 2);
            assert.ok(stats.body.model.items > 150);
            const pre = await fetch(t.s.url + '/api/events', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5500', 'Access-Control-Request-Method': 'POST' } });
            assert.equal(pre.status, 204);
            assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5500');
            const evil = await fetch(t.s.url + '/api/health', { headers: { Origin: 'https://evil.example' } });
            assert.equal(evil.headers.get('access-control-allow-origin'), null);
        } finally { await t.close(); }
    });
}

test('[sqlite] giới hạn tần suất đăng nhập (chống dò mật khẩu)', async () => {
    const t = await boot('sqlite');
    try {
        let last;
        for (let i = 0; i < 11; i++) last = await t.api('POST', '/api/auth/login', { email: 'x@test.vn', password: 'sai' });
        assert.equal(last.status, 429);
        assert.ok(Number(last.headers.get('retry-after')) >= 1);
    } finally { await t.close(); }
});

test('[sqlite] dữ liệu demo: không đăng nhập được và được ghi rõ trong lời giải thích', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylehub-seed-'));
    try {
        const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'server', 'seed-demo.js'), '--users=40'], { env: Object.assign({}, process.env, { STYLEHUB_DATA_DIR: dataDir }), encoding: 'utf8' });
        assert.match(out, /Đã tạo 40 người dùng demo/);
        const t = await boot('sqlite', { dataDir });
        try {
            assert.equal((await t.api('POST', '/api/auth/login', { email: 'demo-0001@demo.stylehub.local', password: 'bất kỳ' })).status, 401);
            const A = (await t.api('POST', '/api/auth/register', { email: 'new@test.vn', password: 'secret123' })).body.token;
            await t.api('POST', '/api/events', { events: ['hoodies-1', 'hoodies-7', 'hoodies-9', 'tops-1'].map((id) => ({ productId: id, type: 'view' })) }, A);
            const recs = await t.api('GET', '/api/recommendations?context=home&limit=12', undefined, A);
            const social = recs.body.items.filter((x) => x.explanation.type === 'ucf');
            assert.ok(social.length > 0, 'có gợi ý cộng tác từ cộng đồng demo');
            assert.ok(social.every((x) => /dữ liệu demo/.test(x.reason)), 'bằng chứng chỉ từ người dùng demo phải được ghi rõ');
            const { exportEvents } = require('../server/db');
            const events = exportEvents(path.join(dataDir, 'stylehub.db'));
            assert.ok(events.some((e) => e.demo) && events.some((e) => !e.demo));
        } finally { await t.s.close(); }
    } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});
