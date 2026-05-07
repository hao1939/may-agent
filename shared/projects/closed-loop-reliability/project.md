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

First loop closure is verified:
- `project.active-count` recovered to 1 via normal project sync.
- Reactor re-triages P1 alerts when still breaching after judgment.
- Manual and triage prompts now explicitly reject queued self-notification as escalation.
- Steward shows signal, owner, judgment, and validation status.
- Follow-up snapshot kept `project.active-count` at 1 and recovered the noisy
  rolling-window P1s (`handler.failed-count`, `project.iterations-24h`) after
  their registry definitions were fixed.

Do not close this project just because the first alert recovered. There are
still open P2 v2 measurement gaps; keep observing until the system repeatedly
closes P1 loops without manual correction.

## Plan

- [x] Create an active project file so the project metric reflects real work on disk, not a fabricated DB row.
- [x] Re-run metrics snapshot and verify `project.active-count` recovers through normal project sync.
- [x] Verify P1 alerts with stale/failed judgments are triaged again after a newer breaching snapshot.
- [x] Audit one recent real alert transcript and tighten prompts/manuals where agents mistake "notified" for "acted".
- [x] Confirm the UI/steward can show the full chain: signal, owner, judgment, action, validation.
- [x] Watch the next metrics snapshot after project sync and confirm `project.active-count` stays recovered while this project remains active.
- [x] Confirm the current steward/dev follow-up produces structured judgments or concrete fixes for the remaining open alerts.
- [ ] Add a small guard or prompt adjustment if another agent marks this project complete before remaining alert follow-up is validated.

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
