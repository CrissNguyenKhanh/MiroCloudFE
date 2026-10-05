import { afterEach, describe, expect, it, vi } from 'vitest'

import { readMockState, resetMockState, updateMockState } from './store'

describe('mock storage fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('continues in memory when localStorage access is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError')
      }),
      setItem: vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError')
      }),
    })

    const reset = resetMockState()
    expect(reset.rooms.length).toBeGreaterThanOrEqual(6)

    updateMockState((state) => {
      state.notifications.push({ id: 'memory-only' })
      return state
    })
    expect(readMockState().notifications).toContainEqual({ id: 'memory-only' })
  })
})
