---
title: "Deduplicate guard.triggered events per (sessionId, guard) pair"
date: 2026-06-18
author: arc
status: proposed
priority: P2
related: [KE-2007, KE-2000, KE-2005]
---

# Proposal: Deduplicate Guard Events Per Session

## Problem

The `guard.triggered-count-24h` metric (currently 4220, threshold 4500) has
required **5 threshold calibrations** in 10 days (1500→2000→2500→3500→4500)
and is about to breach again within hours. The root cause is structural:
the `beforeToolCall` hook emits a `guard.triggered` event **every tool call**
when a guard fires, not once per session.

Current data:
- aks-explorer: 2231 sessions/24h, avg 18.4 ops each
- Guard triggers from `beforeToolCall`: 4180/24h (99% of all triggers)
- ~1.89 triggers per aks-explorer session (many sessions see the same
  commit-guard warning repeatedly across multiple tool calls)
- Projected 24h total at current 6h rate (260/hr): ~6240 — 39% above threshold

The metric's purpose is to detect anomalous guard activity (new guard
misbehaving, agents repeatedly hitting blocks). Repeated warnings within
a single session don't add signal — the first warning already captures the
condition. Subsequent emissions just inflate the count proportional to
session length × volume.

## Evidence

Threshold calibration history (git log):
```
d950cdf52  → 1500
9da357108  1500 → 2000
483ca44d8  2000 → 2500
d5a0dfbb6  2500 → 3500
ac70bb0ab  3500 → 4500  (citing noise floor ~2100/day)
```

Current state (2026-06-18):
- 24h guard triggers: 4220 (vs 4500 threshold)
- 6h rate: 1560 (260/hr) — up from 78/hr measured at KE-2007 (Jun 15)
- aks-explorer sessions grew: 753 sessions/6h now vs lower when 4500 set
- Breach projected: ~3-6 hours as old low-rate windows roll off

## Proposed Change

In `manager.ts` `createGuardSignalHook()` (line ~1355), track emitted
(sessionId, guardName) pairs and skip re-emission for duplicates:

```typescript
// In createGuardSignalHook, maintain a Set per session
const emittedGuards = new Set<string>();

// Before emitting:
const key = `${sessionId}:${result.block ? 'block' : 'warn'}:${guardReason}`;
if (!emittedGuards.has(key)) {
  emittedGuards.add(key);
  this.bus?.emit({ type: "guard.triggered", ... });
}
```

The guard still **returns** its demand to the agent (warn/block behavior
unchanged), it just doesn't emit a duplicate event to the bus for
metric counting.

Alternative (simpler): deduplicate per (sessionId, demandType) — emit
at most 1 warn and 1 block event per session regardless of reason. This
is cruder but reduces events by ~90%.

## Expected Impact

- Triggers per aks-explorer session: ~1.89 → ~1.0 (each session emits
  1 event instead of repeating per tool call)
- Projected 24h metric: ~4200 → ~2200 (assuming ~2200 sessions fire a
  guard at least once)
- Eliminates need for further threshold calibrations driven by volume
- Preserves signal: new guard types or new agents hitting guards still
  show up as distinct (sessionId, guard) pairs

## Risks

- If a guard legitimately fires for **different reasons** within one
  session (e.g., first a hallucinated-path then a read-before-edit),
  those are already distinct guard names and would still emit separately.
- The `block` vs `warn` distinction is preserved in the dedup key, so
  escalation from warn→block within a session still emits.
- Low risk of losing real signal; the metric already counts 4180/4226
  from a single guard type (`beforeToolCall`) which is overwhelmingly
  the same warning repeated.

## Alternative: Just raise threshold again

Could raise 4500→7000 and punt. But this is the 6th calibration for the
same structural cause. The metric becomes meaningless if the threshold
tracks volume rather than anomalies.
