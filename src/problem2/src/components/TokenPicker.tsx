import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'
import { CloseIcon, SearchIcon } from './Icons'
import { TokenIcon } from './TokenIcon'
import { formatPrice } from '../lib/format'
import { searchTokens } from '../lib/tokens'
import { useI18n } from '../i18n/context'
import type { Token } from '../lib/types'

interface TokenPickerProps {
  open: boolean
  tokens: readonly Token[]
  selected?: string
  /** The other side's ticker; selecting it flips the pair. */
  counterpart?: string
  onSelect: (token: Token) => void
  onClose: () => void
  title: string
}

export function TokenPicker({ open, onClose, ...rest }: TokenPickerProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-60 grid place-items-center bg-black/60 p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          {/* Mounted only while open, so its state resets without an effect. */}
          <PickerDialog onClose={onClose} {...rest} />
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

type PickerDialogProps = Omit<TokenPickerProps, 'open'>

function PickerDialog({
  tokens,
  selected,
  counterpart,
  onSelect,
  onClose,
  title,
}: PickerDialogProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const results = useMemo(() => searchTokens(tokens, query), [tokens, query])

  useEffect(() => {
    const focus = window.setTimeout(() => searchRef.current?.focus(), 40)
    return () => window.clearTimeout(focus)
  }, [])

  // Restore focus and page scrolling on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // On the document, not the dialog: focus lands inside a tick later, and a
    // click on dead space takes it back out. Bound locally, Escape dies silently.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  const commit = useCallback(
    (token: Token | undefined) => {
      if (!token) return
      onSelect(token)
      onClose()
    },
    [onSelect, onClose],
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => {
        if (!results.length) return 0
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = (current + delta + results.length) % results.length
        listRef.current
          ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
          ?.scrollIntoView({ block: 'nearest' })
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      commit(results[activeIndex])
    }
  }

  return (
    <m.div
      className="flex max-h-[min(600px,86vh)] w-[min(420px,100%)] flex-col overflow-hidden rounded-card bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-lg font-semibold" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
          onClick={onClose}
          aria-label={t('picker.closeLabel')}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-lg border border-transparent bg-panel px-3 py-2.5 transition-colors focus-within:border-line-strong">
        <SearchIcon className="shrink-0 text-muted" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          placeholder={t('picker.search')}
          aria-label={t('picker.searchLabel')}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <p className="px-5 pb-1.5 text-xs text-muted" aria-live="polite">
        {t(results.length === 1 ? 'picker.countOne' : 'picker.count', { count: results.length })}
      </p>

      <div
        className="scroll-slim flex-1 overflow-y-auto px-2 pb-2"
        ref={listRef}
        role="listbox"
        aria-label={t('picker.assets')}
      >
        {results.map((token, index) => (
          <button
            key={token.symbol}
            type="button"
            role="option"
            aria-selected={token.symbol === selected}
            data-index={index}
            className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
              index === activeIndex ? 'bg-panel' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => commit(token)}
          >
            <TokenIcon token={token} size={32} />
            <span className="min-w-0 flex-1">
              <span
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  token.symbol === selected ? 'text-accent-text' : ''
                }`}
              >
                {token.symbol}
                {token.symbol === counterpart && (
                  <span className="rounded-sm bg-accent-wash px-1.5 py-px text-[10px] font-semibold text-accent-text">
                    {t('picker.flips')}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted">{token.name}</span>
            </span>
            <span className="shrink-0 text-right text-[13px] tabular-nums">
              {formatPrice(token.price)}
            </span>
          </button>
        ))}

        {!results.length && (
          <p className="px-5 pt-10 pb-11 text-center text-[13px] text-muted">
            {t('picker.emptyTitle', { query })}
            <br />
            {t('picker.emptyHint')}
          </p>
        )}
      </div>

      <div className="flex gap-4 border-t border-line px-5 py-3 text-xs text-muted">
        <span>
          <Key>↑</Key> <Key>↓</Key> {t('picker.browse')}
        </span>
        <span>
          <Key>↵</Key> {t('picker.select')}
        </span>
        <span>
          <Key>esc</Key> {t('picker.close')}
        </span>
      </div>
    </m.div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-4 rounded-[3px] bg-raised px-1 py-px text-center font-mono text-[10px] text-muted">
      {children}
    </kbd>
  )
}
