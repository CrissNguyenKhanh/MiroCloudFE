import { calculateNights, formatCurrency } from './date'

export function calculateStayPrice(room, checkIn, checkOut) {
  const nights = calculateNights(checkIn, checkOut)
  const nightlyRate = Number(room?.pricePerNight) || 0
  return {
    nights,
    nightlyRate,
    total: nights * nightlyRate,
    formattedTotal: formatCurrency(nights * nightlyRate),
  }
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `stay-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createIdempotencyIntent(previous, payload, keyFactory = createIdempotencyKey) {
  const fingerprint = JSON.stringify(payload)
  if (previous?.fingerprint === fingerprint) return previous
  return { fingerprint, key: keyFactory() }
}

export function bookingSubmissionState(error) {
  if (error?.code === 'ROOM_UNAVAILABLE') return 'unavailable'
  if (error?.code === 'IDEMPOTENCY_KEY_REUSED') return 'key-reused'
  if (error?.code === 'TIMEOUT' || error?.code === 'NETWORK_ERROR') return 'uncertain'
  return 'error'
}

export function bookingStatusLabel(status) {
  const labels = {
    confirmed: 'Đã xác nhận',
    pending: 'Đang xử lý',
    cancelled: 'Đã hủy',
    completed: 'Đã hoàn tất',
  }
  return labels[status] ?? status
}
