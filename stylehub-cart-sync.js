/* THE STYLE HUB - CART SYNC + UNIVERSAL BAG DRAWER + SELECTED CHECKOUT - CLEAR PAID ITEMS + MERGE DUPLICATES + SAFE REMOVE V25 */
(function () {
    const CART_KEYS = [
        "stylehub_cart_memory_v1",
        "stylehub_cart",
        "hub_cart",
        "cartMemoryArray",
        "the_style_hub_cart",
        "cart"
    ];

    const BAG_SELECTION_KEY = "stylehub_bag_selected_indexes_v1";
    let stylehubCheckoutSelectedIndexesSnapshot = [];
    let stylehubCheckoutSelectedFingerprintsSnapshot = [];

    function parseCart(raw) {
        try {
            const parsed = JSON.parse(raw || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function parseMoney(value) {
        const num = parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);
        return Number.isFinite(num) ? num : 0;
    }

    function formatMoney(value) {
        return (Number(value || 0)).toLocaleString("vi-VN") + " ₫";
    }

    function triggerStyleHubUniversalFirework() {
        if (typeof window.triggerFireworkCelebration === "function") {
            try {
                window.triggerFireworkCelebration();
                return;
            } catch (error) {}
        }

        const canvas = document.createElement("canvas");
        canvas.style.position = "fixed";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "2147483647";
        document.body.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        const particles = [];
        const colors = ["#ffffff", "#111111", "#666666", "#dddddd", "#999999"];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function burst(x, y) {
            for (let i = 0; i < 56; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4.5 + 2;
                particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 2.6 + 1.4,
                    alpha: 1,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
        }

        resize();
        burst(canvas.width * 0.26, canvas.height * 0.42);
        burst(canvas.width * 0.50, canvas.height * 0.30);
        burst(canvas.width * 0.74, canvas.height * 0.42);

        let frame = 0;
        function loop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(function (p) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.12;
                p.alpha -= 0.013;
                ctx.save();
                ctx.globalAlpha = Math.max(p.alpha, 0);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            for (let i = particles.length - 1; i >= 0; i--) {
                if (particles[i].alpha <= 0) particles.splice(i, 1);
            }

            frame++;
            if (particles.length && frame < 190) {
                requestAnimationFrame(loop);
            } else {
                canvas.remove();
            }
        }
        loop();
    }

    function getQty(item) {
        const qty = Number(item && (item.qty || item.quantity || item.amount || 1));
        return Number.isNaN(qty) || qty < 1 ? 1 : qty;
    }

    function normalizeItem(item) {
        if (!item || typeof item !== "object") return null;

        const priceText = item.price || item.itemPrice || item.productPrice || "";
        const priceNum = Number(item.priceNum || item.priceValue || item.unitPrice) || parseMoney(priceText);
        const img = item.mainImg || item.image || item.img || item.thumbnail || "";

        return {
            key: item.key || item.id || item.productId || "",
            name: item.name || item.productName || item.title || "Sản phẩm",
            price: priceText || (priceNum ? formatMoney(priceNum) : ""),
            priceNum: priceNum,
            mainImg: img,
            size: item.size || item.selectedSize || item.variant || "M",
            qty: getQty(item)
        };
    }

    function getCartMergeKey(item) {
        const normalized = normalizeItem(item);
        if (!normalized) return "";
        return [
            String(normalized.key || "").trim().toLowerCase(),
            String(normalized.name || "").trim().toLowerCase(),
            String(normalized.size || "").trim().toLowerCase(),
            Number(normalized.priceNum || 0),
            String(normalized.mainImg || "").trim()
        ].join("||");
    }

    function mergeDuplicateCartItems(cart) {
        const merged = [];
        const indexByKey = {};

        (Array.isArray(cart) ? cart : []).forEach(function (rawItem) {
            const item = normalizeItem(rawItem);
            if (!item) return;

            const mergeKey = getCartMergeKey(item);
            if (!mergeKey) return;

            if (Object.prototype.hasOwnProperty.call(indexByKey, mergeKey)) {
                const existing = merged[indexByKey[mergeKey]];
                existing.qty = getQty(existing) + getQty(item);
            } else {
                indexByKey[mergeKey] = merged.length;
                merged.push(item);
            }
        });

        return merged;
    }

    function isCartChangedAfterMerge(originalCart, mergedCart) {
        const safeOriginal = (Array.isArray(originalCart) ? originalCart : []).map(normalizeItem).filter(Boolean);
        if (safeOriginal.length !== mergedCart.length) return true;
        try {
            return JSON.stringify(safeOriginal) !== JSON.stringify(mergedCart);
        } catch (error) {
            return true;
        }
    }

    function syncProductDetailCartMemory(cart) {
        const safeCart = mergeDuplicateCartItems(cart);
        window.cartMemoryArray = safeCart;
        if (typeof window.StyleHubSetProductDetailCartMemory === "function") {
            try { window.StyleHubSetProductDetailCartMemory(safeCart); } catch (error) {}
        }
        return safeCart;
    }

    function getCartItemFingerprint(item) {
        const normalized = normalizeItem(item);
        if (!normalized) return "";
        return [
            normalized.key || "",
            normalized.name || "",
            normalized.size || "",
            Number(normalized.priceNum || 0),
            getQty(normalized),
            normalized.mainImg || ""
        ].join("||");
    }

    function writeCartStorageOnly(cart) {
        const safeCart = mergeDuplicateCartItems(Array.isArray(cart) ? cart : []);
        const data = JSON.stringify(safeCart);

        CART_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
            localStorage.setItem(key, data);
        });

        syncProductDetailCartMemory(safeCart);
        return safeCart;
    }

    function readCart() {
        for (const key of CART_KEYS) {
            const rawCart = parseCart(localStorage.getItem(key));
            const cart = rawCart.map(normalizeItem).filter(Boolean);
            if (cart.length > 0) {
                const mergedCart = mergeDuplicateCartItems(cart);
                if (isCartChangedAfterMerge(cart, mergedCart)) {
                    writeCartStorageOnly(mergedCart);
                } else {
                    syncProductDetailCartMemory(mergedCart);
                }
                return mergedCart;
            }
        }
        syncProductDetailCartMemory([]);
        return [];
    }

    function save(cart) {
        const safeCart = writeCartStorageOnly(cart);
        update(safeCart);
        renderBagModal(safeCart);
        return safeCart;
    }

    function clear() {
        writeCartStorageOnly([]);
        update([]);
        renderBagModal([]);
    }

    function update(cartArg) {
        const cart = Array.isArray(cartArg) ? cartArg.map(normalizeItem).filter(Boolean) : readCart();
        const totalQty = cart.reduce(function (sum, item) {
            return sum + getQty(item);
        }, 0);

        document.querySelectorAll("#bag-count, #cart-count, [data-stylehub-cart-count]").forEach(function (el) {
            el.textContent = String(totalQty);
        });

        document.querySelectorAll("a, #bag-trigger, .pd-bag-link").forEach(function (el) {
            const text = (el.textContent || "").trim().toUpperCase();
            if (!text.startsWith("BAG")) return;

            const countEl = el.querySelector("#bag-count, #cart-count, [data-stylehub-cart-count]");
            if (countEl) {
                countEl.textContent = String(totalQty);
            } else {
                el.innerHTML = 'BAG (<span id="cart-count" data-stylehub-cart-count>' + totalQty + '</span>)';
            }
        });
    }

    function injectBagStyles() {
        if (document.getElementById("stylehub-universal-bag-css")) return;

        const style = document.createElement("style");
        style.id = "stylehub-universal-bag-css";
        style.textContent = `
            #bag-modal.stylehub-universal-bag-modal,
            #bag-modal.stylehub-bag-managed {
                position: fixed !important;
                inset: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(0, 0, 0, 0.42) !important;
                z-index: 2147483646 !important;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity .25s ease, visibility .25s ease;
            }

            #bag-modal.stylehub-universal-bag-modal.stylehub-bag-open,
            #bag-modal.stylehub-bag-managed.stylehub-bag-open {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }

            #bag-modal.stylehub-bag-managed .bag-sidebar,
            #bag-modal .stylehub-universal-bag-panel {
                position: fixed !important;
                top: 0 !important;
                right: 0 !important;
                left: auto !important;
                bottom: auto !important;
                width: min(380px, 90vw) !important;
                max-width: min(380px, 90vw) !important;
                height: 100vh !important;
                max-height: 100vh !important;
                background: #ffffff !important;
                color: #111111 !important;
                padding: 30px 26px 24px !important;
                box-shadow: -18px 0 40px rgba(0,0,0,.12) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                transform: none !important;
                box-sizing: border-box !important;
            }

            #bag-modal.stylehub-bag-managed .bag-header,
            #bag-modal .stylehub-universal-bag-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 0 0 16px 0 !important;
                margin: 0 !important;
                border-bottom: 1px solid #eeeeee !important;
                flex-shrink: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal.stylehub-bag-managed .bag-header h3,
            #bag-modal .stylehub-universal-bag-header h3 {
                margin: 0 !important;
                padding: 0 !important;
                font-size: 17px !important;
                line-height: 1 !important;
                letter-spacing: 5.5px !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                color: #111111 !important;
            }

            #bag-modal.stylehub-bag-managed .close-modal,
            #bag-modal .stylehub-universal-bag-close {
                border: 0 !important;
                background: transparent !important;
                color: #111111 !important;
                font-size: 34px !important;
                line-height: 1 !important;
                font-weight: 300 !important;
                cursor: pointer !important;
                padding: 0 0 4px 14px !important;
                margin: 0 !important;
                box-shadow: none !important;
            }

            #bag-modal.stylehub-bag-managed #cart-items-container,
            #bag-modal .stylehub-universal-bag-body {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                padding: 18px 0 18px !important;
                min-height: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-bag-empty,
            #bag-modal .empty-cart-msg {
                color: #777777 !important;
                font-size: 13px !important;
                letter-spacing: 1px !important;
                text-align: center !important;
                margin: 42px 0 !important;
            }

            #bag-modal .stylehub-bag-select-row {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                margin: 0 0 18px 0 !important;
                padding: 0 0 14px 0 !important;
                border-bottom: 1px solid #eeeeee !important;
                background: #ffffff !important;
                color: #111111 !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
                letter-spacing: 1.8px !important;
                text-transform: uppercase !important;
            }

            #bag-modal .stylehub-bag-select-label {
                display: inline-flex !important;
                align-items: center !important;
                gap: 9px !important;
                cursor: pointer !important;
                color: #111111 !important;
                font-weight: 600 !important;
            }

            #bag-modal .stylehub-bag-select-label input,
            #bag-modal .stylehub-bag-select-checkbox {
                width: 15px !important;
                height: 15px !important;
                margin: 0 !important;
                accent-color: #111111 !important;
                cursor: pointer !important;
            }

            #bag-modal .stylehub-bag-selected-count {
                color: #777777 !important;
                font-size: 10px !important;
                font-weight: 500 !important;
                letter-spacing: 1.6px !important;
                white-space: nowrap !important;
            }

            #bag-modal .stylehub-bag-item {
                display: grid !important;
                grid-template-columns: 18px 84px minmax(0, 1fr) auto !important;
                gap: 12px !important;
                padding: 0 0 22px !important;
                margin: 0 0 22px !important;
                border-bottom: 1px solid #f1f1f1 !important;
                align-items: start !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-bag-item img,
            #bag-modal .stylehub-bag-img-placeholder {
                width: 84px !important;
                height: 106px !important;
                object-fit: cover !important;
                background: #f7f7f7 !important;
                display: block !important;
                flex: none !important;
            }

            #bag-modal .stylehub-bag-name {
                margin: 5px 0 10px !important;
                padding: 0 !important;
                font-size: 15px !important;
                line-height: 1.35 !important;
                font-weight: 600 !important;
                color: #111111 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-meta {
                margin: 0 0 10px !important;
                padding: 0 !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                color: #666666 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-price {
                margin: 0 !important;
                padding: 0 !important;
                font-size: 15px !important;
                line-height: 1.35 !important;
                color: #111111 !important;
                font-weight: 600 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
                white-space: nowrap !important;
            }

            #bag-modal .stylehub-bag-remove {
                border: 0 !important;
                background: transparent !important;
                color: #8d8d8d !important;
                cursor: pointer !important;
                font-size: 12px !important;
                line-height: 1.2 !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
                padding: 5px 0 0 10px !important;
                margin: 0 !important;
                min-width: auto !important;
                width: auto !important;
                height: auto !important;
                box-shadow: none !important;
            }

            #bag-modal.stylehub-bag-managed .bag-footer,
            #bag-modal .stylehub-universal-bag-footer {
                flex: 0 0 auto !important;
                background: #ffffff !important;
                color: #111111 !important;
                border-top: 1px solid #eeeeee !important;
                padding: 16px 0 0 0 !important;
                margin: 0 !important;
                position: relative !important;
                z-index: 2 !important;
                box-shadow: none !important;
            }

            #bag-modal.stylehub-bag-managed .total-row,
            #bag-modal .stylehub-bag-total-row {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 20px !important;
                margin: 0 0 20px 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
                opacity: 1 !important;
            }

            #bag-modal #cart-total-price,
            #bag-modal .stylehub-bag-total-amount {
                color: #111111 !important;
                opacity: 1 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
                white-space: nowrap !important;
            }

            #bag-modal .stylehub-bag-discount-form {
                display: grid !important;
                grid-template-columns: 1fr 90px !important;
                gap: 10px !important;
                margin: 0 0 16px 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-bag-discount-input {
                width: 100% !important;
                height: 46px !important;
                border: 1px solid #dddddd !important;
                background: #ffffff !important;
                color: #111111 !important;
                padding: 0 14px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                border-radius: 0 !important;
                outline: none !important;
                box-shadow: none !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                letter-spacing: 2.5px !important;
                text-transform: uppercase !important;
            }

            #bag-modal .stylehub-bag-discount-input::placeholder {
                color: #777777 !important;
                opacity: .8 !important;
            }

            #bag-modal .stylehub-bag-apply-btn {
                width: 100% !important;
                height: 46px !important;
                border: 1px solid #111111 !important;
                background: #080808 !important;
                color: #ffffff !important;
                cursor: pointer !important;
                padding: 0 12px !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                font-size: 12px !important;
                line-height: 44px !important;
                font-weight: 500 !important;
                letter-spacing: 2.8px !important;
                text-align: center !important;
                text-transform: uppercase !important;
            }

            #bag-modal .stylehub-bag-summary {
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                margin: 0 0 14px 0 !important;
                padding: 0 0 14px 0 !important;
                border-bottom: 1px solid #eeeeee !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-bag-summary-row {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 18px !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #333333 !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                font-weight: 400 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-summary-row span:last-child {
                color: #333333 !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-summary-row.stylehub-bag-discount-line span:last-child {
                color: #c00000 !important;
            }

            #bag-modal .stylehub-bag-summary-row.stylehub-summary-multiline {
                align-items: flex-start !important;
            }

            #bag-modal .stylehub-bag-summary-row.stylehub-summary-multiline span:last-child {
                white-space: normal !important;
                text-align: right !important;
                word-break: break-word !important;
                max-width: 62% !important;
            }

            #bag-modal .stylehub-bag-total-row.stylehub-bag-grand-row {
                margin: 0 0 14px 0 !important;
                padding: 0 !important;
                border: 0 !important;
                font-size: 15px !important;
                letter-spacing: 2.5px !important;
            }

            #bag-modal .stylehub-bag-voucher-hint {
                margin: -2px 0 18px 0 !important;
                padding: 0 !important;
                color: #222222 !important;
                font-size: 11px !important;
                line-height: 1.45 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-voucher-message {
                margin: -6px 0 12px 0 !important;
                padding: 0 !important;
                min-height: 16px !important;
                color: #777777 !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-bag-voucher-message.is-error {
                color: #c00000 !important;
            }

            #bag-modal .stylehub-bag-voucher-message.is-success {
                color: #18794e !important;
            }

            #bag-modal.stylehub-bag-managed .checkout-btn,
            #bag-modal .stylehub-universal-checkout {
                display: grid !important;
                place-items: center !important;
                width: 100% !important;
                min-height: 54px !important;
                height: 54px !important;
                padding: 0 16px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                border: 1px solid #111111 !important;
                background: #080808 !important;
                color: #ffffff !important;
                cursor: pointer !important;
                font-size: 13px !important;
                line-height: 1 !important;
                font-weight: 500 !important;
                letter-spacing: 4px !important;
                text-indent: 0 !important;
                text-align: center !important;
                text-transform: uppercase !important;
                vertical-align: middle !important;
                position: static !important;
                opacity: 1 !important;
                box-shadow: none !important;
                appearance: none !important;
                -webkit-appearance: none !important;
            }

            #bag-modal .stylehub-universal-checkout > span {
                display: flex !important;
                width: 100% !important;
                height: 100% !important;
                align-items: center !important;
                justify-content: center !important;
                line-height: 1 !important;
                transform: translate(2px, 1px) !important;
                pointer-events: none !important;
            }

            #bag-modal.stylehub-bag-managed .checkout-btn:disabled,
            #bag-modal .stylehub-universal-checkout:disabled {
                opacity: .45 !important;
                cursor: not-allowed !important;
            }

            body.stylehub-bag-active,
            html.stylehub-bag-active {
                overflow: hidden !important;
            }

            body.stylehub-bag-active .notification-bell,
            body.stylehub-bag-active #stylehubNotificationBell,
            body.stylehub-bag-active .stylehub-notification-root,
            body.stylehub-bag-active [data-stylehub-notification-bell],
            body.stylehub-bag-active .stylehub-bell-btn,
            body.stylehub-bag-active .pd-notification-bell,
            body.stylehub-bag-active .tsh-ai-fab,
            body.stylehub-bag-active #tsh-ai-fab,
            body.stylehub-bag-active .ai-chat-bubble,
            body.stylehub-bag-active #ai-chat-button,
            body.stylehub-bag-active .tsh-ai-toggle,
            body.stylehub-bag-active .tsh-ai-box,
            body.stylehub-bag-active .stylehub-ai-root {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }


            #bag-modal .stylehub-checkout-back {
                border: 0 !important;
                background: transparent !important;
                color: #777777 !important;
                cursor: pointer !important;
                font-size: 11px !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
                padding: 0 !important;
                margin: 0 0 18px 0 !important;
                text-align: left !important;
                box-shadow: none !important;
            }

            #bag-modal .stylehub-checkout-products {
                display: flex !important;
                flex-direction: column !important;
                gap: 14px !important;
                margin: 0 0 22px 0 !important;
                padding: 0 0 16px 0 !important;
                border-bottom: 1px solid #eeeeee !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-checkout-product {
                display: grid !important;
                grid-template-columns: 62px minmax(0, 1fr) auto !important;
                gap: 12px !important;
                align-items: center !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-checkout-product img,
            #bag-modal .stylehub-checkout-product-placeholder {
                width: 62px !important;
                height: 78px !important;
                object-fit: cover !important;
                background: #f7f7f7 !important;
            }

            #bag-modal .stylehub-checkout-product-name {
                margin: 0 0 6px 0 !important;
                color: #111111 !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
                font-weight: 600 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-checkout-product-meta {
                margin: 0 !important;
                color: #666666 !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-checkout-product-price {
                margin: 0 !important;
                color: #111111 !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-checkout-form {
                display: flex !important;
                flex-direction: column !important;
                gap: 14px !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-checkout-field label {
                display: block !important;
                margin: 0 0 7px 0 !important;
                color: #222222 !important;
                font-size: 10px !important;
                font-weight: 600 !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
            }

            #bag-modal .stylehub-checkout-field input,
            #bag-modal .stylehub-checkout-field textarea {
                width: 100% !important;
                border: 1px solid #dddddd !important;
                background: #ffffff !important;
                color: #111111 !important;
                padding: 12px 13px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                border-radius: 0 !important;
                outline: none !important;
                box-shadow: none !important;
                font-family: inherit !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-checkout-field textarea {
                min-height: 84px !important;
                resize: vertical !important;
            }

            #bag-modal .stylehub-checkout-message {
                min-height: 18px !important;
                margin: 2px 0 0 0 !important;
                color: #c00000 !important;
                font-size: 11px !important;
                line-height: 1.35 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }

            #bag-modal .stylehub-checkout-success-note {
                margin: 0 0 14px 0 !important;
                color: #18794e !important;
                font-size: 12px !important;
                line-height: 1.45 !important;
                letter-spacing: 0 !important;
                text-transform: none !important;
            }



            #bag-modal .stylehub-universal-checkout-panel {
                width: min(380px, 90vw) !important;
                max-width: min(380px, 90vw) !important;
                padding: 28px 26px 24px !important;
                z-index: 2147483647 !important;
            }

            #bag-modal .stylehub-universal-checkout-panel .stylehub-universal-bag-header h3 {
                font-size: 14px !important;
                letter-spacing: 2.8px !important;
                line-height: 1.25 !important;
            }

            #bag-modal .stylehub-universal-checkout-body {
                padding-top: 16px !important;
            }

            @media (max-width: 640px) {
                #bag-modal.stylehub-bag-managed .bag-sidebar,
                #bag-modal .stylehub-universal-bag-panel {
                    width: min(360px, 94vw) !important;
                    max-width: min(360px, 94vw) !important;
                    padding: 26px 20px 22px !important;
                }

                #bag-modal.stylehub-bag-managed .bag-header h3,
                #bag-modal .stylehub-universal-bag-header h3 {
                    font-size: 16px !important;
                    letter-spacing: 5px !important;
                }

                #bag-modal .stylehub-bag-item {
                    grid-template-columns: 18px 86px 1fr auto !important;
                    gap: 10px !important;
                }

                #bag-modal .stylehub-bag-item img,
                #bag-modal .stylehub-bag-img-placeholder {
                    width: 86px !important;
                    height: 112px !important;
                }

                #bag-modal .stylehub-bag-discount-form {
                    grid-template-columns: 1fr 86px !important;
                    gap: 8px !important;
                }

                #bag-modal .stylehub-bag-discount-input,
                #bag-modal .stylehub-bag-apply-btn {
                    height: 44px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureBagModal() {
        injectBagStyles();

        let modal = document.getElementById("bag-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "bag-modal";
            document.body.appendChild(modal);
        }

        modal.className = "modal-overlay stylehub-universal-bag-modal stylehub-bag-managed";
        modal.style.display = modal.classList.contains("stylehub-bag-open") ? "block" : "none";

        const managedVersion = modal.getAttribute("data-stylehub-bag-managed-version");
        if (managedVersion !== "10" || !modal.querySelector("#cart-items-container")) {
            modal.innerHTML = `
                <aside class="stylehub-universal-bag-panel bag-sidebar" role="dialog" aria-modal="true" aria-label="Shopping Bag">
                    <div class="stylehub-universal-bag-header bag-header">
                        <h3>Shopping Bag</h3>
                        <button type="button" class="stylehub-universal-bag-close close-modal" aria-label="Close bag">×</button>
                    </div>
                    <div id="cart-items-container" class="stylehub-universal-bag-body"></div>
                    <div class="stylehub-universal-bag-footer bag-footer">
                        <div class="stylehub-bag-discount-form">
                            <input type="text" id="stylehubBagVoucherInput" class="stylehub-bag-discount-input" placeholder="ENTER DISCOUNT CODE" autocomplete="off">
                            <button type="button" id="stylehubBagVoucherApply" class="stylehub-bag-apply-btn">Apply</button>
                        </div>
                        <p id="stylehubBagVoucherMessage" class="stylehub-bag-voucher-message"></p>
                        <div class="stylehub-bag-summary">
                            <div class="stylehub-bag-summary-row"><span>Tạm tính</span><span id="cart-subtotal-price">0 ₫</span></div>
                            <div class="stylehub-bag-summary-row"><span>Phí ship</span><span id="cart-shipping-price">0 ₫</span></div>
                            <div class="stylehub-bag-summary-row stylehub-bag-discount-line"><span>Giảm giá</span><span id="cart-discount-price">-0 ₫</span></div>
                        </div>
                        <div class="stylehub-bag-total-row stylehub-bag-grand-row total-row">
                            <span>Tổng cộng</span>
                            <span id="cart-total-price" class="stylehub-bag-total-amount">0 ₫</span>
                        </div>
                        <p class="stylehub-bag-voucher-hint">Gợi ý: STYLE10 giảm 10%, FREESHIP miễn phí ship.</p>
                        <button type="button" class="stylehub-universal-checkout checkout-btn">Checkout</button>
                    </div>
                </aside>
            `;
            modal.setAttribute("data-stylehub-bag-managed-version", "10");
        }

        return modal;
    }

    function getActiveVoucherCode() {
        return String(localStorage.getItem("stylehub_active_voucher") || "").trim().toUpperCase();
    }

    function calculateBagTotals(subtotal) {
        const code = getActiveVoucherCode();
        const shipping = subtotal > 0 ? 30000 : 0;
        let discount = 0;

        if (code === "STYLE10") discount = Math.round(subtotal * 0.1);
        // FREESHIP vẫn hiển thị phí ship gốc ở dòng "Phí ship",
        // sau đó trừ đúng số tiền ship ở dòng "Giảm giá" để khách dễ hiểu.
        if (code === "FREESHIP") discount = shipping;

        return {
            subtotal: subtotal,
            shipping: shipping,
            discount: discount,
            total: Math.max(0, subtotal + shipping - discount),
            code: code
        };
    }

    function updateProductDetailTotalsIfAvailable(subtotal) {
        if (typeof window.updateStyleHubBagTotalsUI === "function") {
            try { window.updateStyleHubBagTotalsUI(subtotal); } catch (error) {}
        }
        if (typeof window.StyleHubRenderCheckoutTotals === "function") {
            try { setTimeout(window.StyleHubRenderCheckoutTotals, 80); } catch (error) {}
        }
    }

    function getBagSelectionHash(cart) {
        return (Array.isArray(cart) ? cart : []).map(function (item, index) {
            const normalized = normalizeItem(item) || {};
            return [
                index,
                normalized.key || "",
                normalized.name || "",
                normalized.size || "",
                normalized.qty || 1,
                normalized.priceNum || 0,
                normalized.mainImg || ""
            ].join("::");
        }).join("||");
    }

    function setSelectedIndexes(selectedIndexes, cart) {
        const safeCart = Array.isArray(cart) ? cart : readCart();
        const selectedSet = new Set((Array.isArray(selectedIndexes) ? selectedIndexes : [])
            .map(function (index) { return Number(index); })
            .filter(function (index) { return Number.isInteger(index) && index >= 0 && index < safeCart.length; }));

        localStorage.setItem(BAG_SELECTION_KEY, JSON.stringify({
            hash: getBagSelectionHash(safeCart),
            selected: Array.from(selectedSet)
        }));
    }

    function resetSelectedIndexes(cart) {
        const safeCart = Array.isArray(cart) ? cart : readCart();
        const allIndexes = safeCart.map(function (_, index) { return index; });
        setSelectedIndexes(allIndexes, safeCart);
        return allIndexes;
    }

    function getSelectedIndexes(cart) {
        const safeCart = Array.isArray(cart) ? cart : readCart();
        if (!safeCart.length) {
            localStorage.removeItem(BAG_SELECTION_KEY);
            return [];
        }

        let stored = null;
        try {
            stored = JSON.parse(localStorage.getItem(BAG_SELECTION_KEY) || "null");
        } catch (error) {
            stored = null;
        }

        if (!stored || stored.hash !== getBagSelectionHash(safeCart) || !Array.isArray(stored.selected)) {
            return resetSelectedIndexes(safeCart);
        }

        const selected = stored.selected
            .map(function (index) { return Number(index); })
            .filter(function (index, position, arr) {
                return Number.isInteger(index) && index >= 0 && index < safeCart.length && arr.indexOf(index) === position;
            });

        setSelectedIndexes(selected, safeCart);
        return selected;
    }

    function getSelectedCart(cart) {
        const safeCart = Array.isArray(cart) ? cart : readCart();
        const selectedIndexes = getSelectedIndexes(safeCart);
        return selectedIndexes.map(function (index) { return safeCart[index]; }).filter(Boolean);
    }

    function renderBagModal(cartArg) {
        const modal = document.getElementById("bag-modal");
        if (!modal) return;

        const cart = Array.isArray(cartArg) ? cartArg.map(normalizeItem).filter(Boolean) : readCart();
        const container = modal.querySelector("#cart-items-container");
        const subtotalEl = modal.querySelector("#cart-subtotal-price");
        const shippingEl = modal.querySelector("#cart-shipping-price");
        const discountEl = modal.querySelector("#cart-discount-price");
        const totalEl = modal.querySelector("#cart-total-price");
        const voucherInput = modal.querySelector("#stylehubBagVoucherInput");
        const voucherMessage = modal.querySelector("#stylehubBagVoucherMessage");
        const checkoutBtn = modal.querySelector(".checkout-btn, .stylehub-universal-checkout");
        if (!container) return;

        let subtotal = 0;
        const selectedIndexes = getSelectedIndexes(cart);
        const selectedSet = new Set(selectedIndexes);

        if (voucherInput && document.activeElement !== voucherInput) {
            voucherInput.value = getActiveVoucherCode();
        }

        if (!cart.length) {
            const emptyTotals = calculateBagTotals(0);
            container.innerHTML = '<p class="stylehub-bag-empty empty-cart-msg">Your bag is empty.</p>';
            if (subtotalEl) subtotalEl.textContent = formatMoney(emptyTotals.subtotal);
            if (shippingEl) shippingEl.textContent = formatMoney(emptyTotals.shipping);
            if (discountEl) discountEl.textContent = "-" + formatMoney(emptyTotals.discount);
            if (totalEl) totalEl.textContent = formatMoney(emptyTotals.total);
            if (voucherMessage) {
                voucherMessage.textContent = "";
                voucherMessage.className = "stylehub-bag-voucher-message";
            }
            if (checkoutBtn) checkoutBtn.disabled = true;
            updateProductDetailTotalsIfAvailable(0);
            return;
        }

        const itemsHtml = cart.map(function (item, index) {
            const qty = getQty(item);
            const price = Number(item.priceNum) || parseMoney(item.price);
            if (selectedSet.has(index)) subtotal += price * qty;

            const imgHtml = item.mainImg
                ? '<img src="' + escapeHTML(item.mainImg) + '" alt="' + escapeHTML(item.name) + '">'
                : '<div class="stylehub-bag-img-placeholder"></div>';
            const displayPrice = price ? formatMoney(price) : (item.price || '0 ₫');
            const checkedAttr = selectedSet.has(index) ? ' checked' : '';

            return `
                <div class="stylehub-bag-item">
                    <input type="checkbox" class="stylehub-bag-select-checkbox" data-stylehub-select-index="${index}" aria-label="Chọn ${escapeHTML(item.name)} để thanh toán"${checkedAttr}>
                    ${imgHtml}
                    <div>
                        <p class="stylehub-bag-name">${escapeHTML(item.name)}</p>
                        <p class="stylehub-bag-meta">Size: ${escapeHTML(item.size)} / SL: ${qty}</p>
                        <p class="stylehub-bag-price">${escapeHTML(displayPrice)}</p>
                    </div>
                    <button type="button" class="stylehub-bag-remove" data-stylehub-remove-index="${index}">Xóa</button>
                </div>
            `;
        }).join("\n");

        container.innerHTML = `
            <div class="stylehub-bag-select-row">
                <label class="stylehub-bag-select-label">
                    <input type="checkbox" id="stylehubBagSelectAll"${selectedIndexes.length === cart.length ? ' checked' : ''}>
                    <span>Chọn tất cả</span>
                </label>
                <span class="stylehub-bag-selected-count">${selectedIndexes.length}/${cart.length} sản phẩm</span>
            </div>
            ${itemsHtml}
        `;

        const totals = calculateBagTotals(subtotal);
        if (subtotalEl) subtotalEl.textContent = formatMoney(totals.subtotal);
        if (shippingEl) shippingEl.textContent = formatMoney(totals.shipping);
        if (discountEl) discountEl.textContent = "-" + formatMoney(totals.discount);
        if (totalEl) totalEl.textContent = formatMoney(totals.total);
        if (voucherMessage && !voucherMessage.textContent) {
            voucherMessage.className = "stylehub-bag-voucher-message";
        }
        if (checkoutBtn) checkoutBtn.disabled = selectedIndexes.length === 0;
        updateProductDetailTotalsIfAvailable(subtotal);
    }

    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function forceBagStayOpen(scrollTop) {
        const modal = document.getElementById("bag-modal");
        if (!modal) return;

        modal.style.display = "block";
        modal.classList.add("stylehub-bag-open");
        document.body.classList.add("stylehub-bag-active");
        document.documentElement.classList.add("stylehub-bag-active");

        const body = modal.querySelector("#cart-items-container, .stylehub-universal-bag-body");
        if (body && Number.isFinite(scrollTop)) {
            requestAnimationFrame(function () {
                body.scrollTop = scrollTop;
            });
        }
    }

    function applyBagVoucher() {
        const modal = ensureBagModal();
        const body = modal.querySelector("#cart-items-container, .stylehub-universal-bag-body");
        const keepScrollTop = body ? body.scrollTop : 0;
        const input = modal.querySelector("#stylehubBagVoucherInput");
        const message = modal.querySelector("#stylehubBagVoucherMessage");
        const code = String(input && input.value || "").trim().toUpperCase();
        const validCodes = ["STYLE10", "FREESHIP"];

        if (!code) {
            localStorage.removeItem("stylehub_active_voucher");
            renderBagModal();
            if (message) {
                message.textContent = "Đã bỏ mã giảm giá.";
                message.className = "stylehub-bag-voucher-message";
            }
            forceBagStayOpen(keepScrollTop);
            return;
        }

        if (!validCodes.includes(code)) {
            if (message) {
                message.textContent = "Mã không hợp lệ. Hãy thử STYLE10 hoặc FREESHIP.";
                message.className = "stylehub-bag-voucher-message is-error";
            }
            if (input) input.value = code;
            forceBagStayOpen(keepScrollTop);
            return;
        }

        localStorage.setItem("stylehub_active_voucher", code);
        renderBagModal();

        const refreshedInput = modal.querySelector("#stylehubBagVoucherInput");
        const refreshedMessage = modal.querySelector("#stylehubBagVoucherMessage");
        if (refreshedInput) refreshedInput.value = code;
        if (refreshedMessage) {
            refreshedMessage.textContent = code === "STYLE10" ? "Đã áp dụng STYLE10: giảm 10%." : "Đã áp dụng FREESHIP: miễn phí ship.";
            refreshedMessage.className = "stylehub-bag-voucher-message is-success";
        }
        forceBagStayOpen(keepScrollTop);
    }

    function openBag() {
        const modal = ensureBagModal();
        renderBagModal();
        update();

        if (typeof window.closeSearchModal === "function") { try { window.closeSearchModal(); } catch (error) {} }
        if (typeof window.closeAccountModal === "function") { try { window.closeAccountModal(); } catch (error) {} }

        modal.style.display = "block";
        requestAnimationFrame(function () {
            modal.classList.add("stylehub-bag-open");
            document.body.classList.add("stylehub-bag-active");
            document.documentElement.classList.add("stylehub-bag-active");
        });
    }

    function closeBag() {
        const modal = document.getElementById("bag-modal");
        if (!modal) return;

        modal.classList.remove("stylehub-bag-open");
        document.body.classList.remove("stylehub-bag-active");
        document.documentElement.classList.remove("stylehub-bag-active");
        setTimeout(function () {
            if (!modal.classList.contains("stylehub-bag-open")) {
                modal.style.display = "none";
            }
        }, 260);
    }

    function hardCloseBag() {
        const modal = document.getElementById("bag-modal");
        if (!modal) return;

        modal.classList.remove("stylehub-bag-open");
        modal.style.display = "none";
        document.body.classList.remove("stylehub-bag-active");
        document.documentElement.classList.remove("stylehub-bag-active");
    }

    function isBagTrigger(node) {
        if (!node) return false;
        if (node.matches && node.matches("#bag-trigger, .pd-bag-link")) return true;
        const text = (node.textContent || "").trim().toUpperCase();
        return node.tagName && node.tagName.toLowerCase() === "a" && text.startsWith("BAG");
    }

    function getStyleHubAccountEmailForCheckout(fallbackEmail) {
        return String(
            localStorage.getItem("hub_current_user_key") ||
            localStorage.getItem("hub_email") ||
            fallbackEmail ||
            ""
        ).trim().toLowerCase();
    }

    function getStyleHubShippingProfileForCheckout(email) {
        const accountEmail = getStyleHubAccountEmailForCheckout(email);
        if (!accountEmail) return {};
        try {
            const profile = JSON.parse(localStorage.getItem("stylehub_shipping_profile_" + accountEmail) || "{}");
            return profile && typeof profile === "object" ? profile : {};
        } catch (error) {
            return {};
        }
    }

    function saveStyleHubShippingProfileForCheckout(profileData) {
        const email = getStyleHubAccountEmailForCheckout(profileData && profileData.email);
        if (!email) return;

        const oldProfile = getStyleHubShippingProfileForCheckout(email);
        const nextProfile = Object.assign({}, oldProfile, profileData || {}, {
            accountEmail: email,
            updatedAt: Date.now()
        });

        localStorage.setItem("stylehub_shipping_profile_" + email, JSON.stringify(nextProfile));
        localStorage.setItem("stylehub_last_shipping_profile_key", "stylehub_shipping_profile_" + email);
        if (nextProfile.name) localStorage.setItem("hub_name", nextProfile.name);
        if (nextProfile.email) localStorage.setItem("hub_email", nextProfile.email);
    }

    function getCheckoutPrefillInfo() {
        const accountEmail = getStyleHubAccountEmailForCheckout();
        const profile = getStyleHubShippingProfileForCheckout(accountEmail);
        return {
            name: profile.name || localStorage.getItem("hub_name") || "",
            phone: profile.phone || "",
            email: profile.email || accountEmail || "",
            address: profile.address || ""
        };
    }

    function calculateCartSubtotal(cart) {
        return (Array.isArray(cart) ? cart : []).reduce(function (sum, item) {
            const normalized = normalizeItem(item);
            if (!normalized) return sum;
            const qty = getQty(normalized);
            const price = Number(normalized.priceNum) || parseMoney(normalized.price);
            return sum + price * qty;
        }, 0);
    }

    function renderCheckoutPanel() {
        const modal = ensureBagModal();
        const fullCart = readCart();
        const selectedIndexesForCheckout = getSelectedIndexes(fullCart);
        const cart = selectedIndexesForCheckout.map(function (index) { return fullCart[index]; }).filter(Boolean);
        stylehubCheckoutSelectedIndexesSnapshot = selectedIndexesForCheckout.slice();
        stylehubCheckoutSelectedFingerprintsSnapshot = cart.map(getCartItemFingerprint);
        if (!cart.length) {
            openBag();
            const message = modal.querySelector("#stylehubBagVoucherMessage");
            if (message) {
                message.textContent = "Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.";
                message.className = "stylehub-bag-voucher-message is-error";
            }
            return;
        }
        const prefill = getCheckoutPrefillInfo();
        const subtotal = calculateCartSubtotal(cart);
        const totals = calculateBagTotals(subtotal);

        const productsHtml = cart.map(function (item) {
            const qty = getQty(item);
            const price = Number(item.priceNum) || parseMoney(item.price);
            const lineTotal = price * qty;
            const imgHtml = item.mainImg
                ? '<img src="' + escapeHTML(item.mainImg) + '" alt="' + escapeHTML(item.name) + '">'
                : '<div class="stylehub-checkout-product-placeholder"></div>';

            return `
                <div class="stylehub-checkout-product">
                    ${imgHtml}
                    <div>
                        <p class="stylehub-checkout-product-name">${escapeHTML(item.name)}</p>
                        <p class="stylehub-checkout-product-meta">Size: ${escapeHTML(item.size)} / SL: ${qty}</p>
                    </div>
                    <p class="stylehub-checkout-product-price">${formatMoney(lineTotal)}</p>
                </div>
            `;
        }).join("\n");

        modal.innerHTML = `
            <aside class="stylehub-universal-bag-panel stylehub-universal-checkout-panel bag-sidebar" role="dialog" aria-modal="true" aria-label="Shipping Information">
                <div class="stylehub-universal-bag-header bag-header">
                    <h3>Shipping Information</h3>
                    <button type="button" class="stylehub-universal-bag-close close-modal" aria-label="Close checkout">×</button>
                </div>
                <div class="stylehub-universal-bag-body stylehub-universal-checkout-body">
                    <button type="button" class="stylehub-checkout-back">← Quay lại Bag</button>
                    <div class="stylehub-checkout-products">${productsHtml}</div>
                    <form id="stylehubUniversalCheckoutForm" class="stylehub-checkout-form">
                        <div class="stylehub-checkout-field">
                            <label for="stylehubCheckoutName">Họ và tên người nhận</label>
                            <input id="stylehubCheckoutName" type="text" value="${escapeHTML(prefill.name)}" placeholder="Nhập họ tên" required>
                        </div>
                        <div class="stylehub-checkout-field">
                            <label for="stylehubCheckoutPhone">Số điện thoại</label>
                            <input id="stylehubCheckoutPhone" type="tel" value="${escapeHTML(prefill.phone)}" placeholder="Nhập số điện thoại" required>
                        </div>
                        <div class="stylehub-checkout-field">
                            <label for="stylehubCheckoutAddress">Địa chỉ nhận hàng</label>
                            <textarea id="stylehubCheckoutAddress" placeholder="Nhập địa chỉ nhận hàng đầy đủ" required>${escapeHTML(prefill.address)}</textarea>
                        </div>
                        <div class="stylehub-checkout-field">
                            <label for="stylehubCheckoutEmail">Email</label>
                            <input id="stylehubCheckoutEmail" type="email" value="${escapeHTML(prefill.email)}" placeholder="Ví dụ: abc@gmail.com" required>
                        </div>
                        <p id="stylehubCheckoutMessage" class="stylehub-checkout-message"></p>
                    </form>
                </div>
                <div class="stylehub-universal-bag-footer bag-footer">
                    <div class="stylehub-bag-summary">
                        <div class="stylehub-bag-summary-row"><span>Tạm tính</span><span>${formatMoney(totals.subtotal)}</span></div>
                        <div class="stylehub-bag-summary-row"><span>Phí ship</span><span>${formatMoney(totals.shipping)}</span></div>
                        <div class="stylehub-bag-summary-row stylehub-bag-discount-line"><span>Giảm giá</span><span>-${formatMoney(totals.discount)}</span></div>
                    </div>
                    <div class="stylehub-bag-total-row stylehub-bag-grand-row total-row">
                        <span>Tổng cộng</span>
                        <span class="stylehub-bag-total-amount">${formatMoney(totals.total)}</span>
                    </div>
                    <button type="button" class="stylehub-universal-checkout stylehub-checkout-submit">Xác nhận đặt hàng</button>
                </div>
            </aside>
        `;
        modal.setAttribute("data-stylehub-bag-managed-version", "checkout-v1");
        modal.style.display = "block";
        requestAnimationFrame(function () {
            modal.classList.add("stylehub-bag-open");
            document.body.classList.add("stylehub-bag-active");
            document.documentElement.classList.add("stylehub-bag-active");
        });
    }

    function goToCheckout() {
        const cart = readCart();
        if (!cart.length) return;
        if (!getSelectedCart(cart).length) {
            const modal = ensureBagModal();
            renderBagModal(cart);
            const message = modal.querySelector("#stylehubBagVoucherMessage");
            if (message) {
                message.textContent = "Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.";
                message.className = "stylehub-bag-voucher-message is-error";
            }
            forceBagStayOpen();
            return;
        }
        renderCheckoutPanel();
    }

    function showUniversalCheckoutMessage(text, isSuccess) {
        const message = document.getElementById("stylehubCheckoutMessage");
        if (message) {
            message.textContent = text || "";
            message.style.color = isSuccess ? "#18794e" : "#c00000";
        }

        if (!message && typeof window.showToastNotification === "function") {
            try { window.showToastNotification(text); } catch (error) {}
        } else if (!message && text) {
            alert(text);
        }
    }


    /* ==================== EMAILJS FOR UNIVERSAL BAG CHECKOUT ==================== */
    const STYLEHUB_UNIVERSAL_EMAILJS_PUBLIC_KEY = window.STYLEHUB_EMAILJS_PUBLIC_KEY || "MB1m-Q2_ueI82N8Xo";
    const STYLEHUB_UNIVERSAL_EMAILJS_SERVICE_ID = window.STYLEHUB_EMAILJS_SERVICE_ID || "service_xjsmniq";
    const STYLEHUB_UNIVERSAL_EMAILJS_TEMPLATE_IDS = Array.from(new Set([
        window.STYLEHUB_EMAILJS_TEMPLATE_ID || "template_f4bnal4",
        ...(Array.isArray(window.STYLEHUB_EMAILJS_FALLBACK_TEMPLATE_IDS) ? window.STYLEHUB_EMAILJS_FALLBACK_TEMPLATE_IDS : []),
        "template_1v0d3yr"
    ].filter(Boolean)));

    window.STYLEHUB_EMAILJS_PUBLIC_KEY = STYLEHUB_UNIVERSAL_EMAILJS_PUBLIC_KEY;
    window.STYLEHUB_EMAILJS_SERVICE_ID = STYLEHUB_UNIVERSAL_EMAILJS_SERVICE_ID;
    window.STYLEHUB_EMAILJS_TEMPLATE_ID = window.STYLEHUB_EMAILJS_TEMPLATE_ID || STYLEHUB_UNIVERSAL_EMAILJS_TEMPLATE_IDS[0];
    window.STYLEHUB_EMAILJS_FALLBACK_TEMPLATE_IDS = window.STYLEHUB_EMAILJS_FALLBACK_TEMPLATE_IDS || STYLEHUB_UNIVERSAL_EMAILJS_TEMPLATE_IDS.slice(1);

    function loadStyleHubEmailJSSDK(timeoutMs) {
        timeoutMs = timeoutMs || 7000;
        return new Promise(function(resolve, reject) {
            const startedAt = Date.now();

            function finishIfReady() {
                if (window.emailjs && typeof window.emailjs.send === "function") {
                    if (typeof window.emailjs.init === "function") {
                        window.emailjs.init(STYLEHUB_UNIVERSAL_EMAILJS_PUBLIC_KEY);
                    }
                    resolve();
                    return true;
                }
                return false;
            }

            if (finishIfReady()) return;

            let sdkScript = document.querySelector('script[data-stylehub-emailjs-sdk="1"], script[src*="@emailjs/browser"]');
            if (!sdkScript) {
                sdkScript = document.createElement("script");
                sdkScript.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
                sdkScript.async = true;
                sdkScript.setAttribute("data-stylehub-emailjs-sdk", "1");
                document.head.appendChild(sdkScript);
            }

            sdkScript.addEventListener("load", function() { finishIfReady(); }, { once: true });
            sdkScript.addEventListener("error", function() {
                reject(new Error("EmailJS SDK không tải được. Kiểm tra mạng hoặc CDN @emailjs/browser."));
            }, { once: true });

            (function poll() {
                if (finishIfReady()) return;
                if (Date.now() - startedAt > timeoutMs) {
                    reject(new Error("EmailJS SDK chưa sẵn sàng sau " + timeoutMs + "ms."));
                    return;
                }
                setTimeout(poll, 120);
            })();
        });
    }

    function normalizeStyleHubUniversalEmail(value) {
        return String(value || "").trim().toLowerCase();
    }

    function isValidStyleHubUniversalEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeStyleHubUniversalEmail(value));
    }

    function buildStyleHubUniversalProductDetails(order) {
        const items = Array.isArray(order && order.orderedProductsList) ? order.orderedProductsList : [];
        if (!items.length) return "Không có sản phẩm";

        return items.map(function(item, index) {
            const normalized = normalizeItem(item) || {};
            const name = normalized.name || "Sản phẩm";
            const size = normalized.size || "N/A";
            const qty = getQty(normalized);
            const price = normalized.price || (normalized.priceNum ? formatMoney(normalized.priceNum) : "");
            return (index + 1) + ". " + name + " (Size: " + size + ") x " + qty + " - Giá: " + price;
        }).join("\n");
    }

    async function sendStyleHubUniversalOrderEmail(order) {
        // Khi đang ở product-detail.html, ưu tiên dùng hàm gửi mail chính của trang.
        if (typeof window.sendStyleHubOrderEmail === "function") {
            return window.sendStyleHubOrderEmail(order);
        }

        await loadStyleHubEmailJSSDK();

        const userInfo = order.userInfo || {};
        const toEmail = normalizeStyleHubUniversalEmail(
            order.shippingEmail ||
            userInfo.email ||
            order.customerEmail ||
            order.userEmail ||
            localStorage.getItem("hub_shipping_email") ||
            localStorage.getItem("hub_email") ||
            ""
        );

        if (!isValidStyleHubUniversalEmail(toEmail)) {
            throw new Error("Email người nhận không hợp lệ hoặc đang bị trống: " + (toEmail || "N/A"));
        }

        const customerName = userInfo.name || localStorage.getItem("hub_name") || "Khách hàng";
        const orderId = order.orderId || order.clientOrderUid || "";
        const orderDate = order.orderDate || order.date || new Date().toLocaleString("vi-VN");
        const customerPhone = userInfo.phone || localStorage.getItem("hub_phone") || "";
        const customerAddress = userInfo.address || order.shippingAddress || localStorage.getItem("hub_address") || "";
        const productDetails = buildStyleHubUniversalProductDetails(order);
        const totalPrice = order.totalPriceFormatted || formatMoney(calculateCartSubtotal(order.orderedProductsList || []));

        const templateParams = {
            to_email: toEmail,
            customer_name: customerName,
            orderId: orderId,
            order_date: orderDate,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            product_details: productDetails,
            total_price: totalPrice,
            subtotal_price: order.subtotalFormatted || "",
            shipping_fee: order.shippingFeeFormatted || "",
            discount_price: order.discountFormatted || "",
            voucher_code: order.voucherCode || "",

            // Biến dự phòng cho template cũ/mới
            email: toEmail,
            user_email: toEmail,
            reply_to: toEmail,
            to_name: customerName,
            from_name: "The Style Hub",
            order_id: orderId,
            order_number: orderId,
            phone: customerPhone,
            address: customerAddress,
            message: productDetails,
            total: totalPrice
        };

        let lastError = null;
        for (const templateId of STYLEHUB_UNIVERSAL_EMAILJS_TEMPLATE_IDS) {
            try {
                console.log("Universal BAG đang gửi EmailJS:", templateId, templateParams);
                return await window.emailjs.send(
                    STYLEHUB_UNIVERSAL_EMAILJS_SERVICE_ID,
                    templateId,
                    templateParams,
                    STYLEHUB_UNIVERSAL_EMAILJS_PUBLIC_KEY
                );
            } catch (error) {
                lastError = error;
                console.error("Universal BAG gửi EmailJS thất bại với template " + templateId + ":", error);
            }
        }

        throw lastError || new Error("Universal BAG gửi EmailJS thất bại.");
    }

    window.sendStyleHubUniversalOrderEmail = sendStyleHubUniversalOrderEmail;


    const STYLEHUB_INVENTORY_KEY = "stylehub_inventory_v1";
    const STYLEHUB_STOCK_DEDUCTED_ORDERS_KEY = "stylehub_stock_deducted_orders_v1";

    function readStyleHubJsonObject(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "{}");
            return data && typeof data === "object" && !Array.isArray(data) ? data : {};
        } catch (error) {
            return {};
        }
    }

    function saveStyleHubJsonObject(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (error) {}
    }

    function getStyleHubOrderItemsForStock(order) {
        const items = (order && (order.orderedProductsList || order.items || order.products || order.cart || order.cartItems)) || [];
        return Array.isArray(items) ? items : [];
    }

    function getStyleHubItemProductId(item) {
        const direct = String(item && (item.key || item.productId || item.id || item.sku || item.productKey) || "").trim();
        if (direct) return direct;
        const name = String(item && (item.name || item.productName || item.title) || "").trim().toLowerCase();
        if (!name) return "";
        try {
            if (typeof database !== "undefined" && database) {
                const found = Object.keys(database).find(function(id) {
                    return String(database[id] && database[id].name || "").trim().toLowerCase() === name;
                });
                if (found) return found;
            }
        } catch (error) {}
        return "";
    }

    function deductStyleHubStockFallback(order) {
        const orderId = String(order && (order.orderId || order.id || order.clientOrderUid) || "").trim();
        if (!orderId) return;
        const status = String(order && (order.status || order.orderStatus) || "").toLowerCase();
        if (status.includes("hủy") || status.includes("huỷ") || status.includes("cancel")) return;

        const ledger = readStyleHubJsonObject(STYLEHUB_STOCK_DEDUCTED_ORDERS_KEY);
        if (ledger[orderId] && !ledger[orderId].restored) return;

        const grouped = {};
        getStyleHubOrderItemsForStock(order).forEach(function(item) {
            const productId = getStyleHubItemProductId(item);
            if (!productId) return;
            const qty = Math.max(1, Number(item.qty || item.quantity || item.count || 1) || 1);
            grouped[productId] = (grouped[productId] || 0) + qty;
        });

        const ids = Object.keys(grouped);
        if (!ids.length) return;

        const inventory = readStyleHubJsonObject(STYLEHUB_INVENTORY_KEY);
        const appliedItems = [];
        ids.forEach(function(productId) {
            const currentRecord = inventory[productId] || {};
            const product = (typeof database !== "undefined" && database && database[productId]) ? database[productId] : {};
            const currentStock = Math.max(0, Number(
                currentRecord.stock !== undefined ? currentRecord.stock :
                product.stock !== undefined ? product.stock : 20
            ) || 0);
            const qty = grouped[productId];
            const nextStock = Math.max(0, currentStock - qty);
            inventory[productId] = Object.assign({}, currentRecord, {
                stock: nextStock,
                outOfStock: nextStock <= 0,
                updatedAt: Date.now(),
                lastOrderId: orderId
            });
            appliedItems.push({ key: productId, qty: qty });
        });

        ledger[orderId] = {
            orderId: orderId,
            createdAt: Number(order && order.createdAt) || Date.now(),
            deductedAt: Date.now(),
            restored: false,
            items: appliedItems
        };
        saveStyleHubJsonObject(STYLEHUB_INVENTORY_KEY, inventory);
        saveStyleHubJsonObject(STYLEHUB_STOCK_DEDUCTED_ORDERS_KEY, ledger);
        try {
            localStorage.setItem("stylehub_inventory_updated_at", String(Date.now()));
            window.dispatchEvent(new CustomEvent("stylehub-inventory-change"));
        } catch (error) {}
    }

    function saveLocalUniversalOrder(order) {
        const email = String(order.userEmail || order.customerEmail || order.shippingEmail || "guest").trim().toLowerCase() || "guest";
        const key = email === "guest" ? "hub_orders_guest" : "hub_orders_" + email;
        let orders = [];
        try {
            orders = JSON.parse(localStorage.getItem(key) || "[]");
            if (!Array.isArray(orders)) orders = [];
        } catch (error) {
            orders = [];
        }
        orders.unshift(order);
        localStorage.setItem(key, JSON.stringify(orders));
        deductStyleHubStockFallback(order);
        return order;
    }

    async function saveUniversalOrder(order) {
        if (window.StyleHubOrders && typeof window.StyleHubOrders.saveOrder === "function") {
            return window.StyleHubOrders.saveOrder(order);
        }
        return saveLocalUniversalOrder(order);
    }

    function clearCartAfterCheckout(selectedIndexes, selectedFingerprints) {
        window.__stylehubCartWasCheckedOutAt = Date.now();

        const currentCart = readCart();
        const selectedSet = new Set((Array.isArray(selectedIndexes) ? selectedIndexes : [])
            .map(function (index) { return Number(index); })
            .filter(function (index) { return Number.isInteger(index) && index >= 0 && index < currentCart.length; }));
        const fingerprintSet = new Set((Array.isArray(selectedFingerprints) ? selectedFingerprints : [])
            .map(function (value) { return String(value || ""); })
            .filter(Boolean));

        const remainingCart = currentCart.filter(function (item, index) {
            if (selectedSet.has(index)) return false;
            if (fingerprintSet.has(getCartItemFingerprint(item))) return false;
            return true;
        });

        localStorage.removeItem("stylehub_active_voucher");
        localStorage.removeItem(BAG_SELECTION_KEY);

        // Ghi trực tiếp vào toàn bộ key giỏ hàng để sản phẩm đã thanh toán không bị script cũ ghi ngược lại.
        const safeRemainingCart = writeCartStorageOnly(remainingCart);

        if (typeof window.StyleHubResetProductDetailCartMemory === "function" && !safeRemainingCart.length) {
            try { window.StyleHubResetProductDetailCartMemory(); } catch (error) {}
            writeCartStorageOnly([]);
        }

        if (typeof window.clearStyleHubCartStorage === "function" && !safeRemainingCart.length) {
            try { window.clearStyleHubCartStorage(); } catch (error) {}
            writeCartStorageOnly([]);
        }

        window.cartMemoryArray = safeRemainingCart;
        update(safeRemainingCart);

        if (safeRemainingCart.length) {
            resetSelectedIndexes(safeRemainingCart);
        }

        if (typeof window.renderCartUI === "function" && typeof window.StyleHubSetProductDetailCartMemory === "function") {
            syncProductDetailCartMemory(safeRemainingCart);
            try { window.renderCartUI(); } catch (error) {}
            // Sau renderCartUI cũ, chốt lại storage lần nữa để không hiện lại món đã thanh toán.
            setTimeout(function () {
                syncProductDetailCartMemory(safeRemainingCart);
                writeCartStorageOnly(safeRemainingCart);
                update(safeRemainingCart);
            }, 80);
        }
    }

    async function submitUniversalCheckout() {
        const fullCart = readCart();
        let selectedIndexes = Array.isArray(stylehubCheckoutSelectedIndexesSnapshot) && stylehubCheckoutSelectedIndexesSnapshot.length
            ? stylehubCheckoutSelectedIndexesSnapshot.slice()
            : getSelectedIndexes(fullCart);
        selectedIndexes = selectedIndexes.filter(function (index) { return Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < fullCart.length; }).map(Number);
        const cart = selectedIndexes.map(function (index) { return fullCart[index]; }).filter(Boolean);
        const selectedFingerprints = Array.isArray(stylehubCheckoutSelectedFingerprintsSnapshot) && stylehubCheckoutSelectedFingerprintsSnapshot.length
            ? stylehubCheckoutSelectedFingerprintsSnapshot.slice()
            : cart.map(getCartItemFingerprint);
        if (!fullCart.length) {
            showUniversalCheckoutMessage("Giỏ hàng của bạn đang trống.");
            return;
        }

        if (!cart.length) {
            showUniversalCheckoutMessage("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.");
            return;
        }

        const button = document.querySelector("#bag-modal .stylehub-checkout-submit");
        const name = String(document.getElementById("stylehubCheckoutName") && document.getElementById("stylehubCheckoutName").value || "").trim();
        const phone = String(document.getElementById("stylehubCheckoutPhone") && document.getElementById("stylehubCheckoutPhone").value || "").trim();
        const address = String(document.getElementById("stylehubCheckoutAddress") && document.getElementById("stylehubCheckoutAddress").value || "").trim();
        const email = String(document.getElementById("stylehubCheckoutEmail") && document.getElementById("stylehubCheckoutEmail").value || "").trim().toLowerCase();

        if (!name || !phone || !address || !email) {
            showUniversalCheckoutMessage("Vui lòng điền đầy đủ thông tin giao hàng.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showUniversalCheckoutMessage("Email chưa đúng định dạng.");
            return;
        }

        const accountEmail = getStyleHubAccountEmailForCheckout(email) || email;
        const subtotal = calculateCartSubtotal(cart);
        const totals = calculateBagTotals(subtotal);
        const createdAt = Date.now();
        const orderId = "STH" + createdAt.toString().slice(-6) + Math.floor(10 + Math.random() * 90);
        const orderDate = new Date(createdAt).toLocaleString("vi-VN");

        const order = {
            orderId: orderId,
            userEmail: accountEmail,
            customerEmail: accountEmail,
            shippingEmail: email,
            orderDate: orderDate,
            date: orderDate,
            createdAt: createdAt,
            updatedAt: createdAt,
            clientOrderUid: orderId,
            status: "Đang chờ xác nhận",
            userInfo: {
                name: name,
                phone: phone,
                email: email,
                accountEmail: accountEmail,
                address: address
            },
            orderedProductsList: cart,
            subtotalFormatted: formatMoney(totals.subtotal),
            shippingFeeFormatted: formatMoney(totals.shipping),
            discountFormatted: "-" + formatMoney(totals.discount),
            voucherCode: totals.code || "",
            totalPriceFormatted: formatMoney(totals.total)
        };

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Đang xử lý...";
            }

            saveStyleHubShippingProfileForCheckout({
                name: name,
                phone: phone,
                address: address,
                email: email
            });

            const savedOrder = await saveUniversalOrder(order);
            const orderForEmail = JSON.parse(JSON.stringify(savedOrder || order));
            if (window.StyleHubNotifications && typeof window.StyleHubNotifications.addOrderSuccessNotification === "function") {
                try { window.StyleHubNotifications.addOrderSuccessNotification(savedOrder || order); } catch (error) {}
            }

            // BAG checkout dùng drawer riêng trong stylehub-cart-sync.js, nên phải gửi EmailJS tại đây.
            // Không await để đơn hàng vẫn hiện thành công nhanh; dữ liệu đơn đã được snapshot trước khi clear giỏ.
            sendStyleHubUniversalOrderEmail(orderForEmail)
                .then(function() {
                    console.log("Email xác nhận đơn hàng BAG đã gửi thành công.");
                })
                .catch(function(emailError) {
                    console.error("Email xác nhận đơn hàng BAG gửi thất bại:", emailError);
                    if (typeof window.showToastNotification === "function") {
                        try { window.showToastNotification("Đơn đã đặt thành công, nhưng email xác nhận chưa gửi được. Kiểm tra EmailJS/Gmail."); } catch (error) {}
                    }
                });

            clearCartAfterCheckout(selectedIndexes, selectedFingerprints);
            renderCheckoutSuccess(order);
        } catch (error) {
            console.error("Không thể lưu đơn hàng:", error);
            showUniversalCheckoutMessage("Có lỗi khi đặt hàng. Vui lòng thử lại.");
            if (button) {
                button.disabled = false;
                button.textContent = "Xác nhận đặt hàng";
            }
        }
    }

    function renderCheckoutSuccess(order) {
        const modal = document.getElementById("bag-modal");
        if (!modal) return;

        modal.innerHTML = `
            <aside class="stylehub-universal-bag-panel stylehub-universal-checkout-panel bag-sidebar" role="dialog" aria-modal="true" aria-label="Order Success">
                <div class="stylehub-universal-bag-header bag-header">
                    <h3>Order Success</h3>
                    <button type="button" class="stylehub-universal-bag-close close-modal" aria-label="Close">×</button>
                </div>
                <div class="stylehub-universal-bag-body stylehub-universal-checkout-body">
                    <p class="stylehub-checkout-success-note">Đặt hàng thành công. Đơn hàng của bạn đang chờ xác nhận.</p>
                    <div class="stylehub-bag-summary">
                        <div class="stylehub-bag-summary-row"><span>Mã đơn</span><span>${escapeHTML(order.orderId)}</span></div>
                        <div class="stylehub-bag-summary-row"><span>Khách hàng</span><span>${escapeHTML(order.userInfo.name)}</span></div>
                        <div class="stylehub-bag-summary-row"><span>Số điện thoại</span><span>${escapeHTML(order.userInfo.phone)}</span></div>
                        <div class="stylehub-bag-summary-row stylehub-summary-multiline"><span>Email</span><span>${escapeHTML(order.userInfo.email || order.shippingEmail || order.customerEmail || order.userEmail || '')}</span></div>
                        <div class="stylehub-bag-summary-row stylehub-summary-multiline"><span>Địa chỉ</span><span>${escapeHTML(order.userInfo.address || order.shippingAddress || '')}</span></div>
                        <div class="stylehub-bag-summary-row"><span>Tổng cộng</span><span>${escapeHTML(order.totalPriceFormatted)}</span></div>
                    </div>
                </div>
                <div class="stylehub-universal-bag-footer bag-footer">
                    <button type="button" class="stylehub-universal-checkout stylehub-checkout-done"><span>Đóng</span></button>
                </div>
            </aside>
        `;
        modal.setAttribute("data-stylehub-bag-managed-version", "checkout-success-v1");
        update(readCart());
        if (typeof window.showToastNotification === "function") {
            try { window.showToastNotification("Đặt hàng thành công!"); } catch (error) {}
        }
    }

    function bindBagEvents() {
        ensureBagModal();
        renderBagModal();
        update();

        document.querySelectorAll("#bag-trigger, .pd-bag-link, a").forEach(function (trigger) {
            if (!isBagTrigger(trigger)) return;

            // Bỏ handler BAG riêng từng trang để mọi trang dùng chung 1 drawer.
            // Đặc biệt: product-detail.html có inline onclick=toggleCartDrawer(true),
            // nếu không gỡ ra thì BAG trong trang sản phẩm sẽ không đồng bộ với các trang ngoài.
            trigger.onclick = null;

            if (trigger.dataset.stylehubBagBound === "1") return;
            trigger.dataset.stylehubBagBound = "1";

            trigger.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                openBag();
            }, true);
        });
    }

    document.addEventListener("click", function (event) {
        const modal = document.getElementById("bag-modal");
        const removeBtn = event.target.closest("[data-stylehub-remove-index]");
        if (removeBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

            const index = Number(removeBtn.getAttribute("data-stylehub-remove-index"));
            const cart = readCart();
            if (Number.isInteger(index) && index >= 0 && index < cart.length) {
                const selectedBefore = new Set(getSelectedIndexes(cart));
                const currentItem = normalizeItem(cart[index]);
                const currentQty = getQty(currentItem);
                let selectedAfter = [];

                // Nếu cùng sản phẩm đang được gộp SL: 2, 3,... thì bấm Xóa chỉ trừ 1 cái.
                // Chỉ khi SL còn 1 mới xóa hẳn dòng sản phẩm khỏi BAG.
                if (currentQty > 1) {
                    cart[index] = Object.assign({}, currentItem, { qty: currentQty - 1 });
                    selectedBefore.forEach(function (selectedIndex) {
                        if (selectedIndex >= 0 && selectedIndex < cart.length) selectedAfter.push(selectedIndex);
                    });
                } else {
                    cart.splice(index, 1);
                    selectedBefore.forEach(function (selectedIndex) {
                        if (selectedIndex < index) selectedAfter.push(selectedIndex);
                        if (selectedIndex > index) selectedAfter.push(selectedIndex - 1);
                    });
                }

                const savedCart = save(cart) || readCart();
                setSelectedIndexes(selectedAfter, savedCart);
                renderBagModal(savedCart);
                // Đồng bộ biến cartMemoryArray trong product-detail.html trước khi gọi renderCartUI.
                // Nếu không, drawer cũ có thể ghi ngược giỏ hàng cũ làm nút Xóa không có tác dụng.
                syncProductDetailCartMemory(savedCart);
                if (typeof window.renderCartUI === "function" && typeof window.StyleHubSetProductDetailCartMemory === "function") {
                    setTimeout(function () {
                        syncProductDetailCartMemory(savedCart);
                        window.renderCartUI();
                        writeCartStorageOnly(savedCart);
                    }, 80);
                }
            }
            return;
        }

        const closeBtn = event.target.closest("#bag-modal .close-modal, #bag-modal .stylehub-universal-bag-close");
        if (closeBtn) {
            event.preventDefault();
            event.stopPropagation();
            const isCheckoutSuccess = modal && modal.getAttribute("data-stylehub-bag-managed-version") === "checkout-success-v1";
            closeBag();
            if (isCheckoutSuccess) setTimeout(triggerStyleHubUniversalFirework, 180);
            return;
        }

        const applyVoucherBtn = event.target.closest("#bag-modal #stylehubBagVoucherApply, #bag-modal .stylehub-bag-apply-btn");
        if (applyVoucherBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            applyBagVoucher();
            return false;
        }

        const backCheckoutBtn = event.target.closest("#bag-modal .stylehub-checkout-back");
        if (backCheckoutBtn) {
            event.preventDefault();
            event.stopPropagation();
            const modal = document.getElementById("bag-modal");
            if (modal) modal.setAttribute("data-stylehub-bag-managed-version", "");
            openBag();
            return;
        }

        const submitCheckoutBtn = event.target.closest("#bag-modal .stylehub-checkout-submit");
        if (submitCheckoutBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (!submitCheckoutBtn.disabled) submitUniversalCheckout();
            return;
        }

        const doneCheckoutBtn = event.target.closest("#bag-modal .stylehub-checkout-done");
        if (doneCheckoutBtn) {
            event.preventDefault();
            event.stopPropagation();
            closeBag();
            setTimeout(triggerStyleHubUniversalFirework, 180);
            return;
        }

        const checkoutBtn = event.target.closest("#bag-modal .checkout-btn, #bag-modal .stylehub-universal-checkout");
        if (checkoutBtn) {
            event.preventDefault();
            event.stopPropagation();
            if (!checkoutBtn.disabled) goToCheckout();
            return;
        }

        if (modal && event.target === modal) {
            event.preventDefault();
            closeBag();
            return;
        }

        const trigger = event.target.closest("#bag-trigger, .pd-bag-link, a");
        if (!isBagTrigger(trigger)) return;

        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        openBag();
    }, true);

    document.addEventListener("change", function (event) {
        const selectAll = event.target && event.target.closest && event.target.closest("#bag-modal #stylehubBagSelectAll");
        if (selectAll) {
            event.preventDefault();
            event.stopPropagation();
            const cart = readCart();
            setSelectedIndexes(selectAll.checked ? cart.map(function (_, index) { return index; }) : [], cart);
            renderBagModal(cart);
            forceBagStayOpen();
            return;
        }

        const itemCheckbox = event.target && event.target.closest && event.target.closest("#bag-modal [data-stylehub-select-index]");
        if (itemCheckbox) {
            event.stopPropagation();
            const cart = readCart();
            const index = Number(itemCheckbox.getAttribute("data-stylehub-select-index"));
            const selectedSet = new Set(getSelectedIndexes(cart));
            if (itemCheckbox.checked) {
                selectedSet.add(index);
            } else {
                selectedSet.delete(index);
            }
            setSelectedIndexes(Array.from(selectedSet), cart);
            renderBagModal(cart);
            forceBagStayOpen();
        }
    }, true);

    document.addEventListener("submit", function (event) {
        if (event.target && event.target.matches && event.target.matches("#stylehubUniversalCheckoutForm")) {
            event.preventDefault();
            event.stopPropagation();
            submitUniversalCheckout();
        }
    }, true);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeBag();
        if (event.key === "Enter" && event.target && event.target.matches && event.target.matches("#bag-modal #stylehubBagVoucherInput")) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            applyBagVoucher();
        }
    });

    window.StyleHubCartSync = {
        read: readCart,
        save: save,
        clear: clear,
        update: update,
        openBag: openBag,
        closeBag: closeBag,
        hardCloseBag: hardCloseBag,
        renderBagModal: renderBagModal,
        applyVoucher: applyBagVoucher,
        calculateTotals: calculateBagTotals,
        openCheckout: goToCheckout,
        submitCheckout: submitUniversalCheckout,
        getSelectedIndexes: getSelectedIndexes,
        setSelectedIndexes: setSelectedIndexes,
        getSelectedCart: getSelectedCart,
        mergeDuplicateCartItems: mergeDuplicateCartItems,
        writeCartStorageOnly: writeCartStorageOnly
    };

    window.openStyleHubBag = openBag;
    window.closeStyleHubBag = closeBag;

    // Compat cho product-detail.html: nếu trang cũ còn gọi toggleCartDrawer(true)
    // từ inline HTML, vẫn mở đúng drawer BAG chung thay vì mở drawer cũ bị lệch UI.
    const originalToggleCartDrawer = window.toggleCartDrawer;
    window.StyleHubOriginalToggleCartDrawer = originalToggleCartDrawer;
    window.toggleCartDrawer = function (isOpen) {
        if (isOpen === false) {
            closeBag();
            return;
        }
        openBag();
    };
    window.toggleStyleHubUnifiedBag = window.toggleCartDrawer;

    document.addEventListener("DOMContentLoaded", function () {
        bindBagEvents();
        setTimeout(bindBagEvents, 300);
        setTimeout(bindBagEvents, 1000);
    });

    window.addEventListener("storage", function (event) {
        if (CART_KEYS.includes(event.key)) {
            update();
            renderBagModal();
        }
    });

    setTimeout(function () {
        update();
        renderBagModal();
    }, 500);
})();
