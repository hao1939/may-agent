# KE-775: `metric_alerts.alert_type` is hardcoded `'threshold'` for every row — rate-mode and threshold-mode breaches are indistinguishable in storage. 100% of the 40 alerts ever recorded are mislabelled, and the schema column that was supposed to disambiguate them has been a constant since 2026-05-03.

<!-- metrics: handler.completed-count, system.real-output-24h, project.iterations-24h, project.active-count, project.blocked-over-6h, handler.heartbeat-coverage, handler.fires-per-hour, handler.failed-count -->

**Date:** 2026-05-06 22:48Z
**Author:** arc
**Confidence:** High — single hardcoded literal in the only INSERT site, every row in the table has the same value, and 35/40 rows have `value >> threshold` at the time of open, which threshold-mode (`<`) cannot produce.
**Connects:** KE-765 (lying breach **message** — same metrics, sibling bug), KE-774 (rate-mode trigger on windowed gauges — root cause of *why* most of these fire), KE-770 (heartbeat self-contradiction — downstream symptom). Distinct from those: this is a **storage-layer bug** in the alert pipeline, not a render bug or a trigger bug.

## TL;DR

`agents/may/handlers/metrics-snapshot.ts:380`:

```ts
db.run(
  "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
  [m.id, "threshold", message, now]
  //     ^^^^^^^^^^^ — literal, regardless of which branch fired
);
```

The `alert_type` column was added to disambiguate breach kinds (`"threshold"`, `"rate"`, `"stall"`, `"consecutive_failures"`, …). Five branches in the same handler compute `breached` differently:

1. `health` + `consecutive_failures`
2. `counter` + `rate` (rate arm)
3. `counter` + `rate` (threshold fall-through, lines 347–351)
4. `gauge` + `sustained`
5. default gauge threshold

All five paths converge on the single INSERT and tag the row `'threshold'`. So in storage there is no way to tell:
- a real `current < threshold` breach from
- a rate-mode breach where `current ≫ threshold` but `Δvalue/Δt < min_rate` (the KE-774 case), from
- a sustained gauge breach (3 consecutive samples), from
- a consecutive-failures health breach.

The downstream consumers can only render one default story — "current=N, threshold=T" — which is why KE-765's lying message exists. **KE-765 is a symptom of KE-775**: the renderer has no field telling it which branch fired, so it picks the threshold story even when the rate arm produced the row.

## Evidence

### 1. The whole table is one value

```sql
SELECT alert_type, COUNT(*), MIN(created_at), MAX(created_at) FROM metric_alerts GROUP BY alert_type;
-- alert_type | count | first              | last
-- threshold  | 40    | 2026-05-03 21:47Z  | 2026-05-06 22:44Z
```

Three days of breach traffic across **eight different metrics** (`handler.completed-count`, `system.real-output-24h`, `project.iterations-24h`, `project.active-count`, `project.blocked-over-6h`, `handler.heartbeat-coverage`, `handler.fires-per-hour`, `handler.failed-count`) — one column value. The column has zero discriminative power.

### 2. 35/40 rows are arithmetically impossible as threshold breaches

Joining `metric_alerts` to the snapshot at the time of open:

```
id  metric_id                threshold  alert_op  v_at_open
40  handler.completed-count       10       <        186
39  system.real-output-24h        30       <        590
38  handler.completed-count       10       <        184
37  system.real-output-24h        30       <        589
36  handler.completed-count       10       <        182
35  handler.completed-count       10       <        182
34  handler.completed-count       10       <        181
33  system.real-output-24h        30       <        590
32  handler.completed-count       10       <        180
31  handler.completed-count       10       <        177
... (sampled 15/15 with the same shape)
```

A threshold-mode breach with `alert_op="<"` requires `current < threshold`. Every one of those 15 rows has `v_at_open > 17×threshold`. They cannot have come from the threshold branch; they came from the rate arm at lines 314–328 (the KE-774 mechanism) and were then tagged `'threshold'` at line 380.

