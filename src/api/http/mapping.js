import { ApiError } from '../errors'
import { calculateNights, todayISO } from '../../utils/date'

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function snakeToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_match, character) => character.toUpperCase())
}

function camelToSnake(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

function mapKeys(value, keyMapper) {
  if (Array.isArray(value)) return value.map((item) => mapKeys(item, keyMapper))
  if (!isPlainObject(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [keyMapper(key), mapKeys(item, keyMapper)]),
  )
}

export function fromApi(value) {
  return mapKeys(value, snakeToCamel)
}

export function toApi(value) {
  return mapKeys(value, camelToSnake)
}

function unwrapEntity(payload, keys) {
  const mapped = fromApi(payload)
  if (!isPlainObject(mapped)) return mapped

  for (const key of keys) {
    if (isPlainObject(mapped[key])) return mapped[key]
  }
  return mapped
}

export function asCollection(payload, keys = []) {
  const mapped = fromApi(payload)
  if (Array.isArray(mapped)) return mapped
  if (mapped === null || mapped === undefined) return []

  const candidates = [...keys, 'items', 'content', 'results']
  for (const key of candidates) {
    if (Array.isArray(mapped?.[key])) return mapped[key]
  }

  throw new ApiError('Máy chủ trả về danh sách không đúng định dạng.', {
    code: 'INVALID_RESPONSE',
    details: payload,
  })
}

export function normalizeUser(payload) {
  const user = unwrapEntity(payload, ['user', 'account'])
  if (!isPlainObject(user)) return user ?? null

  return {
    ...user,
    fullName: user.fullName ?? user.name,
    role: typeof user.role === 'string' ? user.role.toLowerCase() : user.role,
    status: typeof user.status === 'string' ? user.status.toLowerCase() : user.status,
  }
}

export function normalizeRoom(payload) {
  const room = unwrapEntity(payload, ['room'])
  if (!isPlainObject(room)) return room ?? null

  return {
    ...room,
    pricePerNight: room.pricePerNight ?? room.price,
    capacity: room.capacity ?? room.maxGuests,
    amenities: room.amenities ?? room.equipment ?? [],
    palette: room.palette ?? ['#9bb8b3', '#eadbc2', '#244f5d'],
    isBookable: room.isBookable ?? room.active,
    type: typeof room.type === 'string' ? room.type.toLowerCase() : room.type,
  }
}

export function normalizeBooking(payload) {
  const booking = unwrapEntity(payload, ['booking'])
  if (!isPlainObject(booking)) return booking ?? null

  const status =
    typeof booking.status === 'string' ? booking.status.toLowerCase() : booking.status
  const checkInDate = booking.checkInDate ?? booking.checkIn
  const checkOutDate = booking.checkOutDate ?? booking.checkOut
  const room = booking.room
    ? normalizeRoom(booking.room)
    : booking.roomId || booking.roomName || booking.roomNumber
      ? normalizeRoom({
          id: booking.roomId,
          name: booking.roomName,
          roomNumber: booking.roomNumber,
        })
      : booking.room

  return {
    ...booking,
    code: booking.code ?? booking.bookingCode,
    roomId: booking.roomId ?? room?.id,
    checkInDate,
    checkOutDate,
    guests: booking.guests ?? booking.guestCount,
    nights:
      booking.nights ??
      (checkInDate && checkOutDate ? calculateNights(checkInDate, checkOutDate) : undefined),
    nightlyRate: booking.nightlyRate ?? booking.pricePerNight,
    totalPrice: booking.totalPrice ?? booking.totalAmount ?? booking.total,
    cancellationReason: booking.cancellationReason ?? booking.cancelReason ?? null,
    room,
    user: booking.user ? normalizeUser(booking.user) : booking.user,
    status,
    canCancel:
      booking.canCancel ??
      (['pending', 'confirmed'].includes(status) &&
        (!checkInDate || checkInDate > todayISO())),
  }
}

export function normalizeNotification(payload) {
  const notification = unwrapEntity(payload, ['notification'])
  if (!isPlainObject(notification)) return notification ?? null

  const notificationPayload = fromApi(notification.payload)

  return {
    ...notification,
    title:
      notification.title ??
      (isPlainObject(notificationPayload) ? notificationPayload.title : undefined) ??
      'Thông báo từ CloudStay',
    message:
      notification.message ??
      (isPlainObject(notificationPayload)
        ? notificationPayload.message ?? notificationPayload.body
        : notificationPayload) ??
      '',
    createdAt: notification.createdAt ?? notification.sentAt,
    read: notification.read ?? Boolean(notification.readAt),
    type:
      typeof notification.type === 'string'
        ? notification.type.toLowerCase()
        : notification.type,
  }
}

export function normalizeAuth(payload) {
  const mapped = fromApi(payload)
  const auth = mapped?.auth ?? mapped?.authentication ?? mapped?.session ?? mapped
  const accessToken =
    auth?.accessToken ??
    auth?.token ??
    auth?.jwt ??
    auth?.access?.token ??
    mapped?.tokens?.accessToken ??
    mapped?.accessToken ??
    null

  const userPayload = mapped?.user ?? auth?.user ?? mapped?.account ?? (
    mapped?.id && (mapped?.email || mapped?.fullName || mapped?.role) ? mapped : null
  )

  return {
    accessToken,
    user: normalizeUser(userPayload),
  }
}

export function encodeId(value) {
  return encodeURIComponent(String(value))
}
