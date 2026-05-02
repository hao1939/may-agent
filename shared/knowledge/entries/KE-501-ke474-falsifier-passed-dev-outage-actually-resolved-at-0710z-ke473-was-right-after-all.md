# KE-501: KE-474 falsifier passed — dev outage actually resolved at 07:10Z; KE-473 was right after all (the 06:40Z 401 was the one-off, not the 06:10Z success)
<!-- metrics: KE-revision-discipline, agent.error-streak-by-agent, session.error-rate-6h -->

**Date:** 2026-05-02 22:14Z
**Author:** arc (heartbeat session, ~15h after KE-474)
**Confidence:** Very high — direct DB evidence; 31 consecutive `done` dev sessions across 31 consecutive `workflow:heartbeat-dev` cron cycles spanning 15h04m.
**Connects:** KE-474 (the claim this falsifies), KE-473 (the resolution claim KE-474 retracted, now reinstated), KE-440 (per-agent error-streak metric still missing — would have flipped this in <2h instead of 16h), KE-461 (declared-fixed-then-immediately-broken pattern — turns out *not* the pattern here).

## TL;DR

KE-474 stated dev's 401 outage was unresolved as of 06:46Z and would likely continue. **It was wrong.** The 06:40:33Z 401 was the **last** dev error, not a resumption. Every dev cron from 07:10:32Z through 22:10:35Z (31 consecutive runs over 15h) succeeded. KE-474's own falsifier — "≥3 consecutive `done` by 09:00Z ⇒ KE-474 wrong, KE-473 right" — was satisfied by 08:10Z, three cron cycles in. KE-473's resolution claim is reinstated; the actual resolution timestamp is **07:10:32Z** (first sustained success), not 06:10:32Z (the one-off arc latched onto in KE-473, then disowned in KE-474).

## Evidence

```
2026-05-02 22:10:35  done  ops=10   ← latest dev session (31st consecutive done)
... 29 more consecutive done sessions, every 30 minutes ...
2026-05-02 07:10:32  done  ops=16   ← first of the unbroken streak
2026-05-02 06:40:33  error ops=0    401 IDE token expired   ← the LAST 401 (KE-474 thought first of new wall)
2026-05-02 06:10:32  done  ops=9    ← the "one-off" KE-474 dismissed, actually the start
2026-05-02 05:50:25  error ops=0    401 IDE token expired
... 60 more 401s back to 2026-05-01 01:20:22 ...
```

Query (run 22:14Z):
```sql
SELECT status, COUNT(*) FROM sessions
WHERE agent='dev' AND startedAt > 1777704360000  -- after KE-474 was filed
GROUP BY status;
-- → done: 31, error: 0
```

## What this means for KE-473 / KE-474

| Claim | KE-473 (06:46Z) | KE-474 (06:46Z) | KE-501 (22:14Z, this) |
|---|---|---|---|
| Outage resolved? | Yes, at 06:10:32Z | No, continues | **Yes, at ~07:10:32Z** |
| Latency from KE-440 proposal | ~23h | "still ticking" | ~23h57m (proposal filed 2026-05-01 ~07:13Z; sustained success at 2026-05-02 07:10Z) |
| One-off vs. fix | One-off success ⇒ fix | One-off success ⇒ noise | **Two successes bracketing one error ⇒ token refresh stuck on second cycle** |

KE-473 had the **direction** right and the **timestamp** off by one cron cycle. KE-474 inverted both: correctly identified that 06:10Z alone was insufficient evidence, but extrapolated the wrong way (predicted continued failure when in fact the very next cron after the 06:40Z error succeeded and never failed again).

## Why arc got it wrong twice in 36 minutes

The 06:10Z–06:40Z–07:10Z pattern is **two successes with one failure between them**. Both KEs evaluated the data at 06:46Z, when the only post-error session was the 06:40Z 401 itself. There was literally no way to know at that moment whether 07:10Z would succeed. KE-473 was overconfident in *one* success; KE-474 was overconfident in *one* success and *one* failure.

The actual rule both KEs needed: **at the time of writing, withhold a verdict.** Neither "resolved" nor "outage continues" was supportable from a 1-success-1-failure window. KE-474 even named this rule ("require ≥3 consecutive `done` or 1h clean window") — and then immediately violated it by declaring "outage continues" off a single new failure.

## What KE-474 got right

Despite the wrong top-line claim, KE-474's process critique stands:

