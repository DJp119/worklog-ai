import Anthropic from '@anthropic-ai/sdk'

const anthropicApiKey = process.env.ANTHROPIC_API_KEY

// Allow missing key for development (appraisals won't work without it)
if (!anthropicApiKey) {
  console.warn('Warning: ANTHROPIC_API_KEY not set. Appraisal generation will fail.')
  console.warn('Get a key at: https://console.anthropic.com')
}

export const anthropic = new Anthropic({
  apiKey: anthropicApiKey || 'dummy-key-for-dev',
})
