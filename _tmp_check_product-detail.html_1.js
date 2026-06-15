
        


        let currentItem = null;
        let selectedSizeText = "M";
        let cartMemoryArray = [];
        let isUserLoggedIn = localStorage.getItem('isLoggedInStatus') === 'true'; 
        let pendingCheckoutAction = false; 


        function getProductCategoryById(productId) {
            if (!productId) return "mens";
            if (productId.startsWith("womens")) return "womens";
            if (productId.startsWith("kids")) return "kids";
            if (productId.startsWith("sale")) return "sale";
            if (productId.startsWith("shoe")) return "shoes";
            return "mens";
        }

        function getRelatedBackPage(category) {
            if (category === "womens") return "womens.html";
            if (category === "kids") return "kids.html";
            if (category === "sale") return "sale.html";
            if (category === "shoes") return "shoes.html";
            return "mens.html";
        }

        function renderRelatedProducts(currentProductId) {
            const relatedGrid = document.getElementById("relatedProductsGrid");
            const relatedSection = document.getElementById("relatedProductsSection");
            if (!relatedGrid || typeof database === "undefined") return;

            const currentCategory = getProductCategoryById(currentProductId);

            const allSameCategoryIds = Object.keys(database).filter(function(id) {
                const item = database[id];
                return id !== currentProductId &&
                       getProductCategoryById(id) === currentCategory &&
                       item &&
                       (item.mainImg || (item.images && item.images[0]));
            });

            if (allSameCategoryIds.length === 0) {
                if (relatedSection) relatedSection.style.display = "none";
                return;
            }

            const sortedIds = allSameCategoryIds.sort(function(a, b) {
                const numA = parseInt(a.split("-").pop(), 10) || 0;
                const numB = parseInt(b.split("-").pop(), 10) || 0;
                return numA - numB;
            });

            const currentNumber = parseInt(String(currentProductId).split("-").pop(), 10) || 0;
            const afterCurrent = sortedIds.filter(function(id) {
                return (parseInt(id.split("-").pop(), 10) || 0) > currentNumber;
            });
            const beforeCurrent = sortedIds.filter(function(id) {
                return (parseInt(id.split("-").pop(), 10) || 0) <= currentNumber;
            });

            const selectedIds = afterCurrent.concat(beforeCurrent).slice(0, 4);
            relatedGrid.innerHTML = "";

            selectedIds.forEach(function(id) {
                const item = database[id];
                const mainImage = item.mainImg || (item.images && item.images[0]) || "";
                const hoverImage = (item.images && item.images[1]) ? item.images[1] : mainImage;
                const brandText = item.brand || "ESSENTIALS";
                const detailUrl = "product-detail.html?id=" + id;

                const card = document.createElement("a");
                card.className = "related-product-card";
                card.href = detailUrl;
                card.innerHTML = `
                    <div class="related-image-box">
                        <img class="related-img-main" src="${mainImage}" alt="${item.name || ''}">
                        <img class="related-img-hover" src="${hoverImage}" alt="${item.name || ''}">
                    </div>
                    <p class="related-brand">${brandText}</p>
                    <p class="related-name">${item.name || ''}</p>
                    <p class="related-price">${item.price || ''}</p>
                `;

                relatedGrid.appendChild(card);
            });
        }

        document.addEventListener("DOMContentLoaded", function() {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id') || 'tops-1';
            currentItem = database[productId];
            
            const backLink = document.getElementById('back-link-target');

            if (productId.startsWith('womens')) {
                backLink.href = 'womens.html';
            } else if (productId.startsWith('dress')) {
                backLink.href = 'mens.html';
            } else if (productId.startsWith('kids')) {
                backLink.href = 'kids.html';
            } else if (productId.startsWith('sale')) {
                backLink.href = 'sale.html'; 
            } else if (productId.startsWith('shoe')) {
                backLink.href = 'shoes.html'; 
            } else {
                backLink.href = 'index.html'; 
            }
            
            if (currentItem) {
                document.getElementById('brand-name-target').innerText = currentItem.brand || "Essentials";
                document.getElementById('product-name-target').innerText = currentItem.name;
                document.getElementById('product-price-target').innerText = currentItem.price;
                const galleryTarget = document.getElementById('gallery-target');
                galleryTarget.innerHTML = '';
                
                currentItem.images.forEach(imgUrl => {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'product-image-item';
                    const imgElement = document.createElement('img');
                    imgElement.src = imgUrl;
                    imgContainer.appendChild(imgElement);
                    galleryTarget.appendChild(imgContainer);
                });
            }

            renderRelatedProducts(productId);
            
            loadSavedShippingInfo();
            updateHeaderAccountUI();
        });

        function changeSize(el) { 
            document.querySelectorAll('.size-button').forEach(b => b.classList.remove('selected')); 
            el.classList.add('selected');
            selectedSizeText = el.innerText;
        }
        
        function toggleCartDrawer(isOpen) { document.getElementById('cartOverlay').classList.toggle('open', isOpen); }
        function toggleCheckoutDrawer(isOpen) { document.getElementById('checkoutOverlay').classList.toggle('open', isOpen); }
        function toggleAuthModal(isOpen) { document.getElementById('authModal').classList.toggle('open', isOpen); }

        function toggleAuthView(targetBlock) {
            const loginBlock = document.getElementById('auth-login-block');
            const registerBlock = document.getElementById('auth-register-block');
            if(targetBlock === 'register') {
                loginBlock.classList.add('hidden-auth-block');
                registerBlock.classList.remove('hidden-auth-block');
            } else {
                registerBlock.classList.add('hidden-auth-block');
                loginBlock.classList.remove('hidden-auth-block');
            }
        }

        function showToastNotification(textMsg) {
            const toast = document.getElementById('toastMessage');
            toast.innerText = textMsg;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 2800);
        }

        function updateHeaderAccountUI() {
            const links = document.querySelectorAll('#account-trigger, #headerAccountLink');
            links.forEach(function(link) {
                if(isUserLoggedIn) {
                    const savedName = localStorage.getItem('hub_name') || "ACCOUNT";
                    link.innerText = savedName.toUpperCase();
                    link.href = "account.html";
                } else {
                    link.innerText = "ACCOUNT";
                    link.href = "account.html";
                }
            });
        }

        function handleImmediateLogin() {
            const emailInput = document.getElementById('authEmail').value.trim();
            const emailName = emailInput ? emailInput.split('@')[0] : 'USER';
            const savedName = localStorage.getItem('hub_name');

            isUserLoggedIn = true;
            localStorage.setItem('isLoggedInStatus', 'true');
            localStorage.setItem('hub_email', emailInput);
            localStorage.setItem('hub_current_user_key', emailInput.toLowerCase());
            localStorage.setItem('hub_name', savedName && savedName.trim() !== '' ? savedName : emailName);

            if(!localStorage.getItem('hub_phone')) localStorage.setItem('hub_phone', '');
            if(!localStorage.getItem('hub_address')) localStorage.setItem('hub_address', '');

            loadSavedShippingInfo();
            updateHeaderAccountUI();
            toggleAuthModal(false);
            showToastNotification("Đăng nhập xác thực thành công!");
            if(pendingCheckoutAction) {
                pendingCheckoutAction = false;
                toggleCheckoutDrawer(true);
            }
        }

        function handleImmediateRegister() {
            const nameInput = document.getElementById('regNewName').value.trim();
            const emailInput = document.getElementById('regNewEmail').value.trim();

            isUserLoggedIn = true;
            localStorage.setItem('isLoggedInStatus', 'true');
            localStorage.setItem('hub_name', nameInput);
            localStorage.setItem('hub_email', emailInput);
            localStorage.setItem('hub_current_user_key', emailInput.toLowerCase());
            localStorage.setItem('hub_phone', '');
            localStorage.setItem('hub_address', '');

            loadSavedShippingInfo();
            updateHeaderAccountUI();
            toggleAuthModal(false);
            
            triggerFireworkCelebration();

            if(pendingCheckoutAction) {
                pendingCheckoutAction = false;
                setTimeout(() => { toggleCheckoutDrawer(true); }, 1000);
            }
        }

        function addBag() { 
            if (!currentItem) return;
            const existingItem = cartMemoryArray.find(item => item.key === currentItem.key && item.size === selectedSizeText);
            if (existingItem) { existingItem.qty += 1; } 
            else {
                cartMemoryArray.push({
                    key: currentItem.key, name: currentItem.name, price: currentItem.price,
                    priceNum: currentItem.priceNum, mainImg: currentItem.mainImg, size: selectedSizeText, qty: 1
                });
            }
            renderCartUI();
            showToastNotification(`ĐÃ THÊM SẢN PHẨM (SIZE ${selectedSizeText}) VÀO BAG!`);
        }

        function removeCartItem(index) {
            cartMemoryArray.splice(index, 1);
            renderCartUI();
        }

        function renderCartUI() {
            const container = document.getElementById('cartItemsContainer');
            const emptyMsg = document.getElementById('emptyCartMessage');
            container.innerHTML = '';
            let totalItemsCount = 0;
            let totalAmountMoney = 0;

            if (cartMemoryArray.length === 0) {
                emptyMsg.classList.remove('hidden');
                document.getElementById('bag-count').innerText = "0";
                document.getElementById('cartTotalTarget').innerText = "0 ₫";
                return;
            }
            emptyMsg.classList.add('hidden');

            cartMemoryArray.forEach((item, index) => {
                totalItemsCount += item.qty;
                totalAmountMoney += (item.priceNum * item.qty);
                const row = document.createElement('div');
                row.className = 'cart-product-row';
                row.innerHTML = `
                    <img src="${item.mainImg}" class="cart-item-img">
                    <div class="cart-item-info">
                        <p class="cart-item-title">${item.name}</p>
                        <p class="cart-item-meta">Size: ${item.size} / SL: ${item.qty}</p>
                        <p class="cart-item-price">${item.price}</p>
                    </div>
                    <button class="remove-item-btn" onclick="removeCartItem(${index})">Xóa</button>
                `;
                container.appendChild(row);
            });
            document.getElementById('bag-count').innerText = totalItemsCount;
            document.getElementById('cartTotalTarget').innerText = totalAmountMoney.toLocaleString('vi-VN') + " ₫";
        }

        function loadSavedShippingInfo() {
            const savedName = localStorage.getItem('hub_name');
            const savedPhone = localStorage.getItem('hub_phone');
            const savedAddress = localStorage.getItem('hub_address');
            const savedEmail = localStorage.getItem('hub_email');
            
            if (savedName) { document.getElementById('cusName').value = savedName; }
            if (savedEmail) { document.getElementById('cusEmail').value = savedEmail; }
            
            if (savedPhone && savedPhone !== "Chưa cập nhật") { 
                document.getElementById('cusPhone').value = savedPhone; 
            } else {
                document.getElementById('cusPhone').value = ""; 
            }
            
            if (savedAddress && savedAddress !== "Chưa cập nhật địa chỉ giao hàng") { 
                document.getElementById('cusAddress').value = savedAddress; 
            } else {
                document.getElementById('cusAddress').value = ""; 
            }
        }

        function openCheckoutFromCart() {
            if(cartMemoryArray.length === 0) { showToastNotification("Giỏ hàng của bạn đang trống!"); return; }
            toggleCartDrawer(false);
            if(!isUserLoggedIn) { pendingCheckoutAction = true; toggleAuthModal(true); return; }
            toggleCheckoutDrawer(true);
        }

        function openCheckoutDirectly() {
            if (!currentItem) return;
            const existingItem = cartMemoryArray.find(item => item.key === currentItem.key && item.size === selectedSizeText);
            if (!existingItem) {
                cartMemoryArray.push({
                    key: currentItem.key, name: currentItem.name, price: currentItem.price,
                    priceNum: currentItem.priceNum, mainImg: currentItem.mainImg, size: selectedSizeText, qty: 1
                });
                renderCartUI();
            }
            if(!isUserLoggedIn) { pendingCheckoutAction = true; toggleAuthModal(true); return; }
            toggleCheckoutDrawer(true);
        }

        function submitFinalOrder() {
            const name = document.getElementById('cusName').value.trim();
            const phone = document.getElementById('cusPhone').value.trim();
            const address = document.getElementById('cusAddress').value.trim();
            const email = document.getElementById('cusEmail').value.trim().toLowerCase();

            if(!name || !phone || !address || !email) {
                showToastNotification("Vui lòng điền đầy đủ thông tin giao hàng!");
                return;
            }

            if(cartMemoryArray.length === 0) {
                showToastNotification("Giỏ hàng của bạn đang trống!");
                return;
            }
            
            const accountEmail = (
                localStorage.getItem('hub_current_user_key') ||
                localStorage.getItem('hub_email') ||
                email
            ).trim().toLowerCase();

            localStorage.setItem('hub_name', name);
            localStorage.setItem('hub_email', accountEmail);
            localStorage.setItem('hub_current_user_key', accountEmail);
            localStorage.setItem('hub_shipping_email', email);
            localStorage.setItem('hub_phone', phone);
            localStorage.setItem('hub_address', address);

            const orderStorageKey = 'hub_orders_' + accountEmail;
            const existingOrdersArray = JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
            const uniqueOrderId = "STH" + Math.floor(100000 + Math.random() * 900000);
            
            const orderDate = new Date().toLocaleString('vi-VN');
            const newCompletedOrderObject = {
                orderId: uniqueOrderId,
                userEmail: accountEmail,
                customerEmail: accountEmail,
                shippingEmail: email,
                orderDate: orderDate,
                date: orderDate,
                userInfo: {
                    name: name,
                    phone: phone,
                    email: accountEmail,
                    address: address
                },
                totalPriceFormatted: document.getElementById('cartTotalTarget').innerText,
                orderedProductsList: [...cartMemoryArray],
                status: "Đang chờ xác nhận"
            };

            existingOrdersArray.unshift(newCompletedOrderObject);
            localStorage.setItem(orderStorageKey, JSON.stringify(existingOrdersArray));

            // Lưu thêm theo tên tài khoản để tránh lỗi tài khoản chưa có email riêng.
            const nameOrderKey = 'hub_orders_' + (localStorage.getItem('hub_name') || name)
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_');
            if (nameOrderKey !== orderStorageKey) {
                const nameOrders = JSON.parse(localStorage.getItem(nameOrderKey) || '[]');
                nameOrders.unshift(newCompletedOrderObject);
                localStorage.setItem(nameOrderKey, JSON.stringify(nameOrders));
            }

            // Lưu thêm bản global có userEmail để account có thể dò lại nếu cần.
            const globalOrders = JSON.parse(localStorage.getItem('hub_orders') || '[]');
            globalOrders.unshift(newCompletedOrderObject);
            localStorage.setItem('hub_orders', JSON.stringify(globalOrders));
            
            toggleCheckoutDrawer(false);
            cartMemoryArray = [];
            renderCartUI();
            triggerFireworkCelebration();
        }

        /* --- HIỆU ỨNG PHÁO HOA --- */
        const canvas = document.getElementById('fwCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resizeCanvas);

        function triggerFireworkCelebration() {
            canvas.style.display = 'block';
            resizeCanvas();
            particles = [];
            createExplosion(canvas.width * 0.25, canvas.height * 0.4);
            createExplosion(canvas.width * 0.5, canvas.height * 0.3);
            createExplosion(canvas.width * 0.75, canvas.height * 0.4);
            let animationFrameId, framesCount = 0;
            function loop() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < particles.length; i++) {
                    let p = particles[i];
                    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.012;
                    ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                    if (p.alpha <= 0) { particles.splice(i, 1); i--; }
                }
                framesCount++;
                if (particles.length > 0 && framesCount < 200) { animationFrameId = requestAnimationFrame(loop); } 
                else { cancelAnimationFrame(animationFrameId); canvas.style.display = 'none'; showToastNotification("THAO TÁC XÁC THỰC THÀNH CÔNG!"); }
            }
            loop();
        }

        function createExplosion(x, y) {
            const colors = ['#ffffff', '#000000', '#777777', '#333333', '#dddddd']; 
            for (let i = 0; i < 60; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 5 + 2;
                particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 3 + 1.5, color: colors[Math.floor(Math.random() * colors.length)], alpha: 1 });
            }
        }
    