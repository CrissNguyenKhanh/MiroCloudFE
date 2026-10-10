import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleX, Hotel, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import RoomVisual from '../components/rooms/RoomVisual'
import { useToast } from '../contexts/ToastContext'
import { formatCurrency, formatDateVN } from '../utils/date'

const PAGE_SIZE = 10
const tabs = [
  { value: 'all', label: 'Tất cả', filters: {} },
  { value: 'upcoming', label: 'Sắp tới', filters: { status: 'confirmed', when: 'upcoming' } },
  { value: 'cancelled', label: 'Đã hủy', filters: { status: 'cancelled' } },
]

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [cancelId, setCancelId] = useState(null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const requestIdRef = useRef(0)
  const { showToast } = useToast()

  const loadBookings = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const tab = tabs.find((item) => item.value === activeTab) ?? tabs[0]
    setStatus('loading')
    setError('')
    try {
      const result = await api.bookings.mine({ ...tab.filters, page, limit: PAGE_SIZE })
      if (requestId !== requestIdRef.current) return
      setBookings(result.data)
      setMeta(result.meta)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [activeTab, page])

  useEffect(() => {
    loadBookings()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadBookings])

  const chooseTab = (value) => {
    setActiveTab(value)
    setPage(1)
    setCancelId(null)
    setReason('')
  }

  const cancelBooking = async (bookingId) => {
    if (cancelling) return
    setCancelling(true)
    try {
      const trimmedReason = reason.trim()
      await api.bookings.cancelMine(
        bookingId,
        trimmedReason ? { reason: trimmedReason } : undefined,
      )
      setCancelId(null)
      setReason('')
      showToast('Đơn đặt phòng đã được hủy.')
      await loadBookings()
    } catch (cancelError) {
      const message = cancelError?.code === 'CANCELLATION_WINDOW_PASSED'
        ? 'Đã qua hạn hủy: muộn hơn 14:00 ngày trước ngày nhận phòng.'
        : getErrorMessage(cancelError)
      showToast(message, 'error')
      if (cancelError?.code === 'CANCELLATION_WINDOW_PASSED') await loadBookings()
    } finally {
      setCancelling(false)
    }
  }

  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const hasPrevious = page > 1
  const hasNext = hasKnownTotal ? page * PAGE_SIZE < total : bookings.length === PAGE_SIZE

  return (
    <div className="page page--soft account-page">
      <section className="account-page__hero">
        <div className="container">
          <span className="eyebrow">Kỳ nghỉ của bạn</span>
          <h1>Đơn đặt phòng</h1>
          <p>Theo dõi, xem lại hoặc hủy những kỳ nghỉ đủ điều kiện.</p>
        </div>
      </section>
      <section className="section account-page__content">
        <div className="container">
          <div className="tabs" role="tablist" aria-label="Lọc đơn đặt phòng">
            {tabs.map((tab) => (
              <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'tab tab--active' : 'tab'} onClick={() => chooseTab(tab.value)}>
                {tab.label}
              </button>
            ))}
          </div>

          {status === 'loading' && <LoadingState label="Đang tải các kỳ nghỉ…" />}
          {status === 'error' && <ErrorState message={error} onRetry={loadBookings} />}
          {status === 'success' && bookings.length === 0 && (
            <EmptyState
              title={hasPrevious ? 'Trang này không còn đơn' : activeTab === 'all' ? 'Bạn chưa có đơn đặt phòng' : 'Không có đơn trong mục này'}
              message={hasPrevious ? 'Dữ liệu có thể đã thay đổi. Hãy quay lại trang trước.' : 'Một căn phòng ấm áp vẫn đang chờ bạn khám phá.'}
              action={hasPrevious
                ? <button className="button button--navy" type="button" onClick={() => setPage((current) => current - 1)}>Trang trước</button>
                : <Link className="button button--navy" to="/rooms"><Search size={17} /> Tìm phòng</Link>}
            />
          )}
          {status === 'success' && bookings.length > 0 && (
            <>
              {hasKnownTotal && <p className="collection-scope">{total} đơn phù hợp · trang {page}</p>}
              <div className="booking-list">
                {bookings.map((booking) => {
                  const roomName = booking.room?.name || booking.roomName || `Phòng ${booking.roomId}`
                  const roomNumber = booking.room?.roomNumber || booking.roomNumber
                  const cancellationExpired = booking.status === 'confirmed' && !booking.canCancel
                  return (
                    <article className="booking-card" key={booking.id}>
                      <RoomVisual room={booking.room || { name: roomName, type: booking.roomType }} />
                      <div className="booking-card__content">
                        <div className="booking-card__topline">
                          <span className="booking-card__code">{booking.code}</span>
                          <StatusBadge status={booking.status} />
                        </div>
                        <div>
                          <span className="eyebrow">{roomNumber ? `Phòng ${roomNumber}` : `ID ${booking.roomId}`}</span>
                          <h2>{roomName}</h2>
                        </div>
                        <div className="booking-card__facts">
                          <span><CalendarDays /><small>Nhận — Trả</small><strong>{formatDateVN(booking.checkInDate)} — {formatDateVN(booking.checkOutDate)}</strong></span>
                          <span><Hotel /><small>Kỳ nghỉ</small><strong>{booking.nights} đêm · {booking.guests} khách</strong></span>
                          <span><small>Tổng đã xác nhận</small><strong>{formatCurrency(booking.totalPrice)}</strong></span>
                        </div>
                        {booking.cancellationReason && <p className="booking-card__cancel-note"><CircleX size={16} /> Lý do hủy: {booking.cancellationReason}</p>}
                        {cancellationExpired && (
                          <p className="inline-notice inline-notice--warning">
                            <strong>Đã quá hạn hủy đặt phòng.</strong>{' '}
                            Chỉ được hủy trước 14:00 ngày trước ngày nhận phòng.
                          </p>
                        )}
                        <div className="booking-card__actions">
                          <Link className="text-link" to={`/rooms/${booking.roomId}`}>Xem phòng</Link>
                          {booking.canCancel && (
                            <button type="button" className="text-button text-button--danger" onClick={() => { setCancelId(cancelId === booking.id ? null : booking.id); setReason('') }}>
                              Hủy đơn <ChevronDown size={16} />
                            </button>
                          )}
                        </div>
                        {cancelId === booking.id && (
                          <div className="cancel-box">
                            <label htmlFor={`cancel-reason-${booking.id}`}>Lý do hủy <span>(không bắt buộc)</span></label>
                            <textarea id={`cancel-reason-${booking.id}`} rows="2" maxLength="300" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cho CloudStay biết lý do của bạn…" />
                            <div>
                              <button type="button" className="button button--ghost" onClick={() => { setCancelId(null); setReason('') }}>Giữ đơn</button>
                              <button type="button" className="button button--danger" onClick={() => cancelBooking(booking.id)} disabled={cancelling}>{cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              {(hasPrevious || hasNext) && (
                <nav className="pagination" aria-label="Phân trang đơn đặt phòng">
                  <button className="button button--outline" type="button" disabled={!hasPrevious} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> Trang trước</button>
                  <span>Trang {page}</span>
                  <button className="button button--outline" type="button" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>Trang sau <ChevronRight size={17} /></button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
