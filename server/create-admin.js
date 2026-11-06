#!/usr/bin/env node
/* Tạo hoặc cập nhật tài khoản quản trị:  npm run create-admin -- email@vi-du.com MatKhauManh123 */
'use strict';
const { openStore } = require('./db');
const { loadConfig, ensureAdmin } = require('./server');

const [email, password] = process.argv.slice(2);
if (!email || !password) {
    console.error('Cách dùng: npm run create-admin -- <email> <mật-khẩu-ít-nhất-8-ký-tự>');
    process.exit(1);
}
const config = loadConfig(process.env);
const store = openStore({ dataDir: config.dataDir, kind: config.storeKind });
try {
    ensureAdmin(store, email, password, console.log);
} catch (e) {
    console.error(e.message);
    process.exitCode = 1;
} finally {
    store.close();
}
