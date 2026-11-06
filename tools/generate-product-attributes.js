#!/usr/bin/env node
/* Sinh recommender/product-attributes.js: thuộc tính có cấu trúc cho từng sản phẩm.
   Nguồn = quy tắc suy luận trong recommender/engine.js (inferAttributes) + sửa tay
   trong tools/attribute-overrides.json. Chạy: npm run attributes */
'use strict';
const fs = require('fs');
const path = require('path');
const engine = require('../recommender/engine');
const { loadCatalog, ROOT } = require('../recommender/load-catalog');

const catalog = loadCatalog(ROOT);
const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, 'attribute-overrides.json'), 'utf8'));
const table = {};
for (const id of Object.keys(catalog)) {
    const a = engine.inferAttributes(id, catalog[id]);
    const fixed = overrides[id] || {};
    const entry = {
        gender: a.gender, category: a.category, type: a.type, colors: a.colors,
        styles: a.styles, materials: a.materials, fit: a.fit, brand: a.brand
    };
    for (const [k, v] of Object.entries(fixed)) if (!k.startsWith('_')) entry[k] = v;
    if (fixed.type) entry.category = engine.CATEGORY_OF_TYPE[fixed.type];
    table[id] = entry;
}
const header = '/* Tự động sinh bởi tools/generate-product-attributes.js — KHÔNG sửa tay file này.\n' +
    '   Muốn sửa thuộc tính: chỉnh tools/attribute-overrides.json rồi chạy `npm run attributes`.\n' +
    '   Giá/khoảng giá không lưu ở đây mà lấy trực tiếp từ product-data.js để luôn khớp giá hiện hành. */\n';
const body = '(function (root) {\n    var data = ' + JSON.stringify(table, null, 4).replace(/\n/g, '\n    ') + ';\n' +
    '    if (typeof module === \'object\' && module.exports) module.exports = data;\n' +
    '    else if (root) root.STYLEHUB_PRODUCT_ATTRIBUTES = data;\n' +
    '})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this));\n';
const out = path.join(ROOT, 'recommender', 'product-attributes.js');
fs.writeFileSync(out, header + body);
console.log('Đã ghi ' + Object.keys(table).length + ' sản phẩm vào ' + path.relative(ROOT, out));
