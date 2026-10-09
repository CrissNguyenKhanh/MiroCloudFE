# CloudStay Frontend

CloudStay là frontend React/Vite cho đồ án đặt phòng khách sạn một cơ sở. Repository này chỉ chứa giao diện và lớp gọi API; ba service `identity-service`, `booking-service` và `notification-service` nằm ở repository backend riêng.

Ứng dụng có hai chế độ:

- **Mock mode** để demo độc lập, không cần backend.
- **Real mode** để gọi các public API khách sạn đã được xác minh của backend.

Chi tiết endpoint, mapping và giới hạn hiện tại nằm trong [docs/backend-integration.md](docs/backend-integration.md).

## Chức năng hiện có

Luồng khách hàng:

- Đăng ký, đăng nhập, đăng xuất và khôi phục phiên bằng `GET /users/me`.
- Tìm phòng theo ngày nhận/trả, số khách, hạng phòng, mức giá và phân trang.
- Xem chi tiết phòng, giá dự kiến, ngày không khả dụng và phòng thay thế.
- Đặt phòng với `Idempotency-Key`, chặn gửi trùng và xử lý riêng xung đột phòng/key.
- Xem lại kết quả theo booking ID, lọc/phân trang đơn của tôi và hủy trong thời hạn cho phép.
- Xem thông báo, đánh dấu từng thông báo hoặc đánh dấu tất cả bằng nhiều request từng item.

Luồng admin:

- Dashboard ghi rõ phạm vi dữ liệu đang hiển thị, không trình bày số liệu trang đầu như tổng toàn hệ thống.
- Thêm, sửa và bật/tắt phòng; danh sách real mode chỉ gồm phòng đang active.
- Xem, lọc, phân trang và hủy booking với lý do bắt buộc.
- Xem user, đổi trạng thái `ACTIVE`/`LOCKED` sau bước xác nhận.
- Xem outbox và retry thủ công; không tự retry định kỳ.

Frontend guard chỉ phục vụ điều hướng/UX. Backend vẫn là nơi quyết định quyền, ownership, availability, giá và trạng thái cuối cùng.

## Cài và chạy trên Windows PowerShell

Khuyến nghị Node.js `22.16.0` (đã pin trong `.node-version`) và npm 10 trở lên.

```powershell
git clone <URL-FRONTEND>
Set-Location MiroCloudFE
Copy-Item .env.example .env
npm ci
npm run dev
```

Mở URL Vite in ra, thường là `http://localhost:5173`. Phải khởi động lại Vite sau khi thay đổi `.env`.

## Chọn mock mode hoặc real mode

`.env.example` chỉ chứa placeholder local, mặc định dùng mock:

```text
VITE_USE_MOCK_API=true
VITE_IDENTITY_API_URL=http://localhost:3001
VITE_BOOKING_API_URL=http://localhost:3002
VITE_NOTIFICATION_API_URL=http://localhost:3003
VITE_API_TIMEOUT_MS=10000
```

Để dùng backend local, sao chép file mẫu sang `.env`, đổi `VITE_USE_MOCK_API=false`, rồi restart Vite. Real mode không tự fallback sang dữ liệu mock khi API lỗi.

| Biến | Giá trị mẫu | Ý nghĩa |
| --- | --- | --- |
| `VITE_USE_MOCK_API` | `true` | Chọn mock (`true`) hoặc HTTP adapter (`false`). |
| `VITE_IDENTITY_API_URL` | `http://localhost:3001` | Origin của Identity Service. |
| `VITE_BOOKING_API_URL` | `http://localhost:3002` | Origin của Booking Service. |
| `VITE_NOTIFICATION_API_URL` | `http://localhost:3003` | Origin của Notification Service. |
| `VITE_API_TIMEOUT_MS` | `10000` | Timeout request real API, đơn vị mili giây. |

Mọi biến `VITE_*` được đóng gói vào JavaScript và công khai trong trình duyệt. Không đặt database URL/password, JWT secret, service key hoặc token riêng tư vào các biến này. Browser không được gọi `/internal/v1/*`.

## Tài khoản demo

Các tài khoản sau chỉ tồn tại trong mock mode:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Khách | `guest@cloudstay.vn` | `Guest123!` |
| Admin | `admin@cloudstay.vn` | `Admin123!` |

