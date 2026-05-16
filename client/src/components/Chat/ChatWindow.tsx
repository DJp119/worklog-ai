import { useState, useEffect, useRef, useCallback } from 'react'
import { getChatMessages, type ChatMessage } from '../../lib/chatApi'
import { useSSE } from '../../lib/useSSE'
import MessageBubble from './MessageBubble'

interface ChatWindowProps {
  sessionId: string
}

export default function ChatWindow({ sessionId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { streamMessage, isStreaming, error, abort } = useSSE()

  const [streamingResponse, setStreamingResponse] = useState('')

  const loadMessages = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getChatMessages(sessionId)
      setMessages(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingResponse])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  const handleSend = async (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || isStreaming) return

    const userMessageContent = inputValue.trim()
    setInputValue('')

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: Date.now().toString(),
      session_id: sessionId,
      user_id: 'temp',
      role: 'user',
      content: userMessageContent,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, tempUserMessage])
    setStreamingResponse('')

    try {
      await streamMessage(
        sessionId,
        userMessageContent,
        (text) => {
          setStreamingResponse(prev => prev + text)
        },
        () => {
          // When complete, reload messages to get the real IDs from DB
          void loadMessages()
          setStreamingResponse('')
        }
      )
    } catch (err) {
      console.error('Send message error:', err)
      // Don't reload on error - keep the temp message so user can retry
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(e)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black/20">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">How can I help?</h3>
              <p className="text-sm text-gray-400">
                Ask me about your accomplishments, areas for growth, or to draft your self-appraisal based on your work logs.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 mt-4">
              <button
                type="button"
                onClick={() => setInputValue('What were my biggest accomplishments in this period?')}
                className="text-left text-sm p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all"
              >
                "What were my biggest accomplishments?"
              </button>
              <button
                type="button"
                onClick={() => setInputValue('Draft a summary of my leadership impact.')}
                className="text-left text-sm p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all"
              >
                "Draft a summary of my leadership impact."
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streamingResponse && (
              <MessageBubble 
                message={{
                  id: 'streaming',
                  session_id: sessionId,
                  user_id: 'temp',
                  role: 'assistant',
                  content: streamingResponse,
                  created_at: new Date().toISOString()
                }} 
              />
            )}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-[80%] mx-auto text-center">
                <p className="font-semibold mb-1">An error occurred</p>
                <p>{error}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-black/40">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your work logs..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-14 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none overflow-y-auto min-h-[50px] max-h-[200px]"
            rows={1}
            disabled={isStreaming || isLoading}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={abort}
              className="absolute right-2 bottom-2 p-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 transition-all shadow-lg"
              title="Stop generation"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-sm"></div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-gray-500">
            Mistral AI may produce inaccurate information about your work. Always verify important claims.
          </p>
        </div>
      </div>
    </div>
  )
}
