"use strict";
/*
 * Kiểm thử chatbot Stylist AI (stylehub-ai-chat.js) với dữ liệu thật trong product-data.js.
 * Chạy:  node --test tests/chatbot.test.js
 * Không cần npm install, không cần mạng: nạp 2 file vào vm context với DOM/localStorage giả lập tối thiểu.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PRODUCT_DATA = fs.readFileSync(path.join(ROOT, "product-data.js"), "utf8");
const CHAT = fs.readFileSync(path.join(ROOT, "stylehub-ai-chat.js"), "utf8");

function createStorage(quotaChars) {
    const data = new Map();
    const used = () => {
        let n = 0;
        for (const [k, v] of data) n += k.length + v.length;
        return n;
    };
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) {
            const v = String(value);
            if (quotaChars) {
                const prev = data.has(key) ? key.length + data.get(key).length : 0;
                if (used() - prev + key.length + v.length > quotaChars) {
                    const error = new Error("The quota has been exceeded.");
                    error.name = "QuotaExceededError";
                    error.code = 22;
                    throw error;
                }
            }
            data.set(key, v);
        },
        removeItem(key) { data.delete(key); },
        clear() { data.clear(); },
        key(i) { return Array.from(data.keys())[i] || null; },
        get length() { return data.size; },
        used: used
    };
}

function fakeElement(tag) {
    return {
        tagName: String(tag || "div").toUpperCase(),
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {},
        append() {},
        remove() {},
        addEventListener() {},
        setAttribute() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
}

function createEnv(options) {
    const opts = options || {};
    const storage = createStorage(opts.quotaChars);
    Object.entries(opts.preload || {}).forEach(([k, v]) => storage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)));
    const document = {
        readyState: "loading", // không dựng widget; chỉ kiểm thử logic qua window.StyleHubStylistAI
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement(tag) { return fakeElement(tag); },
        head: { appendChild(el) { if (opts.onScript) opts.onScript(el); } },
        body: { appendChild() {} }
    };
    const sandbox = {
        document: document,
        localStorage: storage,
        console: { log() {}, info() {}, warn() {}, error() {} },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setImmediate: setImmediate,
        addEventListener() {},
        dispatchEvent() {},
        innerWidth: 1280,
        innerHeight: 800
    };
    if (opts.firebase) sandbox.firebase = opts.firebase;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(PRODUCT_DATA, sandbox, { filename: "product-data.js" });
    vm.runInContext(CHAT, sandbox, { filename: "stylehub-ai-chat.js" });
    const db = vm.runInContext("database", sandbox);
    return { api: sandbox.StyleHubStylistAI, storage: storage, db: db, sandbox: sandbox };
}

function fakeFirebase(initialBehavior) {
    const fb = {
        behavior: initialBehavior,
        writes: [],
        apps: [{}],
        initializeApp() {},
        database() {
            const makeRef = (refPath) => ({
                child(p) { return makeRef(refPath + "/" + p); },
                once() {
                    if (fb.behavior === "hang") return new Promise(() => {});
                    return Promise.resolve({ exists: () => false, val: () => null });
                },
                update(value) { return fb.write("update", refPath, value); },
                set(value) { return fb.write("set", refPath, value); },
                on() {}
            });
            return { ref: makeRef };
        },
        write(op, refPath, value) {
            if (fb.behavior === "hang") return new Promise(() => {});
            if (fb.behavior === "deny") {
                const error = new Error("PERMISSION_DENIED: Permission denied");
                error.code = "PERMISSION_DENIED";
                return Promise.reject(error);
            }
            fb.writes.push({ op: op, path: refPath, value: value });
            return Promise.resolve();
        }
    };
    return fb;
}

const offlineScripts = (el) => setImmediate(() => { if (el.onerror) el.onerror(new Error("offline")); });

function isKids(db, id) { return id.startsWith("kids") || /^kids\b/i.test(db[id].name); }
function isFemale(db, id) { return id.startsWith("womens") || /\bwomens?\b/i.test(db[id].name); }

/* ------------------------------------------------------------------ */

test("tệp chatbot trùng lặp đã được gộp: chỉ còn stylehub-ai-chat.js", () => {
    assert.equal(fs.existsSync(path.join(ROOT, "stylehub-ai-pro.js")), false);
});

