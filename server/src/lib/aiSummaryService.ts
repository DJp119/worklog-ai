import { mistral, chatModel } from './mistral.js'
import { logger } from './logger.js'

export interface AISummaryResult {
  summary: string
  impact_summary: string
  category: string
  tags: string[]
}

const validCategories = ['news', 'models', 'startups', 'research', 'tools', 'open_source', 'funding', 'india_ai', 'world_ai'] as const

/**
 * Generate an AI-powered summary and impact assessment for an article.
 * Uses Mistral AI to create a concise summary and classify the article.
 */
export async function generateArticleSummary(
  title: string,
  content: string,
  sourceName: string
): Promise<AISummaryResult | null> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey || apiKey === 'dummy-key-for-dev') {
    logger.warn('MISTRAL_API_KEY not configured - skipping AI summarization')
    return null
  }

  const prompt = `You are an AI news editor. Analyze the following article and return JSON only in this exact format:

{
  "summary": "A concise 2-3 sentence summary of the article",
  "impact_summary": "One sentence on how this impacts AI professionals, developers, or businesses",
  "category": "One of: news, models, startups, research, tools, open_source, funding, india_ai, world_ai",
  "tags": ["relevant", "tags", "for", "this", "article"]
}

Article Title: ${title}
Source: ${sourceName}
Content: ${content.slice(0, 4000)}

Return only valid JSON. No markdown code blocks. No extra text.`

  try {
    const response = await mistral.chat.complete({
      model: chatModel,
      maxTokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    })

    const text = (response.choices?.[0]?.message?.content as string) || ''
    if (!text) {
      logger.warn('Mistral returned empty response for article summary')
      return null
    }

    const cleanText = text.replace(/```json\s?/g, '').replace(/```/g, '').trim()
    const result = JSON.parse(cleanText)

    // Validate category
    if (!validCategories.includes(result.category)) {
      result.category = 'news'
    }

    return {
      summary: result.summary || content.slice(0, 300),
      impact_summary: result.impact_summary || `From ${sourceName}: ${content.slice(0, 200)}`,
      category: result.category,
      tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
    }
  } catch (error) {
    logger.error('AI summarization failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Batch summarize multiple articles (fire-and-forget for cron jobs)
 */
export async function batchSummarizeArticles(
  articles: { id: string; title: string; content: string; source_name: string }[]
): Promise<number> {
  let success = 0
  for (const article of articles) {
    const summary = await generateArticleSummary(article.title, article.content, article.source_name)
    if (summary) {
      success++
    }
  }
  return success
}
