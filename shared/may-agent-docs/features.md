# Feature Checklist — Agent System Hardening

**Owner**: Hao
**Purpose**: The authoritative list of features the agent system must have. Each feature is grounded in a real problem. Design docs and conventions follow from this list, not the other way around.

**Design principle**: Agents and humans use the same tools. May manages the team autonomously — tracking work, following up, handling failures. The human uses the same tools when they want to investigate or intervene. No separate admin interfaces. If May can ask "what's stuck?", the human can type the same thing in the console.

---

## How to Read This

- **Status**: `[ ]` not started, `[~]` partially built, `[x]` done
- **Layers**:
  - **Infra**: What the system handles automatically (zero agent burden)
  - **Admin**: Tools available to both May (autonomous) and the human (when investigating). Same interface, same data.
  - **Agent**: What agents are responsible for (behavioral)
- **Design doc**: Link to detailed design in `docs/design/`
- **Convention**: Link to agent convention/practice in `agents/shared/`

---

## Track A: Agent Simplification

*Make agents' lives simpler. Fewer tools, fewer ceremony steps, less to learn.*

### F1. Simplify Agent Communication

**Problem**: Agents have 3 communication tools (call, send, handoff), 2 files to check (todo.md + SIGNALS.md), manual ACK ceremony, 28-line dedup protocol. SIGNALS.md grew to 8K+ lines. handoff is used 1 time total. This is too much machinery for what agents actually do: delegate work (call/send) and report completion (finish).

**Requirement**: 2 communication tools (call, send), 1 file to check (todo.md), zero ceremony. Delete handoff, SIGNALS.md, and dedup protocol. Merge handoff's useful fields (artifact, context, expectations) into send() as optional parameters.

**Status**: `[x]` — All phases shipped including Phase 7 cleanup

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | requests.ts shipped. send() tracks requests. send-tool.ts gives leaf agents send(). Dead code deleted (orders.ts, session-recovery.ts, handoff-tool.ts). Coordination preset removed. | SIGNALS.md still exists (665 bytes placeholder) — scheduled for deletion after transition period. |
| Agent | CONVENTIONS.md rewritten, best-practices.md cleaned up, heartbeats updated. | Residual SIGNALS refs in some agent docs (low priority). |

**Design doc**: [`docs/design/request-tracking.md`](design/request-tracking.md)

---

### F2. Structured Result Passing

**Problem**: call() returns `lastAssistantText` — a text blob. The caller has to parse natural language to figure out what happened. finish() captures structured data (status, deliverables, blockers) but it goes to session-outcomes.jsonl instead of back to the caller.

**Requirement**: finish() structured data flows back to call() callers as structured data, not just text.

**Status**: `[x]` — Shipped (commit 15dec6c)

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | `finishResult` in TaskResult. finish() data flows back to call() callers as structured data. handleCompletion wires it. | None — complete. |
| Agent | None needed | None needed — pure infra wiring. |

**Design doc**: Part of [`docs/design/request-tracking.md`](design/request-tracking.md)

---

### F3. Reduce Agent Ceremony

**Problem**: Agents spend 2-3 turns per heartbeat reading config files before doing real work. C44 (verify after write) costs 1 extra tool call per edit despite edit() already returning a diff. Agents manually update todo.md and write journal entries — mechanical chores unrelated to their actual task.

**Requirement**: Infra absorbs ceremony. Agents start working faster and finish with one call.

**Status**: `[x]` — Shipped (commit 02961fd + context injection + finish()-driven todo/memory)

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | heartbeat.md, todo.md, common-sense.md auto-injected into heartbeat context. heartbeat.md in cross-edit-guard. edit() returns inline diff. write() returns content preview. finish() accepts completed_items/new_items — infra auto-updates todo.md post-session. Memory system uses finish() structured data instead of raw last-assistant-text. | Journal removal from heartbeat instructions (behavioral). |
| Agent | C44 simplified — agents check returned diff/preview instead of re-reading. Agents declare completed/new items in finish() instead of manually editing todo.md. | Agents must adopt finish(completed_items, new_items) pattern. Journal writing can stop. |

**Design doc**: None needed — individual items are small code changes
**Convention**: `agents/shared/common-sense.md` §2.3

---

## Track B: Admin Tools

*Tools for managing the system — used by May autonomously and by the human when investigating. Same interface, same data. No separate dashboards.*

### F4. Request Tracking

**Problem**: 766 send()s with 0 feedback. May sends 76 tasks to tech-lead — no way to know which got done. The human checks in and can't answer "what's outstanding?" either. The only option is `peek` at raw session messages or `list` running sessions — neither answers the question.

Today May tries to supervise with list/peek/cancel (975 + 670 + 5461 calls). Same tools the human would use. Both are doing admin work with the wrong tools.

**Requirement**: May can query request status. "What did I send to tech-lead?" "What's stale?" "What failed?" A request is any call() or send() — tracked automatically by infra, queryable by May.

**Status**: `[x]` — Shipped (requests.db + request-status.ts + agents "requests" action)

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | `requests.db` (SQLite). Auto-tracks call/send. Auto-updates on completion. ~200 lines replacing ~500 of JSONL. | None — complete. |
| Admin | `agents(action: "requests", filter: "stale/failed/active/all")` works. May and human query the same data. | Request tree view (parentRequestId CTE) — nice-to-have. |
| Agent | Agents call finish() (~40% of sessions now). | **No new burden.** Agents just keep calling finish(). |

**Design doc**: [`docs/design/request-tracking.md`](design/request-tracking.md)

