import { describe, expect, it, vi } from 'vitest'

import { addDays, todayISO } from '../../utils/date'
import { createIdentityHttpApi } from './identity'
import {
  fromApi,
  normalizeBooking,
  normalizeNotification,
  normalizeUser,
  toApi,
} from './mapping'

describe('HTTP contract mapping', () => {
  it('maps nested snake_case and camelCase values recursively', () => {
    expect(
      fromApi({ room_id: 'room-1', price_breakdown: { nightly_rate: 1_500_000 } }),
    ).toEqual({ roomId: 'room-1', priceBreakdown: { nightlyRate: 1_500_000 } })
    expect(toApi({ checkInDate: '2028-01-01', guestInfo: { fullName: 'An' } })).toEqual({
      check_in_date: '2028-01-01',
      guest_info: { full_name: 'An' },
    })
  })

  it('normalizes entity envelopes to stable UI shapes', () => {
    expect(normalizeUser({ user: { full_name: 'An', role: 'CUSTOMER' } })).toMatchObject({
      fullName: 'An',
      role: 'customer',
    })

    const booking = normalizeBooking({
      booking: {
        id: 'booking-1',
        room_id: 'room-1',
        room_name: 'Deluxe Skyline',
        check_in_date: addDays(todayISO(), 2),
        status: 'CONFIRMED',
      },
    })
    expect(booking).toMatchObject({
      id: 'booking-1',
      status: 'confirmed',
      canCancel: true,
      room: { id: 'room-1', name: 'Deluxe Skyline' },
    })

    expect(
      normalizeNotification({
        notification: {
          payload: { title: 'Đã xác nhận', message: 'Đơn của bạn đã sẵn sàng.' },
          read_at: null,
        },
      }),
    ).toMatchObject({
      title: 'Đã xác nhận',
      message: 'Đơn của bạn đã sẵn sàng.',
      read: false,
    })
  })

  it('does not send mock-only fields to strict registration endpoints', async () => {
    const request = vi.fn().mockResolvedValue({
      access_token: 'access-token',
      user: { id: 'user-1', full_name: 'Khánh', role: 'CUSTOMER' },
    })
    const identity = createIdentityHttpApi(request)

    await identity.register({
      email: 'khanh@example.com',
      password: 'Password123!',
      fullName: 'Khánh',
      phone: '0901234567',
    })

    expect(request).toHaveBeenCalledWith('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'khanh@example.com',
        password: 'Password123!',
        full_name: 'Khánh',
      },
    })
  })
})
