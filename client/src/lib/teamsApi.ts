/**
 * client/src/lib/teamsApi.ts
 *
 * Thin API module for organizations, departments, teams, and memberships.
 * Mounted at /api/orgs and /api/teams.
 */

import { apiRequest } from './api'
import type {
  Organization,
  OrgMember,
  Department,
  Team,
  TeamMember,
  CreateOrgRequest,
  CreateTeamRequest,
  CreateDepartmentRequest,
  TeamRole,
  Goal,
  GoalWithDetails,
  GoalScope,
  GoalStatus,
} from 'shared'

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export async function createOrg(body: CreateOrgRequest): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/api/orgs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface MyOrgRow {
  org_id: string
  role: 'member' | 'admin' | 'owner'
  organizations: Pick<Organization, 'id' | 'name' | 'slug'>
}

export async function listMyOrgs(): Promise<MyOrgRow[]> {
  return apiRequest<MyOrgRow[]>('/api/orgs')
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  return apiRequest<OrgMember[]>(`/api/orgs/${orgId}/members`)
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function createDepartment(
  orgId: string,
  body: CreateDepartmentRequest,
): Promise<Department> {
  return apiRequest<Department>(`/api/orgs/${orgId}/departments`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function createTeam(
  orgId: string,
  body: CreateTeamRequest,
): Promise<Team> {
  return apiRequest<Team>(`/api/orgs/${orgId}/teams`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reparentTeam(
  teamId: string,
  newParentId: string | null,
): Promise<Team> {
  return apiRequest<Team>(`/api/teams/${teamId}/reparent`, {
    method: 'PUT',
    body: JSON.stringify({ newParentId }),
  })
}

export async function deleteTeam(
  teamId: string,
  reparentChildrenTo?: string,
): Promise<void> {
  await apiRequest(`/api/teams/${teamId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reparentChildrenTo }),
  })
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<TeamMember> {
  // The server requires orgId in the body for tenant-isolation validation.
  return apiRequest<TeamMember>(`/api/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  })
}

export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/api/teams/${teamId}/members/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await apiRequest(`/api/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function rebuildClosure(orgId: string): Promise<void> {
  await apiRequest(`/api/orgs/${orgId}/rebuild-closure`, {
    method: 'POST',
  })
}

// ---------------------------------------------------------------------------
// Org-scoped goal listing (Issue T visibility fix)
// ---------------------------------------------------------------------------

export interface ListOrgGoalsParams {
  teamId?: string
  scope?: GoalScope
  status?: GoalStatus
}

export async function listOrgGoals(
  orgId: string,
  params?: ListOrgGoalsParams,
): Promise<Goal[]> {
  const search = new URLSearchParams()
  if (params?.teamId) search.set('teamId', params.teamId)
  if (params?.scope) search.set('scope', params.scope)
  if (params?.status) search.set('status', params.status)
  const qs = search.toString()
  return apiRequest<Goal[]>(`/api/orgs/${orgId}/goals${qs ? `?${qs}` : ''}`)
}

export async function getOrgGoals(goalId: string): Promise<GoalWithDetails> {
  return apiRequest<GoalWithDetails>(`/api/goals/${goalId}`)
}
