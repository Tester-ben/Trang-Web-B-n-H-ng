/* ===== THE STYLE HUB - Vietnam Address Selector (No API key) =====
   Không dùng Google Maps, không cần billing, không cần API key.
   Dữ liệu lấy từ provinces.open-api.vn miễn phí. Nếu API lỗi, khách vẫn nhập thủ công được.
*/
(function () {
    const DATA_URL = "https://provinces.open-api.vn/api/?depth=3";
    const CACHE_KEY = "stylehub_vn_address_data_v1";
    const CACHE_TIME_KEY = "stylehub_vn_address_data_time_v1";
    const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    let provinces = [];

    function ready(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn);
        } else {
            fn();
        }
    }

    function injectStyles() {
        if (document.getElementById("stylehub-vn-address-style")) return;

        const style = document.createElement("style");
        style.id = "stylehub-vn-address-style";
        style.textContent = `
            .vn-address-group {
                position: relative;
            }

            .vn-address-select,
            .vn-address-input {
                width: 100%;
                border: 1px solid #dddddd;
                background: #ffffff;
                color: #111111;
                padding: 12px 13px;
                margin-bottom: 10px;
                font-family: inherit;
                font-size: 13px;
                outline: none;
                border-radius: 0;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            .vn-address-select:focus,
            .vn-address-input:focus,
            #cusAddress:focus {
                border-color: #111111;
                box-shadow: 0 0 0 1px #111111;
            }

            .vn-address-select:disabled {
                background: #f6f6f6;
                color: #999999;
                cursor: not-allowed;
            }

            .vn-address-group #cusAddress[readonly] {
                background: #f8f8f8;
                color: #111111;
                cursor: default;
            }

            .address-hint {
                display: block;
                margin-top: 4px;
                font-size: 11px;
                line-height: 1.45;
                color: #777777;
            }

            .vn-address-error {
                margin-top: 4px;
                margin-bottom: 10px;
                padding: 10px 12px;
                background: #fff6f6;
                border: 1px solid #ffd9d9;
                color: #b00020;
                font-size: 12px;
                line-height: 1.45;
            }

            .vn-address-loading {
                margin-top: -4px;
                margin-bottom: 10px;
                color: #777777;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    function getEls() {
        return {
            province: document.getElementById("cusProvince"),
            district: document.getElementById("cusDistrict"),
            ward: document.getElementById("cusWard"),
            street: document.getElementById("cusStreet"),
            full: document.getElementById("cusAddress")
        };
    }

    function createStatusEl(type, message) {
        const { province } = getEls();
        if (!province || !province.parentNode) return null;

        const old = province.parentNode.querySelector(".vn-address-error, .vn-address-loading");
        if (old) old.remove();

        const el = document.createElement("div");
        el.className = type === "error" ? "vn-address-error" : "vn-address-loading";
        el.textContent = message;
        province.parentNode.insertBefore(el, province);
        return el;
    }

    function removeStatusEl() {
        const { province } = getEls();
        if (!province || !province.parentNode) return;

        const old = province.parentNode.querySelector(".vn-address-error, .vn-address-loading");
        if (old) old.remove();
    }

    function normalizeName(value) {
        return String(value || "").trim();
    }

    function resetSelect(select, placeholder, disabled) {
        if (!select) return;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        select.disabled = !!disabled;
    }

    function fillSelect(select, items, placeholder) {
        resetSelect(select, placeholder, false);

        items.forEach(function (item) {
            const option = document.createElement("option");
            option.value = item.code;
            option.textContent = item.name;
            option.dataset.name = item.name;
            select.appendChild(option);
        });
    }

    function getSelectedName(select) {
        if (!select || !select.value) return "";
        const option = select.options[select.selectedIndex];
        return option ? normalizeName(option.dataset.name || option.textContent) : "";
    }

    function getSelectedProvince() {
        const { province } = getEls();
        const code = Number(province && province.value);
        return provinces.find(item => Number(item.code) === code) || null;
    }

    function getSelectedDistrict() {
        const { district } = getEls();
        const selectedProvince = getSelectedProvince();
        if (!selectedProvince || !Array.isArray(selectedProvince.districts)) return null;

        const code = Number(district && district.value);
        return selectedProvince.districts.find(item => Number(item.code) === code) || null;
    }

    function updateFullAddress() {
        const { province, district, ward, street, full } = getEls();
        if (!full) return;

        const parts = [
            normalizeName(street && street.value),
            getSelectedName(ward),
            getSelectedName(district),
            getSelectedName(province)
        ].filter(Boolean);

        full.value = parts.join(", ");
        full.dispatchEvent(new Event("input", { bubbles: true }));
        full.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function bindEvents() {
        const { province, district, ward, street } = getEls();

        if (province) {
            province.addEventListener("change", function () {
                const selectedProvince = getSelectedProvince();

                resetSelect(district, "Chọn Quận/Huyện", true);
                resetSelect(ward, "Chọn Phường/Xã", true);

                if (selectedProvince && Array.isArray(selectedProvince.districts)) {
                    fillSelect(district, selectedProvince.districts, "Chọn Quận/Huyện");
                }

                updateFullAddress();
            });
        }

        if (district) {
            district.addEventListener("change", function () {
                const selectedDistrict = getSelectedDistrict();

                resetSelect(ward, "Chọn Phường/Xã", true);

                if (selectedDistrict && Array.isArray(selectedDistrict.wards)) {
                    fillSelect(ward, selectedDistrict.wards, "Chọn Phường/Xã");
                }

                updateFullAddress();
            });
        }

        if (ward) {
            ward.addEventListener("change", updateFullAddress);
        }

        if (street) {
            street.addEventListener("input", updateFullAddress);
            street.addEventListener("change", updateFullAddress);
        }
    }

    function setupManualFallback() {
        const { province, district, ward, street, full } = getEls();

        if (province) province.style.display = "none";
        if (district) district.style.display = "none";
        if (ward) ward.style.display = "none";
        if (street) street.style.display = "none";

        if (full) {
            full.removeAttribute("readonly");
            full.placeholder = "Nhập địa chỉ đầy đủ: số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố";
            full.rows = 4;
        }

        createStatusEl("error", "Chưa tải được dữ liệu địa chỉ Việt Nam. Bạn vẫn có thể nhập địa chỉ đầy đủ thủ công.");
    }

    function getCachedData() {
        try {
            const cachedAt = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
            const raw = localStorage.getItem(CACHE_KEY);

            if (!raw || !cachedAt || Date.now() - cachedAt > CACHE_MAX_AGE) return null;

            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : null;
        } catch (error) {
            return null;
        }
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
        } catch (error) {
            // Bỏ qua nếu trình duyệt không cho lưu localStorage.
        }
    }

    function loadVietnamAddressData() {
        const cached = getCachedData();
        if (cached && cached.length) {
            return Promise.resolve(cached);
        }

        createStatusEl("loading", "Đang tải dữ liệu Tỉnh/Thành phố Việt Nam...");

        return fetch(DATA_URL)
            .then(function (response) {
                if (!response.ok) throw new Error("Không tải được dữ liệu địa chỉ");
                return response.json();
            })
            .then(function (data) {
                if (!Array.isArray(data) || !data.length) {
                    throw new Error("Dữ liệu địa chỉ không hợp lệ");
                }

                setCachedData(data);
                return data;
            });
    }

    function initVietnamAddressSelector() {
        const { province, district, ward, street, full } = getEls();
        if (!province || !district || !ward || !street || !full) return;

        injectStyles();
        resetSelect(province, "Chọn Tỉnh/Thành phố", true);
        resetSelect(district, "Chọn Quận/Huyện", true);
        resetSelect(ward, "Chọn Phường/Xã", true);

        loadVietnamAddressData()
            .then(function (data) {
                provinces = data;
                removeStatusEl();
                fillSelect(province, provinces, "Chọn Tỉnh/Thành phố");
                bindEvents();
                updateFullAddress();
            })
            .catch(function () {
                setupManualFallback();
            });
    }

    ready(initVietnamAddressSelector);
})();
