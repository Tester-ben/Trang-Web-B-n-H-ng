/* Độ đo đánh giá hệ gợi ý top-K (relevance nhị phân). */
'use strict';

function hits(rec, truth, k) {
    let h = 0;
    for (let i = 0; i < Math.min(k, rec.length); i++) if (truth.has(rec[i])) h++;
    return h;
}
const precisionAtK = (rec, truth, k) => hits(rec, truth, k) / k;
const recallAtK = (rec, truth, k) => (truth.size ? hits(rec, truth, k) / truth.size : 0);
const hitRateAtK = (rec, truth, k) => (hits(rec, truth, k) > 0 ? 1 : 0);

function ndcgAtK(rec, truth, k) {
    let dcg = 0;
    for (let i = 0; i < Math.min(k, rec.length); i++) if (truth.has(rec[i])) dcg += 1 / Math.log2(i + 2);
    let idcg = 0;
    for (let i = 0; i < Math.min(k, truth.size); i++) idcg += 1 / Math.log2(i + 2);
    return idcg ? dcg / idcg : 0;
}

function mrrAtK(rec, truth, k) {
    for (let i = 0; i < Math.min(k, rec.length); i++) if (truth.has(rec[i])) return 1 / (i + 1);
    return 0;
}

/** Độ đa dạng trong danh sách: trung bình (1 - tương đồng nội dung) giữa các cặp. */
function intraListDiversity(rec, simFn, k) {
    const list = rec.slice(0, k);
    let s = 0, n = 0;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { s += 1 - simFn(list[i], list[j]); n++; }
    return n ? s / n : 0;
}

/** Độ mới lạ: trung bình -log2(p(i)), p(i) = tỉ lệ người dùng huấn luyện từng tương tác với i (làm trơn). */
function novelty(rec, popCountFn, nUsers, k) {
    const list = rec.slice(0, k);
    if (!list.length) return 0;
    let s = 0;
    for (const id of list) s += -Math.log2((popCountFn(id) + 1) / (nUsers + 2));
    return s / list.length;
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function std(xs) {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}

/**
 * Kiểm định hoán vị dấu (paired sign-flip permutation test), hai phía.
 * H0: trung bình chênh lệch theo từng người dùng = 0.
 */
function pairedPermutationTest(a, b, iterations, rng) {
    const d = a.map((x, i) => x - b[i]);
    const observed = Math.abs(mean(d));
    let extreme = 0;
    for (let it = 0; it < iterations; it++) {
        let s = 0;
        for (let i = 0; i < d.length; i++) s += rng() < 0.5 ? d[i] : -d[i];
        if (Math.abs(s / d.length) >= observed - 1e-12) extreme++;
    }
    return { meanDiff: mean(d), pValue: (extreme + 1) / (iterations + 1) };
}

module.exports = { precisionAtK, recallAtK, hitRateAtK, ndcgAtK, mrrAtK, intraListDiversity, novelty, mean, std, pairedPermutationTest };
