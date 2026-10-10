import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Header from './Header'

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
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

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  )
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('Header notification polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.mine.mockReset()
    mocks.auth.user = { id: 'user-1', fullName: 'Nguyễn An', email: 'an@example.com' }
    mocks.auth.isAuthenticated = true
    mocks.auth.isAdmin = false
    mocks.auth.logout.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches notifications for an authenticated user and displays the unread count', async () => {
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
  })

  it('does not fetch or poll while unauthenticated', async () => {
    mocks.auth.user = null
    mocks.auth.isAuthenticated = false

    renderHeader()
    await act(async () => {
      vi.advanceTimersByTime(90_000)
    })

    expect(mocks.mine).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/thông báo chưa đọc/i)).not.toBeInTheDocument()
  })

  it('cleans up the polling interval when unmounted', async () => {
    mocks.mine.mockResolvedValue({ data: [] })
    const { unmount } = renderHeader()
    await flushPromises()

    expect(mocks.mine).toHaveBeenCalledTimes(1)
    unmount()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(mocks.mine).toHaveBeenCalledTimes(1)
  })
})
