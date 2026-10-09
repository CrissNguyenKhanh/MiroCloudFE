import { ApiError } from '../errors'
import { calculateNights, canCustomerCancel } from '../../utils/date'

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

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function numberOrOriginal(value) {
  if (value === undefined || value === null || value === '') return value
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

function booleanOrOriginal(value) {
  if (value === undefined || value === null || value === '') return value
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return value
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
  let source = mapped
  let meta = null

  if (isPlainObject(mapped) && hasOwn(mapped, 'data')) {
    source = mapped.data
    meta = mapped.meta ?? null
  }

  if (Array.isArray(source)) return { data: source, meta }
  if (source === null || source === undefined) return { data: [], meta }

  const candidates = [...keys, 'items', 'content', 'results']
  for (const key of candidates) {
    if (Array.isArray(source?.[key])) {
      return { data: source[key], meta: source.meta ?? meta }
    }
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

  const stay = isPlainObject(room.stay)
    ? {
        ...room.stay,
        nights: numberOrOriginal(room.stay.nights),
        totalPrice: numberOrOriginal(room.stay.totalPrice),
        available: booleanOrOriginal(room.stay.available),
      }
    : room.stay

  return {
    ...room,
    pricePerNight: numberOrOriginal(room.pricePerNight ?? room.price),
    capacity: numberOrOriginal(room.capacity ?? room.maxGuests),
    size: numberOrOriginal(room.size ?? room.sizeSqm),
    bed: room.bed ?? room.bedType,
    view: room.view ?? room.viewLabel,
    amenities: room.amenities ?? room.equipment ?? [],
    palette: room.palette ?? ['#9bb8b3', '#eadbc2', '#244f5d'],
    isBookable: booleanOrOriginal(room.isBookable ?? room.active),
    featured: booleanOrOriginal(room.featured),
    available: booleanOrOriginal(room.available),
    floor: numberOrOriginal(room.floor),
    nights: numberOrOriginal(room.nights),
    totalPrice: numberOrOriginal(room.totalPrice),
    stay,
    type:
      typeof (room.type ?? room.roomType) === 'string'
        ? (room.type ?? room.roomType).toLowerCase()
        : room.type ?? room.roomType,
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
          roomType: booking.roomType,
        })
      : booking.room

  return {
    ...booking,
    code: booking.code ?? booking.bookingCode,
    roomId: booking.roomId ?? room?.id,
    checkInDate,
    checkOutDate,
    roomNumber: booking.roomNumber ?? room?.roomNumber,
    roomName: booking.roomName ?? room?.name,
    roomType: booking.roomType ?? room?.type,
    guests: numberOrOriginal(booking.guests ?? booking.guestCount),
    nights: numberOrOriginal(
      booking.nights ??
        (checkInDate && checkOutDate ? calculateNights(checkInDate, checkOutDate) : undefined),
    ),
    nightlyRate: numberOrOriginal(booking.nightlyRate ?? booking.pricePerNight),
    totalPrice: numberOrOriginal(booking.totalPrice ?? booking.totalAmount ?? booking.total),
    cancellationReason: booking.cancellationReason ?? booking.cancelReason ?? null,
    room,
    user: booking.user ? normalizeUser(booking.user) : booking.user,
    status,
    canCancel: canCustomerCancel({
      ...booking,
      canCancel: booleanOrOriginal(booking.canCancel),
      checkInDate,
      status,
    }),
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
