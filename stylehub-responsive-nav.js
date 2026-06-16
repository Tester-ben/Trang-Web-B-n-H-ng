/* =========================================================
   THE STYLE HUB - RESPONSIVE NAVIGATION V2
   - Không dùng MORE nữa.
   - Khi menu trái gần chạm logo, tự chuyển sang nút 2 gạch.
   ========================================================= */
(function () {
    const STYLE_ID = "stylehub-responsive-nav-style";
    const MOBILE_ID = "stylehub-mobile-menu";

    const menuGroups = [
        { title: "FEATURED", links: [["Home", "index.html"], ["New Arrivals", "collections.html"]] },
        { title: "MENS", links: [["All Products", "mens.html"], ["Tops", "mens.html?cat=tops"], ["Hoodies", "mens.html?cat=hoodies"], ["Dress Shirt", "mens.html?cat=dress-shirt"]] },
        { title: "WOMENS", links: [["All Products", "womens.html"], ["Tops", "womens.html?cat=tops"], ["Jackets & Outerwear", "womens.html?cat=jackets"]] },
        { title: "KIDS", links: [["All Kids", "kids.html"], ["Tops", "kids.html?cat=tops"], ["Jackets & Outerwear", "kids.html?cat=jackets"]] },
        { title: "SALE", links: [["All Sale Items", "sale.html"], ["Tops", "sale.html?cat=tops"], ["Jackets & Outerwear", "sale.html?cat=jackets"]] },
        { title: "SHOES", links: [["All Shoes", "shoes.html"]] },
        { title: "POLICIES", links: [["Chính sách đổi hàng & bảo hành", "exchange-warranty-policy.html"], ["Chính sách bảo mật", "privacy-policy.html"], ["Chính sách giao hàng", "shipping-policy.html"]] }
    ];

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
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

            /* Khi màn hình vừa/nhỏ, bỏ hết menu chữ bên trái, chỉ hiện nút 2 gạch */
            @media (max-width: 1120px) {
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

    function initResponsiveNav() {
        injectStyle();
        removeOldMoreMenu();

        const header = document.querySelector(".main-header");
        createMobileMenu(header);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initResponsiveNav);
    } else {
        initResponsiveNav();
    }
})();
