import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleX, X } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import StatusBadge from '../../components/common/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import { useToast } from '../../contexts/ToastContext'
import { formatCurrency, formatDateVN } from '../../utils/date'

const PAGE_SIZE = 20

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [roomId, setRoomId] = useState('')
  const [userId, setUserId] = useState('')
  const [filterDraft, setFilterDraft] = useState({ roomId: '', userId: '' })
  const [page, setPage] = useState(1)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const requestIdRef = useRef(0)
  const { showToast } = useToast()

  const loadBookings = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setError('')
    try {
      const result = await api.bookings.adminList({
        ...(filter === 'all' ? {} : { status: filter }),
        ...(roomId ? { roomId } : {}),
        ...(userId ? { userId } : {}),
        page,
        limit: PAGE_SIZE,
      })
      if (requestId !== requestIdRef.current) return
      setBookings(result.data)
      setMeta(result.meta)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [filter, page, roomId, userId])

  useEffect(() => {
    loadBookings()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadBookings])

  const changeFilter = (value) => {
    setFilter(value)
    setPage(1)
  }

  const applyEntityFilters = (event) => {
    event.preventDefault()
    setRoomId(filterDraft.roomId.trim())
    setUserId(filterDraft.userId.trim())
    setPage(1)
  }

  const clearEntityFilters = () => {
    setFilterDraft({ roomId: '', userId: '' })
    setRoomId('')
    setUserId('')
    setPage(1)
  }

  const cancelBooking = async (event) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 2) return
    setCancelling(true)
    try {
      await api.bookings.cancelAdmin(cancelTarget.id, { reason: trimmedReason })
      showToast('Booking đã được admin hủy. Việc gửi thông báo được xử lý riêng qua outbox.')
      setCancelTarget(null)
      setReason('')
      await loadBookings()
    } catch (cancelError) {
      showToast(getErrorMessage(cancelError), 'error')
    } finally {
      setCancelling(false)
    }
  }

  const total = Number(meta?.total)
  const hasKnownTotal = Number.isFinite(total) && total >= 0
  const hasPrevious = page > 1
  const hasNext = hasKnownTotal ? page * PAGE_SIZE < total : bookings.length === PAGE_SIZE

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><span className="eyebrow">Booking operations</span><h1>Quản lý booking</h1><p>Theo dõi đơn và hủy có lý do khi cần thiết.</p></div>
      </header>
      <div className="admin-toolbar admin-toolbar--bookings">
        <span>{hasKnownTotal ? `${total} booking phù hợp` : `Trang ${page}`}</span>
        <select value={filter} onChange={(event) => changeFilter(event.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Mọi trạng thái</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>
      <form className="admin-toolbar admin-toolbar--bookings" onSubmit={applyEntityFilters}>
        <label>
          <span className="sr-only">Lọc theo Room ID</span>
          <input
            value={filterDraft.roomId}
            onChange={(event) => setFilterDraft((current) => ({ ...current, roomId: event.target.value }))}
            placeholder="Room UUID"
            aria-label="Lọc theo Room ID"
          />
        </label>
        <label>
          <span className="sr-only">Lọc theo User ID</span>
          <input
            value={filterDraft.userId}
            onChange={(event) => setFilterDraft((current) => ({ ...current, userId: event.target.value }))}
            placeholder="User UUID"
            aria-label="Lọc theo User ID"
          />
        </label>
        <button className="button button--outline" type="submit">Áp dụng</button>
        {(roomId || userId) && <button className="text-button" type="button" onClick={clearEntityFilters}>Xóa lọc ID</button>}
      </form>

      {status === 'loading' && <LoadingState label="Đang tải booking…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadBookings} />}
      {status === 'success' && bookings.length === 0 && <EmptyState title={hasPrevious ? 'Trang này không còn booking' : 'Không có booking phù hợp'} message={hasPrevious ? 'Dữ liệu có thể đã thay đổi. Hãy quay lại trang trước.' : 'Hãy thử thay đổi bộ lọc trạng thái.'} />}
      {status === 'success' && bookings.length > 0 && (
        <>
          <div className="admin-panel admin-panel--flush">
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--bookings">
                <thead><tr><th>Mã đơn</th><th>Khách</th><th>Phòng</th><th>Lưu trú</th><th>Tổng</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
                <tbody>
                  {bookings.map((booking) => {
                    const userLabel = booking.user?.fullName || (booking.userId ? `ID ${booking.userId}` : 'Không có dữ liệu hồ sơ')
                    const roomLabel = booking.room?.name || booking.roomName || (booking.roomId ? `ID ${booking.roomId}` : 'Không có dữ liệu phòng')
                    const roomNumber = booking.room?.roomNumber || booking.roomNumber
                    return (
                      <tr key={booking.id}>
                        <td><strong>{booking.code}</strong><small>{booking.guests} khách</small></td>
                        <td><strong>{userLabel}</strong><small>{booking.user?.email || 'Không có email trong booking'}</small></td>
                        <td>{roomLabel}<small>{roomNumber ? `Phòng ${roomNumber}` : `ID ${booking.roomId}`}</small></td>
                        <td>{formatDateVN(booking.checkInDate)}<small>đến {formatDateVN(booking.checkOutDate)} · {booking.nights} đêm</small></td>
                        <td>{formatCurrency(booking.totalPrice)}</td>
                        <td><StatusBadge status={booking.status} /></td>
                        <td>{booking.status === 'confirmed' && <button className="table-danger-action" type="button" onClick={() => { setCancelTarget(booking); setReason('') }}><CircleX /> Hủy</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {(hasPrevious || hasNext) && (
            <nav className="pagination" aria-label="Phân trang booking admin">
              <button className="button button--outline" type="button" disabled={!hasPrevious} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> Trang trước</button>
              <span>Trang {page}</span>
              <button className="button button--outline" type="button" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>Trang sau <ChevronRight size={17} /></button>
            </nav>
          )}
        </>
      )}

      {cancelTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancelTarget(null)}>
          <section className="admin-modal admin-modal--small" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <div className="admin-modal__header"><div><span className="eyebrow">Thao tác nhạy cảm</span><h2 id="cancel-title">Hủy booking {cancelTarget.code}</h2></div><button className="icon-button" type="button" onClick={() => setCancelTarget(null)} aria-label="Đóng"><X /></button></div>
            <p>Booking của <strong>{cancelTarget.user?.fullName || `ID ${cancelTarget.userId}`}</strong> tại <strong>{cancelTarget.room?.name || cancelTarget.roomName || `ID ${cancelTarget.roomId}`}</strong> sẽ chuyển sang trạng thái đã hủy.</p>
            <form className="stack-form" onSubmit={cancelBooking}>
              <label htmlFor="admin-cancel-reason">Lý do hủy <span>(bắt buộc)</span><textarea id="admin-cancel-reason" rows="3" minLength="2" maxLength="300" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do hủy booking…" /></label>
              <div className="admin-modal__actions"><button type="button" className="button button--ghost" onClick={() => setCancelTarget(null)}>Quay lại</button><button className="button button--danger" type="submit" disabled={cancelling || reason.trim().length < 2}>{cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
