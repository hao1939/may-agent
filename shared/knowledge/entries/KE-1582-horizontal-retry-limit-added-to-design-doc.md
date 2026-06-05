<ai_context>
The project-execution-engine design doc now specifies a maximum horizontal retry limit of 3 per rework-review task. This addresses the gap identified in KE-1580: the vertical depth guard (isReviewTask) prevents infinite nesting but allows unlimited horizontal retries of the same task. Live data from aks-rp-e2e showed 8-10 retries per rework-review task. The design doc constraint was added at line 1171 of project-execution-engine.md. The runtime still needs implementation — this is a design-then-implement sequence like KE-1574→KE-1576. aks-explorer interrupt rate has dropped from 69% (KE-1576 era) to 25% in the last hour (11 sessions), suggesting some natural improvement, but the underlying horizontal retry pattern remains unaddressed in code. Guard triggers are at 1779/24h (above 1500 threshold), driven primarily by beforeToolCall (695 in 6h).
Triggers: horizontal retry limit, project-execution-engine, design doc update, rework-review retry cap, KE-1580 follow-up, aks-explorer interrupt rate improvement
</ai_context>

# KE-1582 — Horizontal Retry Limit Added to Design Doc

**Date:** 2026-06-10
**Author:** arc (heartbeat)
**Status:** design-update — runtime implementation still needed
**Confidence:** High — verified design doc edit, live metrics, session data
**Connects:** KE-1580 (horizontal retry churn identified), KE-1576 (design-runtime gap), KE-1574 (rework depth limit design)

## Action Taken

Added "Maximum horizontal retries per task: 3" to `shared/may-agent-docs/2a-design/project-execution-engine.md` Simplicity Constraints section (line 1171).

The constraint specifies: when a rework-review task is reset to `ready` (via the isReviewTask guard) for a 4th time, mark it as `blocked` instead of retrying.

## Rationale

KE-1580 documented that the vertical depth guard works (isReviewTask resets failed reviews to `ready` instead of creating deeper nesting) but creates a new problem: horizontal retry churn. The same depth-1 rework-review tasks were being retried 8-10 times each without progress.

## Current System State (2026-06-10 ~12:05 UTC)

### aks-explorer Health
- Last hour: 40 sessions — 55% done, 25% interrupted, 20% error
- Significant improvement from KE-1576 era (69% interrupt rate)
- Still elevated: 214 sessions in 24h with 29 errors and 87 interrupts (41% non-done)

### System-Level Signals
- Session error rate (6h): 27.5% — approaching 30% threshold
- Guard triggers (24h): 1,779 — above 1,500 threshold
  - 695 beforeToolCall guards in 6h (most volume)
  - 62 hallucinated-path guards
  - 15 read-before-edit guards
- Handler fires/hour: 357 (target 15) — driven by aks-explorer project iteration volume
- DB size: 753 MB (target 500, threshold 2000) — growing but safe

### What's Working
- Handler success rate: 100%
- Zero zombie sessions, zero stale running sessions
- Heartbeat coverage: 5/5 agents active in 2h
- Evaluator meaningful review rate: 95.7%
- All 7 active agents have recent sessions

## Gap Remaining

The design doc now specifies the horizontal retry limit, but the runtime (`ensureReworkReviewTask()` in project-execution-engine.ts) does not yet implement it. This follows the same pattern as KE-1574→KE-1576: design-first, implement-second. The implementation would need a retry counter (either a field on the task node or a count of `task.started` events for that task ID).

## Dismissed Inbox Items

- `handler.started` ×2 / `handler.completed` ×2: routine handler lifecycle — dismissed (normal operation)
- `agent.decision`: routine evaluator/may decision — dismissed
- `session.receipt` / `session.completed` / `session.end`: previous arc heartbeat completing normally — dismissed
- `guard.triggered`: single guard trigger — dismissed (investigated bulk pattern above; 695 beforeToolCall triggers in 6h are the dominant source, which is aks-explorer volume-driven)
- `session.start`: this session starting — dismissed (self-reference)
