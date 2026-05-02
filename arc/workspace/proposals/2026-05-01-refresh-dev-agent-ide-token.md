# Proposal: Refresh dev-agent IDE token (dev has been down ≥28h)

**For:** Hao (anyone with shell/credential access)
**From:** arc heartbeat 2026-05-01 ~07:00Z (UPDATED 11:18Z, 11:50Z, 12:27Z, 2026-05-02 03:20Z, 04:48Z)
**Urgency:** HIGH — dev fully non-functional 28h+, autonomous loop blind

## UPDATE 2026-05-02 04:48Z (heartbeat 7, 27.8h since last success)

- **58 consecutive 401 errors** since 2026-05-01 00:58:35Z (last `done`).
- Last error 2026-05-02 04:20:24Z; outage clock now **27.8h**.
- Cadence has held at exactly ~2 errors/hour throughout — dev's
  cron is firing on schedule, the IDE token refresh is the only
  thing missing. (3 new 401s since the 03:20Z update, 88 min apart
  on average — i.e. dev runs every 30 min and they all fail.)
- Steady-state observation: every heartbeat that passes adds ~1 KE
  about why nobody noticed dev was dark, but dev itself stays dark.
  The autonomous system has now spent ≥28h documenting its own
  blind spot rather than escalating through the only channel that
  can fix it (a human refreshing a credential).
- **The proposal-channel latency itself is the headline finding.**
  This file has been live 21h with monotonically worsening data
  and zero state change. If Hao reads this in the next heartbeat
  cycle, that is one bit of information per ≥21h — the autonomous
  loop's effective bandwidth-to-human is below the rate at which
  it generates findings.

**Action still needed from Hao:** refresh the IDE / Copilot token
(or swap dev's model from `gpt-5.5` to something with a valid
deployment). No agent can do this.

## UPDATE 2026-05-02 03:20Z (heartbeat 6, ≥26h since last success)

- **55 consecutive 401 errors** since 2026-05-01 00:58:35Z (last `done`).
- Last error 2026-05-02 02:50:24Z; outage clock now **26.3h**, accruing
  ~2 errors/hour.
- 24h dev session counts: `total=51, done=0, errored=51, avg_ops=0`.
- This is the only agent with 100% failure in the last 24h. Every
  other agent's failure rate is <2%.
- Five new KEs (KE-455 through KE-467) have been written across this
  outage; not one of them was emitted by dev because dev cannot run.
  The autonomous loop has been writing KEs *about why it can't see
  problems* while one of its own observers is silently dark.
- The session.error-rate-6h metric reads **0.0121 (1.2%, GREEN)**
  while dev is fully down — KE-440's per-agent metric proposal still
  not implemented.

**Action still needed from Hao:** refresh the IDE / Copilot token
(or swap dev's model from `gpt-5.5` to something with a valid
deployment). No agent can do this.

## UPDATE 2026-05-01 12:27Z (heartbeat 5)

- **25 consecutive 401 errors** for dev (was 24 at 11:50Z update).
- Last error: 2026-05-01 12:20:22Z. Last success: 2026-05-01 00:58:35Z (≈11h27m ago).
- All 4 may heartbeats since the 11:50Z update (10:49, 11:18, 11:19, 11:49, 12:19) ran cleanly and reported tree-clean / inbox-processed; **none surfaced dev's outage**. KE-441 prediction holds: pure-text knowledge entries do not change behavior; the heartbeat prompt template is the binding constraint.
- The pattern is now stable enough to be its own data point: this proposal has been live 5h27m, accruing ~1 new 401 every 30 min without intervention. Each heartbeat that passes is one more proof that the proposal-channel latency is the bottleneck, not the token expiry itself.

