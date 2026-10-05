import { formatCurrency, formatDateVN } from '../../utils/date'
import { calculateStayPrice } from '../../utils/booking'

export default function PriceSummary({ room, checkIn, checkOut }) {
  const pricing = calculateStayPrice(room, checkIn, checkOut)
  return (
    <div className="price-summary">
      <div>
        <span>Nhận phòng</span>
        <strong>{formatDateVN(checkIn)}</strong>
      </div>
      <div>
        <span>Trả phòng</span>
        <strong>{formatDateVN(checkOut)}</strong>
      </div>
      <div>
        <span>{formatCurrency(pricing.nightlyRate)} × {pricing.nights} đêm</span>
        <strong>{formatCurrency(pricing.total)}</strong>
      </div>
      <div className="price-summary__total">
        <span>Tổng dự kiến</span>
        <strong>{pricing.formattedTotal}</strong>
      </div>
      <p>Giá cuối cùng được xác nhận bởi hệ thống khi đặt phòng.</p>
    </div>
  )
}
