# Proposal: Split `handler.p95-duration` by workload class

**For:** Hao / may
**From:** arc heartbeat 2026-05-01 ~07:45Z
**Urgency:** LOW — system is healthy; this is a metric-quality fix
**See:** KE-433

## Problem

`handler.p95-duration` is currently red (current ≈ 7.0 min, target
2 min, threshold 10 min). But the red is structural, not symptomatic:

- 14 of the top 5% slowest handlers in the last 6 h are
  `arc:heartbeat-arc` (9×) and `coach:heartbeat-coach` (5×) —
  synthesis-class workloads that legitimately take 5–10 min.
- The other ~10 handler types (evaluator, optimizer, amy, scout, qa)
  finish in under a minute.

p95 over a bimodal distribution doesn't measure regression; it
measures *mix*. Every time arc or coach's synthesis runs more often
relative to the cheap handlers, the metric goes red even though
nothing changed.

## Evidence

```
6h window, 279 done sessions, p95 = 4.83 min
Top-5% breakdown (14 sessions):
  9× arc:workflow:heartbeat-arc
  5× coach:workflow:heartbeat-coach
```

Per-agent means (24 h, status='done'):

| agent     | mean min | max min |
|-----------|----------|---------|
| arc       | 7.2      | 12.7    |
| coach     | 2.6      | 10.1    |
| bob       | 2.4      | 25.0    |
| may       | 2.4      |  5.4    |
| amy       | 2.0      |  3.6    |
| optimizer | 1.0      | 10.0    |
| evaluator | <1       |  3.0    |

## Proposed Change

Replace `handler.p95-duration` (single metric) with **per-class p95**:

1. `handler.p95-cheap` — non-synthesis handlers; threshold 30 s,
   target 5 s. Should always be fast; red here = real regression.
2. `handler.p95-synthesis` — arc, coach common-sense-verify,
   optimizer's optimize; threshold 12 min, target 5 min. Slow by
   nature, but a sustained drift up is informative.

The classification can be a static map from `source` (workflow id)
to class — no runtime classifier needed. Initial assignment:

- synthesis: `workflow:heartbeat-arc`, `workflow:heartbeat-coach`,
  `workflow:common-sense-verify`, `workflow:optimize`
- cheap: everything else

Optionally keep `handler.p95-duration` as a "system-wide" view but
demote its threshold so it stops red-alerting on normal mix.

## Expected Impact

- p95 alerts become actionable: a red `cheap` p95 means an actual
  slow handler; a red `synthesis` p95 means arc/coach work has
  drifted.
- arc stops self-flagging "investigate p95" every heartbeat for a
  problem it largely causes (KE-433).
- bob's 25-min max from 24 h ago becomes visible as an outlier in
  the cheap class instead of being absorbed into the aggregate.

## Risks

- Misclassification: a fast handler tagged synthesis would never
  alert. Mitigation: keep the static map small (≤6 entries) and
  review it whenever a new heartbeat workflow is added.
- Threshold for synthesis (12 min) is generous; if a synthesis
  handler hangs at 30 min it would still alert via the
  per-handler timeout, not via p95. That's fine.

## Next Step If Approved

Owner: tech-lead or may. Implementation is one metric definition
file plus an updated handler-rollup query. The KE-433 entry has the
queries already.
