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

// Monthly Summary types
export interface MonthlySummary {
    id: string
    user_id: string
    month_year: string
    summary_text: string
    entry_count: number
    word_count: number
    source_entry_ids: string[]
    generated_at: string
}

// Chat types
export interface ChatSession {
    id: string
    user_id: string
    title: string
    period_start: string
    period_end: string
    created_at: string
    updated_at: string
}

export interface ChatMessage {
    id: string
    session_id: string
    user_id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
}

export interface CreateChatSessionRequest {
    period_start: string
    period_end: string
}

export interface SendChatMessageRequest {
    content: string
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
    preferred_language?: string | null
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
    preferred_language?: string | null
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

// AI Pulse types
export interface AIArticle {
    id: string
    title: string
    slug: string
    summary: string
    content: string
    source_url?: string
    source_name?: string
    category: 'news' | 'models' | 'startups' | 'research' | 'tools' | 'open_source' | 'funding' | 'india_ai' | 'world_ai'
    published_at: string
    impact_summary?: string
    cta_text?: string
    cta_link?: string
    thumbnail_url?: string
    views_count: number
    bookmark_count: number
    share_count: number
    created_at: string
    updated_at: string
}

export interface AIImpactCard {
    id: string
    slug: string
    industry: 'jobs' | 'healthcare' | 'education' | 'finance' | 'marketing' | 'engineering' | 'design' | 'hr' | 'agriculture' | 'manufacturing'
    industry_display_name: string
    what_changed: string
    impact_level: 'high' | 'medium' | 'low'
    companies_involved: string[]
    future_prediction: string
    opportunities: string[]
    risks: string[]
    tools: string[]
    created_at: string
    updated_at: string
}

export interface BookmarkRequest {
    article_id?: string
    impact_card_id?: string
}

export interface Bookmark {
    id: string
    user_id: string
    article_id?: string
    impact_card_id?: string
    created_at: string
}

// =============================================================================
// Corporate Teams: Orgs, Departments, Teams, Members
// =============================================================================

export type OrgRole = 'member' | 'admin' | 'owner'
export type TeamRole = 'member' | 'manager' | 'admin' | 'owner'

export interface Organization {
    id: string
    name: string
    slug: string
    created_at: string
    updated_at: string
}

export interface OrgMember {
    id: string
    org_id: string
    user_id: string
    role: OrgRole
    created_at: string
    updated_at: string
    user?: { id: string; email: string; name?: string | null }
}

export interface Department {
    id: string
    org_id: string
    name: string
    created_at: string
    updated_at: string
}

export interface Team {
    id: string
    org_id: string
    department_id?: string | null
    parent_team_id?: string | null
    name: string
    created_at: string
    updated_at: string
}

export interface TeamMember {
    id: string
    team_id: string
    user_id: string
    role: TeamRole
    org_id: string
    created_at: string
    updated_at: string
    user?: { id: string; email: string; name?: string | null }
}

export interface CreateOrgRequest {
    name: string
    slug: string
}

export interface CreateTeamRequest {
    name: string
    parentTeamId?: string | null
    departmentId?: string | null
}

export interface CreateDepartmentRequest {
    name: string
}

// =============================================================================
// Goals
// =============================================================================

export type GoalScope = 'organization' | 'department' | 'team' | 'individual'
export type GoalStatus = 'draft' | 'active' | 'at_risk' | 'completed' | 'cancelled'
export type GoalPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom'
export type ProgressMode = 'manual' | 'key_results' | 'linked_items'
export type MetricType = 'number' | 'percentage' | 'currency' | 'boolean' | 'ratio'

export interface Goal {
    id: string
    org_id: string
    scope: GoalScope
    team_id?: string | null
    department_id?: string | null
    parent_goal_id?: string | null
    title: string
    description?: string | null
    status: GoalStatus
    period: GoalPeriod
    start_date: string
    due_date: string
    progress: number
    progress_mode: ProgressMode
    rollup_weight: number
    created_by?: string | null
    created_at: string
    updated_at: string
}

export interface GoalKeyResult {
    id: string
    goal_id: string
    title: string
    metric_type: MetricType
    start_value: number
    target_value: number
    current_value: number
    unit?: string | null
    weight: number
    sort_order?: number | null
    created_at: string
    updated_at: string
}

export type GoalLinkProvider = 'jira' | 'github'

export interface GoalLink {
    id: string
    goal_id: string
    provider: GoalLinkProvider
    link_type: string
    external_id: string
    external_key: string
    external_url: string
    title: string
    state?: string | null
    is_done: boolean
    weight: number
    created_by?: string | null
    org_id: string
    metadata?: Record<string, any> | null
    created_at: string
    updated_at: string
}

export interface GoalAssignee {
    goal_id: string
    user_id: string
    assigned_by?: string | null
    assigned_at: string
    org_id: string
    user?: { id: string; email: string; name?: string | null }
}

export interface GoalUpdate {
    id: string
    goal_id: string
    user_id?: string | null
    progress: number
    status: string
    note?: string | null
    created_at: string
    org_id: string
}

export interface GoalWithDetails extends Goal {
    key_results: GoalKeyResult[]
    links: GoalLink[]
    assignees: GoalAssignee[]
    updates: GoalUpdate[]
}

export interface CreateGoalRequest {
    orgId: string
    scope: GoalScope
    title: string
    period: GoalPeriod
    startDate: string
    dueDate: string
    teamId?: string | null
    departmentId?: string | null
    parentGoalId?: string | null
    description?: string | null
    progressMode?: ProgressMode
}

export interface UpdateGoalRequest {
    title?: string
    description?: string | null
    status?: GoalStatus
    period?: GoalPeriod
    startDate?: string
    dueDate?: string
    progress?: number
    progressMode?: ProgressMode
    rollupWeight?: number
    teamId?: string | null
    departmentId?: string | null
    parentGoalId?: string | null
}

export interface CreateKeyResultRequest {
    title: string
    metricType: MetricType
    targetValue: number
    startValue?: number
    unit?: string | null
    weight?: number
    sortOrder?: number | null
}

export interface CreateCheckInRequest {
    progress?: number
    status?: GoalStatus
    note?: string
}

export interface AssignGoalRequest {
    userId: string
}

export interface LinkWorkItemRequest {
    url: string
    label?: string
    weight?: number
}

// =============================================================================
// Integrations
// =============================================================================

export type IntegrationProvider = 'jira' | 'github' | 'slack' | 'github_app' | 'gitlab'

export interface UserIntegration {
    id: string
    user_id: string
    provider: IntegrationProvider
    created_at: string
    token_expires_at?: string | null
    is_active?: boolean
    scopes?: string[]
    config?: Record<string, any>
}

export type OrgIntegrationProvider = 'slack' | 'github_app' | 'jira'

export interface OrgIntegration {
    id: string
    org_id: string
    provider: OrgIntegrationProvider
    external_install_id: string
    is_active: boolean
    installed_by?: string | null
    created_at: string
    updated_at: string
    config?: Record<string, any> | null
}

export interface JiraSite {
    id: string
    name: string
    url: string
    avatarUrl?: string
    scopes: string[]
}

export interface JiraConnectStartResponse {
    authUrl: string
}

export interface JiraOAuthConfirmRequest {
    code: string
    state: string
    cloudId?: string
}

export interface SlackLinkPinRequest {
    code: string
}

export interface SlackLinkPinStartResponse {
    expiresAt: string
}

// =============================================================================
// Subscriptions & Billing (Paddle)
// =============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'unpaid'

export interface Subscription {
    id: string
    org_id: string
    tier: SubscriptionTier
    status: SubscriptionStatus
    paddle_customer_id?: string | null
    paddle_subscription_id?: string | null
    paddle_price_id?: string | null
    current_period_start?: string | null
    current_period_end?: string | null
    cancel_at_period_end: boolean
    max_members?: number | null
    ai_reports_enabled: boolean
    created_at: string
    updated_at: string
}

// =============================================================================
// Integration Channel Preferences
// =============================================================================

export type ChannelProvider = 'slack' | 'github' | 'jira'
export type ChannelType = 'notification' | 'sync'

export interface ChannelPreference {
    id: string
    org_id: string
    user_id?: string | null
    team_id?: string | null
    provider: ChannelProvider
    channel_type: ChannelType
    channel_config: Record<string, any>
    is_active: boolean
    set_by?: string | null
    created_at: string
    updated_at: string
}

// =============================================================================
// AI Performance Reports
// =============================================================================

export type ReportType = 'self' | 'individual' | 'team' | 'organization'
export type ReportStatus = 'generating' | 'completed' | 'failed' | 'expired'

export interface PerformanceReport {
    id: string
    org_id: string
    report_type: ReportType
    target_user_id?: string | null
    target_team_id?: string | null
    period_start: string
    period_end: string
    generated_by: string
    report_content: Record<string, any>
    report_markdown?: string | null
    ai_model?: string | null
    token_usage?: number | null
    generation_time_ms?: number | null
    status: ReportStatus
    error_message?: string | null
    created_at: string
    updated_at: string
}

export interface GenerateReportRequest {
    reportType: ReportType
    targetUserId?: string
    targetTeamId?: string
    periodStart: string
    periodEnd: string
}
