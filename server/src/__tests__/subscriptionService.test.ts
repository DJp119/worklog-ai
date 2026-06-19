process.env.PADDLE_WEBHOOK_SECRET = 'test_secret_32_chars_long_at_least!'
process.env.NODE_ENV = 'test'

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveTierFromPriceId, mapPaddleStatus, clearTierCache } from '../services/subscriptionService.js'

describe('resolveTierFromPriceId', () => {
  beforeEach(() => {
    process.env.PADDLE_PRO_PRICE_ID = 'pri_pro_123'
    process.env.PADDLE_ENTERPRISE_PRICE_ID = 'pri_enterprise_456'
    clearTierCache('test-org')
  })

  it('returns free for null price id', () => {
    expect(resolveTierFromPriceId(null)).toBe('free')
  })

  it('returns free for undefined price id', () => {
    expect(resolveTierFromPriceId(undefined)).toBe('free')
  })

  it('returns pro for the pro price id', () => {
    expect(resolveTierFromPriceId('pri_pro_123')).toBe('pro')
  })

  it('returns enterprise for the enterprise price id', () => {
    expect(resolveTierFromPriceId('pri_enterprise_456')).toBe('enterprise')
  })

  it('returns free for an unknown price id', () => {
    expect(resolveTierFromPriceId('pri_unknown')).toBe('free')
  })
})

describe('mapPaddleStatus', () => {
  it('maps active', () => expect(mapPaddleStatus('active')).toBe('active'))
  it('maps trialing', () => expect(mapPaddleStatus('trialing')).toBe('trialing'))
  it('maps past_due', () => expect(mapPaddleStatus('past_due')).toBe('past_due'))
  it('maps paused', () => expect(mapPaddleStatus('paused')).toBe('paused'))
  it('maps canceled', () => expect(mapPaddleStatus('canceled')).toBe('canceled'))
  it('maps unpaid', () => expect(mapPaddleStatus('unpaid')).toBe('unpaid'))

  it('defaults to canceled for unknown status', () => {
    expect(mapPaddleStatus('unknown_status')).toBe('canceled')
  })

  it('defaults to canceled for null', () => {
    expect(mapPaddleStatus(null)).toBe('canceled')
  })
})
