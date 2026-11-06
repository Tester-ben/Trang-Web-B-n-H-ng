/* =============================================================================
   THE STYLE HUB — Recommendation Engine v2 (StyleHubRecEngine)
   -----------------------------------------------------------------------------
   Một mã nguồn dùng chung cho 3 nơi:
     1. Trình duyệt (chế độ tĩnh/offline, dữ liệu localStorage)   -> window.StyleHubRecEngine
     2. Máy chủ Node (server/, dữ liệu tập trung nhiều người dùng)  -> require('./engine')
     3. Thực nghiệm offline (evaluation/)                          -> require('./engine')
   Không phụ thuộc thư viện ngoài.

   Thành phần thuật toán
   - Ma trận ưu tiên người dùng × sản phẩm từ hành vi: xem, thêm giỏ, yêu thích,
     mua, đánh giá sao (kết hợp điểm cảm xúc bình luận), có suy giảm theo thời gian.
   - Content-based (CB): TF-IDF trên thuộc tính có cấu trúc (loại, màu, phong cách,
     chất liệu, form, giới tính, khoảng giá, thương hiệu) + hồ sơ quiz "Style DNA".
   - User-based CF (UserKNN): cosine trên vector ưu tiên (log-nén, giữ tín hiệu âm),
     significance weighting, top-k hàng xóm; dùng MỌI tương tác dương của hàng xóm
     (mua, đánh giá >= 4 sao, yêu thích, giỏ, xem) có trọng số.
   - Item-based CF (ItemKNN): cosine giữa sản phẩm + shrinkage theo số người chung.
   - Matrix Factorization BPR (Rendle et al., 2009) cho dữ liệu ngầm định.
   - Popularity có suy giảm thời gian (xu hướng) cho cold-start.
   - Hybrid có trọng số, tự điều chỉnh theo độ tin cậy dữ liệu của từng người dùng
     + đa dạng hóa MMR (Carbonell & Goldstein, 1998).
   - Giải thích (XAI) lấy từ thành phần đóng góp nhiều nhất và bằng chứng thật.
   - Gợi ý phối đồ (outfit), hồ sơ phong cách (Style DNA).
   ========================================================================== */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else if (root) root.StyleHubRecEngine = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    var VERSION = '2.0.0';
    var DAY = 86400000;

    /* ------------------------------------------------------------------ */
    /* 1. Từ vựng thuộc tính và nhãn tiếng Việt                            */
    /* ------------------------------------------------------------------ */
    var LABELS = {
        gender: { men: 'đồ nam', women: 'đồ nữ', kids: 'đồ trẻ em', unisex: 'unisex' },
        category: { top: 'áo', bottom: 'quần', outerwear: 'áo khoác', footwear: 'giày dép' },
        type: {
            tee: 'áo thun', longsleeve: 'áo thun dài tay', tank: 'áo ba lỗ', polo: 'áo polo', shirt: 'áo sơ mi',
            sweatshirt: 'áo nỉ', hoodie: 'áo hoodie', knit: 'áo len', jacket: 'áo khoác', coat: 'áo măng tô',
            sweatpants: 'quần nỉ', pants: 'quần dài', jeans: 'quần jeans', shorts: 'quần short',
            sneaker: 'giày sneaker', boot: 'giày boot', slipper: 'dép', flat: 'giày búp bê'
        },
        color: {
            black: 'màu đen', white: 'màu trắng', beige: 'màu be/kem', grey: 'màu xám', brown: 'màu nâu',
            blue: 'màu xanh dương', green: 'màu xanh lá', red: 'màu đỏ', pink: 'màu hồng', purple: 'màu tím', orange: 'màu cam'
        },
        style: {
            streetwear: 'streetwear', sporty: 'thể thao', minimal: 'tối giản', casual: 'casual', smart: 'thanh lịch',
            lounge: 'thư giãn', vintage: 'vintage', workwear: 'workwear', luxury: 'cao cấp'
        },
        material: { fleece: 'nỉ fleece', cotton: 'cotton', knit: 'len/dệt kim', denim: 'denim', leather: 'da thật', nylon: 'nylon', rayon: 'rayon' },
        fit: {
            relaxed: 'form rộng thoải mái', classic: 'form classic', boxy: 'form boxy/oversize', cropped: 'form lửng',
            fitted: 'form ôm', wide: 'ống rộng', flare: 'ống loe', straight: 'ống đứng'
        },
        price: { budget: 'giá bình dân', mid: 'giá tầm trung', premium: 'giá cao cấp', luxury: 'giá xa xỉ' }
    };
    var PRICE_TIERS = ['budget', 'mid', 'premium', 'luxury'];
    var CATEGORY_OF_TYPE = {
        tee: 'top', longsleeve: 'top', tank: 'top', polo: 'top', shirt: 'top', sweatshirt: 'top', hoodie: 'top', knit: 'top',
        jacket: 'outerwear', coat: 'outerwear',
        sweatpants: 'bottom', pants: 'bottom', jeans: 'bottom', shorts: 'bottom',
        sneaker: 'footwear', boot: 'footwear', slipper: 'footwear', flat: 'footwear'
    };
    var PERSONA = {
        streetwear: 'Streetwear cá tính', minimal: 'Tối giản hiện đại', sporty: 'Năng động thể thao', smart: 'Thanh lịch lịch lãm',
        lounge: 'Thoải mái thư giãn', vintage: 'Vintage hoài cổ', luxury: 'Sang trọng cao cấp', casual: 'Casual năng động', workwear: 'Workwear bụi bặm'
    };

    var TEAMS_RE = /\b(mlb|dodgers|yankees|white sox|red sox|cubs|reds|astros|blue jays|diamondbacks|spurs|panthers|knicks|property of la)\b/g;
    var COLOR_RULES = [
        [/heather stone/, 'grey'],
        [/\bblack\b|\bonyx\b/, 'black'],
        [/\bwhite\b/, 'white'],
        [/\bivory\b|\bcream\b|\boat(meal)?\b|\bvanilla\b|\bdune\b|\bpearl\b|\bbeige\b|\bsand\b|\btaupe\b|\bkhaki\b/, 'beige'],
        [/\bgr[ae]y\b|\bconcrete\b|\biron\b|\bcharcoal\b|\bsmoke\b|\bcarbon\b|\bcinder\b|\bseal\b|\bovercast\b|\balumina\b|\bclay\b|\bsilver\b/, 'grey'],
        [/\bbrown\b|\bmocha\b|\bchocolate\b|\bcamel\b|\bclay\b/, 'brown'],
        [/\bblue\b|\bnavy\b|\bindigo\b|\bsapphire\b|\bsky\b|\bcoastal\b|\bdenim\b|\bcobalt\b/, 'blue'],
        [/\bgreen\b|\bolive\b|\bsage\b|\bforest\b|\bmint\b/, 'green'],
        [/\bred\b|\bmaroon\b|\boxblood\b|\bburgundy\b|\bwine\b|\bcrimson\b/, 'red'],
        [/\bpink\b|\bblush\b|\brose\b|\bmauve\b/, 'pink'],
        [/\bpurple\b|\blilac\b|\blavender\b|\bplum\b/, 'purple'],
        [/\borange\b|\bginger\b|\brust\b|\bcopper\b/, 'orange']
    ];
    var NEUTRAL_COLORS = { black: 1, white: 1, beige: 1, grey: 1, brown: 1, blue: 0.8 };

    function matchColors(text) {
        var found = [];
        var source = ' ' + String(text || '').toLowerCase() + ' ';
        COLOR_RULES.forEach(function (rule) {
            var m = rule[0].exec(source);
            if (m && !found.some(function (f) { return f.color === rule[1]; })) found.push({ color: rule[1], at: m.index });
        });
        return found.sort(function (a, b) { return a.at - b.at; })
            .map(function (x) { return x.color; })
            .filter(function (c, i, arr) { return arr.indexOf(c) === i; });
    }

    function extractColors(rawName, imageUrl) {
        var n = String(rawName || '').toLowerCase().replace(/\(sale\)/g, ' ');
        var parts = n.split(' - ');
        var colorway = parts.length > 1 ? parts[parts.length - 1] : n;
        var colors = matchColors(colorway.replace(TEAMS_RE, ' '));
        if (!colors.length && parts.length > 1) colors = matchColors(n.replace(TEAMS_RE, ' '));
        if (!colors.length && imageUrl) {
            var file = String(imageUrl).split('?')[0].split('/').pop() || '';
            try { file = decodeURIComponent(file); } catch (_) { /* giữ nguyên */ }
            file = file.toLowerCase().replace(/[_\-]+/g, ' ');
            colors = matchColors(file.replace(TEAMS_RE, ' '));
        }
        return colors.slice(0, 3);
    }

    function departmentOf(id, p) {
        var dept = String((p && (p.adminDepartment || p.department || p.gender)) || '').toLowerCase();
        var key = String(id || '').toLowerCase();
        if (dept.indexOf('women') >= 0 || key.indexOf('womens') === 0) return 'womens';
        if (dept.indexOf('kid') >= 0 || key.indexOf('kids') === 0) return 'kids';
        if (dept.indexOf('shoe') >= 0 || key.indexOf('shoe') === 0) return 'shoes';
        if (dept.indexOf('sale') >= 0 || key.indexOf('sale') === 0) return 'sale';
        return 'mens';
    }

    function inferType(name, dept) {
        var isShoeDept = dept === 'shoes';
        if (isShoeDept && /sneaker|basketball|runner|aerobic|athletics/.test(name)) return 'sneaker';
        if (/\bboots?\b/.test(name)) return 'boot';
        if (/slippers?|\bslides?\b/.test(name)) return 'slipper';
        if (/ballerin/.test(name)) return 'flat';
        if (isShoeDept || /sneaker/.test(name)) return 'sneaker';
        if (/\bcoat\b/.test(name)) return 'coat';
        if (/jacket|overshirt|blazer|trucker|parka|bomber/.test(name)) return 'jacket';
        if (/hoodie|hooded/.test(name)) return 'hoodie';
        if (/sweatshirt/.test(name)) return 'sweatshirt';
        if (/\btank\b|sleeveless/.test(name)) return 'tank';
        if (/\btees?\b|t-shirt|\btshirt\b/.test(name)) return /long sleeve|long-sleeve|\bls\b/.test(name) ? 'longsleeve' : 'tee';
        if (/crewneck|mockneck|crew neck/.test(name) && !/sweater/.test(name)) return 'sweatshirt';
        if (/\bpolo\b/.test(name)) return 'polo';
        if (/sweater|cardigan|pullover|henley|knitwear/.test(name)) return 'knit';
        if (/\bshirt\b/.test(name)) return 'shirt';
        if (/\bjeans?\b/.test(name)) return 'jeans';
        if (/sweatpants?|jogger|track pant/.test(name)) return 'sweatpants';
        if (/\bshorts?\b|sweatshort/.test(name)) return 'shorts';
        if (/\bpants?\b|trousers?|leggings?/.test(name)) return 'pants';
        return 'tee';
    }

    function priceOf(p) {
        var n = Number(p && p.priceNum);
        if (Number.isFinite(n) && n > 0) return n;
        var parsed = Number(String((p && p.price) || '').replace(/[^\d]/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function priceTierOf(price) {
        if (!price) return null;
        if (price < 1500000) return 'budget';
        if (price < 4000000) return 'mid';
        if (price < 8000000) return 'premium';
        return 'luxury';
    }

    /** Suy luận thuộc tính có cấu trúc từ dữ liệu sản phẩm (dùng cho sản phẩm admin mới thêm). */
    function inferAttributes(id, product) {
        var p = product || {};
        var name = String(p.name || '').toLowerCase().replace(/\(sale\)/g, ' ').replace(/\s+/g, ' ').trim();
        var dept = departmentOf(id, p);
        var gender;
        if (dept === 'kids' || /^kids\b|\bkids?\b/.test(name)) gender = 'kids';
        else if (dept === 'womens' || /\bwomens?\b/.test(name)) gender = 'women';
        else if (dept === 'shoes') gender = /ballerin/.test(name) ? 'women' : 'unisex';
        else gender = 'men';

        var type = inferType(name, dept);
        var category = CATEGORY_OF_TYPE[type] || 'top';
        var price = priceOf(p);
        var isTeam = new RegExp(TEAMS_RE.source).test(name);

        var styles = [];
        var addStyle = function (s) { if (styles.indexOf(s) < 0) styles.push(s); };
        if (isTeam || /sport|\btrack\b|training|running|soccer|basketball|athletics|bike short|raglan|aerobic|runner|jersey/.test(name)) addStyle('sporty');
        if (isTeam || /graphic|merch|logo|boxy|oversized|varsity|baseball|streetwear|educate|freedom|disciple|\bfg\b|f of g|fear of god|\b(9|26|43)\b|panelled/.test(name)) addStyle('streetwear');
        if (/dress shirt|executive|tailored|trouser|knit polo|henley|sweater|overshirt|ballerin|ankle boot|leather|shawl collar|lapelless|collarless|relaxed shirt|casual shirt|urban shirt|non-iron/.test(name)) addStyle('smart');
        if (/essential|classic|minimalist|clean neck|signature|non-branded/.test(name) && !isTeam && !/graphic|merch|logo|varsity|pinstripe|\b(9|26|43)\b|educate|freedom|disciple/.test(name)) addStyle('minimal');
        if (/lounge/.test(name) || ((category === 'bottom' || category === 'footwear') && /fleece|sweatpant|sweatshort|slipper|drawstring|bike short/.test(name))) addStyle('lounge');
        if (/90s|70s|\bfaded\b|vintage (sweatpant|tee)|\bworn\b/.test(name)) addStyle('vintage');
        if (/work pant|worker|utility|trucker|overshirt|5 pocket|carpenter/.test(name)) addStyle('workwear');
        if (/leather/.test(name) || price >= 10000000) addStyle('luxury');
        if (styles.indexOf('smart') < 0 && /^(tee|longsleeve|tank|hoodie|sweatshirt|shorts|sweatpants|jeans|polo|sneaker|slipper)$/.test(type)) addStyle('casual');
        if (!styles.length) addStyle(category === 'outerwear' ? 'smart' : 'casual');

        var materials = [];
        var addMat = function (m) { if (materials.indexOf(m) < 0) materials.push(m); };
        if (/fleece/.test(name) || /^(hoodie|sweatshirt)$/.test(type) || (type === 'sweatpants' && !/\btrack\b/.test(name))) addMat('fleece');
        if (/cotton/.test(name) || /^(tee|longsleeve|tank|shirt|polo)$/.test(type)) addMat('cotton');
        if (type === 'knit' || /\bknit\b|\brib\b|sweater|henley/.test(name)) addMat('knit');
        if (/denim|\bjeans?\b|trucker|5 pocket jean/.test(name)) addMat('denim');
        if (/leather/.test(name)) addMat('leather');
        if (/nylon|\btrack (jacket|pant)/.test(name)) addMat('nylon');
        if (/rayon/.test(name)) addMat('rayon');

        var fit = null;
        var fits = [[/boxy|oversized/, 'boxy'], [/cropped/, 'cropped'], [/wide leg/, 'wide'], [/flare/, 'flare'], [/straight/, 'straight'], [/fitted|slim/, 'fitted'], [/relaxed/, 'relaxed'], [/classic fit/, 'classic']];
        for (var i = 0; i < fits.length; i++) if (fits[i][0].test(name)) { fit = fits[i][1]; break; }

        var brand = String(p.brand || '').toLowerCase().trim();
        if (/fear of god/.test(brand)) brand = 'fear of god';
        if (!brand && dept === 'kids') brand = 'essentials';

        return {
            gender: gender, category: category, type: type,
            colors: extractColors(p.name, p.mainImg || (Array.isArray(p.images) ? p.images[0] : '')),
            styles: styles, materials: materials, fit: fit, brand: brand || null,
            price: price, priceTier: priceTierOf(price)
        };
    }

    /* ------------------------------------------------------------------ */
    /* 2. Tiện ích số học                                                   */
    /* ------------------------------------------------------------------ */
    function mulberry32(seed) {
        var a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function sparseNorm(v) { var s = 0; for (var k in v) s += v[k] * v[k]; return Math.sqrt(s); }
    function sparseNormalize(v) {
        var n = sparseNorm(v), out = {};
        if (!n) return out;
        for (var k in v) out[k] = v[k] / n;
        return out;
    }
    function sparseDot(a, b) {
        var small = a, large = b;
        if (Object.keys(a).length > Object.keys(b).length) { small = b; large = a; }
        var s = 0;
        for (var k in small) if (large[k] !== undefined) s += small[k] * large[k];
        return s;
    }
    /** Cosine similarity giữa hai vector thưa (giữ lại để tương thích API cũ). */
    function cosine(a, b) {
        var na = sparseNorm(a || {}), nb = sparseNorm(b || {});
        return na && nb ? sparseDot(a, b) / (na * nb) : 0;
    }
    function addScaled(target, v, s) { for (var k in v) target[k] = (target[k] || 0) + v[k] * s; }
    function compress(x) { return x >= 0 ? Math.log1p(x) : -Math.log1p(-x); }
    function decay(age, halfLifeDays) { return Math.pow(0.5, Math.max(0, age) / (halfLifeDays * DAY)); }
    function truncate(text, n) { text = String(text || ''); return text.length > n ? text.slice(0, n - 1).trim() + '…' : text; }

    /* ------------------------------------------------------------------ */
    /* 3. Cấu hình mặc định                                                */
    /* ------------------------------------------------------------------ */
    var DEFAULTS = {
        eventWeights: { view: 1, cart: 3, wishlist: 5, purchase: 7, ratingPerStar: 4 },
        viewCap: 5, cartCap: 3,
        shortHalfLifeDays: 30, shortMaxAgeDays: 90,      // xem, thêm giỏ
        longHalfLifeDays: 180,                            // yêu thích, mua
        ratingHalfLifeDays: 365,                          // đánh giá sao
        sentimentMix: 0.3,                                // r_eff = (1-μ)·sao + μ·(3 + 2·cảm xúc)
        dislikeThreshold: 2.5,
        userKnn: { k: 25, significance: 4, minSim: 0.01 },
        itemKnn: { k: 30, shrink: 3 },
        mf: { enabled: true, factors: 16, epochs: 100, learningRate: 0.05, regularization: 0.01, seed: 42, minPositives: 10 },
        confidenceKappa: 3,                               // tin cậy CF theo số tương tác của người dùng: n/(n+κ)
        communityKappa: 30,                               // tin cậy CF theo quy mô cộng đồng: U/(U+κc)
        coldStartThreshold: 2,                            // <= 2 tương tác dương -> dùng trọng số cold-start (switching hybrid)
        genderMismatchFactor: 0.35,                       // giảm điểm sản phẩm khác giới tính khi biết chắc giới tính người dùng
        genderConfidence: 0.8,
        quizWeight: 1,
        // Trọng số hybrid. Giá trị "home" được tinh chỉnh bằng grid search trên tập validation
        // (evaluation/run-evaluation.js -> recommender/tuned-weights.json). Xem docs/KET_QUA_THUC_NGHIEM.md.
        weights: {
            home: { cb: 0.07, ucf: 0.45, icf: 0.07, mf: 0.28, pop: 0.13 },
            cold: { cb: 0.08, ucf: 0.48, icf: 0.1, mf: 0.13, pop: 0.2 },
            product: { ctx: 0.35, cb: 0.05, ucf: 0.29, icf: 0.05, mf: 0.18, pop: 0.08 }
        },
        mmrLambda: 0.8,
        // Quy tắc trải nghiệm: nếu người dùng vừa xem sản phẩm trong 30 phút gần nhất (đang trong phiên),
        // trọng số "session" ở trang chủ tối thiểu 0.3 để gợi ý phản ánh ý định hiện tại. Không ảnh hưởng
        // thực nghiệm offline (đánh giá theo ngày, không có phiên đang mở).
        // Trang chủ: hệ số cho sản phẩm người dùng CHỈ mới xem (chưa giỏ/yêu thích/mua) để ưu tiên khám phá
        // mẫu mới; 1 = tắt. Giá trị được chọn bằng thực nghiệm (xem docs/KET_QUA_THUC_NGHIEM.md).
        viewedOnlyFactor: 0.9,
        liveSessionMinutes: 30,
        liveSessionWeight: 0.3,
        groupWeights: { type: 3, category: 1.5, gender: 2.5, color: 1.5, style: 1.5, material: 1, fit: 0.75, brand: 0.75, price: 1 }
    };

    // Bộ trọng số hybrid được THAY THẾ nguyên khối (không trộn với mặc định) để cấu hình rõ ràng.
    var REPLACE_KEYS = { home: 1, cold: 1, product: 1 };
    function mergeOptions(base, extra) {
        var out = {};
        Object.keys(base).forEach(function (k) {
            var b = base[k], e = extra ? extra[k] : undefined;
            if (REPLACE_KEYS[k] && e && typeof e === 'object') out[k] = Object.assign({}, e);
            else if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = mergeOptions(b, e && typeof e === 'object' ? e : {});
            else out[k] = e !== undefined ? e : b;
        });
        if (extra) Object.keys(extra).forEach(function (k) { if (out[k] === undefined) out[k] = extra[k]; });
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* 4. Đặc trưng nội dung (TF-IDF)                                       */
    /* ------------------------------------------------------------------ */
    function rawFeatures(attr) {
        var f = {};
        var add = function (k, w) { if (k && (f[k] === undefined || f[k] < w)) f[k] = w; };
        add('type:' + attr.type, 1);
        add('category:' + attr.category, 1);
        add('gender:' + attr.gender, 1);
        if (attr.gender === 'unisex') { add('gender:men', 0.6); add('gender:women', 0.6); }
        (attr.colors || []).forEach(function (c, i) { add('color:' + c, i === 0 ? 1 : 0.7); });
        (attr.styles || []).forEach(function (s) { add('style:' + s, 1); });
        (attr.materials || []).forEach(function (m) { add('material:' + m, 1); });
        if (attr.fit) add('fit:' + attr.fit, 1);
        if (attr.brand) add('brand:' + attr.brand, 1);
        var t = PRICE_TIERS.indexOf(attr.priceTier);
        if (t >= 0) {
            add('price:' + PRICE_TIERS[t], 1);
            if (t > 0) add('price:' + PRICE_TIERS[t - 1], 0.4);
            if (t < PRICE_TIERS.length - 1) add('price:' + PRICE_TIERS[t + 1], 0.4);
        }
        return f;
    }

    /** Vector đặc trưng từ câu trả lời quiz (cùng không gian với sản phẩm). */
    function quizFeatures(quiz) {
        var f = {};
        if (!quiz || typeof quiz !== 'object') return f;
        var add = function (k, w) { f[k] = Math.max(f[k] || 0, w); };
        if (LABELS.gender[quiz.gender]) {
            add('gender:' + quiz.gender, 1);
            if (quiz.gender === 'men' || quiz.gender === 'women') add('gender:unisex', 0.6);
        }
        (Array.isArray(quiz.styles) ? quiz.styles : []).forEach(function (s) { if (LABELS.style[s]) add('style:' + s, 1); });
        (Array.isArray(quiz.colors) ? quiz.colors : []).forEach(function (c) { if (LABELS.color[c]) add('color:' + c, 1); });
        (Array.isArray(quiz.types) ? quiz.types : []).forEach(function (t) {
            if (LABELS.type[t]) { add('type:' + t, 1); add('category:' + CATEGORY_OF_TYPE[t], 0.6); }
        });
        var tier = PRICE_TIERS.indexOf(quiz.budget);
        if (tier >= 0) {
            add('price:' + PRICE_TIERS[tier], 1);
            if (tier > 0) add('price:' + PRICE_TIERS[tier - 1], 0.4);
            if (tier < PRICE_TIERS.length - 1) add('price:' + PRICE_TIERS[tier + 1], 0.4);
        }
        return f;
    }

    function featureLabel(key) {
        var i = key.indexOf(':');
        var group = key.slice(0, i), value = key.slice(i + 1);
        if (group === 'brand') return value.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        var label = (LABELS[group] && LABELS[group][value]) || value;
        return group === 'style' ? 'phong cách ' + label : label;
    }

    /* ------------------------------------------------------------------ */
    /* 5. Ma trận ưu tiên từ sự kiện                                        */
    /* ------------------------------------------------------------------ */
    var EVIDENCE_RANK = { view: 1, cart: 2, wishlist: 3, rating: 4, purchase: 5 };

    function effectiveRating(value, sentiment, mix) {
        var r = Number(value);
        if (!Number.isFinite(r) || r < 1 || r > 5) return null;
        var s = Number(sentiment);
        if (sentiment === null || sentiment === undefined || !Number.isFinite(s)) return r;
        s = Math.max(-1, Math.min(1, s));
        return Math.max(1, Math.min(5, (1 - mix) * r + mix * (3 + 2 * s)));
    }

    /**
     * Gom sự kiện thành ma trận ưu tiên.
     * events: [{ user, item, type: view|cart|wishlist|unwishlist|purchase|rating, value, sentiment, ts }]
     */
    function buildPreferenceData(events, catalog, opts, now) {
        var acc = new Map();   // user -> Map(item -> accumulator)
        var recent = new Map(); // user -> [{item, ts}]
        var sorted = (events || []).filter(function (e) {
            return e && e.user !== undefined && e.user !== null && e.item && catalog[e.item];
        }).slice().sort(function (a, b) { return (Number(a.ts) || 0) - (Number(b.ts) || 0); });

        sorted.forEach(function (e) {
            var user = String(e.user);
            var ts = Number(e.ts) || now;
            if (ts > now) return; // không dùng sự kiện tương lai
            if (!acc.has(user)) acc.set(user, new Map());
            var items = acc.get(user);
            if (!items.has(e.item)) items.set(e.item, { views: 0, carts: 0, wish: false, wishTs: 0, purchaseTs: 0, rating: null, ratingTs: 0, lastTs: 0 });
            var a = items.get(e.item);
            var age = now - ts;
            a.lastTs = Math.max(a.lastTs, ts);
            switch (e.type) {
                case 'view':
                    if (age <= opts.shortMaxAgeDays * DAY) a.views += decay(age, opts.shortHalfLifeDays);
                    if (!recent.has(user)) recent.set(user, []);
                    recent.get(user).push({ item: e.item, ts: ts });
                    break;
                case 'cart':
                    if (age <= opts.shortMaxAgeDays * DAY) a.carts += decay(age, opts.shortHalfLifeDays) * Math.max(1, Math.min(3, Number(e.value) || 1));
                    break;
                case 'wishlist':
                    a.wish = e.value === undefined || e.value === null ? true : !!Number(e.value);
                    a.wishTs = ts;
                    break;
                case 'unwishlist':
                    a.wish = false; a.wishTs = ts;
                    break;
                case 'purchase':
                    a.purchaseTs = Math.max(a.purchaseTs, ts);
                    break;
                case 'rating':
                case 'review':
                    var r = effectiveRating(e.value, e.sentiment, opts.sentimentMix);
                    if (r === null && Number(e.value) === 0) { a.rating = null; a.ratingTs = ts; }
                    else if (r !== null) { a.rating = r; a.ratingTs = ts; }
                    break;
                default:
                    break; // rec_impression, rec_click... không dùng để học sở thích
            }
        });

        var users = new Map();
        var w = opts.eventWeights;
        acc.forEach(function (items, user) {
            var map = new Map(), n = 0, maxScore = 0, normSq = 0;
            items.forEach(function (a, item) {
                var score = 0, strongest = null, disliked = false;
                if (a.views > 0) { score += w.view * Math.min(opts.viewCap, a.views); strongest = 'view'; }
                if (a.carts > 0) { score += w.cart * Math.min(opts.cartCap, a.carts); strongest = 'cart'; }
                if (a.wish) { score += w.wishlist * decay(now - a.wishTs, opts.longHalfLifeDays); strongest = 'wishlist'; }
                if (a.purchaseTs) { score += w.purchase * decay(now - a.purchaseTs, opts.longHalfLifeDays); strongest = 'purchase'; }
                if (a.rating !== null) {
                    var ratingScore = (a.rating - 3) * w.ratingPerStar * decay(now - a.ratingTs, opts.ratingHalfLifeDays);
                    if (a.rating <= opts.dislikeThreshold) { score = ratingScore; disliked = true; strongest = 'rating'; }
                    else {
                        score += ratingScore;
                        if (a.rating >= 3.5 && strongest !== 'purchase') strongest = 'rating';
                    }
                }
                if (!score) return;
                var entry = {
                    score: score, comp: compress(score), strongest: strongest, disliked: disliked,
                    purchased: !!a.purchaseTs, rating: a.rating, lastTs: a.lastTs
                };
                map.set(item, entry);
                if (score > 0) { n++; maxScore = Math.max(maxScore, score); }
                normSq += entry.comp * entry.comp;
            });
            var rec = (recent.get(user) || []).sort(function (x, y) { return y.ts - x.ts; });
            var seen = {}, recentItems = [];
            rec.forEach(function (r) { if (!seen[r.item]) { seen[r.item] = 1; recentItems.push(r); } });
            if (map.size || recentItems.length) {
                users.set(user, { items: map, positives: n, maxScore: maxScore, norm: Math.sqrt(normSq), recent: recentItems.slice(0, 10) });
            }
        });
        return users;
    }

    /* ------------------------------------------------------------------ */
    /* 6. BPR Matrix Factorization                                          */
    /* ------------------------------------------------------------------ */
    function trainBPR(users, itemIds, cfg) {
        var rng = mulberry32(cfg.seed || 42);
        var k = cfg.factors, lr = cfg.learningRate, reg = cfg.regularization;
        var itemIndex = new Map(itemIds.map(function (id, i) { return [id, i]; }));
        var pairs = [], weights = [], userPos = new Map(), userList = [];
        users.forEach(function (u, user) {
            var pos = [];
            u.items.forEach(function (e, item) { if (e.score > 0 && itemIndex.has(item)) pos.push(itemIndex.get(item)); });
            if (!pos.length) return;
            var ui = userList.length;
            userList.push(user);
            userPos.set(ui, new Set(pos));
            u.items.forEach(function (e, item) {
                if (e.score > 0 && itemIndex.has(item)) { pairs.push([ui, itemIndex.get(item)]); weights.push(Math.log1p(e.score)); }
            });
        });
        if (pairs.length < (cfg.minPositives || 10) || userList.length < 2 || itemIds.length < 3) return null;
        var gauss = function () { return (rng() + rng() + rng() - 1.5) * 0.1; };
        var P = userList.map(function () { var v = new Float64Array(k); for (var f = 0; f < k; f++) v[f] = gauss(); return v; });
        var Q = itemIds.map(function () { var v = new Float64Array(k); for (var f = 0; f < k; f++) v[f] = gauss(); return v; });
        var B = new Float64Array(itemIds.length);
        var cum = [], total = 0;
        weights.forEach(function (x) { total += x; cum.push(total); });
        var pick = function () {
            var r = rng() * total, lo = 0, hi = cum.length - 1;
            while (lo < hi) { var mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
            return pairs[lo];
        };
        var steps = pairs.length;
        for (var epoch = 0; epoch < cfg.epochs; epoch++) {
            for (var s = 0; s < steps; s++) {
                var pr = pick(), u = pr[0], i = pr[1];
                var pos = userPos.get(u), j, guard = 0;
                do { j = Math.floor(rng() * itemIds.length); guard++; } while (pos.has(j) && guard < 20);
                if (pos.has(j)) continue;
                var pu = P[u], qi = Q[i], qj = Q[j];
                var x = B[i] - B[j];
                for (var f = 0; f < k; f++) x += pu[f] * (qi[f] - qj[f]);
                var g = 1 / (1 + Math.exp(x));
                B[i] += lr * (g - reg * B[i]);
                B[j] += lr * (-g - reg * B[j]);
                for (var f2 = 0; f2 < k; f2++) {
                    var puf = pu[f2], qif = qi[f2], qjf = qj[f2];
                    pu[f2] += lr * (g * (qif - qjf) - reg * puf);
                    qi[f2] += lr * (g * puf - reg * qif);
                    qj[f2] += lr * (-g * puf - reg * qjf);
                }
            }
        }
        var userIndex = new Map(userList.map(function (user, i) { return [user, i]; }));
        return {
            score: function (user, item) {
                var ui = userIndex.get(user), ii = itemIndex.get(item);
                if (ui === undefined || ii === undefined) return null;
                var p = P[ui], q = Q[ii], x = B[ii];
                for (var f = 0; f < k; f++) x += p[f] * q[f];
                return x;
            },
            hasUser: function (user) { return userIndex.has(user); },
            users: userList.length, pairs: pairs.length
        };
    }

    /* ------------------------------------------------------------------ */
    /* 7. Mô hình                                                          */
    /* ------------------------------------------------------------------ */
    /**
     * createModel({ catalog, attributes?, events, profiles?, demoUsers?, now?, options?, isAvailable? })
     * - catalog: { id: { name, brand, priceNum, mainImg, images, stock, outOfStock, ... } }
     * - attributes: { id: {gender, category, type, colors, styles, materials, fit, brand, priceTier} } (tùy chọn)
     * - profiles: { user: { quiz: {gender, styles, colors, types, budget} } } (tùy chọn)
     * - demoUsers: mảng/Set id người dùng mô phỏng (để giải thích trung thực)
     */
    function createModel(input) {
        input = input || {};
        var catalog = input.catalog || {};
        var opts = mergeOptions(DEFAULTS, input.options || {});
        var now = Number(input.now) || Date.now();
        var attrTable = input.attributes || {};
        var profiles = input.profiles || {};
        var demoUsers = new Set(input.demoUsers ? Array.from(input.demoUsers).map(String) : []);
        var isAvailable = typeof input.isAvailable === 'function' ? input.isAvailable : function (id) {
            var p = catalog[id];
            return !!p && !p.outOfStock && (p.stock === undefined || Number(p.stock) > 0);
        };

        var itemIds = Object.keys(catalog);
        var attributes = {};
        itemIds.forEach(function (id) {
            var base = inferAttributes(id, catalog[id]);
            var fixed = attrTable[id];
            attributes[id] = fixed ? mergeAttr(base, fixed) : base;
        });

        // TF-IDF
        var raw = {}, df = {};
        itemIds.forEach(function (id) {
            raw[id] = rawFeatures(attributes[id]);
            Object.keys(raw[id]).forEach(function (f) { df[f] = (df[f] || 0) + 1; });
        });
        var N = itemIds.length || 1;
        var idf = {};
        Object.keys(df).forEach(function (f) { idf[f] = Math.log((1 + N) / (1 + df[f])) + 1; });
        var groupWeight = function (f) { return opts.groupWeights[f.slice(0, f.indexOf(':'))] || 1; };
        var weightFeatures = function (rawVec) {
            var v = {};
            Object.keys(rawVec).forEach(function (f) { v[f] = rawVec[f] * groupWeight(f) * (idf[f] || Math.log(1 + N) + 1); });
            return sparseNormalize(v);
        };
        var itemVec = {};
        itemIds.forEach(function (id) { itemVec[id] = weightFeatures(raw[id]); });

        var contentCache = new Map();
        function contentSim(a, b) {
            if (a === b) return 1;
            var key = a < b ? a + '|' + b : b + '|' + a;
            if (contentCache.has(key)) return contentCache.get(key);
            var s = itemVec[a] && itemVec[b] ? sparseDot(itemVec[a], itemVec[b]) : 0;
            contentCache.set(key, s);
            return s;
        }

        // Ma trận ưu tiên
        var users = buildPreferenceData(input.events || [], catalog, opts, now);
        var itemUsers = new Map(), itemPosNormSq = new Map();
        users.forEach(function (u, user) {
            u.items.forEach(function (e, item) {
                if (!itemUsers.has(item)) itemUsers.set(item, []);
                itemUsers.get(item).push([user, e.comp]);
                if (e.comp > 0) itemPosNormSq.set(item, (itemPosNormSq.get(item) || 0) + e.comp * e.comp);
            });
        });

        // Popularity (xu hướng, có suy giảm)
        var popularity = new Map(), popCount = new Map();
        var popWeight = { view: 0.5, cart: 1.5, wishlist: 2, rating: 2, purchase: 3 };
        function popContribution(e) { return e && e.score > 0 ? (popWeight[e.strongest] || 0.5) * decay(now - e.lastTs, opts.shortHalfLifeDays) : 0; }
        users.forEach(function (u) {
            u.items.forEach(function (e, item) {
                if (e.score <= 0) return;
                popularity.set(item, (popularity.get(item) || 0) + popContribution(e));
                popCount.set(item, (popCount.get(item) || 0) + 1);
            });
        });

        var activeUsers = 0;
        users.forEach(function (u) { if (u.positives > 0) activeUsers++; });
        var communityConfidence = activeUsers / (activeUsers + (opts.communityKappa || 0) || 1);

        // BPR
        var mf = null;
        if (opts.mf && opts.mf.enabled) mf = trainBPR(users, itemIds, opts.mf);

        // ---------- User-based CF ----------
        var neighborCache = new Map();
        function userNeighbors(user) {
            if (neighborCache.has(user)) return neighborCache.get(user);
            var me = users.get(user), result = [];
            if (me && me.norm) {
                var dots = new Map(), common = new Map();
                me.items.forEach(function (e, item) {
                    (itemUsers.get(item) || []).forEach(function (pair) {
                        var v = pair[0];
                        if (v === user) return;
                        dots.set(v, (dots.get(v) || 0) + e.comp * pair[1]);
                        common.set(v, (common.get(v) || 0) + 1);
                    });
                });
                var g = opts.userKnn.significance;
                dots.forEach(function (dot, v) {
                    var other = users.get(v);
                    if (!other || !other.norm) return;
                    var c = common.get(v);
                    var sim = dot / (me.norm * other.norm) * (Math.min(c, g) / g);
                    if (sim > opts.userKnn.minSim) result.push({ user: v, sim: sim, common: c, demo: demoUsers.has(v) });
                });
                result.sort(function (a, b) { return b.sim - a.sim || (a.user < b.user ? -1 : 1); });
                result = result.slice(0, opts.userKnn.k);
            }
            neighborCache.set(user, result);
            return result;
        }

        function userCFScores(user) {
            var nbrs = userNeighbors(user), scores = new Map(), evidence = new Map();
            if (!nbrs.length) return { scores: scores, evidence: evidence, neighbors: nbrs };
            var denom = nbrs.reduce(function (s, n) { return s + n.sim; }, 0);
            nbrs.forEach(function (n) {
                var other = users.get(n.user);
                other.items.forEach(function (e, item) {
                    if (e.score <= 0 || !other.maxScore) return;
                    scores.set(item, (scores.get(item) || 0) + n.sim * (e.score / other.maxScore));
                    if (!evidence.has(item)) evidence.set(item, []);
                    evidence.get(item).push({ strongest: e.strongest, rating: e.rating, demo: n.demo, sim: n.sim });
                });
            });
            scores.forEach(function (v, k) { scores.set(k, v / denom); });
            return { scores: scores, evidence: evidence, neighbors: nbrs };
        }

        // ---------- Item-based CF ----------
        var itemNeighborCache = new Map();
        function itemNeighbors(item) {
            if (itemNeighborCache.has(item)) return itemNeighborCache.get(item);
            var normI = Math.sqrt(itemPosNormSq.get(item) || 0), result = [];
            if (normI) {
                var dots = new Map(), co = new Map();
                (itemUsers.get(item) || []).forEach(function (pair) {
                    if (pair[1] <= 0) return;
                    users.get(pair[0]).items.forEach(function (e, j) {
                        if (j === item || e.comp <= 0) return;
                        dots.set(j, (dots.get(j) || 0) + pair[1] * e.comp);
                        co.set(j, (co.get(j) || 0) + 1);
                    });
                });
                dots.forEach(function (dot, j) {
                    var normJ = Math.sqrt(itemPosNormSq.get(j) || 0);
                    if (!normJ) return;
                    var c = co.get(j);
                    var sim = dot / (normI * normJ) * (c / (c + opts.itemKnn.shrink));
                    if (sim > 0) result.push([j, sim, c]);
                });
                result.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
                result = result.slice(0, opts.itemKnn.k);
            }
            itemNeighborCache.set(item, result);
            return result;
        }
        function itemCFSim(a, b) {
            var list = itemNeighbors(a);
            for (var i = 0; i < list.length; i++) if (list[i][0] === b) return list[i][1];
            return 0;
        }
        function itemCFScores(user) {
            var me = users.get(user), scores = new Map(), anchors = new Map();
            if (!me) return { scores: scores, anchors: anchors };
            me.items.forEach(function (e, j) {
                itemNeighbors(j).forEach(function (pair) {
                    var contribution = pair[1] * e.comp;
                    scores.set(pair[0], (scores.get(pair[0]) || 0) + contribution);
                    var best = anchors.get(pair[0]);
                    if (contribution > 0 && (!best || contribution > best.value)) anchors.set(pair[0], { item: j, value: contribution, action: e.strongest });
                });
            });
            return { scores: scores, anchors: anchors };
        }

        // ---------- Content-based ----------
        function tasteVector(user, extraQuiz) {
            var me = users.get(user), taste = {};
            if (me) me.items.forEach(function (e, item) { if (itemVec[item]) addScaled(taste, itemVec[item], e.comp); });
            taste = sparseNormalize(taste);
            var quiz = extraQuiz || (profiles[user] && profiles[user].quiz);
            var qf = quizFeatures(quiz);
            if (Object.keys(qf).length) {
                var positives = me ? me.positives : 0;
                var beta = opts.quizWeight * (positives < 5 ? 1 : 0.5);
                addScaled(taste, weightFeatures(qf), beta);
                taste = sparseNormalize(taste);
            }
            return taste;
        }
        function contentScores(user, candidates, quiz) {
            var taste = tasteVector(user, quiz), scores = new Map();
            if (!Object.keys(taste).length) return { scores: scores, taste: taste };
            candidates.forEach(function (id) { var s = sparseDot(taste, itemVec[id]); if (s > 0) scores.set(id, s); });
            return { scores: scores, taste: taste };
        }

        // ---------- Ngữ cảnh: sản phẩm đang xem / phiên gần đây ----------
        function contextScores(productId, candidates) {
            var scores = new Map();
            if (!catalog[productId]) return scores;
            var hasCF = itemNeighbors(productId).length > 0;
            candidates.forEach(function (id) {
                var s = hasCF ? 0.6 * contentSim(productId, id) + 0.4 * itemCFSim(productId, id) : contentSim(productId, id);
                if (s > 0) scores.set(id, s);
            });
            return scores;
        }
        function recentFor(user, override) {
            if (Array.isArray(override) && override.length) {
                return override.filter(function (r) { return r && catalog[r.item]; })
                    .map(function (r) { return { item: r.item, ts: Math.min(now, Number(r.ts) || now) }; })
                    .sort(function (a, b) { return b.ts - a.ts; }).slice(0, 10);
            }
            var me = users.get(user);
            return me ? me.recent : [];
        }
        function sessionScores(user, candidates, override) {
            var scores = new Map(), anchors = new Map();
            var recentList = recentFor(user, override);
            if (!recentList.length) return { scores: scores, anchors: anchors };
            var recentItems = recentList.slice(0, 5);
            candidates.forEach(function (id) {
                var total = 0, best = null;
                recentItems.forEach(function (r, rank) {
                    if (r.item === id) return; // không "gợi ý" lại chính sản phẩm vừa xem vì... chính nó
                    var w = Math.pow(0.6, rank) * decay(now - r.ts, 7);
                    var s = w * (0.7 * contentSim(r.item, id) + 0.3 * itemCFSim(r.item, id));
                    total += s;
                    if (!best || s > best.value) best = { item: r.item, value: s };
                });
                if (total > 0) { scores.set(id, total); if (best) anchors.set(id, best); }
            });
            return { scores: scores, anchors: anchors };
        }

        /** Độ phổ biến trong CỘNG ĐỒNG: trừ phần đóng góp của chính người dùng (không gợi ý lại thứ chỉ mình họ xem). */
        function popularityScores(candidates, user) {
            var me = users.get(user), scores = new Map();
            candidates.forEach(function (id) {
                var s = (popularity.get(id) || 0) - (me ? popContribution(me.items.get(id)) : 0);
                if (s > 1e-12) scores.set(id, s);
            });
            return scores;
        }
        function communityCount(id, user) {
            var me = users.get(user), e = me ? me.items.get(id) : null;
            return (popCount.get(id) || 0) - (e && e.score > 0 ? 1 : 0);
        }
        function mfScores(user, candidates) {
            var scores = new Map();
            if (!mf || !mf.hasUser(user)) return scores;
            var raw = candidates.map(function (id) { return [id, mf.score(user, id)]; });
            var min = Infinity, max = -Infinity;
            raw.forEach(function (r) { if (r[1] !== null) { min = Math.min(min, r[1]); max = Math.max(max, r[1]); } });
            if (!(max > min)) return scores;
            raw.forEach(function (r) { if (r[1] !== null) scores.set(r[0], (r[1] - min) / (max - min)); });
            return scores;
        }

        // ---------- Ứng viên ----------
        function hasImage(id) { var p = catalog[id]; return !!(p && (p.mainImg || (Array.isArray(p.images) && p.images[0]))); }
        function candidateItems(user, o) {
            var me = users.get(user);
            var exclude = new Set(o.exclude || []);
            if (o.productId) exclude.add(o.productId);
            return itemIds.filter(function (id) {
                if (exclude.has(id) || !hasImage(id)) return false;
                if (o.checkAvailability !== false && !isAvailable(id)) return false;
                if (me) {
                    var e = me.items.get(id);
                    if (e && e.disliked) return false;
                    if (e && e.purchased && o.excludePurchased !== false) return false;
                    if (e && o.excludeInteracted) return false; // chỉ gợi ý thứ người dùng CHƯA tương tác
                }
                if (o.excludeInteracted && Array.isArray(o.recent) && o.recent.some(function (r) { return r && r.item === id; })) return false;
                return true;
            });
        }

        function normalizeMap(m) {
            var max = 0;
            m.forEach(function (v) { if (v > max) max = v; });
            var out = new Map();
            if (max > 0) m.forEach(function (v, k) { if (v > 0) out.set(k, v / max); });
            return out;
        }

        /**
         * Trọng số hybrid thích ứng theo lượng dữ liệu: CF được nhân độ tin cậy của người dùng
         * (số tương tác) và của cộng đồng (số người dùng có dữ liệu) — ít dữ liệu thì dựa nhiều
         * hơn vào nội dung/xu hướng.
         */
        function adaptiveWeights(base, positives, available) {
            var c = positives / (positives + opts.confidenceKappa) * communityConfidence;
            var w = {}, sum = 0;
            Object.keys(base).forEach(function (k) {
                if (!available[k] || !(base[k] > 0)) return;
                var x = base[k];
                if (k === 'ucf' || k === 'icf' || k === 'mf') x *= c;
                if (k === 'pop') x *= (1 - c) + 0.25;
                if (x > 0) { w[k] = x; sum += x; }
            });
            if (!sum) return available.pop ? { pop: 1 } : {};
            Object.keys(w).forEach(function (k) { w[k] /= sum; });
            return w;
        }

        /**
         * Hồ sơ giới tính của người dùng: lấy từ quiz, hoặc suy ra khi >= 80% sản phẩm (không unisex)
         * người dùng tương tác thuộc cùng một giới tính (tối thiểu 3 sản phẩm).
         */
        function genderProfile(user, quiz) {
            if (quiz && (quiz.gender === 'men' || quiz.gender === 'women' || quiz.gender === 'kids')) return { gender: quiz.gender, source: 'quiz' };
            var me = users.get(user);
            if (!me) return null;
            var weight = {}, total = 0, count = 0;
            me.items.forEach(function (e, item) {
                var g = attributes[item] && attributes[item].gender;
                if (e.score <= 0 || !g || g === 'unisex') return;
                weight[g] = (weight[g] || 0) + e.score; total += e.score; count++;
            });
            if (count < 3 || !total) return null;
            var best = Object.keys(weight).sort(function (a, b) { return weight[b] - weight[a]; })[0];
            return weight[best] / total >= opts.genderConfidence ? { gender: best, source: 'history' } : null;
        }
        function genderCompatibleWith(profileGender, itemGender) {
            if (!profileGender || !itemGender) return true;
            if (profileGender === 'kids' || itemGender === 'kids') return profileGender === itemGender;
            return itemGender === 'unisex' || itemGender === profileGender;
        }

        /** Tính điểm từng thành phần (dùng cho recommend và cho thực nghiệm). */
        function componentScores(user, o) {
            o = o || {};
            user = String(user === undefined || user === null ? 'guest' : user);
            var context = o.context || (o.productId ? 'product' : 'home');
            var candidates = o.candidates || candidateItems(user, o);
            var me = users.get(user);
            var quiz = o.quiz || (profiles[user] && profiles[user].quiz);
            var cb = contentScores(user, candidates, quiz);
            var gp = genderProfile(user, quiz);
            if (!gp && context === 'product' && attributes[o.productId] && attributes[o.productId].gender !== 'unisex') {
                gp = { gender: attributes[o.productId].gender, source: 'product' };
            }
            var gate = new Map();
            if (gp) candidates.forEach(function (id) {
                if (!genderCompatibleWith(gp.gender, attributes[id].gender)) gate.set(id, opts.genderMismatchFactor);
            });
            var ucf = userCFScores(user), icf = itemCFScores(user);
            var raw = {
                cb: cb.scores,
                ucf: filterTo(ucf.scores, candidates),
                icf: filterTo(icf.scores, candidates),
                mf: mfScores(user, candidates),
                pop: popularityScores(candidates, user)
            };
            var session = null;
            if (context === 'product' && o.productId) raw.ctx = contextScores(o.productId, candidates);
            else { session = sessionScores(user, candidates, o.recent); raw.session = session.scores; }
            var recentList = recentFor(user, o.recent);
            var liveSession = recentList.length > 0 && now - recentList[0].ts <= opts.liveSessionMinutes * 60000;
            var norm = {}, available = {};
            Object.keys(raw).forEach(function (k) { norm[k] = normalizeMap(raw[k]); available[k] = norm[k].size > 0; });
            return {
                user: user, context: context, candidates: candidates, normalized: norm, available: available,
                positives: me ? me.positives : 0, taste: cb.taste, ucf: ucf, icf: icf, session: session,
                gate: gate, genderProfile: gp, liveSession: liveSession,
                viewedOnly: viewedOnlySet(me)
            };
        }
        function viewedOnlySet(me) {
            var out = new Set();
            if (me) me.items.forEach(function (e, id) { if (e.strongest === 'view' && !e.purchased) out.add(id); });
            return out;
        }
        function filterTo(map, candidates) {
            var out = new Map();
            candidates.forEach(function (id) { if (map.has(id)) out.set(id, map.get(id)); });
            return out;
        }

        /**
         * Xếp hạng hybrid: tổng có trọng số các thành phần đã chuẩn hóa, nhân hệ số giới tính,
         * hòa điểm thì ưu tiên sản phẩm phổ biến hơn (cũng là cách lấp chỗ trống khi thiếu tín hiệu).
         */
        function rankFromComponents(comp, weights) {
            var w = adaptiveWeights(weights, comp.positives, comp.available);
            var keys = Object.keys(w);
            var ranked = comp.candidates.map(function (id) {
                var score = 0, parts = {};
                keys.forEach(function (k) {
                    var v = comp.normalized[k].get(id) || 0;
                    if (v) { parts[k] = w[k] * v; score += parts[k]; }
                });
                var g = comp.gate ? comp.gate.get(id) : undefined;
                if (comp.context === 'home' && opts.viewedOnlyFactor < 1 && comp.viewedOnly && comp.viewedOnly.has(id)) g = (g === undefined ? 1 : g) * opts.viewedOnlyFactor;
                if (g !== undefined) {
                    score *= g;
                    keys.forEach(function (k) { if (parts[k]) parts[k] *= g; });
                }
                return { id: id, score: score, parts: parts, pop: (popularity.get(id) || 0) * (g !== undefined ? g : 1) };
            });
            ranked.sort(function (a, b) { return b.score - a.score || b.pop - a.pop || (a.id < b.id ? -1 : 1); });
            return { ranked: ranked, weights: w };
        }

        /** Switching hybrid: người dùng mới (ít tương tác) ở trang chủ dùng bộ trọng số cold-start. */
        function weightsFor(comp) {
            var base;
            if (comp.context === 'home' && comp.positives <= opts.coldStartThreshold && opts.weights.cold) base = opts.weights.cold;
            else base = opts.weights[comp.context] || opts.weights.home;
            if (comp.context === 'home' && comp.liveSession && (base.session || 0) < opts.liveSessionWeight) {
                base = Object.assign({}, base, { session: opts.liveSessionWeight });
            }
            return base;
        }

        /** Đa dạng hóa bằng Maximal Marginal Relevance. */
        function mmr(ranked, limit, lambda) {
            var pool = ranked.slice(0, Math.max(limit * 6, 30)).filter(function (r) { return r.score > 0; });
            if (pool.length <= 1) return ranked.slice(0, limit);
            var top = pool[0].score || 1;
            var selected = [];
            while (selected.length < limit && pool.length) {
                var bestIndex = 0, bestValue = -Infinity;
                for (var i = 0; i < pool.length; i++) {
                    var maxSim = 0;
                    for (var j = 0; j < selected.length; j++) maxSim = Math.max(maxSim, contentSim(pool[i].id, selected[j].id));
                    var value = lambda * (pool[i].score / top) - (1 - lambda) * maxSim;
                    if (value > bestValue) { bestValue = value; bestIndex = i; }
                }
                selected.push(pool.splice(bestIndex, 1)[0]);
            }
            if (selected.length < limit) {
                var chosen = new Set(selected.map(function (r) { return r.id; }));
                ranked.forEach(function (r) { if (selected.length < limit && !chosen.has(r.id)) selected.push(r); });
            }
            return selected;
        }

        function topSharedFeatures(vecA, vecB, n, skipGroups) {
            var skip = skipGroups || {};
            return Object.keys(vecB).filter(function (f) { return vecA[f] > 0 && !skip[f.slice(0, f.indexOf(':'))]; })
                .map(function (f) { return [f, vecA[f] * vecB[f]]; })
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, n)
                .map(function (x) { return featureLabel(x[0]); });
        }

        function describeAction(action) {
            return { purchase: 'đã mua', rating: 'đánh giá cao', wishlist: 'đã yêu thích', cart: 'đã thêm vào giỏ', view: 'đã xem' }[action] || 'quan tâm';
        }

        function explain(item, comp, productId) {
            var parts = item.parts, keys = Object.keys(parts);
            var total = keys.reduce(function (s, k) { return s + parts[k]; }, 0) || 1;
            var shares = {};
            keys.forEach(function (k) { shares[k] = Math.round(parts[k] / total * 100); });
            var main = keys.sort(function (a, b) { return parts[b] - parts[a]; })[0];
            var text = 'Gợi ý dành cho bạn', evidence = {};
            var name = function (id) { return '“' + truncate(catalog[id] && catalog[id].name, 42) + '”'; };
            if (main === 'ucf') {
                var ev = comp.ucf.evidence.get(item.id) || [];
                var count = function (pred) { return ev.filter(pred).length; };
                var purchases = count(function (x) { return x.strongest === 'purchase'; });
                var rated = count(function (x) { return x.strongest === 'rating' && x.rating >= 3.5; });
                var wished = count(function (x) { return x.strongest === 'wishlist'; });
                var carted = count(function (x) { return x.strongest === 'cart'; });
                var demoOnly = ev.length > 0 && ev.every(function (x) { return x.demo; });
                evidence = { neighbors: ev.length, purchases: purchases, highRatings: rated, wishlists: wished, carts: carted, demoOnly: demoOnly };
                if (purchases) text = purchases + ' người có gu giống bạn đã mua';
                else if (rated) text = rated + ' người có gu giống bạn đánh giá ≥4★';
                else if (wished) text = wished + ' người có gu giống bạn đã yêu thích';
                else if (carted) text = carted + ' người có gu giống bạn đã thêm vào giỏ';
                else text = 'Người có gu giống bạn đã xem sản phẩm này';
                if (demoOnly) text += ' (dữ liệu demo)';
            } else if (main === 'icf') {
                var anchor = comp.icf.anchors.get(item.id);
                if (anchor) { text = 'Thường được chọn cùng ' + name(anchor.item) + ' bạn ' + describeAction(anchor.action); evidence = { anchor: anchor.item }; }
                else text = 'Khách hàng có hành vi giống bạn cũng chọn';
            } else if (main === 'cb') {
                var feats = topSharedFeatures(comp.taste || {}, itemVec[item.id] || {}, 3, { brand: 1, category: 1, price: 0 });
                text = feats.length ? 'Hợp gu của bạn: ' + feats.join(' · ') : 'Phù hợp với sở thích của bạn';
                evidence = { features: feats };
            } else if (main === 'ctx' && productId) {
                var shared = topSharedFeatures(itemVec[productId] || {}, itemVec[item.id] || {}, 3, { category: 1, brand: 1, price: 1 });
                text = shared.length ? 'Tương tự sản phẩm đang xem: ' + shared.join(' · ') : 'Tương tự sản phẩm bạn đang xem';
                evidence = { features: shared, productId: productId };
            } else if (main === 'session') {
                var sa = comp.session && comp.session.anchors.get(item.id);
                text = sa ? 'Vì bạn vừa xem ' + name(sa.item) : 'Dựa trên các sản phẩm bạn vừa xem';
                evidence = sa ? { anchor: sa.item } : {};
            } else if (main === 'mf') {
                text = 'Mô hình học máy BPR dự đoán bạn sẽ thích';
            } else if (main === 'pop') {
                var c = communityCount(item.id, comp.user);
                text = c >= 2 ? 'Đang được nhiều khách quan tâm (' + c + ' người)' : 'Sản phẩm nổi bật để bạn khám phá';
                evidence = { users: c };
            }
            return { type: main || 'explore', text: text, evidence: evidence, shares: shares };
        }

        /**
         * Gợi ý chính.
         * o: { context: 'home'|'product', productId, limit, diversify, lambda, weights, quiz, exclude, excludePurchased }
         */
        function recommend(user, o) {
            o = o || {};
            var limit = Math.max(1, Math.min(50, Number(o.limit) || 4));
            var comp = componentScores(user, o);
            var weights = o.weights || weightsFor(comp);
            var ranking = rankFromComponents(comp, weights);
            var ranked = ranking.ranked;
            if (!ranked.length) return [];
            var anySignal = ranked[0].score > 0;
            var list;
            if (!anySignal) {
                list = exploreList(comp.candidates.filter(function (id) { return !comp.gate.has(id); }).concat(comp.candidates.filter(function (id) { return comp.gate.has(id); })), limit);
                return list.map(function (id) {
                    return { id: id, score: 0, reason: 'Khám phá bộ sưu tập', explanation: { type: 'explore', text: 'Khám phá bộ sưu tập', evidence: {}, shares: {} } };
                });
            }
            list = o.diversify === false ? ranked.slice(0, limit) : mmr(ranked, limit, o.lambda !== undefined ? o.lambda : opts.mmrLambda);
            return list.map(function (item) {
                var ex = item.score > 0 ? explain(item, comp, o.productId) : { type: 'explore', text: 'Khám phá bộ sưu tập', evidence: {}, shares: {} };
                return { id: item.id, score: Number(item.score.toFixed(4)), reason: ex.text, explanation: ex };
            });
        }

        /** Danh sách khám phá khi chưa có tín hiệu: đa dạng loại sản phẩm, ưu tiên phổ biến. */
        function exploreList(candidates, limit) {
            var order = new Map(candidates.map(function (id, i) { return [id, i]; }));
            var sorted = candidates.slice().sort(function (a, b) { return (popularity.get(b) || 0) - (popularity.get(a) || 0) || order.get(a) - order.get(b); });
            var out = [], seenTypes = {};
            sorted.forEach(function (id) {
                var t = attributes[id].type;
                if (out.length < limit && !seenTypes[t]) { seenTypes[t] = 1; out.push(id); }
            });
            sorted.forEach(function (id) { if (out.length < limit && out.indexOf(id) < 0) out.push(id); });
            return out;
        }

        /* ---------- Gợi ý phối đồ ---------- */
        var STYLE_COMPAT = {
            streetwear: { streetwear: 1, casual: 0.8, sporty: 0.8, vintage: 0.8, lounge: 0.6, minimal: 0.6, workwear: 0.7, smart: 0.3, luxury: 0.5 },
            casual: { casual: 1, streetwear: 0.8, minimal: 0.8, sporty: 0.7, lounge: 0.8, vintage: 0.7, workwear: 0.7, smart: 0.5, luxury: 0.4 },
            sporty: { sporty: 1, streetwear: 0.8, casual: 0.7, lounge: 0.8, minimal: 0.5, vintage: 0.6, workwear: 0.4, smart: 0.1, luxury: 0.3 },
            minimal: { minimal: 1, smart: 0.8, casual: 0.8, streetwear: 0.6, luxury: 0.7, lounge: 0.6, sporty: 0.5, vintage: 0.6, workwear: 0.6 },
            smart: { smart: 1, minimal: 0.8, luxury: 0.9, casual: 0.5, workwear: 0.5, streetwear: 0.3, vintage: 0.4, lounge: 0.2, sporty: 0.1 },
            lounge: { lounge: 1, casual: 0.8, sporty: 0.8, minimal: 0.6, streetwear: 0.6, vintage: 0.6, smart: 0.2, luxury: 0.3, workwear: 0.4 },
            vintage: { vintage: 1, streetwear: 0.8, casual: 0.7, workwear: 0.7, minimal: 0.6, lounge: 0.6, sporty: 0.6, smart: 0.4, luxury: 0.4 },
            workwear: { workwear: 1, vintage: 0.7, casual: 0.7, streetwear: 0.7, minimal: 0.6, smart: 0.5, luxury: 0.4, lounge: 0.4, sporty: 0.4 },
            luxury: { luxury: 1, smart: 0.9, minimal: 0.7, streetwear: 0.5, casual: 0.4, vintage: 0.4, workwear: 0.4, lounge: 0.3, sporty: 0.3 }
        };
        function styleMatch(a, b) {
            if (!a.length || !b.length) return 0.5;
            var best = 0;
            a.forEach(function (x) { b.forEach(function (y) { best = Math.max(best, (STYLE_COMPAT[x] && STYLE_COMPAT[x][y]) || 0.3); }); });
            return best;
        }
        function colorHarmony(a, b) {
            if (!a.length || !b.length) return { score: 0.5, note: '' };
            var ca = a[0], cb = b[0];
            var na = NEUTRAL_COLORS[ca] || 0, nb = NEUTRAL_COLORS[cb] || 0;
            var label = LABELS.color[ca].replace('màu ', '') + ' + ' + LABELS.color[cb].replace('màu ', '');
            if (ca === cb) return { score: na ? 0.85 : 0.75, note: 'Phối tông-sur-tông ' + LABELS.color[ca] };
            if (na >= 1 && nb >= 1) return { score: 0.95, note: 'Phối màu trung tính ' + label };
            if (na || nb) return { score: 0.9 + 0.1 * Math.min(na, nb), note: 'Màu nhấn đi cùng màu trung tính: ' + label };
            return { score: 0.3, note: 'Hai màu nổi: ' + label };
        }
        function genderCompatible(base, cand) {
            if (base === 'kids' || cand === 'kids') return base === cand;
            if (base === 'unisex' || cand === 'unisex') return true;
            return base === cand;
        }
        var OUTFIT_TARGETS = { top: ['bottom', 'footwear'], bottom: ['top', 'footwear'], outerwear: ['top', 'bottom'], footwear: ['top', 'bottom'] };

        function outfit(productId, user, o) {
            o = o || {};
            var base = attributes[productId];
            if (!base) return [];
            var perCategory = Math.max(1, Math.min(4, Number(o.perCategory) || 1));
            var targets = OUTFIT_TARGETS[base.category] || ['bottom', 'footwear'];
            var personal = new Map();
            if (user !== undefined && user !== null) {
                var comp = componentScores(String(user), { context: 'home', checkAvailability: true });
                var r = rankFromComponents(comp, weightsFor(comp));
                var maxS = r.ranked.length ? r.ranked[0].score : 0;
                if (maxS > 0) r.ranked.forEach(function (x) { personal.set(x.id, x.score / maxS); });
            }
            var basePrice = PRICE_TIERS.indexOf(base.priceTier);
            var result = [];
            targets.forEach(function (category) {
                var scored = itemIds.filter(function (id) {
                    var a = attributes[id];
                    return id !== productId && a.category === category && hasImage(id) && isAvailable(id) && genderCompatible(base.gender, a.gender);
                }).map(function (id) {
                    var a = attributes[id];
                    var color = colorHarmony(base.colors, a.colors);
                    var style = styleMatch(base.styles, a.styles);
                    var tier = PRICE_TIERS.indexOf(a.priceTier);
                    var price = basePrice >= 0 && tier >= 0 ? 1 - Math.abs(basePrice - tier) / 3 : 0.5;
                    var p = personal.get(id);
                    var score = p !== undefined
                        ? 0.35 * color.score + 0.25 * style + 0.15 * price + 0.25 * p
                        : 0.45 * color.score + 0.35 * style + 0.2 * price;
                    var sharedStyle = base.styles.filter(function (s) { return a.styles.indexOf(s) >= 0; });
                    var reasons = [];
                    if (color.note) reasons.push(color.note);
                    if (sharedStyle.length) reasons.push('cùng phong cách ' + LABELS.style[sharedStyle[0]]);
                    if (p !== undefined && p > 0.6) reasons.push('hợp gu của bạn');
                    return { id: id, category: category, score: Number(score.toFixed(4)), reason: reasons.join(' · ') || 'Dễ phối cùng' };
                }).sort(function (x, y) { return y.score - x.score || (x.id < y.id ? -1 : 1); });
                result = result.concat(scored.slice(0, perCategory));
            });
            return result;
        }

        /* ---------- Hồ sơ phong cách ---------- */
        function styleDNA(user, quiz) {
            user = String(user === undefined || user === null ? 'guest' : user);
            var me = users.get(user);
            var taste = tasteVector(user, quiz);
            var groups = { type: {}, color: {}, style: {}, price: {}, gender: {} };
            Object.keys(taste).forEach(function (f) {
                var g = f.slice(0, f.indexOf(':')), v = taste[f];
                if (groups[g] && v > 0) groups[g][f] = v;
            });
            var summarize = function (g) {
                var entries = Object.keys(groups[g]).map(function (f) { return [f, groups[g][f]]; }).sort(function (a, b) { return b[1] - a[1]; });
                var sum = entries.reduce(function (s, e) { return s + e[1]; }, 0) || 1;
                return entries.slice(0, 3).map(function (e) {
                    return { key: e[0].slice(e[0].indexOf(':') + 1), label: featureLabel(e[0]), share: Math.round(e[1] / sum * 100) };
                });
            };
            var styleTop = summarize('style');
            var hasQuiz = Object.keys(quizFeatures(quiz || (profiles[user] && profiles[user].quiz))).length > 0;
            var positives = me ? me.positives : 0;
            return {
                persona: styleTop.length ? PERSONA[styleTop[0].key] || 'Phong cách riêng' : null,
                types: summarize('type'), colors: summarize('color'), styles: styleTop, prices: summarize('price'), genders: summarize('gender'),
                interactions: positives, fromQuiz: hasQuiz,
                confidence: Number((positives / (positives + 5)).toFixed(2))
            };
        }

        function similarItems(productId, limit) {
            if (!catalog[productId]) return [];
            var candidates = itemIds.filter(function (id) { return id !== productId && hasImage(id); });
            var scores = contextScores(productId, candidates);
            return candidates.filter(function (id) { return scores.has(id); })
                .sort(function (a, b) { return scores.get(b) - scores.get(a) || (a < b ? -1 : 1); })
                .slice(0, limit || 4)
                .map(function (id) { return { id: id, score: Number(scores.get(id).toFixed(4)) }; });
        }

        function stats() {
            var interactions = 0;
            users.forEach(function (u) { interactions += u.items.size; });
            var possible = users.size * itemIds.length;
            return {
                users: users.size, items: itemIds.length, interactions: interactions,
                density: possible ? Number((interactions / possible).toFixed(4)) : 0,
                sparsity: possible ? Number((1 - interactions / possible).toFixed(4)) : 1,
                mfTrained: !!mf, mfUsers: mf ? mf.users : 0,
                activeUsers: activeUsers, communityConfidence: Number(communityConfidence.toFixed(3))
            };
        }

        return {
            version: VERSION,
            options: opts,
            attributes: attributes,
            itemVector: function (id) { return itemVec[id] || {}; },
            contentSim: contentSim,
            itemCFSim: itemCFSim,
            userNeighbors: userNeighbors,
            userData: function (user) { return users.get(String(user)) || null; },
            popularity: function (id) { return popularity.get(id) || 0; },
            popularityCount: function (id) { return popCount.get(id) || 0; },
            componentScores: componentScores,
            rankFromComponents: rankFromComponents,
            weightsFor: weightsFor,
            adaptiveWeights: adaptiveWeights,
            mmr: mmr,
            recommend: recommend,
            outfit: outfit,
            styleDNA: styleDNA,
            similarItems: similarItems,
            stats: stats
        };
    }

    function mergeAttr(base, fixed) {
        var out = {};
        Object.keys(base).forEach(function (k) { out[k] = base[k]; });
        Object.keys(fixed || {}).forEach(function (k) { if (fixed[k] !== undefined) out[k] = fixed[k]; });
        if (fixed && fixed.type && !fixed.category) out.category = CATEGORY_OF_TYPE[fixed.type] || out.category;
        return out;
    }

    return {
        VERSION: VERSION,
        DEFAULTS: DEFAULTS,
        LABELS: LABELS,
        PERSONA: PERSONA,
        PRICE_TIERS: PRICE_TIERS,
        CATEGORY_OF_TYPE: CATEGORY_OF_TYPE,
        inferAttributes: inferAttributes,
        extractColors: extractColors,
        quizFeatures: quizFeatures,
        rawFeatures: rawFeatures,
        effectiveRating: effectiveRating,
        buildPreferenceData: buildPreferenceData,
        trainBPR: trainBPR,
        createModel: createModel,
        cosine: cosine,
        mulberry32: mulberry32,
        featureLabel: featureLabel
    };
});
