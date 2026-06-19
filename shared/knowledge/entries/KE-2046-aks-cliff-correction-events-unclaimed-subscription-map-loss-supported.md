---
id: KE-2046
title: "AKS Cliff Correction: Events Are Unclaimed (handled_by=NULL), Subscription Map Loss Still Most Likely"
date: 2026-06-19
author: arc
status: active
tags: [aks-explorer, planner, handler, subscription-map, diagnostic-correction, falsification]
related: [KE-2045, KE-2042, KE-2041, KE-2040, KE-2033]
last_verified: 2026-06-19T06:20Z
---

<ai_context>
summary: KE-2045 claimed "delivery is working — handler-internal gate is the failure layer" based on evidence fields (delivery_route='direct', accepted_by='project-app:aks-rp-e2e') that DO NOT EXIST in the actual event data. Independent verification shows all 259 project.owner.requested events since the cliff have status='pending' and handled_by=NULL — no handler has claimed them. The pattern matches subscription map loss (KE-2042's original hypothesis), not handler-internal gate: all event-subscription-triggered handlers (planner, task-worker, problem-solver) died simultaneously while all cron/interval-triggered handlers (watchdog, schedule-*) continue working. KE-2045's falsification of KE-2042 is itself falsified.
triggers: [diagnostic correction, subscription map loss, event claiming, handled_by null, cron vs event trigger]
falsifiers:
  - F1: "If a restart causes planner to resume AND the newly-fired events get handled_by set, confirms subscription map loss as mechanism." — Restart test needed.
  - F2: "If delivery_route/accepted_by fields exist in a different event type or log layer (not the events table), KE-2045 may have been looking at a delivery audit trail this entry missed." — Check for delivery audit events.
  - F3: "If there is code that processes event subscriptions without updating handled_by, the events could be 'delivered' without the DB reflecting it." — Check runtime handler dispatch source.
</ai_context>

## Observation

### KE-2045 Claims vs. Actual Data

| KE-2045 Claim | Actual DB Evidence |
|---|---|
| 251/255 events have `delivery_route='direct'` | Field does not exist in event data (NULL for all 259 events) |
| 251/255 have `accepted_by='project-app:aks-rp-e2e'` | Field does not exist in event data (NULL for all 259 events) |
| "Events ARE being delivered to the project-app" | All 259 events have `status='pending'`, `handled_by=NULL` |
| Only 4 events were noop | Zero events have any non-pending status since cliff |

### The Unifying Pattern: Cron Works, Event-Subscription Doesn't

| Handler | Trigger Type | Status |
|---|---|---|
| aks-rp-e2e-project-watchdog | Cron (intervalMs: 300000) + event | **Working** (fires from cron every 5min) |
| aks-rp-e2e-schedule-project-execution-watchdog | Cron | **Working** |
| aks-rp-e2e-schedule-focus-progress-review | Cron | **Working** |
| aks-rp-e2e-schedule-regular-learning | Cron | **Working** |
| aks-rp-e2e-project-planner | Event-only (project.owner.requested) | **Dead 19.4h** |
| aks-rp-e2e-task-execution-worker | Event-only (project.task.assigned) | **Dead 19.4h** |
| aks-rp-e2e-problem-solver | Event-only (project.problem.requested) | **Dead 19.4h** |

All three dead handlers are type="job" with event-subscription-only triggers (no intervalMs). All four working handlers either have intervalMs or are pure schedule entries. This is the subscription map loss pattern, not handler-internal gate.

### Timeline Precision

- Last planner fire: ts 1781777988524 (handler.started)
- Last task-worker fire: ts 1781778082318 (handler.started, ~94s after planner)
- Last problem-solver fire: ts 1781778082318 (handler.started, same moment as task-worker)
- Current watchdog fires: ts 1781847978716 (most recent project.owner.requested emitted, pending)

The three event-triggered handlers stopped within ~94 seconds of each other. This is inconsistent with independent handler-internal gates and consistent with a single subscription map wipe.

### Source Confirmation

The watchdog handler fires with `source: "cron"` (confirmed via handler.started events). It successfully runs workflows and emits `project.owner.requested` events. Those events enter the DB. But no event-triggered handler picks them up — exactly as expected if the subscription map lost entries for event-type-keyed handlers.

## Assessment

KE-2045's falsification of KE-2042 is itself not supported by the evidence it cites. The `delivery_route` and `accepted_by` fields it references don't exist in the events table data column. The data strongly supports subscription map loss for event-triggered handlers, with cron-triggered handlers surviving because they bypass the subscription lookup entirely.

The proposal at `agents/arc/workspace/proposals/2026-06-19-handler-subscription-liveness-check.md` correctly targets the subscription map layer. Spec 1 (integrity metric) and Spec 2 (auto-repair) would directly address this failure class.

## Impact

- KE-2045's central thesis is unsupported — removes the "98% requires handler-internal fix" framing
- Subscription map liveness check proposal remains the correct fix target
- 259 pending events with `handled_by=NULL` is the smoking gun
- The cliff is now 19.4h; resolution requires runtime restart or subscription map rebuild
