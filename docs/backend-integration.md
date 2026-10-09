# Backend integration

Tài liệu này ghi lại contract frontend đã đối chiếu read-only với repository `cloud-room-booking` ngày **09/10/2026**.

- Backend `origin/main`: `d9727cba5b55f94e6e9bacd7ca2b89f68bf576b2`.
- Backend `origin/fix/booking-ci-after-merge`: `7254e8f00f496a7211ff3c0500ede3242dce9788`.
- Nhánh fix chỉ sửa readiness và booking tests; public API contract giống `main`.
- Code router/controller/schema/service/repository là nguồn sự thật. `docs/api-contract.md` của backend còn ghi endpoint availability cũ.
- Audit không đổi backend, không chạy migration/seed và không kết nối Neon.

## Quy ước chung

- Public prefix: `/api/v1`; browser không gọi `/internal/v1/*`.
- Auth: `Authorization: Bearer <access_token>`.
- Thành công entity thường là `{ "data": entity }`.
- Collection có thể là `{ "data": [] }` hoặc `{ "data": [], "meta": {...} }`.
- Lỗi: `{ "error": { "code", "message", "details"? }, "request_id" }`.
- UI dùng camelCase; HTTP adapter map field snake_case và giữ nguyên metadata phân trang.
- Role/status backend dùng chữ hoa; adapter normalize về chữ thường cho giao diện.

## Bảng tích hợp

