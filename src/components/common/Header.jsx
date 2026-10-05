import { useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Brand from './Brand'

const navItems = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/rooms', label: 'Phòng' },
  { to: '/bookings', label: 'Đơn của tôi', protected: true },
  { to: '/notifications', label: 'Thông báo', protected: true },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const closeMenus = () => {
    setMenuOpen(false)
    setAccountOpen(false)
  }

  const handleLogout = () => {
    logout()
    closeMenus()
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="container header__inner">
        <Brand />
        <button
          className="icon-button header__menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav
          id="primary-navigation"
          className={`header__nav${menuOpen ? ' header__nav--open' : ''}`}
          aria-label="Điều hướng chính"
        >
          {navItems.map((item) => {
            if (item.protected && !isAuthenticated) return null
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMenus}
                className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            )
          })}

          {isAuthenticated ? (
            <div className="account-menu">
              <button
                type="button"
                className="account-menu__trigger"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="account-menu__avatar">{user.fullName?.charAt(0) ?? 'C'}</span>
                <span className="account-menu__label">{user.fullName?.split(' ').at(-1)}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="account-menu__popover">
                  <div className="account-menu__summary">
                    <strong>{user.fullName}</strong>
                    <span>{user.email}</span>
                  </div>
                  <NavLink to="/notifications" onClick={closeMenus}>
                    <Bell size={17} /> Thông báo
                  </NavLink>
                  {isAdmin && (
                    <NavLink to="/admin" onClick={closeMenus}>
                      <ShieldCheck size={17} /> Quản trị
                    </NavLink>
                  )}
                  <button type="button" onClick={handleLogout}>
                    <LogOut size={17} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <NavLink className="button button--small button--navy" to="/login" onClick={closeMenus}>
              <UserRound size={16} /> Đăng nhập
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  )
}
