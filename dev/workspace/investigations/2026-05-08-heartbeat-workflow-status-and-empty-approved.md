# Dev heartbeat: workflow status reality check and empty Approved queue

Date: 2026-05-08
Agent: dev

## Goal

Triage the current heartbeat signals, act on any dev-owned actionable failure, and leave evidence for why no code patch was warranted.

## Signals reviewed

### Work queue

`agents/shared/work-queue.md` still has no unchecked items under `## Approved`. All implementation candidates remain under `## Proposed (needs review)`, so dev has no approved queue item to implement.

### Current runtime health

Current active metrics show the core dev heartbeat checks healthy:

- `session.error-rate-6h = 0` against threshold `> 0.3`
- `handler.success-rate = 1` against threshold `< 0.8`
- `handler.failed-count = 0` against threshold `> 10`
- no active metric was missing a snapshot in the last hour

Recent handler failures are stale: the 6h event count for `handler.failed` returned zero rows; the only 6h delivery-failure residue was one evaluator `message.delivery_failed` to invalid target `functions.message`, already outside dev's editable runtime surface per the earlier investigation.

### Pending inbox events

The visible dev inbox items are heartbeat/session lifecycle noise:

- Recent `session.end` for dev's prior heartbeat is useful evidence that the generic heartbeat standardization landed, but its corresponding `workflow_runs` row is still marked `escalated` with no `result_reason`.
- Recent `session.start` ×3 is expected concurrent heartbeat dispatch for dev/scout/arc and not a dev action item.
- Older dev `session.end` items document prior triage loops and can be dismissed as already acted on.

### Workflow status reality gap

One non-obvious issue remains visible in data: the prior dev heartbeat session `s_1778201190940_140` ended with session status `done` and a successful `finishParams` summary, yet its parent workflow run `wr_1778201190933_pbop` is recorded as `status='escalated'` with `result_reason=NULL`.

Evidence:

- DB `sessions`/event data shows the child session finished `done` and committed `cf79ca5f2`.
- DB `workflow_runs` shows `wr_1778201190933_pbop | dev-heartbeat | escalated | result_reason=NULL`.
- Later heartbeat workflow rows after that commit show some successful fast `done` runs (`scout-heartbeat`, `may-heartbeat`, `evaluator-heartbeat`), so this is not currently a universal heartbeat outage.

Judgment: this is worth watching but not safe to patch from this heartbeat without a concrete runtime call stack. The workflow status writer is not obvious in `/app/agents` from grep, and the current metrics are green. Treat as a documented reality-gap signal, not an immediate code change.

## Decision

Routine self-maintenance is sufficient this turn:

1. Dismiss prior dev `session.end` events as already acted on or documented.
2. Dismiss recent `session.start` events as normal concurrent heartbeat lifecycle.
3. Do not implement Proposed work-queue items without approval.
4. Do not patch message-target rejection here; the editable repo does not contain the message API implementation and prior evidence already escalated that runtime gap.
5. Leave this artifact so the workflow status mismatch is not lost if it recurs.

## Next validation signals

- Next metrics snapshot should keep `handler.success-rate` and `session.error-rate-6h` healthy.
- Future `workflow_runs` rows for `dev-heartbeat` should be checked for `status='done'` after successful child sessions.
- If successful sessions continue mapping to `workflow_runs.status='escalated'` with null reasons, create an approved/shared project or proposal to trace workflow result-state persistence.
