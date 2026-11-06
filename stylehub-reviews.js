/* =============================================================================
   THE STYLE HUB — Đánh giá sản phẩm sau mua (trang chi tiết sản phẩm)
   - Chỉ khách ĐÃ MUA sản phẩm mới đánh giá được (máy chủ xác minh qua đơn hàng; chế độ
     tĩnh xác minh qua lịch sử đơn trên trình duyệt).
   - Phân tích cảm xúc bình luận tiếng Việt (recommender/sentiment-vi.js), hiển thị ngay khi gõ.
   - Đánh giá (sao + cảm xúc) là tín hiệu đầu vào của hệ gợi ý: r_eff = 0.7·sao + 0.3·(3 + 2·cảm xúc).
   ========================================================================== */
(function () {
    'use strict';
    var LOCAL_KEY = 'stylehub_reviews_v1';
    var productId = /product-detail\.html$/.test(location.pathname) ? new URLSearchParams(location.search).get('id') : null;
    if (!productId) return;

    var read = function (k, f) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? f : v; } catch (_) { return f; } };
    var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
    var api = function () { return window.StyleHubApi || null; };
    var S = function () { return window.StyleHubSentiment || null; };
    var catalog = function () { return typeof database === 'undefined' ? {} : database; };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function email() { try { return localStorage.getItem('isLoggedInStatus') === 'true' ? String(localStorage.getItem('hub_current_user_key') || localStorage.getItem('hub_email') || '').trim().toLowerCase() : ''; } catch (_) { return ''; } }
    function userKey() { return email().replace(/\s+/g, '_') || 'guest'; }
    function maskName(n) { n = String(n || '').trim(); if (n.length <= 2) return n ? n[0] + '*' : 'Khách hàng'; return n[0] + '***' + n[n.length - 1]; }
    function stars(n) { var out = ''; for (var i = 1; i <= 5; i++) out += i <= Math.round(n) ? '★' : '☆'; return out; }
    function sentimentChip(label) {
        var map = { positive: ['Tích cực', 'is-pos'], neutral: ['Trung lập', 'is-neu'], negative: ['Tiêu cực', 'is-neg'] };
        var m = map[label] || map.neutral;
        return el('span', 'sh-sentiment ' + m[1], m[0]);
    }
    function purchasedLocally() {
        var e = email();
        if (!e) return false;
        return (read('hub_orders_' + e, []) || []).some(function (o) {
            return o && !/hủy|huỷ|cancel|hoàn trả|refund/i.test(o.status || '') && (o.orderedProductsList || []).some(function (i) { return i && (i.key || i.id) === productId; });
        });
    }
    function localState() {
        var all = read(LOCAL_KEY, {});
        var list = Array.isArray(all[productId]) ? all[productId] : [];
        var distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, sum = 0;
        list.forEach(function (r) { distribution[r.rating] = (distribution[r.rating] || 0) + 1; sum += r.rating; });
        var mine = list.find(function (r) { return r.user === userKey(); }) || null;
        return {
            source: 'local',
            stats: { count: list.length, average: list.length ? Math.round(sum / list.length * 100) / 100 : null, distribution: distribution },
            reviews: list.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).map(function (r) { return Object.assign({}, r, { mine: r.user === userKey() }); }),
            canReview: purchasedLocally(), myReview: mine, loggedIn: !!email(), connected: false
        };
    }

    var section, state = null;
    function ensureSection() {
        if (section) return section;
        section = el('section', 'sh-reviews-section');
        section.id = 'shReviewsSection';
        section.setAttribute('aria-labelledby', 'shReviewsTitle');
        var anchor = document.getElementById('shOutfitSection') || document.getElementById('relatedProductsSection');
        if (anchor) anchor.insertAdjacentElement('afterend', section); else document.body.appendChild(section);
        return section;
    }

    function load() {
        var a = api();
        var p = a ? a.getReviews(productId) : Promise.resolve(null);
        return p.then(function (data) {
            if (data && data.ok) {
                state = { source: 'server', stats: data.stats, reviews: data.reviews, canReview: data.canReview, myReview: data.myReview, loggedIn: !!email(), connected: a.isConnected() };
            } else state = localState();
            render();
        });
    }

    function render() {
        var root = ensureSection();
        root.replaceChildren();
        var head = el('div', 'sh-reviews-head');
        head.appendChild(el('span', 'sh-recommend-eyebrow', 'VERIFIED REVIEWS'));
        var h = el('h2', null, 'Đánh giá từ khách đã mua'); h.id = 'shReviewsTitle';
        head.appendChild(h);
        root.appendChild(head);

        var summary = el('div', 'sh-reviews-summary');
        var avg = el('div', 'sh-reviews-avg');
        avg.appendChild(el('strong', null, state.stats.average ? state.stats.average.toFixed(1) : '—'));
        avg.appendChild(el('span', 'sh-stars', stars(state.stats.average || 0)));
        avg.appendChild(el('small', null, state.stats.count + ' đánh giá'));
        summary.appendChild(avg);
        var dist = el('div', 'sh-reviews-dist');
        for (var s = 5; s >= 1; s--) {
            var n = state.stats.distribution[s] || 0;
            var row = el('div', 'sh-dist-row');
            row.appendChild(el('span', null, s + '★'));
            var bar = el('span', 'sh-dist-bar'); var fill = el('i'); fill.style.width = (state.stats.count ? n / state.stats.count * 100 : 0) + '%'; bar.appendChild(fill);
            row.appendChild(bar);
            row.appendChild(el('b', null, String(n)));
            dist.appendChild(row);
        }
        summary.appendChild(dist);
        var labels = { positive: 0, neutral: 0, negative: 0 };
        state.reviews.forEach(function (r) { labels[r.sentimentLabel || 'neutral'] = (labels[r.sentimentLabel || 'neutral'] || 0) + 1; });
        var senti = el('div', 'sh-reviews-senti');
        senti.appendChild(el('span', 'sh-senti-title', 'Cảm xúc bình luận (AI)'));
        ['positive', 'neutral', 'negative'].forEach(function (k) { var c = sentimentChip(k); c.textContent += ' · ' + labels[k]; senti.appendChild(c); });
        summary.appendChild(senti);
        root.appendChild(summary);

        root.appendChild(renderForm());

        var list = el('div', 'sh-reviews-list');
        if (!state.reviews.length) list.appendChild(el('p', 'sh-reviews-empty', 'Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ sau khi mua hàng.'));
        state.reviews.forEach(function (r) {
            var item = el('article', 'sh-review');
            var top = el('div', 'sh-review-top');
            top.appendChild(el('span', 'sh-stars', stars(r.rating)));
            top.appendChild(el('strong', null, r.author || maskName(r.userName)));
            if (r.verifiedPurchase) top.appendChild(el('span', 'sh-badge-verified', '✓ Đã mua hàng'));
            if (r.isDemo) top.appendChild(el('span', 'sh-badge-demo', 'Dữ liệu demo'));
            top.appendChild(sentimentChip(r.sentimentLabel));
            top.appendChild(el('time', null, new Date(r.createdAt).toLocaleDateString('vi-VN')));
            item.appendChild(top);
            if (r.comment) item.appendChild(el('p', 'sh-review-text', r.comment));
            if (r.mine) {
                var del = el('button', 'sh-review-delete', 'Xóa đánh giá của tôi');
                del.type = 'button';
                del.addEventListener('click', function () { removeMine(); });
                item.appendChild(del);
            }
            list.appendChild(item);
        });
        root.appendChild(list);
        root.appendChild(el('p', 'sh-reviews-note', state.source === 'server'
            ? 'Đánh giá được lưu trên máy chủ và chỉ nhận từ tài khoản có đơn hàng chứa sản phẩm này.'
            : 'Chế độ không có máy chủ: đánh giá được lưu trên trình duyệt này, chỉ tài khoản đã đặt sản phẩm này trên trình duyệt mới đánh giá được.'));
    }

    function renderForm() {
        var box = el('div', 'sh-review-form');
        if (!state.loggedIn) { box.appendChild(el('p', 'sh-review-gate', 'Đăng nhập và mua sản phẩm để chia sẻ đánh giá của bạn.')); return box; }
        if (state.source === 'server' && !state.connected) { box.appendChild(el('p', 'sh-review-gate', 'Đang kết nối tài khoản với máy chủ… Hãy đăng nhập lại nếu thông báo này không biến mất.')); return box; }
        if (!state.canReview) { box.appendChild(el('p', 'sh-review-gate', 'Chỉ khách đã mua sản phẩm này mới có thể đánh giá. Sau khi đặt hàng, bạn sẽ thấy ô đánh giá tại đây.')); return box; }
        var mine = state.myReview;
        var rating = mine ? mine.rating : 0;
        box.appendChild(el('p', 'sh-review-form-title', mine ? 'Cập nhật đánh giá của bạn' : 'Viết đánh giá của bạn'));
        var starRow = el('div', 'sh-review-stars');
        starRow.setAttribute('role', 'group');
        starRow.setAttribute('aria-label', 'Chọn số sao');
        var buttons = [];
        for (var i = 1; i <= 5; i++) {
            (function (n) {
                var b = el('button', 'sh-review-star', '★');
                b.type = 'button';
                b.setAttribute('aria-label', n + ' sao');
                b.addEventListener('click', function () { rating = n; paint(); });
                buttons.push(b);
                starRow.appendChild(b);
            })(i);
        }
        function paint() { buttons.forEach(function (b, idx) { b.classList.toggle('is-on', idx < rating); b.setAttribute('aria-pressed', String(idx + 1 === rating)); }); }
        paint();
        box.appendChild(starRow);
        var area = el('textarea');
        area.maxLength = 1000;
        area.rows = 3;
        area.placeholder = 'Chất liệu, form dáng, màu sắc, size… (tối đa 1000 ký tự)';
        area.value = mine ? mine.comment || '' : '';
        area.setAttribute('aria-label', 'Nội dung đánh giá');
        box.appendChild(area);
        var preview = el('p', 'sh-sentiment-preview');
        preview.setAttribute('aria-live', 'polite');
        function updatePreview() {
            var analyzer = S();
            if (!analyzer || !area.value.trim()) { preview.textContent = 'AI sẽ nhận diện cảm xúc bình luận khi bạn nhập.'; return; }
            var r = analyzer.analyze(area.value);
            preview.replaceChildren(el('span', null, 'AI nhận diện cảm xúc: '), sentimentChip(r.label), el('small', null, ' (điểm ' + r.score.toFixed(2) + ')'));
        }
        area.addEventListener('input', updatePreview);
        updatePreview();
        box.appendChild(preview);
        var status = el('p', 'sh-review-status');
        status.setAttribute('role', 'status');
        var submit = el('button', 'sh-review-submit', mine ? 'Cập nhật đánh giá' : 'Gửi đánh giá');
        submit.type = 'button';
        submit.addEventListener('click', function () {
            if (!rating) { status.textContent = 'Vui lòng chọn số sao.'; return; }
            submit.disabled = true;
            save(rating, area.value.trim()).then(function (msg) { status.textContent = msg; submit.disabled = false; });
        });
        box.appendChild(submit);
        box.appendChild(status);
        return box;
    }

    function save(rating, comment) {
        if (state.source === 'server') {
            return api().postReview(productId, rating, comment).then(function (r) {
                if (!r.ok) return (r.data && r.data.message) || 'Không gửi được đánh giá.';
                if (window.StyleHubRecommendations) window.StyleHubRecommendations.markDirty();
                return load().then(function () { return 'Cảm ơn bạn! Đánh giá đã được lưu.'; });
            }).catch(function () { return 'Không kết nối được máy chủ.'; });
        }
        var analyzer = S();
        var s = analyzer && comment ? analyzer.analyze(comment) : { score: null, label: 'neutral' };
        var all = read(LOCAL_KEY, {});
        var list = (Array.isArray(all[productId]) ? all[productId] : []).filter(function (r) { return r.user !== userKey(); });
        list.push({ user: userKey(), author: maskName(localStorage.getItem('hub_name') || email().split('@')[0]), rating: rating, comment: comment.slice(0, 1000), sentiment: s.score, sentimentLabel: s.label, verifiedPurchase: true, createdAt: Date.now() });
        all[productId] = list;
        var ok = write(LOCAL_KEY, all);
        if (window.StyleHubRecommendations) { window.StyleHubRecommendations.markDirty(); }
        state = localState();
        render();
        return Promise.resolve(ok ? 'Đã lưu đánh giá trên trình duyệt này.' : 'Không lưu được (bộ nhớ trình duyệt bị chặn hoặc đầy).');
    }

    function removeMine() {
        if (state.source === 'server') { api().deleteReview(productId).then(load); return; }
        var all = read(LOCAL_KEY, {});
        all[productId] = (Array.isArray(all[productId]) ? all[productId] : []).filter(function (r) { return r.user !== userKey(); });
        write(LOCAL_KEY, all);
        if (window.StyleHubRecommendations) window.StyleHubRecommendations.markDirty();
        state = localState();
        render();
    }

    function start() {
        if (!catalog()[productId]) return;
        load();
        document.addEventListener('stylehub-api-auth-change', function () { load(); });
        document.addEventListener('stylehub-api-synced', function () { if (state && state.source === 'server' && !state.canReview) load(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
