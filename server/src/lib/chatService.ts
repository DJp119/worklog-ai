import { supabase } from './supabase.js'

import { generateMonthlySummary } from './summaryService.js'
import type { MonthlySummary, UserProfile, ChatMessage } from 'shared'

function getMonthsBetween(startStr: string, endStr: string): string[] {
  const start = new Date(startStr)
  start.setDate(1) // Always 1st of month
  const end = new Date(endStr)
  end.setDate(1)
  
  const months: string[] = []
  let current = new Date(start)
  
  while (current <= end) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`)
    current.setMonth(current.getMonth() + 1)
  }
  
  return months
}

export async function getSummariesForRange(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<MonthlySummary[]> {
  const months = getMonthsBetween(periodStart, periodEnd)
  
  const { data: existing } = await supabase
    .from('monthly_summaries')
    .select('*')
    .eq('user_id', userId)
    .in('month_year', months)
  
  const existingMonths = new Set(existing?.map(s => s.month_year) || [])
  const missingMonths = months.filter(m => !existingMonths.has(m))
  
  const newSummaries: MonthlySummary[] = []
  for (const month of missingMonths) {
    const summary = await generateMonthlySummary(userId, month)
    if (summary) newSummaries.push(summary)
  }
  
  return [...(existing || []), ...newSummaries]
    .sort((a, b) => a.month_year.localeCompare(b.month_year))
}

export function stitchSummaries(summaries: MonthlySummary[]): string {
  if (summaries.length === 0) return 'No work data available for this period.'
  
  return summaries.map(s => {
    const date = new Date(s.month_year)
    // Avoid timezone issues by using UTC parts or just manually mapping
    const [year, monthStr] = s.month_year.split('-')
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const label = `${monthNames[parseInt(monthStr, 10) - 1]} ${year}`
    
    return `### ${label}\n${s.summary_text}`
  }).join('\n\n')
}

export function buildSystemPrompt(
  stitchedSummaries: string,
  userProfile: Partial<UserProfile>
): string {
  return `You are an AI appraisal assistant for ${userProfile.name || 'a professional'}.
Job Title: ${userProfile.job_title || 'Not specified'}
Company: ${userProfile.company_name || 'Not specified'}

YOUR DATA SOURCE — Monthly work summaries:
${stitchedSummaries}

RULES:
- Answer appraisal questions using ONLY the work data above
- Write in first person ("I") as if the user is speaking
- Be specific — cite project names, metrics, dates from the summaries
- If data is insufficient for a question, say so honestly
- Keep responses focused and professional`
}

export function applySlidingWindow(messages: { role: string; content: string }[], maxTokens = 4000): { role: 'user' | 'assistant'; content: string }[] {
  let tokenCount = 0
  const result: { role: 'user' | 'assistant'; content: string }[] = []
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = Math.ceil(messages[i].content.length / 4)
    if (tokenCount + tokens > maxTokens && result.length > 0) break // Always keep at least 1 message if it's too long
    tokenCount += tokens
    result.unshift(messages[i] as { role: 'user' | 'assistant'; content: string })
  }
  
  return result
}
