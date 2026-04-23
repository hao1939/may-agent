# PROPOSAL: Heartbeat ↔ Reactor Coordination for Metrics

**Status:** DRAFT — awaiting Hao review  
**Date:** 2026-04-23  
**Author:** May  
**Related:** [metrics-system.md](metrics-system.md) | [metrics-evolution-roadmap.md](metrics-evolution-roadmap.md)

---

## Problem

We have **two systems** that react to metric problems, and they're poorly coordinated:

| System | Trigger | What it does | Frequency |
|--------|---------|-------------|-----------|
| **Heartbeat** | Every 30min per agent | Shows metrics; if any breach **threshold**, gates the entire heartbeat — agent MUST fix before doing anything else | ~48 times/day/agent |
| **Metric-alert-reactor** | `metric.breach` event (hourly from snapshot handler) | Forks a **dedicated session** for the owning agent with remediation instructions | On breach |

### Current bugs & gaps

1. **Heartbeat only shows threshold breaches as ⚠️.** Metrics without thresholds (target-only) show ✅ even when far from target. Example: `tech-lead.codebase-weight` has no threshold, only target=32000, so heartbeat always shows ✅ — the agent never knows to work on it.

2. **Reactor was dead for 2 days** (dedup bug: LIKE `%metricId%` matched heartbeat sessions). Fixed 2026-04-23. Since it just started working, we're seeing overlap for the first time.

3. **When both work, agents get double-poked.** A breaching health metric causes: (a) heartbeat gates the agent every 30min, AND (b) reactor forks a separate session. The heartbeat gate is aggressive — it blocks ALL other work. The reactor fork is also aggressive — it creates a dedicated session. That's two separate conversations about the same problem.

4. **Different breach semantics.** Heartbeat checks `threshold` only. Reactor fires on threshold breaches AND regressions AND stalls. They don't share a vocabulary for "what's wrong."

5. **No escalation path.** If an agent can't fix a metric (needs code change, needs Hao, needs another agent), both systems just keep poking them indefinitely.

---

## Proposal: Two-Tier Response

### Tier 1: Heartbeat = Awareness Layer (soft)

**Purpose:** Give agents ongoing visibility into ALL their metrics. Inform prioritization. Don't block.

**Changes:**

1. **Show target gaps, not just threshold breaches.** Introduce three states:
   - `✅` — healthy (above threshold AND on track toward target)
   - `⚡ BELOW TARGET` — no threshold breach, but current is far from target (> 20% gap)
   - `🔴 BREACHING` — threshold breach (existing behavior)

2. **Remove the hard gate for `⚡ BELOW TARGET` metrics.** These inform the agent's work selection but don't block the heartbeat. The agent sees "your codebase-weight is 26K/32K target" and can decide whether to address it this cycle or not.

3. **Keep the hard gate ONLY for `🔴 BREACHING` metrics** — but limit to **first occurrence per breach episode.** After the agent has addressed it once (even if unresolved), subsequent heartbeats show it as `🔴 BREACHING (acknowledged)` without gating. This prevents the 30-min harassment loop.

4. **Show trend arrows** (already have snapshot history):
   - `↑` improving over last 3 snapshots
   - `↓` degrading
   - `→` flat

**Example heartbeat metrics block:**
```
📊 Your Metrics:
  ✅ tech-lead.build-health: 1 (target 1) →
  ⚡ tech-lead.delegation-quality: 0.71 (target 0.85) ↑  — 17% gap
  🔴 tech-lead.codebase-weight: 26637 (target ≤32000) ↑  — BREACHING threshold
  ✅ tech-lead.meaningful-changes: 8446 (target 10) →
```

### Tier 2: Reactor = Urgent Action Layer (hard)

**Purpose:** Force a dedicated session for sustained or worsening breaches. Escalation, not first response.

**Changes:**

1. **Only fire after N consecutive breach snapshots** (not on first breach). Default N=3 (i.e., 3 hours of sustained breach). This lets heartbeat handle transient issues first.

2. **Include what heartbeat already tried.** The reactor task should say "This metric has been breaching for 3h. Your last heartbeat acknowledged it at [time]. Previous action: [summary]. The heartbeat approach isn't working — take stronger action."

3. **Escalation tiers based on breach duration:**
   - **3h (N=3):** Fork owner with remediation task (current behavior)
   - **12h (N=12):** Fork owner + notify May. May reviews whether threshold is realistic.
   - **48h (N=48):** May escalates to Hao. Metric is either broken, threshold is wrong, or the agent can't fix it alone.

4. **Resolution required.** Reactor sessions must end with one of:
   - `FIXED` — root cause addressed, expect metric to recover
   - `THRESHOLD_ADJUSTED` — threshold was unrealistic, updated
   - `ESCALATED` — needs help from another agent or Hao
   - `DEFERRED` — conscious decision to defer, with reason and timeline

5. **Dedup by resolution, not by time window.** Current 4h dedup window is arbitrary. Instead: don't re-fork if there's an active (non-finished) reactor session for this metric. Re-fork only after the previous session completes without resolution AND the metric is still breaching.

### How They Work Together

