/* =========================================================
   THE STYLE HUB - NOTIFICATION BELL
   - Hiển thị chuông thông báo ở các trang collection / home / product detail
   - Lưu thư cảm ơn khi khách đặt hàng thành công
   ========================================================= */
(function () {
    const STYLE_ID = "stylehub-notification-style";
    const ROOT_SELECTOR = "[data-stylehub-notification-bell]";
    const STORAGE_PREFIX = "stylehub_notifications_";

    function normalizeKey(value) {
        return String(value || "guest").trim().toLowerCase().replace(/\s+/g, "_");
    }

    function getCurrentUserKey() {
        return normalizeKey(
            localStorage.getItem("hub_current_user_key") ||
            localStorage.getItem("hub_email") ||
            localStorage.getItem("hub_last_user_email") ||
            "guest"
        );
    }

    function getStorageKey(userKey) {
        return STORAGE_PREFIX + normalizeKey(userKey || getCurrentUserKey());
    }

    function loadNotifications(userKey) {
        try {
            const raw = localStorage.getItem(getStorageKey(userKey));
            const list = JSON.parse(raw || "[]");
            return Array.isArray(list) ? list : [];
        } catch (error) {
            return [];
        }
    }

    function saveNotifications(list, userKey) {
        localStorage.setItem(getStorageKey(userKey), JSON.stringify(list.slice(0, 30)));
    }

    function formatTime(dateValue) {
        const date = dateValue ? new Date(dateValue) : new Date();
        if (Number.isNaN(date.getTime())) return new Date().toLocaleString("vi-VN");
        return date.toLocaleString("vi-VN");
    }

    function escapeHTML(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getOrderProductsText(order) {
        const products = order && (order.orderedProductsList || order.items || order.products);
        if (!Array.isArray(products) || !products.length) return "Đơn hàng của bạn";
        return products.map(function (item) {
            const name = item.name || item.title || "Sản phẩm";
            const size = item.size ? " - Size " + item.size : "";
            const qty = item.qty || item.quantity || 1;
            return name + size + " x" + qty;
        }).join(", ");
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .stylehub-notification-root {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                z-index: 1005;
            }

            .stylehub-bell-btn {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                border: 1px solid rgba(17,17,17,.18);
                background: #ffffff;
                color: #111111;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 17px;
                line-height: 1;
                position: relative;
                transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
            }

            .main-header .stylehub-bell-btn {
                width: 28px;
                height: 28px;
                font-size: 14px;
                background: transparent;
                border-color: rgba(255,255,255,.28);
                color: #ffffff;
            }

            .stylehub-bell-btn:hover {
                transform: translateY(-1px);
                border-color: #111111;
                box-shadow: 0 8px 22px rgba(0,0,0,.12);
            }

            .main-header .stylehub-bell-btn:hover {
                border-color: rgba(255,255,255,.8);
                box-shadow: 0 8px 22px rgba(0,0,0,.25);
            }

            .stylehub-bell-count {
                position: absolute;
                top: -6px;
                right: -7px;
                min-width: 17px;
                height: 17px;
                padding: 0 5px;
                border-radius: 999px;
                background: #0b3030;
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                display: none;
                align-items: center;
                justify-content: center;
                border: 1px solid #ffffff;
            }

            .stylehub-bell-count.show {
                display: inline-flex;
            }

            .stylehub-notification-panel {
                position: absolute;
                top: calc(100% + 12px);
                right: 0;
                width: 360px;
                max-height: 460px;
                overflow-y: auto;
                background: #ffffff;
                color: #111111;
                border: 1px solid #eeeeee;
                box-shadow: 0 18px 45px rgba(0,0,0,.18);
                padding: 18px;
                display: none;
                text-align: left;
            }

            .stylehub-notification-root.open .stylehub-notification-panel {
                display: block;
            }

            .stylehub-notification-panel::before {
                content: "";
                position: absolute;
                top: -8px;
                right: 14px;
                width: 14px;
                height: 14px;
                background: #ffffff;
                border-left: 1px solid #eeeeee;
                border-top: 1px solid #eeeeee;
                transform: rotate(45deg);
            }

            .stylehub-notification-title {
                font-size: 12px;
                letter-spacing: 1.8px;
                text-transform: uppercase;
                font-weight: 700;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eeeeee;
            }

            .stylehub-notification-empty {
                padding: 26px 8px;
                text-align: center;
                color: #888888;
                font-size: 13px;
                line-height: 1.5;
            }

            .stylehub-notification-card {
                border: 1px solid #eeeeee;
                background: #fbfbfb;
                padding: 14px;
                margin-bottom: 12px;
            }

            .stylehub-notification-card.unread {
                border-color: #0b3030;
                background: #f4fbfa;
            }

            .stylehub-notification-card h4 {
                font-size: 13px;
                margin: 0 0 7px 0;
                letter-spacing: .5px;
                color: #111111;
            }

            .stylehub-notification-card p {
                font-size: 12px;
                line-height: 1.55;
                margin: 0 0 8px 0;
                color: #444444;
            }

            .stylehub-notification-meta {
                font-size: 10px;
                color: #888888;
                letter-spacing: .5px;
                text-transform: uppercase;
            }

            .stylehub-notification-actions {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-top: 14px;
                padding-top: 12px;
                border-top: 1px solid #eeeeee;
            }

            .stylehub-notification-link,
            .stylehub-notification-clear {
                background: transparent;
                border: none;
                color: #111111;
                font-size: 11px;
                letter-spacing: 1px;
                text-transform: uppercase;
                cursor: pointer;
                padding: 0;
                text-decoration: underline;
            }

            .stylehub-notification-clear {
                color: #999999;
            }

            .filter-right-sort[data-stylehub-notification-bell] {
                min-width: 38px;
                justify-content: flex-end;
                display: flex;
            }

            .home-bag-notify-wrap,
            .pd-bag-notify-wrap {
                display: inline-flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                vertical-align: middle;
            }

            .home-bag-notify-wrap > a,
            .pd-bag-notify-wrap > a {
                margin-left: 0 !important;
            }

            .home-notification-bell,
            .pd-notification-bell {
                display: inline-flex;
                justify-content: center;
            }

            @media (max-width: 768px) {
                .stylehub-notification-panel {
                    position: fixed;
                    top: 74px;
                    left: 16px;
                    right: 16px;
                    width: auto;
                    max-height: 70vh;
                }

                .stylehub-notification-panel::before {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function buildPanelHTML(notifications) {
        if (!notifications.length) {
            return `
                <div class="stylehub-notification-title">Thông báo</div>
                <div class="stylehub-notification-empty">
                    Chưa có thông báo mới.<br>
                    Khi bạn đặt hàng thành công, thư cảm ơn sẽ xuất hiện ở đây.
                </div>
            `;
        }

        const cards = notifications.map(function (noti) {
            return `
                <div class="stylehub-notification-card ${noti.read ? "" : "unread"}">
                    <h4>${escapeHTML(noti.title || "Thông báo mới")}</h4>
                    <p>${escapeHTML(noti.message || "")}</p>
                    ${noti.products ? `<p><strong>Sản phẩm:</strong> ${escapeHTML(noti.products)}</p>` : ""}
                    ${noti.total ? `<p><strong>Tổng tiền:</strong> ${escapeHTML(noti.total)}</p>` : ""}
                    <div class="stylehub-notification-meta">${escapeHTML(noti.createdText || "")}</div>
                </div>
            `;
        }).join("");

        return `
            <div class="stylehub-notification-title">Thông báo</div>
            ${cards}
            <div class="stylehub-notification-actions">
                <button type="button" class="stylehub-notification-link" data-open-account>Đơn hàng của tôi</button>
                <button type="button" class="stylehub-notification-clear" data-clear-notifications>Xóa thông báo</button>
            </div>
        `;
    }

    function renderRoot(root) {
        if (!root) return;
        root.classList.add("stylehub-notification-root");

        const notifications = loadNotifications();
        const unread = notifications.filter(function (item) { return !item.read; }).length;

        root.innerHTML = `
            <button type="button" class="stylehub-bell-btn" aria-label="Thông báo đơn hàng">
                🔔
                <span class="stylehub-bell-count ${unread ? "show" : ""}">${unread > 9 ? "9+" : unread}</span>
            </button>
            <div class="stylehub-notification-panel">
                ${buildPanelHTML(notifications)}
            </div>
        `;

        const btn = root.querySelector(".stylehub-bell-btn");
        const panel = root.querySelector(".stylehub-notification-panel");

        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            document.querySelectorAll(".stylehub-notification-root.open").forEach(function (item) {
                if (item !== root) item.classList.remove("open");
            });

            root.classList.toggle("open");

            if (root.classList.contains("open")) {
                const list = loadNotifications().map(function (item) {
                    return Object.assign({}, item, { read: true });
                });
                saveNotifications(list);
                const count = root.querySelector(".stylehub-bell-count");
                if (count) {
                    count.textContent = "0";
                    count.classList.remove("show");
                }
            }
        });

        if (panel) {
            panel.addEventListener("click", function (event) {
                event.stopPropagation();

                if (event.target.closest("[data-open-account]")) {
                    window.location.href = "account.html";
                    return;
                }

                if (event.target.closest("[data-clear-notifications]")) {
                    saveNotifications([]);
                    renderAllBells();
                }
            });
        }
    }

    function renderAllBells() {
        injectStyle();
        document.querySelectorAll(ROOT_SELECTOR).forEach(renderRoot);
    }

    function addOrderSuccessNotification(order) {
        const orderId = order && (order.orderId || order.id) || ("STH" + Math.floor(100000 + Math.random() * 900000));
        const userKey = normalizeKey(
            order && (
                order.userEmail ||
                order.customerEmail ||
                order.shippingEmail ||
                (order.userInfo && order.userInfo.email)
            ) || getCurrentUserKey()
        );

        const notification = {
            id: "order_success_" + orderId + "_" + Date.now(),
            type: "order-success",
            title: "Đặt hàng thành công",
            message: "THE STYLE HUB cảm ơn bạn đã đặt hàng. Mã đơn " + orderId + " đã được ghi nhận và đang chờ xác nhận.",
            products: getOrderProductsText(order),
            total: order && (order.totalPriceFormatted || order.total || ""),
            orderId: orderId,
            createdAt: Date.now(),
            createdText: formatTime(Date.now()),
            read: false
        };

        const list = loadNotifications(userKey);
        list.unshift(notification);
        saveNotifications(list, userKey);

        const currentKey = getCurrentUserKey();
        if (currentKey !== userKey) {
            const currentList = loadNotifications(currentKey);
            currentList.unshift(notification);
            saveNotifications(currentList, currentKey);
        }

        renderAllBells();
    }

    document.addEventListener("click", function () {
        document.querySelectorAll(".stylehub-notification-root.open").forEach(function (root) {
            root.classList.remove("open");
        });
    });

    document.addEventListener("DOMContentLoaded", renderAllBells);

    window.StyleHubNotifications = {
        addOrderSuccessNotification: addOrderSuccessNotification,
        renderAllBells: renderAllBells,
        loadNotifications: loadNotifications
    };
})();
