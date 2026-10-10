import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { resetMockDemo } from './api'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { addDays, todayISO } from './utils/date'

function renderApp(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('customer booking flow in mock mode', () => {
  beforeEach(() => {
    resetMockDemo()
  })

  it('searches, signs in, books a room and sees the new booking', async () => {
    const user = userEvent.setup()
    const checkIn = addDays(todayISO(), 70)
    const checkOut = addDays(checkIn, 2)
    renderApp(`/rooms?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)

    expect(await screen.findByRole('heading', { name: /lựa chọn dành cho bạn/i })).toBeVisible()

    const roomLinks = await screen.findAllByRole('link', { name: /^Xem .+/i })
    await user.click(roomLinks[0])

    const roomHeading = await screen.findByRole('heading', { level: 1 })
    const roomName = roomHeading.textContent
    await user.click(screen.getByRole('button', { name: /Tiếp tục đặt phòng/i }))

    expect(await screen.findByRole('heading', { name: /Đăng nhập CloudStay/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Dùng tài khoản khách/i }))
    await user.click(screen.getByRole('button', { name: /^Đăng nhập/i }))

    expect(await screen.findByRole('heading', { name: /Xác nhận kỳ nghỉ/i })).toBeVisible()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Xác nhận đặt phòng/i }))

    expect(await screen.findByRole('heading', { name: /Kỳ nghỉ của bạn đã sẵn sàng/i })).toBeVisible()
    const resultCard = screen.getByRole('heading', { name: /Kỳ nghỉ của bạn đã sẵn sàng/i }).closest('section')
    const bookingCode = within(resultCard).getByText(/^CS-[A-Z0-9]+$/).textContent
    expect(within(resultCard).getByText(roomName)).toBeVisible()

    await user.click(within(resultCard).getByRole('link', { name: /Xem đơn của tôi/i }))

    expect(await screen.findByRole('heading', { name: roomName })).toBeVisible()
    expect(screen.getByText(bookingCode)).toBeVisible()
  }, 10_000)

  it('protects admin routes for a signed-in customer', async () => {
    const user = userEvent.setup()
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: /Đăng nhập CloudStay/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Dùng tài khoản khách/i }))
    await user.click(screen.getByRole('button', { name: /^Đăng nhập/i }))

    expect(await screen.findByRole('heading', { name: /Bạn chưa có quyền vào đây/i })).toBeVisible()
  })

  it('routes an authenticated admin to the notification operations page', async () => {
    const user = userEvent.setup()
    renderApp('/admin/notifications')

    expect(await screen.findByRole('heading', { name: /Đăng nhập CloudStay/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Dùng tài khoản admin/i }))
    await user.click(screen.getByRole('button', { name: /^Đăng nhập/i }))

    expect(await screen.findByRole('heading', { name: 'Thông báo' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Thông báo' })).toHaveAttribute('href', '/admin/notifications')
  })
})
