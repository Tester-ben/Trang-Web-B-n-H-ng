'use strict';
/* =============================================================================
   Kiểm thử đầu-cuối (E2E) trên trình duyệt thật — cần Playwright + Chromium:
     npm i -D playwright && npx playwright install chromium
   Nếu máy chưa có Playwright, các test này tự BỎ QUA (không làm hỏng npm test).
   Mạng ngoài (ảnh fearofgod.com, Firebase, EmailJS) bị chặn để test ổn định, offline.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

let playwright = null;
try { playwright = require('playwright'); } catch (_) { playwright = null; }
const skip = playwright ? false : 'chưa cài Playwright (npm i -D playwright && npx playwright install chromium)';
const ROOT = path.resolve(__dirname, '..');

/** Máy chủ file tĩnh tối giản (mô phỏng Live Server — KHÔNG có backend). */
function staticServer() {
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((r) => server.close(r)) })));
}

async function newPage(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    return { ctx, page, errors };
}

test('E2E chế độ tĩnh: gợi ý cục bộ, phối đồ, đánh giá, quiz, không lỗi JS', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        for (const id of ['hoodies-3', 'hoodies-5', 'tops-22']) {
            await page.goto(site.url + '/product-detail.html?id=' + id, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(600);
        }
        const recs = await page.$$eval('#relatedProductsGrid .related-product-card', (cards) => cards.map((c) => c.querySelector('.sh-related-reason').textContent));
        assert.equal(recs.length, 4);
        assert.ok(recs.every((r) => r.length > 5));
        assert.equal(await page.$$eval('#shOutfitGrid .sh-outfit-card', (c) => c.length), 2, 'áo -> quần + giày');
        assert.ok(await page.$('#shReviewsSection .sh-review-gate'), 'chưa đăng nhập/mua thì không được đánh giá');
        await page.click('.sh-rating-star[data-stars="5"]');
        assert.match(await page.textContent('#stylehubRatingStatus'), /Đã lưu sở thích/);
        await page.goto(site.url + '/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const reasons = await page.$$eval('.sh-pick-reason', (x) => x.map((e) => e.textContent));
        assert.ok(reasons.some((r) => /Vì bạn vừa xem/.test(r)), 'trang chủ phản ánh sản phẩm vừa xem: ' + reasons.join(' | '));
        await page.evaluate(() => window.StyleHubStyleDNA.openQuiz());
        await page.click('.sh-quiz-chip:has-text("Nữ")');
        await page.click('.sh-quiz-chip:has-text("Tối giản")');
        await page.click('.sh-quiz-save');
        await page.waitForTimeout(800);
        assert.ok(await page.evaluate(() => !!localStorage.getItem('stylehub_style_quiz_v1_guest')));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});

test('E2E có máy chủ: đăng nhập liên kết tài khoản, gợi ý từ máy chủ, mua rồi đánh giá', { skip, timeout: 180000 }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylehub-e2e-'));
    execFileSync(process.execPath, [path.join(ROOT, 'server', 'seed-demo.js'), '--users=60'], { env: Object.assign({}, process.env, { STYLEHUB_DATA_DIR: dataDir }) });
    const { start, loadConfig } = require('../server/server');
    const srv = await start(Object.assign(loadConfig({}), { port: 0, dataDir, tokenSecret: 'e2e' }), { silent: true, serviceOptions: { minRebuildMs: 0 } });
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.goto(srv.url + '/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        assert.equal((await page.evaluate(() => window.StyleHubAuth.register({ firstName: 'Lan', lastName: 'Tran', email: 'lan@example.com', password: 'matkhau123' }))).ok, true);
        await page.waitForTimeout(500);
        assert.equal((await page.evaluate(() => window.StyleHubAuth.login('lan@example.com', 'matkhau123'))).ok, true);
        await page.waitForFunction(() => window.StyleHubApi.isConnected(), null, { timeout: 10000 });
        for (const id of ['hoodies-1', 'hoodies-7', 'hoodies-9']) {
            await page.goto(srv.url + '/product-detail.html?id=' + id, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(700);
        }
        await page.evaluate(() => window.StyleHubApi.flush());
        await page.waitForTimeout(800);
        await page.goto(srv.url + '/product-detail.html?id=hoodies-12', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const contexts = await page.$$eval('#relatedProductsGrid .related-product-card', (c) => c.map((x) => x.getAttribute('data-rec-context')));
        assert.ok(contexts.length === 4 && contexts.every((c) => c === 'product:server'), 'gợi ý lấy từ máy chủ: ' + contexts.join(','));
        await page.evaluate(() => {
            const order = { orderId: 'E2E' + Date.now(), status: 'Đang chờ xác nhận', orderedProductsList: [{ key: 'hoodies-12', qty: 1, size: 'L', priceNum: 4883000 }] };
            localStorage.setItem('hub_orders_lan@example.com', JSON.stringify([order]));
            window.StyleHubApi.recordOrder(order);
            return window.StyleHubApi.flush();
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.sh-review-form textarea', { timeout: 10000 });
        await page.click('.sh-review-star >> nth=4');
        await page.fill('.sh-review-form textarea', 'Áo đẹp lắm, vải dày dặn <b>mặc ấm</b>');
        await page.click('.sh-review-submit');
        await page.waitForSelector('.sh-review-text', { timeout: 10000 });
        const text = await page.textContent('.sh-review-text');
        assert.equal(text, 'Áo đẹp lắm, vải dày dặn mặc ấm', 'thẻ HTML bị loại bỏ');
        assert.match(await page.textContent('.sh-review .sh-sentiment'), /Tích cực/);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await srv.close();
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
