(function () {
    "use strict";

    function getProductId() {
        return new URLSearchParams(window.location.search).get("id") || "";
    }

    function isShoeProduct() {
        return getProductId().toLowerCase().startsWith("shoe");
    }

    function patchShoeSizes() {
        if (!isShoeProduct()) return;

        const group = document.querySelector(".size-buttons-group");
        if (!group) return;

        // product-detail.html mới đã render size giày trực tiếp để tránh nháy S/M/L/XL.
        // Nếu đã render rồi thì không patch lại nữa.
        if (group.getAttribute("data-size-type") === "shoes" && group.querySelector(".shoe-number-size")) return;

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

        const style = document.createElement("style");
        style.textContent = `
            .shoe-size-panel {
                display: flex;
                flex-direction: column;
                gap: 28px;
                margin-top: 14px;
                margin-bottom: 30px;
            }

            .shoe-size-row {
                display: grid;
                grid-template-columns: 90px 1fr;
                gap: 18px;
                align-items: start;
            }

            .shoe-size-label {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 1.2px;
                padding-top: 14px;
                white-space: nowrap;
            }

            .shoe-size-options {
                display: flex;
                flex-wrap: wrap;
                gap: 10px 12px;
                max-width: 420px;
            }

            .shoe-number-size {
                min-width: 48px !important;
                height: 42px !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            @media(max-width: 768px) {
                .shoe-size-row {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
            }
        `;
        document.head.appendChild(style);

        function selectSize(btn) {
            group.querySelectorAll(".shoe-number-size").forEach(x => x.classList.remove("selected"));
            btn.classList.add("selected");

            window.selectedSizeText = btn.dataset.size;
            window.selectedSize = btn.dataset.size;

            try {
                selectedSizeText = btn.dataset.size;
                selectedSize = btn.dataset.size;
            } catch (e) {}
        }

        group.querySelectorAll(".shoe-number-size").forEach(btn => {
            btn.addEventListener("click", function () {
                selectSize(this);
            });
        });

        const first = group.querySelector(".shoe-number-size");
        if (first) selectSize(first);
    }

    document.addEventListener("DOMContentLoaded", function () {
        patchShoeSizes();
    });
})();