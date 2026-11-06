/* Giới hạn tần suất đơn giản (cửa sổ cố định) theo khóa: IP/người dùng + nhóm endpoint. */
'use strict';

class RateLimiter {
    constructor() {
        this.buckets = new Map();
        this.timer = setInterval(() => this.cleanup(), 60000);
        if (this.timer.unref) this.timer.unref();
    }
    /** true nếu còn quota; false nếu vượt giới hạn. */
    allow(key, limit, windowMs) {
        const now = Date.now();
        let b = this.buckets.get(key);
        if (!b || now >= b.reset) { b = { count: 0, reset: now + windowMs }; this.buckets.set(key, b); }
        b.count++;
        return b.count <= limit;
    }
    retryAfter(key) {
        const b = this.buckets.get(key);
        return b ? Math.max(1, Math.ceil((b.reset - Date.now()) / 1000)) : 1;
    }
    cleanup() {
        const now = Date.now();
        for (const [k, b] of this.buckets) if (now >= b.reset) this.buckets.delete(k);
    }
    stop() { clearInterval(this.timer); }
}

module.exports = { RateLimiter };
