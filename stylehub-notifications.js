/* =========================================================
   THE STYLE HUB - NOTIFICATION BELL
   - Hiển thị chuông thông báo ở các trang collection / home / product detail
   - Lưu thư cảm ơn khi khách đặt hàng thành công
   ========================================================= */
(function () {
    const STYLE_ID = "stylehub-notification-style";
    const ROOT_SELECTOR = "[data-stylehub-notification-bell]";
    const STORAGE_PREFIX = "stylehub_notifications_";
    const BELL_POS_KEY = "stylehub_notification_bell_position_like_ai";

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
                position: fixed !important;
                right: 82px;
                bottom: calc(24px + 76px);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                z-index: 99989 !important;
                user-select: none;
                touch-action: none;
                will-change: transform, right, bottom;
                transform: translate3d(0, 0, 0);
            }

            .stylehub-bell-btn {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                border: 1px solid rgba(17,17,17,.18);
                background: #ffffff;
                color: #111111;
                cursor: grab;
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

            .stylehub-notification-root.dragging {
                transition: none !important;
            }

            .stylehub-notification-root.dragging .stylehub-bell-btn {
                cursor: grabbing;
                transform: none !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.20);
            }

            .stylehub-notification-root.dragging .stylehub-notification-panel {
                display: none !important;
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
                bottom: calc(100% + 12px);
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
                bottom: -8px;
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

            /* ===== FINAL FIX: chuông không bị header / featured menu đè ===== */
            .stylehub-notification-root {
                z-index: 999999 !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] {
                position: relative !important;
                z-index: 999999 !important;
                min-width: 42px;
                display: flex !important;
                justify-content: flex-end !important;
                align-items: center !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] .stylehub-notification-panel {
                z-index: 1000000 !important;
            }

            .home-notification-bell,
            .pd-notification-bell {
                position: fixed !important;
                right: 104px !important;
                bottom: 24px !important;
                top: auto !important;
                z-index: 999999 !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .home-bag-notify-wrap,
            .pd-bag-notify-wrap {
                display: inline !important;
                flex-direction: initial !important;
                gap: 0 !important;
            }

            .home-bag-notify-wrap > a,
            .pd-bag-notify-wrap > a {
                margin-left: 18px !important;
            }

            .home-notification-bell .stylehub-bell-btn,
            .pd-notification-bell .stylehub-bell-btn {
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.22) !important;
                font-size: 22px !important;
            }

            .home-notification-bell .stylehub-bell-btn:hover,
            .pd-notification-bell .stylehub-bell-btn:hover {
                transform: translateY(-2px) !important;
                border-color: #0b3030 !important;
                box-shadow: 0 16px 36px rgba(0,0,0,.28) !important;
            }

            .home-notification-bell .stylehub-notification-panel,
            .pd-notification-bell .stylehub-notification-panel {
                top: auto !important;
                bottom: calc(100% + 14px) !important;
                right: 0 !important;
                z-index: 1000000 !important;
            }

            .home-notification-bell .stylehub-notification-panel::before,
            .pd-notification-bell .stylehub-notification-panel::before {
                top: auto !important;
                bottom: -8px !important;
                right: 20px !important;
                border-top: none !important;
                border-left: none !important;
                border-right: 1px solid #eeeeee !important;
                border-bottom: 1px solid #eeeeee !important;
            }

            @media (max-width: 768px) {
                .home-notification-bell,
                .pd-notification-bell {
                    right: 92px !important;
                    bottom: 22px !important;
                }

                .home-notification-bell .stylehub-bell-btn,
                .pd-notification-bell .stylehub-bell-btn {
                    width: 52px !important;
                    height: 52px !important;
                    font-size: 20px !important;
                }
            }


            /* ===== PRODUCT DETAIL BELL TOP FIX ===== */
            .pd-notification-bell {
                position: fixed !important;
                top: 88px !important;
                right: 66px !important;
                bottom: auto !important;
                z-index: 999999 !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .pd-notification-bell .stylehub-bell-btn {
                width: 42px !important;
                height: 42px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 10px 25px rgba(0,0,0,.14) !important;
                font-size: 18px !important;
            }

            .pd-notification-bell .stylehub-bell-btn:hover {
                transform: translateY(-2px) !important;
                border-color: #0b3030 !important;
                box-shadow: 0 16px 36px rgba(0,0,0,.22) !important;
            }

            .pd-notification-bell .stylehub-notification-panel {
                top: calc(100% + 12px) !important;
                bottom: auto !important;
                right: 0 !important;
                z-index: 1000000 !important;
            }

            .pd-notification-bell .stylehub-notification-panel::before {
                top: -8px !important;
                bottom: auto !important;
                right: 20px !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: 1px solid #eeeeee !important;
                border-top: 1px solid #eeeeee !important;
            }

            @media (max-width: 768px) {
                .pd-notification-bell {
                    top: 76px !important;
                    right: 20px !important;
                    bottom: auto !important;
                }

                .pd-notification-bell .stylehub-bell-btn {
                    width: 38px !important;
                    height: 38px !important;
                    font-size: 17px !important;
                }
            }


            /* ===== POLICY/HOME BELL POSITION FIX ===== */
            .home-notification-bell {
                position: fixed !important;
                right: 104px !important;
                bottom: 24px !important;
                top: auto !important;
                z-index: 999999 !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .home-notification-bell .stylehub-bell-btn {
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.22) !important;
                font-size: 22px !important;
            }

            .home-notification-bell .stylehub-notification-panel {
                top: auto !important;
                bottom: calc(100% + 14px) !important;
                right: 0 !important;
                z-index: 1000000 !important;
            }

            .home-notification-bell .stylehub-notification-panel::before {
                top: auto !important;
                bottom: -8px !important;
                right: 20px !important;
                border-top: none !important;
                border-left: none !important;
                border-right: 1px solid #eeeeee !important;
                border-bottom: 1px solid #eeeeee !important;
            }


            /* ===== FIXED BELL ALL PAGES + RESTORE HOODIES PAGE 2 ===== */
            .stylehub-notification-root {
                z-index: 999999 !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] {
                position: fixed !important;
                top: 88px !important;
                right: 66px !important;
                z-index: 999999 !important;
                min-width: 42px !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] .stylehub-bell-btn {
                width: 42px !important;
                height: 42px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 10px 25px rgba(0,0,0,.14) !important;
                font-size: 18px !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] .stylehub-notification-panel {
                top: calc(100% + 12px) !important;
                right: 0 !important;
                bottom: auto !important;
                z-index: 1000000 !important;
            }

            .filter-right-sort[data-stylehub-notification-bell] .stylehub-notification-panel::before {
                top: -8px !important;
                bottom: auto !important;
                right: 20px !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: 1px solid #eeeeee !important;
                border-top: 1px solid #eeeeee !important;
            }

            .home-notification-bell {
                position: fixed !important;
                right: 104px !important;
                bottom: 24px !important;
                top: auto !important;
                z-index: 999999 !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .home-notification-bell .stylehub-bell-btn {
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.22) !important;
                font-size: 22px !important;
            }

            .home-notification-bell .stylehub-notification-panel {
                top: auto !important;
                bottom: calc(100% + 14px) !important;
                right: 0 !important;
                z-index: 1000000 !important;
            }

            .home-notification-bell .stylehub-notification-panel::before {
                top: auto !important;
                bottom: -8px !important;
                right: 20px !important;
                border-top: none !important;
                border-left: none !important;
                border-right: 1px solid #eeeeee !important;
                border-bottom: 1px solid #eeeeee !important;
            }

            .pd-notification-bell {
                position: fixed !important;
                top: 88px !important;
                right: 66px !important;
                bottom: auto !important;
                z-index: 999999 !important;
                display: inline-flex !important;
                justify-content: center !important;
                align-items: center !important;
            }

            .pd-notification-bell .stylehub-bell-btn {
                width: 42px !important;
                height: 42px !important;
                border-radius: 50% !important;
                background: #ffffff !important;
                color: #111111 !important;
                border: 1px solid rgba(17,17,17,.16) !important;
                box-shadow: 0 10px 25px rgba(0,0,0,.14) !important;
                font-size: 18px !important;
            }

            .pd-notification-bell .stylehub-notification-panel {
                top: calc(100% + 12px) !important;
                right: 0 !important;
                bottom: auto !important;
                z-index: 1000000 !important;
            }

            .pd-notification-bell .stylehub-notification-panel::before {
                top: -8px !important;
                bottom: auto !important;
                right: 20px !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: 1px solid #eeeeee !important;
                border-top: 1px solid #eeeeee !important;
            }

            .home-bag-notify-wrap,
            .pd-bag-notify-wrap {
                display: inline !important;
                flex-direction: initial !important;
                gap: 0 !important;
            }

            @media (max-width: 768px) {
                .filter-right-sort[data-stylehub-notification-bell],
                .pd-notification-bell {
                    top: 76px !important;
                    right: 18px !important;
                }

                .home-notification-bell {
                    right: 92px !important;
                    bottom: 22px !important;
                }

                .home-notification-bell .stylehub-bell-btn {
                    width: 52px !important;
                    height: 52px !important;
                    font-size: 20px !important;
                }
            }

        `;
        document.head.appendChild(style);
    }

    function buildPanelHTML(notifications) {
        if (!notifications.length) {
            return `
                <div class="stylehub-notification-title">Thông báo</div>
                <div class="stylehub-notification-empty">Chưa có thông báo mới.</div>
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


    function getSavedBellPosition() {
        try {
            const saved = JSON.parse(localStorage.getItem(BELL_POS_KEY) || "null");
            if (saved && typeof saved.right === "number" && typeof saved.bottom === "number") {
                return saved;
            }
        } catch (error) {}
        return { right: 82, bottom: 100 };
    }

    function clampBellPosition(root, position) {
        const rect = root.getBoundingClientRect();
        const width = rect.width || 42;
        const height = rect.height || 42;

        let right = Number(position.right);
        let bottom = Number(position.bottom);

        right = Math.max(16, Math.min(window.innerWidth - width - 16, right));
        bottom = Math.max(16, Math.min(window.innerHeight - height - 16, bottom));

        return { right: right, bottom: bottom };
    }

    function applyBellPosition(root, position) {
        if (!root) return;

        const next = clampBellPosition(root, position);

        root.style.right = next.right + "px";
        root.style.bottom = next.bottom + "px";
        root.style.left = "auto";
        root.style.top = "auto";
        root.style.transform = "translate3d(0, 0, 0)";
    }

    function saveBellPosition(root) {
        if (!root) return;
        const right = parseFloat(getComputedStyle(root).right) || 82;
        const bottom = parseFloat(getComputedStyle(root).bottom) || 100;
        localStorage.setItem(BELL_POS_KEY, JSON.stringify({ right: right, bottom: bottom }));
    }

    function bindBellDragLikeAI(root, btn) {
        if (!root || !btn || root.dataset.stylehubAiLikeDragBound === "1") return;
        root.dataset.stylehubAiLikeDragBound = "1";

        applyBellPosition(root, getSavedBellPosition());

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startRight = 0;
        let startBottom = 0;
        let lastDx = 0;
        let lastDy = 0;
        let animationFrame = null;

        function applyDragTransform() {
            animationFrame = null;
            root.style.transform = "translate3d(" + lastDx + "px, " + lastDy + "px, 0)";
        }

        function requestDragPaint() {
            if (animationFrame) return;
            animationFrame = requestAnimationFrame(applyDragTransform);
        }

        btn.addEventListener("pointerdown", function (e) {
            if (e.button !== undefined && e.button !== 0) return;

            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            startRight = parseFloat(getComputedStyle(root).right) || 82;
            startBottom = parseFloat(getComputedStyle(root).bottom) || 100;
            lastDx = 0;
            lastDy = 0;

            root.classList.add("dragging");
            root.classList.remove("open");
            root.style.transition = "none";

            if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
            e.preventDefault();
            e.stopPropagation();
        });

        btn.addEventListener("pointermove", function (e) {
            if (!dragging) return;

            lastDx = e.clientX - startX;
            lastDy = e.clientY - startY;

            if (Math.abs(lastDx) > 3 || Math.abs(lastDy) > 3) moved = true;

            requestDragPaint();

            e.preventDefault();
            e.stopPropagation();
        });

        function finishDrag(e) {
            if (!dragging) return;

            // Lấy đúng vị trí ĐANG NHÌN THẤY trên màn hình trước khi bỏ transform.
            // Cách này chặn lỗi thả chuột xong chuông bị nhảy/dịch sang chỗ khác.
            const visualRect = root.getBoundingClientRect();
            const rawNext = {
                right: window.innerWidth - visualRect.right,
                bottom: window.innerHeight - visualRect.bottom
            };

            dragging = false;
            root.classList.remove("dragging");
            root.style.transition = "";

            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }

            root.style.transform = "translate3d(0, 0, 0)";

            const next = clampBellPosition(root, rawNext);
            root.style.right = next.right + "px";
            root.style.bottom = next.bottom + "px";
            root.style.left = "auto";
            root.style.top = "auto";

            localStorage.setItem(BELL_POS_KEY, JSON.stringify(next));

            if (moved) {
                root.dataset.stylehubBellMoved = "1";
                setTimeout(function () {
                    root.dataset.stylehubBellMoved = "";
                }, 220);
            }

            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        btn.addEventListener("pointerup", finishDrag);
        btn.addEventListener("pointercancel", finishDrag);
        btn.addEventListener("lostpointercapture", finishDrag);

        window.addEventListener("resize", function () {
            applyBellPosition(root, getSavedBellPosition());
            saveBellPosition(root);
        });
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

        bindBellDragLikeAI(root, btn);

        btn.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (root.dataset.stylehubBellMoved === "1") {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

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
