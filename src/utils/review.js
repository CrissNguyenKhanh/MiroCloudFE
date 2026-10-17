import { todayISO } from './date'

export const REVIEW_LIMITS = { title: 100, comment: 2000, displayName: 60 }

export const RATING_LABELS = {
  1: 'Rất tệ',
  2: 'Chưa tốt',
  3: 'Bình thường',
  4: 'Tốt',
  5: 'Tuyệt vời',
}

// Mirrors backend ReviewService.isReviewable: CONFIRMED and check-out date reached
// (Asia/Ho_Chi_Minh). The backend remains the final authority.
export function isReviewableBooking(booking, today = todayISO()) {
  return (
    String(booking?.status ?? '').toLowerCase() === 'confirmed' &&
    typeof booking?.checkOutDate === 'string' &&
    booking.checkOutDate <= today
  )
}

export function reviewStatusLabel(status) {
  const labels = { visible: 'Đang hiển thị', hidden: 'Đã ẩn' }
  return labels[status] ?? status
}

export function validateReview({ rating, title = '', comment = '', displayName = '' } = {}) {
  const errors = {}
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    errors.rating = 'Vui lòng chọn số sao từ 1 đến 5.'
  }
  if (title.trim().length > REVIEW_LIMITS.title) {
    errors.title = `Tiêu đề tối đa ${REVIEW_LIMITS.title} ký tự.`
  }
  if (comment.trim().length > REVIEW_LIMITS.comment) {
    errors.comment = `Nội dung tối đa ${REVIEW_LIMITS.comment} ký tự.`
  }
  const name = displayName.trim()
  if (!name) errors.displayName = 'Vui lòng nhập tên hiển thị.'
  else if (name.length > REVIEW_LIMITS.displayName) {
    errors.displayName = `Tên hiển thị tối đa ${REVIEW_LIMITS.displayName} ký tự.`
  }
  return errors
}

// Review timestamps are full ISO instants (timestamptz), unlike booking dates.
export function formatReviewDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

export function wasReviewEdited(review) {
  const created = new Date(review?.createdAt).getTime()
  const updated = new Date(review?.updatedAt).getTime()
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000
}
