import { describe, expect, it } from 'vitest'
import { convertFrom, convertTo, rateOf } from './convert'
import type { Token } from './types'

const token = (symbol: string, price: number): Token => ({
  symbol,
  name: symbol,
  price,
  asOf: '2023-08-29T07:10:52.000Z',
  icon: null,
})

const ETH = token('ETH', 1645.9337373737374)
const USDC = token('USDC', 0.9898111811125403)

describe('convert', () => {
  it('takes the rate straight from the two USD prices', () => {
    expect(rateOf(ETH, USDC)).toBeCloseTo(ETH.price / USDC.price, 12)
  })

  it('round-trips: converting back returns the amount you started with', () => {
    // The two directions must agree, or the two fields contradict each other.
    const forward = convertFrom(ETH, USDC, 2.5)
    const back = convertTo(ETH, USDC, forward.toAmount)

    expect(back.fromAmount).toBeCloseTo(2.5, 12)
  })

  it('values both legs identically, since no cost is applied', () => {
    const conversion = convertFrom(ETH, USDC, 3)
    expect(conversion.toValueUsd).toBeCloseTo(conversion.fromValueUsd, 8)
  })

  it('treats a zero or negative amount as nothing rather than NaN', () => {
    for (const amount of [0, -5]) {
      expect(convertFrom(ETH, USDC, amount).toAmount).toBe(0)
      expect(convertTo(ETH, USDC, amount).fromAmount).toBe(0)
    }
  })
})
