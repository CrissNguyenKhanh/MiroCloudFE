import { DEMO_ACCOUNTS } from "../../data/mockData";
import {
  addDays,
  calculateNights,
  canCustomerCancel,
  rangesOverlap,
  todayISO,
  validateStay,
} from "../../utils/date";
import { isReviewableBooking, REVIEW_LIMITS } from "../../utils/review";
import { ApiError } from "../errors";
import { clearApiSession, getApiSession, setApiSession } from "../session";
import { readMockState, resetMockState, updateMockState } from "./store";

const registeredCredentials = new Map();
const ACTIVE_BOOKING_STATUSES = new Set(["pending", "confirmed"]);
const MOCK_MEDIA_TYPES = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);
const MOCK_MEDIA_LIMITS = {
  image: 5 * 1024 * 1024,
  video: 30 * 1024 * 1024,
  count: 20,
};

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function apiError(message, status, code, details) {
  return new ApiError(message, { status, code, details });
}

function requireUser() {
  const user = getApiSession().user;
  if (!user) {
    throw apiError("Vui lòng đăng nhập để tiếp tục.", 401, "AUTH_REQUIRED");
  }
  return user;
}

function requireAdmin() {
  const user = requireUser();
  if (user.role !== "admin") {
    throw apiError(
      "Bạn không có quyền thực hiện thao tác này.",
      403,
      "ADMIN_REQUIRED",
    );
  }
  return user;
}

function findRoom(state, roomId) {
  const room = state.rooms.find(({ id }) => id === roomId);
  if (!room) throw apiError("Không tìm thấy phòng.", 404, "ROOM_NOT_FOUND");
  return room;
}

function findBooking(state, bookingId) {
  const booking = state.bookings.find(({ id }) => id === bookingId);
  if (!booking)
    throw apiError("Không tìm thấy đơn đặt phòng.", 404, "BOOKING_NOT_FOUND");
  return booking;
}

function ensureBookingAccess(booking, user) {
  if (user.role !== "admin" && booking.userId !== user.id) {
    throw apiError(
      "Bạn không có quyền xem đơn đặt phòng này.",
      403,
      "BOOKING_FORBIDDEN",
    );
  }
}

function compareNewest(first, second) {
  return String(second.createdAt ?? "").localeCompare(
    String(first.createdAt ?? ""),
  );
}

function collection(data, meta = null) {
  return { data: clone(data), meta: clone(meta) };
}

function paginated(data, filters = {}, defaultLimit = 10) {
  const requestedPage = Number(filters.page);
  const requestedLimit = Number(filters.limit);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : defaultLimit;
  const start = (page - 1) * limit;
  return collection(data.slice(start, start + limit), {
    page,
    limit,
    total: data.length,
  });
}

function latestPayment(state, bookingId) {
  return (state.payments ?? [])
    .filter((payment) => payment.bookingId === bookingId)
    .sort(compareNewest)[0] ?? null;
}

function paymentStatusFor(state, bookingId) {
  return latestPayment(state, bookingId)?.status ?? "unpaid";
}

function canCancelBooking(state, booking, { asAdmin = false } = {}) {
  return (
    ACTIVE_BOOKING_STATUSES.has(booking.status) &&
    paymentStatusFor(state, booking.id) !== "succeeded" &&
    (asAdmin || canCustomerCancel(booking))
  );
}

// Mirrors backend ReviewService.reviewState: attached to booking detail only.
function reviewStateFor(state, booking) {
  const review = state.reviews.find(
    ({ bookingId }) => bookingId === booking.id,
  );
  return {
    canReview: !review && isReviewableBooking(booking),
    reviewId: review?.id ?? null,
  };
}

function presentBooking(
  state,
  booking,
  {
    includeUser = false,
    allowAdminCancellation = false,
    includeReviewState = false,
  } = {},
) {
  const room = state.rooms.find(({ id }) => id === booking.roomId) ?? null;
  const user = includeUser
    ? (state.users.find(({ id }) => id === booking.userId) ?? null)
    : undefined;

  return clone({
    ...booking,
    room,
    paymentStatus: paymentStatusFor(state, booking.id),
    ...(includeUser ? { user } : {}),
    canCancel: canCancelBooking(state, booking, {
      asAdmin: allowAdminCancellation,
    }),
    ...(includeReviewState ? reviewStateFor(state, booking) : {}),
  });
}

function hasBookingConflict(
  state,
  roomId,
  checkInDate,
  checkOutDate,
  ignoredBookingId,
) {
  return state.bookings.some(
    (booking) =>
      booking.id !== ignoredBookingId &&
      booking.roomId === roomId &&
      ACTIVE_BOOKING_STATUSES.has(booking.status) &&
      rangesOverlap(
        checkInDate,
        checkOutDate,
        booking.checkInDate,
        booking.checkOutDate,
      ),
  );
}

function validateDatePair(filters) {
  const checkIn = filters.checkIn ?? filters.checkInDate;
  const checkOut = filters.checkOut ?? filters.checkOutDate;

  if (!checkIn && !checkOut) return { checkIn: null, checkOut: null };

  const errors = validateStay({
    checkIn,
    checkOut,
    guests: filters.guests ?? 1,
    minDate: filters.minDate ?? todayISO(),
  });
  if (Object.keys(errors).length) {
    throw apiError(
      "Thông tin tìm kiếm chưa hợp lệ.",
      400,
      "VALIDATION_ERROR",
      errors,
    );
  }

  return { checkIn, checkOut };
}

