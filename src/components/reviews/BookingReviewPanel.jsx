import StarRating from './StarRating'
import { formatReviewDate } from '../../utils/review'

// Review area inside a booking card: write prompt, or the user's existing review.
export default function BookingReviewPanel({ review, confirmingDelete, busy, onWrite, onEdit, onAskDelete, onCancelDelete, onDelete }) {
  if (!review) {
    return (
      <div className="booking-review booking-review--prompt">
        <div>
          <strong>Kỳ nghỉ của bạn thế nào?</strong>
          <p>Chia sẻ trải nghiệm để giúp khách sau chọn phòng.</p>
        </div>
        <button type="button" className="button button--copper button--small" onClick={onWrite}>Viết đánh giá</button>
      </div>
    )
  }

  return (
    <div className="booking-review">
      <div className="booking-review__head">
        <StarRating value={review.rating} size={16} />
        <strong>{review.title || 'Đánh giá của bạn'}</strong>
        <small>{formatReviewDate(review.createdAt)}</small>
        {review.status === 'hidden' && <span className="status-badge status-badge--hidden">Đang bị ẩn</span>}
      </div>
      {review.comment && <p>{review.comment}</p>}
      {review.status === 'hidden' && <p className="booking-review__note">Quản trị viên đã ẩn đánh giá này khỏi trang phòng.</p>}
      {confirmingDelete ? (
        <div className="booking-review__actions">
          <span>Xóa đánh giá này?</span>
          <button type="button" className="button button--ghost button--small" onClick={onCancelDelete} disabled={busy}>Giữ lại</button>
          <button type="button" className="button button--danger button--small" onClick={onDelete} disabled={busy}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
        </div>
      ) : (
        <div className="booking-review__actions">
          <button type="button" className="text-button" onClick={onEdit}>Sửa đánh giá</button>
          <button type="button" className="text-button text-button--danger" onClick={onAskDelete}>Xóa</button>
        </div>
      )}
    </div>
  )
}
