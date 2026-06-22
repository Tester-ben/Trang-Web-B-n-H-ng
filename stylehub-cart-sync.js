/* THE STYLE HUB - CART SYNC ACROSS ALL PAGES - FINAL FIX */
(function () {
    const CART_KEYS = ["stylehub_cart_memory_v1", "stylehub_cart", "hub_cart", "cartMemoryArray", "the_style_hub_cart"];

    function parseCart(raw) {
        try {
            const parsed = JSON.parse(raw || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function readCart() {
        for (const key of CART_KEYS) {
            const cart = parseCart(localStorage.getItem(key));
            if (cart.length > 0) return cart;
        }
        return [];
    }

    function getQty(item) {
        const qty = Number(item && (item.qty || item.quantity || item.amount || 1));
        return Number.isNaN(qty) || qty < 1 ? 1 : qty;
    }

    function save(cart) {
        const safeCart = Array.isArray(cart) ? cart : [];
        const data = JSON.stringify(safeCart);
        localStorage.setItem("stylehub_cart_memory_v1", data);
        localStorage.setItem("stylehub_cart", data);
        localStorage.setItem("hub_cart", data);
        localStorage.setItem("cartMemoryArray", data);
        update(safeCart);
    }

    function clear() {
        CART_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
        });
        localStorage.setItem("stylehub_cart_memory_v1", "[]");
        localStorage.setItem("stylehub_cart", "[]");
        localStorage.setItem("hub_cart", "[]");
        localStorage.setItem("cartMemoryArray", "[]");
        update([]);
    }

    function update(cartArg) {
        const cart = Array.isArray(cartArg) ? cartArg : readCart();
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

    window.StyleHubCartSync = {
        read: readCart,
        save: save,
        clear: clear,
        update: update
    };

    document.addEventListener("DOMContentLoaded", function () {
        update();
    });

    window.addEventListener("storage", function (event) {
        if (CART_KEYS.includes(event.key)) update();
    });
})();
