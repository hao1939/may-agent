---
id: KE-2040
title: "AKS Cliff at 14.3h — Planner Handler Silent Drop: 191 Events Unprocessed, Root Cause Narrowed"
date: 2026-06-19
author: arc
status: active
tags: [aks-explorer, throughput, handler, event-routing, system-health, deadlock]
related: [KE-2039, KE-2038, KE-2037, KE-2033]
last_verified: 2026-06-19T00:35Z
---

<ai_context>
summary: The AKS throughput cliff is now 14.3h old (10:22Z Jun 18 → 00:35Z Jun 19). Root cause narrowed from "dispatch is impotent" (KE-2039) to "planner handler has silently stopped processing project.owner.requested events." 191 project.owner.requested events emitted since the last planner handler fire at 10:19:48Z — all status=pending, handled_by=null. Zero handler.started, handler.completed, or handler.skipped events reference the planner handler in 14h. The watchdog fires every 5 min, the bus subscriber should route events to the planner, but the handler simply never triggers. The aks-rp-e2e task tree has 2 stale active leaf tasks with synthetic session IDs (s_task_...) that don't correspond to running sessions. 4 backlog tasks and 73 blocked tasks exist but cannot execute without the planner. dispatch-dedup has no aks-explorer entry, circuit-breaker file doesn't exist, and in-memory inflight auto-expires after 10 min — so known skip gates don't explain 14h silence.
triggers: heartbeat health check, KE-2039 continuation
falsifiers:
  - F1: "If the handler subscription map (`eventSubscriptions`) lost the planner entry due to a runtime hot-reload or app-loader re-registration, the planner would resume immediately after a runtime restart." — Requires runtime restart to test.
  - F2: "If the planner entry was de-registered (enabled=false or removed from entries[]) by a code change after 10:19Z, git log would show the change." — Check git log.
  - F3: "If the event bus subscriber ignores project.owner.requested because it matches the `isRunning` check for another handler, the triggerSubscribers path would be silently skipped for the planner." — Code review shows isRunning check only applies to heartbeat events, not domain events.
</ai_context>

## Observation

### Cliff Duration Update (00:35Z Jun 19)

| Metric | Value |
|--------|-------|
| Cliff start | 10:22:57Z Jun 18 |
| Current time | 00:35Z Jun 19 |
| Duration | **14.3 hours** |
| Last planner handler.started | `1781777988524` (10:19:48Z Jun 18) |
| owner.requested events since | **191** (all status=pending) |
| handler events for planner since | **0** (no started, completed, or skipped) |

### Root Cause Narrowing

KE-2039 documented the watchdog treadmill (141 unanswered requests in 12h). This entry narrows the root cause from "dispatch is impotent" to **"planner handler silently stopped triggering on subscribed events"**.

The event routing pipeline for aks-rp-e2e has three stages:

1. **Watchdog → event emission** ✅ Working. `aks-rp-e2e-project-watchdog` (cron, 5 min) runs every 5 min, dispatches `project-execution-watchdog` workflow, detects 2 stale active tasks, and emits `project.owner.requested` with reason `watchdog-stale-active-review`. 24 handler events in the last hour confirm continuous execution.

2. **Event bus → handler subscription** ❓ Broken. `project.owner.requested` events arrive on the bus. The bus subscriber calls `triggerSubscribers("project.owner.requested", event)`. The `eventSubscriptions` map should contain `"project.owner.requested" → Set{"aks-rp-e2e-project-planner"}`. But zero handler events fire for the planner.

3. **Handler → planner session** ⬜ Never reached. No planner session has started since 10:22:57Z.

### Eliminated Causes

| Mechanism | Status | Evidence |
|-----------|--------|----------|
| dispatch-dedup block | ❌ Not blocked | `.state/dispatch-dedup.json` has no aks-explorer entry |
| circuit breaker | ❌ No file | `.state/circuit-breaker.json` doesn't exist |
| inflight capacity lock | ❌ Auto-expires | `activeInflightStarts` prunes entries >10 min old |
| handler disabled | ❌ enabled: true | `app.ts` line 450 |
| projectId mismatch | ❌ Matches | Both event data and handler config use "aks-rp-e2e" |
| maxConcurrentTriggers | ❌ Default 1 | Planner doesn't set it; default allows 1 concurrent |
| code change disabling | ❌ No change | app.ts unchanged since tree update at 12:18Z |

### Remaining Hypothesis

The most likely cause is an **in-memory state desync** in the cron scheduler:
- The `eventSubscriptions` Map (rebuilt by `buildEventSubscriptions()`) may have lost the planner entry after a project-app reload or hot-update cycle.
- Or the `entries[]` array in the cron scheduler may no longer contain the planner entry despite the app.ts file still declaring it.
- This is an in-memory-only condition — no file or DB state will reveal it. Only a runtime restart or explicit `buildEventSubscriptions()` re-invocation would fix it.

### Task Tree State

```
tree.json (updated_at: 2026-06-18T12:18:59Z):
  Total tasks: 2188
  done: 2107, blocked: 73, active: 4, backlog: 4
  
Active leaves (2 — both stale):
  - rp-nodepool-trio-output-ownership-attach-and-checkpoint-20260618
    session: s_task_rp-nodepool-trio-... (not running)
  - vm-prerelease-autoscaling-row125-service-principal-contradiction-reconcile-20260618
    session: s_task_vm-prerelease-... (not running)
    
Backlog leaves (4 — runnable but planner won't assign them)
```

The 4 backlog tasks cannot become active without the planner assigning them. The 2 active tasks have synthetic session IDs that don't exist in the sessions table. The tree is structurally stuck.

### System Impact

| Metric | Value |
|--------|-------|
| DB size | 1630 MB (stable — cliff suppresses growth) |
| Session error rate | 5.9% (normal) |
| Handler fires/hr | 100 (inflated by watchdog treadmill) |
| AKS sessions in 14h | ~12 (all metric-alert-triage) |
| Watchdog events (14h) | ~191 (all unanswered) |

## Implication

1. **This is almost certainly a runtime restart fix.** The planner handler's event subscription is maintained in memory only. A process restart would rebuild the `eventSubscriptions` map and resume normal operation. This explains why previous cliffs (Jun 16, 10h) self-resolved — a daemon restart cleared the state.

2. **The watchdog treadmill is pure waste.** 191 events × ~2 handler fires each = ~382 handler invocations producing zero useful work. The watchdog should have a circuit breaker: after N consecutive unanswered watchdog-stale-active-review events, reduce frequency or escalate differently.

3. **Stale active tasks need a reaper.** The 2 stuck tasks have synthetic session IDs that never corresponded to real sessions. A periodic task-tree sanitizer that transitions tasks with dead sessions from "active" to "backlog" would break this deadlock class without requiring the planner.

4. **The cliff-duration record continues.** At 14.3h, this is 43% longer than the Jun 16 cliff (10h). KE-2038's F1 (recovery within 12h) is falsified.
