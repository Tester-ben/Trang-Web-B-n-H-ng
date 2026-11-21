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
        await page.waitForSelector('#shPersonalGrid .rk-hit');
        // Sào treo đồ: lý do gợi ý của từng món nằm trong nhãn trợ năng (và hiện khi rê chuột / mở chi tiết).
        const reasons = await page.$$eval('#shPersonalGrid .rk-hit', (x) => x.map((e) => e.getAttribute('aria-label')));
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

test('E2E: khu giày trang chủ dạng vòng cung — lấy giày từ danh mục, xoay bằng bánh xe/phím, bấm mở trang sản phẩm', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.goto(site.url + '/index.html', { waitUntil: 'load' });
        await page.waitForSelector('[data-shoes-orbit].is-ready .sh-orbit-shoe');
        const shoes = await page.$$eval('.sh-orbit-shoe', (els) => els.map((a) => a.getAttribute('href')));
        assert.ok(shoes.length >= 10 && shoes.every((h) => /^product-detail\.html\?id=shoe-\d+$/.test(h)), shoes.join(','));
        assert.equal(await page.$$eval('[data-shoes-orbit] .stylehub-wishlist-btn, [data-shoes-orbit] .stylehub-stock-badge', (els) => els.length), 0, 'không bị gắn nút tim / nhãn kho chồng lên');
        assert.equal(await page.textContent('[data-orbit-count]'), '02 / ' + String(shoes.length).padStart(2, '0'));
        await page.focus('[data-orbit-wheel]');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(800);
        assert.equal(await page.textContent('[data-orbit-count]'), '03 / ' + String(shoes.length).padStart(2, '0'));
        assert.equal(await page.getAttribute('[data-orbit-link]', 'href'), 'product-detail.html?id=shoe-3');
        assert.equal(await page.getAttribute('[data-orbit-sizes] a[data-size="42"]', 'href'), 'product-detail.html?id=shoe-3&size=42');
        await page.click('[data-orbit-sizes] a[data-size="42"]');
        await page.waitForURL(/product-detail\.html\?id=shoe-3&size=42/);
        await page.waitForSelector('.shoe-number-size');
        assert.equal(await page.$eval('.shoe-number-size.selected', (b) => b.dataset.size), '42', 'trang sản phẩm chọn sẵn size đã bấm');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await site.close();
    }
});

test('E2E: "Được chọn cho bạn" là sào treo 10 món do hệ gợi ý trả về — xem chi tiết, chọn size, thêm vào BAG, đóng bằng Esc', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.goto(site.url + '/product-detail.html?id=hoodies-3', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await page.goto(site.url + '/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#shPersonalGrid .rk-item');
        const items = await page.$$eval('#shPersonalGrid .rk-hit', (els) => els.map((e) => ({ id: e.dataset.recId, rank: e.dataset.recRank, ctx: e.dataset.recContext, label: e.getAttribute('aria-label') })));
        assert.equal(items.length, 10, 'sào treo 10 món');
        assert.equal(new Set(items.map((x) => x.id)).size, 10, 'không trùng sản phẩm');
        assert.deepEqual(items.map((x) => x.rank), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'vẫn ghi thứ hạng để đo lượt bấm');
        assert.ok(items.every((x) => /^home:/.test(x.ctx)));
        const recIds = await page.evaluate(() => window.StyleHubRecommendations.recommendHome(10).map((r) => r.id));
        assert.deepEqual(items.slice(0, recIds.length).map((x) => x.id), recIds, 'đúng danh sách và thứ tự của hệ gợi ý');
        assert.ok(items.some((x) => /Vì bạn vừa xem|Hợp phong cách|khách hàng/.test(x.label)), 'có lý do gợi ý: ' + items.map((x) => x.label).join(' | '));

        await page.click('#shPersonalGrid .rk-hit >> nth=0');
        await page.waitForSelector('.rk-focus:not([hidden])');
        assert.equal(await page.textContent('#rkFocusName'), await page.evaluate((id) => database[id].name, items[0].id));
        assert.equal(await page.getAttribute('.rk-focus', 'role'), 'dialog');
        await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('rk-focus-close'));
        assert.match(await page.getAttribute('.rk-focus .rk-btn-ghost', 'href'), new RegExp('product-detail\\.html\\?id=' + items[0].id));
        // bấm vào tên sản phẩm hoặc vào món đồ trong khung chi tiết cũng sang trang sản phẩm
        assert.match(await page.getAttribute('.rk-focus-namelink', 'href'), new RegExp('product-detail\\.html\\?id=' + items[0].id));
        assert.match(await page.getAttribute('.rk-focus-golink', 'href'), new RegExp('product-detail\\.html\\?id=' + items[0].id));
        if (await page.isDisabled('.rk-focus .rk-btn-primary')) await page.click('.rk-focus .rk-size >> nth=2');
        await page.click('.rk-focus .rk-btn-primary');
        assert.match(await page.textContent('.rk-focus-msg'), /Đã thêm vào BAG/);
        assert.equal((await page.textContent('#cart-count')).trim(), '1');
        assert.equal(await page.evaluate(() => { const it = window.StyleHubCartSync.read()[0]; return it.key || it.id; }), items[0].id);

        await page.keyboard.press('Escape');
        await page.waitForSelector('.rk-focus', { state: 'hidden' });
        await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('rk-hit'));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});

