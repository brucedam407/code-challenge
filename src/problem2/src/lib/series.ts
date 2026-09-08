interface SeriesPoint {
  /** Epoch milliseconds. */
  t: number
  /** Units of the quote asset per one unit of the base asset. */
  value: number
}

export interface Series {
  points: SeriesPoint[]
  change: number
  low: number
  high: number
}

const POINTS = 48
const WINDOW_MS = 24 * 60 * 60 * 1000

const STEP_SIGMA = 0.0035
const MEAN_REVERSION = 0.06

/** Deterministic, so a pair always draws the same line. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function gaussian(random: () => number): number {
  const u = Math.max(random(), Number.EPSILON)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/**
 * Simulated: the feed has one spot quote per token and no history. Not market data.
 */
export function simulate24h(pairKey: string, endValue: number, now = Date.now()): Series {
  if (!(endValue > 0)) {
    return { points: [], change: 0, low: 0, high: 0 }
  }

  const random = mulberry32(hash(pairKey))
  const walk: number[] = [1]

  for (let i = 1; i < POINTS; i++) {
    const previous = walk[i - 1]
    const drift = (1 - previous) * MEAN_REVERSION
    walk.push(Math.max(0.2, previous * (1 + gaussian(random) * STEP_SIGMA) + drift))
  }

  // Anchor the final point to the rate the rest of the UI shows.
  const scale = endValue / walk[walk.length - 1]
  const step = WINDOW_MS / (POINTS - 1)

  const points = walk.map((value, i) => ({
    t: now - WINDOW_MS + i * step,
    value: value * scale,
  }))

  const values = points.map((p) => p.value)

  return {
    points,
    change: (points[points.length - 1].value - points[0].value) / points[0].value,
    low: Math.min(...values),
    high: Math.max(...values),
  }
}
