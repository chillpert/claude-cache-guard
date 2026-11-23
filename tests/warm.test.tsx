import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Warm } from '../types'
import { TEXT } from '../hooks/texts'

type On = Parameters<TestBody>[1]

const MINUTE = 60_000
const START = 1_000_000_000
const OFF: Warm = { isOn: false, onAt: 0, activeAt: 0, lastAt: 0, ttlS: 0, pokes: 0, isBusy: false }
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
async function engine($: Parameters<TestBody>[0], on: On, seed?: Warm) {
  const clock = mock.clock(on, { now: START })
  mock.store(on)
  mock.env(on, {})
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
  on('session.id', () => ({ value: 'session' }))
  on('session.messages', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return { clock, sent, warm: () => kept.value as Warm }
}

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
