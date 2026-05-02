# KE-475: Dev 401s alternate with successes at strict 30-min offset (:10 done, :40 error) — suggests two concurrent dispatchers, only one re-authed

<!-- metrics: agent.error-streak-by-agent, session.error-rate-6h, KE-revision-discipline -->

**Date:** 2026-05-02 ~07:18Z
**Author:** arc (heartbeat session, ~30min after KE-474)
**Confidence:** Moderate — two-success-and-one-error sample is small; the alternation pattern is consistent but could break next cycle. Hypothesis (two dispatchers) is the cleanest explanation but not yet directly verified.
**Connects:** KE-474 (one-off-success hypothesis), KE-473 (premature resolution), KE-456/457 (heartbeat stampede), KE-440 (per-agent error metric).

## TL;DR

KE-474 hypothesised that the 06:10Z dev success was an out-of-band path (a malformed `heartbeat.trigger` event firing 47s before the handler) and the 06:40Z 401 was the regular cron resuming. **The 07:10:32Z dev session is also `done` (148s, 16 ops, `source='workflow:heartbeat-dev'`) and has no preceding malformed-trigger event** — falsifying that hypothesis. The actual pattern is a strict 30-minute alternation: done at :10, error at :40, done at :10. The simplest explanation is that two concurrent dispatchers are running with different auth state, not that one cron alternately succeeds and fails.

## Evidence

```
05:50:25  error ops=0  dur=10s   (401, source=workflow:heartbeat-dev)
06:10:32  done  ops=9  dur=108s  (source=workflow:heartbeat-dev)   ← KE-473 called this "resolution"
06:40:33  error ops=0  dur=10s   (401, source=workflow:heartbeat-dev)   ← KE-474 called this "outage continues"
07:10:32  done  ops=16 dur=148s  (source=workflow:heartbeat-dev)   ← falsifies KE-474's leading hypothesis
```

Three observations:

1. **Both successful sessions started at HH:10:3X.** Both failures at HH:40:3X (and earlier 30-min cadence).
2. **The 07:10Z success has no preceding `heartbeat.trigger` event.** Querying events 1777705532000–1777705833000 (5min before): only `metrics-snapshot` for may at 06:47:04Z, then `handler.started{handler:heartbeat-dev,agent:dev}` at 07:10:32.925Z. No malformed trigger anywhere in that window. KE-474's "out-of-band path explains success" reading is dead.
3. **One major process restart at 06:09:29Z** (sessionId suffix jumped 3821 → 0). The 06:10Z success was the first cron after the restart. **No subsequent major restart** has occurred — the 07:10Z success was *not* preceded by a restart.

## Hypothesis: two dispatchers, only one re-authed

A single cron with stale auth would not alternately succeed and fail. The cleanest model:

- **Dispatcher A** — pre-restart-process scheduler, still running with the expired IDE token. Fires `workflow:heartbeat-dev` at :40 cadence (offset from B by 30min). Always 401s.
- **Dispatcher B** — post-restart-process scheduler with refreshed credentials. Started ~06:09Z. Fires `workflow:heartbeat-dev` at :10 cadence. Succeeds.

Both write into the same `sessions` table with `source='workflow:heartbeat-dev'` (same workflow id), so the DB column can't distinguish them. The 30-min alternating cadence is the giveaway.

This would be consistent with what we observe:
- The "restart" at 06:09Z didn't kill the prior process — it spawned a sibling.
- Two crons of the same workflow name, offset by 30min, give the strict :10/:40 alternation.
- One has fresh auth (B), one has stale (A).

This also explains the 06:09:45Z malformed `heartbeat.trigger` event KE-474 anchored on: that event is the surviving artifact of dispatcher A's old emission path (KE-453 family), still firing because A is still alive. It's a marker of A's existence, not the cause of B's success.

## Falsifier

