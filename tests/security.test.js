/* Kiểm thử bảo mật (node:test, không cần thư viện ngoài).
   Chạy: node --test tests/security.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodeCrypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'stylehub-crypto.js'));

const hex = (bytes) => Buffer.from(bytes).toString('hex');
const ascii = (text) => Uint8Array.from(Buffer.from(text, 'latin1'));
const NUL = String.fromCharCode(0);

/* ------------------------------------------------------------------ */
/* 1. SHA-256 / HMAC-SHA256 / PBKDF2 — vector chuẩn                      */
/* ------------------------------------------------------------------ */

test('SHA-256: vector chuẩn FIPS 180-2', () => {
    assert.equal(C.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(C.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(C.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    assert.equal(C.sha256Hex('a'.repeat(1000000)),
        'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

test('SHA-256: khớp node:crypto ở mọi biên khối (0..300 byte) và UTF-8', () => {
    for (let length = 0; length <= 300; length++) {
        const data = nodeCrypto.randomBytes(length);
        assert.equal(C.sha256Hex(Uint8Array.from(data)), nodeCrypto.createHash('sha256').update(data).digest('hex'), 'length ' + length);
    }
    const vietnamese = 'Áo thun đen nam — giá 450.000₫';
    assert.equal(C.sha256Hex(vietnamese), nodeCrypto.createHash('sha256').update(vietnamese, 'utf8').digest('hex'));
});

test('HMAC-SHA256: vector RFC 4231 (TC1, TC2, TC3, TC6, TC7)', () => {
    assert.equal(C.hmacSha256Hex(new Uint8Array(20).fill(0x0b), 'Hi There'),
        'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
    assert.equal(C.hmacSha256Hex('Jefe', 'what do ya want for nothing?'),
        '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    assert.equal(C.hmacSha256Hex(new Uint8Array(20).fill(0xaa), new Uint8Array(50).fill(0xdd)),
        '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe');
    assert.equal(C.hmacSha256Hex(new Uint8Array(131).fill(0xaa), 'Test Using Larger Than Block-Size Key - Hash Key First'),
        '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
    assert.equal(C.hmacSha256Hex(new Uint8Array(131).fill(0xaa),
        'This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.'),
        '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2');
});

test('HMAC-SHA256: khớp node:crypto với khóa/dữ liệu ngẫu nhiên', () => {
    for (let i = 0; i < 60; i++) {
        const key = nodeCrypto.randomBytes(i * 3 % 150);
        const data = nodeCrypto.randomBytes(i * 7 % 200);
        assert.equal(C.hmacSha256Hex(Uint8Array.from(key), Uint8Array.from(data)),
            nodeCrypto.createHmac('sha256', key).update(data).digest('hex'));
    }
});

test('PBKDF2-HMAC-SHA256: vector công bố (RFC 7914 §11 và bộ vector phổ biến)', () => {
    assert.equal(hex(C.pbkdf2Sha256('password', 'salt', 1, 32)), '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    assert.equal(hex(C.pbkdf2Sha256('password', 'salt', 2, 32)), 'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43');
    assert.equal(hex(C.pbkdf2Sha256('password', 'salt', 4096, 32)), 'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a');
    assert.equal(hex(C.pbkdf2Sha256('passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 4096, 40)),
        '348c89dbcbd32b2f32d814b8116e84cf2b17347ebc1800181c4e2a1fb8dd53e1c635518c7dac47e9');
    assert.equal(hex(C.pbkdf2Sha256(ascii('pass' + NUL + 'word'), ascii('sa' + NUL + 'lt'), 4096, 16)), '89b69d0516f829893c696226650a8687');
    // RFC 7914 §11
    assert.equal(hex(C.pbkdf2Sha256('passwd', 'salt', 1, 64)),
        '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783');
    assert.equal(hex(C.pbkdf2Sha256('Password', 'NaCl', 80000, 64)),
        '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d');
});

test('PBKDF2-HMAC-SHA256: khớp node:crypto.pbkdf2Sync (ngẫu nhiên, nhiều độ dài khóa)', () => {
    for (let i = 0; i < 12; i++) {
        const password = nodeCrypto.randomBytes(1 + i * 9);
        const salt = nodeCrypto.randomBytes(8 + i);
        const iterations = 1 + i * 37;
        const dkLen = 1 + (i * 13) % 80;
        assert.equal(hex(C.pbkdf2Sha256(Uint8Array.from(password), Uint8Array.from(salt), iterations, dkLen)),
            nodeCrypto.pbkdf2Sync(password, salt, iterations, dkLen, 'sha256').toString('hex'));
    }
});

/* ------------------------------------------------------------------ */
/* 2. hashPassword / verifyPassword                                     */
/* ------------------------------------------------------------------ */

test('hashPassword: định dạng, salt ngẫu nhiên, verify đúng/sai, chống chuỗi giả mạo', () => {
    const started = process.hrtime.bigint();
    const stored = C.hashPassword('Mật khẩu bí mật 123');
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.match(stored, /^pbkdf2-sha256\$60000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(C.DEFAULT_ITERATIONS, 60000);
    assert.ok(elapsedMs < 1000, 'băm mặc định phải nhanh (đo được ' + elapsedMs.toFixed(1) + ' ms)');
    console.log('  hashPassword(60000 vòng) mất ' + elapsedMs.toFixed(1) + ' ms trên Node ' + process.version);

    assert.equal(C.verifyPassword('Mật khẩu bí mật 123', stored), true);
    assert.equal(C.verifyPassword('mật khẩu bí mật 123', stored), false);
    assert.equal(C.verifyPassword('', stored), false);
    assert.notEqual(C.hashPassword('Mật khẩu bí mật 123'), stored, 'salt phải khác nhau');

    // Kết quả trùng với pbkdf2Sync của Node cho cùng salt/vòng lặp.
    const [, iterations, saltHex, hashHex] = stored.split('$');
    assert.equal(nodeCrypto.pbkdf2Sync(Buffer.from('Mật khẩu bí mật 123', 'utf8'), Buffer.from(saltHex, 'hex'), Number(iterations), 32, 'sha256').toString('hex'), hashHex);

    // Chuỗi bị sửa / sai định dạng / số vòng lặp vô lý đều bị từ chối.
    assert.equal(C.verifyPassword('Mật khẩu bí mật 123', stored.slice(0, -1) + (stored.endsWith('0') ? '1' : '0')), false);
    assert.equal(C.verifyPassword('x', 'plaintext-password'), false);
    assert.equal(C.verifyPassword('x', 'pbkdf2-sha256$1$00$' + '0'.repeat(64)), false);
    assert.equal(C.isPasswordHash(stored), true);
    assert.equal(C.isPasswordHash('pbkdf2-sha256$999999999$' + 'ab'.repeat(16) + '$' + '0'.repeat(64)), false);

    // Cho phép đổi số vòng lặp mà vẫn verify được các hash cũ.
    const fast = C.hashPassword('abc123', { iterations: 1000, saltHex: '00112233445566778899aabbccddeeff' });
    assert.equal(fast, 'pbkdf2-sha256$1000$00112233445566778899aabbccddeeff$' + nodeCrypto.pbkdf2Sync('abc123', Buffer.from('00112233445566778899aabbccddeeff', 'hex'), 1000, 32, 'sha256').toString('hex'));
    assert.equal(C.verifyPassword('abc123', fast), true);
});

test('timingSafeEqualStrings', () => {
    assert.equal(C.timingSafeEqualStrings('abc', 'abc'), true);
    assert.equal(C.timingSafeEqualStrings('abc', 'abd'), false);
    assert.equal(C.timingSafeEqualStrings('abc', 'abcd'), false);
    assert.equal(C.timingSafeEqualStrings('', ''), true);
});

/* ------------------------------------------------------------------ */
/* 3. Nâng cấp tài khoản cũ (hàm thuần)                                 */
/* ------------------------------------------------------------------ */

const fastHash = (pw) => C.hashPassword(pw, { iterations: 1000 });

test('migrateAccounts: băm mật khẩu dạng chữ, giữ nguyên tài khoản đã băm, bỏ khóa nguy hiểm', () => {
    const hashed = fastHash('daBam123');
    const legacy = JSON.parse('{"__proto__": {"polluted": true}, "old@x.com": {"email": "old@x.com", "password": "matkhau1", "name": "Old"}, "new@x.com": {"email": "new@x.com", "passwordHash": "' + hashed + '", "name": "New"}}');
    const { accounts, changed } = C.migrateAccounts(legacy, fastHash);
    assert.equal(changed, true);
    assert.equal(Object.prototype.hasOwnProperty.call(accounts, '__proto__'), false);
    assert.equal(({}).polluted, undefined);
    assert.equal(accounts['old@x.com'].password, undefined);
    assert.equal(C.verifyPassword('matkhau1', accounts['old@x.com'].passwordHash), true);
    assert.equal(accounts['old@x.com'].name, 'Old');
    assert.equal(accounts['new@x.com'].passwordHash, hashed);

    const again = C.migrateAccounts(accounts, fastHash);
    assert.equal(again.changed, false, 'chạy lần 2 không thay đổi gì');
    assert.equal(JSON.stringify(again.accounts).includes('matkhau1'), false);
});

test('checkAccountPassword: tài khoản cũ được nâng cấp khi đăng nhập đúng, sai mật khẩu thì không', () => {
    const legacy = { email: 'a@x.com', password: 'secret77', name: 'A' };
    const wrong = C.checkAccountPassword(legacy, 'secret78', fastHash);
    assert.deepEqual([wrong.ok, wrong.upgraded], [false, false]);

    const right = C.checkAccountPassword(legacy, 'secret77', fastHash);
    assert.equal(right.ok, true);
    assert.equal(right.upgraded, true);
    assert.equal(right.account.password, undefined);
    assert.equal(C.verifyPassword('secret77', right.account.passwordHash), true);

    const hashedAccount = { email: 'b@x.com', passwordHash: fastHash('pw-b-123'), password: 'pw-b-123' };
    const cleaned = C.checkAccountPassword(hashedAccount, 'pw-b-123', fastHash);
    assert.equal(cleaned.ok, true);
    assert.equal(cleaned.upgraded, true, 'xóa trường password thừa');
    assert.equal(cleaned.account.password, undefined);

    assert.equal(C.checkAccountPassword({ email: 'c@x.com' }, 'anything').ok, false);
    assert.equal(C.checkAccountPassword(null, 'anything').ok, false);
    assert.deepEqual(C.publicAccount({ email: 'd@x.com', name: 'D', password: 'p', passwordHash: 'h' }), { email: 'd@x.com', name: 'D' });
});

/* ------------------------------------------------------------------ */
/* 4. escapeHtml / sanitizeText / safeImageUrl                          */
/* ------------------------------------------------------------------ */

test('escapeHtml', () => {
    assert.equal(C.escapeHtml('<a href="x">\'&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
    assert.equal(C.escapeHtml(null), '');
});

const RDQ = String.fromCharCode(0x201D);
const RSQ = String.fromCharCode(0x2019);

test('sanitizeText: bỏ thẻ, script, ký tự điều khiển, dấu nháy thẳng; giới hạn độ dài', () => {
    assert.equal(C.sanitizeText('<script>alert(1)</script>Áo thun'), 'Áo thun');
    assert.equal(C.sanitizeText('Tee <img src=x onerror=alert(1)> Black'), 'Tee Black');
    assert.equal(C.sanitizeText('" onerror="alert(1)'), RDQ + ' onerror=' + RDQ + 'alert(1)');
    assert.equal(C.sanitizeText("it's `x`"), 'it' + RSQ + 's ' + RSQ + 'x' + RSQ);
    assert.equal(C.sanitizeText('a<b>c'), 'a c');
    assert.equal(C.sanitizeText('1 < 2 > 0'), '1 2 0');
    assert.equal(C.sanitizeText('dòng1' + String.fromCharCode(10) + 'dòng2' + String.fromCharCode(0) + String.fromCharCode(0x2028) + 'x'), 'dòng1 dòng2 x');
    assert.equal(C.sanitizeText('x'.repeat(50), 10), 'x'.repeat(10));
    assert.equal(C.sanitizeText(undefined), '');
    assert.equal(C.sanitizeText(12345), '12345');
    for (const sample of ['<svg/onload=alert(1)>', '"><script>alert(1)</script>', "'-alert(1)-'"]) {
        const cleaned = C.sanitizeText(sample);
        assert.equal(/[<>"']/.test(cleaned), false, sample + ' -> ' + cleaned);
    }
});

test('safeImageUrl: chỉ http(s), data:image base64 (không SVG) và đường dẫn tương đối', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const ok = ['https://fearofgod.com/cdn/shop/files/a.jpg?v=1&width=1600', 'http://example.com/x.png', png, 'images/visa.png', '/images/visa.png', 'img.png?v=2'];
    for (const url of ok) assert.equal(C.safeImageUrl(url), url, url);
    assert.equal(C.safeImageUrl('  https://a.com/x.png  '), 'https://a.com/x.png');
    const bad = [
        'javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java' + String.fromCharCode(9) + 'script:alert(1)', 'vbscript:msgbox(1)',
        'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=', png + '" onerror="alert(1)',
        'https://a.com/x.png" onerror="alert(1)', "https://a.com/x.png'><script>", '//evil.example/x.png',
        'https://a.com/x .png', 'file:///etc/passwd', '', null, undefined
    ];
    for (const url of bad) assert.equal(C.safeImageUrl(url), '', String(url));
});

/* ------------------------------------------------------------------ */
/* 5. product-data.js: làm sạch sản phẩm admin (chạy mã thật trong vm)  */
/* ------------------------------------------------------------------ */

// Giả lập localStorage: khóa dữ liệu là thuộc tính riêng (Object.keys(localStorage) như trình duyệt).
function makeStorage(initial) {
    const store = {};
    Object.defineProperties(store, {
        getItem: { value: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null) },
        setItem: { value: (key, value) => { store[key] = String(value); } },
        removeItem: { value: (key) => { delete store[key]; } },
        key: { value: (index) => Object.keys(store)[index] || null },
        clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
        length: { get: () => Object.keys(store).length },
        _data: { get: () => Object.assign({}, store) }
    });
    Object.keys(initial || {}).forEach((k) => { store[k] = String(initial[k]); });
    return store;
}

function loadProductData(customProducts, withCrypto) {
    const context = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: makeStorage({ stylehub_admin_products_v1: JSON.stringify(customProducts) })
    };
    context.window = context;
    if (withCrypto) context.StyleHubCrypto = C;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'product-data.js'), 'utf8'), context, { filename: 'product-data.js' });
    return { context, database: vm.runInContext('database', context) };
}

const MALICIOUS_PRODUCTS = {
    'custom-mens-evil-tee': {
        key: 'custom-mens-evil-tee',
        name: 'Evil Tee<img src=x onerror=alert(document.cookie)>',
        brand: '"><script>alert(1)</script>Brand',
        price: '100.000 ₫',
        priceNum: 100000,
        mainImg: 'javascript:alert(1)',
        images: ['https://cdn.example.com/a.jpg', 'data:text/html;base64,PHNjcmlwdD4=', 'https://cdn.example.com/b.jpg" onerror="alert(1)'],
        description: '<b>Đẹp</b> và "bền"',
        adminDepartment: 'mens',
        sizes: { S: 1, 'M<': 2, L: '<i>3</i>' },
        tags: ['ok', '<script>x</script>', { nested: true }],
        onclick: 'alert(1)'
    },
    'bad"><img src=x onerror=alert(1)>': { name: 'Bad id' },
    'custom-womens-dress': { name: 'Silk Dress', mainImg: 'https://cdn.example.com/dress.jpg', priceNum: 'not-a-number', adminDepartment: 'womens' }
};

test('product-data.js: sản phẩm admin độc hại được làm sạch, mã không hợp lệ bị bỏ qua', () => {
    const { database } = loadProductData(MALICIOUS_PRODUCTS, true);
    const evil = database['custom-mens-evil-tee'];
    assert.ok(evil, 'sản phẩm hợp lệ vẫn được thêm');
    assert.equal(evil.name, 'Evil Tee');
    assert.equal(evil.brand.includes('<'), false);
    assert.equal(evil.brand.includes('"'), false);
    assert.equal(evil.mainImg, '');
    assert.deepEqual(Array.from(evil.images), ['https://cdn.example.com/a.jpg']);
    assert.equal(evil.description, 'Đẹp và ' + RDQ + 'bền' + RDQ);
    assert.equal(evil.sizes.S, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(evil.sizes, 'M<'), false);
    assert.equal(evil.sizes.L, '3');
    assert.deepEqual(Array.from(evil.tags), ['ok', '']);
    assert.equal(evil.onclick, 'alert(1)', 'chuỗi vô hại (không có thẻ) được giữ nguyên dạng text');
    assert.equal(evil.key, 'custom-mens-evil-tee');
    assert.equal(Object.keys(database).some((id) => id.includes('"') || id.includes('<')), false);
    assert.equal(database['custom-womens-dress'].name, 'Silk Dress');
    assert.equal(database['custom-womens-dress'].mainImg, 'https://cdn.example.com/dress.jpg');
    assert.equal(database['custom-womens-dress'].priceNum, 'not-a-number', 'chuỗi lạ chỉ còn là text vô hại');
    // Sản phẩm gốc không bị ảnh hưởng.
    assert.equal(database['shoe-1'].name, 'Athletics III Basketball - Cinder Warm Vanilla');
    assert.ok(database['shoe-1'].mainImg.startsWith('https://'));
});

test('product-data.js: bản dự phòng cục bộ cho kết quả GIỐNG HỆT StyleHubCrypto', () => {
    const withCrypto = loadProductData(MALICIOUS_PRODUCTS, true);
    const withoutCrypto = loadProductData(MALICIOUS_PRODUCTS, false);
    assert.equal(withoutCrypto.context.StyleHubCrypto, undefined);
    assert.equal(JSON.stringify(withoutCrypto.database['custom-mens-evil-tee']), JSON.stringify(withCrypto.database['custom-mens-evil-tee']));

    const sanitizeLocal = withoutCrypto.context.StyleHubProductAdmin.sanitizeProductRecord;
    const corpus = [
        '<script>alert(1)</script>x', 'Tee <img src=x onerror=alert(1)> Black', '" onerror="x', "it's", 'a`b`',
        'line' + String.fromCharCode(13, 10) + 'break', 'sep' + String.fromCharCode(0x2028) + 'x', 'tab' + String.fromCharCode(9) + 'x',
        '<<a>>', '   spaced   out   ', 'Áo khoác <b>Fear of God</b> — "Essentials"', 'x'.repeat(400)
    ];
    for (const text of corpus) {
        assert.equal(sanitizeLocal({ name: text }).name, C.sanitizeText(text, 300), JSON.stringify(text));
        assert.equal(sanitizeLocal({ description: text }).description, C.sanitizeText(text, 2000), JSON.stringify(text));
    }
    const urls = ['https://a.com/x.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'images/a.png', '//x.com/a.png', 'https://a.com/x".png'];
    for (const url of urls) assert.equal(sanitizeLocal({ mainImg: url }).mainImg, C.safeImageUrl(url), url);
});

/* ------------------------------------------------------------------ */
/* 6. stylehub-common.js: module đăng nhập thật (chạy trong vm)          */
/* ------------------------------------------------------------------ */

function loadAuth(initialStorage, options) {
    const opts = options || {};
    const source = fs.readFileSync(path.join(ROOT, 'stylehub-common.js'), 'utf8');
    const start = source.indexOf('window.StyleHubAuth = {');
    assert.ok(start > 0, 'không tìm thấy StyleHubAuth');
    const end = source.indexOf('})();', start) + '})();'.length;
    const authSource = source.slice(0, end);
    const storage = makeStorage(initialStorage);
    const context = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: storage,
        document: { querySelectorAll: () => [] }
    };
    context.window = context;
    if (opts.withCrypto !== false) {
        // Dùng 1000 vòng để test nhanh; định dạng/thuật toán giống hệt bản thật.
        context.StyleHubCrypto = Object.assign({}, C, { hashPassword: (pw) => C.hashPassword(pw, { iterations: 1000 }) });
    }
    vm.createContext(context);
    vm.runInContext(authSource, context, { filename: 'stylehub-common.js#auth' });
    return { auth: context.StyleHubAuth, storage };
}

test('StyleHubAuth: đăng ký lưu passwordHash, không lưu mật khẩu dạng chữ ở bất kỳ khóa nào', () => {
    const { auth, storage } = loadAuth({});
    const result = auth.register({ firstName: 'An', lastName: 'Nguyễn', email: 'An@Example.com', password: 'MatKhau#2026' });
    assert.equal(result.ok, true);
    assert.equal(result.user.passwordHash, undefined);
    assert.equal(result.user.password, undefined);
    const accounts = JSON.parse(storage.getItem('stylehub_accounts_v1'));
    assert.ok(C.isPasswordHash(accounts['an@example.com'].passwordHash));
    assert.equal(accounts['an@example.com'].password, undefined);
    const everything = JSON.stringify(storage._data);
    assert.equal(everything.includes('MatKhau#2026'), false, 'không khóa localStorage nào chứa mật khẩu gốc');

    assert.equal(auth.register({ email: 'an@example.com', password: 'khac123', name: 'X' }).ok, false, 'trùng email');
    assert.equal(auth.register({ email: 'b@example.com', password: '123', name: 'B' }).ok, false, 'mật khẩu quá ngắn');
});

test('StyleHubAuth: đăng nhập đúng/sai, getCurrentUser và readAccounts không lộ hash, đăng xuất', () => {
    const { auth, storage } = loadAuth({});
    auth.register({ name: 'Bình', email: 'binh@example.com', password: 'binh-pass-1' });
    const wrong = auth.login('binh@example.com', 'binh-pass-2');
    assert.equal(wrong.ok, false);
    assert.equal(storage.getItem('isLoggedInStatus'), null);

    const right = auth.login(' BINH@example.com ', 'binh-pass-1');
    assert.equal(right.ok, true);
    assert.equal(right.user.passwordHash, undefined);
    assert.equal(storage.getItem('isLoggedInStatus'), 'true');
    assert.equal(storage.getItem('hub_current_user_key'), 'binh@example.com');

    const current = auth.getCurrentUser();
    assert.equal(current.email, 'binh@example.com');
    assert.equal(current.passwordHash, undefined);
    const listed = auth.readAccounts();
    assert.equal(listed['binh@example.com'].passwordHash, undefined);

    auth.signOut();
    assert.equal(auth.getCurrentUser(), null);
    assert.equal(auth.login('chua-dang-ky@example.com', 'whatever').ok, false);
});

test('StyleHubAuth: tài khoản cũ dạng chữ được nâng cấp ngay khi tải trang, vẫn đăng nhập được', () => {
    const legacyAccounts = { 'cu@example.com': { email: 'cu@example.com', password: 'mat-khau-cu', name: 'Khách Cũ', createdAt: 1 } };
    const legacyUserData = { firstName: 'Mới', lastName: 'Trần', email: 'moi@example.com', password: 'mat-khau-moi', name: 'Trần Mới' };
    const { auth, storage } = loadAuth({
        stylehub_accounts_v1: JSON.stringify(legacyAccounts),
        hub_userData: JSON.stringify(legacyUserData)
    });
    const accounts = JSON.parse(storage.getItem('stylehub_accounts_v1'));
    assert.equal(accounts['cu@example.com'].password, undefined);
    assert.ok(C.isPasswordHash(accounts['cu@example.com'].passwordHash));
    assert.ok(C.isPasswordHash(accounts['moi@example.com'].passwordHash), 'hub_userData cũ được chuyển thành tài khoản băm');
    assert.equal(JSON.parse(storage.getItem('hub_userData')).password, undefined);
    assert.equal(JSON.parse(storage.getItem('hub_userData')).email, 'moi@example.com');
    const everything = JSON.stringify(storage._data);
    assert.equal(everything.includes('mat-khau-cu'), false);
    assert.equal(everything.includes('mat-khau-moi'), false);

    assert.equal(auth.login('cu@example.com', 'mat-khau-cu').ok, true);
    assert.equal(auth.login('moi@example.com', 'mat-khau-moi').ok, true);
    assert.equal(auth.login('cu@example.com', 'sai').ok, false);
});

test('StyleHubAuth: thiếu stylehub-crypto.js thì từ chối an toàn, không lưu mật khẩu dạng chữ', () => {
    const { auth, storage } = loadAuth({}, { withCrypto: false });
    const result = auth.register({ name: 'C', email: 'c@example.com', password: 'abcdef1' });
    assert.equal(result.ok, false);
    assert.match(result.message, /stylehub-crypto\.js/);
    assert.equal(storage.getItem('stylehub_accounts_v1'), null);
});

/* ------------------------------------------------------------------ */
/* 7. stylehub-orders-api.js: khách hàng chỉ truy vấn đơn của mình      */
/* ------------------------------------------------------------------ */

function createFakeFirebase(remoteOrders) {
    const calls = [];
    function matches(order, field, value) {
        return String((order && order[field]) || '').toLowerCase() === value;
    }
    function makeRef(pathName, query) {
        const snapshotFor = () => {
            let value = null;
            if (pathName === 'stylehub_orders/orders') {
                const filtered = {};
                Object.keys(remoteOrders).forEach((id) => {
                    if (!query || matches(remoteOrders[id], query.field, query.value)) filtered[id] = remoteOrders[id];
                });
                value = filtered;
            }
            return { val: () => value, exists: () => value !== null };
        };
        return {
            orderByChild(field) {
                return { equalTo(value) { return makeRef(pathName, { field, value }); } };
            },
            once(eventName) {
                calls.push({ type: 'once', path: pathName, query: query || null });
                return Promise.resolve(snapshotFor());
            },
            on(eventName, callback) {
                calls.push({ type: 'on', path: pathName, query: query || null });
                Promise.resolve().then(() => callback(snapshotFor()));
            },
            set() { calls.push({ type: 'set', path: pathName }); return Promise.resolve(); },
            remove() { calls.push({ type: 'remove', path: pathName }); return Promise.resolve(); }
        };
    }
    const db = { ref: (p) => makeRef(p, null) };
    return {
        calls,
        firebase: { apps: [{}], initializeApp() {}, database: () => db }
    };
}

function loadOrdersApi(storage, fake) {
    const context = {
        console: { log() {}, warn() {}, error() {} },
        localStorage: storage,
        firebase: fake.firebase,
        CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        StorageEvent: class StorageEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } },
        setTimeout, clearTimeout, Promise
    };
    context.window = context;
    context.addEventListener = () => {};
    context.dispatchEvent = () => true;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'stylehub-orders-api.js'), 'utf8'), context, { filename: 'stylehub-orders-api.js' });
    return context.StyleHubOrders;
}

const order = (id, email, extra) => Object.assign({
    // createdAt trước STOCK_FEATURE_START_AT để test không kích hoạt trừ kho tự động.
    orderId: id, createdAt: 1780000000000 + Number(id.replace(/\D/g, '')), status: 'Đang chờ xác nhận',
    userEmail: email, userInfo: { name: 'Khách ' + id, phone: '0900000000', email: email, address: 'HCM' },
    orderedProductsList: [{ key: 'shoe-1', name: 'Shoe', qty: 1, price: '6.100.000 ₫' }]
}, extra || {});

test('getOrdersByEmail: chỉ truy vấn Firebase theo email (không tải toàn bộ), gộp đơn trên máy của đúng email', async () => {
    const remote = {
        STH001: order('STH001', 'me@example.com'),
        STH002: order('STH002', 'other@example.com'),
        STH003: order('STH003', 'ship@example.com', { accountEmail: 'me@example.com' })
    };
    const fake = createFakeFirebase(remote);
    const storage = makeStorage({
        'hub_orders_me@example.com': JSON.stringify([order('STH010', 'me@example.com')]),
        'hub_orders_other@example.com': JSON.stringify([order('STH011', 'other@example.com')])
    });
    const api = loadOrdersApi(storage, fake);
    fake.calls.length = 0;

    const orders = await api.getOrdersByEmail('ME@example.com');
    const ids = Array.from(orders, (o) => o.orderId).sort();
    assert.deepEqual(ids, ['STH001', 'STH003', 'STH010']);
    const orderReads = fake.calls.filter((c) => c.path === 'stylehub_orders/orders' && (c.type === 'once' || c.type === 'on'));
    assert.ok(orderReads.length >= 1);
    assert.equal(orderReads.some((c) => !c.query), false, 'không được đọc toàn bộ nút orders');
    assert.deepEqual(orderReads.map((c) => c.query.field).sort(), ['accountEmail', 'userEmail']);
    assert.ok(orderReads.every((c) => c.query.value === 'me@example.com'));
    assert.equal(JSON.stringify(orders).includes('other@example.com'), false, 'không lộ đơn của khách khác');
    assert.equal((await api.getOrdersByEmail('')).length, 0);
});

test('onOrdersChanged({email}): realtime chỉ lắng nghe truy vấn theo email; admin vẫn nghe toàn bộ', async () => {
    const remote = { STH001: order('STH001', 'me@example.com'), STH002: order('STH002', 'other@example.com') };
    const fake = createFakeFirebase(remote);
    const api = loadOrdersApi(makeStorage({}), fake);
    fake.calls.length = 0;

    const received = [];
    api.onOrdersChanged((orders) => received.push(Array.from(orders, (o) => o.orderId)), { email: 'me@example.com' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const listeners = fake.calls.filter((c) => c.type === 'on' && c.path === 'stylehub_orders/orders');
    assert.equal(listeners.length, 2);
    assert.ok(listeners.every((c) => c.query && c.query.value === 'me@example.com'));
    assert.ok(received.length >= 1);
    assert.deepEqual(received[received.length - 1], ['STH001']);

    fake.calls.length = 0;
    api.onOrdersChanged(() => {});
    const adminListeners = fake.calls.filter((c) => c.type === 'on' && c.path === 'stylehub_orders/orders');
    assert.equal(adminListeners.length, 1);
    assert.equal(adminListeners[0].query, null, 'trang admin vẫn nghe toàn bộ như cũ');
});

test('normalizeOrder giữ accountEmail (email tài khoản) tách biệt với email giao hàng', () => {
    const api = loadOrdersApi(makeStorage({}), createFakeFirebase({}));
    const normalized = api.normalizeOrder({
        orderId: 'STH777', userEmail: 'acc@example.com', customerEmail: 'acc@example.com', shippingEmail: 'ship@example.com',
        userInfo: { name: 'A', email: 'ship@example.com', accountEmail: 'acc@example.com' }, orderedProductsList: [{ key: 'shoe-1', qty: 1 }]
    });
    assert.equal(normalized.accountEmail, 'acc@example.com');
    assert.equal(api.normalizeOrder(normalized).accountEmail, 'acc@example.com', 'giữ nguyên qua nhiều lần chuẩn hóa');
});

/* ------------------------------------------------------------------ */
/* 8. Kiểm tra tĩnh admin.html, trang HTML và rules                      */
/* ------------------------------------------------------------------ */

test('admin.html: không còn mật khẩu dạng chữ, bản băm demo hợp lệ, onclick dùng jsArg', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.equal(/ADMIN_PASSWORD\s*=/.test(html), false);
    assert.equal(html.includes('"admin123"') || html.includes("'admin123'"), false);
    const match = html.match(/STATIC_DEMO_ADMIN_HASH = "([^"]+)"/);
    assert.ok(match, 'có bản băm cho chế độ demo tĩnh');
    assert.ok(C.isPasswordHash(match[1]));
    assert.equal(C.verifyPassword('admin123', match[1]), true, 'mật khẩu demo trong README vẫn dùng được');
    assert.equal(C.verifyPassword('admin1234', match[1]), false);
    assert.equal(/onclick="[^"]*'\$\{escapeHtml\(/.test(html), false, 'không còn tham số onclick chỉ dùng escapeHtml');
    assert.ok((html.match(/\$\{jsArg\(/g) || []).length >= 10);
    assert.ok(html.indexOf('<script src="stylehub-crypto.js"></script>') < html.indexOf('<script src="product-data.js'));
    assert.match(html, /\/api\/health/);
    assert.match(html, /\/api\/auth\/login/);
    assert.match(html, /role !== 'admin'/);
});

test('admin.html: jsArg chặn chèn mã qua mã đơn chứa dấu nháy', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    const escapeSrc = html.slice(html.indexOf('function escapeHtml(value)'), html.indexOf('function normalizeText(value)'));
    const context = {};
    vm.createContext(context);
    vm.runInContext(escapeSrc + '; this.jsArg = jsArg;', context);
    const evilId = "x');alert(document.cookie);//";
    const attribute = context.jsArg(evilId);
    // Mô phỏng trình duyệt: giải mã entity trong thuộc tính rồi chạy biểu thức JS.
    const decoded = attribute.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const seen = [];
    vm.runInNewContext('confirmOrder(' + decoded + ')', { confirmOrder: (id) => seen.push(id), alert: () => { throw new Error('XSS!'); }, document: {} });
    assert.deepEqual(seen, [evilId]);
    assert.equal(attribute.includes('"'), false, 'không có dấu " thô trong thuộc tính');
});

test('Mọi trang nạp stylehub-common.js đều nạp stylehub-crypto.js ngay trước đó', () => {
    const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    let checked = 0;
    for (const page of pages) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        const commonIndex = html.search(/<script src="stylehub-common\.js/);
        if (commonIndex < 0) continue;
        checked++;
        const before = html.slice(0, commonIndex).trimEnd();
        assert.ok(before.endsWith('<script src="stylehub-crypto.js"></script>'), page);
    }
    assert.ok(checked >= 14, 'đã kiểm tra ' + checked + ' trang');
});

test('firebase.database.rules.json: JSON hợp lệ, có index theo email và kiểm tra dữ liệu', () => {
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.database.rules.json'), 'utf8')).rules;
    assert.equal(rules['.read'], false);
    assert.equal(rules['.write'], false);
    const orders = rules.stylehub_orders.orders;
    assert.ok(orders['.indexOn'].includes('userEmail'));
    assert.ok(orders['.indexOn'].includes('accountEmail'));
    assert.match(orders.$orderId.orderId['.validate'], /matches/);
    assert.ok(rules.stylehub_orders.admin_products.$productId.name['.validate'].includes('[<>]'));
});