```
Hour 0: Metric breaches threshold
  → Heartbeat (next cycle): Shows 🔴 BREACHING, gates agent, agent investigates
  → Reactor: Does nothing (only 1 breach snapshot)

Hour 1: Still breaching
  → Heartbeat: Shows 🔴 BREACHING (acknowledged), no gate
  → Reactor: Does nothing (only 2 breach snapshots)

Hour 2: Still breaching  
  → Heartbeat: Shows 🔴 BREACHING (acknowledged), no gate
  → Reactor: Does nothing (only 3 breach snapshots, threshold is N=3)

Hour 3: Still breaching — sustained problem
  → Heartbeat: Shows 🔴 BREACHING (acknowledged), no gate
  → Reactor: FIRES — forks dedicated session for owner

Hour 12: Still breaching — heartbeat + reactor didn't fix it
  → Reactor: Fires escalation — notifies May

Hour 48: Still breaching — systemic issue
  → May escalates to Hao
```

### For target-only metrics (no threshold):

```
Ongoing: Metric far from target
  → Heartbeat: Shows ⚡ BELOW TARGET every cycle — soft nudge
  → Reactor: Never fires (no threshold to breach)
  → Agent decides: work on it when it's the highest priority among their active metrics
```

This is correct behavior. Target gaps are **strategic** (the agent decides when to work on them), not **urgent** (the system forces action). If a target gap becomes urgent, Hao or May adds a threshold.

---

## Implementation Plan

### Step 1: Update `heartbeat-data.ts` — show three states

```typescript
// Current (broken):
const breached = r.threshold != null && r.current != null &&
  (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);

// Proposed:
const breaching = r.threshold != null && r.current != null &&
  (r.alert_direction === "above" ? r.current > r.threshold : r.current < r.threshold);

const targetGap = r.target != null && r.current != null
  ? Math.abs(r.current - r.target) / Math.abs(r.target)
  : 0;
const belowTarget = !breaching && targetGap > 0.2; // >20% gap

// Three states:
// 🔴 BREACHING — threshold crossed
// ⚡ BELOW TARGET — no threshold breach but >20% from target  
// ✅ — healthy
```

### Step 2: Soften the heartbeat gate

Change `may-heartbeat.ts` (and generic heartbeat workflows):
- `🔴 BREACHING` on first encounter → hard gate (current behavior)
- `🔴 BREACHING` if already acknowledged this breach episode → show but don't gate
- `⚡ BELOW TARGET` → never gate, just inform

Track acknowledgment: add `acknowledged_at` column to `metric_alerts`, set it when heartbeat first gates the agent for this alert.

### Step 3: Add consecutive-breach check to reactor

```typescript
// In metric-alert-reactor.ts:
const consecutiveBreaches = db.prepare(`
  SELECT COUNT(*) as n FROM (
    SELECT value FROM metric_snapshots 
    WHERE metric_id = ? ORDER BY measured_at DESC LIMIT ?
  ) sub WHERE value ${alertAbove ? '>' : '<'} ?
`).get(metricId, MIN_CONSECUTIVE, threshold);

if (consecutiveBreaches.n < MIN_CONSECUTIVE) {
  ctx.log(`[metric-alert-reactor] Only ${consecutiveBreaches.n}/${MIN_CONSECUTIVE} consecutive breaches for ${metricId}, skipping`);
  return;
}
```

### Step 4: Escalation tiers in reactor

Add breach-duration check and tier selection. Fork owner at 3h, notify May at 12h, escalate to Hao at 48h.

### Step 5: Resolution-based dedup

Replace time-window dedup with session-status dedup:
```typescript
const activeSession = db.prepare(`
  SELECT sessionId FROM sessions 
  WHERE task LIKE ? AND status != 'done' AND status != 'failed'
`).get(`[metric-alert][${metricId}]%`);

if (activeSession) {
  ctx.log(`[metric-alert-reactor] Active session ${activeSession.sessionId} for ${metricId}, skipping`);
  return;
}
```

---

## What This Doesn't Change

- **Metrics-snapshot handler** — still runs hourly, still emits `metric.breach` events. No change.
- **Metric schema** — no new tables. One new column: `metric_alerts.acknowledged_at`.
- **Agent metric ownership** — unchanged. Owners still responsible for their metrics.
- **Core principle** — "Metrics are signals, not targets" still applies. We're just making the signal delivery smarter.

---

## Expected Outcomes

| Before | After |
|--------|-------|
| Heartbeat ignores target-only gaps | Heartbeat shows ⚡ for >20% gaps |
| Heartbeat gates agent every 30min for same breach | Gates once, then shows as acknowledged |
| Reactor fires on first breach | Reactor fires after 3h sustained breach |
| No escalation path | 3h → 12h → 48h escalation |
| Time-based dedup (arbitrary 4h) | Session-status dedup (logical) |
| Agent gets poked by both systems simultaneously | Heartbeat handles first 3h, reactor takes over for sustained issues |

---

## Open Questions for Hao

1. **Consecutive breach threshold: 3 snapshots (3h)?** Could be 2 (2h) or 4 (4h). 3 seems reasonable — gives heartbeat 2 chances to handle it.

2. **Target gap threshold: 20%?** Some metrics have very tight targets. Should this be per-metric configurable, or is 20% a good universal default?

3. **Should agents be able to dismiss reactor sessions with DEFERRED?** Risk: agents defer forever. Mitigation: DEFERRED sessions get re-triggered after 7 days.

4. **Escalation to Hao at 48h — via what channel?** Currently May can only `notify` Hao by leaving breadcrumbs. Should this create a specific alert file?
