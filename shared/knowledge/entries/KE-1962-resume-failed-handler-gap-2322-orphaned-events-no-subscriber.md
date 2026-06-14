---
id: KE-1962
title: "Resume-Failed Handler Gap — 2,322 Orphaned Events, No Subscriber"
date: 2026-06-14
author: arc
status: active
tags: [resume-failed, handler-gap, event-leak, session-lifecycle, investigation, may-request]
related: [KE-1932, KE-1951, KE-1837, KE-1785]
---

## Context

May sent arc a P1 investigation request: `session.resume_failed` events are leaking — 2,299+ pending with no handler. This KE documents the investigation findings.

## Claim

`session.resume_failed` is emitted by `manager.ts` (line 287) when session resume fails, but **no handler subscribes to this event type**. All 2,322 events ever emitted have `handled_by = NULL` and `status = 'pending'`. They accumulate indefinitely in the events table until the 7-day db-retention sweep deletes them. This is both a DB waste issue and a signal gap.

## Evidence

### Handler gap confirmation

- `grep -rn "resume_failed" agents/*/handlers/*.ts` → zero matches (excluding test files and comments)
- No cron.json entry references `session.resume_failed`
- `SELECT handled_by, COUNT(*) FROM events WHERE event_type = 'session.resume_failed' GROUP BY handled_by` → `{NULL: 2322}`

### Volume (7-day retention window)

| Day (relative) | Resume Fails | Handler Starts | Fail/Start Ratio |
|----------------|-------------|----------------|-----------------|
| day 2 | 271 | 5,202 | 5.2% |
| day 3 | 200 | 5,124 | 3.9% |
| day 4 | 343 | 5,201 | 6.6% |
| day 5 | 780 | 5,858 | 13.3% |
| day 6 | 727 | 5,759 | 12.6% |

### Composition (last 24h, 727 events)

All 727 events share: `category = "session_not_found"`, `recoverable = false`, `nextAction = "escalate"`.

Source breakdown by session ID prefix:
| Prefix | Count | Share |
|--------|-------|-------|
| `s_project_planner_*` | 400 | 55% |
| `s_problem_aks-rp-e2e_*` | 70 | 10% |
| `s_task_network-*` | 55 | 8% |
| `s_task_aad-rbac-*` | 14 | 2% |
| Other `s_task_*` | ~188 | 26% |

Each session ID appears exactly once (no retries of the same session).

### Root cause chain

1. The project workflow (watchdog/planner) creates deterministic session IDs (e.g., `s_project_planner_planning_update_20260614080615_4qsjrj`)
2. The workflow tries to resume these sessions, expecting them to exist
3. They don't exist in the sessions DB (never started, or were cleaned up)
4. `manager.executeResume` → `emitSessionResumeFailed` with `category: "session_not_found"`
5. The event is emitted to the bus but no handler subscribes to `session.resume_failed`
6. Event sits as `pending` / `handled_by: NULL` until db-retention deletes it after 7 days

### Impact

- **DB waste**: 700+ rows/day with no consumer, ~2,300 accumulated at any time
- **Signal gap**: Nobody is alerted when sessions fail to resume
- **Handler waste**: Each failed resume attempt goes through the full handler.started → handler.completed cycle

## Assessment of May's Options

May proposed three options:
- **A. Add a handler** that marks events as handled → stopgap, hides the symptom
- **B. Add to db-retention** for auto-cleanup → events already expire at 7d via existing retention
- **C. Fix the retry loop** → root cause fix, but requires src/ change (ORDER-010)

**Preferred: C + A combined.**

- Option B is already effectively in place (7d retention covers events)
- Option A (handler) would provide visibility and prevent `pending` accumulation but doesn't fix the root cause
- Option C (dedup_key from KE-1837 design spec) would prevent the generation of deterministic session IDs that are never created. This is a src/ change requiring Hao's approval per ORDER-010.

## Recommendation

1. **Immediate (agent-lane)**: No handler-side fix can prevent the emission — `emitSessionResumeFailed` is in manager.ts (src/). A handler that subscribes to `session.resume_failed` and marks events as handled would reduce pending accumulation but not the underlying waste.
2. **Root cause (src/ change, ORDER-010)**: Implement dedup_key from KE-1837's design spec to prevent the workflow from generating session IDs for sessions that will never exist.
3. **Escalate to Hao**: The resume_failed rate (12-13% of handler starts) represents structural waste that only a src/ change can fix.

## Falsifiers

- F1: If a handler subscribing to `session.resume_failed` is added, `handled_by` should populate for new events and the pending count should not grow beyond a few hours' backlog.
- F2: If dedup_key is implemented in src/, resume_failed events/day should drop >80% (from 700+ to <150) within 24h.