test("bug 1: từ khóa ngắn khớp theo TỪ — 'Phí shipping như nào?' trả lời chính sách giao hàng, không chào hỏi", () => {
    const { api } = createEnv();
    const r = api.respond("Phí shipping như nào?");
    assert.equal(r.kind, "shipping");
    assert.match(r.html, /giao hàng/i);
    assert.match(r.html, /1–2 ngày/);
    assert.doesNotMatch(r.html, /Chào bạn/);

    assert.equal(api.respond("phi ship bao nhieu").kind, "shipping", "gõ không dấu");
    assert.equal(api.respond("hi").kind, "greeting");
    assert.equal(api.respond("Xin chào shop").kind, "greeting");
    assert.equal(api.respond("hello").kind, "greeting");
    assert.notEqual(api.respond("this hoodie").kind, "greeting", "'this' không chứa từ 'hi'");
});

test("bug 1: hỏi chính sách đổi trả được trả lời ngay; yêu cầu cụ thể mới chuyển nhân viên", () => {
    const { api } = createEnv();
    assert.equal(api.shouldForwardToSupport("Chính sách đổi trả như thế nào?"), false);
    const r = api.respond("Chính sách đổi trả như thế nào?");
    assert.equal(r.kind, "returns");
    assert.match(r.html, /15 ngày/);

    assert.equal(api.shouldForwardToSupport("Tôi muốn gặp nhân viên hỗ trợ"), true);
    assert.equal(api.shouldForwardToSupport("Đơn STH123456 bị lỗi đường may"), true);
    assert.equal(api.shouldForwardToSupport("tôi muốn đổi hàng"), true);
    assert.equal(api.shouldForwardToSupport("Cho tôi xem hoodie đen"), false);
});

test("bug 1/7: không còn khớp chuỗi con sai ('streetwear' ≠ trẻ em, 'chiều cao' ≠ nữ, 'đẹp' ≠ dép)", () => {
    const { api, db } = createEnv();
    const street = api.respond("áo streetwear");
    assert.equal(street.kind, "products");
    assert.ok(street.products.every((id) => !isKids(db, id)), street.products.join(","));

    const pretty = api.respond("áo đẹp");
    assert.ok(pretty.products.length > 0);
    assert.ok(pretty.products.every((id) => !id.startsWith("shoe")), pretty.products.join(","));
    const prettyAscii = api.respond("ao dep");
    assert.ok(prettyAscii.products.every((id) => !id.startsWith("shoe")), prettyAscii.products.join(","));

    // "nam" trong "Việt Nam" không phải giới tính
    const vn = api.analyzeText("giao hàng Việt Nam");
    assert.ok(vn.tokens.includes("nam"));
});

test("bug 2: phân tích ngân sách tiếng Việt", () => {
    const { api } = createEnv();
    const pick = (s) => {
        const b = api.parseBudget(s);
        return b ? { min: b.min, max: b.max } : null;
    };
    assert.deepEqual(pick("áo thun nữ dưới 200.000đ"), { min: null, max: 200000 });
    assert.deepEqual(pick("dưới 200k"), { min: null, max: 200000 });
    assert.deepEqual(pick("under 1 triệu"), { min: null, max: 1000000 });
    assert.deepEqual(pick("từ 500k đến 1tr"), { min: 500000, max: 1000000 });
    assert.deepEqual(pick("trên 2 triệu"), { min: 2000000, max: null });
    assert.deepEqual(pick("quần 500-800k"), { min: 500000, max: 800000 });
    assert.deepEqual(pick("dưới 1,5 triệu"), { min: null, max: 1500000 });
    assert.deepEqual(pick("200.000 ₫ trở xuống"), { min: null, max: 200000 });
    assert.deepEqual(pick("tầm 1tr5"), { min: 1200000, max: 1800000 });
    assert.deepEqual(pick("dưới 500"), { min: null, max: 500000 });
    // Không phải tiền
    assert.equal(pick("size 42"), null);
    assert.equal(pick("tôi cao 1m70 nặng 65kg"), null);
    assert.equal(pick("giày nam 42"), null);
    assert.equal(pick("tôi cao 170cm"), null);
    assert.equal(pick("mua 2 cái"), null);
});

