import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireOrgRole } from '../services/authz.js'
import { logger } from '../lib/logger.js'

interface UpsertBody {
  provider: 'slack' | 'github' | 'jira'
  channelType: 'notification' | 'sync'
  channelConfig: Record<string, any>
  teamId?: string | null
}

interface TeamSlackBody {
  teamId: string
  channelConfig: { channel_ids: string[]; notify_on?: string[] }
}

export const channelPreferenceRoutes = Router()

channelPreferenceRoutes.get('/:orgId/mine', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('integration_channel_preferences')
      .select('*')
      .eq('org_id', req.params.orgId)
      .eq('user_id', req.userId!)
      .order('provider', { ascending: true })

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET channel preferences failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

channelPreferenceRoutes.put('/:orgId', requireAuth, requireOrgRole('member'), async (req: AuthRequest, res) => {
  try {
    const { provider, channelType, channelConfig, teamId } = req.body as UpsertBody
    if (!provider || !channelType || !channelConfig) {
      return res.status(400).json({ success: false, error: 'provider, channelType, and channelConfig required' })
    }

    if (teamId) {
      const { data: team } = await req.supabase!
        .from('teams')
        .select('org_id')
        .eq('id', teamId)
        .maybeSingle()
      if (!team || team.org_id !== req.params.orgId) {
        return res.status(403).json({ success: false, error: 'Team not found in this org' })
      }
    }

    const { data, error } = await req.supabase!
      .from('integration_channel_preferences')
      .upsert({
        org_id: req.params.orgId,
        user_id: teamId ? null : req.userId!,
        team_id: teamId ?? null,
        provider,
        channel_type: channelType,
        channel_config: channelConfig,
        set_by: req.userId!,
      }, { onConflict: 'org_id,COALESCE(user_id,\'00000000-0000-0000-0000-000000000000\'),COALESCE(team_id,\'00000000-0000-0000-0000-000000000000\'),provider,channel_type' })
      .select()
      .single()

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('PUT channel preference failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

channelPreferenceRoutes.delete('/:orgId/:prefId', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { error } = await req.supabase!
      .from('integration_channel_preferences')
      .delete()
      .eq('id', req.params.prefId)
      .eq('org_id', req.params.orgId)

    if (error) throw error
    return res.json({ success: true, data: null })
  } catch (err: any) {
    logger.with('err', err).error('DELETE channel preference failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

channelPreferenceRoutes.get('/:orgId/team-slack', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { data, error } = await req.supabase!
      .from('integration_channel_preferences')
      .select('*')
      .eq('org_id', req.params.orgId)
      .eq('provider', 'slack')
      .eq('channel_type', 'notification')
      .not('team_id', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('GET team Slack preferences failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})

channelPreferenceRoutes.post('/:orgId/team-slack', requireAuth, requireOrgRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { teamId, channelConfig } = req.body as TeamSlackBody
    if (!teamId || !channelConfig) {
      return res.status(400).json({ success: false, error: 'teamId and channelConfig required' })
    }

    const { data: team } = await req.supabase!
      .from('teams')
      .select('org_id')
      .eq('id', teamId)
      .maybeSingle()
    if (!team || team.org_id !== req.params.orgId) {
      return res.status(403).json({ success: false, error: 'Team not found in this org' })
    }

    const { data, error } = await req.supabase!
      .from('integration_channel_preferences')
      .upsert({
        org_id: req.params.orgId,
        team_id: teamId,
        provider: 'slack',
        channel_type: 'notification',
        channel_config: channelConfig,
        set_by: req.userId!,
      }, { onConflict: 'org_id,COALESCE(user_id,\'00000000-0000-0000-0000-000000000000\'),COALESCE(team_id,\'00000000-0000-0000-0000-000000000000\'),provider,channel_type' })
      .select()
      .single()

    if (error) throw error
    return res.json({ success: true, data })
  } catch (err: any) {
    logger.with('err', err).error('POST team Slack preference failed')
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' })
  }
})
