import { describe, expect, it } from 'vitest'

import { calculateStayPrice } from './booking'

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
})
