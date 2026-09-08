import { useCallback, useEffect, useRef, useState } from 'react'
import fallbackRows from '../data/prices.fallback.json'
import { toTokens } from '../lib/tokens'
import type { FeedStatus, PriceRow, Token } from '../lib/types'

const FEED_URL = 'https://interview.switcheo.com/prices.json'

/** Committed snapshot, so the page works offline. */
const FALLBACK_TOKENS = toTokens(fallbackRows as PriceRow[])

interface PricesState {
  tokens: Token[]
  status: FeedStatus
  refresh: () => void
}

export function usePrices(): PricesState {
  const [tokens, setTokens] = useState<Token[]>(FALLBACK_TOKENS)
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    async function load() {
      try {
        const response = await fetch(FEED_URL, { signal: controller.signal })
        if (!response.ok) throw new Error(`Feed responded ${response.status}`)

        const rows = (await response.json()) as PriceRow[]
        const next = toTokens(rows)
        if (!next.length) throw new Error('Feed returned no priced tokens')
        if (!mounted.current) return

        setTokens(next)
        setStatus('live')
      } catch {
        if (!mounted.current) return
        setTokens(FALLBACK_TOKENS)
        setStatus('cached')
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void load()

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [nonce])

  const refresh = useCallback(() => {
    setStatus('loading')
    setNonce((n) => n + 1)
  }, [])

  return { tokens, status, refresh }
}
