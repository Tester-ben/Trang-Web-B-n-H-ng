/* =========================================================
   THE STYLE HUB - CLIENT SECURITY HELPERS (stylehub-crypto.js)
   ---------------------------------------------------------
   - SHA-256, HMAC-SHA256, PBKDF2-HMAC-SHA256 viết bằng JavaScript thuần,
     chạy ĐỒNG BỘ (các hàm đăng nhập/đăng ký hiện tại của website là đồng bộ).
     Không dùng crypto.subtle vì API đó chỉ có trong "secure context"
     (https hoặc localhost) — website hay được mở qua Live Server bằng IP LAN.
   - hashPassword / verifyPassword: định dạng
         pbkdf2-sha256$<số vòng lặp>$<salt hex>$<hash hex>
   - escapeHtml / sanitizeText / safeImageUrl: chống XSS khi hiển thị dữ liệu
     do người dùng hoặc admin nhập.
   - Các hàm thuần (pure) để nâng cấp tài khoản cũ còn lưu mật khẩu dạng chữ.

   Lưu ý: tài khoản lưu trong localStorage chỉ là cơ chế demo của bản web tĩnh.
   Băm mật khẩu giúp không lộ mật khẩu gốc khi ai đó mở DevTools/localStorage,
   nhưng không thay thế được xác thực phía máy chủ (backend dùng scrypt).
   UMD: trình duyệt -> window.StyleHubCrypto ; Node.js -> module.exports
   ========================================================= */
