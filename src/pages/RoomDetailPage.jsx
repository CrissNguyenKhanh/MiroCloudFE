import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bath, BedDouble, Check, ChevronLeft, Coffee, Maximize2, ShieldCheck, Sparkles, UsersRound, Wifi } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, isMockMode } from '../api'
import { getErrorMessage } from '../api/errors'
import PriceSummary from '../components/bookings/PriceSummary'
import { ErrorState, FieldError, LoadingState } from '../components/common/States'
import RoomCard from '../components/rooms/RoomCard'
import RoomVisual from '../components/rooms/RoomVisual'
import { formatCurrency, formatDateVN, getDefaultStayRange, rangesOverlap, todayISO, validateStay } from '../utils/date'

const amenityIcons = [Wifi, Coffee, Bath, Sparkles]

function readGuests(value) {
  if (value === null || value === '') return 2
  return Number(value)
}

export default function RoomDetailPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const defaults = getDefaultStayRange()
  const [room, setRoom] = useState(null)
  const [availability, setAvailability] = useState({ unavailableDates: [], bookedRanges: [] })
  const [alternatives, setAlternatives] = useState([])
  const [availabilityWarning, setAvailabilityWarning] = useState('')
  const [status, setStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [stay, setStay] = useState({
    checkIn: searchParams.get('checkIn') || defaults.checkIn,
    checkOut: searchParams.get('checkOut') || defaults.checkOut,
    guests: readGuests(searchParams.get('guests')),
  })
  const [errors, setErrors] = useState({})
  const requestIdRef = useRef(0)
  const navigate = useNavigate()

  const loadRoom = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setRefreshing(true)
    setError('')
    setAvailabilityWarning('')

    const basicErrors = validateStay({ ...stay, maxGuests: 20 })
    const canCheckStay = Object.keys(basicErrors).length === 0
    const detailFilters = canCheckStay
      ? { checkIn: stay.checkIn, checkOut: stay.checkOut }
      : {}
    const requests = [api.rooms.getById(roomId, detailFilters)]

    if (canCheckStay) {
      requests.push(
        api.rooms.unavailableDates(roomId, { from: stay.checkIn, to: stay.checkOut }),
        api.rooms.alternatives(roomId, stay),
      )
    }

    const [detailResult, datesResult, alternativesResult] = await Promise.allSettled(requests)
    if (requestId !== requestIdRef.current) return

    if (detailResult.status === 'rejected') {
      setError(getErrorMessage(detailResult.reason, 'Không tìm thấy phòng này.'))
      setStatus('error')
      setRefreshing(false)
      return
    }

    setRoom(detailResult.value)
    setStatus('success')
    if (!canCheckStay) {
      setAvailability({ unavailableDates: [], bookedRanges: [] })
      setAlternatives([])
      setRefreshing(false)
      return
    }

    if (datesResult?.status === 'fulfilled') {
      setAvailability(datesResult.value ?? { unavailableDates: [], bookedRanges: [] })
    } else {
      setAvailability({ unavailableDates: [], bookedRanges: [] })
    }
    if (alternativesResult?.status === 'fulfilled') {
      setAlternatives(alternativesResult.value?.otherRooms ?? [])
    } else {
      setAlternatives([])
    }
    if (datesResult?.status === 'rejected' || alternativesResult?.status === 'rejected') {
      setAvailabilityWarning('Một phần dữ liệu ngày kín hoặc phòng thay thế chưa tải được. Tình trạng cuối cùng vẫn được backend kiểm tra khi đặt.')
    }
    setRefreshing(false)
  }, [roomId, stay.checkIn, stay.checkOut, stay.guests])

  useEffect(() => {
    loadRoom()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadRoom])

  const checkoutQuery = useMemo(() => new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  }).toString(), [stay])

  const bookedRanges = availability.bookedRanges ?? []
  const hasRangeConflict = bookedRanges.some((range) => rangesOverlap(
    stay.checkIn,
    stay.checkOut,
    range.checkIn,
    range.checkOut,
  ))
  const isUnavailable = room?.isBookable === false || room?.stay?.available === false || hasRangeConflict

  const update = (event) => {
    const { name, value } = event.target
    setStay((current) => ({ ...current, [name]: name === 'guests' ? Number(value) : value }))
    setErrors((current) => ({ ...current, [name]: undefined, availability: undefined }))
  }

  const continueToCheckout = (event) => {
    event.preventDefault()
    const nextErrors = validateStay({ ...stay, maxGuests: Math.min(Number(room.capacity) || 20, 20) })
    if (isUnavailable) nextErrors.availability = 'Phòng không còn trống trong toàn bộ khoảng ngày đã chọn.'
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) navigate(`/checkout/${room.id}?${checkoutQuery}`)
  }

  if (status === 'loading') return <div className="page-state-wrap"><LoadingState label="Đang mở cửa phòng…" /></div>
  if (status === 'error') return <div className="page-state-wrap"><ErrorState message={error} onRetry={loadRoom} /></div>

  const palette = Array.isArray(room.palette) && room.palette.length >= 3
    ? room.palette
    : ['#9bb8b3', '#eadbc2', '#244f5d']
  const amenities = Array.isArray(room.amenities) ? room.amenities : []
  const unavailableDates = availability.unavailableDates ?? []
  const detailSearch = `?${checkoutQuery}`

  return (
    <div className="page room-detail-page">
      <div className="container room-detail__breadcrumb">
        <Link to={`/rooms?${checkoutQuery}`}><ChevronLeft size={17} /> Quay lại danh sách phòng</Link>
      </div>
      <section className="container room-detail__hero">
        <div className="room-detail__visual-grid">
          <RoomVisual room={room} className="room-visual--detail" />
          <RoomVisual room={{ ...room, view: 'Góc thư giãn', palette: [palette[1], palette[0], palette[2]] }} className="room-visual--secondary" />
          <RoomVisual room={{ ...room, view: 'Phòng tắm', palette: [palette[0], '#f1ece2', '#46626a'] }} className="room-visual--secondary" />
        </div>
        <div className="room-detail__intro">
          <div>
            <span className="eyebrow">Phòng {room.roomNumber || '—'}{room.floor !== undefined ? ` · Tầng ${room.floor}` : ''}</span>
            <h1>{room.name}</h1>
            <p>{room.description || 'Thông tin mô tả đang được cập nhật.'}</p>
          </div>
          <div className="room-detail__rate">
            <strong>{formatCurrency(room.pricePerNight)}</strong>
            <span>/ đêm</span>
          </div>
        </div>
        <div className="room-detail__quick-facts">
          <span><UsersRound /> <strong>{room.capacity} khách</strong></span>
          <span><Maximize2 /> <strong>{room.size ?? '—'} m²</strong></span>
          <span><BedDouble /> <strong>{room.bed || 'Đang cập nhật'}</strong></span>
          <span><ShieldCheck /> <strong>Backend xác nhận khi đặt</strong></span>
        </div>
      </section>

      <section className="container room-detail__body">
        <div className="room-detail__content">
          <div className="content-block">
            <span className="eyebrow">Tiện nghi trong phòng</span>
            <h2>Mọi thứ bạn cần để thật sự nghỉ ngơi.</h2>
            {amenities.length > 0 ? (
              <div className="amenities-grid">
                {amenities.map((amenity, index) => {
                  const Icon = amenityIcons[index % amenityIcons.length]
                  return <span key={amenity}><Icon size={19} /> {amenity}</span>
                })}
              </div>
            ) : <p>Danh sách tiện nghi đang được cập nhật.</p>}
          </div>

          <div className="content-block availability-block">
            <span className="eyebrow">Tình trạng theo ngày</span>
            <h2>{refreshing ? 'Đang kiểm tra khoảng ngày…' : isUnavailable ? 'Khoảng ngày này đã kín.' : 'Khoảng ngày hiện đang còn trống.'}</h2>
            <p>CloudStay kiểm tra cả khoảng lưu trú theo quy ước [ngày nhận, ngày trả). Input ngày của trình duyệt không khóa từng ngày kín riêng lẻ.</p>
            {unavailableDates.length > 0 && (
              <div className="date-chips" aria-label="Các ngày đã kín">
                {unavailableDates.slice(0, 8).map((date) => <span key={date}>{formatDateVN(date)}</span>)}
                {unavailableDates.length > 8 && <span>+{unavailableDates.length - 8} ngày</span>}
              </div>
            )}
            {availabilityWarning && <p className="inline-notice inline-notice--warning">{availabilityWarning}</p>}
          </div>

          <div className="content-block policies">
            <span className="eyebrow">Thông tin lưu trú</span>
            <h2>Một vài điều cần biết.</h2>
            <div className="policy-grid">
              <div><strong>Nhận & trả phòng</strong><p>Nhận phòng từ 14:00. Trả phòng trước 12:00 ngày khởi hành.</p></div>
              <div><strong>Chính sách hủy</strong><p>{isMockMode ? 'Bản demo áp dụng quy tắc hủy mô phỏng.' : 'Khách có thể hủy đến 14:00 ngày trước ngày nhận phòng; backend quyết định cuối cùng.'}</p></div>
              <div><strong>Khoảng ngày</strong><p>Ngày trả phòng không tính là đêm lưu trú — áp dụng quy ước [nhận, trả).</p></div>
              <div><strong>Giá phòng</strong><p>Giá trên giao diện là ước tính; giá cuối cùng đến từ hệ thống đặt phòng.</p></div>
            </div>
          </div>

          {isUnavailable && alternatives.length > 0 && (
            <div className="content-block">
              <span className="eyebrow">Phòng thay thế</span>
              <h2>Còn trống trong cùng khoảng ngày.</h2>
              <div className="room-grid room-grid--results">
                {alternatives.slice(0, 3).map((alternative) => (
                  <RoomCard room={alternative} key={alternative.id} search={detailSearch} />
                ))}
              </div>
            </div>
          )}
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
                <input type="date" name="checkOut" min={stay.checkIn || todayISO()} value={stay.checkOut} onChange={update} aria-invalid={Boolean(errors.checkOut)} />
                <FieldError>{errors.checkOut}</FieldError>
              </label>
            </div>
            <label>Số khách
              <select name="guests" value={stay.guests} onChange={update} aria-invalid={Boolean(errors.guests)}>
                {Array.from({ length: Math.min(Number(room.capacity) || 20, 20) }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} khách</option>)}
              </select>
              <FieldError>{errors.guests}</FieldError>
            </label>
            <PriceSummary room={room} checkIn={stay.checkIn} checkOut={stay.checkOut} />
            {errors.availability && <div className="form-alert form-alert--error" role="alert">{errors.availability}</div>}
            <button className="button button--copper button--full" type="submit" disabled={refreshing || isUnavailable}>
              {refreshing ? 'Đang kiểm tra…' : isUnavailable ? 'Khoảng ngày đã kín' : 'Tiếp tục đặt phòng'}
            </button>
            <p className="booking-panel__assurance"><Check size={15} /> Bạn chưa bị tính phí ở bước này.</p>
          </form>
        </aside>
      </section>
    </div>
  )
}
