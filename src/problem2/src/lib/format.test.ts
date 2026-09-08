import { describe, expect, it } from 'vitest'
import { formatAmount, sanitizeAmountInput } from './format'

describe('sanitizeAmountInput', () => {
  it('rejects anything that is not a plain decimal', () => {
    // null drops the keystroke, so the field never holds a bad value.
    for (const bad of ['1.5abc', 'abc', '1e5', '-1', '1+1', '1.5.5', '0.123456789']) {
      expect(sanitizeAmountInput(bad), bad).toBeNull()
    }
  })

  it('accepts valid and half-typed amounts', () => {
    expect(sanitizeAmountInput('12.5')).toBe('12.5')
    expect(sanitizeAmountInput('')).toBe('')
    expect(sanitizeAmountInput('1.')).toBe('1.')
    expect(sanitizeAmountInput('0.12345678')).toBe('0.12345678')
    expect(sanitizeAmountInput('1,234.5')).toBe('1234.5')
    expect(sanitizeAmountInput('007')).toBe('7')
  })
})

describe('formatAmount', () => {
  it('never prints a misleading zero or NaN', () => {
    // Dust rendered as "0" reads as a broken quote.
    expect(formatAmount(1e-12)).toBe('<0.00000001')
    expect(formatAmount(Number.NaN)).toBe('0')
    expect(formatAmount(0)).toBe('0')
  })
})
