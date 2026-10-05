import { ArrowLeft, Cloud } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="standalone-state">
      <span className="standalone-state__code">404</span>
      <Cloud />
      <h1>Trang này đã trôi vào mây.</h1>
      <p>Đường dẫn bạn mở không tồn tại hoặc đã được thay đổi.</p>
      <Link className="button button--navy" to="/"><ArrowLeft /> Về trang chủ</Link>
    </div>
  )
}
