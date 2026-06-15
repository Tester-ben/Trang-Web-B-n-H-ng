
function openSearchBox() {
    const box = document.getElementById("searchBox");
    const input = document.getElementById("searchInput");
    if (box) box.style.display = "block";
    if (input) setTimeout(() => input.focus(), 80);
}
function closeSearchBox() {
    const box = document.getElementById("searchBox");
    const results = document.getElementById("searchResults");
    const input = document.getElementById("searchInput");
    if (box) box.style.display = "none";
    if (results) results.innerHTML = "";
    if (input) input.value = "";
}
function searchProducts() {
    const input = document.getElementById("searchInput");
    const resultsBox = document.getElementById("searchResults");
    if (!input || !resultsBox || typeof database === "undefined") return;
    const keyword = input.value.trim().toLowerCase();
    resultsBox.innerHTML = "";
    if (!keyword) return;
    const results = Object.keys(database).filter(id => {
        const item = database[id] || {};
        const text = `${item.name || ""} ${item.brand || ""} ${item.key || ""}`.toLowerCase();
        return text.includes(keyword);
    }).slice(0, 12);
    if (results.length === 0) {
        resultsBox.innerHTML = `<p class="search-empty">No products found.</p>`;
        return;
    }
    results.forEach(id => {
        const item = database[id];
        resultsBox.innerHTML += `
            <div class="search-result-item" onclick="window.location.href='product-detail.html?id=${id}'">
                <img src="${item.mainImg || (item.images && item.images[0]) || ''}" alt="${item.name || ''}">
                <div>
                    <strong>${item.name || ''}</strong>
                    <span>${item.price || ''}</span>
                </div>
            </div>`;
    });
}
document.addEventListener("DOMContentLoaded", function () {
    const trigger = document.getElementById("search-trigger");
    if (trigger) {
        trigger.addEventListener("click", function(e) {
            e.preventDefault();
            openSearchBox();
        });
    }
});
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeSearchBox();
    if (e.key === "Enter" && document.activeElement && document.activeElement.id === "searchInput") {
        const first = document.querySelector(".search-result-item");
        if (first) first.click();
    }
});
document.addEventListener("click", function(e) {
    const box = document.getElementById("searchBox");
    if (box && e.target === box) closeSearchBox();
});
