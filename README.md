# CloudStay Frontend

CloudStay là repository **frontend riêng** cho đồ án đặt phòng khách sạn một cơ sở. Ứng dụng dùng React, Vite và JavaScript; backend (`identity-service`, `booking-service`, `notification-service`) nằm ở repository khác và không được chỉnh sửa trong dự án này.

Phiên bản hiện tại chạy đầy đủ bằng mock API trong trình duyệt. HTTP adapter cho API thật đã được tách riêng, nhưng **chưa thể coi là tích hợp nghiệp vụ khách sạn** vì backend hiện vẫn dùng mô hình đặt phòng học/phòng họp theo ngày và ca (`booking_date`, `slot_id`). Chi tiết nằm trong [docs/backend-integration.md](docs/backend-integration.md).

## Những gì đã hoàn thành

Luồng khách hàng:

- Trang chủ, form chọn ngày nhận/trả và số khách.
- Tìm phòng theo khoảng ngày `[check-in, check-out)`, sức chứa, hạng phòng và mức giá.
- Xem chi tiết, tiện nghi, chính sách, số đêm và tổng giá dự kiến.
- Đăng ký/đăng nhập, route bảo vệ và trang không có quyền.
- Xác nhận booking với khóa chống gửi trùng; xử lý riêng lỗi xung đột `409` và lỗi mạng/timeout.
- Trang kết quả và mã đặt phòng.
- Xem đơn của tôi, hủy đơn đủ điều kiện và trả lại phòng trống.
- Xem thông báo, đánh dấu từng thông báo hoặc tất cả là đã đọc.

Luồng admin:

- Dashboard tổng quan phòng, booking và doanh thu dự kiến.
- Danh sách phòng, thêm/sửa, bật hoặc ngừng nhận đặt.
- Danh sách booking, tìm/lọc và hủy kèm lý do.
- Guard frontend chỉ cho tài khoản admin truy cập. Đây chỉ là điều hướng giao diện; backend vẫn phải thực thi quyền thật.

Trạng thái giao diện có loading, lỗi, danh sách rỗng, validation, thành công; bố cục responsive cho desktop và điện thoại, có label, focus state, skip link và nội dung thay thế phù hợp cho minh họa phòng.

## Cài và chạy trên Windows PowerShell

Yêu cầu khuyến nghị: Node.js `22.16.0` (đã pin trong `.node-version`) và npm 10 trở lên.

```powershell
git clone <URL-do-ban-cung-cap>
Set-Location MiroCloudFE
Copy-Item .env.example .env
npm ci
npm run dev
```

Mở URL Vite in ra, mặc định là `http://localhost:5173`.

Không cần backend để chạy demo vì `.env.example` mặc định đặt `VITE_USE_MOCK_API=true`.

## Tài khoản demo

Các tài khoản sau **chỉ dùng trong mock mode**, không phải credential production:

| Vai trò | Email                | Mật khẩu    |
| ------- | -------------------- | ----------- |
| Khách   | `guest@cloudstay.vn` | `Guest123!` |
| Admin   | `admin@cloudstay.vn` | `Admin123!` |

Trang đăng nhập có nút điền nhanh từng tài khoản.

## Mock mode hoạt động ra sao

Mọi page chỉ gọi facade `src/api/index.js`; page không import dữ liệu mock trực tiếp. Khi `VITE_USE_MOCK_API=true`, facade chọn mock adapter có cùng interface với HTTP adapter.

Mock mode có:

- 6 phòng khác hạng, giá, sức chứa và tiện nghi.
- Tìm phòng thực theo ngày/số khách và loại các phòng có booking chồng lấn.
- Tạo booking, chống gửi trùng bằng `Idempotency-Key`, báo `409` khi phòng vừa được đặt.
- Đơn mới xuất hiện trong “Đơn của tôi”. Hủy đơn cập nhật trạng thái và mở lại khoảng ngày.
- Thông báo khi đặt/hủy và trạng thái đã đọc.
- CRUD/toggle phòng và danh sách booking cho admin.
- Dữ liệu demo được giữ trong `localStorage` với key `cloudstay.mock-db.v1`; session mock chỉ lưu hồ sơ người dùng, không lưu mật khẩu hay token.

Tài khoản tự đăng ký được đăng nhập ngay và session mock vẫn còn khi reload. Vì ứng dụng không lưu mật khẩu/verifier trong browser storage, tài khoản tự đăng ký không thể đăng nhập lại sau khi chủ động đăng xuất; hãy dùng hai tài khoản demo ở trên cho luồng đăng nhập lặp lại.

Để xóa dữ liệu demo, xóa hai key `cloudstay.mock-db.v1` và `cloudstay.mock-session.v1` trong Local Storage, hoặc xóa site data của `localhost`.

## Chuyển sang API thật

Tạo `.env` từ `.env.example`, sau đó đổi:

```text
VITE_USE_MOCK_API=false
VITE_IDENTITY_API_URL=http://localhost:3001
VITE_BOOKING_API_URL=http://localhost:3002
VITE_NOTIFICATION_API_URL=http://localhost:3003
VITE_API_TIMEOUT_MS=10000
```

