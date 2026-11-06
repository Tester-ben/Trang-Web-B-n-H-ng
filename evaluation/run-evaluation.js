#!/usr/bin/env node
/* =============================================================================
   Thực nghiệm offline cho hệ gợi ý THE STYLE HUB
   -----------------------------------------------------------------------------
   Chạy:  npm run evaluate                  (dữ liệu mô phỏng, 3 seed, ~1-2 phút)
          npm run evaluate -- --quick       (1 seed, 300 người dùng — kiểm tra nhanh)
          npm run evaluate -- --data=server (dữ liệu thật từ server/data/stylehub.db)
          npm run evaluate -- --data=csv:duong_dan.csv  (cột: user_id,item_id,event_type,value,timestamp)

   Giao thức: tách theo THỜI GIAN (không rò rỉ tương lai).
     - Validation: huấn luyện < ngày 90, đánh giá các lượt mua/đánh giá >= 4 sao trong [90, 105)
       -> dùng để tinh chỉnh trọng số hybrid (grid search thô -> mịn) và λ của MMR.
     - Test: huấn luyện < ngày 105, đánh giá trong [105, 120) -> số liệu báo cáo.
   Mọi thuật toán phải trả về đủ K sản phẩm; chỗ trống được lấp bằng độ phổ biến.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const engine = require('../recommender/engine');
const { loadCatalog, loadAttributes, ROOT } = require('../recommender/load-catalog');
const { simulate } = require('./simulate');
const { createLegacyModel } = require('./legacy-v1');
const M = require('./metrics');

const DAY = 86400000;
const K = 10;
const COMPONENTS = ['session', 'cb', 'ucf', 'icf', 'mf', 'pop'];
// Trọng số đặt tay ban đầu (trước khi tinh chỉnh) — giữ cố định để so sánh, không phụ thuộc giá trị mặc định hiện tại của engine.
const INITIAL_WEIGHTS = { session: 0.25, cb: 0.25, ucf: 0.2, icf: 0.15, mf: 0.1, pop: 0.05 };

function parseArgs(argv) {
    const args = { data: 'simulated', seeds: 3, users: 600, quick: false, out: null };
    for (const a of argv.slice(2)) {
        if (a === '--quick') args.quick = true;
        else if (a.startsWith('--data=')) args.data = a.slice(7);
        else if (a.startsWith('--seeds=')) args.seeds = Math.max(1, Number(a.slice(8)) || 1);
        else if (a.startsWith('--users=')) args.users = Math.max(3, Number(a.slice(8)) || 600);
        else if (a.startsWith('--out=')) args.out = a.slice(6);
    }
    if (args.quick) { args.seeds = 1; args.users = Math.min(args.users, 300); }
    return args;
}

const log = (...xs) => { if (!process.env.STYLEHUB_EVAL_SILENT) console.log(...xs); };

/* ---------------- Tách dữ liệu ---------------- */
function targetsIn(events, from, to) {
    const truth = new Map();
    for (const e of events) {
        if (e.ts < from || e.ts >= to) continue;
        const positive = e.type === 'purchase' || ((e.type === 'rating' || e.type === 'review') && Number(e.value) >= 4);
        if (!positive) continue;
        const u = String(e.user);
        if (!truth.has(u)) truth.set(u, new Set());
        truth.get(u).add(e.item);
    }
    return truth;
}

function buildSplit(dataset, cutoff, end, options) {
    const train = dataset.events.filter((e) => e.ts < cutoff);
    const truthAll = targetsIn(dataset.events, cutoff, end);
    const model = engine.createModel({
        catalog: dataset.catalog, attributes: dataset.attributes, events: train, now: cutoff,
        options: options || {}, isAvailable: () => true
    });
    // Bỏ mục tiêu là sản phẩm người dùng đã mua trong tập huấn luyện (hệ thống không gợi ý lại hàng đã mua).
    const truth = new Map();
    truthAll.forEach((items, user) => {
        const ud = model.userData(user);
        const filtered = new Set([...items].filter((id) => !(ud && ud.items.get(id) && ud.items.get(id).purchased)));
        if (filtered.size) truth.set(user, filtered);
    });
    return { train, truth, model, cutoff, end, nTrainUsers: new Set(train.map((e) => String(e.user))).size };
}

/* ---------------- Xếp hạng ---------------- */
function rankHybrid(split, comp, weights, opts) {
    const model = split.model;
    const useCold = opts && opts.coldWeights && comp.positives <= model.options.coldStartThreshold;
    const ranked = model.rankFromComponents(comp, useCold ? opts.coldWeights : weights).ranked;
    const list = opts && opts.lambda !== undefined && opts.lambda < 1 ? model.mmr(ranked, K, opts.lambda) : ranked.slice(0, K);
    return list.map((r) => r.id);
}