test("bug 2: 'áo thun nữ dưới 200.000đ' — lọc cứng, nói rõ không có, phương án thay thế được ghi rõ là ngoài ngân sách", () => {
    const { api, db } = createEnv();
    const r = api.respond("Cho tôi xem áo thun nữ dưới 200.000đ");
    assert.equal(r.kind, "no-match");
    assert.equal(r.products.length, 0);
    assert.match(r.html, /chưa có áo thun nữ nào dưới 200\.000 ₫/);
    assert.match(r.html, /NGOÀI khoảng giá/);
    assert.ok(r.alternatives.length > 0);
    for (const id of r.alternatives) {
        assert.ok(db[id].priceNum > 200000, id);
        assert.ok(isFemale(db, id), id);
    }
});

test("bug 2: mọi sản phẩm được giới thiệu là 'phù hợp' đều nằm trong ngân sách", () => {
    const { api, db } = createEnv();
    const cases = [
        ["áo dưới 800k", 0, 800000],
        ["hoodie từ 4 triệu đến 5 triệu", 4000000, 5000000],
        ["giày trên 7 triệu", 7000000, Infinity],
        ["quần dưới 5tr", 0, 5000000],
        ["cho tôi xem áo thun nam từ 2tr đến 3tr", 2000000, 3000000]
    ];
    for (const [q, min, max] of cases) {
        const r = api.respond(q);
        assert.equal(r.kind, "products", q);
        assert.ok(r.products.length > 0, q);
        for (const id of r.products) {
            const p = db[id].priceNum;
            assert.ok(p >= min && p <= max, `${q}: ${id} = ${p}`);
        }
    }
});

test("bug 7: hoodie/áo chung chung không đưa đồ trẻ em lên; tôn trọng nam/nữ/trẻ em", () => {
    const { api, db } = createEnv();
    const hoodie = api.respond("hoodie");
    assert.equal(hoodie.kind, "products");
    assert.ok(hoodie.products.every((id) => !isKids(db, id)), hoodie.products.join(","));
    assert.ok(hoodie.products.every((id) => /hoodie/i.test(db[id].name)), hoodie.products.join(","));

    const kidsHoodie = api.respond("hoodie trẻ em");
    assert.ok(kidsHoodie.products.length > 0);
    assert.ok(kidsHoodie.products.every((id) => isKids(db, id) && /hoodie/i.test(db[id].name)), kidsHoodie.products.join(","));

    const femaleHoodie = api.respond("hoodie nữ");
    assert.ok(femaleHoodie.products.length > 0);
    assert.ok(femaleHoodie.products.every((id) => isFemale(db, id)), femaleHoodie.products.join(","));

    const menHot = api.respond("Cho tôi coi vài mẫu áo nam hot");
    assert.equal(menHot.kind, "products");
    assert.ok(menHot.products.every((id) => !isFemale(db, id) && !isKids(db, id)), menHot.products.join(","));
});

test("loại sản phẩm được lọc chặt: 'váy' không trả về dress shirt, 'dress shirt' trả về sơ mi", () => {
    const { api, db } = createEnv();
    const dress = api.respond("cho tôi xem váy");
    assert.equal(dress.kind, "no-match");
    assert.equal(dress.products.length, 0);
    assert.match(dress.html, /chưa có váy/);

    const shirts = api.respond("Cho tôi coi dress shirt");
    assert.equal(shirts.kind, "products");
    assert.ok(shirts.products.every((id) => /\bshirt\b/i.test(db[id].name) && !/t-?shirt/i.test(db[id].name)), shirts.products.join(","));

    const jeans = api.respond("Cho tôi coi quần jean");
    assert.ok(jeans.products.length > 0);
    assert.ok(jeans.products.every((id) => /jean/i.test(db[id].name)), jeans.products.join(","));
});

