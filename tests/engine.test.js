'use strict';
/* Kiểm thử đơn vị cho recommender/engine.js — chạy: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../recommender/engine');
const { loadCatalog, loadAttributes } = require('../recommender/load-catalog');

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 1);
const img = 'https://example.com/a.jpg';

// Danh mục nhỏ, có kiểm soát.
const CATALOG = {
    'tee-black': { name: 'Classic Tee - Black', brand: 'Essentials', priceNum: 2000000, mainImg: img, department: 'mens' },
    'tee-white': { name: 'Classic Tee - White', brand: 'Essentials', priceNum: 2000000, mainImg: img, department: 'mens' },
    'hoodie-black': { name: 'Classic Hoodie - Black', brand: 'Essentials', priceNum: 4500000, mainImg: img, department: 'mens' },
    'hoodie-grey': { name: 'Classic Hoodie - Grey', brand: 'Essentials', priceNum: 4500000, mainImg: img, department: 'mens' },
    'pants-black': { name: 'Classic Sweatpant - Black', brand: 'Essentials', priceNum: 4000000, mainImg: img, department: 'mens' },
    'jeans-blue': { name: 'Straight Jean - Blue', brand: 'Fear of God', priceNum: 9000000, mainImg: img, department: 'mens' },
    'shirt-white': { name: 'Executive Dress Shirt - White', brand: 'The CEO', priceNum: 700000, mainImg: img, department: 'mens' },
    'sneaker-grey': { name: 'Runner Sneaker - Grey', brand: 'Athletics', priceNum: 6000000, mainImg: img, department: 'shoes' },
    'dress-pink': { name: 'Womens Relaxed Shirt - Pink', brand: 'Fear of God', priceNum: 5000000, mainImg: img, department: 'womens' },
    'kids-hoodie': { name: 'Kids Hoodie - Black', priceNum: 1800000, mainImg: img, department: 'kids' },
    'kids-pants': { name: 'Kids Sweatpant - Black', priceNum: 1500000, mainImg: img, department: 'kids' },
    'sold-out': { name: 'Classic Tee - Grey', brand: 'Essentials', priceNum: 2000000, mainImg: img, department: 'mens', outOfStock: true, stock: 0 },
    'no-image': { name: 'Classic Tee - Blue', brand: 'Essentials', priceNum: 2000000, department: 'mens' }
};

const ev = (user, item, type, daysAgo, value, extra) => Object.assign({ user, item, type, ts: NOW - daysAgo * DAY, value }, extra || {});

test('suy luận thuộc tính: áo thun không bị gắn thêm "shirt", tên đội bóng không phải màu', () => {
    const tee = engine.inferAttributes('x', { name: 'Dodgers Heavyweight Merch T-Shirt', department: 'mens' });
    assert.equal(tee.type, 'tee');
    const whiteSox = engine.inferAttributes('x', { name: 'White Sox Raglan Half Zip Sport Hoodie - Black', department: 'mens' });
    assert.deepEqual(whiteSox.colors, ['black']);
    assert.ok(whiteSox.styles.includes('sporty'));
    const leather = engine.inferAttributes('x', { name: 'Womens Leather Tracking Jacket - Maroon', priceNum: 28500000, department: 'womens' });
    assert.ok(!leather.styles.includes('sporty'), '"Tracking" không được khớp thành track (thể thao)');
    assert.equal(leather.gender, 'women');
    assert.deepEqual(leather.colors, ['red']);
    const shoe = engine.inferAttributes('shoe-10', { name: 'Ballerino - Black', department: 'shoes' });
    assert.equal(shoe.type, 'flat');
    assert.equal(shoe.category, 'footwear');
});

test('bảng thuộc tính sinh sẵn khớp toàn bộ danh mục thật', () => {
    const catalog = loadCatalog();
    const attrs = loadAttributes();
    const ids = Object.keys(catalog);
    assert.ok(ids.length > 150);
    for (const id of ids) {
        assert.ok(attrs[id], 'thiếu thuộc tính cho ' + id);
        assert.ok(engine.CATEGORY_OF_TYPE[attrs[id].type], 'type không hợp lệ ở ' + id);
        assert.equal(attrs[id].category, engine.CATEGORY_OF_TYPE[attrs[id].type]);
    }
});

test('điểm đánh giá hiệu dụng kết hợp cảm xúc bình luận', () => {
    assert.equal(engine.effectiveRating(5, null, 0.3), 5);
    const mixed = engine.effectiveRating(5, -0.8, 0.3);
    assert.ok(mixed < 4.2 && mixed > 3.5, '5 sao nhưng bình luận rất tiêu cực -> giảm còn ~3.9');
    assert.equal(engine.effectiveRating(7, 0, 0.3), null);
});

test('ma trận ưu tiên: giới hạn lượt xem, ghi đè khi không thích, bỏ yêu thích, bỏ sự kiện lỗi', () => {
    const events = [];
    for (let i = 0; i < 30; i++) events.push(ev('u', 'tee-black', 'view', 1));
    events.push(ev('u', 'hoodie-black', 'purchase', 2));
    events.push(ev('u', 'hoodie-black', 'rating', 1, 1));            // mua nhưng chấm 1 sao -> không thích
    events.push(ev('u', 'tee-white', 'wishlist', 3, 1));
    events.push(ev('u', 'tee-white', 'unwishlist', 2));
    events.push(ev('u', 'ghost-item', 'purchase', 1));               // sản phẩm không tồn tại
    events.push(ev('u', 'pants-black', 'purchase', -5));             // sự kiện tương lai
    const data = engine.buildPreferenceData(events, CATALOG, engine.DEFAULTS, NOW);
    const u = data.get('u');
    assert.ok(u.items.get('tee-black').score <= engine.DEFAULTS.eventWeights.view * engine.DEFAULTS.viewCap + 1e-9);
    assert.equal(u.items.get('hoodie-black').disliked, true);
    assert.ok(u.items.get('hoodie-black').score < 0);
    assert.equal(u.items.has('tee-white'), false, 'đã bỏ yêu thích thì không còn tín hiệu');
    assert.equal(u.items.has('ghost-item'), false);
    assert.equal(u.items.has('pants-black'), false);
});

function socialScenario() {
    // A và B cùng gu đồ đen; B mua quần đen và chấm 5 sao quần jeans (không mua). C thích đồ công sở.
    return [
        ev('A', 'tee-black', 'purchase', 10), ev('A', 'hoodie-black', 'cart', 3), ev('A', 'hoodie-black', 'view', 3),
        ev('B', 'tee-black', 'purchase', 12), ev('B', 'hoodie-black', 'purchase', 11), ev('B', 'pants-black', 'purchase', 9),
        ev('B', 'jeans-blue', 'rating', 8, 5),
        ev('C', 'shirt-white', 'purchase', 5), ev('C', 'tee-white', 'purchase', 6), ev('C', 'dress-pink', 'view', 4)
    ];
}

test('UserKNN: người dùng tương tự được gợi ý sản phẩm hàng xóm đã MUA hoặc ĐÁNH GIÁ TÍCH CỰC', () => {
    const model = engine.createModel({ catalog: CATALOG, events: socialScenario(), now: NOW, options: { mf: { enabled: false } } });
    const neighbors = model.userNeighbors('A');
    assert.equal(neighbors[0].user, 'B', 'B là hàng xóm gần nhất của A');
    assert.ok(!neighbors.some(n => n.user === 'C' && n.sim > neighbors[0].sim));
    const comp = model.componentScores('A', { context: 'home' });
    const ucf = comp.normalized.ucf;
    assert.ok(ucf.get('pants-black') > 0, 'sản phẩm B đã mua');
    assert.ok(ucf.get('jeans-blue') > 0, 'sản phẩm B chấm 5 sao dù không mua (lỗi bản cũ: chỉ lấy hàng đã mua)');
    // Chuẩn hóa đúng: điểm cộng tác cao nhất = 1 (bản cũ dùng max(1, ...) nên không bao giờ đạt 1).
    assert.equal(Math.max(...ucf.values()), 1);
    assert.ok(!ucf.has('tee-black') || !comp.candidates.includes('tee-black'), 'không gợi ý lại hàng A đã mua');
});

test('Hybrid: lọc hàng đã mua, hết hàng, không có ảnh, không thích và sản phẩm đang xem', () => {
    const events = socialScenario().concat([ev('A', 'tee-white', 'rating', 1, 1)]);
    const model = engine.createModel({ catalog: CATALOG, events, now: NOW, options: { mf: { enabled: false } } });
    const recs = model.recommend('A', { context: 'product', productId: 'hoodie-grey', limit: 20, diversify: false });
    const ids = recs.map(r => r.id);
    for (const banned of ['tee-black', 'sold-out', 'no-image', 'tee-white', 'hoodie-grey']) assert.ok(!ids.includes(banned), banned);
    assert.ok(recs.every(r => typeof r.reason === 'string' && r.reason.length > 0));
});

test('Giải thích trung thực: số người trong lời giải thích khớp bằng chứng thật', () => {
    const model = engine.createModel({
        catalog: CATALOG, events: socialScenario(), now: NOW,
        options: { mf: { enabled: false }, weights: { home: { ucf: 1 } } }
    });
    const recs = model.recommend('A', { limit: 3, diversify: false });
    const pants = recs.find(r => r.id === 'pants-black');
    assert.ok(pants, 'quần đen phải nằm trong top 3');
    assert.equal(pants.explanation.type, 'ucf');
    assert.equal(pants.explanation.evidence.purchases, 1);
    assert.match(pants.reason, /^1 người có gu giống bạn đã mua/);
    const jeans = recs.find(r => r.id === 'jeans-blue');
    assert.ok(jeans);
    assert.match(jeans.reason, /đánh giá ≥4★/);
});

test('Dữ liệu demo được ghi rõ trong lời giải thích', () => {
    const model = engine.createModel({
        catalog: CATALOG, events: socialScenario(), now: NOW, demoUsers: ['B'],
        options: { mf: { enabled: false }, weights: { home: { ucf: 1 } } }
    });
    const pants = model.recommend('A', { limit: 3, diversify: false }).find(r => r.id === 'pants-black');
    assert.match(pants.reason, /dữ liệu demo/);
});

test('Cold-start: chưa có dữ liệu -> khám phá đa dạng loại; có quiz -> theo quiz', () => {
    const model = engine.createModel({ catalog: CATALOG, events: [], now: NOW, options: { mf: { enabled: false } } });
    const explore = model.recommend('new-user', { limit: 4 });
    const types = new Set(explore.map(r => model.attributes[r.id].type));
    assert.equal(types.size, explore.length, 'mỗi gợi ý một loại khác nhau');
    const withQuiz = model.recommend('new-user', { limit: 3, quiz: { gender: 'kids', types: ['hoodie'], colors: ['black'] } });
    assert.equal(withQuiz[0].id, 'kids-hoodie');
    assert.equal(withQuiz[0].explanation.type, 'cb');
});

test('Ngữ cảnh trang sản phẩm ưu tiên sản phẩm tương tự', () => {
    const model = engine.createModel({ catalog: CATALOG, events: [], now: NOW, options: { mf: { enabled: false } } });
    const recs = model.recommend('guest', { context: 'product', productId: 'hoodie-black', limit: 2, diversify: false });
    assert.equal(recs[0].id, 'hoodie-grey');
    assert.match(recs[0].reason, /Tương tự sản phẩm đang xem/);
});

test('MMR làm tăng độ đa dạng danh sách', () => {
    const catalog = loadCatalog();
    const attributes = loadAttributes();
    const events = [];
    ['hoodies-3', 'hoodies-5', 'hoodies-15', 'hoodies-4'].forEach((id, i) => events.push(ev('u', id, 'view', i + 1)));
    const model = engine.createModel({ catalog, attributes, events, now: NOW, options: { mf: { enabled: false } } });
    const ild = (list) => {
        let s = 0, n = 0;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { s += 1 - model.contentSim(list[i].id, list[j].id); n++; }
        return n ? s / n : 0;
    };
    const plain = model.recommend('u', { limit: 8, diversify: false });
    const diverse = model.recommend('u', { limit: 8, diversify: true, lambda: 0.6 });
    assert.ok(ild(diverse) > ild(plain), `ILD ${ild(diverse).toFixed(3)} > ${ild(plain).toFixed(3)}`);
});

test('BPR: tái lập được (seed) và học được tín hiệu (AUC trên dữ liệu huấn luyện > 0.8)', () => {
    const catalog = loadCatalog();
    const ids = Object.keys(catalog);
    const rng = engine.mulberry32(7);
    const events = [];
    // 2 nhóm người dùng với 2 nhóm sản phẩm tách biệt.
    for (let u = 0; u < 40; u++) {
        const group = u % 2 ? ids.slice(0, 40) : ids.slice(40, 80);
        for (let k = 0; k < 8; k++) events.push(ev('u' + u, group[Math.floor(rng() * group.length)], 'purchase', 5));
    }
    const data = engine.buildPreferenceData(events, catalog, engine.DEFAULTS, NOW);
    const cfg = Object.assign({}, engine.DEFAULTS.mf);
    const m1 = engine.trainBPR(data, ids, cfg), m2 = engine.trainBPR(data, ids, cfg);
    assert.equal(m1.score('u1', ids[0]), m2.score('u1', ids[0]), 'cùng seed -> cùng kết quả');
    let correct = 0, total = 0;
    for (let u = 0; u < 40; u++) {
        const own = u % 2 ? ids.slice(0, 40) : ids.slice(40, 80);
        const other = u % 2 ? ids.slice(40, 80) : ids.slice(0, 40);
        for (let t = 0; t < 20; t++) {
            const a = m1.score('u' + u, own[t]), b = m1.score('u' + u, other[t]);
            if (a > b) correct++;
            total++;
        }
    }
    assert.ok(correct / total > 0.8, 'AUC=' + (correct / total).toFixed(3));
});

test('Phối đồ: áo -> quần + giày, đúng giới tính; đồ trẻ em chỉ phối với đồ trẻ em', () => {
    const model = engine.createModel({ catalog: CATALOG, events: [], now: NOW, options: { mf: { enabled: false } } });
    const look = model.outfit('tee-black', null);
    assert.deepEqual(look.map(x => x.category).sort(), ['bottom', 'footwear']);
    assert.ok(look.every(x => model.attributes[x.id].gender !== 'women' && model.attributes[x.id].gender !== 'kids'));
    const kids = model.outfit('kids-hoodie', null);
    assert.ok(kids.length >= 1);
    assert.ok(kids.every(x => model.attributes[x.id].gender === 'kids'));
    assert.ok(look[0].reason.length > 0);
});

test('Style DNA phản ánh loại và màu chiếm ưu thế', () => {
    const events = [ev('u', 'hoodie-black', 'purchase', 3), ev('u', 'hoodie-grey', 'purchase', 4), ev('u', 'kids-hoodie', 'view', 5)];
    const model = engine.createModel({ catalog: CATALOG, events, now: NOW, options: { mf: { enabled: false } } });
    const dna = model.styleDNA('u');
    assert.equal(dna.types[0].key, 'hoodie');
    assert.ok(dna.persona);
    assert.ok(dna.interactions >= 2);
});
