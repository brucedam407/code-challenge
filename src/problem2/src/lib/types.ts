export interface PriceRow {
  currency: string
  date: string
  price: number
}

export interface Token {
  symbol: string
  name: string
  price: number
  asOf: string
  icon: string | null
}

export type FeedStatus = 'loading' | 'live' | 'cached'

export type EditedSide = 'from' | 'to'
