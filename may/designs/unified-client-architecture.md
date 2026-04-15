# Unified Client Architecture — Design Brief

**Origin**: Hao observed that Telegram, Console, and Web UI are all just clients to the same agent. They should share design and functionality.
**Owner**: may → tech-lead
**Date**: 2026-03-30

## Current Architecture

```
                    ┌─────────────────┐
                    │   EventBus      │  ← central nervous system
                    │  (RunnerEvents) │
                    └────┬───┬───┬────┘
                         │   │   │
              ┌──────────┘   │   └──────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Console  │  │ Telegram │  │  Socket  │
        │   UI     │  │   Bot    │  │   UI     │
        └──────────┘  └──────────┘  └──────┬───┘
                                           │ Unix socket
                                    ┌──────┴───┐
                                    │  Web UI   │
                                    │(HTTP + WS)│
                                    └──────────┘
```

### How Each Client Works Today

| Feature | Console | Telegram | Web UI |
|---------|---------|----------|--------|
| **Input** | readline → `handleInput()` | long-poll API → `bus.command({type:'input'})` | WS → socket → bus.command |
| **Output** | bus.on() → stdout formatting | bus.on() → accumulate text, flush on turn_end | socket → WS → browser |
| **Chat** | ✅ via ChatSession | ✅ via bus.command | ✅ via socket proxy |
| **Session list** | ❌ | ❌ | ✅ (HTTP API) |
| **Transcript view** | ❌ | ❌ | ✅ (HTTP API) |
| **Control commands** | Built-in: exit, cancel | ❌ (text-only) | ❌ (no UI buttons) |
| **Restart/Reload** | Ctrl+C / `exit` | ❌ | ❌ (socket supports it) |
| **Real-time streaming** | ✅ (direct bus) | Partial (batched) | ✅ (WS) |
| **Message splitting** | N/A (unlimited stdout) | Custom 4096-char logic | N/A (browser renders) |

### Key Insight

The **Unix socket** (`socket.ts`) is already the universal control plane:
- Streams RunnerEvents as JSON lines
- Accepts commands: `input`, `cancel`, `cancel_all`, `restart`, `close`, `reload_agents`
- Supports filtered subscriptions (per-session, per-channel)
- Auto-expands child session events

**All clients should be thin wrappers over the socket protocol**, not direct bus listeners.

## Design: What to Unify

### Phase 1: Parity — Give Telegram What Web UI Has

1. **`/sessions`** — List active/recent sessions (Telegram command)
2. **`/transcript <id>`** — View session transcript (Telegram command)
3. **`/status`** — Show agent stats (sessions, requests, uptime)
4. **`/restart`** — Send restart command via socket
5. **`/cancel`** — Cancel active sessions

### Phase 2: Give Web UI What It's Missing

1. **Restart button** in the web UI header
2. **Cancel button** next to running sessions
3. **Input box** that sends chat messages via WebSocket (it may already have this)
4. **Status bar** showing connection state + active session count

### Phase 3: Shared Utilities (Optional Refactor)

Extract common logic that Console, Telegram, and Web UI all need:

```typescript
// src/app/ui/shared.ts

/** Format a RunnerEvent's text content for display */
export function formatEventText(event: RunnerEvent): string;

/** Split a long message into chunks respecting word boundaries */
export function splitMessage(text: string, maxLen: number): string[];

/** Parse a user command (e.g., "/restart", "/sessions") */
export function parseCommand(input: string): { command: string; args: string[] } | null;

/** Format session info for display */
export function formatSessionInfo(session: SessionInfo): string;

/** Format transcript messages for display */
export function formatTranscript(messages: TranscriptMessage[]): string;
```

## Implementation Plan

### P1 Tasks (dispatch to tech-lead)

**Task 1: Telegram Bot Commands**
- File: `src/app/ui/telegram.ts`
- Add command parsing in the message handler
- `/sessions` → query DB for active sessions, format as Telegram message
- `/transcript <id>` → fetch transcript, split into 4096-char Telegram messages
- `/status` → show stats (active sessions, uptime, request counts)
- `/restart` → send `{type:"restart"}` via bus.command()
- `/cancel` → send `{type:"cancel_all"}` via bus.command()

**Task 2: Web UI Control Buttons**
- File: `src/app/ui/web-static/index.html`
- Add restart button in header → sends `{type:"restart"}` via WebSocket
- Add cancel button next to running sessions → sends `{type:"cancel", sessionId}` via WebSocket
- Add status indicator showing WebSocket connection state

### P2 Tasks (nice-to-have)

**Task 3: Shared Utilities**
- New file: `src/app/ui/shared.ts`
- Extract message splitting from telegram.ts
- Extract event formatting patterns
- Both telegram.ts and console.ts import from shared.ts

## Socket Protocol Reference

The socket already supports everything needed:

```jsonl
// Subscribe to events
{"type":"subscribe","channel":"chat"}
{"type":"subscribe","sessionId":"s_123"}

// Send input
{"type":"input","message":"hello","source":"telegram"}

// Control
{"type":"restart"}
{"type":"close"}
{"type":"cancel","sessionId":"s_123"}
{"type":"cancel_all"}
{"type":"reload_agents"}
```

## Non-Goals
- Don't rewrite the Console UI to use socket (it's in-process, direct bus access is fine)
- Don't add authentication yet (future concern)
- Don't change the socket protocol (it's already sufficient)
