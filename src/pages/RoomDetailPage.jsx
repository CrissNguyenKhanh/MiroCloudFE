import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bath, BedDouble, Check, ChevronLeft, Coffee, Maximize2, ShieldCheck, Sparkles, UsersRound, Wifi } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import PriceSummary from '../components/bookings/PriceSummary'
import { ErrorState, FieldError, LoadingState } from '../components/common/States'
import RoomVisual from '../components/rooms/RoomVisual'
import { formatCurrency, getDefaultStayRange, todayISO, validateStay } from '../utils/date'

const amenityIcons = [Wifi, Coffee, Bath, Sparkles]

export default function RoomDetailPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const defaults = getDefaultStayRange()
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [stay, setStay] = useState({
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: Number(searchParams.get('guests')) || 2,
  })
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()

  const loadRoom = useCallback(async () => {
    setStatus('loading')
    try {
      setRoom(await api.rooms.getById(roomId))
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Không tìm thấy phòng này.'))
      setStatus('error')
    }
  }, [roomId])

  useEffect(() => {
    loadRoom()
  }, [loadRoom])

  const checkoutQuery = useMemo(() => new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  }).toString(), [stay])

  const update = (event) => {
    const { name, value } = event.target
    setStay((current) => ({ ...current, [name]: name === 'guests' ? Number(value) : value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const continueToCheckout = (event) => {
    event.preventDefault()
    const nextErrors = validateStay({ ...stay, maxGuests: room.capacity })
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) navigate(`/checkout/${room.id}?${checkoutQuery}`)
  }

  if (status === 'loading') return <div className="page-state-wrap"><LoadingState label="Đang mở cửa phòng…" /></div>
  if (status === 'error') return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadRoom} /></div>

  return (
    <div className="page room-detail-page">
      <div className="container room-detail__breadcrumb">
        <Link to={`/rooms?${checkoutQuery}`}><ChevronLeft size={17} /> Quay lại danh sách phòng</Link>
      </div>
      <section className="container room-detail__hero">
        <div className="room-detail__visual-grid">
          <RoomVisual room={room} className="room-visual--detail" />
          <RoomVisual room={{ ...room, view: 'Góc thư giãn', palette: [room.palette[1], room.palette[0], room.palette[2]] }} className="room-visual--secondary" />
          <RoomVisual room={{ ...room, view: 'Phòng tắm', palette: [room.palette[0], '#f1ece2', '#46626a'] }} className="room-visual--secondary" />
        </div>
        <div className="room-detail__intro">
          <div>
            <span className="eyebrow">Phòng {room.roomNumber} · Tầng {room.floor}</span>
            <h1>{room.name}</h1>
            <p>{room.description}</p>
          </div>
          <div className="room-detail__rate">
            <strong>{formatCurrency(room.pricePerNight)}</strong>
            <span>/ đêm</span>
          </div>
        </div>
        <div className="room-detail__quick-facts">
          <span><UsersRound /> <strong>{room.capacity} khách</strong></span>
          <span><Maximize2 /> <strong>{room.size} m²</strong></span>
          <span><BedDouble /> <strong>{room.bed}</strong></span>
          <span><ShieldCheck /> <strong>Xác nhận tức thì</strong></span>
        </div>
      </section>

      <section className="container room-detail__body">
        <div className="room-detail__content">
          <div className="content-block">
            <span className="eyebrow">Tiện nghi trong phòng</span>
            <h2>Mọi thứ bạn cần để thật sự nghỉ ngơi.</h2>
            <div className="amenities-grid">
              {room.amenities.map((amenity, index) => {
                const Icon = amenityIcons[index % amenityIcons.length]
                return <span key={amenity}><Icon size={19} /> {amenity}</span>
              })}
            </div>
          </div>
          <div className="content-block policies">
            <span className="eyebrow">Thông tin lưu trú</span>
            <h2>Một vài điều cần biết.</h2>
            <div className="policy-grid">
              <div><strong>Nhận & trả phòng</strong><p>Nhận phòng từ 14:00. Trả phòng trước 12:00 ngày khởi hành.</p></div>
              <div><strong>Chính sách hủy</strong><p>Đơn mock có thể hủy trước ngày nhận phòng. Điều kiện thật do backend xác nhận.</p></div>
              <div><strong>Khoảng ngày</strong><p>Ngày trả phòng không tính là đêm lưu trú — áp dụng quy ước [nhận, trả).</p></div>
              <div><strong>Giá phòng</strong><p>Giá trên giao diện là ước tính; giá cuối cùng đến từ hệ thống đặt phòng.</p></div>
            </div>
          </div>
        </div>

        <aside className="booking-panel">
          <span className="eyebrow">Chọn kỳ nghỉ</span>
          <h2>Giữ phòng của bạn</h2>
          <form onSubmit={continueToCheckout} noValidate>
            <div className="form-grid form-grid--two">
              <label>Nhận phòng
                <input type="date" name="checkIn" min={todayISO()} value={stay.checkIn} onChange={update} aria-invalid={Boolean(errors.checkIn)} />
                <FieldError>{errors.checkIn}</FieldError>
              </label>
              <label>Trả phòng
                <input type="date" name="checkOut" min={stay.checkIn} value={stay.checkOut} onChange={update} aria-invalid={Boolean(errors.checkOut)} />
                <FieldError>{errors.checkOut}</FieldError>
              </label>
            </div>
            <label>Số khách
              <select name="guests" value={stay.guests} onChange={update} aria-invalid={Boolean(errors.guests)}>
                {Array.from({ length: room.capacity }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} khách</option>)}
              </select>
              <FieldError>{errors.guests}</FieldError>
            </label>
            <PriceSummary room={room} checkIn={stay.checkIn} checkOut={stay.checkOut} />
            <button className="button button--copper button--full" type="submit">Tiếp tục đặt phòng</button>
            <p className="booking-panel__assurance"><Check size={15} /> Bạn chưa bị tính phí ở bước này.</p>
          </form>
        </aside>
      </section>
    </div>
  )
}
