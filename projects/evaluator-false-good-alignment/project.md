---
id: evaluator-false-good-alignment
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 0
---

# Evaluator False-Good Alignment

## Goal
Align `evaluator.false-good-rate-sample` with the real evaluator quality question so the metric only flags meaningful heuristic over-credit, not passing-grade `good -> acceptable` review outcomes.

## Signals
- `evaluator.false-good-rate-sample` target `< 0.05`; current metric row `0.0833` on 2026-06-19 heartbeat
- Fresh 24h event recompute shows `3` `evaluation.false_good` events, keeping the metric above target
- Fresh in-window `evaluation.false_good` mix is `2` `good -> acceptable` plus `1` `good -> needs_improvement`
- Shared work queue still has an open proposal to exclude `good -> acceptable` vocabulary mismatches from this metric

## Current State
This is still not an alert-threshold incident, but it remains a durable target-miss with a known semantics gap and fresh recurring evidence.

- Live metrics now show `evaluator.false-good-rate-sample = 0.0833`, above the `0.05` target but still far below the `0.6` alert threshold.
- Fresh 24h event data is now mixed rather than purely semantic: there are `3` `evaluation.false_good` events in-window, `2` with `heuristicVerdict = good -> reviewedVerdict = acceptable` and `1` with `heuristicVerdict = good -> reviewedVerdict = needs_improvement`.
- The semantics gap still dominates the metric numerator (`2/3` of fresh false-good events), but there is now at least one real misclassification in the same window, so this project should not be framed as acceptable-only drift anymore.
- Runtime code still emits `evaluation.false_good` whenever a heuristic `good` review is later anything other than `good`; `projects/evaluation.app/workflows/evaluator-aftermath.ts` does not distinguish `acceptable` from `needs_improvement` in that emission path.
- Metrics code still counts all `evaluation.false_good` events in the numerator and reviewed-good sessions in the denominator (`agents/may/handlers/metrics-snapshot.ts`), while KE-2010 and `shared/work-queue.md` still point at the same fix path for excluding `good -> acceptable` vocabulary mismatches.
- Current resume trigger: owner/product judgment from May on whether to implement the queued vocabulary-mismatch exclusion or explicitly accept the current semantics/target.

## Plan
1. Ask May for owner judgment on whether to implement the queued vocabulary-mismatch fix or explicitly accept the current metric semantics.
2. If implementation is approved, track the smallest safe change across `projects/evaluation.app/workflows/evaluator-aftermath.ts` and the downstream metric behavior.
3. Re-check the next fresh 24h window after any change to confirm the numerator only captures `good -> needs_improvement` style overturns.
4. Close when either the code/metric semantics are aligned and the target is met structurally, or product explicitly accepts the current semantics and target.

## Validation
- Fresh query of `evaluation.false_good` events shows `good -> acceptable` overturns are excluded, or owner explicitly documents that they should count.
- `evaluator.false-good-rate-sample` stays at or below target on fresh snapshots for structural reasons.
- Any remaining in-window `evaluation.false_good` events represent substantive `good -> needs_improvement` style overturns.
- Event/code path evidence matches the chosen policy.

## Journal
- 2026-06-19 19:10Z: Heartbeat created this project after a non-alert audit found a still-open target miss with a known fix path. Evidence: metrics row shows `evaluator.false-good-rate-sample = 0.0556`; fresh 24h event recompute gives `1` false-good / `19` reviewed-good = `0.0526`; the only in-window false-good event is `good -> acceptable`; `agents/may/handlers/metrics-snapshot.ts` still counts all `evaluation.false_good` rows; and `projects/evaluation.app/workflows/evaluator-aftermath.ts` still emits `evaluation.false_good` for any reviewed non-good outcome after heuristic `good`.
- 2026-06-19 19:16Z: Heartbeat reactivated this project after a fresh non-alert audit showed the same semantics gap recurring more strongly. Evidence: metrics row now shows `evaluator.false-good-rate-sample = 0.0952`; last-24h `evaluation.false_good` events are exactly `2`, both `heuristicVerdict=good -> reviewedVerdict=acceptable` (sessions `s_1781895606312_25` and `s_1781894565677_3`), with no `good -> needs_improvement` overturns in that sample. Sent May a P1 owner-judgment request asking whether to implement the queued acceptable-mismatch exclusion or explicitly accept the current semantics/target.
- 2026-06-19 19:24Z: Heartbeat refreshed the project after the next 24h sample stopped being acceptable-only but still showed the same dominant semantics gap. Evidence: live metric row is now `0.0833` vs target `0.05`; fresh `evaluation.false_good` recompute found `3` in-window events (`2` `good -> acceptable`, `1` `good -> needs_improvement`); `agents/may/handlers/metrics-snapshot.ts` still counts all `evaluation.false_good` rows; `projects/evaluation.app/workflows/evaluator-aftermath.ts` still emits them for any reviewed non-`good` outcome; and no May owner reply to the latest project-specific request was found in `message.created` events.