test("sản phẩm hết hàng không được gợi ý và không thêm được vào BAG", () => {
    const { api } = createEnv({ preload: { stylehub_inventory_v1: { "hoodies-2": { stock: 0, outOfStock: true } } } });
    for (let i = 0; i < 3; i++) {
        const r = api.respond(i === 0 ? "hoodie" : i === 1 ? "hoodie nam" : "hoodie dưới 5 triệu");
        assert.ok(!r.products.includes("hoodies-2"));
    }
    assert.equal(api.addToCart("hoodies-2").reason, "out-of-stock");
});

test("bug 3: tư vấn size giày nam → '42' tiếp tục luồng giày (không hỏi chiều cao/cân nặng)", () => {
    const { api } = createEnv();
    let r = api.respond("Tư vấn size giày nam");
    assert.equal(r.kind, "shoe-size");
    assert.match(r.html, /size EU số mấy/);

    r = api.respond("42");
    assert.equal(r.kind, "shoe-size");
    assert.match(r.html, /vừa chân hay rộng/);
    assert.doesNotMatch(r.html, /chiều cao|cân nặng/);

    r = api.respond("vừa");
    assert.equal(r.kind, "shoe-size");
    assert.equal(r.shoeAdvice.size, 42);
    assert.equal(r.shoeAdvice.available, true);
    assert.match(r.html, /size 42/);
});

test("bug 3: hỏi xen chính sách giữa chừng vẫn giữ luồng size giày; luồng xong thì 'giày nam' là tìm sản phẩm", () => {
    const { api } = createEnv();
    api.respond("Tư vấn size giày nam");
    assert.equal(api.respond("phí ship bao nhiêu").kind, "shipping");
    const r = api.respond("42");
    assert.equal(r.kind, "shoe-size");
    assert.match(r.html, /vừa chân hay rộng/);
    assert.equal(api.respond("vừa").shoeAdvice.size, 42);
    assert.equal(api.respond("giày nam").kind, "products");

    const other = createEnv().api;
    other.respond("Tư vấn size giày nam");
    assert.equal(other.respond("cho xem hoodie").kind, "products", "đổi chủ đề rõ ràng thì thoát luồng size");
});

test("bug 3: shoeNumberSize không ép về 36; size không bán thì nói rõ", () => {
    const { api } = createEnv();
    assert.equal(api.shoeNumberSize(42, "male", "regular").size, 42);
    assert.equal(api.shoeNumberSize(42, "male", "loose").size, 43);
    assert.equal(api.shoeNumberSize(44, "male", "loose").available, false);
    assert.equal(api.shoeNumberSize(43, "female", "regular").available, false);
    assert.equal(api.shoeNumberSize(41, "female", "loose").available, true);

    let r = api.respond("Tư vấn size giày nam");
    r = api.respond("44");
    r = api.respond("rộng");
    assert.equal(r.shoeAdvice.size, 45);
    assert.equal(r.shoeAdvice.available, false);
    assert.match(r.html, /chưa có size 45/);
    assert.doesNotMatch(r.html, /\b36\b/);

    const female = createEnv().api;
    const f = female.respond("size giày nữ 43 vừa");
    assert.equal(f.kind, "shoe-size");
    assert.equal(f.shoeAdvice.available, false);
    assert.match(f.html, /37–42/);
});

test("bug 3: size giày ngoài hệ EU được hỏi lại; chiều dài bàn chân được quy đổi", () => {
    const { api } = createEnv();
    api.respond("tư vấn size giày nam");
    const odd = api.respond("25");
    assert.equal(odd.kind, "shoe-size");
    assert.match(odd.html, /không thuộc hệ size EU/);

    const env2 = createEnv().api;
    let r = env2.respond("tư vấn size giày nam chân dài 26cm");
    assert.match(r.html, /size 41/);
    r = env2.respond("vừa");
    assert.equal(r.shoeAdvice.size, 41);
    assert.match(r.html, /26cm/);
});

test("tư vấn size quần áo: chiều cao/cân nặng → độ rộng → size; ngân sách không bị hiểu nhầm là cân nặng", () => {
    const { api } = createEnv();
    let r = api.respond("tư vấn size áo");
    assert.equal(r.kind, "clothing-size");
    assert.match(r.html, /chiều cao và cân nặng/);
    r = api.respond("1m70 65kg");
    assert.match(r.html, /vừa vặn hay rộng/);
    r = api.respond("vừa");
    assert.equal(r.clothingSize, "L");

    const big = createEnv().api;
    big.respond("tư vấn size áo nam");
    big.respond("1m85 90kg");
    const xxl = big.respond("rộng");
    assert.equal(xxl.clothingSize, "XXL");
    assert.match(xxl.html, /chưa có size XXL/);

    const budget = createEnv().api.respond("áo dưới 100 nghìn");
    assert.notEqual(budget.kind, "clothing-size");
});

