/* =========================================================
   THE STYLE HUB - CLOUD ORDERS API
   ---------------------------------------------------------
   Muốn thấy đơn hàng từ MÁY KHÁC, bắt buộc phải dùng database online.
   1) Tạo Firebase project
   2) Tạo Realtime Database
   3) Copy firebaseConfig thay vào phần PASTE_... bên dưới
   Nếu chưa cấu hình Firebase, code tự chạy bằng localStorage như demo cũ.
   ========================================================= */

(function () {
    const STYLEHUB_FIREBASE_CONFIG = {
        apiKey: "AIzaSyBLmPFwTOltztOw28_LUp1L56jgYYAaApM",
        authDomain: "thestylehub-aaf2f.firebaseapp.com",
        databaseURL: "https://thestylehub-aaf2f-default-rtdb.firebaseio.com",
        projectId: "thestylehub-aaf2f",
        storageBucket: "thestylehub-aaf2f.firebasestorage.app",
        messagingSenderId: "1044789250378",
        appId: "1:1044789250378:web:e268f523e323954a6dd9b3",
        measurementId: "G-Y53W16W4W3"
    };

    const DB_ROOT = "stylehub_orders/orders";
    let firebaseReady = false;
    let firebaseDatabase = null;
    let realtimeAttached = false;

    function hasValue(value) {
        return typeof value === "string" && value.trim() !== "" && !value.includes("PASTE_");
    }

    function isCloudConfigured() {
        return hasValue(STYLEHUB_FIREBASE_CONFIG.apiKey) &&
               hasValue(STYLEHUB_FIREBASE_CONFIG.databaseURL) &&
               hasValue(STYLEHUB_FIREBASE_CONFIG.projectId) &&
               typeof firebase !== "undefined" &&
               typeof firebase.database === "function";
    }

    function initFirebase() {
        if (!isCloudConfigured()) return false;
        if (firebaseReady && firebaseDatabase) return true;

        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(STYLEHUB_FIREBASE_CONFIG);
            }
            firebaseDatabase = firebase.database();
            firebaseReady = true;
            return true;
        } catch (error) {
            console.warn("StyleHub Firebase chưa sẵn sàng, đang dùng localStorage:", error);
            return false;
        }
    }

    function cleanText(value, fallback) {
        const text = value === undefined || value === null ? "" : String(value).trim();
        return text || fallback || "";
    }

    function getCustomerInfo(order) {
        const info = order && order.userInfo ? order.userInfo : {};
        return {
            name: cleanText(info.name || order.customerName || order.name, "N/A"),
            phone: cleanText(info.phone || order.customerPhone || order.phone, "N/A"),
            email: cleanText(info.email || order.userEmail || order.customerEmail || order.shippingEmail || order.email, "N/A").toLowerCase(),
            address: cleanText(info.address || order.customerAddress || order.address, "Chưa cập nhật địa chỉ")
        };
    }

    function normalizeProducts(items) {
        if (!Array.isArray(items)) return [];
        return items.map(function (item) {
            return {
                key: cleanText(item.key || item.id, ""),
                name: cleanText(item.name, "Sản phẩm"),
                size: cleanText(item.size, "-"),
                qty: Number(item.qty || item.quantity || 1),
                price: cleanText(item.price || item.priceFormatted, ""),
                priceNum: Number(item.priceNum || String(item.price || "0").replace(/[^\d]/g, "") || 0),
                mainImg: cleanText(item.mainImg || item.image || item.img, "")
            };
        });
    }

    function calculateTotal(items) {
        let total = 0;
        normalizeProducts(items).forEach(function (item) {
            total += (Number(item.priceNum) || 0) * (Number(item.qty) || 1);
        });
        return total.toLocaleString("vi-VN") + " ₫";
    }

    function normalizeOrder(order) {
        const safeOrder = order || {};
        const customer = getCustomerInfo(safeOrder);
        const orderId = cleanText(safeOrder.orderId, "STH" + Math.floor(100000 + Math.random() * 900000));
        const products = normalizeProducts(safeOrder.orderedProductsList || safeOrder.items || []);
        const createdAt = Number(safeOrder.createdAt || safeOrder.timestamp || Date.now());
        const dateText = cleanText(safeOrder.orderDate || safeOrder.date, new Date(createdAt).toLocaleString("vi-VN"));

        return {
            orderId: orderId,
            createdAt: createdAt,
            updatedAt: Number(safeOrder.updatedAt || createdAt),
            orderDate: dateText,
            date: dateText,
            status: cleanText(safeOrder.status, "Đang chờ xác nhận"),
            userEmail: customer.email,
            customerEmail: customer.email,
            shippingEmail: cleanText(safeOrder.shippingEmail || customer.email, customer.email).toLowerCase(),
            userInfo: customer,
            orderedProductsList: products,
            totalPriceFormatted: cleanText(safeOrder.totalPriceFormatted || safeOrder.totalPrice, calculateTotal(products))
        };
    }

    function safeParse(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function getLocalOrderKeys() {
        return Object.keys(localStorage).filter(function (key) {
            return key === "hub_orders" || key.indexOf("hub_orders_") === 0;
        });
    }

    function upsertIntoKey(storageKey, order) {
        const orders = safeParse(storageKey);
        const index = orders.findIndex(function (item) { return item && item.orderId === order.orderId; });
        if (index >= 0) orders[index] = order;
        else orders.unshift(order);
        localStorage.setItem(storageKey, JSON.stringify(orders));
    }

    function saveLocalOrder(order) {
        const normalized = normalizeOrder(order);

        // Chỉ lưu đơn theo đúng email tài khoản hiện tại.
        // Không ghi thêm vào hub_orders global nữa, vì account.html có thể đọc cả local + cloud
        // và gây cảm giác một lần đặt hàng bị nhảy thành 2 đơn giống nhau.
        if (normalized.userEmail && normalized.userEmail !== "n/a") {
            upsertIntoKey("hub_orders_" + normalized.userEmail, normalized);
        } else {
            upsertIntoKey("hub_orders_guest", normalized);
        }
        return normalized;
    }

    function updateLocalOrder(orderId, patch) {
        getLocalOrderKeys().forEach(function (key) {
            const orders = safeParse(key);
            let changed = false;
            const updated = orders.map(function (order) {
                if (order && order.orderId === orderId) {
                    changed = true;
                    return normalizeOrder(Object.assign({}, order, patch, { updatedAt: Date.now() }));
                }
                return order;
            });
            if (changed) localStorage.setItem(key, JSON.stringify(updated));
        });
    }

    function deleteLocalOrder(orderId) {
        getLocalOrderKeys().forEach(function (key) {
            const orders = safeParse(key);
            const filtered = orders.filter(function (order) { return !order || order.orderId !== orderId; });
            if (filtered.length !== orders.length) localStorage.setItem(key, JSON.stringify(filtered));
        });
    }

    function uniqueAndSort(orders) {
        const map = new Map();
        (orders || []).forEach(function (order) {
            if (!order) return;
            const normalized = normalizeOrder(order);
            map.set(normalized.orderId, normalized);
        });
        return Array.from(map.values()).sort(function (a, b) {
            return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
        });
    }

    async function saveOrder(order) {
        const normalized = saveLocalOrder(order);
        if (initFirebase()) {
            await firebaseDatabase.ref(DB_ROOT + "/" + normalized.orderId).set(normalized);
        }
        return normalized;
    }

    async function getAllOrders() {
        if (initFirebase()) {
            const snapshot = await firebaseDatabase.ref(DB_ROOT).once("value");
            const value = snapshot.val() || {};
            return uniqueAndSort(Object.keys(value).map(function (key) { return value[key]; }));
        }
        let all = [];
        getLocalOrderKeys().forEach(function (key) { all = all.concat(safeParse(key)); });
        return uniqueAndSort(all);
    }

    function getOwnerEmail(order) {
        const normalized = normalizeOrder(order);
        return String(normalized.userEmail || normalized.customerEmail || normalized.shippingEmail || "").trim().toLowerCase();
    }

    async function getOrdersByEmail(email) {
        const targetEmail = String(email || "").trim().toLowerCase();
        if (!targetEmail) return [];
        const allOrders = await getAllOrders();
        return allOrders.filter(function (order) { return getOwnerEmail(order) === targetEmail; });
    }

    async function updateOrderStatus(orderId, status) {
        const patch = { status: status, updatedAt: Date.now() };
        if (status === "Đang giao") patch.confirmedAt = new Date().toLocaleString("vi-VN");
        if (status === "Đã nhận hàng") patch.completedAt = new Date().toLocaleString("vi-VN");
        if (String(status || "").toLowerCase().includes("hủy")) patch.cancelledAt = new Date().toLocaleString("vi-VN");
        updateLocalOrder(orderId, patch);
        if (initFirebase()) {
            await firebaseDatabase.ref(DB_ROOT + "/" + orderId).update(patch);
        }
    }

    async function deleteOrder(orderId) {
        deleteLocalOrder(orderId);
        if (initFirebase()) {
            await firebaseDatabase.ref(DB_ROOT + "/" + orderId).remove();
        }
    }

    function onOrdersChanged(callback) {
        if (initFirebase()) {
            if (realtimeAttached) return;
            realtimeAttached = true;
            firebaseDatabase.ref(DB_ROOT).on("value", function (snapshot) {
                const value = snapshot.val() || {};
                callback(uniqueAndSort(Object.keys(value).map(function (key) { return value[key]; })));
            });
        } else {
            window.addEventListener("storage", function (event) {
                if (event.key && event.key.indexOf("hub_orders") === 0) {
                    getAllOrders().then(callback);
                }
            });
        }
    }

    window.StyleHubOrders = {
        isCloudConfigured: isCloudConfigured,
        saveOrder: saveOrder,
        getAllOrders: getAllOrders,
        getOrdersByEmail: getOrdersByEmail,
        updateOrderStatus: updateOrderStatus,
        deleteOrder: deleteOrder,
        onOrdersChanged: onOrdersChanged,
        normalizeOrder: normalizeOrder
    };
})();