function evaluateLists(split, listsByUser) {
    const model = split.model;
    const perUser = { p5: [], r5: [], n5: [], p10: [], r10: [], n10: [], hr10: [], mrr10: [], ild10: [], nov10: [] };
    const users = [];
    const covered = new Set();
    listsByUser.forEach((list, user) => {
        const truth = split.truth.get(user);
        if (!truth) return;
        users.push(user);
        perUser.p5.push(M.precisionAtK(list, truth, 5));
        perUser.r5.push(M.recallAtK(list, truth, 5));
        perUser.n5.push(M.ndcgAtK(list, truth, 5));
        perUser.p10.push(M.precisionAtK(list, truth, 10));
        perUser.r10.push(M.recallAtK(list, truth, 10));
        perUser.n10.push(M.ndcgAtK(list, truth, 10));
        perUser.hr10.push(M.hitRateAtK(list, truth, 10));
        perUser.mrr10.push(M.mrrAtK(list, truth, 10));
        perUser.ild10.push(M.intraListDiversity(list, model.contentSim, 10));
        perUser.nov10.push(M.novelty(list, model.popularityCount, split.nTrainUsers, 10));
        list.slice(0, 10).forEach((id) => covered.add(id));
    });
    const summary = {};
    Object.keys(perUser).forEach((k) => { summary[k] = M.mean(perUser[k]); });
    summary.coverage10 = covered.size / Object.keys(split.model.attributes).length;
    summary.users = users.length;
    return { summary, perUser, users };
}

function runAlgorithms(split, dataset, algos, seed) {
    const results = {};
    const users = [...split.truth.keys()];
    const comps = new Map();
    const compFor = (u, quiz) => {
        const key = u + (quiz ? '|q' : '');
        if (!comps.has(key)) comps.set(key, split.model.componentScores(u, { context: 'home', checkAvailability: false, quiz }));
        return comps.get(key);
    };
    let legacy = null;
    const rng = engine.mulberry32(seed * 31 + 7);
    for (const algo of algos) {
        const lists = new Map();
        for (const u of users) {
            let list;
            if (algo.type === 'random') {
                const c = compFor(u).candidates.slice();
                for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
                list = c.slice(0, K);
            } else if (algo.type === 'legacy') {
                if (!legacy) legacy = createLegacyModel({ catalog: dataset.catalog, events: split.train, now: split.cutoff, isAvailable: () => true });
                list = legacy.recommendHome(u, K).map((r) => r.id);
            } else {
                const quiz = algo.useQuiz && dataset.quizByUser ? dataset.quizByUser.get(u) : undefined;
                list = rankHybrid(split, compFor(u, quiz), algo.weights, { lambda: algo.lambda, coldWeights: algo.coldWeights });
            }
            lists.set(u, list);
        }
        results[algo.name] = evaluateLists(split, lists);
    }
    return results;
}

/* ---------------- Mô phỏng người dùng mới (cold-start) ----------------
   Chọn ngẫu nhiên 30% người dùng có mục tiêu trong cửa sổ đánh giá, cắt lịch sử huấn luyện của họ
   còn 0 hoặc 2 sự kiện đầu tiên (một nửa mỗi loại), huấn luyện lại mô hình rồi chỉ đánh giá nhóm này. */
function buildColdSplit(dataset, cutoff, end, seed, fraction) {
    const rng = engine.mulberry32(seed * 977 + 3);
    const candidates = [...targetsIn(dataset.events, cutoff, end).keys()].sort();
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const cold = new Map(candidates.slice(0, Math.max(1, Math.round(candidates.length * (fraction || 0.3)))).map((u, i) => [u, i % 2 ? 2 : 0]));
    const kept = new Map();
    const truncated = dataset.events.filter((e) => {
        if (e.ts >= cutoff) return true;
        const u = String(e.user);
        if (!cold.has(u)) return true;
        const n = kept.get(u) || 0;
        if (n >= cold.get(u)) return false;
        kept.set(u, n + 1);
        return true;
    });
    const split = buildSplit(Object.assign({}, dataset, { events: truncated }), cutoff, end);
    const truth = new Map();
    split.truth.forEach((items, u) => { if (cold.has(u)) truth.set(u, items); });
    split.truth = truth;
    return split;
}

/* ---------------- Grid search trọng số hybrid ---------------- */
function compositions(total, parts) {
    if (parts === 1) return [[total]];
    const out = [];
    for (let i = 0; i <= total; i++) compositions(total - i, parts - 1).forEach((rest) => out.push([i].concat(rest)));
    return out;
}

