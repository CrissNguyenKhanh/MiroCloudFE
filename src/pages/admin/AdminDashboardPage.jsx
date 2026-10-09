import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BedDouble, BookOpenCheck, CalendarClock, CircleDollarSign } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, isMockMode } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/common/States'
import StatusBadge from '../../components/common/StatusBadge'
import { formatCurrency, formatDateVN } from '../../utils/date'

export default function AdminDashboardPage() {
  const [data, setData] = useState({ rooms: [], bookings: [], bookingsMeta: null })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const [rooms, bookings] = await Promise.all([
        api.rooms.list(),
        api.bookings.adminList({ page: 1, limit: 20 }),
      ])
      setData({ rooms: rooms.data, bookings: bookings.data, bookingsMeta: bookings.meta })
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
  const cancelledBookings = data.bookings.filter((booking) => booking.status === 'cancelled')
  const pageBookingValue = activeBookings.reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0)

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">CloudStay operations</span><h1>Tổng quan</h1><p>Số liệu bên dưới chỉ phản ánh danh sách active và trang booking đang tải, không phải thống kê toàn hệ thống.</p></div>
        <span className="admin-mode-pill">{isMockMode ? 'Mock mode' : 'Real API'}</span>
      </header>

      {status === 'loading' && <LoadingState label="Đang tổng hợp dữ liệu…" />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'success' && (
        <>
          <section className="metric-grid">
            <article><span className="metric-icon"><BedDouble /></span><small>Phòng active</small><strong>{data.rooms.length}</strong><em>không gồm phòng inactive</em></article>
            <article><span className="metric-icon"><BookOpenCheck /></span><small>Booking trên trang 1</small><strong>{data.bookings.length}</strong><em>{Number.isFinite(Number(data.bookingsMeta?.total)) ? `${data.bookingsMeta.total} tổng từ API` : 'tối đa 20 dòng'}</em></article>
            <article><span className="metric-icon"><CalendarClock /></span><small>Trạng thái trên trang</small><strong>{activeBookings.length}</strong><em>xác nhận · {cancelledBookings.length} đã hủy</em></article>
            <article><span className="metric-icon"><CircleDollarSign /></span><small>Giá trị booking xác nhận</small><strong>{formatCurrency(pageBookingValue)}</strong><em>chỉ trang này, không phải doanh thu</em></article>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__heading"><div><h2>Booking gần đây</h2><p>Tối đa 5 dòng từ trang booking đầu tiên.</p></div><Link className="text-link" to="/admin/bookings">Xem danh sách <ArrowRight /></Link></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Mã đơn</th><th>Khách</th><th>Phòng</th><th>Nhận phòng</th><th>Tổng dự kiến</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {data.bookings.slice(0, 5).map((booking) => (
                    <tr key={booking.id}>
                      <td><strong>{booking.code}</strong></td>
                      <td>{booking.user?.fullName || (booking.userId ? `ID ${booking.userId}` : 'Không có dữ liệu hồ sơ')}</td>
                      <td>{booking.room?.name || booking.roomName || `ID ${booking.roomId}`}</td>
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
