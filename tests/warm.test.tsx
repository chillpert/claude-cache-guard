import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Warm } from '../types'
import { TEXT } from '../hooks/texts'

type On = Parameters<TestBody>[1]

const MINUTE = 60_000
const START = 1_000_000_000
const OFF: Warm = { isOn: false, onAt: 0, activeAt: 0, lastAt: 0, ttlS: 0, pokes: 0, streak: 0, isBusy: false, tokens: 0, model: '', percent: 0 }
const BAND = {
  plugin: 'cache-guard',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const

// Nothing sits beneath the plugin: these hooks stand for the engine.
// With a seed, the state is answered from it (and does not redraw); without, the kit's own state does.
async function engine(
  $: Parameters<TestBody>[0],
  on: On,
  seed?: Warm,
  messages: unknown[] = [],
  opts: { env?: Record<string, string>; store?: Record<string, unknown> } = {},
) {
  const clock = mock.clock(on, { now: START })
  // the store, readable by the test
  const store = new Map<string, unknown>(Object.entries(opts.store ?? {}))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_, e) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  mock.env(on, opts.env ?? {})
  let kept = { value: seed as unknown, version: 1 }
  if (seed) {
    on('state.get', (_, e, next) => (e.key === 'warm' ? { value: kept } : next(e)))
    on('state.set', (_, e, next) => {
      if (e.key !== 'warm') return next(e)
      kept = { value: e.value, version: kept.version + 1 }
      return { value: { isSet: true as const, version: kept.version } }
    })
  }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  const id = { value: 'session' }
  on('session.id', () => ({ value: id.value }))
  on('session.messages', () => ({ value: messages }) as never)
  on('session.root', () => ({ value: '/repo' }))
  on('fs.exists', () => ({ value: true }))
  const files: Record<string, string> = {}
  on('fs.write', (_, e) => {
    files[(e as { path: string }).path] = (e as { text?: string; content?: string }).text ?? (e as { content?: string }).content ?? ''
    return { value: undefined }
  })
  const asked: string[] = []
  on('model.complete', (_, e) => {
    asked.push((e as { prompt: string }).prompt)
    return { value: { isAnswered: true, text: 'ABOUT: Fixing the login test.\n\n## Goal\nfix it', usage: {} } } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  on('prompt.fill', () => ({ isFilled: false }) as never)
  on('ui.notify', () => ({ value: undefined }) as never)
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 5, model: 'm' },
    } as never
  })
  const ran: string[] = []
  on('command.run', (_, e) => {
    ran.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  const logged: string[] = []
  on('ui.log', (_, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return { clock, sent, ran, logged, asked, files, id, store, warm: () => kept.value as Warm }
}

const ASK = [{ role: 'user', text: 'fix the login test', toolUses: [] }]
const type = ($: Parameters<TestBody>[0], text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
// what the engine does on /clear: the conversation ends, the process goes on under a new id
async function clear($: Parameters<TestBody>[0], id: { value: string }, next: string) {
  await $.session.end({ reason: 'clear', sessionId: id.value, resume: { id: id.value } } as never)
  id.value = next
}
async function step($: Parameters<TestBody>[0]) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 } as never)
  for await (const _ of stream) {
    // read to its end
  }
  await stream.result
}
const handoffBlock = async ($: Parameters<TestBody>[0]) =>
  (await $.prompt.context({ blocks: [] } as never)).blocks.find(b => b.name === 'cacheGuardHandoff')?.text

test('the bar is shown by default and its button switches keep warm', async ($, on) => {
  await engine($, on)

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(TEXT.barNoRequest)
  expect((await ui.find({ type: 'Button' }))?.text).toBe(TEXT.barWarmOff)
  await ui.press({ key: 'warm' })
  expect((await ui.find({ type: 'Button' }))?.text).toBe(TEXT.barWarmOn)
  await ui.press({ key: 'warm' })
  expect((await ui.find({ type: 'Button' }))?.text).toBe(TEXT.barWarmOff)
  await ui.unmount()
})

test('a poke goes out 48m after the last request of a 1h cache, once', async ($, on) => {
  const { clock, sent, warm } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, lastAt: START, ttlS: 3600 })

  await clock.advance(47 * MINUTE)
  expect(sent).toEqual([])
  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(TEXT.barColdIn(13))
  await ui.unmount()

  await clock.advance(2 * MINUTE)
  expect(sent).toEqual([TEXT.poke])
  expect(warm().pokes).toBe(1)
})

test('a cache that already went cold is not poked', async ($, on) => {
  const { clock, sent } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, lastAt: START - 2 * 60 * MINUTE, ttlS: 3600 })

  await clock.advance(5 * MINUTE)
  expect(sent).toEqual([])
  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(TEXT.barCold)
  await ui.unmount()
})

