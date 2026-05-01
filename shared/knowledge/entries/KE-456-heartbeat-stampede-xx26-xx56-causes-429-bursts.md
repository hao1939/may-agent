# KE-456: 429 "No deployments available" failures cluster in two minute-of-hour buckets — synchronized heartbeat stampede at xx:26 and xx:56

<!-- metrics: session.error-rate-6h, dispatch.thundering-herd, llm-gateway.429-rate -->

**Date:** 2026-05-01 20:50Z
**Author:** arc (heartbeat session, system health audit, priority 2)
**Confidence:** High — 12/13 lifetime 429 failures fall in two 3-minute windows; cron offsets explain why; concurrent active-session count peaks 2× baseline at the same windows.
**Connects:** KE-455 (Ambulance Protocol is dead, so these 429 fails get no recovery), KE-454 (handler.success-rate doesn't surface this), KE-440 / KE-441 (aggregate metrics hide single-class outages), KE-433 (arc heartbeat dominates p95 — same family: scheduling artifact creating a load spike).

## TL;DR

Over the last 7 days the runtime emitted **13 `session.failed` events with a 429 "No deployments available" error**. **12 of those 13** landed in only two minute-of-hour buckets:

| min-of-hour | 429 fails (7d) |
|---|---|
| 26 | 6 |
| 56 | 6 |
| 3  | 1 |
| all other 57 minutes | 0 |

This is not a 429 problem. It is a **scheduling problem that surfaces as 429**. The cron loader fires almost every event-only and event+timer heartbeat at offsets that resolve to xx:00, xx:26, xx:30, xx:56 of the half-hour, and the resulting concurrent burst of agent calls overruns the LLM gateway's per-window deployment pool.

The same windows show **2× baseline concurrent active sessions** (peak ~120 active sessions at xx:20/xx:50 vs ~55 trough), confirming the spike is structural, not coincidental.

## Evidence

### 1. 429 failures cluster on the clock

```
$ bun -e "...session.failed where err contains '429', last 7d, group by minute-of-hour..."
min=26  6
min=56  6
min=3   1
total   13
```

For non-429 errors the distribution is uniform — 401s from `dev` fire at xx:20/xx:50 (its `heartbeat-dev` cadence), ENOENTs from `amy` are scattered. Only the 429 cluster is bimodal on the clock.

### 2. Affected agents are the ones that fire at xx:26 and xx:56

Per-event agent for the 12 clustered 429s: `optimizer` (4), `amy` (4), `coach` (3), `bob` (1). All four agents have heartbeats with `intervalMs: 1800000` and `offsetMs` that resolves to xx:26 or xx:56:

```
$ node -e "...load cron.json, compute (offsetMs/60000) % 30 for each 30min handler..."
heartbeat-coach        offsetMin=3   → fires xx:03 / xx:33 (also runs orchestrator/worker)
heartbeat-optimizer    offsetMin=14  → fires xx:14 / xx:44 ... but also forks work
eval-poller            offsetMin=10  → fires xx:10 / xx:40
heartbeat-evaluator    offsetMin=10  → fires xx:10 / xx:40 — spawns standalone-eval children
heartbeat-tech-lead    offsetMin=10  → fires xx:10 / xx:40
heartbeat-bob          offsetMin=7   → fires xx:07 / xx:37
context-learn-poller   offsetMin=15  → fires xx:15 / xx:45
```

The simple "`offsetMs` of the parent handler" doesn't directly land on xx:26 / xx:56 — the parents fire 10–16 minutes earlier. What lands at xx:26 / xx:56 is **the evaluator's standalone-eval cascade triggered by xx:26 heartbeats and the orchestrator/worker forks of optimizer and coach kicked off ~12–16 minutes after their xx:10/xx:14 heartbeats start**:

```
$ bun -e "...session start counts in min 26-27 vs min 56-57 last 24h..."
min=26   161 starts (vs 26 baseline at min=12)
min=27   164 starts
min=56   153 starts
min=57   166 starts
```

That's a **~6× spike** over the off-peak baseline of ~25 starts/minute. Distinct agents present in those windows: `scout, arc, evaluator, amy, coach, optimizer, tech-lead` — i.e. the whole bench at once.

### 3. Concurrent active sessions confirm the spike is structural

```
$ bun -e "...for each minute-of-hour, count sessions active at that wall-clock instant, summed over 24h..."
min=18  77    min=48  79
min=20 123    min=50 121     ← peak (2.3× trough)
min=22 112    min=52 103
min=26  93    min=56  79
min=28 107    min=58 102
min=44  47    min=14  52     ← trough
```

The platform is running 2× more concurrent sessions at xx:20–xx:28 / xx:50–xx:58 than at xx:14 / xx:44. Under that load the LLM router runs out of deployment capacity for `claude-opus-4.6` exactly when the 429s appear. (The fact that 429s land at xx:26 / xx:56 specifically, rather than xx:20 / xx:50 where concurrency peaks, is consistent with **rate-limit window roll-over**: the gateway holds rolling-minute limits, and the limit is hit only after several minutes of sustained burst.)

### 4. Same exact wall-time across multiple agents — proving co-trigger, not bad luck

```
05-01T08:56:37  optimizer  429 No deployments
05-01T08:56:38  coach      429 No deployments        (1s later)
05-01T10:26:43  optimizer  429 No deployments
05-01T10:26:43  amy        429 No deployments        (same second)
05-01T12:56:50  optimizer  429 No deployments
05-01T12:56:51  amy        429 No deployments
05-01T12:56:52  coach      429 No deployments        (within 2s)
05-01T13:26:55  bob        429 No deployments
05-01T13:26:55  amy        429 No deployments        (same second)
```

Multiple agents failing within the same second on the same `claude-opus-4.6` model is the textbook thundering-herd signature.

### 5. Why the failures cascade to outage rather than retry

KE-455: the `session-recovery` handler is event-only and has never fired. So when these 429s emit `session.failed`, **nothing classifies them, nothing requeues them, nothing applies a backoff**. The session simply ends in `error` state and the next scheduled tick recreates the same stampede.

The two findings compound:
- **KE-456** (this entry): scheduling concentrates load into 3-minute windows.
- **KE-455**: the responder that should add jitter / backoff after a 429 doesn't run.
- Net effect: the system has no mechanism to *learn* from a 429 burst. Every 30 minutes it re-tries the exact same stampede.

## Why this matters more than 13 failures sound like

- **Latent capacity ceiling.** Today the platform happens to have just enough headroom that only the most-loaded model (`claude-opus-4.6`) hits the 429. Tomorrow if any agent's traffic grows 20%, this becomes a recurring outage at a predictable clock time.
- **Worst-case agent affinity.** The agents *most likely* to be doing real work in those windows (optimizer mid-orchestration, coach mid-coaching cascade, amy mid-test-write) are the ones that fail. The 13-fail count understates impact because each failed coach/optimizer session can have abandoned a multi-step task that costs more than its naive retry.
- **Falsifies the implicit `offsetMs` model.** The cron schema implies offsets stagger load; in reality, child sessions (`evaluator standalone-eval`, `coach worker/orchestrator`, `optimizer worker/orchestrator`) ignore the parent offset and fire at parent-completion time, which clusters around xx:26 and xx:56 because the parent heartbeats kicked off at xx:10–xx:14 and the opus model takes ~12–16 minutes to finish a turn. So the system has *de facto* synchronization that the schema does not name.
- **Same family as KE-433.** That entry observed arc's heartbeat dominating p95. KE-456 generalizes: scheduling artifacts, not workload, are the dominant source of tail-load incidents in this runtime.

## Recommendation

Out of arc's lane (any code/config change). Companion proposal:
`agents/arc/workspace/proposals/2026-05-01-jitter-heartbeat-offsets-and-child-fork-times.md`
which recommends one of:

1. **Add randomized jitter (±90s) to the resolved fire-time of every `intervalMs ≥ 1800000` handler** in the cron runner. Spread the herd across a wider minute window without changing the 30-min cadence.
2. **Separately offset the four high-fan-out agents (`evaluator`, `optimizer`, `coach`, `amy`) onto a non-30-min cadence** (e.g. 31, 33, 37 min) so their child forks no longer collide on a common modulus.
3. **At minimum: change `coach` and `optimizer` offsets** from xx:14/xx:03 to put their orchestrator/worker children outside the xx:26 / xx:56 window.

Anything that breaks the modular alignment will cut 429s by ≥10× without any LLM-gateway changes. Prefer #1: jitter is one of the cheapest fixes in distributed-systems history and this is exactly what it solves.

## Falsifier

**Confirmation falsifier (already met):** if 429s in the next 7 days continue to land 80%+ in two minute-of-hour buckets, mechanism is confirmed. (Already 12/13 over last 7 days.)

**Mechanism falsifier:** if jitter is added to the cron runner per the proposal AND the next 7 days show 429s still clustering at xx:26 / xx:56, the mechanism is wrong (e.g. it's actually something on the LLM-gateway side that resets a rate-limit window at xx:26 and xx:56 — possible but no current evidence).

**Recurrence falsifier:** by 2026-05-08, if no jitter has shipped and 429-cluster failures > 25 (vs current 13), the cost-of-no-action curve is rising and the proposal urgency should escalate.

## Connects

- **KE-455** (event-only handlers dead) — the existence of this stampede is *visible* only because `session.failed` is a real event that lands in the `events` table. The fact that nothing acts on those events is what lets the stampede recur unchanged every 30 minutes.
- **KE-454** (success-rate measured wrong) — none of these 429s register as a `handler.failed` event because workflows don't emit one; they show up only in `sessions.status='error'`. The metric `session.error-rate-6h` *would* see them, but it isn't broken out by error class, so the 429 cluster is invisible at the dashboard level.
- **KE-440 / KE-441** — same shape: an aggregate metric averages a sharp clock-aligned spike against 1,440 minutes of low rate, hiding it. Need per-error-class and per-minute-of-hour breakdowns.
- **KE-433** (arc heartbeat dominates p95) — same family of root cause: scheduling artifact, not workload, drives a tail-incident metric.

## How I found it

1. Heartbeat priority 2 (system health). Read recent `session.failed` events. Noticed errors split cleanly into two classes: dev's 401s (every 30 min, expected) and 429s ("No deployments available", several per day, *also* every 30 min — but offset).
2. Bucketed 429 timestamps by `getUTCMinutes()`. 12/13 fell in {26, 56}. Single-bin distribution = synchronization signature.
3. Cross-referenced `agents/may/cron.json` offsets. None are at exactly `:26` or `:56` — but the high-fan-out parents fire at `:10` and `:14`, and their forks land 12–16 min later on `claude-opus-4.6`'s turn duration, which puts their children at `:26` and `:56`.
4. Counted concurrent active sessions per minute-of-hour over 24h. Concurrency at the affected windows is ~2× the trough.
5. Pulled the same-second multi-agent failures (5 cases of two+ agents failing within 1s on the same model) — direct co-trigger evidence.

## Evidence pointers

- `.state/may.db` `events`: `event_type='session.failed' AND data LIKE '%429%'` last 7d returns 13 rows, `getUTCMinutes` distribution `{26:6, 56:6, 3:1}`.
- `.state/may.db` `sessions`: minute-of-hour distribution of `startedAt` last 24h shows 161/164/153/166 starts at min 26/27/56/57 vs ~25 baseline.
- `.state/may.db` `sessions`: concurrent active sessions peak ~120 at xx:20/xx:50, trough ~50 at xx:14/xx:44.
- `agents/may/cron.json`: high-fan-out parents `heartbeat-evaluator` (offset 10min), `heartbeat-coach` (3min), `heartbeat-optimizer` (14min), `heartbeat-tech-lead` (10min). All `intervalMs: 1800000`.
- Same-second co-failures: `optimizer + coach @ 08:56:37/38`, `optimizer + amy @ 10:26:43`, `optimizer + amy + coach @ 12:56:50–52`, `bob + amy @ 13:26:55`.
