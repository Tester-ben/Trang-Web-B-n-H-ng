THE STYLE HUB - STATIC DEMO VERSION
===================================

Bản này đã được chỉnh theo yêu cầu “web tĩnh”.

Các phần đã chuyển về tĩnh:
1. Removed Firebase scripts from all HTML pages.
2. Removed EmailJS sending from checkout/product detail.
3. stylehub-orders-api.js is now a no-backend static mock API.
4. Customer checkout shows success UI and saves the order only inside the customer's local Account demo history.
5. Customer demo orders are stored under stylehub_customer_demo_orders, not hub_orders/Firebase/backend.
6. Admin dashboard uses demo/sample orders and demo/sample support messages only.
7. Customer orders/messages will NOT jump to Admin.
8. Old dynamic order storage keys are cleared by the static order API to avoid leaking dynamic data from previous versions.

Admin demo password:
admin123

Notes:
- Cart, search, filters, product detail, AI stylist suggestions and UI interactions remain available because they are front-end JavaScript interactions.
- Account > Orders History can show the customer's own demo checkout order on the same browser.
- Admin actions such as Confirm, Complete, Delete still work on the sample data during the current browser session only, for presentation/demo purposes.
- No backend/API/database/email service is required.
