import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarCheck2, CheckCheck, CircleX, Sparkles } from 'lucide-react'
import { api } from '../api'
import { getErrorMessage } from '../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { useToast } from '../contexts/ToastContext'

const typeIcons = {
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
  }).format(new Date(value))
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const { showToast } = useToast()

  const loadNotifications = useCallback(async () => {
    setStatus('loading')
    try {
      setNotifications(await api.notifications.mine())
      setStatus('success')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markRead = async (id) => {
    try {
      const updated = await api.notifications.markRead(id)
      setNotifications((current) => current.map((item) => item.id === id ? updated : item))
    } catch (updateError) {
      showToast(getErrorMessage(updateError), 'error')
    }
  }

  const markAllRead = async () => {
    setUpdating(true)
    try {
      setNotifications(await api.notifications.markAllRead())
      showToast('Đã đánh dấu tất cả thông báo là đã đọc.')
    } catch (updateError) {
      showToast(getErrorMessage(updateError), 'error')
    } finally {
      setUpdating(false)
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <div className="page page--soft account-page">
      <section className="account-page__hero">
        <div className="container account-page__hero-row">
          <div>
            <span className="eyebrow">Cập nhật mới nhất</span>
            <h1>Thông báo</h1>
            <p>{unreadCount ? `Bạn có ${unreadCount} thông báo chưa đọc.` : 'Bạn đã xem hết các thông báo.'}</p>
          </div>
          {unreadCount > 0 && (
            <button className="button button--outline" type="button" onClick={markAllRead} disabled={updating}>
              <CheckCheck size={17} /> {updating ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
            </button>
          )}
        </div>
      </section>
      <section className="section account-page__content">
        <div className="container container--narrow">
          {status === 'loading' && <LoadingState label="Đang tải thông báo…" />}
          {status === 'error' && <ErrorState message={error} onRetry={loadNotifications} />}
          {status === 'success' && notifications.length === 0 && <EmptyState title="Chưa có thông báo" message="Các xác nhận đặt hoặc hủy phòng sẽ xuất hiện tại đây." />}
          {status === 'success' && notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] ?? Bell
                return (
                  <button
                    type="button"
                    className={`notification-item${notification.read ? '' : ' notification-item--unread'}`}
                    key={notification.id}
                    onClick={() => !notification.read && markRead(notification.id)}
                    aria-label={`${notification.title}${notification.read ? ', đã đọc' : ', chưa đọc. Nhấn để đánh dấu đã đọc'}`}
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
          )}
        </div>
      </section>
    </div>
  )
}
