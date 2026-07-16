/* =========================================================
   THE STYLE HUB - STATIC DEMO ORDER API
   ---------------------------------------------------------
   This file intentionally contains NO Firebase, NO backend,
   NO real order storage and NO cross-page order syncing.

   Purpose for school static-web requirement:
   - Customer checkout can show a success UI only.
   - Admin dashboard displays sample/demo data only.
   - Orders placed by customers will NOT appear in Admin.
   ========================================================= */
(function () {
    "use strict";

    const STATIC_MODE = true;
    const ORDER_STORAGE_KEYS = ["stylehub_orders", "hub_orders"];

    function cleanOldDynamicOrderStorage() {
        try {
            Object.keys(localStorage).forEach(function (key) {
                if (ORDER_STORAGE_KEYS.indexOf(key) !== -1 || key.indexOf("hub_orders_") === 0) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {}
    }

    cleanOldDynamicOrderStorage();

    const demoCreatedAt = Date.now() - 86400000;

    const demoProducts = {
        "hoodies-4": {
            key: "hoodies-4",
            name: "Classic Pullover Hoodie - Vintage Black Edition",
            price: "4.350.000 ₫",
            priceNum: 4350000,
            mainImg: "https://fearofgod.com/cdn/shop/files/192AS264732F_CLASSIC_HOODIE-VINTAGE_BLACK_1_900x.jpg?v=1770739042"
        },
        "shoe-5": {
            key: "shoe-5",
            name: "Aerobic Sneaker - Light Grey",
            price: "7.200.000 ₫",
            priceNum: 7200000,
            mainImg: "https://fearofgod.com/cdn/shop/files/FG980-8109NUB_101_LIGHT_GREY_1_900x.jpg?v=1772082765"
        },
        "womens-17": {
            key: "womens-17",
            name: "Womens Varsity Long Sleeve Tee - White",
            price: "3.950.000 ₫",
            priceNum: 3950000,
            mainImg: "https://fearofgod.com/cdn/shop/files/FG9W10-9995JER_WOMENS_VARSIRTY_LS-TEE-WHITE_1_acba7eaf-2a53-44a9-9cc7-26f17660e752.jpg?v=1775231220&width=1200"
        },
        "kids-26": {
            key: "kids-26",
            name: "Kids Essential Tee - Vintage Black",
            price: "1.150.000 ₫",
            priceNum: 1150000,
            mainImg: "https://fearofgod.com/cdn/shop/files/RW00330_KIDS_ESSENTIAL_TEE-VINTAGE_BLACK_1.jpg?v=1781023864&width=3840"
        }
    };

    function formatVnd(value) {
        const amount = Number(value || 0);
        return amount.toLocaleString("vi-VN") + " ₫";
    }

    function makeDemoItem(productKey, size, qty) {
        const product = demoProducts[productKey] || {};
        const quantity = Number(qty || 1);
        return {
            key: productKey,
            id: productKey,
            productId: productKey,
            productKey: productKey,
            sku: productKey,
            name: product.name || "Sản phẩm demo",
            productName: product.name || "Sản phẩm demo",
            title: product.name || "Sản phẩm demo",
            size: size || "-",
            selectedSize: size || "-",
            qty: quantity,
            quantity: quantity,
            price: product.price || "0 ₫",
            priceFormatted: product.price || "0 ₫",
            priceNum: Number(product.priceNum || 0),
            mainImg: product.mainImg || "",
            image: product.mainImg || "",
            img: product.mainImg || "",
            thumbnail: product.mainImg || "",
            productImage: product.mainImg || ""
        };
    }

    function makeDemoOrderTotal(items) {
        return formatVnd((items || []).reduce(function(total, item) {
            return total + Number(item.priceNum || 0) * Number(item.qty || item.quantity || 1);
        }, 0));
    }

    const demoOrderItems01 = [
        makeDemoItem("hoodies-4", "M", 1),
        makeDemoItem("shoe-5", "42", 1)
    ];
    const demoOrderItems02 = [
        makeDemoItem("womens-17", "S", 1)
    ];
    const demoOrderItems03 = [
        makeDemoItem("kids-26", "L", 2)
    ];

    let demoOrders = [
        {
            orderId: "DEMO1001",
            clientOrderUid: "DEMO1001",
            orderDate: new Date(demoCreatedAt).toLocaleString("vi-VN"),
            date: new Date(demoCreatedAt).toLocaleString("vi-VN"),
            createdAt: demoCreatedAt,
            updatedAt: demoCreatedAt,
            status: "Đang chờ xác nhận",
            userEmail: "demo.customer01@stylehub.vn",
            customerEmail: "demo.customer01@stylehub.vn",
            shippingEmail: "demo.customer01@stylehub.vn",
            userInfo: {
                name: "Nguyễn Minh Anh",
                phone: "0901234567",
                email: "demo.customer01@stylehub.vn",
                address: "12 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh"
            },
            orderedProductsList: demoOrderItems01,
            totalPriceFormatted: makeDemoOrderTotal(demoOrderItems01)
        },
        {
            orderId: "DEMO1002",
            clientOrderUid: "DEMO1002",
            orderDate: new Date(demoCreatedAt - 7200000).toLocaleString("vi-VN"),
            date: new Date(demoCreatedAt - 7200000).toLocaleString("vi-VN"),
            createdAt: demoCreatedAt - 7200000,
            updatedAt: demoCreatedAt - 7200000,
            status: "Đang giao",
            userEmail: "demo.customer02@stylehub.vn",
            customerEmail: "demo.customer02@stylehub.vn",
            shippingEmail: "demo.customer02@stylehub.vn",
            userInfo: {
                name: "Trần Gia Hân",
                phone: "0912345678",
                email: "demo.customer02@stylehub.vn",
                address: "88 Lê Lợi, Hải Châu, Đà Nẵng"
            },
            orderedProductsList: demoOrderItems02,
            totalPriceFormatted: makeDemoOrderTotal(demoOrderItems02)
        },
        {
            orderId: "DEMO1003",
            clientOrderUid: "DEMO1003",
            orderDate: new Date(demoCreatedAt - 14400000).toLocaleString("vi-VN"),
            date: new Date(demoCreatedAt - 14400000).toLocaleString("vi-VN"),
            createdAt: demoCreatedAt - 14400000,
            updatedAt: demoCreatedAt - 14400000,
            status: "Đã nhận hàng",
            userEmail: "demo.customer03@stylehub.vn",
            customerEmail: "demo.customer03@stylehub.vn",
            shippingEmail: "demo.customer03@stylehub.vn",
            userInfo: {
                name: "Lê Quốc Bảo",
                phone: "0987654321",
                email: "demo.customer03@stylehub.vn",
                address: "25 Hai Bà Trưng, Hoàn Kiếm, Hà Nội"
            },
            orderedProductsList: demoOrderItems03,
            totalPriceFormatted: makeDemoOrderTotal(demoOrderItems03)
        }
    ];

    let demoCustomProducts = {};
    let demoInventory = {};
    let orderListeners = [];

    function clone(value) {
        return JSON.parse(JSON.stringify(value === undefined ? null : value));
    }

    function normalizeOrder(order) {
        const safe = order || {};
        const id = safe.orderId || safe.id || safe.clientOrderUid || ("DEMO" + Date.now());
        const userInfo = Object.assign({}, safe.userInfo || {}, safe.customerInfo || {}, safe.shippingInfo || {});
        return Object.assign({}, safe, {
            orderId: id,
            id: id,
            clientOrderUid: safe.clientOrderUid || id,
            status: safe.status || "Đang chờ xác nhận",
            userInfo: userInfo,
            orderedProductsList: safe.orderedProductsList || safe.items || safe.products || []
        });
    }

    function notifyListeners() {
        const snapshot = clone(demoOrders.map(normalizeOrder));
        orderListeners.forEach(function (callback) {
            try { callback(snapshot); } catch (error) {}
        });
    }

    function getOrders() {
        return clone(demoOrders.map(normalizeOrder));
    }

    async function getAllOrders() {
        cleanOldDynamicOrderStorage();
        return getOrders();
    }

    async function getOrdersByEmail() {
        // Static demo: customer account does not read or create real orders.
        return [];
    }

    async function saveOrder(order) {
        cleanOldDynamicOrderStorage();
        console.log("[THE STYLE HUB - STATIC DEMO] Checkout success UI only. Order is NOT stored and will NOT appear in Admin.", order);
        return normalizeOrder(order);
    }

    function addOrder(order) {
        return saveOrder(order);
    }

    async function updateOrderStatus(orderId, status, patch) {
        const id = String(orderId || "");
        const index = demoOrders.findIndex(function (order) { return String(order.orderId || order.id) === id; });
        if (index !== -1) {
            demoOrders[index] = Object.assign({}, demoOrders[index], patch || {}, {
                status: status || demoOrders[index].status,
                updatedAt: Date.now()
            });
            notifyListeners();
            return clone(normalizeOrder(demoOrders[index]));
        }
        return null;
    }

    async function updateOrderDetails(orderId, patch) {
        const id = String(orderId || "");
        const index = demoOrders.findIndex(function (order) { return String(order.orderId || order.id) === id; });
        if (index !== -1) {
            demoOrders[index] = Object.assign({}, demoOrders[index], patch || {}, { updatedAt: Date.now() });
            notifyListeners();
            return clone(normalizeOrder(demoOrders[index]));
        }
        return null;
    }

    async function deleteOrder(orderId) {
        const id = String(orderId || "");
        const before = demoOrders.length;
        demoOrders = demoOrders.filter(function (order) { return String(order.orderId || order.id) !== id; });
        if (demoOrders.length !== before) notifyListeners();
        return true;
    }

    function clearOrders() {
        demoOrders = [];
        cleanOldDynamicOrderStorage();
        notifyListeners();
    }

    function onOrdersChanged(callback) {
        if (typeof callback === "function") {
            orderListeners.push(callback);
            setTimeout(function () { callback(getOrders()); }, 0);
        }
        return function unsubscribe() {
            orderListeners = orderListeners.filter(function (item) { return item !== callback; });
        };
    }

    async function saveCustomProductsMap(map) {
        demoCustomProducts = Object.assign({}, map || {});
        return clone(demoCustomProducts);
    }

    function getCustomProductsMap() {
        return clone(demoCustomProducts || {});
    }

    async function saveInventoryMap(map) {
        demoInventory = Object.assign({}, map || {});
        return clone(demoInventory);
    }

    function getInventoryMap() {
        return clone(demoInventory || {});
    }

    window.STYLEHUB_STATIC_DEMO_MODE = STATIC_MODE;
    window.StyleHubOrders = {
        staticMode: true,
        normalizeOrder,
        getAllOrders,
        getOrdersByEmail,
        saveOrder,
        addOrder,
        updateOrderStatus,
        updateOrderDetails,
        deleteOrder,
        clearOrders,
        onOrdersChanged,
        getCustomProductsMap,
        saveCustomProductsMap,
        getInventoryMap,
        saveInventoryMap
    };

    window.StyleHubOrdersAPI = {
        staticMode: true,
        getOrders,
        addOrder,
        updateOrder: updateOrderDetails,
        clearOrders
    };
})();
