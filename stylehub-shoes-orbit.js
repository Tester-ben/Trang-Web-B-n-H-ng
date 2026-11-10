/* =============================================================================
   THE STYLE HUB — "Shoes Orbit" cho trang chủ (thay dải giày chạy ngang).
   - Giày lấy từ product-data.js (mọi sản phẩm ngành Giày, kể cả giày admin thêm).
   - Giày xếp trên một cung tròn; đôi đang chọn lớn nhất. Kéo bánh xe, kéo trên khu giày,
     cuộn ngang bằng touchpad hoặc phím ←/→ để xoay; bấm đôi bên cạnh để đưa vào giữa.
   - Bấm đôi đang chọn / "Xem chi tiết" / một size: mở trang sản phẩm bình thường.
   Ý tưởng bố cục tham khảo dạng "shoe orbit"; mã viết riêng cho website này.
   ========================================================================== */
(function () {
    'use strict';

    var root = document.querySelector('[data-shoes-orbit]');
    if (!root || typeof database === 'undefined' || !database) return;

    var SIZES = [37, 38, 39, 40, 41, 42, 43, 44];
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var admin = window.StyleHubProductAdmin || null;

    function departmentOf(id, item) {
        if (admin && typeof admin.inferDepartment === 'function') return admin.inferDepartment(id, item);
        return String(id).toLowerCase().indexOf('shoe') === 0 ? 'shoes' : '';
    }
    function imageOf(item) { return item.mainImg || (Array.isArray(item.images) ? item.images[0] : '') || ''; }
    function splitName(name) {
        var text = String(name || '').trim();
        var cut = text.indexOf(' - ');
        return cut > 0 ? { model: text.slice(0, cut), color: text.slice(cut + 3) } : { model: text, color: '' };
    }
    function pad2(n) { return n < 10 ? '0' + n : String(n); }
    function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

    var shoes = Object.keys(database).filter(function (id) {
        var item = database[id];
        return item && departmentOf(id, item) === 'shoes' && imageOf(item);
    }).map(function (id) {
        var item = database[id];
        var parts = splitName(item.name);
        return { id: id, item: item, model: parts.model, color: parts.color, image: imageOf(item), url: 'product-detail.html?id=' + encodeURIComponent(id) };
    });
    var n = shoes.length;
    if (n < 2) { root.hidden = true; return; }

    /* ---------- Dựng giao diện ---------- */
    var stage = root.querySelector('[data-orbit-stage]');
    var info = root.querySelector('[data-orbit-info]');
    var el = {
        count: root.querySelector('[data-orbit-count]'),
        brand: root.querySelector('[data-orbit-brand]'),
        name: root.querySelector('[data-orbit-name]'),
        color: root.querySelector('[data-orbit-color]'),
        price: root.querySelector('[data-orbit-price]'),
        stock: root.querySelector('[data-orbit-stock]'),
        link: root.querySelector('[data-orbit-link]'),
        sizes: root.querySelector('[data-orbit-sizes]'),
        wheel: root.querySelector('[data-orbit-wheel]'),
        ridges: root.querySelector('[data-orbit-ridges]'),
        first: root.querySelector('[data-orbit-first]'),
        last: root.querySelector('[data-orbit-last]'),
        live: root.querySelector('[data-orbit-live]')
    };

    ['', ' is-inner'].forEach(function (extra) {
        var ring = document.createElement('div');
        ring.className = 'sh-orbit-ring' + extra;
        ring.setAttribute('aria-hidden', 'true');
        stage.appendChild(ring);
    });

    var nodes = shoes.map(function (shoe, i) {
        var a = document.createElement('a');
        a.className = 'sh-orbit-shoe';
        a.href = shoe.url;
        a.draggable = false;
        a.tabIndex = -1;
        a.setAttribute('aria-label', (shoe.item.name || 'Giày') + (shoe.item.price ? ', ' + shoe.item.price : ''));
        var img = document.createElement('img');
        img.src = shoe.image;
        img.alt = shoe.item.name || 'Giày';
        img.loading = i < 4 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        a.appendChild(img);
        stage.appendChild(a);
        return a;
    });

    var RIDGES = 26;
    var ridgeNodes = [];
    for (var r = 0; r < RIDGES; r++) {
        var ridge = document.createElement('span');
        ridge.className = 'sh-orbit-ridge';
        el.ridges.appendChild(ridge);
        ridgeNodes.push(ridge);
    }
    if (el.first) el.first.textContent = '01';
    if (el.last) el.last.textContent = pad2(n);
    el.wheel.setAttribute('aria-valuemin', '1');
    el.wheel.setAttribute('aria-valuemax', String(n));

    /* ---------- Hình học: vị trí trên cung tròn ---------- */
    var G = null;
    function measure() {
        var W = stage.clientWidth, H = stage.clientHeight;
        var mobile = window.matchMedia('(max-width: 860px)').matches;
        // Góc tính theo độ, chiều dương ngược kim đồng hồ (trục y hướng lên).
        G = mobile
            ? { W: W, H: H, cx: W * 1.12, cy: H * 1.02, R: W * 0.98, hero: 126, step: 25, fade: 1.6, size: clamp(W * 0.6, 200, 330) }
            : { W: W, H: H, cx: W * 0.80, cy: H * 1.16, R: H * 0.98, hero: 121, step: 21, fade: 2.6, size: clamp(W * 0.31, 300, 470) };
        stage.style.setProperty('--orbit-cx', G.cx.toFixed(1) + 'px');
        stage.style.setProperty('--orbit-cy', G.cy.toFixed(1) + 'px');
        stage.style.setProperty('--orbit-r', G.R.toFixed(1) + 'px');
        root.style.setProperty('--orbit-size', Math.round(G.size) + 'px');
    }

    function wrapDelta(d) {
        // khoảng cách vòng tròn ngắn nhất trong [-n/2, n/2)
        d = ((d % n) + n) % n;
        return d >= n / 2 ? d - n : d;
    }
    function indexOf(v) { return ((Math.round(v) % n) + n) % n; }

    /* ---------- Trạng thái chuyển động ---------- */
    var start = Math.min(1, n - 1);
    var pos = start, target = start, active = -1;
    var raf = 0, last = 0, visible = true, interacted = false;

    function render(now) {
        if (!G) measure();
        for (var i = 0; i < n; i++) {
            var d = wrapDelta(i - pos), ad = Math.abs(d);
            var ang = (G.hero - d * G.step) * Math.PI / 180;
            var x = G.cx + G.R * Math.cos(ang);
            var y = G.cy - G.R * Math.sin(ang);
            var rot = d * G.step * 0.45;
            var scale = Math.max(0.3, 1 - 0.34 * ad);
            var opacity = ad > G.fade + 1 ? 0 : clamp(1 - (ad - G.fade) * 0.9, 0, 1);
            var bob = !reduceMotion && ad < 0.5 ? Math.sin((now || 0) / 650) * 5 * (1 - ad * 2) : 0;
            var node = nodes[i];
            node.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y + bob).toFixed(1) + 'px,0) translate(-50%,-58%) rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
            node.style.opacity = opacity.toFixed(3);
            node.style.zIndex = String(100 - Math.round(ad * 10));
            node.style.pointerEvents = opacity < 0.15 ? 'none' : '';
            node.style.visibility = opacity <= 0.001 ? 'hidden' : '';
        }
        drawRidges();
        var a = indexOf(pos);
        if (a !== active) setActive(a);
    }

    function drawRidges() {
        var w = el.ridges.clientWidth || 300;
        var offset = pos * (Math.PI * 2 / 9); // bánh xe quay 1/9 vòng mỗi đôi giày
        for (var k = 0; k < RIDGES; k++) {
            var phi = (k / RIDGES) * Math.PI * 2 - offset;
            phi = Math.atan2(Math.sin(phi), Math.cos(phi));
            var node = ridgeNodes[k];
            if (Math.abs(phi) >= Math.PI / 2) { node.style.opacity = '0'; continue; }
            var c = Math.cos(phi);
            var width = Math.max(1, 5 * c);
            var x = w * (0.5 + 0.5 * Math.sin(phi)) - width / 2;
            node.style.transform = 'translateX(' + x.toFixed(1) + 'px) scaleX(' + (width / 4).toFixed(3) + ')';
            node.style.opacity = (0.2 + 0.8 * c).toFixed(3);
        }
    }

    function tick(now) {
        raf = 0;
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        if (!dragging) {
            if (reduceMotion) pos = target;
            else pos += (target - pos) * (1 - Math.exp(-dt / 0.11));
            if (Math.abs(target - pos) < 0.0005) pos = target;
        }
        render(now);
        // Tiếp tục vẽ khi đang chuyển động hoặc để đôi giữa "lơ lửng" nhẹ khi khu đang hiện.
        if (visible && (dragging || pos !== target || !reduceMotion)) schedule();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

    function goTo(v) {
        target = v;
        schedule();
    }
    function step(delta) { interacted = true; goTo(Math.round(target) + delta); }

    function setActive(i) {
        active = i;
        var shoe = shoes[i];
        var item = shoe.item;
        el.count.textContent = pad2(i + 1) + ' / ' + pad2(n);
        el.brand.textContent = item.brand || 'THE STYLE HUB';
        el.name.textContent = shoe.model;
        el.color.textContent = shoe.color;
        el.color.hidden = !shoe.color;
        el.price.textContent = item.price || '';
        el.link.href = shoe.url;
        el.link.setAttribute('aria-label', 'Xem chi tiết ' + (item.name || 'sản phẩm'));
        var stock = admin && typeof admin.getAdminStockInfo === 'function' ? admin.getAdminStockInfo(shoe.id) : null;
        if (stock && el.stock) {
            el.stock.textContent = stock.vn;
            el.stock.className = 'sh-orbit-stock' + (stock.status === 'out' ? ' is-out' : stock.status === 'low' ? ' is-low' : '');
            el.stock.hidden = false;
        }
        el.sizes.querySelectorAll('a').forEach(function (a) {
            a.href = shoe.url + '&size=' + a.getAttribute('data-size');
            a.setAttribute('aria-label', 'Size ' + a.getAttribute('data-size') + ' — ' + (item.name || 'giày'));
        });
        nodes.forEach(function (node, j) {
            node.tabIndex = j === i ? 0 : -1;
            node.setAttribute('aria-current', j === i ? 'true' : 'false');
        });
        el.wheel.setAttribute('aria-valuenow', String(i + 1));
        el.wheel.setAttribute('aria-valuetext', pad2(i + 1) + ' / ' + pad2(n) + ': ' + (item.name || ''));
        if (el.live) el.live.textContent = (item.name || '') + ', ' + (item.price || '');
        info.classList.remove('is-changing');
        void info.offsetWidth; // chạy lại hiệu ứng chữ
        info.classList.add('is-changing');
    }

    SIZES.forEach(function (size) {
        var a = document.createElement('a');
        a.className = 'sh-orbit-size';
        a.textContent = String(size);
        a.setAttribute('data-size', String(size));
        el.sizes.appendChild(a);
    });

    /* ---------- Kéo: bánh xe và khu giày ---------- */
    var dragging = null;
    var suppressClick = false;

    function beginDrag(e, pxPerStep, source) {
        if (e.button !== undefined && e.button !== 0) return;
        interacted = true;
        dragging = { x: e.clientX, y: e.clientY, pos: pos, px: pxPerStep, moved: false, source: source, t: performance.now(), v: 0, lastX: e.clientX };
        if (source === 'wheel') {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (error) {}
            e.preventDefault();
        }
    }
    function moveDrag(e) {
        if (!dragging) return;
        var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
        if (!dragging.moved) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            // Trên khu giày: vuốt dọc là cuộn trang, chỉ vuốt ngang mới xoay.
            if (dragging.source === 'stage' && Math.abs(dy) > Math.abs(dx)) { dragging = null; return; }
            dragging.moved = true;
            root.classList.add('is-dragging');
            if (dragging.source === 'stage') {
                try { stage.setPointerCapture(e.pointerId); } catch (error) {}
            }
        }
        var now = performance.now();
        var dtMs = Math.max(1, now - dragging.t);
        dragging.v = (e.clientX - dragging.lastX) / dtMs;
        dragging.t = now;
        dragging.lastX = e.clientX;
        pos = dragging.pos - dx / dragging.px;
        target = pos;
        schedule();
    }
    function endDrag() {
        if (!dragging) return;
        if (dragging.moved) {
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 0);
            var fling = clamp(-dragging.v * 110 / dragging.px, -2, 2); // quán tính theo tốc độ vuốt
            goTo(Math.round(pos + fling));
        }
        dragging = null;
        root.classList.remove('is-dragging');
        schedule();
    }

    el.wheel.addEventListener('pointerdown', function (e) { beginDrag(e, 46, 'wheel'); });
    el.wheel.addEventListener('pointermove', moveDrag);
    el.wheel.addEventListener('pointerup', endDrag);
    el.wheel.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerdown', function (e) { beginDrag(e, Math.max(120, (G ? G.W : 900) * 0.16), 'stage'); });
    stage.addEventListener('pointermove', moveDrag);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // Bấm đôi bên cạnh: đưa vào giữa thay vì mở trang; bấm đôi giữa: mở trang sản phẩm.
    stage.addEventListener('click', function (e) {
        var node = e.target.closest('.sh-orbit-shoe');
        if (suppressClick) { e.preventDefault(); return; }
        if (!node) return;
        var i = nodes.indexOf(node);
        if (i !== active) {
            e.preventDefault();
            interacted = true;
            goTo(Math.round(target) + wrapDelta(i - Math.round(target)));
        }
    });

    // Touchpad cuộn ngang (không chặn cuộn dọc của trang).
    var wheelAcc = 0, wheelTimer = 0;
    stage.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        interacted = true;
        wheelAcc += e.deltaX;
        if (Math.abs(wheelAcc) > 60) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () { wheelAcc = 0; }, 160);
    }, { passive: false });

    function onKey(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
        else if (e.key === 'Home') { e.preventDefault(); interacted = true; goTo(Math.round(target) + wrapDelta(0 - Math.round(target))); }
        else if (e.key === 'End') { e.preventDefault(); interacted = true; goTo(Math.round(target) + wrapDelta(n - 1 - Math.round(target))); }
    }
    el.wheel.addEventListener('keydown', onKey);
    stage.addEventListener('keydown', onKey);

    /* ---------- Tự xoay nhẹ khi chưa ai chạm, dừng khi rê chuột / rời màn hình ---------- */
    var hovering = false;
    root.addEventListener('pointerenter', function () { hovering = true; });
    root.addEventListener('pointerleave', function () { hovering = false; });
    root.addEventListener('focusin', function () { hovering = true; });
    root.addEventListener('focusout', function () { hovering = false; });
    if (!reduceMotion) {
        setInterval(function () {
            if (!interacted && !hovering && visible && !dragging && !document.hidden) goTo(Math.round(target) + 1);
        }, 4200);
    }

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (visible) schedule();
        }, { rootMargin: '120px' }).observe(root);
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { measure(); render(performance.now()); }, 80);
    });

    measure();
    render(0);
    root.classList.add('is-ready');
    schedule();
})();
