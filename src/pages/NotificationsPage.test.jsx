import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsPage from './NotificationsPage'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../api', () => ({
  api: {
    notifications: {
      mine: mocks.mine,
      markRead: mocks.markRead,
      markAllRead: mocks.markAllRead,
    },
  },
}))

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

function notification(overrides = {}) {
  return {
    id: 'notification-1',
    title: 'Đặt phòng thành công',
    message: 'Đặt phòng của bạn đã được xác nhận.',
    type: 'booking_created',
    read: false,
    createdAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('NotificationsPage realtime synchronization', () => {
  beforeEach(() => {
    mocks.mine.mockReset()
    mocks.markRead.mockReset()
    mocks.markAllRead.mockReset()
    mocks.showToast.mockReset()
  })

  it('refetches the list when cloudstay:notification-created is dispatched', async () => {
    mocks.mine
      .mockResolvedValueOnce({ data: [notification()] })
      .mockResolvedValueOnce({
        data: [
          notification(),
          notification({ id: 'notification-2', title: 'Đặt phòng đã bị hủy' }),
        ],
      })
    render(<NotificationsPage />)
    expect(await screen.findByText('Đặt phòng thành công')).toBeVisible()

    await act(async () => {
      window.dispatchEvent(new CustomEvent('cloudstay:notification-created', {
        detail: { notification_id: 'notification-2' },
      }))
    })

    expect(await screen.findByText('Đặt phòng đã bị hủy')).toBeVisible()
    expect(mocks.mine).toHaveBeenCalledTimes(2)
  })

  it('dispatches notifications-changed after markRead succeeds', async () => {
    const current = notification()
    mocks.mine.mockResolvedValue({ data: [current] })
    mocks.markRead.mockResolvedValue({ ...current, read: true })
    const changed = vi.fn()
    window.addEventListener('cloudstay:notifications-changed', changed)
    try {
      render(<NotificationsPage />)
      const item = await screen.findByRole('button', {
        name: /Đặt phòng thành công, chưa đọc/i,
      })
      fireEvent.click(item)

      await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith('notification-1'))
      expect(changed).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('cloudstay:notifications-changed', changed)
    }
  })

  it('dispatches notifications-changed after markAllRead succeeds', async () => {
    const current = notification()
    mocks.mine.mockResolvedValue({ data: [current] })
    mocks.markAllRead.mockResolvedValue({
      data: [{ ...current, read: true }],
      attemptedCount: 1,
      updatedCount: 1,
      failedCount: 0,
      failures: [],
    })
    const changed = vi.fn()
    window.addEventListener('cloudstay:notifications-changed', changed)
    try {
      render(<NotificationsPage />)
      fireEvent.click(await screen.findByRole('button', { name: /Đánh dấu tất cả đã đọc/i }))

      await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1))
      expect(changed).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('cloudstay:notifications-changed', changed)
    }
  })
})
