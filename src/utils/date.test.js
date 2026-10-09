import { describe, expect, it } from 'vitest'

import {
  addDays,
  calculateNights,
  canCustomerCancel,
  customerCancellationDeadline,
  parseISODate,
  rangesOverlap,
  todayISO,
  validateStay,
} from './date'

describe('date utilities', () => {
  it('accepts real ISO calendar dates and rejects malformed or impossible dates', () => {
    expect(parseISODate('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z')
    expect(parseISODate('2027-02-29')).toBeNull()
    expect(parseISODate('2026-13-01')).toBeNull()
    expect(parseISODate('05/10/2026')).toBeNull()
    expect(parseISODate(null)).toBeNull()
  })

  it('validates the stay dates and guest count against a deterministic future range', () => {
    const today = todayISO()
    const checkIn = addDays(today, 2)
    const checkOut = addDays(today, 5)

    expect(validateStay({ checkIn, checkOut, guests: 2, maxGuests: 2, minDate: today })).toEqual({})

    expect(
      validateStay({
        checkIn: addDays(today, -1),
        checkOut,
        guests: 0,
        maxGuests: 2,
        minDate: today,
      }),
    ).toMatchObject({ checkIn: expect.any(String), guests: expect.any(String) })

    expect(
      validateStay({ checkIn, checkOut: checkIn, guests: 3, maxGuests: 2, minDate: today }),
    ).toMatchObject({ checkOut: expect.any(String), guests: expect.any(String) })
  })

  it('reports invalid required dates and non-integer guests', () => {
    expect(
      validateStay({ checkIn: '2026-02-30', checkOut: '', guests: 1.5, minDate: '2026-01-01' }),
    ).toEqual({
      checkIn: expect.any(String),
      checkOut: expect.any(String),
      guests: expect.any(String),
    })
  })

  it('calculates hotel nights using the half-open stay convention', () => {
    expect(calculateNights('2028-02-28', '2028-03-02')).toBe(3)
    expect(calculateNights('2028-03-02', '2028-03-03')).toBe(1)
    expect(calculateNights('2028-03-03', '2028-03-03')).toBe(0)
    expect(calculateNights('2028-03-04', '2028-03-03')).toBe(0)
    expect(calculateNights('not-a-date', '2028-03-03')).toBe(0)
  })

  it('treats checkout as available for the next guest', () => {
    expect(rangesOverlap('2028-06-10', '2028-06-12', '2028-06-12', '2028-06-14')).toBe(false)
    expect(rangesOverlap('2028-06-10', '2028-06-13', '2028-06-12', '2028-06-14')).toBe(true)
    expect(rangesOverlap('2028-06-10', '2028-06-15', '2028-06-11', '2028-06-12')).toBe(true)
    expect(rangesOverlap('invalid', '2028-06-15', '2028-06-11', '2028-06-12')).toBe(false)
  })

  it('enforces the backend stay limits', () => {
    expect(
      validateStay({
        checkIn: '2028-06-01',
        checkOut: '2028-07-02',
        guests: 21,
        minDate: '2028-01-01',
      }),
    ).toMatchObject({ checkOut: expect.any(String), guests: expect.any(String) })
  })

  it('uses the 24-hour cancellation cutoff before 14:00 Vietnam time', () => {
    expect(customerCancellationDeadline('2028-06-10')?.toISOString()).toBe(
      '2028-06-09T07:00:00.000Z',
    )

    const booking = { status: 'confirmed', checkInDate: '2028-06-10' }
    expect(canCustomerCancel(booking, new Date('2028-06-09T07:00:00.000Z'))).toBe(true)
    expect(canCustomerCancel(booking, new Date('2028-06-09T07:00:00.001Z'))).toBe(false)
    expect(canCustomerCancel({ ...booking, canCancel: false }, new Date('2028-01-01'))).toBe(false)
  })
})
