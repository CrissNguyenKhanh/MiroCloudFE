import { Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Brand light />
          <p>Một kỳ nghỉ chậm rãi, được chăm chút từ lần chạm đầu tiên.</p>
        </div>
        <div>
          <h2>Khám phá</h2>
          <Link to="/rooms">Hạng phòng</Link>
          <Link to="/bookings">Đơn của tôi</Link>
          <Link to="/notifications">Thông báo</Link>
        </div>
        <div>
          <h2>Liên hệ</h2>
          <span><MapPin size={16} /> 28 Đường Mây, Đà Nẵng</span>
          <span><Phone size={16} /> 0236 388 2026</span>
          <span><Mail size={16} /> hello@cloudstay.vn</span>
        </div>
        <div className="footer__note">
          <h2>CloudStay demo</h2>
          <p>Đây là dữ liệu mô phỏng phục vụ đồ án, không phát sinh giao dịch thật.</p>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© 2026 CloudStay.</span>
        <span>Thanh lịch trong từng khoảnh khắc.</span>
      </div>
    </footer>
  )
}