---

### F5. Auto-Escalation

**Problem**: When things go wrong, nobody finds out. finish(blocked) writes to a file nobody reads. Recovery exhaustion logs "escalating" but does nothing. Logic errors are silently archived. `onSessionBlocked` is defined but never wired. 244 recovery escalations went nowhere.

May should be notified automatically — she's the admin. She decides what to do.

**Requirement**: Every failure path produces a todo item in May's queue. Zero agent burden — agents just call finish() honestly. Infra reads the status and routes the notification.

**Status**: `[x]` — Shipped (commits 489c3df, c6fcad8)

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | onSessionBlocked wired. handleCompletion routes blocked/failure to parent todo.md. Recovery exhaustion writes to May's todo.md. | None — complete. |
| Admin | Failures appear as todo items for May or visible via requests query. | None — complete. |
| Agent | Agents call finish(status, blockers). | **No new burden.** Honest finish() is all that's needed. |

**Design doc**: Part of [`docs/design/request-tracking.md`](design/request-tracking.md)

---

### F6. Crash Recovery

**Problem**: Recovery is split across 3 overlapping mechanisms. Session resume works. Infra retry works. But orders.ts and session-recovery.ts are write-only dead code — getPendingOrders() and getPendingRecoveries() exist but are never called. 244 escalations went nowhere.

May should know what was lost after a crash and what was recovered.

**Requirement**: On startup, query request DB for incomplete requests with no live session. Resume or re-trigger. Report to May what was recovered and what was lost.

**Status**: `[x]` — Dead code removed, session resume + infra retry work

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | Session resume via [STARTED] sentinel. Infra retry via classifyError(). requests.db tracks all requests. Dead code (orders.ts, session-recovery.ts) deleted. | Startup query for orphaned IN_PROGRESS requests (nice-to-have). |
| Admin | requests query shows failed/stale — May can act on it. | Post-restart summary (nice-to-have). |
| Agent | None needed | None needed |

**Design doc**: Part of [`docs/design/request-tracking.md`](design/request-tracking.md)

---

### F7. Request Observability

**Problem**: Nobody can answer "what's the system working on right now?" with full context. `status` shows running sessions but not the request tree (human asked → May delegated → tech-lead called coder → ...).

May needs situational awareness to manage effectively.

**Requirement**: May can see the full request tree — who asked for what, who's working on it, what's the chain of delegation.

**Status**: `[~]`

| Layer | What exists | What's missing |
|-------|------------|---------------|
| Infra | system-status reads delegations.jsonl + active sessions. | Request tree via parentRequestId chain in requests.db. Recursive CTE query. |
| Admin | `status` command shows flat session list. | `agents(action: "requests", view: "tree")` shows delegation chains: "human asked X → May sent to tech-lead → tech-lead called coder → coder working". |
| Agent | None needed | None needed |

**Design doc**: Part of [`docs/design/request-tracking.md`](design/request-tracking.md)

---

## Feature Backlog

Features identified but not yet scoped:

- **F8. Structured todo.md** — Replace freeform markdown with structured task entries (id, priority, from, status). Enables mechanical tracking instead of text parsing.
- **F9. Budget awareness** — Agents can see remaining opBudget. Plan work within constraints instead of getting cut off mid-task.
- **F10. Cross-agent feedback pairs** — Bob↔Tech-Lead, Coach↔Optimizer read each other's output and provide feedback. Currently defined in SOULs but no infra support.
- **F11. Knowledge query tool** — Agents can search shared knowledge without knowing file paths. Currently must know exact paths.

---

## Implementation Notes

### What Track A and Track B share

Track A (agent simplification) and Track B (May admin tools) share the same underlying infrastructure:

- **requests.db** serves both: Track A uses it for dedup (infra checks before writing to todo.md). Track B uses it for queries (May asks "what's stale?").
- **handleCompletion()** serves both: Track A uses it for structured result passing. Track B uses it for escalation and status updates.
- **send() changes** serve both: Track A merges handoff fields into send(). Track B records the request.

They should be implemented together — one pass through the code, both tracks benefit.

### What can ship independently

- F1 (SIGNALS.md deletion, handoff deletion) — pure removal, no dependencies
- F2 (structured result passing) — 10 lines in handleCompletion()
- F3 (todo.md injection, heartbeat.md guard) — small targeted changes
- F5 (escalation wiring) — 20 lines in handleCompletion(), only needs a way to write to agent todo.md

### What requires requests.db

- F4 (request tracking queries for May)
- F6 (crash recovery via DB query)
- F7 (request tree via recursive CTE)
- F1 dedup (infra checks DB instead of Bob grepping SIGNALS.md)

---

## Changelog

- **2026-03-13**: Created. F1-F5 scoped from codebase audit. F6-F10 listed as backlog.
- **2026-03-13**: Promoted escalation to F6, added ceremony reduction (F7), recovery simplification (F8).
- **2026-03-13**: Restructured into Track A (agent simplification) and Track B (May admin tools). Reframed: May is the system admin, not the human. Features give May management capability. Consolidated overlapping features. Renumbered F1-F7.
- **2026-03-13**: F1 updated — code shipped (Phases 1-6), Phase 7 cleanup scoped: dead code deletion, dead agent files (SIGNALS.md 424KB, 11 skill dirs), best-practices.md rewrite (~300 lines contradictory content), CONVENTIONS.md C1/C4 rewrite, heartbeat/SOUL SIGNALS removal.
- **2026-03-17**: F1 through F6 marked complete. All code shipped, dead code removed, docs updated.
