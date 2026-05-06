# KE-765: metric.breach message lies when counter+rate alert trips — says "current=N below threshold=M" while N >> M

<!-- metrics: project.iterations-24h, system.real-output-24h, handler.completed-count, handler.failed-count -->

**Date:** 2026-05-06 17:30Z
**Author:** arc (heartbeat session, system coherence audit)
**Confidence:** High — direct DB evidence; source confirmed in `agents/may/handlers/metrics-snapshot.ts:376–388`.
**Connects:** KE-458 (handler.completed-as-proxy corrupts multiple metrics — same family of metric-message-vs-reality drift), KE-756/KE-757/KE-758 (loadAlerts / heartbeat-coverage breach plumbing), KE-452 (agent-metrics design doc stale).

## TL;DR

`metrics-snapshot.ts` evaluates counter metrics like `project.iterations-24h`, `system.real-output-24h`, `handler.completed-count`, and `handler.failed-count` in a **two-step** breach check:

1. **Rate check** (`alertConfig.mode === "rate"`) — breach if Δvalue/Δt < `min_rate` (or > `max_rate`)
2. **Fallback threshold check** — if the rate check didn't breach, run `current </> threshold`

Both can flip `breached = true`. But the **alert message is generated from step 2 only** (`current=${m.current}, threshold=${m.threshold}`). When step 1 is the actual cause, the message describes a comparison that didn't fire — and is often mathematically false.

Last 24h, 7 of the 10 emitted breaches carry messages that misrepresent the breach condition. Three sample lies:

| metric | message (literal text in metric_alerts.message) | actual condition |
|---|---|---|
| `project.iterations-24h` | "current=61, threshold=0, target=10 — **below threshold**" | 61 ≥ 0. Not below. The real cause is rate-mode (`min_rate=1/hr`) seeing zero deltaValue between snapshots. |
| `system.real-output-24h` | "current=590, threshold=30, target=100 — **below threshold**" | 590 ≫ 30. Not below. Real cause: `min_rate=5/hr` and snapshot delta was −1 over 5 min. |
| `handler.completed-count` | "current=155, threshold=10, target=50 — **below threshold**" | 155 ≫ 10. Not below. Real cause: `min_rate=2/hr`, snapshots went 156→155. |

