
    // Hàm tính tổng tiền dựa trên giỏ hàng (Giữ nguyên logic của ông)
    function calculateTotal(items) {
        if (!items) return "0 ₫";
        let total = 0;
        items.forEach(item => {
            let price = parseInt(item.price.replace(/[^\d]/g, ''));
            total += price * item.qty;
        });
        return total.toLocaleString('vi-VN') + " ₫";
    }

    // Tự động hiển thị tổng tiền khi khách vào trang thanh toán
    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    document.getElementById('display-total').innerText = calculateTotal(cartItems);

    // Hàm xử lý khi nhấn nút đặt hàng
    function handleCheckout(event) {
        event.preventDefault(); // Ngăn trang bị reset lại khi submit form

        const name = document.getElementById('cusname').value;
        const phone = document.getElementById('cusphone').value;
        const email = document.getElementById('cusemail').value;
        const address = document.getElementById('cusaddress').value;
        
        if (cartItems.length === 0) {
            alert("Giỏ hàng của bạn đang trống!");
            return;
        }
        
        // Tạo mã đơn và thời gian đặt giống trang Admin
        const orderId = "STH" + Math.floor(100000 + Math.random() * 900000);
        const orderDate = new Date().toLocaleString('vi-VN');
        const totalPriceFormatted = calculateTotal(cartItems);

        // Tạo chuỗi danh sách sản phẩm đẹp để gửi vào nội dung Email
        let productDetailsText = "";
        cartItems.forEach(item => {
            productDetailsText += `• ${item.name} (Size: ${item.size}) x ${item.qty} - Giá: ${item.price}\n`;
        });

        // 1. Gói dữ liệu để lưu vào hub_orders cho Admin đọc (Đã sửa chuẩn key để không bị lỗi N/A)
        const newOrder = {
            orderId: orderId,
            orderDate: orderDate,
            date: orderDate,
            userEmail: email.trim().toLowerCase(),
            customerEmail: email.trim().toLowerCase(),
            shippingEmail: email.trim().toLowerCase(),
            status: "Đang chờ xác nhận",
            userInfo: {
                name: name,
                phone: phone,
                email: email.trim().toLowerCase(),
                address: address
            },
            orderedProductsList: cartItems,
            totalPriceFormatted: totalPriceFormatted
        };

        // Lưu vào localStorage
        let currentOrders = JSON.parse(localStorage.getItem('hub_orders') || '[]');
        currentOrders.unshift(newOrder); // Thêm đơn mới lên đầu danh sách
        localStorage.setItem('hub_orders', JSON.stringify(currentOrders));

        // 2. Kích hoạt gửi Email tự động qua EmailJS
        const templateParams = {
            to_email: email,             // Khớp với {{to_email}} trên EmailJS
            customer_name: name,         // Khớp với {{customer_name}}
            orderId: orderId,            // Khớp với {{orderId}}
            order_date: orderDate,       // Khớp với {{order_date}}
            customer_phone: phone,       // Khớp với {{customer_phone}}
            customer_address: address,   // Khớp với {{customer_address}}
            product_details: productDetailsText, // Khớp với {{product_details}}
            total_price: totalPriceFormatted     // Khớp với {{total_price}}
        };

        // Tiến hành gửi lên hệ thống EmailJS
        // TODO: THAY "YOUR_SERVICE_ID" và "YOUR_TEMPLATE_ID" bằng mã thực tế 
        emailjs.send('service_xjsmniq', 'template_f4bnal4', templateParams)
            .then(function(response) {
               console.log('Email gửi thành công!', response.status, response.text);
               // Xóa giỏ hàng sau khi đặt thành công
               localStorage.removeItem('cart');
               alert("Đặt hàng thành công! Một email xác nhận chi tiết đã được gửi đến bạn.");
               window.location.href = "account.html"; // Chuyển về tài khoản để khách xem trạng thái đơn
            }, function(error) {
               console.error('Gửi email thất bại...', error);
               alert("Có lỗi xảy ra trong quá trình gửi mail xác nhận, nhưng đơn hàng của bạn đã được hệ thống ghi nhận.");
            });
    }
