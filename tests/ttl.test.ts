import { expect, test } from 'claude-code/testing'

import { rowsOf, writtenTtlS } from '../hooks/register'

test('the lifetime comes from what the request wrote, by the larger share', () => {
  expect(writtenTtlS({ ephemeral_1h_input_tokens: 150_000, ephemeral_5m_input_tokens: 0 })).toBe(3600)
  expect(writtenTtlS({ ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 150_000 })).toBe(300)
  // a server tool's small 5-minute write after its result does not shorten a 1-hour cache
  expect(writtenTtlS({ ephemeral_1h_input_tokens: 150_000, ephemeral_5m_input_tokens: 800 })).toBe(3600)
  // a pure read writes nothing and says nothing about the lifetime
  expect(writtenTtlS({})).toBeUndefined()
  expect(writtenTtlS({ ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 })).toBeUndefined()
})

test('from the transcript, a request counts from the user entry before its reply', () => {
  const line = (o: object) => JSON.stringify(o)
  const usage = { input_tokens: 10, cache_read_input_tokens: 140_000, cache_creation_input_tokens: 500, output_tokens: 900, cache_creation: { ephemeral_1h_input_tokens: 500 } }
  const rows = rowsOf([
    line({ type: 'user', timestamp: '2026-11-23T10:00:00.000Z' }),
    line({ type: 'assistant', timestamp: '2026-11-23T10:03:00.000Z', message: { model: 'claude-opus-5-5', usage } }),
    line({ type: 'user', isSidechain: true, timestamp: '2026-11-23T10:04:00.000Z' }),
  ])
  expect(rows).toEqual([{ at: Date.parse('2026-11-23T10:00:00.000Z'), tokens: 141_410, model: 'claude-opus-5-5', ttlS: 3600 }])
})
