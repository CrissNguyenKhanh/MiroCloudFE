import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, CircleX, Hotel, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import StatusBadge from '../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import RoomVisual from '../components/rooms/RoomVisual'
import { useToast } from '../contexts/ToastContext'
import { formatCurrency, formatDateVN, todayISO } from '../utils/date'

const tabs = [
  { value: 'all', label: 'Tất cả' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [cancelId, setCancelId] = useState(null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { showToast } = useToast()

  const loadBookings = useCallback(async () => {
    setStatus('loading')
    try {
      setBookings(await api.bookings.mine())
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const filtered = useMemo(() => bookings.filter((booking) => {
    if (activeTab === 'upcoming') return booking.status === 'confirmed' && booking.checkInDate >= todayISO()
    if (activeTab === 'cancelled') return booking.status === 'cancelled'
    return true
  }), [activeTab, bookings])

  const cancelBooking = async (bookingId) => {
    if (cancelling) return
    setCancelling(true)
    try {
      const updated = await api.bookings.cancel(bookingId, { reason })
      setBookings((current) => current.map((booking) => booking.id === bookingId ? updated : booking))
      setCancelId(null)
      setReason('')
      showToast('Đơn đã được hủy và phòng đã trở lại danh sách trống.')
    } catch (cancelError) {
      showToast(getErrorMessage(cancelError), 'error')
    } finally {
      setCancelling(false)
    }
  }

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
              <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'tab tab--active' : 'tab'} onClick={() => setActiveTab(tab.value)}>
                {tab.label}
              </button>
            ))}
          </div>

          {status === 'loading' && <LoadingState label="Đang tải các kỳ nghỉ…" />}
          {status === 'error' && <ErrorState message={error} onRetry={loadBookings} />}
          {status === 'success' && filtered.length === 0 && (
            <EmptyState
              title={activeTab === 'all' ? 'Bạn chưa có đơn đặt phòng' : 'Không có đơn trong mục này'}
              message="Một căn phòng ấm áp vẫn đang chờ bạn khám phá."
              action={<Link className="button button--navy" to="/rooms"><Search size={17} /> Tìm phòng</Link>}
            />
          )}
          {status === 'success' && filtered.length > 0 && (
            <div className="booking-list">
              {filtered.map((booking) => (
                <article className="booking-card" key={booking.id}>
                  <RoomVisual room={booking.room} />
                  <div className="booking-card__content">
                    <div className="booking-card__topline">
                      <span className="booking-card__code">{booking.code}</span>
                      <StatusBadge status={booking.status} />
                    </div>
                    <div>
                      <span className="eyebrow">Phòng {booking.room?.roomNumber}</span>
                      <h2>{booking.room?.name || 'Phòng CloudStay'}</h2>
                    </div>
                    <div className="booking-card__facts">
                      <span><CalendarDays /><small>Nhận — Trả</small><strong>{formatDateVN(booking.checkInDate)} — {formatDateVN(booking.checkOutDate)}</strong></span>
                      <span><Hotel /><small>Kỳ nghỉ</small><strong>{booking.nights} đêm · {booking.guests} khách</strong></span>
                      <span><small>Tổng dự kiến</small><strong>{formatCurrency(booking.totalPrice)}</strong></span>
                    </div>
                    {booking.cancellationReason && <p className="booking-card__cancel-note"><CircleX size={16} /> Lý do hủy: {booking.cancellationReason}</p>}
                    <div className="booking-card__actions">
                      <Link className="text-link" to={`/rooms/${booking.roomId}`}>Xem phòng</Link>
                      {booking.canCancel && (
                        <button type="button" className="text-button text-button--danger" onClick={() => setCancelId(cancelId === booking.id ? null : booking.id)}>
                          Hủy đơn <ChevronDown size={16} />
                        </button>
                      )}
                    </div>
                    {cancelId === booking.id && (
                      <div className="cancel-box">
                        <label htmlFor={`cancel-reason-${booking.id}`}>Lý do hủy <span>(không bắt buộc trong mock)</span></label>
                        <textarea id={`cancel-reason-${booking.id}`} rows="2" maxLength="300" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cho CloudStay biết lý do của bạn…" />
                        <div>
                          <button type="button" className="button button--ghost" onClick={() => { setCancelId(null); setReason('') }}>Giữ đơn</button>
                          <button type="button" className="button button--danger" onClick={() => cancelBooking(booking.id)} disabled={cancelling}>{cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
