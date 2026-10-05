import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleX, Search, X } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import StatusBadge from '../../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import { useToast } from '../../contexts/ToastContext'
import { formatCurrency, formatDateVN } from '../../utils/date'

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { showToast } = useToast()

  const loadBookings = useCallback(async () => {
    setStatus('loading')
    try {
      setBookings(await api.bookings.adminList())
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => { loadBookings() }, [loadBookings])

  const filtered = useMemo(() => bookings.filter((booking) => {
    if (filter !== 'all' && booking.status !== filter) return false
    if (!query) return true
    return [booking.code, booking.user?.fullName, booking.user?.email, booking.room?.name, booking.room?.roomNumber]
      .join(' ').toLowerCase().includes(query.toLowerCase())
  }), [bookings, filter, query])

  const cancelBooking = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 2) return
    setCancelling(true)
    try {
      const updated = await api.bookings.cancel(cancelTarget.id, { reason })
      setBookings((current) => current.map((booking) => booking.id === updated.id ? updated : booking))
      showToast('Booking đã được admin hủy; khách đã nhận thông báo.')
      setCancelTarget(null)
      setReason('')
    } catch (cancelError) {
      showToast(getErrorMessage(cancelError), 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">Booking operations</span><h1>Quản lý booking</h1><p>Theo dõi đơn và hủy có lý do khi cần thiết.</p></div>
      </header>
      <div className="admin-toolbar admin-toolbar--bookings">
        <label className="search-input"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã đơn, khách hoặc phòng…" aria-label="Tìm booking" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Mọi trạng thái</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {status === 'loading' && <LoadingState label="Đang tải booking…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadBookings} />}
      {status === 'success' && filtered.length === 0 && <EmptyState title="Không có booking phù hợp" message="Hãy thử thay đổi từ khóa hoặc bộ lọc trạng thái." />}
      {status === 'success' && filtered.length > 0 && (
        <div className="admin-panel admin-panel--flush">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--bookings">
              <thead><tr><th>Mã đơn</th><th>Khách</th><th>Phòng</th><th>Lưu trú</th><th>Tổng</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr key={booking.id}>
                    <td><strong>{booking.code}</strong><small>{booking.guests} khách</small></td>
                    <td><strong>{booking.user?.fullName ?? 'Khách CloudStay'}</strong><small>{booking.user?.email}</small></td>
                    <td>{booking.room?.name}<small>Phòng {booking.room?.roomNumber}</small></td>
                    <td>{formatDateVN(booking.checkInDate)}<small>đến {formatDateVN(booking.checkOutDate)} · {booking.nights} đêm</small></td>
                    <td>{formatCurrency(booking.totalPrice)}</td>
                    <td><StatusBadge status={booking.status} /></td>
                    <td>{booking.canCancel && <button className="table-danger-action" type="button" onClick={() => { setCancelTarget(booking); setReason('') }}><CircleX /> Hủy</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancelTarget(null)}>
          <section className="admin-modal admin-modal--small" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <div className="admin-modal__header"><div><span className="eyebrow">Thao tác nhạy cảm</span><h2 id="cancel-title">Hủy booking {cancelTarget.code}</h2></div><button className="icon-button" type="button" onClick={() => setCancelTarget(null)} aria-label="Đóng"><X /></button></div>
            <p>Booking của <strong>{cancelTarget.user?.fullName}</strong> tại phòng <strong>{cancelTarget.room?.name}</strong> sẽ chuyển sang trạng thái đã hủy.</p>
            <form className="stack-form" onSubmit={cancelBooking}>
              <label htmlFor="admin-cancel-reason">Lý do hủy <span>(bắt buộc)</span><textarea id="admin-cancel-reason" rows="3" minLength="2" maxLength="300" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do để thông báo cho khách…" /></label>
              <div className="admin-modal__actions"><button type="button" className="button button--ghost" onClick={() => setCancelTarget(null)}>Quay lại</button><button className="button button--danger" type="submit" disabled={cancelling || reason.trim().length < 2}>{cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
