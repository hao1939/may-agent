# Agent-Metrics Doc/Registry Drift (3 cells + 1 missing row)

<ai_context>
summary: Three threshold cells in shared/may-agent-docs/design/agent-metrics.md disagreed with the runtime metrics table (the registry of record per KE-722). One metric the table claimed (low-quality-rate at 0.30) was actually two distinct metrics in the registry — a P3 broad dashboard signal (0.80) and a P1 substantive variant (0.30). Fixed direct in the design dir (arc lane).
triggers: agent-metrics.md, registry drift, KE-722, evaluator.low-quality-rate-24h, evaluator.substantive-low-quality-rate-24h, session.first-turn-error-count-1h, metric.stale-active-count
last_updated: 2026-05-12
source_basis: query_db against metrics table 2026-05-12 ~16:00Z vs shared/may-agent-docs/design/agent-metrics.md
</ai_context>

## What I found

Coherence audit of `shared/may-agent-docs/design/agent-metrics.md` against the live `metrics` table:

| Metric ID | Doc threshold | Registry threshold | Notes |
|---|---|---|---|
| `session.first-turn-error-count-1h` | 0 | **5** | Doc claimed zero-tolerance; registry actually allows 5 errors/h before alerting. |
| `evaluator.low-quality-rate-24h` | 0.30 | **0.80** | Doc number was wrong for this ID. The 0.30 threshold belongs to a sibling metric. |
| `evaluator.substantive-low-quality-rate-24h` | (absent) | 0.30 | The P1 metric whose 0.30 threshold the doc was misattributing — wasn't in the doc at all. |
| `metric.stale-active-count` | 0 | **2** | Threshold is 2, not 0. |

Verified via `query_db` on `metrics` table at 2026-05-12 ~16:00Z. The metrics-snapshot registry (`agents/may/handlers/metrics-snapshot.ts` lines 47–98) is the durable source of record per KE-722.

## Why it matters

`agent-metrics.md` is loaded by humans and agents doing alert triage. Two of the four drifts (first-turn-error threshold, stale-active threshold) describe the metric as zero-tolerance when it isn't — agents reading the doc would expect any non-zero value to alert and pre-emptively investigate noise that the system intentionally tolerates. The low-quality-rate confusion is worse: a P3 dashboard-only signal was conflated with a P1 actionable metric, so an agent looking at red on the P3 might inappropriately escalate, or a P1 breach on the substantive variant might be mis-explained against the broad-signal description.

## What I changed

Edited `shared/may-agent-docs/design/agent-metrics.md` (arc direct-fix lane per heartbeat lane rules):
- Updated `session.first-turn-error-count-1h` threshold to 5.
- Annotated `evaluator.low-quality-rate-24h` as dashboard-only P3 and corrected threshold to 0.80.
- Added a row for `evaluator.substantive-low-quality-rate-24h` (P1 actionable variant, threshold 0.30).
- Updated `metric.stale-active-count` threshold to 2.

No registry change; the runtime was already correct.

## Pattern (recurrence)

This is the third doc/registry drift in `agent-metrics.md` caught by an arc coherence audit (prior: KE-722 itself, the KE-726 follow-up). The pattern: registry constants get tuned (threshold raised after a noise complaint, new sibling metric added) but the doc table — which lives in a different file — doesn't move with it. Possible mitigations for future work, none acted on this session:
1. Generate the doc table from `ALL_METRICS` (single source of truth at file-level, not just "registry wins in doctrine").
2. A test that diffs the markdown table against `ALL_METRICS` and fails CI on drift.
3. Or accept drift as the steady state and rely on periodic arc audits (status quo).
