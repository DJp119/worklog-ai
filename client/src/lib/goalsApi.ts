/**
 * client/src/lib/goalsApi.ts
 *
 * Goal CRUD, key results, assignees, check-ins, links, reparent.
 * Mounted at /api/goals.
 */

import { apiRequest } from './api'
import type {
  CreateGoalRequest,
  UpdateGoalRequest,
  Goal,
  GoalWithDetails,
  GoalKeyResult,
  GoalAssignee,
  GoalUpdate,
  GoalLink,
  CreateKeyResultRequest,
  CreateCheckInRequest,
  LinkWorkItemRequest,
  GoalScope,
  GoalStatus,
  ProgressMode,
  GoalPeriod,
  MetricType,
} from 'shared'

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export async function createGoal(body: CreateGoalRequest): Promise<Goal> {
  return apiRequest<Goal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getGoal(goalId: string): Promise<GoalWithDetails> {
  return apiRequest<GoalWithDetails>(`/api/goals/${goalId}`)
}

export async function updateGoal(
  goalId: string,
  body: UpdateGoalRequest,
): Promise<Goal> {
  return apiRequest<Goal>(`/api/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteGoal(goalId: string): Promise<void> {
  await apiRequest(`/api/goals/${goalId}`, { method: 'DELETE' })
}

export async function setParent(
  goalId: string,
  parentGoalId: string | null,
): Promise<Goal> {
  return apiRequest<Goal>(`/api/goals/${goalId}/parent`, {
    method: 'PUT',
    body: JSON.stringify({ parentGoalId }),
  })
}

// ---------------------------------------------------------------------------
// Key Results
// ---------------------------------------------------------------------------

export async function addKeyResult(
  goalId: string,
  body: CreateKeyResultRequest,
): Promise<GoalKeyResult> {
  return apiRequest<GoalKeyResult>(`/api/goals/${goalId}/key-results`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateKeyResult(
  goalId: string,
  krId: string,
  body: Partial<CreateKeyResultRequest>,
): Promise<GoalKeyResult> {
  return apiRequest<GoalKeyResult>(
    `/api/goals/${goalId}/key-results/${krId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

export async function addAssignee(
  goalId: string,
  userId: string,
): Promise<GoalAssignee> {
  return apiRequest<GoalAssignee>(`/api/goals/${goalId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export async function removeAssignee(
  goalId: string,
  userId: string,
): Promise<void> {
  await apiRequest(`/api/goals/${goalId}/assignees/${userId}`, {
    method: 'DELETE',
  })
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function createCheckIn(
  goalId: string,
  body: CreateCheckInRequest,
): Promise<GoalUpdate> {
  return apiRequest<GoalUpdate>(`/api/goals/${goalId}/checkins`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Links (JIRA / GitHub work items)
// ---------------------------------------------------------------------------

export async function addLink(
  goalId: string,
  body: LinkWorkItemRequest,
): Promise<GoalLink> {
  return apiRequest<GoalLink>(`/api/goals/${goalId}/links`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removeLink(
  goalId: string,
  linkId: string,
): Promise<void> {
  await apiRequest(`/api/goals/${goalId}/links/${linkId}`, {
    method: 'DELETE',
  })
}

// ---------------------------------------------------------------------------
// Enum helpers (for dropdowns)
// ---------------------------------------------------------------------------

export const GOAL_SCOPES: GoalScope[] = [
  'organization',
  'department',
  'team',
  'individual',
]

export const GOAL_STATUSES: GoalStatus[] = [
  'draft',
  'active',
  'at_risk',
  'completed',
  'cancelled',
]

export const GOAL_PERIODS: GoalPeriod[] = [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'custom',
]

export const PROGRESS_MODES: ProgressMode[] = [
  'manual',
  'key_results',
  'linked_items',
]

export const METRIC_TYPES: MetricType[] = [
  'number',
  'percentage',
  'currency',
  'boolean',
  'ratio',
]
