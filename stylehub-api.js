/* =============================================================================
   THE STYLE HUB — Client kết nối backend gợi ý (window.StyleHubApi)
   -----------------------------------------------------------------------------
   - Tự phát hiện backend cùng origin (GET /api/health). Khi mở bằng Live Server/file tĩnh
     không có backend -> website chạy chế độ tĩnh (engine gợi ý trong trình duyệt), không lỗi.
   - Đổi địa chỉ API: đặt window.STYLEHUB_API_BASE trước khi nạp file này.
   - Khi khách đăng nhập/đăng ký trên website, tài khoản được liên kết với máy chủ
     (cùng email + mật khẩu, băm scrypt phía server) để hành vi được gom TẬP TRUNG cho
     Collaborative Filtering đa thiết bị. Lịch sử cục bộ cũ được đồng bộ một lần.
   - Sự kiện hành vi được xếp hàng đợi (localStorage) và gửi theo lô, tự gửi lại khi có mạng.
   ========================================================================== */
(function () {
    'use strict';
    if (window.StyleHubApi) return;

    var TOKEN_KEY = 'stylehub_api_token_v1';
    var TOKEN_EMAIL_KEY = 'stylehub_api_token_email_v1';
    var QUEUE_KEY = 'stylehub_api_event_queue_v1';
    var ORDER_QUEUE_KEY = 'stylehub_api_order_queue_v1';
    var STATUS_KEY = 'stylehub_api_status_v1';
    var SYNC_PREFIX = 'stylehub_api_synced_';
    var BASE = String(window.STYLEHUB_API_BASE || '').replace(/\/+$/, '');
    var availability = null;
    var flushTimer = null;
    var flushing = false;

    function read(key, fallback, storage) {
        try { var v = JSON.parse((storage || localStorage).getItem(key)); return v === null || v === undefined ? fallback : v; } catch (_) { return fallback; }
    }
    function write(key, value, storage) {
        try { (storage || localStorage).setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
    }
    function remove(key) { try { localStorage.removeItem(key); } catch (_) { /* bỏ qua */ } }
    function emit(name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) { /* bỏ qua */ } }

    function currentEmail() {
        try {
            if (localStorage.getItem('isLoggedInStatus') !== 'true') return '';
            return String(localStorage.getItem('hub_current_user_key') || localStorage.getItem('hub_email') || '').trim().toLowerCase();
        } catch (_) { return ''; }
    }

    function fetchWithTimeout(url, init, ms) {
        if (typeof AbortController === 'undefined') return fetch(url, init);
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, ms || 6000);
        return fetch(url, Object.assign({}, init, { signal: controller.signal })).finally(function () { clearTimeout(timer); });
    }

    /** Promise<boolean>: backend có sẵn không (cache 60 giây trong sessionStorage). */
    function available() {
        if (availability) return availability;
        if (typeof fetch !== 'function' || location.protocol === 'file:') return (availability = Promise.resolve(false));
        var cached = read(STATUS_KEY, null, sessionStorage);
        if (cached && cached.base === BASE && Date.now() - cached.at < 60000) return (availability = Promise.resolve(!!cached.up));
        availability = fetchWithTimeout(BASE + '/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store' }, 1500)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return !!(d && d.ok === true && d.service === 'stylehub-api'); })
            .catch(function () { return false; })
            .then(function (up) { write(STATUS_KEY, { up: up, at: Date.now(), base: BASE }, sessionStorage); return up; });
        return availability;
    }

    function token() {
        try {
            var t = localStorage.getItem(TOKEN_KEY), e = localStorage.getItem(TOKEN_EMAIL_KEY);
            var email = currentEmail();
            return t && e && email && e === email ? t : null;
        } catch (_) { return null; }
    }

    function request(method, path, body, opts) {
        opts = opts || {};
        var headers = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        var t = opts.auth === false ? null : token();
        if (t) headers.Authorization = 'Bearer ' + t;
        return fetchWithTimeout(BASE + path, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' }, opts.timeout || 8000)
            .then(function (r) {
                return r.json().catch(function () { return null; }).then(function (data) {
                    if (r.status === 401 && t) { remove(TOKEN_KEY); emit('stylehub-api-auth-change', { connected: false }); }
                    return { status: r.status, ok: r.ok && !!data && data.ok !== false, data: data || {} };
                });
            });
    }

    /** Liên kết tài khoản website với máy chủ (gọi sau khi đăng nhập/đăng ký cục bộ thành công). */
    function connect(email, password, name) {
        email = String(email || '').trim().toLowerCase();
        if (!email || !password) return Promise.resolve({ ok: false });
        return available().then(function (up) {
            if (!up) return { ok: false, offline: true };
            return request('POST', '/api/auth/login', { email: email, password: password }, { auth: false }).then(function (r) {
                if (r.status === 401) return request('POST', '/api/auth/register', { email: email, password: password, name: name || email.split('@')[0] }, { auth: false });
                return r;
            }).then(function (r) {
                if (!r.ok || !r.data.token) {
                    var message = r.status === 409 ? 'Email đã có tài khoản trên máy chủ với mật khẩu khác — gợi ý tạm dùng dữ liệu trên trình duyệt.' : (r.data.message || 'Không kết nối được máy chủ gợi ý.');
                    emit('stylehub-api-auth-change', { connected: false, message: message });
                    return { ok: false, message: message };
                }
                try { localStorage.setItem(TOKEN_KEY, r.data.token); localStorage.setItem(TOKEN_EMAIL_KEY, email); } catch (_) { /* bỏ qua */ }
                emit('stylehub-api-auth-change', { connected: true, user: r.data.user });
                return syncLocalHistory(email).then(function () { flush(); return { ok: true, user: r.data.user }; });
            });
        }).catch(function () { return { ok: false }; });
    }

    function disconnect() { remove(TOKEN_KEY); remove(TOKEN_EMAIL_KEY); emit('stylehub-api-auth-change', { connected: false }); }

    /* ---------------- Hàng đợi sự kiện ---------------- */
    function track(events) {
        var list = (Array.isArray(events) ? events : [events]).filter(function (e) { return e && e.productId && e.type; });
        if (!list.length) return;
        var email = currentEmail();
        if (!email) return; // khách chưa đăng nhập: dữ liệu chỉ ở trình duyệt (engine cục bộ dùng)
        var queue = read(QUEUE_KEY, []);
        list.forEach(function (e) { queue.push(Object.assign({ ts: Date.now(), email: email }, e)); });
        if (queue.length > 500) queue = queue.slice(queue.length - 500);
        write(QUEUE_KEY, queue);
        scheduleFlush();
    }
    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 1200);
    }
    function flush() {
        if (flushing || !token()) return Promise.resolve(false);
        var email = currentEmail();
        var queue = read(QUEUE_KEY, []);
        var mine = queue.filter(function (e) { return e.email === email; }).slice(0, 100);
        var orders = read(ORDER_QUEUE_KEY, []).filter(function (o) { return o.email === email; });
        if (!mine.length && !orders.length) return Promise.resolve(true);
        flushing = true;
        return available().then(function (up) {
            if (!up) return false;
            var work = Promise.resolve();
            orders.forEach(function (o) {
                work = work.then(function () {
                    return request('POST', '/api/orders', o.body).then(function (r) {
                        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429)) {
                            write(ORDER_QUEUE_KEY, read(ORDER_QUEUE_KEY, []).filter(function (x) { return x.body.orderId !== o.body.orderId; }));
                        }
                    });
                });
            });
            if (mine.length) {
                work = work.then(function () {
                    return request('POST', '/api/events', { events: mine.map(function (e) { return { productId: e.productId, type: e.type, value: e.value, ts: e.ts, context: e.context }; }) })
                        .then(function (r) {
                            if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429)) {
                                var sent = new Set(mine);
                                write(QUEUE_KEY, read(QUEUE_KEY, []).filter(function (e) { return !mine.some(function (m) { return m.ts === e.ts && m.productId === e.productId && m.type === e.type && m.email === e.email; }); }));
                                emit('stylehub-api-synced', { accepted: r.data.accepted || 0, size: sent.size });
                            }
                        });
                });
            }
            return work.then(function () { return true; });
        }).catch(function () { return false; }).then(function (r) { flushing = false; return r; });
    }

    /** Đồng bộ lịch sử cục bộ (xem, giỏ, đánh giá hợp gu, yêu thích, đơn hàng) lên máy chủ một lần cho mỗi tài khoản. */
    function syncLocalHistory(email) {
        if (read(SYNC_PREFIX + email, false)) return Promise.resolve();
        var key = email.replace(/\s+/g, '_');
        var profile = read('stylehub_preferences_v1_' + key, {});
        var now = Date.now(), maxAge = 85 * 86400000;
        var events = [];
        ['views', 'cart'].forEach(function (field) {
            Object.keys(profile[field] || {}).forEach(function (id) {
                var e = profile[field][id] || {};
                if (!e.at || now - e.at > maxAge) return;
                var n = Math.min(field === 'views' ? 3 : 2, Number(e.count) || 1);
                for (var i = 0; i < n; i++) events.push({ productId: id, type: field === 'views' ? 'view' : 'cart', value: 1, ts: e.at - i * 60000, context: 'sync' });
            });
        });
        Object.keys(profile.ratings || {}).forEach(function (id) {
            var r = profile.ratings[id] || {};
            if (r.value >= 1 && r.value <= 5) events.push({ productId: id, type: 'rating', value: r.value, ts: Math.max(r.at || now, now - maxAge), context: 'sync' });
        });
        read('stylehub_wishlist_' + key, []).forEach(function (id) { events.push({ productId: id, type: 'wishlist', value: 1, ts: now, context: 'sync' }); });
        events.forEach(function (e) { e.email = email; });
        var queue = read(QUEUE_KEY, []).concat(events);
        write(QUEUE_KEY, queue.slice(-500));
        read('hub_orders_' + email, []).forEach(function (order) { queueOrder(order, email); });
        write(SYNC_PREFIX + email, true);
        return Promise.resolve();
    }

    function orderBody(order) {
        var items = (order && (order.orderedProductsList || order.items) || []).map(function (it) {
            return { productId: it.key || it.id || it.productId, quantity: Number(it.qty || it.quantity || 1), size: it.size || '', price: Number(it.priceNum) || 0 };
        }).filter(function (it) { return it.productId; });
        return { orderId: String(order.orderId || order.clientOrderUid || ('ORD' + Date.now())).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), items: items, total: 0 };
    }
    function queueOrder(order, email) {
        if (!order || /hủy|huỷ|cancel|hoàn trả|refund/i.test(String(order.status || ''))) return;
        var body = orderBody(order);
        if (!body.items.length) return;
        var q = read(ORDER_QUEUE_KEY, []);
        if (q.some(function (x) { return x.body.orderId === body.orderId; })) return;
        q.push({ email: email, body: body });
        write(ORDER_QUEUE_KEY, q.slice(-50));
    }
    /** Gọi sau khi đặt hàng thành công: ghi nhận lượt mua đã xác minh cho hệ gợi ý và cho phép đánh giá. */
    function recordOrder(order) {
        var email = currentEmail();
        if (!email) return;
        queueOrder(order, email);
        scheduleFlush();
    }

    /* ---------------- API tiện ích ---------------- */
    function qs(params) {
        return Object.keys(params).filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    }
    function getRecommendations(params) {
        return available().then(function (up) {
            if (!up) return null;
            return request('GET', '/api/recommendations?' + qs(params)).then(function (r) { return r.ok ? r.data : null; });
        }).catch(function () { return null; });
    }
    function getPopular(limit) {
        return available().then(function (up) {
            if (!up) return null;
            return request('GET', '/api/products/popular?' + qs({ limit: limit })).then(function (r) { return r.ok ? r.data : null; });
        }).catch(function () { return null; });
    }
    function getOutfit(productId) {
        return available().then(function (up) {
            if (!up) return null;
            return request('GET', '/api/recommendations/outfit?' + qs({ productId: productId })).then(function (r) { return r.ok ? r.data : null; });
        }).catch(function () { return null; });
    }
    function getReviews(productId) {
        return available().then(function (up) {
            if (!up) return null;
            return request('GET', '/api/products/' + encodeURIComponent(productId) + '/reviews?limit=20').then(function (r) { return r.ok ? r.data : null; });
        }).catch(function () { return null; });
    }
    function postReview(productId, rating, comment) {
        return request('POST', '/api/products/' + encodeURIComponent(productId) + '/reviews', { rating: rating, comment: comment });
    }
    function deleteReview(productId) { return request('DELETE', '/api/products/' + encodeURIComponent(productId) + '/reviews'); }
    function getStyleDNA() {
        if (!token()) return Promise.resolve(null);
        return request('GET', '/api/profile/style-dna').then(function (r) { return r.ok ? r.data : null; }).catch(function () { return null; });
    }
    function saveQuiz(quiz) {
        if (!token()) return Promise.resolve(null);
        return request('PUT', '/api/profile/quiz', { quiz: quiz }).catch(function () { return null; });
    }
    function deleteHistory() {
        if (!token()) return Promise.resolve(null);
        return request('DELETE', '/api/profile/history').catch(function () { return null; });
    }

    /* ---------------- Móc vào đăng nhập/đăng ký có sẵn ---------------- */
    function hookAuth() {
        var A = window.StyleHubAuth;
        if (!A || A.__apiHooked) return !!(A && A.__apiHooked);
        var origLogin = A.login, origRegister = A.register, origSignOut = A.signOut;
        A.login = function (email, password) {
            var result = origLogin.apply(this, arguments);
            if (result && result.ok) connect(email, password, result.user && result.user.name);
            return result;
        };
        A.register = function (data) {
            var result = origRegister.apply(this, arguments);
            if (result && result.ok && data) available().then(function (up) {
                if (up) request('POST', '/api/auth/register', { email: data.email, password: data.password, name: (result.user && result.user.name) || data.name }, { auth: false });
            });
            return result;
        };
        A.signOut = function () { disconnect(); return origSignOut.apply(this, arguments); };
        A.__apiHooked = true;
        return true;
    }
    if (!hookAuth()) {
        var tries = 0;
        var poll = setInterval(function () { if (hookAuth() || ++tries > 40) clearInterval(poll); }, 250);
    }
    window.addEventListener('online', function () { availability = null; flush(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
    setTimeout(flush, 1500);

    window.StyleHubApi = {
        base: BASE,
        available: available,
        isConnected: function () { return !!token(); },
        connect: connect,
        disconnect: disconnect,
        track: track,
        flush: flush,
        recordOrder: recordOrder,
        getRecommendations: getRecommendations,
        getOutfit: getOutfit,
        getPopular: getPopular,
        getReviews: getReviews,
        postReview: postReview,
        deleteReview: deleteReview,
        getStyleDNA: getStyleDNA,
        saveQuiz: saveQuiz,
        deleteHistory: deleteHistory,
        request: request
    };
})();