(function (root, factory) {
    "use strict";
    const api = factory(root);
    if (typeof module === "object" && module && module.exports) module.exports = api;
    else if (root && typeof root === "object") root.StyleHubCrypto = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
    "use strict";

    /* ---------------- SHA-256 core ---------------- */
    const K = new Int32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

    // Xử lý một khối 512 bit. w[0..15] phải chứa 16 word big-endian của khối; w có độ dài 64.
    function compress(state, w) {
        for (let i = 16; i < 64; i++) {
            const x = w[i - 15], y = w[i - 2];
            const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
            const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = state[0], b = state[1], c = state[2], d = state[3];
        let e = state[4], f = state[5], g = state[6], h = state[7];
        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0;
            d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
        state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
        state[4] = (state[4] + e) | 0; state[5] = (state[5] + f) | 0;
        state[6] = (state[6] + g) | 0; state[7] = (state[7] + h) | 0;
    }

    // Băm "bytes" tiếp nối một trạng thái đã xử lý "prefixLength" byte (bội số của 64).
    function finishHash(initialState, bytes, prefixLength) {
        const state = Int32Array.from(initialState);
        const w = new Int32Array(64);
        const length = bytes.length;
        const totalBits = (prefixLength + length) * 8;
        const paddedLength = ((length + 9 + 63) >> 6) << 6;
        const block = new Uint8Array(paddedLength);
        block.set(bytes);
        block[length] = 0x80;
        const high = Math.floor(totalBits / 0x100000000);
        const low = totalBits >>> 0;
        block[paddedLength - 8] = (high >>> 24) & 0xff;
        block[paddedLength - 7] = (high >>> 16) & 0xff;
        block[paddedLength - 6] = (high >>> 8) & 0xff;
        block[paddedLength - 5] = high & 0xff;
        block[paddedLength - 4] = (low >>> 24) & 0xff;
        block[paddedLength - 3] = (low >>> 16) & 0xff;
        block[paddedLength - 2] = (low >>> 8) & 0xff;
        block[paddedLength - 1] = low & 0xff;
        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let i = 0; i < 16; i++) {
                const j = offset + i * 4;
                w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
            }
            compress(state, w);
        }
        return state;
    }

    function wordsToBytes(words) {
        const out = new Uint8Array(words.length * 4);
        for (let i = 0; i < words.length; i++) {
            out[i * 4] = (words[i] >>> 24) & 0xff;
            out[i * 4 + 1] = (words[i] >>> 16) & 0xff;
            out[i * 4 + 2] = (words[i] >>> 8) & 0xff;
            out[i * 4 + 3] = words[i] & 0xff;
        }
        return out;
    }

    function utf8Bytes(value) {
        if (value instanceof Uint8Array) return value;
        if (Array.isArray(value)) return Uint8Array.from(value);
        const text = String(value === undefined || value === null ? "" : value);
        if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
        const binary = unescape(encodeURIComponent(text));
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }

    function sha256(message) {
        return wordsToBytes(finishHash(H0, utf8Bytes(message), 0));
    }

    /* ---------------- HMAC-SHA256 ---------------- */
    // Tính sẵn trạng thái sau khối (key XOR ipad) và (key XOR opad) để PBKDF2 chạy nhanh.
    function hmacContext(key) {
        let keyBytes = utf8Bytes(key);
        if (keyBytes.length > 64) keyBytes = sha256(keyBytes);
        const padded = new Uint8Array(64);
        padded.set(keyBytes);
        const w = new Int32Array(64);
        const inner = Int32Array.from(H0);
        const outer = Int32Array.from(H0);
        for (let i = 0; i < 16; i++) {
            const j = i * 4;
            const word = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
            w[i] = word ^ 0x36363636;
        }
        compress(inner, w);
        for (let i = 0; i < 16; i++) {
            const j = i * 4;
            const word = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
            w[i] = word ^ 0x5c5c5c5c;
        }
        compress(outer, w);
        return { inner: inner, outer: outer };
    }

    function hmacWithContext(context, message) {
        const innerDigest = wordsToBytes(finishHash(context.inner, utf8Bytes(message), 64));
        return wordsToBytes(finishHash(context.outer, innerDigest, 64));
    }

    function hmacSha256(key, message) {
        return hmacWithContext(hmacContext(key), message);
    }

    /* ---------------- PBKDF2-HMAC-SHA256 ---------------- */
    function pbkdf2Sha256(password, salt, iterations, keyLength) {
        const rounds = Math.floor(Number(iterations));
        const dkLen = Math.floor(Number(keyLength === undefined ? 32 : keyLength));
        if (!(rounds >= 1)) throw new Error("PBKDF2: số vòng lặp không hợp lệ");
        if (!(dkLen >= 1) || dkLen > 1024) throw new Error("PBKDF2: độ dài khóa không hợp lệ");
        const context = hmacContext(password);
        const saltBytes = utf8Bytes(salt);
        const blocks = Math.ceil(dkLen / 32);
        const output = new Uint8Array(blocks * 32);
        const w = new Int32Array(64);
        const innerState = new Int32Array(8);
        const outerState = new Int32Array(8);

        for (let blockIndex = 1; blockIndex <= blocks; blockIndex++) {
            const first = new Uint8Array(saltBytes.length + 4);
            first.set(saltBytes);
            first[saltBytes.length] = (blockIndex >>> 24) & 0xff;
            first[saltBytes.length + 1] = (blockIndex >>> 16) & 0xff;
            first[saltBytes.length + 2] = (blockIndex >>> 8) & 0xff;
            first[saltBytes.length + 3] = blockIndex & 0xff;
            const u1 = hmacWithContext(context, first);
            const u = new Int32Array(8);
            for (let i = 0; i < 8; i++) {
                const j = i * 4;
                u[i] = (u1[j] << 24) | (u1[j + 1] << 16) | (u1[j + 2] << 8) | u1[j + 3];
            }
            const t = Int32Array.from(u);

            // Đường nhanh: mỗi vòng HMAC trên 32 byte = đúng 1 khối cho inner + 1 khối cho outer.
            for (let iteration = 1; iteration < rounds; iteration++) {
                innerState.set(context.inner);
                for (let i = 0; i < 8; i++) w[i] = u[i];
                w[8] = 0x80000000;
                w[9] = 0; w[10] = 0; w[11] = 0; w[12] = 0; w[13] = 0; w[14] = 0;
                w[15] = 768; // (64 + 32) byte * 8 bit
                compress(innerState, w);

                outerState.set(context.outer);
                for (let i = 0; i < 8; i++) w[i] = innerState[i];
                w[8] = 0x80000000;
                w[9] = 0; w[10] = 0; w[11] = 0; w[12] = 0; w[13] = 0; w[14] = 0;
                w[15] = 768;
                compress(outerState, w);

                for (let i = 0; i < 8; i++) {
                    u[i] = outerState[i];
                    t[i] ^= outerState[i];
                }
            }
            output.set(wordsToBytes(t), (blockIndex - 1) * 32);
        }
        return output.slice(0, dkLen);
    }

    /* ---------------- tiện ích ---------------- */
    function bytesToHex(bytes) {
        let hex = "";
        for (let i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
        return hex;
    }

    function hexToBytes(hex) {
        const clean = String(hex || "");
        if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) throw new Error("Chuỗi hex không hợp lệ");
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        return out;
    }

    function randomBytes(length) {
        const size = Math.max(1, Math.floor(Number(length) || 16));
        const out = new Uint8Array(size);
        const webCrypto = (root && root.crypto && typeof root.crypto.getRandomValues === "function") ? root.crypto
            : (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") ? globalThis.crypto
            : null;
        if (webCrypto) {
            webCrypto.getRandomValues(out);
            return out;
        }
        if (typeof require === "function") {
            try {
                const nodeCrypto = require("crypto");
                return Uint8Array.from(nodeCrypto.randomBytes(size));
            } catch (error) { /* tiếp tục fallback */ }
        }
        throw new Error("Trình duyệt không hỗ trợ crypto.getRandomValues — không thể tạo salt an toàn.");
    }

    function timingSafeEqualStrings(a, b) {
        const left = String(a === undefined || a === null ? "" : a);
        const right = String(b === undefined || b === null ? "" : b);
        const length = Math.max(left.length, right.length);
        let diff = left.length ^ right.length;
        for (let i = 0; i < length; i++) {
            diff |= (i < left.length ? left.charCodeAt(i) : 0) ^ (i < right.length ? right.charCodeAt(i) : 0);
        }
        return diff === 0;
    }

    /* ---------------- mật khẩu ---------------- */
    // ~60 ms trên Node 22 / Chrome desktop (đo bằng tests/security.test.js), ~150 ms trên điện thoại tầm trung.
    const DEFAULT_ITERATIONS = 60000;
    const MIN_ITERATIONS = 1000;
    const MAX_ITERATIONS = 2000000;
    const HASH_PATTERN = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{16,128})\$([0-9a-f]{64})$/;

    function isPasswordHash(value) {
        const match = HASH_PATTERN.exec(String(value || ""));
        if (!match) return false;
        const iterations = Number(match[1]);
        return iterations >= MIN_ITERATIONS && iterations <= MAX_ITERATIONS;
    }

    function hashPassword(password, options) {
        const opts = options || {};
        const iterations = Math.floor(Number(opts.iterations || DEFAULT_ITERATIONS));
        if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) throw new Error("Số vòng lặp PBKDF2 không hợp lệ");
        const salt = opts.saltHex ? hexToBytes(opts.saltHex) : randomBytes(16);
        const derived = pbkdf2Sha256(String(password === undefined || password === null ? "" : password), salt, iterations, 32);
        return "pbkdf2-sha256$" + iterations + "$" + bytesToHex(salt) + "$" + bytesToHex(derived);
    }

    function verifyPassword(password, stored) {
        const match = HASH_PATTERN.exec(String(stored || ""));
        if (!match) return false;
        const iterations = Number(match[1]);
        if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return false;
        const derived = pbkdf2Sha256(String(password === undefined || password === null ? "" : password), hexToBytes(match[2]), iterations, 32);
        return timingSafeEqualStrings(bytesToHex(derived), match[3]);
    }

    /* ---------------- tài khoản cũ (localStorage) ---------------- */
    // Trả về bản sao KHÔNG còn mật khẩu dạng chữ. Nếu chỉ có mật khẩu cũ thì băm nó.
    function upgradeAccountRecord(account, hashFn) {
        if (!account || typeof account !== "object") return { account: account, changed: false };
        const hasher = typeof hashFn === "function" ? hashFn : hashPassword;
        const copy = Object.assign({}, account);
        let changed = false;
        if (!isPasswordHash(copy.passwordHash) && typeof copy.password === "string" && copy.password !== "") {
            copy.passwordHash = hasher(copy.password);
            changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(copy, "password")) {
            delete copy.password;
            changed = true;
        }
        return { account: copy, changed: changed };
    }

    function migrateAccounts(accounts, hashFn) {
        const source = accounts && typeof accounts === "object" ? accounts : {};
        const result = {};
        let changed = false;
        Object.keys(source).forEach(function (email) {
            if (email === "__proto__" || email === "constructor" || email === "prototype") { changed = true; return; }
            const upgraded = upgradeAccountRecord(source[email], hashFn);
            result[email] = upgraded.account;
            if (upgraded.changed) changed = true;
        });
        return { accounts: result, changed: changed };
    }

    // Kiểm tra mật khẩu cho cả tài khoản đã băm và tài khoản cũ còn mật khẩu dạng chữ.
    function checkAccountPassword(account, password, hashFn) {
        if (!account || typeof account !== "object") return { ok: false, account: account, upgraded: false };
        const candidate = String(password === undefined || password === null ? "" : password);
        if (isPasswordHash(account.passwordHash)) {
            const ok = verifyPassword(candidate, account.passwordHash);
            if (ok && Object.prototype.hasOwnProperty.call(account, "password")) {
                const cleaned = Object.assign({}, account);
                delete cleaned.password;
                return { ok: true, account: cleaned, upgraded: true };
            }
            return { ok: ok, account: account, upgraded: false };
        }
        if (typeof account.password === "string" && account.password !== "") {
            if (!timingSafeEqualStrings(account.password, candidate)) return { ok: false, account: account, upgraded: false };
            const hasher = typeof hashFn === "function" ? hashFn : hashPassword;
            const upgraded = Object.assign({}, account, { passwordHash: hasher(candidate) });
            delete upgraded.password;
            return { ok: true, account: upgraded, upgraded: true };
        }
        return { ok: false, account: account, upgraded: false };
    }

    function publicAccount(account) {
        if (!account || typeof account !== "object") return account;
        const copy = Object.assign({}, account);
        delete copy.password;
        delete copy.passwordHash;
        return copy;
    }

    /* ---------------- chống XSS ---------------- */
    function escapeHtml(value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Làm sạch văn bản hiển thị (tên, thương hiệu, mô tả...) để có thể chèn an toàn
    // vào innerHTML và thuộc tính HTML: bỏ thẻ, bỏ ký tự điều khiển, thay dấu nháy thẳng.
    function sanitizeText(value, maxLength) {
        if (value === undefined || value === null) return "";
        const limit = Math.max(1, Math.floor(Number(maxLength) || 500));
        return String(value)
            .replace(/<\s*(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
            .replace(/<\/?[a-z!?][^>]*>/gi, " ")
            .replace(/[<>]/g, "")
            .replace(/"/g, "\u201D")
            .replace(/'/g, "\u2019")
            .replace(/`/g, "\u2019")
            .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, limit);
    }

    const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/]+=*$/i;

    // Chỉ chấp nhận http(s), data:image (base64, không SVG) và đường dẫn tương đối không có scheme.
    function safeImageUrl(value) {
        const url = String(value === undefined || value === null ? "" : value).trim();
        if (!url) return "";
        if (/^data:/i.test(url)) return DATA_IMAGE_PATTERN.test(url) ? url : "";
        if (/[\u0000-\u0020\u007F"'<>`\\]/.test(url)) return "";
        if (/^https?:\/\/[^/?#]+/i.test(url)) return url;
        if (url.indexOf("//") === 0) return "";
        if (/^[a-z][a-z0-9+.\-]*:/i.test(url)) return "";
        return url;
    }

    return {
        version: "1.0.0",
        DEFAULT_ITERATIONS: DEFAULT_ITERATIONS,
        sha256: sha256,
        sha256Hex: function (message) { return bytesToHex(sha256(message)); },
        hmacSha256: hmacSha256,
        hmacSha256Hex: function (key, message) { return bytesToHex(hmacSha256(key, message)); },
        pbkdf2Sha256: pbkdf2Sha256,
        bytesToHex: bytesToHex,
        hexToBytes: hexToBytes,
        utf8Bytes: utf8Bytes,
        randomBytes: randomBytes,
        timingSafeEqualStrings: timingSafeEqualStrings,
        isPasswordHash: isPasswordHash,
        hashPassword: hashPassword,
        verifyPassword: verifyPassword,
        upgradeAccountRecord: upgradeAccountRecord,
        migrateAccounts: migrateAccounts,
        checkAccountPassword: checkAccountPassword,
        publicAccount: publicAccount,
        escapeHtml: escapeHtml,
        sanitizeText: sanitizeText,
        safeImageUrl: safeImageUrl
    };
});