function tuneWeights(split, quizByUser) {
    const model = split.model;
    const users = [...split.truth.keys()];
    const prepared = users.map((u) => {
        const quiz = quizByUser ? quizByUser.get(u) : undefined;
        const comp = model.componentScores(u, { context: 'home', checkAvailability: false, quiz });
        const n = comp.candidates.length;
        const arrays = {};
        COMPONENTS.forEach((k) => {
            const a = new Float64Array(n);
            const m = comp.normalized[k];
            if (m) comp.candidates.forEach((id, i) => { a[i] = m.get(id) || 0; });
            arrays[k] = a;
        });
        const tie = new Float64Array(n), gate = new Float64Array(n);
        let maxPop = 0;
        comp.candidates.forEach((id) => { maxPop = Math.max(maxPop, model.popularity(id)); });
        comp.candidates.forEach((id, i) => {
            const g = comp.gate.has(id) ? comp.gate.get(id) : 1;
            gate[i] = g;
            tie[i] = maxPop ? 1e-9 * g * model.popularity(id) / maxPop : 0;
        });
        return { comp, arrays, tie, gate, truth: split.truth.get(u) };
    });
    const scoreWeights = (weights) => {
        let total = 0;
        for (const p of prepared) {
            const w = model.adaptiveWeights(weights, p.comp.positives, p.comp.available);
            const keys = Object.keys(w);
            const n = p.comp.candidates.length;
            const top = []; // [score, index] giữ 10 phần tử lớn nhất
            for (let i = 0; i < n; i++) {
                let s = 0;
                for (const k of keys) s += w[k] * p.arrays[k][i];
                s = s * p.gate[i] + p.tie[i];
                if (top.length < K) { top.push([s, i]); if (top.length === K) top.sort((a, b) => a[0] - b[0]); }
                else if (s > top[0][0]) { top[0] = [s, i]; top.sort((a, b) => a[0] - b[0]); }
            }
            top.sort((a, b) => b[0] - a[0]);
            total += M.ndcgAtK(top.map((t) => p.comp.candidates[t[1]]), p.truth, K);
        }
        return prepared.length ? total / prepared.length : 0;
    };
    const toWeights = (vec, unit) => Object.fromEntries(COMPONENTS.map((k, i) => [k, Number((vec[i] * unit).toFixed(4))]));
    let best = null;
    // Lưới thô bước 0.2
    for (const vec of compositions(5, COMPONENTS.length)) {
        const w = toWeights(vec, 0.2);
        const s = scoreWeights(w);
        if (!best || s > best.score) best = { weights: w, score: s };
    }
    // Tinh chỉnh cục bộ bước 0.1 rồi 0.05 (di chuyển khối lượng giữa 2 thành phần)
    for (const step of [0.1, 0.05]) {
        let improved = true;
        while (improved) {
            improved = false;
            for (const from of COMPONENTS) for (const to of COMPONENTS) {
                if (from === to || best.weights[from] < step - 1e-9) continue;
                const w = Object.assign({}, best.weights);
                w[from] = Number((w[from] - step).toFixed(4));
                w[to] = Number((w[to] + step).toFixed(4));
                const s = scoreWeights(w);
                if (s > best.score + 1e-9) { best = { weights: w, score: s }; improved = true; }
            }
        }
    }
    return best;
}

function tuneLambda(split, weights) {
    const rows = [];
    for (const lambda of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
        const r = runAlgorithms(split, null, [{ name: 'h', weights, lambda }], 1).h.summary;
        rows.push({ lambda, ndcg10: r.n10, ild10: r.ild10, coverage10: r.coverage10 });
    }
    const base = rows[0].ndcg10;
    // Chọn λ đa dạng nhất mà NDCG@10 không giảm quá 2% so với không đa dạng hóa.
    const ok = rows.filter((r) => r.ndcg10 >= base * 0.98);
    const chosen = ok.sort((a, b) => b.ild10 - a.ild10)[0] || rows[0];
    return { chosen: chosen.lambda, rows };
}

/* ---------------- Dữ liệu ---------------- */
function simulatedDataset(catalog, attributes, seed, nUsers, rho) {
    const sim = simulate({ catalog, attributes, seed, nUsers, rho });
    return {
        kind: 'simulated', catalog, attributes, events: sim.events, start: sim.start, now: sim.now,
        quizByUser: new Map(sim.users.map((u) => [u.id, u.quiz])), meta: sim.meta
    };
}

function realDataset(spec, catalog, attributes) {
    let events = [];
    if (spec === 'server') {
        const dbPath = process.env.STYLEHUB_DB || path.join(ROOT, 'server', 'data', 'stylehub.db');
        const { exportEvents } = require('../server/db');
        events = exportEvents(dbPath).filter((e) => !e.demo || process.env.STYLEHUB_EVAL_INCLUDE_DEMO);
    } else if (spec.startsWith('csv:')) {
        const lines = fs.readFileSync(spec.slice(4), 'utf8').split(/\r?\n/).filter(Boolean);
        const header = lines.shift().split(',').map((s) => s.trim());
        const idx = (name) => header.indexOf(name);
        for (const line of lines) {
            const cols = line.split(',');
            const ts = isNaN(Number(cols[idx('timestamp')])) ? Date.parse(cols[idx('timestamp')]) : Number(cols[idx('timestamp')]);
            events.push({ user: cols[idx('user_id')], item: cols[idx('item_id')], type: cols[idx('event_type')], value: cols[idx('value')] === '' ? undefined : Number(cols[idx('value')]), ts });
        }
    } else throw new Error('Nguồn dữ liệu không hỗ trợ: ' + spec);
    events = events.filter((e) => catalog[e.item] && Number.isFinite(e.ts)).sort((a, b) => a.ts - b.ts);
    if (events.length < 50) throw new Error('Dữ liệu thật quá ít để đánh giá (' + events.length + ' sự kiện). Cần >= 50.');
    return { kind: 'real', catalog, attributes, events, start: events[0].ts, now: events[events.length - 1].ts + 1, quizByUser: null, meta: { events: events.length } };
}

/* ---------------- Báo cáo ---------------- */
const pct = (x) => (x * 100).toFixed(2);
const f3 = (x) => x.toFixed(3);

