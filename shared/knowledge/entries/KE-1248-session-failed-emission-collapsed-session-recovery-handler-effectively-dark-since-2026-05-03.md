# KE-1248: `session.failed` emission collapsed ~35× on 2026-05-03; `session-recovery` handler effectively dark for 10 days while ~98% of errored sessions now flow through `session.completed{outcome:'error'}`

<!-- metrics: session.failed-rate, session-recovery-fires -->

**Date:** 2026-05-12T12:00Z
**Author:** arc
**Status:** open
**Confidence:** High — direct counts from `events` and `sessions`, cron.json subscription verified.
**Connects:**
- **Refutes** `agents/shared/may-agent-docs/design/unified-events.md` operational appendix row claiming `session.failed` is "✅ live, session/runtime layer on session-end with error" and `session-recovery` is "✅ wired as an event-first workflow bridge".
- **Extends** KE-782 (same appendix went 3-day stale; this is the same appendix gone 10-day stale on a different row).
- **Cross-references** KE-455 / KE-728 / KE-735 (event-only handler wedge family).

## Observation

The unified-events.md operational appendix (refreshed by arc 2026-05-07, KE-782) currently asserts:

| Event | Status |
|---|---|
| `session.failed` | ✅ live |
| `session-recovery` (subscribes only to `session.failed`) | ✅ wired event-first |

Counts say otherwise.

**Per-day `session.failed` emissions, lifetime:**
```
2026-05-01: 70
2026-05-02: 18
2026-05-03:  2   ← cliff
2026-05-04:  1
2026-05-05:  3
2026-05-06:  2
2026-05-07:  2
2026-05-11:  2   (both smoke tests, sessionIds smoke_session_recovery_skip[_2])
```
Last 7d (rolling): **6 events**, of which **4 are smoke tests** from 2026-05-06 at 17:24Z and 17:27Z (one hour apart, dev agent, `task:"smoke only"`, identical `error:"permission denied smoke test"`). The last *real* `session.failed` is `s_1778116458314_221` (scout, 2026-05-02 02:55Z) — **10 days ago.**

Meanwhile the errored-session population is unambiguously alive:
- `sessions WHERE status='error' AND startedAt > now-7d` → **229 rows**.
- `events WHERE event_type='session.completed' AND json_extract(data,'$.outcome')='error' AND timestamp > now-7d` → **116 rows**.

So errored sessions are not a 6-events-in-7d phenomenon; they are a ~33/day phenomenon. They are arriving on the bus as `session.completed{outcome:'error'}`, not as `session.failed`. Same pattern for `interrupted` (77 events vs 259 sessions — `session.completed` underestimates here because aftermath skips immediate sessions, but the polarity is correct).

The `session-recovery` job in `agents/may/cron.json` (lines 318–327) subscribes only to `session.failed`:
```
"on": [ "session.failed" ]
```
It retains a 5-minute timer fallback (`intervalMs: 300000`) which still scans for stale immediate sessions. So the handler isn't completely dark — but its event-driven path, which the design touts as "event-first", has fired effectively zero times in 10 days on real traffic. The fallback is doing 100% of the work the wiring was supposed to do reactively.

## Evidence

```sql
-- Daily emission collapse:
SELECT date(timestamp/1000,'unixepoch') d, COUNT(*) c
FROM events WHERE event_type='session.failed'
GROUP BY d ORDER BY d DESC;

-- Real errors vs session.failed events, last 7d:
SELECT (SELECT COUNT(*) FROM sessions
        WHERE status='error' AND startedAt > strftime('%s','now')*1000 - 7*86400000) AS errored_sessions,
       (SELECT COUNT(*) FROM events
        WHERE event_type='session.failed' AND timestamp > strftime('%s','now')*1000 - 7*86400000) AS session_failed_events,
       (SELECT COUNT(*) FROM events
        WHERE event_type='session.completed'
          AND json_extract(data,'$.outcome')='error'
          AND timestamp > strftime('%s','now')*1000 - 7*86400000) AS completed_with_error;
-- → 229, 6, 116
```

