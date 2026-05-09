---
id: closed-loop-reliability
owner: may
status: active
type: continuous
priority: P1
workflow: master-worker
iteration: 3
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

Current snapshot (2026-05-09): all P0/P1 runtime reliability vitals are green.
Three lower-priority alerts remain open:

- **#255** `v2.spec-coverage-rate` (P2, may): judgment=downgrade_priority. Owning
  project `v2-spec-coverage-buildout` exists, status=waiting for human review at
  0.7727 coverage. Has a clear resume condition. No action needed from this project.
- **#197** `scout.operational-friction-rate-24h` (P3, scout): judgment=downgrade_priority.
  Current=0.735 vs threshold=0.3. Metric source is evaluation verdicts (86/117 = 74%
  needs_improvement in 24h). Root cause: evaluator heuristic quality, not scout ops.
  Owning project: `evaluator-low-quality-rate-calibration` (blocked on human input).
- **#225** `scout.good-session-rate-24h` (P3, scout): judgment=resolve_stale (prior
  alert resolved, new one re-fired). Current=0.265 vs threshold=0.65. Same root cause:
  evaluator heuristic verdicts. Same owning dependency.

Decision: all three prior open alerts have owning projects or identified root causes.
#255 → v2-spec-coverage-buildout (waiting). #197/#225 → evaluator heuristic
quality, tracked by evaluator-low-quality-rate-calibration (blocked on human).

New alert #256 `project.blocked-count` (P2, may) fired: current=5, threshold=4,
target=2. This is a meta-metric — too many projects stuck in blocked/waiting.
Root cause: several projects are blocked on human governance decisions. This
alert is legitimate but not actionable from this project; the fix is humans
unblocking the upstream projects.

Remaining plan items (#197/#225 recovery) are blocked on evaluator-low-quality-rate-calibration
which awaits human decision on metric intent. No actionable work this execution.

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

### Re-plan (2026-05-09)
- [x] Audit all open alerts: identify owner, latest judgment, root cause, and owning project for each.
- [x] Audit new alert #256 `project.blocked-count`: root cause is multiple projects blocked on human decisions; documented.
- [x] Record the external dependency: `evaluator-low-quality-rate-calibration` needs a human decision before #197/#225 can recover.
- [x] Stop this pass without creating filler work; keep the project active for future metric/event checks.

### Watch Conditions

- If `evaluator-low-quality-rate-calibration` leaves blocked/waiting, verify #197/#225 on the next metrics snapshot.
- If a P0/P1 runtime reliability vital regresses, re-plan immediately.
- If `project.blocked-count` stays open after human decisions land, audit the remaining blocked projects and nudge their owners.

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
- 2026-05-09: First reframe attempt was not enough: the orchestrator marked all new items complete because the remaining alerts were P3 and Scout-owned. Treating "has owner" as closure is wrong. Workflow prompt now requires durable judgment/action/validation evidence before alert-related items can close.
- 2026-05-09: New alert #256 project.blocked-count (P2) appeared — 5 blocked projects. Root cause: human governance decisions pending. Documented; not actionable from this project.
- 2026-05-09: Audited all 3 open alerts. #255 has owning project (v2-spec-coverage-buildout, waiting). #197 and #225 source is evaluation verdicts not sessions — 74% needs_improvement from evaluator heuristics. Root cause is evaluator quality, tracked by evaluator-low-quality-rate-calibration (blocked on human). Re-planned accordingly.
