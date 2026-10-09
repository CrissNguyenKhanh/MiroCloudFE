import { describe, expect, it } from 'vitest'

import { bookingSubmissionState, calculateStayPrice, createIdempotencyIntent } from './booking'

describe('booking utilities', () => {
  it('calculates nights and the estimated total from the nightly room rate', () => {
    const result = calculateStayPrice(
      { pricePerNight: 1_650_000 },
      '2028-02-28',
      '2028-03-02',
    )

    expect(result).toMatchObject({
      nights: 3,
      nightlyRate: 1_650_000,
      total: 4_950_000,
    })
    expect(result.formattedTotal.replace(/\D/g, '')).toBe('4950000')
  })

  it('returns a zero total when the stay has no billable nights', () => {
    expect(calculateStayPrice({ pricePerNight: 1_650_000 }, '2028-03-02', '2028-03-02')).toMatchObject({
      nights: 0,
      total: 0,
    })
  })

  it('keeps one idempotency key for the same payload and rotates it when payload changes', () => {
    let sequence = 0
    const nextKey = () => `key-${++sequence}`
    const payload = { roomId: 'room-1', checkInDate: '2028-03-02', checkOutDate: '2028-03-04', guests: 2 }

    const first = createIdempotencyIntent(null, payload, nextKey)
    const retry = createIdempotencyIntent(first, { ...payload }, nextKey)
    const changed = createIdempotencyIntent(retry, { ...payload, guests: 3 }, nextKey)

    expect(retry).toBe(first)
    expect(changed.key).not.toBe(first.key)
    expect(sequence).toBe(2)
  })

  it('distinguishes booking conflict, reused key and uncertain delivery errors', () => {
    expect(bookingSubmissionState({ code: 'ROOM_UNAVAILABLE' })).toBe('unavailable')
    expect(bookingSubmissionState({ code: 'IDEMPOTENCY_KEY_REUSED' })).toBe('key-reused')
    expect(bookingSubmissionState({ code: 'TIMEOUT' })).toBe('uncertain')
    expect(bookingSubmissionState({ code: 'NETWORK_ERROR' })).toBe('uncertain')
    expect(bookingSubmissionState({ code: 'VALIDATION_ERROR' })).toBe('error')
  })
})
