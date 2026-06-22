/* THE STYLE HUB - CART SYNC ACROSS ALL PAGES */
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

    function writeCart(cart) {
        const safeCart = Array.isArray(cart) ? cart : [];
        const data = JSON.stringify(safeCart);
        localStorage.setItem("stylehub_cart_memory_v1", data);
        localStorage.setItem("stylehub_cart", data);
        localStorage.setItem("hub_cart", data);
        update(safeCart);
    }

    function clearCart() {
        CART_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
        });
        localStorage.setItem("stylehub_cart_memory_v1", "[]");
        localStorage.setItem("stylehub_cart", "[]");
        localStorage.setItem("hub_cart", "[]");
        update([]);
    }

    function update(cartArg) {
        const cart = Array.isArray(cartArg) ? cartArg : readCart();
        const totalQty = cart.reduce(function (sum, item) {
            return sum + getQty(item);
        }, 0);

        document.querySelectorAll("#cart-count, #bag-count, [data-stylehub-cart-count]").forEach(function (el) {
            el.textContent = String(totalQty);
        });

        document.querySelectorAll("#bag-trigger, a").forEach(function (el) {
            const text = (el.textContent || "").trim().toUpperCase();
            if (text.startsWith("BAG")) {
                el.innerHTML = 'BAG (<span id="cart-count">' + totalQty + '</span>)';
            }
        });
    }

    window.StyleHubCartSync = {
        read: readCart,
        save: writeCart,
        clear: clearCart,
        update: update
    };

    document.addEventListener("DOMContentLoaded", function () {
        update();
    });

    window.addEventListener("storage", function (event) {
        if (CART_KEYS.includes(event.key)) update();
    });
})();
