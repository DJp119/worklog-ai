import dotenv from 'dotenv'
import { logger } from './logger.js'

dotenv.config()

const openrouterApiKey = process.env.OPENROUTER_API_KEY
const openrouterModel = process.env.OPENROUTER_PLAYGROUND_MODEL || 'google/gemma-2-9b-it:free'

export const hasOpenRouter = !!openrouterApiKey

export interface OpenRouterGenerateOptions {
  prompt: string
  systemPrompt?: string
}

export async function callOpenRouter(options: OpenRouterGenerateOptions): Promise<string> {
  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const messages = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: options.prompt })

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': 'https://impactlyai.com',
        'X-Title': 'Impactly AI',
      },
      body: JSON.stringify({
        model: openrouterModel,
        messages,
        temperature: 0.7,
        max_tokens: 400,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`)
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenRouter API returned empty content')
    }

    return content
  } catch (error) {
    logger.error('OpenRouter API call failed: {}', error instanceof Error ? error.message : String(error))
    throw error
  }
}
