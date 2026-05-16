import { useState, useCallback, useRef } from 'react'
import { refreshAccessToken } from './api'
import { getStoredTokens } from './authStorage'

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const streamMessage = useCallback(async (
    sessionId: string,
    content: string,
    onDelta: (text: string) => void,
    onComplete: () => void
  ) => {
    setIsStreaming(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      const sendRequest = () => {
        const { accessToken } = getStoredTokens()

        return fetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ content }),
          signal: abortControllerRef.current?.signal
        })
      }

      let response = await sendRequest()

      if (response.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          response = await sendRequest()
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Chat API error:', response.status, errorData)
        throw new Error(errorData.error || 'Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No stream supported')

      let done = false
      let buffer = ''

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone

        if (value) {
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          // Last element is either empty string (if ends with \n\n) or partial event
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr)
                if (data.type === 'delta') {
                  onDelta(data.text)
                } else if (data.type === 'done') {
                  // Wait for completion but don't call immediately,
                  // loop will finish.
                } else if (data.type === 'error') {
                  console.error('SSE error from server:', data.error)
                  setError(data.error)
                }
              } catch (e) {
                console.error('Error parsing SSE:', e)
              }
            }
          }
        }
      }

      onComplete()
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Stream aborted')
      } else {
        console.error('SSE Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
      onComplete()
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return { streamMessage, isStreaming, error, abort }
}