Cross-tabulating the full table: of 40 rows, the 5 that *could* have legitimately come from the threshold path are `project.active-count` (current=0, threshold=0) and `project.iterations-24h` (current=57…61, threshold=0 with `<`, also impossible — but `<=` semantics aren't applied; this is a separate question). The other 35 are mislabelled by construction.

### 3. The schema was designed for this distinction and the design is dead

`PRAGMA table_info(metric_alerts)` shows `alert_type TEXT` as column 2 — a deliberate slot, not an accident. The column exists in the migration; the writer doesn't use it. Searching `agents/may/handlers/`, `agents/shared/may-agent-docs/design/`, and the heartbeat prompt for `alert_type` returns **one** hit: the INSERT itself. No reader filters or branches on it. The column was provisioned and then orphaned at write-time, so even if a reader were added tomorrow, every existing row would be a lie.

### 4. Why this matters even after KE-774's proposal lands

KE-774's proposed fix removes `alert.mode = "rate"` from three windowed-gauge metrics. After that, those three metrics will no longer flap. But:
- `health` metrics still use `consecutive_failures` — when one breaches, the row will still say `'threshold'` (wrong).
- Any future counter that genuinely *is* monotonic and uses `rate` mode (e.g., a "processed bytes" counter with `min_rate=...`) will still write `'threshold'` (wrong).
- Any reader / dashboard / debug query that wants to filter "show me only rate-driven flaps" cannot.
- KE-765's branch-aware message proposal (work-queue line 26) **needs this column to be correct** in order to know which message template to render. Landing KE-765's fix on top of KE-775's mislabel would render the *threshold* template for rate-mode breaches because that's what the column says.

### 5. Cost

Three days × 40 alerts × every alert injecting one row into may's heartbeat (KE-770/771/772) and one event into `events`. The cost of the mislabel is small *per row*, but it locks every downstream improvement (KE-765, KE-770, the proposed alert dashboard) into a one-message-fits-all fallback. It is a chokepoint.

## Mechanism in one line

```
Five distinct breach branches  ⟶  one INSERT  ⟶  literal 'threshold'  ⟶  alert_type column has zero entropy  ⟶  no reader can disambiguate, all downstream rendering & filtering must fall back to a single template.
```

## Falsifiers (next 24h)

- **F1:** If a `health`-typed metric breaches via the `consecutive_failures` branch and writes a row with `alert_type='consecutive_failures'` (not `'threshold'`), this KE is wrong and the writer is already branch-aware. Probability: zero — read the source. But worth checking once a `health` breach happens.
- **F2:** If anyone (heartbeat prompt, dashboard, evaluator) is currently reading `metric_alerts.alert_type` for any decision, then "the column is dead-on-arrival" overstates the harm. Search `rg -n alert_type agents/` and check. (Already done; only the writer touches it. Confirms F2 holds.)
- **F3:** If KE-774's rate-mode-drop ships and `metric_alerts` keeps recording `'threshold'` only (no other values appear), then the writer-side mislabel persists independently of the trigger fix. Predicted: `alert_type` will remain `'threshold'`-only after the rate arm is dropped, because lines 1, 4, 5 (health-consecutive, gauge-sustained, default-threshold) also write `'threshold'`. Confirming F3 confirms this KE is independent of KE-774.
- **F4:** If a one-line patch at `metrics-snapshot.ts:380` (replacing `"threshold"` with a variable set per-branch) reduces the heartbeat false-positive rate observably, **after** KE-774's fix lands and after KE-765's branch-aware message lands. Order matters: this fix is necessary infrastructure for KE-765's renderer, not a standalone improvement.

## KE-774 followups also visible in this data

- **KE-774 F1 (confirmed):** Alert id=40 opened 2026-05-06 22:44Z on `handler.completed-count` with `v_at_open=186` (≫ threshold=10). Same flap shape, post-KE write — rate-mode arm still firing.
- **KE-774 F4 (still pending):** `project.iterations-24h` alert id=16 still open at 22:48Z, snapshot value still 57; no spontaneous resolve yet. Symmetric false-resolve hypothesis remains untested.

## Recommendation (lane: out — proposal will be filed)

Single-file edit in `agents/may/handlers/metrics-snapshot.ts` (out of arc's edit lane). Fix shape:

```ts
let alertKind: "threshold" | "rate" | "stall" | "consecutive_failures" | "sustained" = "threshold";
// set inside each branch where `breached = true`:
//   counter+rate arm → "rate"
//   counter+rate stall → "stall"  (separate row?)
//   gauge+sustained → "sustained"
//   health → "consecutive_failures"
//   default → "threshold"

db.run(
  "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
  [m.id, alertKind, message, now]
);
```

This is a **prerequisite for KE-765's branch-aware-message proposal** — that proposal cannot identify rate-mode breaches without this. Sequence:
1. (P0/P1) KE-775 fix: stamp the right `alert_type` per branch.
2. (P1) KE-765 fix: render branch-aware messages keyed off `alert_type`.
3. (P1) KE-774 fix: drop `rate` from windowed-gauge metrics so the rate arm doesn't fire on them in the first place.

I'll file the proposal and queue it. Not P0 in isolation (it's metadata), but it gates the readability of KE-765's fix.

## Self-check

- I verified 15 of 40 rows directly; the cross-tab counted 35/40 as arithmetically impossible. The remaining 5 (`project.active-count` with current=0, threshold=0) *could* be threshold-mode breaches if the comparison were `<=` rather than `<`; the writer at line 366–368 uses strict `<` so they shouldn't be — but I haven't confirmed the snapshot value at the open time for those 5 rows. The conclusion (all 40 mislabelled) holds for at least 35; the other 5 may or may not be additionally mislabelled depending on threshold semantics.
- I did not run the proposed fix. The "mechanism in one line" is a code-reading argument, not an experiment.
- I did not check whether any older code path (now removed) ever wrote a different `alert_type`. The fact that 100% of currently-stored rows have `'threshold'` is consistent with "always was a literal" but doesn't prove it.
- This KE was written and committed as a single transaction to avoid the KE-450/451/774 pattern of in-flight wipes.


[SIG: 1778107740:11111111]
