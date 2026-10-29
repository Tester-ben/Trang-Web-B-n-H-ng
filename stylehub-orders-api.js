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
    const INVENTORY_DB_ROOT = "stylehub_orders/inventory";
    const CUSTOM_PRODUCTS_DB_ROOT = "stylehub_orders/admin_products";
    const INVENTORY_KEY = "stylehub_inventory_v1";
    const CUSTOM_PRODUCTS_KEY = "stylehub_admin_products_v1";
    const STOCK_DEDUCTED_ORDERS_KEY = "stylehub_stock_deducted_orders_v1";
    const STOCK_FEATURE_START_AT = 1782539550000; // Chỉ tự động trừ kho cho đơn mới từ bản cập nhật này trở đi.
    let firebaseReady = false;
    let firebaseDatabase = null;
    let realtimeAttached = false;
    let inventoryRealtimeAttached = false;
    let customProductsRealtimeAttached = false;

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

    function isRealText(value) {
        const text = String(value === undefined || value === null ? "" : value).trim();
        const normalized = text.toLowerCase();
        return !!text && normalized !== "n/a" && normalized !== "na" && normalized !== "undefined" && normalized !== "null" && normalized !== "chưa cập nhật địa chỉ";
    }

    function firstText(values, fallback) {
        for (let i = 0; i < values.length; i++) {
            const text = cleanText(values[i], "");
            if (isRealText(text)) return text;
        }
        return fallback || "";
    }

    function mergeInfoObjects(order) {
        const safeOrder = order || {};
        return Object.assign({},
            safeOrder.customer || {},
            safeOrder.customerInfo || {},
            safeOrder.shippingInfo || {},
            safeOrder.deliveryInfo || {},
            safeOrder.receiver || {},
            safeOrder.recipient || {},
            safeOrder.userInfo || {}
        );
    }

    function buildAddress(order, info) {
        const safeOrder = order || {};
        const directAddress = firstText([
            info.address, info.fullAddress, info.customerAddress, info.shippingAddress, info.deliveryAddress, info.receiverAddress, info.recipientAddress,
            safeOrder.customerAddress, safeOrder.shippingAddress, safeOrder.deliveryAddress, safeOrder.receiverAddress, safeOrder.recipientAddress, safeOrder.address, safeOrder.fullAddress
        ], "");
        if (directAddress) return directAddress;

        const parts = [
            info.street, info.addressLine, info.ward, info.district, info.city, info.province,
            safeOrder.street, safeOrder.addressLine, safeOrder.ward, safeOrder.district, safeOrder.city, safeOrder.province
        ].map(function(value) { return cleanText(value, ""); }).filter(isRealText);
        return parts.length ? parts.join(", ") : "Chưa cập nhật địa chỉ";
    }

    function getCustomerInfo(order) {
        const safeOrder = order || {};
        const info = mergeInfoObjects(safeOrder);
        const name = firstText([
            info.name, info.fullName, info.customerName, info.receiverName, info.recipientName, info.contactName,
            safeOrder.customerName, safeOrder.name, safeOrder.fullName, safeOrder.receiverName, safeOrder.recipientName, safeOrder.shippingName, safeOrder.customer_name
        ], "N/A");
        const phone = firstText([
            info.phone, info.phoneNumber, info.mobile, info.tel, info.customerPhone, info.receiverPhone, info.recipientPhone,
            safeOrder.customerPhone, safeOrder.phone, safeOrder.phoneNumber, safeOrder.mobile, safeOrder.tel, safeOrder.receiverPhone, safeOrder.recipientPhone, safeOrder.customer_phone
        ], "N/A");
        const email = firstText([
            info.email, info.shippingEmail, info.customerEmail, info.accountEmail,
            safeOrder.shippingEmail, safeOrder.customerEmail, safeOrder.userEmail, safeOrder.email, safeOrder.customer_email
        ], "N/A");
        return {
            name: name,
            phone: phone,
            email: email.toLowerCase(),
            address: buildAddress(safeOrder, info)
        };
    }

    function normalizeProducts(items) {
        if (!Array.isArray(items)) return [];
        return items.map(function (item) {
            const safeItem = item || {};
            return {
                key: cleanText(safeItem.key || safeItem.id || safeItem.productId || safeItem.sku, ""),
                name: cleanText(safeItem.name || safeItem.productName || safeItem.title, "Sản phẩm"),
                size: cleanText(safeItem.size || safeItem.selectedSize, "-"),
                qty: Number(safeItem.qty || safeItem.quantity || safeItem.count || 1),
                price: cleanText(safeItem.price || safeItem.priceFormatted || safeItem.unitPriceFormatted, ""),
                priceNum: Number(safeItem.priceNum || safeItem.unitPrice || safeItem.priceValue || String(safeItem.price || "0").replace(/[^\d]/g, "") || 0),
                mainImg: cleanText(safeItem.mainImg || safeItem.image || safeItem.img || safeItem.thumbnail, "")
            };
        });
    }

    function calculateTotalNumber(items) {
        let total = 0;
        normalizeProducts(items).forEach(function (item) {
            total += (Number(item.priceNum) || 0) * (Number(item.qty) || 1);
        });
        return total;
    }

    function calculateTotal(items) {
        return calculateTotalNumber(items).toLocaleString("vi-VN") + " ₫";
    }

    function parseDateToMs(value) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const text = cleanText(value, "");
        if (!text) return 0;

        let match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
            return new Date(Number(match[6]), Number(match[5]) - 1, Number(match[4]), Number(match[1]), Number(match[2]), Number(match[3] || 0)).getTime();
        }

        match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)).getTime();
        }

        const parsed = Date.parse(text);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getOrderCreatedAt(safeOrder) {
        const explicit = Number(safeOrder.createdAt || safeOrder.timestamp || safeOrder.orderTimestamp || safeOrder.created_at || 0);
        if (explicit > 0) return explicit;
        return parseDateToMs(safeOrder.orderDate || safeOrder.date || safeOrder.createdDate || safeOrder.created_at);
    }

    function getOrderItems(safeOrder) {
        return safeOrder.orderedProductsList || safeOrder.items || safeOrder.products || safeOrder.cart || safeOrder.cartItems || safeOrder.orderItems || [];
    }

    function parseMoney(value) {
        return Number(String(value || "0").replace(/[^\d]/g, "")) || 0;
    }


    function readJsonObject(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "{}");
            return data && typeof data === "object" && !Array.isArray(data) ? data : {};
        } catch (error) {
            return {};
        }
    }

    function saveJsonObject(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value || {}));
        } catch (error) {
            console.warn("Không thể lưu dữ liệu tồn kho:", error);
        }
    }

    function isPlainObject(value) {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }

    function objectHasData(value) {
        return isPlainObject(value) && Object.keys(value).length > 0;
    }

    function writeSharedMapToLocal(key, map, eventName) {
        saveJsonObject(key, map || {});
        try {
            localStorage.setItem(key + "_updated_at", String(Date.now()));
            window.dispatchEvent(new CustomEvent(eventName, { detail: { key: key, data: map || {} } }));
            window.dispatchEvent(new StorageEvent("storage", { key: key, newValue: JSON.stringify(map || {}) }));
        } catch (error) {}
    }

    async function saveSharedMapToCloud(dbRoot, key, map, eventName) {
        const safeMap = isPlainObject(map) ? map : {};
        writeSharedMapToLocal(key, safeMap, eventName);
        if (initFirebase()) {
            await firebaseDatabase.ref(dbRoot).set(safeMap);
        }
        return safeMap;
    }

    async function startSharedMapRealtime(options) {
        if (!options || !options.dbRoot || !options.key || !options.eventName) return;
        if (!initFirebase()) {
            writeSharedMapToLocal(options.key, readJsonObject(options.key), options.eventName);
            return;
        }

        firebaseDatabase.ref(options.dbRoot).on("value", function(snapshot) {
            const remote = snapshot.val() || {};
            const local = readJsonObject(options.key);

            if (!objectHasData(remote) && objectHasData(local)) {
                firebaseDatabase.ref(options.dbRoot).set(local).catch(function(error) {
                    console.warn("Không thể đưa dữ liệu local lên Firebase:", error);
                });
                return;
            }

            writeSharedMapToLocal(options.key, isPlainObject(remote) ? remote : {}, options.eventName);

            if (options.applyProducts && window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
                window.StyleHubProductAdmin.applyAdminProductsToDatabase();
            }
        });
    }

    function startInventoryRealtime() {
        if (inventoryRealtimeAttached) return;
        inventoryRealtimeAttached = true;
        startSharedMapRealtime({
            dbRoot: INVENTORY_DB_ROOT,
            key: INVENTORY_KEY,
            eventName: "stylehub-inventory-change",
            applyProducts: true
        });
    }

    function startCustomProductsRealtime() {
        if (customProductsRealtimeAttached) return;
        customProductsRealtimeAttached = true;
        startSharedMapRealtime({
            dbRoot: CUSTOM_PRODUCTS_DB_ROOT,
            key: CUSTOM_PRODUCTS_KEY,
            eventName: "stylehub-products-change",
            applyProducts: true
        });
    }

    async function saveInventoryMap(map) {
        return saveSharedMapToCloud(INVENTORY_DB_ROOT, INVENTORY_KEY, map || {}, "stylehub-inventory-change");
    }

    async function saveCustomProductsMap(map) {
        return saveSharedMapToCloud(CUSTOM_PRODUCTS_DB_ROOT, CUSTOM_PRODUCTS_KEY, map || {}, "stylehub-products-change");
    }

    async function setProductStock(productId, record) {
        const id = cleanText(productId, "");
        if (!id) return readJsonObject(INVENTORY_KEY);
        const inventory = readJsonObject(INVENTORY_KEY);
        const stock = Math.max(0, Number(record && record.stock || 0));
        inventory[id] = Object.assign({}, inventory[id] || {}, record || {}, {
            stock: stock,
            outOfStock: !!(record && record.outOfStock) || stock <= 0,
            updatedAt: Date.now()
        });
        return saveInventoryMap(inventory);
    }

    function getInventoryMap() {
        return readJsonObject(INVENTORY_KEY);
    }

    function getCustomProductsMap() {
        return readJsonObject(CUSTOM_PRODUCTS_KEY);
    }

    function getProductDatabaseItem(productId) {
        try {
            if (typeof database !== "undefined" && database && database[productId]) return database[productId];
        } catch (error) {}
        return {};
    }

    function resolveProductId(item) {
        const direct = cleanText(item && (item.key || item.productId || item.id || item.sku || item.productKey), "");
        if (direct) return direct;

        const name = cleanText(item && (item.name || item.productName || item.title), "").toLowerCase();
        if (!name) return "";

        try {
            if (typeof database !== "undefined" && database) {
                const found = Object.keys(database).find(function(id) {
                    const productName = cleanText(database[id] && database[id].name, "").toLowerCase();
                    return productName && productName === name;
                });
                if (found) return found;
            }
        } catch (error) {}

        const customProducts = readJsonObject("stylehub_admin_products_v1");
        return Object.keys(customProducts).find(function(id) {
            const productName = cleanText(customProducts[id] && customProducts[id].name, "").toLowerCase();
            return productName && productName === name;
        }) || "";
    }

    function normalizeStockItems(items) {
        const grouped = {};
        normalizeProducts(items).forEach(function(item) {
            const productId = resolveProductId(item);
            const qty = Math.max(1, Number(item.qty || item.quantity || 1) || 1);
            if (!productId) return;
            grouped[productId] = (grouped[productId] || 0) + qty;
        });
        return Object.keys(grouped).map(function(productId) {
            return { key: productId, qty: grouped[productId] };
        });
    }

    function isCancelledStockStatus(status) {
        const text = String(status || "").toLowerCase();
        return text.includes("hủy") || text.includes("huỷ") || text.includes("cancel");
    }

    function shouldAutoTrackStock(order, force) {
        if (force) return true;
        const createdAt = Number(order && order.createdAt) || getOrderCreatedAt(order || {});
        return createdAt >= STOCK_FEATURE_START_AT;
    }

    function notifyInventoryChanged() {
        try {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
                window.StyleHubProductAdmin.applyAdminProductsToDatabase();
            }
            localStorage.setItem("stylehub_inventory_updated_at", String(Date.now()));
            window.dispatchEvent(new CustomEvent("stylehub-inventory-change"));
            window.dispatchEvent(new StorageEvent("storage", { key: INVENTORY_KEY }));
        } catch (error) {}
    }

    function deductStockForOrder(order, options) {
        const normalized = normalizeOrder(order || {});
        const orderId = cleanText(normalized.orderId, "");
        if (!orderId || isCancelledStockStatus(normalized.status)) return;
        if (!shouldAutoTrackStock(normalized, options && options.force)) return;

        const items = normalizeStockItems(normalized.orderedProductsList || []);
        if (!items.length) return;

        const ledger = readJsonObject(STOCK_DEDUCTED_ORDERS_KEY);
        if (ledger[orderId] && !ledger[orderId].restored) return;

        const inventory = readJsonObject(INVENTORY_KEY);
        const appliedItems = [];
        items.forEach(function(item) {
            const productId = item.key;
            const qty = Math.max(1, Number(item.qty || 1) || 1);
            const currentRecord = inventory[productId] || {};
            const product = getProductDatabaseItem(productId);
            const currentStock = Math.max(0, Number(
                currentRecord.stock !== undefined ? currentRecord.stock :
                product.stock !== undefined ? product.stock : 20
            ) || 0);
            const nextStock = Math.max(0, currentStock - qty);
            inventory[productId] = Object.assign({}, currentRecord, {
                stock: nextStock,
                outOfStock: nextStock <= 0,
                updatedAt: Date.now(),
                lastOrderId: orderId
            });
            appliedItems.push({ key: productId, qty: qty });
        });

        if (!appliedItems.length) return;
        ledger[orderId] = {
            orderId: orderId,
            createdAt: Number(normalized.createdAt) || Date.now(),
            deductedAt: Date.now(),
            restored: false,
            items: appliedItems
        };
        saveJsonObject(INVENTORY_KEY, inventory);
        saveJsonObject(STOCK_DEDUCTED_ORDERS_KEY, ledger);
        saveInventoryMap(inventory).catch(function(error) { console.warn("Không thể đồng bộ tồn kho lên Firebase:", error); });
        notifyInventoryChanged();
    }

    function restoreStockForOrder(orderId) {
        const id = cleanText(orderId, "");
        if (!id) return;
        const ledger = readJsonObject(STOCK_DEDUCTED_ORDERS_KEY);
        const record = ledger[id];
        if (!record || record.restored || !Array.isArray(record.items) || !record.items.length) return;

        const inventory = readJsonObject(INVENTORY_KEY);
        record.items.forEach(function(item) {
            const productId = cleanText(item && item.key, "");
            const qty = Math.max(1, Number(item && item.qty || 1) || 1);
            if (!productId) return;
            const currentRecord = inventory[productId] || {};
            const product = getProductDatabaseItem(productId);
            const currentStock = Math.max(0, Number(
                currentRecord.stock !== undefined ? currentRecord.stock :
                product.stock !== undefined ? product.stock : 20
            ) || 0);
            const nextStock = currentStock + qty;
            inventory[productId] = Object.assign({}, currentRecord, {
                stock: nextStock,
                outOfStock: nextStock <= 0,
                updatedAt: Date.now(),
                restoredFromOrderId: id
            });
        });

        record.restored = true;
        record.restoredAt = Date.now();
        saveJsonObject(INVENTORY_KEY, inventory);
        saveJsonObject(STOCK_DEDUCTED_ORDERS_KEY, ledger);
        saveInventoryMap(inventory).catch(function(error) { console.warn("Không thể đồng bộ tồn kho lên Firebase:", error); });
        notifyInventoryChanged();
    }

    function syncStockDeductionsFromOrders(orders) {
        uniqueAndSort(orders || []).forEach(function(order) {
            const normalized = normalizeOrder(order || {});
            if (isCancelledStockStatus(normalized.status)) {
                restoreStockForOrder(normalized.orderId);
            } else {
                deductStockForOrder(normalized, { force: false });
            }
        });
    }

    function hasMeaningfulOrderData(order) {
        const safeOrder = order || {};
        const customer = getCustomerInfo(safeOrder);
        const products = normalizeProducts(getOrderItems(safeOrder));
        const total = parseMoney(safeOrder.totalPriceFormatted || safeOrder.totalPrice || safeOrder.grandTotal || safeOrder.total) || calculateTotalNumber(products);
        return isRealText(customer.name) || isRealText(customer.phone) || isRealText(customer.email) || isRealText(customer.address) || products.length > 0 || total > 0;
    }

    function getStatusKeyFromText(status) {
        const text = String(status || "").trim().toLowerCase();
        if (text.includes("hủy") || text.includes("cancel")) return "cancelled";
        if (text.includes("đã nhận") || text.includes("hoàn thành") || text.includes("đã giao") || text.includes("completed") || text.includes("done")) return "done";
        if (text.includes("đang giao") || text.includes("dang giao") || text.includes("shipping") || text.includes("in transit") || text.includes("delivering")) return "shipping";
        return "pending";
    }

    function normalizeOrder(order) {
        const safeOrder = order || {};
        const customer = getCustomerInfo(safeOrder);
        const orderId = cleanText(safeOrder.orderId || safeOrder.id || safeOrder.clientOrderUid, "STH" + Math.floor(100000 + Math.random() * 900000));
        const products = normalizeProducts(getOrderItems(safeOrder));
        const createdAt = getOrderCreatedAt(safeOrder);
        const updatedAt = Number(safeOrder.updatedAt || safeOrder.updated_at || createdAt || 0);
        const dateText = cleanText(safeOrder.orderDate || safeOrder.date || safeOrder.createdDate, createdAt ? new Date(createdAt).toLocaleString("vi-VN") : "");
        const totalText = cleanText(safeOrder.totalPriceFormatted || safeOrder.totalPrice || safeOrder.grandTotalFormatted || safeOrder.totalFormatted, calculateTotal(products));
        const statusText = cleanText(safeOrder.status || safeOrder.orderStatus, "Đang chờ xác nhận");
        const statusKey = cleanText(safeOrder.statusKey || safeOrder.status_key || safeOrder.orderStatusKey, getStatusKeyFromText(statusText));

        return Object.assign({}, safeOrder, {
            orderId: orderId,
            createdAt: createdAt,
            updatedAt: updatedAt,
            orderDate: dateText,
            date: dateText,
            status: statusText,
            statusKey: statusKey,
            userEmail: customer.email,
            customerEmail: customer.email,
            shippingEmail: firstText([safeOrder.shippingEmail, safeOrder.customerEmail, safeOrder.userEmail, customer.email], customer.email).toLowerCase(),
            userInfo: customer,
            orderedProductsList: products,
            totalPriceFormatted: totalText,
            cancelReason: cleanText(safeOrder.cancelReason || safeOrder.cancellationReason || safeOrder.cancel_reason, ""),
            cancelReasonNote: cleanText(safeOrder.cancelReasonNote || safeOrder.cancellationNote || safeOrder.cancel_note, ""),
            cancelledBy: cleanText(safeOrder.cancelledBy || safeOrder.cancelled_by, ""),
            cancelledAt: cleanText(safeOrder.cancelledAt || safeOrder.cancelled_at, ""),
            confirmedAt: cleanText(safeOrder.confirmedAt || safeOrder.confirmed_at, ""),
            completedAt: cleanText(safeOrder.completedAt || safeOrder.completed_at, ""),
            addressUpdatedAt: cleanText(safeOrder.addressUpdatedAt || safeOrder.address_updated_at, ""),
            addressUpdatedBy: cleanText(safeOrder.addressUpdatedBy || safeOrder.address_updated_by, "")
        });
    }

    function shouldKeepOrder(order) {
        const normalized = normalizeOrder(order);
        if (!normalized.orderId) return false;
        return hasMeaningfulOrderData(normalized);
    }

    function scoreOrder(order) {
        const normalized = normalizeOrder(order);
        let score = 0;
        if (isRealText(normalized.userInfo.name)) score += 4;
        if (isRealText(normalized.userInfo.phone)) score += 4;
        if (isRealText(normalized.userInfo.email)) score += 3;
        if (isRealText(normalized.userInfo.address)) score += 3;
        score += normalized.orderedProductsList.length * 5;
        if (parseMoney(normalized.totalPriceFormatted) > 0) score += 4;
        if (Number(normalized.createdAt) > 0) score += 2;
        return score;
    }

    function mergeOrderData(current, incoming) {
        const a = normalizeOrder(current);
        const b = normalizeOrder(incoming);
        if (!a || !a.orderId) return b;
        if (!b || !b.orderId) return a;

        const richer = scoreOrder(b) >= scoreOrder(a) ? b : a;
        const latest = Number(b.updatedAt || b.createdAt || 0) >= Number(a.updatedAt || a.createdAt || 0) ? b : a;
        return normalizeOrder(Object.assign({}, richer, latest, {
            userInfo: scoreOrder(b) >= scoreOrder(a) ? b.userInfo : a.userInfo,
            orderedProductsList: (richer.orderedProductsList && richer.orderedProductsList.length) ? richer.orderedProductsList : latest.orderedProductsList,
            totalPriceFormatted: parseMoney(richer.totalPriceFormatted) > 0 ? richer.totalPriceFormatted : latest.totalPriceFormatted
        }));
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
            if (!order || !shouldKeepOrder(order)) return;
            const normalized = normalizeOrder(order);
            if (map.has(normalized.orderId)) {
                map.set(normalized.orderId, mergeOrderData(map.get(normalized.orderId), normalized));
            } else {
                map.set(normalized.orderId, normalized);
            }
        });
        return Array.from(map.values()).sort(function (a, b) {
            return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
        });
    }

    async function saveOrder(order) {
        const normalized = saveLocalOrder(order);
        deductStockForOrder(normalized, { force: true });
        if (initFirebase()) {
            await firebaseDatabase.ref(DB_ROOT + "/" + normalized.orderId).set(normalized);
        }
        return normalized;
    }

    function getAllLocalOrders() {
        let all = [];
        getLocalOrderKeys().forEach(function (key) { all = all.concat(safeParse(key)); });
        return all;
    }

    function findLocalOrderById(orderId) {
        const id = cleanText(orderId, "");
        if (!id) return null;
        let best = null;
        getAllLocalOrders().forEach(function(order) {
            if (!order || cleanText(order.orderId || order.id || order.clientOrderUid, "") !== id) return;
            const normalized = normalizeOrder(order);
            if (!best || scoreOrder(normalized) > scoreOrder(best)) best = normalized;
        });
        return best;
    }

    async function getCloudOrderById(orderId) {
        if (!initFirebase()) return null;
        try {
            const snapshot = await firebaseDatabase.ref(DB_ROOT + "/" + orderId).once("value");
            return snapshot.val() || null;
        } catch (error) {
            console.warn("Không đọc được đơn cloud trước khi cập nhật:", error);
            return null;
        }
    }

    async function saveMergedOrderPatch(orderId, patch) {
        const id = cleanText(orderId, "");
        if (!id) return normalizeOrder(patch || {});
        const safePatch = patch && typeof patch === "object" ? patch : {};
        const localBase = findLocalOrderById(id) || { orderId: id };
        const cloudBase = await getCloudOrderById(id);
        const base = cloudBase ? mergeOrderData(localBase, cloudBase) : normalizeOrder(localBase);
        const merged = normalizeOrder(Object.assign({}, base, safePatch, {
            orderId: id,
            updatedAt: safePatch.updatedAt || Date.now()
        }));

        updateLocalOrder(id, merged);
        if (initFirebase()) {
            await firebaseDatabase.ref(DB_ROOT + "/" + id).set(merged);
        }
        return merged;
    }

    async function getAllOrders() {
        let all = getAllLocalOrders();
        if (initFirebase()) {
            const snapshot = await firebaseDatabase.ref(DB_ROOT).once("value");
            const value = snapshot.val() || {};
            all = Object.keys(value).map(function (key) { return value[key]; }).concat(all);
        }
        const orders = uniqueAndSort(all);
        syncStockDeductionsFromOrders(orders);
        return orders;
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

    async function updateOrderDetails(orderId, extraPatch) {
        const safeExtraPatch = extraPatch && typeof extraPatch === "object" ? extraPatch : {};
        const patch = Object.assign({}, safeExtraPatch, { updatedAt: Date.now() });

        // Không ghi patch rời lên Firebase nữa. Nếu order chưa có trên cloud,
        // Firebase .update(patch) sẽ tạo một đơn chỉ có địa chỉ/status nhưng mất sản phẩm, ngày và tổng tiền.
        // Vì vậy phải merge với bản local/cloud đầy đủ rồi set lại nguyên order.
        return saveMergedOrderPatch(orderId, patch);
    }

    async function updateOrderStatus(orderId, status, extraPatch) {
        const safeExtraPatch = extraPatch && typeof extraPatch === "object" ? extraPatch : {};
        const statusKey = getStatusKeyFromText(status);
        const patch = Object.assign({}, safeExtraPatch, { status: status, statusKey: statusKey, updatedAt: Date.now() });
        if (statusKey === "shipping") {
            patch.confirmedAt = patch.confirmedAt || new Date().toLocaleString("vi-VN");
            patch.shippingStartedAt = patch.shippingStartedAt || new Date().toLocaleString("vi-VN");
        }
        if (statusKey === "done") patch.completedAt = new Date().toLocaleString("vi-VN");
        if (isCancelledStockStatus(status)) {
            patch.cancelledAt = patch.cancelledAt || new Date().toLocaleString("vi-VN");
            restoreStockForOrder(orderId);
        }

        await saveMergedOrderPatch(orderId, patch);
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
                const orders = uniqueAndSort(Object.keys(value).map(function (key) { return value[key]; }));
                syncStockDeductionsFromOrders(orders);
                callback(orders);
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
        updateOrderDetails: updateOrderDetails,
        deleteOrder: deleteOrder,
        onOrdersChanged: onOrdersChanged,
        normalizeOrder: normalizeOrder,
        deductStockForOrder: deductStockForOrder,
        restoreStockForOrder: restoreStockForOrder,
        getInventoryMap: getInventoryMap,
        saveInventoryMap: saveInventoryMap,
        setProductStock: setProductStock,
        startInventoryRealtime: startInventoryRealtime,
        getCustomProductsMap: getCustomProductsMap,
        saveCustomProductsMap: saveCustomProductsMap,
        startCustomProductsRealtime: startCustomProductsRealtime
    };

    startInventoryRealtime();
    startCustomProductsRealtime();
})();