function roomMatchesText(room, query) {
  if (!query) return true;
  const haystack = [
    room.name,
    room.roomNumber,
    room.type,
    room.view,
    ...(room.amenities ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase("vi");
  return haystack.includes(String(query).trim().toLocaleLowerCase("vi"));
}

function readRoomFilters(filters = {}, { admin = false } = {}) {
  const guests =
    filters.guests === undefined || filters.guests === ""
      ? null
      : Number(filters.guests);
  const minPrice =
    filters.minPrice === undefined || filters.minPrice === ""
      ? null
      : Number(filters.minPrice);
  const maxPrice =
    filters.maxPrice === undefined || filters.maxPrice === ""
      ? null
      : Number(filters.maxPrice);

  if (guests !== null && (!Number.isInteger(guests) || guests < 1)) {
    throw apiError(
      "Số khách phải là số nguyên dương.",
      400,
      "VALIDATION_ERROR",
      {
        guests: "Số khách phải là số nguyên dương.",
      },
    );
  }
  if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) {
    throw apiError("Mức giá tối thiểu không hợp lệ.", 400, "VALIDATION_ERROR", {
      minPrice: "Mức giá tối thiểu không hợp lệ.",
    });
  }
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    throw apiError("Mức giá tối đa không hợp lệ.", 400, "VALIDATION_ERROR", {
      maxPrice: "Mức giá tối đa không hợp lệ.",
    });
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw apiError("Khoảng giá chưa hợp lệ.", 400, "VALIDATION_ERROR", {
      maxPrice: "Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.",
    });
  }

  const dates = admin
    ? { checkIn: null, checkOut: null }
    : validateDatePair({ ...filters, guests: guests ?? 1 });
  return { guests, minPrice, maxPrice, ...dates };
}

function filterRooms(state, filters = {}, options = {}) {
  const { guests, minPrice, maxPrice, checkIn, checkOut } = readRoomFilters(
    filters,
    options,
  );
  const type = normalizeText(filters.roomType ?? filters.type).toLowerCase();
  const requestedBookable =
    filters.isBookable === undefined || filters.isBookable === ""
      ? null
      : filters.isBookable === true || filters.isBookable === "true";

  return state.rooms.filter((room) => {
    if (!options.admin && !room.isBookable) return false;
    if (
      options.admin &&
      requestedBookable !== null &&
      room.isBookable !== requestedBookable
    )
      return false;
    if (
      filters.featured !== undefined &&
      room.featured !==
        (filters.featured === true || filters.featured === "true")
    )
      return false;
    if (type && room.type.toLowerCase() !== type) return false;
    if (guests !== null && room.capacity < guests) return false;
    if (minPrice !== null && room.pricePerNight < minPrice) return false;
    if (maxPrice !== null && room.pricePerNight > maxPrice) return false;
    if (!roomMatchesText(room, filters.query ?? filters.search)) return false;
    if (checkIn && hasBookingConflict(state, room.id, checkIn, checkOut))
      return false;
    return true;
  });
}

function validateRoomPayload(payload, { partial = false } = {}) {
  const errors = {};
  const name = normalizeText(payload.name);
  const roomNumber = normalizeText(payload.roomNumber);
  const type = normalizeText(payload.type).toLowerCase();
  const pricePerNight = Number(payload.pricePerNight);
  const capacity = Number(payload.capacity);

  if (!partial || payload.name !== undefined) {
    if (!name) errors.name = "Vui lòng nhập tên phòng.";
  }
  if (!partial || payload.roomNumber !== undefined) {
    if (!roomNumber) errors.roomNumber = "Vui lòng nhập số phòng.";
  }
  if (!partial || payload.type !== undefined) {
    if (!type) errors.type = "Vui lòng chọn loại phòng.";
  }
  if (!partial || payload.pricePerNight !== undefined) {
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) {
      errors.pricePerNight = "Giá mỗi đêm phải lớn hơn 0.";
    }
  }
  if (!partial || payload.capacity !== undefined) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      errors.capacity = "Sức chứa phải là số nguyên dương.";
    }
  }
  if (payload.amenities !== undefined && !Array.isArray(payload.amenities)) {
    errors.amenities = "Danh sách tiện nghi không hợp lệ.";
  }

  if (Object.keys(errors).length) {
    throw apiError(
      "Thông tin phòng chưa hợp lệ.",
      400,
      "VALIDATION_ERROR",
      errors,
    );
  }

  return {
    ...(payload.name !== undefined || !partial ? { name } : {}),
    ...(payload.roomNumber !== undefined || !partial ? { roomNumber } : {}),
    ...(payload.type !== undefined || !partial ? { type } : {}),
    ...(payload.pricePerNight !== undefined || !partial
      ? { pricePerNight }
      : {}),
    ...(payload.capacity !== undefined || !partial ? { capacity } : {}),
  };
}

