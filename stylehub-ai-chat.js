/* =========================================================
   THE STYLE HUB - STYLIST AI PRO
   Features:
   - Lưu lịch sử chat khi đổi trang / F5
   - Logo TSH kéo thả khắp màn hình
   - Double click để thu nhỏ / mở lại
   - Nút X đóng
   - Nút xóa lịch sử chat
   - Typing animation
   - Gợi ý sản phẩm từ product-data.js
   - Click sản phẩm mở product-detail.html?id=...
   - Bấm icon giỏ hàng thêm vào BAG
   - Tư vấn size áo/quần theo bảng Nam/Nữ
   - Tư vấn size giày số: Nam 21-36, Nữ 19-33
   ========================================================= */

   (function () {
    "use strict";

    const STORAGE_MESSAGES = "tsh_ai_pro_messages";
    const STORAGE_CONTEXT = "tsh_ai_pro_context";
    const STORAGE_POS = "tsh_ai_pro_position";
    const SUPPORT_CONVERSATION_KEY = "tsh_support_conversation_id";
    const SUPPORT_SEEN_KEY = "tsh_support_seen_admin_messages";
    const SUPPORT_LOCAL_KEY = "tsh_support_conversations_v1";
    const SUPPORT_DB_ROOT = "stylehub_orders/support_conversations";
    const STYLE_ID = "tsh-ai-pro-style";
    const WIDGET_ID = "tsh-ai-pro-widget";
    const STYLEHUB_FIREBASE_CONFIG = {}; // STATIC DEMO MODE: Firebase disabled.
    let supportDbPromise = null;
    let supportReplyListenerStarted = false;
    let selectedImageAttachment = null;

    const CLOTHING_SIZE = {
        male: [
            { size: "XS", minW: 42, maxW: 47, height: "1m54 - 1m59" },
            { size: "S", minW: 48, maxW: 53, height: "1m60 - 1m64" },
            { size: "M", minW: 53, maxW: 60, height: "1m65 - 1m69" },
            { size: "L", minW: 61, maxW: 68, height: "1m70 - 1m75" },
            { size: "XL", minW: 69, maxW: 75, height: "trên 1m75" },
            { size: "XXL", minW: 76, maxW: 200, height: "trên 1m75" }
        ],
        female: [
            { size: "XS", minW: 32, maxW: 36, height: "1m42 - 1m47" },
            { size: "S", minW: 37, maxW: 42, height: "1m48 - 1m53" },
            { size: "M", minW: 43, maxW: 48, height: "1m54 - 1m59" },
            { size: "L", minW: 49, maxW: 54, height: "1m60 - 1m65" },
            { size: "XL", minW: 55, maxW: 60, height: "trên 1m65" },
            { size: "XXL", minW: 61, maxW: 200, height: "trên 1m65" }
        ]
    };

    const SHOE_NUMBER_SIZE = {
        male: { min: 21, max: 36 },
        female: { min: 19, max: 33 }
    };

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .tsh-ai-toggle {
                position: fixed;
                right: 24px;
                bottom: 24px;
                width: 64px;
                height: 64px;
                border-radius: 50%;
                border: none;
                background: #0b3030;
                color: #fff;
                z-index: 99990;
                cursor: grab;
                box-shadow: 0 12px 30px rgba(0,0,0,.25);
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
                touch-action: none;
            }

            .tsh-ai-toggle:active {
                cursor: grabbing;
            }

            .tsh-ai-logo {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                background: #050505;
                color: #fff;
                border: 1px solid rgba(255,255,255,.35);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                letter-spacing: 1.5px;
                position: relative;
                overflow: hidden;
            }

            .tsh-ai-logo::before {
                content: "";
                position: absolute;
                width: 28px;
                height: 34px;
                border: 2px solid rgba(255,255,255,.75);
                border-radius: 12px 12px 16px 16px;
                opacity: .45;
            }

            .tsh-ai-logo span {
                position: relative;
                z-index: 1;
                font-size: 12px;
            }

            .tsh-ai-box {
                position: fixed;
                right: 24px;
                bottom: 100px;
                width: 410px;
                height: 640px;
                max-width: calc(100vw - 32px);
                max-height: calc(100vh - 115px);
                background: #fff;
                border-radius: 22px;
                overflow: hidden;
                box-shadow: 0 20px 58px rgba(0,0,0,.25);
                z-index: 99991;
                display: none;
                flex-direction: column;
                font-family: Roboto, Arial, sans-serif;
            }

            .tsh-ai-box.open {
                display: flex;
            }

            .tsh-ai-header {
                height: 72px;
                background: #0b3030;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 0 16px;
            }

            .tsh-ai-title {
                flex: 1;
                font-size: 16px;
                font-weight: 700;
            }

            .tsh-ai-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .tsh-ai-icon-btn {
                border: none;
                background: transparent;
                color: #fff;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .tsh-ai-icon-btn:hover {
                background: rgba(255,255,255,.12);
            }

            .tsh-ai-body {
                flex: 1;
                overflow-y: auto;
                padding: 18px 16px 12px;
                background: #fff;
                scroll-behavior: smooth;
            }

            .tsh-ai-meta {
                color: #8a8f95;
                font-size: 12px;
                margin: 10px 0 5px;
            }

            .tsh-ai-msg {
                max-width: 88%;
                padding: 12px 15px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.45;
                margin-bottom: 10px;
                word-break: break-word;
            }

            .tsh-ai-msg.bot {
                background: #f3f3f3;
                color: #151515;
                border-top-left-radius: 6px;
            }

            .tsh-ai-msg.user {
                background: #050505;
                color: #fff;
                margin-left: auto;
                border-top-right-radius: 6px;
            }

            .tsh-ai-typing {
                width: 68px;
                padding: 13px 16px;
                border-radius: 18px;
                background: #f3f3f3;
                display: flex;
                gap: 5px;
                margin: 5px 0 12px;
            }

            .tsh-ai-typing span {
                width: 7px;
                height: 7px;
                background: #aaa;
                border-radius: 50%;
                animation: tshAiBlink 1s infinite ease-in-out;
            }

            .tsh-ai-typing span:nth-child(2) { animation-delay: .15s; }
            .tsh-ai-typing span:nth-child(3) { animation-delay: .3s; }

            @keyframes tshAiBlink {
                0%, 80%, 100% { opacity: .3; }
                40% { opacity: 1; }
            }

            .tsh-ai-product-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin: 10px 0;
            }

            .tsh-ai-product-card {
                display: grid;
                grid-template-columns: 78px 1fr 34px;
                gap: 10px;
                align-items: center;
                background: #fff;
                border-radius: 14px;
                padding: 8px;
                box-shadow: 0 2px 12px rgba(0,0,0,.08);
                border: 1px solid #eee;
            }

            .tsh-ai-product-card img {
                width: 78px;
                height: 78px;
                object-fit: cover;
                border-radius: 10px;
                background: #f5f5f5;
            }

            .tsh-ai-product-name {
                display: block;
                font-size: 13px;
                line-height: 1.35;
                color: #0066ff;
                text-decoration: none;
                margin-bottom: 6px;
                max-height: 36px;
                overflow: hidden;
            }

            .tsh-ai-product-price {
                font-size: 14px;
                font-weight: 800;
                color: #111;
            }

            .tsh-ai-product-old {
                font-size: 12px;
                color: #888;
                text-decoration: line-through;
                margin-left: 6px;
            }

            .tsh-ai-product-cart {
                border: none;
                background: #000;
                color: #fff;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 15px;
            }

            .tsh-ai-suggestions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 0 16px 12px;
                background: #fff;
            }

            .tsh-ai-suggestions button {
                border: 1px solid #ddd;
                background: #fff;
                color: #111;
                border-radius: 18px;
                padding: 7px 10px;
                font-size: 12px;
                cursor: pointer;
            }

            .tsh-ai-suggestions button:hover {
                background: #111;
                color: #fff;
                border-color: #111;
            }

            .tsh-ai-support-note {
                display: block;
                margin-top: 8px;
                padding: 10px 12px;
                border-radius: 12px;
                background: #fffaf1;
                border: 1px solid #ead8b8;
                color: #6f4a1f;
                font-size: 13px;
                line-height: 1.45;
            }

            .tsh-ai-msg.bot strong.tsh-shop-name {
                display: block;
                margin-bottom: 4px;
                color: #0b3030;
                letter-spacing: .6px;
            }

            .tsh-ai-chat-image {
                display: block;
                width: 100%;
                max-width: 240px;
                max-height: 260px;
                object-fit: cover;
                border-radius: 14px;
                margin-top: 8px;
                border: 1px solid rgba(0,0,0,.08);
                background: #f7f7f7;
            }

            .tsh-ai-msg.user .tsh-ai-chat-image {
                border-color: rgba(255,255,255,.22);
                background: #111;
            }

            .tsh-ai-selected-image {
                display: none;
                align-items: center;
                gap: 10px;
                margin: 0 14px 10px;
                padding: 10px;
                border-radius: 16px;
                border: 1px solid #ead8b8;
                background: #fffaf1;
            }

            .tsh-ai-selected-image.active {
                display: flex;
            }

            .tsh-ai-selected-image img {
                width: 52px;
                height: 52px;
                object-fit: cover;
                border-radius: 12px;
                background: #eee;
                border: 1px solid rgba(0,0,0,.08);
            }

            .tsh-ai-selected-info {
                flex: 1;
                min-width: 0;
                color: #6f4a1f;
                font-size: 12px;
                line-height: 1.35;
            }

            .tsh-ai-selected-info strong {
                display: block;
                color: #111;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .tsh-ai-remove-image {
                border: none;
                background: rgba(0,0,0,.08);
                color: #111;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }

            .tsh-ai-file-input {
                display: none;
            }

            .tsh-ai-inputbar {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 14px 16px;
                background: #fff;
                border-top: 1px solid #f0f0f0;
            }

            .tsh-ai-attach {
                width: 44px;
                height: 44px;
                flex: 0 0 44px;
                border-radius: 50%;
                border: 1px solid #ddd;
                background: #fff;
                color: #111;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .tsh-ai-attach:hover {
                background: #111;
                color: #fff;
                border-color: #111;
            }

            .tsh-ai-input {
                flex: 1;
                height: 44px;
                border: 1px solid #ddd;
                border-radius: 22px;
                padding: 0 15px;
                font-size: 14px;
                outline: none;
            }

            .tsh-ai-send {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                background: #000;
                color: #fff;
                font-size: 18px;
                cursor: pointer;
            }

            @media(max-width:520px) {
                .tsh-ai-box {
                    right: 10px;
                    left: 10px;
                    width: auto;
                    bottom: 88px;
                    height: 560px;
                }
                .tsh-ai-toggle {
                    right: 18px;
                    bottom: 18px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getDB() {
        try {
            if (typeof database === "object") return database;
            if (typeof window.database === "object") return window.database;
        } catch (e) {}
        return {};
    }

    function escapeHTML(str) {
        return String(str || "").replace(/[&<>"']/g, function (m) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
        });
    }

    function isSafeImageDataUrl(value) {
        return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(String(value || ""));
    }

    function imageAttachmentHtml(attachment) {
        if (!attachment || !isSafeImageDataUrl(attachment.dataUrl)) return "";
        const alt = escapeHTML(attachment.name || "Ảnh khách gửi");
        return `<img class="tsh-ai-chat-image" src="${attachment.dataUrl}" alt="${alt}" loading="lazy">`;
    }

    function buildChatHtml(text, attachment) {
        const safeText = text ? escapeHTML(text) : "";
        const img = imageAttachmentHtml(attachment);
        if (safeText && img) return safeText + img;
        return safeText || img || "";
    }

    function formatFileSize(bytes) {
        const n = Number(bytes || 0);
        if (!n) return "";
        if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
        return (n / (1024 * 1024)).toFixed(1).replace(".0", "") + " MB";
    }

    function compressImageFile(file) {
        return new Promise(function(resolve, reject) {
            if (!file || !String(file.type || "").startsWith("image/")) {
                reject(new Error("Vui lòng chọn đúng file ảnh."));
                return;
            }

            if (file.size > 6 * 1024 * 1024) {
                reject(new Error("Ảnh hơi nặng. Bạn chọn ảnh dưới 6MB giúp shop nhé."));
                return;
            }

            const reader = new FileReader();
            reader.onerror = function() { reject(new Error("Không đọc được ảnh. Bạn thử chọn ảnh khác nhé.")); };
            reader.onload = function() {
                const image = new Image();
                image.onerror = function() { reject(new Error("Ảnh không hợp lệ. Bạn thử chọn ảnh khác nhé.")); };
                image.onload = function() {
                    const maxSide = 1100;
                    let width = image.naturalWidth || image.width;
                    let height = image.naturalHeight || image.height;
                    const scale = Math.min(1, maxSide / Math.max(width, height));
                    width = Math.max(1, Math.round(width * scale));
                    height = Math.max(1, Math.round(height * scale));

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(image, 0, 0, width, height);

                    let quality = 0.82;
                    let dataUrl = canvas.toDataURL("image/jpeg", quality);
                    while (dataUrl.length > 1200000 && quality > 0.55) {
                        quality -= 0.08;
                        dataUrl = canvas.toDataURL("image/jpeg", quality);
                    }

                    resolve({
                        dataUrl: dataUrl,
                        name: file.name || "image.jpg",
                        type: "image/jpeg",
                        originalType: file.type || "",
                        size: Math.round(dataUrl.length * 0.75),
                        width: width,
                        height: height
                    });
                };
                image.src = String(reader.result || "");
            };
            reader.readAsDataURL(file);
        });
    }

    function setSelectedImageAttachment(attachment) {
        selectedImageAttachment = attachment || null;
        const preview = document.getElementById("tshAiSelectedImage");
        if (!preview) return;
        if (!selectedImageAttachment) {
            preview.classList.remove("active");
            preview.innerHTML = "";
            return;
        }
        preview.classList.add("active");
        preview.innerHTML = `
            <img src="${selectedImageAttachment.dataUrl}" alt="${escapeHTML(selectedImageAttachment.name || "Ảnh đã chọn")}">
            <div class="tsh-ai-selected-info"><strong>${escapeHTML(selectedImageAttachment.name || "Ảnh đã chọn")}</strong><span>Ảnh sẽ được gửi cho shop · ${escapeHTML(formatFileSize(selectedImageAttachment.size))}</span></div>
            <button class="tsh-ai-remove-image" type="button" id="tshAiRemoveImage" title="Bỏ ảnh">×</button>
        `;
        const remove = document.getElementById("tshAiRemoveImage");
        if (remove) remove.addEventListener("click", function() { setSelectedImageAttachment(null); });
    }

    function normalize(str) {
        return String(str || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function formatTime() {
        return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }

    function loadMessages() {
        try { return JSON.parse(localStorage.getItem(STORAGE_MESSAGES)) || []; }
        catch (e) { return []; }
    }

    function saveMessages(messages) {
        localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages.slice(-100)));
    }

    function loadContext() {
        try { return JSON.parse(localStorage.getItem(STORAGE_CONTEXT)) || {}; }
        catch (e) { return {}; }
    }

    function saveContext(context) {
        localStorage.setItem(STORAGE_CONTEXT, JSON.stringify(context || {}));
    }

    function getImage(item) {
        return item.mainImg || (Array.isArray(item.images) && item.images[0]) || "";
    }

    function getOldPrice(item) {
        return item.oldPrice || item.originalPrice || item.comparePrice || "";
    }

    function wantsProducts(text) {
        const t = normalize(text);

        // Nếu khách đang hỏi size thì ưu tiên tư vấn size, không nhảy qua gợi ý sản phẩm.
        if (
            t.includes("tu van size") ||
            t.includes("tu van size") ||
            t === "size" ||
            t.includes("chon size") ||
            t.includes("mac size") ||
            t.includes("nen mac") ||
            t.includes("cao") ||
            t.includes("nang") ||
            /\d+\s*(kg|m|cm)/.test(t)
        ) {
            return false;
        }

        return (
            t.includes("cho toi coi") ||
            t.includes("cho toi xem") ||
            t.includes("coi") ||
            t.includes("xem") ||
            t.includes("vai mau") ||
            t.includes("mau") ||
            t.includes("hot") ||
            t.includes("goi y") ||
            t.includes("tim") ||
            t.includes("san pham") ||
            t.includes("ao") ||
            t.includes("quan") ||
            t.includes("giay") ||
            t.includes("shoe") ||
            t.includes("dress") ||
            t.includes("hoodie") ||
            t.includes("jean") ||
            t.includes("sale")
        );
    }

    function inferGender(text) {
        const t = normalize(text);
        if (t.includes("nu") || t.includes("women") || t.includes("womens") || t.includes("girl") || t.includes("chi")) return "female";
        if (t.includes("nam") || t.includes("men") || t.includes("mens") || t.includes("anh") || t.includes("trai")) return "male";
        return "";
    }

    function inferCategory(text) {
        const t = normalize(text);
        if (t.includes("nu") || t.includes("women") || t.includes("womens") || t.includes("vay") || t.includes("dam")) return "women";
        if (t.includes("kid") || t.includes("tre") || t.includes("be")) return "kids";
        if (t.includes("sale") || t.includes("giam") || t.includes("re")) return "sale";
        if (t.includes("giay") || t.includes("dep") || t.includes("shoe") || t.includes("sneaker")) return "shoes";
        if (t.includes("nam") || t.includes("men")) return "men";
        return "";
    }

    function inferIntent(text) {
        const t = normalize(text);
        if (t.includes("dress shirt") || t.includes("so mi")) return "dress-shirt";
        if (t.includes("jean") || t.includes("denim")) return "jeans";
        if (t.includes("quan") || t.includes("pant") || t.includes("short")) return "pants";
        if (t.includes("hoodie") || t.includes("ao khoac")) return "hoodie";
        if (t.includes("giay") || t.includes("dep") || t.includes("shoe") || t.includes("sneaker")) return "shoes";
        if (t.includes("vay") || t.includes("dam") || t.includes("dress")) return "dress";
        if (t.includes("ao") || t.includes("top") || t.includes("tee") || t.includes("shirt")) return "tops";
        if (t.includes("size") || t.includes("cao") || t.includes("nang") || /\d+\s*(kg|m|cm)/.test(t)) return "size";
        return "general";
    }

    function parseWeight(text) {
        const t = normalize(text);
        let m = t.match(/(\d{2,3})\s*(kg|ki)/);
        if (m) return Number(m[1]);
        const nums = t.match(/\b\d{2,3}\b/g);
        if (nums) {
            const possible = nums.map(Number).filter(n => n >= 32 && n <= 120);
            if (possible.length) return possible[possible.length - 1];
        }
        return null;
    }

    function parseHeight(text) {
        const t = normalize(text);

        // 1m70, 1m7, 1m 70
        let m = t.match(/1m\s*(\d{1,2})/);
        if (m) {
            const tail = Number(m[1]);
            return tail < 10 ? 100 + tail * 10 : 100 + tail;
        }

        // 170cm
        m = t.match(/(\d{3})\s*cm/);
        if (m) return Number(m[1]);

        // 1.70m hoặc 1.70
        m = t.match(/(\d)\.(\d{2})\s*m?/);
        if (m) return Number(m[1]) * 100 + Number(m[2]);

        // nhập riêng 170
        const nums = t.match(/\b\d{3}\b/g);
        if (nums) {
            const possible = nums.map(Number).filter(n => n >= 140 && n <= 205);
            if (possible.length) return possible[0];
        }

        return null;
    }

    function parseShoeSize(text) {
        const t = normalize(text);
        let m = t.match(/size\s*(\d{2})/);
        if (m) return Number(m[1]);
        m = t.match(/giay\s*(\d{2})/);
        if (m) return Number(m[1]);
        m = t.match(/\b(\d{2})\b/);
        if (m) {
            const n = Number(m[1]);
            if (n >= 19 && n <= 36) return n;
        }
        return null;
    }

    function inferFit(text) {
        const t = normalize(text);
        if (t.includes("rong") || t.includes("thoai mai")) return "loose";
        if (t.includes("vua") || t.includes("om") || t.includes("fit")) return "regular";
        return "";
    }

    function clothingSize(weight, gender, fit) {
        const list = CLOTHING_SIZE[gender] || CLOTHING_SIZE.male;
        let row = list.find(r => weight >= r.minW && weight <= r.maxW) || list[list.length - 1];

        if (fit === "loose") {
            const idx = list.findIndex(r => r.size === row.size);
            if (idx >= 0 && idx < list.length - 1) row = list[idx + 1];
        }

        return row;
    }

    function smartClothingSize(weight, height, gender, fit) {
        // Không bắt khách phải chọn nam/nữ. Nếu chưa rõ giới tính, dùng bảng unisex/nam làm mặc định,
        // vì form size S/M/L/XL của shop dùng chung khá giống unisex.
        const mainGender = gender || "male";
        const row = clothingSize(weight, mainGender, fit);

        let note = "";
        if (!gender) {
            note = " Mình đang tính theo form unisex/nam. Nếu bạn chọn đồ nữ ôm body thì có thể giảm 1 size.";
        }

        if (height) {
            if (height >= 175 && ["S", "M"].includes(row.size)) {
                note += " Vì bạn khá cao, nếu thích che form hoặc áo dài hơn thì nên ưu tiên tăng thêm 1 size.";
            }
            if (height <= 158 && ["XL", "XXL"].includes(row.size) && fit !== "loose") {
                note += " Nếu bạn không muốn áo quá dài, có thể cân nhắc giảm 1 size.";
            }
        }

        return { row, note };
    }

    function shoeNumberSize(size, gender, fit) {
        const range = SHOE_NUMBER_SIZE[gender] || SHOE_NUMBER_SIZE.male;
        let result = Number(size);

        if (fit === "loose") result += 1;
        result = Math.max(range.min, Math.min(range.max, result));

        return result;
    }

    function productScore(item, id, category, intent, query) {
        const text = normalize(`${id} ${item.key || ""} ${item.brand || ""} ${item.name || ""} ${item.category || ""} ${item.type || ""}`);
        let score = 0;

        if (category === "men" && (id.includes("men") || text.includes("men") || text.includes("mens"))) score += 5;
        if (category === "women" && (id.includes("women") || text.includes("women") || text.includes("womens"))) score += 5;
        if (category === "kids" && (id.includes("kid") || text.includes("kid"))) score += 5;
        if (category === "sale" && (id.includes("sale") || text.includes("sale"))) score += 7;
        if (category === "shoes" && (id.includes("shoe") || text.includes("shoe") || text.includes("sneaker") || text.includes("slipper") || text.includes("boot") || text.includes("basketball"))) score += 8;

        if (intent === "dress-shirt" && (text.includes("dress") || text.includes("shirt") || text.includes("somi") || text.includes("so mi"))) score += 10;
        if (intent === "jeans" && (text.includes("jean") || text.includes("denim"))) score += 9;
        if (intent === "pants" && (text.includes("pant") || text.includes("sweatpant") || text.includes("short") || text.includes("jean"))) score += 7;
        if (intent === "hoodie" && text.includes("hoodie")) score += 9;
        if (intent === "tops" && (text.includes("tee") || text.includes("shirt") || text.includes("top") || text.includes("tank"))) score += 7;
        if (intent === "shoes" && (text.includes("shoe") || text.includes("sneaker") || text.includes("slipper") || text.includes("boot") || text.includes("basketball"))) score += 9;
        if (intent === "dress" && (text.includes("dress") || text.includes("skirt"))) score += 9;

        normalize(query).split(/\s+/).forEach(word => {
            if (word.length > 2 && text.includes(word)) score += 1;
        });

        return score;
    }

    function getProducts(query) {
        const data = getDB();
        const category = inferCategory(query);
        const intent = inferIntent(query);

        const arr = Object.keys(data)
            .map(id => ({ id, item: data[id], score: productScore(data[id] || {}, id, category, intent, query) }))
            .filter(x => x.item && (x.item.name || x.item.mainImg));

        const ranked = arr.filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);

        return ranked.length ? ranked : arr.slice(0, 4);
    }

    function productCards(list) {
        return `<div class="tsh-ai-product-list">` + list.map(({ id, item }) => {
            const oldPrice = getOldPrice(item);
            return `
                <div class="tsh-ai-product-card">
                    <img src="${getImage(item)}" alt="${escapeHTML(item.name)}">
                    <div>
                        <a class="tsh-ai-product-name" href="product-detail.html?id=${encodeURIComponent(id)}">${escapeHTML(item.name)}</a>
                        <span class="tsh-ai-product-price">${escapeHTML(item.price)}</span>
                        ${oldPrice ? `<span class="tsh-ai-product-old">${escapeHTML(oldPrice)}</span>` : ""}
                    </div>
                    <button class="tsh-ai-product-cart" data-product-id="${escapeHTML(id)}">🛒</button>
                </div>
            `;
        }).join("") + `</div>`;
    }

    function introByIntent(intent, category) {
        if (intent === "dress-shirt") return "Dưới đây là vài mẫu dress shirt / áo sơ mi trong shop:";
        if (intent === "jeans") return "Dưới đây là vài mẫu quần jean / denim phù hợp:";
        if (intent === "pants") return "Dưới đây là vài mẫu quần trong shop:";
        if (intent === "tops") return "Dưới đây là vài mẫu áo nổi bật trong shop:";
        if (intent === "hoodie") return "Dưới đây là vài mẫu hoodie / áo khoác phù hợp:";
        if (intent === "shoes") return "Dưới đây là vài mẫu giày/dép nổi bật trong shop:";
        if (intent === "dress") return "Dưới đây là vài mẫu váy/đầm phù hợp:";
        if (category === "sale") return "Dưới đây là vài sản phẩm sale nổi bật:";
        return "Mình gợi ý cho bạn vài sản phẩm phù hợp trong THE STYLE HUB:";
    }


    function loadExternalScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function hasFirebaseConfig() {
        return STYLEHUB_FIREBASE_CONFIG && STYLEHUB_FIREBASE_CONFIG.apiKey && STYLEHUB_FIREBASE_CONFIG.databaseURL;
    }

    function getSupportDb() {
        // STATIC DEMO MODE: support chat does not connect to Firebase/admin.
        return Promise.resolve(null);
    }

    function getSupportConversationId() {
        let id = localStorage.getItem(SUPPORT_CONVERSATION_KEY);
        if (!id) {
            id = "support_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            localStorage.setItem(SUPPORT_CONVERSATION_KEY, id);
        }
        return id;
    }

    function readSupportLocal() {
        try { return JSON.parse(localStorage.getItem(SUPPORT_LOCAL_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function writeSupportLocal(map) {
        localStorage.setItem(SUPPORT_LOCAL_KEY, JSON.stringify(map || {}));
        try { window.dispatchEvent(new StorageEvent("storage", { key: SUPPORT_LOCAL_KEY, newValue: JSON.stringify(map || {}) })); } catch (e) {}
    }

    function getSupportCustomerInfo() {
        const name = localStorage.getItem("hub_name") || localStorage.getItem("customer_name") || localStorage.getItem("checkout_name") || "Khách vãng lai";
        const email = localStorage.getItem("hub_email") || localStorage.getItem("customer_email") || localStorage.getItem("checkout_email") || "";
        const phone = localStorage.getItem("hub_phone") || localStorage.getItem("customer_phone") || localStorage.getItem("checkout_phone") || "";
        return { name: String(name || "Khách vãng lai"), email: String(email || ""), phone: String(phone || "") };
    }

    function supportMessageType(text, attachment) {
        const t = normalize(text);
        if (attachment && attachment.dataUrl) return "Hình ảnh hỗ trợ";
        if (t.includes("khieu nai") || t.includes("phan nan") || t.includes("khong hai long") || t.includes("complain")) return "Khiếu nại";
        if (t.includes("so luong lon") || t.includes("dat nhieu") || t.includes("mua nhieu") || t.includes("mua si") || t.includes("gia si") || t.includes("bulk")) return "Đặt số lượng lớn";
        if (t.includes("y kien") || t.includes("gop y") || t.includes("feedback") || t.includes("danh gia")) return "Góp ý sản phẩm";
        if (t.includes("bao hanh") || t.includes("doi tra") || t.includes("doi hang") || t.includes("hoan tien") || t.includes("tra hang")) return "Đổi trả / bảo hành";
        if (t.includes("nhan vien") || t.includes("nguoi that") || t.includes("admin") || t.includes("shop rep") || t.includes("gap shop")) return "Cần nhân viên hỗ trợ";
        return "Yêu cầu hỗ trợ";
    }

    function shouldForwardToSupport(text) {
        const t = normalize(text);
        const keywords = [
            "khieu nai", "phan nan", "khong hai long", "complain", "loi don", "loi san pham", "hang loi", "hang hong",
            "bao hanh", "doi tra", "doi hang", "tra hang", "hoan tien", "huy don", "doi dia chi",
            "so luong lon", "dat nhieu", "mua nhieu", "mua si", "gia si", "bulk", "doanh nghiep",
            "y kien", "gop y", "feedback", "danh gia san pham", "nhan vien", "nguoi that", "admin", "gap shop", "lien he shop", "tu van vien"
        ];
        if (keywords.some(function (word) { return t.includes(word); })) return true;
        return false;
    }

    async function saveCustomerSupportMessage(text, attachment) {
        // STATIC DEMO MODE: acknowledge only, do not save to admin/local database.
        return {
            conversationId: "STATIC_DEMO",
            messageId: "STATIC_MSG",
            type: supportMessageType(String(text || ""), attachment),
            staticDemo: true
        };
    }

    function supportAckHtml(result) {
        const shortId = String(result.conversationId || "").replace("support_", "").slice(0, 8).toUpperCase();
        return `<strong class="tsh-shop-name">THE STYLE HUB đã nhận được tin nhắn của bạn.</strong>` +
            `Đây là bản demo web tĩnh nên tin nhắn không được gửi sang Admin thật.` +
            `<span class="tsh-ai-support-note">Mã hỗ trợ: ${escapeHTML(shortId || "SUPPORT")} · Nhóm yêu cầu: ${escapeHTML(result.type || "Hỗ trợ")}</span>`;
    }

    function loadSeenSupportMessages() {
        try { return JSON.parse(localStorage.getItem(SUPPORT_SEEN_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function markSupportMessageSeen(id) {
        const seen = loadSeenSupportMessages();
        seen[id] = true;
        localStorage.setItem(SUPPORT_SEEN_KEY, JSON.stringify(seen));
    }

    function appendShop(content, save = true) {
        const body = document.getElementById("tshAiBody");
        const meta = document.createElement("div");
        meta.className = "tsh-ai-meta";
        meta.textContent = `THE STYLE HUB ${formatTime()}`;

        const msg = document.createElement("div");
        msg.className = "tsh-ai-msg bot";
        msg.innerHTML = content;

        if (body) {
            body.append(meta, msg);
            body.scrollTop = body.scrollHeight;
        }

        if (save) storeMessage("bot", content, "THE STYLE HUB");
    }

    function startSupportReplyListener() {
        // STATIC DEMO MODE: no realtime admin replies.
        supportReplyListenerStarted = true;
    }

    function buildReply(text) {
        const context = loadContext();
        const t = normalize(text);
        const intent = inferIntent(text);
        const category = inferCategory(text);

        const newGender = inferGender(text);
        const newFit = inferFit(text);
        const newWeight = parseWeight(text);
        const newHeight = parseHeight(text);
        const newShoeSize = parseShoeSize(text);

        if (newGender) context.gender = newGender;
        if (newFit) context.fit = newFit;
        if (newWeight) context.weight = newWeight;
        if (newHeight) context.height = newHeight;
        if (newShoeSize) context.shoeSize = newShoeSize;

        if (intent === "shoes" || category === "shoes") context.lastIntent = "shoes";
        if (["tops", "pants", "hoodie", "jeans", "dress", "dress-shirt"].includes(intent)) context.lastIntent = "clothing";

        saveContext(context);

        if (t.includes("hi") || t.includes("hello") || t.includes("chao")) {
            return "Chào bạn! Mình là Stylist AI của THE STYLE HUB. Bạn muốn xem áo, quần, giày, dress shirt hay cần tư vấn size?";
        }

        // Ưu tiên tư vấn size trước để khi khách gõ "size" không bị chuyển qua gợi ý sản phẩm.
        if (context.lastIntent === "shoes" && (intent === "size" || newShoeSize || newFit || newGender)) {
            if (!context.gender) return "Bạn muốn chọn size giày nam hay nữ?";
            if (!context.shoeSize) return "Bạn đang mang size giày số mấy? Ví dụ: 42.";
            if (!context.fit) return "Bạn muốn mang vừa chân hay rộng/thoải mái hơn?";

            const finalSize = shoeNumberSize(context.shoeSize, context.gender, context.fit);
            const genderText = context.gender === "female" ? "nữ" : "nam";
            const fitText = context.fit === "loose" ? "mang rộng/thoải mái" : "mang vừa";

            return `Theo bảng size giày ${genderText}, nếu bạn đang mang size ${context.shoeSize} và muốn ${fitText}, bạn nên chọn size ${finalSize}. Nếu chân bè hoặc thích đi tất dày, nên ưu tiên tăng thêm 1 size.`;
        }

        if (intent === "size" || newWeight || newHeight || newFit) {
            context.lastIntent = "clothing";
            saveContext(context);

            if (!context.height || !context.weight) {
                return "Bạn cho mình chiều cao và cân nặng hiện tại nhé. Ví dụ: 1m70 65kg.";
            }

            if (!context.fit) {
                return "Bạn thích mặc vừa vặn hay rộng rãi/thoải mái hơn?";
            }

            const result = smartClothingSize(context.weight, context.height, context.gender, context.fit);
            const row = result.row;
            const genderText = context.gender === "female" ? "nữ" : (context.gender === "male" ? "nam" : "unisex");
            const fitText = context.fit === "loose" ? "rộng rãi/thoải mái" : "vừa vặn";

            return `Với chiều cao khoảng ${context.height}cm và cân nặng khoảng ${context.weight}kg, nếu bạn thích mặc ${fitText} thì mình gợi ý chọn size ${row.size}. Size này hợp khoảng chiều cao ${row.height}.${result.note}`;
        }

        if (wantsProducts(text) || ["tops", "pants", "hoodie", "jeans", "dress", "dress-shirt", "shoes"].includes(intent) || category) {
            return introByIntent(intent, category) + productCards(getProducts(text));
        }

        return "Bạn muốn mình hỗ trợ gì? Mình có thể tư vấn size, gợi ý áo nam/nữ, hoodie, dress shirt, giày hoặc sản phẩm sale.";
    }

    function renderHistory() {
        const body = document.getElementById("tshAiBody");
        const messages = loadMessages();
        body.innerHTML = "";

        if (!messages.length) {
            appendBot("Xin chào! Mình là Stylist AI của THE STYLE HUB. Bạn muốn xem áo, quần, giày, dress shirt hay cần tư vấn size?", false);
        } else {
            messages.forEach(m => {
                const meta = document.createElement("div");
                meta.className = "tsh-ai-meta";
                meta.textContent = m.meta;

                const msg = document.createElement("div");
                msg.className = `tsh-ai-msg ${m.who}`;
                msg.innerHTML = m.html;

                body.append(meta, msg);
            });
        }

        body.scrollTop = body.scrollHeight;
    }

    function storeMessage(who, htmlContent, label) {
        const messages = loadMessages();
        messages.push({
            who,
            html: htmlContent,
            meta: `${label} ${formatTime()}`
        });
        saveMessages(messages);
    }

    function appendUser(text, save = true, attachment) {
        const body = document.getElementById("tshAiBody");

        const meta = document.createElement("div");
        meta.className = "tsh-ai-meta";
        meta.textContent = `Me ${formatTime()}`;

        const msg = document.createElement("div");
        msg.className = "tsh-ai-msg user";
        const html = buildChatHtml(text, attachment);
        msg.innerHTML = html || "Đã gửi hình ảnh";

        body.append(meta, msg);
        body.scrollTop = body.scrollHeight;

        if (save) storeMessage("user", html || escapeHTML(text), "Me");
    }

    function appendBot(content, save = true) {
        const body = document.getElementById("tshAiBody");

        const meta = document.createElement("div");
        meta.className = "tsh-ai-meta";
        meta.textContent = `Stylist AI Tư Vấn ${formatTime()}`;

        const msg = document.createElement("div");
        msg.className = "tsh-ai-msg bot";
        msg.innerHTML = content;

        body.append(meta, msg);
        body.scrollTop = body.scrollHeight;

        if (save) storeMessage("bot", content, "Stylist AI Tư Vấn");
    }

    function showTyping(callback) {
        const body = document.getElementById("tshAiBody");
        const typing = document.createElement("div");
        typing.className = "tsh-ai-typing";
        typing.innerHTML = "<span></span><span></span><span></span>";
        body.appendChild(typing);
        body.scrollTop = body.scrollHeight;

        setTimeout(() => {
            typing.remove();
            callback();
        }, 650);
    }

    function handleMessage(text, attachment) {
        const hasImage = !!(attachment && attachment.dataUrl);
        appendUser(text || (hasImage ? "" : text), true, attachment);

        if (hasImage || shouldForwardToSupport(text)) {
            showTyping(async function () {
                try {
                    const result = await saveCustomerSupportMessage(text, attachment);
                    appendBot(supportAckHtml(result));
                    startSupportReplyListener();
                } catch (error) {
                    console.error("Không gửi được tin nhắn hỗ trợ:", error);
                    appendBot("Shop chưa nhận được tin nhắn do lỗi kết nối. Bạn thử gửi lại giúp mình hoặc liên hệ hotline 02796096060 nhé.");
                }
            });
            return;
        }

        showTyping(function () { appendBot(buildReply(text)); });
    }

    function addToCart(productId) {
        const data = getDB();
        const item = data[productId];
        if (!item) return;

        let cart = [];
        try { cart = JSON.parse(localStorage.getItem("cart")) || []; }
        catch (e) { cart = []; }

        const existing = cart.find(x => x.id === productId || x.key === productId);

        if (existing) {
            existing.qty = (Number(existing.qty) || Number(existing.quantity) || 1) + 1;
            existing.quantity = existing.qty;
        } else {
            cart.push({
                id: productId,
                key: productId,
                name: item.name,
                price: item.price,
                priceNum: item.priceNum || 0,
                image: getImage(item),
                size: "M",
                qty: 1,
                quantity: 1
            });
        }

        localStorage.setItem("cart", JSON.stringify(cart));

        document.querySelectorAll("#cart-count,#bag-count").forEach(el => {
            el.textContent = cart.reduce((sum, item) => sum + (Number(item.qty) || Number(item.quantity) || 1), 0);
        });

        appendBot("Mình đã thêm sản phẩm vào BAG cho bạn rồi nhé.");
    }

    function clearHistory() {
        localStorage.removeItem(STORAGE_MESSAGES);
        localStorage.removeItem(STORAGE_CONTEXT);
        renderHistory();
    }

    function setPositionFromStorage() {
        const toggle = document.getElementById("tshAiToggle");
        const box = document.getElementById("tshAiBox");
        const saved = localStorage.getItem(STORAGE_POS);

        if (!saved) return;

        try {
            const pos = JSON.parse(saved);
            if (typeof pos.right === "number") toggle.style.right = pos.right + "px";
            if (typeof pos.bottom === "number") toggle.style.bottom = pos.bottom + "px";

            const bottom = parseFloat(toggle.style.bottom) || 24;
            const right = parseFloat(toggle.style.right) || 24;
            box.style.right = right + "px";
            box.style.bottom = (bottom + 76) + "px";
        } catch (e) {}
    }

    function openChat() {
        const box = document.getElementById("tshAiBox");
        box.classList.add("open");
        renderHistory();
        setTimeout(() => document.getElementById("tshAiInput").focus(), 80);
    }

    function closeChat() {
        document.getElementById("tshAiBox").classList.remove("open");
    }

    function makeDraggable() {
        const toggle = document.getElementById("tshAiToggle");
        const box = document.getElementById("tshAiBox");

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startRight = 0;
        let startBottom = 0;

        toggle.addEventListener("pointerdown", function (e) {
            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            startRight = parseFloat(getComputedStyle(toggle).right) || 24;
            startBottom = parseFloat(getComputedStyle(toggle).bottom) || 24;
            toggle.setPointerCapture(e.pointerId);
        });

        toggle.addEventListener("pointermove", function (e) {
            if (!dragging) return;

            const dx = startX - e.clientX;
            const dy = startY - e.clientY;

            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

            let right = startRight + dx;
            let bottom = startBottom + dy;

            right = Math.max(16, Math.min(window.innerWidth - 86, right));
            bottom = Math.max(16, Math.min(window.innerHeight - 86, bottom));

            toggle.style.right = right + "px";
            toggle.style.bottom = bottom + "px";

            box.style.right = right + "px";
            box.style.bottom = (bottom + 76) + "px";
        });

        toggle.addEventListener("pointerup", function () {
            if (!dragging) return;
            dragging = false;

            const right = parseFloat(getComputedStyle(toggle).right) || 24;
            const bottom = parseFloat(getComputedStyle(toggle).bottom) || 24;

            localStorage.setItem(STORAGE_POS, JSON.stringify({ right, bottom }));

            if (!moved) openChat();
        });

        toggle.addEventListener("dblclick", function (e) {
            e.preventDefault();
            const box = document.getElementById("tshAiBox");
            box.classList.toggle("open");
            if (box.classList.contains("open")) renderHistory();
        });
    }

    function createWidget() {
        if (document.getElementById(WIDGET_ID)) return;

        const wrap = document.createElement("div");
        wrap.id = WIDGET_ID;

        wrap.innerHTML = `
            <button class="tsh-ai-toggle" id="tshAiToggle" aria-label="Open Stylist AI">
                <div class="tsh-ai-logo"><span>TSH</span></div>
            </button>

            <section class="tsh-ai-box" id="tshAiBox">
                <div class="tsh-ai-header">
                    <div class="tsh-ai-logo"><span>TSH</span></div>
                    <div class="tsh-ai-title">Stylist AI Tư Vấn</div>

                    <div class="tsh-ai-actions">
                        <button class="tsh-ai-icon-btn" id="tshAiClear" title="Xóa lịch sử chat">🗑</button>
                        <button class="tsh-ai-icon-btn" id="tshAiClose" title="Đóng">×</button>
                    </div>
                </div>

                <div class="tsh-ai-body" id="tshAiBody"></div>

                <div class="tsh-ai-suggestions">
                    <button data-suggest="Cho tôi coi vài mẫu áo nam hot">Áo nam hot</button>
                    <button data-suggest="Cho tôi coi quần jean">Quần jean</button>
                    <button data-suggest="Cho tôi coi dress shirt">Dress shirt</button>
                    <button data-suggest="Tư vấn size giày nam">Size giày nam</button>
                    <button data-suggest="Tôi muốn gặp nhân viên hỗ trợ">Gặp shop hỗ trợ</button>
                    <button data-suggest="Có sản phẩm sale không">Sale</button>
                </div>

                <div class="tsh-ai-selected-image" id="tshAiSelectedImage"></div>

                <form class="tsh-ai-inputbar" id="tshAiForm">
                    <input class="tsh-ai-file-input" id="tshAiImageInput" type="file" accept="image/*">
                    <button class="tsh-ai-attach" id="tshAiAttach" type="button" title="Gửi ảnh cho shop">📷</button>
                    <input class="tsh-ai-input" id="tshAiInput" placeholder="Send a message" autocomplete="off">
                    <button class="tsh-ai-send" type="submit">➤</button>
                </form>
            </section>
        `;

        document.body.appendChild(wrap);

        setPositionFromStorage();
        makeDraggable();
        renderHistory();

        document.getElementById("tshAiClose").addEventListener("click", closeChat);
        document.getElementById("tshAiClear").addEventListener("click", clearHistory);

        const attachBtn = document.getElementById("tshAiAttach");
        const imageInput = document.getElementById("tshAiImageInput");
        if (attachBtn && imageInput) {
            attachBtn.addEventListener("click", function() { imageInput.click(); });
            imageInput.addEventListener("change", async function() {
                const file = imageInput.files && imageInput.files[0];
                imageInput.value = "";
                if (!file) return;
                try {
                    const attachment = await compressImageFile(file);
                    setSelectedImageAttachment(attachment);
                } catch (error) {
                    appendBot(escapeHTML(error.message || "Không chọn được ảnh. Bạn thử lại nhé."));
                }
            });
        }

        document.getElementById("tshAiForm").addEventListener("submit", function (e) {
            e.preventDefault();
            const input = document.getElementById("tshAiInput");
            const text = input.value.trim();
            const attachment = selectedImageAttachment;

            if (!text && !attachment) return;

            input.value = "";
            setSelectedImageAttachment(null);
            handleMessage(text, attachment);
        });

        document.querySelectorAll(".tsh-ai-suggestions button").forEach(btn => {
            btn.addEventListener("click", function () {
                handleMessage(btn.dataset.suggest);
            });
        });

        document.getElementById("tshAiBody").addEventListener("click", function (e) {
            const cartBtn = e.target.closest(".tsh-ai-product-cart");
            if (cartBtn) addToCart(cartBtn.dataset.productId);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        injectStyle();
        createWidget();
        startSupportReplyListener();
    });
})();
