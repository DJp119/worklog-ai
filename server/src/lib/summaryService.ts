import { supabase } from './supabase.js'
import { aiProvider } from './aiProvider.js'
import type { WorkLogEntry, MonthlySummary } from 'shared'

export async function generateMonthlySummary(userId: string, monthYear: string): Promise<MonthlySummary | null> {
  try {
    const startDate = new Date(monthYear)
    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid monthYear format: ${monthYear}`)
    }

    // End of the month
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    
    // Fetch work log entries for the month
    const { data: logs, error: logsError } = await supabase
      .from('work_log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start_date', startDate.toISOString().split('T')[0])
      .lt('week_start_date', endDate.toISOString().split('T')[0])
      .order('week_start_date', { ascending: true })

    if (logsError) {
      console.error('Error fetching logs for summary:', logsError)
      return null
    }

    if (!logs || logs.length === 0) {
      // If there are no logs for this month, but a summary existed, delete it
      await supabase
        .from('monthly_summaries')
        .delete()
        .eq('user_id', userId)
        .eq('month_year', startDate.toISOString().split('T')[0])
        
      return null
    }

    const monthLabel = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const formattedLogs = logs.map(log => {
      return `Week of ${log.week_start_date}:
- Accomplishments: ${log.accomplishments}
- Challenges: ${log.challenges}
- Learnings: ${log.learnings}
- Goals Next Week: ${log.goals_next_week}`
    }).join('\n\n')

    const summaryPrompt = `Summarize this month's work logs into a structured monthly summary.

RULES:
- Preserve ALL project names, technologies, tools, and specific metrics
- Group items into: Key Accomplishments, Challenges Faced, Skills Developed
- Keep specific dates for milestones
- Use bullet points, be factual, no fluff
- Output should be 200-350 words

WORK LOGS FOR ${monthLabel}:
${formattedLogs}

Generate the monthly summary:`

    const response = await aiProvider.complete([
      { role: 'system', content: 'You are an AI assistant that creates concise, factual work summaries from weekly logs.' },
      { role: 'user', content: summaryPrompt }
    ])

    const content = response.content
    const summaryText = (typeof content === 'string' ? content : '') || ''
    const wordCount = summaryText.split(/\s+/).length
    const sourceEntryIds = logs.map(l => l.id)
    const monthYearStr = startDate.toISOString().split('T')[0]

    const { data: summary, error: upsertError } = await supabase
      .from('monthly_summaries')
      .upsert({
        user_id: userId,
        month_year: monthYearStr,
        summary_text: summaryText,
        entry_count: logs.length,
        word_count: wordCount,
        source_entry_ids: sourceEntryIds,
        generated_at: new Date().toISOString()
      }, { onConflict: 'user_id, month_year' })
      .select()
      .single()

    if (upsertError) {
      console.error('Error saving monthly summary:', upsertError)
      return null
    }

    return summary as MonthlySummary

  } catch (error) {
    console.error('Failed to generate monthly summary:', error)
    return null
  }
}

export async function invalidateMonthlySummary(userId: string, weekStartDate: string) {
  try {
    const date = new Date(weekStartDate)
    if (isNaN(date.getTime())) {
      console.warn(`Invalid weekStartDate provided for invalidation: ${weekStartDate}`)
      return
    }
    
    // Convert to YYYY-MM-01 format
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    
    // Delete the summary so it can be lazy-loaded on next request
    const { error } = await supabase
      .from('monthly_summaries')
      .delete()
      .eq('user_id', userId)
      .eq('month_year', monthYear)

    if (error) {
      console.error('Error invalidating monthly summary:', error)
    }
  } catch (error) {
    console.error('Failed to invalidate monthly summary:', error)
  }
}
