/**
 * server/src/lib/slackAdapter.ts
 *
 * Slack Web API helpers for the org-installed bot token.
 */

/* eslint-disable no-unused-vars -- interface method parameter names are part of
 * the public type contract; no-unused-vars (default config) doesn't understand
 * TypeScript interface members. tsc covers the actual type safety. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger.js'

const REQUEST_TIMEOUT_MS = 15_000

export interface SlackClient {
  botToken: string
  teamId: string
  call<T = any>(method: string, body?: Record<string, any>): Promise<T>
}

let _crypto: typeof import('./crypto.js') | null = null
async function getCrypto() {
  if (!_crypto) _crypto = await import('./crypto.js')
  return _crypto
}

export async function getSlackClient(orgId: string): Promise<SlackClient> {
  const db: SupabaseClient = (await import('./database.js')).supabase
  const { data, error } = await db
    .from('org_integrations')
    .select('bot_token_enc, external_install_id, is_active')
    .eq('org_id', orgId)
    .eq('provider', 'slack')
    .eq('is_active', true)
    .single()
  if (error || !data) throw new Error('Slack not installed for org')

  const { decryptSecret } = await getCrypto()
  const botToken = decryptSecret(data.bot_token_enc)

  return {
    botToken,
    teamId: data.external_install_id,
    async call<T = any>(method: string, body: Record<string, any> = {}): Promise<T> {
      const form = new URLSearchParams()
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
      const resp = await fetch(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`Slack ${method} HTTP ${resp.status}: ${txt}`)
      }
      const data: any = await resp.json()
      if (!data.ok) {
        if (data.error === 'invalid_auth' || data.error === 'token_revoked' || data.error === 'not_authed') {
          await db
            .from('org_integrations')
            .update({ is_active: false })
            .eq('org_id', orgId)
            .eq('provider', 'slack')
          logger.with('orgId', orgId).warn('Slack bot invalidated — disabled org integration')
        }
        throw new Error(`Slack ${method} error: ${data.error}`)
      }
      return data as T
    },
  }
}

export async function authTest(client: SlackClient): Promise<{ ok: boolean; team_id?: string; team?: string; user_id?: string; bot_id?: string }> {
  return client.call('auth.test')
}

export async function postMessage(client: SlackClient, channel: string, text: string, blocks?: any[]): Promise<any> {
  return client.call('chat.postMessage', { channel, text, blocks: blocks ? JSON.stringify(blocks) : undefined })
}

export async function openDm(client: SlackClient, userId: string): Promise<{ channel: { id: string } }> {
  return client.call('conversations.open', { users: userId })
}

export async function usersLookupByEmail(client: SlackClient, email: string): Promise<any> {
  return client.call('users.lookupByEmail', { email })
}

export async function usersInfo(client: SlackClient, userId: string): Promise<any> {
  return client.call('users.info', { user: userId })
}

export async function sendEphemeral(responseUrl: string, text: string): Promise<void> {
  const resp = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'ephemeral', text }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    throw new Error(`Slack response_url POST failed: ${resp.status} ${t}`)
  }
}
