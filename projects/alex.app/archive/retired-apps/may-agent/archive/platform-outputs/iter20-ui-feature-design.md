# Web UI Feature Design - Session Investigation UX

**Date:** 2026-05-15  
**Updated:** 2026-05-16  
**Context:** Session investigation features requested by hao for understanding what agents do, what it costs, where work gets stuck, and how local symptoms roll up to system patterns.

---

## Product Goal

The UI should help an operator answer five questions quickly:

1. **Why did this session happen?** Trigger, project, metric, workflow, parent session, or human action.
2. **What did it do?** Turns, tool calls, tool results, files touched, messages, and produced artifacts.
3. **What did it cost?** API calls, model/provider, tokens, cache use, cost, duration, and repeated work.
4. **Where did it fail or waste effort?** Errors, retries, cycling, idle turns, guard friction, missing context.
5. **Where else is this pattern happening?** Same error, same agent, same workflow, same project, same tool loop.

The design center is not a single session page. It is an investigation graph that supports both top-down and bottom-up movement.

---

## Investigation Model

### Top-Down Path

Start from a broad signal and drill down:

`Project / Agent / Metric / Event -> Workflow run -> Session tree -> Session -> Turn -> API call + tool calls + result`

Top-down is used when the operator asks: "What is this project/agent/system doing, and which sessions explain the state?"

### Bottom-Up Path

Start from a local symptom and roll up:

`Tool error / expensive API call / repeated turn -> Session turn -> Parent session -> Workflow -> Project / trigger / metric -> repeated pattern`

Bottom-up is used when the operator asks: "I found something suspicious in this session; what caused it and is it recurring?"

### Core Objects

| Object | Purpose | Current Sources |
|--------|---------|-----------------|
| Project | Work context and human goal | `projects/*/project.md`, project detail API |
| Event | Trigger or signal | events table, loop trace |
| Workflow run | Orchestration unit | `workflow_runs`, workflow run files |
| Session | Agent execution unit | `sessions` table, `session.jsonl` |
| Turn / API call | LLM response boundary | assistant entries in `session.jsonl` |
| Tool call/result | Action and evidence | transcript content blocks |
| Evaluation / digest | Judgment and summary | `evaluations`, session digests |

---

## Current Architecture Summary

### Data Layer

- **SQLite DB** has `sessions`, `workflow_runs`, `events`, `evaluations`, metrics, alerts, and project cache tables.
- **session.jsonl** stores the full conversation transcript. Assistant entries are the practical API-call boundary.
- **Transcript API** already exposes assistant `api`, `provider`, `model`, and `usage` when present.
- **No normalized `session_api_calls` table yet.** Per-call metadata exists in raw transcript entries, but is not indexed/queryable as first-class data. Latency is still not consistently stored per call.

### HTTP API

| Endpoint | Role in Investigation |
|----------|-----------------------|
| `GET /api/sessions/:id` | Session metadata, child session tree, evaluation |
| `GET /api/sessions/:id/transcript` | Turns, tool calls/results, API metadata from session.jsonl |
| `GET /api/projects/detail?path=...` | Project roll-up and recent sessions |
| `GET /api/projects/lineage?path=...` | Top-down project session lineage from tagged/workflow/file-read/child/mention signals |
| `GET /api/loop-trace?...` | Causal trace from event/metric/workflow/session to related executions |
| `GET /api/projects/sessions` | Project session list, useful but less complete than lineage |

### UI

- The project detail page already has project sessions and lineage surfaces.
- The system loop trace already links events/workflows/sessions.
- The session route/inspector is the right central workspace for turn-level investigation.
- First Logs + API implementation slice is present in:
  - `/app/projects/may-agent.app/ui/index.html` commit `4307cbf38`
  - `repos/may-agent/src/app/http/server.ts` commit `c241e46a`

---

## Target UX Shape

### 1. Investigation Overview

Entry surfaces should prioritize "what needs attention" rather than raw lists.

Top-down entry points:

- Project page: active work, current state, lineage, recent sessions, errors, cost, stalled work.
- Agent page: recent sessions, active sessions, low-efficiency sessions, repeated error clusters.
- Metrics/events page: alert -> workflow -> session trace.
- Dashboard: red projects/agents/metrics with direct links into the causal trace.

Each row should provide: status, owner/agent, project, trigger, duration, cost if known, and one-click open to session inspector.

### 2. Session Inspector as the Central Workspace

The session inspector should be optimized around one selected session.

Required panels:

- Header: session id, agent, status, kind, project, workflow, parent session, started/ended, duration, op count.
- Breadcrumb: project/event/metric -> workflow -> parent session -> current session.
- Child sessions: compact tree with status and open links.
- Logs + API: grouped turn view showing API call metadata and related tool activity.
- Transcript: raw chronological conversation for fallback inspection.
- Evaluation/digest: quality, efficiency, verdict, issues, and summary if available.

The Logs + API panel is the main turn-level investigation view. Transcript remains the source-of-truth fallback.

### 3. Bottom-Up Pattern View

From a suspicious turn, the operator should be able to ask: "Where else did this happen?"

Pattern anchors:

- Same tool name and similar error.
- Same guard failure category.
- Same model/provider with high cost or empty response.
- Same project and repeated worker/reviewer loop.
- Same workflow handler producing repeated blocked/waiting outcomes.

This does not need LLM summarization first. Start with deterministic grouping and links.

---

## Feature Designs

### 1. Logs + API Session Inspector View

**Goal:** Show the original session log and the related API response boundary together.

**Current status:** First focused slice is implemented. It adds a Logs + API tab and exposes API metadata from transcript assistant entries.

**Data model:**

