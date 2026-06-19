import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tier } from '../services/subscriptionService.js'

type GetUserSyncFiltersFn = (db: SupabaseClient, userId: string, provider: 'github' | 'jira') => Promise<Record<string, any> | null>
type GetTeamSlackChannelsFn = (db: SupabaseClient, orgId: string, teamId: string) => Promise<string[]>

let getUserSyncFilters: GetUserSyncFiltersFn
let getTeamSlackChannels: GetTeamSlackChannelsFn

function chainableMock(result: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient
}

beforeAll(async () => {
  process.env.PADDLE_WEBHOOK_SECRET = 'test'
  const mod = await import('../services/subscriptionService.js')
  getUserSyncFilters = mod.getUserSyncFilters as unknown as GetUserSyncFiltersFn
  getTeamSlackChannels = mod.getTeamSlackChannels as unknown as GetTeamSlackChannelsFn
})

describe('getUserSyncFilters', () => {
  it('extracts repo_filter from github sync prefs', async () => {
    const db = chainableMock({
      data: {
        channel_config: { repo_filter: ['org/repo1', 'org/repo2'] },
      },
      error: null,
    })
    const result = await getUserSyncFilters(db, 'user-1', 'github')
    expect(result).toEqual({ repo_filter: ['org/repo1', 'org/repo2'] })
  })

  it('extracts project_keys from jira sync prefs', async () => {
    const db = chainableMock({
      data: {
        channel_config: { project_keys: ['PROJ1', 'PROJ2'] },
      },
      error: null,
    })
    const result = await getUserSyncFilters(db, 'user-1', 'jira')
    expect(result).toEqual({ project_keys: ['PROJ1', 'PROJ2'] })
  })

  it('returns null when no filter exists', async () => {
    const db = chainableMock({ data: null, error: null })
    const result = await getUserSyncFilters(db, 'user-1', 'github')
    expect(result).toBeNull()
  })
})

describe('getTeamSlackChannels', () => {
  it('returns channel_ids from team slack prefs', async () => {
    const db = chainableMock({
      data: {
        channel_config: { channel_ids: ['C01', 'C02'], notify_on: ['goal_assigned'] },
      },
      error: null,
    })
    const result = await getTeamSlackChannels(db, 'org-1', 'team-1')
    expect(result).toEqual(['C01', 'C02'])
  })

  it('returns empty array when no prefs exist', async () => {
    const db = chainableMock({ data: null, error: null })
    const result = await getTeamSlackChannels(db, 'org-1', 'team-1')
    expect(result).toEqual([])
  })

  it('returns empty array when channel_ids is missing', async () => {
    const db = chainableMock({
      data: {
        channel_config: { notify_on: ['goal_assigned'] },
      },
      error: null,
    })
    const result = await getTeamSlackChannels(db, 'org-1', 'team-1')
    expect(result).toEqual([])
  })
})
