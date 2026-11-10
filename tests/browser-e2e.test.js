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

test('E2E: món đã ngừng kinh doanh (dress-8) bị gỡ khỏi BAG cũ, giỏ đặt lại và lịch sử chat; link cũ báo không còn bán', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        const stale = { key: 'dress-8', name: 'The Weekend Minimalist Urban Shirt', price: '580.000 ₫', priceNum: 580000, size: 'M', qty: 1 };
        const kept = { key: 'dress-7', name: 'Món vẫn đang bán', price: '590.000 ₫', priceNum: 590000, size: 'L', qty: 1 };
        await page.goto(site.url + '/mens.html', { waitUntil: 'domcontentloaded' });
        await page.evaluate(([oldItem, okItem]) => {
            const cart = JSON.stringify([oldItem, okItem]);
            ['stylehub_cart_memory_v1', 'stylehub_cart', 'hub_cart', 'cartMemoryArray', 'the_style_hub_cart', 'cart'].forEach((k) => localStorage.setItem(k, cart));
            const card = (id) => '<div class="tsh-ai-product-list"><div class="tsh-ai-product-card"><a class="tsh-ai-product-name" href="product-detail.html?id=' + id + '">' + id +
                '</a><button class="tsh-ai-product-cart" type="button" data-product-id="' + id + '">🛒</button></div></div>';
            localStorage.setItem('tsh_ai_pro_messages', JSON.stringify([{ who: 'bot', html: 'Gợi ý:' + card('dress-8') + card('dress-7'), meta: 'Stylist AI 10:00' }]));
        }, [stale, kept]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);

        assert.deepEqual(await page.evaluate(() => window.StyleHubCartSync.read().map((i) => i.key)), ['dress-7'], 'BAG chỉ còn món đang bán');
        const stored = await page.evaluate(() => ['stylehub_cart_memory_v1', 'cart'].map((k) => localStorage.getItem(k) || ''));
        assert.ok(stored.every((v) => v.includes('dress-7') && !v.includes('dress-8')), 'giỏ lưu trong trình duyệt đã được dọn: ' + stored.join(' | '));
        assert.deepEqual(await page.$$eval('#tshAiBody .tsh-ai-product-card [data-product-id]', (els) => els.map((e) => e.dataset.productId)), ['dress-7'],
            'lịch sử chat không còn thẻ của món đã gỡ');
        assert.equal(await page.$$eval('#tshAiBody .tsh-ai-discontinued-note', (els) => els.length), 1, 'thẻ đã gỡ được thay bằng ghi chú "không còn bán"');

        // Giỏ "Đặt lại đơn này" còn sót từ trước khi gỡ: món đã gỡ bị bỏ qua.
        await page.evaluate((oldItem) => localStorage.setItem('stylehub_reorder_cart', JSON.stringify([oldItem,
            { key: 'dress-9', name: 'Món đặt lại', price: '490.000 ₫', priceNum: 490000, size: 'M', qty: 1 }])), stale);
        await page.goto(site.url + '/product-detail.html?id=dress-9&reorder=1', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        assert.deepEqual(await page.evaluate(() => (window.cartMemoryArray || []).map((i) => i.key)), ['dress-9']);

        // Giỏ đặt lại chỉ toàn món đã gỡ: KHÔNG được làm trống giỏ hiện tại của khách.
        await page.evaluate(([oldItem, okItem]) => {
            ['stylehub_cart_memory_v1', 'stylehub_cart', 'hub_cart', 'cartMemoryArray', 'the_style_hub_cart', 'cart'].forEach((k) => localStorage.setItem(k, JSON.stringify([okItem])));
            localStorage.setItem('stylehub_reorder_cart', JSON.stringify([oldItem]));
        }, [stale, kept]);
        await page.goto(site.url + '/product-detail.html?id=tops-1', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        assert.deepEqual(await page.evaluate(() => (window.cartMemoryArray || []).map((i) => i.key)), ['dress-7']);
        assert.equal(await page.evaluate(() => localStorage.getItem('stylehub_reorder_cart')), null);

        // Link cũ tới món đã gỡ (và id trùng thuộc tính của Object): thông báo cho khách, không còn nút mua.
        for (const id of ['dress-8', 'constructor']) {
            await page.goto(site.url + '/product-detail.html?id=' + id, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(600);
            assert.equal((await page.textContent('#product-name-target')).trim(), 'Sản phẩm hiện không còn bán', id);
            assert.equal(await page.isVisible('.btn-add-to-bag'), false, id);
            assert.equal(await page.isVisible('.size-selector-section'), false, id);
        }

        // Sản phẩm admin (custom-*) đến muộn từ Firebase: hiện "đang tải", rồi tự hiển thị khi dữ liệu về.
        await page.goto(site.url + '/product-detail.html?id=custom-mens-late-tee', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        assert.equal((await page.textContent('#product-name-target')).trim(), 'Đang tải sản phẩm…');
        await Promise.all([
            page.waitForEvent('load'),
            page.evaluate(() => {
                localStorage.setItem('stylehub_admin_products_v1', JSON.stringify({ 'custom-mens-late-tee': {
                    name: 'Late Admin Tee', brand: 'Essentials', price: '450.000 ₫', priceNum: 450000, adminDepartment: 'mens',
                    mainImg: 'https://cdn.example.com/late-1.jpg', images: ['https://cdn.example.com/late-1.jpg', 'https://cdn.example.com/late-2.jpg']
                } }));
                window.dispatchEvent(new CustomEvent('stylehub-products-change'));
            })
        ]);
        await page.waitForTimeout(600);
        assert.equal((await page.textContent('#product-name-target')).trim(), 'Late Admin Tee');
        assert.equal(await page.isVisible('.btn-add-to-bag'), true);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await site.close();
    }
});

test('E2E: đặt hàng từ BAG rồi bấm hoàn tất (pháo hoa) không gây lỗi JS', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        for (const pageName of ['mens.html', 'index.html']) {
            const { ctx, page, errors } = await newPage(browser);
            await page.goto(site.url + '/' + pageName, { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => {
                const cart = JSON.stringify([{ key: 'dress-7', name: 'Món thử', price: '590.000 ₫', priceNum: 590000, size: 'M', qty: 1 }]);
                ['stylehub_cart_memory_v1', 'stylehub_cart', 'hub_cart', 'cartMemoryArray', 'the_style_hub_cart', 'cart'].forEach((k) => localStorage.setItem(k, cart));
            });
            await page.reload({ waitUntil: 'load' });
            await page.waitForTimeout(1000); // chờ các script khởi tạo trang chạy xong (có script tự đóng BAG lúc tải)
            await page.evaluate(() => window.StyleHubCartSync.openBag());
            await page.waitForSelector('#bag-modal .stylehub-universal-checkout', { state: 'visible' });
            await page.waitForTimeout(400);
            await page.click('#bag-modal .stylehub-universal-checkout');
            await page.waitForSelector('#stylehubCheckoutName', { state: 'visible' });
            await page.fill('#stylehubCheckoutName', 'Khach Thu');
            await page.fill('#stylehubCheckoutPhone', '0900000000');
            await page.fill('#stylehubCheckoutAddress', '1 Duong Thu, Quan 1, TP HCM');
            await page.fill('#stylehubCheckoutEmail', 'khach.thu@example.com');
            await page.click('#bag-modal .stylehub-checkout-submit');
            await page.waitForSelector('#bag-modal .stylehub-checkout-done', { state: 'visible' });
            await page.waitForTimeout(300);
            await page.click('#bag-modal .stylehub-checkout-done');
            await page.waitForTimeout(5000); // pháo hoa chạy hết
            assert.deepEqual(errors, [], pageName);
            await ctx.close();
        }
    } finally {
        await browser.close();
        await site.close();
    }
});

test('E2E: trang Admin có mục Hệ gợi ý (Streamlit), báo rõ khi ứng dụng chưa chạy và chỉ nhận địa chỉ http(s)', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.goto(site.url + '/admin.html', { waitUntil: 'load' });
        // Cổng 9 luôn đóng: kiểm thử không phụ thuộc việc máy đang chạy Streamlit hay không.
        await page.evaluate(() => localStorage.setItem('stylehub_streamlit_url', 'http://127.0.0.1:9'));
        await page.waitForTimeout(1200);
        await page.fill('#adminPassword', 'admin123');
        await page.click('#adminLoginButton');
        await page.waitForSelector('.admin-nav-btn[data-tab="streamlit"]', { state: 'visible' });
        await page.click('.admin-nav-btn[data-tab="streamlit"]');
        await page.waitForFunction(() => document.getElementById('streamlitStatusChip').textContent === 'Không kết nối được', null, { timeout: 15000 });
        assert.equal(await page.$eval('#streamlitFrame', (f) => f.hidden), true);
        assert.match(await page.textContent('#streamlitEmpty'), /streamlit run streamlit_app\/app\.py/);

        await page.fill('#streamlitUrlInput', 'javascript:alert(1)');
        await page.click('text=Lưu & tải lại');
        assert.equal(await page.evaluate(() => localStorage.getItem('stylehub_streamlit_url')), 'http://127.0.0.1:9', 'địa chỉ không phải http(s) bị từ chối');

        await page.fill('#streamlitUrlInput', 'http://127.0.0.1:9/ung-dung/');
        await page.click('text=Lưu & tải lại');
        assert.equal(await page.evaluate(() => localStorage.getItem('stylehub_streamlit_url')), 'http://127.0.0.1:9/ung-dung');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await site.close();
    }
});
