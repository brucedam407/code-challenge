import { useMemo, useState } from 'react'
import { LazyMotion, domAnimation } from 'motion/react'
import { Calculator, type Pair } from './components/Calculator'
import { MoonIcon, SunIcon } from './components/Icons'
import { PriceChart } from './components/PriceChart'
import { RateHeader } from './components/RateHeader'
import { usePrices } from './hooks/usePrices'
import { useTheme } from './hooks/useTheme'
import { LOCALES, useI18n, type Locale, type MessageKey } from './i18n/context'
import { I18nProvider } from './i18n/provider'
import { simulate24h } from './lib/series'
import type { FeedStatus } from './lib/types'

const FEED_LABEL: Record<FeedStatus, MessageKey> = {
  loading: 'feed.loading',
  live: 'feed.live',
  cached: 'feed.cached',
}

/** Opening pair, when the feed carries both. */
const DEFAULT_PAIR: Pair = { from: 'ETH', to: 'USDC' }

export default function App() {
  return (
    <I18nProvider>
      <Page />
    </I18nProvider>
  )
}

function Page() {
  const { t, locale, setLocale } = useI18n()
  const { theme, toggle } = useTheme()
  const { tokens, status, refresh } = usePrices()
  const [pair, setPair] = useState<Pair>(DEFAULT_PAIR)

  const bySymbol = useMemo(() => new Map(tokens.map((token) => [token.symbol, token])), [tokens])

  // Same fallback the calculator uses, so the three always agree.
  const base = bySymbol.get(pair.from) ?? tokens[0]
  const quote = bySymbol.get(pair.to) ?? tokens.find((token) => token.symbol !== base?.symbol)
  const rate = base && quote ? base.price / quote.price : 0

  const series = useMemo(
    () => simulate24h(`${base?.symbol}/${quote?.symbol}`, rate),
    [base?.symbol, quote?.symbol, rate],
  )

  const dotColour = status === 'live' ? 'bg-up' : status === 'cached' ? 'bg-warn' : 'bg-faint'

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-surface">
          <div className="mx-auto flex h-[62px] w-[min(1180px,100%)] items-center gap-3 px-[clamp(16px,3vw,28px)] sm:gap-7">
            <span className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap">
              <span
                className="size-5 shrink-0 rotate-45 rounded-[3px] bg-accent shadow-[inset_0_0_0_3.5px_var(--color-surface)]"
                aria-hidden="true"
              />
              <span className="max-[620px]:hidden">MERIDIAN</span>
            </span>

            <nav
              className="flex items-center gap-5 text-sm font-medium max-[760px]:hidden"
              aria-label={t('nav.main')}
            >
              <a href="#price" aria-current="page" className="text-ink">
                {t('nav.price')}
              </a>
              <a href="#calculator" className="text-muted transition-colors hover:text-accent-text">
                {t('nav.calculator')}
              </a>
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-sm bg-panel px-2.5 py-1.5 text-xs whitespace-nowrap text-muted max-[620px]:px-1.5">
                <span className={`size-1.5 shrink-0 rounded-full ${dotColour}`} />
                <span className="max-[620px]:hidden">{t(FEED_LABEL[status])}</span>
              </span>

              <button
                type="button"
                className="rounded-sm bg-panel px-3 py-1.5 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:bg-raised hover:text-ink max-[620px]:hidden"
                onClick={refresh}
              >
                {t('feed.refresh')}
              </button>

              <div
                className="flex gap-0.5 rounded-sm bg-panel p-0.5"
                role="group"
                aria-label={t('lang.label')}
              >
                {(Object.keys(LOCALES) as Locale[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`rounded-[3px] px-2 py-1 text-[11px] font-semibold transition-colors ${
                      locale === code ? 'bg-raised-strong text-ink' : 'text-muted hover:text-ink'
                    }`}
                    aria-pressed={locale === code}
                    onClick={() => setLocale(code)}
                  >
                    {LOCALES[code].label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="grid size-7.5 shrink-0 place-items-center rounded-sm bg-panel text-muted transition-colors hover:bg-raised hover:text-accent-text"
                onClick={toggle}
                aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </div>
        </header>

        <main
          className="mx-auto grid w-[min(1180px,100%)] flex-1 content-start gap-5 px-[clamp(16px,3vw,28px)] pt-[clamp(20px,3.5vw,36px)] pb-14"
          id="price"
        >
          <RateHeader base={base} quote={quote} rate={rate} series={series} />

          <div className="grid items-start gap-5 min-[941px]:grid-cols-[minmax(0,1fr)_400px]">
            <section className="rounded-card border border-line bg-surface px-5 pt-4.5 pb-3.5">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-[15px] font-semibold">
                  {t('chart.title', { base: base?.symbol ?? '', quote: quote?.symbol ?? '' })}
                </h2>
                <span className="text-xs text-faint">{t('chart.note')}</span>
              </div>
              {quote && base && (
                <PriceChart series={series} quoteSymbol={quote.symbol} baseSymbol={base.symbol} />
              )}
            </section>

            <div id="calculator">
              <Calculator
                tokens={tokens}
                pair={pair}
                onPairChange={setPair}
                feedReady={tokens.length > 0}
              />
            </div>
          </div>
        </main>
      </div>
    </LazyMotion>
  )
}
