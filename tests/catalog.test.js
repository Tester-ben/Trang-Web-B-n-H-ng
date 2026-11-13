'use strict';
/* Kiểm tra tính nhất quán dữ liệu: mọi thẻ sản phẩm viết sẵn trong các trang HTML (mens, womens,
   kids, shoes, sale, ...) phải khớp product-data.js — trang chi tiết, giỏ hàng, thanh toán và hệ gợi ý
   đều đọc product-data.js, nên thẻ lệch nghĩa là khách thấy một tên/giá nhưng mua theo tên/giá khác. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadCatalog } = require('../recommender/load-catalog');

const ROOT = path.resolve(__dirname, '..');
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const norm = (s) => decode(s).toLowerCase().replace(/\(sale\)/g, ' ').replace(/\s+/g, ' ').trim();
const firstPrice = (s) => { const m = decode(s).match(/\d{1,3}(?:\.\d{3})+|\d+/); return m ? Number(m[0].replace(/\./g, '')) : 0; };
const fileOf = (u) => decode(u).split('?')[0].split('/').pop().toLowerCase();

function staticCards() {
    const cards = [];
    for (const page of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
        const re = /<a\b[^>]*href="product-detail\.html\?id=([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(html))) {
            const body = m[2];
            const pick = (rx) => { const x = body.match(rx); return x ? decode(x[1].replace(/<[^>]+>/g, '')) : null; };
            const card = {
                page, id: m[1],
                name: pick(/class="(?:item-name|name)"[^>]*>([\s\S]*?)<\/(?:h4|h3|p|div|span)>/),
                price: pick(/class="(?:item-price|price)"[^>]*>([\s\S]*?)<\/(?:p|span|div)>/),
                brand: pick(/class="(?:tag-brand|brand)"[^>]*>([\s\S]*?)<\/(?:p|span|div)>/),
                img: (body.match(/<img[^>]*class="(?:img-front|img-main)"[^>]*src="([^"]+)"/) || [])[1] || null
            };
            if (card.name || card.price) cards.push(card); // bỏ qua liên kết chữ, chỉ xét thẻ sản phẩm
        }
    }
    return cards;
}

test('Thẻ sản phẩm trên các trang danh mục khớp product-data.js (tên, giá, thương hiệu, ảnh)', () => {
    const db = loadCatalog(ROOT);
    const cards = staticCards();
    assert.ok(cards.length > 150, 'tìm thấy ' + cards.length + ' thẻ');
    const problems = [];
    for (const c of cards) {
        const p = db[c.id];
        if (!p) { problems.push(c.page + ': ' + c.id + ' không có trong product-data.js'); continue; }
        if (c.name && norm(c.name) !== norm(p.name)) problems.push(`${c.page}: ${c.id} tên "${c.name}" ≠ "${p.name}"`);
        // Trang Sale ghi giá giảm trước, giá gốc gạch ngang sau: so giá đầu tiên.
        if (c.price && firstPrice(c.price) !== (Number(p.priceNum) || firstPrice(p.price))) problems.push(`${c.page}: ${c.id} giá ${c.price} ≠ ${p.price}`);
        if (c.brand && p.brand && norm(c.brand) !== norm(p.brand)) problems.push(`${c.page}: ${c.id} thương hiệu "${c.brand}" ≠ "${p.brand}"`);
        if (c.img && ![p.mainImg].concat(p.images || []).filter(Boolean).map(fileOf).includes(fileOf(c.img))) problems.push(`${c.page}: ${c.id} ảnh ${fileOf(c.img)} không thuộc sản phẩm`);
    }
    assert.deepEqual(problems, []);
});
