import { describe, expect, it, vi } from 'vitest'

import { addDays, todayISO } from '../../utils/date'
import { createIdentityHttpApi } from './identity'
import {
  fromApi,
  asCollection,
  normalizeBooking,
  normalizeNotification,
  normalizeRoom,
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
      id: 'user-1', full_name: 'Khánh', email: 'khanh@example.com', role: 'CUSTOMER',
    })
    const identity = createIdentityHttpApi(request)

    const result = await identity.register({
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
    expect(request).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      registrationSucceeded: true,
      requiresLogin: true,
      accessToken: null,
      user: { id: 'user-1', fullName: 'Khánh' },
    })
  })

  it('preserves collection metadata and explicit zero/false room values', () => {
    expect(asCollection({ data: [{ id: 'room-1' }], meta: { page: 2, total: 11 } })).toEqual({
      data: [{ id: 'room-1' }],
      meta: { page: 2, total: 11 },
    })
    expect(normalizeRoom({
      room_number: '001',
      room_type: 'DELUXE',
      price_per_night: 0,
      size_sqm: 0,
      active: false,
      featured: false,
      equipment: [],
    })).toMatchObject({
      roomNumber: '001',
      type: 'deluxe',
      pricePerNight: 0,
      size: 0,
      isBookable: false,
      featured: false,
      amenities: [],
    })
  })
})
