'use strict';
/* Kiểm thử module cảm xúc tiếng Việt — chạy: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../recommender/sentiment-vi');
const dev = require('./fixtures/sentiment-vi-labeled.json').samples;
const heldout = require('./fixtures/sentiment-vi-heldout.json').samples;

function accuracy(samples) {
    let ok = 0;
    for (const [text, label] of samples) if (S.analyze(text).label === label) ok++;
    return ok / samples.length;
}

test('phủ định, nhấn mạnh và chuyển ý', () => {
    assert.equal(S.analyze('Áo đẹp').label, 'positive');
    assert.equal(S.analyze('Áo không đẹp').label, 'negative');
    assert.equal(S.analyze('Không tệ chút nào').label, 'positive');
    assert.ok(S.analyze('rất đẹp').score > S.analyze('đẹp').score);
    assert.ok(S.analyze('hơi rộng').score > S.analyze('rộng').score);
    assert.equal(S.analyze('Đẹp thì đẹp nhưng mặc một tuần đã sờn cổ').label, 'negative');
    assert.equal(S.analyze('Hơi rộng một chút nhưng chất vải đẹp, mặc vẫn ưng').label, 'positive');
});

test('không dấu và âm tiết nhập nhằng', () => {
    assert.equal(S.analyze('ao dep lam, vai min').label, 'positive');
    assert.equal(S.analyze('dat hang hom qua').label, 'neutral', '"dat" = đặt (không phải đắt)');
    assert.equal(S.analyze('vua nhan hang, chua mac thu').label, 'neutral');
    assert.equal(S.analyze('Mẫu này có đẹp không shop').label, 'neutral', 'câu hỏi có/không');
});

test('emoji', () => {
    assert.equal(S.analyze('😍😍').label, 'positive');
    assert.equal(S.analyze('👎').label, 'negative');
});

test('độ chính xác trên tập dev (dùng khi xây từ điển) >= 0.9', () => {
    const acc = accuracy(dev);
    assert.ok(acc >= 0.9, 'dev accuracy = ' + acc.toFixed(3));
});

test('độ chính xác trên tập held-out (không dùng để chỉnh luật) >= 0.75', () => {
    const acc = accuracy(heldout);
    // Báo cáo trung thực: giá trị đo được khi chốt từ điển là 0.825 (33/40).
    assert.ok(acc >= 0.75, 'held-out accuracy = ' + acc.toFixed(3));
});
