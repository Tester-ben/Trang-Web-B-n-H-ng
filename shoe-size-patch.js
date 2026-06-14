(function () {
    "use strict";

    function getProductId() {
        return new URLSearchParams(window.location.search).get("id") || "";
    }

    function isShoeProduct() {
        const id = getProductId().toLowerCase();
        return id.startsWith("shoe");
    }

    function patchShoeSizes() {
        if (!isShoeProduct()) return;

        const group = document.querySelector(".size-buttons-group");
        if (!group) return;

        group.innerHTML = `
            <div class="shoe-size-panel">
                <div class="shoe-size-row">
                    <div class="shoe-size-label">SIZE NAM</div>
                    <div class="shoe-size-options">
                        ${Array.from({ length: 16 }, (_, i) => 21 + i)
                            .map(n => `<button type="button" class="size-button shoe-number-size" data-size="${n}">${n}</button>`)
                            .join("")}
                    </div>
                </div>

                <div class="shoe-size-row">
                    <div class="shoe-size-label">SIZE NỮ</div>
                    <div class="shoe-size-options">
                        ${Array.from({ length: 15 }, (_, i) => 19 + i)
                            .map(n => `<button type="button" class="size-button shoe-number-size" data-size="${n}">${n}</button>`)
                            .join("")}
                    </div>
                </div>
            </div>
        `;

        const first = group.querySelector(".shoe-number-size");
        if (first) first.classList.add("selected");

        group.querySelectorAll(".shoe-number-size").forEach(btn => {
            btn.addEventListener("click", function () {
                group.querySelectorAll(".shoe-number-size").forEach(x => x.classList.remove("selected"));
                this.classList.add("selected");
                window.selectedSizeText = this.dataset.size;
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(patchShoeSizes, 300);
    });
})();