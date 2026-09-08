import { TokenIcon } from './TokenIcon'
import { formatAmount, formatFeedTime, formatPercent } from '../lib/format'
import { useI18n } from '../i18n/context'
import type { Series } from '../lib/series'
import type { Token } from '../lib/types'

interface RateHeaderProps {
  base: Token | undefined
  quote: Token | undefined
  rate: number
  series: Series
}

export function RateHeader({ base, quote, rate, series }: RateHeaderProps) {
  const { t, intl } = useI18n()
  if (!base || !quote) return null

  const up = series.change >= 0

  return (
    <header className="pt-1 pb-0.5">
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        {/* Overlapped discs read as a pair rather than two separate assets. */}
        <span className="flex items-center">
          <TokenIcon token={base} size={30} />
          <TokenIcon token={quote} size={30} className="-ml-2.5 ring-2 ring-page" />
        </span>
        <h1 className="text-[clamp(20px,2.6vw,24px)] font-semibold tracking-[-0.01em]">
          {t('rate.pair', { base: base.symbol, quote: quote.symbol })}
        </h1>
        <span className="text-[13px] text-muted">
          {base.name} · {quote.name}
        </span>
      </div>

      <p className="mb-2.5 text-[clamp(30px,5vw,44px)] leading-[1.1] font-semibold tracking-[-0.025em] tabular-nums">
        {t('rate.line', {
          base: base.symbol,
          amount: formatAmount(rate, { grouped: true }),
          quote: quote.symbol,
        })}
      </p>

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className={`font-semibold tabular-nums ${up ? 'text-up' : 'text-down'}`}>
          {up ? '▲' : '▼'} {formatPercent(Math.abs(series.change))}
        </span>
        <span>{t('rate.window')}</span>
        {/* Never let a simulated number pass as market data. */}
        <span
          className="cursor-help rounded-sm bg-raised px-1.5 py-0.5 text-[11px] text-muted"
          title={t('rate.simulatedHint')}
        >
          {t('rate.simulated')}
        </span>
      </p>

      <p className="mt-2 text-xs text-faint">
        {t('rate.marked', { time: formatFeedTime(base.asOf, intl) })}
      </p>
    </header>
  )
}
