import { useEffect, useRef, useState } from 'react'
import { BedDouble, Bell, BookOpenCheck, ChevronLeft, LayoutDashboard, LogOut, Send, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { getApiSession } from '../api/session'
import Brand from '../components/common/Brand'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  createNotificationSocket,
  NOTIFICATION_CREATED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from '../realtime/notificationSocket'

const NOTIFICATION_POLL_INTERVAL_MS = 60_000

export default function AdminLayout() {
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const toastedNotificationIdsRef = useRef(new Set())

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !getApiSession().accessToken) {
      setUnreadCount(0)
      return undefined
    }

    let active = true
    let latestRequest = 0
    toastedNotificationIdsRef.current = new Set()

    const refreshWhileActive = async (signal) => {
      const requestId = ++latestRequest
      try {
        const result = await api.notifications.mine()
        if (!active) return
        if (requestId === latestRequest) {
          setUnreadCount(result.data.filter((notification) => notification.read === false).length)
        }

        if (signal?.notification_id && !toastedNotificationIdsRef.current.has(signal.notification_id)) {
          const notification = result.data.find((item) => item.id === signal.notification_id)
          if (notification) {
            toastedNotificationIdsRef.current.add(signal.notification_id)
            showToast(notification.title, 'info')
          }
        }
      } catch {
        // Polling and realtime refreshes are silent fallbacks.
      }
    }

    const handleNotificationCreated = (message) => {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_CREATED_EVENT, { detail: message }))
      return refreshWhileActive(message)
    }
    const handleNotificationsChanged = () => refreshWhileActive()

    refreshWhileActive()
    const intervalId = window.setInterval(refreshWhileActive, NOTIFICATION_POLL_INTERVAL_MS)
    const socket = createNotificationSocket({
      audience: 'ADMIN',
      onNotification: handleNotificationCreated,
    })
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)

    return () => {
      active = false
      latestRequest += 1
      window.clearInterval(intervalId)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
      socket.close()
    }
  }, [isAdmin, isAuthenticated, showToast, user?.id])

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
          <NavLink to="/admin/notifications" className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link--notifications admin-nav-link--active' : 'admin-nav-link admin-nav-link--notifications'}>
            <Bell /> Thông báo
            {unreadCount > 0 && <span className="admin-notification-badge" aria-label={unreadCount + ' thông báo chưa đọc'}>{unreadCount}</span>}
          </NavLink>
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
