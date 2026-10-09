import { BedDouble, BookOpenCheck, ChevronLeft, LayoutDashboard, LogOut, Send, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Brand from '../components/common/Brand'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand light />
        <div className="admin-sidebar__label">Quản trị khách sạn</div>
        <nav aria-label="Điều hướng quản trị">
          <NavLink end to="/admin" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link'}><LayoutDashboard /> Tổng quan</NavLink>
          <NavLink to="/admin/rooms" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link'}><BedDouble /> Phòng</NavLink>
          <NavLink to="/admin/bookings" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link'}><BookOpenCheck /> Booking</NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link'}><UsersRound /> Tài khoản</NavLink>
          <NavLink to="/admin/outbox" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link'}><Send /> Outbox</NavLink>
        </nav>
        <div className="admin-sidebar__bottom">
          <div className="admin-user">
            <span>{user?.fullName?.charAt(0) || 'A'}</span>
            <div><strong>{user?.fullName || user?.email}</strong><small>Administrator</small></div>
          </div>
          <NavLink to="/"><ChevronLeft /> Về trang khách</NavLink>
          <button type="button" onClick={signOut}><LogOut /> Đăng xuất</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
