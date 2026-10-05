import { DEMO_ACCOUNTS } from '../../data/mockData'
import { calculateNights, rangesOverlap, todayISO, validateStay } from '../../utils/date'
import { ApiError } from '../errors'
import { clearApiSession, getApiSession, setApiSession } from '../session'
import { readMockState, resetMockState, updateMockState } from './store'

const registeredCredentials = new Map()
const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'confirmed'])

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function apiError(message, status, code, details) {
  return new ApiError(message, { status, code, details })
}

function requireUser() {
  const user = getApiSession().user
  if (!user) {
    throw apiError('Vui lòng đăng nhập để tiếp tục.', 401, 'AUTH_REQUIRED')
  }
  return user
}

function requireAdmin() {
  const user = requireUser()
  if (user.role !== 'admin') {
    throw apiError('Bạn không có quyền thực hiện thao tác này.', 403, 'ADMIN_REQUIRED')
  }
  return user
}

function findRoom(state, roomId) {
  const room = state.rooms.find(({ id }) => id === roomId)
  if (!room) throw apiError('Không tìm thấy phòng.', 404, 'ROOM_NOT_FOUND')
  return room
}

function findBooking(state, bookingId) {
  const booking = state.bookings.find(({ id }) => id === bookingId)
  if (!booking) throw apiError('Không tìm thấy đơn đặt phòng.', 404, 'BOOKING_NOT_FOUND')
  return booking
}

function ensureBookingAccess(booking, user) {
  if (user.role !== 'admin' && booking.userId !== user.id) {
    throw apiError('Bạn không có quyền xem đơn đặt phòng này.', 403, 'BOOKING_FORBIDDEN')
  }
}

function compareNewest(first, second) {
  return String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? ''))
}

function canCancelBooking(booking, { asAdmin = false } = {}) {
  return (
    ACTIVE_BOOKING_STATUSES.has(booking.status) &&
    (asAdmin || booking.checkInDate > todayISO())
  )
}

function presentBooking(
  state,
  booking,
  { includeUser = false, allowAdminCancellation = false } = {},
) {
  const room = state.rooms.find(({ id }) => id === booking.roomId) ?? null
  const user = includeUser
    ? state.users.find(({ id }) => id === booking.userId) ?? null
    : undefined

  return clone({
    ...booking,
    room,
    ...(includeUser ? { user } : {}),
    canCancel: canCancelBooking(booking, { asAdmin: allowAdminCancellation }),
  })
}

function hasBookingConflict(state, roomId, checkInDate, checkOutDate, ignoredBookingId) {
  return state.bookings.some(
    (booking) =>
      booking.id !== ignoredBookingId &&
      booking.roomId === roomId &&
      ACTIVE_BOOKING_STATUSES.has(booking.status) &&
      rangesOverlap(checkInDate, checkOutDate, booking.checkInDate, booking.checkOutDate),
  )
}

function validateDatePair(filters) {
  const checkIn = filters.checkIn ?? filters.checkInDate
  const checkOut = filters.checkOut ?? filters.checkOutDate

  if (!checkIn && !checkOut) return { checkIn: null, checkOut: null }

  const errors = validateStay({
    checkIn,
    checkOut,
    guests: filters.guests ?? 1,
    minDate: filters.minDate ?? todayISO(),
  })
  if (Object.keys(errors).length) {
    throw apiError('Thông tin tìm kiếm chưa hợp lệ.', 400, 'VALIDATION_ERROR', errors)
  }

  return { checkIn, checkOut }
}

function roomMatchesText(room, query) {
  if (!query) return true
  const haystack = [room.name, room.roomNumber, room.type, room.view, ...(room.amenities ?? [])]
    .join(' ')
    .toLocaleLowerCase('vi')
  return haystack.includes(String(query).trim().toLocaleLowerCase('vi'))
}

