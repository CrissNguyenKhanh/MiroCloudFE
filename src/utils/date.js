const DAY_IN_MS = 24 * 60 * 60 * 1000
const HOTEL_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DEFAULT_MAX_STAY_NIGHTS = 30
const DEFAULT_MAX_GUESTS = 20

export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const datePart = (type) => parts.find((part) => part.type === type)?.value
  return `${datePart('year')}-${datePart('month')}-${datePart('day')}`
}

export function addDays(dateValue, amount) {
  const date = parseISODate(dateValue)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function parseISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

export function calculateNights(checkIn, checkOut) {
  const start = parseISODate(checkIn)
  const end = parseISODate(checkOut)
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS))
}

export function rangesOverlap(startA, endA, startB, endB) {
  const aStart = parseISODate(startA)
  const aEnd = parseISODate(endA)
  const bStart = parseISODate(startB)
  const bEnd = parseISODate(endB)
  if (!aStart || !aEnd || !bStart || !bEnd) return false

  // Hotel stays use half-open ranges: [check-in, check-out).
  return aStart < bEnd && bStart < aEnd
}

export function validateStay({
  checkIn,
  checkOut,
  guests,
  maxGuests = DEFAULT_MAX_GUESTS,
  maxNights = DEFAULT_MAX_STAY_NIGHTS,
  minDate = todayISO(),
} = {}) {
  const errors = {}
  const parsedCheckIn = parseISODate(checkIn)
  const parsedCheckOut = parseISODate(checkOut)
  const guestCount = Number(guests)

  if (!parsedCheckIn) {
    errors.checkIn = 'Vui lòng chọn ngày nhận phòng hợp lệ.'
  } else if (checkIn < minDate) {
    errors.checkIn = 'Ngày nhận phòng không thể ở trong quá khứ.'
  }

  if (!parsedCheckOut) {
    errors.checkOut = 'Vui lòng chọn ngày trả phòng hợp lệ.'
  } else if (parsedCheckIn && parsedCheckOut <= parsedCheckIn) {
    errors.checkOut = 'Ngày trả phòng phải sau ngày nhận phòng.'
  } else if (
    parsedCheckIn &&
    Number.isFinite(maxNights) &&
    calculateNights(checkIn, checkOut) > maxNights
  ) {
    errors.checkOut = `Mỗi lần đặt phòng tối đa ${maxNights} đêm.`
  }

  if (!Number.isInteger(guestCount) || guestCount < 1) {
    errors.guests = 'Số khách phải là số nguyên dương.'
  } else if (Number.isFinite(maxGuests) && guestCount > maxGuests) {
    errors.guests = `Phòng này phù hợp tối đa ${maxGuests} khách.`
  }

  return errors
}

export function customerCancellationDeadline(checkInDate) {
  const parsed = parseISODate(checkInDate)
  if (!parsed) return null

  // Asia/Ho_Chi_Minh is UTC+07:00 year-round. Check-in starts at 14:00,
  // and customers may cancel through the instant exactly 24 hours before it.
  const checkInAt = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    7,
  )
  return new Date(checkInAt - DAY_IN_MS)
}

export function canCustomerCancel(booking, now = new Date()) {
  if (typeof booking?.canCancel === 'boolean') return booking.canCancel
  const status = String(booking?.status ?? '').toLowerCase()
  if (!['pending', 'confirmed'].includes(status)) return false
  const deadline = customerCancellationDeadline(booking?.checkInDate)
  return Boolean(deadline) && now.getTime() <= deadline.getTime()
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function formatDateVN(value, options = {}) {
  const date = parseISODate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  }).format(date)
}

export function getDefaultStayRange() {
  const today = todayISO()
  return {
    checkIn: addDays(today, 1),
    checkOut: addDays(today, 3),
  }
}

export function isFutureDate(value) {
  return Boolean(parseISODate(value)) && value > todayISO()
}
