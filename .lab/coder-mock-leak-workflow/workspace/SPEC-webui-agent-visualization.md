# SPEC: Web UI — Agent Activity Visualization

**For**: Coder  
**From**: May (Hao's direction)  
**Date**: 2026-04-10  
**Priority**: HIGH — this is coder's primary ongoing project

---

## Goal

Transform the web dashboard from a basic request list into a **live visualization of agent system activity**. Hao wants to see at a glance: who's working, what they're doing, how productive they are, and what the system health looks like.

## Current State

The web UI (`src/app/ui/web-static/index.html`, 1120 lines) has:
- **Dashboard tab**: Shows stats cards + request list (recent sessions/tasks)
- **Chat tab**: WebSocket-based chat with May
- **Knowledge tab**: Browse `agents/shared/knowledge/` files
- **Benchmarks tab**: Gym benchmark results

Backend (`src/app/ui/web.ts`, ~500 lines) serves:
- `GET /api/stats` — 24h session counts per agent, 7d totals
- `GET /api/requests?...` — paginated session list with delegation tree
- `GET /api/digest?date=...` — daily digest markdown
- `GET /api/benchmarks/...` — gym data
- `GET /api/browse?path=...` — knowledge file browser
- `WS /ws` — live event stream (session_start, session_end, notifications, etc.)

Database tables available:
- `sessions` — sessionId, agent, task, status, kind, parentSessionId, startedAt, endedAt, opCount, error, outcome
- `evaluations` — sessionId, agent, quality, efficiency, productiveCalls, wastedCalls, verdict, issues
- `requests` — id, fromEntity, toEntity, task, status, createdAt, completedAt, priority
- `knowledge_entries` — id, title, status, claim, discovered, last_verified
- `hypotheses` — id, title, status, priority, proposed_by

## What to Build

### Phase 1: Agent Activity Panel (add to Dashboard tab)

Add a new section **above** the request list that shows:

1. **Agent Status Grid** — One card per active agent (bob, tech-lead, coach, optimizer, scout, amy-kimi, qa, evaluator, coder, may)
   - Color-coded: 🟢 active (session in last 30min), 🟡 idle (last session 30min-2h ago), 🔴 inactive (>2h)
   - Show: last session time, sessions today, success rate today
   - Click to filter the request list to that agent

2. **Activity Timeline** — Horizontal bar chart showing agent sessions over last 24h
   - Each agent = one row
   - Sessions as colored blocks (green=done, red=error, blue=running)
   - X-axis = time (hours)
   - Pure CSS/HTML — NO external charting libraries

3. **System Health Summary** — Top-level numbers
   - Total sessions today / success rate
   - Active agents count
   - Average session duration
   - Error rate trend (compare today vs yesterday)

### Phase 2: Live Activity Feed

Using the existing WebSocket connection (`/ws`):
- Show a live feed of events: "bob started session", "tech-lead finished (good, 5min)", "optimizer error: ..."
- Color-coded by agent
- Auto-scroll, max 50 items visible
- Pause button to stop scrolling

### Phase 3: Agent Deep Dive

When clicking an agent card, show:
- Session history (last 50 sessions) with duration, status, task summary
- Quality/efficiency trend (from evaluations table)
- Delegation patterns (who delegates to whom — from parentSessionId)
- Current workspace files (what they've been producing)

## Technical Constraints

- **Single HTML file** — keep everything in `index.html` (inline CSS + JS). No build step, no npm packages.
- **No external dependencies** — no D3, no Chart.js. Use CSS grid, flexbox, and HTML `<canvas>` if needed.
- **New API endpoints** in `web.ts` as needed. Follow existing patterns (use `_db()`, return JSON).
- **TypeScript compiles clean** — `npx tsc --noEmit` must pass.
- **Mobile responsive** — the dashboard should work on phone screens.

## API Endpoints Needed

```
GET /api/agents/activity
  Returns: { agents: [{ name, lastSession, sessionsToday, successRate, status }] }

GET /api/agents/timeline?hours=24
  Returns: { agents: [{ name, sessions: [{ id, start, end, status }] }] }

GET /api/agents/{name}/detail
  Returns: { recentSessions, evalTrend, delegationMap, workspaceFiles }
```

## Implementation Order

1. Add `/api/agents/activity` endpoint to `web.ts`
2. Add Agent Status Grid to `index.html`
3. Add `/api/agents/timeline` endpoint
4. Add Activity Timeline visualization
5. Add System Health Summary
6. Wire up WebSocket for live feed
7. Add agent detail deep-dive

**Start with steps 1-3. Ship each step independently — commit and test before moving to the next.**

## Testing

- `npx tsc --noEmit` — must pass
- Manual: open http://localhost:8080 and verify the new panels render
- The existing tests must still pass: `npx vitest run`
