import StarRating from './StarRating'
import { formatReviewDate, wasReviewEdited } from '../../utils/review'

// Public review item (room detail).
export default function ReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card__head">
        <span className="review-card__avatar" aria-hidden="true">{review.reviewerName?.charAt(0)?.toUpperCase() || 'K'}</span>
        <div>
          <strong>{review.reviewerName}</strong>
          <small>{formatReviewDate(review.createdAt)}{wasReviewEdited(review) ? ' · đã chỉnh sửa' : ''}</small>
        </div>
        <StarRating value={review.rating} size={15} />
      </div>
      {review.title && <h3>{review.title}</h3>}
      {review.comment && <p>{review.comment}</p>}
    </article>
  )
}
