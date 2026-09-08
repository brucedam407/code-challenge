import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

if (!('getRandomValues' in globalThis.crypto)) {
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    value: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256)
      return array
    },
  })
}

// Plain functions, not vi.fn(): `restoreMocks` resets implementations before
// every test, which would leave motion calling `.addListener` on undefined.
const noop = () => {}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  }),
})

// Used by the picker's keyboard navigation; jsdom lacks it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = noop
}
