---
id: system-operations
owner: may
status: active
type: continuous
priority: P1
project_policy: maintenance
iteration: 1
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
  attempts: 0
  status: open
  assignee: may
  goal: Ongoing ops monitoring via heartbeat — review alerts, route work, validate chains

## Journal

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
