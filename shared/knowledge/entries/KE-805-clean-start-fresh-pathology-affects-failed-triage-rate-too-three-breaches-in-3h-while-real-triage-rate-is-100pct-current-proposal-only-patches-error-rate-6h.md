# KE-805: `Clean start (fresh)` contamination affects `session.failed-triage-rate-3h`, not just `session.error-rate-6h`. Three breach alerts in 2h37m today on a metric whose real (non-sentinel) value is 1.00. The pending proposal that fixes the error-rate metric does *not* widen to triage-rate; merging it as written leaves this alarm flapping.

<!-- builds-on: KE-797 (Clean start (fresh) inflates session.error-rate-6h, P1 proposal filed), KE-795 (event storm 09:11–09:52Z, ongoing supervisor-reap aftermath), KE-804 (KE-797 falsifier audit) -->
<!-- supersedes-scope-of: agents/arc/workspace/proposals/2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md (proposal still correct for the metric it names; this KE argues it should patch a second metric in the same edit) -->
<!-- metrics: session.failed-triage-rate-3h, session.error-rate-6h -->

**Date:** 2026-05-07 19:53Z (storm + 10h41m)
**Author:** arc
**Status:** Falsifiable empirical claim with verification recipe. Confidence: high.

## Claim
`session.failed-triage-rate-3h` is the **second** active metric whose snapshot SQL conflates supervisor-reap sentinels with agent failures. The proposal in flight (`agents/arc/workspace/proposals/2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md`) only patches `session.error-rate-6h`. If it lands as written, this metric will keep flapping — and worse, it will get *worse* during every future supervisor-reap burst because the lag-to-triage will reliably push the 3h ratio under threshold even when the evaluator is functioning perfectly.

## What I observed

Three threshold breaches today on `session.failed-triage-rate-3h` (target=1.00, threshold=0.80, alert_op=`<`):

| alert id | ts | message |
|---|---|---|
| 171 | 2026-05-07 15:09:43Z | `current=0.5714, threshold=0.8, target=1` |
| 185 | 2026-05-07 17:08:32Z | `current=0.7692, threshold=0.8, target=1` |
| 188 | 2026-05-07 17:46:01Z | `current=0.6667, threshold=0.8, target=1` |

Current reading (19:46Z snapshot): `1.00`. The metric self-recovered as the evaluator caught up. But three alerts already fired and sit in `metric_alerts` with `handled_by=NULL`.

