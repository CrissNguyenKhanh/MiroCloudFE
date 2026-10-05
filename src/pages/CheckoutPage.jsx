import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { getErrorMessage } from '../api/errors'
import PriceSummary from '../components/bookings/PriceSummary'
import { ErrorState, FieldError, LoadingState } from '../components/common/States'
import RoomVisual from '../components/rooms/RoomVisual'
import { useAuth } from '../contexts/AuthContext'
import { calculateStayPrice, createIdempotencyKey } from '../utils/booking'
import { formatCurrency, getDefaultStayRange, validateStay } from '../utils/date'

export default function CheckoutPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const defaults = getDefaultStayRange()
  const stay = {
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: Number(searchParams.get('guests')) || 2,
  }
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('loading')
  const [requestStatus, setRequestStatus] = useState('idle')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [specialRequests, setSpecialRequests] = useState('')
  const [acceptPolicy, setAcceptPolicy] = useState(false)
  const idempotencyKey = useRef(createIdempotencyKey())
  const { user } = useAuth()
  const navigate = useNavigate()

  const loadRoom = useCallback(async () => {
    setStatus('loading')
    try {
      setRoom(await api.rooms.getById(roomId))
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [roomId])

  useEffect(() => {
    loadRoom()
  }, [loadRoom])

  const submit = async (event) => {
    event.preventDefault()
    if (requestStatus === 'submitting') return
    const nextErrors = validateStay({ ...stay, maxGuests: room.capacity })
    if (!acceptPolicy) nextErrors.policy = 'Bạn cần xác nhận thông tin và chính sách hủy.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setRequestStatus('submitting')
    setError('')
    try {
      const booking = await api.bookings.create(
        {
          roomId: room.id,
          checkInDate: stay.checkIn,
          checkOutDate: stay.checkOut,
          guests: stay.guests,
          specialRequests,
        },
        { idempotencyKey: idempotencyKey.current },
      )
      setRequestStatus('success')
      navigate(`/booking/success/${booking.id}`, { replace: true, state: { booking } })
    } catch (submitError) {
      setRequestStatus(submitError instanceof ApiError && submitError.status === 409 ? 'conflict' : 'error')
      setError(getErrorMessage(submitError))
    }
  }

  if (status === 'loading') return <div className="page-state-wrap"><LoadingState label="Đang chuẩn bị thông tin đặt phòng…" /></div>
  if (status === 'error' && !room) return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadRoom} /></div>

  const query = new URLSearchParams({ ...stay, guests: String(stay.guests) }).toString()
  const estimatedTotal = calculateStayPrice(room, stay.checkIn, stay.checkOut).total

  return (
    <div className="page page--soft checkout-page">
      <div className="container checkout-page__header">
        <Link to={`/rooms/${room.id}?${query}`}><ArrowLeft size={17} /> Quay lại phòng</Link>
        <span><LockKeyhole size={16} /> Xác nhận an toàn</span>
      </div>
      <div className="container checkout-layout">
        <section className="checkout-main">
          <span className="eyebrow">Bước cuối cùng</span>
          <h1>Xác nhận kỳ nghỉ</h1>
          <p>Kiểm tra lại thông tin bên dưới trước khi gửi yêu cầu đặt phòng.</p>

          <div className="checkout-section">
            <div className="checkout-section__heading"><UserRound /><div><h2>Thông tin khách</h2><p>Dùng thông tin từ tài khoản đang đăng nhập.</p></div></div>
            <div className="guest-summary">
              <span><small>Họ và tên</small><strong>{user.fullName}</strong></span>
              <span><small>Email</small><strong>{user.email}</strong></span>
              <span><small>Số điện thoại</small><strong>{user.phone || 'Chưa cập nhật'}</strong></span>
            </div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="checkout-section">
              <h2>Yêu cầu thêm</h2>
              <label htmlFor="special-requests" className="input-label">Ghi chú cho khách sạn <span>(không bắt buộc)</span></label>
              <textarea id="special-requests" rows="4" maxLength="300" value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="Ví dụ: phòng yên tĩnh, nôi em bé…" />
              <small className="character-count">{specialRequests.length}/300</small>
            </div>

            {(requestStatus === 'error' || requestStatus === 'conflict') && (
              <div className={`booking-error${requestStatus === 'conflict' ? ' booking-error--conflict' : ''}`} role="alert">
                <AlertTriangle />
                <div>
                  <strong>{requestStatus === 'conflict' ? 'Phòng không còn trống' : 'Chưa thể xác nhận đặt phòng'}</strong>
                  <p>{error}</p>
                  {requestStatus === 'conflict' && <Link className="text-link" to={`/rooms?${query}`}>Tìm phòng khác</Link>}
                  {requestStatus === 'error' && <p className="booking-error__note">Nếu thử lại, hệ thống sẽ giữ cùng khóa chống trùng cho lần xác nhận này.</p>}
                </div>
              </div>
            )}

            <label className="checkbox-field">
              <input type="checkbox" checked={acceptPolicy} onChange={(event) => { setAcceptPolicy(event.target.checked); setFieldErrors((current) => ({ ...current, policy: undefined })) }} />
              <span>Tôi xác nhận ngày lưu trú, số khách và đã đọc chính sách hủy của phòng.</span>
            </label>
            <FieldError>{fieldErrors.policy}</FieldError>

            <button className="button button--copper button--full checkout-submit" type="submit" disabled={requestStatus === 'submitting'}>
              {requestStatus === 'submitting' ? 'Đang xác nhận…' : <>Xác nhận đặt phòng · {formatCurrency(estimatedTotal)}</>}
            </button>
            <p className="secure-note"><ShieldCheck size={16} /> Không có thanh toán thật trong phiên bản này.</p>
          </form>
        </section>

        <aside className="checkout-summary">
          <RoomVisual room={room} />
          <div className="checkout-summary__room">
            <span className="eyebrow">Phòng {room.roomNumber}</span>
            <h2>{room.name}</h2>
            <p>{room.bed} · {room.capacity} khách</p>
          </div>
          <PriceSummary room={room} checkIn={stay.checkIn} checkOut={stay.checkOut} />
        </aside>
      </div>
    </div>
  )
}
