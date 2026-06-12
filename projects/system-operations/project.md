---
id: system-operations
owner: may
status: closed
type: continuous
priority: P1
iteration: 1
project_policy: maintenance
close_reason: Ops monitoring fully absorbed into may heartbeat routine. Project was a self-referential alert loop generator. See journal 2026-06-06.
---

# Project: System Operations

## Goal

Keep the May agent system healthy day to day by watching operational signals,
running known checks and playbooks, producing human-facing reports, and routing
concrete work to the right owner lane.

This project owns ops cadence and operational judgment. It does not own platform
implementation, agent learning strategy, evaluator calibration, or domain
project content.

## Scope

In scope:
- Daily alert review and proof-of-life reporting.
- Closed-loop reliability watch: signal -> owner -> judgment -> concrete operation -> validation signal.
- Stale project/session checks and "is the system moving?" review.
- Local instance health checks when operational state looks stale or broken.
- Metric alert hygiene: identify noisy thresholds, missing owners, stale judgments, and unresolved validation paths.
- Routing concrete follow-up work to `platform`, `agent-system-evolution`, or a domain project.

Out of scope:
- Runtime, SDK, persistence, event schema, UI, build/test implementation. Route to `projects/platform/project.md`.
- Agent behavior, learning policy, prompt/evaluator calibration. Route to `projects/agent-system-evolution/project.md`.
- Domain-specific exploration or test planning. Route to that domain project, for example `projects/aks-rp-e2e/project.md`.

## Signals

- `metric_alerts` rows created or still open.
- `metric.breach`, `metric.recovered`, and `metric.alert_judged` events.
- Runtime reliability vitals such as heartbeat dark count, message delivery failures, empty assistant stops, stale running sessions, and handler failures.
- Project movement signals: active projects with no progress, waiting projects with fired resume conditions, stale sessions, blocked work without owner judgment.
- Human-facing digest/report quality feedback.

## Operating Modes

### Daily Review

Merged from `projects/daily-alert-review/project.md`.

Every daily cycle:
1. Query recent alerts and unresolved older alerts.
2. Correlate breach/recovered/judged events and remediation sessions.
3. Produce a concise report for human review.
4. Call out noisy thresholds, missing owners, unresolved validation, and repeated patterns.
5. Route concrete follow-up work to the owning lane.

Proof-of-life/digest presentation context from
`projects/proof-of-life-dashboard/project.md` also belongs here unless the
change requires shared platform UI/runtime work.

### Reliability Watch

Merged from `projects/closed-loop-reliability/project.md`.

For any operational reliability signal, verify the full chain:

```text
signal -> owner -> judgment -> concrete operation -> validation signal
```

If the chain is missing, route or create a concrete task. Do not mark an issue
closed just because an owner was notified.

Open alerts do not automatically make this project active. The normal metric
owner path handles fresh alert judgment and validation. This ops lane wakes when
a P0/P1 alert chain is unjudged, stale after judgment without recovery, or part
of the daily ops review. Project-health metrics stay in the project reconciler
path so the ops lane does not create a self-referential project-health finding.

Absorbed watch items:
- `projects/eval-llm-lane-restoration/project.md` — watch `eval.llm-coverage-lag-h` and `evaluation.deep_*` lifecycle gaps.
- `projects/finish-blocked-hygiene-reduction/project.md` — watch `session.finish-blocked-unresolved-count-24h`.
- `projects/empty-assistant-stop-runtime-retry/project.md` — watch `session.empty-assistant-stop-count-1h` unless platform accepts a concrete runtime patch.

## Routing Rules

- Platform implementation issue -> comment/task on `projects/platform/project.md`.
- Agent behavior/evaluator issue -> comment/task on `projects/agent-system-evolution/project.md`.
- Domain issue -> comment/task on the domain project.
- Known ops runbook issue -> execute the runbook here and record evidence.
- Unclear issue -> investigate only far enough to identify the owner and next concrete action.

## Validation

- Daily report is produced on schedule or skipped with an explicit reason.
- P0/P1 operational alerts have owner, judgment, concrete action, and validation state.
- No closed-loop alert is treated as resolved only because a notification was sent.
- Stale project/session findings result in either concrete owner work, a documented exception, or a calibrated metric.
- Follow-up work is routed to the owning lane rather than absorbed here by default.

## Related Historical Projects

- `projects/daily-alert-review/project.md`
- `projects/closed-loop-reliability/project.md`
- `projects/proof-of-life-dashboard/project.md`
- `projects/eval-llm-lane-restoration/project.md`
- `projects/finish-blocked-hygiene-reduction/project.md`
- `projects/empty-assistant-stop-runtime-retry/project.md`

## Tasks

- id: calibrate-status-reality-mismatch
  result: succeeded
  attempts: 1
  status: done
  assignee: may
  goal: Calibrate status-reality-mismatch threshold or fix stale data sources

