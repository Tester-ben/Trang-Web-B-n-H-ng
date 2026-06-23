document.addEventListener("DOMContentLoaded", function () {
    syncHeaderAccountName();
    syncBagCount();
    bindSearchBox();
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
