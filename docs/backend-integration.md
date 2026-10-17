# Backend integration

Tài liệu này ghi lại contract frontend đã đối chiếu read-only với repository `cloud-room-booking` ngày **17/10/2026**.

- Backend branch: `chore/docker-local-isolated`.
- Backend commit tích hợp được đối chiếu: `c2a1e93`.
- Source router/controller/service/repository/test tại commit trên là nguồn sự thật.
- Audit không đổi backend, không chạy migration/seed và không thực hiện mutation trên Render/Neon.

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
| Payment MOCK | `POST /bookings/:id/payments`, `GET /bookings/:id/payment` | JWT, Idempotency-Key; provider `MOCK` | Hoàn tất; có reconciliation sau trạng thái chưa xác định |
| Public review | `GET /rooms/:id/reviews` | data, meta, summary; chỉ review visible | Hoàn tất |
| Review của khách | booking review, `/reviews/me`, update/delete | ownership, eligibility, mỗi booking một review | Hoàn tất |
| Admin review | `GET/PATCH /admin/reviews...` | filter và moderation status | Hoàn tất |
| Public media | `GET /rooms/:id/media` | ảnh/video theo cover và sort order | Hoàn tất; có fallback khi rỗng/lỗi ảnh |
| Admin media | `/admin/rooms/:id/media...` | multipart upload/replace; metadata update/delete | Hoàn tất; Cloudinary thật chưa E2E |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read` | Không có read-all | Hoàn tất; mark-all gọi từng item |
| Admin phòng | `GET/POST/PATCH /admin/rooms/:id?` | Inventory active/inactive; whitelist room schema | Hoàn tất |
| Admin booking | `GET /admin/bookings`, `POST /admin/bookings/:id/cancel` | Filter status/room/user/page/limit; reason bắt buộc | Hoàn tất |
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

Toggle gửi `{active:boolean}`. `GET /api/v1/admin/rooms` trả inventory gồm cả phòng active/inactive; real mode không lấy mock inventory thay thế.

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

Admin booking hỗ trợ `status`, `room_id`, `user_id`, `page`, `limit`. Pagination dùng metadata backend; UI không suy diễn thống kê toàn hệ thống từ riêng trang đang tải.

Booking mapping giữ `payment_status`, `can_review`, `review_id` và `can_cancel`. Dù dữ liệu cũ có `can_cancel=true`, frontend vẫn không đưa thao tác hủy khi payment đã `SUCCEEDED`; backend là lớp bảo vệ cuối cùng.

## Payment MOCK

Payment là mô phỏng nghiệp vụ, không phải VNPay/MoMo/ngân hàng và không có refund hoặc webhook.

```http
POST /api/v1/bookings/:id/payments
Authorization: Bearer <JWT>
Idempotency-Key: <8-128 ký tự>
Content-Type: application/json

