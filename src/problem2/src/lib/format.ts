/** Most decimals a user may type. */
const MAX_DECIMALS = 8

/**
 * `Number.toLocaleString` builds a formatter on every call, which measured ~50x
 * the cost of reusing one. The set of shapes here is small and fixed, so each
 * gets a single instance.
 */
const GROUPING = new Intl.NumberFormat('en-US')

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const byDecimals = new Map<number, Intl.NumberFormat>()

function fixedFormatter(decimals: number): Intl.NumberFormat {
  let formatter = byDecimals.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    byDecimals.set(decimals, formatter)
  }
  return formatter
}

const byLocale = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = byLocale.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // 24h everywhere: a trading interface reads clock time, not AM/PM.
      hour12: false,
      timeZone: 'UTC',
    })
    byLocale.set(locale, formatter)
  }
  return formatter
}

/** Runs per keystroke, so it must tolerate half-typed input: '', '.', '1.'. */
export function sanitizeAmountInput(raw: string): string | null {
  const cleaned = raw.replace(/[,\s_]/g, '')
  if (cleaned === '') return ''
  if (!/^\d*\.?\d*$/.test(cleaned)) return null

  const [whole, fraction = ''] = cleaned.split('.')
  if (fraction.length > MAX_DECIMALS) return null
  // "007" -> "7", but keep the "0" in "0.5".
  const normalisedWhole = whole.replace(/^0+(?=\d)/, '')

  return cleaned.includes('.') ? `${normalisedWhole || '0'}.${fraction}` : normalisedWhole
}

export function parseAmount(raw: string): number | null {
  if (raw.trim() === '' || raw === '.') return null
  const value = Number(raw.replace(/[,\s_]/g, ''))
  return Number.isFinite(value) ? value : null
}

function decimalsFor(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude === 0) return 2
  if (magnitude >= 1000) return 2
  if (magnitude >= 1) return 4
  if (magnitude >= 0.01) return 6
  return MAX_DECIMALS
}

export function formatAmount(value: number, options?: { grouped?: boolean }): string {
  if (!Number.isFinite(value)) return '0'
  if (value === 0) return '0'

  const decimals = decimalsFor(value)
  const fixed = value.toFixed(decimals)
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed

  // Rounds away entirely: show a bound rather than a confident "0".
  if (Number(trimmed) === 0) return `<0.${'0'.repeat(MAX_DECIMALS - 1)}1`

  if (!options?.grouped) return trimmed

  const [whole, fraction] = trimmed.split('.')
  const groupedWhole = GROUPING.format(Number(whole))
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole
}

export function toInputValue(value: number, options?: { roundDown?: boolean }): string {
  if (!Number.isFinite(value) || value <= 0) return ''

  const render = (decimals: number) => {
    let amount = value
    if (options?.roundDown) {
      const factor = 10 ** decimals
      amount = Math.floor(amount * factor) / factor
    }
    const fixed = amount.toFixed(decimals)
    return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
  }

  const display = render(decimalsFor(value))
  if (Number(display) > 0) return display

  const full = render(MAX_DECIMALS)
  return Number(full) > 0 ? full : ''
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  if (value !== 0 && Math.abs(value) < 0.01) return '<$0.01'
  return USD.format(value)
}

export function formatPrice(value: number): string {
  const decimals = Math.abs(value) >= 1 ? 2 : Math.abs(value) >= 0.01 ? 4 : 6
  return `$${fixedFormatter(decimals).format(value)}`
}

export function formatPercent(fraction: number, decimals = 2): string {
  return `${(fraction * 100).toFixed(decimals)}%`
}

export function formatFeedTime(iso: string, locale = 'en-GB'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--'
  return `${dateFormatter(locale).format(date)} UTC`
}
