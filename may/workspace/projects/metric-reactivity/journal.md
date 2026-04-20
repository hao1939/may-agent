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

## 2026-04-20 — Build Progress: Delivery Already Works

### Key Finding
The delivery mechanism is NOT broken — it's working. Evidence:
- `trackRequest({toAgent: "evaluator", task: "⚠️ Metric 'Coverage' regressed..."})` creates records with status CREATED
- These appear as "Injected: pending tasks" in target agent heartbeats
- Agent heartbeat.md files already instruct agents to check injected tasks and act on red metrics

### What's Actually Missing
1. **One-shot delivery**: `notifyOwnerOnRegression` fires ONCE on regression. If the agent ignores/misses it, no reminder comes. Unresolved alerts persist in `metric_alerts` but aren't re-surfaced.
2. **Agent compliance**: Agents (evaluator, tech-lead, qa) are seeing alerts but not acting. This is behavioral, not plumbing.

### Remaining Build Work
- Add periodic re-notification for unresolved alerts (e.g., every N heartbeats, re-create trackRequest if alert still unresolved and prior request status is still CREATED)
- Consider escalation: if alert unresolved > 24h, escalate to May

### No-op Items (already working)
- ~~Push via notify()~~: trackRequest already delivers via injection. No need for separate notify.
- ~~Pull via heartbeat context~~: "Injected: metrics" already shows threshold violations to agents.

## 2026-04-21 — Build Complete (Milestone 3)

### Changes Made

1. **Pull fix — `agents/shared/workflows/agent-heartbeat.ts`**: Added active metric alert query to the `check-health` step prompt. Every agent's heartbeat now instructs them to check for unresolved alerts matching their name prefix (e.g., `evaluator.%` for evaluator). This ensures agents see their alerts every heartbeat, not just on first regression.

2. **Push fix — `agents/may/handlers/metrics-snapshot.ts`**: Added `ctx.notify()` call after `ctx.trackRequest()` in `notifyOwnerOnRegression`. Now when a metric regresses, the owner gets both a tracked request AND a notification.

### Verification Needed
- Next heartbeat cycle: agents should see their active alerts in check-health step
- Next metric regression: owner should receive notify() in addition to trackRequest

## 2026-04-21 — Verify: Partial Progress (Milestone 4)

### Evidence collected
- All 4 alerts still unresolved (qa.review-coverage, tech-lead.meaningful-changes, evaluator.coverage, tech-lead.build-health)
- **Push delivery confirmed working**: evaluator received 2 "Coverage regressed" trackRequests (status: CREATED). Bob received "Hypotheses resolved" regression notice.
- **Pull delivery confirmed in code**: `agent-heartbeat.ts` line 71 injects active alerts query into check-health step
- **Agent reaction: NONE** — all regression trackRequests still status CREATED, no agent has acted

### Assessment
Plumbing works. Delivery works. The gap is now **agent compliance** — agents receive alerts but don't prioritize acting on them. This may require:
1. Waiting for more heartbeat cycles with the new pull injection
2. Escalation: if still no reaction after 24h, May should notify agents directly with P0 priority
3. Heartbeat instruction tuning: make alert response mandatory, not optional

### Next
- Re-check in next heartbeat cycle
- If still no reaction, escalate via direct notify() to each owning agent

## 2026-04-21 — Escalation Sent

All 4 alerts still unresolved. qa.review-coverage has been open 51h (well past 24h threshold). Sent P0 escalation notifications to all 3 owning agents (qa, tech-lead, evaluator) via notify(). Heartbeats triggered for qa and tech-lead. Evaluator heartbeat not triggered (may need manual follow-up).

Milestone 4 (Verify) remains incomplete — waiting for agent responses to escalation.

## 2026-04-22 — Unblocked: Mandatory Alert Response

### Problem
Agent compliance was the blocker — alerts were delivered but ignored. Root cause: heartbeat instruction said "investigate and act" but didn't make it mandatory or top-priority.

### Changes
1. **`agents/shared/workflows/agent-heartbeat.ts`**: Strengthened alert instruction to MANDATORY. Alerts now explicitly override other work. Agents told to diagnose, act, and report — not defer.

### Status
Unblocked. Next heartbeat cycle should show whether mandatory framing changes agent behavior. If still no reaction after 1 cycle, will fork agents directly with alert-specific investigation tasks.