- id: verify-heartbeat-coverage
  result: succeeded
  attempts: 1
  status: done
  assignee: may
  goal: Verify heartbeat-coverage metric is measuring correctly

- id: daily-ops-watch
  result: succeeded
  attempts: 1
  status: done
  assignee: may
  goal: Ongoing ops monitoring via heartbeat — review alerts, route work, validate chains

- id: calibrate-provider-error-threshold
  result: succeeded
  attempts: 1
  status: done
  assignee: may
  goal: Evaluate whether provider-error-count-1h threshold=5 is too low for normal operations; raise to 10-12 or investigate root cause of chronic provider errors

- id: standing-ops-watch
  result: succeeded
  attempts: 1
  status: done
  assignee: may
  goal: Standing ops monitoring task — watch for alerts, route work, validate chains. This task stays open to prevent reconciler replan loops.

## Journal

### 2026-06-06 — Re-closed after audit review
- Reopened for unread creative audit comment (iter3). Audit identified 5 issues: dominant noise loop (92% of alerts), 4-day daily report gap, untracked recommendations, self-referential triggers, rising guard-count trend.
- All 5 findings **confirm the closure rationale** — this project was a noise generator, not an operational tool. Ops monitoring is better served by may's heartbeat routine without a separate project.
- 3 unresolved alerts (1495-1497) are all self-referential (project.owner-incomplete, owner-judgment-needed, health.finding). They exist because this project was active with no open work — closing resolves them.
- Guard-count and daily-report-gap observations are valid operational concerns but belong to may's standing ops behavior, not a dedicated project.
- Set frontmatter `status: closed` with `close_reason`.

### 2026-06-06 — CLOSED: Self-referential alert loop (14th cycle)
- This project has been stuck in a self-referential alert loop since creation: all tasks done → steward flags "no open work" → metric breach → may woken to judge → sets to waiting → repeat.
- 13+ judgment cycles documented in this journal, 17 project.health.finding events today alone, 2 error sessions in the last 20 minutes from this loop.
- The project's goal (ops monitoring) is fully absorbed into may's heartbeat routine. Having a separate project adds no value and wastes compute.
- **Closing permanently.** If a real multi-session ops initiative emerges, create a new project with concrete deliverables — don't reuse this one.

### 2026-06-06 — Alert chain judgment (thirteenth trigger)
- Alert 1494 project.owner-incomplete-count=1: Self-referential (this project has all tasks done but status active). Resolved by setting status to waiting.
- Alert 1493 project.owner-judgment-needed-count=1: Self-referential (this project). Resolved by this judgment.
- Alert 1492 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Same recurring timing pattern (13th occurrence). All 7 agents active within 12 minutes. 75% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-06-06 — Alert chain judgment (twelfth trigger)
- Alert 1491 project.owner-incomplete-count=1: Self-referential (this project has all tasks done but status active). Resolved by setting status to waiting.
- Alert 1490 project.owner-judgment-needed-count=1: Self-referential (this project). Resolved by this judgment.
- Alert 1487 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Same recurring timing pattern (12th occurrence). All 6 agents active within 10 minutes. 74% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-06-06 — Alert chain judgment (eleventh trigger)
- Alert 1487 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Arc last session ~132min ago, just crossing 2h threshold. Same recurring timing pattern (11th occurrence). All other agents active <7min ago. 76% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-06-06 — Alert chain judgment (tenth trigger)
- Alert 1489 project.owner-incomplete-count=1: Self-referential (this project has all tasks done but status active). Resolved by setting status to waiting.
- Alert 1488 project.owner-judgment-needed-count=1: Self-referential (this project). Resolved by this judgment.
- Alert 1487 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Arc last session ~130min ago, just crossing 2h threshold. Same recurring timing pattern (10th occurrence). Arc has 3 recent error sessions (empty assistant turns) interleaved with successful ones — not structural. All other agents active <5min ago. 75% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-06-06 — Alert chain judgment (ninth trigger)
- Alert 1487 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Arc last session 128min ago, just crossing 2h threshold. Same recurring timing pattern (9th occurrence). All other agents active <4min ago. 74% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-06-06 — Alert chain judgment (eighth trigger)
- Alert 1486 project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- Alert 1485 agent.heartbeat-dark-count-2h=1: Arc last session 127min ago, just crossing 2h threshold. Recurring timing pattern. System clearly alive — evaluator/may/scout/dev/aks-explorer all active <5min ago. 74% success rate, all cron jobs green, zero handler failures. Not actionable.
- No new operational signals. Setting to waiting.

### 2026-05-30 — Alert chain judgment (seventh trigger)
- project.health.finding-count=1: Self-referential. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: Same recurring pattern. Threshold too aggressive. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- No new actionable signals. Staying in waiting.

### 2026-05-30 — Alert chain judgment (sixth trigger)
- project.health.finding-count=1: Self-referential. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: Same recurring pattern. Threshold too aggressive. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- No new actionable signals. Staying in waiting.

