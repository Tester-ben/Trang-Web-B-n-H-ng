/* Nạp danh mục sản phẩm (product-data.js) và bảng thuộc tính cho môi trường Node
   (server/ và evaluation/). product-data.js là script trình duyệt nên được chạy
   trong sandbox vm với localStorage giả lập rỗng. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadCatalog(rootDir) {
    const file = path.join(rootDir || ROOT, 'product-data.js');
    const source = fs.readFileSync(file, 'utf8');
    const memory = {};
    const storage = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null),
        setItem: (k, v) => { memory[k] = String(v); },
        removeItem: (k) => { delete memory[k]; }
    };
    const sandbox = { window: {}, localStorage: storage, console: { log() {}, warn() {}, error() {} } };
    sandbox.window.localStorage = storage;
    vm.createContext(sandbox);
    vm.runInContext(source + '\n;globalThis.__stylehubCatalog = database;', sandbox, { filename: 'product-data.js', timeout: 5000 });
    const db = sandbox.__stylehubCatalog || {};
    // Bản sao thuần JSON, tách khỏi sandbox.
    return JSON.parse(JSON.stringify(db));
}

function loadAttributes(rootDir) {
    const file = path.join(rootDir || ROOT, 'recommender', 'product-attributes.js');
    if (!fs.existsSync(file)) return {};
    delete require.cache[require.resolve(file)];
    return require(file);
}

module.exports = { loadCatalog, loadAttributes, ROOT };
