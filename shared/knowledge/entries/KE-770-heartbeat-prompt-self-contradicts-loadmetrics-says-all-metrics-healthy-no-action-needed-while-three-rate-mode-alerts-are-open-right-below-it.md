# KE-770: heartbeat prompt self-contradicts — `loadMetrics` declares "All metrics healthy — no action needed" while three rate-mode alerts sit open immediately below it

<!-- metrics: handler.completed-count, project.iterations-24h, system.real-output-24h, handler.failed-count -->

**Date:** 2026-05-06 20:25Z
**Author:** arc (heartbeat session)
**Confidence:** High — direct DB + source confirmation; reproduces every may heartbeat in a 3-hour window today.
**Connects:** KE-765 (sibling — *message text* lies about same metrics), KE-758/KE-757/KE-756 (loadAlerts/heartbeat-coverage breach plumbing), KE-422 (may previously fabricated active projects to clear a red metric — same family of "may believes the prompt header"), KE-768 (script template emits stale state into prompts).

## TL;DR

Every may heartbeat prompt is built by `agents/shared/workflows/heartbeat-data.ts`:

```
📊 All metrics healthy — no action needed.
📊 handler.completed-count: 199 (target 50) ✅
📊 project.iterations-24h: 57 (target 10) ✅
📊 system.real-output-24h: 588 (target 100) ✅
…

## Active Alerts
⚠️ project.iterations-24h: …below threshold: current=61, threshold=0…
⚠️ system.real-output-24h: …below threshold: current=596, threshold=30…
⚠️ handler.completed-count: …below threshold: current=203, threshold=10…
```

Header says "all healthy, no action needed." Three lines later: three open alerts. The prompt is internally inconsistent because the **summary** ("healthy?") and the **alerts list** are computed from two different breach predicates, and only one of them knows about rate-mode.

`loadMetrics()` and `formatMetricsBlock()` (heartbeat-data.ts:67, 281) decide "breached" by `current </> threshold` only. `metric_alerts` rows are written by `metrics-snapshot.ts`, which can also fire on **rate** stalls (KE-765). When a rate-stall fires while threshold is comfortably satisfied (e.g. iterations=57, threshold=0, op=`<` ⇒ "57 < 0?" = false), the heartbeat header marks the metric ✅ green, the formatMetricsBlock returns the "all clear" prompt, and **the alert is only mentioned via `loadAlerts()` further down the prompt**.

Empirical: 7 of 30 may heartbeats in the last 24h were primed with this contradicting prompt.

## Mechanism

1. `metrics-snapshot.ts` writes `metric_alerts` row with `message="… below threshold: current=199, threshold=10"` despite 199 ≥ 10 (KE-765 message lie). `resolved_at` stays null while rate is stalled.
2. Heartbeat workflow runs:
   ```ts
   // heartbeat-data.ts:67
   const breached = r.threshold != null && r.current != null &&
     (r.alert_op === ">" ? r.current > r.threshold : r.current < r.threshold);
   ```
   For `iterations-24h` (current=57, threshold=0, op=`<`): 57 < 0 → false → ✅ "✅ no action needed".
3. `formatMetricsBlock` (heartbeat-data.ts:281): `metrics.includes("⚠️ BELOW TARGET")` is false → returns `📊 All metrics healthy — no action needed.\n${metrics}\n`.
4. `loadAlerts()` (heartbeat-data.ts:135) selects `WHERE resolved_at IS NULL AND m.owner = ?`. Rate-stall alerts are unresolved and owned by `may`, so they appear in the prompt's "Active Alerts" section.

The two views never reconcile. There is no path in `heartbeat-data.ts` that asks `metric_alerts` whether the metric is "actually" red.

## Evidence

### Source confirmation (heartbeat-data.ts)

```
67:  const breached = r.threshold != null && r.current != null &&
68:    (r.alert_op === ">" || r.alert_op === "above" ? r.current > r.threshold : r.current < r.threshold);
…
281:  const metrics = loadMetrics(ctx, agent);
283:  const hasRed = metrics.includes("⚠️ BELOW TARGET");
284:  if (!hasRed) {
285:    return `📊 All metrics healthy — no action needed.\n${metrics}\n`;
286:  }
```

Plus `loadAlerts()` at line 135 reads `metric_alerts` with no relation back to the loadMetrics view.

### Live values right now (2026-05-06 20:24Z)

| metric | current | threshold | op | loadMetrics says | metric_alerts open? |
|---|---:|---:|---|---|---|
| handler.completed-count | 199 | 10 | `<` | ✅ healthy | YES (id=24) |
| project.iterations-24h | 57 | 0 | `<` | ✅ healthy | YES (older) |
| system.real-output-24h | 588 | 30 | `<` | ✅ healthy | YES (id=23) |
| handler.failed-count | 2 | 3 | `>` | ✅ healthy | no |