function readRoomFilters(filters = {}, { admin = false } = {}) {
  const guests = filters.guests === undefined || filters.guests === '' ? null : Number(filters.guests)
  const minPrice = filters.minPrice === undefined || filters.minPrice === '' ? null : Number(filters.minPrice)
  const maxPrice = filters.maxPrice === undefined || filters.maxPrice === '' ? null : Number(filters.maxPrice)

  if (guests !== null && (!Number.isInteger(guests) || guests < 1)) {
    throw apiError('Số khách phải là số nguyên dương.', 400, 'VALIDATION_ERROR', {
      guests: 'Số khách phải là số nguyên dương.',
    })
  }
  if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) {
    throw apiError('Mức giá tối thiểu không hợp lệ.', 400, 'VALIDATION_ERROR', {
      minPrice: 'Mức giá tối thiểu không hợp lệ.',
    })
  }
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    throw apiError('Mức giá tối đa không hợp lệ.', 400, 'VALIDATION_ERROR', {
      maxPrice: 'Mức giá tối đa không hợp lệ.',
    })
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw apiError('Khoảng giá chưa hợp lệ.', 400, 'VALIDATION_ERROR', {
      maxPrice: 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.',
    })
  }

  const dates = admin ? { checkIn: null, checkOut: null } : validateDatePair({ ...filters, guests: guests ?? 1 })
  return { guests, minPrice, maxPrice, ...dates }
}

function filterRooms(state, filters = {}, options = {}) {
  const { guests, minPrice, maxPrice, checkIn, checkOut } = readRoomFilters(filters, options)
  const type = normalizeText(filters.type).toLowerCase()
  const requestedBookable =
    filters.isBookable === undefined || filters.isBookable === ''
      ? null
      : filters.isBookable === true || filters.isBookable === 'true'

  return state.rooms.filter((room) => {
    if (!options.admin && !room.isBookable) return false
    if (options.admin && requestedBookable !== null && room.isBookable !== requestedBookable) return false
    if (filters.featured !== undefined && room.featured !== (filters.featured === true || filters.featured === 'true')) return false
    if (type && room.type.toLowerCase() !== type) return false
    if (guests !== null && room.capacity < guests) return false
    if (minPrice !== null && room.pricePerNight < minPrice) return false
    if (maxPrice !== null && room.pricePerNight > maxPrice) return false
    if (!roomMatchesText(room, filters.query ?? filters.search)) return false
    if (checkIn && hasBookingConflict(state, room.id, checkIn, checkOut)) return false
    return true
  })
}

function validateRoomPayload(payload, { partial = false } = {}) {
  const errors = {}
  const name = normalizeText(payload.name)
  const roomNumber = normalizeText(payload.roomNumber)
  const type = normalizeText(payload.type).toLowerCase()
  const pricePerNight = Number(payload.pricePerNight)
  const capacity = Number(payload.capacity)

  if (!partial || payload.name !== undefined) {
    if (!name) errors.name = 'Vui lòng nhập tên phòng.'
  }
  if (!partial || payload.roomNumber !== undefined) {
    if (!roomNumber) errors.roomNumber = 'Vui lòng nhập số phòng.'
  }
  if (!partial || payload.type !== undefined) {
    if (!type) errors.type = 'Vui lòng chọn loại phòng.'
  }
  if (!partial || payload.pricePerNight !== undefined) {
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) {
      errors.pricePerNight = 'Giá mỗi đêm phải lớn hơn 0.'
    }
  }
  if (!partial || payload.capacity !== undefined) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      errors.capacity = 'Sức chứa phải là số nguyên dương.'
    }
  }
  if (payload.amenities !== undefined && !Array.isArray(payload.amenities)) {
    errors.amenities = 'Danh sách tiện nghi không hợp lệ.'
  }

  if (Object.keys(errors).length) {
    throw apiError('Thông tin phòng chưa hợp lệ.', 400, 'VALIDATION_ERROR', errors)
  }

  return {
    ...(payload.name !== undefined || !partial ? { name } : {}),
    ...(payload.roomNumber !== undefined || !partial ? { roomNumber } : {}),
    ...(payload.type !== undefined || !partial ? { type } : {}),
    ...(payload.pricePerNight !== undefined || !partial ? { pricePerNight } : {}),
    ...(payload.capacity !== undefined || !partial ? { capacity } : {}),
  }
}

