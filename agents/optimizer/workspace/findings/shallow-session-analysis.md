# Shallow Session Analysis (≤3 ops)

**Date**: 2026-06-01  
**Status**: Resolved (root causes identified, one already self-corrected)

## Data (last 6h)

| Agent | Total | Shallow (≤3 ops) | % |
|-------|-------|-------------------|---|
| optimizer | 219 | 176 | 80% |
| evaluator | 157 | 144 | 92% |
| coach | 92 | 43 | 47% |
| may | 30 | 7 | 23% |
| amy | 19 | 2 | 11% |

**System-wide**: 568 sessions, 374 shallow (66%)

## Root Causes

### 1. Closed-project workflow churn (RESOLVED)
- **optimizer** had 198 shallow sessions from `workflow:worker` and `workflow:orchestrator` sources
- All tied to `optimizer/system-efficiency` (105) and `optimizer/test-coverage` (93)
- These were master-worker iterations repeatedly saying "project is complete, stop dispatching"
- **Self-resolved**: Last such session was at 02:49 UTC. Projects now status=closed → no more launches.
- The `project-health.ts` correctly skips `closed` projects. The issue was the workflow had a long wind-down period of the orchestrator calling workers who immediately bail.

### 2. Evaluator standalone-eval jobs (BY DESIGN)
- 144 shallow sessions from `standalone-eval` source
- These are evaluation sessions that complete successfully with full JSON output in ≤3 ops
- They produce a complete evaluation in 1-3 tool calls — this is EFFICIENT, not wasteful
- **Verdict**: Not a problem. These are fast-completing jobs.

### 3. Heartbeat sessions with nothing to do (ACCEPTABLE)
- 4 optimizer heartbeat sessions completed with 0-3 ops
- When all projects are closed and metrics healthy, a heartbeat correctly finishes quickly
- **Verdict**: Acceptable — doing unnecessary work would be worse waste.

## Recommendations

1. **No action needed** for evaluator or heartbeat shallow sessions
2. The project churn is now resolved. Monitor next 6h to confirm zero project-related shallow sessions.
3. Consider adding a metric: `workflow.unnecessary-iterations` to catch future cases where closed/done projects get repeatedly dispatched.

## Disposition of P0 Notification
**Dismiss** — the 75% shallow rate was inflated by a one-time wind-down event (projects closing). The rate should normalize within the next heartbeat cycle.
