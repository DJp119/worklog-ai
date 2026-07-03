import { describe, it, expect, vi } from 'vitest'
import { parseLinkUrl } from '../services/goalService.js'
import { supabase } from '../lib/database.js'

describe('goalService: parseLinkUrl', () => {
  it('parses github PR url correctly', async () => {
    const parsed = await parseLinkUrl('https://github.com/owner/repo/pull/42')
    expect(parsed.provider).toBe('github')
    expect(parsed.linkType).toBe('pr')
    expect(parsed.externalId).toBe('owner/repo#42')
    expect(parsed.externalKey).toBe('owner/repo#42')
    expect(parsed.externalUrl).toBe('https://github.com/owner/repo/pull/42')
    expect(parsed.isDone).toBe(false)
  })

  it('parses github issue url correctly', async () => {
    const parsed = await parseLinkUrl('https://github.com/owner/repo/issues/100')
    expect(parsed.provider).toBe('github')
    expect(parsed.linkType).toBe('issue')
    expect(parsed.externalId).toBe('owner/repo#100')
    expect(parsed.externalKey).toBe('owner/repo#100')
    expect(parsed.externalUrl).toBe('https://github.com/owner/repo/issues/100')
    expect(parsed.isDone).toBe(false)
  })

  it('parses jira url with domain correctly', async () => {
    const parsed = await parseLinkUrl('https://mycompany.atlassian.net/browse/PROJ-123')
    expect(parsed.provider).toBe('jira')
    expect(parsed.linkType).toBe('issue')
    expect(parsed.externalId).toBe('PROJ-123')
    expect(parsed.externalKey).toBe('PROJ-123')
    expect(parsed.externalUrl).toBe('https://mycompany.atlassian.net/browse/PROJ-123')
    expect(parsed.isDone).toBe(false)
  })

  it('handles JIRA bare key without orgId by returning empty externalUrl', async () => {
    const parsed = await parseLinkUrl('PROJ-123')
    expect(parsed.provider).toBe('jira')
    expect(parsed.linkType).toBe('issue')
    expect(parsed.externalId).toBe('PROJ-123')
    expect(parsed.externalKey).toBe('PROJ-123')
    expect(parsed.externalUrl).toBe('') // empty string because no orgId was provided to resolve it
  })

  it('resolves bare JIRA key with orgId when JIRA site is connected', async () => {
    // Mock supabase.from().select().eq().eq().maybeSingle()
    const mockSingleResult = {
      data: {
        config: {
          sites: [
            { domain: 'impactlyai.atlassian.net' }
          ]
        }
      },
      error: null
    }

    const selectMock = {
      eq: vi.fn().mockImplementation(() => selectMock),
      maybeSingle: vi.fn().mockResolvedValue(mockSingleResult)
    }

    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'org_integrations') {
        return {
          select: vi.fn().mockReturnValue(selectMock)
        } as any
      }
      return null as any
    }) as any)

    const parsed = await parseLinkUrl('PROJ-123', 'org-123')
    expect(parsed.provider).toBe('jira')
    expect(parsed.linkType).toBe('issue')
    expect(parsed.externalId).toBe('PROJ-123')
    expect(parsed.externalKey).toBe('PROJ-123')
    expect(parsed.externalUrl).toBe('https://impactlyai.atlassian.net/browse/PROJ-123')

    fromSpy.mockRestore()
  })

  it('returns empty URL for bare JIRA key if JIRA integration is not configured', async () => {
    const selectMock = {
      eq: vi.fn().mockImplementation(() => selectMock),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }

    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'org_integrations') {
        return {
          select: vi.fn().mockReturnValue(selectMock)
        } as any
      }
      return null as any
    }) as any)

    const parsed = await parseLinkUrl('PROJ-123', 'org-123')
    expect(parsed.externalUrl).toBe('')

    fromSpy.mockRestore()
  })

  it('throws on unrecognized url', async () => {
    await expect(parseLinkUrl('https://google.com')).rejects.toThrow('Unrecognized work item URL or key')
  })
})
