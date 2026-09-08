import type { PriceRow, Token } from './types'

/** The feed ships only `currency`; these labels are for the picker alone. */
const TOKEN_NAMES: Record<string, string> = {
  ampLUNA: 'Eris Amplified LUNA',
  ATOM: 'Cosmos Hub',
  axlUSDC: 'Axelar USDC',
  BLUR: 'Blur',
  bNEO: 'BurgerNEO',
  BUSD: 'Binance USD',
  ETH: 'Ethereum',
  EVMOS: 'Evmos',
  GMX: 'GMX',
  IBCX: 'Inter-Blockchain Index',
  IRIS: 'IRISnet',
  KUJI: 'Kujira',
  LSI: 'Liquid Staking Index',
  LUNA: 'Terra',
  OKB: 'OKB',
  OKT: 'OKT Chain',
  OSMO: 'Osmosis',
  RATOM: 'Liquid Staked ATOM',
  rSWTH: 'Wrapped SWTH',
  STATOM: 'Stride Staked ATOM',
  STEVMOS: 'Stride Staked EVMOS',
  STLUNA: 'Stride Staked LUNA',
  STOSMO: 'Stride Staked OSMO',
  STRD: 'Stride',
  SWTH: 'Switcheo',
  USC: 'Kujira USC',
  USD: 'US Dollar',
  USDC: 'USD Coin',
  WBTC: 'Wrapped Bitcoin',
  wstETH: 'Wrapped stETH',
  YieldUSD: 'Yield USD',
  ZIL: 'Zilliqa',
}

/** Icons vendored from github.com/Switcheo/token-icons into `public/tokens`. */
const ICON_BASE = `${import.meta.env.BASE_URL}tokens/`

const ICONS_ON_DISK = new Set(Object.keys(TOKEN_NAMES))

/** One entry per ticker: BUSD is listed twice, so the latest quote wins. */
export function toTokens(rows: readonly PriceRow[]): Token[] {
  const latest = new Map<string, PriceRow>()

  for (const row of rows) {
    if (!row?.currency || typeof row.price !== 'number') continue
    if (!Number.isFinite(row.price) || row.price <= 0) continue

    const previous = latest.get(row.currency)
    if (!previous || Date.parse(row.date) > Date.parse(previous.date)) {
      latest.set(row.currency, row)
    }
  }

  return [...latest.values()]
    .map((row) => ({
      symbol: row.currency,
      name: TOKEN_NAMES[row.currency] ?? row.currency,
      price: row.price,
      asOf: row.date,
      icon: ICONS_ON_DISK.has(row.currency) ? `${ICON_BASE}${row.currency}.svg` : null,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol, 'en', { sensitivity: 'base' }))
}

/** Ranks tokens for the picker: exact ticker hit, then prefix, then substring. */
export function searchTokens(tokens: readonly Token[], query: string): Token[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...tokens]

  const scored: Array<{ token: Token; score: number }> = []

  for (const token of tokens) {
    const symbol = token.symbol.toLowerCase()
    const name = token.name.toLowerCase()

    let score = -1
    if (symbol === q) score = 0
    else if (symbol.startsWith(q)) score = 1
    else if (name.startsWith(q)) score = 2
    else if (symbol.includes(q)) score = 3
    else if (name.includes(q)) score = 4

    if (score >= 0) scored.push({ token, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || a.token.symbol.localeCompare(b.token.symbol))
    .map((entry) => entry.token)
}
