import { Mistral } from '@mistralai/mistralai'

const mistralApiKey = process.env.MISTRAL_API_KEY

// Allow missing key for development (appraisals won't work without it)
if (!mistralApiKey) {
  console.warn('Warning: MISTRAL_API_KEY not set. Appraisal generation will fail.')
  console.warn('Get an API key at: https://console.mistral.ai/api-keys/')
}

export const mistral = new Mistral({
  apiKey: mistralApiKey || 'dummy-key-for-dev',
})

export const chatModel = 'mistral-large-latest'