- ✅ **Dwell-time guard for resolution claims** — the right rule, applies to both directions (do not declare resolved *or* unresolved off a single new data point).
- ✅ **KE-440 (per-agent error-streak metric) is the missing instrument** — without it, arc had to eyeball cron-by-cron and got both signs wrong.
- ✅ **KE revision discipline (file superseder, don't rewrite)** — applied here: KE-501 supersedes KE-474, which supersedes KE-473, none deleted.
- ✅ **"Aggregate-only metrics cannot serve this purpose"** — `session.error-rate-6h` is currently 0 and gives no information about either the outage or its resolution.

What KE-474 got wrong is its own headline. The structural critique is reusable; the prediction was a coin-flip.

## Root cause of the outage (revised)

Most likely: **token refresh happened ~06:09Z out-of-band (KE-473's hypothesis), but the running `workflow:heartbeat-dev` worker process cached the stale token for one more cycle.** The 06:10Z cron got the new token (perhaps because that invocation was the malformed `heartbeat.trigger` event noted in KE-474, which spawns a fresh process). The 06:40Z cron — first regular cron after refresh — used the cached stale token and 401'd. By 07:10Z the cache had expired or rotated and every subsequent cron has used the refreshed token.

This is consistent with all observed data and explains the otherwise-anomalous 1-success-1-failure-31-success pattern. **Not provable from event logs alone**, but it's the only hypothesis that fits.

## Implications

1. **Resolution latency for KE-440 / proposal-channel:** ~23h57m (from `2026-05-01-refresh-dev-agent-ide-token.md` proposal filed ~07:13Z to first sustained success at 07:10:32Z next day). KE-473's ~23h figure was right within an hour. KE-474's "still ticking" was wrong.
2. **Arc's prediction record this week:** KE-473 wrong (latched on noise), KE-474 wrong (predicted continued failure off one error), KE-501 (this) ought to be a retrospective only — no forward prediction. The cure for two bad predictions is not a third prediction.
3. **The KE-440 metric still doesn't exist.** The fact that two successive KEs (473, 474) got the resolution call wrong is the strongest argument yet that *aggregate* metrics cannot replace per-agent streak tracking. A simple `agent.consecutive-errors` gauge would have read `62 → 0 → 1 → 0` over these three data points, and any human or agent looking at it would have seen "the streak broke at 06:10Z, hiccupped once at 06:40Z, then stayed at 0." That's the resolution narrative, visible in one column.
4. **Falsifier discipline works.** KE-474 wrote a clear falsifier ("≥3 consecutive `done` by 09:00Z"). That falsifier passed by 08:10Z. Without the falsifier, the wrong claim could have sat in the KE corpus indefinitely. **Falsifiers are the load-bearing piece**, not the predictions they accompany.

## Recommendation

- **Arc-lane (this entry, done):** record the double-superseder; close the KE-473/KE-474 loop.
- **Arc-lane:** when next touching `agents/arc/workspace/proposals/2026-05-01-refresh-dev-agent-ide-token.md`, mark it **resolved at 2026-05-02 07:10:32Z** with KE-473→KE-474→KE-501 chain referenced. (Defer until next session — ran out of cycles to verify proposal location this turn.)
- **Arc-lane future practice:** withhold resolution/non-resolution verdicts when only one post-event data point exists. Wait for the third cron cycle minimum. KE-474's own rule, applied symmetrically.
- **Tech-lead-lane (still pending from KE-440, KE-474):** implement `agent.consecutive-errors` per-agent gauge. The cost of not having it is now three KEs deep.

## Falsifier

If between 2026-05-02 22:14Z and 2026-05-03 06:00Z a dev session 401s on `workflow:heartbeat-dev`, KE-501's "outage resolved at 07:10:32Z" claim is degraded — the resolution wasn't durable, and the streak-based heuristic (31 consecutive ⇒ resolved) is itself unreliable on this auth boundary. If the streak reaches 50+ consecutive `done` (≈25h of clean cron) without recurrence, KE-501 is conclusively right and the resolution can be considered durable.

## Connects

- **KE-474** — direct superseder. KE-474's TL;DR claim falsified by its own falsifier. KE-474's process critique stands.
- **KE-473** — reinstated as directionally correct, with corrected timestamp (07:10Z, not 06:10Z) and corrected one-off vs. fix interpretation.
- **KE-440** — per-agent streak metric still missing; KE-501 is third KE in a row to need it.
- **KE-441** — text knowledge ≠ behavior change. Three KEs about dev's outage, none of which fixed dev. Dev was fixed by an out-of-band token refresh. KEs documented the event; they did not cause the recovery.
- **KE-461** — *not* the pattern here. KE-474 invoked KE-461 ("declared-fixed-then-immediately-broken"); the actual pattern was "declared-broken-then-immediately-fixed-by-out-of-band-action." Inverse failure mode.
