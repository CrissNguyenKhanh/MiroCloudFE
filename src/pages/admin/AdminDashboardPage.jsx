import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BedDouble, BookOpenCheck, CalendarClock, CircleDollarSign } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/common/States'
import StatusBadge from '../../components/common/StatusBadge'
import { formatCurrency, formatDateVN, todayISO } from '../../utils/date'

export default function AdminDashboardPage() {
  const [data, setData] = useState({ rooms: [], bookings: [] })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const [rooms, bookings] = await Promise.all([api.rooms.adminList(), api.bookings.adminList()])
      setData({ rooms, bookings })
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeBookings = data.bookings.filter((booking) => booking.status === 'confirmed')
  const upcoming = activeBookings.filter((booking) => booking.checkInDate >= todayISO())
  const estimatedRevenue = activeBookings.reduce((sum, booking) => sum + booking.totalPrice, 0)

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">CloudStay operations</span><h1>Tổng quan hôm nay</h1><p>Theo dõi nhanh tình trạng phòng và booking trong môi trường demo.</p></div>
        <span className="admin-mode-pill">Mock mode</span>
      </header>

      {status === 'loading' && <LoadingState label="Đang tổng hợp dữ liệu…" />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'success' && (
        <>
          <section className="metric-grid">
            <article><span className="metric-icon"><BedDouble /></span><small>Phòng đang nhận đặt</small><strong>{data.rooms.filter((room) => room.isBookable).length}</strong><em>/ {data.rooms.length} phòng</em></article>
            <article><span className="metric-icon"><BookOpenCheck /></span><small>Booking xác nhận</small><strong>{activeBookings.length}</strong><em>{data.bookings.filter((booking) => booking.status === 'cancelled').length} đã hủy</em></article>
            <article><span className="metric-icon"><CalendarClock /></span><small>Kỳ nghỉ sắp tới</small><strong>{upcoming.length}</strong><em>theo ngày nhận phòng</em></article>
            <article><span className="metric-icon"><CircleDollarSign /></span><small>Doanh thu dự kiến</small><strong>{formatCurrency(estimatedRevenue)}</strong><em>không phải số liệu thanh toán</em></article>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__heading"><div><h2>Booking gần đây</h2><p>Các đơn mới nhất trong dữ liệu mock.</p></div><Link className="text-link" to="/admin/bookings">Xem tất cả <ArrowRight /></Link></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Mã đơn</th><th>Khách</th><th>Phòng</th><th>Nhận phòng</th><th>Tổng dự kiến</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {data.bookings.slice(0, 5).map((booking) => (
                    <tr key={booking.id}>
                      <td><strong>{booking.code}</strong></td>
                      <td>{booking.user?.fullName ?? 'Khách CloudStay'}</td>
                      <td>{booking.room?.name}</td>
                      <td>{formatDateVN(booking.checkInDate)}</td>
                      <td>{formatCurrency(booking.totalPrice)}</td>
                      <td><StatusBadge status={booking.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
