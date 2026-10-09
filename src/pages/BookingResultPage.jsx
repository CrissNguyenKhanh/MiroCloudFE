import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck2, Check, Copy, Home, MapPin } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import { ErrorState, LoadingState } from '../components/common/States'
import { useToast } from '../contexts/ToastContext'
import { formatCurrency, formatDateVN } from '../utils/date'

export default function BookingResultPage() {
  const { bookingId } = useParams()
  const location = useLocation()
  const optimisticBooking = location.state?.booking?.id === bookingId ? location.state.booking : null
  const [booking, setBooking] = useState(optimisticBooking)
  const [status, setStatus] = useState(optimisticBooking ? 'refreshing' : 'loading')
  const [error, setError] = useState('')
  const { showToast } = useToast()
  const hasCurrentBooking = booking?.id === bookingId

  const loadBooking = useCallback(async () => {
    setStatus((current) => current === 'success' || current === 'refreshing' ? 'refreshing' : 'loading')
    setError('')
    try {
      setBooking(await api.bookings.getById(bookingId))
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus(hasCurrentBooking ? 'stale' : 'error')
    }
  }, [bookingId, hasCurrentBooking])

  useEffect(() => {
    loadBooking()
  }, [bookingId])

  const copyCode = async () => {
    await navigator.clipboard?.writeText(booking.code)
    showToast('Đã sao chép mã đặt phòng.')
  }

  if (status === 'error') return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadBooking} /></div>
  if (status === 'loading' || !hasCurrentBooking) return <div className="page-state-wrap"><LoadingState label="Đang lấy kết quả đặt phòng…" /></div>

  return (
    <div className="page page--soft result-page">
      <section className="result-card">
        <div className="result-card__success"><Check /></div>
        <span className="eyebrow">Đặt phòng thành công</span>
        <h1>Kỳ nghỉ của bạn đã sẵn sàng.</h1>
        <p>CloudStay đã ghi nhận booking. Thông báo có thể xuất hiện sau khi hệ thống xử lý outbox.</p>
        {status === 'stale' && <p className="inline-notice inline-notice--warning">Chưa tải lại được dữ liệu mới nhất: {error}</p>}

        <div className="booking-code">
          <span>Mã đặt phòng</span>
          <strong>{booking.code}</strong>
          <button className="icon-button" type="button" onClick={copyCode} aria-label="Sao chép mã đặt phòng"><Copy size={18} /></button>
        </div>

        <div className="result-details">
          <div><CalendarCheck2 /><span><small>Thời gian</small><strong>{formatDateVN(booking.checkInDate)} — {formatDateVN(booking.checkOutDate)}</strong><small>{booking.nights} đêm · {booking.guests} khách</small></span></div>
          <div><Home /><span><small>Hạng phòng</small><strong>{booking.room?.name || booking.roomName || 'Thông tin phòng'}</strong><small>Phòng {booking.room?.roomNumber || booking.roomNumber || '—'}</small></span></div>
          <div><MapPin /><span><small>Tổng đã xác nhận</small><strong>{formatCurrency(booking.totalPrice)}</strong><small>Giá do booking backend trả về</small></span></div>
        </div>

        <div className="result-card__actions">
          <Link className="button button--navy" to="/bookings">Xem đơn của tôi</Link>
          <Link className="button button--outline" to="/">Về trang chủ</Link>
        </div>
      </section>
    </div>
  )
}
