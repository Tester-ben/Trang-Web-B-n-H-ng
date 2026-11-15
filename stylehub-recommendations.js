/* =============================================================================
   THE STYLE HUB — Hệ gợi ý phía trình duyệt (window.StyleHubRecommendations) v2
   -----------------------------------------------------------------------------
   - Nguồn 1 (ưu tiên): máy chủ /api/recommendations — Hybrid trên dữ liệu TẬP TRUNG của mọi
     người dùng (Collaborative Filtering đa thiết bị). Xem stylehub-api.js, server/.
   - Nguồn 2 (dự phòng / chế độ tĩnh): engine cùng thuật toán (recommender/engine.js) chạy
     trên dữ liệu localStorage của trình duyệt này.
   - Ghi nhận hành vi: xem chi tiết, thêm giỏ, yêu thích/bỏ yêu thích, đánh giá "hợp gu",
     lượt hiển thị/nhấp gợi ý (đo CTR).
   - Giữ nguyên API cũ: recommend(id, n), recommendHome(n), track(id, type, rating).
   Yêu cầu nạp trước: product-data.js, recommender/product-attributes.js,
   recommender/sentiment-vi.js, recommender/engine.js, stylehub-api.js (tùy chọn).
   ========================================================================== */
(function () {
    'use strict';
    var PREFIX = 'stylehub_preferences_v1_';
    var QUIZ_PREFIX = 'stylehub_style_quiz_v1_';
    var LOCAL_REVIEWS_KEY = 'stylehub_reviews_v1';
    var DAY = 86400000;
    var SERVER_TTL = 45000;

    var read = function (key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; } catch (_) { return fallback; } };
    var write = function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
    var removeKey = function (key) { try { localStorage.removeItem(key); } catch (_) { /* bỏ qua */ } };
    var catalog = function () { return typeof database === 'undefined' ? {} : database; };
    // Chỉ khóa riêng của danh mục (tránh ?id=constructor / toString trùng thuộc tính kế thừa của Object).
    var inCatalog = function (id) { return !!id && Object.prototype.hasOwnProperty.call(catalog(), id); };
    var array = function (v) { return Array.isArray(v) ? v : []; };
    var engine = function () { return window.StyleHubRecEngine || null; };
    var api = function () { return window.StyleHubApi || null; };
    var emit = function (name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) { /* bỏ qua */ } };

    function identity() {
        try {
            return localStorage.getItem('isLoggedInStatus') === 'true'
                ? String(localStorage.getItem('hub_current_user_key') || localStorage.getItem('hub_email') || 'guest').trim().toLowerCase().replace(/\s+/g, '_') : 'guest';
        } catch (_) { return 'guest'; }
    }
    function profile(user) {
        var p = read(PREFIX + user, {});
        return { views: p.views && typeof p.views === 'object' ? p.views : {}, cart: p.cart && typeof p.cart === 'object' ? p.cart : {}, ratings: p.ratings && typeof p.ratings === 'object' ? p.ratings : {} };
    }
    function hasImage(id) { var p = catalog()[id]; return !!(p && (p.mainImg || array(p.images)[0])); }
    function available(id) {
        if (window.StyleHubProductAdmin) { try { return window.StyleHubProductAdmin.getAdminStockInfo(id).status !== 'out'; } catch (_) { return true; } }
        var p = catalog()[id];
        var inv = read('stylehub_inventory_v1', {})[id] || p || {};
        return !inv.outOfStock && (inv.stock === undefined || Number(inv.stock) > 0);
    }

    /* ---------------- Ghi nhận hành vi ---------------- */
    var localDirty = true;
    function markDirty() { localDirty = true; }

    function track(id, type, rating) {
        if (!catalog()[id]) return false;
        var user = identity(), p = profile(user), now = Date.now();
        if (type === 'rating') {
            if (!Number.isInteger(rating) || rating < 0 || rating > 5) return false;
            if (rating === 0) delete p.ratings[id]; else p.ratings[id] = { value: rating, at: now };
        } else if (type === 'view' || type === 'cart') {
            var field = type === 'view' ? 'views' : 'cart';
            var old = p[field][id] || {};
            if (now - (old.at || 0) < 30000) return false;
            p[field][id] = { count: Math.min(10, (Number(old.count) || 0) + 1), at: now };
        } else return false;
        ['views', 'cart'].forEach(function (f) {
            p[f] = Object.fromEntries(Object.entries(p[f]).filter(function (x) { return x[1] && now - x[1].at < 90 * DAY; })
                .sort(function (a, b) { return b[1].at - a[1].at; }).slice(0, 200));
        });
        var saved = write(PREFIX + user, p);
        if (saved) {
            markDirty();
            if (api()) api().track({ productId: id, type: type, value: type === 'rating' ? rating : 1, context: type === 'view' ? 'product-detail' : 'site' });
            emit('stylehub-preferences-change', { id: id, type: type });
        }
        return saved;
    }

    function purchases(user) {
        if (user === 'guest') return [];
        return array(read('hub_orders_' + user, [])).filter(function (o) { return o && !/hủy|huỷ|cancel|hoàn trả|refund/i.test(o.status || ''); })
            .reduce(function (acc, o) {
                var ts = Number(o.createdAt) || Date.parse(o.date || '') || Date.now();
                array(o.orderedProductsList).forEach(function (i) { var id = i && (i.key || i.id); if (catalog()[id]) acc.push({ id: id, ts: ts }); });
                return acc;
            }, []);
    }
    function getQuiz(user) { return read(QUIZ_PREFIX + (user || identity()), null); }

    function recentViews(user) {
        var views = profile(user).views;
        return Object.keys(views).filter(function (id) { return catalog()[id] && views[id] && Number(views[id].at); })
            .map(function (id) { return { item: id, ts: Number(views[id].at) }; })
            .sort(function (a, b) { return b.ts - a.ts; }).slice(0, 10);
    }

    /** Dữ liệu cục bộ của mọi hồ sơ trên trình duyệt -> luồng sự kiện cho engine. */
    function localEvents() {
        var events = [], now = Date.now(), users = [];
        try { users = Object.keys(localStorage).filter(function (k) { return k.indexOf(PREFIX) === 0; }).map(function (k) { return k.slice(PREFIX.length); }); } catch (_) { /* bỏ qua */ }
        var current = identity();
        if (users.indexOf(current) < 0) users.push(current);
        users.forEach(function (user) {
            var p = profile(user);
            ['views', 'cart'].forEach(function (field) {
                Object.keys(p[field]).forEach(function (id) {
                    var e = p[field][id] || {};
                    var n = Math.max(1, Math.min(5, Number(e.count) || 1));
                    for (var i = 0; i < n; i++) events.push({ user: user, item: id, type: field === 'views' ? 'view' : 'cart', value: 1, ts: Number(e.at) - i * 60000 });
                });
            });
            Object.keys(p.ratings).forEach(function (id) { var r = p.ratings[id] || {}; events.push({ user: user, item: id, type: 'rating', value: Number(r.value), ts: Number(r.at) || now }); });
            array(read('stylehub_wishlist_' + user, [])).forEach(function (id) { events.push({ user: user, item: id, type: 'wishlist', value: 1, ts: now - DAY }); });
            purchases(user).forEach(function (x) { events.push({ user: user, item: x.id, type: 'purchase', ts: x.ts }); });
        });
        var reviews = read(LOCAL_REVIEWS_KEY, {});
        Object.keys(reviews).forEach(function (productId) {
            array(reviews[productId]).forEach(function (r) {
                if (r && r.user) events.push({ user: r.user, item: productId, type: 'review', value: Number(r.rating), sentiment: r.sentiment, ts: Number(r.createdAt) || now });
            });
        });
        return events;
    }

    var localModel = null, localBuiltAt = 0;
    function getLocalModel() {
        var E = engine();
        if (!E) return null;
        if (localModel && !localDirty && Date.now() - localBuiltAt < 60000) return localModel;
        var user = identity(), profiles = {};
        var quiz = getQuiz(user);
        if (quiz) profiles[user] = { quiz: quiz };
        localModel = E.createModel({
            catalog: catalog(), attributes: window.STYLEHUB_PRODUCT_ATTRIBUTES || {}, events: localEvents(), profiles: profiles,
            isAvailable: available, options: { mf: { enabled: false } }
        });
        localBuiltAt = Date.now();
        localDirty = false;
        return localModel;
    }

    /* ---------------- Kết quả từ máy chủ (cache) ---------------- */
    var serverCache = {}, pending = {};
    function cacheKey(context, productId) {
        var connected = api() && api().isConnected();
        return identity() + '|' + context + '|' + (productId || '') + '|' + (connected ? 'auth' : 'anon');
    }
    function requestServer(context, productId, limit) {
        var a = api();
        if (!a) return;
        var key = cacheKey(context, productId);
        var entry = serverCache[key];
        if (pending[key] || (entry && !entry.stale && Date.now() - entry.at < SERVER_TTL)) return;
        pending[key] = true;
        var params = { context: context, productId: productId, limit: Math.min(24, Math.max(8, (limit || 4) * 3)) };
        if (!a.isConnected()) {
            var quiz = getQuiz(identity());
            if (quiz) params.quiz = JSON.stringify(quiz);
            var rv = recentViews(identity()).slice(0, 6).map(function (r) { return r.item + ':' + r.ts; }).join(',');
            if (rv) params.recent = rv;
        }
        a.getRecommendations(params).then(function (data) {
            delete pending[key];
            if (!data || !Array.isArray(data.items)) return;
            var own = new Set(purchases(identity()).map(function (x) { return x.id; }));
            var items = data.items.filter(function (r) { return r && catalog()[r.id] && r.id !== productId && hasImage(r.id) && available(r.id) && !own.has(r.id); })
                .map(function (r) { return Object.assign({}, r, { source: 'server' }); });
            serverCache[key] = { items: items, at: Date.now(), meta: data.meta || {}, personalized: !!data.personalized };
            emit('stylehub-recommendations-updated', { context: context, productId: productId, source: 'server' });
            refresh();
        }).catch(function () { delete pending[key]; });
    }
    /* Số liệu "bán chạy / đánh giá cao" theo sản phẩm: ưu tiên máy chủ (toàn bộ khách hàng), dự phòng là
       dữ liệu cục bộ của trình duyệt (cùng engine). Chỉ là số đếm — không có danh tính người dùng. */
    var popularCache = null, popularPending = false;
    function requestPopular() {
        var a = api();
        if (!a || typeof a.getPopular !== 'function' || popularPending) return;
        if (popularCache && Date.now() - popularCache.at < SERVER_TTL) return;
        popularPending = true;
        a.getPopular(200).then(function (data) {
            popularPending = false;
            if (!data || !Array.isArray(data.items)) return;
            var items = {};
            data.items.forEach(function (x) { if (x && catalog()[x.id]) items[x.id] = x; });
            popularCache = { items: items, at: Date.now() };
        }).catch(function () { popularPending = false; });
    }
    function popularStats() {
        requestPopular();
        if (popularCache) return { source: 'server', items: popularCache.items };
        var model = getLocalModel();
        return model && typeof model.itemStats === 'function' ? { source: 'local', items: model.itemStats() } : null;
    }

    function invalidateServer() {
        Object.keys(serverCache).forEach(function (k) { serverCache[k].stale = true; });
        Object.keys(socialCache).forEach(function (k) { socialCache[k].stale = true; });
    }

    function fromServerOrLocal(context, productId, limit) {
        limit = Math.max(1, Math.min(24, Number(limit) || 4));
        requestServer(context, productId, limit);
        var entry = serverCache[cacheKey(context, productId)];
        if (entry && entry.items.length >= Math.min(limit, 2)) return entry.items.slice(0, limit);
        var model = getLocalModel();
        if (!model) return [];
        return model.recommend(identity(), { context: context, productId: productId, limit: limit, recent: recentViews(identity()) })
            .map(function (r) { return Object.assign({}, r, { source: 'local' }); });
    }

    /* ---------------- "Khách hàng cùng phong cách cũng chọn" (chỉ User-based CF) ---------------- */
    var socialCache = {}, socialPending = {};
    function recommendSocial(limit) {
        limit = Math.max(1, Math.min(12, Number(limit) || 4));
        var key = cacheKey('social', '');
        var a = api();
        if (a && !socialPending[key] && (!socialCache[key] || socialCache[key].stale || Date.now() - socialCache[key].at > SERVER_TTL)) {
            socialPending[key] = true;
            a.getRecommendations({ context: 'home', strategy: 'social', limit: Math.min(24, limit * 3) }).then(function (data) {
                delete socialPending[key];
                if (!data || !Array.isArray(data.items)) return;
                socialCache[key] = { at: Date.now(), items: data.items.filter(function (r) { return catalog()[r.id] && hasImage(r.id) && available(r.id); }).map(function (r) { return Object.assign({}, r, { source: 'server' }); }) };
                renderSocialRow();
            }).catch(function () { delete socialPending[key]; });
        }
        var entry = socialCache[key];
        if (entry) return entry.items.slice(0, limit);
        var model = getLocalModel();
        if (!model) return [];
        return model.recommend(identity(), { context: 'home', limit: limit * 2, weights: { ucf: 1 }, diversify: false, excludeInteracted: true })
            .filter(function (r) { return r.explanation && r.explanation.type === 'ucf'; }).slice(0, limit)
            .map(function (r) { return Object.assign({}, r, { source: 'local' }); });
    }

    function renderSocialRow() {
        var anchor = document.getElementById('shPersonalSection');
        if (!anchor) return;
        var items = recommendSocial(4);
        var section = document.getElementById('shSocialSection');
        if (!section) {
            section = document.createElement('section');
            section.id = 'shSocialSection';
            section.className = 'sh-social-section';
            section.setAttribute('aria-labelledby', 'shSocialTitle');
            var head = document.createElement('div'); head.className = 'sh-social-head';
            var kicker = document.createElement('span'); kicker.className = 'sh-recommend-eyebrow'; kicker.textContent = 'CUSTOMERS LIKE YOU';
            var title = document.createElement('h2'); title.id = 'shSocialTitle'; title.textContent = 'Khách hàng cùng phong cách cũng chọn';
            var lede = document.createElement('p'); lede.className = 'sh-social-lede';
            lede.textContent = 'Những thiết kế được khách hàng có phong cách tương đồng với bạn mua và đánh giá cao.';
            head.append(kicker, title, lede);
            var grid = document.createElement('div'); grid.className = 'sh-social-grid'; grid.id = 'shSocialGrid';
            var empty = document.createElement('p'); empty.className = 'sh-social-empty'; empty.id = 'shSocialEmpty';
            section.append(head, grid, empty);
            anchor.insertAdjacentElement('afterend', section);
        }
        var grid2 = document.getElementById('shSocialGrid');
        var signature = JSON.stringify(items.map(function (x) { return [x.id, x.reason]; }));
        if (grid2.dataset.signature === signature) return;
        grid2.dataset.signature = signature;
        grid2.replaceChildren();
        section.hidden = !items.length;
        items.forEach(function (rec, rank) {
            var item = catalog()[rec.id];
            var card = document.createElement('a');
            card.className = 'sh-outfit-card sh-social-card';
            card.href = 'product-detail.html?id=' + encodeURIComponent(rec.id);
            card.setAttribute('data-rec-id', rec.id);
            card.setAttribute('data-rec-rank', String(rank));
            card.setAttribute('data-rec-context', 'social:' + (rec.source || 'local'));
            var img = document.createElement('img'); img.src = item.mainImg || array(item.images)[0] || ''; img.alt = item.name || ''; img.loading = 'lazy';
            var name = document.createElement('p'); name.className = 'sh-outfit-name'; name.textContent = item.name || '';
            var price = document.createElement('p'); price.className = 'sh-outfit-price'; price.textContent = item.price || '';
            var why = document.createElement('p'); why.className = 'sh-outfit-reason sh-social-reason'; why.textContent = rec.reason;
            card.append(img, name, price, why);
            grid2.appendChild(card);
        });
        trackImpressions(items, 'social');
    }

    /** Gợi ý cho trang chi tiết sản phẩm (tương thích API cũ). */
    // Sản phẩm không còn trong danh mục (link cũ tới món đã gỡ): dùng gợi ý cá nhân như trang chủ,
    // không gửi yêu cầu ngữ cảnh "product" thiếu productId (máy chủ sẽ trả 404).
    function recommend(current, limit) { return inCatalog(current) ? fromServerOrLocal('product', current, limit) : fromServerOrLocal('home', undefined, limit); }
    /** Gợi ý cho trang chủ (tương thích API cũ). */
    function recommendHome(limit) { return fromServerOrLocal('home', undefined, limit); }

    /** Gợi ý phối đồ cho một sản phẩm (áo -> quần + giày...). */
    function outfit(productId, perCategory) {
        var model = getLocalModel();
        return model && inCatalog(productId) ? model.outfit(productId, identity(), { perCategory: perCategory || 1 }) : [];
    }
    /** Hồ sơ phong cách cục bộ (máy chủ trả bản đầy đủ hơn qua StyleHubApi.getStyleDNA). */
    function styleDNA() { var model = getLocalModel(); return model ? model.styleDNA(identity(), getQuiz(identity()) || undefined) : null; }

    function saveQuiz(quiz) {
        if (!quiz || typeof quiz !== 'object') return false;
        // savedAt: thời điểm khách làm quiz — câu trả lời được ưu tiên như yêu cầu rõ ràng cho tới khi khách có đủ
        // hành vi mới (recommender/engine.js: quizIntent).
        quiz = Object.assign({}, quiz, { savedAt: Date.now() });
        var saved = write(QUIZ_PREFIX + identity(), quiz);
        markDirty();
        invalidateServer();
        if (api()) api().saveQuiz(quiz).then(function () { invalidateServer(); refresh(); emit('stylehub-recommendations-updated', { source: 'quiz' }); });
        emit('stylehub-preferences-change', { type: 'quiz' });
        return saved;
    }
    /** Gợi ý trang chủ đang bám theo câu trả lời quiz? Trả về tóm tắt lựa chọn + những yêu cầu shop chưa đáp ứng được. */
    function quizIntentInfo() {
        var E = engine(), model = getLocalModel(), user = identity(), quiz = getQuiz(user);
        if (!E || !model || !quiz || typeof model.quizIntentActive !== 'function' || !model.quizIntentActive(user, quiz)) return null;
        var L = E.LABELS, cap = function (x) { return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
        var parts = [];
        var who = { men: 'Nam', women: 'Nữ', kids: 'Trẻ em' }[quiz.gender];
        if (who) parts.push(who);
        array(quiz.styles).forEach(function (s) { if (L.style[s]) parts.push(cap(L.style[s])); });
        array(quiz.colors).forEach(function (c) { if (L.color[c]) parts.push(cap(L.color[c].replace(/^màu /, ''))); });
        array(quiz.types).forEach(function (t) { if (L.type[t]) parts.push(cap(L.type[t])); });
        if (E.PRICE_RANGE_LABEL && E.PRICE_RANGE_LABEL[quiz.budget]) parts.push(cap(E.PRICE_RANGE_LABEL[quiz.budget]));
        return { summary: parts.join(' · '), notes: model.quizNotes(quiz) };
    }

    function clearHistory() {
        var user = identity();
        removeKey(PREFIX + user);
        removeKey(QUIZ_PREFIX + user);
        markDirty();
        invalidateServer();
        var done = api() ? api().deleteHistory() : Promise.resolve(null);
        emit('stylehub-preferences-change', { type: 'clear' });
        return done;
    }

    /* ---------------- Đo lường hiển thị/nhấp (CTR) ---------------- */
    var impressed = {};
    function trackImpressions(items, context) {
        if (!api() || !Array.isArray(items)) return;
        var events = [];
        items.forEach(function (it, rank) {
            var k = context + '|' + it.id;
            if (impressed[k]) return;
            impressed[k] = 1;
            events.push({ productId: it.id, type: 'rec_impression', value: rank, context: context + ':' + (it.source || 'local') });
        });
        if (events.length) api().track(events);
    }
    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-rec-id]') : null;
        if (!el || !api()) return;
        api().track({ productId: el.getAttribute('data-rec-id'), type: 'rec_click', value: Number(el.getAttribute('data-rec-rank')) || 0, context: el.getAttribute('data-rec-context') || 'unknown' });
        if (api().flush) setTimeout(function () { api().flush(); }, 0);
    }, true);

    /** Tương thích bản cũ: điểm ưu tiên của người dùng theo sản phẩm. */
    function signals(user) {
        var model = getLocalModel();
        var data = model ? model.userData(user || identity()) : null;
        var out = {};
        if (data) data.items.forEach(function (e, id) { out[id] = Number(e.score.toFixed(4)); });
        return out;
    }

    window.StyleHubRecommendations = {
        recommend: recommend, recommendHome: recommendHome, recommendSocial: recommendSocial, outfit: outfit, styleDNA: styleDNA,
        saveQuiz: saveQuiz, getQuiz: function () { return getQuiz(identity()); }, clearHistory: clearHistory,
        track: track, trackImpressions: trackImpressions, signals: signals, popularStats: popularStats, quizIntentInfo: quizIntentInfo,
        cosine: function (a, b) { return engine() ? engine().cosine(a, b) : 0; },
        identity: identity, markDirty: markDirty,
        source: function (context, productId) { var e = serverCache[cacheKey(context || 'home', productId)]; return e ? 'server' : 'local'; }
    };

    /* ---------------- Gắn vào trang ---------------- */
    function currentId() { return /product-detail\.html$/.test(location.pathname) ? new URLSearchParams(location.search).get('id') : null; }

    var LABEL_CATEGORY = { top: 'Áo phối cùng', bottom: 'Quần phối cùng', footwear: 'Giày phối cùng', outerwear: 'Áo khoác phối cùng' };
    function renderOutfit(productId) {
        var anchor = document.getElementById('relatedProductsSection');
        if (!anchor || !inCatalog(productId)) return;
        var section = document.getElementById('shOutfitSection');
        if (!section) {
            section = document.createElement('section');
            section.id = 'shOutfitSection';
            section.className = 'sh-outfit-section';
            section.setAttribute('aria-labelledby', 'shOutfitTitle');
            var head = document.createElement('div');
            head.className = 'sh-outfit-head';
            var kicker = document.createElement('span'); kicker.className = 'sh-recommend-eyebrow'; kicker.textContent = 'COMPLETE THE LOOK';
            var title = document.createElement('h2'); title.id = 'shOutfitTitle'; title.textContent = 'Hoàn thiện set đồ';
            var lede = document.createElement('p'); lede.className = 'sh-outfit-lede';
            lede.textContent = 'Những thiết kế được chọn để kết hợp cùng sản phẩm này.';
            head.append(kicker, title, lede);
            var grid = document.createElement('div'); grid.className = 'sh-outfit-grid'; grid.id = 'shOutfitGrid';
            section.append(head, grid);
            anchor.insertAdjacentElement('afterend', section);
        }
        var grid2 = document.getElementById('shOutfitGrid');
        var looks = outfit(productId, 1);
        var signature = JSON.stringify(looks.map(function (x) { return [x.id, x.reason]; }));
        if (grid2.dataset.signature === signature) return;
        grid2.dataset.signature = signature;
        grid2.replaceChildren();
        section.hidden = !looks.length;
        looks.forEach(function (look, rank) {
            var item = catalog()[look.id];
            var card = document.createElement('a');
            card.className = 'sh-outfit-card';
            card.href = 'product-detail.html?id=' + encodeURIComponent(look.id);
            card.setAttribute('data-rec-id', look.id);
            card.setAttribute('data-rec-rank', String(rank));
            card.setAttribute('data-rec-context', 'outfit');
            var img = document.createElement('img');
            img.src = item.mainImg || array(item.images)[0] || '';
            img.alt = item.name || '';
            img.loading = 'lazy';
            var cat = document.createElement('span'); cat.className = 'sh-outfit-cat'; cat.textContent = LABEL_CATEGORY[look.category] || 'Phối cùng';
            var name = document.createElement('p'); name.className = 'sh-outfit-name'; name.textContent = item.name || '';
            var price = document.createElement('p'); price.className = 'sh-outfit-price'; price.textContent = item.price || '';
            var why = document.createElement('p'); why.className = 'sh-outfit-reason'; why.textContent = look.reason;
            card.append(img, cat, name, price, why);
            grid2.appendChild(card);
        });
        trackImpressions(looks.map(function (l) { return { id: l.id, source: 'local' }; }), 'outfit');
    }

    function refresh() {
        var id = currentId();
        if (id && typeof window.renderRelatedProducts === 'function') window.renderRelatedProducts(id);
        if (id) renderOutfit(id);
        if (document.getElementById('shPersonalSection')) renderSocialRow();
    }
    function cartSnapshot() {
        return Object.fromEntries(array(read('stylehub_cart_memory_v1', [])).filter(function (i) { return i && (i.key || i.id); }).map(function (i) { return [i.key || i.id, Number(i.qty || i.quantity || 1)]; }));
    }
    function wishlistSnapshot(user) { return new Set(array(read('stylehub_wishlist_' + user, []))); }

    function init() {
        setTimeout(requestPopular, 1500); // lấy sẵn số liệu bán chạy để chatbot trả lời ngay
        var user = identity(), before = cartSnapshot(), wishBefore = wishlistSnapshot(user);
        var id = currentId();
        if (id) track(id, 'view');
        function sync() {
            var nextUser = identity(), after = cartSnapshot();
            if (nextUser !== user) {
                user = nextUser; before = after; wishBefore = wishlistSnapshot(user);
                markDirty(); invalidateServer();
                if (id) track(id, 'view');
            } else {
                Object.keys(after).forEach(function (key) { if (after[key] > (before[key] || 0)) track(key, 'cart'); });
                before = after;
            }
            refresh();
            var select = document.getElementById('stylehubPreferenceRating');
            if (select && document.activeElement !== select) select.value = String((profile(user).ratings[id] || {}).value || 0);
            updateRatingVisuals();
        }
        var header = document.querySelector('#relatedProductsSection .related-products-header');
        var updateRatingVisuals = function () {};
        if (header && id && catalog()[id]) {
            var controls = document.createElement('div');
            controls.className = 'sh-preference-panel';
            controls.innerHTML = [
                '<div class="sh-preference-top">',
                '  <span class="sh-preference-icon" aria-hidden="true">✦</span>',
                '  <div class="sh-preference-intro">',
                '    <p class="sh-preference-heading">Phong cách này hợp gu bạn đến đâu?</p>',
                '    <p class="sh-preference-subtitle">Chạm vào số sao để cá nhân hóa gợi ý. Đây là đánh giá sở thích, không phải đánh giá sau mua hàng.</p>',
                '  </div>',
                '</div>',
                '<div class="sh-rating-interaction">',
                '  <div class="sh-star-list" role="group" aria-label="Chọn mức độ yêu thích từ 1 đến 5 sao">',
                '    <button class="sh-rating-star" type="button" data-stars="1" aria-label="1 sao - Không phù hợp" aria-pressed="false">★</button>',
                '    <button class="sh-rating-star" type="button" data-stars="2" aria-label="2 sao - Ít phù hợp" aria-pressed="false">★</button>',
                '    <button class="sh-rating-star" type="button" data-stars="3" aria-label="3 sao - Bình thường" aria-pressed="false">★</button>',
                '    <button class="sh-rating-star" type="button" data-stars="4" aria-label="4 sao - Yêu thích" aria-pressed="false">★</button>',
                '    <button class="sh-rating-star" type="button" data-stars="5" aria-label="5 sao - Rất yêu thích" aria-pressed="false">★</button>',
                '  </div>',
                '  <div class="sh-rating-caption"><strong id="shRatingLabel">Bạn chưa đánh giá</strong><span id="shRatingHint">Hãy chọn từ 1 đến 5 sao</span></div>',
                '</div>',
                '<div class="sh-rating-foot">',
                '  <span class="sh-rating-foot-note" id="shRatingSourceNote">Sở thích của bạn được lưu trên thiết bị này</span>',
                '  <div class="sh-rating-foot-actions">',
                '    <select id="stylehubPreferenceRating" aria-label="Mức độ yêu thích sản phẩm đang xem">',
                '      <option value="0">Chưa đánh giá</option>',
                '      <option value="1">1 ★ — Không phù hợp</option>',
                '      <option value="2">2 ★ — Ít phù hợp</option>',
                '      <option value="3">3 ★ — Bình thường</option>',
                '      <option value="4">4 ★ — Yêu thích</option>',
                '      <option value="5">5 ★ — Rất yêu thích</option>',
                '    </select>',
                '    <button type="button" class="sh-rating-clear" id="shRatingClear">Xóa đánh giá</button>',
                '  </div>',
                '</div>',
                '<span id="stylehubRatingStatus" role="status" aria-live="polite"></span>'
            ].join('');
            header.appendChild(controls);
            var select = document.getElementById('stylehubPreferenceRating');
            var labels = ['Bạn chưa đánh giá', 'Không phù hợp', 'Ít phù hợp', 'Bình thường', 'Yêu thích', 'Rất yêu thích'];
            updateRatingVisuals = function () {
                var n = Number(select.value) || 0;
                controls.querySelectorAll('.sh-rating-star').forEach(function (button) {
                    var stars = Number(button.dataset.stars);
                    button.classList.toggle('is-selected', stars <= n);
                    button.setAttribute('aria-pressed', String(stars === n));
                });
                controls.querySelector('#shRatingLabel').textContent = labels[n];
                controls.querySelector('#shRatingHint').textContent = n ? n + '/5 sao · Đã ghi nhận sở thích' : 'Hãy chọn từ 1 đến 5 sao';
                var note = controls.querySelector('#shRatingSourceNote');
                if (note) note.textContent = api() && api().isConnected() ? 'Sở thích của bạn được đồng bộ trên mọi thiết bị' : 'Sở thích của bạn được lưu trên thiết bị này';
            };
            controls.querySelectorAll('.sh-rating-star').forEach(function (button) {
                button.addEventListener('click', function () {
                    select.value = button.dataset.stars;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
            controls.querySelector('#shRatingClear').addEventListener('click', function () {
                select.value = '0';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            select.addEventListener('change', function () {
                var saved = track(id, 'rating', Number(this.value));
                controls.querySelector('#stylehubRatingStatus').textContent = saved
                    ? (this.value === '0' ? 'Đã xóa đánh giá sở thích.' : 'Đã lưu sở thích — danh sách gợi ý đã được cập nhật.')
                    : 'Chưa lưu được. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt.';
                updateRatingVisuals();
                invalidateServer();
                refresh();
            });
        }
        sync();
        document.addEventListener('stylehub-wishlist-change', function () {
            var now = wishlistSnapshot(user);
            var events = [];
            now.forEach(function (pid) { if (!wishBefore.has(pid) && catalog()[pid]) events.push({ productId: pid, type: 'wishlist', value: 1, context: 'site' }); });
            wishBefore.forEach(function (pid) { if (!now.has(pid) && catalog()[pid]) events.push({ productId: pid, type: 'unwishlist', context: 'site' }); });
            wishBefore = now;
            if (events.length && api()) api().track(events);
            markDirty();
            refresh();
        });
        document.addEventListener('stylehub-api-synced', function () { invalidateServer(); refresh(); emit('stylehub-recommendations-updated', { source: 'sync' }); });
        document.addEventListener('stylehub-api-auth-change', function () { markDirty(); invalidateServer(); refresh(); emit('stylehub-recommendations-updated', { source: 'auth' }); });
        window.addEventListener('storage', function () { markDirty(); sync(); });
        window.addEventListener('stylehub-inventory-change', refresh);
        window.addEventListener('stylehub-products-change', function () { markDirty(); refresh(); });
        document.addEventListener('click', function () { setTimeout(sync, 150); });
        window.addEventListener('pagehide', sync);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
