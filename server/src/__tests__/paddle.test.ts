import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'

let verifyPaddleSignature: typeof import('../lib/paddle.js')['verifyPaddleSignature']
let getPaddleSubscription: typeof import('../lib/paddle.js')['getPaddleSubscription']

beforeAll(async () => {
  process.env.PADDLE_WEBHOOK_SECRET = 'test_secret_32_chars_long_at_least!'
  process.env.NODE_ENV = 'test'
  const mod = await import('../lib/paddle.js')
  verifyPaddleSignature = mod.verifyPaddleSignature
  getPaddleSubscription = mod.getPaddleSubscription
})

describe('verifyPaddleSignature', () => {
  it('returns false for empty signature header', () => {
    expect(verifyPaddleSignature('{}', '')).toBe(false)
  })

  it('returns false for malformed signature header', () => {
    expect(verifyPaddleSignature('{}', 'invalid')).toBe(false)
  })

  it('returns false for missing h1 part', () => {
    expect(verifyPaddleSignature('{}', 't=1234567890')).toBe(false)
  })

  it('returns false for missing t part', () => {
    expect(verifyPaddleSignature('{}', 'h1=abc123')).toBe(false)
  })

  it('verifies a valid signature correctly', () => {
    const rawBody = JSON.stringify({ event_id: 'evt_001', event_type: 'subscription.created' })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const payload = `${timestamp}:${rawBody}`
    const expectedSig = crypto.createHmac('sha256', 'test_secret_32_chars_long_at_least!')
      .update(payload)
      .digest('hex')
    const header = `t=${timestamp};h1=${expectedSig}`

    expect(verifyPaddleSignature(rawBody, header)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const rawBody = JSON.stringify({ event_id: 'evt_001' })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const payload = `${timestamp}:${rawBody}`
    const expectedSig = crypto.createHmac('sha256', 'test_secret_32_chars_long_at_least!')
      .update(payload)
      .digest('hex')
    const header = `t=${timestamp};h1=${expectedSig}`

    const tamperedBody = JSON.stringify({ event_id: 'evt_tampered' })
    expect(verifyPaddleSignature(tamperedBody, header)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const rawBody = JSON.stringify({ event_id: 'evt_002' })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const payload = `${timestamp}:${rawBody}`
    const wrongSig = crypto.createHmac('sha256', 'different_secret_32_chars_long_at_least')
      .update(payload)
      .digest('hex')
    const header = `t=${timestamp};h1=${wrongSig}`

    expect(verifyPaddleSignature(rawBody, header)).toBe(false)
  })
})

describe('getPaddleSubscription', () => {
  it('throws without PADDLE_API_KEY', async () => {
    await expect(getPaddleSubscription('sub_001')).rejects.toThrow()
  })
})
