import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminRoomsPage from './AdminRoomsPage'

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  toggleBookable: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../api', () => ({
  api: {
    rooms: {
      adminList: mocks.adminList,
      toggleBookable: mocks.toggleBookable,
      create: mocks.create,
      update: mocks.update,
    },
  },
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

const inactiveRoom = {
  id: 'room-2',
  roomNumber: '102',
  name: 'Garden Suite',
  type: 'suite',
  pricePerNight: 2_500_000,
  capacity: 2,
  floor: 1,
  palette: ['#234'],
  amenities: [],
  isBookable: false,
}

describe('AdminRoomsPage inventory', () => {
  beforeEach(() => {
    mocks.adminList.mockReset()
    mocks.toggleBookable.mockReset()
    mocks.create.mockReset()
    mocks.update.mockReset()
    mocks.showToast.mockReset()
  })

  it('renders an inactive room and keeps it visible after reactivation', async () => {
    mocks.adminList.mockResolvedValue({ data: [inactiveRoom] })
    mocks.toggleBookable.mockResolvedValue({ ...inactiveRoom, isBookable: true })

    render(<AdminRoomsPage />)

    expect(await screen.findByText('Garden Suite')).toBeVisible()
    expect(screen.getByText('Tạm ngừng')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Nhận đặt lại Garden Suite' }))

    await waitFor(() => expect(mocks.toggleBookable).toHaveBeenCalledWith('room-2', true))
    expect(screen.getByText('Garden Suite')).toBeVisible()
    expect(screen.getByText('Đang nhận đặt')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ngừng nhận đặt Garden Suite' })).toBeVisible()
  })
})
