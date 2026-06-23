document.addEventListener("DOMContentLoaded", function () {
    syncHeaderAccountName();
    syncBagCount();
    bindSearchBox();
    initFooterSupportContactBlock();
    initSmartHeaderScroll();
});

function syncHeaderAccountName() {
    const accountLinks = document.querySelectorAll("#account-trigger, #headerAccountLink");
    const isLoggedIn = localStorage.getItem("isLoggedInStatus") === "true";
    const savedName = localStorage.getItem("hub_name");
    if (isLoggedIn && !localStorage.getItem("hub_current_user_key") && localStorage.getItem("hub_email")) {
        localStorage.setItem("hub_current_user_key", localStorage.getItem("hub_email").trim().toLowerCase());
    }

    accountLinks.forEach(function (link) {
        if (isLoggedIn && savedName && savedName.trim() !== "") {
            link.textContent = savedName.toUpperCase();
            link.href = "account.html";
        } else {
            link.textContent = "ACCOUNT";
            link.href = "account.html";
        }
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

            @media (max-width: 768px) {
                .footer-support-contact-block {
                    margin-top: 24px;
                    max-width: 100%;
                }

                .footer-support-contact-line {
                    font-size: 12px;
                    white-space: nowrap;
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
            <p class="footer-support-contact-line"><span><strong>Gọi mua:</strong>&nbsp;<a href="tel:02796096060">02796096060</a>&nbsp;(8:00 - 21:30)</span></p>
            <p class="footer-support-contact-line"><span><strong>Khiếu nại:</strong>&nbsp;<a href="tel:02873066060">02873066060</a>&nbsp;(8:00 - 21:30)</span></p>
            <p class="footer-support-contact-line"><span><strong>Bảo hành:</strong>&nbsp;<a href="tel:02873066060">02873066060</a>&nbsp;(8:00 - 21:00)</span></p>
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
                z-index: 5000 !important;
                overflow: visible !important;
                pointer-events: auto;
            }

            body.stylehub-smart-header.stylehub-header-hidden .main-header {
                transform: translateY(-100%);
                pointer-events: none;
            }

            body.stylehub-smart-header .main-header .nav-dropdown,
            body.stylehub-smart-header .main-header .mega-menu-dropdown {
                z-index: 6000 !important;
                pointer-events: auto !important;
            }

            body.stylehub-smart-header .main-header .menu-item-has-dropdown:hover .nav-dropdown,
            body.stylehub-smart-header .main-header .menu-item-has-mega:hover .mega-menu-dropdown {
                display: block;
            }

            body.stylehub-smart-header .sub-filter-bar {
                position: sticky !important;
                top: 57px;
                z-index: 950;
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
