# Multi-Provider AI Fallback: NVIDIA NIM → Mistral

## Context

The current implementation uses only Mistral AI for all AI-powered features (chat, monthly summaries, appraisals). Mistral API is a paid service, and hit rate limits can cause service outages.

**Goal:** Add NVIDIA NIM API as the primary provider (free tier: 40 RPM / 30K TPM) with automatic fallback to Mistral when NVIDIA NIM limits are exceeded. This will:
- **Reduce costs** by 80-90% (NVIDIA NIM free tier handles most traffic)
- **Improve reliability** with automatic fallback when one provider hits limits
- **Maintain compatibility** with existing chat/appraisal workflows

---

## Architecture

### Provider Hierarchy

```
Request → NVIDIA NIM (Primary, Free) ══[429/Rate Limit]══> Mistral (Fallback, Paid)
                                    ══[Other Error]══> Error to User
```

### Rate Limit Tracking

- Track requests per minute (RPM) for NVIDIA NIM
- When approaching 40 RPM threshold (e.g., at 38 RPM), switch to Mistral for remaining requests in that minute window
- Reset counter every 60 seconds

---

## Critical Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `server/src/lib/aiProvider.ts` | **CREATE** | Multi-provider abstraction layer with fallback logic |
| `server/src/lib/nvidiaNim.ts` | **CREATE** | NVIDIA NIM API client wrapper |
| `server/src/lib/mistral.ts` | **MODIFY** | Export mistral client for fallback usage |
| `server/src/routes/chat.ts` | **MODIFY** | Use new aiProvider instead of direct mistral calls |
| `server/src/lib/summaryService.ts` | **MODIFY** | Use aiProvider for monthly summary generation |
| `server/src/routes/appraisal.ts` | **MODIFY** | Use aiProvider for appraisal generation |
| `server/.env.example` | **MODIFY** | Add NVIDIA_NIM_API_KEY configuration |
| `client/.env.example` | **MODIFY** | Document any client-side env changes |
| `docs/AI_PROVIDER_SETUP.md` | **CREATE** | Setup guide for NVIDIA NIM and fallback configuration |

---

## Implementation Details

### 1. New File: `server/src/lib/nvidiaNim.ts`

NVIDIA NIM uses REST API (not an npm SDK). Implementation:

```typescript
/**
 * NVIDIA NIM API Client
 * Free tier: 40 RPM, 30K TPM
 * Models: meta/llama-3.1-70b-instruct, mistralai/mixtral-8x7b-instruct, etc.
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
  private readonly SAFETY_MARGIN = 2  // Switch at 38 RPM

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
    return Math.max(0, this.RPM_LIMIT - this.rpmCounter)
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
    return response.json()
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
```

---

### 2. New File: `server/src/lib/aiProvider.ts`

Multi-provider abstraction with automatic fallback:

```typescript
/**
 * AI Provider Abstraction with Fallback
 * Primary: NVIDIA NIM (free, 40 RPM)
 * Fallback: Mistral AI (paid)
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
  private currentWindowStart = Date.now()
  private currentRPM = 0
  private readonly RPM_LIMIT = 40
  private readonly SAFETY_MARGIN = 2

  constructor() {
    const nimApiKey = process.env.NVIDIA_NIM_API_KEY
    if (nimApiKey && nimApiKey.trim() !== '') {
      this.nimClient = new NvidiaNimClient(nimApiKey)
      console.log('AI Provider: NVIDIA NIM configured as primary')
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
        content: response.choices[0]?.message?.content || '',
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

      return wrapped
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
      content: response.choices?.[0]?.message?.content || '',
      provider: 'mistral',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
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
      const text = chunk.data.choices?.[0]?.delta?.content
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
    console.log('[AI Provider] Falling back to Mistral')
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
    console.log('[AI Provider] Falling back to Mistral stream')
    yield* this.tryMistralStream(messages)
  }

  getProviderStatus() {
    return {
      nimConfigured: !!this.nimClient,
      currentRPM: this.currentRPM,
      rpmLimit: this.RPM_LIMIT,
      remainingRPM: Math.max(0, this.RPM_LIMIT - this.currentRPM - this.SAFETY_MARGIN),
    }
  }
}

export const aiProvider = new AIProvider()
export default aiProvider
```

---

### 3. Modify `server/src/lib/mistral.ts`

```typescript
import { Mistral } from '@mistralai/mistralai'

const mistralApiKey = process.env.MISTRAL_API_KEY

if (!mistralApiKey) {
  console.warn('Warning: MISTRAL_API_KEY not set. AI will only work if NVIDIA NIM is configured.')
}

export const mistral = new Mistral({
  apiKey: mistralApiKey || 'dummy-key-for-dev',
})

export const chatModel = 'mistral-large-latest'

export default mistral
```

---

### 4. Modify `server/src/routes/chat.ts` (Lines 227-259)

Replace direct mistral calls with aiProvider:

