import { describe, expect, it } from 'vitest'
import { toTokens } from './tokens'
import type { PriceRow } from './types'

const row = (currency: string, price: number, date: string): PriceRow => ({
  currency,
  price,
  date,
})

const OLD = '2023-08-29T07:10:40.000Z'
const NEW = '2023-08-29T07:11:40.000Z'

describe('toTokens', () => {
  it('keeps the latest quote when the feed repeats a ticker', () => {
    // BUSD is listed twice; the wrong row silently misprices every quote.
    expect(toTokens([row('BUSD', 0.9991, OLD), row('BUSD', 0.9998, NEW)])[0].price).toBe(0.9998)
    expect(toTokens([row('BUSD', 0.9998, NEW), row('BUSD', 0.9991, OLD)])[0].price).toBe(0.9998)
  })

  it('drops rows without a usable price instead of quoting against them', () => {
    const tokens = toTokens([
      row('ETH', 1645.93, NEW),
      row('ZERO', 0, NEW),
      row('NEGATIVE', -5, NEW),
      row('NAN', Number.NaN, NEW),
      null as unknown as PriceRow,
    ])

    expect(tokens.map((token) => token.symbol)).toEqual(['ETH'])
  })
})
