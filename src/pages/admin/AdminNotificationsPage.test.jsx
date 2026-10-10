import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminNotificationsPage from './AdminNotificationsPage'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  showToast: vi.fn(),
  dispatchNotificationsChanged: vi.fn(),
}))

vi.mock('../../api', () => ({
  api: {
    notifications: {
      mine: mocks.mine,
      markRead: mocks.markRead,
      markAllRead: mocks.markAllRead,
    },
  },
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('../../realtime/notificationSocket', () => ({
  NOTIFICATION_CREATED_EVENT: 'cloudstay:notification-created',
  dispatchNotificationsChanged: mocks.dispatchNotificationsChanged,
}))

function notification(overrides = {}) {
  return {
    id: 'admin-notification-1',
    title: 'Có booking mới',
    message: 'Booking CS-1001 vừa được tạo.',
    type: 'booking_created',
    read: false,
    createdAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('AdminNotificationsPage', () => {
  beforeEach(() => {
    mocks.mine.mockReset()
    mocks.markRead.mockReset()
    mocks.markAllRead.mockReset()
    mocks.showToast.mockReset()
    mocks.dispatchNotificationsChanged.mockReset()
  })

  it('shows loading, then renders notifications and unread count', async () => {
    let resolveMine
    mocks.mine.mockImplementation(() => new Promise((resolve) => { resolveMine = resolve }))
    render(<AdminNotificationsPage />)
    expect(screen.getByText('Đang tải thông báo quản trị…')).toBeVisible()

    await act(async () => {
      resolveMine({ data: [notification(), notification({ id: 'read-1', title: 'Đã xử lý', read: true })] })
    })

    expect(screen.getByText('Có booking mới')).toBeVisible()
    expect(screen.getByText('1 thông báo chưa đọc cần được theo dõi.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/i })).toBeVisible()
  })

  it('renders an empty state when there are no admin notifications', async () => {
    mocks.mine.mockResolvedValue({ data: [] })
    render(<AdminNotificationsPage />)
    expect(await screen.findByRole('heading', { name: 'Chưa có thông báo' })).toBeVisible()
  })

  it('marks one unread notification locally and dispatches notifications-changed', async () => {
    const current = notification()
    mocks.mine.mockResolvedValue({ data: [current] })
    mocks.markRead.mockResolvedValue({ ...current, read: true })
    render(<AdminNotificationsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Có booking mới, chưa đọc/i }))

    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith('admin-notification-1'))
    expect(await screen.findByRole('button', { name: /Có booking mới, đã đọc/i })).toBeVisible()
    expect(mocks.dispatchNotificationsChanged).toHaveBeenCalledTimes(1)
  })

  it('marks all notifications read and dispatches notifications-changed', async () => {
    const current = notification()
    mocks.mine.mockResolvedValue({ data: [current] })
    mocks.markAllRead.mockResolvedValue({
      data: [{ ...current, read: true }],
      attemptedCount: 1,
      updatedCount: 1,
      failedCount: 0,
      failures: [],
    })
    render(<AdminNotificationsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Đánh dấu tất cả đã đọc/i }))

    await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1))
    expect(mocks.dispatchNotificationsChanged).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('Đã đánh dấu tất cả thông báo là đã đọc.')
    expect(screen.queryByRole('button', { name: /Đánh dấu tất cả đã đọc/i })).not.toBeInTheDocument()
  })

  it('silently refetches when notification-created is dispatched', async () => {
    let resolveRealtime
    mocks.mine
      .mockResolvedValueOnce({ data: [notification()] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRealtime = resolve }))
    render(<AdminNotificationsPage />)
    expect(await screen.findByText('Có booking mới')).toBeVisible()

    act(() => {
      window.dispatchEvent(new CustomEvent('cloudstay:notification-created'))
    })
    expect(screen.queryByText('Đang tải thông báo quản trị…')).not.toBeInTheDocument()
    expect(screen.getByText('Có booking mới')).toBeVisible()

    await act(async () => {
      resolveRealtime({ data: [notification(), notification({ id: 'admin-notification-2', title: 'Booking tiếp theo' })] })
    })
    expect(screen.getByText('Booking tiếp theo')).toBeVisible()
  })

  it('keeps the newest realtime response when requests resolve out of order', async () => {
    let resolveOlder
    let resolveNewer
    mocks.mine
      .mockResolvedValueOnce({ data: [notification()] })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNewer = resolve }))
    render(<AdminNotificationsPage />)
    expect(await screen.findByText('Có booking mới')).toBeVisible()

    act(() => window.dispatchEvent(new CustomEvent('cloudstay:notification-created')))
    act(() => window.dispatchEvent(new CustomEvent('cloudstay:notification-created')))
    await act(async () => {
      resolveNewer({ data: [notification({ id: 'newer', title: 'Mới nhất' })] })
    })
    expect(screen.getByText('Mới nhất')).toBeVisible()

    await act(async () => {
      resolveOlder({ data: [notification({ id: 'older', title: 'Cũ hơn' })] })
    })
    expect(screen.getByText('Mới nhất')).toBeVisible()
    expect(screen.queryByText('Cũ hơn')).not.toBeInTheDocument()
  })

  it('shows a retryable error when the initial request fails', async () => {
    mocks.mine.mockRejectedValue(new Error('Notification API unavailable'))
    render(<AdminNotificationsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Notification API unavailable')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })

  it('shows an error toast when markRead fails', async () => {
    mocks.mine.mockResolvedValue({ data: [notification()] })
    mocks.markRead.mockRejectedValue(new Error('Không thể cập nhật'))
    render(<AdminNotificationsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Có booking mới, chưa đọc/i }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('Không thể cập nhật', 'error'))
    expect(mocks.dispatchNotificationsChanged).not.toHaveBeenCalled()
  })

  it('reports partial mark-all failures with the customer-compatible message', async () => {
    const current = notification()
    mocks.mine.mockResolvedValue({ data: [current] })
    mocks.markAllRead.mockResolvedValue({
      data: [current],
      attemptedCount: 2,
      updatedCount: 1,
      failedCount: 1,
      failures: [{ id: current.id }],
    })
    render(<AdminNotificationsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Đánh dấu tất cả đã đọc/i }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(
      'Đã cập nhật 1/2 thông báo; 1 thông báo chưa hoàn tất.',
      'error',
    ))
    expect(mocks.dispatchNotificationsChanged).toHaveBeenCalledTimes(1)
  })
})
