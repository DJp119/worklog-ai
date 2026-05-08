import { apiRequest } from './api'

export interface ChatSession {
  id: string
  user_id: string
  title: string
  period_start: string
  period_end: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface CreateChatSessionRequest {
  period_start: string
  period_end: string
}

export async function getChatSessions(): Promise<ChatSession[]> {
  return apiRequest<ChatSession[]>('/api/chat/sessions')
}

export async function createChatSession(body: CreateChatSessionRequest): Promise<ChatSession> {
  return apiRequest<ChatSession>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export async function deleteChatSession(id: string): Promise<void> {
  await apiRequest(`/api/chat/sessions/${id}`, {
    method: 'DELETE'
  })
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`)
}
