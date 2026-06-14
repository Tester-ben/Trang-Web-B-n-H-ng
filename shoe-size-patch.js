/* =========================================================
   THE STYLE HUB - PRODUCT DETAIL SHOE SIZE PATCH
   - Nếu sản phẩm là giày: đổi size S/M/L/XL thành size số
   - Nam: 21-36
   - Nữ: 19-33
   - Add to Bag vẫn lấy đúng selectedSizeText
   ========================================================= */

(function () {
    "use strict";

    function normalize(str) {
        return String(str || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function getProductId() {
        return new URLSearchParams(window.location.search).get("id") || "";
    }

    function isShoeProduct() {
        const id = getProductId();
        const bodyText = normalize(document.body.innerText);
        return (
            id.startsWith("shoe") ||
            bodyText.includes("sneaker") ||
            bodyText.includes("basketball") ||
            bodyText.includes("slipper") ||
            bodyText.includes("boot") ||
            bodyText.includes("shoe")
        );
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
                        ${Array.from({ length: 16 }, (_, i) => 21 + i).map(n => `<button type="button" class="size-button shoe-number-size" data-size="${n}">${n}</button>`).join("")}
                    </div>
                </div>

                <div class="shoe-size-row">
                    <div class="shoe-size-label">SIZE NỮ</div>
                    <div class="shoe-size-options">
                        ${Array.from({ length: 15 }, (_, i) => 19 + i).map(n => `<button type="button" class="size-button shoe-number-size" data-size="${n}">${n}</button>`).join("")}
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            .shoe-size-panel {
                display: flex;
                flex-direction: column;
                gap: 14px;
                width: 100%;
            }

            .shoe-size-row {
                display: grid;
                grid-template-columns: 78px 1fr;
                gap: 10px;
                align-items: start;
            }

            .shoe-size-label {
                font-size: 11px;
                letter-spacing: 1px;
                font-weight: 700;
                padding-top: 12px;
                color: #111;
            }

            .shoe-size-options {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .shoe-number-size {
                min-width: 42px !important;
                padding: 10px 12px !important;
                margin-right: 0 !important;
            }

            @media(max-width: 768px) {
                .shoe-size-row {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);

        group.querySelectorAll(".shoe-number-size").forEach(btn => {
            btn.addEventListener("click", function () {
                group.querySelectorAll(".shoe-number-size").forEach(x => x.classList.remove("selected"));
                this.classList.add("selected");

                window.selectedSizeText = this.dataset.size;

                try {
                    selectedSizeText = this.dataset.size;
                } catch (e) {}
            });
        });

        const firstMale = group.querySelector('.shoe-number-size[data-size="21"]');
        if (firstMale) firstMale.click();
    }

    document.addEventListener("DOMContentLoaded", function () {
        setTimeout(patchShoeSizes, 250);
    });
})();
