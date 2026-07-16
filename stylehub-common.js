
/* ===== STYLE HUB ACCOUNT AUTH FIX =====
   Sửa 2 lỗi:
   1) Không còn tên demo/owner hiện trên máy người khác.
   2) Không cho đăng nhập bằng email chưa đăng ký hoặc sai mật khẩu.
   Lưu ý: Đây là auth demo bằng localStorage cho project tĩnh. Production nên dùng Firebase Auth. */
(function () {
    const ACCOUNTS_KEY = "stylehub_accounts_v1";
    const SESSION_FLAG = "isLoggedInStatus";
    const DEMO_EMAILS = ["phantu210206@gmail.com"];
    const DEMO_NAME_PATTERNS = ["phan thanh tu", "thanh tu phan", "phan thanh tú", "thanh tú phan"];

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function normalizeName(name) {
        return String(name || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
    }

    function readAccounts() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeAccounts(accounts) {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts || {}));
    }

    function isDemoIdentity(email, name) {
        const cleanEmail = normalizeEmail(email);
        const cleanName = normalizeName(name);
        if (DEMO_EMAILS.includes(cleanEmail)) return true;
        return DEMO_NAME_PATTERNS.some(function (pattern) {
            return cleanName === pattern || cleanName.includes(pattern);
        });
    }

    function clearSessionOnly() {
        localStorage.setItem(SESSION_FLAG, "false");
        localStorage.removeItem("hub_name");
        localStorage.removeItem("hub_email");
        localStorage.removeItem("hub_current_user_key");
        localStorage.removeItem("userEmail");
    }

    function purgeDemoIdentity() {
        const accounts = readAccounts();
        const currentEmail = normalizeEmail(localStorage.getItem("hub_email") || localStorage.getItem("hub_current_user_key") || "");
        const currentName = localStorage.getItem("hub_name") || "";
        const oldUser = (function () {
            try { return JSON.parse(localStorage.getItem("hub_userData") || "{}"); }
            catch (error) { return {}; }
        })();
        const oldEmail = normalizeEmail(oldUser.email);
        const oldName = String(oldUser.name || [oldUser.lastName, oldUser.firstName].filter(Boolean).join(" ") || "");

        // Không xoá session nếu email đó đã là tài khoản thật trong máy hiện tại.
        // Bản trước nhận diện "Thanh Tú / phantu..." là dữ liệu demo nên khi sang trang sản phẩm
        // nó tự clear session, làm người dùng bị đăng xuất.
        const currentIsRealAccount = currentEmail && accounts[currentEmail];
        if (!currentIsRealAccount && isDemoIdentity(currentEmail, currentName)) {
            clearSessionOnly();
            localStorage.removeItem("hub_last_user_email");
        }

        // Chỉ xoá hub_userData demo cũ khi nó không tương ứng với tài khoản đã đăng ký.
        const oldUserIsRealAccount = oldEmail && accounts[oldEmail];
        if (!oldUserIsRealAccount && isDemoIdentity(oldEmail, oldName)) {
            localStorage.removeItem("hub_userData");
        }
    }

    function migrateOldSingleAccount() {
        let oldUser = {};
        try { oldUser = JSON.parse(localStorage.getItem("hub_userData") || "{}"); }
        catch (error) { oldUser = {}; }

        const email = normalizeEmail(oldUser.email);
        const password = String(oldUser.password || "");
        const firstName = String(oldUser.firstName || "").trim();
        const lastName = String(oldUser.lastName || "").trim();
        const name = String(oldUser.name || [lastName, firstName].filter(Boolean).join(" ") || email.split("@")[0] || "").trim();

        if (!email || !password || isDemoIdentity(email, name)) return;

        const accounts = readAccounts();
        if (!accounts[email]) {
            accounts[email] = {
                email,
                password,
                firstName,
                lastName,
                name,
                createdAt: Date.now(),
                migratedFrom: "hub_userData"
            };
            writeAccounts(accounts);
        }
    }

    function setSession(account) {
        const email = normalizeEmail(account.email);
        const name = String(account.name || [account.lastName, account.firstName].filter(Boolean).join(" ") || email.split("@")[0]).trim();
        localStorage.setItem(SESSION_FLAG, "true");
        localStorage.setItem("hub_name", name);
        localStorage.setItem("hub_email", email);
        localStorage.setItem("hub_current_user_key", email);
        localStorage.setItem("hub_last_user_email", email);
        localStorage.setItem("hub_account_email_" + name.toLowerCase().replace(/\s+/g, "_"), email);
        localStorage.setItem("userEmail", email);
    }

    function register(data) {
        purgeDemoIdentity();
        migrateOldSingleAccount();

        const email = normalizeEmail(data && data.email);
        const password = String((data && data.password) || "");
        const firstName = String((data && data.firstName) || "").trim();
        const lastName = String((data && data.lastName) || "").trim();
        const name = String((data && data.name) || [lastName, firstName].filter(Boolean).join(" ") || email.split("@")[0] || "").trim();

        if (!isValidEmail(email)) return { ok: false, message: "Email không hợp lệ." };
        if (password.length < 6) return { ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự." };
        if (!name) return { ok: false, message: "Vui lòng nhập tên tài khoản." };

        const accounts = readAccounts();
        if (accounts[email]) {
            return { ok: false, message: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác." };
        }

        const account = { email, password, firstName, lastName, name, createdAt: Date.now() };
        accounts[email] = account;
        writeAccounts(accounts);
        localStorage.setItem("hub_userData", JSON.stringify({ firstName, lastName, email, password, name }));
        return { ok: true, message: "Đăng ký thành công! Hãy đăng nhập thông tin.", user: account };
    }

    function login(email, password) {
        purgeDemoIdentity();
        migrateOldSingleAccount();

        const cleanEmail = normalizeEmail(email);
        const cleanPassword = String(password || "");
        const accounts = readAccounts();
        const account = accounts[cleanEmail];

        if (!isValidEmail(cleanEmail)) return { ok: false, message: "Email không hợp lệ." };
        if (!account) return { ok: false, message: "Tài khoản này chưa được đăng ký. Vui lòng tạo tài khoản trước." };
        if (String(account.password || "") !== cleanPassword) return { ok: false, message: "Mật khẩu không đúng. Vui lòng kiểm tra lại." };

        setSession(account);
        return { ok: true, message: "Đăng nhập thành công!", user: account };
    }

    function getCurrentUser() {
        purgeDemoIdentity();
        migrateOldSingleAccount();

        if (localStorage.getItem(SESSION_FLAG) !== "true") return null;
        const email = normalizeEmail(localStorage.getItem("hub_current_user_key") || localStorage.getItem("hub_email") || "");
        if (!email) {
            clearSessionOnly();
            return null;
        }
        const accounts = readAccounts();
        const account = accounts[email];
        if (!account) {
            clearSessionOnly();
            return null;
        }
        return account;
    }

    function signOut() {
        const email = normalizeEmail(localStorage.getItem("hub_email") || localStorage.getItem("hub_current_user_key") || "");
        if (email) localStorage.setItem("hub_last_user_email", email);
        clearSessionOnly();
    }

    function syncHeader() {
        const user = getCurrentUser();
        const accountLinks = document.querySelectorAll("#account-trigger, #headerAccountLink, #footer-account-link, .footer-account-link");
        accountLinks.forEach(function (link) {
            if (user) {
                link.textContent = String(user.name || user.email.split("@")[0]).toUpperCase();
                link.href = "account.html";
            } else {
                link.textContent = "ACCOUNT";
                link.href = "account.html";
            }
        });
    }

    purgeDemoIdentity();
    migrateOldSingleAccount();

    window.StyleHubAuth = {
        register,
        login,
        signOut,
        getCurrentUser,
        syncHeader,
        readAccounts,
        normalizeEmail
    };
})();

document.addEventListener("DOMContentLoaded", function () {
    syncHeaderAccountName();
    syncBagCount();
    bindSearchBox();
    initFooterSupportContactBlock();
    initSmartHeaderScroll();
});

function syncHeaderAccountName() {
    if (window.StyleHubAuth && typeof window.StyleHubAuth.syncHeader === "function") {
        window.StyleHubAuth.syncHeader();
        return;
    }

    const accountLinks = document.querySelectorAll("#account-trigger, #headerAccountLink, #footer-account-link, .footer-account-link");
    accountLinks.forEach(function (link) {
        link.textContent = "ACCOUNT";
        link.href = "account.html";
    });
}

function syncBagCount() {
    const counters = document.querySelectorAll("#cart-count, #bag-count");
    let cart = [];

    try {
        cart = JSON.parse(localStorage.getItem("cart")) || [];
    } catch (error) {
        cart = [];
    }

    const total = cart.reduce(function (sum, item) {
        return sum + (Number(item.qty) || Number(item.quantity) || 1);
    }, 0);

    counters.forEach(function (counter) {
        counter.textContent = total;
    });
}

function openSearchBox() {
    const searchBox = document.getElementById("searchBox");
    const searchInput = document.getElementById("searchInput");
    if (!searchBox) return;

    searchBox.style.display = "block";
    searchBox.classList.add("open");

    setTimeout(function () {
        if (searchInput) searchInput.focus();
    }, 50);
}

function closeSearchBox() {
    const searchBox = document.getElementById("searchBox");
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    if (!searchBox) return;

    searchBox.style.display = "none";
    searchBox.classList.remove("open");

    if (searchInput) searchInput.value = "";
    if (searchResults) searchResults.innerHTML = "";
}

function bindSearchBox() {
    const searchTrigger = document.getElementById("search-trigger");
    const searchBox = document.getElementById("searchBox");
    const searchInput = document.getElementById("searchInput");

    if (searchTrigger) {
        searchTrigger.addEventListener("click", function (event) {
            event.preventDefault();
            openSearchBox();
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", searchProducts);
        searchInput.addEventListener("keyup", searchProducts);
        searchInput.addEventListener("paste", function () {
            setTimeout(searchProducts, 0);
        });
    }

    document.addEventListener("click", function (event) {
        if (searchBox && event.target === searchBox) {
            closeSearchBox();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeSearchBox();
        if (event.key === "Enter" && document.activeElement === searchInput) {
            const firstResult = document.querySelector(".search-result-item");
            if (firstResult) firstResult.click();
        }
    });
}



/* ===== FOOTER SUPPORT CONTACT BLOCK ===== */
function initFooterSupportContactBlock() {
    const footerBrands = document.querySelectorAll(".site-footer .footer-brand");
    if (!footerBrands.length) return;

    if (!document.getElementById("stylehub-footer-support-style")) {
        const style = document.createElement("style");
        style.id = "stylehub-footer-support-style";
        style.textContent = `
            .footer-support-contact-block {
                margin-top: 28px;
                color: #ffffff;
                max-width: 330px;
            }

            .footer-support-contact-title {
                margin: 0 0 14px 0;
                color: #ffffff;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 1.4px;
                text-transform: uppercase;
            }

            .footer-support-contact-line {
                margin: 0 0 10px 0;
                color: rgba(255, 255, 255, 0.92);
                font-size: 13px;
                line-height: 1.55;
                letter-spacing: 0.2px;
                white-space: nowrap;
            }

            .footer-support-contact-line strong {
                color: #ffffff;
                font-weight: 500;
            }

            .footer-support-contact-line a {
                color: #ffffff !important;
                text-decoration: none;
                font-weight: 700;
                letter-spacing: 0.3px;
            }

            .footer-support-contact-line a:hover {
                text-decoration: underline;
            }


            .footer-support-contact-block {
                width: max-content;
                max-width: none !important;
            }

            .footer-support-contact-line,
            .footer-support-contact-line strong,
            .footer-support-contact-line a,
            .footer-support-contact-line span {
                display: inline !important;
                white-space: nowrap !important;
            }

            .footer-support-contact-line {
                display: block !important;
                width: max-content;
                max-width: none !important;
            }


            .site-footer .footer-brand {
                overflow: visible !important;
            }

            .site-footer .footer-support-contact-block {
                width: max-content !important;
                min-width: max-content !important;
                max-width: none !important;
                overflow: visible !important;
            }

            .site-footer .footer-support-contact-line {
                display: block !important;
                width: max-content !important;
                min-width: max-content !important;
                max-width: none !important;
                white-space: nowrap !important;
                word-break: keep-all !important;
                overflow-wrap: normal !important;
                line-break: strict !important;
            }


            #checkoutOverlay .checkout-side-panel,
            .checkout-side-panel {
                scrollbar-gutter: stable both-edges;
                padding-right: 28px !important;
            }

            #checkoutOverlay .checkout-side-panel::-webkit-scrollbar,
            .checkout-side-panel::-webkit-scrollbar {
                width: 14px;
            }

            #checkoutOverlay .checkout-side-panel::-webkit-scrollbar-track,
            .checkout-side-panel::-webkit-scrollbar-track {
                background: #f1f1f1;
            }

            #checkoutOverlay .checkout-side-panel::-webkit-scrollbar-thumb,
            .checkout-side-panel::-webkit-scrollbar-thumb {
                background: #b8b8b8;
                border-radius: 10px;
                border: 3px solid #f1f1f1;
            }

            #checkoutOverlay .checkout-side-panel::-webkit-scrollbar-thumb:hover,
            .checkout-side-panel::-webkit-scrollbar-thumb:hover {
                background: #777;
            }

            #stylehubCheckoutTotals strong {
                min-width: 100px;
                text-align: right;
                white-space: nowrap;
            }

            @media (max-width: 768px) {
                .footer-support-contact-block {
                    margin-top: 24px;
                    max-width: 100%;
                }

                .footer-support-contact-line {
                    font-size: 12px;
                    white-space: nowrap !important;
                    display: block !important;
                    width: max-content !important;
                    min-width: max-content !important;
                    max-width: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    footerBrands.forEach(function (brandCol) {
        if (brandCol.querySelector(".footer-support-contact-block")) return;

        const block = document.createElement("div");
        block.className = "footer-support-contact-block";
        block.innerHTML = `
            <h4 class="footer-support-contact-title">Liên Hệ Hỗ Trợ</h4>
            <p class="footer-support-contact-line" style="white-space:nowrap !important;display:block !important;width:max-content !important;max-width:none !important;">Gọi&nbsp;mua:&nbsp;02796096060&nbsp;(8:00&nbsp;-&nbsp;21:30)</p>
            <p class="footer-support-contact-line" style="white-space:nowrap !important;display:block !important;width:max-content !important;max-width:none !important;">Khiếu&nbsp;nại:&nbsp;02873066060&nbsp;(8:00&nbsp;-&nbsp;21:30)</p>
            <p class="footer-support-contact-line" style="white-space:nowrap !important;display:block !important;width:max-content !important;max-width:none !important;">Bảo&nbsp;hành:&nbsp;02873066060&nbsp;(8:00&nbsp;-&nbsp;21:00)</p>
        `;

        const socialLinks = brandCol.querySelector(".social-links, .footer-social-links");
        if (socialLinks && socialLinks.parentNode) {
            socialLinks.insertAdjacentElement("afterend", block);
        } else {
            brandCol.appendChild(block);
        }
    });
}

/* ===== SMART HEADER SCROLL: hide main header on scroll down, show on scroll up ===== */
function initSmartHeaderScroll() {
    const header = document.querySelector(".main-header");
    const subFilter = document.querySelector(".sub-filter-bar");

    if (!header || !subFilter || document.body.dataset.smartHeaderReady === "1") return;
    document.body.dataset.smartHeaderReady = "1";
    document.body.classList.add("stylehub-smart-header");

    if (!document.getElementById("stylehub-smart-header-style")) {
        const style = document.createElement("style");
        style.id = "stylehub-smart-header-style";
        style.textContent = `
            body.stylehub-smart-header .main-header {
                transform: translateY(0);
                transition: transform 0.26s ease;
                will-change: transform;
                z-index: 7000 !important;
                overflow: visible !important;
                pointer-events: auto;
            }

            body.stylehub-smart-header.stylehub-header-hidden .main-header {
                transform: translateY(-100%);
                pointer-events: none;
            }

            body.stylehub-smart-header .main-header .nav-dropdown,
            body.stylehub-smart-header .main-header .mega-menu-dropdown {
                z-index: 99999 !important;
                pointer-events: auto !important;
            }

            body.stylehub-smart-header .main-header .menu-item-has-dropdown:hover .nav-dropdown,
            body.stylehub-smart-header .main-header .menu-item-has-mega:hover .mega-menu-dropdown {
                display: block;
            }

            body.stylehub-smart-header .sub-filter-bar {
                position: sticky !important;
                top: 57px;
                z-index: 1000;
                background: #ffffff;
                padding-top: 15px !important;
                transition: top 0.26s ease, box-shadow 0.26s ease;
            }

            body.stylehub-smart-header.stylehub-header-hidden .sub-filter-bar {
                top: 0;
                box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
            }

            @media (max-width: 768px) {
                body.stylehub-smart-header .sub-filter-bar {
                    top: 57px;
                    overflow-x: auto;
                    white-space: nowrap;
                }

                body.stylehub-smart-header.stylehub-header-hidden .sub-filter-bar {
                    top: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    let lastScrollY = window.scrollY || window.pageYOffset || 0;
    let ticking = false;

    function showHeader() {
        document.body.classList.remove("stylehub-header-hidden");
    }

    function hideHeader() {
        document.body.classList.add("stylehub-header-hidden");
    }

    function updateHeaderByScroll() {
        const currentScrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
        const diff = currentScrollY - lastScrollY;

        if (currentScrollY < 20) {
            showHeader();
        } else if (diff > 4 && currentScrollY > 90) {
            hideHeader();
        } else if (diff < -1) {
            showHeader();
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    window.addEventListener("scroll", function () {
        if (!ticking) {
            window.requestAnimationFrame(updateHeaderByScroll);
            ticking = true;
        }
    }, { passive: true });


    if (!window.stylehubHeaderMouseFix) {
        window.stylehubHeaderMouseFix = true;
        window.addEventListener("mousemove", function (event) {
            if (event.clientY <= 70) {
                document.body.classList.remove("stylehub-header-hidden");
            }
        }, { passive: true });
    }

    window.addEventListener("resize", showHeader);
}

function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getProductSearchText(item, id) {
    return normalizeSearchText([
        id,
        item.key,
        item.name,
        item.brand,
        item.price,
        item.category,
        item.gender,
        item.type,
        item.color
    ].filter(Boolean).join(" "));
}

function scoreSearchResult(item, id, keyword, terms) {
    const name = normalizeSearchText(item.name || "");
    const brand = normalizeSearchText(item.brand || "");
    const productId = normalizeSearchText(id || "");
    const fullText = getProductSearchText(item, id);

    if (!terms.every(term => fullText.includes(term))) return -1;

    let score = 0;

    if (name === keyword) score += 100;
    if (name.startsWith(keyword)) score += 70;
    if (brand.startsWith(keyword)) score += 35;
    if (productId.startsWith(keyword)) score += 25;
    if (name.includes(keyword)) score += 20;

    terms.forEach(term => {
        if (name.includes(term)) score += 10;
        if (brand.includes(term)) score += 5;
        if (productId.includes(term)) score += 3;
    });

    return score;
}

function renderSearchResultRow(id, item) {
    const row = document.createElement("div");
    row.className = "search-result-item";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    const imgSrc = item.mainImg || (item.images && item.images[0]) || "";
    const name = escapeHtml(item.name || "");
    const brand = escapeHtml(item.brand || "THE STYLE HUB");
    const price = escapeHtml(item.price || "");

    row.innerHTML = `
        <div class="search-result-thumb">
            <img src="${escapeHtml(imgSrc)}" alt="${name}">
        </div>
        <div class="search-result-info">
            <strong>${name}</strong>
            <small>${brand}</small>
            <span>${price}</span>
        </div>
    `;

    function goToProduct() {
        window.location.href = "product-detail.html?id=" + encodeURIComponent(id);
    }

    row.addEventListener("click", goToProduct);
    row.addEventListener("keydown", function(event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goToProduct();
        }
    });

    return row;
}

function searchProducts() {
    const searchInput = document.getElementById("searchInput");
    const resultsBox = document.getElementById("searchResults");
    if (!searchInput || !resultsBox) return;

    const rawKeyword = searchInput.value || "";
    const keyword = normalizeSearchText(rawKeyword);
    resultsBox.innerHTML = "";

    if (!keyword) {
        resultsBox.innerHTML = `<p class="search-empty">Type a product name, category, color, or brand...</p>`;
        return;
    }

    if (typeof database === "undefined" || !database) {
        resultsBox.innerHTML = `<p class="search-empty">Product data is not loaded.</p>`;
        return;
    }

    const terms = keyword.split(" ").filter(Boolean);

    const results = Object.keys(database)
        .map(function (id) {
            const item = database[id] || {};
            return {
                id: id,
                item: item,
                score: scoreSearchResult(item, id, keyword, terms)
            };
        })
        .filter(result => result.score >= 0)
        .sort(function (a, b) {
            return b.score - a.score || String(a.item.name || "").localeCompare(String(b.item.name || ""));
        })
        .slice(0, 18);

    if (results.length === 0) {
        resultsBox.innerHTML = `<p class="search-empty">No products found for "${escapeHtml(rawKeyword.trim())}".</p>`;
        return;
    }

    const countText = document.createElement("p");
    countText.className = "search-count";
    countText.textContent = `${results.length} product${results.length > 1 ? "s" : ""} found`;
    resultsBox.appendChild(countText);

    results.forEach(function (result) {
        resultsBox.appendChild(renderSearchResultRow(result.id, result.item));
    });
}



/* ===== THE STYLE HUB - COMPLETE SHOP ENHANCEMENTS 20260623 ===== */
(function () {
    const STYLE_ID = "stylehub-complete-enhancements-style";
    const WISHLIST_KEY_PREFIX = "stylehub_wishlist_";
    const RECENT_KEY_PREFIX = "stylehub_recently_viewed_";
    const VOUCHER_KEY = "stylehub_active_voucher";
    let wishlistClickGuardBound = false;

    function ready(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
        else fn();
    }

    function getAccountKey() {
        return String(
            localStorage.getItem("hub_current_user_key") ||
            localStorage.getItem("hub_email") ||
            localStorage.getItem("userEmail") ||
            "guest"
        ).trim().toLowerCase().replace(/\s+/g, "_") || "guest";
    }

    function parseMoney(text) {
        const n = String(text || "").replace(/[^\d]/g, "");
        return Number(n || 0);
    }

    function formatMoney(num) {
        return (Number(num || 0)).toLocaleString("vi-VN") + " ₫";
    }

    function productIdFromHref(href) {
        try {
            return new URL(href || "", window.location.href).searchParams.get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function getCurrentProductId() {
        try {
            return new URLSearchParams(window.location.search).get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function getProductData(id) {
        if (typeof database !== "undefined" && database && database[id]) return database[id];
        return null;
    }

    function stableHash(value) {
        let hash = 0;
        String(value || "").split("").forEach(ch => {
            hash = ((hash << 5) - hash) + ch.charCodeAt(0);
            hash |= 0;
        });
        return Math.abs(hash);
    }

    function getStockInfo(productId) {
        if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
            window.StyleHubProductAdmin.applyAdminProductsToDatabase();
        }
        if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.getAdminStockInfo === "function") {
            return window.StyleHubProductAdmin.getAdminStockInfo(productId);
        }

        let inventory = {};
        try {
            inventory = JSON.parse(localStorage.getItem("stylehub_inventory_v1") || "{}");
        } catch (error) {
            inventory = {};
        }

        const product = getProductData(productId) || {};
        const inv = inventory[productId];
        const stock = inv ? Math.max(0, Number(inv.stock || 0)) : Math.max(0, Number(product.stock === undefined ? 20 : product.stock));
        const outOfStock = inv ? (!!inv.outOfStock || stock <= 0) : (!!product.outOfStock || stock <= 0);

        if (outOfStock) return { status: "out", label: "Out of Stock", vn: "Hết hàng", qty: 0 };
        if (stock <= 3) return { status: "low", label: "Low Stock", vn: "Sắp hết hàng", qty: stock };
        return { status: "in", label: "In Stock", vn: "Còn hàng", qty: stock };
    }

    function getProductSizes(productId, productName) {
        const id = String(productId || "").toLowerCase();
        const name = String(productName || "").toLowerCase();
        if (id.startsWith("shoe") || name.includes("sneaker") || name.includes("shoe")) return ["37","38","39","40","41","42","43","44"];
        if (id.startsWith("kids")) return ["XS","S","M","L"];
        return ["S","M","L","XL"];
    }

    function inferColorText(text) {
        const t = String(text || "").toLowerCase();
        const colors = [
            ["black", "Black"], ["white", "White"], ["grey", "Grey"], ["gray", "Grey"],
            ["brown", "Brown"], ["seal", "Seal"], ["heather", "Heather"], ["oatmeal", "Oatmeal"],
            ["cream", "Cream"], ["blue", "Blue"], ["green", "Green"], ["ginger", "Ginger"],
            ["coastal", "Coastal"], ["vintage", "Vintage"], ["iron", "Iron Grey"]
        ];
        const hit = colors.find(([k]) => t.includes(k));
        return hit ? hit[1] : "Other";
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .stylehub-extra-filter-bar {
                max-width: 1440px;
                margin: 0 auto;
                padding: 14px 40px 0;
                display: flex;
                gap: 12px;
                align-items: center;
                flex-wrap: wrap;
            }
            .stylehub-extra-filter-bar select,
            .stylehub-extra-filter-bar button,
            .stylehub-voucher-row input {
                border: 1px solid #ddd;
                background: #fff;
                color: #111;
                padding: 10px 12px;
                font-size: 11px;
                letter-spacing: 1px;
                text-transform: uppercase;
                outline: none;
            }
            .stylehub-extra-filter-bar button {
                cursor: pointer;
            }
            .enhancement-filter-hidden { display: none !important; }
            .stylehub-stock-badge {
                display: inline-flex;
                align-items: center;
                width: max-content;
                margin: 8px 0 4px;
                padding: 4px 8px;
                border: 1px solid #ddd;
                font-size: 10px;
                letter-spacing: 1px;
                text-transform: uppercase;
                color: #111;
                background: #fff;
            }
            .stylehub-stock-badge.low { border-color: #d69700; color: #8b6200; }
            .stylehub-stock-badge.out { border-color: #c90000; color: #c90000; }
            .stylehub-out-of-stock {
                opacity: 0.62;
            }
            .stylehub-wishlist-btn {
                position: absolute;
                top: 12px;
                right: 12px;
                z-index: 20;
                width: 34px;
                height: 34px;
                border: 1px solid rgba(0,0,0,.1);
                background: rgba(255,255,255,.92);
                color: #111;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .stylehub-wishlist-btn.active {
                background: #111;
                color: #fff;
            }
            .stylehub-size-guide-btn {
                margin-top: 14px;
                border: 0;
                background: transparent;
                color: #111;
                border-bottom: 1px solid #111;
                font-size: 11px;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                cursor: pointer;
                padding: 0 0 4px;
            }
            .stylehub-modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 9000;
                background: rgba(0,0,0,.45);
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .stylehub-modal-overlay.open { display: flex; }
            .stylehub-modal-box {
                width: min(760px, 100%);
                max-height: 85vh;
                overflow: auto;
                background: #fff;
                color: #111;
                padding: 28px;
                position: relative;
            }
            .stylehub-modal-close {
                position: absolute;
                right: 18px;
                top: 14px;
                border: 0;
                background: transparent;
                font-size: 24px;
                cursor: pointer;
            }
            .stylehub-size-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 18px;
                font-size: 13px;
            }
            .stylehub-size-table th,
            .stylehub-size-table td {
                border: 1px solid #eee;
                padding: 10px;
                text-align: left;
            }
            .stylehub-thumb-nav {
                display: flex;
                gap: 10px;
                margin: 0 0 18px;
                flex-wrap: wrap;
            }
            .stylehub-thumb-nav button {
                width: 64px;
                height: 82px;
                border: 1px solid #ddd;
                background: #f7f7f7;
                padding: 0;
                cursor: pointer;
                overflow: hidden;
            }
            .stylehub-thumb-nav img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center top;
                display: block;
            }
            .stylehub-recent-section,
            .stylehub-wishlist-section {
                max-width: 1300px;
                margin: 30px auto 60px;
                padding: 0 40px;
            }
            .stylehub-recent-section h2,
            .stylehub-wishlist-section h2 {
                font-size: 16px;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 18px;
            }
            .stylehub-mini-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 22px;
            }
            .stylehub-mini-card {
                color: inherit;
                text-decoration: none;
                display: block;
            }
            .stylehub-mini-card img {
                width: 100%;
                aspect-ratio: 3/4;
                object-fit: cover;
                object-position: center top;
                background: #f7f7f7;
                display: block;
                margin-bottom: 10px;
            }
            .stylehub-mini-card strong {
                display: block;
                font-size: 12px;
                line-height: 1.35;
                font-weight: 400;
            }
            .stylehub-mini-card span {
                display: block;
                font-size: 12px;
                margin-top: 4px;
            }
            .stylehub-voucher-box {
                border-top: 1px solid #eee;
                margin-top: 18px;
                padding-top: 16px;
                font-size: 13px;
            }
            .stylehub-voucher-row {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            .stylehub-voucher-row input {
                flex: 1;
                text-transform: uppercase;
            }
            .stylehub-voucher-row button {
                border: 1px solid #111;
                background: #111;
                color: #fff;
                padding: 10px 14px;
                font-size: 11px;
                letter-spacing: 1.5px;
                cursor: pointer;
                text-transform: uppercase;
            }
            .stylehub-checkout-line {
                display: flex;
                justify-content: space-between;
                margin: 7px 0;
                color: #444;
            }
            .stylehub-checkout-line.total {
                color: #111;
                font-weight: 700;
                border-top: 1px solid #eee;
                padding-top: 10px;
                margin-top: 10px;
            }
            .stylehub-status-pill {
                display: inline-flex;
                padding: 5px 8px;
                border: 1px solid #ddd;
                font-size: 10px;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin-left: 8px;
            }
            .stylehub-skeleton {
                background: linear-gradient(90deg, #f2f2f2 25%, #fafafa 37%, #f2f2f2 63%);
                background-size: 400% 100%;
                animation: stylehubSkeleton 1.2s ease infinite;
            }
            @keyframes stylehubSkeleton {
                0% { background-position: 100% 50%; }
                100% { background-position: 0 50%; }
            }
            @media (max-width: 768px) {
                .stylehub-extra-filter-bar { padding: 12px 20px 0; }
                .stylehub-extra-filter-bar select,
                .stylehub-extra-filter-bar button { width: 100%; }
                .stylehub-mini-grid { grid-template-columns: repeat(2, 1fr); }
                .stylehub-recent-section,
                .stylehub-wishlist-section { padding: 0 20px; }
            }
        `;
        document.head.appendChild(style);
    }

    function getWishlist() {
        try {
            const data = JSON.parse(localStorage.getItem(WISHLIST_KEY_PREFIX + getAccountKey()) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function setWishlist(list) {
        localStorage.setItem(WISHLIST_KEY_PREFIX + getAccountKey(), JSON.stringify(Array.from(new Set(list))));
    }

    function toggleWishlist(productId) {
        if (!productId) return;
        const list = getWishlist();
        const exists = list.includes(productId);
        const next = exists ? list.filter(id => id !== productId) : [productId].concat(list);
        setWishlist(next);
        document.dispatchEvent(new CustomEvent("stylehub-wishlist-change"));
    }

    function initWishlistClickGuard() {
        if (wishlistClickGuardBound) return;
        wishlistClickGuardBound = true;

        document.addEventListener("click", function (event) {
            const target = event.target instanceof Element ? event.target : null;
            const btn = target ? target.closest(".stylehub-wishlist-btn") : null;
            if (!btn) return;

            const card = btn.closest('a[href*="product-detail.html?id="]');
            if (!card) return;

            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") {
                event.stopImmediatePropagation();
            }

            const productId = productIdFromHref(card.getAttribute("href"));
            if (!productId) return;

            toggleWishlist(productId);
            const active = getWishlist().includes(productId);
            btn.classList.toggle("active", active);
            btn.innerHTML = active ? "♥" : "♡";
        }, true);
    }

    function initWishlistButtons() {
        const list = getWishlist();
        document.querySelectorAll('a[href*="product-detail.html?id="]').forEach(card => {
            const productId = productIdFromHref(card.getAttribute("href"));
            if (!productId || card.querySelector(".stylehub-wishlist-btn")) return;
            const thumb = card.querySelector(".mens-thumb-box, .product-thumb, .product-image, .thumb-box") || card;
            if (getComputedStyle(thumb).position === "static") thumb.style.position = "relative";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "stylehub-wishlist-btn" + (list.includes(productId) ? " active" : "");
            btn.innerHTML = list.includes(productId) ? "♥" : "♡";
            btn.setAttribute("aria-label", "Add to wishlist");
            btn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                toggleWishlist(productId);
                const active = getWishlist().includes(productId);
                btn.classList.toggle("active", active);
                btn.innerHTML = active ? "♥" : "♡";
            });
            thumb.appendChild(btn);
        });

        const productId = getCurrentProductId();
        const productPanel = document.querySelector(".info-sticky-panel");
        if (productId && productPanel && !productPanel.querySelector(".stylehub-product-wishlist")) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "stylehub-size-guide-btn stylehub-product-wishlist";
            btn.textContent = list.includes(productId) ? "♥ Saved to Wishlist" : "♡ Add to Wishlist";
            btn.addEventListener("click", function () {
                toggleWishlist(productId);
                btn.textContent = getWishlist().includes(productId) ? "♥ Saved to Wishlist" : "♡ Add to Wishlist";
            });
            const cta = productPanel.querySelector(".cta-buttons-group");
            if (cta) cta.insertAdjacentElement("afterend", btn);
        }
    }

    function initCollectionFilters() {
        // Removed by user request: do not render FILTER PRICE / FILTER SIZE / FILTER COLOR / CLEAR.
        return;
    }


    function readAdminCustomProducts() {
        try {
            const data = JSON.parse(localStorage.getItem("stylehub_admin_products_v1") || "{}");
            return data && typeof data === "object" ? data : {};
        } catch (error) {
            return {};
        }
    }

    function inferAdminDepartment(productId, item) {
        if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.inferDepartment === "function") {
            return window.StyleHubProductAdmin.inferDepartment(productId, item || {});
        }
        const id = String(productId || "").toLowerCase();
        const dept = String((item && (item.adminDepartment || item.department || item.gender)) || "").toLowerCase();
        if (dept.includes("women")) return "womens";
        if (dept.includes("kid")) return "kids";
        if (dept.includes("shoe")) return "shoes";
        if (dept.includes("sale")) return "sale";
        if (id.startsWith("womens")) return "womens";
        if (id.startsWith("kids")) return "kids";
        if (id.startsWith("shoe")) return "shoes";
        if (id.startsWith("sale")) return "sale";
        return "mens";
    }

    function getCurrentDepartmentFromPage() {
        const page = String(window.location.pathname.split("/").pop() || "").toLowerCase();
        if (page === "womens.html") return "womens";
        if (page === "kids.html") return "kids";
        if (page === "shoes.html") return "shoes";
        if (page === "sale.html") return "sale";
        if (page === "mens.html") return "mens";
        return "";
    }

    function getCurrentCategoryFromUrl() {
        try {
            return new URLSearchParams(window.location.search).get("cat") || "all";
        } catch (error) {
            return "all";
        }
    }

    function createAdminCustomCard(productId, item, currentDept) {
        const mainImg = item.mainImg || (item.images && item.images[0]) || "";
        const hoverImg = (item.images && item.images[1]) || mainImg;
        const category = item.category || item.type || (currentDept === "shoes" ? "shoes" : "tops");
        const price = item.price || formatMoney(item.priceNum || 0);

        const link = document.createElement("a");
        link.href = "product-detail.html?id=" + encodeURIComponent(productId);
        link.dataset.productId = productId;
        link.dataset.cat = category;
        link.dataset.stylehubAdminCustom = "1";

        if (currentDept === "shoes") {
            link.className = "product-card stylehub-admin-custom-card";
            link.innerHTML = `
                <div class="product-thumb hover-img">
                    <img class="img-main" src="${escapeHtml(mainImg)}" alt="${escapeHtml(item.name || "")}">
                    <img class="img-hover" src="${escapeHtml(hoverImg)}" alt="${escapeHtml(item.name || "")}">
                </div>
                <div class="product-info">
                    <p class="brand">${escapeHtml(item.brand || "THE STYLE HUB")}</p>
                    <p class="name">${escapeHtml(item.name || "Sản phẩm")}</p>
                    <p class="price">${escapeHtml(price)}</p>
                </div>`;
        } else {
            link.className = "mens-card stylehub-admin-custom-card";
            link.innerHTML = `
                <div class="mens-thumb-box">
                    <img class="img-front" src="${escapeHtml(mainImg)}" alt="${escapeHtml(item.name || "")}">
                    <img class="img-back" src="${escapeHtml(hoverImg)}" alt="${escapeHtml(item.name || "")}">
                </div>
                <div class="mens-details">
                    <p class="tag-brand">${escapeHtml(item.brand || "THE STYLE HUB")}</p>
                    <h4 class="item-name">${escapeHtml(item.name || "Sản phẩm")}</h4>
                    <p class="item-price">${escapeHtml(price)}</p>
                </div>`;
        }
        return link;
    }

    function initAdminCustomProductCards() {
        const currentDept = getCurrentDepartmentFromPage();
        if (!currentDept) return;
        const grid = document.querySelector(".mens-product-grid");
        if (!grid) return;

        if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
            window.StyleHubProductAdmin.applyAdminProductsToDatabase();
        }

        const customProducts = readAdminCustomProducts();
        Object.keys(customProducts).forEach(function(productId) {
            const item = customProducts[productId] || {};
            if (inferAdminDepartment(productId, item) !== currentDept) return;
            const safeProductId = window.CSS && window.CSS.escape ? CSS.escape(productId) : String(productId).replace(/"/g, '\"');
            const hrefProductId = String(productId).replace(/"/g, '');
            if (grid.querySelector('[data-product-id="' + safeProductId + '"]') || grid.querySelector('a[href*="id=' + hrefProductId + '"]')) return;
            grid.appendChild(createAdminCustomCard(productId, item, currentDept));
        });

        const activeCategory = getCurrentCategoryFromUrl();
        if (activeCategory !== "all" && typeof window.filterCategory === "function") {
            const tag = document.querySelector(`.filter-tag[onclick*="${activeCategory}"]`);
            window.filterCategory(activeCategory, tag || null);
        }
    }

    function setStockBadgeState(badge, stock, showQty) {
        if (!badge || !stock) return;
        badge.className = badge.className
            .replace(/\b(in|low|out)\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
        badge.classList.add(stock.status);
        badge.textContent = stock.vn + (showQty && stock.status !== "out" ? ` · ${stock.qty} sản phẩm` : "");
    }

    function initStockBadges() {
        document.querySelectorAll('a[href*="product-detail.html?id="]').forEach(card => {
            const id = productIdFromHref(card.getAttribute("href"));
            if (!id) return;
            const stock = getStockInfo(id);
            const details = card.querySelector(".mens-details, .product-info, .product-details") || card;
            let badge = card.querySelector(".stylehub-stock-badge");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "stylehub-stock-badge";
                details.appendChild(badge);
            }
            setStockBadgeState(badge, stock, false);
            card.classList.toggle("stylehub-out-of-stock", stock.status === "out");
        });

        const id = getCurrentProductId();
        const panel = document.querySelector(".info-sticky-panel");
        if (id && panel) {
            const stock = getStockInfo(id);
            let badge = panel.querySelector(".stylehub-detail-stock");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "stylehub-stock-badge stylehub-detail-stock";
                const price = panel.querySelector(".product-price");
                if (price) price.insertAdjacentElement("afterend", badge);
            }
            setStockBadgeState(badge, stock, true);

            const buttonMap = new Map([
                ["btn-add-to-bag", "Add to Bag"],
                ["btn-order-now", "Order Now"]
            ]);
            panel.querySelectorAll(".btn-add-to-bag, .btn-order-now").forEach(btn => {
                const isOut = stock.status === "out";
                btn.disabled = isOut;
                btn.style.opacity = isOut ? ".45" : "";
                btn.style.cursor = isOut ? "not-allowed" : "";
                if (isOut) {
                    btn.textContent = "Out of Stock";
                } else {
                    buttonMap.forEach(function(text, className) {
                        if (btn.classList.contains(className)) btn.textContent = text;
                    });
                }
            });
        }
    }

    function initSizeGuide() {
        const sizeSection = document.querySelector(".size-selector-section");
        if (!sizeSection || sizeSection.querySelector(".stylehub-size-guide-btn")) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stylehub-size-guide-btn";
        btn.textContent = "Size Guide";
        sizeSection.appendChild(btn);

        const modal = document.createElement("div");
        modal.className = "stylehub-modal-overlay";
        modal.innerHTML = `
            <div class="stylehub-modal-box">
                <button class="stylehub-modal-close" type="button">×</button>
                <h3>Size Guide</h3>
                <table class="stylehub-size-table">
                    <thead><tr><th>Size</th><th>Gợi ý cân nặng</th><th>Gợi ý chiều cao</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                        <tr><td>XS</td><td>20 - 30kg</td><td>110 - 130cm</td><td>Kids / dáng nhỏ</td></tr>
                        <tr><td>S</td><td>30 - 45kg</td><td>130 - 155cm</td><td>Kids lớn / người nhỏ</td></tr>
                        <tr><td>M</td><td>45 - 58kg</td><td>155 - 168cm</td><td>Regular fit</td></tr>
                        <tr><td>L</td><td>58 - 72kg</td><td>168 - 178cm</td><td>Relaxed fit</td></tr>
                        <tr><td>XL</td><td>72 - 88kg</td><td>178 - 188cm</td><td>Oversized fit</td></tr>
                    </tbody>
                </table>
                <p style="margin-top:14px;color:#666;font-size:13px;line-height:1.6;">Bảng size chỉ mang tính tham khảo theo cân nặng và chiều cao. Với sản phẩm form rộng, có thể giảm 1 size nếu muốn mặc vừa người.</p>
            </div>
        `;
        document.body.appendChild(modal);
        btn.addEventListener("click", () => modal.classList.add("open"));
        modal.querySelector(".stylehub-modal-close").addEventListener("click", () => modal.classList.remove("open"));
        modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
    }

    function initProductThumbnails() {
        const gallery = document.querySelector("#gallery-target, .image-scroll-gallery");
        if (!gallery || document.querySelector(".stylehub-thumb-nav")) return;

        function build() {
            const imgs = Array.from(gallery.querySelectorAll("img")).slice(0, 6);
            if (imgs.length < 2 || document.querySelector(".stylehub-thumb-nav")) return;
            const nav = document.createElement("div");
            nav.className = "stylehub-thumb-nav";
            imgs.forEach((img, index) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.innerHTML = `<img src="${img.src}" alt="Thumbnail ${index + 1}">`;
                btn.addEventListener("click", () => img.scrollIntoView({ behavior: "smooth", block: "center" }));
                nav.appendChild(btn);
            });
            gallery.insertAdjacentElement("beforebegin", nav);
        }
        setTimeout(build, 300);
        setTimeout(build, 1000);
    }

    function saveRecentlyViewed() {
        const id = getCurrentProductId();
        const item = getProductData(id);
        if (!id || !item) return;

        const key = RECENT_KEY_PREFIX + getAccountKey();
        let list = [];
        try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { list = []; }
        list = list.filter(x => x !== id);
        list.unshift(id);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 8)));
    }

    function renderMiniProducts(sectionTitle, ids, className) {
        const valid = ids.map(id => [id, getProductData(id)]).filter(pair => pair[1]);
        if (!valid.length) return null;
        const section = document.createElement("section");
        section.className = className;
        section.innerHTML = `
            <h2>${sectionTitle}</h2>
            <div class="stylehub-mini-grid">
                ${valid.slice(0, 4).map(([id, item]) => `
                    <a class="stylehub-mini-card" href="product-detail.html?id=${encodeURIComponent(id)}">
                        <img src="${item.mainImg || (item.images && item.images[0]) || ""}" alt="${item.name || ""}">
                        <strong>${item.name || ""}</strong>
                        <span>${item.price || ""}</span>
                    </a>
                `).join("")}
            </div>
        `;
        return section;
    }

    function initRecentlyViewed() {
        const id = getCurrentProductId();
        if (!id) return;

        saveRecentlyViewed();

        // Chặn lỗi bị lặp Recently Viewed khi runAll chạy nhiều lần.
        document.querySelectorAll(".stylehub-recent-section").forEach(function(section, index) {
            if (index > 0) section.remove();
        });

        const existingSection = document.querySelector(".stylehub-recent-section");
        if (existingSection) return;

        const key = RECENT_KEY_PREFIX + getAccountKey();
        let ids = [];
        try { ids = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { ids = []; }
        ids = Array.from(new Set(ids)).filter(x => x !== id);

        const section = renderMiniProducts("Recently Viewed", ids, "stylehub-recent-section");
        if (section) {
            const related = document.querySelector("#relatedProductsSection");
            if (related) related.insertAdjacentElement("afterend", section);
            else document.body.appendChild(section);
        }
    }

    function initWishlistSectionOnAccount() {
        const profileTab = document.querySelector("#profile-tab");
        if (!profileTab) return;

        document.querySelectorAll(".stylehub-wishlist-section").forEach(function(section, index) {
            if (index > 0) section.remove();
        });

        if (document.querySelector(".stylehub-wishlist-section")) return;

        const ids = getWishlist();
        const section = renderMiniProducts("My Wishlist", ids, "stylehub-wishlist-section");
        if (section) profileTab.appendChild(section);
    }

    function initVoucherAndShipping() {
        const checkoutBody = document.querySelector("#checkoutOverlay .cart-body, .checkout-side-panel .cart-body");
        const checkoutFooter = document.querySelector("#checkoutOverlay .cart-footer, .checkout-side-panel .cart-footer");
        if (!checkoutBody || !checkoutFooter || document.querySelector(".stylehub-voucher-box")) return;

        const box = document.createElement("div");
        box.className = "stylehub-voucher-box";
        box.innerHTML = `
            <div class="stylehub-voucher-row">
                <input id="stylehubVoucherInput" placeholder="Enter discount code">
                <button type="button" id="stylehubApplyVoucher">Apply</button>
            </div>
            <div id="stylehubCheckoutTotals"></div>
            <small>Gợi ý: STYLE10 giảm 10%, FREESHIP miễn phí ship.</small>
        `;
        checkoutBody.appendChild(box);

        function readCartFromStorage() {
            const keys = ["stylehub_cart_memory_v1", "stylehub_cart", "hub_cart", "cart", "cartMemoryArray", "the_style_hub_cart"];

            for (const key of keys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key) || "[]");
                    if (Array.isArray(data) && data.length) return data;
                } catch (error) {}
            }

            return [];
        }

        function getCurrentDetailItemAsCart() {
            try {
                const params = new URLSearchParams(window.location.search);
                const id = params.get("id") || "";
                if (!id || typeof database === "undefined" || !database[id]) return [];

                const item = database[id];
                const selectedBtn = document.querySelector(".size-button.selected");
                const selectedSize = selectedBtn ? (selectedBtn.dataset.size || selectedBtn.innerText.trim()) : "M";

                return [{
                    key: id,
                    name: item.name || "",
                    price: item.price || "",
                    priceNum: Number(item.priceNum) || parseMoney(item.price),
                    qty: 1,
                    size: selectedSize
                }];
            } catch (error) {
                return [];
            }
        }

        function calcSubtotal() {
            let cart = readCartFromStorage();

            // Khi khách bấm Order Now, một số browser chưa kịp sync localStorage,
            // nên fallback bằng sản phẩm đang mở trên product-detail.
            if (!cart.length && /product-detail\.html/i.test(window.location.pathname)) {
                cart = getCurrentDetailItemAsCart();
            }

            return cart.reduce((sum, item) => {
                const price = Number(item.priceNum) || parseMoney(item.price || item.productPrice || item.itemPrice);
                const qty = Number(item.qty || item.quantity || item.amount || 1);
                return sum + price * qty;
            }, 0);
        }

        function renderTotals() {
            const code = String(localStorage.getItem(VOUCHER_KEY) || "").toUpperCase();
            const subtotal = calcSubtotal();
            const shipping = subtotal > 0 ? 30000 : 0;
            let discount = 0;

            if (code === "STYLE10") discount = Math.round(subtotal * 0.1);
            // FREESHIP vẫn hiển thị phí ship gốc, rồi trừ ở dòng giảm giá.
            if (code === "FREESHIP") discount = shipping;

            const total = Math.max(0, subtotal + shipping - discount);
            const totals = document.getElementById("stylehubCheckoutTotals");
            if (!totals) return;

            totals.innerHTML = `
                <div class="stylehub-checkout-line"><span>Tạm tính</span><strong>${formatMoney(subtotal)}</strong></div>
                <div class="stylehub-checkout-line"><span>Phí ship</span><strong>${formatMoney(shipping)}</strong></div>
                <div class="stylehub-checkout-line"><span>Giảm giá</span><strong>-${formatMoney(discount)}</strong></div>
                <div class="stylehub-checkout-line total"><span>Tổng cộng</span><strong>${formatMoney(total)}</strong></div>
            `;
        }

        box.querySelector("#stylehubApplyVoucher").addEventListener("click", () => {
            const code = box.querySelector("#stylehubVoucherInput").value.trim().toUpperCase();
            if (["STYLE10", "FREESHIP"].includes(code)) localStorage.setItem(VOUCHER_KEY, code);
            else localStorage.removeItem(VOUCHER_KEY);
            renderTotals();
            if (typeof window.renderCartUI === "function") {
                setTimeout(window.renderCartUI, 80);
            }
        });

        renderTotals();
        window.StyleHubRenderCheckoutTotals = renderTotals;

        ["click", "input", "change", "storage"].forEach(eventName => {
            window.addEventListener(eventName, () => setTimeout(renderTotals, 120));
            document.addEventListener(eventName, () => setTimeout(renderTotals, 120));
        });

        setTimeout(renderTotals, 250);
        setTimeout(renderTotals, 800);
        setTimeout(renderTotals, 1500);
    }

    function initFormValidation() {
        const phone = document.querySelector("#cusPhone, #editPhone");
        const email = document.querySelector("#cusEmail, #editEmail");
        const name = document.querySelector("#cusName, #editFullName");
        if (phone) {
            phone.setAttribute("pattern", "0[0-9]{9}");
            phone.setAttribute("title", "Số điện thoại phải gồm 10 số và bắt đầu bằng 0");
        }
        if (email) {
            email.setAttribute("type", "email");
            email.setAttribute("title", "Email phải đúng định dạng, ví dụ: name@gmail.com");
        }
        if (name) {
            name.setAttribute("minlength", "2");
            name.setAttribute("title", "Tên phải có ít nhất 2 ký tự");
        }
    }

    function initOrderStatusUI() {
        document.querySelectorAll(".order-history-list, #injectOrdersContainer, #injectCancelledOrdersContainer").forEach(list => {
            list.querySelectorAll(".order-card, .order-item, .admin-order-card").forEach(card => {
                if (card.querySelector(".stylehub-status-pill")) return;
                const text = card.textContent.toLowerCase();
                let label = "Đang chờ xác nhận";
                if (text.includes("đang giao") || text.includes("shipping")) label = "Đang giao hàng";
                if (text.includes("đã giao") || text.includes("delivered")) label = "Đã giao hàng";
                if (text.includes("hủy") || text.includes("cancel")) label = "Đã hủy";
                if (text.includes("xác nhận") || text.includes("confirmed")) label = "Đã xác nhận";
                const pill = document.createElement("span");
                pill.className = "stylehub-status-pill";
                pill.textContent = label;
                const title = card.querySelector("strong, h3, h4") || card;
                title.appendChild(pill);
            });
        });
    }

    function initAdminStatusControls() {
        if (!/admin\.html/i.test(location.pathname)) return;
        document.querySelectorAll(".order-card, .admin-order-card, .order-item").forEach(card => {
            if (card.querySelector(".stylehub-admin-status-select")) return;
            const select = document.createElement("select");
            select.className = "stylehub-admin-status-select";
            select.innerHTML = `
                <option>Đang chờ xác nhận</option>
                <option>Đã xác nhận</option>
                <option>Đang giao hàng</option>
                <option>Đã giao hàng</option>
                <option>Đã hủy</option>
            `;
            select.style.marginTop = "10px";
            select.style.padding = "8px";
            select.addEventListener("change", () => {
                localStorage.setItem("stylehub_latest_admin_status_change", JSON.stringify({
                    status: select.value,
                    time: Date.now()
                }));
                alert("Đã cập nhật trạng thái: " + select.value);
            });
            card.appendChild(select);
        });
    }

    function initStatusNotifications() {
        try {
            const raw = localStorage.getItem("stylehub_latest_admin_status_change");
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || !data.time || Date.now() - data.time > 86400000) return;
            const seen = localStorage.getItem("stylehub_seen_status_change_time");
            if (seen === String(data.time)) return;
            localStorage.setItem("stylehub_seen_status_change_time", String(data.time));
            if (typeof window.StyleHubNotifications !== "undefined" && window.StyleHubNotifications) return;
            console.log("Order status update:", data.status);
        } catch (e) {}
    }

    function initImageSkeletons() {
        document.querySelectorAll("img").forEach(img => {
            if (img.complete) return;
            img.classList.add("stylehub-skeleton");
            img.addEventListener("load", () => img.classList.remove("stylehub-skeleton"), { once: true });
            img.addEventListener("error", () => img.classList.remove("stylehub-skeleton"), { once: true });
        });
    }

    function initFooterPageLinks() {
        const footerCategories = document.querySelector(".site-footer .footer-categories");
        const footerSupport = document.querySelector(".site-footer .footer-support");
        if (footerCategories && !footerCategories.querySelector('a[href="about.html"]')) {
            footerCategories.insertAdjacentHTML("beforeend", '<a href="about.html">ABOUT THE STYLE HUB</a>');
        }
        if (footerSupport && !footerSupport.querySelector('a[href="contact.html"]')) {
            footerSupport.insertAdjacentHTML("beforeend", '<a href="contact.html">Liên hệ</a>');
        }
    }

    function runAll() {
        injectStyles();
        initFooterPageLinks();
        initCollectionFilters();
        initAdminCustomProductCards();
        initStockBadges();
        initWishlistClickGuard();
        initWishlistButtons();
        initSizeGuide();
        initProductThumbnails();
        initRecentlyViewed();
        initWishlistSectionOnAccount();
        initVoucherAndShipping();
        initFormValidation();
        initOrderStatusUI();
        initAdminStatusControls();
        initStatusNotifications();
        initImageSkeletons();
    }

    ready(function () {
        runAll();
        setTimeout(runAll, 500);
        setTimeout(runAll, 1500);
        document.addEventListener("stylehub-wishlist-change", function () {
            initWishlistButtons();
            initWishlistSectionOnAccount();
        });
        window.addEventListener("stylehub-inventory-change", function () {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
                window.StyleHubProductAdmin.applyAdminProductsToDatabase();
            }
            initStockBadges();
        });
        window.addEventListener("stylehub-products-change", function () {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.applyAdminProductsToDatabase === "function") {
                window.StyleHubProductAdmin.applyAdminProductsToDatabase();
            }
            initAdminCustomProductCards();
            initStockBadges();
        });
    });
})();



/* ===== FOOTER SOCIAL ICON CLEANUP: remove white box for YouTube/Shopee ===== */
function initFooterSocialIconCleanup() {
    if (!document.getElementById("stylehub-footer-icon-cleanup-style")) {
        const style = document.createElement("style");
        style.id = "stylehub-footer-icon-cleanup-style";
        style.textContent = `
            .site-footer .footer-social-icon,
            .site-footer .social-links a,
            .site-footer .footer-social-links a {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                overflow: visible !important;
            }

            .site-footer .footer-social-icon img,
            .site-footer .social-links img,
            .site-footer .footer-social-links img {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                object-fit: contain !important;
                display: block !important;
            }

            .site-footer img[data-stylehub-clean-social="youtube"],
            .site-footer img[data-stylehub-clean-social="shopee"] {
                width: 42px !important;
                height: 42px !important;
                max-width: 42px !important;
                max-height: 42px !important;
                min-width: 42px !important;
                min-height: 42px !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
                border-radius: 50% !important;
                object-fit: contain !important;
                vertical-align: middle !important;
            }

            @media (max-width: 768px) {
                .site-footer img[data-stylehub-clean-social="youtube"],
                .site-footer img[data-stylehub-clean-social="shopee"] {
                    width: 38px !important;
                    height: 38px !important;
                    max-width: 38px !important;
                    max-height: 38px !important;
                    min-width: 38px !important;
                    min-height: 38px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const youtubeSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2048%2048%27%3E%3Ccircle%20cx%3D%2724%27%20cy%3D%2724%27%20r%3D%2722%27%20fill%3D%27%23ff0000%27/%3E%3Cpath%20d%3D%27M20%2016.5v15l13-7.5-13-7.5z%27%20fill%3D%27%23fff%27/%3E%3C/svg%3E";
    const shopeeSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2048%2048%27%3E%3Ccircle%20cx%3D%2724%27%20cy%3D%2724%27%20r%3D%2722%27%20fill%3D%27%23ee4d2d%27/%3E%3Cpath%20d%3D%27M15%2018h18l-1.5%2018h-15L15%2018z%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272.3%27%20stroke-linejoin%3D%27round%27/%3E%3Cpath%20d%3D%27M18.5%2018c0-4.2%202.2-7%205.5-7s5.5%202.8%205.5%207%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272.3%27%20stroke-linecap%3D%27round%27/%3E%3Ctext%20x%3D%2724%27%20y%3D%2731%27%20font-family%3D%27Arial%2C%20Helvetica%2C%20sans-serif%27%20font-size%3D%2713%27%20font-weight%3D%27700%27%20text-anchor%3D%27middle%27%20fill%3D%27%23fff%27%3ES%3C/text%3E%3C/svg%3E";

    document.querySelectorAll(".site-footer img").forEach(function(img) {
        const src = (img.getAttribute("src") || "").toLowerCase();
        const alt = (img.getAttribute("alt") || "").toLowerCase();
        const label = src + " " + alt;

        if (label.includes("ytb") || label.includes("youtube") || label.includes("you tube")) {
            img.setAttribute("src", youtubeSvg);
            img.setAttribute("alt", "YouTube");
            img.setAttribute("data-stylehub-clean-social", "youtube");
            img.closest("a")?.classList.add("footer-social-icon", "footer-youtube-icon");
        }

        if (label.includes("shoppe") || label.includes("shopee")) {
            img.setAttribute("src", shopeeSvg);
            img.setAttribute("alt", "Shopee");
            img.setAttribute("data-stylehub-clean-social", "shopee");
            img.closest("a")?.classList.add("footer-social-icon", "footer-shopee-icon");
        }
    });
}


document.addEventListener("DOMContentLoaded", initFooterSocialIconCleanup);



/* ===== FORCE FOOTER BLACK BACKGROUND - FINAL ===== */
function initStyleHubBlackFooterFinal() {
    if (document.getElementById("stylehub-black-footer-final-style")) return;

    const style = document.createElement("style");
    style.id = "stylehub-black-footer-final-style";
    style.textContent = `
        html body .site-footer,
        html body footer.site-footer,
        html body .footer,
        html body footer,
        html body [class*="footer"] {
            background: #050505 !important;
            background-color: #050505 !important;
            background-image: none !important;
        }

        html body .site-footer::before,
        html body .site-footer::after,
        html body footer::before,
        html body footer::after,
        html body [class*="footer"]::before,
        html body [class*="footer"]::after {
            background: #050505 !important;
            background-color: #050505 !important;
            background-image: none !important;
        }

        html body .site-footer a,
        html body footer.site-footer a,
        html body .footer a,
        html body footer a {
            color: rgba(255,255,255,0.84) !important;
        }

        html body .site-footer h1,
        html body .site-footer h2,
        html body .site-footer h3,
        html body .site-footer h4,
        html body .site-footer strong,
        html body footer.site-footer h1,
        html body footer.site-footer h2,
        html body footer.site-footer h3,
        html body footer.site-footer h4,
        html body footer.site-footer strong {
            color: #ffffff !important;
        }

        html body .site-footer p,
        html body .site-footer span,
        html body .site-footer li,
        html body footer.site-footer p,
        html body footer.site-footer span,
        html body footer.site-footer li {
            color: rgba(255,255,255,0.84) !important;
        }
    `;
    document.head.appendChild(style);

    document.querySelectorAll(".site-footer, footer.site-footer, .footer, footer").forEach(function(el) {
        el.style.setProperty("background", "#050505", "important");
        el.style.setProperty("background-color", "#050505", "important");
        el.style.setProperty("background-image", "none", "important");
    });
}


document.addEventListener("DOMContentLoaded", initStyleHubBlackFooterFinal);



/* ===== REMOVE COLLECTION EXTRA FILTER BAR ===== */
function removeStyleHubExtraFilterBar() {
    document.querySelectorAll(
        ".stylehub-extra-filter-bar, #stylehubPriceFilter, #stylehubSizeFilter, #stylehubColorFilter, #stylehubClearFilters"
    ).forEach(function (el) {
        const bar = el.closest(".stylehub-extra-filter-bar");
        if (bar) {
            bar.remove();
        } else {
            el.remove();
        }
    });
}

function initRemoveStyleHubExtraFilterBar() {
    if (!document.getElementById("stylehub-remove-extra-filter-style")) {
        const style = document.createElement("style");
        style.id = "stylehub-remove-extra-filter-style";
        style.textContent = `
            .stylehub-extra-filter-bar,
            #stylehubPriceFilter,
            #stylehubSizeFilter,
            #stylehubColorFilter,
            #stylehubClearFilters {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    removeStyleHubExtraFilterBar();

    setTimeout(removeStyleHubExtraFilterBar, 100);
    setTimeout(removeStyleHubExtraFilterBar, 500);
    setTimeout(removeStyleHubExtraFilterBar, 1200);
}


document.addEventListener("DOMContentLoaded", initRemoveStyleHubExtraFilterBar);












/* ===== PRODUCT IMAGE ZOOM LIGHTBOX - ALL PRODUCTS ===== */
function initStyleHubProductImageLightbox() {
    if (window.__stylehubProductImageLightboxReady) return;
    window.__stylehubProductImageLightboxReady = true;

    if (!document.getElementById("stylehub-product-lightbox-style")) {
        const style = document.createElement("style");
        style.id = "stylehub-product-lightbox-style";
        style.textContent = `
            .stylehub-product-lightbox {
                position: fixed;
                inset: 0;
                z-index: 2147482000;
                background: #ffffff;
                display: none;
                color: #111111;
            }

            .stylehub-product-lightbox.open {
                display: block;
            }

            .stylehub-lightbox-close {
                position: fixed;
                top: 36px;
                right: 42px;
                z-index: 2147482100;
                width: 44px;
                height: 44px;
                border: none;
                background: transparent;
                color: #111111;
                font-size: 34px;
                line-height: 1;
                cursor: pointer;
                font-weight: 300;
            }

            .stylehub-lightbox-main {
                width: 100%;
                height: 100vh;
                overflow-y: auto;
                scroll-behavior: smooth;
                padding: 90px 145px 90px 80px;
                box-sizing: border-box;
            }

            .stylehub-lightbox-image-wrap {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px 0;
                box-sizing: border-box;
            }

            .stylehub-lightbox-image-wrap img {
                width: auto;
                height: auto;
                max-width: min(1120px, 86vw);
                max-height: none;
                object-fit: contain;
                display: block;
                user-select: none;
            }

            .stylehub-lightbox-thumbs {
                position: fixed;
                right: 38px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 2147482050;
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 76vh;
                overflow-y: auto;
                padding: 4px;
            }

            .stylehub-lightbox-thumb {
                width: 72px;
                height: 92px;
                padding: 0;
                background: #f7f7f7;
                border: 1px solid transparent;
                cursor: pointer;
                overflow: hidden;
            }

            .stylehub-lightbox-thumb.active {
                border-color: #111111;
            }

            .stylehub-lightbox-thumb img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center top;
                display: block;
            }

            .stylehub-lightbox-hint {
                position: fixed;
                left: 42px;
                top: 38px;
                z-index: 2147482050;
                color: #777777;
                font-size: 11px;
                letter-spacing: 1.6px;
                text-transform: uppercase;
            }

            .image-scroll-gallery img,
            #gallery-target img,
            .product-gallery img,
            .product-image-gallery img {
                cursor: zoom-in;
            }

            body.stylehub-lightbox-open {
                overflow: hidden !important;
            }

            @media (max-width: 768px) {
                .stylehub-lightbox-main {
                    padding: 78px 18px 120px;
                }

                .stylehub-lightbox-image-wrap {
                    min-height: 78vh;
                }

                .stylehub-lightbox-image-wrap img {
                    max-width: 96vw;
                }

                .stylehub-lightbox-thumbs {
                    left: 0;
                    right: 0;
                    bottom: 18px;
                    top: auto;
                    transform: none;
                    flex-direction: row;
                    justify-content: center;
                    max-height: none;
                    overflow-x: auto;
                    padding: 0 18px;
                }

                .stylehub-lightbox-thumb {
                    width: 58px;
                    height: 74px;
                    flex: 0 0 auto;
                }

                .stylehub-lightbox-close {
                    top: 22px;
                    right: 22px;
                }

                .stylehub-lightbox-hint {
                    left: 22px;
                    top: 28px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getProductImages() {
        const selectors = [
            "#gallery-target img",
            ".image-scroll-gallery img",
            ".product-gallery img",
            ".product-image-gallery img",
            ".product-detail-gallery img"
        ];

        const found = [];
        selectors.forEach(function(selector) {
            document.querySelectorAll(selector).forEach(function(img) {
                const src = img.currentSrc || img.src || img.getAttribute("src");
                if (!src) return;
                if (found.some(item => item.src === src)) return;
                found.push({
                    src: src,
                    alt: img.alt || "Product image",
                    node: img
                });
            });
        });

        return found;
    }

    function ensureLightbox() {
        let box = document.getElementById("stylehubProductLightbox");
        if (box) return box;

        box = document.createElement("div");
        box.id = "stylehubProductLightbox";
        box.className = "stylehub-product-lightbox";
        box.innerHTML = `
            <div class="stylehub-lightbox-hint">Click image to zoom · ESC to close</div>
            <button class="stylehub-lightbox-close" type="button" aria-label="Close image zoom">×</button>
            <div class="stylehub-lightbox-main" id="stylehubLightboxMain"></div>
            <div class="stylehub-lightbox-thumbs" id="stylehubLightboxThumbs"></div>
        `;
        document.body.appendChild(box);

        box.querySelector(".stylehub-lightbox-close").addEventListener("click", closeLightbox);
        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape" && box.classList.contains("open")) {
                closeLightbox();
            }
        });

        return box;
    }

    function closeLightbox() {
        const box = document.getElementById("stylehubProductLightbox");
        if (!box) return;
        box.classList.remove("open");
        document.body.classList.remove("stylehub-lightbox-open");
    }

    function openLightbox(startIndex) {
        const images = getProductImages();
        if (!images.length) return;

        const box = ensureLightbox();
        const main = box.querySelector("#stylehubLightboxMain");
        const thumbs = box.querySelector("#stylehubLightboxThumbs");

        main.innerHTML = images.map(function(item, index) {
            return `
                <section class="stylehub-lightbox-image-wrap" data-lightbox-index="${index}">
                    <img src="${item.src}" alt="${item.alt.replace(/"/g, "&quot;")}">
                </section>
            `;
        }).join("");

        thumbs.innerHTML = images.map(function(item, index) {
            return `
                <button class="stylehub-lightbox-thumb" type="button" data-lightbox-thumb="${index}">
                    <img src="${item.src}" alt="${item.alt.replace(/"/g, "&quot;")}">
                </button>
            `;
        }).join("");

        const sections = Array.from(main.querySelectorAll(".stylehub-lightbox-image-wrap"));
        const thumbButtons = Array.from(thumbs.querySelectorAll(".stylehub-lightbox-thumb"));

        function setActive(index) {
            thumbButtons.forEach(function(btn, i) {
                btn.classList.toggle("active", i === index);
            });
        }

        thumbButtons.forEach(function(btn) {
            btn.addEventListener("click", function() {
                const index = Number(btn.dataset.lightboxThumb || 0);
                if (sections[index]) {
                    sections[index].scrollIntoView({ behavior: "smooth", block: "start" });
                    setActive(index);
                }
            });
        });

        main.addEventListener("scroll", function() {
            let active = 0;
            const mainRect = main.getBoundingClientRect();

            sections.forEach(function(section, index) {
                const rect = section.getBoundingClientRect();
                if (Math.abs(rect.top - mainRect.top) < Math.abs(sections[active].getBoundingClientRect().top - mainRect.top)) {
                    active = index;
                }
            });

            setActive(active);
        });

        box.classList.add("open");
        document.body.classList.add("stylehub-lightbox-open");

        const safeIndex = Math.max(0, Math.min(images.length - 1, Number(startIndex || 0)));
        setTimeout(function() {
            if (sections[safeIndex]) {
                sections[safeIndex].scrollIntoView({ behavior: "auto", block: "start" });
            }
            setActive(safeIndex);
        }, 30);
    }

    function bindGalleryImages() {
        const images = getProductImages();

        images.forEach(function(item, index) {
            if (item.node.dataset.stylehubLightboxBound === "1") return;
            item.node.dataset.stylehubLightboxBound = "1";
            item.node.addEventListener("click", function(event) {
                event.preventDefault();
                event.stopPropagation();
                openLightbox(index);
            });
        });
    }

    bindGalleryImages();

    // Product images can be rendered after product-data.js loads.
    setTimeout(bindGalleryImages, 300);
    setTimeout(bindGalleryImages, 900);
    setTimeout(bindGalleryImages, 1600);
}

document.addEventListener("DOMContentLoaded", initStyleHubProductImageLightbox);







/* ===== RESTORE ORIGINAL HEADER MENU CLEANUP ===== */
function restoreStyleHubOriginalHeaderMenuCleanup() {
    document.querySelectorAll(
        "#stylehubFearNavPanel, #stylehubFloatingNavDropdown, .stylehub-fear-nav-panel, .stylehub-floating-nav-dropdown, .stylehub-header-dropdown-menu"
    ).forEach(function(el) {
        el.remove();
    });

    document.querySelectorAll(".stylehub-header-dropdown-wrap").forEach(function(wrapper) {
        const firstLink = wrapper.querySelector("a, button, span");
        if (firstLink && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(firstLink, wrapper);
            wrapper.remove();
        }
    });
}

document.addEventListener("DOMContentLoaded", restoreStyleHubOriginalHeaderMenuCleanup);
setTimeout(restoreStyleHubOriginalHeaderMenuCleanup, 300);
setTimeout(restoreStyleHubOriginalHeaderMenuCleanup, 1000);



/* ===== LOGO HOME LINK ONLY ===== */
function initStyleHubLogoHomeOnly() {
    function normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
    }

    document.querySelectorAll(".main-header, header.main-header, .site-header, header").forEach(function(header) {
        Array.from(header.querySelectorAll("a, div, h1, h2, span")).forEach(function(el) {
            if (normalizeText(el.textContent) !== "THE STYLE HUB") return;
            if (el.closest(".stylehub-fear-nav-panel, .stylehub-floating-nav-dropdown")) return;

            if (el.tagName.toLowerCase() === "a") {
                el.href = "index.html";
                return;
            }

            if (el.dataset.stylehubLogoHomeOnly === "1") return;
            el.dataset.stylehubLogoHomeOnly = "1";

            const a = document.createElement("a");
            a.href = "index.html";
            a.className = el.className || "";
            a.innerHTML = el.innerHTML;
            if (el.getAttribute("style")) a.setAttribute("style", el.getAttribute("style"));
            a.style.color = "inherit";
            a.style.textDecoration = "none";
            el.replaceWith(a);
        });
    });
}

document.addEventListener("DOMContentLoaded", initStyleHubLogoHomeOnly);
setTimeout(initStyleHubLogoHomeOnly, 500);


/* ===== FOOTER SOCIAL YOUTUBE + SHOPEE FIX ===== */
function initStyleHubFooterSocialFullSet() {
    const footerSocialStyleId = "stylehub-footer-social-full-set-style";

    if (!document.getElementById(footerSocialStyleId)) {
        const style = document.createElement("style");
        style.id = footerSocialStyleId;
        style.textContent = `
            .site-footer .social-links,
            .site-footer .footer-social-links {
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 18px !important;
                max-width: 360px !important;
                width: 100% !important;
                flex-wrap: nowrap !important;
            }

            .site-footer .footer-social-icon {
                width: 42px !important;
                height: 42px !important;
                min-width: 42px !important;
                min-height: 42px !important;
                max-width: 42px !important;
                max-height: 42px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: transparent !important;
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                text-decoration: none !important;
                overflow: visible !important;
            }

            .site-footer .footer-social-icon img {
                display: block !important;
                object-fit: contain !important;
                object-position: center !important;
                border: 0 !important;
                outline: none !important;
                border-radius: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .site-footer .footer-fb-icon img,
            .site-footer .footer-zalo-icon img,
            .site-footer .footer-instagram-icon img {
                width: 38px !important;
                height: 38px !important;
                max-width: 38px !important;
                max-height: 38px !important;
            }

            .site-footer .footer-youtube-icon img {
                width: 39px !important;
                height: 39px !important;
                max-width: 39px !important;
                max-height: 39px !important;
            }

            .site-footer .footer-shopee-icon img {
                width: 39px !important;
                height: 39px !important;
                max-width: 39px !important;
                max-height: 39px !important;
            }

            .site-footer .footer-youtube-icon,
            .site-footer .footer-shopee-icon {
                border-radius: 50% !important;
                background: transparent !important;
                overflow: hidden !important;
            }

            .site-footer .footer-youtube-icon img,
            .site-footer .footer-shopee-icon img,
            .site-footer img[data-stylehub-clean-social="youtube"],
            .site-footer img[data-stylehub-clean-social="shopee"] {
                border-radius: 50% !important;
                background: transparent !important;
                object-fit: cover !important;
                display: block !important;
            }

            @media (max-width: 768px) {
                .site-footer .social-links,
                .site-footer .footer-social-links {
                    gap: 14px !important;
                    max-width: 300px !important;
                    flex-wrap: nowrap !important;
                }

                .site-footer .footer-social-icon {
                    width: 36px !important;
                    height: 36px !important;
                    min-width: 36px !important;
                    min-height: 36px !important;
                    max-width: 36px !important;
                    max-height: 36px !important;
                }

                .site-footer .footer-fb-icon img,
                .site-footer .footer-zalo-icon img,
                .site-footer .footer-instagram-icon img,
                .site-footer .footer-youtube-icon img,
                .site-footer .footer-shopee-icon img {
                    width: 32px !important;
                    height: 32px !important;
                    max-width: 32px !important;
                    max-height: 32px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const youtubeCleanSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2048%2048%27%3E%3Ccircle%20cx%3D%2724%27%20cy%3D%2724%27%20r%3D%2722%27%20fill%3D%27%23ff0000%27/%3E%3Cpath%20d%3D%27M20%2016.5v15l13-7.5-13-7.5z%27%20fill%3D%27%23fff%27/%3E%3C/svg%3E";
    const shopeeCleanSvg = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2048%2048%27%3E%3Ccircle%20cx%3D%2724%27%20cy%3D%2724%27%20r%3D%2722%27%20fill%3D%27%23ee4d2d%27/%3E%3Cpath%20d%3D%27M15%2018h18l-1.5%2018h-15L15%2018z%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272.3%27%20stroke-linejoin%3D%27round%27/%3E%3Cpath%20d%3D%27M18.5%2018c0-4.2%202.2-7%205.5-7s5.5%202.8%205.5%207%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%272.3%27%20stroke-linecap%3D%27round%27/%3E%3Ctext%20x%3D%2724%27%20y%3D%2731%27%20font-family%3D%27Arial%2C%20Helvetica%2C%20sans-serif%27%20font-size%3D%2713%27%20font-weight%3D%27700%27%20text-anchor%3D%27middle%27%20fill%3D%27%23fff%27%3ES%3C/text%3E%3C/svg%3E";

    function createIcon(className, imageSrc, label, cleanType) {
        const link = document.createElement("a");
        link.className = "footer-social-icon " + className;
        link.href = "#";
        link.setAttribute("aria-label", label);

        const img = document.createElement("img");
        img.src = imageSrc;
        img.alt = label;
        if (cleanType) img.setAttribute("data-stylehub-clean-social", cleanType);

        link.appendChild(img);
        return link;
    }

    document.querySelectorAll(".site-footer .footer-social-links, .site-footer .social-links").forEach(function(group) {
        if (!group.closest(".site-footer")) return;

        if (!group.querySelector(".footer-youtube-icon, img[data-stylehub-clean-social='youtube'], img[src*='ytb.png']")) {
            group.appendChild(createIcon("footer-youtube-icon", youtubeCleanSvg, "YouTube", "youtube"));
        }

        if (!group.querySelector(".footer-shopee-icon, img[data-stylehub-clean-social='shopee'], img[src*='shoppe.png'], img[src*='shopee.png']")) {
            group.appendChild(createIcon("footer-shopee-icon", shopeeCleanSvg, "Shopee", "shopee"));
        }
    });

    if (typeof initFooterSocialIconCleanup === "function") {
        initFooterSocialIconCleanup();
    }
}

document.addEventListener("DOMContentLoaded", initStyleHubFooterSocialFullSet);
setTimeout(initStyleHubFooterSocialFullSet, 300);
setTimeout(initStyleHubFooterSocialFullSet, 1000);
/* ===== END FOOTER SOCIAL YOUTUBE + SHOPEE FIX ===== */


/* ===== FEATURED MENU CLEANUP: REMOVE EXTRA COLLECTION LINKS ===== */
(function () {
    const removeTexts = new Set([
        "MLB SPRING 2026",
        "COLLECTION NINE WOMENSWEAR",
        "ESSENTIALS CLASSIC STYLES",
        "ATHLETICS & TEAM APPAREL",
        "ESSENTIALS",
        "FEAR OF GOD",
        "SALE"
    ]);

    function normalizeText(value) {
        return (value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function cleanDesktopFeaturedMenu() {
        document.querySelectorAll(".main-header .menu-item-has-mega").forEach(function (menu) {
            const trigger = menu.querySelector(":scope > a");
            if (normalizeText(trigger && trigger.textContent) !== "FEATURED") return;

            menu.querySelectorAll(".mega-links-col > a").forEach(function (link) {
                if (removeTexts.has(normalizeText(link.textContent))) {
                    link.remove();
                }
            });
        });
    }

    function cleanMobileFeaturedMenu() {
        document.querySelectorAll(".mobile-menu-group").forEach(function (group) {
            const title = group.querySelector(".mobile-menu-title");
            if (normalizeText(title && title.textContent) !== "FEATURED") return;

            group.querySelectorAll("a").forEach(function (link) {
                if (removeTexts.has(normalizeText(link.textContent))) {
                    link.remove();
                }
            });
        });
    }

    function cleanFeaturedMenu() {
        cleanDesktopFeaturedMenu();
        cleanMobileFeaturedMenu();
    }

    cleanFeaturedMenu();
    document.addEventListener("DOMContentLoaded", cleanFeaturedMenu);
    window.addEventListener("load", cleanFeaturedMenu);
    setTimeout(cleanFeaturedMenu, 250);
    setTimeout(cleanFeaturedMenu, 800);
})();
/* ===== END FEATURED MENU CLEANUP ===== */

/* ===== MOBILE PRODUCT IMAGE FLIP ===== */
(function () {
    function isMobileTouch() {
        return window.matchMedia('(max-width: 768px)').matches &&
            (window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0);
    }

    function injectMobileFlipStyles() {
        if (document.getElementById('stylehub-mobile-product-flip-style')) return;
        const style = document.createElement('style');
        style.id = 'stylehub-mobile-product-flip-style';
        style.textContent = `
            @media (max-width: 768px) {
                .mens-card.mobile-image-flipped .img-front,
                .product-card.mobile-image-flipped .img-main {
                    opacity: 0 !important;
                }

                .mens-card.mobile-image-flipped .img-back,
                .product-card.mobile-image-flipped .img-hover {
                    opacity: 1 !important;
                    transform: scale(1.01) !important;
                }

                .mens-thumb-box img,
                .product-thumb img,
                .hover-img img {
                    transition: opacity .35s ease, transform .35s ease !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function findProductCard(target) {
        return target.closest('.mens-card, .product-card');
    }

    function hasSecondImage(card) {
        return !!(
            (card.querySelector('.img-front') && card.querySelector('.img-back')) ||
            (card.querySelector('.img-main') && card.querySelector('.img-hover'))
        );
    }

    function isInsideProductImage(target, card) {
        const imageArea = target.closest('.mens-thumb-box, .product-thumb, .hover-img, .product-image, .thumb-box');
        return !!(imageArea && card.contains(imageArea));
    }

    function closeOtherCards(currentCard) {
        document.querySelectorAll('.mens-card.mobile-image-flipped, .product-card.mobile-image-flipped')
            .forEach(function (card) {
                if (card !== currentCard) card.classList.remove('mobile-image-flipped');
            });
    }

    document.addEventListener('click', function (event) {
        if (!isMobileTouch()) return;

        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('.stylehub-wishlist-btn, button, input, select, textarea')) return;

        const card = findProductCard(target);
        if (!card || !hasSecondImage(card) || !isInsideProductImage(target, card)) return;

        if (!card.classList.contains('mobile-image-flipped')) {
            event.preventDefault();
            event.stopPropagation();
            closeOtherCards(card);
            card.classList.add('mobile-image-flipped');
        }
    }, true);

    document.addEventListener('click', function (event) {
        if (!isMobileTouch()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('.mens-card, .product-card')) return;
        closeOtherCards(null);
    });

    injectMobileFlipStyles();
    document.addEventListener('DOMContentLoaded', injectMobileFlipStyles);
})();
/* ===== END MOBILE PRODUCT IMAGE FLIP ===== */
