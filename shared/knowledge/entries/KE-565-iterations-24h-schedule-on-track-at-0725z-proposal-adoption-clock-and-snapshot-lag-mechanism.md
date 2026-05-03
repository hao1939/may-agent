# KE-565 — `iterations-24h` schedule on-track at 07:25Z; proposal-adoption clock at 43h+43m; snapshot lag mechanism documented

<!-- metrics: project.iterations-24h, project.blocked-over-6h -->

**Date:** 2026-05-03 ~07:28Z
**Author:** arc (heartbeat)
**Status:** confirmation — KE-563 F2 not fired; KE-455 + KE-496 still hold; one new mechanism note (snapshot lag).
**Confidence:** High (arithmetic on DB read).
**Connects:** KE-455, KE-496, KE-512, KE-561, KE-562, KE-563, KE-564, and arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`.
**Severity:** low (continuing checkpoint + small mechanism finding).

## What this KE adds

Three things, all checkable from the DB:

1. **KE-563 schedule held at the 07:25Z sample.** Predicted `current = 26` (after the 06:42Z events age out, before the 07:42Z events do); live count of `project.iteration` events in the trailing 24h window is **26** at 07:25:07Z. F2 ("schedule diverges by >2") still not fired. Next checkpoint: end-of-bucket 07 — predicted `current = 24` once both 07:42:19Z events age out at 07:42:19Z 2026-05-03.

2. **The KE-496 proposal-adoption clock crossed +43h.** arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md` was written 2026-05-01 18:20Z (file mtime). At 07:25Z 2026-05-03 it is **+37h05m** since the file was written and **+45m** since May's `agent.notification` to `hao` (06:42:46Z) explicitly named the proposal path as the unblocker. No commit in `agents/shared/may-agent-docs/design/agent-metrics.md` since 2026-04-30 20:55Z, no metrics-table edit visible in the DB, and no follow-up `agent.notification` from `hao`. F4 from KE-564 ("metrics-table edit before 14:12Z 2026-05-03") has 6h47m of runway left before the design-doc threshold (3) is silently crossed.

3. **Snapshot lag is a real, bounded source of off-by-one in schedule checks.** The `metrics.project.iterations-24h.current` field is updated by the metric refresher every ~5 minutes; the live count of events with `timestamp > now-86400000` updates continuously. At 07:15Z the snapshot read `current = 27` while the live count was already `26` (the two 06:42Z events had aged out 33 minutes earlier but the next snapshot tick had not landed). Practical implication for KE-563-style schedule checks:

   - Use `SELECT COUNT(*) FROM events WHERE event_type='project.iteration' AND timestamp > strftime('%s','now')*1000 - 86400000` for arithmetic. **Not** `metrics.current`.
   - Expect `metrics.current` to lag the live count by 0–5 minutes (≤1 event under steady ageout, more during a burst).
   - F2's "diverges by >2" tolerance was set with this in mind, but for spot-checks at the bucket boundary the right number is the live count, and the schedule should be evaluated at `bucket_end + ageout_jitter (≈30s)`, not at `bucket_end` exactly.

## Evidence

```sql
-- Live count at 07:25:07Z 2026-05-03
SELECT COUNT(*) FROM events
 WHERE event_type='project.iteration'
   AND timestamp > strftime('%s','now')*1000 - 86400000;
-- → 26

-- Snapshot at 07:15Z 2026-05-03
SELECT current FROM metrics WHERE id='project.iterations-24h';
-- → 27 (lag: ~1 event, ~33 min stale)

-- All-time metric.breach events
SELECT COUNT(*) FROM events WHERE event_type='metric.breach';
-- → 0
```

Live ageout schedule (events sorted by ageout time, reproducible from DB):

| Bucket end (UTC) | Events aging out in this bucket | Predicted `current` at bucket end |
|------------------|--------------------------------|-----------------------------------|
| 2026-05-03 06    | 2 (already aged at 06:42:21Z)  | 26 ✓ matches live at 07:25Z       |
| 2026-05-03 07    | 2 (07:42:19.4Z ×2)             | 24 |
| 2026-05-03 08    | 3 (08:12 ×2, 08:42 ×1)         | 21 |
| 2026-05-03 09    | 3 (09:12 ×2, 09:42 ×1)         | 18 |
| 2026-05-03 10    | 3 (10:12 ×2, 10:42 ×2)         | 14 |
| 2026-05-03 11    | 3 (11:12 ×2, 11:42 ×1)         | 11 |
| 2026-05-03 12    | 4 (12:12 ×2, 12:42 ×2)         | 7  |
| 2026-05-03 13    | 3 (13:12 ×1, 13:42 ×2)         | 4  |
| 2026-05-03 14    | 3 (14:12 ×2, 14:42 ×1)         | 1  |
| 2026-05-04 02    | 1 (02:42:22.4Z)                | 0  |

(Bucket counts match KE-563 within rounding; this table is the same schedule re-grounded against 26 not 29 because four further events have aged out since KE-563 was written. The crossings of the design-doc threshold (3) at ≈14:12Z 2026-05-03 and the live threshold (0) at 02:42Z 2026-05-04 are unchanged.)

## Falsifiers

This KE inherits KE-563's F1/F2/F3 unchanged, plus KE-564's F4. New observations:

- **F2 (schedule miss)**: still not fired (07:25Z spot-check matches arithmetically).
- **F4 (metrics-table edit before 14:12Z 2026-05-03)**: 6h47m of runway. If a commit lands in `agents/shared/may-agent-docs/design/agent-metrics.md` or a `metric.update` event mutates `project.iterations-24h.threshold` to 3 (or `project.blocked-over-6h.target` to 0), F4 fires and the "0 breach events across the cliff" prediction is voided by repair, not error.

## Why this is worth a tick of arc's heartbeat

KE-563 said "publish the schedule, only re-write if it diverges." Why land another checkpoint anyway:

- **F4 has a clock now.** Putting the proposal-adoption clock on the same artifact as the schedule check means whoever reads the next KE in this chain sees both "the cliff is N hours away" and "the proposal has been waiting M hours" side by side. That reframes the proposal from "an arc workspace file someone might pick up" to "the only thing that prevents the next predictable silent breach." Today the clock is +37h on the proposal and +45m on May's escalation; tomorrow same time it will be +61h and +24h45m if nothing moves.
- **The snapshot-lag mechanism was implicit in KE-564 but not named.** KE-564 hand-waved the discrepancy as "metric snapshot lags live count by one 5-min tick." That phrasing was right but vague — naming the mechanism (5-min refresher cadence vs. continuous event window) and stating the practical rule (use the live count for arithmetic checks, expect ≤1-event lag) makes the next reader's job easier and converts a future "the schedule was off by one!" surprise into "yes, that's the snapshot lag, here's the rule."

## Recommendations

None new. The two existing recommendations (KE-563 §Recommendations, KE-564 §Recommendations) carry forward and the proposal-adoption clock above strengthens both:

1. **Adopt arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`** — May's escalation now references it; +37h since written, +45m since escalation, ~6h47m before the metric crosses the design-doc threshold without alerting.
2. **Repair KE-455's emit path** so `metric.breach` events fire when the config is corrected.

## Lesson

When a chain of forecast KEs becomes deterministic, each new KE should add at most one of: (a) a confirmed checkpoint (cheap), (b) a proposal-adoption clock (puts the no-op landing in calendar terms), (c) a newly-named mechanism (snapshot lag) that future KEs can reference without re-deriving. Three small additions per KE is a reasonable cap; if a heartbeat can't find one of these for the same chain, the next entry should wait for a divergence, not a tick.

[SIG: 1777793300:ke565-arc]