Mock mode có dữ liệu phòng, booking, notification và admin flow riêng trong trình duyệt. Dữ liệu demo dùng local storage; không phải dữ liệu thật và không được dùng để điền các field còn thiếu trong real mode.

## Contract real mode đã tích hợp

- Identity: register/login/me, danh sách user admin và cập nhật trạng thái user.
- Rooms: danh sách active, search availability, detail theo kỳ nghỉ, unavailable dates và alternatives.
- Bookings: tạo booking strict body, booking detail, danh sách của tôi, admin list, hủy theo đúng customer/admin endpoint.
- Notifications: tải danh sách và đánh dấu từng item đã đọc.
- Outbox: danh sách và retry thủ công qua public admin API.

HTTP adapter map `snake_case` của backend sang model `camelCase`, giữ `meta` phân trang và phân biệt đúng giá trị `0`/`false` với field bị thiếu. Giá trên giao diện trước khi đặt chỉ là dự kiến; kết quả tạo booking dùng giá authoritative do backend trả về.

## Giới hạn và backlog đã biết

- Chưa có payment/refund, upload ảnh, lưu phone/profile hoặc special requests.
- Chưa có refresh token và reset password; access token hết hạn cần đăng nhập lại.
- Backend chưa có `GET /api/v1/admin/rooms`; real mode không thể tải lại hoặc khôi phục toàn bộ phòng inactive sau reload.
- Chưa có API thống kê toàn hệ thống; dashboard chỉ mô tả phạm vi trang/dữ liệu đã tải. Không gọi tổng giá booking là “doanh thu thực thu”.
- Filter `room_id` và `user_id` của admin booking hiện bị lỗi ở backend do lệch tên snake_case/camelCase. UI không tuyên bố hai filter này đã hoạt động.
- Notification API chưa có read-all; thao tác “đánh dấu tất cả” gọi endpoint của từng thông báo và báo lỗi một phần nếu có.
- Payload/formatter notification chưa bảo đảm có ngày nhận/trả; khi thiếu, UI dùng nội dung chung thay vì tự bịa ngày.
- Backend không lưu special requests; trường này không được gửi trong real mode.

## Kiểm tra

```powershell
npm run test:run
npm run build
git diff --check
```

`npm test` chạy Vitest ở watch mode; `npm run test:coverage` tạo báo cáo coverage local.

Checklist real mode thủ công:

1. Khởi động ba backend service và frontend với `VITE_USE_MOCK_API=false`.
2. Register → login → reload → xác nhận session được khôi phục.
3. Search → đổi filter/trang → mở detail với đúng ngày → kiểm tra unavailable dates/alternatives.
4. Checkout → result → reload trang kết quả theo booking ID; không double submit hoặc tự retry khi timeout.
5. My bookings → đổi filter/trang → hủy booking hợp lệ → kiểm tra lỗi quá hạn nếu có.
6. Notifications → đọc từng item → mark all và kiểm tra trạng thái lỗi một phần.
7. Admin → rooms → bookings → users → outbox; xác nhận trước thao tác thay đổi dữ liệu.

Không dùng Neon chung làm database test và không chạy checklist ghi dữ liệu trên hệ thống thật khi chưa có tài khoản/database test riêng.

## Cấu trúc chính

```text
src/
├── api/
│   ├── http/             # HTTP adapters và mapping real API
│   ├── mock/             # Mock adapter + persistent store
│   ├── client.js         # Fetch client, timeout, auth/error handling
│   └── index.js          # Facade chọn adapter theo env
├── components/           # Thành phần dùng lại
├── contexts/             # Auth và toast state
├── layouts/              # Customer/admin shells
├── pages/                # Customer và admin pages
├── routes/               # Protected/admin guards
├── styles/index.css      # Design system responsive
└── utils/                # Date, overlap, pricing, formatting
```

Giao diện phòng dùng minh họa SVG nội bộ từ `RoomVisual.jsx`, không phụ thuộc tài nguyên ảnh bên ngoài. Khi có ảnh được cấp quyền, có thể bổ sung field ảnh và giữ SVG làm fallback.

## Deploy Cloudflare Pages

Xem [docs/cloudflare-pages.md](docs/cloudflare-pages.md). Cấu hình cơ bản:

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

Không đưa `.env` thật hoặc secret vào repository hay cấu hình `VITE_*` của Cloudflare Pages.