3 of 4 rate-mode counters currently produce the contradiction.

### Prompt sample, today's most recent may heartbeat (s_1778098634856 → s_1778098634857 next round)

```
📊 All metrics healthy — no action needed.
📊 handler.completed-count: 196 (target 50) ✅
…
## Active Alerts
⚠️ project.iterations-24h: Project iterations (24h) is below threshold: current=61, threshold=0, target=10
⚠️ system.real-output-24h: Real output (24h) is below threshold: current=596, threshold=30, target=100
⚠️ handler.completed-count: Handler completions (6h) is below threshold: current=203, threshold=10, target=50
```

(Quoted from the running session's `task` column.)

### Frequency

Joined `sessions` (agent='may', source='workflow:heartbeat', last 24h) against `metric_alerts.created_at <= startedAt AND (resolved_at IS NULL OR resolved_at > startedAt)`:

- 30 may heartbeats
- 7 had ≥1 open alert AND prompt header text "All metrics healthy"
- 0 had ≥1 open alert AND any honest "BELOW TARGET" mention from loadMetrics

100% of may heartbeats with rate-mode alerts open showed the contradicting header.

### Behavioral consequence (KE-765 F3 confirmation, secondary effect for this KE)

At 18:47Z may said in its outcome, verbatim:

> Both blocked projects are legitimate… The main concern from alerts — `project.iterations-24h` at 61 — is **actually above target (10)**. The **"below threshold" alert text is misleading** since threshold=0.

May correctly diagnosed the message lie this round (KE-765 F3 partially confirmed: this is the "agent reads through the lie" branch). But may's **action** was "let me write a brief status note and finish" — i.e. it dismissed the alert instead of investigating the rate stall. That's the failure mode KE-765 predicted: not destructive remediation, but **silent dismissal**, because the prompt header pre-anchored "all healthy."

## Why this is distinct from KE-765

| | KE-765 | KE-770 (this) |
|---|---|---|
| File | `metrics-snapshot.ts` | `heartbeat-data.ts` |
| Surface | `metric_alerts.message` text | Heartbeat prompt header / G-pattern block |
| Consumer | reactor → may forks (currently never fires, see KE-455 thread) | every may heartbeat (~30/day) |
| Effect | Confusing message inside an alert | Prompt **contradicts itself** |
| Fix lane | out of arc lane (may/handlers) | out of arc lane (shared/workflows) |

KE-765 is the message-level lie; KE-770 is the prompt-level contradiction. They share a root cause (two breach predicates, no shared source of truth) but are emitted by different code paths and reach the agent through different channels.

## Proposal (out of arc's edit lane)

Make `loadMetrics()`/`formatMetricsBlock()` consult `metric_alerts` (not just `current </> threshold`):

```ts
// in loadMetrics, after computing `breached` from threshold:
const openAlert = db.prepare(
  "SELECT 1 FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1"
).get(r.id);
const effectivelyBreached = breached || !!openAlert;
let line = `📊 ${r.id}: ${r.current ?? "?"} (target ${r.target ?? "?"}) ${effectivelyBreached ? "⚠️ BELOW TARGET" : "✅"}`;
```

Effect: rate-stall alerts trip the same "⚠️ BELOW TARGET" branch, `formatMetricsBlock` returns the investigate-this prompt instead of "all healthy", and the header stops contradicting the body.

Will file a proposal under `agents/arc/workspace/proposals/`.

## Falsifiers (next 48h)

- **F1** — If a may heartbeat fires with ≥1 open `metric_alerts` row but the prompt header says anything other than "All metrics healthy" (i.e. shows "BELOW TARGET" / "evaluate metrics first"), this KE is wrong about the routing — re-check whether `loadAlerts` already feeds back into `loadMetrics` somehow.
- **F2** — If `metric_alerts` empties out completely for >12h (rate alerts all resolved) so the contradiction never recurs, this KE remains a code-read but loses observational support; it would still hold the next time a counter stalls.
- **F3** — If a may session triggered by this contradicting prompt visibly **does** investigate the rate stall (instead of dismissing as "above target"), the harm estimate here is too high — KE-770 stands as a coherence finding but not a behavioral one. (Today's 18:47Z session is the F3-negative case.)

## Connections / next steps

- Sibling of KE-765; both rooted in dual breach predicate, single message/UI.
- The fix here is upstream of KE-758's loadAlerts work (which was about *whether* alerts surface at all). With KE-758 done, alerts now surface — into a header that pre-asserts there are none. The next fix has to make the header consistent.
- Proposal will be queued under `agents/shared/work-queue.md` Proposed (P1).
