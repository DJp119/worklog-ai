/**
 * AI Provider Abstraction with Fallback
 *
 * Primary: NVIDIA NIM (free, 40 RPM)
 * Fallback: Mistral AI (paid)
 *
 * Auto-fallback when NVIDIA NIM rate limit is exceeded
 */

import mistralClient, { chatModel } from './mistral.js'
import NvidiaNimClient from './nvidiaNim.js'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AICompleteResponse {
  content: string
  provider: 'nvidia-nim' | 'mistral'
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

type StreamChunk = string

class AIProvider {
  private nimClient: NvidiaNimClient | null = null

  constructor() {
    const nimApiKey = process.env.NVIDIA_NIM_API_KEY
    if (nimApiKey && nimApiKey.trim() !== '') {
      this.nimClient = new NvidiaNimClient(nimApiKey)
      console.log('AI Provider: NVIDIA NIM configured as primary provider')
    } else {
      console.log('AI Provider: NVIDIA NIM not configured, using Mistral only')
    }
  }

  private async tryNVIDIAComplete(
    messages: Message[]
  ): Promise<AICompleteResponse | null> {
    if (!this.nimClient) return null

    try {
      const response = await this.nimClient.complete({
        model: 'meta/llama-3.1-70b-instruct',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 2048,
      })

      return {
        content: (typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content
          : '') || '',
        provider: 'nvidia-nim',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('RATE_LIMIT_EXCEEDED')) {
        console.log('[AI Provider] NVIDIA NIM rate limit reached, falling back to Mistral')
        return null
      }
      console.error('[AI Provider] NVIDIA NIM error:', error)
      return null
    }
  }

  private async tryNVIDIAStream(
    messages: Message[]
  ): Promise<AsyncGenerator<StreamChunk> | null> {
    if (!this.nimClient) return null

    try {
      const stream = this.nimClient.stream({
        model: 'meta/llama-3.1-70b-instruct',
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 2048,
      })

      // Wrap to catch rate limit errors mid-stream
      const wrapped = (async function* () {
        try {
          for await (const chunk of stream) {
            yield chunk
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('RATE_LIMIT_EXCEEDED')) {
            throw new Error('NVIDIA_NIM_RATE_LIMIT_EXCEEDED_DURING_STREAM')
          }
          throw error
        }
      })()

      return wrapped as unknown as AsyncGenerator<StreamChunk>
    } catch (error) {
      console.error('[AI Provider] NVIDIA NIM stream error:', error)
      return null
    }
  }

  private async tryMistralComplete(
    messages: Message[]
  ): Promise<AICompleteResponse> {
    const response = await mistralClient.chat.complete({
      model: chatModel,
      messages: messages as any,
    })

    return {
      content: (typeof response.choices?.[0]?.message?.content === 'string'
        ? response.choices[0].message.content
        : '') || '',
      provider: 'mistral',
      usage: {
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
      },
    }
  }

  private async *tryMistralStream(
    messages: Message[]
  ): AsyncGenerator<StreamChunk> {
    const stream = await mistralClient.chat.stream({
      model: chatModel,
      messages: messages as any,
    })

    for await (const chunk of stream) {
      const text = (chunk.data.choices?.[0]?.delta?.content) as string | undefined
      if (text) yield text
    }
  }

  async complete(
    messages: Message[]
  ): Promise<AICompleteResponse> {
    // Try NVIDIA NIM first
    const nimResult = await this.tryNVIDIAComplete(messages)
    if (nimResult) {
      console.log(`[AI Provider] Used NVIDIA NIM (remaining: ${await this.nimClient?.getRemainingRPM()})`)
      return nimResult
    }

    // Fallback to Mistral
    console.log('[AI Provider] Using Mistral (fallback)')
    return this.tryMistralComplete(messages)
  }

  async *stream(
    messages: Message[]
  ): AsyncGenerator<StreamChunk> {
    // Try NVIDIA NIM first
    const nimStream = await this.tryNVIDIAStream(messages)
    if (nimStream) {
      console.log(`[AI Provider] Using NVIDIA NIM stream (remaining: ${await this.nimClient?.getRemainingRPM()})`)
      yield* nimStream
      return
    }

    // Fallback to Mistral
    console.log('[AI Provider] Using Mistral stream (fallback)')
    yield* this.tryMistralStream(messages)
  }

  getProviderStatus() {
    return {
      nimConfigured: !!this.nimClient,
      nimRemainingRPM: this.nimClient ? this.nimClient.getRemainingRPM() : 0,
    }
  }
}

export const aiProvider = new AIProvider()
export default aiProvider