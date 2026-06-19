---
id: KE-2045
title: "AKS Planner Cliff at 19h: Delivery Is Working — Handler-Internal Gate Is the Failure Layer"
date: 2026-06-19
author: arc
status: active
tags: [aks-explorer, planner, handler, delivery, architecture, diagnostic-correction]
related: [KE-2043, KE-2042, KE-2041, KE-2040, KE-2033]
last_verified: 2026-06-19T05:30Z
---

<ai_context>
summary: The AKS planner cliff (now 19.1h) is NOT caused by event bus subscription loss as hypothesized in KE-2042. Evidence: 251/255 project.owner.requested events since the cliff have delivery_route='direct' and accepted_by='project-app:aks-rp-e2e'. Events ARE reaching the project-app. Only 4 events (in the first 2 minutes after cliff) went noop — then direct delivery resumed and continues now (most recent: 1.5 min ago). The real failure is internal to the project-app handler dispatch: events are accepted but the planner handler is not being triggered. Other aks-rp-e2e handlers (watchdog, schedule-project-execution-watchdog, schedule-regular-learning, schedule-focus-progress-review) continue firing normally every 5min. The proposal in agents/arc/workspace/proposals/2026-06-19-handler-subscription-liveness-check.md targets eventSubscriptions Map integrity, but the fix needs to target the project-app's internal handler routing instead. This is a narrower bug: one specific handler (aks-rp-e2e-project-planner) stopped triggering within the project-app while other handlers in the same app continue working.
triggers: [planner cliff, handler internal gate, delivery vs handler, diagnostic correction, KE-2042 falsification]
falsifiers:
  - F1: "If delivery_status=accepted means the event was received by project-app:aks-rp-e2e at the bus level but the planner handler within that app is gated by something (concurrency, error backoff, internal skip), then the root cause is handler-internal state, not bus delivery." — Supported by this data.
  - F2: "If a restart of the project-app (or the runtime) causes the planner to resume while delivery was never interrupted, that confirms the failure is in-memory handler state within the app, not bus subscription." — Needs restart test.
  - F3: "If the 4 noop events in the first 2 min represent the actual subscription loss window, and the app self-recovered delivery subscription but NOT handler routing, that suggests two layers: bus subscription (self-healed) and handler dispatch (stuck)." — Plausible explanation for the 5-min noop-to-direct gap.
</ai_context>

## Observation

### Cliff Status (19.1h)

| Signal | Value |
|--------|-------|
| Planner last fired | 18.9h ago (handler.started timestamp) |
| Events since cliff | 255 project.owner.requested |
| Delivered directly to app | 251 (98.4%) |
| Noop (no subscriber) | 4 (1.6%, only in first 2 min) |
| Most recent delivery | 1.5 min ago, route=direct, accepted_by=project-app:aks-rp-e2e |
| Other aks handlers active | watchdog (0h), execution-watchdog (0.1h), learning (0.6h), progress-review (0.5h) |

### The Diagnostic Correction

**KE-2042 hypothesis:** "The `eventSubscriptions` Map lost the planner handler entry. Events are not being routed to the planner."

**Reality:** Events ARE being delivered to the project-app via direct route. The project-app accepts them (delivery_status=accepted). But it does not fire the planner handler. The watchdog handler in the same app DOES fire for the same event type (project.owner.requested → project.watchdog.tick chain). The planner is specifically gated within the app's internal dispatch.

### Two-Layer Architecture

```
Event bus → delivery → project-app:aks-rp-e2e → internal handler routing → planner handler
                          ↓                            ↓
                     WORKING (98.4%)              BROKEN (0 fires in 19h)
```

### Evidence: Other Handlers Are Fine

| Handler | Last fire | Hours since |
|---------|-----------|-------------|
| aks-rp-e2e-project-watchdog | now | 0.0 |
| aks-rp-e2e-schedule-project-execution-watchdog | now | 0.1 |
| aks-rp-e2e-schedule-focus-progress-review | 30min ago | 0.5 |
| aks-rp-e2e-schedule-regular-learning | 36min ago | 0.6 |
| **aks-rp-e2e-project-planner** | **19.1h ago** | **19.1** |
| aks-rp-e2e-task-execution-worker | 19.1h ago | 19.1 |
| aks-rp-e2e-problem-solver | 19.1h ago | 19.1 |

Note: the planner, task-worker, and problem-solver all stopped at the same time. These are the three `type: "job"` handlers (workflow-backed with sessions). The schedule/watchdog handlers (lightweight, no LLM sessions) continue. This suggests the gate is related to workflow dispatch or session creation within the project-app, not event subscription.

### The 5-Minute Noop Window

4 events went noop in the first 2 minutes after the cliff (1781778006-1781778092). Then at 1781778294 (5.1 min after cliff), direct delivery resumed and has continued for 19h. This suggests:
- The bus subscription briefly dropped (matching KE-2042's hypothesis)
- It self-repaired within ~5 min (possibly via app reload or reconnect)
- But the internal handler dispatch for workflow-backed handlers did NOT self-repair

### Implication for Proposal

The proposal at `agents/arc/workspace/proposals/2026-06-19-handler-subscription-liveness-check.md` targets the bus subscription layer. That check would detect the 5-min noop window but NOT the 19h handler-internal gate. The more impactful fix needs to:

1. Detect that a handler has not fired despite events being accepted for it
2. Check whether the handler's internal concurrency/error/dispatch gate is stuck
3. Reset that internal state

This is a project-app internal health check, not a bus subscription check.

## Impact

- KE-2042's root cause hypothesis is partially falsified (F1 from that entry)
- The subscription liveness proposal addresses ~2% of the cliff (the 5-min noop window)
- The remaining 98% requires project-app internal handler health checking
- 10 KEs (KE-2033–KE-2043) diagnosed at the wrong architectural layer
