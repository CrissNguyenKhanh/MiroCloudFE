import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNotificationSocket,
  getNotificationWebSocketUrl,
} from './notificationSocket'

class FakeWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.listeners = new Map()
    this.sent = []
    this.closed = false
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  send(message) {
    this.sent.push(message)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.emit('close')
  }
}

function createSocket(overrides = {}) {
  return createNotificationSocket({
    baseUrl: 'http://localhost:3003',
    getAccessToken: () => 'access-token',
    ...overrides,
  })
}

function authenticate(socket) {
  socket.emit('message', { data: JSON.stringify({ type: 'AUTH_OK' }) })
}

describe('notificationSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('derives ws and wss endpoint URLs from the Notification API base URL', () => {
    expect(getNotificationWebSocketUrl('http://localhost:3003')).toBe('ws://localhost:3003/ws')
    expect(getNotificationWebSocketUrl('https://notification.example.com/')).toBe(
      'wss://notification.example.com/ws',
    )
  })

  it('does not create a WebSocket without an access token', () => {
    const connection = createSocket({ getAccessToken: () => null })
    expect(FakeWebSocket.instances).toHaveLength(0)
    connection.close()
  })

  it('connects to the derived URL and sends AUTH with the current access token on open', () => {
    const connection = createSocket()
    const socket = FakeWebSocket.instances[0]

    expect(socket.url).toBe('ws://localhost:3003/ws')
    expect(socket.url).not.toContain('access-token')
    socket.emit('open')
    expect(socket.sent.map(JSON.parse)).toEqual([{ type: 'AUTH', token: 'access-token' }])
    connection.close()
  })

  it('becomes authenticated on AUTH_OK and only then delivers USER notification signals', () => {
    const onNotification = vi.fn()
    const connection = createSocket({ onNotification })
    const socket = FakeWebSocket.instances[0]
    const message = {
      type: 'NOTIFICATION_CREATED',
      notification_id: 'notification-1',
      event_type: 'BOOKING_CREATED',
      audience: 'USER',
    }

    socket.emit('message', { data: JSON.stringify(message) })
    expect(onNotification).not.toHaveBeenCalled()
    expect(connection.isAuthenticated()).toBe(false)

    authenticate(socket)
    socket.emit('message', { data: JSON.stringify(message) })
    expect(connection.isAuthenticated()).toBe(true)
    expect(onNotification).toHaveBeenCalledWith(message)
    connection.close()
  })

  it('ignores ADMIN notification signals in the customer connection', () => {
    const onNotification = vi.fn()
    const connection = createSocket({ onNotification })
    const socket = FakeWebSocket.instances[0]
    authenticate(socket)

    socket.emit('message', { data: JSON.stringify({
      type: 'NOTIFICATION_CREATED',
      notification_id: 'notification-1',
      event_type: 'BOOKING_CREATED',
      audience: 'ADMIN',
    }) })

    expect(onNotification).not.toHaveBeenCalled()
    connection.close()
  })

  it('delivers ADMIN notification signals when the expected audience is ADMIN', () => {
    const onNotification = vi.fn()
    const connection = createSocket({ expectedAudience: 'ADMIN', onNotification })
    const socket = FakeWebSocket.instances[0]
    const message = {
      type: 'NOTIFICATION_CREATED',
      notification_id: 'notification-admin-1',
      event_type: 'BOOKING_CREATED',
      audience: 'ADMIN',
    }
    authenticate(socket)

    socket.emit('message', { data: JSON.stringify(message) })

    expect(onNotification).toHaveBeenCalledWith(message)
    connection.close()
  })

  it('ignores USER notification signals in an ADMIN connection', () => {
    const onNotification = vi.fn()
    const connection = createSocket({ audience: 'ADMIN', onNotification })
    const socket = FakeWebSocket.instances[0]
    authenticate(socket)

    socket.emit('message', { data: JSON.stringify({
      type: 'NOTIFICATION_CREATED',
      notification_id: 'notification-user-1',
      event_type: 'BOOKING_CANCELLED',
      audience: 'USER',
    }) })

    expect(onNotification).not.toHaveBeenCalled()
    connection.close()
  })

  it('ignores malformed and unsupported messages without throwing', () => {
    const onNotification = vi.fn()
    const connection = createSocket({ onNotification })
    const socket = FakeWebSocket.instances[0]
    authenticate(socket)

    expect(() => socket.emit('message', { data: '{invalid-json' })).not.toThrow()
    expect(() => socket.emit('message', { data: JSON.stringify({
      type: 'NOTIFICATION_CREATED',
      audience: 'USER',
    }) })).not.toThrow()
    expect(onNotification).not.toHaveBeenCalled()
    connection.close()
  })

  it('reconnects with bounded backoff and resets it after AUTH_OK', () => {
    const connection = createSocket()
    const first = FakeWebSocket.instances[0]
    first.emit('close')

    vi.advanceTimersByTime(999)
    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(2)

    const second = FakeWebSocket.instances[1]
    second.emit('close')
    vi.advanceTimersByTime(1_999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)

    const third = FakeWebSocket.instances[2]
    authenticate(third)
    third.emit('close')
    vi.advanceTimersByTime(1_000)
    expect(FakeWebSocket.instances).toHaveLength(4)
    connection.close()
  })

  it('close shuts down an active socket without scheduling reconnect', () => {
    const connection = createSocket()
    const socket = FakeWebSocket.instances[0]
    connection.close()

    expect(socket.closed).toBe(true)
    vi.advanceTimersByTime(20_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('close cancels an already scheduled reconnect timer', () => {
    const connection = createSocket()
    FakeWebSocket.instances[0].emit('close')
    connection.close()

    vi.advanceTimersByTime(20_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
