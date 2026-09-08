import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LazyMotion, domAnimation } from 'motion/react'
import { Calculator, type Pair } from './Calculator'
import type { Token } from '../lib/types'

const token = (symbol: string, name: string, price: number): Token => ({
  symbol,
  name,
  price,
  asOf: '2023-08-29T07:10:52.000Z',
  icon: null,
})

const TOKENS: Token[] = [
  token('ETH', 'Ethereum', 1645.9337373737374),
  token('USDC', 'USD Coin', 0.9898111811125403),
  token('WBTC', 'Wrapped Bitcoin', 26002.82),
]

const RATE = TOKENS[0].price / TOKENS[1].price

/** The pair is controlled by the page, so the test owns it too. */
function Harness() {
  const [pair, setPair] = useState<Pair>({ from: 'ETH', to: 'USDC' })
  return <Calculator tokens={TOKENS} pair={pair} onPairChange={setPair} feedReady />
}

function renderCalculator() {
  render(
    <LazyMotion features={domAnimation} strict>
      <Harness />
    </LazyMotion>,
  )
}

const from = () => screen.getByLabelText('From') as HTMLInputElement
const to = () => screen.getByLabelText('To') as HTMLInputElement

describe('Calculator', () => {
  it('converts forwards at the marked rate', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.clear(from())
    await user.type(from(), '1.5')

    // The rate and nothing else: no fee, no spread.
    await waitFor(() => expect(Number(to().value)).toBeCloseTo(1.5 * RATE, 2))
  })

  it('converts backwards when the user types into the To field', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.clear(to())
    await user.type(to(), '1000')

    await waitFor(() => expect(Number(from().value)).toBeCloseTo(1000 / RATE, 6))
    expect(screen.getByText(/solving for From/i)).toBeInTheDocument()
  })

  it('refuses keystrokes that would make the amount invalid', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.clear(from())
    await user.type(from(), '1.5abc')
    expect(from()).toHaveValue('1.5')

    await user.clear(from())
    await user.type(from(), '2.5.5')
    expect(from()).toHaveValue('2.55')

    await user.clear(from())
    await user.type(from(), '0.123456789')
    expect(from()).toHaveValue('0.12345678')
  })

  it('reverses the pair and carries the amount over', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.clear(from())
    await user.type(from(), '2')
    await waitFor(() => expect(to().value).not.toBe(''))
    const received = to().value

    await user.click(screen.getByRole('button', { name: /convert USDC to ETH instead/i }))

    expect(
      screen.getByRole('button', { name: /change asset, currently USDC/i }),
    ).toBeInTheDocument()
    expect(from()).toHaveValue(received)
  })

  it('flips the pair instead of allowing a self-conversion', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.click(screen.getByRole('button', { name: /change asset, currently ETH/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('option', { name: /USDC/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      screen.getByRole('button', { name: /change asset, currently USDC/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change asset, currently ETH/i })).toBeInTheDocument()
  })

  it('closes the token picker on Escape', async () => {
    // Regression: bound to the dialog, Escape did nothing until focus moved in.
    const user = userEvent.setup()
    renderCalculator()

    await user.click(screen.getByRole('button', { name: /change asset, currently ETH/i }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says so when a result is smaller than it can show', async () => {
    const user = userEvent.setup()
    renderCalculator()

    await user.click(screen.getByRole('button', { name: /change asset, currently USDC/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('option', { name: /WBTC/i }))

    await user.clear(from())
    await user.type(from(), '0.00000004')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /smaller than this calculator shows/i,
    )
  })
})
