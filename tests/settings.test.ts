import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { TEXT } from '../hooks/texts'

type On = Parameters<TestBody>[1]

const START = 1_000_000_000
const LAST = { at: START, tokens: 150_000, model: 'claude-opus-5-5', shown: 'Opus 5.5', effort: 'high' }

async function engine($: Parameters<TestBody>[0], on: On, model: string, store: Record<string, unknown> = {}) {
  mock.clock(on, { now: START + 60_000 })
  mock.store(on, { 'last:session': LAST, ...store })
  mock.env(on, {})
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.id', () => ({ value: 'session' }))
  on('session.model', () => ({ value: model }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))
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
  const type = (text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
  return { logged, sent, type }
}

test('a message right after a model change is held once', async ($, on) => {
  const { logged, sent, type } = await engine($, on, 'Sonnet 5.5')

  await type('carry on')
  expect(sent).toEqual([])
  expect(logged).toEqual([TEXT.modelChanged('claude-opus-5-5', '150k', TEXT.costNote('$1.20'))])
  await type('carry on')
  expect(sent).toEqual(['carry on'])
})

test('the same model sends at once', async ($, on) => {
  const { sent, type } = await engine($, on, 'Opus 5.5')

  await type('carry on')
  expect(sent).toEqual(['carry on'])
})

test('/effort to another level holds the next message, unless the model kept the cache before', async ($, on) => {
  const { logged, sent, type } = await engine($, on, 'Opus 5.5')

  await $.command.run({ command: 'effort', args: 'low' } as never)
  await type('carry on')
  expect(sent).toEqual([])
  expect(logged.at(-1)).toBe(TEXT.effortChanged('high', 'low', '150k', TEXT.costNote('$1.20')))
})

test('an effort change is let through on a model seen to keep the cache', async ($, on) => {
  const { sent, type } = await engine($, on, 'Opus 5.5', { 'effortKeeps:claude-opus-5-5': true })

  await $.command.run({ command: 'effort', args: 'low' } as never)
  await type('carry on')
  expect(sent).toEqual(['carry on'])
})
