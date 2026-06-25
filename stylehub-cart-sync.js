/* THE STYLE HUB - CART SYNC + UNIVERSAL BAG DRAWER - ALL PAGES V7 */
(function () {
    const CART_KEYS = [
        "stylehub_cart_memory_v1",
        "stylehub_cart",
        "hub_cart",
        "cartMemoryArray",
        "the_style_hub_cart",
        "cart"
    ];

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

    function readCart() {
        for (const key of CART_KEYS) {
            const cart = parseCart(localStorage.getItem(key)).map(normalizeItem).filter(Boolean);
            if (cart.length > 0) return cart;
        }
        return [];
    }

    function save(cart) {
        const safeCart = (Array.isArray(cart) ? cart : []).map(normalizeItem).filter(Boolean);
        const data = JSON.stringify(safeCart);

        localStorage.setItem("stylehub_cart_memory_v1", data);
        localStorage.setItem("stylehub_cart", data);
        localStorage.setItem("hub_cart", data);
        localStorage.setItem("cartMemoryArray", data);
        localStorage.setItem("the_style_hub_cart", data);
        localStorage.setItem("cart", data);

        if (Array.isArray(window.cartMemoryArray)) {
            window.cartMemoryArray = safeCart;
        }

        update(safeCart);
        renderBagModal(safeCart);
    }

    function clear() {
        CART_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
        });
        localStorage.setItem("stylehub_cart_memory_v1", "[]");
        localStorage.setItem("stylehub_cart", "[]");
        localStorage.setItem("hub_cart", "[]");
        localStorage.setItem("cartMemoryArray", "[]");
        localStorage.setItem("the_style_hub_cart", "[]");
        localStorage.setItem("cart", "[]");

        if (Array.isArray(window.cartMemoryArray)) {
            window.cartMemoryArray = [];
        }

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
                z-index: 99998 !important;
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
                width: min(460px, 100vw) !important;
                max-width: min(460px, 100vw) !important;
                height: 100vh !important;
                max-height: 100vh !important;
                background: #ffffff !important;
                color: #111111 !important;
                padding: 42px 42px 34px !important;
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
                padding: 0 0 22px 0 !important;
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
                letter-spacing: 6px !important;
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
                padding: 26px 0 22px !important;
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

            #bag-modal .stylehub-bag-item {
                display: grid !important;
                grid-template-columns: 104px 1fr auto !important;
                gap: 18px !important;
                padding: 0 0 22px !important;
                margin: 0 0 22px !important;
                border-bottom: 1px solid #f1f1f1 !important;
                align-items: start !important;
                background: #ffffff !important;
                color: #111111 !important;
            }

            #bag-modal .stylehub-bag-item img,
            #bag-modal .stylehub-bag-img-placeholder {
                width: 104px !important;
                height: 132px !important;
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
                padding: 20px 0 0 0 !important;
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
                grid-template-columns: 1fr 96px !important;
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
                display: block !important;
                width: 100% !important;
                min-height: 58px !important;
                height: 58px !important;
                padding: 0 16px !important;
                border: 1px solid #111111 !important;
                background: #080808 !important;
                color: #ffffff !important;
                cursor: pointer !important;
                font-size: 13px !important;
                line-height: 58px !important;
                font-weight: 500 !important;
                letter-spacing: 4px !important;
                text-align: center !important;
                text-transform: uppercase !important;
                position: static !important;
                opacity: 1 !important;
                box-shadow: none !important;
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

            @media (max-width: 640px) {
                #bag-modal.stylehub-bag-managed .bag-sidebar,
                #bag-modal .stylehub-universal-bag-panel {
                    width: 100vw !important;
                    max-width: 100vw !important;
                    padding: 32px 24px 28px !important;
                }

                #bag-modal.stylehub-bag-managed .bag-header h3,
                #bag-modal .stylehub-universal-bag-header h3 {
                    font-size: 16px !important;
                    letter-spacing: 5px !important;
                }

                #bag-modal .stylehub-bag-item {
                    grid-template-columns: 86px 1fr auto !important;
                    gap: 14px !important;
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
        if (managedVersion !== "7") {
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
            modal.setAttribute("data-stylehub-bag-managed-version", "7");
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

        container.innerHTML = cart.map(function (item, index) {
            const qty = getQty(item);
            const price = Number(item.priceNum) || parseMoney(item.price);
            subtotal += price * qty;

            const imgHtml = item.mainImg
                ? '<img src="' + escapeHTML(item.mainImg) + '" alt="' + escapeHTML(item.name) + '">'
                : '<div class="stylehub-bag-img-placeholder"></div>';
            const displayPrice = price ? formatMoney(price) : (item.price || '0 ₫');

            return `
                <div class="stylehub-bag-item">
                    ${imgHtml}
                    <div>
                        <p class="stylehub-bag-name">${escapeHTML(item.name)}</p>
                        <p class="stylehub-bag-meta">Size: ${escapeHTML(item.size)} / SL: ${qty}</p>
                        <p class="stylehub-bag-price">${escapeHTML(displayPrice)}</p>
                    </div>
                    <button type="button" class="stylehub-bag-remove" data-stylehub-remove-index="${index}">Xóa</button>
                </div>
            `;
        }).join("");

        const totals = calculateBagTotals(subtotal);
        if (subtotalEl) subtotalEl.textContent = formatMoney(totals.subtotal);
        if (shippingEl) shippingEl.textContent = formatMoney(totals.shipping);
        if (discountEl) discountEl.textContent = "-" + formatMoney(totals.discount);
        if (totalEl) totalEl.textContent = formatMoney(totals.total);
        if (voucherMessage && !voucherMessage.textContent) {
            voucherMessage.className = "stylehub-bag-voucher-message";
        }
        if (checkoutBtn) checkoutBtn.disabled = false;
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

    function isBagTrigger(node) {
        if (!node) return false;
        if (node.matches && node.matches("#bag-trigger, .pd-bag-link")) return true;
        const text = (node.textContent || "").trim().toUpperCase();
        return node.tagName && node.tagName.toLowerCase() === "a" && text.startsWith("BAG");
    }

    function goToCheckout() {
        const cart = readCart();
        if (!cart.length) return;

        const firstItem = cart[0] || {};
        const firstKey = firstItem.key || "";

        localStorage.setItem("stylehub_open_bag_after_load", "1");
        localStorage.setItem("stylehub_open_checkout_after_load", "1");

        if (/product-detail\.html/i.test(window.location.pathname)) {
            closeBag();

            // Dùng luồng checkout gốc của product-detail để vẫn giữ đăng nhập, form giao hàng, tổng tiền.
            if (typeof window.loadStyleHubCartIntoMemory === "function") {
                try { window.loadStyleHubCartIntoMemory(); } catch (error) {}
            }
            if (typeof window.renderCartUI === "function") {
                try { window.renderCartUI(); } catch (error) {}
            }
            if (typeof window.openCheckoutFromCart === "function") {
                window.openCheckoutFromCart();
            } else if (typeof window.toggleCheckoutDrawer === "function") {
                window.toggleCheckoutDrawer(true);
            } else if (typeof window.proceedToCheckout === "function") {
                window.proceedToCheckout();
            }
            return;
        }

        window.location.href = firstKey
            ? "product-detail.html?id=" + encodeURIComponent(firstKey) + "#checkout"
            : "product-detail.html#checkout";
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

            const index = Number(removeBtn.getAttribute("data-stylehub-remove-index"));
            const cart = readCart();
            if (Number.isInteger(index) && index >= 0) {
                cart.splice(index, 1);
                save(cart);
                if (typeof window.renderCartUI === "function") setTimeout(window.renderCartUI, 80);
            }
            return;
        }

        const closeBtn = event.target.closest("#bag-modal .close-modal, #bag-modal .stylehub-universal-bag-close");
        if (closeBtn) {
            event.preventDefault();
            event.stopPropagation();
            closeBag();
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
        renderBagModal: renderBagModal,
        applyVoucher: applyBagVoucher,
        calculateTotals: calculateBagTotals
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

    function openCheckoutAfterRedirectIfNeeded() {
        const isProductDetail = /product-detail\.html/i.test(window.location.pathname);
        const shouldOpenCheckout = isProductDetail && (
            window.location.hash === "#checkout" ||
            localStorage.getItem("stylehub_open_checkout_after_load") === "1"
        );

        if (!shouldOpenCheckout) return;

        localStorage.removeItem("stylehub_open_bag_after_load");
        localStorage.removeItem("stylehub_open_checkout_after_load");

        setTimeout(function () {
            if (!readCart().length) return;

            if (typeof window.loadStyleHubCartIntoMemory === "function") {
                try { window.loadStyleHubCartIntoMemory(); } catch (error) {}
            }
            if (typeof window.renderCartUI === "function") {
                try { window.renderCartUI(); } catch (error) {}
            }
            if (typeof window.openCheckoutFromCart === "function") {
                window.openCheckoutFromCart();
            } else if (typeof window.toggleCheckoutDrawer === "function") {
                window.toggleCheckoutDrawer(true);
            }
        }, 350);
    }

    document.addEventListener("DOMContentLoaded", function () {
        bindBagEvents();
        setTimeout(bindBagEvents, 300);
        setTimeout(bindBagEvents, 1000);
        openCheckoutAfterRedirectIfNeeded();
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
