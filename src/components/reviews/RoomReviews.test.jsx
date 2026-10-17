import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetMockDemo } from '../../api'
import RoomReviews from './RoomReviews'

describe('RoomReviews (mock API)', () => {
  beforeEach(async () => {
    await resetMockDemo()
  })

  it('shows the summary, lists visible reviews and filters by star count', async () => {
    render(<RoomReviews roomId="room-deluxe-skyline" />)

    expect(await screen.findByText('Cửa sổ nhìn ra thành phố tuyệt đẹp')).toBeVisible()
    expect(screen.getByText('3 đánh giá')).toBeVisible()
    expect(screen.getByText('4.7')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: '4 sao: 1 đánh giá' }))

    expect(await screen.findByText(/Đang lọc 4 sao/)).toBeVisible()
    const list = document.querySelector('.review-list')
    expect(within(list).getAllByRole('article')).toHaveLength(1)
    expect(within(list).getByText('Thu Hà')).toBeVisible()
    expect(screen.queryByText('Minh Anh')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }))
    expect(await screen.findByText('Minh Anh')).toBeVisible()
  })

  it('explains an empty room without inventing a rating', async () => {
    render(<RoomReviews roomId="room-twin-comfort" />)

    expect(await screen.findByText(/chưa có đánh giá/i)).toBeVisible()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
  })
})
