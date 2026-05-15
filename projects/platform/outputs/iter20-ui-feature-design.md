# Web UI Feature Design — Session Investigation UX

**Date:** 2026-05-15  
**Context:** 5 features requested by hao to improve session investigation.

---

## Current Architecture Summary

### Data Layer
- **SQLite DB** with tables: `sessions` (sessionId, agent, task, status, kind, parentSessionId, projectId, startedAt, endedAt, opCount, outcome, error), `evaluations` (quality, efficiency, productiveCalls, wastedCalls, verdict, issues, usage)
- **session.jsonl** files on disk: full conversation transcripts (user/assistant/tool_result messages)
- No dedicated `api_calls` or `llm_calls` table — API usage is only in evaluations.usage (JSON blob)

### HTTP API (relevant endpoints)
| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions/:id` | Session row + recursive children tree + evaluation |
| `GET /api/sessions/:id/transcript` | Parsed JSONL → `{role, text, toolCalls, content}[]` |
| `GET /api/agents/:name/detail` | Agent sessions list, stats |
| `GET /api/loop-trace?...` | Full causal trace: event→workflow→sessions |
| `GET /api/projects/sessions` | Sessions filtered by projectId |

### UI (single-page `ui/index.html`, ~4.5K lines vanilla JS)
- **Tabs:** Dashboard, Agents (with deep-dive), Projects, Knowledge, Benchmarks
- **Agent deep-dive** has sub-tabs: Overview, Sessions (table), Evaluations
- **Session inspector** shows metadata grid, task block, child tree, score bar, transcript viewer
- Transcript renders user/assistant/tool_result messages with tool call expansion

---

## Feature Designs

### 1. Session → API Call Mapping

**Goal:** Show which LLM API calls a session made, their cost/tokens, and how they map to conversation turns.

**Current data:** `session.jsonl` implicitly encodes API calls — each assistant message IS one API response. The `evaluations.usage` field has aggregate token counts. No per-call timing/cost breakdown exists today.

**Design:**
- **Phase 1 (UI-only, no backend change):** In the transcript viewer, annotate each assistant message as "API Call #N" with a turn counter. Show opCount from session metadata.
- **Phase 2 (backend instrumentation):** Add a `session_api_calls` table or append API metadata (latency_ms, input_tokens, output_tokens, cache_read_tokens, cost_usd) to each assistant entry in session.jsonl. The SDK's `callModel()` already has this data in the response.
- **Phase 2 UI:** Show a collapsible "API Calls" panel per session with a table: call#, latency, tokens in/out, cost. Click a row to highlight the corresponding transcript turn.

**Effort:** Phase 1 = S (1-2h), Phase 2 = M (needs SDK change + migration)

---

### 2. Session Tab: Logs + API Calls (Side-by-Side)

**Goal:** Unified view showing session logs alongside the corresponding API call details.

**Design:**
- Add a new sub-tab "Logs + API" in the session inspector (alongside existing Transcript view).
- **Left pane:** Chronological log entries (tool calls made, results received, errors).
- **Right pane:** The API call that produced each group of tool calls (tokens, latency, model used).
- Clicking a log entry highlights its parent API call; clicking an API call scrolls to its tool_use blocks.
- Implementation: The transcript data already has this structure (`assistant` messages contain `toolCalls[]`, followed by `tool_result` entries). Group them into "turns" in the UI.

**Data needed:** Already available from `/api/sessions/:id/transcript`. Per-call cost/latency needs Phase 2 of Feature 1.

**Effort:** M (UI work, no backend change for basic version)

---

### 3. LLM-Powered Session Summarization

**Goal:** One-click summary of a session's activity for quick investigation.

**Design:**
- **API endpoint:** `POST /api/sessions/:id/summarize` — takes the transcript, truncates to fit context, sends to an LLM with a prompt like: "Summarize what this agent session accomplished, key decisions, errors encountered, and whether it was efficient."
- **Caching:** Store summaries in a new `session_summaries` table (sessionId PK, summary TEXT, model TEXT, createdAt INTEGER). Return cached if exists.
- **UI:** Add a "✨ Summarize" button in the session inspector header. Shows a loading state, then renders the markdown summary in a highlighted box.
- **Cost control:** Only allow summarization of completed sessions. Use a cheap/fast model (e.g., haiku). Truncate transcript to last 50 turns if too long.

**Effort:** M (new endpoint + LLM call + small table + UI button)

---

### 4. Session Scoring

**Goal:** Multi-dimensional scoring to quickly identify wasteful or stuck sessions.

**Current data:** `evaluations` table already has `quality`, `efficiency`, `productiveCalls`, `wastedCalls`, `verdict`. This is partially implemented.

**Proposed scoring dimensions:**
| Dimension | Signal | Source |
|-----------|--------|--------|
| **Efficiency** | productive vs wasted tool calls | evaluations.efficiency |
| **Cost** | total tokens / cost_usd relative to task complexity | evaluations.usage |
| **Cycling** | repeated identical tool calls or error→retry loops | transcript analysis |
| **Progress** | did it produce deliverables / advance the goal? | outcome + finish status |
| **Speed** | wall-clock time relative to opCount | sessions.startedAt/endedAt/opCount |
| **Error rate** | fraction of tool_results with isError=true | transcript |

**Design:**
- **Backend:** Extend the heuristic evaluator to compute all dimensions and store in evaluations table (add columns: `cycling_score`, `cost_score`, `speed_score`, `error_rate`). Or store as JSON in a `scores` column.
- **UI:** Replace the single score bar with a radar/spider chart or multi-bar showing all dimensions. Color-code: green (>0.7), yellow (0.4-0.7), red (<0.4). Add sortable columns in the sessions table for each score.
- **Aggregate views:** Per-agent average scores over time (sparklines in agent overview).

**Effort:** M-L (scoring logic + schema extension + UI visualization)

---

### 5. Top-Down & Bottom-Up Investigation UX

**Goal:** Help users investigate from either direction — overview→drill-down or detail→roll-up.

**Top-down (already partially exists via loop-trace):**
- Entry points: Dashboard → Agent → Sessions → Transcript
- **Enhance:** Add a "Session Tree" visualization showing the full call hierarchy (parent→children) with color-coded status. Already have `parentSessionId` and recursive CTE in the API.
- Add filtering: "Show me all sessions that scored < 0.5 efficiency" or "all sessions with cycling detected."

**Bottom-up (new):**
- From any session, show: "Part of workflow X, triggered by event Y, parent session Z"
- Add a **breadcrumb trail** at top of session inspector: `Event #123 → Workflow abc → Parent Session → This Session`
- **Pattern detection:** "This agent had 5 sessions in the last hour with the same error" — surface as an alert/badge in the agent overview.
- **Roll-up view:** Given a workflowRunId or projectId, show aggregate stats: total sessions, total cost, success rate, time spent.

