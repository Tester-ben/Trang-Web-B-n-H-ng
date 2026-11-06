/* =============================================================================
   THE STYLE HUB — Phân tích cảm xúc bình luận tiếng Việt (StyleHubSentiment)
   -----------------------------------------------------------------------------
   Phương pháp dựa trên từ điển (lexicon-based), minh bạch và chạy offline:
   - Từ điển cụm từ tích cực/tiêu cực theo ngữ cảnh thời trang/mua sắm (điểm -3..+3).
   - Ghép cụm dài nhất trước (ví dụ "chất lượng kém" ưu tiên hơn "chất").
   - Phủ định ("không", "chẳng", "chưa", "ko"...) đảo chiều cụm cảm xúc trong cửa sổ 3 âm tiết.
   - Từ nhấn mạnh/giảm nhẹ ("rất", "quá", "cực kỳ", "hơi", "khá", "lắm").
   - Từ chuyển ý ("nhưng", "tuy nhiên"): vế sau nặng hơn vế trước.
   - Hỗ trợ gõ không dấu: nếu cả câu không có dấu thì so khớp với từ điển đã bỏ dấu.
   - Emoji cảm xúc.
   Kết quả: score ∈ [-1, 1] (tanh), label ∈ {positive, neutral, negative}.
   Dùng để điều chỉnh điểm đánh giá trong hệ gợi ý: r_eff = 0.7·sao + 0.3·(3 + 2·score).
   ========================================================================== */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else if (root) root.StyleHubSentiment = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    var LEXICON = {
        // ---- Tích cực ----
        'đẹp': 2, 'xinh': 2, 'xinh xắn': 2, 'dễ thương': 2, 'cute': 2, 'ưng': 2, 'ưng ý': 2.5, 'thích': 2, 'mê': 2.5,
        'yêu': 2, 'tốt': 2, 'chất': 1.5, 'xịn': 2.5, 'xịn xò': 2.5, 'sang chảnh': 2, 'sang trọng': 2, 'tinh tế': 2,
        'mềm': 1.5, 'mềm mại': 2, 'mịn': 1.5, 'thoáng': 1.5, 'thoáng mát': 2, 'mát': 1, 'êm': 1.5, 'êm chân': 2,
        'thoải mái': 2, 'vừa': 1.5, 'vừa vặn': 2, 'vừa in': 2, 'chuẩn': 1.5, 'chuẩn size': 2, 'đúng size': 2,
        'đúng mô tả': 2, 'giống hình': 2, 'như hình': 2, 'y hình': 2, 'giống mô tả': 2, 'chắc chắn': 1.5, 'bền': 2,
        'đáng tiền': 2.5, 'đáng mua': 2.5, 'đáng đồng tiền': 2.5, 'xứng đáng': 2, 'hài lòng': 2.5, 'tuyệt': 3,
        'tuyệt vời': 3, 'hoàn hảo': 3, 'xuất sắc': 3, 'đỉnh': 2.5, 'đỉnh cao': 3, 'ổn': 1, 'ổn áp': 1.5, 'ok': 1,
        'oke': 1, 'okela': 1.5, 'good': 2, 'nice': 2, 'perfect': 3, 'love': 2, 'recommend': 2, 'nên mua': 2,
        'sẽ mua lại': 2.5, 'mua lại': 1.5, 'ủng hộ': 1.5, 'giao nhanh': 1.5, 'giao hàng nhanh': 1.5, 'nhanh': 1,
        'đóng gói cẩn thận': 2, 'cẩn thận': 1, 'chu đáo': 2, 'nhiệt tình': 2, 'form đẹp': 2, 'dày dặn': 1.5,
        'đường may đẹp': 2, 'đường may chắc': 2, 'rẻ': 1, 'giá tốt': 2, 'giá hợp lý': 2, 'hợp lý': 1.5,
        'phù hợp': 1.5, 'hợp': 1.5, 'tôn dáng': 2.5, '10 điểm': 3, '5 sao': 2.5, 'năm sao': 2.5,
        'không chê vào đâu được': 3, 'không có gì để chê': 3, 'ấm': 1.5, 'ấm áp': 1.5, 'sạch sẽ': 1.5, 'thơm': 1.5,
        'chính hãng': 2, 'hàng thật': 1.5, 'auth': 1.5, 'trẻ trung': 1.5, 'năng động': 1.5, 'cá tính': 1.5,
        'lịch sự': 1.5, 'thanh lịch': 2, 'nổi bật': 1.5, 'hợp thời trang': 2, 'sành điệu': 2, 'nịnh dáng': 2.5,
        'tận tình': 2, 'tư vấn tốt': 2, 'hàng đẹp': 2, 'quá đẹp': 2.5, 'ưng cái bụng': 2.5,
        // ---- Trung tính (chặn khớp sai, ví dụ "chất lượng" không phải lời khen) ----
        'chất lượng': 0, 'chất liệu': 0, 'chất vải': 0, 'bình thường': 0, 'vừa mới': 0, 'mới nhận': 0,
        'đổi size': 0, 'chưa biết': 0, 'không biết': 0, 'tạm được': -0.3, 'tạm ổn': 0.4, 'cũng được': 0.4, 'tiền nào của nấy': -0.5,
        // ---- Tiêu cực ----
        'xấu': -2.5, 'tệ': -2.5, 'kém': -2, 'kém chất lượng': -2.5, 'chán': -2, 'thất vọng': -3, 'dở': -2,
        'tồi': -2.5, 'tồi tệ': -3, 'ghét': -2.5, 'rộng': -1, 'chật': -1.5, 'bó': -1, 'ngắn': -1, 'cộc': -1,
        'mỏng': -1.5, 'mỏng manh': -1.5, 'mỏng dính': -2, 'nhăn': -1.5, 'xù': -1.5, 'xù lông': -2, 'phai': -1.5,
        'phai màu': -2, 'ra màu': -2, 'bạc màu': -2, 'xỉn màu': -2, 'rách': -2.5, 'thủng': -2.5, 'lỗi': -2,
        'hỏng': -2.5, 'hư': -2, 'bị lỗi': -2, 'hàng lỗi': -2, 'bung chỉ': -2, 'sứt chỉ': -2, 'chỉ thừa': -1, 'sai size': -2, 'sai màu': -2,
        'sai mẫu': -2, 'nhầm': -1.5, 'giao nhầm': -2, 'khác hình': -2, 'khác mô tả': -2, 'khác xa': -2,
        'không giống hình': -2.5, 'chậm': -1.5, 'giao chậm': -2, 'đắt': -1.5, 'mắc': -1.5, 'phí tiền': -3,
        'hàng giả': -3, 'fake': -3, 'nóng': -1, 'bí': -1.5, 'ngứa': -2, 'hôi': -2, 'có mùi': -1.5, 'cũ': -1.5,
        'dơ': -2, 'bẩn': -2, 'lừa đảo': -3, 'lừa': -2, 'trả hàng': -1.5, 'hoàn tiền': -1, 'cứng': -1,
        'thô': -1.5, 'thô ráp': -2, 'nhám': -1, 'sờn': -2, 'lệch': -1.5, 'méo': -1.5, 'bad': -2, 'poor': -2,
        'worst': -3, 'terrible': -3, 'disappointed': -3, 'ugly': -2.5, 'không đáng': -2, 'tiếc tiền': -2.5,
        'vứt': -2, 'bỏ đi': -2, 'chê': -1.5, 'kém xa': -2.5, 'thua xa': -2.5, 'thái độ': -1, 'chảnh': -1.5,
        'không như mong đợi': -2.5, 'chưa hài lòng': -2, 'không hài lòng': -2.5
    };
    var EMOJI = {
        '😍': 2.5, '❤️': 2, '❤': 2, '😘': 2, '🥰': 2.5, '👍': 2, '👌': 1.5, '😊': 1.5, '😁': 1.5, '😄': 1.5,
        '💯': 2.5, '🔥': 1.5, '⭐': 1, '😡': -2.5, '😠': -2, '👎': -2, '😞': -2, '😢': -1.5, '😭': -1,
        '💩': -2.5, '😤': -1.5, '🙁': -1.5, '☹️': -1.5, '😒': -1.5
    };
    var NEGATORS = ['không hề', 'chẳng hề', 'chưa hề', 'đâu có', 'không', 'chẳng', 'chả', 'chưa', 'ko', 'k', 'hông', 'hổng', 'kg', 'khong'];
    var INTENSIFIERS_PRE = { 'rất': 1.5, 'quá': 1.5, 'cực kỳ': 1.8, 'cực kì': 1.8, 'cực': 1.8, 'siêu': 1.8, 'vô cùng': 1.8, 'thật sự': 1.3, 'thực sự': 1.3, 'khá': 0.8, 'hơi': 0.6, 'tương đối': 0.8, 'hơi bị': 1.3 };
    var INTENSIFIERS_POST = { 'lắm': 1.4, 'quá': 1.4, 'cực': 1.5, 'xỉu': 1.5, 'dã man': 1.6, 'vô cùng': 1.6, 'cực kỳ': 1.6 };
    var CONTRAST = ['nhưng mà', 'nhưng', 'tuy nhiên', 'có điều', 'mỗi tội'];
    // "vừa" là trạng từ (vừa mới/vừa nhận...) thì không phải lời khen "vừa vặn".
    var VUA_ADVERB_NEXT = { 'mới': 1, 'nhận': 1, 'mua': 1, 'đặt': 1, 'về': 1, 'giao': 1, 'xong': 1, 'mặc': 1, 'thử': 1, 'ra': 1, 'tới': 1, 'đến': 1 };

    function stripDiacritics(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D');
    }
    function buildIndex(dict, strip) {
        var index = {}, maxLen = 1;
        Object.keys(dict).forEach(function (phrase) {
            var key = strip ? stripDiacritics(phrase) : phrase;
            // Khi bỏ dấu, nếu trùng khóa thì giữ giá trị có trị tuyệt đối nhỏ hơn (an toàn hơn).
            if (index[key] !== undefined && Math.abs(index[key]) <= Math.abs(dict[phrase])) return;
            index[key] = dict[phrase];
            maxLen = Math.max(maxLen, key.split(' ').length);
        });
        return { map: index, maxLen: maxLen };
    }
    // Âm tiết nhập nhằng khi gõ không dấu (ví dụ "nhan" = nhăn/nhận, "dat" = đắt/đặt, "phai" = phai/phải,
    // "em" = êm/em, "hop" = hợp/hộp, "do" = dở/đó/đỏ): không dùng một mình ở chế độ không dấu.
    var PLAIN_AMBIGUOUS = ['nhan', 'mac', 'sang', 'mong', 'kem', 'chan', 'cu', 'bi', 'hoi', 'phai', 'lua', 'mat', 'em', 'am',
        'hop', 'yeu', 'ben', 'xin', 'dat', 'cham', 'ngan', 'bo', 'hu', 'loi', 'thung', 'do', 'chat', 'nong', 'thom', 'xu', 'cung'];
    var LEX = { accented: buildIndex(LEXICON, false), plain: buildIndex(LEXICON, true) };
    PLAIN_AMBIGUOUS.forEach(function (k) { delete LEX.plain.map[k]; });
    var TRAILING_PARTICLES = { 'shop': 1, 'ạ': 1, 'a': 1, 'ad': 1, 'admin': 1, 'bạn': 1, 'ban': 1, 'ơi': 1, 'oi': 1, 'vậy': 1, 'vay': 1, 'nhé': 1, 'nhe': 1, 'hả': 1, 'ha': 1, 'ta': 1 };
    var QUESTION_END = { 'không': 1, 'khong': 1, 'ko': 1, 'k': 1, 'chưa': 1, 'chua': 1, 'hông': 1, 'hong': 1, 'nhỉ': 1, 'nhi': 1 };
    var NEG = { accented: buildIndex(arrayToDict(NEGATORS), false), plain: buildIndex(arrayToDict(NEGATORS), true) };
    var PRE = { accented: buildIndex(INTENSIFIERS_PRE, false), plain: buildIndex(INTENSIFIERS_PRE, true) };
    var POST = { accented: buildIndex(INTENSIFIERS_POST, false), plain: buildIndex(INTENSIFIERS_POST, true) };
    var CON = { accented: buildIndex(arrayToDict(CONTRAST), false), plain: buildIndex(arrayToDict(CONTRAST), true) };

    function arrayToDict(arr) { var d = {}; arr.forEach(function (w) { d[w] = 1; }); return d; }

    function tokenize(text) {
        var emojis = [];
        var t = String(text || '').normalize('NFC');
        Object.keys(EMOJI).forEach(function (e) {
            var count = t.split(e).length - 1;
            for (var i = 0; i < count; i++) emojis.push(EMOJI[e]);
            if (count) t = t.split(e).join(' ');
        });
        t = t.toLowerCase().replace(/(\d+)\s*\/\s*10/g, ' $1 điểm ').replace(/[^\p{L}\p{N}\s]+/gu, ' . ');
        var tokens = t.split(/\s+/).filter(Boolean);
        return { tokens: tokens, emojis: emojis };
    }

    function matchAt(tokens, i, index) {
        for (var len = Math.min(index.maxLen, tokens.length - i); len >= 1; len--) {
            var phrase = tokens.slice(i, i + len).join(' ');
            if (index.map[phrase] !== undefined) return { phrase: phrase, value: index.map[phrase], len: len };
        }
        return null;
    }

    /**
     * Phân tích một bình luận. Trả về { score, label, raw, matches }.
     */
    function analyze(text) {
        var tk = tokenize(text);
        var tokens = tk.tokens;
        var plain = stripDiacritics(tokens.join(' ')) === tokens.join(' ');
        var mode = plain ? 'plain' : 'accented';
        var lex = LEX[mode], neg = NEG[mode], pre = PRE[mode], post = POST[mode], con = CON[mode];
        var segments = [[]], matches = [];
        var negateUntil = -1, boost = 1;
        // Câu hỏi có/không ("... có phai không") không mang cảm xúc khẳng định -> bỏ qua mệnh đề đó.
        var ignore = {}, clauseStart = 0;
        for (var t = 0; t <= tokens.length; t++) {
            if (t === tokens.length || tokens[t] === '.') {
                var clause = tokens.slice(clauseStart, t);
                while (clause.length && TRAILING_PARTICLES[clause[clause.length - 1]]) clause = clause.slice(0, -1);
                if (clause.length >= 3 && QUESTION_END[clause[clause.length - 1]] && (clause.indexOf('có') >= 0 || clause.indexOf('co') >= 0)) {
                    for (var q = clauseStart; q < t; q++) ignore[q] = 1;
                }
                clauseStart = t + 1;
            }
        }
        // Cấu trúc nhượng bộ "đẹp thì đẹp nhưng ..." -> vế trước gần như bị phủ nhận.
        var joined = tokens.join(' ');
        var concessive = /(^| )(\S+) (thì|thi) \2 (nhưng|nhung)( |$)/.test(joined);
        var i = 0;
        while (i < tokens.length) {
            if (tokens[i] === '.') { negateUntil = -1; boost = 1; i++; continue; }
            if (ignore[i]) { i++; continue; }
            var c = matchAt(tokens, i, con);
            if (c) { segments.push([]); negateUntil = -1; boost = 1; i += c.len; continue; }
            var m = matchAt(tokens, i, lex);
            var n = matchAt(tokens, i, neg);
            // Ưu tiên cụm cảm xúc chứa phủ định sẵn (ví dụ "không hài lòng", "không đáng").
            if (n && (!m || m.len <= n.len)) { negateUntil = i + n.len + 3; i += n.len; continue; }
            var p = matchAt(tokens, i, pre);
            if (p && (!m || m.len <= p.len)) {
                // "quá" đứng trước: nhấn mạnh; nếu không có cụm cảm xúc phía sau thì bỏ qua.
                boost = p.value; i += p.len; continue;
            }
            if (m) {
                var stem = m.phrase;
                var nextToken = tokens[i + 1];
                if ((stem === 'vua' || stem === 'vừa') && nextToken && (plain ? VUA_ADVERB_NEXT_PLAIN[nextToken] : VUA_ADVERB_NEXT[nextToken])) { i++; continue; }
                var value = m.value * boost;
                var after = matchAt(tokens, i + m.len, post);
                if (after) value *= after.value;
                var negated = i <= negateUntil && m.value !== 0;
                if (negated) value = value > 0 ? -0.8 * value : -0.6 * value;
                if (value !== 0) {
                    segments[segments.length - 1].push(value);
                    matches.push({ phrase: m.phrase, value: Number(value.toFixed(2)), negated: negated });
                }
                boost = 1;
                i += m.len + (after ? after.len : 0);
                continue;
            }
            i++;
        }
        var total = 0;
        segments.forEach(function (seg, idx) {
            var w = segments.length > 1 ? (idx === segments.length - 1 ? 1.4 : (concessive ? 0.2 : 0.6)) : 1;
            seg.forEach(function (v) { total += v * w; });
        });
        tk.emojis.forEach(function (v) { total += v; matches.push({ phrase: 'emoji', value: v, negated: false }); });
        var score = Math.tanh(total / 2.5);
        var label = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
        return { score: Number(score.toFixed(3)), label: label, raw: Number(total.toFixed(3)), matches: matches };
    }
    var VUA_ADVERB_NEXT_PLAIN = {};
    Object.keys(VUA_ADVERB_NEXT).forEach(function (k) { VUA_ADVERB_NEXT_PLAIN[stripDiacritics(k)] = 1; });

    function labelVi(label) {
        return { positive: 'Tích cực', neutral: 'Trung lập', negative: 'Tiêu cực' }[label] || 'Trung lập';
    }

    return { analyze: analyze, labelVi: labelVi, stripDiacritics: stripDiacritics, LEXICON: LEXICON };
});
