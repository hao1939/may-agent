# DESIGN: Heartbeat ↔ Reactor Coordination for Metrics

**Status:** DRAFT v2 — awaiting Hao review  
**Date:** 2026-04-23  
**Author:** May  
**Related:** [metrics-system.md](metrics-system.md) | [metrics-evolution-roadmap.md](metrics-evolution-roadmap.md)

---

## Problem

Two systems react to metric problems. They overlap and conflict:

| System | What it does | Problem |
|--------|-------------|---------|
| **Heartbeat** | Shows metrics; if threshold breached, **gates entire heartbeat** — agent can't do anything else | Gates every 30min for same breach. Ignores target-only gaps. |
| **Reactor** | On `metric.breach` event, forks dedicated session | Was broken (dedup bug, fixed). When working, double-pokes alongside heartbeat. |

Both try to force action. Neither knows about the other. Result: agent gets harassed by two systems for the same problem, while target-only gaps get zero attention.

---

## Proposal: Show ↔ Act

**Heartbeat shows. Reactor acts.** Clean separation.

### Heartbeat = Display Only

- Shows ALL metrics every cycle — breaches, target gaps, healthy ones
- **Never gates.** No more blocking the heartbeat for red metrics.
- Adds target gap visibility (metrics without thresholds currently always show ✅)
- Agent uses metrics to inform their own prioritization, per "metrics are signals not targets"

**Example:**
```
📊 Your Metrics:
  ✅ tech-lead.build-health: 1 (target 1)
  📉 tech-lead.delegation-quality: 0.71 (target 0.85) — 17% gap
  🔴 tech-lead.codebase-weight: 26637 (threshold ≤32000) — BREACHING
  ✅ tech-lead.meaningful-changes: 8446 (target 10)
```

Three states:
- `✅` — healthy
- `📉` — below target but no threshold breach (soft signal)
- `🔴` — threshold breach (hard signal, reactor will handle)

### Reactor = Immediate Action

- Fires immediately on `metric.breach` — no delay, no consecutive-breach check
- Forks a dedicated session for the owning agent
- Dedup: skip only if there's an **active (unfinished)** reactor session for this metric
- The reactor is the action channel. Its job is to react. Let it react.

### How They Coordinate

They don't need to. They have different jobs:

```
Breach happens:
  → Snapshot handler emits metric.breach
  → Reactor fires immediately → forks dedicated session
  → Next heartbeat shows 🔴 for awareness, but doesn't gate — agent continues normal work
  → Dedicated session handles the fix
```

No overlap because heartbeat doesn't act and reactor doesn't display. The agent sees the breach in heartbeat (context), and gets a dedicated session from reactor (action). These complement, not conflict.

For target-only gaps (no threshold):
```
  → Heartbeat shows 📉 every cycle — ongoing awareness
  → Reactor never fires (no breach event)
  → Agent decides when to work on it based on priority
  → If it becomes urgent, Hao/May adds a threshold → reactor kicks in
```

---

## Implementation

### 1. `heartbeat-data.ts` — add target gap visibility, remove gate

```typescript
// Show three states instead of two:
const breaching = r.threshold != null && r.current != null &&
  (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);
const belowTarget = !breaching && r.target != null && r.current != null &&
  Math.abs(r.current - r.target) / Math.abs(r.target) > 0.2;

const icon = breaching ? "🔴" : belowTarget ? "📉" : "✅";
const suffix = breaching ? "— BREACHING" : belowTarget ? `— ${Math.round(gap*100)}% gap` : "";
```

Remove the `formatMetricsBlock` hard-gate logic ("STOP. Your FIRST tool call must be...").

### 2. `may-heartbeat.ts` — remove red metric gate

Delete the `hasRedMetrics` gate block that forces agent to address metrics before doing anything else. Metrics are just shown in the context block.

### 3. `metric-alert-reactor.ts` — session-based dedup

Replace time-window dedup with:
```typescript
const activeSession = db.prepare(
  `SELECT sessionId FROM sessions 
   WHERE task LIKE ? AND finishedAt IS NULL`
).get(`[metric-alert][${metricId}]%`);
if (activeSession) return; // already being handled
```

No other changes to reactor — it already fires and forks correctly.

### That's it. Three changes.

---

## What This Removes

- The heartbeat red-metric gate (~30 lines in `may-heartbeat.ts`)
- The "STOP. MANDATORY." formatting in `formatMetricsBlock`
- Time-window dedup in reactor (replaced with session-status dedup)

## What This Adds

- Target gap display in heartbeat (~10 lines in `heartbeat-data.ts`)
- `📉` state for below-target metrics

## Schema Changes

None.

---

## Open Question

**Should 📉 (below target) suggest action?** Two options:
- (a) Just show the number and gap — agent decides (simpler)
- (b) For the worst 📉 metric, add a one-liner: "Consider working on X" (slightly more directive)

I lean (a) — keep it simple, trust agent judgment.
