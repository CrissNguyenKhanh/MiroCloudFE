import { Star } from 'lucide-react'

const STARS = [1, 2, 3, 4, 5]

// Read-only stars. `value` may be fractional (average rating).
export default function StarRating({ value = 0, size = 16, label }) {
  const rating = Math.min(5, Math.max(0, Number(value) || 0))
  return (
    <span className="star-rating" role="img" aria-label={label ?? `${rating} trên 5 sao`}>
      <span className="star-rating__row" aria-hidden="true">
        {STARS.map((star) => <Star key={star} size={size} />)}
      </span>
      <span className="star-rating__row star-rating__row--filled" style={{ width: `${(rating / 5) * 100}%` }} aria-hidden="true">
        {STARS.map((star) => <Star key={star} size={size} fill="currentColor" />)}
      </span>
    </span>
  )
}
