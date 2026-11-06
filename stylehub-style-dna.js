/* =============================================================================
   THE STYLE HUB — Quiz "Style DNA" (giải quyết cold-start) + Hồ sơ phong cách
   - Khách mới trả lời 5 câu (30 giây) -> hồ sơ sở thích ban đầu cho Content-based và
     hybrid "switching" (thực nghiệm: NDCG@10 người dùng mới tăng rõ rệt, xem docs/KET_QUA_THUC_NGHIEM.md).
   - Hồ sơ phong cách hiển thị minh bạch những gì hệ thống "hiểu" về gu của khách,
     cho phép làm lại quiz hoặc xóa toàn bộ lịch sử gợi ý (quyền riêng tư).
   ========================================================================== */
(function () {
    'use strict';
    var R = function () { return window.StyleHubRecommendations || null; };
    var api = function () { return window.StyleHubApi || null; };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

    var QUESTIONS = [
        { key: 'gender', title: 'Bạn thường mua đồ cho ai?', single: true, options: [['men', 'Nam'], ['women', 'Nữ'], ['kids', 'Trẻ em']] },
        { key: 'styles', title: 'Phong cách bạn yêu thích? (tối đa 3)', max: 3, options: [['streetwear', 'Streetwear'], ['minimal', 'Tối giản'], ['sporty', 'Thể thao'], ['smart', 'Thanh lịch'], ['casual', 'Casual'], ['lounge', 'Thoải mái/mặc nhà'], ['vintage', 'Vintage'], ['workwear', 'Workwear']] },
        { key: 'colors', title: 'Màu bạn hay mặc? (tối đa 3)', max: 3, options: [['black', 'Đen'], ['white', 'Trắng'], ['beige', 'Be/kem'], ['grey', 'Xám'], ['brown', 'Nâu'], ['blue', 'Xanh dương'], ['green', 'Xanh lá'], ['red', 'Đỏ'], ['pink', 'Hồng']] },
        { key: 'types', title: 'Bạn đang tìm sản phẩm nào? (tối đa 3)', max: 3, options: [['tee', 'Áo thun'], ['hoodie', 'Hoodie'], ['sweatshirt', 'Áo nỉ'], ['shirt', 'Sơ mi'], ['polo', 'Polo'], ['jacket', 'Áo khoác'], ['sweatpants', 'Quần nỉ'], ['pants', 'Quần dài'], ['jeans', 'Jeans'], ['shorts', 'Quần short'], ['sneaker', 'Giày sneaker']] },
        { key: 'budget', title: 'Ngân sách cho mỗi sản phẩm?', single: true, options: [['budget', 'Dưới 1,5 triệu'], ['mid', '1,5 – 4 triệu'], ['premium', '4 – 8 triệu'], ['luxury', 'Trên 8 triệu']] }
    ];

    /* ---------------- Quiz ---------------- */
    var modal = null;
    function openQuiz() {
        var current = (R() && R().getQuiz()) || {};
        if (!modal) {
            modal = el('div', 'sh-quiz-overlay');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'shQuizTitle');
            modal.addEventListener('click', function (e) { if (e.target === modal) closeQuiz(); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeQuiz(); });
            document.body.appendChild(modal);
        }
        modal.replaceChildren();
        var box = el('div', 'sh-quiz');
        var close = el('button', 'sh-quiz-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Đóng'); close.addEventListener('click', closeQuiz);
        var title = el('h3', null, 'Style DNA — 30 giây để hiểu gu của bạn'); title.id = 'shQuizTitle';
        box.append(close, el('span', 'sh-recommend-eyebrow', 'COLD-START QUIZ'), title,
            el('p', 'sh-quiz-lede', 'Câu trả lời chỉ dùng để cá nhân hóa gợi ý. Bạn có thể làm lại hoặc xóa bất cứ lúc nào.'));
        var answers = {};
        QUESTIONS.forEach(function (q) {
            var pre = current[q.key];
            answers[q.key] = q.single ? (pre || null) : (Array.isArray(pre) ? pre.slice(0, q.max) : []);
            var group = el('fieldset', 'sh-quiz-group');
            group.appendChild(el('legend', null, q.title));
            var chips = el('div', 'sh-quiz-chips');
            q.options.forEach(function (opt) {
                var chip = el('button', 'sh-quiz-chip', opt[1]);
                chip.type = 'button';
                var selected = function () { return q.single ? answers[q.key] === opt[0] : answers[q.key].indexOf(opt[0]) >= 0; };
                var paint = function () { chips.querySelectorAll('.sh-quiz-chip').forEach(function (c) { c.classList.toggle('is-on', c._sel()); c.setAttribute('aria-pressed', String(c._sel())); }); };
                chip._sel = selected;
                chip.addEventListener('click', function () {
                    if (q.single) answers[q.key] = selected() ? null : opt[0];
                    else if (selected()) answers[q.key] = answers[q.key].filter(function (x) { return x !== opt[0]; });
                    else if (answers[q.key].length < q.max) answers[q.key] = answers[q.key].concat([opt[0]]);
                    paint();
                });
                chips.appendChild(chip);
            });
            group.appendChild(chips);
            box.appendChild(group);
            setTimeout(function () { chips.querySelectorAll('.sh-quiz-chip').forEach(function (c) { c.classList.toggle('is-on', c._sel()); c.setAttribute('aria-pressed', String(c._sel())); }); }, 0);
        });
        var status = el('p', 'sh-quiz-status'); status.setAttribute('role', 'status');
        var save = el('button', 'sh-quiz-save', 'Lưu & xem gợi ý hợp gu'); save.type = 'button';
        save.addEventListener('click', function () {
            var quiz = { gender: answers.gender || undefined, styles: answers.styles, colors: answers.colors, types: answers.types, budget: answers.budget || undefined };
            if (!quiz.gender && !quiz.styles.length && !quiz.colors.length && !quiz.types.length && !quiz.budget) { status.textContent = 'Hãy chọn ít nhất một câu trả lời.'; return; }
            if (R()) R().saveQuiz(quiz);
            status.textContent = 'Đã lưu Style DNA!';
            setTimeout(function () { closeQuiz(); renderAll(); }, 350);
        });
        box.append(save, status);
        modal.appendChild(box);
        modal.classList.add('is-open');
        document.body.classList.add('sh-quiz-lock');
        setTimeout(function () { close.focus(); }, 30);
    }
    function closeQuiz() { if (modal) modal.classList.remove('is-open'); document.body.classList.remove('sh-quiz-lock'); }

    /* ---------------- Hồ sơ phong cách ---------------- */
    function bars(title, list) {
        var wrap = el('div', 'sh-dna-group');
        wrap.appendChild(el('h4', null, title));
        if (!list || !list.length) { wrap.appendChild(el('p', 'sh-dna-empty', 'Chưa đủ dữ liệu')); return wrap; }
        list.forEach(function (x) {
            var row = el('div', 'sh-dna-row');
            row.appendChild(el('span', null, x.label));
            var bar = el('span', 'sh-dna-bar'); var fill = el('i'); fill.style.width = Math.max(4, x.share) + '%'; bar.appendChild(fill);
            row.append(bar, el('b', null, x.share + '%'));
            wrap.appendChild(row);
        });
        return wrap;
    }
    function hasSignal(dna) { return dna && (dna.interactions > 0 || dna.fromQuiz) && dna.persona; }

    function renderDNA(container, dna, opts) {
        opts = opts || {};
        container.replaceChildren();
        if (!hasSignal(dna)) {
            var cta = el('div', 'sh-dna-cta');
            cta.append(el('strong', null, 'Mới đến THE STYLE HUB?'),
                el('p', null, 'Làm quiz Style DNA 30 giây để nhận gợi ý đúng gu ngay từ lần đầu — không cần chờ hệ thống học từ lịch sử xem.'));
            var start = el('button', 'sh-dna-btn', 'Làm quiz Style DNA'); start.type = 'button'; start.addEventListener('click', openQuiz);
            cta.appendChild(start);
            container.appendChild(cta);
            return;
        }
        var head = el('div', 'sh-dna-head');
        head.append(el('span', 'sh-recommend-eyebrow', 'YOUR STYLE DNA'), el('h3', null, dna.persona));
        var meta = el('p', 'sh-dna-meta', (dna.fromQuiz ? 'Từ quiz' : 'Từ hành vi') + (dna.interactions ? ' · ' + dna.interactions + ' sản phẩm đã tương tác' : '') +
            ' · độ tin cậy ' + Math.round((dna.confidence || 0) * 100) + '%' + (opts.source ? ' · ' + opts.source : ''));
        head.appendChild(meta);
        container.appendChild(head);
        if (opts.compact) {
            var chips = el('div', 'sh-dna-chips');
            [].concat(dna.types.slice(0, 2), dna.colors.slice(0, 2), dna.styles.slice(0, 2)).forEach(function (x) { chips.appendChild(el('span', 'sh-dna-chip', x.label)); });
            container.appendChild(chips);
        } else {
            var grid = el('div', 'sh-dna-grid');
            grid.append(bars('Loại sản phẩm', dna.types), bars('Màu sắc', dna.colors), bars('Phong cách', dna.styles), bars('Mức giá', dna.prices));
            container.appendChild(grid);
        }
        var actions = el('div', 'sh-dna-actions');
        var redo = el('button', 'sh-dna-btn ghost', dna.fromQuiz ? 'Làm lại quiz' : 'Làm quiz để tinh chỉnh'); redo.type = 'button'; redo.addEventListener('click', openQuiz);
        actions.appendChild(redo);
        if (opts.allowClear) {
            var clear = el('button', 'sh-dna-btn danger', 'Xóa lịch sử gợi ý'); clear.type = 'button';
            clear.addEventListener('click', function () {
                if (!window.confirm('Xóa toàn bộ lịch sử xem, đánh giá hợp gu và quiz dùng cho gợi ý? (Đơn hàng và đánh giá sản phẩm không bị xóa)')) return;
                var p = R() ? R().clearHistory() : Promise.resolve();
                Promise.resolve(p).then(function () { renderAll(); });
            });
            actions.appendChild(clear);
        }
        container.appendChild(actions);
    }

    function localDNA() { try { return R() ? R().styleDNA() : null; } catch (_) { return null; } }

    function renderInto(container, opts) {
        var local = localDNA();
        renderDNA(container, local, Object.assign({}, opts, { source: 'trên trình duyệt' }));
        var a = api();
        if (a && a.isConnected()) {
            a.getStyleDNA().then(function (data) {
                if (data && data.dna && hasSignal(data.dna)) renderDNA(container, data.dna, Object.assign({}, opts, { source: 'đồng bộ máy chủ' }));
            });
        }
    }

    function renderHome() {
        var section = document.getElementById('shPersonalSection');
        if (!section) return;
        var box = document.getElementById('shStyleDnaHome');
        if (!box) {
            box = el('div', 'sh-dna-home');
            box.id = 'shStyleDnaHome';
            var grid = document.getElementById('shPersonalGrid');
            if (grid) section.insertBefore(box, grid); else section.appendChild(box);
        }
        var card = box.querySelector('.sh-dna-home-card');
        if (!card) { card = el('div', 'sh-dna-home-card'); box.appendChild(card); }
        renderInto(card, { compact: true });
    }
    function renderAccount() {
        var box = document.getElementById('shStyleDnaAccount');
        if (!box) return;
        renderInto(box, { allowClear: true });
        var status = document.getElementById('shStyleDnaSync');
        if (status) {
            var a = api();
            if (!a) { status.textContent = 'Chế độ tĩnh: gợi ý tính trên trình duyệt này.'; return; }
            a.available().then(function (up) {
                status.textContent = !up ? 'Không có máy chủ gợi ý — đang dùng dữ liệu trên trình duyệt này.'
                    : a.isConnected() ? 'Đã đồng bộ với máy chủ gợi ý: hành vi của bạn được dùng trên mọi thiết bị.' : 'Máy chủ gợi ý sẵn sàng — hãy đăng nhập lại để đồng bộ tài khoản.';
            });
        }
    }
    function renderAll() { renderHome(); renderAccount(); }

    window.StyleHubStyleDNA = { openQuiz: openQuiz, render: renderAll };
    document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest('[data-open-style-quiz]') : null;
        if (t) { e.preventDefault(); openQuiz(); }
    });
    function start() {
        renderAll();
        document.addEventListener('stylehub-preferences-change', function () { setTimeout(renderAll, 50); });
        document.addEventListener('stylehub-api-auth-change', renderAll);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
