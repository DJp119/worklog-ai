const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Get auth tokens from localStorage
 */
function getTokens() {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    return { accessToken, refreshToken }
}

async function refreshAccessToken(): Promise<boolean> {
    const { refreshToken } = getTokens()
    if (!refreshToken) return false

    try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        })

        if (!response.ok) return false

        const data = await response.json()
        localStorage.setItem('accessToken', data.data.accessToken)
        localStorage.setItem('refreshToken', data.data.refreshToken)

        return true
    } catch (error) {
        console.error('Token refresh failed:', error)
        return false
    }
}

/**
 * Generic API request with auth
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const { accessToken } = getTokens()

    const headers = new Headers(options.headers)
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
    }

    async function sendRequest(): Promise<Response> {
        return fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        })
    }

    let response = await sendRequest()

    if (response.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
            const newToken = localStorage.getItem('accessToken')
            if (newToken) {
                headers.set('Authorization', `Bearer ${newToken}`)
                response = await sendRequest()
            }
        }
    }

    const data = await response.json()

    if (!response.ok) {
        if (response.status === 401) {
            // Clear auth and redirect
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            window.location.href = '/login'
        }
        throw new Error(data.error || 'Request failed')
    }

    return data
}

// ============================================
// Work Log Entries API
// ============================================

export interface WorkLogEntry {
    id: string
    user_id: string
    week_start_date: string
    accomplishments: string
    challenges: string
    learnings: string
    goals_next_week: string
    hours_logged?: number
    created_at: string
    updated_at: string
}

export interface CreateWorkLogRequest {
    week_start_date: string
    accomplishments: string
    challenges: string
    learnings: string
    goals_next_week: string
    hours_logged?: number
}

export async function getEntries(): Promise<WorkLogEntry[]> {
    return apiRequest<WorkLogEntry[]>('/api/entries')
}

export async function getEntry(id: string): Promise<WorkLogEntry> {
    return apiRequest<WorkLogEntry>(`/api/entries/${id}`)
}

export async function createEntry(body: CreateWorkLogRequest): Promise<WorkLogEntry> {
    return apiRequest<WorkLogEntry>('/api/entries', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

export async function updateEntry(
    id: string,
    body: Partial<CreateWorkLogRequest>
): Promise<WorkLogEntry> {
    return apiRequest<WorkLogEntry>(`/api/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    })
}

export async function deleteEntry(id: string): Promise<void> {
    await apiRequest(`/api/entries/${id}`, {
        method: 'DELETE',
    })
}

// ============================================
// Appraisal API
// ============================================

export interface GeneratedAppraisal {
    id: string
    user_id: string
    criteria_id?: string
    period_start: string
    period_end: string
    generated_text: string
    word_count: number
    created_at: string
}

export interface GenerateAppraisalRequest {
    period_start: string
    period_end: string
    criteria_text: string
    company_goals?: string
    values?: string
}

export async function generateAppraisal(
    body: GenerateAppraisalRequest
): Promise<GeneratedAppraisal> {
    return apiRequest<GeneratedAppraisal>('/api/appraisal/generate', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

export async function getAppraisalHistory(): Promise<GeneratedAppraisal[]> {
    return apiRequest<GeneratedAppraisal[]>('/api/appraisal/history')
}

export async function getAppraisal(id: string): Promise<GeneratedAppraisal> {
    return apiRequest<GeneratedAppraisal>(`/api/appraisal/${id}`)
}

// ============================================
// User Profile API
// ============================================

export interface UserProfile {
    id: string
    email: string
    name?: string
    companyName?: string
    jobTitle?: string
    reminderDay: number
    reminderTime: string
    reminderEnabled: boolean
    emailVerified: boolean
    createdAt: string
}

export async function getProfile(): Promise<UserProfile> {
    return apiRequest<UserProfile>('/api/users/profile')
}

export async function updateProfile(
    body: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>
): Promise<UserProfile> {
    return apiRequest<UserProfile>('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
    })
}