test('E2E: sào bỏ qua ảnh người mẫu để treo ảnh sản phẩm, món không có ảnh treo được hoặc link ảnh hỏng nhường chỗ cho gợi ý kế tiếp', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.setContent('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' + site.url + '/stylehub-rack.css">'
            + '<div id="host"></div><script src="' + site.url + '/product-data.js"></script><script src="' + site.url + '/stylehub-rack.js"></script>');
        await page.waitForFunction(() => window.StyleHubRack && typeof database !== 'undefined');
        await page.evaluate((siteUrl) => {
            // Ảnh thử: áo trên nền trơn (treo được), nửa chiếc áo (ảnh tách hỏng: lệch hẳn), ảnh người mẫu (nền không trơn).
            const mk = (draw) => { const c = document.createElement('canvas'); c.width = 300; c.height = 380; const g = c.getContext('2d'); g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 300, 380); draw(g); return c.toDataURL('image/png'); };
            const poly = (g, pts, color) => { g.fillStyle = color; g.beginPath(); pts.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]))); g.closePath(); g.fill(); };
            const tee = (color) => mk((g) => poly(g, [[95, 60], [205, 60], [265, 110], [240, 150], [215, 135], [215, 330], [85, 330], [85, 135], [60, 150], [35, 110]], color));
            const half = mk((g) => poly(g, [[150, 60], [205, 60], [265, 110], [240, 150], [215, 135], [215, 330], [150, 330]], '#2b2b2b'));
            const photo = mk((g) => { for (let y = 0; y < 380; y += 4) for (let x = 0; x < 300; x += 4) { g.fillStyle = 'rgb(' + ((x * 7 + y * 3) % 200) + ',' + ((x * 5 + y * 11) % 180) + ',' + ((x * 13 + y * 2) % 160) + ')'; g.fillRect(x, y, 4, 4); } });
            const entry = (id, imgs) => ({ id, product: Object.assign({}, database[id], { mainImg: imgs[0], images: imgs }), rec: { reason: 'Hợp phong cách của bạn' } });
            window.StyleHubRack.render(document.getElementById('host'), [
                entry('hoodies-8', [photo, tee('#2b2b2b')]),   // ảnh đầu là ảnh người mẫu -> treo ảnh thứ 2
                entry('dress-1', [half, photo]),               // không ảnh nào treo được -> nhường chỗ
                entry('tops-3', [siteUrl + '/admin.html']),    // "ảnh" là một trang web (như sản phẩm admin nhập nhầm link) -> nhường chỗ
                entry('tops-1', [tee('#3a3f46')]),
                entry('tops-5', [tee('#5b4a3a')]),             // món dự phòng (gợi ý kế tiếp)
                entry('tops-7', [tee('#4a5a3a')])
            ], { limit: 4 });
        }, site.url);
        await page.waitForFunction(() => document.querySelectorAll('#host .rk-item').length === 4 && !document.querySelector('#host .rk-item.is-loading')
            && [...document.querySelectorAll('#host .rk-hit')].every((h) => !['dress-1', 'tops-3'].includes(h.dataset.recId)), null, { timeout: 30000 });
        const shown = await page.$$eval('#host .rk-item', (els) => els.map((n) => ({ id: n.querySelector('.rk-hit').dataset.recId, rank: n.querySelector('.rk-hit').dataset.recRank, img: n.dataset.img, cut: n.classList.contains('is-cut') })));
        assert.deepEqual(shown.map((x) => x.id), ['hoodies-8', 'tops-1', 'tops-5', 'tops-7'], 'món không treo được bị thay bằng món kế tiếp, thứ tự giữ nguyên');
        assert.deepEqual(shown.map((x) => x.rank), ['0', '1', '2', '3']);
        assert.ok(shown.every((x) => x.cut), 'tất cả là đồ đã tách nền, không còn tấm ảnh');
        assert.equal(shown[0].img, '2', 'bỏ qua ảnh người mẫu, treo ảnh sản phẩm thứ 2');

        await page.click('#host .rk-hit >> nth=0');
        await page.waitForSelector('.rk-focus:not([hidden])');
        assert.match(await page.getAttribute('.rk-focus-namelink', 'href'), /product-detail\.html\?id=hoodies-8/);
        assert.match(await page.getAttribute('.rk-focus-golink', 'href'), /product-detail\.html\?id=hoodies-8/);
        assert.equal(await page.$eval('.rk-face-front', (f) => f.classList.contains('is-photo')), false, 'khung chi tiết dùng đúng ảnh sản phẩm đang treo');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});

