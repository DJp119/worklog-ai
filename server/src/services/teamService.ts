/**
 * server/src/services/teamService.ts
 *
 * Team & org CRUD — all mutations through service-role Supabase client.
 * Authorization enforced by callers (routes use requireOrgRole/requireTeamRole).
 * Called from: server/src/routes/organizations.ts, server/src/routes/teams.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export async function createOrg(
  db: SupabaseClient, name: string, slug: string, ownerId: string
) {
  const { data, error } = await db.rpc('provision_organization', {
    p_name: name,
    p_slug: slug,
    p_owner_id: ownerId,
  })
  if (error) { logger.with('err', error).error('createOrg failed'); throw error }
  return data as string
}

export async function listMyOrgs(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('org_members')
    .select('org_id, role, organizations(id, name, slug)')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

export async function getOrgMembers(db: SupabaseClient, orgId: string) {
  const { data, error } = await db
    .from('org_members')
    .select('id, user_id, role, users(id, email, name)')
    .eq('org_id', orgId)
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export async function createDepartment(
  db: SupabaseClient, orgId: string, name: string
) {
  const { data, error } = await db
    .from('departments')
    .insert({ org_id: orgId, name })
    .select()
    .single()
  if (error) { logger.with('err', error).error('createDepartment failed'); throw error }
  return data
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function createTeam(
  db: SupabaseClient, orgId: string, name: string,
  opts?: { parentTeamId?: string; departmentId?: string }
) {
  await db.from('organizations').select('id').eq('id', orgId).single()

  const { data, error } = await db
    .from('teams')
    .insert({
      org_id: orgId,
      name,
      parent_team_id: opts?.parentTeamId ?? null,
      department_id: opts?.departmentId ?? null,
    })
    .select()
    .single()
  if (error) { logger.with('err', error).error('createTeam failed'); throw error }
  return data
}

export async function moveTeam(
  db: SupabaseClient, teamId: string, newParentId: string | null
) {
  const { data: team } = await db.from('teams').select('org_id').eq('id', teamId).single()
  if (!team) throw new Error('Team not found')
  await db.from('organizations').select('id').eq('id', team.org_id).single()

  const { data, error } = await db
    .from('teams')
    .update({ parent_team_id: newParentId })
    .eq('id', teamId)
    .select()
    .single()
  if (error) { logger.with('err', error).error('moveTeam failed'); throw error }
  return data
}

export async function deleteTeam(
  db: SupabaseClient, teamId: string, reparentChildrenTo?: string
) {
  const { data: children } = await db
    .from('teams')
    .select('id')
    .eq('parent_team_id', teamId)

  if (children && children.length > 0) {
    if (!reparentChildrenTo) {
      throw new Error('Team has child teams. Provide reparentChildrenTo or reparent first.')
    }
    const { error: reparentErr } = await db
      .from('teams')
      .update({ parent_team_id: reparentChildrenTo })
      .in('id', children.map(c => c.id))
    if (reparentErr) throw reparentErr
  }

  const { error } = await db.from('teams').delete().eq('id', teamId)
  if (error) { logger.with('err', error).error('deleteTeam failed'); throw error }
}

// ---------------------------------------------------------------------------
// Team membership
// ---------------------------------------------------------------------------

export async function addMember(
  db: SupabaseClient, teamId: string, userId: string, role: string, orgId: string
) {
  const { data, error } = await db
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId, role, org_id: orgId })
    .select()
    .single()
  if (error) { logger.with('err', error).error('addMember failed'); throw error }
  return data
}

export async function updateMemberRole(
  db: SupabaseClient, teamId: string, userId: string, role: string
) {
  const { data, error } = await db
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeMember(db: SupabaseClient, teamId: string, userId: string) {
  const { error } = await db
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Closure rebuild (ops/repair)
// ---------------------------------------------------------------------------

export async function rebuildClosure(db: SupabaseClient, orgId: string) {
  const { data: teams } = await db.from('teams').select('id').eq('org_id', orgId)
  if (!teams?.length) return

  const teamIds = teams.map(t => t.id)
  await db.from('team_closure').delete().in('ancestor_id', teamIds)
  await db.from('team_closure').delete().in('descendant_id', teamIds)

  const selfRows = teamIds.map(id => ({ ancestor_id: id, descendant_id: id, depth: 0 }))
  await db.from('team_closure').insert(selfRows)

  const { data: allTeams } = await db
    .from('teams')
    .select('id, parent_team_id')
    .eq('org_id', orgId)

  let changed = true
  let maxIter = 20
  while (changed && maxIter-- > 0) {
    changed = false
    for (const team of allTeams ?? []) {
      if (!team.parent_team_id) continue
      const { data: parentAncestors } = await db
        .from('team_closure')
        .select('ancestor_id, depth')
        .eq('descendant_id', team.parent_team_id)
      const { data: teamDescendants } = await db
        .from('team_closure')
        .select('descendant_id, depth')
        .eq('ancestor_id', team.id)

      for (const pa of parentAncestors ?? []) {
        for (const td of teamDescendants ?? []) {
          const newDepth = pa.depth + td.depth + 1
          const { error } = await db
            .from('team_closure')
            .upsert({
              ancestor_id: pa.ancestor_id,
              descendant_id: td.descendant_id,
              depth: newDepth,
            }, { onConflict: 'ancestor_id,descendant_id' })
          if (!error) changed = true
        }
      }
    }
  }
  logger.info('Rebuilt closure for org {} ({} teams)', orgId, teamIds.length)
}
