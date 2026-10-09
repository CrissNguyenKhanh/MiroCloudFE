import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import { useToast } from '../../contexts/ToastContext'

function formatTimestamp(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export default function AdminOutboxPage() {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const { showToast } = useToast()

  const loadEvents = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const result = await api.bookings.listOutbox()
      setEvents(result.data)
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const retry = async () => {
    if (!window.confirm('Retry thủ công các outbox event đang đến hạn?')) return
    setRetrying(true)
    try {
      const result = await api.bookings.retryOutbox()
      showToast(`Đã xử lý ${result.data.length} outbox event đến hạn.`)
      await loadEvents()
    } catch (retryError) {
      showToast(getErrorMessage(retryError), 'error')
    } finally {
      setRetrying(false)
    }
  }

  const pendingCount = events.filter((event) => event.status === 'PENDING' || event.status === 'pending').length

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--actions">
        <div><span className="eyebrow">Notification delivery</span><h1>Outbox</h1><p>Tối đa 200 event mới nhất. Trang này không tự retry hoặc dùng service key.</p></div>
        <button className="button button--copper" type="button" onClick={retry} disabled={retrying || pendingCount === 0}><RefreshCcw /> {retrying ? 'Đang retry…' : `Retry thủ công (${pendingCount})`}</button>
      </header>

      {status === 'loading' && <LoadingState label="Đang tải outbox…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadEvents} />}
      {status === 'success' && events.length === 0 && <EmptyState title="Outbox đang trống" message="Chưa có event nào được backend trả về." />}
      {status === 'success' && events.length > 0 && (
        <div className="admin-panel admin-panel--flush">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Event</th><th>Aggregate / user</th><th>Trạng thái</th><th>Lần thử</th><th>Cập nhật</th><th>Lỗi gần nhất</th></tr></thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={event.eventId || event.id || index}>
                    <td><strong>{event.eventType || event.type || 'Không rõ loại'}</strong><small>{event.eventId || event.id || 'Không có ID'}</small></td>
                    <td>{event.aggregateId || '—'}<small>{event.userId ? `User ${event.userId}` : 'Không có user_id'}</small></td>
                    <td><span className={`availability-pill${String(event.status).toUpperCase() === 'SENT' ? ' availability-pill--on' : ''}`}>{event.status || '—'}</span></td>
                    <td>{event.attempts ?? 0}</td>
                    <td>{formatTimestamp(event.updatedAt || event.createdAt)}</td>
                    <td>{event.lastError || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
