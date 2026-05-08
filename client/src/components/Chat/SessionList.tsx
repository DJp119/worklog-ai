import { useState } from 'react'
import type { ChatSession } from '../../lib/chatApi'

interface SessionListProps {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onCreate: (start: string, end: string) => void
  onDelete: (id: string) => void
  isLoading: boolean
}

export default function SessionList({ sessions, activeSessionId, onSelect, onCreate, onDelete, isLoading }: SessionListProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startMonth || !endMonth) return
    
    if (startMonth > endMonth) {
      alert('Start month must be before or equal to end month.')
      return
    }
    
    onCreate(`${startMonth}-01`, `${endMonth}-01`)
    setIsCreating(false)
    setStartMonth('')
    setEndMonth('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <h2 className="text-lg font-semibold gradient-text">Chat Sessions</h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="p-1 rounded-md hover:bg-white/10 text-indigo-400 transition-colors"
          title="New Chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 border-b border-white/10 bg-black/20">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Month</label>
              <input 
                type="month" 
                value={startMonth}
                onChange={e => setStartMonth(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Month</label>
              <input 
                type="month" 
                value={endMonth}
                onChange={e => setEndMonth(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="flex-1 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-lg bg-white/5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 py-1.5 text-xs text-white transition-all rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">No chat sessions yet. Create one to start.</div>
        ) : (
          sessions.map(session => (
            <div 
              key={session.id}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                activeSessionId === session.id 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30' 
                  : 'hover:bg-white/5 border border-transparent'
              }`}
              onClick={() => onSelect(session.id)}
            >
              <div className="truncate pr-2">
                <div className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-indigo-300' : 'text-gray-200'}`}>
                  {session.title}
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {new Date(session.updated_at).toLocaleDateString()}
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(session.id)
                }}
                className={`p-1.5 rounded-md hover:bg-red-500/20 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ${
                  activeSessionId === session.id ? 'opacity-100' : ''
                }`}
                title="Delete session"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