## 2026-04-22 — Event-Driven Auto-Fork Implemented

### Problem
Hao's feedback (April 20): "Don't rely on heartbeats to deliver alerts. Metric breach should auto-fork the responsible agent with a task. Event-driven, not poll-driven."

Despite mandatory heartbeat framing, alerts grew from 4→7. Agents still not acting. `trackRequest` + `notify` are passive — they wait for the agent's next heartbeat to pick up the task.

### Fix
**`agents/may/handlers/metrics-snapshot.ts`**: Replaced `ctx.notify()` with `ctx.manager.run()` in `notifyOwnerOnRegression`. Now when a metric regresses, the owning agent is **immediately forked** with an investigation task. Falls back to notify() if fork fails.

This is the event-driven model Hao requested: metric crosses threshold → auto-fork responsible agent → agent gets a dedicated session to investigate and fix.

### Alerts Status (7 unresolved)
- `qa.review-coverage` (51h+) — qa
- `tech-lead.meaningful-changes` — tech-lead
- `evaluator.coverage` — evaluator  
- `tech-lead.build-health` — tech-lead
- `optimizer.quality-preserved` — optimizer (NEW)
- `coach.knowledge-to-action-latency` — coach (NEW)
- `optimizer.waste-reduction` — optimizer (NEW)

### Next
- Milestone 4 (Verify): Wait for next metrics-snapshot run to trigger auto-fork on regression
- Consider: should we also auto-fork for EXISTING unresolved alerts (one-time backfill)?

## 2026-04-22 — Verification: Auto-Fork Never Fired + Manual Backfill

### Key Finding
Queried `sessions WHERE source='metric-alert'` → **0 results**. The auto-fork mechanism in `notifyOwnerOnRegression` has NEVER actually triggered. 

**Root cause**: The function only fires when `newValue < oldValue AND newValue < threshold`. Once a metric is already below threshold and stays flat (or recovers slightly), no regression is detected. All 7 unresolved alerts represent metrics that breached once and then flatlined — the fork condition was never met again.

### Manual Backfill
Forked 3 agents and notified 2 for their unresolved alerts:
- **tech-lead** (forked P0): build-health + meaningful-changes
- **evaluator** (forked P0): coverage 79 < 80
- **optimizer** (forked P1): quality-preserved + waste-reduction  
- **qa** (notified P0): review-coverage 0 < 1 (60h+ unresolved)
- **coach** (notified P1): knowledge-to-action-latency stalled

### Design Gap Identified
The auto-fork only triggers on *new regressions* (value getting worse). It does NOT re-fork for:
- Alerts that stay unresolved (agent ignored first notification)
- Metrics below threshold but stable (not getting worse)

**Proposed fix**: Add a periodic "stale alert" re-fork — if an alert has been unresolved > 24h and no metric-alert session exists in the last 12h, auto-fork the owner again.

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

## 2026-04-23 — Status Review (Persistent Task)

### Current State
- **Build (Milestone 3)**: Complete. Auto-fork on regression + mandatory heartbeat alerts both implemented.
- **Verify (Milestone 4)**: Partially complete. Auto-fork confirmed to never have fired (no `source=metric-alert` sessions exist in any accessible DB). Manual backfill was done. Waiting for a real regression event to validate the auto-fork path end-to-end.
- **Measure (Milestone 5)**: Not started.

### Remaining Gaps
1. **Stale alert re-fork**: Identified in April 22 journal but never implemented. If an alert stays unresolved >24h and no metric-alert session exists in last 12h, the owner should be re-forked. Without this, a single missed fork = permanent silence.
2. **No metrics DB accessible**: Cannot verify current alert state (no `.state/may.db` or `data/metrics.db` found at expected paths). Need to confirm DB location.
3. **Milestone 5 (Measure)**: Need to define and register an `alert-to-reaction-time` metric in the metrics system.

### Recommendations
- Implement stale-alert re-fork in `metrics-snapshot.ts` (check unresolved alerts age, re-fork if owner hasn't responded)
- Add `alert-reaction-time` metric: measure time from `metric_alerts.created_at` to `resolved_at`
- Once a real regression fires and auto-fork triggers successfully, mark Milestone 4 complete
