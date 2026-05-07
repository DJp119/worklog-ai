import { GoogleGenerativeAI } from '@google/generative-ai'

const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

// Allow missing key for development (appraisals won't work without it)
if (!geminiApiKey) {
  console.warn('Warning: GOOGLE_GENERATIVE_AI_API_KEY not set. Appraisal generation will fail.')
  console.warn('Get a free API key at: https://aistudio.google.com/')
}

export const gemini = new GoogleGenerativeAI(geminiApiKey || 'dummy-key-for-dev')

export const model = gemini.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    maxOutputTokens: 2048,
  },
})
