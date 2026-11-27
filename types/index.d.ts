// Keep warm, for the session: whether it is on and since when, the last message from the person, the
// start of the last main-thread request and the cache lifetime it named (0 while unknown), the pokes sent
// (in all, and since the person's last message), whether a turn is running, and for the bar the last
// request's context size and model and the share of the context window it fills (0 while unknown).
export type Warm = {
  isOn: boolean
  onAt: number
  activeAt: number
  lastAt: number
  ttlS: number
  pokes: number
  streak: number
  isBusy: boolean
  tokens: number
  model: string
  percent: number
}

// A handoff in flight: the summary being written, or the /clear waiting out its grace period. Either can be cancelled.
export type HandoffPhase = 'idle' | 'writing' | 'clearing'

declare module 'claude-code' {
  interface PluginState {
    'cache-guard': { warm: Warm; bar: boolean; checks: { right: number; wrong: number }; handoff: HandoffPhase }
  }
}
