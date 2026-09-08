import { memo } from 'react'
import { formatAmount } from '../lib/format'
import { useI18n } from '../i18n/context'
import type { Token } from '../lib/types'

interface QuickAmountsProps {
  from: Token
  to: Token
  rate: number
  onPick: (amount: number) => void
}

const AMOUNTS = [0.1, 1, 10, 100, 1000, 10000]

/**
 * Each row also fills the input, so the table doubles as a shortcut.
 *
 * Memoised: its numbers depend on the pair and the rate, neither of which
 * changes while an amount is being typed, and formatting twelve of them per
 * keystroke was measurably the most expensive thing on the page.
 */
export const QuickAmounts = memo(function QuickAmounts({
  from,
  to,
  rate,
  onPick,
}: QuickAmountsProps) {
  const { t } = useI18n()
  if (!(rate > 0)) return null

  return (
    <div className="px-5 pt-1 pb-5">
      <h3 className="mb-1.5 text-[13px] font-semibold text-muted">
        {t('calc.table', { base: from.symbol, quote: to.symbol })}
      </h3>

      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {AMOUNTS.map((amount) => (
            <tr key={amount} className="border-t border-line first:border-t-0">
              <th scope="row" className="py-1.5 text-left font-normal">
                <button
                  type="button"
                  className="text-muted transition-colors hover:text-accent-text"
                  onClick={() => onPick(amount)}
                >
                  {formatAmount(amount, { grouped: true })} {from.symbol}
                </button>
              </th>
              <td className="py-1.5 text-right tabular-nums">
                {formatAmount(amount * rate, { grouped: true })} {to.symbol}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
