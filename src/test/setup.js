import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.scrollTo.mockClear()
})