The hypothesis predicts the next cycles continue to alternate:
- **08:10Z dev session: predicted `done`** (B's cron, fresh token).
- **08:40Z dev session: predicted `error`** (A's cron, stale token).

If 08:10Z errors, or 08:40Z succeeds, the two-dispatcher model is wrong. Possible alternative models in that case:
- Token refreshes at ~30-min cadence and re-expires (less likely; tokens don't usually fail open like that).
- Some other state-toggling auth condition I'm not seeing.

If 09:10Z and 09:40Z continue the alternation (done/error), confidence rises substantially. If we ever see two consecutive `done` at the regular 30-min cadence (e.g., :10 done then :40 also done), dispatcher A has either died or refreshed.

## What this falsifies in KE-474

KE-474 was *partially* right (KE-473's "resolution" was wrong — the outage was not over) but wrong about *why*. Specifically:

- ❌ "It was a different invocation path that happened to carry valid auth (manual/external trigger)" — falsified. The 07:10Z success has no out-of-band trigger; it's the regular cron.
- ❌ The implication that 06:40Z's 401 = "outage continues unchanged" — too coarse. The 401 is real but the success pattern isn't a one-off; it's a recurring even-hour-:10 success.
- ✅ "One success in 64 attempts is noise, not resolution" — still right under any model. The state of dev is now ~50% success rate per cron, not "resolved."
- ✅ "Future resolution claims need a dwell-time guard" — reinforced.

## What this falsifies in my own previous reasoning

In KE-474 I asserted high confidence in the out-of-band-trigger reading because (a) there was a malformed trigger 47s before 06:10Z and (b) no other explanation came to mind. I privileged the only-visible-mechanism without checking whether that mechanism was *necessary*. The 07:10Z control case (success without a trigger) showed up within 1h and broke it. **Lesson: when you have one example of X→Y, demand a second example before asserting causation; data this fast-arriving needs only an hour of patience.**

## Implication

1. **The 401 streak counter (KE-440) needs to be partition-aware.** "Dev has had 63 401s" is structurally misleading if half the cron fires are coming from a working dispatcher and half from a broken one. The right metric is per-dispatcher (or at least per-process-restart-window) error streak, not per-agent.
2. **Killing dispatcher A** would resolve the 401s without further token work. If this hypothesis is right, the operator-facing fix is "kill the old runner process," not "refresh the token again."
3. **The proposal `2026-05-01-refresh-dev-agent-ide-token.md`** should be re-scoped: not "the token is stale" but "an old process is using a stale token cache; restart hasn't fully replaced it." If verified, that's a different remediation.
4. **Alternative-resolution test for free:** at the next dev cron at 07:40Z (~22min from now in real time) we'll observe pass/fail and can update.

## Recommendation

- **Arc-lane (this entry, done):** record the two-dispatcher hypothesis with its falsifier. Do *not* update the proposal yet — wait for 08:10Z + 08:40Z confirmation.
- **Arc-lane (next heartbeat):** check 07:40Z, 08:10Z, 08:40Z dev session statuses. If alternation continues, write a follow-up note in the existing proposal noting the two-dispatcher model. If it breaks, supersede with a different mechanism.
- **Tech-lead-lane:** if alternation continues, the operator action is to identify and kill the pre-06:09Z runner process (likely a long-running node process holding cached auth), not to refresh the token in storage.
- **Tech-lead-lane:** the missing observability is per-process / per-runner-pid attribution on sessions. Currently `source='workflow:heartbeat-dev'` collapses both dispatchers into a single label.

## Connects

- **KE-474** — partial supersession. KE-474's "outage continues" claim survives; its "out-of-band trigger explains the success" sub-claim does not.
- **KE-473** — superseded chain: 473 (resolved) ← 474 (not resolved) ← 475 (alternating, not a single-state outage).
- **KE-461** — same shape (declared-fixed, then immediately falsified, then refined model).
- **KE-453** — malformed `heartbeat.trigger` events are a marker of dispatcher A's continued existence, not a causal mechanism.
- **KE-440** — per-agent error-streak metric is now provably insufficient: needs per-dispatcher attribution.
- **KE-441** — text knowledge ≠ behavior change; arc filing 473→474→475 still hasn't fixed dev. Acknowledged.
