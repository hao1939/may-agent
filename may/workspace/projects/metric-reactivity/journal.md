# Metric Reactivity — Journal

## 2026-04-20 — Project Created
- 4 active yellow alerts, zero agent response
- Gap: metrics-snapshot writes alerts to DB, nobody reads them
- No delivery mechanism from alert → agent
- Aligns with metric-oriented + event-driven principles from common-sense

## 2026-04-20 — Investigation Complete (Milestone 1)

### Root Cause Analysis
The alert pipeline has 3 stages, and stage 3 (delivery) is missing:

1. **Detection** ✅ — `metrics-snapshot.ts` checks thresholds, fires alerts via `fireAlert()` which inserts into `metric_alerts` table. Deduplication works (won't re-alert if unresolved alert exists).

2. **Recording** ✅ — Alerts stored in `metric_alerts` table with severity, message, value, threshold. Auto-resolution works when metrics recover.

3. **Delivery** ❌ — Three gaps:
   - `notifyOwnerOnRegression()` calls `ctx.trackRequest({method: "message"})` but this only creates a tracking record — it does NOT call `notify()` or `fork()` to actually reach the agent.
   - No agent heartbeat reads `metric_alerts` table for active alerts.
   - Only consumers of alert data: `proof-of-life` handler (counts for reporting) and dashboard HTTP API (`getAlerts()`). Neither reaches agents.

### The Exact Gap
`trackRequest()` ≠ delivery. It records intent but doesn't execute it. The `notifyOwnerOnRegression` function thinks it's notifying the owner, but it's only logging that it wants to. Nobody picks up the tracked request and actually sends a notification.

### Recommended Fix (for Design milestone)
Two complementary approaches:
- **Push**: After `trackRequest()`, also call `ctx.notify()` or the `notify` tool equivalent to actually reach the owning agent
- **Pull**: Inject active alerts into agent heartbeat context (e.g., read `metric_alerts WHERE resolved_at IS NULL` and include in heartbeat prompt)

## 2026-04-20 — Design Complete (Milestone 2)

### Decision: Push via `notify()` + Pull via heartbeat context

#### Fix 1: Push — Make `notifyOwnerOnRegression` actually notify (metrics-snapshot.ts)

**Problem**: `ctx.trackRequest()` at line 317 only logs intent. It doesn't deliver.

**Fix**: After `ctx.trackRequest()`, add a `notify()` call to the owning agent:
```ts
ctx.notify({
  agent: metric.owner,
  message: task,
  priority: "P1",
});
```

**Blocker**: Need to verify HandlerContext exposes a `notify()` method. The interface is defined in the agent runtime (not a standalone `.ts` file in the repo). Check `agent-loader` or equivalent for available methods.

#### Fix 2: Pull — Inject active alerts into heartbeat context

**Where**: `agents/shared/workflows/agent-heartbeat.ts` or per-agent heartbeat files.

In the `check-health` step, query `metric_alerts WHERE resolved_at IS NULL AND owner = :agent` and inject into the step prompt. Every heartbeat shows the agent their unresolved alerts.

#### Fix 3: Verify ownership mapping

Metrics already have `owner` field. Naming convention confirms:
- `evaluator.coverage` → evaluator
- `tech-lead.build-health` → tech-lead
- `tech-lead.meaningful-changes` → tech-lead
- `qa.review-coverage` → qa

#### Resolved questions
- **Interrupt vs wait?** → Push (notify) for new regressions, Pull (heartbeat) for ongoing awareness. Both needed.
- **Alert fatigue?** → Dedup already exists in `fireAlert()`. Push only on NEW regressions. Heartbeat shows count summary.
