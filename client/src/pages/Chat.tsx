import { useState, useEffect } from 'react'
import SessionList from '../components/Chat/SessionList'
import ChatWindow from '../components/Chat/ChatWindow'
import { getChatSessions, createChatSession, deleteChatSession, type ChatSession } from '../lib/chatApi'

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await getChatSessions()
      setSessions(data)
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSession = async (periodStart: string, periodEnd: string) => {
    try {
      const session = await createChatSession({ period_start: periodStart, period_end: periodEnd })
      setSessions([session, ...sessions])
      setActiveSessionId(session.id)
    } catch (err) {
      console.error(err)
      alert('Failed to create session')
    }
  }

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return
    try {
      await deleteChatSession(id)
      setSessions(sessions.filter(s => s.id !== id))
      if (activeSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id)
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-10rem)] gap-4 md:gap-6 animate-fade-in">
      <div className="w-full md:w-1/3 md:max-w-sm h-1/3 md:h-full glass-panel overflow-hidden flex flex-col rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl">
        <SessionList 
          sessions={sessions} 
          activeSessionId={activeSessionId}
          onSelect={setActiveSessionId}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
          isLoading={isLoading}
        />
      </div>
      <div className="flex-1 h-2/3 md:h-full glass-panel overflow-hidden flex flex-col rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl">
        {activeSessionId ? (
          <ChatWindow key={activeSessionId} sessionId={activeSessionId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select or create a chat session to start.
          </div>
        )}
      </div>
    </div>
  )
}
