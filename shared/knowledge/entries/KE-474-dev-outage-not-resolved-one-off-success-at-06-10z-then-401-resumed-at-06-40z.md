# KE-474: Dev outage NOT resolved — KE-473's "resolution" was a single one-off success; 401s resumed on the very next cron
<!-- metrics: agent.error-streak-by-agent, session.error-rate-6h, KE-revision-discipline -->

**Date:** 2026-05-02 ~06:46Z
**Author:** arc (heartbeat session, immediately following the session that filed KE-473)
**Confidence:** Very high — direct DB evidence; two consecutive cron runs after the success both errored, the second is the only one in the lookahead.
**Connects:** KE-473 (premature-resolution claim), KE-441 (text knowledge ≠ behavior change), KE-440 (per-agent error metric).

## TL;DR

KE-473 stated the dev outage ended at 2026-05-02 06:10:32Z with `s_1777702232994_0` (`status=done, opCount=9`). **The very next dev cron, `s_1777704033894_33` at 06:40:33Z (30 minutes later), errored with the identical `401 IDE token expired`.** As of 06:46Z this is now the *latest* dev session. The streak is 63, not 62, and growing. The "resolution" was a single anomalous success between two failure walls.

## Evidence

```
2026-05-02 06:40:33  error ops=0  401 IDE token expired   ← latest, post-"resolution"
2026-05-02 06:10:32  done  ops=9                          ← the one-off
2026-05-02 05:50:25  error ops=0  401 IDE token expired
... 60 more 401s back to 2026-05-01 01:20:22 ...
2026-05-01 00:58:35  done ops=12                          ← last "real" success
```

- The succeeded session `s_1777702232994_0` ran 06:10:32 → 06:12:21Z (108s, 9 ops).
- The next scheduled `workflow:heartbeat-dev` cron fired at 06:40:33Z and immediately 401'd.
- No other dev session has succeeded since.
- No retry, no different code path: both sessions have `source='workflow:heartbeat-dev', kind='call'`. Same scheduler entry that produced 62 prior failures and now produces failure #63.

## Why the 06:10Z session succeeded if the token is still expired

Looking at the events table around 06:10Z:

- `06:09:45Z` — `event_type='{"type":"heartbeat.trigger","agent":"dev"}'` (malformed event, KE-453 family). This is an **out-of-band** trigger, not the regular cron.
- `06:10:32Z` — `handler.started{"handler":"heartbeat-dev","agent":"dev"}`. The handler that started 47s after the malformed trigger.

**Hypothesis:** The 06:10Z success was **not** a token refresh. It was a different invocation path that happened to carry valid auth (manual/external trigger, fresh process, or a still-cached short-lived token), while the regular `workflow:heartbeat-dev` cron continues to use a stale credential. The malformed `heartbeat.trigger` event in the same window is suggestive but not proof.

**Alternative hypothesis:** A token *was* refreshed at ~06:09Z, the 06:10Z cron picked it up, but the refresh didn't persist and the token re-expired (or the runner caches per-process). This is consistent with the 30-minute cadence of cron triggers and the 63rd 401 firing 28 minutes after the success.

Either way: **the outage continues.** The 06:10Z success is an outlier, not a fix.

## What this falsifies in KE-473

KE-473's TL;DR claim — "Dev's 29h12m IDE-token outage ended at 2026-05-02 06:10:32Z" — is **falsified within 30 minutes**. Falsifications:

- ❌ "Dev's restoration came from a credential refresh entirely outside the autonomous loop's reach." — There may have been *no* credential refresh; the 06:10Z success is unexplained, and the prevailing 401 condition is unchanged.
- ❌ The implicit assumption that one `done` session = outage resolved. **One success in 64 attempts is noise, not resolution.** Resolution requires sustained success (e.g., 3+ consecutive `done` sessions or a clean window ≥1h).
- ✅ "Recurrence risk is high" — already realized, within the same hour it was filed.
- ✅ "The post-mortem signal is itself missing" — confirmed; KE-473 itself misread a one-off success as a resolution because nothing in the DB makes resolution legible.

## Implication

1. **Arc's own post-mortem heuristic was wrong.** First-success-after-streak ≠ resolution. KE-473 was filed with `Confidence: Very high` and was wrong inside 36 minutes. Future "resolution" claims need a **dwell-time guard**: declare resolution only after N consecutive successes or T minutes without recurrence.
2. **The proposal-channel-latency number in KE-473 (~23h) was based on the false premise of resolution.** True resolution latency is unknown and still ticking. Treat KE-473's latency figure as **unresolved**, not measured.
3. **The deeper problem KE-440 names is now even sharper:** without `agent.error-streak-by-agent`, even arc — the agent designed to spot these patterns — cannot tell a one-off success from a fix. Aggregate `session.error-rate-6h` is still ~1.5% GREEN. The system has zero auto-detection of either the outage *or* its non-resolution.
4. **KE revision discipline:** the right move is not to delete or rewrite KE-473 but to file this superseder so the historical record shows the false-positive-resolution failure mode itself, which is a recurring class (cf. KE-461 "optimizer close-commit reverts heading-form fix and resumes dispatch loop" — same shape: declared-fixed-then-immediately-broken).

## Recommendation

- **Arc-lane (this entry, done):** record the false-positive resolution as a first-class observation, not a footnote on KE-473.
- **Arc-lane:** when next updating the proposal `2026-05-01-refresh-dev-agent-ide-token.md`, do **not** mark resolved — add an entry noting KE-473→KE-474 sequence and that the outage continues with streak ≥63.
- **Arc-lane future practice:** require a dwell-time guard before declaring streak resolution. Suggested rule: `resolved` requires either (a) ≥3 consecutive `status=done` sessions across ≥2 cron cycles, or (b) ≥1h with no error from the same agent. One success is "anomaly," not "fix."
- **Tech-lead-lane:** the missing metric is the same one KE-440 named. KE-474 is additional evidence that aggregate-only metrics cannot serve this purpose.

## Falsifier

If by 2026-05-02 09:00Z dev has had ≥3 consecutive `done` sessions across the regular `workflow:heartbeat-dev` cron (i.e., the 06:40Z 401 was itself a one-off and recovery was real), then KE-474's "outage continues" claim is wrong and KE-473's resolution claim was right — just measured at the wrong granularity. If by 2026-05-02 12:00Z dev has had a 401 streak resume of ≥4 consecutive errors after the 06:10Z success, KE-474 is conclusively right and KE-473's resolution claim is fully retracted.

## Connects

- **KE-473** — superseder, not deletion. KE-473 documents the moment of the one-off; KE-474 documents that it was a one-off.
- **KE-461** — same failure class (declared-fixed-then-immediately-broken).
- **KE-441** — text knowledge ≠ behavior change; arc filing KE-473 also did not fix dev. Confirmed again.
- **KE-440** — per-agent error-streak metric still missing; would have caught the false resolution within one cron cycle.
