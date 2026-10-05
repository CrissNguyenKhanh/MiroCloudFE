# Backend integration

Tài liệu này ghi lại việc đối chiếu read-only với backend repository `cloud-room-booking` ngày **05/10/2026**. Không file backend nào bị chỉnh sửa.

## Kết luận

Backend hiện là hệ thống đặt **phòng học/phòng họp theo ngày và ca**, chưa phải booking khách sạn theo kỳ lưu trú. Vì vậy frontend mặc định dùng mock mode hoàn chỉnh và không tuyên bố đã tích hợp booking khách sạn thật.

Booking backend hiện yêu cầu:

```json
{
  "room_id": "uuid",
  "slot_id": "uuid",
  "booking_date": "YYYY-MM-DD"
}
```

Frontend CloudStay cần tối thiểu:

```json
{
  "room_id": "uuid",
  "check_in_date": "YYYY-MM-DD",
  "check_out_date": "YYYY-MM-DD",
  "guests": 2
}
```

Hai contract này không thể map an toàn chỉ bằng đổi tên field. Backend cần hỗ trợ nghiệp vụ khoảng ngày, sức chứa và pricing trước khi bật real mode cho luồng khách sạn.

## Quy ước đã xác minh

- Public API prefix: `/api/v1`.
- Service-to-service prefix: `/internal/v1`.
- Success response chủ yếu bọc trong `{ "data": ... }`.
- Error response: `{ "error": { "code", "message", "details"? }, "request_id" }`.
- Identity chạy cổng `3001`, Booking `3002`, Notification `3003` trong compose local.
- Auth header: `Authorization: Bearer <access_token>`.
- JWT dùng HS256 với claim `sub`, `role`, `status`; backend kiểm tra issuer/audience.
- Role backend: `USER | ADMIN`; user status: `ACTIVE | LOCKED`.
- Không có refresh-token hoặc logout endpoint.

HTTP client frontend đã hỗ trợ success/error envelope trên và normalize role/status về chữ thường cho UI.

## Identity service

| Endpoint hiện tại | Request | Response/ghi chú |
| --- | --- | --- |
| `POST /api/v1/auth/register` | `email`, `password` 8–72 ký tự, `full_name` 2–100 | `201 {data: User}`; không trả token. Frontend real adapter login tiếp bằng credential vừa gửi. |
| `POST /api/v1/auth/login` | `email`, `password` | `{data:{access_token,token_type:"Bearer",expires_in:"1h"}}`. |
| `GET /api/v1/users/me` | Bearer token | `{data: User}`. Frontend gọi sau login vì login không trả user. |
| `GET /api/v1/admin/users` | Admin JWT | `{data: User[]}`. Chưa dùng trong UI hiện tại. |
| `PATCH /api/v1/admin/users/:id/status` | `{status:"ACTIVE"|"LOCKED"}` | Quản lý trạng thái user. |

`User` hiện có `id`, `email`, `full_name`, `role`, `status`, `created_at`, `updated_at`; không có phone.

Admin chỉ được seed nếu backend cấu hình `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`; không nên giả định luôn tồn tại ở môi trường thật.

## Booking/room service hiện tại

### Public

| Endpoint hiện tại | Ghi chú |
| --- | --- |
| `GET /api/v1/rooms` | Chỉ trả phòng `active=true`; Room không có giá/loại/ảnh/mô tả. |
| `GET /api/v1/rooms/:id` | Chỉ lấy phòng active. |
| `GET /api/v1/availability?room_id=<uuid>&date=YYYY-MM-DD` | Trả một phòng, một ngày và danh sách slot. |
| `POST /api/v1/bookings` | JWT + `Idempotency-Key`; body chỉ có `room_id`, `slot_id`, `booking_date`. |
| `GET /api/v1/bookings/me` | Booking của user trong JWT. |
| `POST /api/v1/bookings/:id/cancel` | Body `{reason}` dài 2–300. |

Conflict phòng/ngày/ca trả `409 ROOM_SLOT_CONFLICT`. Dùng lại idempotency key với payload khác trả `409 IDEMPOTENCY_KEY_REUSED`. Key phải dài 8–128 và chỉ dùng `[A-Za-z0-9._:-]`.

`Room` hiện có:

```text
id, name, capacity, equipment, active, created_at, updated_at
```

`Booking` hiện có:

```text
id, room_id, user_id, booking_date, slot_id, status,
cancel_reason, idempotency_key, request_hash, created_at, updated_at
```

Status chỉ có `CONFIRMED | CANCELLED`.

### Admin

- `POST /api/v1/admin/rooms`
- `PATCH /api/v1/admin/rooms/:id`
- `GET /api/v1/admin/bookings`
- `POST /api/v1/admin/bookings/:id/cancel`
- `GET /api/v1/admin/outbox`
- `POST /api/v1/admin/outbox/retry`

Backend **chưa có** `GET /api/v1/admin/rooms`. Sau khi room bị `active=false`, public list cũng ẩn room đó, nên admin frontend không thể tải lại inventory đầy đủ bằng API thật.

## Notification service

