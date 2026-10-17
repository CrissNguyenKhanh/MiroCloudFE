import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminReviewsPage from './AdminReviewsPage'

const mocks = vi.hoisted(() => ({
  adminList: vi.fn(),
  adminSetStatus: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../api', () => ({
  api: { reviews: { adminList: mocks.adminList, adminSetStatus: mocks.adminSetStatus } },
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

function review(overrides = {}) {
  return {
    id: 'review-1',
    bookingId: 'booking-1',
    bookingCode: 'CS-ABC123',
    roomId: 'room-1',
    roomName: 'Deluxe Skyline',
    rating: 2,
    title: 'Không như mong đợi',
    comment: 'Phòng hơi ồn',
    reviewerName: 'Minh Anh',
    status: 'visible',
    createdAt: '2028-01-01T10:00:00.000Z',
    updatedAt: '2028-01-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('AdminReviewsPage moderation', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.adminList.mockResolvedValue({ data: [review()], meta: { total: 1 } })
  })

  it('hides a visible review and reloads the list', async () => {
    mocks.adminSetStatus.mockResolvedValue(review({ status: 'hidden' }))
    render(<AdminReviewsPage />)

    expect(await screen.findByText('Không như mong đợi')).toBeVisible()
    expect(screen.getByText('Booking CS-ABC123')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Ẩn/ }))

    await waitFor(() => expect(mocks.adminSetStatus).toHaveBeenCalledWith('review-1', 'hidden'))
    expect(mocks.showToast).toHaveBeenCalledWith('Đã ẩn đánh giá khỏi trang phòng.')
    await waitFor(() => expect(mocks.adminList).toHaveBeenCalledTimes(2))
  })

  it('offers to restore a hidden review', async () => {
    mocks.adminList.mockResolvedValue({ data: [review({ status: 'hidden' })], meta: { total: 1 } })
    mocks.adminSetStatus.mockResolvedValue(review())
    render(<AdminReviewsPage />)

    await userEvent.click(await screen.findByRole('button', { name: /Hiện lại/ }))

    await waitFor(() => expect(mocks.adminSetStatus).toHaveBeenCalledWith('review-1', 'visible'))
  })

  it('maps status, rating and room filters to the list request and resets to page 1', async () => {
    render(<AdminReviewsPage />)
    await waitFor(() => expect(mocks.adminList).toHaveBeenCalledTimes(1))
    expect(mocks.adminList).toHaveBeenLastCalledWith({ page: 1, limit: 20 })

    await userEvent.selectOptions(screen.getByLabelText('Lọc trạng thái đánh giá'), 'hidden')
    await userEvent.selectOptions(screen.getByLabelText('Lọc theo số sao'), '2')
    await userEvent.type(screen.getByRole('textbox', { name: 'Lọc theo Room ID' }), '11111111-1111-4111-8111-111111111111')
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(mocks.adminList).toHaveBeenLastCalledWith({
      status: 'hidden',
      rating: '2',
      roomId: '11111111-1111-4111-8111-111111111111',
      page: 1,
      limit: 20,
    }))
  })
})
