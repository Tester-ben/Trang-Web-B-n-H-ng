HƯỚNG DẪN ĐỂ ADMIN THẤY ĐƠN HÀNG TỪ MÁY KHÁC

Lý do trước đó admin không thấy đơn của máy khác:
- Code cũ lưu đơn bằng localStorage.
- localStorage chỉ nằm trong đúng trình duyệt/máy đang dùng.
- Khách đặt trên máy A thì admin mở máy B sẽ không thể thấy.

Bản này đã thêm file:
- stylehub-orders-api.js

File này giúp lưu đơn hàng lên Firebase Realtime Database để nhiều máy cùng thấy đơn hàng.

CÁCH BẬT CHỨC NĂNG ONLINE
1. Vào https://console.firebase.google.com/
2. Tạo project mới.
3. Vào Build > Realtime Database > Create Database.
4. Chọn Start in test mode nếu chỉ làm bài demo.
5. Vào Project Settings > General > Your apps > Web app.
6. Copy firebaseConfig.
7. Mở file stylehub-orders-api.js.
8. Thay toàn bộ phần PASTE_... trong STYLEHUB_FIREBASE_CONFIG bằng config thật của Firebase.

Ví dụ phần cần thay nằm đầu file stylehub-orders-api.js:

const STYLEHUB_FIREBASE_CONFIG = {
    apiKey: "PASTE_API_KEY_HERE",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://PASTE_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_PROJECT_ID.appspot.com",
    messagingSenderId: "PASTE_MESSAGING_SENDER_ID",
    appId: "PASTE_APP_ID"
};

Database Rules cho demo/môn học:
{
  "rules": {
    "stylehub_orders": {
      ".read": true,
      ".write": true
    }
  }
}

LƯU Ý QUAN TRỌNG
- Nếu chưa thay Firebase config thật, web vẫn chạy nhưng chỉ lưu trên máy hiện tại như cũ.
- Muốn admin máy bạn thấy đơn của khách máy khác, cả hai phải dùng cùng bộ code đã gắn Firebase config thật.
- Nên upload web lên GitHub Pages/Netlify/Vercel rồi gửi link cho khách đặt thử.
- Mật khẩu admin trong code frontend chỉ phù hợp demo. Website bán hàng thật cần backend/auth bảo mật hơn.

LUỒNG HOẠT ĐỘNG SAU KHI CẤU HÌNH FIREBASE
1. Khách đặt hàng và nhập tên, số điện thoại, email, địa chỉ.
2. Đơn được lưu lên Firebase.
3. Admin mở admin.html trên máy khác, đăng nhập admin123, thấy đơn và thông tin khách.
4. Admin bấm Xác nhận đơn hàng.
5. Trạng thái đổi từ Đang chờ xác nhận sang Đang giao.
6. Bên Account của khách cũng thấy trạng thái Đang giao.
