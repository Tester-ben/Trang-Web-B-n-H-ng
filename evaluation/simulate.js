/* =============================================================================
   Bộ mô phỏng hành vi mua sắm thời trang (dùng cho thực nghiệm offline)
   -----------------------------------------------------------------------------
   MỤC ĐÍCH: kiểm chứng thuật toán khi CHƯA có dữ liệu thật đủ lớn. Đây là dữ liệu
   MÔ PHỎNG, không phải khách hàng thật — kết quả chỉ chứng minh cài đặt đúng và so
   sánh tương đối giữa các thuật toán dưới các giả định nêu dưới đây.

   Mô hình sinh (trên danh mục 197 sản phẩm thật của website — ảnh chụp cố định
   evaluation/catalog-snapshot.json, xem run-evaluation.js):
   - Mỗi người dùng u có: phân khúc (nam/nữ/mua cho trẻ em), trọng số phong cách,
     màu, loại sản phẩm (Dirichlet thưa), khoảng giá ưa thích, mức độ hoạt động
     (log-normal) và một "cụm gu" ẩn c(u) (K cụm).
   - Độ hữu dụng: U(u,i) = (1-ρ)·Thuộc_tính(u,i) + ρ·Gu_cụm(c(u), i) + Phổ_biến(i) + ε(u,i)
       * Thuộc_tính: khớp loại/phong cách/màu/giá/giới tính (phần Content-based học được).
       * Gu_cụm: ái lực ngẫu nhiên của từng cụm với từng sản phẩm — mô phỏng xu hướng,
         ảnh hưởng xã hội không thể hiện qua thuộc tính (phần chỉ Collaborative học được).
       * ρ điều khiển tỉ trọng hai phần (mặc định 0.5; có thí nghiệm độ nhạy ρ = 0..1).
   - Hành vi theo phiên: mỗi phiên có "ý định" (70% phiên tập trung vào một loại sản phẩm
     theo sở thích), người dùng hay XEM LẠI sản phẩm đã xem trước đó (tập cân nhắc);
     xem theo softmax(U), thêm giỏ / mua / yêu thích theo xác suất sigmoid của độ hữu dụng
     chuẩn hóa, chấm sao sau khi mua, viết bình luận tiếng Việt theo mức hài lòng (có nhiễu);
     điểm cảm xúc do recommender/sentiment-vi.js tính.
   - Quiz Style DNA: câu trả lời suy ra từ sở thích ẩn, có nhiễu 20%.
   ========================================================================== */
'use strict';
const engine = require('../recommender/engine');
const sentiment = require('../recommender/sentiment-vi');

const DAY = 86400000;
const STYLES = Object.keys(engine.LABELS.style);
const COLORS = Object.keys(engine.LABELS.color);
const TIERS = engine.PRICE_TIERS;

const REVIEW_TEMPLATES = [
    ['Thất vọng, chất lượng kém, phí tiền', 'Hàng tệ, vải mỏng và xấu', 'Rất tệ, không giống hình', 'Mặc một lần đã bung chỉ, không hài lòng', 'Vải thô, mặc ngứa, sẽ không mua lại'],
    ['Không hài lòng lắm, form hơi rộng', 'Vải hơi mỏng, mặc nóng', 'Màu khác hình một chút, chưa hài lòng', 'Size hơi chật, đường may lệch', 'Giao chậm, áo hơi nhăn'],
    ['Tạm được, tiền nào của nấy', 'Bình thường, giao hàng đúng hẹn', 'Cũng được, chưa mặc nhiều', 'Đã nhận hàng, mặc thử thấy bình thường', 'Tạm ổn so với giá'],
    ['Áo đẹp, vải mềm, mặc thoải mái', 'Hàng đúng mô tả, giao nhanh', 'Form đẹp, đáng mua', 'Màu đẹp, mặc vừa vặn', 'Chất lượng tốt, đóng gói cẩn thận'],
    ['Tuyệt vời, rất hài lòng, sẽ mua lại', 'Quá đẹp, chất lượng xuất sắc 😍', 'Hoàn hảo, 10 điểm', 'Rất đáng tiền, mặc tôn dáng cực kỳ', 'Ưng ý vô cùng, recommend mọi người']
];

