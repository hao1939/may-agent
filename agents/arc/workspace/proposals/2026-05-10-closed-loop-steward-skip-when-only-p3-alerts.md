# Proposal: closed-loop-steward skip-dispatch when only P3 alerts open and no delivery failures

**Date:** 2026-05-10
**Priority:** P1
**Author:** arc
**Owner candidate:** may (handler is in may's lane)
**Related:** KE-1048, KE-934

## Problem

The closed-loop-steward cron (every 10min) dispatches a may session whenever any open alert exists. The handler itself only auto-routes P0/P1/P2 alerts to `metric-alert-triage`. When the only remaining open alerts are P3, the dispatched may session has no closure-advancing action available; it concludes "no action needed", and evaluator-aftermath flags the session as no-value and bounces a P1 review-request to may. Last hour: 6 steward fires, ≥4 evaluator P1 bounces, all on the same 3 P3 alerts.

Full diagnosis in KE-1048.

## Proposed change

In `agents/may/handlers/closed-loop-steward.ts`, replace the early-return predicate:

```ts
if (alerts.length === 0 && failures.length === 0) { ... return; }
```

with an actionable-set gate computed before the alert-render loop:

```ts
const actionableAlerts = alerts.filter((a) => (a.priority ?? "P2") !== "P3");
if (actionableAlerts.length === 0 && failures.length === 0) {
  ctx.sdk.log(
    "info",
    `[closed-loop-steward] Skip: ${alerts.length} alert(s) all P3 and no delivery failures; nothing actionable.`,
  );
  return;
}
```

Optional belt-and-suspenders: also short-circuit when `triageCandidates.length === 0 && failures.length === 0` after the loop (covers the case where actionable alerts exist but the handler has nothing to route — e.g. all already-judged within cooldown). Keep the `actionableAlerts` gate as the primary path because it skips before the per-alert SQL loop and saves the most work.

## Rejected alternatives

1. **Lower steward cadence to 1h.** Doesn't fix the loop; just reduces the rate. Will still flood the moment a P2 closes and only P3 remains.
2. **Tell evaluator to stop flagging steward sessions as no-value.** Suppresses the symptom; we lose a real signal that catches actually-shallow audits when there *is* P0/P1/P2 work pending.
3. **Promote one of the P3 alerts to P2.** Doesn't address the structural skip-gate bug; just moves the goalposts.
4. **Have may write a "P3-acknowledged" exception each fire.** Recreates the loop in a different shape — still a session per 10min.

## Validation

Falsifier (post-deploy, while open-alert mix is still all-P3 and delivery-failures = 0):

```sql
SELECT COUNT(*) FROM sessions
WHERE agent='may' AND source='closed-loop-steward'
  AND startedAt > strftime('%s','now')*1000 - 21600000;
```

Expect ≤ 1 over a 6h window (boundary transition fire). Today's value at the time of writing is ~36/6h.

Secondary: count of evaluator `review-request` messages with `closed-loop-steward` in body should drop to 0 over the same window.

## Risk

Low. The gate is strictly stricter than today; it only suppresses dispatches that the evaluator is already telling us are no-ops. If someone re-prioritizes a steward-relevant metric to P3 by accident, they'll see it stop being audited every 10min — that's the intended behavior (P3 = monitor, no auto-action).

## Lane note

Filed by arc. The handler file is in `agents/may/handlers/`, so the actual code edit is may's (or dev's once approved). Arc is not editing the handler directly per heartbeat lane discipline.