test('E2E: Admin xóa sản phẩm tự thêm (link ảnh hỏng) -> không còn trên trang danh mục và trong danh mục sản phẩm', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        const junk = { key: 'custom-mens-messi', name: 'messi', brand: 'Essentials', priceNum: 10000, price: '10.000 ₫', mainImg: site.url + '/admin.html', images: [site.url + '/admin.html'],
            adminDepartment: 'mens', department: 'mens', category: 'tops', type: 'tops', createdByAdmin: true, createdAt: 1 };
        await page.goto(site.url + '/admin.html', { waitUntil: 'load' });
        await page.evaluate((p) => { localStorage.setItem('stylehub_admin_products_v1', JSON.stringify({ [p.key]: p })); }, junk);
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(800);
        await page.fill('#adminPassword', 'admin123');
        await page.click('#adminLoginButton');
        await page.waitForSelector('.admin-nav-btn[data-tab="products"]', { state: 'visible' });
        await page.click('.admin-nav-btn[data-tab="products"]');
        await page.fill('#productSearchInput', 'custom-mens-messi');
        await page.waitForSelector('#productsGrid .stock-btn.delete');
        assert.equal(await page.$$eval('#productsGrid .product-admin-card', (c) => c.length), 1);
        // sản phẩm có sẵn của shop không có nút Xóa
        await page.fill('#productSearchInput', 'dress-7');
        assert.equal(await page.$$eval('#productsGrid .stock-btn.delete', (b) => b.length), 0);

        await page.fill('#productSearchInput', 'custom-mens-messi');
        await page.click('#productsGrid .stock-btn.delete');
        await page.click('#adminConfirmAccept');
        await page.waitForFunction(() => !document.querySelector('#productsGrid .product-admin-card'));
        const stored = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem('stylehub_admin_products_v1'))['custom-mens-messi'], inv: JSON.parse(localStorage.getItem('stylehub_inventory_v1') || '{}')['custom-mens-messi'] }));
        assert.equal(stored.p.deleted, true, 'đánh dấu đã xóa (không xóa hẳn để bản lưu cũ ở trình duyệt khác không đẩy lại lên)');
        assert.equal(stored.inv.outOfStock, true);

        await page.goto(site.url + '/mens.html', { waitUntil: 'load' });
        await page.waitForTimeout(800);
        assert.equal(await page.evaluate(() => Object.prototype.hasOwnProperty.call(database, 'custom-mens-messi')), false);
        assert.equal(await page.$$eval('a[href*="custom-mens-messi"], [data-product-id="custom-mens-messi"]', (els) => els.length), 0, 'không còn thẻ sản phẩm trên trang Mens');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});

