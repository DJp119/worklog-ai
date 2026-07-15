import { describe, expect, it } from 'vitest'
import { getSlackBotToken } from '../lib/slackOAuth.js'

describe('getSlackBotToken', () => {
  it('uses the OAuth v2 access_token for bot installs', () => {
    expect(getSlackBotToken({
      access_token: 'xoxb-v2-token',
      token_type: 'bot',
    })).toBe('xoxb-v2-token')
  })

  it('does not treat a user token as the bot token', () => {
    expect(getSlackBotToken({
      access_token: 'xoxp-user-token',
      token_type: 'user',
    })).toBeNull()
  })

  it('supports the legacy bot_token field when present', () => {
    expect(getSlackBotToken({ bot_token: 'xoxb-legacy-token' })).toBe('xoxb-legacy-token')
  })
})
