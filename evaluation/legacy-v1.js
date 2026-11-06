/* =============================================================================
   Bản port TRUNG THÀNH thuật toán gợi ý cũ (stylehub-recommendations.js tại commit
   1016e7e) để so sánh công bằng trong thực nghiệm. Giữ nguyên: trọng số tín hiệu,
   đặc trưng regex trên tên, cosine, peers chỉ lấy hàng ĐÃ MUA, maxPeer = max(1, ...),
   điểm 0.65·content + 0.35·social và phần cộng điểm theo loại vừa xem ở trang chủ.
   Khác biệt duy nhất: dữ liệu lấy từ luồng sự kiện thay vì localStorage.
   ========================================================================== */
'use strict';
const DAY = 86400000;

function buildProfiles(events, now) {
    const profiles = new Map();
    const get = (u) => {
        if (!profiles.has(u)) profiles.set(u, { views: {}, cart: {}, ratings: {}, wishlist: new Set(), purchases: new Set() });
        return profiles.get(u);
    };
    for (const e of events) {
        if (e.ts > now) continue;
        const p = get(String(e.user));
        if (e.type === 'view' || e.type === 'cart') {
            const field = e.type === 'view' ? p.views : p.cart;
            const old = field[e.item] || { count: 0, at: 0 };
            if (e.ts - old.at < 30000) continue;
            field[e.item] = { count: Math.min(10, old.count + 1), at: e.ts };
        } else if (e.type === 'rating') {
            if (Number(e.value) === 0) delete p.ratings[e.item];
            else p.ratings[e.item] = { value: Number(e.value), at: e.ts };
        } else if (e.type === 'wishlist') {
            if (e.value === 0) p.wishlist.delete(e.item); else p.wishlist.add(e.item);
        } else if (e.type === 'unwishlist') {
            p.wishlist.delete(e.item);
        } else if (e.type === 'purchase') {
            p.purchases.add(e.item);
        }
    }
    return profiles;
}

