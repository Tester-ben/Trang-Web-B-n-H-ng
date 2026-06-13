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
        searchInput.addEventListener("keyup", searchProducts);
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

function searchProducts() {
    const searchInput = document.getElementById("searchInput");
    const resultsBox = document.getElementById("searchResults");
    if (!searchInput || !resultsBox) return;

    const keyword = searchInput.value.trim().toLowerCase();
    resultsBox.innerHTML = "";
    if (!keyword) return;

    if (typeof database === "undefined") {
        resultsBox.innerHTML = `<p class="search-empty">Product data is not loaded.</p>`;
        return;
    }

    const results = Object.keys(database).filter(function (id) {
        const item = database[id];
        if (!item) return false;
        const text = `${item.name || ""} ${item.brand || ""} ${item.price || ""}`.toLowerCase();
        return text.includes(keyword);
    });

    if (results.length === 0) {
        resultsBox.innerHTML = `<p class="search-empty">No products found.</p>`;
        return;
    }

    results.slice(0, 10).forEach(function (id) {
        const item = database[id];
        const row = document.createElement("div");
        row.className = "search-result-item";
        row.innerHTML = `
            <div class="search-result-thumb">
                <img src="${item.mainImg || (item.images && item.images[0]) || ""}" alt="${item.name || ""}">
            </div>
            <div class="search-result-info">
                <strong>${item.name || ""}</strong>
                <small>${item.brand || ""}</small>
                <span>${item.price || ""}</span>
            </div>
        `;
        row.addEventListener("click", function () {
            window.location.href = "product-detail.html?id=" + id;
        });
        resultsBox.appendChild(row);
    });
}
