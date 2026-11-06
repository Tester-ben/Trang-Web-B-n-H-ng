#!/usr/bin/env node
/* =============================================================================
   Khởi động backend THE STYLE HUB:   npm start   (mặc định http://localhost:3000)
   Biến môi trường (tùy chọn):
     PORT, HOST                         cổng/địa chỉ lắng nghe (mặc định 3000, 127.0.0.1)
     STYLEHUB_DATA_DIR                  thư mục dữ liệu (mặc định server/data)
     STYLEHUB_TOKEN_SECRET              khóa ký token (mặc định tự sinh và lưu ở data/.token-secret)
     STYLEHUB_ADMIN_EMAIL / _PASSWORD   tạo/cập nhật tài khoản quản trị khi khởi động
     STYLEHUB_CORS_ORIGINS              danh sách origin được gọi API, phân tách dấu phẩy
     STYLEHUB_STORE=json                dùng lưu trữ JSON thay cho SQLite
     STYLEHUB_TRUST_PROXY=1             tin header X-Forwarded-For (khi chạy sau reverse proxy)
   ========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { openStore } = require('./db');
const { createApp } = require('./app');
const { RecommenderService } = require('./recommender-service');
const { loadCatalog, loadAttributes, ROOT } = require('../recommender/load-catalog');
const auth = require('./auth');

function ensureSecret(dataDir) {
    const file = path.join(dataDir, '.token-secret');
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
}

function loadConfig(env) {
    env = env || process.env;
    const dataDir = path.resolve(env.STYLEHUB_DATA_DIR || path.join(__dirname, 'data'));
    return {
        port: env.PORT !== undefined ? Number(env.PORT) : 3000,
        host: env.HOST || '127.0.0.1',
        dataDir,
        storeKind: env.STYLEHUB_STORE || undefined,
        tokenSecret: env.STYLEHUB_TOKEN_SECRET || null,
        tokenTtlSeconds: Number(env.STYLEHUB_TOKEN_TTL) || 7 * 24 * 3600,
        corsOrigins: String(env.STYLEHUB_CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000')
            .split(',').map((s) => s.trim()).filter(Boolean),
        adminEmail: env.STYLEHUB_ADMIN_EMAIL || '',
        adminPassword: env.STYLEHUB_ADMIN_PASSWORD || '',
        serveStatic: env.STYLEHUB_SERVE_STATIC !== '0',
        trustProxy: env.STYLEHUB_TRUST_PROXY === '1',
        staticRoot: ROOT
    };
}

function ensureAdmin(store, email, password, log) {
    const clean = auth.normalizeEmail(email);
    if (!auth.isValidEmail(clean) || String(password).length < 8) throw new Error('Email quản trị không hợp lệ hoặc mật khẩu ngắn hơn 8 ký tự.');
    const existing = store.getUserByEmail(clean);
    if (existing) {
        store.updateUser(existing.id, { passwordHash: auth.hashPassword(password), role: 'admin' });
        if (log) log('Đã cập nhật tài khoản quản trị: ' + clean);
        return store.getUserById(existing.id);
    }
    const user = store.createUser({ email: clean, name: 'Quản trị viên', passwordHash: auth.hashPassword(password), role: 'admin' });
    if (log) log('Đã tạo tài khoản quản trị: ' + clean);
    return user;
}

/** Khởi động server; trả về { server, store, url, close() } (dùng cho kiểm thử). */
function start(config, options) {
    const o = options || {};
    const log = o.silent ? () => {} : (...x) => console.log(...x);
    config.tokenSecret = config.tokenSecret || ensureSecret(config.dataDir);
    const store = openStore({ dataDir: config.dataDir, kind: config.storeKind });
    if (config.adminEmail && config.adminPassword) ensureAdmin(store, config.adminEmail, config.adminPassword, log);
    const catalog = loadCatalog(ROOT);
    const attributes = loadAttributes(ROOT);
    const service = new RecommenderService(store, catalog, attributes, o.serviceOptions);
    const app = createApp({ store, catalog, service, config, silent: o.silent });
    const server = http.createServer((req, res) => { app(req, res); });
    server.headersTimeout = 15000;
    server.requestTimeout = 30000;
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
            const addr = server.address();
            const url = 'http://' + (config.host === '0.0.0.0' ? 'localhost' : config.host) + ':' + addr.port;
            log('THE STYLE HUB đang chạy tại ' + url + '  (lưu trữ: ' + store.kind + ', dữ liệu: ' + config.dataDir + ')');
            resolve({
                server, store, service, url, port: addr.port,
                close: () => new Promise((done) => { app.close(); server.close(() => { store.close(); done(); }); server.closeAllConnections && server.closeAllConnections(); })
            });
        });
    });
}

if (require.main === module) {
    const config = loadConfig(process.env);
    start(config).then((s) => {
        console.log('Mở trình duyệt: ' + s.url + '   (API: ' + s.url + '/api/health)');
        if (!config.adminEmail) console.log('Gợi ý: tạo tài khoản quản trị bằng  npm run create-admin -- email@vi-du.com MatKhauManh123');
        const shutdown = () => { s.close().then(() => process.exit(0)); };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }).catch((e) => {
        console.error('Không khởi động được server:', e.message);
        process.exit(1);
    });
}

module.exports = { start, loadConfig, ensureAdmin, ensureSecret };
