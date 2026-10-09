import { afterEach, describe, expect, it, vi } from 'vitest'

import { createHttpApi } from './index'
import { createNotificationsHttpApi } from './notifications'

function jsonResponse(payload, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: vi.fn().mockResolvedValue(payload),
  }
}

function createApi() {
  return createHttpApi({
    identityBaseUrl: 'https://identity.test',
    bookingBaseUrl: 'https://booking.test',
    notificationBaseUrl: 'https://notification.test',
    timeoutMs: 1000,
  })
}

describe('verified backend HTTP contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses /rooms/search query names and preserves pagination metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [{
        id: 'room-1', room_number: '101', room_type: 'DELUXE', price_per_night: 0,
        capacity: 2, size_sqm: 0, bed_type: 'King', view_label: 'City',
        equipment: ['Wi-Fi'], active: false, featured: false,
      }],
      meta: { page: 2, limit: 9, total: 12 },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createApi().rooms.search({
      checkIn: '2028-03-02', checkOut: '2028-03-04', guests: 2,
      type: 'deluxe', minPrice: 0, maxPrice: 2_000_000, page: 2, limit: 9,
    })

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/v1/rooms/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      check_in: '2028-03-02', check_out: '2028-03-04', guests: '2',
      room_type: 'deluxe', min_price: '0', max_price: '2000000', page: '2', limit: '9',
    })
    expect(result).toMatchObject({
      data: [{ id: 'room-1', type: 'deluxe', pricePerNight: 0, size: 0, isBookable: false }],
      meta: { page: 2, limit: 9, total: 12 },
    })
  })

  it('sends only the strict booking body and the supplied idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        id: 'booking-1', booking_code: 'CS-ABC123', room_id: 'room-1',
        check_in_date: '2028-03-02', check_out_date: '2028-03-04', guests: 2,
        nights: 2, price_per_night: 1_000_000, total_price: 2_000_000,
        status: 'CONFIRMED',
      },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await createApi().bookings.create({
      roomId: 'room-1', checkInDate: '2028-03-02', checkOutDate: '2028-03-04',
      guests: 2, specialRequests: 'must not be sent', displayOnly: true,
    }, { idempotencyKey: 'booking-key-123' })

    const [, options] = fetchMock.mock.calls[0]
    expect(Object.fromEntries(options.headers.entries())).toMatchObject({
      'idempotency-key': 'booking-key-123',
    })
    expect(JSON.parse(options.body)).toEqual({
      room_id: 'room-1', check_in_date: '2028-03-02', check_out_date: '2028-03-04', guests: 2,
    })
  })

  it('allow-lists admin room fields and toggles with { active }', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'room-1', room_number: '101', active: true } }, 201))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'room-1', room_number: '101', active: false } }))
    vi.stubGlobal('fetch', fetchMock)
    const rooms = createApi().rooms

    await rooms.create({
      roomNumber: '101', name: 'Deluxe', type: 'deluxe', pricePerNight: 1_000_000,
      capacity: 2, size: 30, bed: 'King', view: 'City', floor: 1, featured: false,
      description: '', palette: [], amenities: ['Wi-Fi'], isBookable: true,
      specialRequests: 'not allowed',
    })
    await rooms.toggleBookable('room-1', false)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      room_number: '101', name: 'Deluxe', room_type: 'deluxe', price_per_night: 1_000_000,
      capacity: 2, size_sqm: 30, bed_type: 'King', view_label: 'City', floor: 1,
      featured: false, description: '', palette: [], equipment: ['Wi-Fi'], active: true,
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ active: false })
  })

  it('registers once when backend returns a user without a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: { id: 'user-1', email: 'khanh@example.com', full_name: 'Khánh', role: 'CUSTOMER', status: 'ACTIVE' },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createApi().identity.register({
      email: 'khanh@example.com', password: 'Password123!', fullName: 'Khánh', phone: '0901234567',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'khanh@example.com', password: 'Password123!', full_name: 'Khánh',
    })
    expect(result).toMatchObject({ registrationSucceeded: true, requiresLogin: true, accessToken: null })
  })

  it('marks notifications individually and reports partial mark-all failure without /read-all', async () => {
    let listCount = 0
    const request = vi.fn(async (path) => {
      if (path === '/api/v1/notifications') {
        listCount += 1
        return listCount === 1
          ? [{ id: 'n-1', read: false }, { id: 'n-2', read: false }]
          : [{ id: 'n-1', read: true }, { id: 'n-2', read: false }]
      }
      if (path.includes('n-1')) return { id: 'n-1', read: true }
      throw Object.assign(new Error('failed'), { code: 'NETWORK_ERROR' })
    })

    const result = await createNotificationsHttpApi(request).markAllRead()

    expect(result).toMatchObject({ attemptedCount: 2, updatedCount: 1, failedCount: 1 })
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/notifications',
      '/api/v1/notifications/n-1/read',
      '/api/v1/notifications/n-2/read',
      '/api/v1/notifications',
    ])
  })
})
