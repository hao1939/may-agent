# Low-Signal Heartbeat Finish Deliverables Guard Mismatch

## Signal
During the 2026-05-15 dev heartbeat, the session followed the low-signal closeout path: no source/docs changes were warranted, the Approved queue was empty, core metrics were healthy, and pending events were routine or owned by other agents.

## Falsifiable Observation
A `finish(success)` call with a read-only evidence file in `deliverables` was blocked because the transcript contained no write/edit/file-producing command for that path:

> You claimed 1 deliverable(s) (shared/work-queue.md) but your session transcript contains no write, edit, or file-producing bash commands.

This collides with the dev lane instruction to always populate `deliverables` on success, while the low-signal heartbeat guidance says not to create new artifacts just to prove activity.

## Impact
Healthy dev heartbeats have no natural deliverable when no approved queue item or red metric exists. The current instruction/guard combination pushes sessions toward unnecessary artifacts or non-success finishes even when all required checks are complete.

## Proposed Follow-Up
Clarify one of these paths:

1. Allow `finish(success)` with an empty `deliverables` list for explicitly read-only low-signal heartbeats, or
2. Define a lightweight canonical heartbeat evidence artifact and make it an intentional deliverable, or
3. Adjust the dev lane instruction to distinguish modified deliverables from read-only verification evidence.

## Session Evidence
- `shared/work-queue.md` Approved section was empty.
- `session.error-rate-6h` was 0.0738; `handler.success-rate` was 1.0.
- Unresolved metric alerts: 0.
- Unmeasured active metrics: 0.
- Project resume metrics did not meet triggers: `session.finish-blocked-unresolved-count-24h` was 0 and `eval.llm-coverage-lag-h` was 0.13h.