| Endpoint hiện tại | Ghi chú |
| --- | --- |
| `GET /api/v1/notifications` | Chỉ trả notification của `sub` trong JWT. |
| `PATCH /api/v1/notifications/:id/read` | Không cần body; backend lọc theo cả `id` và `user_id`. |
| `POST /internal/v1/events` | Dùng `X-Service-Key`; không gọi từ browser. |

Notification shape:

```text
id, event_id, user_id, type, payload, read_at, created_at
```

Frontend suy ra `read = read_at !== null` và lấy `title/message` từ payload nếu cần. Backend chưa có `read-all`; HTTP adapter thử endpoint tương lai rồi fallback sang gọi `markRead` cho từng thông báo khi nhận `404/405`.

Event type hiện có `BOOKING_CREATED | BOOKING_CANCELLED`.

## Mapping HTTP adapter của frontend

| Facade UI | Endpoint giả định/hiện tại | Trạng thái |
| --- | --- | --- |
| `identity.login` | `POST /api/v1/auth/login`, rồi `GET /api/v1/users/me` | Phù hợp contract hiện tại. |
| `identity.register` | `POST /api/v1/auth/register`, rồi login | Phù hợp field hiện tại; phone không gửi. |
| `rooms.search` | `GET /api/v1/rooms` với filter khách sạn | Endpoint tồn tại, nhưng backend bỏ qua/không hỗ trợ filter khoảng ngày, giá, loại. |
| `rooms.getById` | `GET /api/v1/rooms/:id` | Endpoint tồn tại, thiếu field hiển thị khách sạn. |
| `rooms.adminList` | `GET /api/v1/admin/rooms` | Backend chưa có. |
| `rooms.create/update/toggleBookable` | Admin room endpoints | Endpoint có nhưng DTO chỉ hỗ trợ `name`, `capacity`, `equipment`, `active`. |
| `bookings.create` | `POST /api/v1/bookings` | **Không tương thích**: frontend cần check-in/out/guests, backend cần date/slot. |
| `bookings.mine` | `GET /api/v1/bookings/me` | Endpoint có, response thiếu kỳ lưu trú/giá. |
| `bookings.getById` | `GET /api/v1/bookings/:id` | Backend chưa có public detail endpoint. |
| `bookings.adminList/cancel` | Admin booking endpoints | Endpoint có, DTO/shape vẫn là booking theo slot. |
| `notifications.mine/markRead` | Notification endpoints hiện tại | Có thể map được. |
| `notifications.markAllRead` | `PATCH /api/v1/notifications/read-all` | Backend chưa có; adapter có fallback từng item. |

## Contract cần thống nhất với nhóm backend

Ưu tiên theo thứ tự:

1. `Room`: thêm `room_number`, `type`, `price_per_night`, `capacity`, `size`, `bed`, `view`, `description`, `amenities`, `images`, `is_bookable`.
2. Availability theo khoảng `[check_in_date, check_out_date)` và `guests`, trả danh sách phòng phù hợp.
3. `POST /bookings`: nhận room, check-in/out, guests, special requests và `Idempotency-Key`; backend tự kiểm tra overlap trong transaction.
4. Booking response: `id`, code, dates, guests, nights, nightly rate snapshot, total price authoritative, status, nested/snapshot room.
5. Quy tắc hủy: thời hạn, actor, reason, trạng thái chuyển đổi và error code rõ ràng.
6. `GET /api/v1/bookings/:id` có ownership; `GET /api/v1/admin/rooms` gồm cả room ngừng nhận đặt.
7. Pagination/filter thống nhất cho room, booking, user, notification.
8. Quyết định endpoint mark-all notification hoặc giữ fallback client.
9. CORS allowlist cho production origin và preview origins của Cloudflare Pages.

Chỉ sau khi các mục 1–5 có contract/version rõ ràng mới nên đổi `VITE_USE_MOCK_API=false` cho demo booking khách sạn.

## Bảo mật và giới hạn đã biết

- Frontend route guard chỉ cải thiện UX; backend phải kiểm tra JWT/role/ownership trên mọi endpoint.
- Access token real mode chỉ giữ trong memory. Reload sẽ yêu cầu login lại cho tới khi backend có refresh-token an toàn.
- Không đặt service key hoặc JWT secret trong biến `VITE_*`.
- Browser không được gọi `/internal/v1/*`.
- Không retry mù `POST /bookings`; khi người dùng thử lại cùng lần xác nhận, giữ nguyên idempotency key.
- Timeout/network error không đồng nghĩa booking thất bại hay thành công; UI nói rõ trạng thái chưa được xác nhận.

## Vị trí contract đã đối chiếu trong backend

- `services/identity-service/src/routes/index.js`
- `services/identity-service/src/services/identity-service.js`
- `services/identity-service/src/repositories/user-repository.js`
- `services/identity-service/src/middleware/auth.js`
- `services/booking-service/src/routes/index.js`
- `services/booking-service/src/controllers/booking-controller.js`
- `services/booking-service/src/repositories/booking-repository.js`
- `services/booking-service/db/migrations/001_create_booking_schema.sql`
- `services/notification-service/src/routes/index.js`
- `docs/api-contract.md`
- `compose.yaml`