Khởi động lại Vite sau khi đổi `.env`. Nếu thiếu URL khi tắt mock, ứng dụng dừng sớm với thông báo cấu hình rõ ràng.

HTTP client hiện hỗ trợ:

- Bearer access token lưu trong localStorage, reload tự khôi phục qua GET /users/me, hết hạn sau 1h phải login lại.
- Timeout, lỗi mạng, response JSON không hợp lệ, `401`, `403`, `409` và error envelope của backend.
- Không tự retry `POST /bookings`.
- Mapping `snake_case` ↔ `camelCase` tập trung trong adapter.

Tuy vậy, booking khách sạn thật còn chờ backend thống nhất `check_in_date`, `check_out_date`, số khách và pricing. Không bật real mode cho demo booking khách sạn cho tới khi các điểm trong [docs/backend-integration.md](docs/backend-integration.md) được giải quyết.

## Biến môi trường

| Biến                        | Mặc định mẫu            | Ý nghĩa                                                 |
| --------------------------- | ----------------------- | ------------------------------------------------------- |
| `VITE_USE_MOCK_API`         | `true`                  | Chọn mock adapter (`true`) hoặc HTTP adapter (`false`). |
| `VITE_IDENTITY_API_URL`     | `http://localhost:3001` | Origin của identity service.                            |
| `VITE_BOOKING_API_URL`      | `http://localhost:3002` | Origin của booking/room service.                        |
| `VITE_NOTIFICATION_API_URL` | `http://localhost:3003` | Origin của notification service.                        |
| `VITE_API_TIMEOUT_MS`       | `10000`                 | Timeout request real API theo mili giây.                |

Mọi biến `VITE_*` được đóng gói vào JavaScript và **công khai trong trình duyệt**. Không đặt database password, service key, JWT signing secret, private token hoặc secret production vào các biến này.

## Script

```powershell
npm ci
npm run dev
npm run test:run
npm run build
npm run preview
```

`npm test` chạy Vitest ở watch mode. `npm run test:coverage` tạo báo cáo coverage local.

Test hiện bao phủ validation ngày, số đêm/tổng giá, khoảng ngày chồng lấn, booking → hủy → mở lại availability, lỗi `409`, idempotency, notification, HTTP mapping/client và admin mock flow.

## Cấu trúc chính

```text
src/
├── api/
│   ├── http/             # HTTP adapters và mapping real API
│   ├── mock/             # Mock adapter + persistent store
│   ├── client.js         # Fetch client, timeout, auth/error handling
│   └── index.js          # Facade chọn adapter theo env
├── components/
│   ├── bookings/
│   ├── common/
│   └── rooms/
├── contexts/             # Auth và toast state
├── data/                 # Seed data demo
├── layouts/              # Customer/admin shells
├── pages/                # Customer pages và pages/admin
├── routes/               # Protected/admin guards
├── styles/index.css      # Design system responsive thuần CSS
└── utils/                # Date, overlap, pricing, formatting
```

Các file quan trọng:

- `src/App.jsx`: toàn bộ route khách hàng và admin.
- `src/api/index.js`: điểm vào duy nhất của data layer.
- `src/api/mock/mockAdapter.js`: nghiệp vụ demo có trạng thái.
- `src/api/http/`: mapping giả định cho contract khách sạn tương lai.
- `src/components/rooms/RoomVisual.jsx`: minh họa SVG tự tạo trong code, không phụ thuộc ảnh bên ngoài.
- `src/styles/index.css`: toàn bộ responsive design và trạng thái tương tác.

## Ảnh phòng

Phiên bản đầu dùng minh họa SVG tự tạo trong `RoomVisual.jsx`, màu sắc lấy từ trường `palette` của từng phòng. Không có ảnh bên ngoài hoặc tài nguyên có bản quyền được commit.

Khi có ảnh đã được cấp quyền, nên thêm vào `src/assets/rooms/`, thêm field `images` vào model phòng/adapters, rồi đổi `RoomVisual` thành component `<picture>` có kích thước cố định, `alt` theo tên/hướng phòng và fallback về SVG hiện tại.

## Deploy Cloudflare Pages

Hướng dẫn chi tiết và checklist nằm trong [docs/cloudflare-pages.md](docs/cloudflare-pages.md). Cấu hình cơ bản:

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

Không có thao tác deploy hoặc kết nối tài khoản Cloudflare nào được thực hiện trong repository này.

## Phần còn chờ backend

- Contract khách sạn theo khoảng ngày, sức chứa và giá.
- Availability cho cả khoảng `[check-in, check-out)`.
- Admin list có cả phòng ngừng hoạt động.
- Booking detail endpoint hoặc response create/list thống nhất.
- Quy tắc thời hạn hủy do server thực thi.
- Refresh token nếu muốn giữ đăng nhập sau reload ở real mode.
- CORS cho đúng origin frontend Cloudflare Pages/preview.

Xem bảng mapping và bằng chứng contract hiện tại trong [docs/backend-integration.md](docs/backend-integration.md).
