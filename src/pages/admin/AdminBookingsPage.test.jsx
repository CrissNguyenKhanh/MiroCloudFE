import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminBookingsPage from './AdminBookingsPage'

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  cancelAdmin: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../api', () => ({
  api: {
    bookings: {
      adminList: mocks.adminList,
      cancelAdmin: mocks.cancelAdmin,
    },
  },
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

describe('AdminBookingsPage filters', () => {
  beforeEach(() => {
    mocks.adminList.mockReset()
    mocks.adminList.mockResolvedValue({ data: [], meta: { total: 0 } })
    mocks.cancelAdmin.mockReset()
    mocks.showToast.mockReset()
  })

  it('applies room and user UUID filters together with pagination defaults', async () => {
    render(<AdminBookingsPage />)
    await waitFor(() => expect(mocks.adminList).toHaveBeenCalledTimes(1))

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Lọc theo Room ID' }),
      '11111111-1111-4111-8111-111111111111',
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Lọc theo User ID' }),
      '22222222-2222-4222-8222-222222222222',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(mocks.adminList).toHaveBeenLastCalledWith({
      roomId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      page: 1,
      limit: 20,
    }))
  })
})