function makeNotification(userId, { title, message, type }) {
  return {
    id: createId("notification"),
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function bookingFingerprint(payload) {
  return JSON.stringify({
    roomId: payload.roomId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
    guests: payload.guests,
  });
}

function normalizeBookingPayload(payload = {}) {
  return {
    roomId: normalizeText(payload.roomId),
    checkInDate: payload.checkInDate ?? payload.checkIn,
    checkOutDate: payload.checkOutDate ?? payload.checkOut,
    guests: Number(payload.guests),
    specialRequests: normalizeText(payload.specialRequests),
  };
}

async function cancelMockBooking(
  bookingId,
  options = {},
  { admin = false } = {},
) {
  const user = admin ? requireAdmin() : requireUser();
  const reason = normalizeText(
    typeof options === "string" ? options : options.reason,
  );
  if (admin && reason.length < 2) {
    throw apiError("Vui lòng nhập lý do hủy.", 400, "VALIDATION_ERROR", {
      reason: "required",
    });
  }
  let cancelledBooking;

  updateMockState((state) => {
    const booking = findBooking(state, bookingId);
    if (!admin && booking.userId !== user.id) {
      throw apiError(
        "Bạn không có quyền hủy đơn đặt phòng này.",
        403,
        "BOOKING_FORBIDDEN",
      );
    }
    if (booking.status === "cancelled") {
      cancelledBooking = booking;
      return state;
    }
    if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) {
      throw apiError(
        "Đơn này không còn có thể hủy.",
        409,
        "BOOKING_NOT_CANCELLABLE",
      );
    }
    if (paymentStatusFor(state, booking.id) === "succeeded") {
      throw apiError(
        "Đặt phòng đã thanh toán, cần hoàn tiền trước khi hủy",
        409,
        "PAID_BOOKING_CANNOT_CANCEL",
      );
    }
    if (!admin && !canCustomerCancel(booking)) {
      throw apiError(
        "Đã quá thời hạn hủy đơn này.",
        409,
        "CANCELLATION_WINDOW_PASSED",
      );
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    booking.cancelledBy = user.id;
    booking.cancellationReason = reason || null;
    cancelledBooking = booking;

    const room = state.rooms.find(({ id }) => id === booking.roomId);
    state.notifications.push(
      makeNotification(booking.userId, {
        title: "Đã hủy đặt phòng",
        message: `Đơn ${booking.code}${room ? ` cho phòng ${room.name}` : ""} đã được hủy.`,
        type: "booking_cancelled",
      }),
    );
    return state;
  });

  return presentBooking(readMockState(), cancelledBooking, {
    includeUser: admin,
    allowAdminCancellation: admin,
  });
}

function validateReviewPayload(payload = {}, { partial = false } = {}) {
  const errors = {};
  const values = {};

  if (!partial || payload.rating !== undefined) {
    const rating = Number(payload.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.rating = "Điểm đánh giá phải từ 1 đến 5 sao.";
    } else {
      values.rating = rating;
    }
  }
  if (!partial || payload.title !== undefined) {
    const title = normalizeText(payload.title);
    if (title.length > REVIEW_LIMITS.title)
      errors.title = `Tiêu đề tối đa ${REVIEW_LIMITS.title} ký tự.`;
    else values.title = title;
  }
  if (!partial || payload.comment !== undefined) {
    const comment = normalizeText(payload.comment);
    if (comment.length > REVIEW_LIMITS.comment)
      errors.comment = `Nội dung tối đa ${REVIEW_LIMITS.comment} ký tự.`;
    else values.comment = comment;
  }
  const rawName = payload.displayName ?? payload.reviewerName;
  if (!partial || rawName !== undefined) {
    const name = normalizeText(rawName ?? "Khách lưu trú");
    if (!name || name.length > REVIEW_LIMITS.displayName) {
      errors.displayName = `Tên hiển thị phải từ 1 đến ${REVIEW_LIMITS.displayName} ký tự.`;
    } else {
      values.reviewerName = name;
    }
  }
  if (partial && !Object.keys(errors).length && !Object.keys(values).length) {
    errors.payload = "Cần ít nhất một trường cập nhật.";
  }

  if (Object.keys(errors).length) {
    throw apiError(
      "Dữ liệu đầu vào không hợp lệ",
      400,
      "VALIDATION_ERROR",
      errors,
    );
  }
  return values;
}

function presentReview(state, review, { admin = false } = {}) {
  const room = state.rooms.find(({ id }) => id === review.roomId);
  const { userId, bookingCode: code, ...publicFields } = review;
  return clone({
    ...publicFields,
    roomName: room?.name ?? "",
    ...(admin ? { userId, bookingCode: code } : {}),
  });
}

function summarizeReviews(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(({ rating }) => {
    distribution[rating] += 1;
  });
  const total = reviews.reduce((sum, { rating }) => sum + rating, 0);
  return {
    averageRating: reviews.length
      ? Math.round((total / reviews.length) * 10) / 10
      : 0,
    reviewCount: reviews.length,
    distribution,
  };
}

function findOwnReview(state, reviewId, user) {
  const review = state.reviews.find(({ id }) => id === reviewId);
  if (!review || review.userId !== user.id) {
    throw apiError("Không tìm thấy đánh giá", 404, "REVIEW_NOT_FOUND");
  }
  return review;
}

function bookingCode() {
  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()
    .padEnd(6, "0");
  return `CS-${random}`;
}

export function createMockApi() {
  return {
    identity: {
      async login(credentials = {}) {
        const email = normalizeEmail(credentials.email);
        const password = String(credentials.password ?? "");
        const demoAccount = DEMO_ACCOUNTS.find(
          (account) =>
            normalizeEmail(account.email) === email &&
            account.password === password,
        );
        const registeredUserId =
          registeredCredentials.get(email)?.password === password
            ? registeredCredentials.get(email).userId
            : null;
        const state = readMockState();
        const userId = demoAccount?.user.id ?? registeredUserId;
        const user = state.users.find(({ id }) => id === userId);

        if (!user) {
          throw apiError(
            "Email hoặc mật khẩu không đúng.",
            401,
            "INVALID_CREDENTIALS",
          );
        }

        if (user.status === "locked") {
          throw apiError("Tài khoản đã bị khóa.", 403, "ACCOUNT_LOCKED");
        }

        const session = {
          accessToken: `mock-token-${user.id}-${Date.now()}`,
          user: clone(user),
        };
        setApiSession(session);
        return clone(session);
      },

      async register(payload = {}) {
        const fullName = normalizeText(payload.fullName ?? payload.name);
        const email = normalizeEmail(payload.email);
        const password = String(payload.password ?? "");
        const phone = normalizeText(payload.phone);
        const errors = {};

        if (fullName.length < 2)
          errors.fullName = "Họ tên phải có ít nhất 2 ký tự.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          errors.email = "Email không hợp lệ.";
        if (password.length < 8)
          errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
        if (Object.keys(errors).length) {
          throw apiError(
            "Thông tin đăng ký chưa hợp lệ.",
            400,
            "VALIDATION_ERROR",
            errors,
          );
        }

        const state = readMockState();
        if (state.users.some((user) => normalizeEmail(user.email) === email)) {
          throw apiError(
            "Email này đã được sử dụng.",
            409,
            "EMAIL_ALREADY_EXISTS",
          );
        }

        const user = {
          id: createId("user"),
          fullName,
          email,
          phone,
          role: "customer",
          status: "active",
        };
        updateMockState((draft) => {
          draft.users.push(user);
          return draft;
        });
        // Credentials stay in memory only; mock localStorage never contains passwords.
        registeredCredentials.set(email, { password, userId: user.id });

        return {
          accessToken: null,
          user: clone(user),
          registrationSucceeded: true,
          requiresLogin: true,
        };
      },

      async me() {
        return clone(requireUser());
      },

      async adminListUsers() {
        requireAdmin();
        return collection(
          readMockState().users.map((user) => ({ status: "active", ...user })),
        );
      },

      async updateUserStatus(userId, requestedStatus) {
        requireAdmin();
        const normalized = normalizeText(
          typeof requestedStatus === "object"
            ? requestedStatus.status
            : requestedStatus,
        ).toLowerCase();
        if (!["active", "locked"].includes(normalized)) {
          throw apiError(
            "Trạng thái tài khoản không hợp lệ.",
            400,
            "VALIDATION_ERROR",
          );
        }
        let updated;
        updateMockState((state) => {
          const user = state.users.find(({ id }) => id === userId);
          if (!user)
            throw apiError("Không tìm thấy người dùng.", 404, "USER_NOT_FOUND");
          user.status = normalized;
          updated = user;
          return state;
        });
        return clone(updated);
      },
    },

    rooms: {
      async list() {
        const rooms = readMockState().rooms.filter((room) => room.isBookable);
        return collection(rooms);
      },

      async search(filters = {}) {
        const state = readMockState();
        const rooms = filterRooms(state, filters).sort(
          (a, b) => a.pricePerNight - b.pricePerNight,
        );
        const result = paginated(rooms, filters, 12);
        const { checkIn, checkOut } = validateDatePair(filters);
        if (checkIn && checkOut) {
          Object.assign(result.meta, {
            checkIn,
            checkOut,
            nights: calculateNights(checkIn, checkOut),
          });
        }
        return result;
      },

      async getById(roomId, filters = {}) {
        const state = readMockState();
        const room = clone(findRoom(state, roomId));
        const { checkIn, checkOut } = validateDatePair(filters);
        if (checkIn && checkOut) {
          const nights = calculateNights(checkIn, checkOut);
          room.stay = {
            checkIn,
            checkOut,
            nights,
            totalPrice: room.pricePerNight * nights,
            available: !hasBookingConflict(state, roomId, checkIn, checkOut),
          };
        }
        return room;
      },

      async unavailableDates(roomId, filters = {}) {
        const state = readMockState();
        findRoom(state, roomId);
        const from = filters.from ?? todayISO();
        const to = filters.to ?? addDays(from, 90);
        const bookings = state.bookings.filter(
          (booking) =>
            booking.roomId === roomId &&
            ACTIVE_BOOKING_STATUSES.has(booking.status) &&
            rangesOverlap(from, to, booking.checkInDate, booking.checkOutDate),
        );
        const unavailableDates = [];
        bookings.forEach((booking) => {
          let date = booking.checkInDate < from ? from : booking.checkInDate;
          const end = booking.checkOutDate > to ? to : booking.checkOutDate;
          while (date < end) {
            unavailableDates.push(date);
            date = addDays(date, 1);
          }
        });
        return {
          roomId,
          from,
          to,
          bookedRanges: bookings.map((booking) => ({
            checkIn: booking.checkInDate,
            checkOut: booking.checkOutDate,
          })),
          unavailableDates: [...new Set(unavailableDates)].sort(),
        };
      },

      async alternatives(roomId, filters = {}) {
        const state = readMockState();
        const room = findRoom(state, roomId);
        const { checkIn, checkOut } = validateDatePair(filters);
        const nights = calculateNights(checkIn, checkOut);
        const available = !hasBookingConflict(state, roomId, checkIn, checkOut);
        const otherRooms = available
          ? []
          : filterRooms(state, filters)
              .filter((candidate) => candidate.id !== roomId)
              .slice(0, 5)
              .map((candidate) => ({
                ...candidate,
                nights,
                totalPrice: candidate.pricePerNight * nights,
                available: true,
              }));
        return {
          requested: {
            checkIn,
            checkOut,
            nights,
            totalPrice: room.pricePerNight * nights,
            available,
          },
          sameRoomRanges: [],
          otherRooms,
        };
      },

      async adminList(filters = {}) {
        requireAdmin();
        const state = readMockState();
        return collection(
          filterRooms(state, filters, { admin: true }).sort((a, b) =>
            a.roomNumber.localeCompare(b.roomNumber),
          ),
        );
      },

      async create(payload = {}) {
        requireAdmin();
        const normalized = validateRoomPayload(payload);
        let createdRoom;

        updateMockState((state) => {
          if (
            state.rooms.some(
              (room) => room.roomNumber === normalized.roomNumber,
            )
          ) {
            throw apiError(
              "Số phòng này đã tồn tại.",
              409,
              "ROOM_NUMBER_EXISTS",
            );
          }
          createdRoom = {
            id: createId("room"),
            ...normalized,
            size: Number(payload.size) || 0,
            floor: Number(payload.floor) || 0,
            featured: Boolean(payload.featured),
            isBookable: payload.isBookable !== false,
            amenities: clone(payload.amenities ?? []),
            description: normalizeText(payload.description),
            bed: normalizeText(payload.bed),
            view: normalizeText(payload.view),
            palette: clone(
              payload.palette ?? ["#8aa6b1", "#eee4d2", "#315565"],
            ),
          };
          state.rooms.push(createdRoom);
          return state;
        });

        return clone(createdRoom);
      },

      async update(roomId, payload = {}) {
        requireAdmin();
        const normalized = validateRoomPayload(payload, { partial: true });
        let updatedRoom;

        updateMockState((state) => {
          const room = findRoom(state, roomId);
          if (
            normalized.roomNumber &&
            state.rooms.some(
              ({ id, roomNumber }) =>
                id !== roomId && roomNumber === normalized.roomNumber,
            )
          ) {
            throw apiError(
              "Số phòng này đã tồn tại.",
              409,
              "ROOM_NUMBER_EXISTS",
            );
          }

          const safeFields = [
            "size",
            "floor",
            "featured",
            "isBookable",
            "amenities",
            "description",
            "bed",
            "view",
            "palette",
          ];
          safeFields.forEach((field) => {
            if (payload[field] !== undefined)
              room[field] = clone(payload[field]);
          });
          Object.assign(room, normalized);
          updatedRoom = room;
          return state;
        });

        return clone(updatedRoom);
      },

      async toggleBookable(roomId, requestedValue) {
        requireAdmin();
        let updatedRoom;
        const explicitValue =
          typeof requestedValue === "object" && requestedValue !== null
            ? requestedValue.isBookable
            : requestedValue;

        updateMockState((state) => {
          const room = findRoom(state, roomId);
          room.isBookable =
            explicitValue === undefined
              ? !room.isBookable
              : Boolean(explicitValue);
          updatedRoom = room;
          return state;
        });
        return clone(updatedRoom);
      },
    },

    media: {
      async listForRoom(roomId) {
        const state = readMockState();
        const room = findRoom(state, roomId);
        if (!room.isBookable)
          throw apiError("Không tìm thấy phòng.", 404, "ROOM_NOT_FOUND");
        return collection(
          (state.media ?? [])
            .filter((item) => item.roomId === roomId)
            .sort((left, right) =>
              Number(right.isCover) - Number(left.isCover) ||
              left.sortOrder - right.sortOrder,
            ),
        );
      },

      async adminList(roomId) {
        requireAdmin();
        const state = readMockState();
        findRoom(state, roomId);
        return collection(
          (state.media ?? [])
            .filter((item) => item.roomId === roomId)
            .sort((left, right) =>
              Number(right.isCover) - Number(left.isCover) ||
              left.sortOrder - right.sortOrder,
            ),
        );
      },

      async upload(roomId, { file, altText = "" } = {}) {
        requireAdmin();
        if (!file) throw apiError("Cần chọn tệp ảnh hoặc video.", 400, "FILE_REQUIRED");
        const mediaType = MOCK_MEDIA_TYPES.get(file.type);
        if (!mediaType)
          throw apiError(
            "Chỉ nhận ảnh JPEG, PNG, WebP hoặc video MP4, WebM.",
            415,
            "UNSUPPORTED_MEDIA_TYPE",
          );
        if (file.size > MOCK_MEDIA_LIMITS[mediaType])
          throw apiError("Tệp vượt quá dung lượng cho phép.", 413, "FILE_TOO_LARGE");
        if (String(altText).trim().length > 200)
          throw apiError("Alt text tối đa 200 ký tự.", 400, "VALIDATION_ERROR");

        let created;
        updateMockState((state) => {
          findRoom(state, roomId);
          state.media ??= [];
          const roomMedia = state.media.filter((item) => item.roomId === roomId);
          if (roomMedia.length >= MOCK_MEDIA_LIMITS.count)
            throw apiError("Mỗi phòng tối đa 20 ảnh và video.", 409, "MEDIA_LIMIT_REACHED");
          const id = createId("media");
          const now = new Date().toISOString();
          created = {
            id,
            roomId,
            mediaType,
            url:
              typeof URL?.createObjectURL === "function"
                ? URL.createObjectURL(file)
                : `blob:cloudstay-mock/${id}`,
            thumbnailUrl: null,
            format: file.name?.split(".").pop()?.toLowerCase() ?? null,
            bytes: file.size,
            width: null,
            height: null,
            durationSeconds: null,
            altText: String(altText).trim(),
            sortOrder: Math.max(0, ...roomMedia.map((item) => item.sortOrder)) + 1,
            isCover:
              mediaType === "image" && !roomMedia.some((item) => item.isCover),
            createdAt: now,
            updatedAt: now,
          };
          state.media.push(created);
          return state;
        });
        return clone(created);
      },

      async replaceFile(roomId, mediaId, { file, altText } = {}) {
        requireAdmin();
        if (!file) throw apiError("Cần chọn tệp ảnh hoặc video.", 400, "FILE_REQUIRED");
        const mediaType = MOCK_MEDIA_TYPES.get(file.type);
        if (!mediaType)
          throw apiError("Định dạng tệp không được hỗ trợ.", 415, "UNSUPPORTED_MEDIA_TYPE");
        if (file.size > MOCK_MEDIA_LIMITS[mediaType])
          throw apiError("Tệp vượt quá dung lượng cho phép.", 413, "FILE_TOO_LARGE");
        let updated;
        updateMockState((state) => {
          findRoom(state, roomId);
          const media = (state.media ?? []).find(
            (item) => item.id === mediaId && item.roomId === roomId,
          );
          if (!media)
            throw apiError("Không tìm thấy ảnh/video.", 404, "MEDIA_NOT_FOUND");
          const wasCover = media.isCover;
          Object.assign(media, {
            mediaType,
            url:
              typeof URL?.createObjectURL === "function"
                ? URL.createObjectURL(file)
                : `blob:cloudstay-mock/${mediaId}`,
            format: file.name?.split(".").pop()?.toLowerCase() ?? null,
            bytes: file.size,
            ...(altText !== undefined ? { altText: String(altText).trim() } : {}),
            isCover: mediaType === "image" ? media.isCover : false,
            updatedAt: new Date().toISOString(),
          });
          if (wasCover && mediaType === "video") {
            const next = state.media.find(
              (item) => item.roomId === roomId && item.id !== mediaId && item.mediaType === "image",
            );
            if (next) next.isCover = true;
          } else if (
            mediaType === "image" &&
            !state.media.some((item) => item.roomId === roomId && item.isCover)
          ) {
            media.isCover = true;
          }
          updated = media;
          return state;
        });
        return { data: clone(updated), storageCleanupPending: false };
      },

      async update(roomId, mediaId, patch = {}) {
        requireAdmin();
        if (patch.altText !== undefined && String(patch.altText).trim().length > 200)
          throw apiError("Alt text tối đa 200 ký tự.", 400, "VALIDATION_ERROR");
        if (
          patch.sortOrder !== undefined &&
          (!Number.isInteger(Number(patch.sortOrder)) || Number(patch.sortOrder) < 1 || Number(patch.sortOrder) > 10000)
        ) throw apiError("Thứ tự phải từ 1 đến 10000.", 400, "VALIDATION_ERROR");
        let updated;
        updateMockState((state) => {
          findRoom(state, roomId);
          const media = (state.media ?? []).find(
            (item) => item.id === mediaId && item.roomId === roomId,
          );
          if (!media)
            throw apiError("Không tìm thấy ảnh/video.", 404, "MEDIA_NOT_FOUND");
          if (patch.isCover === true && media.mediaType !== "image")
            throw apiError("Chỉ ảnh mới có thể làm ảnh bìa.", 422, "COVER_MUST_BE_IMAGE");
          if (patch.isCover === true) {
            state.media
              .filter((item) => item.roomId === roomId)
              .forEach((item) => { item.isCover = false; });
          }
          const wasCover = media.isCover;
          if (patch.altText !== undefined) media.altText = String(patch.altText).trim();
          if (patch.sortOrder !== undefined) media.sortOrder = Number(patch.sortOrder);
          if (patch.isCover !== undefined) media.isCover = Boolean(patch.isCover);
          if (patch.isCover === false && wasCover) {
            const next = state.media.find(
              (item) =>
                item.roomId === roomId &&
                item.id !== mediaId &&
                item.mediaType === "image",
            );
            if (next) next.isCover = true;
          }
          media.updatedAt = new Date().toISOString();
          updated = media;
          return state;
        });
        return clone(updated);
      },

      async remove(roomId, mediaId) {
        requireAdmin();
        let removed;
        updateMockState((state) => {
          findRoom(state, roomId);
          const index = (state.media ?? []).findIndex(
            (item) => item.id === mediaId && item.roomId === roomId,
          );
          if (index < 0)
            throw apiError("Không tìm thấy ảnh/video.", 404, "MEDIA_NOT_FOUND");
          [removed] = state.media.splice(index, 1);
          if (removed.isCover) {
            const next = state.media.find(
              (item) => item.roomId === roomId && item.mediaType === "image",
            );
            if (next) next.isCover = true;
          }
          return state;
        });
        return {
          data: { id: removed.id, deleted: true },
          storageCleanupPending: false,
        };
      },
    },

    bookings: {
      async create(payload = {}, options = {}) {
        const user = requireUser();
        const normalized = normalizeBookingPayload(payload);
        const idempotencyKey =
          normalizeText(options.idempotencyKey ?? payload.idempotencyKey) ||
          null;
        let createdBooking;

        updateMockState((state) => {
          if (idempotencyKey) {
            const existing = state.bookings.find(
              (booking) =>
                booking.userId === user.id &&
                booking.idempotencyKey === idempotencyKey,
            );
            if (existing) {
              if (
                bookingFingerprint(existing) !== bookingFingerprint(normalized)
              ) {
                throw apiError(
                  "Khóa chống trùng đã được dùng cho một yêu cầu đặt phòng khác.",
                  409,
                  "IDEMPOTENCY_KEY_REUSED",
                );
              }
              createdBooking = existing;
              return state;
            }
          }

          const room = findRoom(state, normalized.roomId);
          if (!room.isBookable) {
            throw apiError(
              "Phòng này hiện không nhận đặt chỗ.",
              409,
              "ROOM_NOT_BOOKABLE",
            );
          }
          const errors = validateStay({
            checkIn: normalized.checkInDate,
            checkOut: normalized.checkOutDate,
            guests: normalized.guests,
            maxGuests: room.capacity,
          });
          if (Object.keys(errors).length) {
            throw apiError(
              "Thông tin đặt phòng chưa hợp lệ.",
              400,
              "VALIDATION_ERROR",
              errors,
            );
          }
          if (
            hasBookingConflict(
              state,
              room.id,
              normalized.checkInDate,
              normalized.checkOutDate,
            )
          ) {
            throw apiError(
              "Phòng vừa được khách khác đặt trong khoảng thời gian này.",
              409,
              "ROOM_UNAVAILABLE",
            );
          }

          const nights = calculateNights(
            normalized.checkInDate,
            normalized.checkOutDate,
          );
          createdBooking = {
            id: createId("booking"),
            code: bookingCode(),
            userId: user.id,
            roomId: room.id,
            checkInDate: normalized.checkInDate,
            checkOutDate: normalized.checkOutDate,
            guests: normalized.guests,
            nights,
            nightlyRate: room.pricePerNight,
            totalPrice: nights * room.pricePerNight,
            specialRequests: normalized.specialRequests,
            status: "confirmed",
            createdAt: new Date().toISOString(),
            cancellationReason: null,
            idempotencyKey,
          };
          state.bookings.push(createdBooking);
          state.notifications.push(
            makeNotification(user.id, {
              title: "Đặt phòng thành công",
              message: `Đơn ${createdBooking.code} cho phòng ${room.name} đã được xác nhận.`,
              type: "booking_confirmed",
            }),
          );
          return state;
        });

        return presentBooking(readMockState(), createdBooking);
      },

      async mine(filters = {}) {
        const user = requireUser();
        const state = readMockState();
        const status = normalizeText(filters.status).toLowerCase();
        const bookings = state.bookings
          .filter((booking) => booking.userId === user.id)
          .filter((booking) => !status || booking.status === status)
          .sort(compareNewest)
          .map((booking) => presentBooking(state, booking));
        return paginated(bookings, filters, 10);
      },

      async getById(bookingId) {
        const user = requireUser();
        const state = readMockState();
        const booking = findBooking(state, bookingId);
        ensureBookingAccess(booking, user);
        return presentBooking(state, booking, {
          includeUser: user.role === "admin",
          allowAdminCancellation: user.role === "admin",
          includeReviewState: true,
        });
      },

      async adminList(filters = {}) {
        requireAdmin();
        const state = readMockState();
        const status = normalizeText(filters.status).toLowerCase();
        const query = normalizeText(
          filters.query ?? filters.search,
        ).toLowerCase();
        const bookings = state.bookings
          .filter((booking) => !status || booking.status === status)
          .filter(
            (booking) => !filters.roomId || booking.roomId === filters.roomId,
          )
          .filter(
            (booking) => !filters.userId || booking.userId === filters.userId,
          )
          .filter((booking) => {
            if (!query) return true;
            const room = state.rooms.find(({ id }) => id === booking.roomId);
            const user = state.users.find(({ id }) => id === booking.userId);
            return [
              booking.code,
              room?.name,
              room?.roomNumber,
              user?.fullName,
              user?.email,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);
          })
          .sort(compareNewest)
          .map((booking) =>
            presentBooking(state, booking, {
              includeUser: true,
              allowAdminCancellation: true,
            }),
          );
        return paginated(bookings, filters, 20);
      },

      cancelMine(bookingId, options = {}) {
        return cancelMockBooking(bookingId, options);
      },

      cancelAdmin(bookingId, options = {}) {
        return cancelMockBooking(bookingId, options, { admin: true });
      },

      cancel(bookingId, options = {}) {
        return options?.asAdmin || options?.admin
          ? cancelMockBooking(bookingId, options, { admin: true })
          : cancelMockBooking(bookingId, options);
      },

      async listOutbox() {
        requireAdmin();
        return collection([]);
      },

      async retryOutbox() {
        requireAdmin();
        return collection([]);
      },
    },

    payments: {
      async create(bookingId, { idempotencyKey, provider = "MOCK" } = {}) {
        const user = requireUser();
        const key = normalizeText(idempotencyKey);
        if (provider !== "MOCK" || key.length < 8)
          throw apiError("Yêu cầu thanh toán không hợp lệ.", 400, "VALIDATION_ERROR");
        let result;
        updateMockState((state) => {
          const booking = findBooking(state, bookingId);
          if (booking.userId !== user.id)
            throw apiError("Không tìm thấy lịch đặt.", 404, "BOOKING_NOT_FOUND");
          if (booking.status === "cancelled")
            throw apiError("Đặt phòng đã hủy không thể thanh toán.", 409, "BOOKING_NOT_PAYABLE");
          state.payments ??= [];
          const reused = state.payments.find(
            (payment) => payment.userId === user.id && payment.idempotencyKey === key,
          );
          if (reused && reused.bookingId !== bookingId)
            throw apiError("Idempotency-Key đã được dùng cho đặt phòng khác.", 409, "IDEMPOTENCY_KEY_REUSED");
          if (reused) {
            result = reused;
            return state;
          }
          const active = latestPayment(state, bookingId);
          if (active && ["pending", "succeeded"].includes(active.status)) {
            result = active;
            return state;
          }
          const now = new Date().toISOString();
          result = {
            id: createId("payment"),
            bookingId,
            userId: user.id,
            provider: "MOCK",
            amount: booking.totalPrice,
            currency: "VND",
            status: "succeeded",
            idempotencyKey: key,
            providerTransactionId: `MOCK-${createId("transaction")}`,
            failureReason: null,
            createdAt: now,
            updatedAt: now,
            paidAt: now,
          };
          state.payments.push(result);
          return state;
        });
        const { userId: _userId, idempotencyKey: _key, ...publicPayment } = result;
        return clone(publicPayment);
      },

      async getForBooking(bookingId) {
        const user = requireUser();
        const state = readMockState();
        const booking = findBooking(state, bookingId);
        if (booking.userId !== user.id)
          throw apiError("Không tìm thấy lịch đặt.", 404, "BOOKING_NOT_FOUND");
        const payment = latestPayment(state, bookingId);
        if (!payment) return null;
        const { userId: _userId, idempotencyKey: _key, ...publicPayment } = payment;
        return clone(publicPayment);
      },
    },

    reviews: {
      async listForRoom(roomId, filters = {}) {
        const state = readMockState();
        findRoom(state, roomId);
        const visible = state.reviews
          .filter(
            (review) => review.roomId === roomId && review.status === "visible",
          )
          .sort(compareNewest);
        const rating = Number(filters.rating);
        const filtered = rating
          ? visible.filter((review) => review.rating === rating)
          : visible;
        const result = paginated(
          filtered.map((review) => presentReview(state, review)),
          filters,
          10,
        );
        return { ...result, summary: summarizeReviews(visible) };
      },

      async mine(filters = {}) {
        const user = requireUser();
        const state = readMockState();
        const mine = state.reviews
          .filter((review) => review.userId === user.id)
          .sort(compareNewest)
          .map((review) => presentReview(state, review));
        return paginated(mine, filters, 10);
      },

      async getForBooking(bookingId) {
        const user = requireUser();
        const state = readMockState();
        const booking = state.bookings.find(({ id }) => id === bookingId);
        if (!booking || booking.userId !== user.id) {
          throw apiError("Không tìm thấy lịch đặt", 404, "BOOKING_NOT_FOUND");
        }
        const review = state.reviews.find(
          (item) => item.bookingId === bookingId,
        );
        if (!review)
          throw apiError(
            "Lịch đặt này chưa có đánh giá",
            404,
            "REVIEW_NOT_FOUND",
          );
        return presentReview(state, review);
      },

      async create(bookingId, payload = {}) {
        const user = requireUser();
        const values = validateReviewPayload(payload);
        let created;

        updateMockState((state) => {
          const booking = state.bookings.find(({ id }) => id === bookingId);
          if (!booking || booking.userId !== user.id) {
            throw apiError("Không tìm thấy lịch đặt", 404, "BOOKING_NOT_FOUND");
          }
          if (booking.status !== "confirmed") {
            throw apiError(
              "Lịch đặt đã hủy nên không thể đánh giá",
              409,
              "BOOKING_NOT_REVIEWABLE",
            );
          }
          if (!isReviewableBooking(booking)) {
            throw apiError(
              "Chỉ được đánh giá sau khi đã đến ngày trả phòng",
              409,
              "STAY_NOT_COMPLETED",
            );
          }
          if (state.reviews.some((review) => review.bookingId === booking.id)) {
            throw apiError(
              "Lịch đặt này đã được đánh giá",
              409,
              "REVIEW_ALREADY_EXISTS",
            );
          }
          const now = new Date().toISOString();
          created = {
            id: createId("review"),
            bookingId: booking.id,
            bookingCode: booking.code,
            roomId: booking.roomId,
            userId: user.id,
            ...values,
            status: "visible",
            createdAt: now,
            updatedAt: now,
          };
          state.reviews.push(created);
          return state;
        });

        return presentReview(readMockState(), created);
      },

      async update(reviewId, payload = {}) {
        const user = requireUser();
        const values = validateReviewPayload(payload, { partial: true });
        let updated;

        updateMockState((state) => {
          const review = findOwnReview(state, reviewId, user);
          Object.assign(review, values, {
            updatedAt: new Date().toISOString(),
          });
          updated = review;
          return state;
        });

        return presentReview(readMockState(), updated);
      },

      async remove(reviewId) {
        const user = requireUser();
        updateMockState((state) => {
          findOwnReview(state, reviewId, user);
          state.reviews = state.reviews.filter(({ id }) => id !== reviewId);
          return state;
        });
      },

      async adminList(filters = {}) {
        requireAdmin();
        const state = readMockState();
        const status = normalizeText(filters.status).toLowerCase();
        const rating = Number(filters.rating);
        const reviews = state.reviews
          .filter((review) => !status || review.status === status)
          .filter(
            (review) => !filters.roomId || review.roomId === filters.roomId,
          )
          .filter((review) => !rating || review.rating === rating)
          .sort(compareNewest)
          .map((review) => presentReview(state, review, { admin: true }));
        return paginated(reviews, filters, 20);
      },

      async adminSetStatus(reviewId, requestedStatus) {
        requireAdmin();
        const status = normalizeText(requestedStatus).toLowerCase();
        if (!["visible", "hidden"].includes(status)) {
          throw apiError(
            "Dữ liệu đầu vào không hợp lệ",
            400,
            "VALIDATION_ERROR",
          );
        }
        let updated;
        updateMockState((state) => {
          const review = state.reviews.find(({ id }) => id === reviewId);
          if (!review)
            throw apiError("Không tìm thấy đánh giá", 404, "REVIEW_NOT_FOUND");
          review.status = status;
          review.updatedAt = new Date().toISOString();
          updated = review;
          return state;
        });
        return presentReview(readMockState(), updated, { admin: true });
      },
    },

    notifications: {
      async mine() {
        const user = requireUser();
        return collection(
          readMockState()
            .notifications.filter(
              (notification) => notification.userId === user.id,
            )
            .sort(compareNewest),
        );
      },

      async markRead(notificationId) {
        const user = requireUser();
        let updatedNotification;
        updateMockState((state) => {
          const notification = state.notifications.find(
            ({ id }) => id === notificationId,
          );
          if (!notification) {
            throw apiError(
              "Không tìm thấy thông báo.",
              404,
              "NOTIFICATION_NOT_FOUND",
            );
          }
          if (notification.userId !== user.id) {
            throw apiError(
              "Bạn không có quyền cập nhật thông báo này.",
              403,
              "NOTIFICATION_FORBIDDEN",
            );
          }
          notification.read = true;
          notification.readAt ??= new Date().toISOString();
          updatedNotification = notification;
          return state;
        });
        return clone(updatedNotification);
      },

      async markAllRead() {
        const user = requireUser();
        const readAt = new Date().toISOString();
        let notifications;
        let updatedCount = 0;
        updateMockState((state) => {
          state.notifications.forEach((notification) => {
            if (notification.userId === user.id && !notification.read) {
              notification.read = true;
              notification.readAt = readAt;
              updatedCount += 1;
            }
          });
          notifications = state.notifications
            .filter((notification) => notification.userId === user.id)
            .sort(compareNewest);
          return state;
        });
        return {
          ...collection(notifications),
          attemptedCount: updatedCount,
          updatedCount,
          failedCount: 0,
          failures: [],
        };
      },
    },
  };
}

export const mockApi = createMockApi();

export function resetMockApi() {
  registeredCredentials.clear();
  clearApiSession();
  try {
    if (typeof localStorage !== "undefined")
      localStorage.removeItem("cloudstay.mock-session.v1");
  } catch {
    // The in-memory reset still succeeds when browser storage is unavailable.
  }
  return resetMockState();
}
