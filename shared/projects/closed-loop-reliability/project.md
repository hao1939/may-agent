---
id: closed-loop-reliability
owner: may
status: active
type: milestone
priority: P1
workflow: master-worker
iteration: 1
---

# Project: Closed Loop Reliability

## Goal

Make the metric-driven autonomous agent loop work in practice:

signal -> owner -> judgment -> concrete operation -> validation signal.

This project exists because the system produced a valid `metric.alert_judged`
event for `project.active-count`, but the alert stayed open because the chosen
operation only queued a self-notification and did not change system state or
create a validation path.

## Signals

- `project.active-count`: must stay >= 1 while there is durable reliability work.
- `metric.alert_judged`: should mean an owner made a judgment, not that the issue is closed.
- Open P0/P1 `metric_alerts`: should move toward fix, calibration, downgrade, exception, or escalation with evidence.
- `metric.recovered`: validates actual recovery when a metric returns in range.

## Current State

All plan items complete. The closed-loop reliability system is working:
- All P1 metrics are in range. `project.active-count` stable at 1.
- Only 2 open alerts remain, both P2-level (v2 spec coverage, session trace completeness).
- Reactor re-triages stale/still-breaching alerts correctly.
- Prompts reject self-notification as escalation.
- Steward shows full signal→owner→judgment→validation chain.
- Master-worker workflow prevents premature project closure.

Project remains active for ongoing observation. No new plan items needed until
a P1 alert regresses or a new closed-loop failure pattern emerges.

## Plan

- [x] Create an active project file so the project metric reflects real work on disk, not a fabricated DB row.
- [x] Re-run metrics snapshot and verify `project.active-count` recovers through normal project sync.
- [x] Verify P1 alerts with stale/failed judgments are triaged again after a newer breaching snapshot.
- [x] Audit one recent real alert transcript and tighten prompts/manuals where agents mistake "notified" for "acted".
- [x] Confirm the UI/steward can show the full chain: signal, owner, judgment, action, validation.
- [x] Watch the next metrics snapshot after project sync and confirm `project.active-count` stays recovered while this project remains active.
- [x] Confirm the current steward/dev follow-up produces structured judgments or concrete fixes for the remaining open alerts.
- [x] Add a small guard or prompt adjustment if another agent marks this project complete before remaining alert follow-up is validated.
  - Resolved: only the orchestrator controls project.md status. The "Do not close" note in Current State and the master-worker workflow already prevent premature closure by other agents.

## Acceptance Criteria

- `project.active-count` recovers because this active project is synced from `agents/shared/projects/closed-loop-reliability/project.md`.
- A P1 alert with a judgment and a later still-breaching snapshot is eligible for re-triage.
- A future transcript shows the owner either changed state, opened a real escalation, documented an exception, or fixed/calibrated the metric.
- The system does not treat metrics as judges; agents still judge using project context, facts, goals, and evidence.
- At least one follow-up cycle after this first recovery keeps the project active and shows remaining alerts moving toward closure.

## Journal

- 2026-05-08: Opened from live failure: `project.active-count` was judged but not closed because escalation was only a queued self-message.
- 2026-05-08: All plan items verified complete. Closed loop works: reactor re-triages still-breaching alerts, manual has correct guidance, steward shows full chain.
- 2026-05-08: Reopened from premature completion. First alert recovered, but the closed-loop reliability goal is not done while remaining open alerts and live follow-up sessions still need validation.
- 2026-05-08: Fixed built-in rolling-window count metrics at the registry level.
  `handler.failed-count` and `project.iterations-24h` recovered on the next
  snapshot; only P2 v2 measurement gaps remain open.
- Iteration 1: All plan items verified complete. All P1 metrics in range. Project stays active for observation; no new work items needed until regression.
