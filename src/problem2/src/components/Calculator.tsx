import { useCallback, useMemo, useState } from 'react'
import { m } from 'motion/react'
import { ReverseIcon, SwitchIcon } from './Icons'
import { AmountPanel } from './AmountPanel'
import { QuickAmounts } from './QuickAmounts'
import { TokenPicker } from './TokenPicker'
import { formatAmount, parseAmount, sanitizeAmountInput, toInputValue } from '../lib/format'
import { convertFrom, convertTo } from '../lib/convert'
import { useI18n } from '../i18n/context'
import type { EditedSide, Token } from '../lib/types'

export interface Pair {
  from: string
  to: string
}

interface CalculatorProps {
  tokens: readonly Token[]
  /** Lifted, so the header and chart always show the pair being converted. */
  pair: Pair
  onPairChange: (pair: Pair) => void
  feedReady: boolean
}

export function Calculator({ tokens, pair, onPairChange, feedReady }: CalculatorProps) {
  const { t } = useI18n()
  const { from: fromSymbol, to: toSymbol } = pair
  const [amountInput, setAmountInput] = useState('1')
  const [editedSide, setEditedSide] = useState<EditedSide>('from')
  const [picking, setPicking] = useState<EditedSide | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [inverted, setInverted] = useState(false)

  const bySymbol = useMemo(() => new Map(tokens.map((token) => [token.symbol, token])), [tokens])

  // Fall back to what the feed carries, while rendering, so no effect corrects state.
  const fromToken = bySymbol.get(fromSymbol) ?? tokens[0]
  const toToken =
    bySymbol.get(toSymbol) ?? tokens.find((token) => token.symbol !== fromToken?.symbol)

  const fromSym = fromToken?.symbol ?? fromSymbol
  const toSym = toToken?.symbol ?? toSymbol

  const typedAmount = parseAmount(amountInput)

  const conversion = useMemo(() => {
    if (!fromToken || !toToken || fromToken === toToken) return null
    if (typedAmount === null || typedAmount <= 0) return null

    return editedSide === 'from'
      ? convertFrom(fromToken, toToken, typedAmount)
      : convertTo(fromToken, toToken, typedAmount)
  }, [fromToken, toToken, typedAmount, editedSide])

  // Only the typed side is state; the other is derived.
  const fromValue =
    editedSide === 'from' ? amountInput : conversion ? toInputValue(conversion.fromAmount) : ''
  const toValue =
    editedSide === 'to' ? amountInput : conversion ? toInputValue(conversion.toAmount) : ''

  /** Counterpart rounds away below display precision. */
  const belowPrecision = Boolean(
    conversion && (editedSide === 'from' ? toValue === '' : fromValue === ''),
  )

  const onAmountChange = (side: EditedSide) => (raw: string) => {
    const next = sanitizeAmountInput(raw)
    if (next === null) return // Rejected keystroke - leave the field untouched.
    setEditedSide(side)
    setAmountInput(next)
  }

  const flip = useCallback(() => {
    setFlipped((current) => !current)
    onPairChange({ from: toSym, to: fromSym })

    // What you were receiving is now what you convert.
    if (conversion) {
      setEditedSide('from')
      setAmountInput(toInputValue(editedSide === 'from' ? conversion.toAmount : (typedAmount ?? 0)))
    }
  }, [toSym, fromSym, onPairChange, conversion, editedSide, typedAmount])

  const chooseToken = (side: EditedSide) => (token: Token) => {
    const other = side === 'from' ? toSym : fromSym
    if (token.symbol === other) {
      // Picking the other leg's asset flips the pair, never a self-conversion.
      flip()
      return
    }
    onPairChange(
      side === 'from' ? { from: token.symbol, to: toSym } : { from: fromSym, to: token.symbol },
    )
  }

  const rate = conversion?.rate ?? (fromToken && toToken ? fromToken.price / toToken.price : 0)

  // Stable, so the memoised table is not re-rendered by every keystroke.
  const pickAmount = useCallback((amount: number) => {
    setEditedSide('from')
    setAmountInput(toInputValue(amount))
  }, [])

  return (
    <div className="relative">
      <m.section
        className="rounded-card relative overflow-hidden border border-line bg-surface"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="calculator-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold" id="calculator-title">
            {t('calc.title')}
          </h2>
        </div>

        <div className="relative grid gap-1.5 p-5">
          <AmountPanel
            label={t('calc.from')}
            token={fromToken}
            value={fromValue}
            onValueChange={onAmountChange('from')}
            onPickToken={() => setPicking('from')}
            valueUsd={
              editedSide === 'from'
                ? (typedAmount ?? 0) * (fromToken?.price ?? 0)
                : (conversion?.fromValueUsd ?? 0)
            }
            disabled={!feedReady}
          />

          <div className="relative z-2 flex h-0 justify-center">
            <button
              type="button"
              className="absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border-[3px] border-surface bg-raised text-ink transition-colors hover:bg-raised-strong hover:text-accent-text"
              onClick={flip}
              aria-label={t('calc.reverse', { from: fromSym, to: toSym })}
            >
              <ReverseIcon
                size={16}
                className={`transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                  flipped ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <AmountPanel
            label={t('calc.to')}
            token={toToken}
            value={toValue}
            onValueChange={onAmountChange('to')}
            onPickToken={() => setPicking('to')}
            valueUsd={
              editedSide === 'to'
                ? (typedAmount ?? 0) * (toToken?.price ?? 0)
                : (conversion?.toValueUsd ?? 0)
            }
            disabled={!feedReady}
          />
        </div>

        {belowPrecision && (
          <p
            className="mx-5 mb-1 rounded-lg bg-down-wash px-3 py-2.5 text-[13px] leading-snug text-down"
            role="alert"
          >
            {t('calc.belowPrecision', { min: formatAmount(0.00000001) })}
          </p>
        )}

        {fromToken && toToken && rate > 0 && (
          <div className="mx-5 mt-1.5 flex items-center justify-between gap-3 border-t border-line py-3 text-[13px]">
            <button
              type="button"
              className="flex items-center gap-2 text-muted tabular-nums transition-colors hover:text-ink"
              onClick={() => setInverted((current) => !current)}
              title={t('calc.inverseHint')}
            >
              {inverted ? (
                <span>
                  1 {toToken.symbol} ={' '}
                  <b className="font-medium text-ink">
                    {formatAmount(1 / rate, { grouped: true })} {fromToken.symbol}
                  </b>
                </span>
              ) : (
                <span>
                  1 {fromToken.symbol} ={' '}
                  <b className="font-medium text-ink">
                    {formatAmount(rate, { grouped: true })} {toToken.symbol}
                  </b>
                </span>
              )}
              <SwitchIcon />
            </button>
            <span className="text-xs text-faint">
              {editedSide === 'to' ? t('calc.solvingFrom') : t('calc.solvingTo')}
            </span>
          </div>
        )}

        {fromToken && toToken && (
          <QuickAmounts from={fromToken} to={toToken} rate={rate} onPick={pickAmount} />
        )}
      </m.section>

      <TokenPicker
        open={picking !== null}
        title={picking === 'to' ? t('picker.to') : t('picker.from')}
        tokens={tokens}
        selected={picking === 'to' ? toSym : fromSym}
        counterpart={picking === 'to' ? fromSym : toSym}
        onSelect={chooseToken(picking ?? 'from')}
        onClose={() => setPicking(null)}
      />
    </div>
  )
}
