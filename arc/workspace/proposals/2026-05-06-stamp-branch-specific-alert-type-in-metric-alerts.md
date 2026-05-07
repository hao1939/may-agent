# Proposal: Stamp branch-specific `alert_type` in `metric_alerts` writes (one-liner with a 6-line setup)

**Status:** Proposed
**Priority:** P1 (gates KE-765's branch-aware breach-message fix; not standalone urgent)
**Author:** arc
**Date:** 2026-05-06
**Connects:** KE-775 (this proposal's source), KE-765 (downstream consumer), KE-774 (rate-mode root cause)

## Problem

Every row in `metric_alerts` has `alert_type='threshold'` because the writer hardcodes the literal `"threshold"`. Five distinct breach branches in `metrics-snapshot.ts` (health-consecutive, counter-rate, counter-stall, gauge-sustained, default-threshold) all converge on the same INSERT. As a result:

- The column has zero discriminative power — `SELECT alert_type, COUNT(*) FROM metric_alerts GROUP BY alert_type` returns one row.
- 35/40 rows ever recorded are arithmetically impossible as threshold-mode breaches (current ≫ threshold), confirming they came from the rate arm but were tagged `'threshold'`.
- Downstream consumers (heartbeat prompt, KE-765's branch-aware message proposal, any future dashboard) cannot tell which arm fired and must default to a one-template-fits-all rendering — the ground cause of KE-765's "lying message."

## Evidence

See KE-775 §1–§3:
- Single hardcoded literal at `agents/may/handlers/metrics-snapshot.ts:380`.
- Whole table is `alert_type='threshold'` since 2026-05-03 (40 rows, 8 distinct metrics).
- 15/15 most recent rows have `v_at_open > 17×threshold` with `alert_op='<'` — must have come from rate arm.
- `rg -n alert_type agents/` returns one hit (the writer); no reader exists yet, so the column has been a write-only fiction since it was added.

## Proposed Change

Single edit in `agents/may/handlers/metrics-snapshot.ts`. In the alert-lifecycle block (~line 295–390), set a per-branch `alertKind` variable when each branch sets `breached = true`, and pass it to the INSERT.

```ts
let alertKind: "threshold" | "rate" | "stall" | "consecutive_failures" | "sustained" = "threshold";

if (metricType === "health" && alertConfig?.mode === "consecutive_failures") {
  // ...
  if (allBreaching) { breached = true; alertKind = "consecutive_failures"; }
} else if (metricType === "counter" && alertConfig?.mode === "rate") {
  // rate arm
  if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) { breached = true; alertKind = "rate"; }
  if (alertConfig.max_rate != null && ratePer > alertConfig.max_rate) { breached = true; alertKind = "rate"; }
  // threshold fall-through retains the default alertKind = "threshold"
  if (!breached) { /* existing threshold check */ }
} else if (metricType === "gauge" && alertConfig?.mode === "sustained") {
  if (allBreaching) { breached = true; alertKind = "sustained"; }
} else {
  /* default — alertKind already "threshold" */
}

// existing INSERT, with alertKind threaded through:
db.run(
  "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
  [m.id, alertKind, message, now]
);
```

Stall events already go through a separate `metric.stalled` event-dispatch path, not through the INSERT, so the `"stall"` value in the union is reserved for future use.

## Expected Impact

- **Immediate:** New rows in `metric_alerts` correctly identify their trigger branch. Histograms and dashboards become possible: "what fraction of breaches are rate-mode noise vs. real threshold violations?"
- **Unblocks KE-765's branch-aware message proposal** (work-queue line 26). That proposal needs to render different templates for different breach kinds; without this fix, it would have to re-derive the kind from `metrics.type` + `metrics.config` at render time, which (a) couples the renderer to the writer's branching logic and (b) doesn't work for already-stored rows.
- **Diagnostic value:** Once landed, a single query — `SELECT alert_type, COUNT(*) FROM metric_alerts WHERE created_at > now-24h GROUP BY alert_type` — tells operators how much of the alert noise is rate-mode flap (KE-774) vs. real breaches.
- **No behavior change to alert open/resolve logic.** Same rows would still be inserted/resolved; only the metadata changes.

## Risks

- **Existing rows remain mislabelled.** The fix is forward-only. Backfill is not feasible because the original branch isn't recoverable from stored fields (you'd have to replay snapshots). Acceptable: the table is small (40 rows), and most pre-existing rows will be naturally garbage-collected as alerts resolve and downstream consumers filter on `resolved_at IS NULL`.
- **Type union may be incomplete.** I've enumerated five branches by reading the code today; if a sixth lands later (e.g., percentile-based breach), it'll default to `"threshold"` again. Mitigation: add a lint rule or a TS-exhaustive switch around the INSERT site so adding a new branch fails to compile without setting `alertKind`. Out of scope for this proposal but a good follow-up.
- **KE-765's renderer still needs writing.** This proposal alone changes nothing user-visible — the heartbeat prompt and breach messages will continue rendering as before until KE-765 lands on top. That's why this is P1, not P0.

## Sequencing

1. **This proposal (KE-775 fix):** stamp `alert_type` correctly. Prerequisite for #2.
2. **KE-765 fix (branch-aware breach message):** render different message templates keyed off `alert_type`. Already on the queue at line 26.
3. **KE-774 fix (drop rate-mode from windowed-gauge metrics):** independent of the above; reduces the population of `alert_type='rate'` rows from "noisy flap" to "near-zero." Already on the queue at line 28.

Steps 1+2 fix the rendering bug. Step 3 reduces alert volume. They can land in any order, but step 2 is most useful after step 1, and step 3 makes step 2's work less visible (because there's less for it to render).

## Falsifiers

- After the fix lands, if `SELECT alert_type, COUNT(*) FROM metric_alerts WHERE created_at > <patch_time> GROUP BY alert_type` still returns a single row, the fix didn't take or another writer exists. Predicted: at least two distinct values appear within 24h (`"threshold"` for `project.active-count`, `"rate"` for the windowed-gauge flappers — assuming KE-774 hasn't landed yet).
- If a `health`-typed metric breaches and writes `alert_type='consecutive_failures'`, that's full confirmation. (No `health` metrics are currently breaching, so this falsifier may take longer to test.)
