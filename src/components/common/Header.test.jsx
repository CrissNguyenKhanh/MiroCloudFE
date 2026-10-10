import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Header from './Header'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  showToast: vi.fn(),
  createNotificationSocket: vi.fn(),
  socketClose: vi.fn(),
  socketOptions: null,
  auth: {
    user: { id: 'user-1', fullName: 'Nguyễn An', email: 'an@example.com' },
    isAuthenticated: true,
    isAdmin: false,
    logout: vi.fn(),
  },
}))

vi.mock('../../api', () => ({
  api: { notifications: { mine: mocks.mine } },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('../../realtime/notificationSocket', () => ({
  NOTIFICATION_CREATED_EVENT: 'cloudstay:notification-created',
  NOTIFICATIONS_CHANGED_EVENT: 'cloudstay:notifications-changed',
  createNotificationSocket: mocks.createNotificationSocket,
}))

function headerTree() {
  return (
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  )
}

function renderHeader() {
  return render(headerTree())
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('Header notification realtime and fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.mine.mockReset()
    mocks.showToast.mockReset()
    mocks.socketClose.mockReset()
    mocks.socketOptions = null
    mocks.createNotificationSocket.mockReset()
    mocks.createNotificationSocket.mockImplementation((options) => {
      mocks.socketOptions = options
      return { close: mocks.socketClose }
    })
    mocks.auth.user = { id: 'user-1', fullName: 'Nguyễn An', email: 'an@example.com' }
    mocks.auth.isAuthenticated = true
    mocks.auth.isAdmin = false
    mocks.auth.logout.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('fetches notifications initially and displays the unread count', async () => {
    mocks.mine.mockResolvedValue({
      data: [
        { id: 'notification-1', read: false },
        { id: 'notification-2', read: true },
        { id: 'notification-3', read: false },
      ],
    })

    renderHeader()
    await flushPromises()

    expect(mocks.mine).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('2 thông báo chưa đọc')).toBeVisible()
    expect(mocks.createNotificationSocket).toHaveBeenCalledTimes(1)
  })

  it('does not fetch, poll, or create a socket while unauthenticated', async () => {
    mocks.auth.user = null
    mocks.auth.isAuthenticated = false

    renderHeader()
    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })

    expect(mocks.mine).not.toHaveBeenCalled()
    expect(mocks.createNotificationSocket).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/thông báo chưa đọc/i)).not.toBeInTheDocument()
  })

  it('keeps a 60-second polling fallback', async () => {
    mocks.mine.mockResolvedValue({ data: [] })
    renderHeader()
    await flushPromises()

    await act(async () => {
      vi.advanceTimersByTime(59_999)
      await Promise.resolve()
    })
    expect(mocks.mine).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(mocks.mine).toHaveBeenCalledTimes(2)
  })

  it('BOOKING_CREATED refetches immediately, updates the badge, and shows no duplicate toast', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'notification-1', read: false }] })
    const notificationCreated = vi.fn()
    window.addEventListener('cloudstay:notification-created', notificationCreated, { once: true })
    renderHeader()
    await flushPromises()

    await act(async () => {
      await mocks.socketOptions.onNotification({
        type: 'NOTIFICATION_CREATED',
        notification_id: 'notification-1',
        event_type: 'BOOKING_CREATED',
        audience: 'USER',
      })
    })

    expect(mocks.mine).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeVisible()
    expect(mocks.showToast).not.toHaveBeenCalled()
    expect(notificationCreated.mock.calls[0][0].detail.notification_id).toBe('notification-1')
  })

  it('shows an informational toast when an admin cancelled the booking', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{
          id: 'notification-2',
          read: false,
          payload: { cancelledBy: 'ADMIN' },
        }],
      })
    renderHeader()
    await flushPromises()

    await act(async () => {
      await mocks.socketOptions.onNotification({
        type: 'NOTIFICATION_CREATED',
        notification_id: 'notification-2',
        event_type: 'BOOKING_CANCELLED',
        audience: 'USER',
      })
    })

    expect(mocks.showToast).toHaveBeenCalledWith(
      'Đặt phòng của bạn đã bị quản trị viên hủy.',
      'info',
    )
  })

  it('does not show a duplicate realtime toast when the customer cancelled the booking', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{
          id: 'notification-3',
          read: false,
          payload: { cancelledBy: 'USER' },
        }],
      })
    renderHeader()
    await flushPromises()

    await act(async () => {
      await mocks.socketOptions.onNotification({
        type: 'NOTIFICATION_CREATED',
        notification_id: 'notification-3',
        event_type: 'BOOKING_CANCELLED',
        audience: 'USER',
      })
    })

    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('refetches the badge immediately when notifications-changed is dispatched', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [{ id: 'notification-1', read: false }] })
      .mockResolvedValueOnce({ data: [{ id: 'notification-1', read: true }] })
    renderHeader()
    await flushPromises()
    expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeVisible()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('cloudstay:notifications-changed'))
      await Promise.resolve()
    })

    expect(mocks.mine).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText(/thông báo chưa đọc/i)).not.toBeInTheDocument()
  })

  it('closes the socket and polling lifecycle on logout or unmount', async () => {
    mocks.mine.mockResolvedValue({ data: [] })
    const view = renderHeader()
    await flushPromises()

    mocks.auth.user = null
    mocks.auth.isAuthenticated = false
    view.rerender(headerTree())
    await flushPromises()

    expect(mocks.socketClose).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(mocks.mine).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(mocks.socketClose).toHaveBeenCalledTimes(1)
  })
})
