/* =============================================================================
   Dịch vụ gợi ý phía máy chủ: dựng mô hình từ hành vi TẬP TRUNG của mọi người dùng
   (khác bản cũ chỉ thấy dữ liệu trong một trình duyệt), cache và dựng lại khi có dữ liệu mới.
   ========================================================================== */
'use strict';
const engine = require('../recommender/engine');

class RecommenderService {
    constructor(store, catalog, attributes, options) {
        this.store = store;
        this.catalog = catalog;
        this.attributes = attributes || {};
        this.options = Object.assign({ minRebuildMs: 3000, engineOptions: {} }, options || {});
        this.model = null;
        this.builtAt = 0;
        this.dirty = true;
        this.buildMs = 0;
    }
    markDirty() { this.dirty = true; }

    getModel() {
        const now = Date.now();
        if (this.model && (!this.dirty || now - this.builtAt < this.options.minRebuildMs)) return this.model;
        const t0 = Date.now();
        const events = this.store.listInteractions().concat(this.store.listReviewEvents());
        this.model = engine.createModel({
            catalog: this.catalog,
            attributes: this.attributes,
            events,
            profiles: this.store.listQuizzes(),
            demoUsers: this.store.demoUserIds().map(String),
            now,
            options: this.options.engineOptions
        });
        this.builtAt = now;
        this.dirty = false;
        this.buildMs = Date.now() - t0;
        return this.model;
    }

    recommend(userId, o) {
        const model = this.getModel();
        const user = userId ? String(userId) : 'guest';
        return model.recommend(user, {
            context: o.context, productId: o.productId, limit: o.limit, quiz: o.quiz, recent: o.recent,
            exclude: o.exclude, checkAvailability: false, diversify: o.diversify, weights: o.weights, excludeInteracted: o.excludeInteracted
        });
    }
    outfit(productId, userId, perCategory) { return this.getModel().outfit(productId, userId ? String(userId) : null, { perCategory }); }
    styleDNA(userId, quiz) { return this.getModel().styleDNA(String(userId), quiz || undefined); }
    stats() { return Object.assign(this.getModel().stats(), { buildMs: this.buildMs, builtAt: this.builtAt }); }
    topPopular(limit) {
        const model = this.getModel();
        return Object.keys(this.catalog).map((id) => ({ id, name: this.catalog[id].name, score: model.popularity(id), users: model.popularityCount(id) }))
            .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit || 10)
            .map((x) => Object.assign(x, { score: Number(x.score.toFixed(3)) }));
    }
}

module.exports = { RecommenderService };