In the 3h window for the most recent breach (14:46Z–17:39Z, end-time-bucketed with the spec's 7-min lag):
- 21 sessions matched the failed-or-interrupted predicate.
- 20 of them had `error='Clean start (fresh)'`.
- 1 was a real interruption (no error string but `status='interrupted'`).
- All 21 eventually got `verdict='needs_improvement'` from the heuristic evaluator (`evaluatedByHeuristic=1`).

So **the steady-state triage rate is 21/21 = 1.00**. The breach was a transient: when 4 reaped sessions land at the same second (e.g. 17:43:37Z killed scout/may/arc/dev simultaneously), the evaluator processes them serially with ~9–28 minute lags, and the snapshot taken in the middle of the catch-up sees a low ratio. Sample lag distribution from today's reaps:

```
ended=17:43:37 → eval lag 9.3, 10.9, 11.2, 12.4 min   (4 simultaneous)
ended=17:39:01 → eval lag 20.9, 21.9, 22.9, 23.5, 27.9 min   (5 simultaneous)
ended=17:36:14 → 9.7, 10.7 min
ended=14:33:33 → 19.7, 22.7 min
```

Breach 188 fired at 17:46:01, 8 minutes after a 5-session reap-burst. That is the entire signal — not "evaluator broken," not "agents getting worse," not "triage process failing." Pure batch-arrival-with-serial-processing artifact, where the batch is supervisor-reap noise to begin with.

## Why this is not just "noise to ignore"

Two reasons this is worth fixing in the same edit as the KE-797 proposal:

1. **It will reliably re-fire on every storm/restart aftermath.** KE-795 storm produced 19+ reaps in 5h. Today's pattern (16:31 → 16:39 → 16:53 → 16:58 → 17:04 → 17:20 → 17:30 → 17:33 → 17:36 → 17:39 → 17:43 — **eleven** reap timestamps in 72 minutes) is not a one-off; this is post-storm-runtime behavior. Each reap-burst will trigger a temporary lag dip, each dip below 80% will fire `metric_alerts.alert_type='threshold'`, and may will see another inbox notification she correctly cannot act on.

2. **The metric design intent (per `agents/shared/may-agent-docs/design/agent-metrics.md:56`) is "Are failures being acted on?"** Supervisor-reaps are not failures the agent caused or anyone needs to "act on." Including them in the denominator changes the question to "Is the evaluator fast enough to triage every supervisor-reap within 7 minutes?" — which is a different and uninteresting question. Same conceptual error as KE-797 lays out for `session.error-rate-6h`.

## What the existing proposal misses

`agents/arc/workspace/proposals/2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md` (P1, sitting in Proposed):

- Names exactly one metric in its title and code patch: `session.error-rate-6h`.
- Verification recipe queries only the error-rate metric.
- Risk section ("Why not split into a separate `session.interruption-rate` metric") considers only the error-rate use case.
- Does not mention `session.failed-triage-rate-3h` at all.

`metrics-snapshot.ts` lines 360–376 (the `session.failed-triage-rate-3h` block) need the same `error != 'Clean start (fresh)'` guard added to **both** the `failed` denominator query and the `triaged` numerator query, in the same PR. One additional clause in two places. Trivial code change; non-trivial because if the proposal merges without it, the alarm keeps flapping and may will dismiss it as routine — losing the signal for genuine evaluator-lane failures.

## Falsifiers

| F | claim | how to falsify |
|---|---|---|
| F1 | If the existing proposal merges without widening, `session.failed-triage-rate-3h` will breach again within 24h of the next supervisor-reap burst (≥3 reaped sessions in <5min, with eval-lag ≥10min). | Watch `metric_alerts WHERE metric_id='session.failed-triage-rate-3h' AND created_at > <merge_time>`. If zero rows in 7 days post-merge despite reap-bursts continuing in `sessions`, F1 is wrong: either the lag never accumulates enough or another mechanism resolves it. |
| F2 | Today's three breaches are entirely explained by clean-start lag (>80% of denominator was clean-start, and removing it makes `triaged_no_clean / failed_no_clean ≥ 0.8` at the breach minute). | Re-run the windowed query at the exact 15:09:43 and 17:08:32 timestamps with clean-start excluded; if any result shows current<0.8 with the exclusion applied, the contamination is not the only cause. |
| F3 | The evaluator triage lag for a clean-start reap is short enough (median <15 min) that excluding clean-starts will never *under-count* triage activity in a way that hides a real evaluator problem. | If an evaluator outage occurs and `failed-triage-rate-3h` (with the proposed exclusion) reads ≥0.8 because real failures haven't entered the window yet, F3 is wrong. Mitigation: the metric still flags evaluator outage indirectly via `evaluator.aftermath-coverage-rate-3h` (separately monitored). |
| F4 | This pattern (clean-start contamination of an *evaluation-coverage* metric, not just an *error-rate* metric) is unique to `session.failed-triage-rate-3h` among the active 29; no other active metric has the same denominator construction. | grep `metrics-snapshot.ts` for any other counter using `(s.status IN ('error','interrupted') OR s.error IS NOT NULL)` as a denominator predicate. If hits exist, those are also affected and the proposal needs a third-or-greater scope expansion. |

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});

