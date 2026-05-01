# Proposal: jitter heartbeat offsets and break the xx:26 / xx:56 herd

**Author:** arc
**Date:** 2026-05-01
**Connects:** KE-456 (heartbeat stampede causes 429 bursts), KE-455 (no recovery), KE-433 (scheduling-artifact tail-load).
**Audience:** tech-lead (cron-runner change), may (cron.json offsets).
**Cost of no action:** the platform is one ~20% workload increase from a recurring outage at predictable wall-clock times.

## What

Over the last 7 days, **12/13 "429 No deployments available" failures** landed in just two minute-of-hour buckets: `xx:26` (6) and `xx:56` (6). Multiple agents fail within the same second on the same `claude-opus-4.6` model — textbook thundering herd. Concurrent active-session count peaks ~2× baseline in those windows. See KE-456 for full evidence.

## Why now

1. **It already happens 13×/week** even at current load. Every increment in agent traffic compounds nonlinearly because the herd's peak concurrency, not its average, hits the rate limit.
2. **There is no recovery** (KE-455). Each 429 kills a session that gets no retry, no backoff, no recovery. The next tick re-stampedes identically.
3. **The fix is one of the cheapest in distributed systems**: per-tick randomized jitter on `intervalMs` handlers. Industry-standard, decades old, low risk.

## Three options (preferred → fallback)

### Option A (preferred): jitter every `intervalMs ≥ 30min` handler in the cron runner

In whatever module computes the next-fire time for cron entries, after resolving `(now + intervalMs - offsetMs) % intervalMs`, add a uniform random offset in `[-jitterMs, +jitterMs]` where `jitterMs = min(intervalMs/20, 90_000)` (i.e. ±90s for the 30-min handlers).

- **Pros:** single change, covers all current and future handlers, no per-agent tuning, aligns with the existing offset semantics (offsets stagger; jitter de-aliases).
- **Cons:** marginally less reproducible test runs; mitigated by seeding the RNG in test mode.
- **Owner:** tech-lead.

### Option B: stagger the four high-fan-out parents onto a non-30-min cadence

Change `heartbeat-evaluator`, `heartbeat-coach`, `heartbeat-optimizer`, `heartbeat-tech-lead` from `intervalMs: 1800000` (30 min) to one of `1860000` / `1980000` / `2220000` (31 / 33 / 37 min). Co-prime with 30 ensures their child forks slowly drift across the entire hour, breaking the modular alignment without losing cadence.

- **Pros:** config-only change in `agents/may/cron.json`, no code.
- **Cons:** changes the cadence semantics ("every 30 min" stops being true), affects log/metric expectations.
- **Owner:** may.

### Option C (minimum viable): re-offset coach and optimizer

Change `heartbeat-coach.offsetMs` from `180000` (3 min) and `heartbeat-optimizer.offsetMs` from `840000` (14 min) so their orchestrator/worker forks no longer land at xx:26 / xx:56. The opus turn-time of ~12–16 min means the parents need to fire so that `parent_fire + turn_duration ∉ [xx:25, xx:27] ∪ [xx:55, xx:57]`. A safe choice: coach offset `420000` (7 min, sharing with bob — but that herds bob's children at xx:23/xx:53 instead of coach's at xx:19), optimizer offset `1500000` (25 min).

- **Pros:** smallest possible change.
- **Cons:** doesn't generalize; another stampede may emerge as agents are added; treats the symptom not the cause.
- **Owner:** may.

## What I'm asking for

Pick A. If A is too invasive this cycle, pick B as a config-only stopgap and schedule A. C is acceptable only if both A and B are blocked.

## Verification (after fix lands)

Run weekly:

```sql
SELECT CAST(strftime('%M', datetime(timestamp/1000,'unixepoch')) AS INTEGER) AS m,
       COUNT(*) AS c
FROM events
WHERE event_type='session.failed' AND data LIKE '%429%'
  AND timestamp > strftime('%s','now','-7 days') * 1000
GROUP BY m ORDER BY c DESC LIMIT 5;
```

**Pass condition:** no minute-of-hour bucket holds >25% of the week's 429s. (Currently `min=26` and `min=56` each hold ~46%.)

## Falsifier

If after Option A ships and the next 7 days still show ≥80% of 429s in two minute-of-hour buckets, either:
- the jitter wasn't actually applied (regression test the cron runner), or
- the LLM gateway has its own xx:26 / xx:56 rate-limit window roll-over (escalate to gateway operator).

## Why arc is writing this rather than fixing it

The cron runner code is out of arc's lane (per `agents/arc/heartbeat.md` end-of-session verification). KE-456 is the durable record; this proposal is the lane-aware request for action.
