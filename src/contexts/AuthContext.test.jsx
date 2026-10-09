import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }))

vi.mock('../api', () => ({
  isMockMode: false,
  api: {
    identity: {
      me: meMock,
      login: vi.fn(),
      register: vi.fn(),
    },
  },
}))

import { clearApiSession, getApiSession, setApiSession } from '../api/session'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span>{auth.isInitializing ? 'initializing' : auth.isAuthenticated ? `authenticated:${auth.user.id}` : 'anonymous'}</span>
      {auth.restoreError && <span role="alert">{auth.restoreError}</span>}
      <button type="button" onClick={auth.retrySession}>retry</button>
    </div>
  )
}

function renderProvider() {
  return render(<AuthProvider><Probe /></AuthProvider>)
}

describe('AuthProvider session restoration', () => {
  beforeEach(() => {
    clearApiSession()
    meMock.mockReset()
  })

  it('keeps guards initializing until /users/me restores the user', async () => {
    let resolveMe
    meMock.mockReturnValue(new Promise((resolve) => { resolveMe = resolve }))
    setApiSession({ accessToken: 'persisted-token' })
    renderProvider()

    expect(screen.getByText('initializing')).toBeVisible()
    resolveMe({ id: 'user-1', role: 'customer' })
    expect(await screen.findByText('authenticated:user-1')).toBeVisible()
  })

  it('clears an unauthorized session instead of leaving a restore error', async () => {
    meMock.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }))
    setApiSession({ accessToken: 'expired-token' })
    renderProvider()

    expect(await screen.findByText('anonymous')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getApiSession()).toEqual({ accessToken: null, user: null })
  })

  it('preserves the token on a network error and can retry restoration', async () => {
    meMock.mockRejectedValueOnce(Object.assign(new Error('Mất kết nối'), { code: 'NETWORK_ERROR' }))
    setApiSession({ accessToken: 'persisted-token' })
    renderProvider()

    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối')
    expect(getApiSession().accessToken).toBe('persisted-token')

    meMock.mockResolvedValueOnce({ id: 'user-2', role: 'customer' })
    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByText('authenticated:user-2')).toBeVisible())
  })
})
