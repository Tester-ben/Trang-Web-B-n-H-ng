/* ===== THE STYLE HUB - Vietnam Address Selector (No API key) =====
   Dùng cho:
   - Checkout: cusProvince/cusDistrict/cusWard/cusStreet/cusAddress
   - Account edit: editProvince/editDistrict/editWard/editStreet/editAddress
*/
(function () {
    const DATA_URL = "https://provinces.open-api.vn/api/?depth=3";
    const CACHE_KEY = "stylehub_vn_address_data_v1";
    const CACHE_TIME_KEY = "stylehub_vn_address_data_time_v1";
    const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    let provinces = [];
    const instances = {};

    const configs = [
        {
            key: "checkout",
            provinceId: "cusProvince",
            districtId: "cusDistrict",
            wardId: "cusWard",
            streetId: "cusStreet",
            fullId: "cusAddress"
        },
        {
            key: "edit",
            provinceId: "editProvince",
            districtId: "editDistrict",
            wardId: "editWard",
            streetId: "editStreet",
            fullId: "editAddress"
        }
    ];

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
            .vn-address-group textarea:focus {
                border-color: #111111;
                box-shadow: 0 0 0 1px #111111;
            }

            .vn-address-select:disabled {
                background: #f6f6f6;
                color: #999999;
                cursor: not-allowed;
            }

            .vn-address-group textarea[readonly] {
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

            .account-edit-field.vn-address-account-group {
                display: block;
            }
        `;
        document.head.appendChild(style);
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function getEls(config) {
        return {
            province: byId(config.provinceId),
            district: byId(config.districtId),
            ward: byId(config.wardId),
            street: byId(config.streetId),
            full: byId(config.fullId)
        };
    }

    function hasElements(config) {
        const els = getEls(config);
        return !!(els.province && els.district && els.ward && els.street && els.full);
    }

    function createStatusEl(config, type, message) {
        const { province } = getEls(config);
        if (!province || !province.parentNode) return null;

        const old = province.parentNode.querySelector(".vn-address-error, .vn-address-loading");
        if (old) old.remove();

        const el = document.createElement("div");
        el.className = type === "error" ? "vn-address-error" : "vn-address-loading";
        el.textContent = message;
        province.parentNode.insertBefore(el, province);
        return el;
    }

    function removeStatusEl(config) {
        const { province } = getEls(config);
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

    function getSelectedProvince(config) {
        const { province } = getEls(config);
        const code = Number(province && province.value);
        return provinces.find(item => Number(item.code) === code) || null;
    }

    function getSelectedDistrict(config) {
        const { district } = getEls(config);
        const selectedProvince = getSelectedProvince(config);
        if (!selectedProvince || !Array.isArray(selectedProvince.districts)) return null;

        const code = Number(district && district.value);
        return selectedProvince.districts.find(item => Number(item.code) === code) || null;
    }

    function updateFullAddress(config) {
        const { province, district, ward, street, full } = getEls(config);
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

    function clearSelector(config, keepFullAddress) {
        const { province, district, ward, street, full } = getEls(config);

        if (province) province.value = "";
        resetSelect(district, "Chọn Quận/Huyện", true);
        resetSelect(ward, "Chọn Phường/Xã", true);
        if (street) street.value = "";
        if (full) full.value = keepFullAddress || "";
    }

    function setExistingAddress(key, address) {
        const config = configs.find(item => item.key === key);
        if (!config || !hasElements(config)) return;

        clearSelector(config, address || "");
    }

    function bindEvents(config) {
        const { province, district, ward, street } = getEls(config);

        if (province && !province.dataset.vnAddressBound) {
            province.dataset.vnAddressBound = "1";
            province.addEventListener("change", function () {
                const selectedProvince = getSelectedProvince(config);

                resetSelect(district, "Chọn Quận/Huyện", true);
                resetSelect(ward, "Chọn Phường/Xã", true);

                if (selectedProvince && Array.isArray(selectedProvince.districts)) {
                    fillSelect(district, selectedProvince.districts, "Chọn Quận/Huyện");
                }

                updateFullAddress(config);
            });
        }

        if (district && !district.dataset.vnAddressBound) {
            district.dataset.vnAddressBound = "1";
            district.addEventListener("change", function () {
                const selectedDistrict = getSelectedDistrict(config);

                resetSelect(ward, "Chọn Phường/Xã", true);

                if (selectedDistrict && Array.isArray(selectedDistrict.wards)) {
                    fillSelect(ward, selectedDistrict.wards, "Chọn Phường/Xã");
                }

                updateFullAddress(config);
            });
        }

        if (ward && !ward.dataset.vnAddressBound) {
            ward.dataset.vnAddressBound = "1";
            ward.addEventListener("change", function () {
                updateFullAddress(config);
            });
        }

        if (street && !street.dataset.vnAddressBound) {
            street.dataset.vnAddressBound = "1";
            street.addEventListener("input", function () {
                updateFullAddress(config);
            });
            street.addEventListener("change", function () {
                updateFullAddress(config);
            });
        }
    }

    function setupManualFallback(config) {
        const { province, district, ward, street, full } = getEls(config);

        if (province) province.style.display = "none";
        if (district) district.style.display = "none";
        if (ward) ward.style.display = "none";
        if (street) street.style.display = "none";

        if (full) {
            full.removeAttribute("readonly");
            full.placeholder = "Nhập địa chỉ đầy đủ: số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố";
            full.rows = 4;
        }

        createStatusEl(config, "error", "Chưa tải được dữ liệu địa chỉ Việt Nam. Bạn vẫn có thể nhập địa chỉ đầy đủ thủ công.");
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

    function loadVietnamAddressData(activeConfigs) {
        const cached = getCachedData();
        if (cached && cached.length) {
            return Promise.resolve(cached);
        }

        activeConfigs.forEach(function(config) {
            createStatusEl(config, "loading", "Đang tải dữ liệu Tỉnh/Thành phố Việt Nam...");
        });

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

    function initConfig(config) {
        if (!hasElements(config)) return false;

        instances[config.key] = config;

        const { province, district, ward } = getEls(config);
        resetSelect(province, "Chọn Tỉnh/Thành phố", true);
        resetSelect(district, "Chọn Quận/Huyện", true);
        resetSelect(ward, "Chọn Phường/Xã", true);

        return true;
    }

    function activateConfig(config) {
        const { province } = getEls(config);

        removeStatusEl(config);
        fillSelect(province, provinces, "Chọn Tỉnh/Thành phố");
        bindEvents(config);
    }

    function initVietnamAddressSelectors() {
        injectStyles();

        const activeConfigs = configs.filter(initConfig);
        if (!activeConfigs.length) return;

        loadVietnamAddressData(activeConfigs)
            .then(function (data) {
                provinces = data;
                activeConfigs.forEach(activateConfig);
            })
            .catch(function () {
                activeConfigs.forEach(setupManualFallback);
            });
    }

    window.StyleHubVNAddress = {
        setExistingAddress: setExistingAddress,
        updateFullAddress: function (key) {
            const config = instances[key] || configs.find(item => item.key === key);
            if (config) updateFullAddress(config);
        }
    };

    ready(initVietnamAddressSelectors);
})();
