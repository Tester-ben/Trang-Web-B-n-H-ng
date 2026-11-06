/* Additive, browser-local hybrid recommender. No checkout/auth/API overrides. */
(function () {
    'use strict';
    const PREFIX = 'stylehub_preferences_v1_';
    const DAY = 86400000;
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
    const catalog = () => typeof database === 'undefined' ? {} : database;
    function identity() {
        try {
            return localStorage.getItem('isLoggedInStatus') === 'true'
                ? String(localStorage.getItem('hub_current_user_key') || localStorage.getItem('hub_email') || 'guest').trim().toLowerCase().replace(/\s+/g, '_') : 'guest';
        } catch (_) { return 'guest'; }
    }
    function profile(user) {
        const p = read(PREFIX + user, {});
        return { views: p.views && typeof p.views === 'object' ? p.views : {}, cart: p.cart && typeof p.cart === 'object' ? p.cart : {}, ratings: p.ratings && typeof p.ratings === 'object' ? p.ratings : {} };
    }
    function track(id, type, rating) {
        if (!catalog()[id]) return false;
        const p = profile(identity()), now = Date.now();
        if (type === 'rating') {
            if (!Number.isInteger(rating) || rating < 0 || rating > 5) return false;
            if (rating === 0) delete p.ratings[id]; else p.ratings[id] = { value: rating, at: now };
        } else if (type === 'view' || type === 'cart') {
            const field = type === 'view' ? 'views' : 'cart';
            const old = p[field][id] || {};
            if (now - (old.at || 0) < 30000) return false;
            p[field][id] = { count: Math.min(10, (Number(old.count) || 0) + 1), at: now };
        } else return false;
        for (const field of ['views', 'cart']) {
            p[field] = Object.fromEntries(Object.entries(p[field]).filter(([, v]) => v && now - v.at < 90 * DAY).sort((a, b) => b[1].at - a[1].at).slice(0, 200));
        }
        const saved = write(PREFIX + identity(), p);
        if (saved) document.dispatchEvent(new CustomEvent('stylehub-preferences-change', { detail: { id, type } }));
        return saved;
    }
    const array = value => Array.isArray(value) ? value : [];
    function purchases(user) {
        if (user === 'guest') return [];
        const orders = array(read('hub_orders_' + user, []));
        return [...new Set(orders.filter(o => o && !/hủy|huỷ|cancel|hoàn trả|refund/i.test(o.status || '')).flatMap(o => array(o.orderedProductsList).map(i => i && (i.key || i.id))).filter(id => catalog()[id]))];
    }
    function signals(user) {
        const p = profile(user), result = {};
        const add = (id, n) => { if (catalog()[id] && Number.isFinite(n)) result[id] = (result[id] || 0) + n; };
        for (const field of ['views', 'cart']) for (const [id, event] of Object.entries(p[field])) {
            if (!event || typeof event !== 'object') continue;
            const age = Math.max(0, Date.now() - Number(event.at));
            if (age < 90 * DAY) add(id, (field === 'views' ? 1 : 3) * Math.min(5, Number(event.count) || 0) * Math.pow(0.5, age / (30 * DAY)));
        }
        array(read('stylehub_wishlist_' + user, [])).forEach(id => add(id, 5));
        purchases(user).forEach(id => add(id, 7));
        for (const [id, rating] of Object.entries(p.ratings)) {
            if (!rating || typeof rating !== 'object') continue;
            const value = Number(rating.value);
            if (value >= 1 && value <= 5) {
                if (value <= 2) result[id] = (value - 3) * 4;
                else add(id, (value - 3) * 4);
            }
        }
        return result;
    }
    function features(id) {
        const p = catalog()[id] || {}, name = String(p.name || '').toLowerCase();
        const f = {};
        const dept = window.StyleHubProductAdmin ? window.StyleHubProductAdmin.inferDepartment(id, p) : id.split('-')[0];
        f['department:' + dept] = 2;
        f['brand:' + String(p.brand || '').toLowerCase()] = 1;
        const groups = {
            tee: /tee|t-shirt/, hoodie: /hoodie/, shirt: /shirt/, pants: /pant|trouser|sweatpant/, shorts: /short(?! sleeve)/,
            knit: /knit|sweater|cardigan/, jacket: /jacket|coat|blazer/, dress: /dress|skirt/, footwear: /shoe|sneaker|basketball|slide|boot/,
            black: /black|cinder|carbon/, light: /white|ivory|cream|vanilla|pearl/, brown: /brown|taupe|dune|oatmeal|wood/, grey: /grey|gray|heather/,
            blue: /blue|navy|indigo/, green: /green|olive|sage/, pink: /pink|rose/,
            casual: /tee|hoodie|sweat|jersey|fleece/, formal: /blazer|tailored|suit/, denim: /denim|jean/
        };
        for (const [key, regex] of Object.entries(groups)) if (regex.test(name)) f[key] = 2;
        const price = Number(p.priceNum) || Number(String(p.price || '').replace(/\D/g, ''));
        if (price) f['price:' + Math.floor(price / 2000000)] = 0.7;
        return f;
    }
    function cosine(a, b) {
        let dot = 0, aa = 0, bb = 0;
        for (const k of Object.keys(a)) { aa += a[k] * a[k]; dot += a[k] * (b[k] || 0); }
        for (const k of Object.keys(b)) bb += b[k] * b[k];
        return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
    }
    function available(id) {
        if (window.StyleHubProductAdmin) return window.StyleHubProductAdmin.getAdminStockInfo(id).status !== 'out';
        const p = catalog()[id];
        const inv = read('stylehub_inventory_v1', {})[id] || p;
        return !inv.outOfStock && (inv.stock === undefined || Number(inv.stock) > 0);
    }
    function recommend(current, limit) {
        const user = identity(), own = signals(user), taste = {}, peers = {}, bought = new Set(purchases(user));
        const positive = Object.fromEntries(Object.entries(own).filter(([, n]) => n > 0));
        const prefs = profile(user);
        const seeds = Object.assign({}, own);
        if (current && catalog()[current]) seeds[current] = Math.max(2, seeds[current] || 0);
        for (const [id, weight] of Object.entries(seeds)) for (const [f, value] of Object.entries(features(id))) taste[f] = (taste[f] || 0) + value * weight;
        // Collaborative filtering uses actual local profiles only, never invented shoppers.
        let users = [];
        try { users = Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); } catch (_) {}
        for (const other of users) {
            if (other === user || other === 'guest') continue;
            const peer = Object.fromEntries(Object.entries(signals(other)).filter(([, n]) => n > 0));
            const common = Object.keys(positive).filter(id => peer[id]).length;
            if (!common) continue;
            const similarity = cosine(positive, peer) * Math.min(1, common / 3);
            for (const id of purchases(other)) if (!positive[id]) peers[id] = (peers[id] || 0) + similarity;
        }
        const maxPeer = Math.max(1, ...Object.values(peers));
        return Object.keys(catalog()).filter(id => id !== current && available(id) && !bought.has(id) && !(prefs.ratings[id] && prefs.ratings[id].value <= 2) && (catalog()[id].mainImg || (catalog()[id].images || [])[0])).map(id => {
            const content = Math.max(0, cosine(taste, features(id)));
            const social = (peers[id] || 0) / maxPeer;
            return { id, score: 0.65 * content + 0.35 * social, reason: social > 0 ? 'Người có sở thích tương tự đã mua' : Object.keys(own).length > 1 ? 'Phù hợp với sở thích của bạn' : 'Phù hợp với sản phẩm bạn đang xem' };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit || 4);
    }
    // Nhận dạng loại trang phục từ tên thật, không giả định sản phẩm có mã 'tee-'.
    function itemType(id) {
        const item = catalog()[id] || {};
        const name = String(item.name || '').toLowerCase();
        if (/\b(?:tee|t-?shirt|t shirt)\b/i.test(name)) return 'tee';
        if (/hoodie|hooded/i.test(name)) return 'hoodie';
        if (/polo/i.test(name)) return 'polo';
        if (/sweater|cardigan|knitwear/i.test(name)) return 'knit';
        if (/\bshirt\b/i.test(name)) return 'shirt';
        if (/jacket|coat|blazer/i.test(name)) return 'jacket';
        if (/\b(?:pant|pants|trouser|sweatpant|jean|bottom)\b/i.test(name)) return 'pants';
        if (/\bshorts?\b/i.test(name)) return 'shorts';
        if (/dress|skirt/i.test(name)) return 'dress';
        if (/shoe|sneaker|basketball|slide|boot/i.test(name)) return 'footwear';
        return null;
    }
    function recommendHome(limit = 4) {
        const user = identity(), preference = profile(user), weighted = signals(user);
        const recentViews = Object.entries(preference.views)
            .filter(([id, entry]) => catalog()[id] && entry && Number.isFinite(Number(entry.at)) && Date.now() - Number(entry.at) < 90 * DAY)
            .sort((a, b) => Number(b[1].at) - Number(a[1].at)).slice(0, 12);
        const recentTypes = {}, longTermTypes = {};
        recentViews.forEach(([id, entry], index) => {
            const type = itemType(id);
            if (!type) return;
            const age = Math.max(0, Date.now() - Number(entry.at));
            const weight = Math.min(4, Number(entry.count) || 1) * Math.exp(-age / (14 * DAY)) / (1 + index * 0.16);
            recentTypes[type] = (recentTypes[type] || 0) + weight;
        });
        for (const [id, value] of Object.entries(weighted)) {
            const type = itemType(id);
            if (type && value > 0) longTermTypes[type] = (longTermTypes[type] || 0) + value;
        }
        const maxRecent = Math.max(0, ...Object.values(recentTypes));
        const maxLongTerm = Math.max(0, ...Object.values(longTermTypes));
        const hasHistory = maxRecent > 0 || maxLongTerm > 0;
        if (!hasHistory) {
            // Khách chưa xem gì: giới thiệu nhiều loại thay vì mặc định 4 hoodie trẻ em.
            const chosen = [], seenTypes = new Set();
            for (const id of Object.keys(catalog())) {
                const type = itemType(id);
                if (!type || seenTypes.has(type) || !available(id)) continue;
                const p = catalog()[id];
                if (!(p.mainImg || array(p.images)[0])) continue;
                chosen.push({ id, score: 0, reason: 'Khám phá bộ sưu tập' });
                seenTypes.add(type);
                if (chosen.length >= limit) break;
            }
            if (chosen.length < limit) {
                for (const id of Object.keys(catalog())) {
                    if (chosen.some(r => r.id === id) || !available(id)) continue;
                    const p = catalog()[id];
                    if (!(p.mainImg || array(p.images)[0])) continue;
                    chosen.push({ id, score: 0, reason: 'Khám phá bộ sưu tập' });
                    if (chosen.length >= limit) break;
                }
            }
            return chosen;
        }
        // Lượt xem gần đây được ưu tiên hơn sở thích cũ. Không cần nhấn tim hay đánh giá.
        const previous = recommend(null, Object.keys(catalog()).length);
        return previous.map(result => {
            const type = itemType(result.id);
            const recent = maxRecent && type ? (recentTypes[type] || 0) / maxRecent : 0;
            const enduring = maxLongTerm && type ? (longTermTypes[type] || 0) / maxLongTerm : 0;
            const alreadyViewed = preference.views[result.id] ? 0.065 : 0;
            const score = result.score + 0.8 * recent + 0.22 * enduring - alreadyViewed;
            return { ...result, score, reason: recent >= 0.55
                ? 'Vì bạn gần đây xem nhiều ' + ({tee:'áo thun',hoodie:'áo hoodie',shirt:'áo sơ mi',polo:'áo polo',pants:'quần',dress:'váy',footwear:'giày'}[type] || 'sản phẩm cùng loại')
                : result.reason };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    }
    window.StyleHubRecommendations = { recommend, recommendHome, track, signals, cosine };
    function currentId() { return /product-detail\.html$/.test(location.pathname) ? new URLSearchParams(location.search).get('id') : null; }
    function refresh() {
        const id = currentId();
        if (id && typeof window.renderRelatedProducts === 'function') window.renderRelatedProducts(id);
    }
    function cartSnapshot() {
        return Object.fromEntries(array(read('stylehub_cart_memory_v1', [])).filter(i => i && (i.key || i.id)).map(i => [i.key || i.id, Number(i.qty || i.quantity || 1)]));
    }
    function init() {
        let user = identity(), before = cartSnapshot();
        const id = currentId();
        if (id) track(id, 'view');
        function sync() {
            const nextUser = identity(), after = cartSnapshot();
            if (nextUser !== user) { user = nextUser; before = after; if (id) track(id, 'view'); }
            else {
                for (const key of Object.keys(after)) if (after[key] > (before[key] || 0)) track(key, 'cart');
                before = after;
            }
            refresh();
            const select = document.getElementById('stylehubPreferenceRating');
            if (select && document.activeElement !== select) select.value = String((profile(user).ratings[id] || {}).value || 0);
            updateRatingVisuals();
        }
        const header = document.querySelector('#relatedProductsSection .related-products-header');
        let updateRatingVisuals = () => {};
        if (header && id && catalog()[id]) {
            const controls = document.createElement('div');
            controls.className = 'sh-preference-panel';
            controls.innerHTML = `
                <div class="sh-preference-top">
                    <span class="sh-preference-icon" aria-hidden="true">✦</span>
                    <div class="sh-preference-intro">
                        <p class="sh-preference-heading">Phong cách này hợp gu bạn đến đâu?</p>
                        <p class="sh-preference-subtitle">Chạm vào số sao để cá nhân hóa gợi ý. Đây là đánh giá sở thích, không phải đánh giá sau mua hàng.</p>
                    </div>
                </div>
                <div class="sh-rating-interaction">
                    <div class="sh-star-list" role="group" aria-label="Chọn mức độ yêu thích từ 1 đến 5 sao">
                        <button class="sh-rating-star" type="button" data-stars="1" aria-label="1 sao - Không phù hợp" aria-pressed="false">★</button>
                        <button class="sh-rating-star" type="button" data-stars="2" aria-label="2 sao - Ít phù hợp" aria-pressed="false">★</button>
                        <button class="sh-rating-star" type="button" data-stars="3" aria-label="3 sao - Bình thường" aria-pressed="false">★</button>
                        <button class="sh-rating-star" type="button" data-stars="4" aria-label="4 sao - Yêu thích" aria-pressed="false">★</button>
                        <button class="sh-rating-star" type="button" data-stars="5" aria-label="5 sao - Rất yêu thích" aria-pressed="false">★</button>
                    </div>
                    <div class="sh-rating-caption"><strong id="shRatingLabel">Bạn chưa đánh giá</strong><span id="shRatingHint">Hãy chọn từ 1 đến 5 sao</span></div>
                </div>
                <div class="sh-rating-foot">
                    <span class="sh-rating-foot-note">Sở thích chỉ được lưu trên trình duyệt hiện tại</span>
                    <div class="sh-rating-foot-actions">
                        <select id="stylehubPreferenceRating" aria-label="Mức độ yêu thích sản phẩm đang xem">
                            <option value="0">Chưa đánh giá</option>
                            <option value="1">1 ★ — Không phù hợp</option>
                            <option value="2">2 ★ — Ít phù hợp</option>
                            <option value="3">3 ★ — Bình thường</option>
                            <option value="4">4 ★ — Yêu thích</option>
                            <option value="5">5 ★ — Rất yêu thích</option>
                        </select>
                        <button type="button" class="sh-rating-clear" id="shRatingClear">Xóa đánh giá</button>
                    </div>
                </div>
                <span id="stylehubRatingStatus" role="status" aria-live="polite"></span>`;
            header.appendChild(controls);
            const select = document.getElementById('stylehubPreferenceRating');
            const labels = ['Bạn chưa đánh giá', 'Không phù hợp', 'Ít phù hợp', 'Bình thường', 'Yêu thích', 'Rất yêu thích'];
            updateRatingVisuals = () => {
                const n = Number(select.value) || 0;
                controls.querySelectorAll('.sh-rating-star').forEach(button => {
                    const stars = Number(button.dataset.stars);
                    button.classList.toggle('is-selected', stars <= n);
                    button.setAttribute('aria-pressed', String(stars === n));
                });
                controls.querySelector('#shRatingLabel').textContent = labels[n];
                controls.querySelector('#shRatingHint').textContent = n ? n + '/5 sao · Đã ghi nhận sở thích' : 'Hãy chọn từ 1 đến 5 sao';
            };
            controls.querySelectorAll('.sh-rating-star').forEach(button => {
                button.addEventListener('click', () => {
                    select.value = button.dataset.stars;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
            controls.querySelector('#shRatingClear').addEventListener('click', () => {
                select.value = '0';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            select.addEventListener('change', function () {
                const saved = track(id, 'rating', Number(this.value));
                controls.querySelector('#stylehubRatingStatus').textContent = saved
                    ? (this.value === '0' ? 'Đã xóa đánh giá sở thích.' : 'Đã lưu sở thích — danh sách gợi ý đã được cập nhật.')
                    : 'Chưa lưu được. Hãy kiểm tra quyền lưu dữ liệu của trình duyệt.';
                updateRatingVisuals();
                refresh();
            });
        }
        sync();
        document.addEventListener('stylehub-wishlist-change', refresh);
        window.addEventListener('storage', sync);
        window.addEventListener('stylehub-inventory-change', refresh);
        window.addEventListener('stylehub-products-change', refresh);
        document.addEventListener('click', () => setTimeout(sync, 150));
        window.addEventListener('pagehide', sync);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
