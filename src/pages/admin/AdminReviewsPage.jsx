import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import StarRating from '../../components/reviews/StarRating'
import { useToast } from '../../contexts/ToastContext'
import { formatReviewDate, reviewStatusLabel } from '../../utils/review'

const PAGE_SIZE = 20

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [roomId, setRoomId] = useState('')
  const [roomDraft, setRoomDraft] = useState('')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const requestIdRef = useRef(0)
  const { showToast } = useToast()

  const loadReviews = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.reviews.adminList({
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        ...(ratingFilter === 'all' ? {} : { rating: ratingFilter }),
        ...(roomId ? { roomId } : {}),
        page,
        limit: PAGE_SIZE,
      })
      if (requestId !== requestIdRef.current) return
      setReviews(result.data)
      setMeta(result.meta)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [page, ratingFilter, roomId, statusFilter])

  useEffect(() => {
    loadReviews()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadReviews])

  const changeStatusFilter = (value) => {
    setStatusFilter(value)
    setPage(1)
  }

  const changeRatingFilter = (value) => {
    setRatingFilter(value)
    setPage(1)
  }

  const applyRoomFilter = (event) => {
    event.preventDefault()
    setRoomId(roomDraft.trim())
    setPage(1)
  }

  const clearRoomFilter = () => {
    setRoomDraft('')
    setRoomId('')
    setPage(1)
  }

  const toggleVisibility = async (review) => {
    if (busyId) return
    const nextStatus = review.status === 'hidden' ? 'visible' : 'hidden'
    setBusyId(review.id)
    try {
      await api.reviews.adminSetStatus(review.id, nextStatus)
      showToast(nextStatus === 'hidden' ? 'Đã ẩn đánh giá khỏi trang phòng.' : 'Đã hiển thị lại đánh giá.')
      await loadReviews()
    } catch (statusError) {
      showToast(getErrorMessage(statusError), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const hasPrevious = page > 1
  const hasNext = hasKnownTotal ? page * PAGE_SIZE < total : reviews.length === PAGE_SIZE

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">Review moderation</span><h1>Quản lý đánh giá</h1><p>Ẩn đánh giá không phù hợp khỏi trang phòng hoặc hiển thị lại khi cần.</p></div>
      </header>
      <div className="admin-toolbar admin-toolbar--bookings">
        <span>{hasKnownTotal ? `${total} đánh giá phù hợp` : `Trang ${page}`}</span>
        <select value={statusFilter} onChange={(event) => changeStatusFilter(event.target.value)} aria-label="Lọc trạng thái đánh giá">
          <option value="all">Mọi trạng thái</option>
          <option value="visible">Đang hiển thị</option>
          <option value="hidden">Đã ẩn</option>
        </select>
        <select value={ratingFilter} onChange={(event) => changeRatingFilter(event.target.value)} aria-label="Lọc theo số sao">
          <option value="all">Mọi số sao</option>
          {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{star} sao</option>)}
        </select>
      </div>
      <form className="admin-toolbar admin-toolbar--bookings" onSubmit={applyRoomFilter}>
        <label>
          <span className="sr-only">Lọc theo Room ID</span>
          <input value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} placeholder="Room UUID" aria-label="Lọc theo Room ID" />
        </label>
        <button className="button button--outline" type="submit">Áp dụng</button>
        {roomId && <button className="text-button" type="button" onClick={clearRoomFilter}>Xóa lọc phòng</button>}
      </form>

      {status === 'loading' && <LoadingState label="Đang tải đánh giá…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadReviews} />}
      {status === 'success' && reviews.length === 0 && <EmptyState title={hasPrevious ? 'Trang này không còn đánh giá' : 'Không có đánh giá phù hợp'} message={hasPrevious ? 'Dữ liệu có thể đã thay đổi. Hãy quay lại trang trước.' : 'Hãy thử thay đổi bộ lọc.'} />}
      {status === 'success' && reviews.length > 0 && (
        <>
          <div className="admin-panel admin-panel--flush">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--reviews">
                <thead><tr><th>Phòng</th><th>Khách</th><th>Đánh giá</th><th>Ngày</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
                <tbody>
                  {reviews.map((review) => {
                    const hidden = review.status === 'hidden'
                    return (
                      <tr key={review.id}>
                        <td><strong>{review.roomName || `ID ${review.roomId}`}</strong><small>{review.roomId}</small></td>
                        <td><strong>{review.reviewerName}</strong><small>{review.bookingCode ? `Booking ${review.bookingCode}` : `Booking ${review.bookingId}`}</small></td>
                        <td>
                          <StarRating value={review.rating} size={14} />
                          {review.title && <strong className="admin-review-text">{review.title}</strong>}
                          {review.comment && <small className="admin-review-text">{review.comment}</small>}
                        </td>
                        <td>{formatReviewDate(review.createdAt)}</td>
                        <td><span className={`status-badge status-badge--${review.status}`}>{reviewStatusLabel(review.status)}</span></td>
                        <td>
                          <button
                            className={hidden ? 'table-secondary-action' : 'table-danger-action'}
                            type="button"
                            disabled={busyId === review.id}
                            onClick={() => toggleVisibility(review)}
                          >
                            {hidden ? <Eye /> : <EyeOff />} {hidden ? 'Hiện lại' : 'Ẩn'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {(hasPrevious || hasNext) && (
            <nav className="pagination" aria-label="Phân trang đánh giá admin">
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