test('keep warm turns itself off after 8h without a message from the person', async ($, on) => {
  const { clock, warm } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, ttlS: 3600 })

  await clock.advance(8 * 60 * MINUTE + MINUTE)
  expect(warm().isOn).toBe(false)
})

const run = (args: string) => ({ command: 'cache-guard', args }) as Parameters<Parameters<TestBody>[0]['command']['run']>[0]

test('bar off hides the bar, bar on shows it again', async ($, on) => {
  await engine($, on)

  expect((await $.command.run(run('bar off'))).text).toBe(TEXT.barOff)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  expect((await $.command.run(run('bar on'))).text).toBe(TEXT.barOn)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(TEXT.barNoRequest)
  await ui.unmount()
})

test('/cache-guard handoff reaches the handoff', async ($, on) => {
  await engine($, on)

  expect((await $.command.run(run('handoff'))).text).toBe(TEXT.handoffEmpty)
  expect((await $.command.run(run('nonsense'))).text).toBe(TEXT.usage)
})

test('the timer is green, then yellow, then red, then cold', async ($, on) => {
  const { clock } = await engine($, on, { ...OFF, lastAt: START, ttlS: 3600 })
  const color = async () => {
    const ui = await $.ui.mount(BAND)
    const found = await ui.find({ type: 'Text', text: /^Cache/ })
    await ui.unmount()
    return [found?.text, found?.props.color]
  }

  expect(await color()).toEqual([TEXT.barColdIn(60), 'success'])
  await clock.advance(31 * MINUTE)
  expect(await color()).toEqual([TEXT.barColdIn(29), 'warning'])
  // a fifth of an hour is 12 minutes: yellow down to it, red below
  await clock.advance(16 * MINUTE)
  expect(await color()).toEqual([TEXT.barColdIn(13), 'warning'])
  await clock.advance(2 * MINUTE)
  expect(await color()).toEqual([TEXT.barColdIn(11), 'error'])
  await clock.advance(11 * MINUTE)
  expect(await color()).toEqual([TEXT.barCold, 'error'])
})

test('an unknown lifetime shows no countdown and sends no poke', async ($, on) => {
  const { clock, sent } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, lastAt: START, ttlS: 0 })

  await clock.advance(70 * MINUTE)
  expect(sent).toEqual([])
  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /^Cache/ }))?.text).toBe(TEXT.barUnknown)
  await ui.unmount()
})

test('the handoff button runs the handoff itself', async ($, on) => {
  const { ran, logged } = await engine($, on)

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Button', key: 'handoff' }))?.text).toBe(TEXT.barHandoff)
  await ui.press({ key: 'handoff' })
  expect(ran).toEqual([]) // nothing reaches the engine unanswered
  expect(logged).toEqual([TEXT.handoffEmpty])
  await ui.unmount()
})

test('keep warm comes back on after the session process restarts', async ($, on) => {
  // what an earlier process kept for this session row; this process starts with the default state
  mock.store(on, { 'warm:session': { isOn: true, onAt: START, activeAt: START, lastAt: START, ttlS: 3600, pokes: 2 } })
  mock.clock(on, { now: START + 10 * MINUTE })
  mock.env(on, {})
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.id', () => ({ value: 'session' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Button', key: 'warm' }))?.text).toBe(TEXT.barWarmOn)
  expect((await ui.find({ type: 'Text', text: /^Cache/ }))?.text).toBe(TEXT.barColdIn(50))
  await ui.unmount()
})

test('a handoff can be cancelled before its clear', async ($, on) => {
  const { clock, ran, logged } = await engine($, on, undefined, [{ role: 'user', text: 'fix the login test', toolUses: [] }])

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'handoff' })
  expect((await ui.find({ type: 'Button', key: 'cancel' }))?.text).toBe(TEXT.barCancel)
  await ui.press({ key: 'cancel' })
  expect(logged.at(-1)).toBe(TEXT.handoffCancelled)
  expect(await ui.find({ type: 'Button', key: 'handoff' })).toBeDefined()
  await clock.advance(MINUTE)
  expect(ran).toEqual([]) // no /clear
  await ui.unmount()
})

test('/cache-guard cancel with no handoff in flight says so', async ($, on) => {
  await engine($, on)
  expect((await $.command.run(run('cancel'))).text).toBe(TEXT.handoffNothingToCancel)
})

test('keep warm pauses once its pokes since the last message add up to one cache write', async ($, on) => {
  // no price known: a 5-minute cache write is 12.5 reads, so 12 pokes
  const { clock, sent, logged } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, lastAt: START, ttlS: 300, streak: 12 })

  await clock.advance(4 * MINUTE + 30_000)
  expect(sent).toEqual([])
  expect(logged).toEqual([TEXT.warmCapped(12)])
})

test('below the cap the poke still goes out', async ($, on) => {
  const { clock, sent } = await engine($, on, { ...OFF, isOn: true, onAt: START, activeAt: START, lastAt: START, ttlS: 300, streak: 11 })

  await clock.advance(4 * MINUTE + 30_000)
  expect(sent).toEqual([TEXT.poke])
})

