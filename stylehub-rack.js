/* =============================================================================
   THE STYLE HUB — "Sào treo đồ" cho khu "Được chọn cho bạn" ở trang chủ.
   -----------------------------------------------------------------------------
   Hiển thị ĐÚNG danh sách do hệ gợi ý trả về (StyleHubRecommendations.recommendHome,
   gọi từ stylehub-premium-home.js) dưới dạng các món đồ treo trên một thanh sào:
   - Ảnh sản phẩm được tách nền ngay trên trình duyệt: ảnh sản phẩm của shop có nền
     phẳng #f5f5f5 và máy chủ ảnh cho phép CORS. Ảnh có nền không phẳng (ảnh người mẫu)
     được treo kiểu ảnh kẹp; ảnh lỗi -> thẻ tên sản phẩm. Không món nào bị bỏ khỏi danh sách.
   - Áo treo bằng móc, quần bằng móc kẹp, giày bằng dây; thẻ giá đung đưa theo món đồ.
   - Rê chuột: món đồ xoay mặt trước ra, các món bên cạnh dạt ra; gió nhẹ làm đồ đung đưa.
   - Bấm (hoặc Enter): món đồ bay ra giữa màn hình -> xem mặt trước/sau, lý do được gợi ý,
     chọn size, thêm vào BAG hoặc mở trang sản phẩm.
   Lượt hiển thị / lượt bấm vẫn được ghi qua data-rec-* như các thẻ gợi ý cũ.
   Ý tưởng tương tác tham khảo trang "scene-rail" của repo runway; mã viết riêng cho dự án.
   ========================================================================== */
