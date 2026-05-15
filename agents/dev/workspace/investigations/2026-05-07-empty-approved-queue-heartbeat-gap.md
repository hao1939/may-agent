# Empty Approved Queue Heartbeat Gap

## Summary
Dev heartbeat found no unchecked items in `agents/shared/work-queue.md` `## Approved`, so the implementation pipeline has no executable approved work despite a large `## Proposed` backlog. Current runtime metrics do not expose this stage-2 backpressure: no active metric tracks the Approved queue depth or the Proposed-vs-Approved gap.

## Evidence
- `agents/shared/work-queue.md` `## Approved` is empty at heartbeat time.
- `## Proposed` contains many unchecked P0/P1/P2 proposals, including P0 infrastructure fixes, but these are not approved for dev implementation.
- Active metrics queried from `.state/may.db` include handler/session/project/system metrics, but none for work-queue Approved count or Proposed backlog.
- Current health is otherwise green enough that this process gap is easy to miss:
  - `handler.failed-count = 0`
  - `handler.success-rate = 1`
  - `session.error-rate-6h = 0.0141`
  - no active metrics lacked a snapshot in the last hour

## Root Cause
The work-queue process has an explicit Approved gate, but only the file comment at the bottom of `agents/shared/work-queue.md` defines a source command for unchecked Approved items. That source command is not registered as an active metric, so dev heartbeat can discover an empty Approved queue only manually. When May does not promote items from Proposed to Approved, dev has no approved implementation task and the system has no red metric for that state.

## Impact
- P0 proposals can accumulate without triggering dev action because dev is correctly constrained to Approved items.
- Handler/session metrics can remain healthy while the infrastructure improvement pipeline is stalled.
- Heartbeats spend time rediscovering that Approved is empty instead of acting on approved fixes.

## Recommended Fix
Register a dev-owned health metric for Approved queue depth, using the existing command embedded in `work-queue.md`:

```sql
INSERT OR IGNORE INTO metrics (
  id, name, owner, source_command, target, threshold, alert_op,
  type, status, speed, created_at, updated_at
) VALUES (
  'workqueue.approved-unchecked-count',
  'Unchecked approved work-queue items',
  'dev',
  'awk ''/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \\[ \\]/'' agents/shared/work-queue.md | wc -l',
  1, 1, '<', 'health', 'active', 'fast',
  unixepoch()*1000, unixepoch()*1000
);
```

A breach (`current < 1`) should route to May for triage, not to dev implementation, because May/human approval is the missing upstream action.

## Verification Performed
- Read `agents/shared/work-queue.md`; `## Approved` contains no unchecked items.
- Queried readonly DB for active metrics and recent metric snapshots; all active metrics have recent snapshots and none cover work-queue approval depth.
- Queried recent handler/session failures; current handler success metrics are healthy, confirming this is a process visibility gap rather than an immediate handler outage.

## 2026-05-07 Heartbeat Recheck

The gap persists on the next dev heartbeat:

- `agents/shared/work-queue.md` still has an empty `## Approved (dev: pick from here)` section.
- `## Proposed` now contains 20 unchecked items, including multiple P0 fixes dated 2026-05-06/2026-05-07.
- Active metrics still have no work-queue metric; the closest process metrics are project/session/handler counters.
- Current runtime health can mask the queue deadlock: `handler.success-rate = 1`, `handler.failed-count = 0`, `session.error-rate-6h = 0.0286`.

This confirms the issue is not a one-heartbeat transient. Dev's priority-1 instruction is currently a silent no-op unless an operator manually notices the empty gate.

## Additional Recommended Fix

Until the metric can be registered by the system writer, make the heartbeat itself emit an append-only signal when Approved is empty. Arc's proposal `agents/arc/workspace/proposals/2026-05-06-dev-heartbeat-signal-on-empty-approved.md` is lane-clean and would make the gate failure visible in `work-queue.md` without allowing dev to implement unapproved Proposed items.

## 2026-05-07 Second Heartbeat Recheck

The queue backpressure is still present and has grown:

- `approved_unchecked=0` in `agents/shared/work-queue.md`.
- `proposed_unchecked=23`, including multiple P0 items.
- Readonly metrics check found `active_metrics=14` and `workqueue_metrics=0`; there is still no active work-queue metric.
- Current runtime metrics remain mostly green (`handler.success-rate=1`, `handler.failed-count=0`, `session.error-rate-6h=0.0233`), so this process failure remains masked by infrastructure health metrics.

This is now independently observed across repeated dev heartbeats. The highest-impact next action is upstream approval/triage (May/human) or registration of `workqueue.approved-unchecked-count`; dev should not bypass the Approved gate by implementing Proposed items directly.

## 2026-05-07 Third Heartbeat Recheck

The gate remains stuck:

- `approved_unchecked=0` from the `## Approved` section.
- `proposed_unchecked=23` from the `## Proposed` section, including many P0/P1 infrastructure fixes.
- `workqueue_metrics=0` in the active `metrics` table, so there is still no registered metric for this queue state.
- Current health metrics still do not force attention to the queue: `handler.success-rate=1`, `handler.failed-count=0`, `session.error-rate-6h=0.023`; `project.active-count=0` is red-ish but measures project activity, not the unapproved implementation backlog.

Conclusion: this has matured from a transient observation into a persistent process-control failure. Dev has no approved implementation work while the Proposed backlog grows, and the runtime still lacks a metric that points May/human triage at the blocked approval gate.
