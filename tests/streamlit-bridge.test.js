'use strict';
/* Kiểm thử cầu nối giữa ứng dụng Streamlit (Python) và hệ gợi ý: streamlit_app/bridge.js.
   Ứng dụng gửi một yêu cầu JSON qua stdin và đọc một kết quả JSON qua stdout. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BRIDGE = path.resolve(__dirname, '..', 'streamlit_app', 'bridge.js');
const SOURCE = { kind: 'sim', users: 120, seed: 7 };

function run(request, env) {
    const res = spawnSync(process.execPath, [BRIDGE], { input: JSON.stringify(request), encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout);
}

test('Cầu nối Streamlit: danh mục, gợi ý cá nhân, khách mới, sản phẩm tương tự và cảm xúc', () => {
    const boot = run({ cmd: 'bootstrap', source: SOURCE });
    assert.equal(boot.ok, true, boot.error);
    const ids = new Set(boot.data.catalog.map((p) => p.id));
    assert.equal(boot.data.stats.items, ids.size);
    assert.equal(boot.data.users.length, 120);
    assert.ok(boot.data.catalog.every((p) => p.name && p.image && p.departmentLabel));

    const userId = boot.data.users.slice().sort((a, b) => b.counts.purchase - a.counts.purchase)[0].id;
    const view = run({ cmd: 'user', source: SOURCE, userId, limit: 8 });
    assert.equal(view.ok, true, view.error);
    assert.equal(view.data.recommendations.length, 8);
    assert.ok(view.data.recommendations.every((r) => ids.has(r.id) && r.reason));
    assert.ok(view.data.history.length > 0 && view.data.dna.persona);
    assert.deepEqual(run({ cmd: 'user', source: SOURCE, userId, limit: 8 }).data.recommendations, view.data.recommendations, 'kết quả tất định');

    const quiz = run({ cmd: 'quiz', source: SOURCE, quiz: { gender: 'women', styles: ['minimal'], colors: ['beige'], budget: 'mid' }, limit: 6 });
    assert.equal(quiz.ok, true, quiz.error);
    const genderOf = Object.fromEntries(boot.data.catalog.map((p) => [p.id, p.gender]));
    assert.ok(quiz.data.recommendations.slice(0, 3).every((r) => ['women', 'unisex'].includes(genderOf[r.id])), 'quiz "nữ" ưu tiên đồ nữ/unisex');
    assert.ok(Array.isArray(quiz.data.notes));
    const typeOf = Object.fromEntries(boot.data.catalog.map((p) => [p.id, p.type]));
    const tees = run({ cmd: 'quiz', source: SOURCE, quiz: { gender: 'men', types: ['tee'], colors: ['white'], budget: 'luxury' }, limit: 8 });
    assert.ok(tees.data.recommendations.filter((r) => typeOf[r.id] === 'tee').length >= 5, 'khách chọn "Áo thun" thì phần lớn gợi ý là áo thun');
    assert.ok(tees.data.notes.some((n) => /màu trắng/.test(n)) && tees.data.notes.some((n) => /trên 8 triệu/.test(n)), tees.data.notes.join(' | '));
    assert.ok(tees.data.recommendations.some((r) => r.shares && r.shares.quiz > 0), 'biểu đồ có phần "khớp câu trả lời quiz"');

    const product = run({ cmd: 'product', source: SOURCE, productId: 'hoodies-3', limit: 6 });
    assert.equal(product.ok, true, product.error);
    assert.ok(product.data.similar.length === 6 && product.data.similar.every((r) => r.id !== 'hoodies-3'));
    assert.ok(product.data.outfit.length > 0 && product.data.outfit.every((o) => ids.has(o.id) && o.category !== 'top'), 'áo -> quần/giày');

    const senti = run({ cmd: 'sentiment', text: 'Áo đẹp, vải mềm, rất hài lòng', stars: 4 });
    assert.equal(senti.ok, true);
    assert.equal(senti.data.label, 'positive');
    assert.ok(Math.abs(senti.data.effective - (0.7 * 4 + 0.3 * (3 + 2 * senti.data.score))) < 1e-9);
});

test('Cầu nối Streamlit: báo lỗi rõ ràng (lệnh sai, sản phẩm không có, chưa có dữ liệu máy chủ)', () => {
    assert.match(run({ cmd: 'khong-co' }).error, /Lệnh không hợp lệ/);
    assert.match(run({ cmd: 'product', source: SOURCE, productId: 'dress-8' }).error, /Không có sản phẩm/);
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylehub-bridge-'));
    try {
        assert.match(run({ cmd: 'bootstrap', source: { kind: 'server' } }, { STYLEHUB_DATA_DIR: emptyDir }).error, /Chưa có dữ liệu máy chủ/);
    } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
    }
});
