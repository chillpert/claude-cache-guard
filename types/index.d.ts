// Keep warm, for the session: whether it is on and since when, the last message from the person, the
// last main-thread request and the cache lifetime it named (0 while unknown), the pokes sent, and
// whether a turn is running.
export type Warm = {
  isOn: boolean
  onAt: number
  activeAt: number
  lastAt: number
  ttlS: number
  pokes: number
  isBusy: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'cache-guard': { warm: Warm; bar: boolean }
  }
}
