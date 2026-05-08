import type { ChatMessage } from '../../lib/chatApi'

interface MessageBubbleProps {
  message: ChatMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  
  // Basic markdown parsing for the assistant response (bold, lists)
  // In a real app, use react-markdown
  const formatContent = (text: string) => {
    if (isUser) return <p className="whitespace-pre-wrap">{text}</p>
    
    // Simple rendering for markdown-like text
    const lines = text.split('\n')
    return (
      <div className="space-y-2">
        {lines.map((line, i) => {
          if (line.trim() === '') return <div key={i} className="h-2"></div>
          
          let formattedLine: React.ReactNode = line
          
          // Basic bold parsing: **text**
          if (typeof formattedLine === 'string') {
            const parts = formattedLine.split(/(\*\*.*?\*\*)/g)
            formattedLine = (
              <>
                {parts.map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                  }
                  return <span key={j}>{part}</span>
                })}
              </>
            )
          }
          
          if (line.startsWith('# ')) {
            return <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2">{formattedLine}</h1>
          } else if (line.startsWith('## ')) {
            return <h2 key={i} className="text-xl font-bold text-white mt-4 mb-2">{formattedLine}</h2>
          } else if (line.startsWith('### ')) {
            return <h3 key={i} className="text-lg font-semibold text-white mt-3 mb-1">{formattedLine}</h3>
          } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            return (
              <div key={i} className="flex pl-2">
                <span className="mr-2 text-indigo-400">•</span>
                <span>{typeof formattedLine === 'string' ? formattedLine.substring(2) : formattedLine}</span>
              </div>
            )
          } else {
            return <p key={i} className="leading-relaxed">{formattedLine}</p>
          }
        })}
      </div>
    )
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg mt-1 ${
          isUser 
            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white' 
            : 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 text-indigo-400'
        }`}>
          {isUser ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </div>
        
        {/* Message Content */}
        <div className={`px-5 py-4 rounded-2xl shadow-sm ${
          isUser 
            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-gray-100 rounded-tr-sm' 
            : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-sm'
        }`}>
          <div className="text-[0.95rem]">
            {formatContent(message.content)}
          </div>
          <div className={`text-[10px] mt-2 opacity-50 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  )
}
