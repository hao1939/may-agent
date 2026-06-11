# KE-1837: Watchdog `ready-resume` Lacks Dedup — Design-Reality Gap

**Status**: confirmed
**Discovered**: 2026-06-12
**Agent**: arc (heartbeat coherence audit)
**Confidence**: high — cross-referenced design doc against live event data

## Claim

The project execution engine's design doc (`2a-design/project-execution-engine.md`) specifies dedup_key for escalations and retry limits for planning runs (max 15) and horizontal retries (max 3), but has **no dedup or rate-limit mechanism for watchdog-generated `project.task.execution.requested` events**. This is the root design gap enabling the amplification loop documented in KE-1836.

## Evidence

### Design doc has dedup for escalations, not for execution requests

Line 379 of the design doc: "Use a deterministic `dedup_key` based on project, task, and blocker so repeat wakes do not create noisy duplicate escalations."

Lines 855–863 describe watchdog recovery: emit `project.task.execution.requested` for stuck tasks, but with no dedup_key, no per-task rate limit, and no check whether the task already has a pending request in the event queue.

### Live system data confirms the gap (24h window ending 2026-06-12 ~18:30Z)

| Metric | Value |
|--------|-------|
| Watchdog ticks | 280 |
| Execution requests generated | 913 |
| Requests with reason `watchdog-ready-resume` | 913 (100%) |
| Organic (non-watchdog) execution requests | 0 |
| Amplification factor | 3.3× |
| Single worst task (`staging-live-bootstrap-byo-acr-20260610`) | 190 requests over 2 days |
| `session.resume_failed` events | 220 |

### Retry limits exist but don't cover this path

The design doc specifies:
- Max 3 horizontal retries per task (line ~1494) — but this counts rework-review resets, not watchdog re-requests
- Max 15 planning loop runs (line ~1503) — applies to planning, not worker dispatch
- Dedup_key on escalations (line 379) — applies only to `escalation.created`, not `project.task.execution.requested`

The watchdog's `ready-resume` path bypasses all three limits because it generates fresh execution-request events rather than task status transitions.

## Design Fix Sketch

The dedup_key pattern from escalations should extend to execution requests:

1. **Per-task request dedup**: before emitting `project.task.execution.requested`, check whether an unhandled request for the same taskId already exists in the event queue. If so, skip.
2. **Per-task cooldown**: after a `session.resume_failed` or `handler.failed` for a task, impose an exponential backoff (e.g., 5m → 10m → 20m → cap at 60m) before the watchdog may re-request that task.
3. **Per-task lifetime cap**: after N failed execution attempts (e.g., 5), mark the task `blocked` with reason "exceeded watchdog retry limit" — analogous to the existing max-3 horizontal retry rule.

## Impact

- 913 phantom execution requests/day consume handler capacity
- 220 session.resume_failed events/day add noise to monitoring
- The worst single task generated 190 requests — each spawning a handler start, potential session attempt, and handler completion/failure event chain
- KE-1836 estimated 65% of all execution requests are watchdog-generated; current 24h window shows 100%

## Related

- KE-1836: The Watchdog Amplification Loop (scout discovery of the same phenomenon from a different angle)
- project-execution-engine.md §Dispatch rules, §Watchdog recovery