function aggregate(perSeed) {
    const names = Object.keys(perSeed[0]);
    const out = {};
    names.forEach((name) => {
        const keys = Object.keys(perSeed[0][name].summary);
        out[name] = {};
        keys.forEach((k) => {
            const xs = perSeed.map((r) => r[name].summary[k]);
            out[name][k] = { mean: M.mean(xs), std: M.std(xs) };
        });
    });
    return out;
}

function markdownReport(R) {
    const L = [];
    L.push('# Kết quả thực nghiệm hệ gợi ý — THE STYLE HUB');
    L.push('');
    L.push('> Tự động sinh bởi `npm run evaluate` lúc ' + R.generatedAt + '. Không sửa tay — chạy lại lệnh để cập nhật.');
    L.push('');
    if (R.dataKind === 'simulated') {
        L.push('**Nguồn dữ liệu: MÔ PHỎNG** (' + R.config.users + ' người dùng × ' + R.config.items + ' sản phẩm thật, 120 ngày, ' + R.config.seeds + ' seed, ρ = 0.5). ' +
            'Dữ liệu được sinh bởi `evaluation/simulate.js` theo mô hình độ hữu dụng có cả phần thuộc tính (content) và phần "gu cụm" ẩn (collaborative). ' +
            'Kết quả chứng minh cài đặt đúng và so sánh tương đối giữa thuật toán **dưới giả định của bộ mô phỏng**; cần đánh giá lại trên dữ liệu thật bằng `npm run evaluate -- --data=server`.');
    } else {
        L.push('**Nguồn dữ liệu: THẬT** (' + R.config.events + ' sự kiện).');
    }
    L.push('');
    L.push('## 1. Giao thức');
    L.push('');
    L.push('- Tách theo thời gian: validation (train < ngày 90, đánh giá [90,105)), test (train < ngày 105, đánh giá [105,120)). Không dùng dữ liệu tương lai.');
    L.push('- Mục tiêu (ground truth): sản phẩm được **mua** hoặc **đánh giá ≥ 4 sao** trong cửa sổ đánh giá, bỏ các sản phẩm người dùng đã mua trước đó.');
    L.push('- Mỗi thuật toán trả về đủ K = 10 sản phẩm (chỗ trống lấp bằng độ phổ biến). Độ đo: Precision/Recall/NDCG@K, HitRate@10, MRR@10, Coverage@10, ILD@10 (đa dạng), Novelty@10 (độ mới).');
    L.push('- Trọng số hybrid được tinh chỉnh bằng grid search (bước 0.2 → 0.1 → 0.05) tối đa NDCG@10 trên **validation**, sau đó mới chạy trên **test**.');
    L.push('');
    L.push('## 2. So sánh thuật toán (tập test, trung bình ± độ lệch chuẩn giữa các seed)');
    L.push('');
    L.push('| Thuật toán | P@5 (%) | R@5 (%) | NDCG@5 | P@10 (%) | R@10 (%) | NDCG@10 | HR@10 (%) | MRR@10 | Coverage@10 (%) | ILD@10 | Novelty@10 |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    Object.entries(R.main).forEach(([name, m]) => {
        L.push('| ' + name + ' | ' + pct(m.p5.mean) + ' | ' + pct(m.r5.mean) + ' | ' + f3(m.n5.mean) + ' | ' + pct(m.p10.mean) + ' | ' + pct(m.r10.mean) +
            ' | **' + f3(m.n10.mean) + '** ± ' + f3(m.n10.std) + ' | ' + pct(m.hr10.mean) + ' | ' + f3(m.mrr10.mean) + ' | ' + pct(m.coverage10.mean) + ' | ' + f3(m.ild10.mean) + ' | ' + m.nov10.mean.toFixed(2) + ' |');
    });
    L.push('');
    L.push('Số người dùng được đánh giá mỗi seed: ' + R.evaluatedUsers.join(', ') + '. Lưu ý: "Thuật toán cũ (v1)" ở đây được đánh giá trong điều kiện **có lợi** — nó được thấy hành vi của toàn bộ người dùng như thể cùng một trình duyệt; trong website cũ, nó chỉ thấy các tài khoản trên cùng trình duyệt (xem mục 7).');
    L.push('');
    const leg = R.main['Thuật toán cũ (v1)'], hyb = R.main['Hybrid v2 (tinh chỉnh)'];
    if (leg && hyb && leg.n10.mean > 0) {
        L.push('**So với thuật toán cũ:** NDCG@10 ' + f3(leg.n10.mean) + ' → ' + f3(hyb.n10.mean) + ' (' + (hyb.n10.mean >= leg.n10.mean ? '+' : '') + ((hyb.n10.mean / leg.n10.mean - 1) * 100).toFixed(1) + '%), ' +
            'Recall@10 ' + pct(leg.r10.mean) + '% → ' + pct(hyb.r10.mean) + '%, HitRate@10 ' + pct(leg.hr10.mean) + '% → ' + pct(hyb.hr10.mean) + '%, độ đa dạng ILD@10 ' + f3(leg.ild10.mean) + ' → ' + f3(hyb.ild10.mean) + '. ' +
            'Đánh đổi: độ phủ danh mục Coverage@10 ' + pct(leg.coverage10.mean) + '% → ' + pct(hyb.coverage10.mean) + '% (bản cũ phủ rộng vì gần như chỉ dựa vào nội dung nhưng độ chính xác thấp).');
        L.push('');
        L.push('Hybrid tinh chỉnh **ngang bằng** thành phần đơn lẻ tốt nhất ở cấu hình mặc định (khác biệt không có ý nghĩa thống kê, xem bảng dưới); lợi thế của hybrid nằm ở **độ bền** khi bản chất dữ liệu thay đổi (mục 6), khi ít người dùng (mục 7) và với người dùng mới (mục 4). Trọng số giữa các thành phần cộng tác (ucf/icf/mf) dao động giữa các seed vì chúng mang thông tin tương tự nhau (đa cộng tuyến); tổng trọng số nhóm cộng tác luôn chiếm phần lớn.');
        L.push('');
    }
    L.push('### Kiểm định ý nghĩa thống kê (paired permutation test, 10.000 hoán vị, NDCG@10 theo từng người dùng, gộp các seed)');
    L.push('');
    L.push('| So sánh | Chênh lệch TB NDCG@10 | p-value |');
    L.push('|---|---|---|');
    R.significance.forEach((s) => L.push('| ' + s.label + ' | ' + (s.meanDiff >= 0 ? '+' : '') + s.meanDiff.toFixed(4) + ' | ' + (s.pValue < 0.001 ? '< 0.001' : s.pValue.toFixed(4)) + ' |'));
    L.push('');
    L.push('### Trọng số hybrid sau tinh chỉnh (theo từng seed) và giá trị mặc định đưa vào engine');
    L.push('');
    L.push('| Seed | ' + COMPONENTS.join(' | ') + ' | NDCG@10 (validation) |');
    L.push('|---|' + COMPONENTS.map(() => '---').join('|') + '|---|');
    R.tuned.forEach((t) => L.push('| ' + t.seed + ' | ' + COMPONENTS.map((k) => t.weights[k].toFixed(2)).join(' | ') + ' | ' + f3(t.score) + ' |'));
    L.push('| **Mặc định người dùng cũ (trung bình)** | ' + COMPONENTS.map((k) => R.defaultWeights[k].toFixed(2)).join(' | ') + ' | |');
    if (R.coldWeights) {
        R.tunedCold.forEach((t) => L.push('| cold-start seed ' + t.seed + ' | ' + COMPONENTS.map((k) => t.weights[k].toFixed(2)).join(' | ') + ' | ' + f3(t.score) + ' |'));
        L.push('| **Mặc định người dùng mới (≤ 2 tương tác, có quiz)** | ' + COMPONENTS.map((k) => R.coldWeights[k].toFixed(2)).join(' | ') + ' | |');
    }
    L.push('');
    L.push('Ký hiệu: session = tương tự sản phẩm vừa xem, cb = content-based, ucf = user-based CF, icf = item-based CF, mf = BPR, pop = xu hướng.');
    L.push('');
    if (R.lambda) {
        L.push('## 3. Đánh đổi chính xác – đa dạng (MMR, validation seed ' + R.config.firstSeed + ')');
        L.push('');
        L.push('| λ | NDCG@10 | ILD@10 | Coverage@10 (%) |');
        L.push('|---|---|---|---|');
        R.lambda.rows.forEach((r) => L.push('| ' + r.lambda + (r.lambda === R.lambda.chosen ? ' (chọn)' : '') + ' | ' + f3(r.ndcg10) + ' | ' + f3(r.ild10) + ' | ' + pct(r.coverage10) + ' |'));
        L.push('');
        L.push('Quy tắc chọn: λ cho độ đa dạng cao nhất mà NDCG@10 giảm không quá 2% so với λ = 1.');
        L.push('');
    }
    if (R.coldStart) {
        L.push('## 4. Người dùng mới (cold-start: ≤ 2 tương tác dương trước thời điểm test)');
        L.push('');
        L.push('| Thuật toán | NDCG@10 | HR@10 (%) | Recall@10 (%) |');
        L.push('|---|---|---|---|');
        Object.entries(R.coldStart.results).forEach(([name, m]) => L.push('| ' + name + ' | ' + f3(m.n10.mean) + ' | ' + pct(m.hr10.mean) + ' | ' + pct(m.r10.mean) + ' |'));
        L.push('');
        L.push('Giao thức: chọn ngẫu nhiên 30% người dùng có mục tiêu trong cửa sổ test, cắt lịch sử của họ còn 0 hoặc 2 sự kiện đầu tiên rồi huấn luyện lại. Số người dùng mới được đánh giá mỗi seed: ' + R.coldStart.users.join(', ') + '. Câu trả lời quiz mô phỏng có nhiễu 20%. "Switching" = người dùng ≤ 2 tương tác dùng bộ trọng số cold-start tinh chỉnh riêng trên validation.');
        L.push('');
    }
    if (R.sentiment) {
        L.push('## 5. Ablation: điều chỉnh điểm đánh giá bằng cảm xúc bình luận');
        L.push('');
        L.push('| Cấu hình | NDCG@10 | Recall@10 (%) |');
        L.push('|---|---|---|');
        R.sentiment.forEach((r) => L.push('| ' + r.label + ' | ' + f3(r.n10) + ' | ' + pct(r.r10) + ' |'));
        L.push('');
    }
    if (R.rho) {
        L.push('## 6. Độ nhạy theo cơ chế sinh dữ liệu (ρ = tỉ trọng "gu cụm" ẩn; seed ' + R.config.firstSeed + ')');
        L.push('');
        const names = Object.keys(R.rho[0].results);
        L.push('| ρ | ' + names.join(' | ') + ' |');
        L.push('|---|' + names.map(() => '---').join('|') + '|');
        R.rho.forEach((row) => L.push('| ' + row.rho + ' | ' + names.map((n) => f3(row.results[n])).join(' | ') + ' |'));
        L.push('');
        L.push('Giá trị là NDCG@10. ρ = 0: sở thích hoàn toàn giải thích được bằng thuộc tính (Content-based có lợi); ρ = 1: chỉ có tương quan ẩn giữa người dùng (Collaborative có lợi).');
        L.push('');
        L.push('Trọng số tối ưu tìm được cho từng ρ (cho thấy hỗn hợp tối ưu dịch chuyển theo bản chất dữ liệu — lý do phải tinh chỉnh lại trên dữ liệu thật):');
        L.push('');
        L.push('| ρ | ' + COMPONENTS.join(' | ') + ' |');
        L.push('|---|' + COMPONENTS.map(() => '---').join('|') + '|');
        R.rho.forEach((row) => L.push('| ' + row.rho + ' | ' + COMPONENTS.map((k) => (row.weights[k] || 0).toFixed(2)).join(' | ') + ' |'));
        L.push('');
    }
    if (R.size) {
        L.push('## 7. Ảnh hưởng của số lượng người dùng (vì sao cần dữ liệu tập trung trên máy chủ)');
        L.push('');
        const names = Object.keys(R.size[0].results);
        L.push('| Số người dùng | Được đánh giá | ' + names.join(' | ') + ' |');
        L.push('|---|---|' + names.map(() => '---').join('|') + '|');
        R.size.forEach((row) => L.push('| ' + row.users + ' | ' + row.evaluated + ' | ' + (row.evaluated ? names.map((n) => f3(row.results[n])).join(' | ') : names.map(() => 'n/a').join(' | ')) + ' |'));
        L.push('');
        L.push('Giá trị là NDCG@10 trên test. Bản cũ chỉ thấy các tài khoản trên **cùng một trình duyệt** (thường 1–3 người) nên phần cộng tác gần như không hoạt động; backend mới gom hành vi của mọi người dùng.');
        L.push('');
    }
    L.push('## Hạn chế');
    L.push('');
    L.push('- Dữ liệu mô phỏng phản ánh giả định của người xây dựng bộ sinh; thứ hạng thuật toán có thể khác trên dữ liệu thật (xem thí nghiệm độ nhạy ρ).');
    L.push('- Bình luận mô phỏng được sinh từ các mẫu câu cùng phong cách với từ điển cảm xúc nên hiệu quả của bước cảm xúc ở đây có thể bị đánh giá cao; độ chính xác thật của module cảm xúc đo trên tập held-out là ' + (R.sentimentHeldout ? (R.sentimentHeldout * 100).toFixed(1) + '%' : 'xem tests/') + '.');
    L.push('- Đánh giá offline đo khả năng dự đoán hành vi tương lai, chưa thay thế được A/B test với người dùng thật (hệ thống đã ghi nhận impression/click để đo CTR khi triển khai).');
    L.push('');
    return L.join('\n');
}

