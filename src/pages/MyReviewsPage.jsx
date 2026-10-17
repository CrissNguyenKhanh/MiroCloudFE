import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import ReviewFormModal from '../components/reviews/ReviewFormModal'
import StarRating from '../components/reviews/StarRating'
import { useToast } from '../contexts/ToastContext'
import { formatReviewDate, wasReviewEdited } from '../utils/review'

const PAGE_SIZE = 10

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const requestIdRef = useRef(0)
  const { showToast } = useToast()

  const loadReviews = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.reviews.mine({ page, limit: PAGE_SIZE })
      if (requestId !== requestIdRef.current) return
      setReviews(result.data)
      setMeta(result.meta)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [page])

  useEffect(() => {
    loadReviews()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadReviews])

  const saveEdit = async (values) => {
    try {
      await api.reviews.update(editing.id, values)
    } catch (updateError) {
      if (updateError?.code !== 'REVIEW_NOT_FOUND') throw updateError
      setEditing(null)
      showToast(getErrorMessage(updateError), 'error')
      await loadReviews()
      return
    }
    setEditing(null)
    showToast('Đã cập nhật đánh giá của bạn.')
    await loadReviews()
  }

  const deleteReview = async (review) => {
    if (deleting) return
    setDeleting(true)
    try {
      await api.reviews.remove(review.id)
      setDeleteId(null)
      showToast('Đã xóa đánh giá.')
      await loadReviews()
    } catch (deleteError) {
      showToast(getErrorMessage(deleteError), 'error')
      if (deleteError?.code === 'REVIEW_NOT_FOUND') {
        setDeleteId(null)
        await loadReviews()
      }
    } finally {
      setDeleting(false)
    }
  }

  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const hasPrevious = page > 1
  const hasNext = hasKnownTotal ? page * PAGE_SIZE < total : reviews.length === PAGE_SIZE

  return (
    <div className="page page--soft account-page">
      <section className="account-page__hero">
        <div className="container">
          <span className="eyebrow">Chia sẻ của bạn</span>
          <h1>Đánh giá của tôi</h1>
          <p>Xem, chỉnh sửa hoặc xóa những đánh giá bạn đã gửi sau kỳ nghỉ.</p>
        </div>
      </section>
      <section className="section account-page__content">
        <div className="container">
          {status === 'loading' && <LoadingState label="Đang tải đánh giá…" />}
          {status === 'error' && <ErrorState message={error} onRetry={loadReviews} />}
          {status === 'success' && reviews.length === 0 && (
            <EmptyState
              title={hasPrevious ? 'Trang này không còn đánh giá' : 'Bạn chưa có đánh giá nào'}
              message={hasPrevious ? 'Dữ liệu có thể đã thay đổi. Hãy quay lại trang trước.' : 'Sau khi trả phòng, bạn có thể đánh giá kỳ nghỉ từ trang Đơn của tôi.'}
              action={hasPrevious
                ? <button className="button button--navy" type="button" onClick={() => setPage((current) => current - 1)}>Trang trước</button>
                : <Link className="button button--navy" to="/bookings"><Search size={17} /> Xem đơn của tôi</Link>}
            />
          )}
          {status === 'success' && reviews.length > 0 && (
            <>
              {hasKnownTotal && <p className="collection-scope">{total} đánh giá · trang {page}</p>}
              <div className="review-list">
                {reviews.map((review) => (
                  <article className="review-card review-card--mine" key={review.id}>
                    <div className="review-card__head">
                      <div>
                        <Link className="text-link" to={`/rooms/${review.roomId}`}>{review.roomName || `Phòng ${review.roomId}`}</Link>
                        <small>{formatReviewDate(review.createdAt)}{wasReviewEdited(review) ? ' · đã chỉnh sửa' : ''}</small>
                      </div>
                      <StarRating value={review.rating} size={15} />
                    </div>
                    {review.status === 'hidden' && <p className="inline-notice inline-notice--warning">Quản trị viên đã ẩn đánh giá này khỏi trang phòng.</p>}
                    {review.title && <h3>{review.title}</h3>}
                    {review.comment && <p>{review.comment}</p>}
                    {deleteId === review.id ? (
                      <div className="review-card__actions">
                        <span>Xóa đánh giá này?</span>
                        <button type="button" className="button button--ghost button--small" onClick={() => setDeleteId(null)} disabled={deleting}>Giữ lại</button>
                        <button type="button" className="button button--danger button--small" onClick={() => deleteReview(review)} disabled={deleting}>{deleting ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
                      </div>
                    ) : (
                      <div className="review-card__actions">
                        <button type="button" className="text-button" onClick={() => setEditing(review)}>Sửa đánh giá</button>
                        <button type="button" className="text-button text-button--danger" onClick={() => setDeleteId(review.id)}>Xóa</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {(hasPrevious || hasNext) && (
                <nav className="pagination" aria-label="Phân trang đánh giá của tôi">
                  <button className="button button--outline" type="button" disabled={!hasPrevious} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> Trang trước</button>
                  <span>Trang {page}</span>
                  <button className="button button--outline" type="button" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>Trang sau <ChevronRight size={17} /></button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>
      {editing && (
        <ReviewFormModal roomName={editing.roomName} review={editing} onSubmit={saveEdit} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
