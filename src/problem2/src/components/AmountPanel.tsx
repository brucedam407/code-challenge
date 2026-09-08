import { useId } from 'react'
import { ChevronDownIcon } from './Icons'
import { TokenIcon } from './TokenIcon'
import { formatUsd } from '../lib/format'
import { useI18n } from '../i18n/context'
import type { Token } from '../lib/types'

interface AmountPanelProps {
  label: string
  token: Token | undefined
  value: string
  onValueChange: (next: string) => void
  onPickToken: () => void
  valueUsd: number
  disabled?: boolean
}

export function AmountPanel({
  label,
  token,
  value,
  onValueChange,
  onPickToken,
  valueUsd,
  disabled = false,
}: AmountPanelProps) {
  const { t } = useI18n()
  const inputId = useId()

  return (
    <div className="rounded-lg border border-transparent bg-panel px-4 py-3.5 transition-colors focus-within:border-line-strong">
      <label className="mb-2 block text-[13px] text-muted" htmlFor={inputId}>
        {label}
      </label>

      <div className="flex items-center gap-3">
        <input
          id={inputId}
          className="w-full min-w-0 flex-1 bg-transparent text-[clamp(22px,5vw,26px)] font-medium tracking-[-0.01em] tabular-nums outline-none placeholder:font-normal placeholder:text-faint disabled:cursor-not-allowed disabled:text-muted"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
        />

        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-raised py-1.5 pr-2.5 pl-1.5 transition-[background-color,transform] hover:bg-raised-strong active:scale-98"
          onClick={onPickToken}
          disabled={disabled}
          aria-label={
            token ? t('picker.changeAsset', { symbol: token.symbol }) : t('picker.chooseAsset')
          }
        >
          <TokenIcon token={token} size={26} />
          <span className="text-[15px] font-semibold">
            {token?.symbol ?? t('picker.selectPlaceholder')}
          </span>
          <ChevronDownIcon className="text-muted" />
        </button>
      </div>

      <p className="mt-2 min-h-4 text-xs tabular-nums text-faint">
        {valueUsd > 0 ? formatUsd(valueUsd) : '$0.00'}
      </p>
    </div>
  )
}