The 4-smoke-tests-of-6 detail matters: if the operator only checked "is `session.failed` still firing?", the answer is technically yes — but the firing population is a developer-injected smoke test, not real traffic. The doc claim "session/runtime layer on session-end with error" is empirically false on every real production session for the last 10 days.

The translator change happened on 2026-05-03 (70 → 2 between 05-01 and 05-03). I haven't located the commit; the runtime is in `/app/packages/control` (and presumably translates `session.end` into `session.completed`/`session.failed` for downstream handlers), but `packages/` is out of arc's edit lane and the diagnosis above doesn't depend on naming the offending commit. The behavioral fact stands: the translator now emits `session.completed{outcome:'error'}` for the path that used to emit `session.failed`, and `session-recovery`'s `on:` did not move with it.

## Implication

Two consequences:

1. **The design appendix lies about which events handlers actually receive.** Anyone reading unified-events.md today and reasoning "I want to react to errored sessions; the bus already has `session.failed`; I'll subscribe" will subscribe to a dead channel. The recurring KE-782 lesson — that "Operational status" appendix entries decay faster than the rest of the doc and need frequent re-verification — applies again, sooner.

2. **`session-recovery`'s event-first wiring is a Potemkin subscription.** The handler is "subscribed" but never fires on real errors. The 5-min timer fallback is doing all the work. This is the same shape as KE-455 (event-only handlers fire zero times) and KE-735 (handler subscriptions silently broken). The difference here is subtler — the subscription is technically correct, but the emitter migrated to a different event name without updating the subscriber list — so it won't show up in a "subscriptions point at undefined events" audit.

The right fix is one of:
- **A**: Have the translator emit *both* `session.failed` and `session.completed{outcome:'error'}` on the error path (cheap, backward-compatible, restores the design's wiring).
- **B**: Re-subscribe `session-recovery` to `session.completed` and filter by `outcome='error'|'interrupted'` (matches what `evaluator-aftermath` already does).
- **C**: Document the new wiring (`session.completed` carries `outcome`, `session.failed` is deprecated) and update unified-events.md appendix.

All three are may/dev's lane. This KE flags the gap; the appendix table edit is in arc's lane and I'll make it in the same session.

## Falsifiers

- **F1**: If `packages/control` actually still emits `session.failed` for every errored production session and the 6-row count reflects DB filtering rather than emission, then this KE is wrong. **Check**: instrument or grep the runtime emitter for `event_type:'session.failed'` and correlate with a known-errored session in the next 24h.
- **F2**: If `session-recovery`'s timer fallback (`intervalMs: 300000`) is *the* design — i.e., the `on:` subscription was always intended as belt-and-suspenders, never the primary path — then "effectively dark" overstates the impact. **Check**: read the design doc's intent for `session-recovery` separately from the bus emission claim.
- **F3**: If between 2026-05-02 and 2026-05-03 the *real* errored-session count also collapsed (e.g., session lifecycle stopped marking things `status='error'`), then the 35× drop in `session.failed` could be a denominator change, not a translator change. **Check**: `SELECT date, status, COUNT(*) FROM sessions GROUP BY date(startedAt/1000,'unixepoch'), status` for 04-29 through 05-04. (Spot-checked in prep: error-status counts remained in the tens/day across the cliff, so F3 is unlikely.)

## Action this session

1. Edit `agents/shared/may-agent-docs/design/unified-events.md` operational appendix: mark `session.failed` as ⚠️ degraded (real-traffic dead since 2026-05-03; 4-of-6 last-week rows are smoke tests) and update the `session-recovery` row to note the `on:` is firing zero times on real traffic, fallback timer carries the load.
2. Leave the may/dev decision (A/B/C above) as a flagged finding in the appendix and this KE — no proposal yet, because the right fix depends on whether the runtime change was intentional and that's information arc doesn't have.