function makeNotification(userId, { title, message, type }) {
  return {
    id: createId('notification'),
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  }
}

function bookingFingerprint(payload) {
  return JSON.stringify({
    roomId: payload.roomId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
    guests: payload.guests,
    specialRequests: payload.specialRequests ?? '',
  })
}

function normalizeBookingPayload(payload = {}) {
  return {
    roomId: normalizeText(payload.roomId),
    checkInDate: payload.checkInDate ?? payload.checkIn,
    checkOutDate: payload.checkOutDate ?? payload.checkOut,
    guests: Number(payload.guests),
    specialRequests: normalizeText(payload.specialRequests),
  }
}

function bookingCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0')
  return `CS-${random}`
}

export function createMockApi() {
  return {
    identity: {
      async login(credentials = {}) {
        const email = normalizeEmail(credentials.email)
        const password = String(credentials.password ?? '')
        const demoAccount = DEMO_ACCOUNTS.find(
          (account) => normalizeEmail(account.email) === email && account.password === password,
        )
        const registeredUserId = registeredCredentials.get(email)?.password === password
          ? registeredCredentials.get(email).userId
          : null
        const state = readMockState()
        const user = demoAccount?.user ?? state.users.find(({ id }) => id === registeredUserId)

        if (!user) {
          throw apiError('Email hoặc mật khẩu không đúng.', 401, 'INVALID_CREDENTIALS')
        }

        const session = {
          accessToken: `mock-token-${user.id}-${Date.now()}`,
          user: clone(user),
        }
        setApiSession(session)
        return clone(session)
      },

      async register(payload = {}) {
        const fullName = normalizeText(payload.fullName ?? payload.name)
        const email = normalizeEmail(payload.email)
        const password = String(payload.password ?? '')
        const phone = normalizeText(payload.phone)
        const errors = {}

        if (fullName.length < 2) errors.fullName = 'Họ tên phải có ít nhất 2 ký tự.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ.'
        if (password.length < 8) errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.'
        if (Object.keys(errors).length) {
          throw apiError('Thông tin đăng ký chưa hợp lệ.', 400, 'VALIDATION_ERROR', errors)
        }

        const state = readMockState()
        if (state.users.some((user) => normalizeEmail(user.email) === email)) {
          throw apiError('Email này đã được sử dụng.', 409, 'EMAIL_ALREADY_EXISTS')
        }

        const user = {
          id: createId('user'),
          fullName,
          email,
          phone,
          role: 'customer',
        }
        updateMockState((draft) => {
          draft.users.push(user)
          return draft
        })
        // Credentials stay in memory only; mock localStorage never contains passwords.
        registeredCredentials.set(email, { password, userId: user.id })

        const session = {
          accessToken: `mock-token-${user.id}-${Date.now()}`,
          user: clone(user),
        }
        setApiSession(session)
        return clone(session)
      },
    },

    rooms: {
      async search(filters = {}) {
        const state = readMockState()
        return clone(filterRooms(state, filters).sort((a, b) => a.pricePerNight - b.pricePerNight))
      },

      async getById(roomId) {
        return clone(findRoom(readMockState(), roomId))
      },

      async adminList(filters = {}) {
        requireAdmin()
        const state = readMockState()
        return clone(filterRooms(state, filters, { admin: true }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)))
      },

      async create(payload = {}) {
        requireAdmin()
        const normalized = validateRoomPayload(payload)
        let createdRoom

        updateMockState((state) => {
          if (state.rooms.some((room) => room.roomNumber === normalized.roomNumber)) {
            throw apiError('Số phòng này đã tồn tại.', 409, 'ROOM_NUMBER_EXISTS')
          }
          createdRoom = {
            id: createId('room'),
            ...normalized,
            size: Number(payload.size) || 0,
            floor: Number(payload.floor) || 0,
            featured: Boolean(payload.featured),
            isBookable: payload.isBookable !== false,
            amenities: clone(payload.amenities ?? []),
            description: normalizeText(payload.description),
            bed: normalizeText(payload.bed),
            view: normalizeText(payload.view),
            palette: clone(payload.palette ?? ['#8aa6b1', '#eee4d2', '#315565']),
          }
          state.rooms.push(createdRoom)
          return state
        })

        return clone(createdRoom)
      },

      async update(roomId, payload = {}) {
        requireAdmin()
        const normalized = validateRoomPayload(payload, { partial: true })
        let updatedRoom

        updateMockState((state) => {
          const room = findRoom(state, roomId)
          if (
            normalized.roomNumber &&
            state.rooms.some(({ id, roomNumber }) => id !== roomId && roomNumber === normalized.roomNumber)
          ) {
            throw apiError('Số phòng này đã tồn tại.', 409, 'ROOM_NUMBER_EXISTS')
          }

          const safeFields = [
            'size',
            'floor',
            'featured',
            'isBookable',
            'amenities',
            'description',
            'bed',
            'view',
            'palette',
          ]
          safeFields.forEach((field) => {
            if (payload[field] !== undefined) room[field] = clone(payload[field])
          })
          Object.assign(room, normalized)
          updatedRoom = room
          return state
        })

        return clone(updatedRoom)
      },

      async toggleBookable(roomId, requestedValue) {
        requireAdmin()
        let updatedRoom
        const explicitValue =
          typeof requestedValue === 'object' && requestedValue !== null
            ? requestedValue.isBookable
            : requestedValue

        updateMockState((state) => {
          const room = findRoom(state, roomId)
          room.isBookable = explicitValue === undefined ? !room.isBookable : Boolean(explicitValue)
          updatedRoom = room
          return state
        })
        return clone(updatedRoom)
      },
    },

    bookings: {
      async create(payload = {}, options = {}) {
        const user = requireUser()
        const normalized = normalizeBookingPayload(payload)
        const idempotencyKey = normalizeText(options.idempotencyKey ?? payload.idempotencyKey) || null
        let createdBooking

        updateMockState((state) => {
          if (idempotencyKey) {
            const existing = state.bookings.find(
              (booking) => booking.userId === user.id && booking.idempotencyKey === idempotencyKey,
            )
            if (existing) {
              if (bookingFingerprint(existing) !== bookingFingerprint(normalized)) {
                throw apiError(
                  'Khóa chống trùng đã được dùng cho một yêu cầu đặt phòng khác.',
                  409,
                  'IDEMPOTENCY_KEY_REUSED',
                )
              }
              createdBooking = existing
              return state
            }
          }

          const room = findRoom(state, normalized.roomId)
          if (!room.isBookable) {
            throw apiError('Phòng này hiện không nhận đặt chỗ.', 409, 'ROOM_NOT_BOOKABLE')
          }
          const errors = validateStay({
            checkIn: normalized.checkInDate,
            checkOut: normalized.checkOutDate,
            guests: normalized.guests,
            maxGuests: room.capacity,
          })
          if (Object.keys(errors).length) {
            throw apiError('Thông tin đặt phòng chưa hợp lệ.', 400, 'VALIDATION_ERROR', errors)
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
              'Phòng vừa được khách khác đặt trong khoảng thời gian này.',
              409,
              'ROOM_UNAVAILABLE',
            )
          }

          const nights = calculateNights(normalized.checkInDate, normalized.checkOutDate)
          createdBooking = {
            id: createId('booking'),
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
            status: 'confirmed',
            createdAt: new Date().toISOString(),
            cancellationReason: null,
            idempotencyKey,
          }
          state.bookings.push(createdBooking)
          state.notifications.push(
            makeNotification(user.id, {
              title: 'Đặt phòng thành công',
              message: `Đơn ${createdBooking.code} cho phòng ${room.name} đã được xác nhận.`,
              type: 'booking_confirmed',
            }),
          )
          return state
        })

        return presentBooking(readMockState(), createdBooking)
      },

      async mine(filters = {}) {
        const user = requireUser()
        const state = readMockState()
        return state.bookings
          .filter((booking) => booking.userId === user.id)
          .filter((booking) => !filters.status || booking.status === filters.status)
          .sort(compareNewest)
          .map((booking) => presentBooking(state, booking))
      },

      async getById(bookingId) {
        const user = requireUser()
        const state = readMockState()
        const booking = findBooking(state, bookingId)
        ensureBookingAccess(booking, user)
        return presentBooking(state, booking, {
          includeUser: user.role === 'admin',
          allowAdminCancellation: user.role === 'admin',
        })
      },

      async adminList(filters = {}) {
        requireAdmin()
        const state = readMockState()
        const query = normalizeText(filters.query ?? filters.search).toLowerCase()
        return state.bookings
          .filter((booking) => !filters.status || booking.status === filters.status)
          .filter((booking) => {
            if (!query) return true
            const room = state.rooms.find(({ id }) => id === booking.roomId)
            const user = state.users.find(({ id }) => id === booking.userId)
            return [booking.code, room?.name, room?.roomNumber, user?.fullName, user?.email]
              .join(' ')
              .toLowerCase()
              .includes(query)
          })
          .sort(compareNewest)
          .map((booking) =>
            presentBooking(state, booking, {
              includeUser: true,
              allowAdminCancellation: true,
            }),
          )
      },

      async cancel(bookingId, options = {}) {
        const user = requireUser()
        const reason = normalizeText(typeof options === 'string' ? options : options.reason)
        let cancelledBooking

        updateMockState((state) => {
          const booking = findBooking(state, bookingId)
          ensureBookingAccess(booking, user)
          if (booking.status === 'cancelled') {
            cancelledBooking = booking
            return state
          }
          if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) {
            throw apiError('Đơn này không còn có thể hủy.', 409, 'BOOKING_NOT_CANCELLABLE')
          }
          if (user.role !== 'admin' && booking.checkInDate <= todayISO()) {
            throw apiError('Đã quá thời hạn hủy đơn này.', 409, 'BOOKING_NOT_CANCELLABLE')
          }

          booking.status = 'cancelled'
          booking.cancelledAt = new Date().toISOString()
          booking.cancelledBy = user.id
          booking.cancellationReason = reason || null
          cancelledBooking = booking

          const room = state.rooms.find(({ id }) => id === booking.roomId)
          state.notifications.push(
            makeNotification(booking.userId, {
              title: 'Đã hủy đặt phòng',
              message: `Đơn ${booking.code}${room ? ` cho phòng ${room.name}` : ''} đã được hủy.`,
              type: 'booking_cancelled',
            }),
          )
          return state
        })

        return presentBooking(readMockState(), cancelledBooking, {
          includeUser: user.role === 'admin',
          allowAdminCancellation: user.role === 'admin',
        })
      },
    },

    notifications: {
      async mine() {
        const user = requireUser()
        return clone(
          readMockState().notifications
            .filter((notification) => notification.userId === user.id)
            .sort(compareNewest),
        )
      },

      async markRead(notificationId) {
        const user = requireUser()
        let updatedNotification
        updateMockState((state) => {
          const notification = state.notifications.find(({ id }) => id === notificationId)
          if (!notification) {
            throw apiError('Không tìm thấy thông báo.', 404, 'NOTIFICATION_NOT_FOUND')
          }
          if (notification.userId !== user.id) {
            throw apiError('Bạn không có quyền cập nhật thông báo này.', 403, 'NOTIFICATION_FORBIDDEN')
          }
          notification.read = true
          notification.readAt ??= new Date().toISOString()
          updatedNotification = notification
          return state
        })
        return clone(updatedNotification)
      },

      async markAllRead() {
        const user = requireUser()
        const readAt = new Date().toISOString()
        let notifications
        updateMockState((state) => {
          state.notifications.forEach((notification) => {
            if (notification.userId === user.id && !notification.read) {
              notification.read = true
              notification.readAt = readAt
            }
          })
          notifications = state.notifications
            .filter((notification) => notification.userId === user.id)
            .sort(compareNewest)
          return state
        })
        return clone(notifications)
      },
    },
  }
}

export const mockApi = createMockApi()

export function resetMockApi() {
  registeredCredentials.clear()
  clearApiSession()
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('cloudstay.mock-session.v1')
  } catch {
    // The in-memory reset still succeeds when browser storage is unavailable.
  }
  return resetMockState()
}