/* ---------------- Chương trình chính ---------------- */
function main() {
    const args = parseArgs(process.argv);
    const t0 = Date.now();
    const catalog = loadCatalog();
    const attributes = loadAttributes();
    const seeds = Array.from({ length: args.seeds }, (_, i) => i + 1);
    const R = { generatedAt: new Date().toISOString(), dataKind: args.data === 'simulated' ? 'simulated' : 'real', config: { seeds: seeds.length, users: args.users, items: Object.keys(catalog).length, firstSeed: seeds[0] } };

    const baseAlgos = (tunedWeights, lambda, coldWeights) => [
        { name: 'Ngẫu nhiên', type: 'random' },
        { name: 'Phổ biến (Popularity)', weights: { pop: 1 } },
        { name: 'Thuật toán cũ (v1)', type: 'legacy' },
        { name: 'Content-based (TF-IDF)', weights: { cb: 1 } },
        { name: 'Xem gần đây (session)', weights: { session: 1 } },
        { name: 'User-based CF (k-NN)', weights: { ucf: 1 } },
        { name: 'Item-based CF (k-NN)', weights: { icf: 1 } },
        { name: 'Matrix Factorization (BPR)', weights: { mf: 1 } },
        { name: 'Hybrid v2 (trọng số ban đầu)', weights: INITIAL_WEIGHTS },
        { name: 'Hybrid v2 (tinh chỉnh)', weights: tunedWeights, coldWeights },
        { name: 'Hybrid v2 (tinh chỉnh) + MMR', weights: tunedWeights, lambda, coldWeights }
    ];

    const perSeed = [], tuned = [], tunedCold = [], pooled = {}, coldPerSeed = [], coldUsers = [], sentimentRows = { on: [], off: [] };
    R.evaluatedUsers = [];
    let lambdaInfo = null;
    const datasets = [];
    if (args.data === 'simulated') {
        for (const seed of seeds) datasets.push({ seed, ds: simulatedDataset(catalog, attributes, seed, args.users, 0.5) });
    } else {
        const ds = realDataset(args.data, catalog, attributes);
        datasets.push({ seed: 1, ds });
        R.config.events = ds.events.length;
    }

    for (const { seed, ds } of datasets) {
        const span = ds.now - ds.start;
        const cutVal = ds.kind === 'simulated' ? ds.start + 90 * DAY : ds.start + 0.7 * span;
        const cutTest = ds.kind === 'simulated' ? ds.start + 105 * DAY : ds.start + 0.85 * span;
        const end = ds.now + 1;
        log('[seed ' + seed + '] ' + ds.events.length + ' sự kiện — tinh chỉnh trên validation...');
        const val = buildSplit(ds, cutVal, cutTest);
        const best = tuneWeights(val);
        let bestCold = null;
        if (ds.kind === 'simulated') {
            bestCold = tuneWeights(buildColdSplit(ds, cutVal, cutTest, seed, 0.5), ds.quizByUser);
            tunedCold.push({ seed, weights: bestCold.weights, score: bestCold.score });
        }
        tuned.push({ seed, weights: best.weights, score: best.score });
        if (!lambdaInfo) lambdaInfo = tuneLambda(val, best.weights);
        log('[seed ' + seed + '] trọng số tốt nhất', JSON.stringify(best.weights), 'NDCG@10(val)=' + best.score.toFixed(4),
            bestCold ? '| cold-start ' + JSON.stringify(bestCold.weights) + ' NDCG@10(val)=' + bestCold.score.toFixed(4) : '', '— đánh giá test...');
        const test = buildSplit(ds, cutTest, end);
        const res = runAlgorithms(test, ds, baseAlgos(best.weights, lambdaInfo.chosen, bestCold ? bestCold.weights : undefined), seed);
        perSeed.push(res);
        R.evaluatedUsers.push(res['Ngẫu nhiên'].summary.users);
        Object.entries(res).forEach(([name, r]) => { pooled[name] = (pooled[name] || []).concat(r.perUser.n10); });

        if (ds.kind === 'simulated') {
            // Cold-start (người dùng mới mô phỏng bằng cách cắt lịch sử)
            const coldSplit = buildColdSplit(ds, cutTest, end, seed + 100, 0.3);
            coldUsers.push(coldSplit.truth.size);
            coldPerSeed.push(runAlgorithms(coldSplit, ds, [
                { name: 'Phổ biến (Popularity)', weights: { pop: 1 } },
                { name: 'Thuật toán cũ (v1)', type: 'legacy' },
                { name: 'Content-based (không quiz)', weights: { cb: 1 } },
                { name: 'Content-based + quiz Style DNA', weights: { cb: 1 }, useQuiz: true },
                { name: 'Hybrid (trọng số người dùng cũ, không switching)', weights: best.weights },
                { name: 'Hybrid switching (không quiz)', weights: best.weights, coldWeights: bestCold.weights },
                { name: 'Hybrid switching + quiz Style DNA', weights: best.weights, coldWeights: bestCold.weights, useQuiz: true }
            ], seed));
            // Ablation cảm xúc
            const noSent = buildSplit(ds, cutTest, end, { sentimentMix: 0 });
            const a = runAlgorithms(noSent, ds, [{ name: 'h', weights: best.weights }], seed).h.summary;
            const b = res['Hybrid v2 (tinh chỉnh)'].summary;
            sentimentRows.off.push(a); sentimentRows.on.push(b);
        }
    }

    R.main = aggregate(perSeed);
    R.tuned = tuned;
    R.defaultWeights = Object.fromEntries(COMPONENTS.map((k) => [k, Number((M.mean(tuned.map((t) => t.weights[k]))).toFixed(2))]));
    R.tunedCold = tunedCold;
    R.coldWeights = tunedCold.length ? Object.fromEntries(COMPONENTS.map((k) => [k, Number((M.mean(tunedCold.map((t) => t.weights[k]))).toFixed(2))])) : null;
    R.lambda = lambdaInfo;

    // Ý nghĩa thống kê
    const rng = engine.mulberry32(2026);
    const singles = ['Content-based (TF-IDF)', 'Xem gần đây (session)', 'User-based CF (k-NN)', 'Item-based CF (k-NN)', 'Matrix Factorization (BPR)', 'Phổ biến (Popularity)'];
    const bestSingle = singles.slice().sort((a, b) => R.main[b].n10.mean - R.main[a].n10.mean)[0];
    R.significance = [
        { label: 'Hybrid v2 (tinh chỉnh) vs ' + bestSingle + ' (đơn lẻ tốt nhất)', ...M.pairedPermutationTest(pooled['Hybrid v2 (tinh chỉnh)'], pooled[bestSingle], 10000, rng) },
        { label: 'Hybrid v2 (tinh chỉnh) vs Thuật toán cũ (v1)', ...M.pairedPermutationTest(pooled['Hybrid v2 (tinh chỉnh)'], pooled['Thuật toán cũ (v1)'], 10000, rng) },
        { label: 'Hybrid v2 (tinh chỉnh) vs Hybrid v2 (trọng số ban đầu)', ...M.pairedPermutationTest(pooled['Hybrid v2 (tinh chỉnh)'], pooled['Hybrid v2 (trọng số ban đầu)'], 10000, rng) }
    ];

    if (args.data === 'simulated') {
        R.coldStart = { results: aggregate(coldPerSeed), users: coldUsers };
        R.sentiment = [
            { label: 'Hybrid v2 — có điều chỉnh theo cảm xúc (μ = 0.3)', n10: M.mean(sentimentRows.on.map((x) => x.n10)), r10: M.mean(sentimentRows.on.map((x) => x.r10)) },
            { label: 'Hybrid v2 — chỉ dùng số sao (μ = 0)', n10: M.mean(sentimentRows.off.map((x) => x.n10)), r10: M.mean(sentimentRows.off.map((x) => x.r10)) }
        ];
        const seed = seeds[0];
        const algosSmall = [
            { name: 'Phổ biến', weights: { pop: 1 } },
            { name: 'Thuật toán cũ (v1)', type: 'legacy' },
            { name: 'Content-based', weights: { cb: 1 } },
            { name: 'User-based CF', weights: { ucf: 1 } },
            { name: 'Item-based CF', weights: { icf: 1 } },
            { name: 'BPR', weights: { mf: 1 } },
            { name: 'Hybrid v2 (trọng số mặc định)', weights: R.defaultWeights }
        ];
        if (!args.quick) {
            log('Thí nghiệm độ nhạy ρ...');
            R.rho = [0, 0.25, 0.5, 0.75, 1].map((rho) => {
                const ds = simulatedDataset(catalog, attributes, seed, args.users, rho);
                const tunedRho = tuneWeights(buildSplit(ds, ds.start + 90 * DAY, ds.start + 105 * DAY)).weights;
                const test = buildSplit(ds, ds.start + 105 * DAY, ds.now + 1);
                const res = runAlgorithms(test, ds, algosSmall.concat([{ name: 'Hybrid v2 (tinh chỉnh theo ρ)', weights: tunedRho }]), seed);
                return { rho, weights: tunedRho, results: Object.fromEntries(Object.entries(res).map(([n, r]) => [n, r.summary.n10])) };
            });
            log('Thí nghiệm số lượng người dùng...');
            R.size = [3, 10, 50, 150, 300, args.users].filter((n, i, a) => a.indexOf(n) === i && n <= args.users).map((n) => {
                const ds = simulatedDataset(catalog, attributes, seed, n, 0.5);
                const test = buildSplit(ds, ds.start + 105 * DAY, ds.now + 1);
                const res = runAlgorithms(test, ds, [algosSmall[1], algosSmall[2], algosSmall[3], algosSmall[6]], seed);
                return { users: n, evaluated: res['Content-based'].summary.users, results: Object.fromEntries(Object.entries(res).map(([name, r]) => [name, r.summary.users ? r.summary.n10 : 0])) };
            });
        }
    }
    try {
        const S = require('../recommender/sentiment-vi');
        const held = require('../tests/fixtures/sentiment-vi-heldout.json').samples;
        R.sentimentHeldout = held.filter(([t, l]) => S.analyze(t).label === l).length / held.length;
    } catch (_) { /* tùy chọn */ }

    R.runtimeSeconds = Number(((Date.now() - t0) / 1000).toFixed(1));
    const outDir = args.out ? path.resolve(args.out) : path.join(ROOT, 'evaluation', 'results');
    fs.mkdirSync(outDir, { recursive: true });
    const stripped = JSON.parse(JSON.stringify(R));
    fs.writeFileSync(path.join(outDir, args.quick ? 'quick.json' : 'latest.json'), JSON.stringify(stripped, null, 2));
    if (!args.quick && args.data === 'simulated') {
        fs.writeFileSync(path.join(ROOT, 'recommender', 'tuned-weights.json'), JSON.stringify({
            _ghi_chu: 'Trọng số hybrid (ngữ cảnh trang chủ) tinh chỉnh bằng grid search trên tập validation mô phỏng; trung bình ' + seeds.length + ' seed. Sinh bởi npm run evaluate.',
            generatedAt: R.generatedAt, home: R.defaultWeights, cold: R.coldWeights, mmrLambda: lambdaInfo.chosen
        }, null, 2) + '\n');
        fs.writeFileSync(path.join(ROOT, 'docs', 'KET_QUA_THUC_NGHIEM.md'), markdownReport(R) + '\n');
    } else if (!args.quick) {
        fs.writeFileSync(path.join(outDir, 'real-data-report.md'), markdownReport(R) + '\n');
    }
    log('\nNDCG@10 (test):');
    Object.entries(R.main).forEach(([n, m]) => log('  ' + n.padEnd(34) + m.n10.mean.toFixed(4) + ' ± ' + m.n10.std.toFixed(4)));
    log('Hoàn tất sau ' + R.runtimeSeconds + 's. Kết quả: ' + path.relative(ROOT, outDir));
    return R;
}

if (require.main === module) main();
module.exports = { main, tuneWeights, buildSplit, runAlgorithms, targetsIn, compositions };
