import type {
  WorkLogEntry,
  CreateWorkLogRequest,
  GeneratedAppraisal,
  GenerateAppraisalRequest,
  ApiResponse,
} from 'shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Get auth token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  // Dynamic import to avoid circular dependency
  const { supabase } = await import('./supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Generic API request with auth
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

// ============================================
// Work Log Entries API
// ============================================

export async function getEntries(): Promise<WorkLogEntry[]> {
  const result = await apiRequest<WorkLogEntry[]>('/api/entries')
  return result.data || []
}

export async function getEntry(id: string): Promise<WorkLogEntry> {
  const result = await apiRequest<WorkLogEntry>(`/api/entries/${id}`)
  if (!result.data) {
    throw new Error('Entry not found')
  }
  return result.data
}

export async function createEntry(body: CreateWorkLogRequest): Promise<WorkLogEntry> {
  const result = await apiRequest<WorkLogEntry>('/api/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!result.data) {
    throw new Error('Failed to create entry')
  }
  return result.data
}

export async function updateEntry(
  id: string,
  body: Partial<CreateWorkLogRequest>
): Promise<WorkLogEntry> {
  const result = await apiRequest<WorkLogEntry>(`/api/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!result.data) {
    throw new Error('Failed to update entry')
  }
  return result.data
}

export async function deleteEntry(id: string): Promise<void> {
  await apiRequest<null>(`/api/entries/${id}`, {
    method: 'DELETE',
  })
}

// ============================================
// Appraisal API
// ============================================

export async function generateAppraisal(
  body: GenerateAppraisalRequest
): Promise<GeneratedAppraisal> {
  const result = await apiRequest<GeneratedAppraisal>('/api/appraisal/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!result.data) {
    throw new Error('Failed to generate appraisal')
  }
  return result.data
}

export async function getAppraisalHistory(): Promise<GeneratedAppraisal[]> {
  const result = await apiRequest<GeneratedAppraisal[]>('/api/appraisal/history')
  return result.data || []
}

export async function getAppraisal(id: string): Promise<GeneratedAppraisal> {
  const result = await apiRequest<GeneratedAppraisal>(`/api/appraisal/${id}`)
  if (!result.data) {
    throw new Error('Appraisal not found')
  }
  return result.data
}