test("bug 4: thêm giày vào BAG không bao giờ tự gán size M", () => {
    const { api } = createEnv();
    const first = api.addToCart("shoe-1");
    assert.equal(first.ok, false);
    assert.equal(first.reason, "need-size");
    assert.equal(api.readCartItems().length, 0);
    const prompt = api.loadMessages().at(-1);
    assert.match(prompt.html, /tsh-ai-size-option/);
    assert.match(prompt.html, /data-size="42"/);

    assert.equal(api.addToCart("shoe-1", "M").reason, "need-size", "size chữ không hợp lệ cho giày");
    const ok = api.addToCart("shoe-1", "42");
    assert.equal(ok.ok, true);
    const cart = api.readCartItems();
    assert.equal(cart.length, 1);
    assert.equal(cart[0].size, "42");
    assert.notEqual(cart[0].size, "M");
});

test("bug 4: giày dùng size vừa được tư vấn; quần áo giữ mặc định M như trang sản phẩm và không làm mất giỏ cũ", () => {
    const existing = [{ key: "tops-1", name: "MLB Raglan Sport Hoodie - Oat Heather", price: "4.883.000 ₫", priceNum: 4883000, mainImg: "", size: "L", qty: 1 }];
    const { api, storage } = createEnv({ preload: { stylehub_cart_memory_v1: existing } });
    api.respond("Tư vấn size giày nam");
    api.respond("42");
    api.respond("vừa");
    const shoe = api.addToCart("shoe-2");
    assert.equal(shoe.ok, true);
    assert.equal(shoe.size, "42");

    const tee = api.addToCart("tops-4");
    assert.equal(tee.size, "M");
    const cart = api.readCartItems();
    assert.equal(cart.length, 3, "giữ món đã có trong stylehub_cart_memory_v1");
    assert.equal(storage.getItem("cart"), storage.getItem("stylehub_cart_memory_v1"), "mọi key giỏ hàng đồng bộ");

    const again = api.addToCart("shoe-2", "42");
    assert.equal(again.ok, true);
    assert.equal(api.readCartItems().find((x) => x.key === "shoe-2").qty, 2);
});

test("bug 5: chỉ báo 'đã nhận' khi Firebase ghi thành công", async () => {
    const fb = fakeFirebase("ok");
    const { api } = createEnv({ firebase: fb });
    const res = await api.saveCustomerSupportMessage("Tôi muốn gặp nhân viên hỗ trợ", null);
    assert.equal(res.status, "sent");
    assert.match(api.supportAckHtml(res), /đã nhận được tin nhắn/);
    assert.ok(fb.writes.some((w) => w.op === "set" && /messages\/msg_/.test(w.path)));
});

test("bug 5: Firebase không phản hồi → 'đang chờ gửi', lưu tạm và tự gửi lại khi có kết nối", async () => {
    const fb = fakeFirebase("hang");
    const { api } = createEnv({ firebase: fb });
    api.config.supportWriteTimeoutMs = 30;
    const res = await api.saveCustomerSupportMessage("Khiếu nại đơn hàng giao chậm", null);
    assert.equal(res.status, "pending");
    const ack = api.supportAckHtml(res);
    assert.doesNotMatch(ack, /đã nhận được tin nhắn/);
    assert.match(ack, /CHƯA gửi được/);
    let local = api.readSupportLocal();
    assert.equal(local[res.conversationId].messages[res.messageId].deliveryStatus, "pending");

    fb.behavior = "ok";
    const sent = await api.flushPendingSupportMessages();
    assert.equal(sent, 1);
    local = api.readSupportLocal();
    assert.equal(local[res.conversationId].messages[res.messageId].deliveryStatus, "sent");
    assert.ok(fb.writes.some((w) => w.op === "set" && w.path.endsWith(res.messageId)));
});

