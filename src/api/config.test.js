import { afterEach, describe, expect, it } from 'vitest'

import { apiConfig, assertRealApiConfig } from './config'

const original = { ...apiConfig }

afterEach(() => {
  Object.assign(apiConfig, original)
})

describe('real API configuration', () => {
  it('requires all three public service URLs', () => {
    Object.assign(apiConfig, {
      identityBaseUrl: 'https://identity.example.com',
      bookingBaseUrl: '',
      notificationBaseUrl: '',
    })

    expect(() => assertRealApiConfig()).toThrow(/VITE_BOOKING_API_URL.*VITE_NOTIFICATION_API_URL/)
  })

  it('accepts a complete real API configuration', () => {
    Object.assign(apiConfig, {
      identityBaseUrl: 'https://identity.example.com',
      bookingBaseUrl: 'https://booking.example.com',
      notificationBaseUrl: 'https://notification.example.com',
    })

    expect(() => assertRealApiConfig()).not.toThrow()
  })
})