{"provider":"MOCK"}
```

- `GET /api/v1/bookings/:id/payment` dùng để đọc/reconcile trạng thái; chưa có payment trả `data: null`.
- Frontend không gửi amount. Backend lấy số tiền authoritative từ booking.
- Double-click bị khóa đồng bộ ở UI. Timeout/network không tự retry POST và không khẳng định thất bại.
- Retry cùng intent giữ nguyên key; người dùng được hướng dẫn GET trạng thái trước.
- Trạng thái normalize về `unpaid`, `pending`, `succeeded`, `failed`.
- Booking cancelled không được thanh toán; booking paid không có thao tác hủy.

## Review và rating

| Quyền | Endpoint |
| --- | --- |
| Public | `GET /api/v1/rooms/:id/reviews` |
| Customer | `POST /bookings/:id/review`, `GET /bookings/:id/review`, `GET /reviews/me`, `PATCH/DELETE /reviews/:id` |
| Admin | `GET /admin/reviews`, `PATCH /admin/reviews/:id/status` |

Public response chỉ chứa review `VISIBLE`, summary/distribution và không lộ `user_id`. Backend quyết định ownership, booking eligibility, ngày checkout và quy tắc một review/booking. Rating hợp lệ 1–5. Chính sách hiện tại không bắt buộc payment succeeded để review; frontend không thêm hạn chế riêng.

My Bookings dùng `can_review`/`review_id` từ booking và chỉ gọi `GET /bookings/:id/review` cho tối đa các booking đủ điều kiện trên trang hiện tại. Cách này tránh kết luận sai do chỉ tải 50 review đầu tiên, đồng thời giới hạn số request theo page size.

## Room Media

| Quyền | Method và endpoint |
| --- | --- |
| Public | `GET /api/v1/rooms/:id/media` |
| Admin | `GET/POST /api/v1/admin/rooms/:id/media` |
| Admin | `PUT /api/v1/admin/rooms/:id/media/:mediaId/file` |
| Admin | `PATCH/DELETE /api/v1/admin/rooms/:id/media/:mediaId` |

Public mapping giữ URL, thumbnail, loại media, alt text, thứ tự, cover, kích thước và thời lượng; không phụ thuộc `public_id`. Gallery ưu tiên cover/sort order, dùng HTML5 video controls không autoplay và fallback sang RoomVisual khi collection rỗng hoặc ảnh lỗi.

Upload/replace gửi `multipart/form-data` với `file` và optional `alt_text`. Client để browser tự tạo boundary, vẫn gắn Bearer token và giữ timeout/error envelope. Validation phía UI khớp mặc định backend: JPEG/PNG/WebP tối đa 5 MB, MP4/WebM tối đa 30 MB, 20 media/phòng, alt text 200 ký tự, sort order 1–10000 và chỉ ảnh được làm cover.

Replace/delete giữ top-level `storage_cleanup_pending`. Khi flag là true, UI báo mutation dữ liệu đã thành công nhưng việc dọn storage còn chờ xử lý. `MEDIA_NOT_CONFIGURED` được trình bày là cấu hình server còn thiếu; frontend không nhận Cloudinary secret.

## Notification và outbox

- Notification chỉ có list và mark-read từng item; không gọi thử endpoint read-all không tồn tại.
- Mark-all dùng `Promise.allSettled`, tải lại danh sách và báo số item lỗi nếu chỉ thành công một phần.
- Booking commit không phụ thuộc việc notification hiển thị ngay. UI không nói booking thất bại nếu notification chậm/lỗi.
- Booking outbox gửi `check_in_date/check_out_date`, nhưng notification formatter hiện còn đọc field cũ `booking_date`; message có thể dùng câu fallback chung.
- Admin outbox list tối đa 200 event. Retry chỉ chạy khi admin xác nhận, không polling và không dùng service key từ browser.

## Cấu hình

Real Render mode (giá trị public, dùng ở build time):

```env
VITE_USE_MOCK_API=false
VITE_IDENTITY_API_URL=https://cloudstay-docker-identity.onrender.com
VITE_BOOKING_API_URL=https://cloudstay-docker-booking.onrender.com
VITE_NOTIFICATION_API_URL=https://cloudstay-docker-notification.onrender.com
VITE_API_TIMEOUT_MS=30000
```

Mock mode offline có thể đặt riêng trong `.env.local`:

```env
VITE_USE_MOCK_API=true
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
3. Checkout → result → Payment MOCK → reconcile → My Bookings.
4. Review đủ điều kiện → My Reviews → public rating/summary.
5. Cancel hợp lệ/quá hạn → Notifications → mark-read/mark-all.
6. Admin Rooms → Media CRUD → Bookings → Reviews → Users → Outbox.

Không chạy migration/seed hoặc thao tác ghi trên Neon dùng chung để “sửa” frontend test.

## Giới hạn còn lại

- Không có payment tiền thật, refund hoặc webhook; Payment chỉ là provider `MOCK`.
- Upload Cloudinary thật chưa được chạy trong audit read-only vì cần admin credential và cấu hình server; adapter/UI được kiểm thử bằng mock.
- Chưa có profile/phone/special requests, refresh token hoặc reset password.
- Không có API doanh thu/thống kê toàn hệ thống; dashboard không bịa số liệu.
- Notification mark-all vẫn gọi từng item; outbox retry cần admin kích hoạt.
- Render hiện allow CORS/WebSocket origin `https://cloudstay-docker-fe.pages.dev`, không khớp frontend tham chiếu `https://mirocloudfe.pages.dev`; cần sửa cấu hình deployment trước khi Real API chạy được trong browser.