**Action still needed from Hao:** refresh the IDE / Copilot token (or swap dev's model). No agent can do this.

## UPDATE 2026-05-01 11:50Z

- **24+ consecutive 401 errors** for dev — outage ongoing.
- Last error: 2026-05-01 11:20:23Z. Last success: 2026-05-01 00:58:35Z.
- **Hao asked may directly at 11:23Z** about dev's status. May
  correctly diagnosed the IDE token / Copilot proxy issue and
  responded "only you can fix it." So the human-conversation channel
  works fine — but two autonomous heartbeats *after* that exchange
  (11:18, 11:19) did **not** flag dev. The diagnostic capability is
  there; it isn't triggered by the heartbeat prompt.
- Filed KE-441 documenting that KE-440 itself recurred within 30
  minutes (no behavior change from the knowledge entry alone).
- Filed companion proposal `2026-05-01-may-heartbeat-outage-check.md`
  asking tech-lead to apply the heartbeat.md patch arc cannot apply.

**Action still needed from Hao:** refresh the IDE / Copilot token (or
swap dev's model). No agent can do this.

## UPDATE 2026-05-01 11:18Z

Four hours after the original proposal, nothing has changed:

- **22 consecutive 401 errors** for dev (was 13 at first writing)
- **Last successful dev session:** 2026-05-01 00:58:35Z (≥10h ago, was 6h)
- **dev 6h failure rate:** 14/14 = 100%
- **System 6h failure rate:** 25/1348 = 1.85% (GREEN — alert threshold 30%)
- May ran ≥8 heartbeats in the interim, each concluded "system healthy".

The aggregate `session.error-rate-6h` metric is **mathematically incapable**
of catching this: dev fires ~3×/hour, system fires ~225×/hour, so dev's
100% failure dilutes to ~1.3% of total. **No threshold tuning fixes this**
— need a per-agent metric. See KE-440.

## Problem

`dev-agent` has been firing on schedule but failing every single
session for ≥9 hours with `401: IDE token expired: unauthorized:
token expired`.

```
$ bun -e "...SELECT MIN(startedAt), COUNT(*) FROM sessions
          WHERE agent='dev' AND status='error'..."
{ first: '2026-04-30T21:17:17Z', n: 13 }   # 13 consecutive failures

$ bun -e "...SELECT MAX(startedAt) FROM sessions
          WHERE agent='dev' AND status='done'..."
{ last:  '2026-05-01T00:58:35Z' }          # 6h before this proposal
```

May's 06:49 heartbeat noticed 2 of these and described them as
"minor token-expired errors. Not critical but worth monitoring."
This is a severity-misread: dev is **down**, not flaky. Every dev
heartbeat since 21:17 UTC has produced zero output.

## Evidence

- 13 consecutive 401 errors, every ~30 min, identical message.
- 0 successful dev sessions in the last 6 hours.
- Pattern: not retryable from inside the agent — token has to be
  refreshed externally (probably an env var / credential file).

## Proposed Change

1. Refresh whatever credential dev-agent uses for "IDE token"
   (likely a JWT for the IDE/coding tool).
2. Verify next dev heartbeat completes successfully (status='done',
   not 'error').
3. **Process fix:** add a metric `agent.error-streak-by-agent` that
   alerts when any agent fails >3 consecutive sessions. Right now
   the only error-rate metric is `session.error-rate-6h` which
   buckets all agents together — dev's 100% failure rate disappears
   into the system aggregate (currently 3.85%, green).

## Expected Impact

- dev resumes producing output.
- Future per-agent outages get caught in <2 hours instead of
  waiting for someone to read individual session histories.

## Risks

- The metric in #3 needs care: some agents legitimately have low
  fire rates and one error in two sessions = 50% false alarm.
  Suggest "≥3 consecutive errors AND ≥0 successes in same window"
  as the trigger.
- Unknown whether the IDE token has a known refresh procedure
  documented anywhere. Worth capturing it as part of the fix.

## Related
- KE-431 sidecar finding (same heartbeat that wrote KE-431 also
  under-classified this).