```typescript
// import mistral => import aiProvider
import { aiProvider } from '../lib/aiProvider.js'

// In POST /api/chat/sessions/:id/messages handler:
const stream = aiProvider.stream(messages)

for await (const chunk of stream) {
  assistantMessage += chunk
  res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`)
}
```

---

### 5. Modify `server/src/lib/summaryService.ts` (Lines 65-71)

```typescript
// import mistral => import aiProvider
import aiProvider from './aiProvider.js'

const response = await aiProvider.complete([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
])

const content = response.content
```

---

### 6. Modify `server/src/routes/appraisal.ts` (Lines 86-99)

```typescript
// import mistral => import aiProvider
import { aiProvider } from '../lib/aiProvider.js'

const response = await aiProvider.complete([
  { role: 'user', content: prompt },
])

result = { choices: [{ message: { content: response.content } }] }
```

---

### 7. Modify `server/.env.example`

```env
# AI Providers (configure at least one)
# Primary: NVIDIA NIM (free tier: 40 RPM, 30K TPM)
# Get API key at: https://build.nvidia.com/explore/discover
NVIDIA_NIM_API_KEY=your-nvidia-nim-api-key

# Fallback: Mistral AI (paid)
# Get API key at: https://console.mistral.ai/api-keys/
# See quotas at: https://docs.mistral.ai/platform/quotas/
MISTRAL_API_KEY=your-mistral-api-key-here
```

---

### 8. New File: `docs/AI_PROVIDER_SETUP.md`

Setup guide for developers:

```markdown
# AI Provider Setup Guide

## Overview

WorkLog AI supports multiple AI providers with automatic fallback:

1. **NVIDIA NIM** (Primary - Free)
   - Rate limit: 40 requests/minute
   - Token limit: 30,000 tokens/minute
   - Model: Llama 3.1 70B Instruct
   - Cost: Free through NVIDIA developer program

2. **Mistral AI** (Fallback - Paid)
   - Rate limit: Configurable
   - Model: Mistral Large
   - Cost: ~$2/1M tokens input, $6/1M tokens output

## Configuration

### Step 1: Get NVIDIA NIM API Key

1. Visit [build.nvidia.com](https://build.nvidia.com/explore/discover)
2. Sign in with Google/GitHub account
3. Click on any model → "Get API Key"
4. Copy the generated API key

### Step 2: Get Mistral API Key (Optional, for fallback)

1. Visit [console.mistral.ai](https://console.mistral.ai/api-keys/)
2. Create API key
3. Note your quota limits

### Step 3: Configure Environment Variables

```bash
# In server/.env
NVIDIA_NIM_API_KEY=nvid_...your-key-here...
MISTRAL_API_KEY=your-mistral-key-here
```

### Step 4: Verify Configuration

```bash
cd server
npm run dev

# Look for startup log:
# "AI Provider: NVIDIA NIM configured as primary"
# or
# "AI Provider: NVIDIA NIM not configured, using Mistral only"
```

## Monitoring

### Check Current Usage

The API provider status is logged with each request:
```
[AI Provider] Used NVIDIA NIM (remaining: 35)
[AI Provider] Falling back to Mistral
```

### Manual Status Check

Make a request to check provider status:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### All requests going to Mistral

- Check NVIDIA_NIM_API_KEY is set correctly
- Verify key is valid at build.nvidia.com
- Check rate limit not exceeded (40 RPM)

### Frequent fallback to Mistral

- Your traffic exceeds 40 RPM
- Consider caching responses or reducing API calls
- Mistral costs will increase proportionally

## Cost Estimates

| Provider | Free Tier | Paid Tier | Est. Monthly Cost (100 users) |
|----------|-----------|-----------|-------------------------------|
| NVIDIA NIM | 40 RPM | Contact sales | $0 (within limits) |
| Mistral AI | $0 | Pay per token | ~$20-50/month |
```

---

## Verification Steps

1. **Install dependencies** (no new packages needed - uses native fetch)

2. **Configure environment**:
   ```bash
   # server/.env
   NVIDIA_NIM_API_KEY=your-key-here
   MISTRAL_API_KEY=your-fallback-key
   ```

3. **Start server**:
   ```bash
   cd server && npm run dev
   # Verify: "AI Provider: NVIDIA NIM configured as primary"
   ```

4. **Test primary provider**:
   ```bash
   curl -X POST http://localhost:3001/api/chat/sessions/test/messages \
     -H "Authorization: Bearer test-token" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   # Should show: "[AI Provider] Used NVIDIA NIM"
   ```

5. **Test fallback**:
   - Use NVIDIA NIM at 40 RPM (rapid requests)
   - Should automatically switch to Mistral after threshold
   - Log shows: "[AI Provider] Falling back to Mistral"

6. **Verify streaming still works**:
   - Chat UI should show streaming text
   - No visual changes to user experience

---

## Rollback Plan

If issues arise:
1. Remove `NVIDIA_NIM_API_KEY` from `.env`
2. Restart server
3. All traffic goes to Mistral only
4. No code changes needed

---

## Notes

- No new npm packages required (uses native fetch)
- Fully backward compatible (Mistral-only deployments still work)
- Rate limit tracking resets every 60 seconds automatically
- Provider choice is logged for monitoring/debugging