export interface SlackOAuthTokenResponse {
  access_token?: unknown
  token_type?: unknown
  bot_token?: unknown
}

/**
 * Slack OAuth v2 returns the bot credential as `access_token` with
 * `token_type: "bot"`. `bot_token` is kept as a compatibility fallback for
 * older response shapes.
 */
export function getSlackBotToken(response: SlackOAuthTokenResponse): string | null {
  if (
    response.token_type === 'bot' &&
    typeof response.access_token === 'string' &&
    response.access_token.length > 0
  ) {
    return response.access_token
  }

  return typeof response.bot_token === 'string' && response.bot_token.length > 0
    ? response.bot_token
    : null
}
