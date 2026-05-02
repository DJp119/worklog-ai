// API Response types
export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

// Work log entry types
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

export interface UpdateWorkLogRequest extends Partial<CreateWorkLogRequest> {}

// Appraisal types
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

export interface AppraisalCriteria {
    id: string
    user_id: string
    period_start: string
    period_end: string
    criteria_text: string
    company_goals?: string
    values?: string
    created_at: string
}

export interface GenerateAppraisalRequest {
    period_start: string
    period_end: string
    criteria_text: string
    company_goals?: string
    values?: string
}

export interface GenerateAppraisalResponse {
    appraisal_id: string
    generated_text: string
    word_count: number
}

// User profile types
export interface UserProfile {
    id: string
    email: string
    name?: string
    company_name?: string
    job_title?: string
    reminder_day: number
    reminder_time: string
    reminder_enabled: boolean
    email_verified: boolean
    created_at: string
    updated_at: string
}

export interface UpdateProfileRequest {
    name?: string
    company_name?: string
    job_title?: string
    reminder_day?: number
    reminder_time?: string
    reminder_enabled?: boolean
}

// Auth types
export interface LoginRequest {
    email: string
    password: string
    rememberMe?: boolean
}

export interface SignupRequest {
    email: string
    password: string
    name?: string
    company_name?: string
    job_title?: string
}

export interface AuthTokenResponse {
    user: {
        id: string
        email: string
        name?: string
        companyName?: string
        jobTitle?: string
    }
    accessToken: string
    refreshToken: string
    expiresIn: number
}

export interface PasswordChangeRequest {
    currentPassword: string
    newPassword: string
}

export interface ForgotPasswordRequest {
    email: string
}

export interface ResetPasswordRequest {
    userId: string
    token: string
    newPassword: string
}

export interface VerifyEmailRequest {
    userId: string
    token: string
}

// Reminder log types
export interface ReminderLog {
    id: string
    user_id: string
    sent_at: string
    email_address: string
    status: 'sent' | 'failed' | 'bounced'
    error_message?: string
}

// Error types
export interface ApiError {
    message: string
    code: string
    details?: Record<string, string[]>
}
