import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, isMockMode } from '../api'
import { getErrorMessage } from '../api/errors'
import PriceSummary from '../components/bookings/PriceSummary'
import { ErrorState, FieldError, LoadingState } from '../components/common/States'
import RoomVisual from '../components/rooms/RoomVisual'
import { useAuth } from '../contexts/AuthContext'
import { bookingSubmissionState, calculateStayPrice, createIdempotencyIntent } from '../utils/booking'
import { formatCurrency, getDefaultStayRange, validateStay } from '../utils/date'

function readGuests(value) {
  if (value === null || value === '') return 2
  return Number(value)
}

export default function CheckoutPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const defaults = getDefaultStayRange()
  const paramsKey = searchParams.toString()
  const stay = useMemo(() => ({
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: readGuests(searchParams.get('guests')),
  }), [paramsKey, defaults.checkIn, defaults.checkOut])
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('loading')
  const [requestStatus, setRequestStatus] = useState('idle')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [specialRequests, setSpecialRequests] = useState('')
  const [acceptPolicy, setAcceptPolicy] = useState(false)
  const intentRef = useRef(null)
  const inFlightRef = useRef(false)
  const loadRequestRef = useRef(0)
  const { user } = useAuth()
  const navigate = useNavigate()

  const bookingIntent = useMemo(() => ({
    roomId,
    checkInDate: stay.checkIn,
    checkOutDate: stay.checkOut,
    guests: stay.guests,
    ...(isMockMode && specialRequests.trim() ? { specialRequests: specialRequests.trim() } : {}),
  }), [roomId, stay.checkIn, stay.checkOut, stay.guests, specialRequests])
  intentRef.current = createIdempotencyIntent(intentRef.current, bookingIntent)

  const loadRoom = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.rooms.getById(roomId, {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
      })
      if (requestId !== loadRequestRef.current) return
      setRoom(result)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [roomId, stay.checkIn, stay.checkOut])

  useEffect(() => {
    loadRoom()
    return () => {
      loadRequestRef.current += 1
    }
  }, [loadRoom])

  const submit = async (event) => {
    event.preventDefault()
    if (inFlightRef.current) return

    const nextErrors = validateStay({
      ...stay,
      maxGuests: Math.min(Number(room.capacity) || 20, 20),
    })
    if (room.stay?.available === false || room.isBookable === false) {
      nextErrors.availability = 'Phòng không còn trống trong khoảng ngày đã chọn.'
    }
    if (!acceptPolicy) nextErrors.policy = 'Bạn cần xác nhận thông tin và chính sách hủy.'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    inFlightRef.current = true
    setRequestStatus('submitting')
    setError('')
    try {
      const booking = await api.bookings.create(bookingIntent, {
        idempotencyKey: intentRef.current.key,
      })
      setRequestStatus('success')
      navigate(`/booking/success/${booking.id}`, { replace: true, state: { booking } })
    } catch (submitError) {
      setRequestStatus(bookingSubmissionState(submitError))
      setError(getErrorMessage(submitError))
    } finally {
      inFlightRef.current = false
    }
  }

  if (status === 'loading') return <div className="page-state-wrap"><LoadingState label="Đang chuẩn bị thông tin đặt phòng…" /></div>
  if (status === 'error' && !room) return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadRoom} /></div>

  const query = new URLSearchParams({ ...stay, guests: String(stay.guests) }).toString()
  const estimatedTotal = room.stay?.totalPrice ?? calculateStayPrice(room, stay.checkIn, stay.checkOut).total
  const hasSubmissionError = ['error', 'unavailable', 'key-reused', 'uncertain'].includes(requestStatus)
  const errorTitle = {
    unavailable: 'Phòng không còn trống',
    'key-reused': 'Yêu cầu không khớp khóa xác nhận',
    uncertain: 'Chưa xác định kết quả đặt phòng',
    error: 'Chưa thể xác nhận đặt phòng',
  }[requestStatus]

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
              <span><small>Họ và tên</small><strong>{user?.fullName || 'Chưa cập nhật'}</strong></span>
              <span><small>Email</small><strong>{user?.email || 'Chưa cập nhật'}</strong></span>
              {isMockMode && <span><small>Số điện thoại</small><strong>{user?.phone || 'Chưa cập nhật'}</strong></span>}
            </div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="checkout-section">
              <h2>Yêu cầu thêm</h2>
              {isMockMode ? (
                <>
                  <label htmlFor="special-requests" className="input-label">Ghi chú cho khách sạn <span>(không bắt buộc)</span></label>
                  <textarea id="special-requests" rows="4" maxLength="300" value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="Ví dụ: phòng yên tĩnh, nôi em bé…" />
                  <small className="character-count">{specialRequests.length}/300</small>
                </>
              ) : (
                <p className="inline-notice">Backend hiện chưa có trường lưu yêu cầu đặc biệt, nên giao diện không gửi dữ liệu này.</p>
              )}
            </div>

            {hasSubmissionError && (
              <div className={`booking-error${requestStatus === 'unavailable' ? ' booking-error--conflict' : ''}`} role="alert">
                <AlertTriangle />
                <div>
                  <strong>{errorTitle}</strong>
                  <p>{error}</p>
                  {requestStatus === 'unavailable' && <Link className="text-link" to={`/rooms?${query}`}>Tìm phòng khác</Link>}
                  {requestStatus === 'key-reused' && <p className="booking-error__note">Hãy quay lại phòng và tạo một ý định đặt phòng mới; không nên đổi payload rồi dùng lại khóa cũ.</p>}
                  {requestStatus === 'uncertain' && (
                    <p className="booking-error__note">Yêu cầu có thể đã tới máy chủ. Hãy kiểm tra <Link className="text-link" to="/bookings">đơn của tôi</Link>; nếu thử lại tại đây, hệ thống giữ nguyên khóa chống trùng.</p>
                  )}
                  {requestStatus === 'error' && <p className="booking-error__note">Bạn có thể thử lại cùng yêu cầu; hệ thống giữ nguyên khóa chống trùng.</p>}
                </div>
              </div>
            )}

            {fieldErrors.availability && <div className="form-alert form-alert--error" role="alert">{fieldErrors.availability}</div>}
            <label className="checkbox-field">
              <input type="checkbox" checked={acceptPolicy} onChange={(event) => { setAcceptPolicy(event.target.checked); setFieldErrors((current) => ({ ...current, policy: undefined })) }} />
              <span>Tôi xác nhận ngày lưu trú, số khách và đã đọc chính sách hủy của phòng.</span>
            </label>
            <FieldError>{fieldErrors.policy}</FieldError>

            <button className="button button--copper button--full checkout-submit" type="submit" disabled={requestStatus === 'submitting' || room.stay?.available === false}>
              {requestStatus === 'submitting' ? 'Đang xác nhận…' : <>Xác nhận đặt phòng · {formatCurrency(estimatedTotal)}</>}
            </button>
            <p className="secure-note"><ShieldCheck size={16} /> Chưa tích hợp thanh toán; giá cuối cùng lấy từ booking backend trả về.</p>
          </form>
        </section>

        <aside className="checkout-summary">
          <RoomVisual room={room} />
          <div className="checkout-summary__room">
            <span className="eyebrow">Phòng {room.roomNumber || '—'}</span>
            <h2>{room.name}</h2>
            <p>{room.bed || 'Loại giường đang cập nhật'} · {room.capacity} khách</p>
          </div>
          <PriceSummary room={room} checkIn={stay.checkIn} checkOut={stay.checkOut} />
        </aside>
      </div>
    </div>
  )
}
