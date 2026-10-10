import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MyBookingsPage from './MyBookingsPage'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  cancelMine: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../api', () => ({
  api: {
    bookings: {
      mine: mocks.mine,
      cancelMine: mocks.cancelMine,
    },
  },
}))

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

function booking(overrides = {}) {
  return {
    id: 'booking-1',
    code: 'BK-1001',
    roomId: 'room-1',
    roomName: 'Deluxe Skyline',
    roomNumber: '101',
    checkInDate: '2028-06-10',
    checkOutDate: '2028-06-12',
    nights: 2,
    guests: 2,
    totalPrice: 2_000_000,
    status: 'confirmed',
    canCancel: true,
    ...overrides,
  }
}

function renderPage() {
  return render(<MemoryRouter><MyBookingsPage /></MemoryRouter>)
}

describe('MyBookingsPage cancellation', () => {
  beforeEach(() => {
    mocks.mine.mockReset()
    mocks.cancelMine.mockReset()
    mocks.showToast.mockReset()
  })

  it('explains the policy and never offers cancellation after the deadline', async () => {
    mocks.mine.mockResolvedValue({ data: [booking({ canCancel: false })], meta: { total: 1 } })

    renderPage()

    expect(await screen.findByText('Đã quá hạn hủy đặt phòng.')).toBeVisible()
    expect(screen.getByText(/Chỉ được hủy trước 14:00 ngày trước ngày nhận phòng/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Hủy đơn/i })).not.toBeInTheDocument()
    expect(mocks.cancelMine).not.toHaveBeenCalled()
  })

  it('cancels an eligible booking once, accepts an optional reason, and refreshes the list', async () => {
    const confirmed = booking()
    const cancelled = booking({
      status: 'cancelled',
      canCancel: false,
      cancellationReason: 'Thay đổi kế hoạch',
    })
    mocks.mine
      .mockResolvedValueOnce({ data: [confirmed], meta: { total: 1 } })
      .mockResolvedValueOnce({ data: [cancelled], meta: { total: 1 } })
    mocks.cancelMine.mockResolvedValue(cancelled)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Hủy đơn/i }))
    await userEvent.type(screen.getByLabelText(/Lý do hủy/i), '  Thay đổi kế hoạch  ')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Xác nhận hủy' }))

    await waitFor(() => expect(mocks.cancelMine).toHaveBeenCalledTimes(1))
    expect(mocks.cancelMine).toHaveBeenCalledWith('booking-1', { reason: 'Thay đổi kế hoạch' })
    expect(mocks.mine).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/Lý do hủy: Thay đổi kế hoạch/)).toBeVisible()
  })

  it('shows the backend cancellation-window error and refreshes eligibility', async () => {
    mocks.mine.mockResolvedValue({ data: [booking()], meta: { total: 1 } })
    mocks.cancelMine.mockRejectedValue(Object.assign(new Error('expired'), {
      code: 'CANCELLATION_WINDOW_PASSED',
      status: 409,
    }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Hủy đơn/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(
      'Đã qua hạn hủy: muộn hơn 14:00 ngày trước ngày nhận phòng.',
      'error',
    ))
    expect(mocks.mine).toHaveBeenCalledTimes(2)
  })
})
