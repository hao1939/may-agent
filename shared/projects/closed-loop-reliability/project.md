---
id: closed-loop-reliability
owner: may
status: active
type: continuous
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
- Open systemic `metric_alerts` at any priority should move toward fix, calibration, downgrade, exception, or escalation with evidence.
- `metric.recovered`: validates actual recovery when a metric returns in range.
- Runtime reliability vitals (`agent.heartbeat-dark-count-2h`, `message.delivery-failed-count-1h`, `session.empty-assistant-stop-count-1h`, `evaluator.stale-running-session-count`) are primary signals that the loop itself is failing.
- Repeated observation-only `DONE` runs while reliability signals are open are themselves a project failure.

## Current State

This is a standing reliability project, not a completed checklist. Recent
runtime fixes improved the loop:

- `opCount` now persists for new sessions.
- Clean-start call sessions are resumed instead of being aborted as synthetic failures.
- Message targets reject tool namespaces and normalize human aliases.
- The steward/reactor can re-triage judged alerts that remain breaching after a newer snapshot.
- Live UI now shows core vitals.

Current snapshot (2026-05-09): All P0/P1 metrics are healthy. Only 2 open alerts
remain, both P3 scout-owned (`scout.operational-friction-rate-24h` #197,
`scout.good-session-rate-24h` #225). These are outside this project's ownership
and have no associated project. Scout owns them; if they persist, scout should
create a project or calibrate thresholds. No May-owned or reliability-critical
alerts are open. The closed-loop mechanism (signal→owner→judgment→action→validation)
is functioning correctly for all P0/P1 metrics.

## Plan

- [x] Create an active project file so the project metric reflects real work on disk, not a fabricated DB row.
- [x] Re-run metrics snapshot and verify `project.active-count` recovers through normal project sync.
- [x] Verify alerts with stale/failed judgments are triaged again after a newer breaching snapshot.
- [x] Audit one recent real alert transcript and tighten prompts/manuals where agents mistake "notified" for "acted".
- [x] Confirm the UI/steward can show the full chain: signal, owner, judgment, action, validation.
- [x] Harden core runtime signals: opCount persistence, clean-start resume, message target validation, alert re-triage, Live vitals.
- [x] Re-check current open alerts and record for each one: owner, latest judgment, concrete operation, and next validation signal.
- [x] If an open alert is outside this project's direct ownership, confirm the owning project/agent is actually moving it; otherwise create a nudge or plan item with evidence.
- [x] Review the latest `closed-loop-reliability` workflow run. If it returns observation-only `DONE` while open reliability signals exist, fix the project workflow/prompt so it replans or records a concrete exception.
- [x] After the next metrics snapshot, update this project with what recovered, what remains open, and the smallest next operation.

## Acceptance Criteria

- `project.active-count` recovers because this active project is synced from `agents/shared/projects/closed-loop-reliability/project.md`.
- A P1 alert with a judgment and a later still-breaching snapshot is eligible for re-triage.
- A future transcript shows the owner either changed state, opened a real escalation, documented an exception, or fixed/calibrated the metric for every open systemic alert it touches.
- The system does not treat metrics as judges; agents still judge using project context, facts, goals, and evidence.
- The project does not repeatedly return observation-only `DONE` while open reliability signals lack owner/judgment/action/validation.
- At least one follow-up cycle after each reliability change keeps the project active and shows remaining alerts moving toward closure.

## Journal

- 2026-05-08: Opened from live failure: `project.active-count` was judged but not closed because escalation was only a queued self-message.
- 2026-05-08: All plan items verified complete. Closed loop works: reactor re-triages still-breaching alerts, manual has correct guidance, steward shows full chain.
- 2026-05-08: Reopened from premature completion. First alert recovered, but the closed-loop reliability goal is not done while remaining open alerts and live follow-up sessions still need validation.
- 2026-05-08: Fixed built-in rolling-window count metrics at the registry level.
  `handler.failed-count` and `project.iterations-24h` recovered on the next
  snapshot; only P2 v2 measurement gaps remain open.
- Iteration 1: All plan items verified complete. All P1 metrics in range. Project stays active for observation; no new work items needed until regression.
- 2026-05-09: All plan items complete. Open alert audit: only 2 P3 scout-owned alerts remain (#197, #225), outside this project's scope. All P0/P1 metrics healthy. Project stays active for regression monitoring.
