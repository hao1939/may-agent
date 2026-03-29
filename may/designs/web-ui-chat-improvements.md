# Web UI Chat Panel Improvements — Design Brief

**Origin**: Hao asked for help understanding the chat panel (2026-03-29). Analysis revealed 3 gaps.
**Owner**: May → Bob (design review) → Tech-Lead (implementation)

## Current Architecture

```
Browser (WebSocket) → web.ts (HTTP/WS server) → Unix socket → may.ts (agent runner)
```

- `src/app/ui/web.ts` (319 lines) — HTTP server + WS bridge
- `src/app/ui/web-static/index.html` (955 lines) — Dashboard + chat UI
- `src/chat-session.ts` — ChatSession class (persistent chat mode)

### How It Works Today

1. Browser opens WebSocket to `/ws` on web server
2. `web.ts` bridges browser WS to agent's Unix domain socket (`socket.ts`)
3. Session picker lets user choose:
   - **💬 Chat mode** — sends `{ type: "input" }` → socket → `handleInput()` → ChatSession
   - **🔗 Steer mode** — select running session, sends `{ type: "steer", sessionId }` to inject messages
4. Subscribe model: `{ type: "subscribe", sessions: ["*"] }` or specific IDs

## Identified Gaps

### Gap 1: No Transcript Hydration on Session Switch
When switching to a running session, user sees: "Watching agent — live events from here."
No conversation history is loaded. The `/sessions/:id` API endpoint exists and returns transcript, but the chat panel doesn't call it on switch.

**Proposed fix**: When `switchSession(sessionId)` is called, fetch `/sessions/${sessionId}` and render the message history before showing live events.

### Gap 2: Session ID Not Prominent
User can't easily tell which session they're talking to. The session picker buttons show `agent (last6chars)` but the chat area itself has no indicator.

**Proposed fix**: Show a session header bar in the chat area with: agent name, session ID, task description, and runtime.

### Gap 3: No Persistent Session Resume
On page refresh, chat starts blank. The user loses their position and context.

**Proposed fix**: Store `currentSessionId` in `localStorage`. On page load, if a stored session is still running, auto-reconnect to it. Clear on explicit disconnect.

## Design Review Questions for Bob

1. Are these the right priorities? Should we tackle all 3 or just the most impactful?
2. Any concerns about the transcript hydration approach (large sessions could be expensive)?
3. Should the session header bar replace the session picker or augment it?
4. Any additional UX improvements worth bundling?
5. Should we add a "scroll to latest" affordance when loading long transcripts?

## Implementation Scope for Tech-Lead

**Files to modify:**
- `src/app/ui/web-static/index.html` — Chat JS + HTML
- `src/app/ui/web.ts` — May need to support transcript pagination or summary

**Files NOT to touch (explicit boundary):**
- `src/chat-session.ts` — No changes to the backend chat session
- `src/may.ts` — No changes to agent runner
- `src/socket.ts` — No changes to socket protocol
- Any agent configs, heartbeat files, or evaluation code

**Testing**: Manual verification via web UI after changes.
