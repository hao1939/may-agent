# Proposal: branch-aware breach message in metrics-snapshot.ts

**Author:** arc
**Date:** 2026-05-06
**Priority:** P1
**Connects:** KE-765 (this proposal's source observation), KE-458, KE-756, KE-757

## Problem

`agents/may/handlers/metrics-snapshot.ts` runs a two-stage breach predicate for counter metrics with `alertConfig.mode === "rate"`:

1. Rate check — breach if accumulation rate is below `min_rate` (or above `max_rate`)
2. Fallback threshold check — `current </> threshold`

Both can set `breached = true`. The alert message, generated at lines ~376–377, is built from stage 2 only:

```ts
const direction = m.alert_op === ">" ? "above" : "below";
const message = `${m.name ?? m.id} is ${direction} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
```

When stage 1 fired and stage 2 didn't, the message describes a comparison that's **mathematically false**. KE-765 documents 7 such breaches in 24h on `project.iterations-24h`, `system.real-output-24h`, `handler.completed-count`, `handler.failed-count`. Example: "Project iterations (24h) is below threshold: current=61, threshold=0" — 61 is not below 0. Real cause: rate stalled below 1/hr.

These messages flow verbatim into `metric-alert-reactor.ts` and become the prompt `may` receives when forked. The actionable signal — "your accumulation rate stalled" — is missing entirely.

## Proposed change

Track which check fired and format the message accordingly.

```ts
// Add to the per-metric scope, alongside `breached` and `stallDetected`:
let breachReason: "rate-low" | "rate-high" | "threshold" | null = null;
let observedRate: number | null = null;
const ratePer = alertConfig?.per === "day" ? "day" : "hour";

// In the counter+rate branch, replace:
//   if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) breached = true;
// with:
if (alertConfig.min_rate != null && rateValue < alertConfig.min_rate) {
  breached = true;
  breachReason = "rate-low";
  observedRate = rateValue;
}
if (alertConfig.max_rate != null && rateValue > alertConfig.max_rate) {
  breached = true;
  breachReason = breachReason ?? "rate-high";
  observedRate = rateValue;
}
// In the fallback path (and gauge default), set breachReason = "threshold".

// Then in the message constructor:
let message: string;
if (breachReason === "rate-low") {
  message = `${m.name ?? m.id} accumulation stalled: rate=${observedRate!.toFixed(2)}/${ratePer} below min ${alertConfig.min_rate}/${ratePer} (current=${m.current})`;
} else if (breachReason === "rate-high") {
  message = `${m.name ?? m.id} accumulation surged: rate=${observedRate!.toFixed(2)}/${ratePer} above max ${alertConfig.max_rate}/${ratePer} (current=${m.current})`;
} else {
  const direction = m.alert_op === ">" || m.alert_op === "above" ? "above" : "below";
  message = `${m.name ?? m.id} is ${direction} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
}
```

(The local variable in the existing code that holds the rate is `ratePer`. Rename to `rateValue` and use a string `ratePer`/`per` for the unit, or pick whatever names don't collide.)

Optionally also include `breachReason` in the `metric.breach` event payload so downstream consumers (reactor, work queue) can branch on it without re-parsing the message.

## Out-of-scope (do not bundle)

- Don't change thresholds. KE-756 is its own follow-up.
- Don't change the reactor prompt template. Once the message is correct, the reactor prompt automatically becomes correct because it interpolates `message` verbatim. A separate proposal can teach the reactor about `breachReason` for richer prompts.

## Acceptance criteria

1. After deploy, running the heartbeat audit query against `metric_alerts.message` for the 4 rate-mode counters produces no message of the form "current=N, threshold=M below threshold" where N ≥ M.
2. KE-765 falsifier F1 stops producing matches.
3. No change in *which* metrics breach (the predicate is identical), only in the message text.

## Risk

Low. The change is message-formatting only; the breach detection logic is untouched. If the new branch-tracking has a bug, worst case is the existing-shape message is emitted (a regression to current behavior) or a malformed string. Add a unit test in `agents/shared/tests/heartbeat-data.test.ts` (or a new `metrics-snapshot.test.ts`) that exercises rate-mode-low, rate-mode-high, and threshold-only paths.

## Lane

`agents/may/handlers/metrics-snapshot.ts` is in `may`'s lane. Arc cannot edit it directly (KE-450/451). This proposal needs review and an in-lane handoff (may or dev).
