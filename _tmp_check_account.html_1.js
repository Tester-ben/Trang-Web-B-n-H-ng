
        
        function openSearchBox() {
            document.getElementById("searchBox").style.display = "block";
        }

        function closeSearchBox() {
            document.getElementById("searchBox").style.display = "none";
        }

        const checkLogin = localStorage.getItem('isLoggedInStatus') === 'true';

        document.addEventListener("DOMContentLoaded", function() {

        document.getElementById("search-trigger").onclick = function () {
            openSearchBox();
        };

        if (!checkLogin) {
            // Chưa đăng nhập thì quay về trang chủ để đăng nhập lại, không hiện popup lỗi.
            window.location.replace("index.html");
            return;
        }

        syncHeaderUsername();
        renderProfileData();
        renderOrdersData();
        window.addEventListener('storage', function(event) {
            if (event.key && event.key.indexOf('hub_orders') === 0) {
                renderOrdersData();
            }
        });
        });

        function syncHeaderUsername() {
            const headerLinks = document.querySelectorAll('#account-trigger, #headerAccountLink');
            const savedName = localStorage.getItem('hub_name') || "ACCOUNT";
            headerLinks.forEach(function(headerLink) {
                headerLink.innerText = savedName.toUpperCase();
                headerLink.href = "account.html";
            });
        }

        function switchAccountTab(tabId, buttonElement) {
            // Xóa hoạt động cũ
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));
            
            // Kích hoạt tab mới
            buttonElement.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        }

        function renderProfileData() {
            document.getElementById('displayFullName').innerText = localStorage.getItem('hub_name') || "USER";
            document.getElementById('displayPhone').innerText = localStorage.getItem('hub_phone') || "090 XXXXXXX";
            document.getElementById('displayAddress').innerText = localStorage.getItem('hub_address') || "Chưa cập nhật địa chỉ giao hàng";
        }

        function getCurrentUserEmail() {
            return (
                localStorage.getItem('hub_current_user_key') ||
                localStorage.getItem('hub_email') ||
                localStorage.getItem('hub_shipping_email') ||
                ''
            ).trim().toLowerCase();
        }

        function safeParseOrders(storageKey) {
            try {
                const orders = JSON.parse(localStorage.getItem(storageKey) || '[]');
                return Array.isArray(orders) ? orders : [];
            } catch (error) {
                return [];
            }
        }

        function getOrderOwnerEmail(order) {
            return String(
                order.userEmail ||
                order.customerEmail ||
                order.shippingEmail ||
                order.email ||
                order.hub_email ||
                order.ownerEmail ||
                (order.userInfo && order.userInfo.email) ||
                ''
            ).trim().toLowerCase();
        }

        function getOrdersForCurrentUser() {
            const email = getCurrentUserEmail();
            if (!email) return [];

            const userNameKey = `hub_orders_${(localStorage.getItem('hub_name') || '').trim().toLowerCase().replace(/\s+/g, '_')}`;
            const perUserKey = `hub_orders_${email}`;
            const perUserOrders = safeParseOrders(perUserKey);
            const nameKeyOrders = safeParseOrders(userNameKey);
            const globalOrders = safeParseOrders('hub_orders').filter(order => getOrderOwnerEmail(order) === email);

            // Global để sau cùng để nếu admin cập nhật trạng thái thì trạng thái mới sẽ ghi đè bản cũ.
            const merged = [...perUserOrders, ...nameKeyOrders, ...globalOrders];
            const orderMap = new Map();

            merged.forEach(order => {
                if (!order) return;
                const key = order.orderId || JSON.stringify(order);
                orderMap.set(key, order);
            });

            return Array.from(orderMap.values());
        }

        function getAccountStatusClass(status) {
            const normalizedStatus = String(status || '').toLowerCase();
            if (normalizedStatus.includes('giao')) return 'order-status-shipping';
            if (normalizedStatus.includes('nhận') || normalizedStatus.includes('hoàn')) return 'order-status-done';
            return 'order-status-pending';
        }

        function renderOrdersData() {
            const container = document.getElementById('injectOrdersContainer');
            container.innerHTML = '';

            const ordersList = getOrdersForCurrentUser();
            
            if(ordersList.length === 0) {
                container.innerHTML = `<p style="font-size: 13px; color: #888; text-align: center; padding: 40px 0;">You haven't placed any orders yet.</p>`;
                return;
            }

            ordersList.forEach(order => {
                const card = document.createElement('div');
                card.className = 'order-item-card';
                
                let productsHTML = '';
                (order.orderedProductsList || []).forEach(item => {
                    productsHTML += `
                        <div class="order-product-row">
                            <span>• ${item.name} (Size: ${item.size || '-'})</span>
                            <strong>x${item.qty || item.quantity || 1}</strong>
                        </div>
                    `;
                });

                const status = order.status || 'Đang chờ xác nhận';
                const statusClass = getAccountStatusClass(status);
                const orderDate = order.orderDate || order.date || '';

                card.innerHTML = `
                    <div class="order-card-top">
                        <span>ID: ${order.orderId || 'N/A'}</span>
                        <span class="order-status-badge ${statusClass}">${status}</span>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-bottom: 12px;">Date: ${orderDate}</div>
                    <div class="order-products-body">${productsHTML}</div>
                    <div class="order-card-bottom">
                        <span>Total Price:</span>
                        <span>${order.totalPriceFormatted || order.totalPrice || ''}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        }
        function searchProducts() {

        const keyword =
            document.getElementById("searchInput").value.toLowerCase();

        const resultsBox =
            document.getElementById("searchResults");

        resultsBox.innerHTML = "";

        if (keyword.trim() === "") return;

        const results = Object.keys(database).filter(id => {
            const item = database[id];
            return item.name &&
                item.name.toLowerCase().includes(keyword);
        });

        results.forEach(id => {

            const item = database[id];

            resultsBox.innerHTML += `
                <div
                    onclick="window.location.href='product-detail.html?id=${id}'"
                    style="padding:12px 0;border-bottom:1px solid #eee;cursor:pointer;">

                    <strong>${item.name}</strong><br>

                    <small>${item.price}</small>

                </div>
            `;
        });

        }
        function executeLogout() {
            localStorage.setItem('isLoggedInStatus', 'false');
            localStorage.removeItem('hub_name');
            localStorage.removeItem('hub_email');
            localStorage.removeItem('hub_current_user_key');
            window.location.href = "index.html"; // Trở về trang chủ sau khi thoát
        }
    