function makeRng(seed) { return engine.mulberry32(seed); }
function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gamma(rng, shape) {
    if (shape < 1) return gamma(rng, shape + 1) * Math.pow(rng(), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x, v;
        do { x = gaussian(rng); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = rng();
        if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}
function dirichlet(rng, n, alpha) {
    const xs = [];
    let s = 0;
    for (let i = 0; i < n; i++) { const g = gamma(rng, alpha); xs.push(g); s += g; }
    return xs.map((x) => x / s);
}
function pickWeighted(rng, weights) {
    let total = 0;
    for (const w of weights) total += w;
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const topK = (keys, weights, k) => keys.map((key, i) => [key, weights[i]]).sort((a, b) => b[1] - a[1]).slice(0, k).map((x) => x[0]);

/**
 * simulate({ catalog, attributes, seed, nUsers, days, rho, clusters, start })
 * -> { events, users, now, meta }
 */
function simulate(opts) {
    const o = Object.assign({ seed: 1, nUsers: 600, days: 120, rho: 0.5, clusters: 8, start: Date.UTC(2026, 5, 1), quizNoise: 0.2 }, opts);
    const rng = makeRng(o.seed * 7919 + 13);
    const model = engine.createModel({ catalog: o.catalog, attributes: o.attributes, events: [], options: { mf: { enabled: false } } });
    const attrs = model.attributes;
    const items = Object.keys(o.catalog).filter((id) => {
        const p = o.catalog[id];
        return p && (p.mainImg || (p.images && p.images[0]));
    });
    const typesByGender = { men: [], women: [], kids: [] };
    items.forEach((id) => {
        const a = attrs[id];
        const gs = a.gender === 'unisex' ? ['men', 'women'] : [a.gender];
        gs.forEach((g) => { if (typesByGender[g] && !typesByGender[g].includes(a.type)) typesByGender[g].push(a.type); });
    });
    const itemPop = new Map(items.map((id) => [id, 0.6 * gaussian(rng)]));
    const clusterAffinity = [];
    for (let c = 0; c < o.clusters; c++) clusterAffinity.push(new Map(items.map((id) => [id, gaussian(rng)])));

    const users = [];
    const events = [];
    for (let n = 0; n < o.nUsers; n++) {
        const user = 'sim' + String(n + 1).padStart(4, '0');
        const gRoll = rng();
        const gender = gRoll < 0.45 ? 'men' : gRoll < 0.85 ? 'women' : 'kids';
        const styleW = dirichlet(rng, STYLES.length, 0.5);
        const colorW = dirichlet(rng, COLORS.length, 0.6);
        const types = typesByGender[gender];
        const typeW = dirichlet(rng, types.length, 0.7);
        const tierPref = gender === 'kids' ? (rng() < 0.7 ? 0 : 1) : pickWeighted(rng, [0.15, 0.4, 0.35, 0.1]);
        const cluster = Math.floor(rng() * o.clusters);
        const styleMap = Object.fromEntries(STYLES.map((s, i) => [s, styleW[i]]));
        const colorMap = Object.fromEntries(COLORS.map((c, i) => [c, colorW[i]]));
        const typeMap = Object.fromEntries(types.map((t, i) => [t, typeW[i]]));

        const utility = new Map();
        items.forEach((id) => {
            const a = attrs[id];
            let genderTerm = 0;
            if (gender === 'kids') genderTerm = a.gender === 'kids' ? 0 : -5;
            else if (a.gender === 'kids') genderTerm = -5;
            else if (a.gender !== 'unisex' && a.gender !== gender) genderTerm = -4;
            const typeScore = (typeMap[a.type] || 0) * types.length;
            const styleScore = a.styles.length ? a.styles.reduce((s, x) => s + (styleMap[x] || 0), 0) / a.styles.length * STYLES.length : 1;
            const colorScore = a.colors.length ? a.colors.reduce((s, x) => s + (colorMap[x] || 0), 0) / a.colors.length * COLORS.length : 1;
            const tier = TIERS.indexOf(a.priceTier);
            const priceTerm = tier >= 0 ? -0.7 * Math.abs(tier - tierPref) : 0;
            const attrTerm = 0.9 * Math.log1p(typeScore) + 0.7 * Math.log1p(styleScore) + 0.5 * Math.log1p(colorScore) + priceTerm;
            const collab = 1.2 * clusterAffinity[cluster].get(id);
            utility.set(id, (1 - o.rho) * attrTerm + o.rho * collab + itemPop.get(id) + genderTerm + 0.3 * gaussian(rng));
        });
        // Chuẩn hóa độ hữu dụng theo từng người dùng (chỉ trên sản phẩm hợp giới tính).
        const vals = items.map((id) => utility.get(id)).filter((v) => v > -3);
        const mu = vals.reduce((s, v) => s + v, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mu) * (v - mu), 0) / vals.length) || 1;
        const z = new Map(items.map((id) => [id, (utility.get(id) - mu) / sd]));

        const sessions = Math.min(30, 1 + Math.floor(Math.exp(1.2 + 0.8 * gaussian(rng))));
        const baseLogit = items.map((id) => Math.min(30, z.get(id) / 0.7));
        const sessionTimes = Array.from({ length: sessions }, () => o.start + rng() * o.days * DAY).sort((a, b) => a - b);
        const viewedBefore = new Set();
        for (let s = 0; s < sessions; s++) {
            let t = sessionTimes[s];
            // Ý định của phiên: 70% phiên tìm một loại sản phẩm cụ thể; sản phẩm đã xem trước đó dễ được xem lại.
            const intent = rng() < 0.7 ? types[pickWeighted(rng, typeW)] : null;
            const weights = items.map((id, i) => Math.exp(baseLogit[i] + (intent && attrs[id].type === intent ? 1.5 : 0) + (viewedBefore.has(id) ? 1.0 : 0)));
            const views = 2 + Math.floor(rng() * 6);
            for (let v = 0; v < views; v++) {
                const id = items[pickWeighted(rng, weights)];
                viewedBefore.add(id);
                const zu = z.get(id);
                t += (1 + rng() * 4) * 60000;
                events.push({ user, item: id, type: 'view', ts: t });
                if (rng() < 0.05) events.push({ user, item: id, type: 'rating', value: clampStar(3 + 0.9 * zu + 0.6 * gaussian(rng)), ts: t + 1000 });
                if (rng() < 0.25 * sigmoid(2 * zu - 3)) events.push({ user, item: id, type: 'wishlist', value: 1, ts: t + 2000 });
                if (rng() < sigmoid(2 * zu - 3)) {
                    events.push({ user, item: id, type: 'cart', value: 1, ts: t + 3000 });
                    if (rng() < 0.55) {
                        events.push({ user, item: id, type: 'purchase', ts: t + 60000 });
                        if (rng() < 0.45) {
                            const satisfaction = zu + 0.5 * gaussian(rng);
                            const stars = clampStar(3 + 0.9 * satisfaction + 0.6 * gaussian(rng));
                            const review = { user, item: id, type: 'rating', value: stars, ts: t + 3 * DAY };
                            if (rng() < 0.6) {
                                let level = satisfaction < -0.8 ? 0 : satisfaction < -0.2 ? 1 : satisfaction < 0.4 ? 2 : satisfaction < 1.2 ? 3 : 4;
                                if (rng() < 0.1) level = Math.max(0, Math.min(4, level + (rng() < 0.5 ? -1 : 1)));
                                const pool = REVIEW_TEMPLATES[level];
                                review.text = pool[Math.floor(rng() * pool.length)];
                                review.sentiment = sentiment.analyze(review.text).score;
                            }
                            events.push(review);
                        }
                    }
                }
            }
        }
        const noisy = (value, alternatives) => (rng() < o.quizNoise ? alternatives[Math.floor(rng() * alternatives.length)] : value);
        users.push({
            id: user, gender, cluster,
            quiz: {
                gender: noisy(gender, ['men', 'women', 'kids']),
                styles: topK(STYLES, styleW, 2).map((x) => noisy(x, STYLES)),
                colors: topK(COLORS, colorW, 2).map((x) => noisy(x, COLORS)),
                types: topK(types, typeW, 2).map((x) => noisy(x, types)),
                budget: noisy(TIERS[tierPref], TIERS)
            }
        });
    }
    events.sort((a, b) => a.ts - b.ts);
    return { events, users, now: o.start + o.days * DAY, start: o.start, meta: { seed: o.seed, nUsers: o.nUsers, days: o.days, rho: o.rho, clusters: o.clusters, items: items.length } };
}
function clampStar(x) { return Math.max(1, Math.min(5, Math.round(x))); }

module.exports = { simulate, REVIEW_TEMPLATES };