(function () {
    'use strict';

    var doc = document;
    var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
    var reduceMotion = mq('(prefers-reduced-motion: reduce)');
    var finePointer = mq('(hover: hover) and (pointer: fine)');

    var BG_TOL = 6;          // nền ảnh shop phẳng tuyệt đối (#f5f5f5) -> ngưỡng rất chặt để không ăn vào áo trắng
    var FEATHER = 30;        // làm mềm mép áo
    var RAIL_IMG_W = 720;    // ảnh dùng trên sào
    var FOCUS_IMG_W = 1200;  // ảnh dùng trong khung xem chi tiết
    var SIZES = { clothing: ['S', 'M', 'L', 'XL'], kids: ['XS', 'S', 'M', 'L'], shoes: ['37', '38', '39', '40', '41', '42', '43', '44'] };
    var CART_KEYS = ['stylehub_cart_memory_v1', 'stylehub_cart', 'hub_cart', 'cartMemoryArray', 'the_style_hub_cart', 'cart'];

    /* ---------------- tiện ích ---------------- */
    function el(tag, cls, text) {
        var n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = text;
        return n;
    }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function catalog() {
        try { if (typeof database === 'object' && database) return database; } catch (e) { /* bỏ qua */ }
        return window.database || {};
    }
    function attrsOf(id, p) {
        var A = window.STYLEHUB_PRODUCT_ATTRIBUTES || {};
        if (A[id]) return A[id];
        var E = window.StyleHubRecEngine;
        if (E && typeof E.inferAttributes === 'function') { try { return E.inferAttributes(id, p) || {}; } catch (e) { /* bỏ qua */ } }
        return {};
    }
    function priceNum(p) {
        var n = Number(p && p.priceNum);
        if (Number.isFinite(n) && n > 0) return n;
        n = Number(String((p && p.price) || '').replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? n : 0;
    }
    function formatVND(n) { return n ? Math.round(n).toLocaleString('vi-VN') + ' ₫' : ''; }
    function shortPrice(n) {
        if (!n) return '';
        if (n >= 1e6) return (Math.round(n / 1e4) / 100).toString().replace('.', ',') + 'tr';
        return Math.round(n / 1000) + 'k';
    }
    function imagesOf(p) {
        var list = [];
        if (p && p.mainImg) list.push(p.mainImg);
        (p && Array.isArray(p.images) ? p.images : []).forEach(function (u) { if (u && list.indexOf(u) < 0) list.push(u); });
        return list;
    }
    /** Ảnh từ CDN của shop (Shopify) có thể xin đúng kích thước cần dùng. */
    function sized(url, w) {
        if (!url || url.indexOf('/cdn/shop/') < 0) return url;
        if (/[?&]width=\d+/.test(url)) return url.replace(/([?&])width=\d+/, '$1width=' + w);
        return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w;
    }
    function sizeKind(id, a) {
        var key = String(id || '').toLowerCase();
        if (key.indexOf('shoe') === 0 || (a && a.category === 'footwear')) return 'shoes';
        if (key.indexOf('kids') === 0 || (a && a.gender === 'kids')) return 'kids';
        return 'clothing';
    }
    function hangKind(a) {
        if (a && a.category === 'footwear') return 'string';
        if (a && a.category === 'bottom') return 'clip';
        return 'hanger';
    }
    function inStock(id, p) {
        try {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.getAdminStockInfo === 'function') {
                return window.StyleHubProductAdmin.getAdminStockInfo(id).status !== 'out';
            }
        } catch (e) { /* bỏ qua */ }
        return !(p && (p.outOfStock || (p.stock !== undefined && Number(p.stock) <= 0)));
    }

    /* ---------------- tách nền ảnh ---------------- */
    function median(arr) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s[s.length >> 1]; }
    function byte(v) { return v < 0 ? 0 : (v > 255 ? 255 : Math.round(v)); }

    function loadImage(url) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.decoding = 'async';
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('image')); };
            img.src = url;
        });
    }

    /**
     * Tách nền một ảnh sản phẩm. Trả về:
     *  { canvas, w, h, neck (0..1), topL, topR (0..1, bề rộng phần trên cùng: cạp quần / cổ áo) }
     *  hoặc { photo: true } khi nền không phẳng (ảnh người mẫu) hay trình duyệt không cho đọc ảnh.
     */
    function cutoutImage(img, maxH) {
        var nw = img.naturalWidth, nh = img.naturalHeight;
        if (!nw || !nh) return { photo: true };
        var s = Math.min(1, maxH / nh);
        var w = Math.max(8, Math.round(nw * s)), h = Math.max(8, Math.round(nh * s));
        var cv = el('canvas'); cv.width = w; cv.height = h;
        var g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h);
        var data;
        try { data = g.getImageData(0, 0, w, h); } catch (e) { return { photo: true }; }
        var p = data.data, n = w * h, i, k, x, y;

        // 1) Màu nền = trung vị các điểm ở mép ảnh; nền phải phẳng và sáng.
        var rs = [], gs = [], bs = [], step = Math.max(1, Math.floor(Math.min(w, h) / 160));
        var sample = function (sx, sy) { var o = (sy * w + sx) * 4; rs.push(p[o]); gs.push(p[o + 1]); bs.push(p[o + 2]); };
        for (x = 0; x < w; x += step) { sample(x, 0); sample(x, h - 1); }
        for (y = 0; y < h; y += step) { sample(0, y); sample(w - 1, y); }
        var br = median(rs), bgc = median(gs), bb = median(bs), near = 0;
        for (i = 0; i < rs.length; i++) {
            if (Math.max(Math.abs(rs[i] - br), Math.abs(gs[i] - bgc), Math.abs(bs[i] - bb)) <= 10) near++;
        }
        if (near / rs.length < 0.9 || (br + bgc + bb) / 3 < 200) return { photo: true };

        // 2) Loang từ mép ảnh, hai ngưỡng: chỉ loang qua điểm gần như TRÙNG màu nền (nhiễu JPEG của nền phẳng), rồi
        //    mới ăn thêm tối đa 2 px sát áo: điểm hơi lệch nền hoặc viền sáng hơn nền. Vải sáng (be, xám nhạt) chỉ
        //    chênh nền vài mức vì vậy không bị loang ăn sâu thành mép rách.
        var diff = new Uint8Array(n), L = new Uint8Array(n), G = new Uint8Array(n), bright = new Uint8Array(n);
        for (i = 0; i < n; i++) {
            var o = i * 4, cr = p[o], cg = p[o + 1], cb = p[o + 2];
            L[i] = (cr + cg + cb) / 3;
            var cmx = cr > cg ? (cr > cb ? cr : cb) : (cg > cb ? cg : cb), cmn = cr < cg ? (cr < cb ? cr : cb) : (cg < cb ? cg : cb);
            G[i] = cmx - cmn <= 8 ? 1 : 0;
            bright[i] = cr >= br - 1 && cg >= bgc - 1 && cb >= bb - 1 ? 1 : 0;
            var e1 = cr - br, e2 = cg - bgc, e3 = cb - bb;
            if (e1 < 0) e1 = -e1; if (e2 < 0) e2 = -e2; if (e3 < 0) e3 = -e3;
            diff[i] = e1 > e2 ? (e1 > e3 ? e1 : e3) : (e2 > e3 ? e2 : e3);
        }
        var dev = 0, devN = 0;
        for (i = 0; i < rs.length; i++) {
            var dv = Math.max(Math.abs(rs[i] - br), Math.abs(gs[i] - bgc), Math.abs(bs[i] - bb));
            if (dv <= 10) { dev += dv; devN++; }
        }
        var noise = devN ? dev / devN : 0;
        var T1 = clamp(Math.round(noise * 2) + 3, 4, BG_TOL);
        // Nền studio phẳng tuyệt đối, còn vải (kể cả vải sáng gần màu nền) luôn có vân: chỉ loang qua điểm có ô 3x3
        // gần như không đổi độ sáng. Nhờ vậy vệt loang dừng ngay mép vải phía được chiếu sáng, không gặm vào trong.
        var FLAT = clamp(Math.round(noise * 2) + 3, 3, 6);
        // độ chênh sáng trong ô 3x3 (tách hai chiều cho nhanh: min/max theo hàng rồi theo cột)
        var rng = new Uint8Array(n), hMin = new Uint8Array(n), hMax = new Uint8Array(n);
        for (y = 0; y < h; y++) {
            var rb0 = y * w;
            hMin[rb0] = hMax[rb0] = L[rb0]; hMin[rb0 + w - 1] = hMax[rb0 + w - 1] = L[rb0 + w - 1];
            for (x = 1; x < w - 1; x++) {
                var kh = rb0 + x, la = L[kh - 1], lb = L[kh], lc = L[kh + 1];
                hMin[kh] = la < lb ? (la < lc ? la : lc) : (lb < lc ? lb : lc);
                hMax[kh] = la > lb ? (la > lc ? la : lc) : (lb > lc ? lb : lc);
            }
        }
        for (k = w; k < n - w; k++) {
            var mnA = hMin[k - w], mnB = hMin[k], mnC = hMin[k + w], mxA = hMax[k - w], mxB = hMax[k], mxC = hMax[k + w];
            var mn3 = mnA < mnB ? (mnA < mnC ? mnA : mnC) : (mnB < mnC ? mnB : mnC);
            var mx3 = mxA > mxB ? (mxA > mxC ? mxA : mxC) : (mxB > mxC ? mxB : mxC);
            rng[k] = mx3 - mn3;
        }
        var bg = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0;
        var push = function (kk) { if (!bg[kk] && diff[kk] <= T1 && rng[kk] <= FLAT) { bg[kk] = 1; q[qt++] = kk; } };
        for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
        for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (qh < qt) {
            k = q[qh++];
            var kx = k % w;
            if (kx > 0) push(k - 1);
            if (kx < w - 1) push(k + 1);
            if (k >= w) push(k - w);
            if (k < n - w) push(k + w);
        }
        var touchesBg = function (kk) {
            var tx = kk % w;
            return (tx > 0 && bg[kk - 1] === 1) || (tx < w - 1 && bg[kk + 1] === 1) || (kk >= w && bg[kk - w] === 1) || (kk < n - w && bg[kk + w] === 1);
        };
        for (var round = 0; round < 2; round++) {
            var add = [];
            for (k = 0; k < n; k++) if (!bg[k] && (diff[k] <= BG_TOL || bright[k]) && touchesBg(k)) add.push(k);
            for (i = 0; i < add.length; i++) bg[add[i]] = 1;
        }

        // Công cụ chung cho 2b–2c: bảng cộng dồn (trung bình màu trong ô vuông với O(1)) và khoảng cách vào trong áo.
        var W1 = w + 1;
        var mask = new Uint8Array(n);
        var integral = function () { // cộng dồn màu các điểm có mask[k] = 1
            var ir = new Uint32Array(W1 * (h + 1)), ig = new Uint32Array(W1 * (h + 1)), ib = new Uint32Array(W1 * (h + 1)), ic = new Uint32Array(W1 * (h + 1));
            for (var yy0 = 0; yy0 < h; yy0++) {
                var rr = 0, rg = 0, rb = 0, rc = 0, row0 = yy0 * w, a1 = (yy0 + 1) * W1 + 1, a0 = yy0 * W1 + 1;
                for (var xx0 = 0; xx0 < w; xx0++) {
                    if (mask[row0 + xx0]) { var oo = (row0 + xx0) * 4; rr += p[oo]; rg += p[oo + 1]; rb += p[oo + 2]; rc++; }
                    ir[a1 + xx0] = ir[a0 + xx0] + rr; ig[a1 + xx0] = ig[a0 + xx0] + rg;
                    ib[a1 + xx0] = ib[a0 + xx0] + rb; ic[a1 + xx0] = ic[a0 + xx0] + rc;
                }
            }
            return { r: ir, g: ig, b: ib, c: ic };
        };
        var boxMean = function (I, cx, cy, rad, out) {
            var x0 = Math.max(0, cx - rad), x1 = Math.min(w - 1, cx + rad), y0 = Math.max(0, cy - rad), y1 = Math.min(h - 1, cy + rad);
            var A = y0 * W1 + x0, B = y0 * W1 + x1 + 1, C2 = (y1 + 1) * W1 + x0, D = (y1 + 1) * W1 + x1 + 1;
            var c = I.c[D] - I.c[B] - I.c[C2] + I.c[A];
            if (!c) return 0;
            out[0] = (I.r[D] - I.r[B] - I.r[C2] + I.r[A]) / c;
            out[1] = (I.g[D] - I.g[B] - I.g[C2] + I.g[A]) / c;
            out[2] = (I.b[D] - I.b[B] - I.b[C2] + I.b[A]) / c;
            return c;
        };
        // khoảng cách (px) từ nền vào trong áo, tối đa 14 (0 = nền hoặc sâu hơn 14 px)
        var din = new Uint8Array(n);
        var distIn = function () {
            din.fill(0);
            var ringQ = [];
            for (k = 0; k < n; k++) if (!bg[k] && touchesBg(k)) { din[k] = 1; ringQ.push(k); }
            for (var dd = 2; dd <= 14 && ringQ.length; dd++) {
                var nq = [];
                for (i = 0; i < ringQ.length; i++) {
                    k = ringQ[i];
                    var zx = k % w;
                    if (zx > 0 && !bg[k - 1] && !din[k - 1]) { din[k - 1] = dd; nq.push(k - 1); }
                    if (zx < w - 1 && !bg[k + 1] && !din[k + 1]) { din[k + 1] = dd; nq.push(k + 1); }
                    if (k >= w && !bg[k - w] && !din[k - w]) { din[k - w] = dd; nq.push(k - w); }
                    if (k < n - w && !bg[k + w] && !din[k + w]) { din[k + w] = dd; nq.push(k + w); }
                }
                ringQ = nq;
            }
        };
        // "phần trong áo": cách mép >= 9 px -> dùng để biết áo tối hay sáng (tính cả sọc lẫn nền vải)
        var deepMask = function () { for (var kk = 0; kk < n; kk++) mask[kk] = !bg[kk] && (din[kk] === 0 || din[kk] >= 9) ? 1 : 0; };
        // "vải chắc chắn": nằm sâu trong áo VÀ khác hẳn màu nền -> màu vải tham chiếu khi gọt viền (dải bóng đổ rộng
        // không bị coi là vải)
        var solidMask = function () { for (var kk = 0; kk < n; kk++) mask[kk] = !bg[kk] && (din[kk] === 0 || din[kk] >= 9) && diff[kk] > 40 ? 1 : 0; };
        // áo quanh điểm này có tối hẳn so với nền không (trung bình phần trong áo trong ô 49x49)
        var darkAround = function (I, kk) {
            var mx = kk % w;
            if (boxMean(I, mx, (kk - mx) / w, 24, Fm) < 30) return false;
            return bgL - (Fm[0] + Fm[1] + Fm[2]) / 3 >= 40;
        };
        var bgL = (br + bgc + bb) / 3, Fm = [0, 0, 0], Bm = [0, 0, 0];

        // 2b) Bóng đổ nhạt quanh áo trong ảnh gốc: xám trung tính, mịn, tối dần đều từ nền vào. Chỉ xóa bóng cạnh áo
        //     tối / màu trung bình (vải trong ô 49x49 tối hơn nền >= 40 mức): cạnh áo sáng, phía được chiếu sáng của vải
        //     cũng mịn và tối dần như bóng nên xóa sẽ gặm mép áo thành răng cưa; bóng mờ cạnh áo sáng lại khó thấy.
        distIn();
        deepMask();
        var deepI0 = integral();
        var band = new Uint8Array(n);
        var grow = function (from, m2) {
            if (bg[m2] || diff[m2] > 40 || !G[m2] || rng[m2] > 6) return;
            var dl = L[from] - L[m2];
            if (dl < 0 || dl > 3 || !darkAround(deepI0, m2)) return;
            bg[m2] = 1; band[m2] = band[from] + 1; q[qt++] = m2;
        };
        qh = 0; qt = 0;
        for (k = 0; k < n; k++) if (bg[k]) q[qt++] = k;
        while (qh < qt) {
            k = q[qh++];
            if (band[k] >= 22) continue;
            var bx = k % w;
            if (bx > 0) grow(k, k - 1);
            if (bx < w - 1) grow(k, k + 1);
            if (k >= w) grow(k, k - w);
            if (k < n - w) grow(k, k + w);
        }

        // 2c) Gọt dải viền còn sót quanh áo (viền sáng / bóng đổ lởm chởm cạnh áo tối): điểm mép nào gần màu nền
        //     tại chỗ (kể cả bóng đổ) hơn màu vải bên trong thì bỏ, lặp dần vào trong tới khi gặp vải thật.
        distIn();
        deepMask();
        var deepI = integral();
        solidMask();
        var solidI = integral();
        for (k = 0; k < n; k++) mask[k] = bg[k] === 1 ? 1 : 0;
        var bgI = integral();
        var peelQ = [];
        for (k = 0; k < n; k++) if (din[k] === 1) peelQ.push(k);
        for (qh = 0; qh < peelQ.length; qh++) {
            k = peelQ[qh];
            if (bg[k] || din[k] === 0 || din[k] > 10) continue;
            var pxk = k % w, pyk = (k - pxk) / w;
            if (!darkAround(deepI, k)) continue; // áo sáng (kể cả áo sáng có sọc đậm): không gọt
            if (boxMean(solidI, pxk, pyk, 20, Fm) < 30) continue;
            if (!boxMean(bgI, pxk, pyk, 6, Bm)) { Bm[0] = br; Bm[1] = bgc; Bm[2] = bb; }
            var ur = Fm[0] - Bm[0], ug = Fm[1] - Bm[1], ub = Fm[2] - Bm[2], ul = ur * ur + ug * ug + ub * ub;
            if (ul < 3 * 40 * 40) continue; // vải gần màu nền (áo sáng): không gọt
            var ok = k * 4;
            var al = ((p[ok] - Bm[0]) * ur + (p[ok + 1] - Bm[1]) * ug + (p[ok + 2] - Bm[2]) * ub) / ul;
            if (al >= 0.42) continue;
            bg[k] = 2; // gọt (2 = không dùng làm màu nền tham chiếu)
            var ux = k % w;
            if (ux > 0 && !bg[k - 1]) peelQ.push(k - 1);
            if (ux < w - 1 && !bg[k + 1]) peelQ.push(k + 1);
            if (k >= w && !bg[k - w]) peelQ.push(k - w);
            if (k < n - w && !bg[k + w]) peelQ.push(k + w);
        }

        // 2d) Làm trơn đường viền: lọc đa số 5x5 trên mặt nạ áo/nền, chỉ ở dải sát mép. Lấp các vết khuyết nhỏ
        //     (mép trông như rách) và bỏ gai lẻ; chi tiết lớn hơn 2 px (cổ áo, cổ tay, khe giữa tay và thân) giữ nguyên.
        var fx0 = w, fx1 = -1, fy0 = h, fy1 = -1;
        for (y = 0; y < h; y++) {
            var rowB = y * w;
            for (x = 0; x < w; x++) if (!bg[rowB + x]) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y; }
        }
        fx0 = Math.max(2, fx0 - 3); fx1 = Math.min(w - 3, fx1 + 3); fy0 = Math.max(2, fy0 - 3); fy1 = Math.min(h - 3, fy1 + 3);
        var fgI = new Uint32Array(W1 * (h + 1));
        for (var pass = 0; pass < 2 && fx1 > fx0; pass++) {
            for (y = Math.max(0, fy0 - 3); y <= Math.min(h - 1, fy1 + 3); y++) {
                var accF = 0, rowF = y * w, baseF = (y + 1) * W1, prevF = y * W1;
                for (x = 0; x < w; x++) {
                    if (!bg[rowF + x]) accF++;
                    fgI[baseF + x + 1] = fgI[prevF + x + 1] + accF;
                }
            }
            var flips2 = [];
            for (y = fy0; y <= fy1; y++) {
                for (x = fx0; x <= fx1; x++) {
                    var cntF = fgI[(y + 3) * W1 + x + 3] - fgI[(y - 2) * W1 + x + 3] - fgI[(y + 3) * W1 + x - 2] + fgI[(y - 2) * W1 + x - 2];
                    if (cntF === 0 || cntF === 25) continue;
                    var kf = y * w + x, isFg = !bg[kf];
                    if (isFg && cntF <= 12) flips2.push(kf);
                    else if (!isFg && cntF >= 13) flips2.push(kf);
                }
            }
            for (i = 0; i < flips2.length; i++) { k = flips2[i]; bg[k] = bg[k] ? 0 : 2; }
        }

        // 3) Mép áo: tách màu vải khỏi màu nền (điểm mép = a·màu vải + (1-a)·màu nền, màu vải lấy từ phía trong,
        //    màu nền lấy tại chỗ nên tính cả bóng đổ), nhờ vậy không còn viền sáng quanh áo tối và mép áo sáng vẫn mềm.
        var dist = new Uint8Array(n), ring = [];
        for (k = 0; k < n; k++) {
            if (bg[k]) continue;
            var ex = k % w;
            if ((ex > 0 && bg[k - 1]) || (ex < w - 1 && bg[k + 1]) || (k >= w && bg[k - w]) || (k < n - w && bg[k + w])) { dist[k] = 1; ring.push(k); }
        }
        for (var d = 2; d <= 3; d++) {
            var nextRing = [];
            for (i = 0; i < ring.length; i++) {
                k = ring[i];
                var rx = k % w;
                if (rx > 0 && !bg[k - 1] && !dist[k - 1]) { dist[k - 1] = d; nextRing.push(k - 1); }
                if (rx < w - 1 && !bg[k + 1] && !dist[k + 1]) { dist[k + 1] = d; nextRing.push(k + 1); }
                if (k >= w && !bg[k - w] && !dist[k - w]) { dist[k - w] = d; nextRing.push(k - w); }
                if (k < n - w && !bg[k + w] && !dist[k + w]) { dist[k + w] = d; nextRing.push(k + w); }
            }
            ring = nextRing;
        }
        for (k = 0; k < n; k++) {
            var o2 = k * 4;
            if (bg[k]) { p[o2 + 3] = 0; continue; }
            var dk = dist[k];
            if (dk !== 1 && dk !== 2) continue;
            // màu vải tham chiếu: trung bình các điểm "bên trong" (cách nền >= 3 px) trong ô 7x7
            var px0 = k % w, py0 = (k - px0) / w, sr = 0, sg = 0, sb = 0, sc = 0;
            for (var yy = Math.max(0, py0 - 3); yy <= Math.min(h - 1, py0 + 3); yy++) {
                for (var xx = Math.max(0, px0 - 3); xx <= Math.min(w - 1, px0 + 3); xx++) {
                    var q2 = yy * w + xx;
                    if (!bg[q2] && (dist[q2] === 0 || dist[q2] >= 3)) { var oq = q2 * 4; sr += p[oq]; sg += p[oq + 1]; sb += p[oq + 2]; sc++; }
                }
            }
            var a;
            if (sc) {
                var fr = sr / sc, fg = sg / sc, fb = sb / sc;
                if (!boxMean(bgI, px0, py0, 4, Bm)) { Bm[0] = br; Bm[1] = bgc; Bm[2] = bb; }
                var vr = fr - Bm[0], vg = fg - Bm[1], vb = fb - Bm[2], len2 = vr * vr + vg * vg + vb * vb;
                if (len2 >= 400) {
                    a = ((p[o2] - Bm[0]) * vr + (p[o2 + 1] - Bm[1]) * vg + (p[o2 + 2] - Bm[2]) * vb) / len2;
                    a = clamp(a, dk === 1 ? 0 : 0.55, 1);
                    p[o2] = byte(fr); p[o2 + 1] = byte(fg); p[o2 + 2] = byte(fb);
                    p[o2 + 3] = Math.round(a * 255);
                    continue;
                }
            }
            // vải gần màu nền: chỉ làm mềm mép ngoài cùng
            if (dk === 1) {
                a = Math.max(0.35, Math.min(1, diff[k] / FEATHER));
                p[o2 + 3] = Math.round(a * 255);
            }
        }
        var comp = new Int32Array(n), sizes = [0], stack = new Int32Array(n);
        for (k = 0; k < n; k++) {
            if (comp[k] || p[k * 4 + 3] <= 40) continue;
            var id = sizes.length, top2 = 0, size = 0;
            comp[k] = id; stack[top2++] = k;
            while (top2) {
                var u = stack[--top2], ux = u % w; size++;
                if (ux > 0 && !comp[u - 1] && p[(u - 1) * 4 + 3] > 40) { comp[u - 1] = id; stack[top2++] = u - 1; }
                if (ux < w - 1 && !comp[u + 1] && p[(u + 1) * 4 + 3] > 40) { comp[u + 1] = id; stack[top2++] = u + 1; }
                if (u >= w && !comp[u - w] && p[(u - w) * 4 + 3] > 40) { comp[u - w] = id; stack[top2++] = u - w; }
                if (u < n - w && !comp[u + w] && p[(u + w) * 4 + 3] > 40) { comp[u + w] = id; stack[top2++] = u + w; }
            }
            sizes.push(size);
        }
        var biggest = 0;
        for (i = 1; i < sizes.length; i++) if (sizes[i] > biggest) biggest = sizes[i];
        for (k = 0; k < n; k++) {
            if (comp[k] && sizes[comp[k]] < biggest * 0.15) p[k * 4 + 3] = 0;
            else if (!comp[k] && p[k * 4 + 3] > 0 && p[k * 4 + 3] <= 40) {
                // điểm mép rất mờ: giữ nếu sát mảng lớn, bỏ nếu đứng lẻ
                var kx3 = k % w, keep = false;
                var nb3 = [kx3 > 0 ? k - 1 : -1, kx3 < w - 1 ? k + 1 : -1, k >= w ? k - w : -1, k < n - w ? k + w : -1];
                for (var t3 = 0; t3 < 4; t3++) { var v3 = nb3[t3]; if (v3 >= 0 && comp[v3] && sizes[comp[v3]] >= biggest * 0.15) keep = true; }
                if (!keep) p[k * 4 + 3] = 0;
            }
        }
        var minX = w, minY = h, maxX = -1, maxY = -1;
        for (k = 0; k < n; k++) {
            if (p[k * 4 + 3] > 80) {
                var cx = k % w, cy = (k - cx) / w;
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;
            }
        }
        if (maxX < 0) return { photo: true, plain: true };
        var bw = maxX - minX + 1, bh = maxY - minY + 1;
        if (bw * bh < n * 0.03) return { photo: true, plain: true }; // gần như không còn gì: coi là ảnh thường
        // Vải gần trùng màu nền bị loang mất thành nhiều sọc -> số lần đổi vải/nền trên mỗi hàng tăng vọt.
        var flips = 0, rows = 0;
        for (y = minY; y <= maxY; y += 3) {
            var prev = 0, f2 = 0;
            for (x = minX; x <= maxX; x++) {
                var on = p[(y * w + x) * 4 + 3] > 80 ? 1 : 0;
                if (on !== prev) { f2++; prev = on; }
            }
            flips += f2; rows++;
        }
        if (rows && flips / rows > 7) return { photo: true, broken: true, plain: true };

        // 3b) Số đo hình dáng để nhận ra ảnh tách hỏng (áo trắng trên nền trắng bị ăn mất một nửa) hay ảnh người mẫu
        //     đứng trên nền trắng: độ phủ trong khung, tỉ lệ ngang/dọc, độ đối xứng trái-phải, bề rộng phần trên cùng.
        var on2 = 0, inter = 0, uni = 0, maxExt = 0, topExt = 0, topRows = Math.max(2, Math.round(bh * 0.08));
        var dHist = new Uint32Array(256); // độ lệch màu so với nền của phần áo (áo trắng trên nền trắng: rất nhỏ)
        for (y = minY; y <= maxY; y++) {
            var row = y * w, a0 = -1, a1 = -1;
            for (x = minX; x <= maxX; x++) {
                var o3 = p[(row + x) * 4 + 3] > 80, m3 = p[(row + (minX + maxX - x)) * 4 + 3] > 80;
                if (o3) {
                    on2++; if (a0 < 0) a0 = x; a1 = x; dHist[diff[row + x]]++;
                }
                if (o3 && m3) inter++;
                if (o3 || m3) uni++;
            }
            var ext = a0 < 0 ? 0 : a1 - a0 + 1;
            if (ext > maxExt) maxExt = ext;
            if (y - minY < topRows && ext > topExt) topExt = ext;
        }
        var half = on2 / 2, cum = 0, dMed = 0;
        for (dMed = 0; dMed < 255; dMed++) { cum += dHist[dMed]; if (cum >= half) break; }
        var quality = { fill: on2 / (bw * bh), aspect: bw / bh, sym: uni ? inter / uni : 0, head: maxExt ? topExt / maxExt : 1, contrast: dMed };

        // 4) Điểm treo: tâm phần trên cùng (cổ áo / cạp quần / cổ giày) và bề rộng phần đó.
        var band = Math.max(2, Math.round(bh * 0.035)), sumX = 0, cnt = 0, topL = maxX, topR = minX;
        var wide = Math.max(2, Math.round(bh * 0.06));
        for (y = minY; y < minY + wide && y <= maxY; y++) {
            for (x = minX; x <= maxX; x++) {
                if (p[(y * w + x) * 4 + 3] > 120) {
                    if (y < minY + band) { sumX += x; cnt++; }
                    if (x < topL) topL = x;
                    if (x > topR) topR = x;
                }
            }
        }
        // Mép trên tại cột giữa (giày treo dây ở chính giữa, dây chạm đúng mặt trên của giày).
        var ctop = bh, c0 = minX + Math.round(bw * 0.46), c1 = minX + Math.round(bw * 0.54);
        for (x = c0; x <= c1; x++) {
            for (y = minY; y < minY + ctop && y <= maxY; y++) {
                if (p[(y * w + x) * 4 + 3] > 120) { ctop = y - minY; break; }
            }
        }
        g.putImageData(data, 0, 0);
        var out = el('canvas'); out.width = bw; out.height = bh;
        out.getContext('2d').drawImage(cv, minX, minY, bw, bh, 0, 0, bw, bh);
        return {
            canvas: out, w: bw, h: bh,
            neck: cnt ? (sumX / cnt - minX) / bw : 0.5,
            ctop: ctop < bh ? ctop / bh : 0,
            topL: (topL - minX) / bw, topR: (topR - minX) / bw,
            q: quality
        };
    }

    /**
     * Ảnh tách nền có dùng được để treo không. Quần áo chụp chính diện thì gần đối xứng trái-phải; ảnh bị ăn mất
     * một mảng lệch hẳn, ảnh người mẫu nền trắng thì cao gầy và có đầu nhỏ ở trên cùng; áo trắng trên nền trắng
     * thì màu vải gần như trùng màu nền.
     * Giày chụp nghiêng nên không xét đối xứng.
     */
    function usable(res, kind) {
        if (!res || !res.canvas) return false;
        var q = res.q;
        if (!q) return true;
        if (q.fill < 0.3) return false;
        // áo gần như trùng màu nền (áo trắng chụp trên nền trắng): không tách được mép tin cậy -> không treo
        if (q.contrast !== undefined && q.contrast < 10) return false;
        if (kind === 'string') return true;
        return q.aspect >= 0.4 && q.sym >= 0.92 && !(q.aspect < 0.62 && q.head < 0.36);
    }
    var MAX_TRY = 4; // số ảnh tối đa thử cho mỗi sản phẩm
    var MIN_ITEMS = 6; // sào ít nhất còn chừng này món thì mới gỡ món không có ảnh treo được (thay vì treo tấm ảnh)

    /**
     * Chọn ảnh để treo: thử lần lượt các ảnh của sản phẩm (ảnh đầu thường là ảnh người mẫu), lấy ảnh đầu tiên
     * tách nền sạch. Không có ảnh nào -> ok: false kèm ảnh dự phòng (ưu tiên ảnh chụp sản phẩm trên nền trơn).
     * skip: chỉ số ảnh bỏ qua (mặt sau trong khung chi tiết khác mặt trước).
     */
    function pickVisual(it, width, maxH, skip) {
        var urls = imagesOf(it.product).slice(0, MAX_TRY);
        var i = 0, first = null, plain = null, loaded = 0;
        return new Promise(function (resolve) {
            var step = function () {
                if (i >= urls.length) {
                    var fb = plain || first;
                    resolve({ ok: false, res: fb, idx: fb ? fb.idx : -1, loaded: loaded });
                    return;
                }
                var idx = i++;
                if (idx === skip) { step(); return; }
                getCutout(urls[idx], width, maxH).then(function (res) {
                    if (!res.failed) loaded++;
                    if (usable(res, it.kind)) { resolve({ ok: true, res: res, idx: idx, loaded: loaded }); return; }
                    if (!res.failed && res.img) {
                        var ph = { photo: true, img: res.img, idx: idx };
                        if (!first) first = ph;
                        if (!plain && (res.plain || res.canvas)) plain = ph;
                    }
                    step();
                });
            };
            step();
        });
    }

    var cutCache = new Map();
    /** Ảnh đã tách nền (có bộ nhớ đệm). Lỗi tải ảnh -> { failed: true }. */
    function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
    /**
     * Tải ảnh có thử lại: lỗi mạng thoáng qua (CDN của shop gốc chặn tạm khi tải nhiều ảnh, mạng chập chờn) thì
     * đợi một chút rồi tải lại, sau đó thử chính link ảnh gốc (khác kích thước) trước khi coi là hỏng.
     */
    function loadImageRetry(src, original) {
        return loadImage(src)
            .catch(function () { return wait(1200).then(function () { return loadImage(src); }); })
            .catch(function () { return original && original !== src ? loadImage(original) : Promise.reject(new Error('image')); });
    }
    function getCutout(url, width, maxH) {
        var src = sized(url, width);
        var key = src + '|' + maxH;
        if (!cutCache.has(key)) {
            cutCache.set(key, loadImageRetry(src, url).then(function (img) {
                var r = cutoutImage(img, maxH);
                r.img = img;
                return r;
            }, function () {
                cutCache.delete(key); // không nhớ lỗi: lần sau (thử lại muộn) tải lại từ đầu
                return { failed: true };
            }));
        }
        return cutCache.get(key);
    }
    function cloneCanvas(c) {
        var n = el('canvas'); n.width = c.width; n.height = c.height;
        n.getContext('2d').drawImage(c, 0, 0);
        return n;
    }

    /* ---------------- SVG phụ kiện treo ---------------- */
    var SVGNS = 'http://www.w3.org/2000/svg';
    function svg(cls, w, h, paths) {
        var s = doc.createElementNS(SVGNS, 'svg');
        s.setAttribute('class', cls);
        s.setAttribute('width', w); s.setAttribute('height', h);
        s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        s.setAttribute('aria-hidden', 'true');
        s.setAttribute('focusable', 'false');
        paths.forEach(function (d) {
            var path = doc.createElementNS(SVGNS, 'path');
            path.setAttribute('d', d[0]);
            if (d[1]) path.setAttribute('class', d[1]);
            s.appendChild(path);
        });
        return s;
    }
    /** Móc treo vắt qua thanh sào (tâm thanh sào ở y = 9) rồi đi xuống điểm treo (y = len). */
    function hookSvg(len) {
        return svg('rk-hook', 30, len, [['M15 ' + len + ' L15 21 C15 16 9 15 9 9.5 C9 4.5 12.2 2 15.2 2 C19 2 21.6 4.6 21.6 8.4', 'rk-wire']]);
    }

    /* ---------------- con lắc: đung đưa ---------------- */
    var K = 15.5, C = 1.25, MAXA = 16;
    var swingers = [];
    var rafId = 0, lastTs = 0;
    function impulse(it, v) { if (reduceMotion.matches || !it) return; it.vel += v; wake(); }
    function wake() { if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(tick); } }
    function tick(ts) {
        var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
        lastTs = ts;
        var moving = false;
        swingers.forEach(function (it) {
            if (!it.alive) return;
            it.vel += (-K * it.ang - C * it.vel) * dt;
            it.ang = clamp(it.ang + it.vel * dt, -MAXA, MAXA);
            if (Math.abs(it.ang) > 0.02 || Math.abs(it.vel) > 0.05) moving = true;
            else { it.ang = 0; it.vel = 0; }
            it.node.style.setProperty('--sw', it.ang.toFixed(2) + 'deg');
        });
        rafId = moving ? requestAnimationFrame(tick) : 0;
    }

    /* ---------------- sào treo ---------------- */
    var rack = null;      // trạng thái của sào duy nhất trên trang
    var pending = null;   // lần vẽ lại bị hoãn khi khung chi tiết đang mở

    function build(host) {
        host.classList.add('rk-host');
        host.setAttribute('data-stylehub-plain-links', '');
        host.replaceChildren();
        var root = el('div', 'rk');
        var scroller = el('div', 'rk-scroller');
        scroller.setAttribute('role', 'list');
        scroller.setAttribute('aria-label', 'Sào treo các sản phẩm được chọn cho bạn');
        var track = el('div', 'rk-track');
        var rod = el('div', 'rk-rod');
        rod.setAttribute('aria-hidden', 'true');
        rod.append(el('span', 'rk-bracket rk-bracket-l'), el('span', 'rk-bracket rk-bracket-r'));
        track.appendChild(rod);
        scroller.appendChild(track);

        var foot = el('div', 'rk-foot');
        var peek = el('div', 'rk-peek');
        peek.setAttribute('aria-live', 'polite');
        var hint = el('p', 'rk-hint', finePointer.matches ? 'Rê chuột lên món đồ để xem · bấm để thử' : 'Chạm vào món đồ để xem chi tiết');
        var info = el('div', 'rk-peek-info');
        var kicker = el('span', 'rk-peek-kicker');
        var name = el('strong', 'rk-peek-name');
        var meta = el('span', 'rk-peek-meta');
        info.append(kicker, name, meta);
        peek.append(hint, info);
        var nav = el('div', 'rk-nav');
        var prog = el('div', 'rk-prog'); prog.appendChild(el('i'));
        prog.setAttribute('aria-hidden', 'true');
        var prev = el('button', 'rk-arrow', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Xem các món phía trước');
        var next = el('button', 'rk-arrow', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Xem các món tiếp theo');
        nav.append(prev, prog, next);
        foot.append(peek, nav);
        root.append(scroller, foot);
        host.appendChild(root);

        var r = {
            host: host, root: root, scroller: scroller, track: track, peek: peek, hint: hint,
            kicker: kicker, name: name, meta: meta, prog: prog.firstChild, prev: prev, next: next,
            items: [], signature: '', live: null, visible: false, dropped: false, breezeTimer: 0
        };
        prev.addEventListener('click', function () { scrollByItems(r, -1); });
        next.addEventListener('click', function () { scrollByItems(r, 1); });
        bindRack(r);
        return r;
    }

    function scrollByItems(r, dir) {
        r.scroller.scrollBy({ left: dir * Math.max(200, r.scroller.clientWidth * 0.6), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    function bindRack(r) {
        // Cuộn ngang: kéo bằng chuột, đồ đung đưa theo tốc độ cuộn, cập nhật thanh tiến độ.
        var lastLeft = 0, lastT = 0;
        r.scroller.addEventListener('scroll', function () {
            var now = performance.now();
            var dx = r.scroller.scrollLeft - lastLeft, dt = Math.max(16, now - lastT);
            lastLeft = r.scroller.scrollLeft; lastT = now;
            var v = clamp(-dx / dt * 260, -40, 40);
            if (Math.abs(v) > 2) r.items.forEach(function (it, i) { impulse(it, v * (0.8 + (i % 3) * 0.12)); });
            updateProgress(r);
        }, { passive: true });

        var drag = null;
        r.scroller.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            drag = { x: e.clientX, left: r.scroller.scrollLeft, moved: false };
        });
        window.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var dx = e.clientX - drag.x;
            if (Math.abs(dx) > 5) { drag.moved = true; r.root.classList.add('is-dragging'); }
            if (drag.moved) r.scroller.scrollLeft = drag.left - dx;
        });
        var endDrag = function () {
            if (!drag) return;
            var moved = drag.moved;
            drag = null;
            r.root.classList.remove('is-dragging');
            if (moved) { r.suppressClick = true; setTimeout(function () { r.suppressClick = false; }, 0); }
        };
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
        r.scroller.addEventListener('dragstart', function (e) { e.preventDefault(); });
        r.scroller.addEventListener('mouseleave', function () { setLive(r, null); });

        // Chỉ chạy hiệu ứng khi khu sào đang hiển thị.
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    r.visible = en.isIntersecting;
                    if (r.visible) { dropIn(r); startBreeze(r); } else stopBreeze(r);
                });
            }, { threshold: 0.18 }).observe(r.root);
        } else { r.visible = true; dropIn(r); }

        var resizeT = 0;
        window.addEventListener('resize', function () {
            clearTimeout(resizeT);
            resizeT = setTimeout(function () { r.items.forEach(function (it) { layoutItem(r, it); }); fitRail(r); updateProgress(r); }, 150);
        });
        document.addEventListener('visibilitychange', function () { if (document.hidden) stopBreeze(r); else if (r.visible) startBreeze(r); });
    }

    function updateProgress(r) {
        var max = r.scroller.scrollWidth - r.scroller.clientWidth;
        var overflow = max > 4;
        r.root.classList.toggle('has-overflow', overflow);
        var frac = overflow ? r.scroller.scrollLeft / max : 0;
        var vis = overflow ? r.scroller.clientWidth / r.scroller.scrollWidth : 1;
        r.prog.style.width = (vis * 100).toFixed(1) + '%';
        r.prog.style.transform = 'translateX(' + (frac * (1 / vis - 1) * 100).toFixed(1) + '%)';
        r.prev.disabled = !overflow || r.scroller.scrollLeft < 4;
        r.next.disabled = !overflow || r.scroller.scrollLeft > max - 4;
    }

    function dropIn(r) {
        if (r.dropped || !r.items.length) return;
        r.dropped = true;
        if (reduceMotion.matches) { r.items.forEach(function (it) { it.node.classList.remove('is-pre'); }); return; }
        r.items.forEach(function (it, i) {
            setTimeout(function () {
                it.node.classList.remove('is-pre');
                setTimeout(function () { impulse(it, (i % 2 ? -1 : 1) * 34); }, 420);
            }, 90 * i);
        });
    }
    function startBreeze(r) {
        if (r.breezeTimer || reduceMotion.matches) return;
        r.breezeTimer = setInterval(function () {
            if (!r.items.length) return;
            var i = Math.floor(Math.random() * r.items.length), dir = Math.random() < 0.5 ? -1 : 1;
            impulse(r.items[i], dir * (9 + Math.random() * 7));
            if (r.items[i + 1]) setTimeout(function () { impulse(r.items[i + 1], dir * 6); }, 180);
        }, 2600);
    }
    function stopBreeze(r) { if (r.breezeTimer) { clearInterval(r.breezeTimer); r.breezeTimer = 0; } }

    /** Món này có phải gợi ý cá nhân hóa không (hay chỉ là danh sách khám phá khi chưa có dữ liệu). */
    function isPersonal(it) {
        if (!it.rec) return false;
        if (it.rec.explanation && it.rec.explanation.type) return it.rec.explanation.type !== 'explore';
        return !!it.rec.reason && it.rec.reason !== 'Khám phá bộ sưu tập';
    }
    var EXPLORE_WHY = 'Bạn chưa có lịch sử mua sắm nên đây là những mẫu nổi bật để khám phá. Gợi ý sẽ được cá nhân hóa khi bạn xem, lưu, mua sản phẩm hoặc làm quiz phong cách.';

    function setLive(r, it) {
        if (r.live === it) return;
        if (r.live) r.live.node.classList.remove('is-live');
        r.live = it;
        if (it) {
            it.node.classList.add('is-live');
            impulse(it, (Math.random() < 0.5 ? -1 : 1) * 11);
            showPeek(r, it);
        } else {
            r.peek.classList.remove('is-on');
        }
    }
    function showPeek(r, it) {
        r.kicker.textContent = (it.product.brand || 'THE STYLE HUB') + ' · ' + (isPersonal(it) ? 'Gợi ý #' + String(it.rank + 1).padStart(2, '0') : 'Khám phá thêm');
        r.name.textContent = it.product.name || '';
        r.meta.textContent = [formatVND(priceNum(it.product)), it.reason].filter(Boolean).join(' — ');
        r.peek.classList.add('is-on');
    }

    /* ---------- từng món đồ ---------- */
    function makeItem(r, entry, index) {
        var p = entry.product, id = entry.id, a = attrsOf(id, p);
        var node = el('div', 'rk-item is-pre is-loading');
        node.setAttribute('role', 'listitem');
        var btn = el('div', 'rk-hit');
        btn.setAttribute('role', 'button');
        btn.tabIndex = 0;
        btn.setAttribute('data-rec-id', id);
        btn.setAttribute('data-rec-rank', String(index));
        btn.setAttribute('data-rec-context', 'home:' + ((entry.rec && entry.rec.source) || (entry.rec ? 'local' : 'fallback')));

        var drop = el('div', 'rk-drop');
        var swing = el('div', 'rk-swing');
        var hang = el('div', 'rk-hang');
        var turn = el('div', 'rk-turn');
        var tag = el('div', 'rk-tag');
        var tagIn = el('span', 'rk-tag-in');
        tagIn.append(el('b', 'rk-tag-front', shortPrice(priceNum(p))), el('b', 'rk-tag-back', '#' + String(index + 1).padStart(2, '0')));
        tag.appendChild(tagIn);
        hang.appendChild(turn);
        swing.append(hang, tag);
        drop.appendChild(swing);
        node.append(drop, btn);

        var it = {
            id: id, product: p, attrs: a, rec: entry.rec || null, rank: index, kind: hangKind(a),
            reason: entry.rec && entry.rec.reason ? entry.rec.reason : '',
            node: node, hit: btn, swing: swing, hang: hang, turn: turn, tag: tag,
            ang: 0, vel: 0, alive: true, cut: null
        };
        updateLabels(it);
        node.style.setProperty('--sw', '0deg');
        node.classList.add('rk-kind-' + it.kind);

        btn.addEventListener('mouseenter', function () { if (finePointer.matches) setLive(r, it); });
        btn.addEventListener('focus', function () { setLive(r, it); });
        btn.addEventListener('click', function (e) {
            if (r.suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            openFocus(r, it);
        });
        btn.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFocus(r, it); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                var nx = r.items[it.rank + (e.key === 'ArrowRight' ? 1 : -1)];
                if (nx) { nx.hit.focus(); nx.node.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); }
            }
        });
        swingers.push(it);
        return it;
    }

    function updateLabels(it) {
        var p = it.product;
        it.reason = it.rec && it.rec.reason ? it.rec.reason : '';
        it.hit.setAttribute('aria-label', [p.name, formatVND(priceNum(p)), it.reason].filter(Boolean).join(' — ') + '. Bấm để xem chi tiết.');
        var front = it.tag.querySelector('.rk-tag-front');
        if (front) front.textContent = shortPrice(priceNum(p));
    }

    /**
     * Điểm buộc dây của giày (tỉ lệ 0..1 trên ảnh đã tách nền): giữa mặt trên của giày.
     * Bốt cổ cao (giữa giày thấp hơn hẳn chỗ cao nhất) thì buộc ở miệng cổ bốt, để bốt không nhô lên trên thanh sào.
     */
    function stringAnchor(cut) {
        return cut.ctop > 0.2 ? { x: cut.neck, top: 0 } : { x: 0.5, top: cut.ctop };
    }
    /** Bề rộng (px, làm tròn xuống để tổng không tràn sào) của một món khi treo nghiêng. */
    function sidePx(r, it) { return Math.floor((it.sideW || 0) * (r.fit || 1)) + 'px'; }

    /** Chiều cao vùng treo đồ (px) đọc từ CSS (--rk-gh). */
    function garmentZone(r) {
        var v = parseFloat(getComputedStyle(r.root).getPropertyValue('--rk-gh'));
        return Number.isFinite(v) && v > 0 ? v : 300;
    }
    /** Tỉ lệ bề rộng hiển thị khi treo: cos(góc nghiêng --rk-turn) × độ thu hẹp (--rk-squash). */
    function turnFactor(r) {
        var cs = getComputedStyle(r.root);
        var deg = parseFloat(cs.getPropertyValue('--rk-turn')), sq = parseFloat(cs.getPropertyValue('--rk-squash'));
        if (!Number.isFinite(deg)) deg = 26;
        if (!Number.isFinite(sq)) sq = 0.74;
        return Math.cos(deg * Math.PI / 180) * sq;
    }
    /** Bản đổ bóng khối cho lúc treo nghiêng: mép gần sáng nhẹ, mép xa tối dần -> áo có độ phồng. */
    function shadedCanvas(src) {
        var c = cloneCanvas(src), g = c.getContext('2d');
        g.globalCompositeOperation = 'source-atop';
        var gr = g.createLinearGradient(0, 0, c.width, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0.12)');
        gr.addColorStop(0.2, 'rgba(255,255,255,0)');
        gr.addColorStop(0.55, 'rgba(0,0,0,0.03)');
        gr.addColorStop(1, 'rgba(0,0,0,0.32)');
        g.fillStyle = gr;
        g.fillRect(0, 0, c.width, c.height);
        var gv = g.createLinearGradient(0, 0, 0, c.height);
        gv.addColorStop(0, 'rgba(0,0,0,0)');
        gv.addColorStop(0.75, 'rgba(0,0,0,0)');
        gv.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = gv;
        g.fillRect(0, 0, c.width, c.height);
        return c;
    }

    function layoutItem(r, it) {
        var GH = garmentZone(r), cut = it.cut;
        var hookLen = Math.round(GH * (it.kind === 'string' ? 0.08 : 0.13));
        var dw, dh, neck = 0.5;
        if (cut && cut.canvas) {
            var ratio = cut.w / cut.h, t = it.attrs.type;
            if (it.kind === 'string') {
                dw = GH * 0.74; dh = dw / ratio;
                if (dh > GH * 0.5) { dh = GH * 0.5; dw = dh * ratio; }
            } else {
                var f = it.kind === 'clip' ? (t === 'shorts' ? 0.56 : 1) : (it.attrs.category === 'outerwear' ? 0.95 : (t === 'hoodie' || t === 'knit' || t === 'sweatshirt' ? 0.9 : 0.85));
                dh = GH * f; dw = dh * ratio;
                var maxW = GH * (it.kind === 'clip' ? 0.66 : 1.02);
                if (dw > maxW) { dw = maxW; dh = dw / ratio; }
            }
            var an = it.kind === 'string' ? stringAnchor(cut) : null;
            neck = an ? an.x : cut.neck;
            it.node.style.setProperty('--ctop', an ? (an.top * dh).toFixed(1) + 'px' : '0px');
        } else {
            // ảnh kẹp (ảnh người mẫu) hoặc thẻ tên khi ảnh lỗi
            dh = GH * 0.72; dw = dh * 0.75;
        }
        var cordLen = it.kind === 'string' ? Math.round(GH * 0.1) : 0;
        var node = it.node;
        node.style.setProperty('--hook', hookLen + 'px');
        node.style.setProperty('--cord', cordLen + 'px');
        node.style.setProperty('--gw', dw.toFixed(1) + 'px');
        node.style.setProperty('--gh', dh.toFixed(1) + 'px');
        node.style.setProperty('--neck-x', (neck * dw).toFixed(1) + 'px');
        it.frontW = Math.round(dw + 24);
        node.style.setProperty('--w-front', it.frontW + 'px');
        // Bề rộng khi treo nghiêng: bề rộng hiển thị (thu hẹp + nghiêng nhẹ) nhưng gối lên nhau ~20%,
        // để sào trông dày đồ như sào thật mà áo vẫn đầy đặn. fitRail() co thêm nếu sào không đủ chỗ.
        var side = dw * turnFactor(r) * (it.kind === 'string' ? 0.9 : 0.8);
        it.sideW = Math.max(GH * 0.24, side);
        node.style.setProperty('--w-side', sidePx(r, it));
        if (cut && cut.canvas && it.kind === 'clip') {
            node.style.setProperty('--clip-l', (cut.topL * 100).toFixed(2) + '%');
            node.style.setProperty('--clip-r', (cut.topR * 100).toFixed(2) + '%');
        }
        if (!it.hookEl || it.hookEl.getAttribute('height') !== String(hookLen + 9)) {
            var hk = hookSvg(hookLen + 9);
            if (it.hookEl) it.hookEl.replaceWith(hk); else it.swing.insertBefore(hk, it.hang);
            it.hookEl = hk;
        }
    }

    /**
     * Co khoảng treo (cho đồ gối lên nhau nhiều hơn) để cả 10 món nằm gọn trong bề ngang màn hình,
     * kể cả lúc một món đang được rê chuột mở rộng ra mặt trước (đồ hai bên chỉ dạt ra, không bị khuất).
     * Chỉ co tới FIT_MIN; màn hình hẹp hơn nữa (điện thoại) thì vẫn kéo ngang như cũ.
     */
    var FIT_MIN = 0.74;
    function fitRail(r) {
        if (!r.items.length) return;
        var cs = getComputedStyle(r.track);
        var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        var gaps = (parseFloat(cs.columnGap) || 0) * (r.items.length - 1);
        var sum = 0;
        r.items.forEach(function (it) { sum += it.sideW || 0; });
        var room = r.scroller.clientWidth - pad - gaps;
        var k = sum > 0 && room > 0 ? room / sum : 1;
        if (finePointer.matches && room > 0) r.items.forEach(function (it) {
            var rest = sum - (it.sideW || 0);
            if (rest > 0) k = Math.min(k, (room - (it.frontW || 0)) / rest);
        });
        k = clamp(k, FIT_MIN, 1);
        if (Math.abs(k - (r.fit || 1)) < 0.005) return;
        r.fit = k;
        r.items.forEach(function (it) { it.node.style.setProperty('--w-side', sidePx(r, it)); });
    }

    function attachVisual(r, it, res) {
        it.turn.replaceChildren();
        it.node.classList.remove('is-loading');
        it.vis = res || null;
        if (res && res.canvas) {
            it.cut = res;
            var side = shadedCanvas(res.canvas);
            side.className = 'rk-garment rk-g-side';
            side.setAttribute('aria-hidden', 'true');
            var c = cloneCanvas(res.canvas);
            c.className = 'rk-garment rk-g-front';
            c.setAttribute('aria-hidden', 'true');
            if (it.kind === 'clip') it.turn.appendChild(el('span', 'rk-clipbar'));
            it.turn.append(side, c);
            if (it.kind === 'string' && !it.hang.querySelector('.rk-cord')) it.hang.insertBefore(el('span', 'rk-cord'), it.turn);
            it.node.classList.add('is-cut');
        } else {
            it.cut = null;
            var card = el('div', 'rk-photo');
            if (res && res.img) {
                var im = el('img');
                im.src = res.img.src; im.alt = ''; im.decoding = 'async';
                card.appendChild(im);
            } else {
                card.appendChild(el('span', 'rk-photo-name', it.product.name || ''));
            }
            card.appendChild(el('span', 'rk-pin'));
            it.turn.appendChild(card);
            it.node.classList.add('is-photo');
        }
        layoutItem(r, it);
        fitRail(r);
        updateProgress(r);
    }

    function loadItems(r, list, more) {
        var GHpx = Math.round(garmentZone(r) * Math.min(2, window.devicePixelRatio || 1));
        var maxH = clamp(GHpx, 360, 640);
        var queue = list.slice();
        if (!more) r.broken = [];
        var next = function () {
            var it = queue.shift();
            if (!it) return;
            pickVisual(it, RAIL_IMG_W, maxH).then(function (pick) {
                if (!it.alive) { setTimeout(next, 0); return; }
                if (pick.loaded && !r.anyLoaded) {
                    // Ảnh tải được bình thường -> những món trước đó không tải nổi ảnh nào là do link ảnh hỏng
                    // (ví dụ sản phẩm admin có "ảnh" là một trang web): nhường chỗ cho món dự phòng.
                    r.anyLoaded = true;
                    r.broken.splice(0).forEach(function (old) {
                        var sp = old.alive ? replaceWithSpare(r, old) : null;
                        if (sp) { queue.push(sp); setTimeout(next, 0); }
                    });
                }
                // Không ảnh nào của món này treo được (áo trắng chụp trên nền trắng, link ảnh hỏng...): nhường chỗ
                // cho món gợi ý kế tiếp của hệ gợi ý, thứ tự gợi ý giữ nguyên. Hết món dự phòng mới dùng ảnh chụp.
                // Chưa tải được ảnh nào trên cả sào (có thể đang mất mạng): giữ nguyên, chờ xem các món khác.
                var spare = pick.ok || !(pick.loaded || r.anyLoaded) ? null : replaceWithSpare(r, it);
                if (spare) { queue.unshift(spare); setTimeout(next, 0); return; }
                // Hết món dự phòng mà món này chỉ có ảnh không treo được: gỡ khỏi sào thay vì treo tấm ảnh
                // (trừ khi sào sẽ còn quá ít món).
                if (!pick.ok && pick.loaded && r.items.length > MIN_ITEMS) { dropItem(r, it); setTimeout(next, 0); return; }
                if (!pick.ok && !pick.loaded) { r.broken.push(it); lateRetry(r, it, maxH); }
                it.imgIdx = pick.idx;
                it.node.setAttribute('data-img', String(pick.idx + 1)); // ảnh thứ mấy của sản phẩm đang được treo
                try { attachVisual(r, it, pick.res); }
                catch (e) { try { attachVisual(r, it, null); } catch (e2) { /* bỏ qua */ } }
                setTimeout(next, 0);
            });
        };
        // Xử lý lần lượt (tránh giật khung hình), 2 luồng song song cho nhanh.
        next(); next();
    }

    /**
     * Món chưa tải được ảnh nào: vài giây sau thử lại cả món (mạng có thể đã ổn). Vẫn không được mà các món khác trên
     * sào vẫn hiện bình thường (tức link ảnh của món này có vấn đề) thì nhường chỗ cho món dự phòng, hết dự phòng thì
     * gỡ khỏi sào — không để thẻ chỉ có chữ. Mất mạng hoàn toàn (không món nào tải được) thì giữ nguyên.
     */
    function lateRetry(r, it, maxH) {
        if (it.retried) return;
        it.retried = true;
        setTimeout(function () {
            if (!it.alive) return;
            pickVisual(it, RAIL_IMG_W, maxH).then(function (pick) {
                if (!it.alive) return;
                if (pick.ok) {
                    r.broken = (r.broken || []).filter(function (x) { return x !== it; });
                    it.imgIdx = pick.idx;
                    it.node.setAttribute('data-img', String(pick.idx + 1));
                    try { attachVisual(r, it, pick.res); } catch (e) { /* bỏ qua */ }
                    return;
                }
                if (pick.loaded) r.anyLoaded = true;
                if (!r.anyLoaded) return;
                r.broken = (r.broken || []).filter(function (x) { return x !== it; });
                var spare = replaceWithSpare(r, it);
                if (spare) loadItems(r, [spare], true);
                else if (r.items.length > MIN_ITEMS) dropItem(r, it);
                else if (pick.res) { it.imgIdx = pick.idx; try { attachVisual(r, it, pick.res); } catch (e) { /* bỏ qua */ } }
            });
        }, 2500);
    }
    /** Gỡ hẳn một món khỏi sào (không còn món dự phòng để thay). */
    function dropItem(r, it) {
        var at = r.items.indexOf(it);
        if (at < 0 || (F && !F.root.hidden && F.it === it)) return;
        it.alive = false;
        if (r.live === it) setLive(r, null);
        it.node.remove();
        r.items.splice(at, 1);
        reindex(r);
        fitRail(r);
        updateProgress(r);
    }

    /** Gỡ món không treo được, thêm món dự phòng kế tiếp vào cuối sào (giữ đúng thứ tự gợi ý). */
    function replaceWithSpare(r, it) {
        if (!r.spares || !r.spares.length) return null;
        if (F && !F.root.hidden && F.it === it) return null;
        var entry = r.spares.shift();
        var at = r.items.indexOf(it);
        if (at < 0) return null;
        it.alive = false;
        if (r.live === it) setLive(r, null);
        it.node.remove();
        r.items.splice(at, 1);
        var ni = makeItem(r, entry, r.items.length);
        r.items.push(ni);
        r.track.appendChild(ni.node);
        layoutItem(r, ni);
        reindex(r);
        fitRail(r);
        updateProgress(r);
        if (r.dropped) setTimeout(function () { if (ni.alive) ni.node.classList.remove('is-pre'); }, 60);
        return ni;
    }
    /** Đánh lại số thứ tự (thẻ giá mặt sau, data-rec-rank, phím mũi tên) theo vị trí trên sào. */
    function reindex(r) {
        r.items.forEach(function (it, i) {
            it.rank = i;
            it.hit.setAttribute('data-rec-rank', String(i));
            var back = it.tag.querySelector('.rk-tag-back');
            if (back) back.textContent = '#' + String(i + 1).padStart(2, '0');
        });
    }

    /**
     * Vẽ (hoặc cập nhật) sào treo.
     * entries: [{ id, product, rec }] theo đúng thứ tự gợi ý; rec = kết quả của hệ gợi ý (có reason) hoặc null.
     * opts.limit: số món treo (mặc định: tất cả). Các món sau đó là dự phòng, chỉ dùng khi một món không có ảnh treo được.
     */
    function render(host, entries, opts) {
        if (!host) return null;
        // Đang mở khung chi tiết (ví dụ vừa thêm vào BAG làm gợi ý thay đổi): cập nhật sào sau khi đóng khung.
        if (F && !F.root.hidden) { pending = { host: host, entries: entries, opts: opts }; return rack; }
        if (!rack || rack.host !== host || !host.contains(rack.root)) rack = build(host);
        var r = rack;
        var list = (entries || []).filter(function (e) { return e && e.id && e.product; });
        var limit = opts && opts.limit > 0 ? Math.floor(opts.limit) : list.length;
        // Chỉ các món đang treo quyết định có dựng lại sào hay không; danh sách dự phòng đổi thì cập nhật âm thầm.
        var signature = limit + ':' + list.slice(0, limit).map(function (e) { return e.id; }).join('|');
        if (signature === r.signature) {
            // Cùng danh sách: chỉ cập nhật lý do gợi ý / giá, không làm rơi lại đồ.
            var byId = {};
            list.forEach(function (e) { byId[e.id] = e; });
            r.items.forEach(function (it) { var e = byId[it.id]; if (e) { it.rec = e.rec || null; it.product = e.product; updateLabels(it); } });
            var hung = {};
            r.items.forEach(function (it) { hung[it.id] = 1; });
            r.spares = list.slice(limit).filter(function (e) { return !hung[e.id]; });
            if (r.live) showPeek(r, r.live);
            return r;
        }
        r.signature = signature;
        // Đang focus (bàn phím) vào một món trên sào: dựng lại xong thì đưa focus về đúng món đó (hoặc món đầu tiên),
        // không để focus rơi ra ngoài trang.
        var active = doc.activeElement;
        var focusId = active && active.classList && active.classList.contains('rk-hit') && r.root.contains(active) ? active.getAttribute('data-rec-id') : null;
        r.items.forEach(function (it) { it.alive = false; it.node.remove(); });
        swingers = swingers.filter(function (s) { return s.alive; });
        r.live = null;
        r.peek.classList.remove('is-on');
        r.spares = list.slice(limit);
        r.items = list.slice(0, limit).map(function (e, i) { return makeItem(r, e, i); });
        r.items.forEach(function (it) { r.track.appendChild(it.node); layoutItem(r, it); });
        fitRail(r);
        r.scroller.scrollLeft = 0;
        updateProgress(r);
        if (focusId && r.items.length) {
            var refocus = r.items.filter(function (x) { return x.id === focusId; })[0] || r.items[0];
            refocus.hit.focus({ preventScroll: true });
        }
        r.dropped = false;
        if (r.visible) dropIn(r);
        loadItems(r, r.items);
        return r;
    }

    /* ---------------- khung xem chi tiết ---------------- */
    var F = null;
    function buildFocus() {
        var root = el('div', 'rk-focus');
        root.hidden = true;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'rkFocusName');
        root.setAttribute('data-stylehub-plain-links', '');
        var bg = el('div', 'rk-focus-bg');
        var panel = el('div', 'rk-focus-panel');
        var close = el('button', 'rk-focus-close'); close.type = 'button'; close.setAttribute('aria-label', 'Đóng');
        close.innerHTML = '<span aria-hidden="true">×</span>';

        var stage = el('div', 'rk-focus-stage');
        var rod = el('div', 'rk-focus-rod'); rod.setAttribute('aria-hidden', 'true');
        window.addEventListener('resize', function () { placeFocusHook(); });
        var flip = el('div', 'rk-focus-flip');
        var front = el('div', 'rk-face rk-face-front');
        var back = el('div', 'rk-face rk-face-back');
        flip.append(front, back);
        // Bấm vào món đồ cũng sang trang sản phẩm (bàn phím / trình đọc màn hình dùng tên sản phẩm hoặc nút "Xem chi tiết").
        var golink = el('a', 'rk-focus-golink');
        golink.tabIndex = -1;
        golink.setAttribute('aria-hidden', 'true');
        golink.title = 'Xem trang sản phẩm';
        golink.append(flip, el('span', 'rk-focus-gohint', 'Xem trang sản phẩm ↗'));
        var views = el('div', 'rk-focus-views');
        var vf = el('button', 'is-on', 'Mặt trước'); vf.type = 'button'; vf.setAttribute('aria-pressed', 'true');
        var vb = el('button', '', 'Mặt sau'); vb.type = 'button'; vb.setAttribute('aria-pressed', 'false');
        views.append(vf, vb);
        stage.append(rod, golink, views);

        var info = el('div', 'rk-focus-info');
        var kicker = el('p', 'rk-focus-kicker');
        var name = el('h3', 'rk-focus-name'); name.id = 'rkFocusName';
        var nameLink = el('a', 'rk-focus-namelink');
        name.appendChild(nameLink);
        var priceRow = el('p', 'rk-focus-price');
        var why = el('p', 'rk-focus-why');
        var sizeTitle = el('p', 'rk-focus-label', 'Chọn size');
        var sizes = el('div', 'rk-focus-sizes');
        sizes.setAttribute('role', 'group');
        sizes.setAttribute('aria-label', 'Chọn size');
        var actions = el('div', 'rk-focus-actions');
        var add = el('button', 'rk-btn rk-btn-primary', 'Thêm vào BAG'); add.type = 'button';
        var detail = el('a', 'rk-btn rk-btn-ghost', 'Xem chi tiết');
        actions.append(add, detail);
        var msg = el('p', 'rk-focus-msg');
        msg.setAttribute('role', 'status');
        info.append(kicker, name, priceRow, why, sizeTitle, sizes, actions, msg);

        panel.append(close, stage, info);
        root.append(bg, panel);
        doc.body.appendChild(root);

        F = { root: root, bg: bg, panel: panel, close: close, stage: stage, rod: rod, flip: flip, golink: golink, front: front, back: back, views: views, vf: vf, vb: vb, hook: null, frontRes: null,
            kicker: kicker, name: name, nameLink: nameLink, priceRow: priceRow, why: why, sizeTitle: sizeTitle, sizes: sizes, add: add, detail: detail, msg: msg,
            it: null, r: null, size: null, opener: null, token: 0 };

        close.addEventListener('click', closeFocus);
        bg.addEventListener('click', closeFocus);
        vf.addEventListener('click', function () { setFace(false); });
        vb.addEventListener('click', function () { setFace(true); });
        add.addEventListener('click', addToBag);
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); closeFocus(); return; }
            if (e.key !== 'Tab') return;
            var f = [].filter.call(root.querySelectorAll('button, a[href]'), function (n) { return !n.disabled && n.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        return F;
    }

    function setFace(backSide) {
        F.flip.classList.toggle('is-back', backSide);
        F.vf.classList.toggle('is-on', !backSide); F.vf.setAttribute('aria-pressed', String(!backSide));
        F.vb.classList.toggle('is-on', backSide); F.vb.setAttribute('aria-pressed', String(backSide));
    }

    /** Đặt móc (áo) / móc kẹp (quần) / dây (giày) / kẹp gỗ (ảnh) nối thanh sào với món đồ đang xem. */
    function placeFocusHook() {
        if (!F || !F.it || F.root.hidden) return;
        var img = F.front.firstChild, stage = F.stage;
        if (F.hook) { F.hook.remove(); F.hook = null; }
        if (!img || !img.getBoundingClientRect) return;
        var sr = stage.getBoundingClientRect(), cr = contentRect(img);
        if (!cr.width) return;
        var res = F.frontRes, kind = F.it.kind;
        var rodY = F.rod.offsetTop + F.rod.offsetHeight / 2;
        var an = res && res.canvas && kind === 'string' ? stringAnchor(res) : null;
        var neck = an ? an.x : (res && res.canvas ? res.neck : 0.5);
        var x = cr.left - sr.left + cr.width * neck;
        var topY = cr.top - sr.top + (an ? an.top * cr.height : 0) + (res && res.canvas ? 0 : 6);
        var len = Math.max(12, Math.round(topY - rodY + 9 + 4));
        var hook = res && res.canvas && kind === 'string'
            ? svg('rk-focus-hook', 30, len, [['M15 ' + len + ' L15 18', 'rk-cordline'], ['M15 21 C15 16 9 15 9 9.5 C9 4.5 12.2 2 15.2 2 C19 2 21.6 4.6 21.6 8.4', 'rk-wire']])
            : hookSvg(len);
        hook.classList.add('rk-focus-hook');
        hook.style.left = (x - 15) + 'px';
        hook.style.top = (rodY - 9) + 'px';
        stage.insertBefore(hook, F.golink);
        F.hook = hook;
    }

    function fillFace(face, res, name) {
        face.replaceChildren();
        if (res && res.canvas) {
            var c = cloneCanvas(res.canvas); c.className = 'rk-face-img'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', name);
            face.appendChild(c);
            face.classList.remove('is-photo');
        } else if (res && res.img) {
            var im = el('img', 'rk-face-img'); im.src = res.img.src; im.alt = name;
            face.appendChild(im);
            face.classList.add('is-photo');
        } else {
            face.appendChild(el('span', 'rk-photo-name', name));
            face.classList.add('is-photo');
        }
    }

    function openFocus(r, it) {
        if (!F) buildFocus();
        var p = it.product, token = ++F.token;
        F.it = it; F.r = r;
        F.opener = it.hit;
        F.msg.textContent = '';
        F.msg.className = 'rk-focus-msg';
        F.kicker.textContent = (p.brand || 'THE STYLE HUB') + ' · ' + (isPersonal(it) ? 'Gợi ý #' + String(it.rank + 1).padStart(2, '0') + ' dành cho bạn' : 'Khám phá thêm');
        F.nameLink.textContent = p.name || '';
        F.priceRow.replaceChildren(el('span', 'rk-focus-now', formatVND(priceNum(p))));
        if (p.oldPrice) F.priceRow.appendChild(el('s', 'rk-focus-old', p.oldPrice));
        F.why.replaceChildren();
        var whyText = isPersonal(it) ? it.reason : (it.rec ? EXPLORE_WHY : '');
        if (whyText) { F.why.append(el('b', null, 'Vì sao gợi ý: '), doc.createTextNode(whyText)); F.why.hidden = false; } else F.why.hidden = true;

        // size: quần áo chọn sẵn M như trang sản phẩm; giày phải tự chọn
        var kind = sizeKind(it.id, it.attrs), list = SIZES[kind];
        F.size = kind === 'shoes' ? null : 'M';
        F.sizeTitle.textContent = kind === 'shoes' ? 'Chọn size giày (EU)' : 'Chọn size';
        F.sizes.replaceChildren();
        list.forEach(function (s) {
            var b = el('button', 'rk-size' + (s === F.size ? ' is-on' : ''), s);
            b.type = 'button';
            b.setAttribute('aria-pressed', String(s === F.size));
            b.addEventListener('click', function () {
                F.size = s;
                [].forEach.call(F.sizes.children, function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
                syncActions();
            });
            F.sizes.appendChild(b);
        });
        var available = inStock(it.id, p);
        F.add.dataset.available = available ? '1' : '0';
        syncActions();

        // mặt trước: dùng ngay đúng ảnh đang treo trên sào, rồi thay bằng bản nét hơn của chính ảnh đó
        F.frontRes = it.cut || null;
        fillFace(F.front, it.cut || it.vis || null, (p.name || '') + ' — mặt trước');
        F.back.replaceChildren();
        setFace(false);
        var imgs = imagesOf(p);
        var frontIdx = it.imgIdx >= 0 ? it.imgIdx : 0;
        F.views.hidden = imgs.length < 2;
        var maxH = clamp(Math.round(window.innerHeight * 0.72 * Math.min(2, window.devicePixelRatio || 1)), 500, 1300);
        if (imgs[frontIdx]) getCutout(imgs[frontIdx], FOCUS_IMG_W, maxH).then(function (res) {
            if (F.token !== token || res.failed) return;
            // món treo bằng ảnh tách nền: chỉ thay khi bản nét hơn vẫn tách sạch; món treo bằng ảnh chụp: hiện ảnh chụp
            var good = it.cut ? (usable(res, it.kind) ? res : null) : { photo: true, img: res.img };
            if (!good) return;
            if (good.canvas) F.frontRes = good;
            fillFace(F.front, good, (p.name || '') + ' — mặt trước');
            if (F.root.classList.contains('is-in')) placeFocusHook();
        });
        // mặt sau: ảnh khác của cùng sản phẩm, ưu tiên ảnh tách nền sạch (không lấy ảnh người mẫu nếu có ảnh sản phẩm)
        if (imgs.length > 1) pickVisual(it, FOCUS_IMG_W, maxH, frontIdx).then(function (pick) {
            if (F.token === token) fillFace(F.back, pick.res, (p.name || '') + ' — mặt sau');
        });

        F.root.hidden = false;
        doc.documentElement.classList.add('rk-lock');
        it.node.classList.add('is-away');
        flight(it, false, function () {
            F.root.classList.add('is-in');
            placeFocusHook();
            F.close.focus();
        });
    }

    function syncActions() {
        var it = F.it; if (!it) return;
        var available = F.add.dataset.available === '1';
        F.add.disabled = !available || !F.size;
        F.add.textContent = !available ? 'Tạm hết hàng' : (F.size ? 'Thêm vào BAG · size ' + F.size : 'Chọn size để thêm vào BAG');
        F.detail.href = 'product-detail.html?id=' + encodeURIComponent(it.id) + (F.size ? '&size=' + encodeURIComponent(F.size) : '');
        F.nameLink.href = F.detail.href;
        F.golink.href = F.detail.href;
    }

    /** Khung thật của ảnh bên trong phần tử dùng object-fit: contain. */
    function contentRect(node) {
        var b = node.getBoundingClientRect();
        var iw = node.tagName === 'CANVAS' ? node.width : node.naturalWidth, ih = node.tagName === 'CANVAS' ? node.height : node.naturalHeight;
        if (!(iw > 0 && ih > 0) || !(b.width > 0 && b.height > 0)) return b;
        var r = iw / ih, w = b.width, h = b.height;
        if (w / h > r) w = h * r; else h = w / r;
        return { left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h };
    }

    /** Món đồ "bay" từ sào ra giữa màn hình (và ngược lại khi đóng). */
    function flight(it, reverse, done) {
        var src = it.turn.querySelector('.rk-g-front') || it.turn.querySelector('.rk-photo') || it.turn.firstChild;
        var dst = F.front.firstChild;
        if (reduceMotion.matches || !src || !dst || !src.getBoundingClientRect || typeof src.animate !== 'function') {
            F.root.classList.toggle('is-flying', false);
            done();
            return;
        }
        F.root.classList.add('is-flying');
        requestAnimationFrame(function () {
            var a = src.getBoundingClientRect(), b = contentRect(dst);
            if (!a.width || !b.width) { F.root.classList.remove('is-flying'); done(); return; }
            var ghost = src.tagName === 'CANVAS' ? cloneCanvas(src) : src.cloneNode(true);
            ghost.className = 'rk-ghost';
            ghost.style.left = b.left + 'px'; ghost.style.top = b.top + 'px';
            ghost.style.width = b.width + 'px'; ghost.style.height = b.height + 'px';
            doc.body.appendChild(ghost);
            var from = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ',' + (a.height / b.height) + ')';
            var kf = [{ transform: from, opacity: 0.85 }, { transform: 'translate(0,0) scale(1,1)', opacity: 1 }];
            if (reverse) kf.reverse();
            var anim = ghost.animate(kf, { duration: 620, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' });
            anim.onfinish = function () {
                ghost.remove();
                F.root.classList.remove('is-flying');
                done();
            };
        });
    }

    function closeFocus() {
        if (!F || F.root.hidden) return;
        var it = F.it;
        F.token++;
        F.root.classList.remove('is-in');
        F.root.classList.add('is-closing');
        if (F.hook) { F.hook.remove(); F.hook = null; }
        var finish = function () {
            F.root.hidden = true;
            F.root.classList.remove('is-closing');
            doc.documentElement.classList.remove('rk-lock');
            if (it) {
                it.node.classList.remove('is-away');
                impulse(it, 26);
                if (F.opener && F.opener.isConnected) F.opener.focus({ preventScroll: true });
            }
            F.it = null;
            if (pending) {
                var job = pending; pending = null;
                var keepId = it && it.id;
                render(job.host, job.entries, job.opts);
                var again = rack && rack.items.filter(function (x) { return x.id === keepId; })[0];
                if (again && doc.activeElement === doc.body) again.hit.focus({ preventScroll: true });
            }
        };
        if (it && it.alive && it.node.isConnected) flight(it, true, finish); else finish();
    }

    /* ---------- thêm vào BAG (cùng định dạng giỏ hàng với trang sản phẩm / chatbot) ---------- */
    function readCart() {
        try { if (window.StyleHubCartSync && typeof window.StyleHubCartSync.read === 'function') { var c = window.StyleHubCartSync.read(); if (Array.isArray(c)) return c.slice(); } } catch (e) { /* bỏ qua */ }
        for (var i = 0; i < CART_KEYS.length; i++) {
            try { var v = JSON.parse(localStorage.getItem(CART_KEYS[i]) || '[]'); if (Array.isArray(v) && v.length) return v.slice(); } catch (e) { /* bỏ qua */ }
        }
        return [];
    }
    function writeCart(cart) {
        try { if (window.StyleHubCartSync && typeof window.StyleHubCartSync.save === 'function') { window.StyleHubCartSync.save(cart); return true; } } catch (e) { /* bỏ qua */ }
        try {
            var data = JSON.stringify(cart);
            CART_KEYS.forEach(function (k) { localStorage.setItem(k, data); });
            var total = cart.reduce(function (s, x) { return s + (Number(x.qty) || Number(x.quantity) || 1); }, 0);
            doc.querySelectorAll('#cart-count,#bag-count').forEach(function (n) { n.textContent = total; });
            return true;
        } catch (e) { return false; }
    }
    function addToBag() {
        var it = F.it; if (!it || !F.size) return;
        var p = catalog()[it.id] || it.product;
        if (!inStock(it.id, p)) { F.msg.textContent = 'Sản phẩm này vừa hết hàng.'; F.msg.className = 'rk-focus-msg is-err'; return; }
        var cart = readCart();
        var size = F.size;
        var found = cart.find(function (x) { return x && (x.key === it.id || x.id === it.id) && String(x.size || '').toUpperCase() === size; });
        if (found) { found.qty = (Number(found.qty) || Number(found.quantity) || 1) + 1; found.quantity = found.qty; }
        else {
            var img = imagesOf(p)[0] || '';
            cart.push({ key: it.id, id: it.id, name: p.name, price: p.price, priceNum: priceNum(p), mainImg: img, image: img, size: size, qty: 1, quantity: 1 });
        }
        if (!writeCart(cart)) { F.msg.textContent = 'Chưa lưu được giỏ hàng (bộ nhớ trình duyệt bị chặn hoặc đã đầy).'; F.msg.className = 'rk-focus-msg is-err'; return; }
        F.msg.replaceChildren(doc.createTextNode('Đã thêm vào BAG (size ' + size + '). '));
        if (window.StyleHubCartSync && typeof window.StyleHubCartSync.openBag === 'function') {
            var open = el('button', 'rk-linkbtn', 'Mở BAG'); open.type = 'button';
            open.addEventListener('click', function () { closeFocus(); setTimeout(function () { window.StyleHubCartSync.openBag(); }, 450); });
            F.msg.appendChild(open);
        }
        F.msg.className = 'rk-focus-msg is-ok';
    }

    window.StyleHubRack = {
        render: render,
        close: closeFocus,
        // để kiểm thử
        _cutout: cutoutImage,
        _shortPrice: shortPrice,
        _sized: sized
    };
})();
