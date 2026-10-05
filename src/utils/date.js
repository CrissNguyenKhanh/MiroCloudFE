const DAY_IN_MS = 24 * 60 * 60 * 1000

const pad = (value) => String(value).padStart(2, '0')

export function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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
  maxGuests,
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
  }

  if (!Number.isInteger(guestCount) || guestCount < 1) {
    errors.guests = 'Số khách phải là số nguyên dương.'
  } else if (maxGuests && guestCount > maxGuests) {
    errors.guests = `Phòng này phù hợp tối đa ${maxGuests} khách.`
  }

  return errors
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
