/* Xác thực: băm mật khẩu scrypt (crypto có sẵn của Node) và token ký HMAC-SHA256. */
'use strict';
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    let actual;
    try {
        actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    } catch (_) { return false; }
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Mật khẩu ngẫu nhiên không ai biết (cho tài khoản demo không đăng nhập được). */
function unusablePasswordHash() { return hashPassword(crypto.randomBytes(32).toString('hex')); }

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function signToken(payload, secret, ttlSeconds) {
    const body = Object.assign({}, payload, { iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (ttlSeconds || 7 * 24 * 3600) });
    const encoded = b64url(JSON.stringify(body));
    const sig = b64url(crypto.createHmac('sha256', secret).update('v1.' + encoded).digest());
    return 'v1.' + encoded + '.' + sig;
}

function verifyToken(token, secret) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return null;
    const expected = crypto.createHmac('sha256', secret).update('v1.' + parts[1]).digest();
    const given = fromB64url(parts[2]);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    let payload;
    try { payload = JSON.parse(fromB64url(parts[1]).toString('utf8')); } catch (_) { return null; }
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,180}\.[a-z]{2,24}$/i;
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function isValidEmail(email) { return EMAIL_RE.test(email) && email.length <= 254; }

module.exports = { hashPassword, verifyPassword, unusablePasswordHash, signToken, verifyToken, normalizeEmail, isValidEmail };
