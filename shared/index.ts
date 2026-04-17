// User profile types
export interface UserProfile {
  id: string
  email: string
  company_name?: string
  job_title?: string
  created_at: string
  updated_at: string
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

// Appraisal criteria types
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

// Generated appraisal output
export interface GeneratedAppraisal {
  id: string
  user_id: string
  criteria_id: string
  period_start: string
  period_end: string
  generated_text: string
  word_count: number
  created_at: string
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

// API Request/Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface LoginRequest {
  email: string
}

export interface LoginResponse {
  message: string
  provider: 'supabase'
}

export interface CreateWorkLogRequest {
  week_start_date: string
  accomplishments: string
  challenges: string
  learnings: string
  goals_next_week: string
  hours_logged?: number
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

// Error types
export interface ApiError {
  message: string
  code: string
  details?: Record<string, string[]>
}
