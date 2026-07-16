/* =========================================================
   THE STYLE HUB - RESPONSIVE NAVIGATION V5
   - Đồng bộ dropdown desktop cho các trang có menu thường.
   - Sửa lỗi hover MENS/WOMENS/KIDS/SALE/SHOES bị bắt nhầm sang FEATURED.
   - Giữ mobile menu 2 gạch khi màn hình nhỏ.
   ========================================================= */
(function () {
    const STYLE_ID = "stylehub-responsive-nav-style";
    const MOBILE_ID = "stylehub-mobile-menu";

    const menuGroups = [
        { title: "FEATURED", href: "index.html", links: [["New Arrivals", "collections.html"]], mega: true },
        { title: "MENS", href: "mens.html", links: [["All Products", "mens.html"], ["Tops", "mens.html?cat=tops"], ["Hoodies", "mens.html?cat=hoodies"], ["Dress Shirt", "mens.html?cat=dress-shirt"], ["Bottoms", "mens.html?cat=bottoms"]] },
        { title: "WOMENS", href: "womens.html", links: [["All Products", "womens.html"], ["Tops", "womens.html?cat=tops"], ["Jackets & Outerwear", "womens.html?cat=jackets"], ["Bottoms", "womens.html?cat=bottoms"]] },
        { title: "KIDS", href: "kids.html", links: [["All Kids", "kids.html"], ["Tops", "kids.html?cat=tops"], ["Jackets & Outerwear", "kids.html?cat=jackets"], ["Bottoms", "kids.html?cat=bottoms"]] },
        { title: "SALE", href: "sale.html", links: [["All Sale Items", "sale.html"], ["Tops", "sale.html?cat=tops"], ["Jackets & Outerwear", "sale.html?cat=jackets"]] },
        { title: "SHOES", href: "shoes.html", links: [["All Shoes", "shoes.html"]] },
        { title: "POLICIES", href: "shipping-policy.html", links: [["Chính sách đổi hàng & bảo hành", "exchange-warranty-policy.html"], ["Chính sách bảo mật", "privacy-policy.html"], ["Chính sách giao hàng", "shipping-policy.html"]] }
    ];

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            /* ===== DESKTOP DROPDOWN SYNC ===== */
            .main-header,
            .main-header .nav-container,
            .main-header .nav-left {
                overflow: visible !important;
            }

            .main-header {
                z-index: 100000 !important;
            }

            .main-header .nav-left {
                display: flex !important;
                align-items: center !important;
                gap: 0 !important;
                height: 100% !important;
            }

            .main-header .nav-left > a,
            .main-header .nav-left > .menu-item-has-dropdown > a,
            .main-header .nav-left > .menu-item-has-mega > a {
                color: #ffffff !important;
                text-decoration: none !important;
                font-size: 11px !important;
                line-height: 1 !important;
                letter-spacing: 2.8px !important;
                text-transform: uppercase !important;
                margin: 0 26px 0 0 !important;
                padding: 23px 0 !important;
                display: block !important;
                white-space: nowrap !important;
                opacity: .82 !important;
                transition: opacity .2s ease, text-decoration-color .2s ease !important;
            }

            .main-header .nav-left > a:hover,
            .main-header .nav-left > .menu-item-has-dropdown:hover > a,
            .main-header .nav-left > .menu-item-has-mega:hover > a,
            .main-header .nav-left > a.active,
            .main-header .nav-left > .menu-item-has-dropdown > a.active,
            .main-header .nav-left > .menu-item-has-mega > a.active {
                opacity: 1 !important;
            }

            .main-header .nav-left > a.active,
            .main-header .nav-left > .menu-item-has-dropdown > a.active,
            .main-header .nav-left > .menu-item-has-mega > a.active {
                text-decoration: underline !important;
                text-underline-offset: 7px !important;
                text-decoration-thickness: 1px !important;
            }

            .main-header .menu-item-has-dropdown {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                height: 57px !important;
            }

            .main-header .menu-item-has-dropdown:hover,
            .main-header .menu-item-has-mega:hover {
                z-index: 1000300 !important;
            }

            /* Không dùng lớp cầu vô hình vì nó có thể bắt nhầm hover sang mục khác */
            .main-header .menu-item-has-dropdown::after {
                content: none !important;
                display: none !important;
                pointer-events: none !important;
            }

            .main-header .nav-dropdown {
                display: block !important;
                position: absolute !important;
                top: 100% !important;
                left: 0 !important;
                min-width: 260px !important;
                padding: 16px 0 !important;
                background: rgba(17, 17, 17, 0.98) !important;
                border: 1px solid rgba(255, 255, 255, 0.12) !important;
                box-shadow: 0 16px 38px rgba(0, 0, 0, 0.40) !important;
                z-index: 1000200 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transform: translateY(8px) !important;
                transition: opacity .18s ease, transform .18s ease, visibility .18s ease !important;
            }

            .main-header .menu-item-has-dropdown:hover .nav-dropdown,
            .main-header .nav-dropdown:hover {
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                transform: translateY(0) !important;
            }

            .main-header .nav-dropdown a {
                display: block !important;
                width: 100% !important;
                color: #d9d9d9 !important;
                text-decoration: none !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
                letter-spacing: 2.5px !important;
                text-transform: uppercase !important;
                white-space: nowrap !important;
                padding: 13px 26px !important;
                margin: 0 !important;
                opacity: 1 !important;
                transition: background .2s ease, color .2s ease, padding-left .2s ease !important;
            }

            .main-header .nav-dropdown a:hover {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.07) !important;
                padding-left: 34px !important;
            }

            .main-header .menu-item-has-mega {
                position: static !important;
                display: flex !important;
                align-items: center !important;
                height: 57px !important;
            }

            /* Tắt lớp phủ trong suốt full-width của FEATURED để không đè hover của MENS/WOMENS/KIDS/SALE/SHOES */
            .main-header .menu-item-has-mega::after {
                content: none !important;
                display: none !important;
                pointer-events: none !important;
            }

            .main-header .mega-menu-dropdown {
                display: block !important;
                position: fixed !important;
                top: 57px !important;
                left: 0 !important;
                width: 100vw !important;
                padding: 42px 78px !important;
                background: rgba(17, 17, 17, 0.985) !important;
                backdrop-filter: blur(8px) !important;
                border-bottom: 1px solid rgba(255,255,255,.10) !important;
                box-shadow: 0 18px 42px rgba(0,0,0,.42) !important;
                z-index: 1000199 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transform: translateY(8px) !important;
                transition: opacity .2s ease, transform .2s ease, visibility .2s ease !important;
            }

            .main-header .menu-item-has-mega:hover .mega-menu-dropdown,
            .main-header .mega-menu-dropdown:hover {
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                transform: translateY(0) !important;
            }

            .main-header .mega-menu-container {
                max-width: 1240px !important;
                margin: 0 auto !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: flex-start !important;
                gap: 54px !important;
            }

            .main-header .mega-links-col {
                min-width: 300px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 0 !important;
            }

            .main-header .mega-links-col a {
                color: #d6d6d6 !important;
                margin: 0 0 18px 0 !important;
                padding: 0 !important;
                font-size: 12px !important;
                line-height: 1.35 !important;
                letter-spacing: 2px !important;
                opacity: .9 !important;
                transition: color .2s ease, transform .2s ease !important;
            }

            .main-header .mega-links-col a:hover {
                color: #ffffff !important;
                transform: translateX(4px) !important;
            }

            .main-header .mega-images-col {
                display: flex !important;
                gap: 34px !important;
            }

            .main-header .mega-img-card {
                width: 220px !important;
                display: flex !important;
                flex-direction: column !important;
                margin: 0 !important;
                text-decoration: none !important;
            }

            .main-header .mega-img-card img {
                width: 220px !important;
                height: 300px !important;
                object-fit: cover !important;
                display: block !important;
                margin: 0 0 12px 0 !important;
            }

            .main-header .mega-img-card span {
                color: #ffffff !important;
                font-size: 10px !important;
                line-height: 1.35 !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
                margin: 0 !important;
                white-space: nowrap !important;
            }

            .mobile-menu-toggle {
                display: none;
                width: 42px;
                height: 42px;
                border: none;
                background: transparent;
                cursor: pointer;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 6px;
                padding: 0;
                z-index: 1000010;
                color: #ffffff;
            }

            .mobile-menu-toggle span {
                display: block;
                width: 18px;
                height: 1.5px;
                background: currentColor;
                transition: transform .22s ease;
            }

            .mobile-menu-toggle.is-open span:first-child {
                transform: translateY(4px) rotate(45deg);
            }

            .mobile-menu-toggle.is-open span:last-child {
                transform: translateY(-4px) rotate(-45deg);
            }

            .mobile-menu-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,.28);
                z-index: 1000000;
            }

            .mobile-menu-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: min(390px, 86vw);
                height: 100vh;
                background: #111111;
                color: #ffffff;
                transform: translateX(-100%);
                transition: transform .28s ease;
                z-index: 1000001;
                overflow-y: auto;
                padding: 88px 30px 36px;
                box-shadow: 24px 0 55px rgba(0,0,0,.25);
            }

            .mobile-menu-overlay.is-open {
                display: block;
            }

            .mobile-menu-overlay.is-open .mobile-menu-panel {
                transform: translateX(0);
            }

            .mobile-menu-close {
                position: absolute;
                top: 24px;
                right: 24px;
                border: none;
                background: transparent;
                color: #ffffff;
                font-size: 30px;
                line-height: 1;
                cursor: pointer;
            }

            .mobile-menu-brand {
                position: absolute;
                top: 26px;
                left: 30px;
                font-size: 14px;
                letter-spacing: 4px;
                font-weight: 700;
                text-transform: uppercase;
            }

            .mobile-menu-group {
                border-top: 1px solid rgba(255,255,255,.12);
                padding: 20px 0;
            }

            .mobile-menu-group:first-of-type {
                border-top: none;
            }

            .mobile-menu-title {
                font-size: 12px;
                letter-spacing: 3px;
                text-transform: uppercase;
                font-weight: 700;
                margin-bottom: 12px;
            }

            .mobile-menu-panel a {
                display: block;
                color: #ffffff;
                text-decoration: none;
                font-size: 13px;
                letter-spacing: 2px;
                text-transform: uppercase;
                padding: 9px 0;
                opacity: .82;
            }

            .mobile-menu-panel a:hover {
                opacity: 1;
            }

            /* JS sẽ tự thêm class này khi link SHOES hoặc cụm bên phải thật sự sát logo. */
            .main-header.stylehub-nav-collapsed .nav-container {
                display: grid !important;
                grid-template-columns: 48px 1fr auto !important;
                align-items: center !important;
                padding-left: 16px !important;
                padding-right: 16px !important;
                gap: 8px !important;
            }

            .main-header.stylehub-nav-collapsed .mobile-menu-toggle {
                display: inline-flex !important;
            }

            .main-header.stylehub-nav-collapsed .nav-left {
                display: none !important;
            }

            .main-header.stylehub-nav-collapsed .logo {
                justify-self: center !important;
                text-align: center !important;
                white-space: nowrap !important;
            }

            .main-header.stylehub-nav-collapsed .logo a {
                letter-spacing: 6px !important;
            }

            .main-header.stylehub-nav-collapsed .nav-right {
                justify-self: end !important;
                display: flex !important;
                align-items: center !important;
                gap: 18px !important;
            }

            .main-header.stylehub-nav-collapsed .nav-right a {
                margin-left: 0 !important;
            }

            @media (max-width: 860px) {
                .main-header .nav-container {
                    display: grid !important;
                    grid-template-columns: 48px 1fr auto !important;
                    align-items: center !important;
                    padding-left: 16px !important;
                    padding-right: 16px !important;
                    gap: 8px !important;
                }

                .mobile-menu-toggle {
                    display: inline-flex !important;
                }

                .main-header .nav-left {
                    display: none !important;
                }

                .main-header .logo {
                    justify-self: center !important;
                    text-align: center !important;
                    white-space: nowrap !important;
                }

                .main-header .logo a {
                    letter-spacing: 6px !important;
                }

                .main-header .nav-right {
                    justify-self: end !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 18px !important;
                }

                .main-header .nav-right a {
                    margin-left: 0 !important;
                }
            }

            @media (max-width: 768px) {
                .main-header .logo a {
                    font-size: 18px !important;
                    letter-spacing: 5px !important;
                }

                .main-header .nav-right {
                    gap: 14px !important;
                }

                .main-header .nav-right a {
                    font-size: 10px !important;
                    letter-spacing: 2px !important;
                }

                .main-header .nav-right a#account-trigger,
                .main-header .nav-right a.pd-account-link,
                .main-header .nav-right a.admin-nav-link {
                    display: none !important;
                }

                .main-header .nav-right a#search-trigger {
                    display: inline-block !important;
                }
            }

            @media (max-width: 520px) {
                .main-header .logo a {
                    font-size: 15px !important;
                    letter-spacing: 3px !important;
                }

                .main-header .nav-right a#search-trigger {
                    display: none !important;
                }

                .mobile-menu-panel {
                    width: 88vw;
                    padding-left: 24px;
                    padding-right: 24px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getCurrentFile() {
        const name = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
        return name || "index.html";
    }

    function markActive(anchor, group) {
        const file = getCurrentFile();
        const policyFiles = ["shipping-policy.html", "privacy-policy.html", "exchange-warranty-policy.html"];
        const groupFile = (group.href || "").split("?")[0].toLowerCase();

        // Không gạch chân FEATURED ở trang Home/Collections.
        // Chỉ đánh dấu active cho các trang danh mục thật như MENS/WOMENS/KIDS/SALE/SHOES.
        if (group.title === "FEATURED") {
            anchor.classList.remove("active");
            return;
        }

        const shouldActive =
            file === groupFile ||
            (group.title === "POLICIES" && policyFiles.includes(file));

        if (shouldActive) anchor.classList.add("active");
    }

    function buildFeaturedMega(group) {
        return `
            <div class="menu-item-has-mega">
                <a href="${group.href}">${group.title}</a>
                <div class="mega-menu-dropdown">
                    <div class="mega-menu-container">
                        <div class="mega-links-col">
                            ${group.links.map(link => `<a href="${link[1]}">${link[0]}</a>`).join("")}
                            <a href="exchange-warranty-policy.html">CHÍNH SÁCH ĐỔI HÀNG & BẢO HÀNH</a>
                            <a href="privacy-policy.html">CHÍNH SÁCH BẢO MẬT</a>
                            <a href="shipping-policy.html">CHÍNH SÁCH GIAO HÀNG</a>
                        </div>
                        <div class="mega-images-col">
                            <a class="mega-img-card" href="womens.html">
                                <img alt="Collection Nine Womenswear" src="https://fearofgod.com/cdn/shop/files/LOOK_36_26241979-d8f6-4a59-81bf-798c81a576b9.jpg?v=1758565392&width=1200">
                                <span>COLLECTION NINE WOMENSWEAR</span>
                            </a>
                            <a class="mega-img-card" href="mens.html">
                                <img alt="Collection Nine Menswear" src="https://fearofgod.com/cdn/shop/files/LOOK_29.png?v=1774904924&width=1200">
                                <span>COLLECTION NINE MENSWEAR</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildSmallDropdown(group) {
        return `
            <div class="menu-item-has-dropdown">
                <a href="${group.href}">${group.title}</a>
                <div class="nav-dropdown">
                    ${group.links.map(link => `<a href="${link[1]}">${link[0]}</a>`).join("")}
                </div>
            </div>
        `;
    }

    function navLooksLikeMainMenu(navLeft) {
        if (!navLeft) return false;
        const text = navLeft.textContent.toUpperCase();
        return ["MENS", "WOMENS", "KIDS", "SALE", "SHOES"].some(item => text.includes(item));
    }

    function syncDesktopDropdowns(header) {
        const navLeft = header && header.querySelector(".nav-left");
        if (!navLooksLikeMainMenu(navLeft)) return;

        const alreadyHasDropdowns = navLeft.querySelector(".menu-item-has-dropdown, .menu-item-has-mega");

        if (!alreadyHasDropdowns) {
            navLeft.innerHTML = menuGroups
                .filter(group => group.title !== "POLICIES")
                .map(group => group.mega ? buildFeaturedMega(group) : buildSmallDropdown(group))
                .join("");
        }

        navLeft.querySelectorAll(":scope > .menu-item-has-dropdown > a, :scope > .menu-item-has-mega > a").forEach(function (anchor) {
            const title = anchor.textContent.trim().toUpperCase();
            const group = menuGroups.find(item => item.title === title);
            if (group) markActive(anchor, group);
        });
    }

    function removeOldMoreMenu() {
        document.querySelectorAll("#stylehub-responsive-more, .responsive-more-menu").forEach(function (item) {
            item.remove();
        });
    }

    function createMobileMenu(header) {
        if (!header || document.getElementById(MOBILE_ID)) return;

        const navContainer = header.querySelector(".nav-container") || header;

        let toggle = navContainer.querySelector(".mobile-menu-toggle");
        if (!toggle) {
            toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "mobile-menu-toggle";
            toggle.setAttribute("aria-label", "Open menu");
            toggle.innerHTML = "<span></span><span></span>";
            navContainer.insertBefore(toggle, navContainer.firstElementChild);
        }

        const overlay = document.createElement("div");
        overlay.className = "mobile-menu-overlay";
        overlay.id = MOBILE_ID;

        const groups = menuGroups.map(group => `
            <div class="mobile-menu-group">
                <div class="mobile-menu-title">${group.title}</div>
                ${group.links.map(link => `<a href="${link[1]}">${link[0]}</a>`).join("")}
            </div>
        `).join("");

        overlay.innerHTML = `
            <div class="mobile-menu-panel">
                <div class="mobile-menu-brand">THE STYLE HUB</div>
                <button type="button" class="mobile-menu-close" aria-label="Close menu">×</button>
                ${groups}
            </div>
        `;

        document.body.appendChild(overlay);

        function openMenu() {
            overlay.classList.add("is-open");
            toggle.classList.add("is-open");
            document.body.style.overflow = "hidden";
        }

        function closeMenu() {
            overlay.classList.remove("is-open");
            toggle.classList.remove("is-open");
            document.body.style.overflow = "";
        }

        toggle.addEventListener("click", function () {
            overlay.classList.contains("is-open") ? closeMenu() : openMenu();
        });

        overlay.querySelector(".mobile-menu-close").addEventListener("click", closeMenu);

        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) closeMenu();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeMenu();
        });
    }

    function getVisibleRect(element) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        return rect;
    }

    function updateHeaderCollapseMode() {
        const header = document.querySelector(".main-header");
        if (!header) return;

        const navLeft = header.querySelector(".nav-left");
        const logo = header.querySelector(".logo");
        const navRight = header.querySelector(".nav-right");

        if (!navLeft || !logo) return;

        // Chỉ ép thu menu ở màn hình rất nhỏ. Còn lại để JS đo đúng khoảng cách thật.
        if (window.innerWidth <= 860) {
            header.classList.add("stylehub-nav-collapsed");
            return;
        }

        // Tạm mở menu desktop để đo đúng vị trí của link cuối cùng bên trái, không đo cả khung nav-left.
        header.classList.remove("stylehub-nav-collapsed");

        const safeGap = 12;
        const logoRect = logo.getBoundingClientRect();

        const leftItems = Array.from(navLeft.children)
            .map(getVisibleRect)
            .filter(Boolean);
        const lastLeftRect = leftItems.length ? leftItems[leftItems.length - 1] : null;

        const rightItems = navRight
            ? Array.from(navRight.children).map(getVisibleRect).filter(Boolean)
            : [];
        const firstRightRect = rightItems.length ? rightItems[0] : null;

        const leftHitsLogo = lastLeftRect && lastLeftRect.right + safeGap >= logoRect.left;
        const rightHitsLogo = firstRightRect && firstRightRect.left - safeGap <= logoRect.right;

        if (leftHitsLogo || rightHitsLogo) {
            header.classList.add("stylehub-nav-collapsed");
        }
    }

    function scheduleHeaderCollapseCheck() {
        window.requestAnimationFrame(updateHeaderCollapseMode);
    }

    function initResponsiveNav() {
        injectStyle();
        removeOldMoreMenu();

        const header = document.querySelector(".main-header");
        syncDesktopDropdowns(header);
        createMobileMenu(header);
        scheduleHeaderCollapseCheck();

        window.addEventListener("resize", scheduleHeaderCollapseCheck);
        window.addEventListener("orientationchange", scheduleHeaderCollapseCheck);
        window.addEventListener("load", scheduleHeaderCollapseCheck);

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleHeaderCollapseCheck).catch(function () {});
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initResponsiveNav);
    } else {
        initResponsiveNav();
    }
})();