- Each assistant message with `api`, `provider`, `model`, or `usage` is an API turn.
- The assistant message's `toolCalls[]` are the planned actions for that turn.
- Following `tool_result` messages with matching ids are the observed results.
- User messages between turns are context inputs.

**UI behavior:**

- Render turn groups: `API Call #N -> assistant text -> tool calls -> tool results`.
- Show model/provider/API type and token/cost fields when available.
- Highlight errors in tool results.
- Allow collapse/expand per turn.
- Link each turn back to raw transcript position.

**Next refinements:**

- Add selected-turn state instead of only collapsible blocks.
- Add a compact right-side metadata panel for the selected turn.
- Add quick filters: errors only, expensive calls, tool calls only, empty responses.
- Add anchors so loop trace and future pattern views can deep-link to a turn.

### 2. Session -> API Call Mapping

**Goal:** Make LLM call boundaries visible and navigable.

**Current data:** Per-call API metadata is partially available in assistant entries and is exposed by the transcript endpoint. The missing part is normalization and consistent latency.

**Phase 1:** Use transcript assistant entries as the API call list. This is enough for UI investigation.

**Phase 2:** Add a normalized `session_api_calls` read model or table with:

- sessionId
- turn index
- response id if available
- provider/model/api
- input/output/cache tokens
- cost
- latency
- stop reason
- error/empty-response markers

**Do not block the UI on Phase 2.** The raw transcript has enough signal for the first useful experience.

### 3. Top-Down Lineage and Breadcrumbs

**Goal:** Make it obvious why a session exists and where it fits.

**Use existing surfaces first:**

- Extend project lineage instead of creating a separate project-session concept.
- Reuse loop trace for event/workflow/session causality.
- Use `parentSessionId`, `workflowRunId`, and `projectId` for session breadcrumbs.

**Session breadcrumb target:**

`Project platform -> trigger.project / project.comment -> workflow wr_... -> parent session -> current session`

**Next API work:**

- Extend `GET /api/sessions/:id` with a `lineage` object that includes project, workflow run, parent chain, and likely triggering event when available.
- Add direct links from lineage rows and loop trace executions into the session inspector.

### 4. Deterministic Suspicion Signals

**Goal:** Surface likely waste before adding subjective scoring.

Start with cheap deterministic markers:

- Repeated identical tool call with same args.
- Repeated failed tool call or guard failure.
- High cost call relative to session median.
- Empty assistant response.
- Long session with no file edits/deliverables.
- Worker/reviewer loop with repeated WAITING/BLOCKED guidance.

These should appear as badges and filters. They are more actionable than an opaque score.

### 5. Session Scoring

**Goal:** Rank sessions after the inspection and suspicion model exists.

Scoring dimensions:

| Dimension | Signal | Source |
|-----------|--------|--------|
| Efficiency | productive vs wasted tool calls | evaluations + transcript heuristics |
| Cost | tokens/cost relative to task and peers | transcript usage + evaluations.usage |
| Cycling | repeated calls, same errors, repeated reviewer guidance | transcript + journal/session metadata |
| Progress | deliverables, commits, project state movement | outcome, file edits, git evidence, project journal |
| Speed | duration vs op count and task complexity | sessions table |
| Error rate | failed tool results / total tool results | transcript |

UI should show bars/badges and sortable columns. Avoid radar charts unless the data proves they help; dense bars and filters are easier to scan.

### 6. LLM-Powered Summarization

**Goal:** Help operators avoid reading hundreds of lines when deterministic navigation is not enough.

Design:

- `POST /api/sessions/:id/summarize`
- Cache summaries by session id + transcript hash + prompt version.
- Restrict to completed sessions by default.
- Include: accomplishments, decisions, errors, cost/waste notes, open questions, links to suspicious turns.

Summarization should use the structured turn groups once available, not raw transcript text only.

---

## Implementation Order

| Phase | Slice | Why First |
|-------|-------|-----------|
| 1 | Logs + API session inspector | Immediate turn-level visibility; uses existing transcript data |
| 2 | Session breadcrumb and lineage links | Connects local session detail to top-down project/workflow context |
| 3 | Turn filters and deterministic suspicion badges | Makes waste/errors discoverable without opaque scoring |
| 4 | Normalized API-call read model | Enables sorting/filtering across sessions and reliable cost analysis |
| 5 | Cross-session pattern view | Bottom-up roll-up from one symptom to recurring system issue |
| 6 | Session scoring | Useful once base signals and navigation are trustworthy |
| 7 | LLM summaries | Helpful layer after structured evidence exists |

The original feature list remains valid, but scoring should not lead the implementation. Investigation needs navigation and evidence first.

---

## Data Gaps Summary

| Need | Current Status | Action |
|------|----------------|--------|
| Per-turn API metadata | Partially available in assistant transcript entries | Keep exposing through transcript; later normalize |
| Per-call latency | Not consistently stored | Capture in model call wrapper or session API-call read model |
| Session lineage | Partially available through loop trace, project lineage, parentSessionId, workflowRunId | Add compact `lineage` object to session detail API |
| Turn-level anchors | Not first-class yet | Add stable turn ids in transcript response/UI |
| Cross-session pattern search | Not implemented | Start with deterministic grouping by tool/error/model/project |
| Session summaries | Not implemented | Add cached endpoint after turn groups exist |
| Multi-dimensional scores | Partial evaluations exist | Extend after deterministic suspicion badges prove useful |

---

## Success Criteria

A successful investigation UI lets an operator:

- Start at a project and find the sessions that explain its current state.
- Open a session and see API calls, tool calls, tool results, errors, and cost in one view.
- Move from a session back to its trigger, workflow, parent, children, and project.
- Start from an error or expensive turn and find similar occurrences elsewhere.
- Distinguish evidence from summaries: raw transcript remains available, summaries are cached helpers.
