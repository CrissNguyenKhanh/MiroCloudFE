import { useState } from 'react'
import { Star } from 'lucide-react'
import { RATING_LABELS } from '../../utils/review'

const STARS = [1, 2, 3, 4, 5]

export default function StarRatingInput({ value = 0, onChange, name = 'rating', invalid = false }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <fieldset className="star-input" aria-invalid={invalid}>
      <legend>Điểm đánh giá</legend>
      <div className="star-input__stars" onMouseLeave={() => setHover(0)}>
        {STARS.map((star) => (
          <label key={star} className={star <= shown ? 'star-input__star star-input__star--on' : 'star-input__star'} onMouseEnter={() => setHover(star)}>
            <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} className="sr-only" />
            <Star size={30} fill={star <= shown ? 'currentColor' : 'none'} aria-hidden="true" />
            <span className="sr-only">{star} sao</span>
          </label>
        ))}
      </div>
      <span className="star-input__label">{shown ? RATING_LABELS[shown] : 'Chọn số sao'}</span>
    </fieldset>
  )
}