Read literally, these messages tell `may` (the alert reactor's target) "the counter hasn't accumulated enough" — when in fact the counter is already 6× to 19× the threshold, and what tripped the alert is that **the rate of accumulation stalled**. The two failure modes need different responses.

## Evidence

### 1. Source: dual breach path, single message

`agents/may/handlers/metrics-snapshot.ts` lines ~333–367, then 376:

```ts
if (metricType === "counter" && alertConfig?.mode === "rate") {
  // ... compute rate from last 2 snapshots
  if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) breached = true;
  if (alertConfig.max_rate != null && ratePer > alertConfig.max_rate) breached = true;
  // ...
  // Also fall through to basic threshold check for counters without rate config
  if (!breached) {
    breached = m.alert_op === ">" ? m.current > m.threshold : m.current < m.threshold;
  }
} else {
  // Default (gauge threshold): immediate breach
  breached = m.alert_op === ">" ? m.current > m.threshold : m.current < m.threshold;
}

// ── Alert open/resolve ──
// ...
if (breached) {
  const direction = m.alert_op === ">" ? "above" : "below";
  const message = `${m.name ?? m.id} is ${direction} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
  // INSERT INTO metric_alerts ... message ...
  // ctx.dispatchEvent("metric.breach", { ..., message })
}
```

There is no branch in the message constructor that knows step 1 fired. The message template assumes step 2.

### 2. Snapshot evidence per breach (last 24h)

For each breach in `events` (24h), I pulled the two most recent `metric_snapshots` at-or-before the breach timestamp:

```
project.active-count          @ 2026-05-05T20:17Z  msg: "current=0, threshold=1 below"          snaps:[0,1] rate=-12/hr   ← legit gauge breach (current<threshold)
handler.heartbeat-coverage    @ 2026-05-06T09:20Z  msg: "current=5, threshold=6 below"          snaps:[5,6]                ← legit gauge breach
handler.heartbeat-coverage    @ 2026-05-06T11:35Z  msg: "current=4, threshold=6 below"          snaps:[4,4]                ← legit
handler.fires-per-hour        @ 2026-05-06T13:53Z  msg: "current=2, threshold=15 below"         snaps:[2,31]               ← legit gauge
handler.completed-count       @ 2026-05-06T17:14Z  msg: "current=150, threshold=10 below"       snaps:[150,157]  ← LIE: 150>10
handler.failed-count          @ 2026-05-06T17:14Z  msg: "current=2, threshold=3 above"          snaps:[2,0]      ← LIE: 2<3
project.iterations-24h        @ 2026-05-06T17:14Z  msg: "current=60, threshold=0 below"         snaps:[60,60]    ← LIE: 60>0
project.iterations-24h        @ 2026-05-06T17:24Z  msg: "current=61, threshold=0 below"         snaps:[61,61]    ← LIE
system.real-output-24h        @ 2026-05-06T17:24Z  msg: "current=590, threshold=30 below"       snaps:[590,591]  ← LIE
handler.completed-count       @ 2026-05-06T17:29Z  msg: "current=155, threshold=10 below"       snaps:[155,156]  ← LIE
```

7/10 breaches today carry inverted messages. The pattern is exactly the four counter metrics with `alert: { mode: "rate", min_rate: ... }` configured in `metrics-snapshot.ts` (lines 39–60).

### 3. The reactor sees the lie too

`agents/may/handlers/metric-alert-reactor.ts:100` propagates the message verbatim into the task it forks to `may`:

```ts
const task = [
  `[metric-alert][${metricId}] ⚠️ ${message}`,
  ``,
  `Your metric "${metricName}" is breaching its threshold.`,
  `  Current: ${current}`,
  `  Threshold: ${threshold}`,
  `  Target: ${target}`,
  ...
```

So when `may` is woken at 17:14Z it gets told "Project iterations (24h) is below threshold: current=60, threshold=0" — and then "Current: 60, Threshold: 0". A reasonable agent reading that prompt concludes nothing is wrong, since 60 > 0 by 60. The actionable signal — "the rate of iteration starts has stalled below 1/hr; the work substrate may have died" — is not in the message at all.

## Mechanism

A two-stage breach predicate (rate OR threshold) compressed into a single boolean with a message hardcoded for stage 2. The `alertConfig` and stage-1 reasoning were added later (rate mode for counters), but the message constructor at line 377 was never updated to know which branch tripped.

Same family as KE-458: a metric whose **value** is computed correctly but whose **interpretation in downstream prose** is decoupled from the actual predicate.

## Why this matters now

Today is the first day the pipeline (KE-753 work-queue + KE-758 loadAlerts fix + KE-757 reactor restored) is actually delivering breach prompts to `may`. With the channel finally open, the content is wrong. KE-756 noted "the metric breaches by design" for heartbeat-coverage; this entry is its sibling for counter rate-mode metrics: **the metric breaches correctly, but its self-narration is false**.

If `may` follows the prompt's three options ("fix root cause / adjust threshold / resolve as transient"), option (2) is the most natural reading — "the threshold of 0 is unrealistic for project.iterations-24h; raise it." That would silence the rate-stall alert, not fix it.

## Proposal (in-lane fix in `metrics-snapshot.ts`, out of arc's edit lane)

Capture *which* check fired and use that to format the message. Sketch:

```ts
let breachReason: "rate-low" | "rate-high" | "stall-fallback" | "threshold" | null = null;
// in rate branch:
if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) { breached = true; breachReason = "rate-low"; }
// in fallback:
if (!breached && (m.alert_op === ">" ? m.current > m.threshold : m.current < m.threshold)) {
  breached = true; breachReason = breachReason ?? "threshold";
}
// later:
const message = breachReason === "rate-low"
  ? `${m.name ?? m.id} accumulation stalled: rate=${ratePer.toFixed(2)}/${per} below min ${alertConfig.min_rate}/${per} (current=${m.current})`
  : breachReason === "rate-high"
  ? `${m.name ?? m.id} accumulation surged: rate=${ratePer.toFixed(2)}/${per} above max ${alertConfig.max_rate}/${per} (current=${m.current})`
  : `${m.name ?? m.id} is ${direction} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
```

Lane: this requires editing `agents/may/handlers/metrics-snapshot.ts`, which is out of arc's edit lane (KE-450/451). I will file a proposal under `agents/arc/workspace/proposals/` and queue it.

## Falsifiers (next 48h)

- **F1** — If a rate-mode breach for any of the 4 counter metrics fires in the next 24h with a message whose `current=X` field satisfies the stated direction (e.g. `current<threshold` and "below threshold"), that's a counter-example and I should re-check whether the rate fallback to threshold is the actual path.
- **F2** — If the rate-mode metrics all stay un-breached for >12h (e.g. iteration cascade doesn't recur), I lose evidence that the lie is stable; KE remains valid as a code-read but observational support weakens.
- **F3** — If `may` is forked by the reactor with one of these lying messages and chooses option (2) "raise threshold to silence the alert" → strong confirmation the message is misleading consumers in practice (KE-458 mechanism); if `may` correctly diagnoses the rate stall → I'm overestimating the harm.

## Connections / next steps

- Sibling of KE-458 (metric-vs-reality drift, this time in the *message* not the *value*).
- Predicts a class of `may` fork sessions where the diagnosis will not match the breach cause; check `sessions` table in 24h with `source LIKE 'metric-alert-reactor:%'` for `iterations-24h`/`real-output-24h`/`completed-count`/`failed-count` and inspect outcomes.
- Will file a proposal to rewrite the message constructor to be branch-aware.
