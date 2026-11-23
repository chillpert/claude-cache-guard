// Every text cache-guard shows a person, in one place. The handoff prompt for Haiku is in register.tsx.

export const COMMAND = 'cache-guard'

export const TEXT = {
  // the slash command in the typeahead
  commandDescription: 'Cache status, handoff to a fresh conversation, keep warm, the bar',
  commandHint: '[status | handoff | warm on | warm off | bar on | bar off]',
  usage: 'Use /cache-guard with status, handoff, warm on, warm off, bar on or bar off.',

  // the guard, when it holds a prompt back
  cold: (idle: string, tokens: string, ratio: number) =>
    `Cache cold (idle ${idle}, ~${tokens} tokens): sending here costs ~${ratio}x a warm turn. /cache-guard handoff to continue fresh, or resend within 2m to send here anyway.`,
  heldDrop: 'Prompt held: cold cache.',

  // the bar above the prompt: the cache's state, then a button that switches keep warm
  barColdIn: (minutes: number) => `Cache cold in ${minutes}m`,
  barBusy: 'Cache warm',
  barNoRequest: 'Cache empty',
  barCold: 'Cache cold',
  barWarmOn: 'keep warm: on',
  barWarmOff: 'keep warm: off',
  barOn: 'Bar shown above the prompt.',
  barOff: 'Bar hidden. /cache-guard bar on shows it again.',

  // keep warm
  poke: 'Cache keep-alive, no action needed. Reply with only: ok',
  warmOn: (ttl: string, every: string) => `Keep warm on: a short poke ${every} after the last request (${ttl} cache).`,
  warmOff: 'Keep warm off.',
  warmIdleOff: (idle: string) => `Keep warm turned itself off after ${idle} without a message from you.`,

  // /cache-guard status
  statusLast: (ago: string, tokens: string, model: string) => `Last request ${ago} ago · ~${tokens} tokens · ${model}`,
  statusLastUnknown: 'Last request: unknown',
  statusCache: (ttl: string, isCold: boolean, held: string) =>
    `Cache lifetime ${ttl} · cold: ${isCold ? 'yes' : 'no'} · held prompt: ${held}`,
  statusWarm: (isOn: boolean, pokes: number) => `Keep warm: ${isOn ? 'on' : 'off'} · ${pokes} poke${pokes === 1 ? '' : 's'} this session`,
  statusNone: 'none',
  simulated: 'Simulated cold cache. Your next prompt will be held.',

  // /cache-guard handoff
  handoffBusy: 'Handoff already in progress.',
  handoffDone: "Already handed off. Run /clear if it didn't clear.",
  handoffEmpty: 'Nothing to hand off yet.',
  handoffRunning: '⟳ Writing handoff…',
  handoffSaved: (file: string, hasPrompt: boolean, hadAttachments: boolean) =>
    `Handoff saved to .claude/handoffs/${file}. Clearing…${hasPrompt ? ` Your prompt will follow${hadAttachments ? ' (re-add attachments)' : ''}.` : ''}`,
  handoffFailed: (why: string) => `Handoff failed: ${why}. Nothing cleared.`,
  handoffFailedShort: 'Handoff failed. Nothing cleared.',
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
