/**
 * client/src/lib/integrationsApi.ts
 *
 * Integration connect / status / OAuth callback helpers for JIRA, GitHub, Slack.
 * Mounted at /api/integrations.
 */

import { apiRequest } from './api'
import type {
  UserIntegration,
  OrgIntegration,
  JiraSite,
  JiraConnectStartResponse,
  JiraOAuthConfirmRequest,
  SlackLinkPinRequest,
  SlackLinkPinStartResponse,
  IntegrationProvider,
  OrgIntegrationProvider,
} from 'shared'

// ---------------------------------------------------------------------------
// User-level integrations
// ---------------------------------------------------------------------------

export async function listUserIntegrations(): Promise<UserIntegration[]> {
  return apiRequest<UserIntegration[]>('/api/integrations/user')
}

export async function disconnectUserIntegration(
  provider: IntegrationProvider,
): Promise<void> {
  await apiRequest(`/api/integrations/user/${provider}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// JIRA user-level OAuth
// ---------------------------------------------------------------------------

export async function startJiraConnect(orgId?: string): Promise<JiraConnectStartResponse> {
  return apiRequest<JiraConnectStartResponse>('/api/integrations/jira/connect', {
    method: 'POST',
    body: JSON.stringify({ provider: 'jira', orgId }),
  })
}

export async function confirmJiraOAuth(
  body: JiraOAuthConfirmRequest,
): Promise<{ provider: 'jira'; requiresSiteSelection?: boolean; key?: string }> {
  return apiRequest('/api/integrations/jira/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getJiraSites(key: string): Promise<{ sites: JiraSite[] }> {
  return apiRequest<{ sites: JiraSite[] }>(
    `/api/integrations/jira/sites?key=${encodeURIComponent(key)}`,
  )
}

export async function selectJiraSite(
  key: string,
  cloudId: string,
): Promise<{ provider: 'jira' }> {
  return apiRequest('/api/integrations/jira/select-site', {
    method: 'POST',
    body: JSON.stringify({ key, cloudId }),
  })
}

// ---------------------------------------------------------------------------
// GitHub user-level OAuth
// ---------------------------------------------------------------------------

export async function startGithubConnect(): Promise<{ authUrl: string }> {
  return apiRequest<{ authUrl: string }>('/api/integrations/github/connect', {
    method: 'POST',
    body: JSON.stringify({ provider: 'github' }),
  })
}

// ---------------------------------------------------------------------------
// Org-level integrations
// ---------------------------------------------------------------------------

export async function listOrgIntegrations(
  orgId: string,
): Promise<OrgIntegration[]> {
  return apiRequest<OrgIntegration[]>(`/api/integrations/org/${orgId}`)
}

export async function disconnectOrgIntegration(
  orgId: string,
  provider: OrgIntegrationProvider,
): Promise<void> {
  await apiRequest(`/api/integrations/org/${orgId}/${provider}`, {
    method: 'DELETE',
  })
}

// Org-level JIRA
export async function startOrgJiraConnect(
  orgId: string,
): Promise<{ authUrl: string; webhookUrl: string }> {
  return apiRequest('/api/integrations/jira/org-connect', {
    method: 'POST',
    body: JSON.stringify({ orgId }),
  })
}

export async function confirmOrgJiraOAuth(
  orgId: string,
  code: string,
  state: string,
): Promise<{ provider: 'jira'; webhookUrl: string; webhookSecret: string }> {
  return apiRequest('/api/integrations/jira/org-confirm', {
    method: 'POST',
    body: JSON.stringify({ orgId, code, state }),
  })
}

// Org-level Slack
export async function startOrgSlackConnect(
  orgId: string,
): Promise<{ authUrl: string }> {
  return apiRequest('/api/integrations/slack/org-connect', {
    method: 'POST',
    body: JSON.stringify({ orgId }),
  })
}

export async function confirmOrgSlackOAuth(
  code: string,
  state: string,
): Promise<{ provider: 'slack' }> {
  return apiRequest('/api/integrations/slack/org-callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })
}

// Org-level GitHub App
export async function startGithubAppConnect(
  orgId: string,
): Promise<{ authUrl: string }> {
  return apiRequest('/api/integrations/github/app-connect', {
    method: 'POST',
    body: JSON.stringify({ orgId }),
  })
}

// Per-user GitHub OAuth — POST confirm exchanges the code via the server
export async function confirmGithubOAuth(
  code: string,
  state: string,
): Promise<{ provider: 'github' }> {
  return apiRequest('/api/integrations/github/confirm', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })
}

// ---------------------------------------------------------------------------
// Slack account linking (Bug AQ — PIN code, not GET CSRF)
// ---------------------------------------------------------------------------

export async function requestSlackLinkPin(
  slackTeamId: string,
  slackUserId: string,
  email: string,
): Promise<SlackLinkPinStartResponse> {
  return apiRequest<SlackLinkPinStartResponse>('/api/integrations/slack/link/start', {
    method: 'POST',
    body: JSON.stringify({ slackTeamId, slackUserId, email }),
  })
}

export async function confirmSlackLinkPin(
  body: SlackLinkPinRequest,
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/api/integrations/slack/link/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