function createLegacyModel({ catalog, events, now, isAvailable }) {
    const profiles = buildProfiles(events, now);
    const available = isAvailable || ((id) => !catalog[id].outOfStock);
    const signalCache = new Map();

    function signals(user) {
        if (signalCache.has(user)) return signalCache.get(user);
        const p = profiles.get(user), result = {};
        if (!p) { signalCache.set(user, result); return result; }
        const add = (id, n) => { if (catalog[id] && Number.isFinite(n)) result[id] = (result[id] || 0) + n; };
        for (const field of ['views', 'cart']) for (const [id, event] of Object.entries(p[field])) {
            const age = Math.max(0, now - event.at);
            if (age < 90 * DAY) add(id, (field === 'views' ? 1 : 3) * Math.min(5, event.count) * Math.pow(0.5, age / (30 * DAY)));
        }
        p.wishlist.forEach((id) => add(id, 5));
        p.purchases.forEach((id) => add(id, 7));
        for (const [id, rating] of Object.entries(p.ratings)) {
            const value = rating.value;
            if (value >= 1 && value <= 5) {
                if (value <= 2) result[id] = (value - 3) * 4;
                else add(id, (value - 3) * 4);
            }
        }
        signalCache.set(user, result);
        return result;
    }

    function inferDepartment(id, item) {
        const dept = String((item && (item.adminDepartment || item.department)) || '').toLowerCase();
        if (dept.includes('women')) return 'womens';
        if (dept.includes('kid')) return 'kids';
        if (dept.includes('shoe')) return 'shoes';
        if (dept.includes('sale')) return 'sale';
        if (id.startsWith('womens')) return 'womens';
        if (id.startsWith('kids')) return 'kids';
        if (id.startsWith('shoe')) return 'shoes';
        if (id.startsWith('sale')) return 'sale';
        return 'mens';
    }
    const featureCache = new Map();
    function features(id) {
        if (featureCache.has(id)) return featureCache.get(id);
        const p = catalog[id] || {}, name = String(p.name || '').toLowerCase();
        const f = {};
        f['department:' + inferDepartment(id, p)] = 2;
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
        featureCache.set(id, f);
        return f;
    }
    function cosine(a, b) {
        let dot = 0, aa = 0, bb = 0;
        for (const k of Object.keys(a)) { aa += a[k] * a[k]; dot += a[k] * (b[k] || 0); }
        for (const k of Object.keys(b)) bb += b[k] * b[k];
        return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
    }
    function itemType(id) {
        const name = String((catalog[id] || {}).name || '').toLowerCase();
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
    const hasImage = (id) => !!(catalog[id].mainImg || (catalog[id].images || [])[0]);

    function recommend(user, current, limit) {
        const own = signals(user), taste = {}, peers = {};
        const p = profiles.get(user) || { ratings: {}, purchases: new Set() };
        const bought = p.purchases;
        const positive = Object.fromEntries(Object.entries(own).filter(([, n]) => n > 0));
        const seeds = Object.assign({}, own);
        if (current && catalog[current]) seeds[current] = Math.max(2, seeds[current] || 0);
        for (const [id, weight] of Object.entries(seeds)) for (const [f, value] of Object.entries(features(id))) taste[f] = (taste[f] || 0) + value * weight;
        for (const other of profiles.keys()) {
            if (other === user) continue;
            const peer = Object.fromEntries(Object.entries(signals(other)).filter(([, n]) => n > 0));
            const common = Object.keys(positive).filter((id) => peer[id]).length;
            if (!common) continue;
            const similarity = cosine(positive, peer) * Math.min(1, common / 3);
            for (const id of profiles.get(other).purchases) if (!positive[id]) peers[id] = (peers[id] || 0) + similarity;
        }
        const maxPeer = Math.max(1, ...Object.values(peers));
        return Object.keys(catalog).filter((id) => id !== current && available(id) && !bought.has(id) && !(p.ratings[id] && p.ratings[id].value <= 2) && hasImage(id)).map((id) => {
            const content = Math.max(0, cosine(taste, features(id)));
            const social = (peers[id] || 0) / maxPeer;
            return { id, score: 0.65 * content + 0.35 * social };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit || 4);
    }

    function recommendHome(user, limit) {
        const p = profiles.get(user);
        const weighted = signals(user);
        const recentViews = p ? Object.entries(p.views).filter(([id, e]) => catalog[id] && now - e.at < 90 * DAY).sort((a, b) => b[1].at - a[1].at).slice(0, 12) : [];
        const recentTypes = {}, longTermTypes = {};
        recentViews.forEach(([id, entry], index) => {
            const type = itemType(id);
            if (!type) return;
            const age = Math.max(0, now - entry.at);
            recentTypes[type] = (recentTypes[type] || 0) + Math.min(4, entry.count || 1) * Math.exp(-age / (14 * DAY)) / (1 + index * 0.16);
        });
        for (const [id, value] of Object.entries(weighted)) {
            const type = itemType(id);
            if (type && value > 0) longTermTypes[type] = (longTermTypes[type] || 0) + value;
        }
        const maxRecent = Math.max(0, ...Object.values(recentTypes));
        const maxLong = Math.max(0, ...Object.values(longTermTypes));
        if (!(maxRecent > 0 || maxLong > 0)) {
            const chosen = [], seen = new Set();
            for (const id of Object.keys(catalog)) {
                const type = itemType(id);
                if (!type || seen.has(type) || !available(id) || !hasImage(id)) continue;
                chosen.push({ id, score: 0 }); seen.add(type);
                if (chosen.length >= limit) break;
            }
            for (const id of Object.keys(catalog)) {
                if (chosen.length >= limit) break;
                if (!chosen.some((r) => r.id === id) && available(id) && hasImage(id)) chosen.push({ id, score: 0 });
            }
            return chosen;
        }
        return recommend(user, null, Object.keys(catalog).length).map((r) => {
            const type = itemType(r.id);
            const recent = maxRecent && type ? (recentTypes[type] || 0) / maxRecent : 0;
            const enduring = maxLong && type ? (longTermTypes[type] || 0) / maxLong : 0;
            const viewed = p && p.views[r.id] ? 0.065 : 0;
            return { id: r.id, score: r.score + 0.8 * recent + 0.22 * enduring - viewed };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
    }

    return { recommend, recommendHome, signals };
}

module.exports = { createLegacyModel };