| Chức năng frontend | Endpoint backend | Request/response chính | Hỗ trợ |
| --- | --- | --- | --- |
| Register | `POST /api/v1/auth/register` | Strict `{email,password,full_name}`; trả user, không token | Hoàn tất; chuyển sang login, không auto-register lại |
| Login/session | `POST /auth/login`, `GET /users/me` | Login trả token; `/me` trả user | Hoàn tất, có restore/retry khi lỗi mạng |
| Search phòng | `GET /rooms/search` | `check_in`, `check_out`, `guests`, `room_type`, giá, page/limit; trả data+meta | Hoàn tất |
| Chi tiết phòng | `GET /rooms/:id` | Optional `check_in/check_out`; có `stay.available/total_price` | Hoàn tất |
| Ngày kín/phòng khác | `GET /rooms/:id/unavailable-dates`, `/alternatives` | Khoảng ngày và số khách | Hoàn tất |
| Tạo booking | `POST /bookings` | `Idempotency-Key`; strict body 4 field | Hoàn tất |
| Booking của tôi | `GET /bookings/me` | status/when/page/limit + meta | Hoàn tất |
| Hủy của khách | `POST /bookings/:id/cancel` | reason optional | Hoàn tất |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read` | Không có read-all | Hoàn tất; mark-all gọi từng item |
| Admin phòng | `POST/PATCH /admin/rooms/:id?` | Whitelist room schema | Hoàn tất trong giới hạn active-only |
| Admin booking | `GET /admin/bookings`, `POST /admin/bookings/:id/cancel` | Filter status/page/limit; reason bắt buộc | Hoàn tất một phần do bug filter backend |
| Admin users | `GET /admin/users`, `PATCH /admin/users/:id/status` | `ACTIVE` hoặc `LOCKED` | Hoàn tất |
| Admin outbox | `GET /admin/outbox`, `POST /admin/outbox/retry` | JWT admin; không body retry | Hoàn tất |

## Identity Service

| Endpoint | Contract |
| --- | --- |
| `POST /api/v1/auth/register` | Strict `{email,password,full_name}`; password 8–72, tên 2–100; trả `201 {data: User}` |
| `POST /api/v1/auth/login` | Strict `{email,password}`; trả token, không trả user |
| `GET /api/v1/users/me` | Trả user hiện tại |
| `GET /api/v1/admin/users` | Trả `{data: User[]}`, không pagination |
| `PATCH /api/v1/admin/users/:id/status` | Strict `{status:"ACTIVE"|"LOCKED"}` |

Frontend không gửi phone khi đăng ký real mode. Sau register thành công, UI chuyển sang login thay vì tự login trong cùng thao tác; vì vậy login lỗi không khiến người dùng đăng ký trùng.

Token được lưu để khôi phục phiên. Khi `/users/me` trả 401/403, frontend xóa phiên; khi chỉ lỗi mạng/timeout, token được giữ và route guard hiển thị nút thử lại.

## Rooms và availability

### Danh sách/search

- `GET /api/v1/rooms` chỉ trả phòng `active=true`, không kiểm tra availability và không có meta.
- `GET /api/v1/rooms/search` nhận:
  `check_in`, `check_out`, `guests`, `room_type`, `min_price`, `max_price`, `page`, `limit`.
- Search trả `{data,meta:{page,limit,total,check_in?,check_out?,nights?}}`.
- Cả hai ngày phải được gửi cùng nhau; tối đa 30 đêm và 20 khách.

Mapping room:

```text
room_type       -> type
size_sqm        -> size
bed_type        -> bed
view_label      -> view
equipment       -> amenities
active          -> isBookable
price_per_night -> pricePerNight
```

Adapter giữ đúng giá trị `0` và `false`; chỉ dùng placeholder trình bày khi field thật sự thiếu.

### Detail và lịch kín

- `GET /api/v1/rooms/:id?check_in&check_out` trả thêm `stay` với ngày, số đêm, tổng giá và availability.
- `GET /api/v1/rooms/:id/unavailable-dates?from&to` trả `booked_ranges` và `unavailable_dates`.
- `GET /api/v1/rooms/:id/alternatives?check_in&check_out&guests` trả khoảng thay thế cùng phòng và phòng khác.
- Khoảng lưu trú dùng quy ước nửa mở `[check-in, check-out)`: ngày checkout có thể là check-in của khách tiếp theo.
- Native date input không thể khóa chính xác từng ngày kín; UI hiển thị ngày kín và kiểm tra toàn khoảng bằng API.

### Admin room

Payload create/update chỉ gồm:

```text
room_number, name, room_type, price_per_night, capacity,
size_sqm, bed_type, view_label, floor, featured, description,
palette, equipment, active
```

Toggle gửi `{active:boolean}`. Backend chưa có `GET /api/v1/admin/rooms`; real mode chỉ hiển thị active rooms từ public list. Sau khi tắt một phòng, frontend không giả lập inventory inactive hoặc lưu local để “khôi phục”.

## Booking Service

### Create

`POST /api/v1/bookings` yêu cầu:

```http
Idempotency-Key: 8-128 ký tự [A-Za-z0-9._:-]
```

```json
{
  "room_id": "uuid",
  "check_in_date": "YYYY-MM-DD",
  "check_out_date": "YYYY-MM-DD",
  "guests": 2
}
```

Frontend không gửi `special_requests`. Một key gắn với đúng một payload: retry timeout/network giữ key cũ; payload thay đổi tạo key mới. Frontend không tự retry POST.

Kết quả mới trả 201; replay cùng key/payload trả 200. Các code quan trọng:

- `ROOM_UNAVAILABLE`
- `IDEMPOTENCY_KEY_REUSED`
- `GUESTS_EXCEED_CAPACITY`
- `VALIDATION_ERROR`
- `ROOM_NOT_FOUND`

Timeout/network được trình bày là “chưa xác định kết quả”, không khẳng định booking thất bại.

### List/detail/cancel

- `GET /api/v1/bookings/me`: default 10, max 50; filter `status`, `when`, `page`, `limit`.
- `GET /api/v1/admin/bookings`: default 20, max 100; filter `status`, `room_id`, `user_id`, page/limit.
- `GET /api/v1/bookings/:id`: ownership được backend kiểm tra và response có `can_cancel`.
- Customer cancel: reason optional; nếu gửi phải trim còn 2–300 ký tự.
- Admin cancel: reason bắt buộc 2–300 ký tự và dùng endpoint admin rõ ràng.
- Deadline khách: được phép đến đúng thời điểm 24 giờ trước 14:00 ngày check-in theo `Asia/Ho_Chi_Minh`; quá hạn trả `CANCELLATION_WINDOW_PASSED`.

Danh sách booking không có `can_cancel`; frontend dùng đúng cutoff trên làm fallback, backend vẫn quyết định cuối cùng.

### Blocker backend đã xác minh

Controller admin booking parse `room_id/user_id`, service truyền nguyên query, nhưng repository destructure `roomId/userId`. Vì vậy hai filter này hiện bị bỏ qua; `status/page/limit` vẫn hoạt động. UI chỉ bật filter trạng thái và ghi rõ blocker.

Pagination dùng window count. Khi page vượt phạm vi và trả mảng rỗng, backend trả `total:0`; UI vẫn cho quay lại trang trước và không suy diễn đây là tổng thật.

## Notification và outbox

- Notification chỉ có list và mark-read từng item; không gọi thử endpoint read-all không tồn tại.
- Mark-all dùng `Promise.allSettled`, tải lại danh sách và báo số item lỗi nếu chỉ thành công một phần.
- Booking commit không phụ thuộc việc notification hiển thị ngay. UI không nói booking thất bại nếu notification chậm/lỗi.
- Booking outbox gửi `check_in_date/check_out_date`, nhưng notification formatter hiện còn đọc field cũ `booking_date`; message có thể dùng câu fallback chung.
- Admin outbox list tối đa 200 event. Retry chỉ chạy khi admin xác nhận, không polling và không dùng service key từ browser.

## Cấu hình

Mock mode:

```env
VITE_USE_MOCK_API=true
```

Real mode local:

```env
VITE_USE_MOCK_API=false
VITE_IDENTITY_API_URL=http://localhost:3001
VITE_BOOKING_API_URL=http://localhost:3002
VITE_NOTIFICATION_API_URL=http://localhost:3003
VITE_API_TIMEOUT_MS=10000
```

Restart Vite sau khi đổi env. Không đặt JWT secret, internal service key, database URL/password hoặc token riêng tư vào `VITE_*`. Real mode không fallback sang mock khi lỗi.

Vitest luôn ép mock mode cho facade mặc định để không vô tình gọi service thật từ `.env` của developer. HTTP adapter real mode được test bằng mocked fetch theo response `{data,meta}` thật.

## Chạy kiểm tra

```powershell
npm ci
npm run test:run
npm run build
git diff --check
```

Checklist real mode thủ công chỉ nên chạy với database test riêng:

1. Register → login → reload → `/users/me` khôi phục session.
2. Search/filter/page → detail → unavailable dates/alternatives.
3. Checkout → result → reload booking ID → My Bookings.
4. Cancel hợp lệ/quá hạn → Notifications → mark-read/mark-all.
5. Admin Rooms → Bookings → Users → Outbox.

Không chạy migration/seed hoặc thao tác ghi trên Neon dùng chung để “sửa” frontend test.

## Chức năng để sau

- Payment/refund.
- Upload ảnh.
- Profile/phone/special requests.
- Refresh token/reset password.
- Admin list đầy đủ gồm phòng inactive.
- Thống kê tổng hệ thống hoặc doanh thu thực thu.
- Hai filter admin booking `room_id/user_id` sau khi backend sửa mismatch.
