import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Footer from '../components/common/Footer'
import Header from '../components/common/Header'

export default function MainLayout() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
