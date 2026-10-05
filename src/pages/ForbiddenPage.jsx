import { ArrowLeft, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="standalone-state">
      <span className="standalone-state__code">403</span>
      <ShieldX />
      <h1>Bạn chưa có quyền vào đây.</h1>
      <p>Khu vực quản trị cần tài khoản admin. Quyền thật luôn phải được backend kiểm tra.</p>
      <Link className="button button--navy" to="/"><ArrowLeft /> Về trang chủ</Link>
    </div>
  )
}
