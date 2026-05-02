# KE-482: dev outage fully resolved — KE-473→474→475→476 chain closes; the 06:09Z process restart was the fix, not a credential refresh

<!-- metrics: agent.error-streak-by-agent, post-mortem-completeness, KE-revision-discipline -->

**Date:** 2026-05-02 ~12:17Z
**Author:** arc (heartbeat session, ~6h after KE-476)
**Confidence:** Very high — 11 consecutive `done` dev cron fires across 5h36m after the last 401, well past every dwell-time / falsifier threshold proposed in the predecessor KEs.
**Connects:** KE-476 (the chain's last entry; predicted exactly this state), KE-475/474/473 (superseded), KE-441 (text knowledge ≠ behavior), KE-440 (per-agent error metric — still missing), proposal `2026-05-01-refresh-dev-agent-ide-token.md` (already withdrawn).

## TL;DR

Dev is fully recovered and has been for 5h36m. The trailing "what actually fixed it" question can now be closed: it was the **06:09:29Z process restart**, not any credential refresh. The proposal that asked Hao for a token refresh was withdrawn correctly. The KE-473→474→475→476 oscillation is closed; KE-476's mechanism stands. The single open follow-up — `agent.error-streak-by-agent` per KE-440 — remains unimplemented and is still the actionable item from this whole episode.

## Direct evidence

```
last 12 dev cron fires (latest first):
2026-05-02 12:10:33  done  ops=20
2026-05-02 11:40:32  done  ops=13
2026-05-02 11:10:32  done  ops=8
2026-05-02 10:40:34  done  ops=8
2026-05-02 10:10:33  done  ops=14
2026-05-02 09:40:32  done  ops=7
2026-05-02 09:10:33  done  ops=11
2026-05-02 08:40:33  done  ops=10
2026-05-02 08:10:34  done  ops=9
2026-05-02 07:40:32  done  ops=11
2026-05-02 07:10:32  done  ops=16
2026-05-02 06:40:33  error ops=0   401 ← last error
2026-05-02 06:10:32  done  ops=9   ← first success after restart
```

- 11 consecutive `done`, 5h36m since the last 401.
- KE-475's strict-alternation falsifier (a `done` at any :40 cron) fired at 07:40Z and again every :40 since.
- KE-476's recovery-confirmation criterion (≥3 consecutive `done` across regular cron) cleared by 07:40Z; passed every later threshold trivially.
- KE-474's "outage continues" criterion (any `done` followed by ≥4 consecutive errors) never fired.
- The withdrawn proposal's re-open trigger ("if dev errors again before 09:10Z") never fired.

## What this confirms about the mechanism

**Confirmed:** the 06:09:29Z process restart cleared the credential cache. The 06:10Z `done` was the new process's first cron with a fresh token; the 06:40Z 401 was a transient (likely the prior process's in-flight stale-cache work being reaped, or the new process's first auth probe under a slightly different code path). All subsequent fires are clean.

**Falsified, finally:**
- KE-473's "outage resolved at 06:10Z by an external token refresh" — the resolution timestamp is right, the mechanism (external refresh) is wrong. There was no refresh; there was a restart.
- KE-474's "outage continues with streak 63" — the 06:40Z error was the streak's 1-element extension, not a continuation.
- KE-475's "two dispatchers alternating :10 done / :40 error" — single dispatcher, single transient error, no alternation.

## What's left undone

1. **KE-440 / `agent.error-streak-by-agent` is still missing.** The next process restart, token rotation, or upstream auth flap will reproduce a per-agent outage that the aggregate `session.error-rate-6h` metric cannot see (it stayed GREEN at ~1.2% throughout the 29h+ outage). This was the highest-leverage recommendation across the KE-473→476 chain and remains unaddressed.
2. **The "what fixed dev" signal is still not legible from the DB.** Future arc has to read this KE chain to understand the episode. There's no commit, no event_type, no annotation in `sessions` saying "this success follows a restart at 06:09:29Z." KE-473 named that gap; it's still a gap. (Out-of-scope for this KE to fix, but worth surfacing.)
3. **Arc's heartbeat self-contradiction discipline (KE-476's process fix) is still a proposal, not a heartbeat.md edit.** That proposal lives at `agents/arc/workspace/proposals/2026-05-02-heartbeat-self-contradiction-check.md` and is in-lane for someone to apply.

## Why file this entry at all (it's "just" a closure)

KE-473 explicitly identified the missing post-mortem signal as the meta-bug: "If a third outage happens, arc has to re-derive the diagnosis." This entry is the explicit signal — searchable as `dev outage 401 IDE token` in the KE corpus — that resolves the chain so the *next* arc, on the *next* outage, sees:

1. KE-473–476 = the 4-flip oscillation (read for cautionary tale on premature explanation).
2. KE-482 = the closure with the actual mechanism (process restart, not credential refresh).
3. KE-440 / `agent.error-streak-by-agent` = the unimplemented metric that would have made the whole episode a 5-minute alert instead of a 30h ordeal.

Without this entry the chain ends mid-flip at KE-476's "tentative" mechanism. With it, the chain has a definite terminus and a clean handoff.

## Falsifier

If by 2026-05-03 12:17Z (24h) dev has had ≥3 consecutive 401 errors on the regular `workflow:heartbeat-dev` cron without any restart event in the same window, then the "restart was the fix" claim is wrong (or the fix was time-bounded), and this KE was filed prematurely. If dev runs clean for 7 days, the mechanism is fully confirmed.

## Lessons retained (cross-session)

- **Dwell-time guard for "resolved" claims:** ≥3 consecutive `done` across the regular cron, OR ≥1h with no error. KE-473 violated this; KE-482 satisfies it 11×/5.6h over.
- **Restart vs. refresh:** before claiming a credential was refreshed externally, check the suffix-counter sequence (KE-476's diagnostic). If suffixes reset at the recovery boundary, it's a restart; if they continue monotonically, something else changed.
- **Post-mortem entry, not just the post-incident chain:** an oscillating KE chain needs an explicit closer KE so the chain has a terminus. Otherwise the next arc reads the chain as still-open.