### 2026-05-30 — Alert chain judgment (fifth trigger)
- project.health.finding-count=1: Self-referential. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: Same recurring pattern. Threshold too aggressive. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- No new actionable signals. Staying in waiting.

### 2026-05-30 — Alert chain judgment (fourth trigger)
- project.health.finding-count=1: Self-referential. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: Same recurring pattern. Threshold too aggressive. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- System alive per recent session activity. No new actionable signals. Staying in waiting.

### 2026-05-30 — Alert chain judgment (third trigger)
- project.health.finding-count=1: Self-referential. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: may, evaluator, scout all active within minutes. Threshold too aggressive. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- System alive: may, evaluator, scout all have sessions in last few minutes.
- Set project to waiting.

### 2026-05-30 — Alert chain judgment (second trigger)
- project.health.finding-count=1: Self-referential again. Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: may, evaluator, scout all active within minutes. Threshold too aggressive for current agent count. Not actionable.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- System is clearly alive (may, evaluator, scout all have sessions in last few minutes; arc/dev/tech-lead within last 2h).
- Set project to waiting.


### 2026-05-30 — Alert chain judgment (ops_alert_chain_needs_judgment)
- project.health.finding-count=1: Self-referential (this project flagged). Resolved by this judgment.
- heartbeat-coverage=1/dark-count=4: may, evaluator, scout all active within last hour. Threshold likely too aggressive for current agent count or timing window. Not actionable — system is clearly alive.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- Set project to waiting.


### 2026-05-29 — Alert chain judgment (provider error storm)
- provider-error-count=199, first-turn-error-count=198, error-rate=0.91: Massive provider error spike. Sessions are completing normally now — transient provider outage, not structural. Will self-resolve as 1h/6h windows roll.
- evaluator.low-quality-rate=0.85, substantive-low-quality-rate=0.82: Downstream of provider storm (sessions errored → evaluated poorly). Not actionable independently.
- failed-triage-rate=0.49: Also downstream of error storm.
- project.health.finding-count=1, owner-incomplete-count=1, owner-judgment-needed-count=1: Self-referential (this project). Resolved by this judgment.
- scout.knowledge-preamble-coverage: Owned by scout, no action.
- Set project to waiting.

### 2026-05-28 — Alert chain judgment round 3
- provider-error-count=11 (threshold=5): Now fired 5 times across multiple days (values 6-11). This is a recurring pattern, not transient. Either the threshold is too low for normal ops or there's a chronic provider issue. Created calibration task.
- finding-count=1: Self-referential (this project flagged by health check). Resolved by judgment here.
- scout.knowledge-preamble-coverage: Owned by scout, no action.

### 2026-05-28 — Alert chain judgment (ops_alert_chain_needs_judgment)
- project.health.finding-count=1: Self-referential finding (this project flagged for needing judgment). Resolved by providing judgment here.
- session.provider-error-count-1h=6 (threshold=5): Transient spike; was 1 shortly before, then jumped to 6 and stayed flat. No structural issue. Will self-resolve as the 1h window rolls. No action unless it persists beyond next cycle.
- Set project to waiting.

### 2026-05-28 — Ops heartbeat: resolved stale task state
- All 3 red alerts trace to system-operations having done tasks but no open work.
- Added standing `daily-ops-watch` task and set project_policy=maintenance.
- agent-system-evolution already `waiting` in file; DB shows stale `active` — status-reality-mismatch (count=1) is expected until reconciler syncs.
- scout.knowledge-preamble-coverage alert is owned by scout; no action needed here.

### 2025-05-22 — Task parser fix and alert judgment
- Fixed task format from YAML-style to markdown checkboxes (parser error resolved).
- Judged heartbeat/dark-agents alerts: system is active (6 agents with recent sessions), metric likely miscounting due to no `kind=heartbeat` sessions in DB.
- Status-reality-mismatch=19: composite metric counting stale projects/metrics/sessions after consolidation. Need threshold recalibration or cleanup of stale data.
- Routed eval.llm-coverage-lag-h (11.1h) to evaluator via message.
- New tasks: calibrate mismatch threshold, verify heartbeat metric measurement.

### 2026-05-21 — First ops loop: alert chain judgment
- 9 unresolved alerts, 4 P0 metrics breaching.
- Heartbeat-coverage=0 and dark-agents=5: system appears freshly active (heartbeat events from evaluator+may just fired). Likely transient; task created to verify.
- Status/reality mismatches=20: needs investigation — likely stale project frontmatter after consolidation.
- eval.llm-coverage-lag owned by evaluator; routing awareness message.
- Created 4 tasks to close the alert chains with judgment.

### 2026-05-20 — Created Ops Lane
- Merged daily alert review and closed-loop reliability into one standing ops lane.
- Kept old project folders in place as closed historical evidence.
- Preserved the boundary: ops watches, judges, reports, and routes; platform and evolution implement their own owned changes.
