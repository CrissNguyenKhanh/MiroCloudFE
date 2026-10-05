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
  const [booking, setBooking] = useState(location.state?.booking ?? null)
  const [status, setStatus] = useState(booking ? 'success' : 'loading')
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const loadBooking = useCallback(async () => {
    setStatus('loading')
    try {
      setBooking(await api.bookings.getById(bookingId))
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [bookingId])

  useEffect(() => {
    if (!booking) loadBooking()
  }, [booking, loadBooking])

  const copyCode = async () => {
    await navigator.clipboard?.writeText(booking.code)
    showToast('Đã sao chép mã đặt phòng.')
  }

  if (status === 'loading') return <div className="page-state-wrap"><LoadingState label="Đang lấy kết quả đặt phòng…" /></div>
  if (status === 'error') return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadBooking} /></div>

  return (
    <div className="page page--soft result-page">
      <section className="result-card">
        <div className="result-card__success"><Check /></div>
        <span className="eyebrow">Đặt phòng thành công</span>
        <h1>Kỳ nghỉ của bạn đã sẵn sàng.</h1>
        <p>CloudStay đã ghi nhận yêu cầu. Một thông báo xác nhận vừa được tạo trong tài khoản demo của bạn.</p>

        <div className="booking-code">
          <span>Mã đặt phòng</span>
          <strong>{booking.code}</strong>
          <button className="icon-button" type="button" onClick={copyCode} aria-label="Sao chép mã đặt phòng"><Copy size={18} /></button>
        </div>

        <div className="result-details">
          <div><CalendarCheck2 /><span><small>Thời gian</small><strong>{formatDateVN(booking.checkInDate)} — {formatDateVN(booking.checkOutDate)}</strong><small>{booking.nights} đêm · {booking.guests} khách</small></span></div>
          <div><Home /><span><small>Hạng phòng</small><strong>{booking.room?.name}</strong><small>Phòng {booking.room?.roomNumber}</small></span></div>
          <div><MapPin /><span><small>Tổng dự kiến</small><strong>{formatCurrency(booking.totalPrice)}</strong><small>Giá cuối cùng do backend xác nhận</small></span></div>
        </div>

        <div className="result-card__actions">
          <Link className="button button--navy" to="/bookings">Xem đơn của tôi</Link>
          <Link className="button button--outline" to="/">Về trang chủ</Link>
        </div>
      </section>
    </div>
  )
}
