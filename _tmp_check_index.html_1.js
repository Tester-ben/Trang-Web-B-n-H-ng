
        let isLoggedIn = localStorage.getItem('isLoggedInStatus') === 'true'; 
        let userData = JSON.parse(localStorage.getItem("hub_userData")) || { firstName: "", lastName: "", email: "", password: "" };

        function checkGlobalLoginStatus() {
            const accountTrigger = document.getElementById('account-trigger');
            const dbUserName = document.getElementById('db-user-name');
            const dbUserEmail = document.getElementById('db-user-email');

            if (localStorage.getItem('isLoggedInStatus') === 'true') {
                isLoggedIn = true;

                const savedName = (localStorage.getItem('hub_name') || "USER").trim() || "USER";
                const savedEmail = localStorage.getItem('hub_email') || "No email saved";

                accountTrigger.innerText = savedName.toUpperCase();
                if (dbUserName) dbUserName.innerText = savedName;
                if (dbUserEmail) dbUserEmail.innerText = savedEmail;
            } else {
                isLoggedIn = false;
                accountTrigger.innerText = "ACCOUNT";
                if (dbUserName) dbUserName.innerText = "USER";
                if (dbUserEmail) dbUserEmail.innerText = "No email saved";
            }
        }

        document.addEventListener("DOMContentLoaded", checkGlobalLoginStatus);

        function showPage(pageId) {
            const homeView = document.getElementById('home-page-view');
            const dashboardView = document.getElementById('dashboard-page-view');
            if (pageId === 'dashboard') {
                homeView.classList.add('hidden');
                dashboardView.classList.remove('hidden');
                window.scrollTo(0, 0);
            } else {
                dashboardView.classList.add('hidden');
                homeView.classList.remove('hidden');
            }
        }

        window.addEventListener('scroll', function () {
            const header = document.querySelector('.main-header');
            if (window.scrollY > 50) { header.classList.add('scrolled'); } 
            else { header.classList.remove('scrolled'); }
        });



        const accountModal = document.getElementById('account-modal');
        const bagModal = document.getElementById('bag-modal');
        const accountTrigger = document.getElementById('account-trigger');

        accountTrigger.onclick = function(e) {
            e.preventDefault();

            const loggedInNow = localStorage.getItem('isLoggedInStatus') === 'true';

            if (loggedInNow) {
                showPage('dashboard');
            } else {
                accountModal.style.display = 'block';
            }
        };

        document.getElementById('search-trigger').onclick = function (e) {
            e.preventDefault();
            openSearchBox();
        };

        document.getElementById('bag-trigger').onclick = function (e) {
            e.preventDefault();
            bagModal.style.display = 'block';
        };

        document.getElementById('close-account').onclick = function () {
            accountModal.style.display = 'none';
        };

        document.getElementById('close-bag').onclick = function () {
            bagModal.style.display = 'none';
        };

        window.onclick = function(event) {

            if (event.target == accountModal)
                accountModal.style.display = 'none';

            if (event.target == bagModal)
                bagModal.style.display = 'none';
        }

        function toggleAuthForm(target) {
            const loginForm = document.getElementById('login-form-container');
            const regForm = document.getElementById('register-form-container');
            if(target === 'register') {
                loginForm.classList.add('hidden');
                regForm.classList.remove('hidden');
            } else {
                loginForm.classList.remove('hidden');
                regForm.classList.add('hidden');
            }
        }

        function showToast(textMsg) {
            const toast = document.getElementById('toastMessage');
            toast.innerText = textMsg;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 2800);
        }

        function handleRegister() {
            const firstName = document.getElementById('reg-fname').value.trim();
            const lastName = document.getElementById('reg-lname').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-pass').value;

            userData = { firstName, lastName, email, password };
            localStorage.setItem('hub_userData', JSON.stringify(userData));

            showToast("Đăng ký thành công! Hãy đăng nhập thông tin.");
            toggleAuthForm('login');
        }

        function handleLogin() {
            const emailInput = document.getElementById('login-email').value.trim();
            const savedUserData = JSON.parse(localStorage.getItem("hub_userData") || '{}');

            let fullDisplayName = "";
            if (savedUserData.email && savedUserData.email.trim().toLowerCase() === emailInput.toLowerCase()) {
                fullDisplayName = `${savedUserData.lastName || ''} ${savedUserData.firstName || ''}`.trim();
            }
            if (!fullDisplayName) {
                fullDisplayName = emailInput.split('@')[0];
            }

            isLoggedIn = true;
            localStorage.setItem('isLoggedInStatus', 'true');
            localStorage.setItem('hub_name', fullDisplayName);
            localStorage.setItem('hub_email', emailInput);
            localStorage.setItem('hub_current_user_key', emailInput.toLowerCase());

            accountTrigger.innerText = fullDisplayName.toUpperCase();
            document.getElementById('db-user-name').innerText = fullDisplayName;
            document.getElementById('db-user-email').innerText = emailInput;

            accountModal.style.display = 'none';
            triggerFireworkCelebration(fullDisplayName);
        }

        function handleSignOut() {
            isLoggedIn = false;
            localStorage.setItem('isLoggedInStatus', 'false');
            localStorage.removeItem('hub_name');
            localStorage.removeItem('hub_email');
            localStorage.removeItem('hub_current_user_key');

            accountTrigger.innerText = "ACCOUNT";
            document.getElementById('db-user-name').innerText = "USER";
            document.getElementById('db-user-email').innerText = "No email saved";

            showToast("Bạn đã đăng xuất tài khoản.");
            showPage('home');
        }

        function switchDashboardTab(tabId) {
            const profileContent = document.getElementById('db-profile-content');
            const ordersContent = document.getElementById('db-orders-content');
            const profileBtn = document.getElementById('tab-profile-btn');
            const ordersBtn = document.getElementById('tab-orders-btn');
            if (tabId === 'profile') {
                profileContent.classList.remove('hidden');
                ordersContent.classList.add('hidden');
                profileBtn.classList.add('active');
                ordersBtn.classList.remove('active');
            } else {
                ordersContent.classList.remove('hidden');
                profileContent.classList.add('hidden');
                ordersBtn.classList.add('active');
                profileBtn.classList.remove('active');
            }
        }

        let cart = [];
        function addToCart(name, price) {
            const existingItem = cart.find(item => item.name === name);
            if(existingItem) { existingItem.quantity += 1; } 
            else { cart.push({ name, price, quantity: 1 }); }
            updateCartUI();
            bagModal.style.display = 'block';
        }

        function updateCartUI() {
            const cartCountElement = document.getElementById('cart-count');
            const cartItemsContainer = document.getElementById('cart-items-container');
            const cartTotalElement = document.getElementById('cart-total-price');
            const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
            cartCountElement.innerText = totalQty;

            if(cart.length === 0) {
                cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your bag is empty.</p>';
                cartTotalElement.innerText = "0 ₫";
                return;
            }

            let htmlOutput = "";
            let totalPrice = 0;
            cart.forEach((item, index) => {
                totalPrice += item.price * item.quantity;
                htmlOutput += `
                    <div class="cart-item">
                        <div class="cart-item-details">
                            <p class="cart-item-name">${item.name}</p>
                            <p class="cart-item-meta">${item.price.toLocaleString('vi-VN')} ₫ x ${item.quantity}</p>
                        </div>
                        <span class="remove-item-btn" onclick="removeFromCart(${index})">&times;</span>
                    </div>
                `;
            });
            cartItemsContainer.innerHTML = htmlOutput;
            cartTotalElement.innerText = totalPrice.toLocaleString('vi-VN') + " ₫";
        }

        function removeFromCart(index) {
            cart.splice(index, 1);
            updateCartUI();
        }

        const canvas = document.getElementById('fwCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);

        function triggerFireworkCelebration(displayName) {
            canvas.style.display = 'block';
            resizeCanvas();
            particles = [];
            createExplosion(canvas.width * 0.3, canvas.height * 0.4);
            createExplosion(canvas.width * 0.5, canvas.height * 0.3);
            createExplosion(canvas.width * 0.7, canvas.height * 0.4);
            
            let animationFrameId;
            let framesCount = 0;
            
            function loop() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < particles.length; i++) {
                    let p = particles[i];
                    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.014;
                    ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                    if (p.alpha <= 0) { particles.splice(i, 1); i--; }
                }
                framesCount++;
                if (particles.length > 0 && framesCount < 140) {
                    animationFrameId = requestAnimationFrame(loop);
                } else {
                    cancelAnimationFrame(animationFrameId);
                    canvas.style.display = 'none';
                    showToast(`XIN CHÀO ${displayName.toUpperCase()}! ĐĂNG NHẬP THÀNH CÔNG.`);
                    showPage('dashboard');
                    checkGlobalLoginStatus();
                }
            }
            loop();
        }

        function createExplosion(x, y) {
            const colors = ['#ffffff', '#000000', '#888888', '#555555', '#cccccc']; 
            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 2;
                particles.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 2.5 + 1,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: 1
                });
            }
        }
        function openSearchBox() {
            document.getElementById("searchBox").style.display = "block";
        }

        function closeSearchBox() {
            document.getElementById("searchBox").style.display = "none";
        }
        function searchProducts() {
        const keyword = document.getElementById("searchInput").value.toLowerCase();
        const resultsBox = document.getElementById("searchResults");

        resultsBox.innerHTML = "";

        if (keyword.trim() === "") return;

        const results = Object.keys(database).filter(id => {
            const item = database[id];
            return item.name && item.name.toLowerCase().includes(keyword);
        });

        if (results.length === 0) {
            resultsBox.innerHTML = `<p style="padding:15px 0;">No products found.</p>`;
            return;
        }

        results.forEach(id => {
            const item = database[id];

            resultsBox.innerHTML += `
                <div
                    onclick="window.location.href='product-detail.html?id=${id}'"
                    style="padding:12px 0; border-bottom:1px solid #eee; cursor:pointer;"
                >
                    <strong>${item.name}</strong><br>
                    <small>${item.price}</small>
                </div>
            `;
        });
    }
    