import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { ErrorState, LoadingState } from '../common/States'
import ReviewCard from './ReviewCard'
import StarRating from './StarRating'

const PAGE_SIZE = 5
const STARS = [5, 4, 3, 2, 1]

// Public reviews of a room: summary + distribution (click a bar to filter) + paged list.
export default function RoomReviews({ roomId }) {
  const [reviews, setReviews] = useState([])
  const [meta, setMeta] = useState(null)
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [page, setPage] = useState(1)
  const requestIdRef = useRef(0)

  const loadReviews = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.reviews.listForRoom(roomId, {
        ...(rating ? { rating } : {}),
        page,
        limit: PAGE_SIZE,
      })
      if (requestId !== requestIdRef.current) return
      setReviews(result.data)
      setMeta(result.meta)
      setSummary(result.summary)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [roomId, rating, page])

  useEffect(() => {
    loadReviews()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadReviews])

  const chooseRating = (value) => {
    setRating((current) => (current === value ? 0 : value))
    setPage(1)
  }

  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const hasPrevious = page > 1
  const hasNext = hasKnownTotal ? page * PAGE_SIZE < total : reviews.length === PAGE_SIZE
  const reviewCount = summary?.reviewCount ?? 0

  return (
    <div className="content-block room-reviews" id="reviews">
      <span className="eyebrow">Đánh giá của khách</span>
      <h2>Khách đã lưu trú nói gì.</h2>

      {status === 'loading' && !summary && <LoadingState compact label="Đang tải đánh giá…" />}
      {status === 'error' && <ErrorState title="Không thể tải đánh giá" message={error} onRetry={loadReviews} />}

      {summary && reviewCount === 0 && status !== 'error' && (
        <p className="room-reviews__empty">Phòng này chưa có đánh giá. Chỉ khách đã hoàn tất kỳ nghỉ mới có thể đánh giá.</p>
      )}

      {summary && reviewCount > 0 && (
        <>
          <div className="review-summary">
            <div className="review-summary__score">
              <strong>{summary.averageRating.toFixed(1)}</strong>
              <StarRating value={summary.averageRating} size={18} />
              <small>{reviewCount} đánh giá</small>
            </div>
            <div className="review-summary__bars" role="group" aria-label="Lọc đánh giá theo số sao">
              {STARS.map((star) => {
                const count = summary.distribution[star] ?? 0
                return (
                  <button
                    key={star}
                    type="button"
                    className={rating === star ? 'review-bar review-bar--active' : 'review-bar'}
                    aria-pressed={rating === star}
                    aria-label={`${star} sao: ${count} đánh giá`}
                    onClick={() => chooseRating(star)}
                  >
                    <span>{star} sao</span>
                    <span className="review-bar__track"><span style={{ width: `${(count / reviewCount) * 100}%` }} /></span>
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {rating > 0 && (
            <p className="collection-scope">
              Đang lọc {rating} sao · <button type="button" className="text-button" onClick={() => chooseRating(rating)}>Xem tất cả</button>
            </p>
          )}
          {status === 'loading' && <LoadingState compact label="Đang tải đánh giá…" />}
          {status === 'success' && reviews.length === 0 && <p className="room-reviews__empty">Không có đánh giá {rating} sao.</p>}
          {status === 'success' && reviews.length > 0 && (
            <div className="review-list">
              {reviews.map((review) => <ReviewCard review={review} key={review.id} />)}
            </div>
          )}
          {(hasPrevious || hasNext) && (
            <nav className="pagination" aria-label="Phân trang đánh giá">
              <button className="button button--outline" type="button" disabled={!hasPrevious} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> Trang trước</button>
              <span>Trang {page}</span>
              <button className="button button--outline" type="button" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>Trang sau <ChevronRight size={17} /></button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