test('the bar shows the context size, its share and the miss cost', async ($, on) => {
  await engine($, on, { ...OFF, lastAt: START, ttlS: 3600, tokens: 310_000, model: 'claude-opus-5-5', percent: 31 })

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /tokens/ }))?.text).toBe(TEXT.barTokensShare('310k', 31))
  // 310k tokens written at 2x $4 per million
  expect((await ui.find({ type: 'Text', text: /^miss/ }))?.text).toBe(TEXT.barMiss('$2.48'))
  await ui.unmount()
})

test('a message typed while a handoff is in flight goes to the fresh conversation', async ($, on) => {
  const { clock, sent, ran, logged, id } = await engine($, on, undefined, ASK)

  await $.command.run(run('handoff'))
  await type($, 'and update the docs')
  expect(sent).toEqual([])
  expect(logged.at(-1)).toBe(TEXT.queuedForHandoff)
  await clock.advance(5_000)
  expect(ran).toEqual(['clear '])
  await clear($, id, 'session-2')
  await clock.advance(1_000)
  expect(sent).toEqual(['and update the docs'])
})

test('a message typed while a handoff is in flight goes back to the box when it is cancelled', async ($, on) => {
  const { clock, sent, ran, logged } = await engine($, on, undefined, ASK)

  await $.command.run(run('handoff'))
  await type($, 'and update the docs')
  expect((await $.command.run(run('cancel'))).text).toBe(TEXT.handoffCancelled)
  // no prompt box in the test: it is logged instead
  expect(logged.at(-1)).toBe('and update the docs')
  await clock.advance(MINUTE)
  expect(ran).toEqual([])
  expect(sent).toEqual([])
})

test('a turn of the old conversation before the clear cancels the handoff', async ($, on) => {
  const { clock, ran, logged } = await engine($, on, undefined, ASK)

  await $.command.run(run('handoff'))
  await step($)
  expect(logged.at(-1)).toBe(TEXT.handoffStale)
  await clock.advance(MINUTE)
  expect(ran).toEqual([]) // no /clear
})

test('a second handoff carries the first one forward', async ($, on) => {
  const { clock, asked, files, id } = await engine($, on, undefined, ASK)

  await $.command.run(run('handoff'))
  await clock.advance(5_000)
  await clear($, id, 'session-2')
  expect(await handoffBlock($)).toContain('fix it')
  expect(asked[0]).not.toContain('<earlier_handoff>')

  await clock.advance(MINUTE)
  expect((await $.command.run(run('handoff'))).text).not.toBe(TEXT.handoffDone)
  expect(asked[1]).toContain('<earlier_handoff>')
  expect(asked[1]).toContain('fix it')
  const notes = Object.entries(files).filter(([path]) => path.endsWith('.md'))
  expect(notes.length).toBe(2)
  const first = notes[0]![0].split(/[\\/]/).pop()!
  expect(notes[1]![1]).toContain(TEXT.fileContinues(first))
})

test('back in a conversation that was handed off, a new handoff can be written', async ($, on) => {
  const { clock, id } = await engine($, on, undefined, ASK)

  await $.command.run(run('handoff'))
  await clock.advance(5_000)
  await clear($, id, 'session-2')
  id.value = 'session' // /resume of the old conversation
  expect((await $.command.run(run('handoff'))).text).not.toBe(TEXT.handoffDone)
})

test('handoffs of parallel session rows are kept apart in the store', async ($, on) => {
  const other = { path: '/b.md', about: 'b', text: 'row b handoff', writtenAt: START, host: 'row-b', phase: 'armed' }
  const { clock, id, store } = await engine($, on, undefined, ASK, { env: { CLAUDE_CODE_HOST_SESSION_ID: 'row-a' }, store: { 'armed:row-b': other } })

  await $.command.run(run('handoff'))
  expect(((store.get('armed:row-a')) as { phase: string }).phase).toBe('pending')
  await clock.advance(5_000)
  await clear($, id, 'session-2')
  expect(((store.get('armed:row-a')) as { phase: string }).phase).toBe('armed')
  expect(store.get('armed:row-b')).toEqual(other)
  expect(store.get('armed')).toBeUndefined()
})

test('a handoff armed under the old single key comes back for its own row only', async ($, on) => {
  const legacy = { path: '/a.md', about: 'a', text: 'row a handoff', writtenAt: START, host: 'row-a', phase: 'armed' }
  const { store } = await engine($, on, undefined, ASK, { env: { CLAUDE_CODE_HOST_SESSION_ID: 'row-a' }, store: { armed: legacy } })

  expect(await handoffBlock($)).toContain('row a handoff')
  expect(store.get('armed:row-a')).toEqual(legacy)
  expect(store.get('armed')).toBeUndefined()
})
