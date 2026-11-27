// Every text cache-guard shows a person, in one place. The handoff prompt for Haiku is in register.tsx.

export const COMMAND = 'cache-guard'
// the grace period between a written handoff and its /clear, in which it can still be cancelled
export const CLEAR_DELAY_S = 5

export const TEXT = {
  // the slash command in the typeahead
  commandDescription: 'Cache status, handoff to a fresh conversation, keep warm, the bar',
  commandHint: '[status | handoff | cancel | warm on | warm off | bar on | bar off]',
  usage: 'Use /cache-guard with status, handoff, cancel, warm on, warm off, bar on or bar off.',

  // the guard, when it holds a prompt back
  cold: (idle: string, tokens: string, ratio: number) =>
    `Cache cold (idle ${idle}, ~${tokens} tokens): sending here costs ~${ratio}x a warm turn. /cache-guard handoff to continue fresh, or resend within 2m to send here anyway.`,
  heldDrop: 'Prompt held: cold cache.',

  // the bar above the prompt: the cache's state, a button that switches keep warm, and one for handoff
  barColdIn: (minutes: number) => `Cache cold in ${minutes}m`,
  barBusy: 'Cache warm',
  barNoRequest: 'Cache empty',
  barUnknown: 'Cache lifetime unknown',
  barCold: 'Cache cold',
  barWarmOn: 'Keep warm: on',
  barWarmOff: 'Keep warm: off',
  barHandoff: 'Handoff',
  barCancel: 'Cancel handoff',
  barOn: 'Bar shown above the prompt.',
  barOff: 'Bar hidden. /cache-guard bar on shows it again.',

  // keep warm
  poke: 'The cache-guard plugin sent a message:\nCache keep-alive, no action needed. Reply with only: ok',
  warmOn: (ttl: string, every: string) => `Keep warm on: a short poke ${every} after the last request (${ttl} cache).`,
  warmOnUnknown: 'Keep warm on: the first poke waits until a reply shows how long the cache lasts.',
  warmOff: 'Keep warm off.',
  warmIdleOff: (idle: string) => `Keep warm turned itself off after ${idle} without a message from you.`,

  // /cache-guard status
  statusLast: (ago: string, tokens: string, model: string) => `Last request ${ago} ago · ~${tokens} tokens · ${model}`,
  statusLastUnknown: 'Last request: unknown',
  statusCache: (ttl: string, isCold: boolean, held: string) =>
    `Cache lifetime ${ttl} · cold: ${isCold ? 'yes' : 'no'} · held prompt: ${held}`,
  statusWarm: (isOn: boolean, pokes: number) => `Keep warm: ${isOn ? 'on' : 'off'} · ${pokes} poke${pokes === 1 ? '' : 's'} this session`,
  statusChecks: (right: number, wrong: number) =>
    `Cold timer checked against the API: ${right} right, ${wrong} wrong this session`,
  statusNone: 'none',
  simulated: 'Simulated cold cache. Your next prompt will be held.',

  // /cache-guard handoff
  handoffBusy: 'Handoff already in progress.',
  handoffDone: "Already handed off. Run /clear if it didn't clear.",
  handoffEmpty: 'Nothing to hand off yet.',
  handoffRunning: '⟳ Writing handoff…',
  handoffSaved: (file: string, hasPrompt: boolean, hadAttachments: boolean) =>
    `Handoff saved to .claude/handoffs/${file}. Clearing in ${CLEAR_DELAY_S}s (Cancel handoff or /cache-guard cancel stops it).${hasPrompt ? ` Your prompt will follow${hadAttachments ? ' (re-add attachments)' : ''}.` : ''}`,
  handoffFailed: (why: string) => `Handoff failed: ${why}. Nothing cleared.`,
  handoffFailedShort: 'Handoff failed. Nothing cleared.',
  handoffCancelled: 'Handoff cancelled. Nothing cleared; this conversation goes on.',
  handoffNothingToCancel: 'No handoff in progress.',
  clearFailed: "Couldn't auto-clear. Run /clear to finish.",
  continued: (about: string) => `↻ Continued: ${about}`,
  resendFailed: "Couldn't resend your prompt. Here it is:",
  notifyTitle: 'Session continued',

  // the handoff file
  fileTitle: '# Handoff',
  fileAbout: (about: string) => `**About:** ${about}`,
  fileAboutFallback: (ask: string) => `Continuing: ${ask}`,
  filePending: '## Pending message (sent to the fresh session as its first prompt)',
  handoffSummaryBy: (model: string) => `Summary written by ${model}.`,
  handoffSummaryFailed: (why: string) => `Summary failed (${why}); the condensed transcript tail is below instead.`,
} as const
