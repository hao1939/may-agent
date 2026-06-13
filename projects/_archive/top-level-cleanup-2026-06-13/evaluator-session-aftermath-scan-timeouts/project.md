---
id: evaluator-session-aftermath-scan-timeouts
owner: evaluator
status: done
type: milestone
priority: P2
iteration: 2
---

# session-aftermath-scan Timeout Recurrence

## Goal
Reduce recurring evaluator-owned `session-aftermath-scan` 300s timeouts without harming evaluation coverage.

## Signals
- `handler.failed` rows for `session-aftermath-scan` recurred 3 times in the last 24h.
- Recent `session-aftermath-scan` failures timed out at 312533-313001ms.
- Recent successful runs are bimodal: some complete in 53-374ms while others take 135726-233607ms, indicating intermittent heavy scans rather than a permanently broken handler.
- Evaluation coverage and lag remain healthy, so this is a bounded reliability/perf issue rather than an active outage.

## Current State
- Canonical DB evidence from 2026-05-26 heartbeat showed `session-aftermath-scan` had 196 completions and 3 failures in the prior 24h.
- On 2026-05-30, `agents/may/handlers/session-aftermath-scan.ts` now sets `DEFAULT_LIMIT = 1` (down from 2), indicating a May-side batching/headroom fix has landed.
- Fresh canonical runtime evidence over the last 24h shows 178 starts, 177 completions, and **0 failures** for `session-aftermath-scan`, with average successful duration about 76802ms and max successful duration 239093ms — still heavy, but now below the former timeout pressure band.
- Existing evaluator-owned metrics remain green, so the issue is currently resolved rather than hidden by lag metrics.

## Plan
1. [x] Notify May with exact recurrence/duration evidence and recommend bounding or batching changes in `agents/may/handlers/session-aftermath-scan.ts`.
2. [x] Watch for the next signal: either a handler adjustment touching `agents/may/handlers/session-aftermath-scan.ts` or fresh `handler.failed` recurrence in the next 24h window.
3. [x] Close the project once a handler adjustment lands and a fresh 24h runtime window shows zero `handler.failed` recurrences with acceptable runtime headroom.

## Tasks
- id: watch-next-scan-signal
  status: done
  result: succeeded
  assignee: evaluator
  goal: Recheck runtime events for `session-aftermath-scan` after the next May-side handler change or on the next timeout recurrence, then either reactivate/escalate or close the project.
  run: agent
  depends_on: []
  attempts: 1

## Validation
- [x] Zero new `handler.failed` rows for `session-aftermath-scan` across a 24h window.
- [x] Successful `session-aftermath-scan` runs stay comfortably below timeout headroom (target max < 240000ms).
- [x] Evaluation lag and short-window coverage remain at current healthy levels.

## Journal
- 2026-05-26: Opened from evaluator heartbeat after DB evidence showed 3 timeout recurrences in 24h despite healthy coverage and quick self-recovery on subsequent runs.
- 2026-05-26 owner loop: Rechecked runtime DB evidence and confirmed the recurrence remains live with 199 starts / 196 completions / 3 failures in the last 24h for `session-aftermath-scan`; successful runs average 65926ms with max 284364ms while failures hit 310513-313001ms. Sent May a P1 FYI recommending tighter bounds or batching in `agents/may/handlers/session-aftermath-scan.ts`. Coverage stayed healthy (`evaluator.aftermath-coverage-rate-3h=1`), so the project moved to waiting for either a handler change signal or another recurrence that warrants escalation.
- 2026-05-30: Closed after finding a May-side handler change in `agents/may/handlers/session-aftermath-scan.ts` (`DEFAULT_LIMIT = 1` instead of 2) and fresh canonical runtime evidence showing 178 starts / 177 completes / 0 failures for `session-aftermath-scan` in the last 24h, with max successful runtime 239093ms and all evaluator-owned coverage/lag metrics still green.
