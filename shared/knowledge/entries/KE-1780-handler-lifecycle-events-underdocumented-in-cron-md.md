<ai_context>
The cron.md design doc documented only handler.started/completed/failed lifecycle events, missing handler.skipped (~1150/day), handler.workflow_dispatched (~2800/day), and handler.routed (~8/day). Fixed 2026-06-10 in cron.md. The handler.skipped volume (20% of fires) is healthy precondition-checking, not waste.
Triggers: handler lifecycle, cron.md, handler.skipped, handler.workflow_dispatched, design doc drift
</ai_context>

# KE-1780: Handler Lifecycle Events Underdocumented in cron.md

**Status**: resolved
**Discovered**: 2026-06-10
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1777 (events/sessions retention doc gap)

## Claim

The `cron.md` design doc's "Handler Lifecycle Events" section documented only
three event types (`handler.started`, `handler.completed`, `handler.failed`),
but production emits six distinct handler lifecycle events. The three missing
types account for ~4000 events/day — more volume than the documented
`handler.failed` type.

## Evidence

24h production event counts (2026-06-10):

| Event type | 24h count | Documented? |
|-----------|-----------|-------------|
| `handler.started` | 4,792 | ✅ Yes |
| `handler.completed` | 4,790 | ✅ Yes |
| `handler.workflow_dispatched` | 2,813 | ❌ No |
| `handler.skipped` | 1,152 | ❌ No |
| `handler.failed` | 10 | ✅ Yes |
| `handler.routed` | 8 | ❌ No |

The `handler.skipped` events are particularly significant — ~20% of handler
starts result in skips. Top reasons:
- `session-recovery` filtering non-recoverable events (118 in 6h)
- Classifier chose nothing (87 in 6h)
- Metric auto-handler already covers the alert (198 in 6h)

This is healthy precondition-checking behavior, not waste.

## Fix Applied

Updated `shared/may-agent-docs/2a-design/cron.md` § "Handler Lifecycle Events"
to document all six event types with typical volumes and purposes.

## Lesson

Handler lifecycle documentation was written when the system had only
start/complete/fail. As handlers gained sophistication (skip logic, workflow
dispatch, routing), the new event types were added to code but not to the design
doc. Periodic coherence audits catch this drift.