test('E2E: tách nền sào treo — bỏ bóng đổ/viền sáng quanh áo tối, không gặm mép áo sáng, loại áo trắng trên nền trắng', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.setContent('<!doctype html><meta charset="utf-8"><script src="' + site.url + '/stylehub-rack.js"></script>');
        await page.waitForFunction(() => window.StyleHubRack && window.StyleHubRack._cutout);
        const r = await page.evaluate(async () => {
            const W = 300, H = 380, BG = 245;
            const POLY = [[95, 60], [205, 60], [265, 110], [240, 150], [215, 135], [215, 330], [85, 330], [85, 135], [60, 150], [35, 110]];
            let seed = 7;
            const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
            const path = (g, dx, dy) => { g.beginPath(); POLY.forEach((pt, i) => (i ? g.lineTo(pt[0] + dx, pt[1] + dy) : g.moveTo(pt[0] + dx, pt[1] + dy))); g.closePath(); };
            const base = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = 'rgb(' + BG + ',' + BG + ',' + BG + ')'; g.fillRect(0, 0, W, H); return { c, g }; };
            // vải có vân: mỗi điểm trong áo lấy độ sáng = f(x) + nhiễu
            const textured = (lum) => {
                const { c, g } = base();
                const m = document.createElement('canvas'); m.width = W; m.height = H; const mg = m.getContext('2d'); mg.fillStyle = '#000'; path(mg, 0, 0); mg.fill();
                const mk = mg.getImageData(0, 0, W, H).data, img = g.getImageData(0, 0, W, H), d = img.data;
                for (let i = 0; i < W * H; i++) if (mk[i * 4 + 3] > 127) { const v = Math.round(lum(i % W) + (rand() - 0.5) * 8); d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v - 2; }
                g.putImageData(img, 0, 0);
                return c;
            };
            const cut = (c) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(window.StyleHubRack._cutout(im, 640)); im.src = c.toDataURL('image/png'); });

            // 1) áo tối + bóng đổ mềm, rộng, lệch phải-dưới + viền sáng 1 px quanh áo (ảnh shop hay có)
            const dark = base();
            dark.g.save(); dark.g.filter = 'blur(7px)'; dark.g.fillStyle = 'rgb(205,205,205)'; path(dark.g, 9, 5); dark.g.fill(); dark.g.restore();
            dark.g.fillStyle = '#222'; path(dark.g, 0, 0); dark.g.fill();
            dark.g.strokeStyle = '#fbfbfb'; dark.g.lineWidth = 1.5; path(dark.g, 0, 0); dark.g.stroke();
            const a = await cut(dark.c);
            // 2) áo xám sáng có vân: nửa trái được chiếu sáng, chỉ chênh nền 3–9 mức
            const b = await cut(textured((x) => (x < 150 ? 239 : 229)));
            // 3) áo trắng trên nền trắng
            const c = await cut(textured(() => 243));
            const pick = (res) => (res.canvas ? { w: res.w, h: res.h, sym: res.q.sym, fill: res.q.fill, contrast: res.q.contrast } : { photo: true });
            return { dark: pick(a), light: pick(b), white: pick(c) };
        });
        // áo thật rộng 231 px, cao 271 px
        assert.ok(r.dark.w <= 236 && r.dark.h <= 276, 'bóng đổ bên phải không bị tính là áo: ' + JSON.stringify(r.dark));
        assert.ok(r.dark.sym >= 0.95, 'áo tối giữ đối xứng: ' + JSON.stringify(r.dark));
        assert.ok(r.light.w >= 226 && r.light.sym >= 0.9, 'mép áo sáng phía được chiếu sáng không bị gặm: ' + JSON.stringify(r.light));
        assert.ok(r.white.photo || r.white.contrast < 10, 'áo trắng trên nền trắng bị nhận ra (không treo): ' + JSON.stringify(r.white));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});