test("bug 5: không tải được Firebase (mất mạng) → không báo 'đã nhận'; bị từ chối quyền → chỉ lưu máy", async () => {
    const offline = createEnv({ onScript: offlineScripts }).api;
    const res = await offline.saveCustomerSupportMessage("khiếu nại sản phẩm", null);
    assert.equal(res.status, "pending");
    assert.doesNotMatch(offline.supportAckHtml(res), /đã nhận được tin nhắn/);

    const denied = createEnv({ firebase: fakeFirebase("deny") }).api;
    const res2 = await denied.saveCustomerSupportMessage("khiếu nại sản phẩm", null);
    assert.equal(res2.status, "local");
    const ack2 = denied.supportAckHtml(res2);
    assert.doesNotMatch(ack2, /đã nhận được tin nhắn/);
    assert.match(ack2, /CHƯA nhận được/);
});

test("bug 6: lịch sử chat không ném QuotaExceededError — tự gỡ ảnh cũ / cắt tin cũ", () => {
    const quota = 150000;
    const { api, storage } = createEnv({ quotaChars: quota });
    const bigImage = "data:image/jpeg;base64," + "A".repeat(60000);
    for (let i = 0; i < 25; i++) {
        let ok;
        assert.doesNotThrow(() => { ok = api.storeMessage("user", `Ảnh số ${i}<img class="tsh-ai-chat-image" src="${bigImage}" alt="x">`, "Me"); });
        assert.equal(ok, true, "tin " + i);
    }
    const saved = api.loadMessages();
    assert.match(saved.at(-1).html, /Ảnh số 24/);
    assert.match(saved.at(-1).html, /data:image/, "tin mới nhất vẫn giữ ảnh");
    assert.ok(saved.some((m) => /tsh-ai-image-removed/.test(m.html)), "ảnh cũ đã được gỡ");
    assert.ok(storage.used() <= quota);

    const tiny = createEnv({ quotaChars: 300 }).api;
    assert.doesNotThrow(() => tiny.storeMessage("bot", "x".repeat(1000), "Bot"));
    assert.doesNotThrow(() => tiny.respond("hoodie nam"));
});

test("bug 6: hội thoại hỗ trợ lưu cục bộ cũng tự gỡ ảnh cũ khi bộ nhớ đầy", async () => {
    const { api } = createEnv({ quotaChars: 150000, onScript: offlineScripts });
    const image = (n) => ({ dataUrl: "data:image/jpeg;base64," + String(n).repeat(60000), name: "anh" + n + ".jpg", type: "image/jpeg", size: 45000 });
    const results = [];
    for (let i = 1; i <= 3; i++) results.push(await api.saveCustomerSupportMessage("ảnh lỗi " + i, image(i)));
    assert.ok(results.every((r) => r.status === "pending"), results.map((r) => r.status).join(","));
    const conv = api.readSupportLocal()[results[2].conversationId];
    const last = conv.messages[results[2].messageId];
    const first = conv.messages[results[0].messageId];
    assert.ok(last.imageData, "ảnh mới nhất được giữ");
    assert.ok(!first.imageData && first.imageRemoved, "ảnh cũ đã được gỡ để vừa bộ nhớ");
});

test("XSS: thẻ sản phẩm escape tên và chặn URL ảnh nguy hiểm; tin nhắn khách được escape", () => {
    const { api } = createEnv();
    const html = api.productCards([
        { id: 'x"><script>alert(1)</script>', item: { name: "<img src=x onerror=alert(1)>", price: "1 ₫", mainImg: "javascript:alert(1)" } },
        { id: "y", item: { name: "ok", price: "1 ₫", mainImg: 'https://example.com/a.jpg" onerror="alert(1)' } }
    ]);
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /javascript:/);
    assert.doesNotMatch(html, /" onerror="/);
    assert.doesNotMatch(html, /<img src=x/);

    api.handleMessage("<img src=x onerror=alert(1)> hi");
    const stored = api.loadMessages();
    assert.equal(stored[0].who, "user");
    assert.doesNotMatch(stored[0].html, /<img/);
    assert.match(stored[0].html, /&lt;img/);
});
