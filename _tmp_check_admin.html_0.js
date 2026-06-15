
    const ADMIN_PASSWORD = "admin123";

    function loginAdmin() {
        const passwordInput = document.getElementById('adminPassword');
        const errorBox = document.getElementById('loginError');
        const password = passwordInput.value.trim();

        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('stylehub_admin_logged_in', 'true');
            errorBox.textContent = '';
            showAdminScreen();
        } else {
            errorBox.textContent = 'Sai mật khẩu admin. Vui lòng nhập lại.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    function logoutAdmin() {
        sessionStorage.removeItem('stylehub_admin_logged_in');
        document.getElementById('admin-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }

    function showAdminScreen() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-screen').style.display = 'block';
        renderOrders();
    }

    document.getElementById('adminPassword').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') loginAdmin();
    });

    function safeParseOrders(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function saveOrders(key, orders) {
        localStorage.setItem(key, JSON.stringify(orders));
    }

    function getOrderKeys() {
        return Object.keys(localStorage).filter(function(key) {
            return key === 'hub_orders' || key.indexOf('hub_orders_') === 0;
        });
    }

    function updateOrderEverywhere(orderId, updater) {
        getOrderKeys().forEach(function(key) {
            const orders = safeParseOrders(key);
            let changed = false;
            const updatedOrders = orders.map(function(order) {
                if (order && order.orderId === orderId) {
                    changed = true;
                    return updater(Object.assign({}, order));
                }
                return order;
            });
            if (changed) saveOrders(key, updatedOrders);
        });
    }

    function deleteOrderEverywhere(orderId) {
        getOrderKeys().forEach(function(key) {
            const orders = safeParseOrders(key);
            const filtered = orders.filter(function(order) {
                return !order || order.orderId !== orderId;
            });
            if (filtered.length !== orders.length) saveOrders(key, filtered);
        });
    }

    function calculateTotal(items) {
        if (!Array.isArray(items)) return '0 ₫';
        let total = 0;
        items.forEach(function(item) {
            const priceText = String(item.price || item.priceFormatted || '0');
            const price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || Number(item.priceNum) || 0;
            const quantity = Number(item.qty || item.quantity || 1);
            total += price * quantity;
        });
        return total.toLocaleString('vi-VN') + ' ₫';
    }

    function getStatusClass(status) {
        const normalizedStatus = String(status || '').toLowerCase();
        if (normalizedStatus.includes('giao')) return 'status-shipping';
        if (normalizedStatus.includes('nhận') || normalizedStatus.includes('hoàn')) return 'status-done';
        return 'status-pending';
    }

    function getCustomerInfo(order) {
        const info = order.userInfo || {};
        return {
            name: info.name || order.customerName || order.name || 'N/A',
            phone: info.phone || order.customerPhone || order.phone || 'N/A',
            email: info.email || order.userEmail || order.customerEmail || order.shippingEmail || order.email || 'N/A',
            address: info.address || order.customerAddress || order.address || 'Chưa cập nhật địa chỉ'
        };
    }

    function renderOrders() {
        const orders = safeParseOrders('hub_orders');
        const container = document.getElementById('admin-orders');
        const orderCount = document.getElementById('orderCount');
        orderCount.textContent = orders.length + ' đơn hàng';

        if (orders.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có đơn hàng nào.</div>';
            return;
        }

        container.innerHTML = orders.map(function(order) {
            const items = Array.isArray(order.orderedProductsList) ? order.orderedProductsList : [];
            const customer = getCustomerInfo(order);
            const status = order.status || 'Đang chờ xác nhận';
            const statusClass = getStatusClass(status);
            const displayTotal = order.totalPriceFormatted || order.totalPrice || calculateTotal(items);
            const date = order.orderDate || order.date || 'N/A';
            const orderId = order.orderId || 'N/A';
            const isShipping = String(status).toLowerCase().includes('giao');
            const isDone = String(status).toLowerCase().includes('nhận') || String(status).toLowerCase().includes('hoàn');

            return `
                <article class="order-card">
                    <div class="order-header">
                        <strong class="order-id">Mã đơn: ${orderId}</strong>
                        <span class="status-badge ${statusClass}">${status}</span>
                    </div>

                    <div class="customer-grid">
                        <div>🕒 <b>Thời gian đặt:</b> ${date}</div>
                        <div>👤 <b>Khách hàng:</b> ${customer.name}</div>
                        <div>📞 <b>Số điện thoại:</b> ${customer.phone}</div>
                        <div>✉️ <b>Email:</b> ${customer.email}</div>
                        <div style="grid-column: 1 / -1;">🏠 <b>Địa chỉ:</b> ${customer.address}</div>
                    </div>

                    <div class="product-list">
                        ${items.length ? items.map(function(item) {
                            return `
                                <div class="product-item">
                                    <span>• ${item.name || 'Sản phẩm'} (Size: ${item.size || '-'}) x ${item.qty || item.quantity || 1}</span>
                                    <span>${item.price || ''}</span>
                                </div>
                            `;
                        }).join('') : '<div class="product-item"><span>Không có dữ liệu sản phẩm</span><span></span></div>'}
                    </div>

                    <div class="total-price">TỔNG CỘNG: ${displayTotal}</div>
                    <div class="btn-group">
                        ${(!isShipping && !isDone) ? `<button class="btn btn-confirm" onclick="confirmOrder('${orderId}')">Xác nhận đơn hàng</button>` : ''}
                        ${(!isDone) ? `<button class="btn btn-complete" onclick="completeOrder('${orderId}')">Đã giao xong</button>` : ''}
                        <button class="btn btn-delete" onclick="removeOrder('${orderId}')">Xóa đơn</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function confirmOrder(orderId) {
        if (!orderId || orderId === 'N/A') return;
        updateOrderEverywhere(orderId, function(order) {
            order.status = 'Đang giao';
            order.confirmedAt = new Date().toLocaleString('vi-VN');
            return order;
        });
        renderOrders();
        alert('Đã xác nhận đơn hàng. Bên tài khoản khách sẽ hiện trạng thái: Đang giao.');
    }

    function completeOrder(orderId) {
        if (!orderId || orderId === 'N/A') return;
        updateOrderEverywhere(orderId, function(order) {
            order.status = 'Đã nhận hàng';
            order.completedAt = new Date().toLocaleString('vi-VN');
            return order;
        });
        renderOrders();
    }

    function removeOrder(orderId) {
        if (!orderId || orderId === 'N/A') return;
        if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này không?')) return;
        deleteOrderEverywhere(orderId);
        renderOrders();
    }

    window.addEventListener('storage', renderOrders);

    if (sessionStorage.getItem('stylehub_admin_logged_in') === 'true') {
        showAdminScreen();
    } else {
        document.getElementById('adminPassword').focus();
    }
