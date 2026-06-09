# KE-1739 — The Escalation Graveyard: 35 Created, Zero Resolved

**Status**: active
**Created**: 2026-06-13
**Author**: arc (heartbeat coherence audit)
**Source**: Production DB analysis + escalation.md design doc cross-check

## Key Finding

The escalation lifecycle is structurally incomplete: **35 `escalation.created` events exist in the database, 0 `escalation.resolved` or `escalation.dismissed` events exist**. Every escalation ever created is technically "open" — including ones where the underlying problem resolved itself days ago.

## The Data

```
escalation.created:   35  (all time)
escalation.routed:    35  (Slice 2 works — May routes them)
escalation.resolved:   0  (Slice 3 never built)
escalation.dismissed:  0
escalation.resumed:    0  (Slice 4 has no inputs)
```

### Repeat Escalation Clusters

The evaluator created 8 near-identical escalations for the same metric breach (`evaluator.substantive-low-quality-rate-24h`) over a ~36-hour window (timestamps 1780787431718 → 1780818300019). Each session independently investigated, found the same root cause (aks-explorer error/interrupted churn), and escalated to human. The metric has since recovered to 0.0 — but all 8 escalations remain "open" in the DB.

| Source Agent | Count | Dominant Pattern |
|---|---|---|
| scout | 22 | Various session-finish blockers |
| evaluator | 11 | 8× substantive-low-quality, 2× failed-triage-rate, 1× other |
| dev | 1 | — |
| aks-explorer | 1 | ManagedSystem SKU blocker |

### Why No Resolution?

1. **No agent emits `escalation.resolved`.** The design doc (escalation.md) documents Slices 3-5 as "unbuilt." No handler, skill, or workflow produces resolution events.
2. **No `dedupKey` populated.** All 35 escalations have `dedupKey: null`. The session-finish boundary code doesn't populate it, so duplicate suppression never fires.
3. **No owner closure loop.** When May routes an escalation (Slice 2), the owner receives a message but has no convention or tool to emit `escalation.resolved` when they fix the problem. The escalation is fire-and-forget from the owner's perspective.

## Consequences

1. **Phantom open count**: Any future `escalation.open-count` metric would show 35 open escalations — all stale. A dashboard or alerting surface built on this would be misleading from day one.
2. **Repeat escalation waste**: Without dedupKey, the evaluator spent 8 sessions escalating the same issue. Each session used 33-56 ops investigating and writing the escalation. That's ~350 ops for 7 redundant escalations.
3. **Dead resume code**: `src/lib/escalation-lifecycle.ts` subscribes to `escalation.resolved` to drive session resume — but it has never received an event. The resume mechanism is untested in production.

## Relationship to Existing Knowledge

- **KE-1710** documents the Groundhog Day loop where agents rediscover the same blocker. The escalation graveyard is the *structural* reason: there's no feedback signal that a previous escalation already covers this issue.
- **escalation.md cross-check table** (updated 2026-06-08) correctly identifies Slices 3-5 as unbuilt but doesn't quantify the accumulating cost.

## Actionable Implications

For any future implementation of Slice 3 (resolution):

1. **Backfill**: the 35 existing orphan escalations should be bulk-dismissed with outcome `superseded` at implementation time. They are all stale.
2. **dedupKey**: the session-finish boundary must populate `dedupKey` from a stable hash of (source agent + reason prefix + metric id if applicable) to prevent repeat escalations.
3. **Auto-resolution**: when a metric recovers below threshold, any escalation created by that metric's alert triage should be auto-resolved with outcome `superseded` — the signal resolved itself.

## Falsification

This finding would be wrong if:
- F1: There's a resolution mechanism outside the event bus (e.g., manual DB updates or message-based closure). **Checked**: no evidence of any alternative closure path.
- F2: The 35 "open" escalations are still genuinely open blockers. **Checked**: the dominant cluster (evaluator substantive-low-quality) has `current=0.0`, well below threshold. The blockers resolved organically.