test('E2E: sào tự thử lại ảnh lỗi thoáng qua, món không tải được ảnh nào bị gỡ (không còn thẻ chỉ có chữ)', { skip, timeout: 120000 }, async () => {
    const site = await staticServer();
    const browser = await playwright.chromium.launch();
    try {
        const { page, errors } = await newPage(browser);
        await page.setContent('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' + site.url + '/stylehub-rack.css">'
            + '<div id="host"></div><script src="' + site.url + '/product-data.js"></script><script src="' + site.url + '/stylehub-rack.js"></script>');
        await page.waitForFunction(() => window.StyleHubRack && typeof database !== 'undefined');
        const teePng = await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 300; c.height = 380; const g = c.getContext('2d');
            g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 300, 380); g.fillStyle = '#2b2b2b'; g.beginPath();
            [[95, 60], [205, 60], [265, 110], [240, 150], [215, 135], [215, 330], [85, 330], [85, 135], [60, 150], [35, 110]].forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
            g.closePath(); g.fill(); return c.toDataURL('image/png');
        });
        let flakyHits = 0;
        // ảnh "chập chờn": lần đầu lỗi kết nối, lần sau tải được (như CDN chặn tạm khi tải nhiều ảnh)
        await page.route('**/__flaky.png*', (route) => {
            flakyHits++;
            if (flakyHits === 1) return route.abort('connectionreset');
            return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(teePng.split(',')[1], 'base64') });
        });
        await page.evaluate(({ siteUrl, teePng }) => {
            const entry = (id, imgs) => ({ id, product: Object.assign({}, database[id], { mainImg: imgs[0], images: imgs }), rec: { reason: 'Hợp phong cách của bạn' } });
            const list = [entry('hoodies-8', [siteUrl + '/__flaky.png']), entry('dress-1', [siteUrl + '/__missing-image.png'])];
            ['tops-1', 'tops-5', 'tops-7', 'tops-9', 'tops-11', 'tops-12'].forEach((id) => list.push(entry(id, [teePng])));
            window.StyleHubRack.render(document.getElementById('host'), list, { limit: 8 });
        }, { siteUrl: site.url, teePng });
        await page.waitForFunction(() => !document.querySelector('#host .rk-item.is-loading') && !document.querySelector('#host .rk-photo-name')
            && document.querySelectorAll('#host .rk-item').length === 7, null, { timeout: 30000 });
        const shown = await page.$$eval('#host .rk-item', (els) => els.map((n) => ({ id: n.querySelector('.rk-hit').dataset.recId, cut: n.classList.contains('is-cut') })));
        assert.equal(shown[0].id, 'hoodies-8');
        assert.ok(shown[0].cut, 'ảnh lỗi thoáng qua được tải lại và treo bình thường');
        assert.ok(flakyHits >= 2);
        assert.ok(!shown.some((x) => x.id === 'dress-1'), 'món không tải được ảnh nào bị gỡ khỏi sào');
        assert.ok(shown.every((x) => x.cut), 'không còn thẻ chỉ có chữ / tấm ảnh');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); await site.close(); }
});
