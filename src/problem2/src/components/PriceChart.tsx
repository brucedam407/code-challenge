import { useId, useMemo, useState } from 'react'
import { formatAmount } from '../lib/format'
import { useI18n } from '../i18n/context'
import type { Series } from '../lib/series'

interface PriceChartProps {
  series: Series
  quoteSymbol: string
  baseSymbol: string
}

const WIDTH = 1000
const HEIGHT = 260
const PAD_TOP = 16
const PAD_BOTTOM = 16

const hour = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function PriceChart({ series, quoteSymbol, baseSymbol }: PriceChartProps) {
  const { t } = useI18n()
  const gradientId = useId()
  const [hovered, setHovered] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const { points, low, high } = series
    if (points.length < 2) return null

    // A flat series would divide by zero.
    const span = high - low || high || 1
    const top = high + span * 0.12
    const bottom = low - span * 0.12
    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM

    const x = (i: number) => (i / (points.length - 1)) * WIDTH
    const y = (value: number) => PAD_TOP + ((top - value) / (top - bottom)) * plotHeight

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ')
    const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`

    return { x, y, line, area }
  }, [series])

  if (!geometry) return null

  const { points, change, low, high } = series
  const up = change >= 0
  const stroke = up ? 'var(--color-up)' : 'var(--color-down)'
  const active = hovered ?? points.length - 1
  const activePoint = points[active]

  /** Percentages, so HTML labels track the SVG without its distortion. */
  const percentY = (value: number) => `${(geometry.y(value) / HEIGHT) * 100}%`

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const index = Math.round(ratio * (points.length - 1))
    setHovered(Math.min(points.length - 1, Math.max(0, index)))
  }

  return (
    <figure className="m-0">
      <div
        className="relative touch-none pr-16"
        onPointerMove={onMove}
        onPointerLeave={() => setHovered(null)}
      >
        {/* Labels live in HTML: text inside a stretched SVG is smeared. */}
        <svg
          className="block h-[clamp(240px,28vw,380px)] w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('chart.alt', {
            base: baseSymbol,
            quote: quoteSymbol,
            direction: up ? t('chart.up') : t('chart.down'),
            percent: Math.abs(change * 100).toFixed(2),
          })}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[high, low].map((value) => (
            <line
              key={value}
              x1="0"
              x2={WIDTH}
              y1={geometry.y(value)}
              y2={geometry.y(value)}
              className="stroke-line [stroke-dasharray:3_4] [vector-effect:non-scaling-stroke]"
              strokeWidth="1"
            />
          ))}

          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            className="[vector-effect:non-scaling-stroke]"
          />

          {hovered !== null && (
            <line
              x1={geometry.x(active)}
              x2={geometry.x(active)}
              y1="0"
              y2={HEIGHT}
              strokeWidth="1"
              className="stroke-line-strong [vector-effect:non-scaling-stroke]"
            />
          )}
          <circle
            cx={geometry.x(active)}
            cy={geometry.y(activePoint.value)}
            r="4"
            fill={stroke}
            strokeWidth="2"
            className="stroke-surface [vector-effect:non-scaling-stroke]"
          />
        </svg>

        <span
          className="absolute right-0 -translate-y-1/2 text-[11px] whitespace-nowrap tabular-nums text-faint"
          style={{ top: percentY(high) }}
        >
          {formatAmount(high, { grouped: true })}
        </span>
        <span
          className="absolute right-0 -translate-y-1/2 text-[11px] whitespace-nowrap tabular-nums text-faint"
          style={{ top: percentY(low) }}
        >
          {formatAmount(low, { grouped: true })}
        </span>
      </div>

      <div className="flex justify-between pt-1.5 pr-16 pb-2.5 text-[11px] text-faint">
        <span>{hour(points[0].t)}</span>
        <span>{t('chart.now')}</span>
      </div>

      <figcaption className="flex items-baseline gap-2.5 border-t border-line pt-2.5">
        <span className="text-sm font-medium tabular-nums">
          {formatAmount(activePoint.value, { grouped: true })} {quoteSymbol}
        </span>
        <span className="text-xs text-muted">
          {hovered === null ? t('chart.latest') : hour(activePoint.t)}
        </span>
      </figcaption>
    </figure>
  )
}
