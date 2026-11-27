# Feature Flow: AI Chat

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Enables users to chat with an AI about their work history. Users create chat sessions scoped to a time period, then send messages that stream responses via Server-Sent Events (SSE). The AI has access to the user's work log entries from the session's period.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (Chat.tsx, ChatWindow.tsx)
    participant A as API (chatRoutes)
    participant D as Database (chat_sessions, chat_messages, work_log_entries)
    participant M as AI (Mistral / OpenRouter)

    %% LOAD CHAT PAGE
    F->>A: GET /api/chat/sessions (Bearer JWT)
    A->>A: requireAuth → req.userId
    A->>D: SELECT * FROM chat_sessions WHERE user_id = req.userId ORDER BY updated_at DESC
    A-->>F: 200 { success: true, data: ChatSession[] }
    F->>B: Renders session list (SessionList.tsx)

    %% CREATE SESSION
    U->>F: Clicks "New Chat" → selects period → "Create"
    F->>A: POST /api/chat/sessions { period_start, period_end }
    A->>A: requireAuth
    A->>D: INSERT INTO chat_sessions (user_id, title, period_start, period_end)
    A-->>F: 201 { success: true, data: ChatSession }
    F->>B: Adds to list, navigates to /chat/:sessionId

    %% OPEN CHAT WINDOW
    F->>A: GET /api/chat/sessions/:id/messages
    A->>A: requireAuth → verify session ownership
    A->>D: SELECT * FROM chat_messages WHERE session_id = :id ORDER BY created_at ASC
    A-->>F: 200 { success: true, data: ChatMessage[] }
    F->>B: Renders ChatWindow with messages (MessageBubble.tsx)

    %% SEND MESSAGE (SSE streaming)
    U->>F: Types message → hits Enter
    F->>F: Adds user message optimistically to UI
    F->>A: POST /api/chat/sessions/:id/messages { content } (SSE)
    A->>A: requireAuth → verify session ownership
    A->>D: INSERT INTO chat_messages (session_id, user_id, role='user', content)
    A->>D: SELECT * FROM work_log_entries WHERE user_id = req.userId AND week_start_date BETWEEN period_start AND period_end
    D-->>A: WorkLogEntry[] (context for AI)
    A->>A: Build context prompt: entries + conversation history
    A->>M: Call Mistral/OpenRouter with stream=true
    M-->>A: Stream tokens (SSE)
    A->>F: Stream SSE events: { type: "token", content: "..." } → { type: "done" }
    F->>F: Appends tokens to assistant message in real-time
    F->>A: On "done": POST /api/chat/sessions/:id/messages (save assistant) — optional, or client saves
    Note: Current impl saves assistant message after stream completes
    A->>D: INSERT INTO chat_messages (session_id, user_id, role='assistant', content)
    F->>B: Final message rendered

    %% DELETE SESSION
    U->>F: Clicks delete on session → confirms
    F->>A: DELETE /api/chat/sessions/:id
    A->>A: requireAuth → verify ownership
    A->>D: DELETE FROM chat_messages WHERE session_id = :id
    A->>D: DELETE FROM chat_sessions WHERE id = :id AND user_id = req.userId
    A-->>F: 200 { success: true }
    F->>B: Removes from list
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `server/src/routes/chat.ts` | 5 handlers: list sessions, create, delete, get messages, send message (SSE) |
| `server/src/lib/chatService.ts` | `sendMessage` (SSE streaming), `createChatSession`, `getChatHistory` |
| `server/src/lib/mistral.ts` | `mistral` client |
| `server/src/lib/openRouter.ts` | `openRouter` client (fallback) |
| `server/src/lib/database.ts` | `supabase` service-role client |
| `server/src/middleware/auth.ts` | `requireAuth` |
| `client/src/pages/Chat.tsx` | Session list + ChatWindow container |
| `client/src/components/Chat/ChatWindow.tsx` | Message display, input, SSE handling |
| `client/src/components/Chat/MessageBubble.tsx` | Single message render (user/assistant) |
| `client/src/components/Chat/SessionList.tsx` | Sidebar session list |
| `client/src/lib/chatApi.ts` | `createChatSession`, `getChatSessions`, `deleteChatSession`, `getChatMessages`, `sendChatMessage` |
| `client/src/lib/useSSE.ts` | `useEventSource` hook (SSE wrapper) |

