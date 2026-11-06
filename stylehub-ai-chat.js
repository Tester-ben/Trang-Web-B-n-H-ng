/* =========================================================
   THE STYLE HUB - STYLIST AI PRO
   Features:
   - Lưu lịch sử chat khi đổi trang / F5
   - Logo TSH kéo thả khắp màn hình
   - Double click để thu nhỏ / mở lại
   - Nút X đóng
   - Nút xóa lịch sử chat
   - Typing animation
   - Gợi ý sản phẩm từ product-data.js, LỌC CỨNG theo loại sản phẩm,
     nam/nữ/trẻ em, ngân sách ("dưới 200k", "từ 500k đến 1tr"...), sale, còn hàng
   - Click sản phẩm mở product-detail.html?id=...
   - Bấm icon giỏ hàng thêm vào BAG (giày bắt buộc có size EU hợp lệ)
   - Tư vấn size áo/quần theo bảng Nam/Nữ (shop bán S–XL, trẻ em XS–L)
   - Tư vấn size giày theo size EU shop đang bán: Nam 37–44, Nữ 37–42
     (khớp renderProductSizeSelector trong product-detail.html)
   - Trả lời chính sách giao hàng / đổi trả từ trang chính sách của shop
   - Nhận diện từ khóa theo TỪ (token), có dấu hoặc không dấu — không còn
     lỗi "hi" khớp trong "shipping"
   - Tin nhắn hỗ trợ phân biệt: đã gửi tới shop / đang chờ gửi / chỉ lưu máy
   - Lưu lịch sử an toàn khi localStorage đầy (tự gỡ ảnh cũ, cắt tin cũ)
   - API kiểm thử: window.StyleHubStylistAI (tests/chatbot.test.js)
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
    const STYLEHUB_FIREBASE_CONFIG = {
        apiKey: "AIzaSyBLmPFwTOltztOw28_LUp1L56jgYYAaApM",
        authDomain: "thestylehub-aaf2f.firebaseapp.com",
        databaseURL: "https://thestylehub-aaf2f-default-rtdb.firebaseio.com",
        projectId: "thestylehub-aaf2f",
        storageBucket: "thestylehub-aaf2f.firebasestorage.app",
        messagingSenderId: "1044789250378",
        appId: "1:1044789250378:web:e268f523e323954a6dd9b3",
        measurementId: "G-Y53W16W4W3"
    };
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

    // Size giày (EU) shop thực sự bán — khớp renderProductSizeSelector() trong product-detail.html.
    // (shoe-size-patch.js cũ dùng dãy 21–36 / 19–33 nhưng đã bị product-detail.html thay thế.)
    const SHOE_SIZES = {
        male: [37, 38, 39, 40, 41, 42, 43, 44],
        female: [37, 38, 39, 40, 41, 42]
    };
    const ALL_SHOE_SIZES = [37, 38, 39, 40, 41, 42, 43, 44];
    // Size quần áo đang bán — khớp renderProductSizeSelector() (clothing / kids-clothing).
    const ADULT_CLOTHING_SIZES = ["S", "M", "L", "XL"];
    const KIDS_CLOTHING_SIZES = ["XS", "S", "M", "L"];
    const DEFAULT_CLOTHING_SIZE = "M"; // product-detail.html cũng chọn sẵn M cho quần áo

    const SUPPORT_HOTLINE = "02873066060";   // Khiếu nại / bảo hành (contact.html, shipping-policy.html)
    const SUPPORT_EMAIL = "support@thestylehub.com";
    const CART_KEYS = ["stylehub_cart_memory_v1", "stylehub_cart", "hub_cart", "cartMemoryArray", "the_style_hub_cart", "cart"];
    const CONFIG = {
        supportWriteTimeoutMs: 8000,
        scriptLoadTimeoutMs: 10000,
        maxStoredMessages: 100,
        maxStoredInlineImages: 3,
        resultLimit: 4
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

            .tsh-ai-size-picker {
                display: block;
                margin-top: 8px;
            }

            .tsh-ai-size-options {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin: 8px 0 4px;
            }

            .tsh-ai-size-option {
                border: 1px solid #111;
                background: #fff;
                color: #111;
                border-radius: 10px;
                min-width: 40px;
                height: 32px;
                padding: 0 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
            }

            .tsh-ai-size-option:hover {
                background: #111;
                color: #fff;
            }

            .tsh-ai-muted {
                display: block;
                color: #6b7075;
                font-size: 12px;
                margin-top: 4px;
            }

            .tsh-ai-support-note.is-warning {
                background: #fff4f2;
                border-color: #f1c3b8;
                color: #8a2f1d;
            }

            .tsh-ai-image-removed {
                display: block;
                font-size: 12px;
                opacity: .75;
                font-style: italic;
                margin-top: 6px;
            }

            .tsh-ai-alt-heading {
                display: block;
                margin-top: 10px;
                font-weight: 700;
            }

            .tsh-ai-product-flag {
                display: inline-block;
                margin-top: 4px;
                padding: 2px 6px;
                border-radius: 8px;
                background: #fff4f2;
                color: #8a2f1d;
                font-size: 11px;
                font-weight: 700;
            }

            .tsh-ai-link {
                color: #0b3030;
                font-weight: 700;
                text-decoration: underline;
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

    /* =========================================================
       TIỆN ÍCH CHUNG: DỮ LIỆU, HTML AN TOÀN, LOCALSTORAGE AN TOÀN
       ========================================================= */

    function getDB() {
        try {
            if (typeof database === "object" && database) return database;
            if (typeof window.database === "object" && window.database) return window.database;
        } catch (e) {}
        return {};
    }

    function escapeHTML(str) {
        return String(str === undefined || str === null ? "" : str).replace(/[&<>"']/g, function (m) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
        });
    }

    function isSafeImageDataUrl(value) {
        return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(String(value || ""));
    }

    // Chỉ cho phép ảnh http(s), đường dẫn tương đối hoặc data:image base64.
    // Chặn javascript:, "onerror=" chèn qua dữ liệu sản phẩm do admin nhập/đồng bộ.
    function safeImageUrl(url) {
        const value = String(url || "").trim();
        if (!value) return "";
        if (/^(https?:)?\/\//i.test(value)) return value;
        if (/^data:/i.test(value)) return isSafeImageDataUrl(value) ? value : "";
        if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";
        return value;
    }

    function imageAttachmentHtml(attachment) {
        if (!attachment || !isSafeImageDataUrl(attachment.dataUrl)) return "";
        const alt = escapeHTML(attachment.name || "Ảnh khách gửi");
        return `<img class="tsh-ai-chat-image" src="${escapeHTML(attachment.dataUrl)}" alt="${alt}" loading="lazy">`;
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

    function formatVND(value) {
        return Math.round(Number(value) || 0).toLocaleString("vi-VN") + " ₫";
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
        selectedImageAttachment = attachment && isSafeImageDataUrl(attachment.dataUrl) ? attachment : null;
        const preview = document.getElementById("tshAiSelectedImage");
        if (!preview) return;
        if (!selectedImageAttachment) {
            preview.classList.remove("active");
            preview.innerHTML = "";
            return;
        }
        const name = escapeHTML(selectedImageAttachment.name || "Ảnh đã chọn");
        preview.classList.add("active");
        preview.innerHTML = `
            <img src="${escapeHTML(selectedImageAttachment.dataUrl)}" alt="${name}">
            <div class="tsh-ai-selected-info"><strong>${name}</strong><span>Ảnh sẽ được gửi cho shop · ${escapeHTML(formatFileSize(selectedImageAttachment.size))}</span></div>
            <button class="tsh-ai-remove-image" type="button" id="tshAiRemoveImage" title="Bỏ ảnh">×</button>
        `;
        const remove = document.getElementById("tshAiRemoveImage");
        if (remove) remove.addEventListener("click", function() { setSelectedImageAttachment(null); });
    }

    function formatTime() {
        return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }

    function isQuotaError(error) {
        return !!error && (
            error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            error.code === 22 ||
            error.code === 1014
        );
    }

    // Không bao giờ ném lỗi ra ngoài: localStorage đầy / bị chặn thì trả về false.
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (!isQuotaError(error)) console.warn("THE STYLE HUB chat: không lưu được " + key, error);
            return false;
        }
    }

    function safeGetJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value === null || value === undefined ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    function safeRemoveItem(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }

    /* ---------- Lịch sử chat (tự co lại khi bộ nhớ đầy) ---------- */

    const INLINE_IMAGE_RE = /<img\b[^>]*\bsrc="data:image\/[^"]*"[^>]*>/gi;
    const IMAGE_REMOVED_HTML = '<span class="tsh-ai-image-removed">[Ảnh đã được gỡ khỏi lịch sử chat để tiết kiệm bộ nhớ trình duyệt]</span>';

    function messageHasInlineImage(message) {
        return !!(message && typeof message.html === "string" && message.html.search(INLINE_IMAGE_RE) >= 0);
    }

    function stripInlineImages(message) {
        if (!messageHasInlineImage(message)) return message;
        return Object.assign({}, message, { html: message.html.replace(INLINE_IMAGE_RE, IMAGE_REMOVED_HTML) });
    }

    // Chỉ giữ ảnh (data URL ~1MB) ở `keep` tin nhắn mới nhất.
    function limitInlineImages(messages, keep) {
        const out = messages.slice();
        let kept = 0;
        for (let i = out.length - 1; i >= 0; i--) {
            if (!messageHasInlineImage(out[i])) continue;
            if (kept < keep) { kept++; continue; }
            out[i] = stripInlineImages(out[i]);
        }
        return out;
    }

    function loadMessages() {
        const list = safeGetJSON(STORAGE_MESSAGES, []);
        return Array.isArray(list) ? list : [];
    }

    function saveMessages(messages) {
        let list = limitInlineImages((Array.isArray(messages) ? messages : []).slice(-CONFIG.maxStoredMessages), CONFIG.maxStoredInlineImages);
        const attempt = function () { return safeSetItem(STORAGE_MESSAGES, JSON.stringify(list)); };
        if (attempt()) return true;

        // QuotaExceededError: gỡ dần ảnh, rồi bỏ bớt tin cũ — chat vẫn hoạt động bình thường.
        list = limitInlineImages(list, 1);
        if (attempt()) return true;
        list = list.map(stripInlineImages);
        if (attempt()) return true;
        while (list.length > 1) {
            list = list.slice(Math.ceil(list.length / 2));
            if (attempt()) return true;
        }
        safeRemoveItem(STORAGE_MESSAGES);
        return false;
    }

    /* ---------- Ngữ cảnh hội thoại (tách riêng giày / quần áo) ---------- */

    const CONTEXT_VERSION = 2;
    const CONTEXT_IDLE_MS = 30 * 60 * 1000;

    function defaultContext() {
        return { v: CONTEXT_VERSION, flow: null, awaiting: null, shoe: {}, clothing: {}, lastProducts: [], updatedAt: 0 };
    }

    function loadContext() {
        const ctx = safeGetJSON(STORAGE_CONTEXT, null);
        if (!ctx || typeof ctx !== "object" || ctx.v !== CONTEXT_VERSION) return defaultContext();
        ctx.shoe = ctx.shoe && typeof ctx.shoe === "object" ? ctx.shoe : {};
        ctx.clothing = ctx.clothing && typeof ctx.clothing === "object" ? ctx.clothing : {};
        ctx.lastProducts = Array.isArray(ctx.lastProducts) ? ctx.lastProducts : [];
        // Câu hỏi tư vấn size bỏ dở quá 30 phút thì không còn "đang chờ" câu trả lời.
        if (Date.now() - Number(ctx.updatedAt || 0) > CONTEXT_IDLE_MS) {
            ctx.awaiting = null;
            ctx.flow = null;
        }
        return ctx;
    }

    function saveContext(ctx) {
        const value = ctx && typeof ctx === "object" ? ctx : defaultContext();
        value.v = CONTEXT_VERSION;
        value.updatedAt = Date.now();
        return safeSetItem(STORAGE_CONTEXT, JSON.stringify(value));
    }

    function getImage(item) {
        return (item && (item.mainImg || (Array.isArray(item.images) && item.images[0]))) || "";
    }

    function getOldPrice(item) {
        return item.oldPrice || item.originalPrice || item.comparePrice || "";
    }

    /* =========================================================
       PHÂN TÍCH CÂU CHỮ: so khớp theo TỪ, có dấu hoặc không dấu
       ========================================================= */

    const WORD_RE = /[\p{L}\p{N}]+/gu;

    function lowerNFC(str) {
        return String(str === undefined || str === null ? "" : str).normalize("NFC").toLowerCase();
    }

    // Bỏ dấu + đ→d, chỉ dùng để so khớp.
    function normalize(str) {
        return lowerNFC(str).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
    }

    function tokenize(str) {
        return lowerNFC(str).match(WORD_RE) || [];
    }

    function isAsciiWord(word) {
        return /^[a-z0-9]+$/.test(word);
    }

    function analyzeText(text) {
        const raw = lowerNFC(text);
        return { text: String(text === undefined || text === null ? "" : text), raw: raw, folded: normalize(raw), tokens: raw.match(WORD_RE) || [] };
    }

    // "nữ" khớp "nữ" hoặc "nu" gõ không dấu, nhưng KHÔNG khớp "nụ"/"menu";
    // "nam" không khớp "năm"; "hi" không khớp "shipping"; "dép" không khớp "đẹp".
    function wordMatches(word, keyword) {
        return word === keyword || (isAsciiWord(word) && word === normalize(keyword));
    }

    const termPartsCache = new Map();
    function termParts(term) {
        if (!termPartsCache.has(term)) termPartsCache.set(term, tokenize(term));
        return termPartsCache.get(term);
    }

    function termSpans(a, term) {
        const parts = termParts(term);
        const tokens = a.tokens;
        const spans = [];
        if (!parts.length || parts.length > tokens.length) return spans;
        for (let i = 0; i + parts.length <= tokens.length; i++) {
            let ok = true;
            for (let j = 0; j < parts.length; j++) {
                if (!wordMatches(tokens[i + j], parts[j])) { ok = false; break; }
            }
            if (ok) spans.push([i, i + parts.length]);
        }
        return spans;
    }

    function hasTerm(a, term) {
        return termSpans(a, term).length > 0;
    }

    function hasAny(a, terms) {
        for (let i = 0; i < terms.length; i++) if (hasTerm(a, terms[i])) return true;
        return false;
    }

    /* ---------- Từ điển ---------- */

    const GREETING_TERMS = ["hi", "hello", "helo", "hey", "chào", "xin chào", "alo", "hế lô", "good morning", "good evening"];
    const THANKS_TERMS = ["cảm ơn", "cám ơn", "thanks", "thank you", "thank", "tks", "thx", "camon"];
    const SHIPPING_TERMS = [
        "ship", "shipping", "shipper", "giao hàng", "giao", "vận chuyển", "phí ship", "phí giao", "freeship", "free ship",
        "miễn phí vận chuyển", "nhận hàng", "delivery", "cod", "phí vận chuyển", "giao tận nơi", "bao lâu nhận"
    ];
    const RETURN_TERMS = [
        "đổi trả", "đổi hàng", "trả hàng", "trả lại", "hoàn tiền", "hoàn hàng", "bảo hành", "đổi size", "đổi màu", "đổi mẫu",
        "return", "returns", "refund", "exchange", "warranty"
    ];
    const SUPPORT_TERMS = [
        "khiếu nại", "phàn nàn", "không hài lòng", "complain", "complaint", "lỗi đơn", "lỗi sản phẩm", "hàng lỗi", "hàng hỏng",
        "hủy đơn", "huỷ đơn", "đổi địa chỉ", "số lượng lớn", "đặt nhiều", "mua nhiều", "mua sỉ", "giá sỉ", "bulk", "doanh nghiệp",
        "ý kiến", "góp ý", "feedback", "đánh giá sản phẩm", "nhân viên", "người thật", "admin", "gặp shop", "liên hệ shop",
        "tư vấn viên", "chat với shop", "nói chuyện với shop"
    ];
    const DEFECT_TERMS = ["lỗi", "bị lỗi", "hỏng", "bị hỏng", "rách", "bung keo", "giao sai", "giao nhầm", "giao thiếu", "thiếu hàng", "móp", "bẩn"];
    const DESIRE_TERMS = ["muốn", "cần", "xin", "giúp", "hỗ trợ", "yêu cầu", "làm thủ tục", "làm sao để"];
    const ORDER_TERMS = ["đơn hàng", "mã đơn", "đơn của tôi", "đơn của mình", "đơn số", "order"];
    const QUESTION_TERMS = [
        "chính sách", "quy định", "điều kiện", "như thế nào", "thế nào", "như nào", "ra sao", "bao lâu", "mấy ngày",
        "bao nhiêu", "được không", "được ko", "có được", "thì sao", "làm sao", "làm thế nào", "cách", "how", "what", "policy"
    ];
    const QUESTION_TAIL_WORDS = ["không", "ko", "k", "hông", "hok", "khum", "nhỉ", "vậy", "chưa", "sao"];

    const SIZE_TERMS = ["size", "cỡ", "số đo", "kích cỡ", "kích thước", "bảng size", "form"];
    const SIZE_ADVICE_TERMS = [
        "tư vấn size", "tư vấn cỡ", "chọn size", "chọn cỡ", "mặc size", "mang size", "đi size", "size nào", "size gì",
        "size bao nhiêu", "size mấy", "cỡ nào", "cỡ mấy", "số mấy", "nên mặc", "nên mang", "nên chọn", "nên lấy",
        "mặc vừa không", "có vừa không"
    ];
    const FIT_LOOSE_TERMS = ["rộng", "rộng rãi", "thoải mái", "oversize", "oversized", "loose", "baggy", "dư", "rộng một chút", "rộng hơn"];
    const FIT_REGULAR_TERMS = ["vừa", "vừa vặn", "vừa chân", "vừa người", "ôm", "ôm body", "fit", "regular", "chuẩn", "đúng size", "bình thường", "slim"];

    const PRODUCT_REQUEST_TERMS = [
        "xem", "coi", "gợi ý", "tìm", "kiếm", "mẫu", "sản phẩm", "show", "find", "recommend", "suggest", "hot", "bán chạy",
        "trending", "mới", "mua", "list", "danh sách", "có những", "có gì", "outfit", "phối"
    ];
    const STRONG_REQUEST_TERMS = ["xem", "coi", "tìm", "kiếm", "gợi ý", "mẫu", "show", "find", "mua", "có những", "có gì", "bán"];
    const GENERIC_PRODUCT_TERMS = ["mẫu", "sản phẩm", "hàng", "đồ", "item", "items", "product", "products", "quần áo"];
    const CLOTHING_TALK_TERMS = ["quần áo", "đồ", "clothes", "clothing", "outfit", "trang phục"];

    const FEMALE_TERMS = ["nữ", "women", "womens", "woman", "female", "girl", "girls", "lady", "ladies", "bạn gái", "vợ", "mẹ", "con gái", "phụ nữ", "bé gái"];
    const MALE_TERMS = ["nam", "men", "mens", "man", "male", "boy", "boys", "bạn trai", "chồng", "bố", "con trai", "đàn ông", "bé trai"];
    const KIDS_TERMS = [
        "trẻ em", "trẻ con", "em bé", "bé", "bé trai", "bé gái", "kid", "kids", "children", "child", "baby", "thiếu nhi",
        "con nít", "cho con", "con tôi", "con mình", "cho bé", "nhóc"
    ];
    const SALE_TERMS = ["sale", "giảm giá", "khuyến mãi", "khuyến mại", "discount", "ưu đãi", "đang giảm", "săn sale", "deal", "clearance", "xả hàng"];
    const CHEAP_TERMS = ["rẻ", "giá rẻ", "rẻ nhất", "cheap", "cheapest", "tiết kiệm", "bình dân", "giá mềm", "hạt dẻ"];
    const EXPENSIVE_TERMS = ["đắt nhất", "cao cấp nhất", "mắc nhất", "most expensive"];

    // Loại sản phẩm khách hỏi → khóa loại; group = nhóm lớn (áo / quần / giày / váy)
    const QUERY_TYPE_DEFS = [
        { key: "tee", terms: ["áo thun", "áo phông", "áo cộc tay", "áo ngắn tay", "t-shirt", "tshirt", "tee", "tees", "áo tee", "short sleeve", "long sleeve tee"] },
        { key: "tank", terms: ["áo ba lỗ", "áo sát nách", "tank", "tank top", "áo hai dây", "sleeveless"] },
        { key: "polo", terms: ["polo", "áo polo", "áo cổ bẻ"] },
        { key: "shirt", terms: ["sơ mi", "áo sơ mi", "sơmi", "somi", "dress shirt", "shirt", "shirts", "overshirt", "sơ mi công sở"] },
        { key: "hoodie", terms: ["hoodie", "hoodies", "hoody", "áo hoodie", "áo có mũ", "áo nỉ có mũ"] },
        { key: "sweater", terms: ["sweater", "sweatshirt", "áo nỉ", "áo len", "crewneck", "cardigan", "knit", "áo sweater"] },
        { key: "jacket", terms: ["áo khoác", "jacket", "jackets", "coat", "áo măng tô", "blazer", "áo gió", "bomber"] },
        { key: "jeans", terms: ["jean", "jeans", "quần jean", "quần jeans", "quần bò", "denim"] },
        { key: "shorts", terms: ["quần short", "quần shorts", "quần đùi", "quần ngắn", "quần sooc", "short", "shorts"] },
        { key: "pants", terms: ["quần dài", "pant", "pants", "trouser", "trousers", "sweatpant", "sweatpants", "jogger", "joggers", "quần jogger", "quần nỉ", "quần ống rộng", "quần tây", "quần âu"] },
        { key: "dress", terms: ["váy", "đầm", "chân váy", "dress", "dresses", "skirt", "đầm dự tiệc"] },
        { key: "sneaker", terms: ["sneaker", "sneakers", "giày thể thao", "giày bóng rổ", "giày chạy bộ", "basketball"] },
        { key: "boot", terms: ["boot", "boots", "bốt", "giày bốt", "giày cổ cao"] },
        { key: "slipper", terms: ["dép", "dép lê", "slipper", "slippers", "sandal", "sandals", "slide", "slides"] },
        { key: "flat", terms: ["giày búp bê", "ballerino", "flat", "flats"] }
    ];
    const QUERY_GROUP_DEFS = [
        { key: "top", terms: ["áo", "top", "tops"] },
        { key: "bottom", terms: ["quần", "bottom", "bottoms"] },
        { key: "shoes", terms: ["giày", "giầy", "giày dép", "shoe", "shoes", "footwear"] }
    ];
    const TYPE_GROUP = {
        tee: "top", tank: "top", polo: "top", shirt: "top", hoodie: "top", sweater: "top", jacket: "top", top: "top",
        pants: "bottom", shorts: "bottom", jeans: "bottom",
        dress: "dress",
        sneaker: "shoes", boot: "shoes", slipper: "shoes", flat: "shoes"
    };
    const TYPE_LABELS = {
        tee: "áo thun", tank: "áo tank / ba lỗ", polo: "áo polo", shirt: "áo sơ mi", hoodie: "hoodie", sweater: "áo nỉ / sweater",
        jacket: "áo khoác", top: "áo", pants: "quần dài", shorts: "quần short", jeans: "quần jean", dress: "váy / đầm",
        sneaker: "giày sneaker", boot: "giày boot", slipper: "dép", flat: "giày búp bê"
    };
    const GROUP_LABELS = { top: "áo", bottom: "quần", shoes: "giày / dép", dress: "váy / đầm" };

    // Nhận diện loại của SẢN PHẨM từ tên tiếng Anh (đã bỏ dấu, chữ thường)
    const PRODUCT_TYPE_TESTS = {
        tee: function (n) { return /\b(tee|tees|t-shirt|tshirt)\b/.test(n); },
        tank: function (n) { return /\b(tank|sleeveless)\b/.test(n); },
        polo: function (n) { return /\bpolo\b/.test(n); },
        shirt: function (n) { return /\b(shirt|overshirt)\b/.test(n) && !/t-?shirt/.test(n); },
        hoodie: function (n) { return /\bhoodie\b/.test(n); },
        sweater: function (n) { return /\b(sweatshirt|sweater|crewneck|knit|pullover|mockneck|henley|cardigan)\b/.test(n) && !/\bhoodie\b/.test(n) && !/\b(shorts?|pants?|sweatpants?)\b/.test(n); },
        jacket: function (n) { return /\b(jacket|coat|blazer|bomber|parka|overshirt)\b/.test(n); },
        top: function (n) { return /\btop\b/.test(n); },
        pants: function (n) { return /\b(pant|pants|trouser|trousers|sweatpant|sweatpants|jogger|joggers|leggings?)\b/.test(n); },
        shorts: function (n) { return /\b(shorts?|sweatshorts?)\b(?!\s*sleeve)/.test(n); },
        jeans: function (n) { return /\bjeans?\b/.test(n) || (/\bdenim\b/.test(n) && !/\b(jacket|coat)\b/.test(n)); },
        dress: function (n) { return /\b(dress|skirt|gown)\b(?!\s*shirt)/.test(n); },
        sneaker: function (n) { return /\b(sneakers?|basketball|runner|aerobic|trainers?)\b/.test(n); },
        boot: function (n) { return /\bboots?\b/.test(n); },
        slipper: function (n) { return /\b(slippers?|slides?|sandals?)\b/.test(n); },
        flat: function (n) { return /\b(ballerino|ballet|flats?|loafers?)\b/.test(n); }
    };

    const COLOR_DEFS = [
        { key: "black", label: "đen", terms: ["đen", "black", "màu đen"], test: /\b(black|onyx|jet)\b/ },
        { key: "white", label: "trắng / kem", terms: ["trắng", "white", "màu trắng", "kem", "ivory", "cream"], test: /\b(white|ivory|cream|pearl)\b/ },
        { key: "grey", label: "xám / ghi", terms: ["xám", "ghi", "grey", "gray", "màu xám"], test: /\b(grey|gray|heather|concrete|smoke|charcoal|stone|iron)\b/ },
        { key: "blue", label: "xanh dương", terms: ["xanh dương", "xanh da trời", "xanh navy", "xanh biển", "navy", "blue", "xanh"], test: /\b(blue|navy|indigo|sky|sapphire|coastal)\b/ },
        { key: "green", label: "xanh lá", terms: ["xanh lá", "xanh rêu", "green", "olive", "xanh"], test: /\b(green|olive|sage)\b/ },
        { key: "brown", label: "nâu / be", terms: ["nâu", "brown", "màu be", "beige", "màu nâu"], test: /\b(brown|dune|taupe|oat|oatmeal|beige|camel|tan|homestead)\b/ },
        { key: "red", label: "đỏ", terms: ["đỏ", "red", "đỏ đô", "maroon", "burgundy"], test: /\b(red|maroon|oxblood|burgundy)\b/ },
        { key: "pink", label: "hồng", terms: ["hồng", "pink", "màu hồng"], test: /\b(pink|blush|rose|mauve)\b/ }
    ];

    // Chất liệu: chỉ dùng để ưu tiên xếp hạng (không lọc cứng)
    const MATERIAL_DEFS = [
        { key: "leather", label: "da", terms: ["da", "da thật", "leather"], test: /\bleather\b/ },
        { key: "denim", label: "denim / jean", terms: ["denim", "vải jean", "vải bò"], test: /\b(denim|jeans?)\b/ },
        { key: "fleece", label: "nỉ", terms: ["nỉ", "fleece", "vải nỉ"], test: /\b(fleece|sweat\w*)\b/ },
        { key: "knit", label: "len / dệt kim", terms: ["len", "dệt kim", "knit", "wool"], test: /\b(knit|wool|sweater)\b/ },
        { key: "nylon", label: "nylon / dù", terms: ["nylon", "vải dù", "dù"], test: /\bnylon\b/ }
    ];

    const QUERY_STOPWORDS =["the", "and", "for", "with", "cho", "toi", "coi", "xem", "mau", "nam", "hot", "sale", "size", "vai", "minh", "ban", "shop", "khong", "nhung", "gia", "duoi", "tren"];

    /* ---------- Ngân sách: "dưới 200.000đ", "dưới 200k", "từ 500k đến 1tr", "trên 2 triệu", "1tr5" ---------- */

    const MONEY_UNIT_VALUES = { k: 1e3, nghin: 1e3, ngan: 1e3, canh: 1e3, thousand: 1e3, tr: 1e6, trieu: 1e6, cu: 1e6, million: 1e6, mil: 1e6, d: 1, dong: 1, vnd: 1 };
    const NON_MONEY_WORDS = ["kg", "kgs", "ky", "ki", "kilo", "can", "cm", "m", "met", "mm", "tuoi", "size", "cai", "chiec", "doi", "san", "nam", "thang", "ngay", "gio", "phut", "lan", "x"];
    const BUDGET_MAX_BEFORE = ["duoi", "it hon", "nho hon", "thap hon", "re hon", "khong qua", "khong vuot qua", "khong hon", "toi da", "max", "under", "below", "less than", "cheaper than", "<=", "<"];
    const BUDGET_MIN_BEFORE = ["tren", "lon hon", "cao hon", "dat hon", "hon", "it nhat", "toi thieu", "over", "above", "more than", "at least", ">=", ">", "min"];
    const BUDGET_APPROX_BEFORE = ["khoang", "tam", "around", "about", "approximately", "xap xi", "quanh", "loanh quanh", "co gia", "gia", "budget", "ngan sach"];
    const BUDGET_RANGE_START = ["tu", "between", "from", "khoang", "tam"];
    const BUDGET_MAX_AFTER = ["tro xuong", "do lai", "tro lai", "or less", "or below", "max", "toi da"];
    const BUDGET_MIN_AFTER = ["tro len", "or more", "or above", "+"];
    const BUDGET_FILLERS = "(?:\\s+(?:muc|gia|tam|khoang|co|la|chung|tien))*";

    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function phraseBefore(text, phrases) {
        for (const phrase of phrases) {
            const re = new RegExp("(?:^|[^a-z0-9])(" + escapeRegExp(phrase) + ")" + BUDGET_FILLERS + "\\s*$");
            const m = text.match(re);
            if (m) return { phrase: phrase, index: m.index + m[0].indexOf(m[1]) };
        }
        return null;
    }

    function phraseAfter(text, phrases) {
        for (const phrase of phrases) {
            const re = new RegExp("^\\s*(" + escapeRegExp(phrase) + ")(?![a-z0-9])");
            const m = text.match(re);
            if (m) return { phrase: phrase, length: m[0].length };
        }
        return null;
    }

    function parseLooseNumber(raw) {
        const s = String(raw);
        if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
        if (/^\d+[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
        if (/^\d+$/.test(s)) return Number(s);
        return NaN;
    }

    function scanMoneyCandidates(folded) {
        const out = [];
        const re = /\d+(?:[.,]\d+)*/g;
        let m;
        while ((m = re.exec(folded))) {
            const start = m.index;
            let end = start + m[0].length;
            if (start > 0 && /[a-z]/.test(folded[start - 1])) continue; // "1m70", "sth123456"
            const num = parseLooseNumber(m[0]);
            if (!Number.isFinite(num)) continue;
            const before = folded.slice(0, start);
            if (/(?:^|[^a-z0-9])(size|sz|so|co|giay|eu)\s*$/.test(before)) continue; // size giày, không phải tiền
            const currency = folded.slice(end).match(/^\s*₫/);
            if (currency) end += currency[0].length;
            const um = currency ? null : folded.slice(end).match(/^\s*([a-z]+)(\d{1,3})?(?![a-z0-9])/);
            let unit = "";
            let tail = "";
            if (um) {
                if (Object.prototype.hasOwnProperty.call(MONEY_UNIT_VALUES, um[1])) {
                    unit = um[1];
                    tail = um[2] || "";
                    end += um[0].length;
                } else if (NON_MONEY_WORDS.includes(um[1])) {
                    continue;
                }
            }
            let value = num;
            if (unit) {
                value = num * MONEY_UNIT_VALUES[unit];
                if (tail && MONEY_UNIT_VALUES[unit] >= 1e3) value += Number("0." + tail) * MONEY_UNIT_VALUES[unit];
            }
            out.push({ start: start, end: end, num: num, unit: unit, value: value });
        }
        return out;
    }

    function smallNumberAsMoney(num) {
        if (num >= 50 && num < 1000) return num * 1e3;   // "dưới 500" → 500.000đ
        if (num > 0 && num <= 20) return num * 1e6;      // "tầm 2" → 2 triệu
        return null;
    }

    function parseBudget(text) {
        const folded = normalize(text);
        const cands = scanMoneyCandidates(folded);
        if (!cands.length) return null;

        const exprs = [];
        for (let i = 0; i < cands.length; i++) {
            const a = cands[i];
            const b = cands[i + 1];
            // Khoảng giá: "từ 500k đến 1tr", "500-800k", "1 - 2 triệu"
            if (b && /^\s*(den|toi|-|–|~|va|and|to)\s*$/.test(folded.slice(a.end, b.start))) {
                let av = a.value;
                let bv = b.value;
                if (!a.unit && b.unit) av = a.num * MONEY_UNIT_VALUES[b.unit];
                if (a.unit && !b.unit && b.num < 1000) bv = b.num * MONEY_UNIT_VALUES[a.unit];
                if (!a.unit && !b.unit && av < 1000 && bv < 1000) {
                    av = smallNumberAsMoney(a.num);
                    bv = smallNumberAsMoney(b.num);
                    if (!phraseBefore(folded.slice(0, a.start), BUDGET_RANGE_START.concat(BUDGET_APPROX_BEFORE))) { av = null; }
                }
                if (av && bv) {
                    const startPhrase = phraseBefore(folded.slice(0, a.start), BUDGET_RANGE_START.concat(BUDGET_APPROX_BEFORE));
                    exprs.push({ kind: "range", min: Math.min(av, bv), max: Math.max(av, bv), span: [startPhrase ? startPhrase.index : a.start, b.end] });
                    i++;
                    continue;
                }
            }

            const before = folded.slice(0, a.start);
            const after = folded.slice(a.end);
            const maxB = phraseBefore(before, BUDGET_MAX_BEFORE);
            const minB = maxB ? null : phraseBefore(before, BUDGET_MIN_BEFORE);
            const approxB = (maxB || minB) ? null : phraseBefore(before, BUDGET_APPROX_BEFORE);
            const maxA = phraseAfter(after, BUDGET_MAX_AFTER);
            const minA = maxA ? null : phraseAfter(after, BUDGET_MIN_AFTER);
            const hasRelation = !!(maxB || minB || approxB || maxA || minA);

            let value = a.value;
            if (!a.unit && value < 1000) {
                if (!hasRelation) continue;            // số trơn không có chữ "dưới/trên/khoảng..." → không phải tiền
                value = smallNumberAsMoney(a.num);
                if (!value) continue;
            }
            const spanStart = (maxB || minB || approxB) ? (maxB || minB || approxB).index : a.start;
            const spanEnd = a.end + ((maxA || minA) ? (maxA || minA).length : 0);
            if (maxB || maxA) exprs.push({ kind: "max", max: value, span: [spanStart, spanEnd] });
            else if (minB || minA) exprs.push({ kind: "min", min: value, span: [spanStart, spanEnd] });
            else exprs.push({ kind: "approx", min: Math.round(value * 0.8), max: Math.round(value * 1.2), value: value, span: [spanStart, spanEnd] });
        }
        if (!exprs.length) return null;

        let min = null;
        let max = null;
        exprs.forEach(function (e) {
            if (e.min !== undefined && e.min !== null) min = min === null ? e.min : Math.max(min, e.min);
            if (e.max !== undefined && e.max !== null) max = max === null ? e.max : Math.min(max, e.max);
        });
        if (min !== null && max !== null && min > max) {
            const last = exprs[exprs.length - 1];
            min = last.min === undefined ? null : last.min;
            max = last.max === undefined ? null : last.max;
        }

        let label;
        const only = exprs.length === 1 ? exprs[0] : null;
        if (only && only.kind === "approx") label = "khoảng " + formatVND(only.value) + " (" + formatVND(min) + " – " + formatVND(max) + ")";
        else if (min !== null && max !== null) label = "từ " + formatVND(min) + " đến " + formatVND(max);
        else if (max !== null) label = "dưới " + formatVND(max);
        else label = "từ " + formatVND(min) + " trở lên";

        return { min: min, max: max, label: label, kind: only ? only.kind : "combined", spans: exprs.map(function (e) { return e.span; }) };
    }

    // Xóa phần ngân sách khỏi câu trước khi tìm từ khóa ("den" trong "500k den 1tr" không phải màu đen).
    function blankSpans(raw, spans, foldedLength) {
        if (!spans || !spans.length || raw.length !== foldedLength) return raw;
        let out = raw;
        spans.forEach(function (span) {
            out = out.slice(0, span[0]) + " ".repeat(Math.max(0, span[1] - span[0])) + out.slice(span[1]);
        });
        return out;
    }

    /* ---------- Trích xuất số đo ---------- */

    function numberAfterTerms(a, terms, test) {
        for (const term of terms) {
            const spans = termSpans(a, term);
            for (const span of spans) {
                const next = a.tokens[span[1]];
                if (next && /^\d+$/.test(next) && test(Number(next))) return Number(next);
            }
        }
        return null;
    }

    function extractHeight(a, allowBare) {
        const f = a.folded;
        let m = f.match(/(?:^|[^a-z0-9.,])1\s*m\s*(\d{1,2})(?![\d])/);
        if (m) {
            const tail = Number(m[1]);
            return tail < 10 ? 100 + tail * 10 : 100 + tail;
        }
        m = f.match(/(?:^|[^a-z0-9.,])([12])[.,](\d{1,2})\s*m(?![a-z])/) || f.match(/\bcao\s*(?:khoang\s*)?([12])[.,](\d{1,2})\b/);
        if (m) return Number(m[1]) * 100 + (m[2].length === 1 ? Number(m[2]) * 10 : Number(m[2]));
        m = f.match(/(?:^|[^a-z0-9.,])(\d{3})\s*cm\b/);
        if (m) return Number(m[1]);
        const afterKeyword = numberAfterTerms(a, ["cao", "chiều cao", "height", "cao khoảng"], function (n) { return n >= 120 && n <= 220; });
        if (afterKeyword) return afterKeyword;
        if (allowBare) {
            const nums = (f.match(/(?:^|[^a-z0-9.,])(\d{3})(?![\d.,]*\s*[a-z])/g) || []).map(function (x) { return Number(x.replace(/\D/g, "")); }).filter(function (n) { return n >= 120 && n <= 220; });
            if (nums.length) return nums[0];
        }
        return null;
    }

    function extractWeight(a) {
        const f = a.folded;
        const m = f.match(/(?:^|[^a-z0-9.,])(\d{2,3}(?:[.,]\d)?)\s*(kg|kgs|ky|ki|kilo|kilogram|can)\b/);
        if (m) return Number(m[1].replace(",", "."));
        return numberAfterTerms(a, ["nặng", "cân nặng", "nặng khoảng", "weight", "nang"], function (n) { return n >= 20 && n <= 200; });
    }

    function extractShoeNumber(a) {
        const m = a.folded.match(/(?:^|[^a-z0-9])(?:size|sz|so|co|giay|giày|eu)\s*(\d{2}(?:[.,]5)?)(?![\d.,]*\s*(?:kg|cm|k|tr|trieu|nghin|ngan)\b)(?![\d])/);
        return m ? Number(m[1].replace(",", ".")) : null;
    }

    function extractFootLength(a) {
        const f = a.folded;
        let m = f.match(/(?:^|[^a-z0-9.,])(\d{2}(?:[.,]\d)?)\s*cm\b/);
        if (m) {
            const v = Number(m[1].replace(",", "."));
            if (v >= 15 && v <= 33) return v;
        }
        m = f.match(/\bchan\s*(?:dai|toi)?\s*(?:khoang|tam)?\s*(\d{2}(?:[.,]\d)?)\b/);
        if (m) {
            const v = Number(m[1].replace(",", "."));
            if (v >= 15 && v <= 33) return v;
        }
        return null;
    }

    function extractLetterSize(a) {
        const m = a.folded.match(/\b(?:size|co)\s*(xxl|xl|xs|s|m|l)\b/);
        return m ? m[1].toUpperCase() : null;
    }

    const BARE_BLOCK_WORDS = ["kg", "kgs", "ky", "ki", "kilo", "cm", "m", "mm", "met", "k", "tr", "trieu", "nghin", "ngan", "canh", "cu", "d", "dong", "vnd", "tuoi", "cai", "chiec", "doi", "lan", "ngay", "thang", "gio", "phut", "phan"];

    function extractBareNumbers(a) {
        const f = a.folded;
        const out = [];
        const re = /\d+(?:[.,]\d+)?/g;
        let m;
        while ((m = re.exec(f))) {
            const start = m.index;
            const end = start + m[0].length;
            if (start > 0 && /[a-z]/.test(f[start - 1])) continue;
            const next = f.slice(end).match(/^\s*([a-z]+)/);
            if (next && BARE_BLOCK_WORDS.includes(next[1])) continue;
            if (f[end] && /[a-z]/.test(f[end])) continue;
            out.push(Number(m[0].replace(",", ".")));
        }
        return out;
    }

    function footLengthToEU(cm) {
        // Công thức Paris point: EU ≈ (chiều dài bàn chân + 1,5cm) × 1,5 — chỉ để ước tính.
        return Math.round((Number(cm) + 1.5) * 1.5);
    }

    /* ---------- Nhận diện loại sản phẩm khách hỏi ---------- */

    function detectProductTypes(a) {
        const matches = [];
        QUERY_TYPE_DEFS.forEach(function (def) {
            def.terms.forEach(function (term) {
                termSpans(a, term).forEach(function (span) { matches.push({ key: def.key, kind: "type", span: span, term: term }); });
            });
        });
        QUERY_GROUP_DEFS.forEach(function (def) {
            def.terms.forEach(function (term) {
                termSpans(a, term).forEach(function (span) { matches.push({ key: def.key, kind: "group", span: span, term: term }); });
            });
        });
        // Cụm dài thắng cụm ngắn nằm bên trong: "dress shirt" ⊃ "dress", "áo thun" ⊃ "áo", "short sleeve" ⊃ "short"
        let kept = matches.filter(function (m) {
            return !matches.some(function (o) {
                if (o === m) return false;
                const oLen = o.span[1] - o.span[0];
                const mLen = m.span[1] - m.span[0];
                return oLen > mLen && o.span[0] <= m.span[0] && o.span[1] >= m.span[1];
            });
        });
        // "dep" gõ không dấu có thể là "đẹp": chỉ hiểu là dép khi câu không nhắc loại đồ khác.
        const others = kept.filter(function (m) { return !(m.key === "slipper" && a.tokens[m.span[0]] === "dep"); });
        if (others.length) kept = others;

        const types = new Set();
        const groups = new Set();
        kept.forEach(function (m) {
            if (m.key === "tee" && m.term === "short sleeve") { types.add("tee"); return; }
            if (m.kind === "type") types.add(m.key);
            else groups.add(m.key);
        });
        return { types: types, groups: groups, dressShirt: hasAny(a, ["dress shirt", "sơ mi công sở"]) };
    }

    function detectGender(a) {
        const cleaned = analyzeText(a.raw.replace(/(việt|viet|miền|mien)\s+nam(?![\p{L}\p{N}])/gu, " "));
        const female = hasAny(cleaned, FEMALE_TERMS);
        const male = hasAny(cleaned, MALE_TERMS);
        if (female && !male) return "female";
        if (male && !female) return "male";
        return "";
    }

    function detectKids(a) {
        const cleaned = analyzeText(a.raw.replace(/(màu|mau)\s+(be|bé)(?![\p{L}\p{N}])/gu, " "));
        return hasAny(cleaned, KIDS_TERMS);
    }

    function isQuestion(a) {
        if (a.text.indexOf("?") >= 0) return true;
        if (hasAny(a, QUESTION_TERMS)) return true;
        const last = a.tokens[a.tokens.length - 1];
        return !!last && QUESTION_TAIL_WORDS.some(function (w) { return wordMatches(last, w); });
    }

    function hasOrderReference(a) {
        return /\bsth\d{4,}\b/.test(a.folded) || hasAny(a, ORDER_TERMS);
    }

    function extractEntities(a, ctx, budget) {
        const typeInfo = detectProductTypes(a);
        const types = typeInfo.types;
        const groups = typeInfo.groups;
        const typeList = Array.from(types);
        const shoeTalk = groups.has("shoes") || typeList.some(function (t) { return TYPE_GROUP[t] === "shoes"; });
        const clothingTalk = groups.has("top") || groups.has("bottom") || typeList.some(function (t) { return TYPE_GROUP[t] !== "shoes"; }) || hasAny(a, CLOTHING_TALK_TERMS);
        const gender = detectGender(a);
        const kids = detectKids(a);
        const sale = hasAny(a, SALE_TERMS);
        const cheap = hasAny(a, CHEAP_TERMS);
        const expensive = hasAny(a, EXPENSIVE_TERMS);
        const colors = COLOR_DEFS.filter(function (def) { return hasAny(a, def.terms); });
        const materials = MATERIAL_DEFS.filter(function (def) { return hasAny(a, def.terms); });
        const sizeTalk = hasAny(a, SIZE_TERMS);
        const sizeAdvice = hasAny(a, SIZE_ADVICE_TERMS);
        const productRequest = hasAny(a, PRODUCT_REQUEST_TERMS);
        const strongRequest = hasAny(a, STRONG_REQUEST_TERMS);
        const fit = hasAny(a, FIT_LOOSE_TERMS) ? "loose" : (hasAny(a, FIT_REGULAR_TERMS) ? "regular" : "");
        const allowBareHeight = !!(ctx && ctx.flow === "clothing" && ctx.awaiting === "measurements");
        const height = extractHeight(a, allowBareHeight);
        const weight = extractWeight(a);
        const shoeNumber = extractShoeNumber(a);
        const footLengthCm = extractFootLength(a);
        const letterSize = extractLetterSize(a);
        const bareNumbers = extractBareNumbers(a);
        const measurements = !!(height || weight);
        const hasCatalogCriteria = types.size > 0 || groups.size > 0 || sale || kids;

        const wantsShoeSize = !letterSize && (
            (shoeTalk && (sizeAdvice || ((sizeTalk || shoeNumber || footLengthCm) && !strongRequest))) ||
            (!shoeTalk && !clothingTalk && !measurements && shoeNumber !== null && shoeNumber >= 30 && shoeNumber <= 50 && !strongRequest)
        );
        const wantsClothingSize = !shoeTalk && !letterSize && !wantsShoeSize && (
            (sizeAdvice && (clothingTalk || measurements)) ||
            (measurements && !strongRequest) ||
            (sizeTalk && clothingTalk && !strongRequest)
        );
        const askSizeKind = (sizeTalk || sizeAdvice) && !shoeTalk && !clothingTalk && !measurements && !letterSize && shoeNumber === null && !footLengthCm;
        const wantsProducts = hasCatalogCriteria ||
            (!!budget && (productRequest || !!gender || colors.length > 0 || cheap || expensive || a.tokens.length <= 4)) ||
            ((!!gender || colors.length > 0 || cheap || expensive) && productRequest) ||
            (productRequest && hasAny(a, GENERIC_PRODUCT_TERMS));

        const queryWords = a.folded.split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3 && QUERY_STOPWORDS.indexOf(w) < 0 && !/^\d+$/.test(w); });

        return {
            types: types, groups: groups, dressShirt: typeInfo.dressShirt, shoeTalk: shoeTalk, clothingTalk: clothingTalk,
            gender: gender, kids: kids, sale: sale, cheap: cheap, expensive: expensive, colors: colors, materials: materials,
            sizeTalk: sizeTalk, sizeAdvice: sizeAdvice, productRequest: productRequest, strongRequest: strongRequest,
            fit: fit, height: height, weight: weight, shoeNumber: shoeNumber, footLengthCm: footLengthCm,
            letterSize: letterSize, bareNumbers: bareNumbers, measurements: measurements, hasCatalogCriteria: hasCatalogCriteria,
            wantsShoeSize: wantsShoeSize, wantsClothingSize: wantsClothingSize, askSizeKind: askSizeKind, wantsProducts: wantsProducts,
            shipping: hasAny(a, SHIPPING_TERMS), returns: hasAny(a, RETURN_TERMS),
            greeting: hasAny(a, GREETING_TERMS), thanks: hasAny(a, THANKS_TERMS),
            budget: budget || null, queryWords: queryWords
        };
    }

    /* =========================================================
       DỮ LIỆU SẢN PHẨM: loại, đối tượng, giá, tồn kho
       ========================================================= */

    function productDepartment(id, item) {
        try {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.inferDepartment === "function") {
                return window.StyleHubProductAdmin.inferDepartment(id, item);
            }
        } catch (e) {}
        const key = String(id || "").toLowerCase();
        if (key.startsWith("womens")) return "womens";
        if (key.startsWith("kids")) return "kids";
        if (key.startsWith("shoe")) return "shoes";
        if (key.startsWith("sale")) return "sale";
        return "mens";
    }

    function productAudience(id, item, dept, name) {
        if (dept === "kids" || /^kids\b/.test(name) || String(id).toLowerCase().startsWith("kids")) return "kids";
        if (dept === "womens" || /\bwomens?\b/.test(name)) return "female";
        if (dept === "shoes" || String(id).toLowerCase().startsWith("shoe")) return "unisex";
        return "male";
    }

    function productPrice(item) {
        const n = Number(item && item.priceNum);
        if (Number.isFinite(n) && n > 0) return n;
        const parsed = parseInt(String((item && item.price) || "").replace(/[^0-9]/g, ""), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function isProductInStock(id, item) {
        try {
            if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.getAdminStockInfo === "function") {
                return window.StyleHubProductAdmin.getAdminStockInfo(id).status !== "out";
            }
        } catch (e) {}
        if (!item) return false;
        if (item.outOfStock) return false;
        return item.stock === undefined || Number(item.stock) > 0;
    }

    function isSaleProduct(id, item, name) {
        return String(id).toLowerCase().startsWith("sale") || /\(sale\)|\bsale\b/.test(name) || !!getOldPrice(item || {});
    }

    function describeProduct(id, item, order) {
        const name = normalize(item.name || "");
        const dept = productDepartment(id, item);
        const types = new Set();
        Object.keys(PRODUCT_TYPE_TESTS).forEach(function (key) { if (PRODUCT_TYPE_TESTS[key](name)) types.add(key); });
        const groups = new Set();
        types.forEach(function (t) { groups.add(TYPE_GROUP[t]); });
        if (dept === "shoes" || String(id).toLowerCase().startsWith("shoe")) groups.add("shoes");
        return {
            id: id,
            item: item,
            order: order,
            name: name,
            words: new Set(normalize([item.name, item.brand].filter(Boolean).join(" ")).split(/[^a-z0-9]+/).filter(Boolean)),
            dept: dept,
            types: types,
            groups: groups,
            primaryType: types.size ? Array.from(types)[0] : (groups.size ? Array.from(groups)[0] : "other"),
            primaryGroup: groups.size ? Array.from(groups)[0] : "other",
            audience: productAudience(id, item, dept, name),
            price: productPrice(item),
            sale: isSaleProduct(id, item, name),
            inStock: isProductInStock(id, item)
        };
    }

    function criteriaTypeMatch(p, c) {
        if (c.types && c.types.size) return Array.from(c.types).some(function (t) { return p.types.has(t); });
        if (c.groups && c.groups.size) return Array.from(c.groups).some(function (g) { return p.groups.has(g); });
        return true;
    }

    function criteriaAudienceMatch(p, c) {
        if (c.kids) return p.audience === "kids";
        if (p.audience === "kids") return false;
        if (c.gender === "female") return p.audience === "female" || p.audience === "unisex";
        if (c.gender === "male") return p.audience === "male" || p.audience === "unisex";
        return true;
    }

    function criteriaBudgetMatch(p, c) {
        if (!c.budget) return true;
        if (!p.price) return false;
        if (c.budget.min !== null && c.budget.min !== undefined && p.price < c.budget.min) return false;
        if (c.budget.max !== null && c.budget.max !== undefined && p.price > c.budget.max) return false;
        return true;
    }

    function colorMatch(p, c) {
        return !!(c.colors && c.colors.length && c.colors.some(function (def) { return def.test.test(p.name); }));
    }

    function rankProducts(list, c) {
        const scored = list.map(function (p) {
            let score = 0;
            if (colorMatch(p, c)) score += 5;
            if (c.materials && c.materials.some(function (def) { return def.test.test(p.name); })) score += 4;
            if (c.dressShirt && /\b(dress shirt|executive shirt|non-iron|tailored)\b/.test(p.name)) score += 2;
            (c.words || []).forEach(function (w) { if (p.words.has(w)) score += 1; });
            return { p: p, score: score };
        });
        scored.sort(function (x, y) {
            if (y.score !== x.score) return y.score - x.score;
            if (c.sort === "asc" && x.p.price !== y.p.price) return x.p.price - y.p.price;
            if (c.sort === "desc" && x.p.price !== y.p.price) return y.p.price - x.p.price;
            return x.p.order - y.p.order;
        });
        return scored.map(function (s) { return s.p; });
    }

    // Khi khách không nói rõ loại đồ, tránh trả về 4 sản phẩm cùng một kiểu:
    // ưu tiên khác nhóm (áo / quần / giày), rồi khác kiểu (tee / hoodie / ...).
    function diversify(list, limit, enabled) {
        if (!enabled) return list.slice(0, limit);
        const picked = [];
        const seenGroups = new Set();
        const seenTypes = new Set();
        list.forEach(function (p) {
            if (picked.length >= limit || seenGroups.has(p.primaryGroup)) return;
            seenGroups.add(p.primaryGroup);
            seenTypes.add(p.primaryType);
            picked.push(p);
        });
        list.forEach(function (p) {
            if (picked.length >= limit || picked.indexOf(p) >= 0 || seenTypes.has(p.primaryType)) return;
            seenTypes.add(p.primaryType);
            picked.push(p);
        });
        list.forEach(function (p) {
            if (picked.length >= limit || picked.indexOf(p) >= 0) return;
            picked.push(p);
        });
        return picked;
    }

    function searchProducts(criteria, options) {
        const c = criteria || {};
        const limit = (options && options.limit) || CONFIG.resultLimit;
        const db = getDB();
        const all = Object.keys(db).map(function (id, order) {
            const item = db[id];
            return item && typeof item === "object" && (item.name || getImage(item)) ? describeProduct(id, item, order) : null;
        }).filter(Boolean);

        const inStock = all.filter(function (p) { return p.inStock; });
        const typeMatched = inStock.filter(function (p) { return criteriaTypeMatch(p, c) && (!c.sale || p.sale); });
        const audienceMatched = typeMatched.filter(function (p) { return criteriaAudienceMatch(p, c); });
        const matches = audienceMatched.filter(function (p) { return criteriaBudgetMatch(p, c); });

        const ranked = rankProducts(matches, c);
        const noSpecificType = !(c.types && c.types.size);
        const top = diversify(ranked, limit, noSpecificType);

        let alternatives = [];
        if (!matches.length && c.budget && audienceMatched.length) {
            // Gần ngân sách nhất — sẽ được ghi rõ là NGOÀI khoảng giá khách yêu cầu.
            const target = c.budget.max !== null && c.budget.max !== undefined ? c.budget.max : c.budget.min;
            alternatives = audienceMatched.slice().sort(function (x, y) {
                return Math.abs(x.price - target) - Math.abs(y.price - target) || x.order - y.order;
            }).slice(0, 3);
        }

        let kidsAvailable = 0;
        if (!c.kids) {
            kidsAvailable = typeMatched.filter(function (p) { return p.audience === "kids" && criteriaBudgetMatch(p, c); }).length;
        }

        return {
            matches: top,
            totalMatches: matches.length,
            alternatives: alternatives,
            typeAvailable: inStock.some(function (p) { return criteriaTypeMatch(p, c); }),
            kidsAvailable: kidsAvailable,
            colorMatches: top.filter(function (p) { return colorMatch(p, c); }).length
        };
    }

    function describeCriteria(c, options) {
        const withBudget = !options || options.budget !== false;
        let label;
        if (c.types && c.types.size) label = Array.from(c.types).map(function (t) { return TYPE_LABELS[t] || t; }).join(" / ");
        else if (c.groups && c.groups.size) label = Array.from(c.groups).map(function (g) { return GROUP_LABELS[g] || g; }).join(" / ");
        else label = "sản phẩm";
        if (c.kids) label += " trẻ em";
        else if (c.gender === "female") label += " nữ";
        else if (c.gender === "male") label += " nam";
        if (c.sale) label += " đang sale";
        if (withBudget && c.budget) label += " " + c.budget.label;
        return label;
    }

    function productCards(list, options) {
        const flag = options && options.flag ? `<span class="tsh-ai-product-flag">${escapeHTML(options.flag)}</span>` : "";
        return `<div class="tsh-ai-product-list">` + list.map(function (entry) {
            const id = entry.id;
            const item = entry.item || {};
            const oldPrice = getOldPrice(item);
            const img = safeImageUrl(getImage(item));
            return `
                <div class="tsh-ai-product-card">
                    <img src="${escapeHTML(img)}" alt="${escapeHTML(item.name)}">
                    <div>
                        <a class="tsh-ai-product-name" href="product-detail.html?id=${encodeURIComponent(id)}">${escapeHTML(item.name)}</a>
                        <span class="tsh-ai-product-price">${escapeHTML(item.price || (productPrice(item) ? formatVND(productPrice(item)) : ""))}</span>
                        ${oldPrice ? `<span class="tsh-ai-product-old">${escapeHTML(oldPrice)}</span>` : ""}
                        ${flag}
                    </div>
                    <button class="tsh-ai-product-cart" type="button" data-product-id="${escapeHTML(id)}" title="Thêm vào BAG">🛒</button>
                </div>
            `;
        }).join("") + `</div>`;
    }

    /* =========================================================
       TƯ VẤN SIZE
       ========================================================= */

    function clothingSize(weight, gender, fit) {
        const list = CLOTHING_SIZE[gender] || CLOTHING_SIZE.male;
        let row = list.find(r => weight >= r.minW && weight <= r.maxW) || (weight < list[0].minW ? list[0] : list[list.length - 1]);

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

    // Không còn ép size về tối đa 36: dùng đúng dãy size EU shop đang bán.
    function shoeNumberSize(size, gender, fit) {
        const g = gender === "female" ? "female" : "male";
        const sold = SHOE_SIZES[g];
        const base = Math.round(Number(size));
        const result = fit === "loose" ? base + 1 : base;
        return {
            size: result,
            base: base,
            gender: g,
            available: sold.indexOf(result) >= 0,
            sold: sold.slice(),
            min: sold[0],
            max: sold[sold.length - 1]
        };
    }

    function genderLabel(g) {
        return g === "female" ? "nữ" : "nam";
    }

    function shoeAdviceHtml(shoe, advice) {
        const fitText = shoe.fit === "loose" ? "mang rộng / thoải mái" : "mang vừa chân";
        const range = `${advice.min}–${advice.max}`;
        let from = `bạn đang mang size ${advice.base}`;
        if (shoe.footLengthCm) from = `chiều dài bàn chân ${String(shoe.footLengthCm).replace(".", ",")}cm tương ứng khoảng size EU ${advice.base} (ước tính)`;
        let html = "";
        if (shoe.roundedFrom) html += `Shop chỉ có size nguyên nên mình làm tròn ${String(shoe.roundedFrom).replace(".", ",")} thành ${advice.base}. `;
        if (advice.available) {
            html += `Theo bảng size giày ${genderLabel(advice.gender)} của shop (EU ${range}), ${from} và muốn ${fitText} thì nên chọn <strong>size ${advice.size}</strong>.`;
            html += ` Nếu chân bè hoặc thích đi tất dày, có thể cân nhắc tăng thêm 1 size.`;
            return html;
        }
        html += `Với ${from} và muốn ${fitText}, bạn cần khoảng <strong>size ${advice.size}</strong>, nhưng shop hiện chỉ bán giày ${genderLabel(advice.gender)} size EU ${range} nên <strong>chưa có size ${advice.size}</strong>.`;
        if (advice.base !== advice.size && advice.sold.indexOf(advice.base) >= 0) {
            html += ` Nếu chấp nhận mang vừa khít, size ${advice.base} vẫn có sẵn.`;
        }
        html += ` Bạn có thể nhắn "gặp nhân viên" để shop kiểm tra thêm giúp bạn.`;
        return html;
    }

    function shoeFlowStep(ctx, ent) {
        const shoe = ctx.shoe;
        ctx.flow = "shoe";
        if (ent.gender) shoe.gender = ent.gender;

        let number = ent.shoeNumber;
        // "42" trả lời câu hỏi size, hoặc "size giày nữ 43 vừa" trong cùng một câu
        if (number === null && ent.bareNumbers.length && (ctx.awaiting === "shoeSize" || ent.wantsShoeSize)) number = ent.bareNumbers[0];

        if (ent.footLengthCm) {
            shoe.size = footLengthToEU(ent.footLengthCm);
            shoe.footLengthCm = ent.footLengthCm;
            shoe.roundedFrom = null;
        } else if (number !== null && number !== undefined) {
            if (number >= 30 && number <= 50) {
                shoe.size = Math.round(number);
                shoe.footLengthCm = null;
                shoe.roundedFrom = number % 1 !== 0 ? number : null;
            } else {
                ctx.awaiting = "shoeSize";
                return {
                    kind: "shoe-size",
                    html: `Size ${escapeHTML(String(number))} không thuộc hệ size EU mà shop đang dùng (giày nam ${SHOE_SIZES.male[0]}–${SHOE_SIZES.male[SHOE_SIZES.male.length - 1]}, giày nữ ${SHOE_SIZES.female[0]}–${SHOE_SIZES.female[SHOE_SIZES.female.length - 1]}). Bạn cho mình size giày EU bạn đang mang (ví dụ: 42) hoặc chiều dài bàn chân (ví dụ: chân dài 26cm) nhé.`
                };
            }
        }
        if (ent.fit) shoe.fit = ent.fit;

        if (!shoe.gender) {
            ctx.awaiting = "gender";
            return { kind: "shoe-size", html: "Bạn muốn chọn size giày nam hay nữ?" };
        }
        if (!shoe.size) {
            ctx.awaiting = "shoeSize";
            return { kind: "shoe-size", html: "Bạn đang mang giày size EU số mấy? Ví dụ: 42. Nếu chưa rõ, bạn nhập chiều dài bàn chân, ví dụ: chân dài 26cm." };
        }
        if (!shoe.fit) {
            ctx.awaiting = "fit";
            return { kind: "shoe-size", html: `Bạn đang mang size ${shoe.size}. Bạn muốn mang vừa chân hay rộng/thoải mái hơn?` };
        }

        ctx.awaiting = null;
        const advice = shoeNumberSize(shoe.size, shoe.gender, shoe.fit);
        shoe.recommended = advice.available ? advice.size : null;
        return { kind: "shoe-size", html: shoeAdviceHtml(shoe, advice), shoeAdvice: advice };
    }

    function clothingFlowStep(ctx, ent) {
        const c = ctx.clothing;
        ctx.flow = "clothing";
        if (ent.gender) c.gender = ent.gender;
        if (ent.kids) c.kids = true;

        let height = ent.height;
        let weight = ent.weight;
        if (ctx.awaiting === "measurements" && (!height || !weight)) {
            ent.bareNumbers.forEach(function (n) {
                if (!height && n >= 120 && n <= 220 && n !== weight) { height = n; return; }
                if (!weight && n >= 25 && n <= 160 && n !== height) weight = n;
            });
        }
        if (height && (height < 120 || height > 220)) height = null;
        if (weight && (weight < 25 || weight > 160)) weight = null;
        if (height) c.height = height;
        if (weight) c.weight = weight;
        if (ent.fit) c.fit = ent.fit;

        if (c.kids) {
            ctx.awaiting = null;
            return {
                kind: "clothing-size",
                html: `Đồ trẻ em của shop có size ${KIDS_CLOTHING_SIZES.join(", ")}. Hiện mình chưa có bảng size trẻ em chi tiết theo chiều cao/cân nặng, bạn nhắn "gặp nhân viên" để shop tư vấn chính xác cho bé nhé.`
            };
        }
        if (!c.height || !c.weight) {
            ctx.awaiting = "measurements";
            let ask = "Bạn cho mình chiều cao và cân nặng hiện tại nhé. Ví dụ: 1m70 65kg.";
            if (c.height && !c.weight) ask = `Bạn cao khoảng ${c.height}cm. Bạn nặng khoảng bao nhiêu kg? Ví dụ: 65kg.`;
            if (!c.height && c.weight) ask = `Bạn nặng khoảng ${c.weight}kg. Bạn cao khoảng bao nhiêu? Ví dụ: 1m70 hoặc 170cm.`;
            if (ent.gender) ask = `Mình sẽ tính theo bảng size ${genderLabel(ent.gender)}. ` + ask;
            return { kind: "clothing-size", html: ask };
        }
        if (!c.fit) {
            ctx.awaiting = "fit";
            return { kind: "clothing-size", html: "Bạn thích mặc vừa vặn hay rộng rãi/thoải mái hơn?" };
        }

        ctx.awaiting = null;
        const result = smartClothingSize(c.weight, c.height, c.gender, c.fit);
        const row = result.row;
        const genderText = c.gender === "female" ? "nữ" : (c.gender === "male" ? "nam" : "unisex");
        const fitText = c.fit === "loose" ? "rộng rãi/thoải mái" : "vừa vặn";
        let html = `Với chiều cao khoảng ${c.height}cm và cân nặng khoảng ${c.weight}kg (bảng size ${genderText}), nếu bạn thích mặc ${fitText} thì mình gợi ý chọn <strong>size ${row.size}</strong>. Size này hợp khoảng chiều cao ${row.height}.${result.note}`;
        if (ADULT_CLOTHING_SIZES.indexOf(row.size) >= 0) {
            c.recommended = row.size;
        } else {
            const nearest = row.size === "XS" ? ADULT_CLOTHING_SIZES[0] : ADULT_CLOTHING_SIZES[ADULT_CLOTHING_SIZES.length - 1];
            c.recommended = nearest;
            html += ` <span class="tsh-ai-support-note is-warning">Lưu ý: shop hiện chỉ có size ${ADULT_CLOTHING_SIZES[0]}–${ADULT_CLOTHING_SIZES[ADULT_CLOTHING_SIZES.length - 1]} cho đồ người lớn nên chưa có size ${row.size}. Size gần nhất là ${nearest} (có thể ${row.size === "XS" ? "hơi rộng" : "hơi ôm"}).</span>`;
        }
        return { kind: "clothing-size", html: html, clothingSize: row.size };
    }

    function continueFlow(ctx, ent) {
        if (ent.shipping || ent.returns) return null;
        if (ctx.awaiting === "sizeKind") {
            if (ent.shoeTalk) { ctx.shoe = {}; return shoeFlowStep(ctx, ent); }
            if (ent.clothingTalk || ent.measurements) { ctx.clothing = {}; return clothingFlowStep(ctx, ent); }
            return null;
        }
        // Luồng đã xong (không còn câu hỏi chờ) thì yêu cầu xem sản phẩm luôn được ưu tiên.
        const waiting = !!ctx.awaiting;
        if (ctx.flow === "shoe") {
            if (ent.wantsClothingSize || (ent.clothingTalk && !ent.shoeTalk)) return null;
            if (ent.wantsProducts && !ent.wantsShoeSize && (ent.strongRequest || !waiting || (ent.hasCatalogCriteria && !ent.shoeTalk))) return null;
            const answers = !!(ent.gender || ent.shoeNumber || ent.footLengthCm || ent.fit || ent.wantsShoeSize ||
                (ctx.awaiting === "shoeSize" && ent.bareNumbers.length));
            return answers ? shoeFlowStep(ctx, ent) : null;
        }
        if (ctx.flow === "clothing") {
            if (ent.wantsShoeSize || ent.shoeTalk) return null;
            if (ent.wantsProducts && !ent.wantsClothingSize && (ent.strongRequest || !waiting || ent.hasCatalogCriteria)) return null;
            const answers = !!(ent.gender || ent.height || ent.weight || ent.fit || ent.wantsClothingSize ||
                (ctx.awaiting === "measurements" && ent.bareNumbers.length));
            return answers ? clothingFlowStep(ctx, ent) : null;
        }
        return null;
    }

    /* =========================================================
       CHÍNH SÁCH (lấy từ shipping-policy.html / exchange-warranty-policy.html)
       ========================================================= */

    function shippingPolicyHtml() {
        return `<strong class="tsh-shop-name">Chính sách giao hàng</strong>` +
            `• Giao hàng toàn quốc cho đơn đặt qua website. Đơn được xử lý trong vòng 24 giờ sau khi xác nhận (đơn ngoài giờ làm việc xử lý vào ngày làm việc tiếp theo).<br>` +
            `• Thời gian giao dự kiến: nội thành TP. Hồ Chí Minh 1–2 ngày làm việc; các tỉnh/thành phố lớn 2–4 ngày; huyện, xã hoặc vùng xa 4–7 ngày.<br>` +
            `• Phí giao hàng hiển thị khi bạn đặt hàng và có thể thay đổi theo khu vực, khối lượng đơn hoặc chương trình ưu đãi; miễn phí vận chuyển chỉ áp dụng theo điều kiện của từng chương trình.<br>` +
            `• Khi nhận hàng, bạn kiểm tra bao bì và sản phẩm; nếu móp méo, rách, giao sai mẫu hoặc thiếu sản phẩm, liên hệ ngay hotline ${SUPPORT_HOTLINE} hoặc ${SUPPORT_EMAIL} (9:00–18:00, Thứ Hai – Chủ Nhật).` +
            `<span class="tsh-ai-support-note">Xem chi tiết: <a class="tsh-ai-link" href="shipping-policy.html">Chính sách giao hàng</a></span>`;
    }

    function returnPolicyHtml() {
        return `<strong class="tsh-shop-name">Chính sách đổi hàng &amp; bảo hành</strong>` +
            `• Đổi hàng trong vòng 15 ngày kể từ ngày mua tại cửa hàng hoặc ngày nhận hàng (đơn online). Sản phẩm cần còn hóa đơn, nguyên nhãn mác, không bẩn/hư hỏng do tác nhân bên ngoài.<br>` +
            `• Miễn phí đổi khi lỗi nhà sản xuất, giao nhầm hoặc hư hỏng khi vận chuyển. Đổi theo nhu cầu (không vừa size, màu, không thích mẫu): bạn chịu phí ship một chiều về kho, shop chịu phí gửi sản phẩm mới — chỉ áp dụng đơn online.<br>` +
            `• Bảo hành lỗi kỹ thuật (màu sắc, chất liệu, kiểu dáng, bung keo) hoặc sản phẩm không giống mô tả: phản hồi trong 15 ngày. Tiền hoàn được tính sau khi trừ khuyến mãi và voucher.<br>` +
            `• Cách gửi yêu cầu: liên hệ hotline ${SUPPORT_HOTLINE}, fanpage hoặc trang Contact, cung cấp mã đơn, hình ảnh sản phẩm và lý do đổi/bảo hành.` +
            `<span class="tsh-ai-support-note">Xem chi tiết: <a class="tsh-ai-link" href="exchange-warranty-policy.html">Chính sách đổi hàng &amp; bảo hành</a>. Nếu bạn muốn shop xử lý đơn cụ thể, hãy gửi mã đơn (ví dụ: STH123456) hoặc nhắn "gặp nhân viên".</span>`;
    }

    /* =========================================================
       TRẢ LỜI GỢI Ý SẢN PHẨM
       ========================================================= */

    function productReply(ctx, ent) {
        const criteria = {
            types: ent.types, groups: ent.groups, gender: ent.gender, kids: ent.kids, sale: ent.sale, budget: ent.budget,
            colors: ent.colors, materials: ent.materials || [], sort: ent.cheap ? "asc" : (ent.expensive ? "desc" : null), words: ent.queryWords, dressShirt: ent.dressShirt
        };
        const res = searchProducts(criteria, { limit: CONFIG.resultLimit });
        ctx.lastProducts = res.matches.map(function (p) { return p.id; });
        const notes = [];

        if (ent.letterSize) {
            const soldLetters = ent.kids ? KIDS_CLOTHING_SIZES : ADULT_CLOTHING_SIZES;
            notes.push(soldLetters.indexOf(ent.letterSize) >= 0
                ? `Các mẫu ${ent.kids ? "trẻ em" : "người lớn"} đều có size ${soldLetters.join(", ")} — có size ${ent.letterSize}.`
                : `Lưu ý: đồ ${ent.kids ? "trẻ em" : "người lớn"} của shop chỉ có size ${soldLetters.join(", ")}, chưa có size ${ent.letterSize}.`);
        }
        if (ent.shoeNumber && (ent.shoeTalk || res.matches.some(function (p) { return p.groups.has("shoes"); }))) {
            const n = Math.round(ent.shoeNumber);
            const male = SHOE_SIZES.male.indexOf(n) >= 0;
            const female = SHOE_SIZES.female.indexOf(n) >= 0;
            if (ent.gender) {
                const ok = ent.gender === "female" ? female : male;
                const range = ent.gender === "female" ? "EU 37–42" : "EU 37–44";
                notes.push(ok
                    ? `Size ${n} có sẵn cho giày ${genderLabel(ent.gender)} (${range}).`
                    : `Lưu ý: shop chưa có giày ${genderLabel(ent.gender)} size ${n} (chỉ có ${range}).`);
            } else {
                notes.push(male || female
                    ? `Size ${n} có sẵn cho giày ${male && female ? "nam và nữ" : (male ? "nam" : "nữ")} (nam EU 37–44, nữ EU 37–42).`
                    : `Lưu ý: shop chưa có giày size ${n} (nam EU 37–44, nữ EU 37–42).`);
            }
        }

        if (res.matches.length) {
            const desc = describeCriteria(criteria);
            let html = `Dưới đây là ${res.matches.length} mẫu ${escapeHTML(desc)} còn hàng trong THE STYLE HUB`;
            html += res.totalMatches > res.matches.length ? ` (có ${res.totalMatches} mẫu phù hợp, mình chọn ${res.matches.length} mẫu tiêu biểu):` : ":";
            if (criteria.colors.length) {
                const colorText = criteria.colors.map(function (d) { return d.label; }).join(" / ");
                html += res.colorMatches
                    ? ` <span class="tsh-ai-muted">Ưu tiên màu ${escapeHTML(colorText)}.</span>`
                    : ` <span class="tsh-ai-muted">Chưa có mẫu đúng màu ${escapeHTML(colorText)} trong nhóm này — đây là các mẫu gần nhất.</span>`;
            }
            if (criteria.materials.length) {
                const materialText = criteria.materials.map(function (d) { return d.label; }).join(" / ");
                const hit = res.matches.some(function (p) { return criteria.materials.some(function (d) { return d.test.test(p.name); }); });
                html += hit
                    ? ` <span class="tsh-ai-muted">Ưu tiên chất liệu ${escapeHTML(materialText)}.</span>`
                    : ` <span class="tsh-ai-muted">Chưa có mẫu chất liệu ${escapeHTML(materialText)} trong nhóm này — đây là các mẫu gần nhất.</span>`;
            }
            notes.forEach(function (n) { html += ` <span class="tsh-ai-muted">${escapeHTML(n)}</span>`; });
            return { kind: "products", html: html + productCards(res.matches), products: res.matches.map(function (p) { return p.id; }), alternatives: [], criteria: criteria };
        }

        // Không có sản phẩm thỏa TẤT CẢ điều kiện → nói rõ, không đưa hàng sai điều kiện như thể là phù hợp.
        let html;
        if (!res.typeAvailable) {
            html = `Hiện THE STYLE HUB chưa có ${escapeHTML(describeCriteria(criteria, { budget: false }))} nào còn hàng.`;
            if (criteria.types.has("dress")) html += ` Shop đang bán áo, quần và giày${criteria.gender === "female" ? " nữ" : ""} — bạn muốn mình gợi ý nhóm nào?`;
        } else if (criteria.budget) {
            html = `Hiện shop chưa có ${escapeHTML(describeCriteria(criteria, { budget: false }))} nào ${escapeHTML(criteria.budget.label)} (còn hàng).`;
        } else {
            html = `Hiện shop chưa có ${escapeHTML(describeCriteria(criteria))} nào còn hàng.`;
        }
        if (res.kidsAvailable && !criteria.kids) {
            html += ` <span class="tsh-ai-muted">Có ${res.kidsAvailable} mẫu dành cho trẻ em đáp ứng điều kiện này — nhắn thêm "trẻ em" nếu bạn muốn xem.</span>`;
        }
        notes.forEach(function (n) { html += ` <span class="tsh-ai-muted">${escapeHTML(n)}</span>`; });
        if (res.alternatives.length) {
            html += `<span class="tsh-ai-alt-heading">Các mẫu ${escapeHTML(describeCriteria(criteria, { budget: false }))} có giá gần ngân sách nhất (NGOÀI khoảng giá bạn đặt):</span>`;
            html += productCards(res.alternatives, { flag: "Ngoài ngân sách" });
        }
        return { kind: "no-match", html: html, products: [], alternatives: res.alternatives.map(function (p) { return p.id; }), criteria: criteria };
    }

    /* =========================================================
       ĐIỀU PHỐI HỘI THOẠI
       ========================================================= */

    const GREETING_REPLY = "Chào bạn! Mình là Stylist AI của THE STYLE HUB. Bạn muốn xem áo, quần, giày, dress shirt hay cần tư vấn size?";
    const FALLBACK_REPLY = "Bạn muốn mình hỗ trợ gì? Mình có thể tư vấn size, gợi ý áo nam/nữ, hoodie, dress shirt, giày, sản phẩm sale (kể cả theo ngân sách, ví dụ: \"áo thun nam dưới 3 triệu\") hoặc giải đáp chính sách giao hàng / đổi trả.";

    function computeReply(text, ctx) {
        const original = analyzeText(text);
        const budget = parseBudget(original.folded);
        const a = budget && budget.spans.length ? analyzeText(blankSpans(original.raw, budget.spans, original.folded.length)) : original;
        a.text = original.text;
        const ent = extractEntities(a, ctx, budget);

        const flowReply = (ctx.flow || ctx.awaiting) ? continueFlow(ctx, ent) : null;
        if (flowReply) return flowReply;

        // Hỏi xen chính sách / cảm ơn / chào: GIỮ câu hỏi size đang chờ để khách trả lời tiếp ("42").
        if (ent.shipping) return { kind: "shipping", html: shippingPolicyHtml() };
        if (ent.returns) return { kind: "returns", html: returnPolicyHtml() };

        if (ent.wantsShoeSize) {
            ctx.shoe = {};
            ctx.awaiting = null;
            return shoeFlowStep(ctx, ent);
        }
        if (ent.wantsClothingSize) {
            ctx.clothing = {};
            ctx.awaiting = null;
            return clothingFlowStep(ctx, ent);
        }
        if (ent.askSizeKind) {
            ctx.flow = null;
            ctx.awaiting = "sizeKind";
            return { kind: "size-kind", html: "Bạn cần tư vấn size giày hay size quần áo?" };
        }
        if (ent.wantsProducts) {
            ctx.flow = null;
            ctx.awaiting = null;
            return productReply(ctx, ent);
        }
        if (ent.letterSize) {
            const sold = ADULT_CLOTHING_SIZES.indexOf(ent.letterSize) >= 0;
            return {
                kind: "size-info",
                html: (sold ? `Quần áo người lớn của shop có size ${ADULT_CLOTHING_SIZES.join(", ")} — có size ${escapeHTML(ent.letterSize)}.` : `Quần áo người lớn của shop chỉ có size ${ADULT_CLOTHING_SIZES.join(", ")}, chưa có size ${escapeHTML(ent.letterSize)}.`) +
                    ` Đồ trẻ em có size ${KIDS_CLOTHING_SIZES.join(", ")}. Bạn muốn xem áo, quần hay cần tư vấn chọn size theo chiều cao/cân nặng?`
            };
        }
        if (ent.thanks) return { kind: "thanks", html: "Không có gì ạ! Bạn cần thêm gợi ý sản phẩm, tư vấn size hay thông tin giao hàng/đổi trả thì cứ nhắn mình nhé." };
        if (ent.greeting) return { kind: "greeting", html: GREETING_REPLY };
        return { kind: "fallback", html: FALLBACK_REPLY };
    }

    function respond(text) {
        const ctx = loadContext();
        const result = computeReply(text, ctx);
        const ent = analyzeText(text);
        if (result.kind !== "greeting" && hasAny(ent, GREETING_TERMS) && ent.tokens.length > 1) {
            result.html = "Chào bạn! " + result.html;
        }
        saveContext(ctx);
        result.products = result.products || [];
        result.alternatives = result.alternatives || [];
        return result;
    }

    function buildReply(text) {
        return respond(text).html;
    }

    /* =========================================================
       HỖ TRỢ: gửi tin cho shop (Firebase) — phân biệt đã gửi / đang chờ / chỉ lưu máy
       ========================================================= */

    function loadExternalScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            const timer = setTimeout(function () { reject(new Error("Hết thời gian tải " + src)); }, CONFIG.scriptLoadTimeoutMs);
            script.onload = function () { clearTimeout(timer); resolve(); };
            script.onerror = function () { clearTimeout(timer); reject(new Error("Không tải được " + src)); };
            document.head.appendChild(script);
        });
    }

    function hasFirebaseConfig() {
        return !!(STYLEHUB_FIREBASE_CONFIG && STYLEHUB_FIREBASE_CONFIG.apiKey && STYLEHUB_FIREBASE_CONFIG.databaseURL);
    }

    let supportDbState = "unknown"; // unknown | loading | ready | unconfigured | unavailable

    function getSupportDb() {
        if (supportDbPromise && supportDbState !== "unavailable") return supportDbPromise;
        supportDbState = "loading";
        supportDbPromise = (async function () {
            if (!hasFirebaseConfig()) {
                supportDbState = "unconfigured";
                return null;
            }
            try {
                if (typeof firebase === "undefined") {
                    await loadExternalScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
                    await loadExternalScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js");
                } else if (typeof firebase.database !== "function") {
                    await loadExternalScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js");
                }
                if (typeof firebase === "undefined" || typeof firebase.database !== "function") throw new Error("Firebase SDK chưa sẵn sàng");
                if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(STYLEHUB_FIREBASE_CONFIG);
                const db = firebase.database();
                supportDbState = "ready";
                return db;
            } catch (error) {
                console.warn("THE STYLE HUB support chat đang dùng local fallback:", error);
                supportDbState = "unavailable"; // lần sau sẽ thử kết nối lại
                return null;
            }
        })();
        return supportDbPromise;
    }

    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            const timer = setTimeout(function () {
                const error = new Error("Hết thời gian chờ máy chủ phản hồi");
                error.code = "timeout";
                reject(error);
            }, ms);
            Promise.resolve(promise).then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
        });
    }

    function isPermissionDenied(error) {
        return !!error && (String(error.code || "").toUpperCase().indexOf("PERMISSION_DENIED") >= 0 || /permission[_ ]denied/i.test(String(error.message || "")));
    }

    let supportConversationIdMemory = null;
    function getSupportConversationId() {
        let id = null;
        try { id = localStorage.getItem(SUPPORT_CONVERSATION_KEY); } catch (e) {}
        if (!id) id = supportConversationIdMemory;
        if (!id) {
            id = "support_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            safeSetItem(SUPPORT_CONVERSATION_KEY, id);
        }
        supportConversationIdMemory = id;
        return id;
    }

    function readSupportLocal() {
        const map = safeGetJSON(SUPPORT_LOCAL_KEY, {});
        return map && typeof map === "object" && !Array.isArray(map) ? map : {};
    }

    function stripSupportImages(map, keepLatest) {
        const copy = JSON.parse(JSON.stringify(map || {}));
        const withImages = [];
        Object.keys(copy).forEach(function (cid) {
            const messages = (copy[cid] && copy[cid].messages) || {};
            Object.keys(messages).forEach(function (mid) {
                if (messages[mid] && messages[mid].imageData) withImages.push(messages[mid]);
            });
        });
        withImages.sort(function (x, y) { return Number(y.createdAt || 0) - Number(x.createdAt || 0); });
        withImages.slice(keepLatest).forEach(function (msg) {
            delete msg.imageData;
            msg.imageRemoved = true;
        });
        return copy;
    }

    // Trả về true/false thay vì ném QuotaExceededError.
    function writeSupportLocal(map, keepConversationId) {
        let data = map || {};
        const attempt = function () {
            const json = JSON.stringify(data);
            if (!safeSetItem(SUPPORT_LOCAL_KEY, json)) return false;
            try { window.dispatchEvent(new StorageEvent("storage", { key: SUPPORT_LOCAL_KEY, newValue: json })); } catch (e) {}
            return true;
        };
        if (attempt()) return true;
        data = stripSupportImages(data, 1);
        if (attempt()) return true;
        data = stripSupportImages(data, 0);
        if (attempt()) return true;
        const ids = Object.keys(data).filter(function (id) { return id !== keepConversationId; }).sort(function (x, y) {
            return Number((data[x] || {}).updatedAt || 0) - Number((data[y] || {}).updatedAt || 0);
        });
        while (ids.length) {
            delete data[ids.shift()];
            if (attempt()) return true;
        }
        return false;
    }

    function getSupportCustomerInfo() {
        function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
        const name = read("hub_name") || read("customer_name") || read("checkout_name") || "Khách vãng lai";
        const email = read("hub_email") || read("customer_email") || read("checkout_email") || "";
        const phone = read("hub_phone") || read("customer_phone") || read("checkout_phone") || "";
        return { name: String(name || "Khách vãng lai"), email: String(email || ""), phone: String(phone || "") };
    }

    function supportMessageType(text, attachment) {
        const a = analyzeText(text);
        if (attachment && attachment.dataUrl) return "Hình ảnh hỗ trợ";
        if (hasAny(a, ["khiếu nại", "phàn nàn", "không hài lòng", "complain", "complaint"])) return "Khiếu nại";
        if (hasAny(a, ["số lượng lớn", "đặt nhiều", "mua nhiều", "mua sỉ", "giá sỉ", "bulk"])) return "Đặt số lượng lớn";
        if (hasAny(a, ["ý kiến", "góp ý", "feedback", "đánh giá"])) return "Góp ý sản phẩm";
        if (hasAny(a, ["bảo hành", "đổi trả", "đổi hàng", "hoàn tiền", "trả hàng", "warranty", "refund", "return"])) return "Đổi trả / bảo hành";
        if (hasAny(a, ["nhân viên", "người thật", "admin", "gặp shop", "tư vấn viên"])) return "Cần nhân viên hỗ trợ";
        return "Yêu cầu hỗ trợ";
    }

    function shouldForwardToSupport(text) {
        const a = analyzeText(text);
        if (!a.tokens.length) return false;
        if (hasAny(a, SUPPORT_TERMS) || hasAny(a, DEFECT_TERMS)) return true;
        if (hasAny(a, RETURN_TERMS)) {
            if (hasOrderReference(a)) return true;     // có mã đơn → cần nhân viên xử lý
            if (isQuestion(a)) return false;           // hỏi chính sách → chatbot trả lời chính sách
            return hasAny(a, DESIRE_TERMS);            // "tôi muốn đổi hàng" → chuyển nhân viên
        }
        return false;
    }

    function supportPreview(message) {
        if (!message) return "";
        if (message.imageData) return message.text ? "📷 " + message.text : "📷 Khách gửi hình ảnh";
        return message.text || "";
    }

    async function pushSupportMessageToServer(db, conversationId, patch, message) {
        const ref = db.ref(SUPPORT_DB_ROOT + "/" + conversationId);
        const createdSnap = await ref.child("createdAt").once("value");
        const safePatch = Object.assign({}, patch);
        if (createdSnap && typeof createdSnap.exists === "function" && createdSnap.exists() && createdSnap.val()) delete safePatch.createdAt;
        await ref.update(safePatch);
        await ref.child("messages/" + message.id).set(message);
    }

    function saveSupportMessageLocally(conversationId, patch, message) {
        const map = readSupportLocal();
        const current = map[conversationId] || { id: conversationId, messages: {} };
        const messages = Object.assign({}, current.messages || {});
        messages[message.id] = message;
        map[conversationId] = Object.assign({}, current, patch, {
            createdAt: current.createdAt || patch.createdAt || Date.now(),
            messages: messages,
            pendingSync: Object.keys(messages).some(function (k) { return messages[k] && messages[k].deliveryStatus === "pending"; })
        });
        return writeSupportLocal(map, conversationId);
    }

    async function saveCustomerSupportMessage(text, attachment) {
        const conversationId = getSupportConversationId();
        const customer = getSupportCustomerInfo();
        const now = Date.now();
        const messageId = "msg_" + now + "_" + Math.random().toString(36).slice(2, 7);
        const hasImage = !!(attachment && isSafeImageDataUrl(attachment.dataUrl));
        const cleanText = String(text || "").trim();
        const type = supportMessageType(cleanText, attachment);
        const displayText = cleanText || (hasImage ? "Khách đã gửi hình ảnh." : "");
        const message = {
            id: messageId,
            from: "customer",
            text: displayText,
            createdAt: now,
            type: type
        };

        if (hasImage) {
            message.imageData = attachment.dataUrl;
            message.imageName = attachment.name || "image.jpg";
            message.imageType = attachment.type || "image/jpeg";
            message.imageSize = attachment.size || 0;
            message.imageWidth = attachment.width || 0;
            message.imageHeight = attachment.height || 0;
        }

        const conversationPatch = {
            id: conversationId,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            type: type,
            status: "open",
            lastMessage: supportPreview(message),
            lastSender: "customer",
            unreadForAdmin: true,
            updatedAt: now,
            createdAt: now
        };

        // sent    = máy chủ (Firebase) đã xác nhận
        // pending = có cấu hình máy chủ nhưng đang mất kết nối/hết thời gian → lưu tạm, sẽ tự gửi lại
        // local   = không có máy chủ / máy chủ từ chối → chỉ lưu trên trình duyệt này, shop CHƯA nhận
        // failed  = không gửi được và cũng không lưu được (bộ nhớ đầy/bị chặn)
        let status = "local";
        const db = await getSupportDb();
        if (db) {
            try {
                await withTimeout(pushSupportMessageToServer(db, conversationId, conversationPatch, message), CONFIG.supportWriteTimeoutMs);
                status = "sent";
            } catch (error) {
                console.warn("THE STYLE HUB: chưa gửi được tin hỗ trợ lên máy chủ:", error);
                status = isPermissionDenied(error) ? "local" : "pending";
            }
        } else if (supportDbState === "unavailable") {
            status = "pending";
        }

        if (status !== "sent") {
            message.deliveryStatus = status;
            if (!saveSupportMessageLocally(conversationId, conversationPatch, message)) status = "failed";
        }
        return { conversationId: conversationId, messageId: messageId, type: type, status: status };
    }

    function supportAckHtml(result) {
        const shortId = escapeHTML(String(result.conversationId || "").replace("support_", "").slice(0, 8).toUpperCase() || "SUPPORT");
        const typeText = escapeHTML(result.type || "Hỗ trợ");
        const contact = `hotline ${SUPPORT_HOTLINE} hoặc email ${SUPPORT_EMAIL}`;
        if (result.status === "sent") {
            return `<strong class="tsh-shop-name">THE STYLE HUB đã nhận được tin nhắn của bạn.</strong>` +
                `Shop sẽ kiểm tra và phản hồi lại ngay tại khung chat này trong thời gian sớm nhất.` +
                `<span class="tsh-ai-support-note">Mã hỗ trợ: ${shortId} · Nhóm yêu cầu: ${typeText} · Trạng thái: Đã gửi tới shop</span>`;
        }
        if (result.status === "pending") {
            return `<strong class="tsh-shop-name">Tin nhắn CHƯA gửi được tới shop.</strong>` +
                `Kết nối tới máy chủ hỗ trợ đang gián đoạn nên mình đã lưu tạm tin nhắn trên trình duyệt này và sẽ tự gửi lại khi có kết nối. Nếu cần gấp, bạn liên hệ ${contact}.` +
                `<span class="tsh-ai-support-note is-warning">Mã hỗ trợ: ${shortId} · Nhóm yêu cầu: ${typeText} · Trạng thái: Đang chờ gửi</span>`;
        }
        if (result.status === "local") {
            return `<strong class="tsh-shop-name">Tin nhắn mới chỉ được lưu trên trình duyệt này.</strong>` +
                `Website hiện không kết nối được máy chủ hỗ trợ nên shop CHƯA nhận được tin nhắn. Bạn vui lòng liên hệ ${contact} để được hỗ trợ.` +
                `<span class="tsh-ai-support-note is-warning">Mã hỗ trợ: ${shortId} · Nhóm yêu cầu: ${typeText} · Trạng thái: Chỉ lưu trên máy</span>`;
        }
        return `<strong class="tsh-shop-name">Không gửi được tin nhắn.</strong>` +
            `Máy chủ hỗ trợ chưa nhận được và trình duyệt cũng không lưu được tin nhắn (bộ nhớ đầy hoặc bị chặn). Bạn vui lòng liên hệ ${contact}.`;
    }

    function loadSeenSupportMessages() {
        const seen = safeGetJSON(SUPPORT_SEEN_KEY, {});
        return seen && typeof seen === "object" && !Array.isArray(seen) ? seen : {};
    }

    function markSupportMessageSeen(id) {
        const seen = loadSeenSupportMessages();
        seen[id] = true;
        const keys = Object.keys(seen);
        const trimmed = {};
        keys.slice(-500).forEach(function (k) { trimmed[k] = true; });
        safeSetItem(SUPPORT_SEEN_KEY, JSON.stringify(trimmed));
    }

    let flushPendingPromise = null;
    function flushPendingSupportMessages() {
        if (flushPendingPromise) return flushPendingPromise;
        flushPendingPromise = (async function () {
            const map = readSupportLocal();
            const pending = [];
            Object.keys(map).forEach(function (cid) {
                const conv = map[cid] || {};
                const messages = conv.messages || {};
                Object.keys(messages).forEach(function (mid) {
                    const msg = messages[mid];
                    if (msg && msg.from === "customer" && msg.deliveryStatus === "pending") pending.push({ cid: cid, conv: conv, msg: msg });
                });
            });
            if (!pending.length) return 0;
            const db = await getSupportDb();
            if (!db) return 0;
            pending.sort(function (x, y) { return Number(x.msg.createdAt || 0) - Number(y.msg.createdAt || 0); });
            let sent = 0;
            let changed = false;
            for (const entry of pending) {
                const message = Object.assign({}, entry.msg);
                delete message.deliveryStatus;
                const patch = {
                    id: entry.cid,
                    customerName: entry.conv.customerName || "Khách vãng lai",
                    customerEmail: entry.conv.customerEmail || "",
                    customerPhone: entry.conv.customerPhone || "",
                    type: message.type || entry.conv.type || "Yêu cầu hỗ trợ",
                    status: "open",
                    lastMessage: supportPreview(message),
                    lastSender: "customer",
                    unreadForAdmin: true,
                    updatedAt: Number(message.createdAt || Date.now()),
                    createdAt: Number(entry.conv.createdAt || message.createdAt || Date.now())
                };
                try {
                    await withTimeout(pushSupportMessageToServer(db, entry.cid, patch, message), CONFIG.supportWriteTimeoutMs);
                } catch (error) {
                    if (isPermissionDenied(error)) {
                        entry.msg.deliveryStatus = "local";
                        changed = true;
                        continue;
                    }
                    break; // vẫn mất kết nối → để lần sau
                }
                entry.msg.deliveryStatus = "sent";
                entry.msg.sentAt = Date.now();
                sent++;
                changed = true;
            }
            if (changed) {
                Object.keys(map).forEach(function (cid) {
                    const messages = (map[cid] && map[cid].messages) || {};
                    map[cid].pendingSync = Object.keys(messages).some(function (k) { return messages[k] && messages[k].deliveryStatus === "pending"; });
                });
                writeSupportLocal(map, getSupportConversationId());
            }
            if (sent) appendShop(`<strong class="tsh-shop-name">Đã gửi ${sent} tin nhắn hỗ trợ đang chờ tới THE STYLE HUB.</strong>Shop sẽ phản hồi tại khung chat này.`);
            return sent;
        })();
        flushPendingPromise.then(function () { flushPendingPromise = null; }, function () { flushPendingPromise = null; });
        return flushPendingPromise;
    }

    function appendShop(content, save = true) {
        const body = document.getElementById("tshAiBody");
        if (body) {
            const meta = document.createElement("div");
            meta.className = "tsh-ai-meta";
            meta.textContent = `THE STYLE HUB ${formatTime()}`;

            const msg = document.createElement("div");
            msg.className = "tsh-ai-msg bot";
            msg.innerHTML = content;

            body.append(meta, msg);
            body.scrollTop = body.scrollHeight;
        }

        if (save) storeMessage("bot", content, "THE STYLE HUB");
    }

    let onlineListenerBound = false;
    function startSupportReplyListener() {
        if (!onlineListenerBound && typeof window.addEventListener === "function") {
            onlineListenerBound = true;
            window.addEventListener("online", function () {
                flushPendingSupportMessages();
                startSupportReplyListener();
            });
        }
        flushPendingSupportMessages();
        if (supportReplyListenerStarted) return;
        supportReplyListenerStarted = true;
        const conversationId = getSupportConversationId();

        getSupportDb().then(function (db) {
            if (!db) {
                supportReplyListenerStarted = false; // thử lại khi có mạng
                return;
            }
            db.ref(SUPPORT_DB_ROOT + "/" + conversationId + "/messages").on("child_added", function (snapshot) {
                const msg = snapshot.val() || {};
                const messageId = msg.id || snapshot.key;
                if (msg.from !== "admin" || !messageId) return;
                const seen = loadSeenSupportMessages();
                if (seen[messageId]) return;
                markSupportMessageSeen(messageId);
                appendShop(`<strong class="tsh-shop-name">THE STYLE HUB phản hồi:</strong>${escapeHTML(msg.text || "")}`);
            });
        });
    }

    /* =========================================================
       GIAO DIỆN TIN NHẮN
       ========================================================= */

    function renderHistory() {
        const body = document.getElementById("tshAiBody");
        if (!body) return;
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
                msg.className = `tsh-ai-msg ${m.who === "user" ? "user" : "bot"}`;
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
        return saveMessages(messages);
    }

    function appendUser(text, save = true, attachment) {
        const body = document.getElementById("tshAiBody");
        const html = buildChatHtml(text, attachment);

        if (body) {
            const meta = document.createElement("div");
            meta.className = "tsh-ai-meta";
            meta.textContent = `Me ${formatTime()}`;

            const msg = document.createElement("div");
            msg.className = "tsh-ai-msg user";
            msg.innerHTML = html || "Đã gửi hình ảnh";

            body.append(meta, msg);
            body.scrollTop = body.scrollHeight;
        }

        if (save) storeMessage("user", html || escapeHTML(text), "Me");
    }

    function appendBot(content, save = true) {
        const body = document.getElementById("tshAiBody");

        if (body) {
            const meta = document.createElement("div");
            meta.className = "tsh-ai-meta";
            meta.textContent = `Stylist AI Tư Vấn ${formatTime()}`;

            const msg = document.createElement("div");
            msg.className = "tsh-ai-msg bot";
            msg.innerHTML = content;

            body.append(meta, msg);
            body.scrollTop = body.scrollHeight;
        }

        if (save) storeMessage("bot", content, "Stylist AI Tư Vấn");
    }

    function showTyping(callback) {
        const body = document.getElementById("tshAiBody");
        if (!body) {
            callback();
            return;
        }
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
                    appendBot(`Shop chưa nhận được tin nhắn do lỗi kết nối. Bạn thử gửi lại giúp mình hoặc liên hệ hotline ${SUPPORT_HOTLINE} nhé.`);
                }
            });
            return;
        }

        showTyping(function () { appendBot(buildReply(text)); });
    }

    /* =========================================================
       GIỎ HÀNG
       ========================================================= */

    function productSizeKind(id, item) {
        const key = String(id || "").toLowerCase();
        // Khớp isShoeProductId / isKidsProductId trong product-detail.html
        if (key.startsWith("shoe") || productDepartment(id, item) === "shoes") return "shoes";
        if (key.startsWith("kids")) return "kids";
        return "clothing";
    }

    function validSizesFor(id, item) {
        const kind = productSizeKind(id, item);
        if (kind === "shoes") return ALL_SHOE_SIZES.map(String);
        if (kind === "kids") return KIDS_CLOTHING_SIZES.slice();
        return ADULT_CLOTHING_SIZES.slice();
    }

    function shoeSizePickerHtml(productId, item) {
        const options = ALL_SHOE_SIZES.map(function (n) {
            return `<button type="button" class="tsh-ai-size-option" data-product-id="${escapeHTML(productId)}" data-size="${n}">${n}</button>`;
        }).join("");
        return `<span class="tsh-ai-size-picker">Bạn chọn size giày (EU) cho <strong>${escapeHTML(item.name)}</strong> trước khi thêm vào BAG nhé:` +
            `<span class="tsh-ai-size-options">${options}</span>` +
            `<span class="tsh-ai-muted">Giày nam: EU ${SHOE_SIZES.male[0]}–${SHOE_SIZES.male[SHOE_SIZES.male.length - 1]} · Giày nữ: EU ${SHOE_SIZES.female[0]}–${SHOE_SIZES.female[SHOE_SIZES.female.length - 1]}. Chưa rõ size? Nhắn "tư vấn size giày".</span></span>`;
    }

    function readCartItems() {
        try {
            if (window.StyleHubCartSync && typeof window.StyleHubCartSync.read === "function") {
                const cart = window.StyleHubCartSync.read();
                if (Array.isArray(cart)) return cart.slice();
            }
        } catch (e) {}
        for (const key of CART_KEYS) {
            const cart = safeGetJSON(key, []);
            if (Array.isArray(cart) && cart.length) return cart.slice();
        }
        return [];
    }

    function writeCartItems(cart) {
        try {
            if (window.StyleHubCartSync && typeof window.StyleHubCartSync.save === "function") {
                window.StyleHubCartSync.save(cart);
                return true;
            }
        } catch (e) {}
        // Không có stylehub-cart-sync.js: ghi CÙNG một giỏ vào mọi key để trang nào cũng đọc được
        // (trước đây chỉ ghi "cart" nên món thêm từ chat bị mất khi giỏ chính đã có hàng).
        const data = JSON.stringify(cart);
        let ok = true;
        CART_KEYS.forEach(function (key) { if (!safeSetItem(key, data)) ok = false; });
        const total = cart.reduce(function (sum, item) { return sum + (Number(item.qty) || Number(item.quantity) || 1); }, 0);
        try {
            document.querySelectorAll("#cart-count,#bag-count").forEach(function (el) { el.textContent = total; });
        } catch (e) {}
        return ok;
    }

    function addToCart(productId, requestedSize) {
        const data = getDB();
        const item = data[productId];
        if (!item) return { ok: false, reason: "missing" };

        if (!isProductInStock(productId, item)) {
            appendBot(`Rất tiếc, <strong>${escapeHTML(item.name)}</strong> hiện đã hết hàng nên mình chưa thêm vào BAG được.`);
            return { ok: false, reason: "out-of-stock" };
        }

        const kind = productSizeKind(productId, item);
        const valid = validSizesFor(productId, item);
        let size = requestedSize === undefined || requestedSize === null || requestedSize === "" ? null : String(requestedSize).trim().toUpperCase();
        let note = "";
        if (size && valid.indexOf(size) < 0) size = null;

        if (!size) {
            const ctx = loadContext();
            if (kind === "shoes") {
                const rec = ctx.shoe && ctx.shoe.recommended ? String(ctx.shoe.recommended) : "";
                if (rec && valid.indexOf(rec) >= 0) {
                    size = rec;
                    note = "theo size giày bạn vừa được tư vấn";
                } else {
                    // Giày KHÔNG có size mặc định: hỏi khách chọn size EU thay vì tự gán "M".
                    appendBot(shoeSizePickerHtml(productId, item));
                    return { ok: false, reason: "need-size", sizes: valid };
                }
            } else {
                const rec = kind === "clothing" && ctx.clothing ? ctx.clothing.recommended : null;
                if (rec && valid.indexOf(rec) >= 0) {
                    size = rec;
                    note = "theo size bạn vừa được tư vấn";
                } else {
                    size = DEFAULT_CLOTHING_SIZE;
                    note = "size mặc định giống trang sản phẩm";
                }
            }
        }

        const cart = readCartItems();
        const existing = cart.find(function (x) {
            return x && (x.key === productId || x.id === productId) && String(x.size || "").toUpperCase() === size;
        });
        if (existing) {
            existing.qty = (Number(existing.qty) || Number(existing.quantity) || 1) + 1;
            existing.quantity = existing.qty;
        } else {
            cart.push({
                key: productId,
                id: productId,
                name: item.name,
                price: item.price,
                priceNum: productPrice(item),
                mainImg: getImage(item),
                image: getImage(item),
                size: size,
                qty: 1,
                quantity: 1
            });
        }
        const saved = writeCartItems(cart);

        if (!saved) {
            appendBot("Chưa lưu được giỏ hàng vì bộ nhớ trình duyệt đã đầy hoặc bị chặn. Bạn thử xóa bớt lịch sử chat (nút 🗑) rồi thêm lại nhé.");
            return { ok: false, reason: "storage" };
        }
        appendBot(`Mình đã thêm <strong>${escapeHTML(item.name)}</strong> (size ${escapeHTML(size)}) vào BAG cho bạn rồi nhé.` +
            (note ? ` <span class="tsh-ai-muted">Size ${escapeHTML(size)}: ${escapeHTML(note)}. Muốn đổi size, bạn mở <a class="tsh-ai-link" href="product-detail.html?id=${encodeURIComponent(productId)}">trang sản phẩm</a> để chọn lại.</span>` : ""));
        return { ok: true, size: size };
    }

    function clearHistory() {
        safeRemoveItem(STORAGE_MESSAGES);
        safeRemoveItem(STORAGE_CONTEXT);
        renderHistory();
    }

    function setPositionFromStorage() {
        const toggle = document.getElementById("tshAiToggle");
        const box = document.getElementById("tshAiBox");
        let saved = null;
        try { saved = localStorage.getItem(STORAGE_POS); } catch (e) {}

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

            safeSetItem(STORAGE_POS, JSON.stringify({ right, bottom }));

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
            const sizeBtn = e.target.closest(".tsh-ai-size-option");
            if (sizeBtn) {
                addToCart(sizeBtn.dataset.productId, sizeBtn.dataset.size);
                return;
            }
            const cartBtn = e.target.closest(".tsh-ai-product-cart");
            if (cartBtn) addToCart(cartBtn.dataset.productId);
        });
    }

    // API công khai: dùng cho kiểm thử tự động (tests/chatbot.test.js) và debug trên console.
    window.StyleHubStylistAI = {
        version: "2.0.0",
        config: CONFIG,
        analyzeText: analyzeText,
        normalize: normalize,
        parseBudget: parseBudget,
        searchProducts: searchProducts,
        respond: respond,
        buildReply: buildReply,
        shoeNumberSize: shoeNumberSize,
        footLengthToEU: footLengthToEU,
        smartClothingSize: smartClothingSize,
        addToCart: addToCart,
        readCartItems: readCartItems,
        shouldForwardToSupport: shouldForwardToSupport,
        saveCustomerSupportMessage: saveCustomerSupportMessage,
        supportAckHtml: supportAckHtml,
        flushPendingSupportMessages: flushPendingSupportMessages,
        readSupportLocal: readSupportLocal,
        writeSupportLocal: writeSupportLocal,
        loadMessages: loadMessages,
        saveMessages: saveMessages,
        storeMessage: storeMessage,
        productCards: productCards,
        loadContext: loadContext,
        resetContext: function () { return saveContext(defaultContext()); },
        handleMessage: handleMessage
    };

    function init() {
        injectStyle();
        createWidget();
        startSupportReplyListener();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
