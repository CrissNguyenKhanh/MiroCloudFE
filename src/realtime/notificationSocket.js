import { apiConfig } from '../api/config'
import { getApiSession } from '../api/session'

export const NOTIFICATION_CREATED_EVENT = 'cloudstay:notification-created'
export const NOTIFICATIONS_CHANGED_EVENT = 'cloudstay:notifications-changed'

const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000]
const SUPPORTED_EVENT_TYPES = new Set(['BOOKING_CREATED', 'BOOKING_CANCELLED'])

export function getNotificationWebSocketUrl(baseUrl = apiConfig.notificationBaseUrl) {
  const url = new URL(baseUrl)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  else throw new TypeError('Notification API URL must use http or https')

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function dispatchNotificationsChanged() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
}

export function createNotificationSocket({
  onNotification,
  audience = 'USER',
  expectedAudience = audience,
  baseUrl = apiConfig.notificationBaseUrl,
  getAccessToken = () => getApiSession().accessToken,
  WebSocketImpl = globalThis.WebSocket,
  reconnectDelays = DEFAULT_RECONNECT_DELAYS,
  setTimeoutFn = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeoutFn = (timer) => globalThis.clearTimeout(timer),
} = {}) {
  let socket = null
  let reconnectTimer = null
  let reconnectAttempt = 0
  let authenticated = false
  let stopped = false

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== null || !getAccessToken()) return
    const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)]
    reconnectAttempt += 1
    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const connect = () => {
    const accessToken = getAccessToken()
    if (stopped || !accessToken || !baseUrl || typeof WebSocketImpl !== 'function') return

    let client
    try {
      client = new WebSocketImpl(getNotificationWebSocketUrl(baseUrl))
    } catch {
      scheduleReconnect()
      return
    }

    socket = client
    authenticated = false

    client.addEventListener('open', () => {
      if (stopped || socket !== client) return
      client.send(JSON.stringify({ type: 'AUTH', token: accessToken }))
    })

    client.addEventListener('message', (event) => {
      if (stopped || socket !== client || typeof event.data !== 'string') return
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }

      if (message?.type === 'AUTH_OK') {
        authenticated = true
        reconnectAttempt = 0
        return
      }

      if (!authenticated
        || message?.type !== 'NOTIFICATION_CREATED'
        || message.audience !== expectedAudience
        || typeof message.notification_id !== 'string'
        || !SUPPORTED_EVENT_TYPES.has(message.event_type)) return

      onNotification?.(message)
    })

    client.addEventListener('close', () => {
      if (socket !== client) return
      socket = null
      authenticated = false
      scheduleReconnect()
    })

    client.addEventListener('error', () => {
      // Browser close events drive reconnect. Realtime errors remain silent and best-effort.
    })
  }

  connect()

  return {
    isAuthenticated: () => authenticated,
    close() {
      stopped = true
      authenticated = false
      if (reconnectTimer !== null) {
        clearTimeoutFn(reconnectTimer)
        reconnectTimer = null
      }
      const activeSocket = socket
      socket = null
      activeSocket?.close()
    },
  }
}