---

## 4. Functions involved (in execution order)

### Session management
1. `Chat.tsx` mount → `getChatSessions()` → `chatApi.ts`
2. `chatRoutes.get('/sessions')` → `server/src/routes/chat.ts:19`
3. `supabase.from('chat_sessions').select('*').eq('user_id', userId).order('updated_at', { ascending: false })`

### Create session
1. `Chat.tsx` "New Chat" → `createChatSession({ period_start, period_end })` → `chatApi.ts`
2. `chatRoutes.post('/sessions')` → `server/src/routes/chat.ts:48`
3. `supabase.from('chat_sessions').insert({ user_id, title, period_start, period_end }).select().single()`

### Send message (SSE)
1. `ChatWindow.tsx` input submit → `sendChatMessage(sessionId, content)` → `chatApi.ts`
2. `chatApi.sendChatMessage` → `POST /api/chat/sessions/:id/messages` with `useSSE.ts` hook
3. `chatRoutes.post('/sessions/:id/messages')` → `server/src/routes/chat.ts:167`
4. `chatService.sendMessage(sessionId, content, userId)` → `lib/chatService.ts`
5. Fetch session → fetch entries in period → build prompt → stream from Mistral/OpenRouter
6. SSE events: `{ type: "token", content: "..." }` → `{ type: "done" }`
7. On done: save assistant message to `chat_messages`

### Delete session
1. `SessionList.tsx` delete → `deleteChatSession(id)` → `chatApi.ts`
2. `chatRoutes.delete('/sessions/:id')` → `server/src/routes/chat.ts:90`
3. Delete messages → delete session (both scoped by `user_id`)

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| Create session request | `{ period_start: "YYYY-MM-DD", period_end: "YYYY-MM-DD" }` |
| Session response | `{ id, user_id, title, period_start, period_end, created_at, updated_at }` |
| Send message request | `{ content: "User's question" }` |
| SSE token event | `{ type: "token", content: "partial response" }` |
| SSE done event | `{ type: "done" }` |
| Assistant message save | `{ session_id, user_id, role: "assistant", content: "full response" }` |
| Message list | `ChatMessage[]` ordered by `created_at ASC` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| Session not found / not owned | 404 `{ error: "Session not found" }` |
| No entries in session period | AI responds with "I don't have any work logs for that period" |
| Mistral stream error | Falls back to OpenRouter; if both fail → SSE `{ type: "error", message: "..." }` |
| Network interruption during stream | `useSSE` reconnects? (Current: no auto-reconnect; user must resend) |
| 401 on request | `apiRequest` refreshes token → retries |
| Session delete with messages | Cascades: messages deleted first, then session |

---

## 7. Simple story

Imagine having a **knowledgeable assistant** who has read all your weekly diaries:

1. You **start a conversation** for a specific time period (e.g., "Q1 2026").
2. You **ask questions**: "What were my biggest wins in March?" "Summarize my learnings."
3. The assistant **reads your relevant entries** and **streams the answer** word-by-word.
4. You can **start multiple conversations** for different periods.
5. Each conversation is **saved** so you can continue later.
6. **No one else** sees your conversations — they're scoped to you.

---

## Related documents

- [Core AI endpoints](../06-api-reference/endpoint-reference-core-ai.md)
- [Chat functions](../04-function-documentation/backend-core-ai.md)
- [Client chat API](../04-function-documentation/frontend-hooks-context-lib.md)
- [SSE hook](../04-function-documentation/frontend-hooks-context-lib.md)

## Verification notes

All paths traced from `server/src/routes/chat.ts`, `server/src/lib/chatService.ts`,
`client/src/components/Chat/ChatWindow.tsx`, `client/src/lib/useSSE.ts` at commit `7567207`.
Not verified at runtime: actual SSE streaming behavior, AI provider fallback, reconnect logic.