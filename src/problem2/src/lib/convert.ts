import type { Token } from './types'

export interface Conversion {
  /** Units of `to` per one unit of `from`. */
  rate: number
  fromAmount: number
  toAmount: number
  fromValueUsd: number
  toValueUsd: number
}

/** No fee, spread or depth: the marked rate and nothing else. */
export function rateOf(from: Token, to: Token): number {
  return from.price / to.price
}

export function convertFrom(from: Token, to: Token, fromAmount: number): Conversion {
  const rate = rateOf(from, to)
  const amount = fromAmount > 0 ? fromAmount : 0

  return {
    rate,
    fromAmount: amount,
    toAmount: amount * rate,
    fromValueUsd: amount * from.price,
    toValueUsd: amount * rate * to.price,
  }
}

export function convertTo(from: Token, to: Token, toAmount: number): Conversion {
  const rate = rateOf(from, to)
  const amount = toAmount > 0 ? toAmount : 0
  const fromAmount = rate > 0 ? amount / rate : 0

  return {
    rate,
    fromAmount,
    toAmount: amount,
    fromValueUsd: fromAmount * from.price,
    toValueUsd: amount * to.price,
  }
}
