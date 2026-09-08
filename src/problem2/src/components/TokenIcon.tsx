import { useState } from 'react'
import type { Token } from '../lib/types'

interface TokenIconProps {
  token: Token | undefined
  size?: number
  className?: string
}

export function TokenIcon({ token, size = 26, className = '' }: TokenIconProps) {
  // Keyed by symbol, so switching tokens clears the failure without an effect.
  const [failedSymbol, setFailedSymbol] = useState<string | null>(null)

  const showImage = Boolean(token?.icon) && failedSymbol !== token?.symbol

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-raised-strong ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={token!.icon!}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          onError={() => setFailedSymbol(token!.symbol)}
          className="block size-full object-contain"
        />
      ) : (
        <span
          className="leading-none font-semibold text-accent-text"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {(token?.symbol ?? '?').slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}
