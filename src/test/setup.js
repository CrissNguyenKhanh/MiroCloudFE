import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.scrollTo.mockClear()
})

afterEach(() => {
  cleanup()
})
