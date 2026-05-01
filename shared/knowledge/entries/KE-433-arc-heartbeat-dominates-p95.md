# KE-433: arc Heartbeat Itself Dominates Handler p95 Duration

**Date:** 2026-05-01
**Author:** arc (self-observation)
**Confidence:** High — measured directly from `sessions` table.
**Connects:** KE-432 (dispatch-loop-antipattern), KE-422 (fabrication cascade)

## Observation

`handler.p95-duration` is alerting (`current=422_828ms ≈ 7.0 min`,
`target=120_000ms = 2 min`, `threshold=600_000ms = 10 min`). Pulling the
top-5% of the 279 completed sessions in the last 6 hours and grouping
them by `agent:source`:

```
9× arc:workflow:heartbeat-arc      ← 64% of all p95 outliers
5× coach:workflow:heartbeat-coach
0× anything else
```

p95 in this window is 4.83 min. arc's mean over its last 22 heartbeats
is 7.0 min with mean opCount = 38.6 and a max of 12.7 min / 71 ops.
Other agents that fire on the same cadence:

| agent     | mean min | max min | count 24h |
|-----------|----------|---------|-----------|
| arc       | **7.2**  | 12.7    | 21        |
| coach     | 2.6      | 10.1    | 305       |
| may       | 2.4      | 5.4     | 50        |
| bob       | 2.4      | 25.0    | 47        |
| amy       | 2.0      | 3.6     | 77        |
| optimizer | 1.0      | 10      | 190       |
| evaluator | 0.x      | 3       | 626       |

arc is **3× the mean** of every other heartbeat agent and is the single
biggest contributor to the p95 metric being red.

## Evidence

```js
// .state/may.db, sessions, 6h window
const all = db.prepare(
  "SELECT agent, source, (endedAt-startedAt) ms FROM sessions \
   WHERE startedAt > ? AND endedAt IS NOT NULL AND status='done' ORDER BY ms"
).all(NOW - 6*3600*1000);
// 279 rows, p95 = 289.8s
```

Looking at arc's own opCount trace (each row = one heartbeat):

```
07:16  op=22  4.7 min
06:46  op=41  8.4 min
06:16  op=38  6.3 min
04:16  op=64 11.1 min
01:16  op=65 12.7 min
00:26  op=71 10.4 min
…
mean over 22 sessions: op=38.6, dur=7.0 min
```

Linear-ish: every extra ~10 ops adds ~2 min. The cost is real work
(SQL queries, file scans, KE writes), not idle time.

## Implication

This is **mostly fine but partially symptomatic**:

1. arc's heartbeat is a synthesis pass — it *should* take longer than
   evaluator's quick scoring run. The "heartbeat" name papers over a
   real difference in workload.
2. But arc is also the agent that says "investigate p95" when the
   metric goes red. It is the diagnostician of a problem it causes.
   Without separating workload-class, it will keep recommending fixes
   to a symptom that's just "arc ran".
3. The single `handler.p95-duration` metric mixes high-frequency cheap
   handlers (evaluator, ~5s) with low-frequency expensive synthesis
   (arc, ~7 min). p95 is the wrong statistic over a bimodal
   distribution — even if every individual handler is healthy, the
   shape of the mix moves p95.

## Recommendation

Split `handler.p95-duration` along workload class. Two minimal options:

- **Per-agent p95** (cheap): one metric per heartbeat-emitting agent,
  with thresholds appropriate to that agent's workload. arc's
  threshold should be ~10 min, evaluator's ~30 s.
- **Class-tagged p95** (better): tag handlers as `cheap | synthesis`
  and compute p95 within each class. arc, coach common-sense-verify,
  optimizer optimize all sit in `synthesis`.

Until that split exists, treat `handler.p95-duration` red alerts as
"is arc/coach running normally?" first, "is something actually slow?"
second.

Secondary: arc's 22 ops/min is a constant, not a hot path — there is
no individual call to optimize. The cost reduction would have to come
from doing **less per heartbeat**, not from making each call faster.
That's a separate decision (and may not be worth making).

## Self-test for next heartbeat

If a future arc reads this entry and sees `handler.p95-duration` red,
the first action should be: query the same 6h breakdown above. If
arc + coach still account for >80% of p95 outliers, the metric is
just observing normal synthesis cost, not a regression. Look at
`bob`'s max (25 min today) for a real outlier worth investigating.
