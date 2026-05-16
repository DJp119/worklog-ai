/**
 * NVIDIA NIM API Client
 *
 * Free tier: 40 RPM, 30K TPM
 * Models: meta/llama-3.1-70b-instruct, mistralai/mixtral-8x7b-instruct, etc.
 *
 * API Docs: https://docs.nvidia.com/nim/llama
 * Available Models: https://build.nvidia.com/explore/discover
 */

interface NIMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface NIMRequest {
  model: string
  messages: NIMMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface NIMResponse {
  choices: Array<{
    message: NIMMessage
    finish_reason?: string
  }>
  usage: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
}

class NvidiaNimClient {
  private apiKey: string
  private baseUrl = 'https://integrate.api.nvidia.com/v1'
  private model = 'meta/llama-3.1-70b-instruct'

  private rpmCounter = 0
  private windowStart = Date.now()
  private readonly RPM_LIMIT = 40
  private readonly SAFETY_MARGIN = 2  // Switch at 38 RPM to allow graceful fallback

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private checkRateLimit(): boolean {
    // Reset counter every 60 seconds
    if (Date.now() - this.windowStart > 60000) {
      this.rpmCounter = 0
      this.windowStart = Date.now()
    }
    return this.rpmCounter < (this.RPM_LIMIT - this.SAFETY_MARGIN)
  }

  async incrementRPM(): Promise<void> {
    this.rpmCounter++
  }

  async getRemainingRPM(): Promise<number> {
    return Math.max(0, this.RPM_LIMIT - this.rpmCounter - this.SAFETY_MARGIN)
  }

  async complete(request: NIMRequest): Promise<NIMResponse> {
    if (!this.checkRateLimit()) {
      throw new Error('NVIDIA_NIM_RATE_LIMIT_EXCEEDED')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...request,
        model: this.model,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`NVIDIA NIM API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    await this.incrementRPM()
    return response.json() as Promise<NIMResponse>
  }

  async *stream(request: NIMRequest): AsyncGenerator<string> {
    if (!this.checkRateLimit()) {
      throw new Error('NVIDIA_NIM_RATE_LIMIT_EXCEEDED')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        ...request,
        model: this.model,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`NVIDIA NIM API error: ${response.status} - ${JSON.stringify(error)}`)
    }

    await this.incrementRPM()

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch {
            // Skip parse errors
          }
        }
      }
    }
  }
}

export default NvidiaNimClient