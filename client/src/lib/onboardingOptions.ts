// Onboarding / personalization field options.
// Ordering matches the product spec ("Impactly thoughts 1106"). Values are the
// canonical strings persisted to the database and sent to the AI; labels are
// shown in the UI (kept identical here since the options are proper nouns /
// ranges that read the same in English).

export const INDUSTRY_OPTIONS = [
  'Technology / Software',
  'Banking & Financial Services',
  'Insurance',
  'Consulting',
  'E-commerce / Retail',
  'Healthcare',
  'Media & Entertainment',
  'Manufacturing',
  'Education',
  'Government / Public Sector',
  'Other',
] as const

export const FUNCTION_OPTIONS = [
  'Engineering / Development',
  'Product Management',
  'Design / UX',
  'Data & Analytics',
  'Sales / Business Development',
  'Marketing',
  'Operations',
  'Finance',
  'HR / People',
  'Customer Success / Support',
  'Other',
] as const

export const YEARS_EXPERIENCE_OPTIONS = ['0–2', '3–5', '6–10', '10+'] as const

export const COMPANY_SIZE_OPTIONS = ['1–50', '51–200', '201–1,000', '1,000+'] as const

export const REVIEW_FREQUENCY_OPTIONS = [
  'Quarterly',
  'Half-yearly',
  'Annual',
  'No formal review',
] as const
