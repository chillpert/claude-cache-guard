// List prices, in dollars per million input tokens and per million cache-read tokens, by model id.
// A cache write costs 1.25x the input price on the 5-minute lifetime and 2x on the 1-hour one.
// Estimates for the bar and the warnings, not a bill: on a subscription nothing here is charged.

type Price = { input: number; read: number }

// Checked in order, so a longer id comes before the shorter one it starts with.
const PRICES: readonly (readonly [string, Price])[] = [
  ['fable-5-2', { input: 8, read: 0.2 }],
  ['mythos-5-2', { input: 8, read: 0.2 }],
  ['fable-5', { input: 10, read: 1 }],
  ['mythos-5', { input: 10, read: 1 }],
  ['opus-5-5', { input: 4, read: 0.2 }],
  ['opus-5', { input: 5, read: 0.5 }],
  ['opus-4-8', { input: 5, read: 0.5 }],
  ['opus-4-7', { input: 5, read: 0.5 }],
  ['opus-4-6', { input: 5, read: 0.5 }],
  ['opus-4-5', { input: 5, read: 0.5 }],
  ['opus-4', { input: 15, read: 1.5 }],
  ['sonnet-5-5', { input: 2, read: 0.1 }],
  ['sonnet-5', { input: 2, read: 0.2 }],
  ['sonnet-4', { input: 3, read: 0.3 }],
  ['haiku-5-5', { input: 0.1, read: 0.01 }],
  ['haiku-4-5', { input: 1, read: 0.1 }],
]

// read over input when the model is not in the table
const DEFAULT_READ_RATIO = 0.1

export function priceOf(model: string): Price | undefined {
  const id = model.toLowerCase()
  return PRICES.find(([key]) => id.includes(key))?.[1]
}

export function writeMultiplier(ttlS: number): number {
  return ttlS <= 300 ? 1.25 : 2
}

// Writing the whole context again over reading it: what a cold turn costs against a warm one.
export function missRatio(model: string, ttlS: number): number {
  const p = priceOf(model)
  const readRatio = p ? p.read / p.input : DEFAULT_READ_RATIO
  return writeMultiplier(ttlS) / readRatio
}

// Dollars to write `tokens` to the cache again, or undefined for a model without a known price.
export function missUsd(tokens: number, model: string, ttlS: number): number | undefined {
  const p = priceOf(model)
  return p ? (tokens / 1e6) * p.input * writeMultiplier(ttlS) : undefined
}

// How many pokes (each a cache read of the context) add up to one cache write of it.
export function pokeCap(model: string, ttlS: number): number {
  return Math.max(1, Math.floor(missRatio(model, ttlS)))
}

export function usd(n: number): string {
  return n >= 10 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`
}
