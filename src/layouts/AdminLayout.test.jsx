import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLayout from './AdminLayout'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  showToast: vi.fn(),
  createNotificationSocket: vi.fn(),
  socketClose: vi.fn(),
  socketOptions: null,
  session: { accessToken: 'admin-token' },
  auth: {
    user: { id: 'admin-1', fullName: 'CloudStay Admin', email: 'admin@cloudstay.vn' },
    isAuthenticated: true,
    isAdmin: true,
    logout: vi.fn(),
  },
}))

vi.mock('../api', () => ({
  api: { notifications: { mine: mocks.mine } },
}))

vi.mock('../api/session', () => ({
  getApiSession: () => mocks.session,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('../realtime/notificationSocket', () => ({
  NOTIFICATION_CREATED_EVENT: 'cloudstay:notification-created',
  NOTIFICATIONS_CHANGED_EVENT: 'cloudstay:notifications-changed',
  createNotificationSocket: mocks.createNotificationSocket,
}))

function layoutTree(initialEntry = '/admin') {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Admin overview</p>} />
          <Route path="notifications" element={<p>Admin notifications</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('AdminLayout notification realtime and fallback', () => {
  beforeEach(() => {
    mocks.mine.mockReset()
    mocks.mine.mockResolvedValue({ data: [] })
    mocks.showToast.mockReset()
    mocks.socketClose.mockReset()
    mocks.socketOptions = null
    mocks.createNotificationSocket.mockReset()
    mocks.createNotificationSocket.mockImplementation((options) => {
      mocks.socketOptions = options
      return { close: mocks.socketClose }
    })
    mocks.session = { accessToken: 'admin-token' }
    mocks.auth.user = { id: 'admin-1', fullName: 'CloudStay Admin', email: 'admin@cloudstay.vn' }
    mocks.auth.isAuthenticated = true
    mocks.auth.isAdmin = true
    mocks.auth.logout.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('renders six admin links in the required order, including notifications', async () => {
    render(layoutTree())
    await flushPromises()
    const nav = screen.getByRole('navigation', { name: 'Điều hướng quản trị' })
    const labels = within(nav).getAllByRole('link').map((link) => link.textContent.trim())

    expect(labels).toEqual(['Tổng quan', 'Phòng', 'Booking', 'Thông báo', 'Tài khoản', 'Outbox'])
    expect(within(nav).getByRole('link', { name: 'Thông báo' })).toHaveAttribute('href', '/admin/notifications')
  })

  it('fetches initially, displays unread badge, and creates an ADMIN socket', async () => {
    mocks.mine.mockResolvedValue({
      data: [
        { id: 'notification-1', read: false },
        { id: 'notification-2', read: true },
        { id: 'notification-3', read: false },
      ],
    })

    render(layoutTree())

    expect(await screen.findByLabelText('2 thông báo chưa đọc')).toBeVisible()
    expect(mocks.mine).toHaveBeenCalledTimes(1)
    expect(mocks.createNotificationSocket).toHaveBeenCalledWith(expect.objectContaining({
      audience: 'ADMIN',
      onNotification: expect.any(Function),
    }))
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('hides the unread badge when the count is zero', async () => {
    render(layoutTree())
    await flushPromises()
    expect(screen.queryByLabelText(/thông báo chưa đọc/i)).not.toBeInTheDocument()
  })

  it('refetches on an ADMIN signal, updates badge, dispatches the page event, and toasts the REST title', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'notification-4', read: false, title: 'Có booking mới' }] })
    const created = vi.fn()
    window.addEventListener('cloudstay:notification-created', created, { once: true })
    render(layoutTree())
    await flushPromises()

    await act(async () => {
      await mocks.socketOptions.onNotification({
        type: 'NOTIFICATION_CREATED',
        notification_id: 'notification-4',
        event_type: 'BOOKING_CREATED',
        audience: 'ADMIN',
      })
    })

    expect(mocks.mine).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeVisible()
    expect(mocks.showToast).toHaveBeenCalledWith('Có booking mới', 'info')
    expect(created.mock.calls[0][0].detail.notification_id).toBe('notification-4')
  })

  it('does not show a duplicate toast for the same notification signal', async () => {
    const item = { id: 'notification-5', read: false, title: 'Booking vừa được tạo' }
    mocks.mine.mockResolvedValue({ data: [item] })
    render(layoutTree())
    await flushPromises()
    const signal = {
      type: 'NOTIFICATION_CREATED',
      notification_id: 'notification-5',
      event_type: 'BOOKING_CREATED',
      audience: 'ADMIN',
    }

    await act(async () => {
      await mocks.socketOptions.onNotification(signal)
      await mocks.socketOptions.onNotification(signal)
    })

    expect(mocks.mine).toHaveBeenCalledTimes(3)
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
  })

  it('refetches the badge when notifications-changed is dispatched', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [{ id: 'notification-1', read: false }] })
      .mockResolvedValueOnce({ data: [{ id: 'notification-1', read: true }] })
    render(layoutTree())
    expect(await screen.findByLabelText('1 thông báo chưa đọc')).toBeVisible()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('cloudstay:notifications-changed'))
      await Promise.resolve()
    })

    expect(mocks.mine).toHaveBeenCalledTimes(2)
    expect(screen.queryByLabelText(/thông báo chưa đọc/i)).not.toBeInTheDocument()
  })

  it('keeps a silent 60-second polling fallback', async () => {
    vi.useFakeTimers()
    render(layoutTree())
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
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('does not fetch or connect without an authenticated admin token', async () => {
    mocks.session = { accessToken: null }
    render(layoutTree())
    await flushPromises()
    expect(mocks.mine).not.toHaveBeenCalled()
    expect(mocks.createNotificationSocket).not.toHaveBeenCalled()
  })

  it('closes the socket and polling lifecycle on logout or unmount', async () => {
    vi.useFakeTimers()
    const view = render(layoutTree())
    await flushPromises()

    mocks.auth.user = null
    mocks.auth.isAuthenticated = false
    mocks.auth.isAdmin = false
    view.rerender(layoutTree())
    await flushPromises()

    expect(mocks.socketClose).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(mocks.mine).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(mocks.socketClose).toHaveBeenCalledTimes(1)
  })
})