**Design:**
- **Breadcrumb API:** Extend `/api/sessions/:id` to include `lineage: {event?, workflow?, parentChain[]}` by joining events/workflows tables.
- **Filter endpoint:** `GET /api/sessions?minEfficiency=0.5&verdict=wasteful&agent=X` — add query params to existing sessions list.
- **Pattern detection:** Cron job or on-demand query: group recent sessions by (agent, error) and flag clusters.

**Effort:** L (multiple UI components + backend queries + pattern detection)

---

## Priority Matrix

| # | Feature | Impact | Effort | Priority | Dependencies |
|---|---------|--------|--------|----------|--------------|
| 4 | Session Scoring | High (identifies waste) | M | **P1** | Evaluations table exists |
| 2 | Logs + API tab | High (daily use) | M | **P1** | Transcript API exists |
| 5 | Investigation UX | High (usability) | L | **P2** | Breadcrumbs need lineage data |
| 1 | Session→API mapping | Medium | S→M | **P2** | Phase 1 trivial; Phase 2 needs SDK |
| 3 | LLM Summarization | Medium (nice-to-have) | M | **P3** | Needs LLM call infra in server |

**Recommended implementation order:** 4 → 2 → 1 (phase 1) → 5 (breadcrumbs) → 3 → 1 (phase 2) → 5 (patterns)

---

## Data Gaps Summary

| Need | Status | Action |
|------|--------|--------|
| Per-API-call tokens/latency/cost | ❌ Not stored per-call | Instrument SDK `callModel()` to append metadata |
| Session lineage (event→workflow→session chain) | ✅ Available via loop-trace | Expose in session detail API |
| Cycling detection | ❌ No automated detection | Add transcript analysis in evaluator |
| Session summaries (LLM) | ❌ No table | Add `session_summaries` table + endpoint |
| Multi-dimensional scores | 🟡 Partial (quality/efficiency exist) | Extend evaluator + schema |