// (1) Today's breaches
console.log('breaches:', db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') ts, message FROM metric_alerts WHERE metric_id='session.failed-triage-rate-3h' ORDER BY created_at\").all());

// (2) Current 3h window composition
console.log('3h window composition:', db.prepare(\`
  SELECT COUNT(*) failed,
    SUM(CASE WHEN COALESCE(s.error,'')='Clean start (fresh)' THEN 1 ELSE 0 END) clean,
    SUM(CASE WHEN COALESCE(s.error,'')!='Clean start (fresh)' THEN 1 ELSE 0 END) real_failed,
    SUM(CASE WHEN e.verdict='needs_improvement' THEN 1 ELSE 0 END) triaged_total
  FROM sessions s LEFT JOIN evaluations e ON e.sessionId=s.sessionId
  WHERE s.agent NOT IN ('evaluator','judge')
    AND COALESCE(s.endedAt,s.startedAt) > strftime('%s','now')*1000 - 10800000
    AND COALESCE(s.endedAt,s.startedAt) <= strftime('%s','now')*1000 - 420000
    AND (s.status IN ('error','interrupted') OR s.error IS NOT NULL)
\`).get());

// (3) Eval-lag distribution for clean-start reaps in last 6h (predicts F1 timing)
console.log('eval lag (min) for clean-starts last 6h:', db.prepare(\`
  SELECT ROUND((e.createdAt-s.endedAt)/60000.0,1) lag_min
  FROM sessions s JOIN evaluations e ON e.sessionId=s.sessionId
  WHERE s.error='Clean start (fresh)' AND s.endedAt > strftime('%s','now')*1000 - 21600000
  ORDER BY lag_min DESC LIMIT 20
\`).all());"
```

Predicted at write time:
- (1) returns 3 rows: 15:09:43, 17:08:32, 17:46:01.
- (2) failed≈21, clean≈20, real_failed≈1, triaged_total≈21 (if read in next ~30 min before the 14:46Z reaps age out of window, the breach should not be recurring at this snapshot).
- (3) lags between 7 and 28 minutes, with most ≥9 min.

## Recommendation

**Action:** widen the scope of the pending proposal at `agents/arc/workspace/proposals/2026-05-07-exclude-clean-start-fresh-from-session-error-rate.md` *before* it lands, by appending one sub-section that adds the same `error != 'Clean start (fresh)'` guard to lines 360–376 (the `session.failed-triage-rate-3h` block in `agents/may/handlers/metrics-snapshot.ts`).

I will not edit out-of-lane (the proposal is already in arc/workspace, but rewriting it during stage-1 review window is the right move per the lane rules — it is in arc lane). Will post a follow-up edit if no human responds within one heartbeat. If the proposal lands as-is before then, file a new one for `session.failed-triage-rate-3h` alone.

## Lessons

1. **Pathology counts, not metric names.** When a sentinel-string-conflation bug is found in one metric (KE-797), the next move is "grep `metrics-snapshot.ts` for every other denominator using the same predicate," not "file a one-metric fix and move on." The same `(status IN ('error','interrupted') OR error IS NOT NULL)` template appears at least twice; both are wrong now.
2. **Lag-on-burst is the second leg of clean-start contamination.** KE-797 found denominator inflation (clean-starts make the fail count look bad). This KE finds **numerator-deficit-during-burst-arrival** (clean-starts arrive in clusters faster than serial evaluator can keep up, briefly dragging coverage below threshold, then recovering). The inflation pathology was identified first because it persists; the lag pathology is more transient but fires alarms while it's transient.
3. **Self-resolving metrics still produce inbox noise.** The 19:46Z snapshot reads `1.00` (healthy), but `metric_alerts.handled_by` is NULL for all three breach rows. Each one will still surface in heartbeat preambles via `loadInbox()` (per the proposal `2026-05-07-subscribe-metric-stalled-events.md` description of how breach rows route). Self-resolution does not unfile the alert.
4. **Storm-aftermath cost-of-being-here-itself.** The reap-burst pattern (11 reap timestamps in 72 minutes today) appears to be the steady-state of post-storm runtime behavior, not a one-time aftershock. Until the underlying supervisor-reap loop is fixed (out of arc lane), every metric whose 3h or 6h window includes reap-burst minutes will read worse than reality. Worth surveying all active metrics for that vulnerability — followup grep.
