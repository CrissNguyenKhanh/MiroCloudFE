import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CalendarCheck2, CheckCheck, CircleX, Sparkles } from 'lucide-react'
import { api } from '../../api'
import { getErrorMessage } from '../../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/States'
import { useToast } from '../../contexts/ToastContext'
import {
  dispatchNotificationsChanged,
  NOTIFICATION_CREATED_EVENT,
} from '../../realtime/notificationSocket'

const typeIcons = {
  booking_created: CalendarCheck2,
  booking_confirmed: CalendarCheck2,
  booking_cancelled: CircleX,
  welcome: Sparkles,
}

function formatTimestamp(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const loadRequestRef = useRef(0)
  const { showToast } = useToast()

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++loadRequestRef.current
    if (!silent) {
      setStatus('loading')
      setError('')
    }
    try {
      const result = await api.notifications.mine()
      if (requestId !== loadRequestRef.current) return
      setNotifications(result.data)
      setStatus('success')
    } catch (loadError) {
      if (requestId !== loadRequestRef.current || silent) return
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    return () => {
      loadRequestRef.current += 1
    }
  }, [loadNotifications])

  useEffect(() => {
    const handleNotificationCreated = () => loadNotifications({ silent: true })
    window.addEventListener(NOTIFICATION_CREATED_EVENT, handleNotificationCreated)
    return () => window.removeEventListener(NOTIFICATION_CREATED_EVENT, handleNotificationCreated)
  }, [loadNotifications])

  const markRead = async (id) => {
    if (pendingIds.has(id)) return
    setPendingIds((current) => new Set(current).add(id))
    try {
      const updated = await api.notifications.markRead(id)
      setNotifications((current) => current.map((item) => item.id === id ? updated : item))
      dispatchNotificationsChanged()
    } catch (updateError) {
      showToast(getErrorMessage(updateError), 'error')
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const markAllRead = async () => {
    setUpdating(true)
    try {
      const result = await api.notifications.markAllRead()
      setNotifications(result.data)
      dispatchNotificationsChanged()
      if (result.failedCount > 0) {
        showToast('Đã cập nhật ' + result.updatedCount + '/' + result.attemptedCount + ' thông báo; ' + result.failedCount + ' thông báo chưa hoàn tất.', 'error')
      } else {
        showToast('Đã đánh dấu tất cả thông báo là đã đọc.')
      }
    } catch (updateError) {
      showToast(getErrorMessage(updateError), 'error')
      await loadNotifications()
    } finally {
      setUpdating(false)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <span className="eyebrow">Notification operations</span>
          <h1>Thông báo</h1>
          <p>{unreadCount ? unreadCount + ' thông báo chưa đọc cần được theo dõi.' : 'Tất cả thông báo quản trị đã được đọc.'}</p>
        </div>
        {unreadCount > 0 && (
          <button className="button button--outline" type="button" onClick={markAllRead} disabled={updating}>
            <CheckCheck size={17} /> {updating ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
          </button>
        )}
      </header>

      {status === 'loading' && <LoadingState label="Đang tải thông báo quản trị…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadNotifications} />}
      {status === 'success' && notifications.length === 0 && (
        <EmptyState title="Chưa có thông báo" message="Các sự kiện đặt phòng dành cho quản trị viên sẽ xuất hiện tại đây." />
      )}
      {status === 'success' && notifications.length > 0 && (
        <section className="admin-panel admin-notifications-panel" aria-label="Danh sách thông báo quản trị">
          <div className="notification-list">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? Bell
              return (
                <button
                  type="button"
                  className={'notification-item' + (notification.read ? '' : ' notification-item--unread')}
                  key={notification.id}
                  onClick={() => !notification.read && markRead(notification.id)}
                  disabled={pendingIds.has(notification.id)}
                  aria-label={notification.title + (notification.read ? ', đã đọc' : ', chưa đọc. Nhấn để đánh dấu đã đọc')}
                >
                  <span className="notification-item__icon"><Icon /></span>
                  <span className="notification-item__body">
                    <span className="notification-item__top"><strong>{notification.title}</strong><time>{formatTimestamp(notification.createdAt)}</time></span>
                    <span>{notification.message}</span>
                  </span>
                  {!notification.read && <i aria-label="Chưa đọc" />}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
