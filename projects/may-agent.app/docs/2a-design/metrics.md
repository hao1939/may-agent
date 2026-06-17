# Metrics & Alerts

## Overview

Metrics are **the system's vital signs**. They measure system health, execution
quality, and progress toward project goals. They are how the system _sees itself_.

The primary question is not "did we evaluate enough sessions?" The primary
question is "is the system completing useful work, and when it fails, does the
right owner act on the failure?" Coverage metrics are kept as liveness/meta
signals only.

Metrics do not directly drive work. The unified work model is:

- A metric breaches → the breach is recorded as state and emitted as an event.
- Every breach resolves to one owner. Project-scoped metrics default that owner
  to the project owner and carry project context; apps do not need to subscribe
  to every project metric for the common feedback path.
- Non-project breaches are routed to the metric owner, heartbeat context, or
  generic alert reactor.
- The agent **judges** what the signal means using goal, facts, history, and a causal theory, then acts, records evidence, or escalates.
- Only **P0 (urgent) metrics fork the agent directly**, bypassing the heartbeat. Everything else waits for the agent to look.

This is intentional — see `heartbeat.md`. Forking on every breach makes agents
reactive; deferring to heartbeats makes them deliberative. Metrics are vitals,
not pagers.

Built-in metrics are owned by `agents/may/handlers/metrics-snapshot.ts`; custom
metrics can be added with `source_query` or `source_command`.

## Schema

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT,          -- 'gauge' | 'counter' | 'health' | 'derived'
  owner TEXT,
  current REAL,
  target REAL,
  threshold REAL,
  unit TEXT,
  priority TEXT,
  status TEXT DEFAULT 'active',
  blocker TEXT,
  project TEXT,
  source TEXT,
  source_query TEXT,
  source_command TEXT,
  config TEXT,          -- JSON: additional metric configuration
  sensitivity REAL,
  measure_interval INTEGER,
  created_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  alert_op TEXT,     -- '<' alert when below, '>' alert when above
  speed TEXT,
  description TEXT,
  direction TEXT
);

CREATE TABLE metric_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id TEXT,
  value REAL,
  sample_size INTEGER,
  measured_at INTEGER,
  measured_by TEXT,
  note TEXT
);
```

## Metric Types

- `gauge` — point-in-time value, can go up or down.
- `counter` — count/rate of events or output.
- `health` — pass/fail or count-of-failures signal.
- `derived` — computed from other metrics.

## System Metrics Registry

The tables below are the prioritized metrics. See the `metrics` table in DB or
`ALL_METRICS` in `agents/may/handlers/metrics-snapshot.ts` for the registry of
record. Per KE-722, this doc and the runtime registry must agree on concrete
numbers; when in doubt, the registry wins.

The active system set is intentionally small. Metrics useful for research,
conformance tracking, coaching detail, or debugging stay out of active alerting
until they become necessary for keeping the loop running.

### Infrastructure

| ID                                             | What it answers                                                     | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Target | Threshold | Alert |
| ---------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | ----- |
| `handler.success-rate`                         | Are handlers working?                                               | `handler.completed / (completed + failed)` from events (6h)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 0.95   | 0.80      | below |
| `handler.heartbeat-coverage`                   | Are heartbeat sessions happening broadly?                           | `COUNT(DISTINCT agent)` from heartbeat sessions (2h)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2      | 2         | below |
| `agent.heartbeat-dark-count-2h`                | Did any scheduled heartbeat agent go dark?                          | enabled heartbeat cron agents with no heartbeat session in 2h                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 0      | 0         | above |
| `agent.config-invalid-count-1h`                | Did runtime skip an agent due to invalid config?                    | durable `agent.config_invalid` events (1h)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0      | 0         | above |
| `runtime.daemon-heartbeat-stale`               | Is the daemon keepalive still emitting durable observations?        | latest `runtime.daemon.heartbeat` event age                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 0      | 0         | above |
| `runtime.project-app-schedule-orphan-count-1h` | Are project-app schedules actually driving owner/workflow progress? | mature `project-app:*:schedule:*` events with no workflow/owner follow-up within 2 minutes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0      | 0         | above |
| `session.error-rate-6h`                        | Is anything failing?                                                | `error+interrupted / total` from sessions (6h). The `error='Clean start (fresh)'` exclusion (KE-797) is **non-functional** because `sessions.error` is nearly always NULL (KE-1558, KE-1878); the COALESCE fallback makes all interrupted sessions count as errors (KE-1778). **Known distortion sources (updated 2026-06-17):** (1) Zero-op startup failures (bundle compilation errors, concurrent dispatch collisions) inflate the error count — sessions that never reached an LLM turn (KE-2017: 75% of errors are 0-op in spike windows). (2) `planning_update` workflow interruptions historically ran ~60% (KE-2015) but collapsed to <6% after planner improvements (KE-2018, 2026-06-17); contribution is now negligible. The metric's 48h average is ~0.15 (range 0.01–0.64 depending on burst presence). The "real" agent error rate (opCount > 0 errors only / total) is ~4–7%. **Failure conservation (KE-1900):** a 36-hour measurement across an architectural transition showed total non-success rate conserved at ~10% while error-only dropped 12× (10.1% → 0.85%) — failures reclassified from `error` to `interrupted`, not eliminated. This metric measures label assignment, not reliability. Fix requires src/ change (ORDER-010). | 0.10   | 0.30      | above |
| `session.planner-timeout-rate-6h`              | Is project planning repeatedly interrupted or timing out?           | timeout-like `workflow:project-planner` terminal sessions / all terminal planner sessions (6h, neutral if sample <5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 0.05   | 0.25      | above |
| `session.first-turn-error-count-1h`            | Is the provider/model failing before the agent can act?             | recent error/interrupted sessions whose first assistant transcript row has `stopReason=error` or provider error text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 0      | 15        | above |
| `message.delivery-failed-count-1h`             | Are inter-agent messages failing to route?                          | `message.delivery_failed` events (1h)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 0      | 0         | above |
| `escalation.pending-count`                     | Are escalations accumulating without closure?                       | unresolved `escalation.created` events with no resolved/dismissed event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 0      | 3         | above |
| `evaluator.stale-running-session-count`        | Is work hanging?                                                    | running/idle non-evaluator sessions older than stale cutoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 0      | 1         | above |

### Quality / Output

| ID                                           | What it answers                                                                       | Source                                                                                              | Target | Threshold | Alert      |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ | --------- | ---------- | ----------- |
| `session.failed-triage-rate-3h`              | Are failures being acted on?                                                          | failed/interrupted sessions with `needs_improvement` evaluation (3h)                                | 1.00   | 0.80      | below      |
| `eval.llm-coverage-lag-h`                    | Has the LLM evaluation lane gone silent?                                              | hours since latest `evaluatedByHeuristic=0` evaluation                                              | 1      | 4         | above      |
| `eval.llm-evals-24h`                         | Did enough sessions get deep evaluation recently?                                     | count of non-evaluator `evaluatedByHeuristic=0` evaluations (24h)                                   | 4      | 1         | below      |
| `evaluator.low-quality-rate-24h`             | Is evaluated work frequently `needs_improvement` or low-scoring? (dashboard-only, P3) | `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores / all evaluations (24h) | 0.10   | 0.80      | above      |
| `evaluator.substantive-low-quality-rate-24h` | Of _substantive_ evaluations, are quality failures frequent?                          | substantive needs-improvement count / substantive evaluations (24h)                                 | 0.10   | 0.30      | above      |
| `system.real-output-24h`                     | Is the system producing?                                                              | `git log` substantive files changed (24h)                                                           | 100    | 30        | below      | **retired** |
| `project.iterations-24h`                     | How much active-project work happened?                                                | active project.iteration events (24h)                                                               | 0      | 0         | watch-only |
| `project.blocked-over-6h`                    | Is work stuck on true blockers?                                                       | `COUNT(*)` from projects where blocked >6h                                                          | 0      | 4         | above      |
| `metric.stale-active-count`                  | Is measurement coverage stale?                                                        | active metrics without a recent snapshot                                                            | 0      | 8         | above      |
| `metric.structurally-pinned-count`           | Are any metrics stuck at a single value?                                              | active metrics with coefficient of variation = 1 over 7d snapshots (KE-938/939/940)                 | 0      | 0         | above      |
| `capability.status-reality-mismatch-count`   | Does runtime state match durable facts?                                               | stale projects, stale metrics, orphan terminal sessions, missing heartbeat agents                   | 0      | 3         | above      |
| `capability.zombie-session-count`            | Are sessions stuck alive?                                                             | running/idle sessions older than stale cutoff                                                       | 0      | 2         | above      |

### Additional Built-In Metrics

These are measured but not in the prioritized tables above.

**Handler / Infrastructure:**

- `handler.completed-count` — completions in 6h
- `handler.failed-count` — failures in 6h
- `handler.p95-duration` — 95th percentile handler duration in 6h
- `handler.fires-per-hour` — handler starts in 1h
- `runtime.daemon-heartbeat-stale` — daemon keepalive observation is missing or older than 7 minutes
- `runtime.project-app-schedule-orphan-count-1h` — project-app schedule ticks that do not produce owner/workflow progress within 2 minutes
- `infra.bus.event-count-1h` — total event bus events in 1h (volume indicator)
- `infra.bus.subscriber-failed-count-1h` — event bus subscriber failures in 1h
- `infra.messages.delivery-rate` — inter-agent message delivery success rate
- `infra.persist.db-size-mb` — SQLite DB file size in MB
- `infra.sessions.active-count` — currently running sessions

**Evaluator:**

- `evaluator.aftermath-coverage-rate-3h` — aftermath pipeline liveness, not a north-star quality goal
- `evaluator.false-good-rate-sample` — reviewed good sessions overturned (24h); quality control on the evaluator itself
- `evaluator.meaningful-review-rate-24h` — fraction of evaluations that are substantive (24h)
- `evaluator.success-candidates-24h` — good sessions marked for learning extraction (24h)
- `evaluator.success-learnings-24h` — learnings extracted from good sessions (24h)
- `evaluator.triage-closure-rate-24h` — fraction of failed sessions triaged and closed (24h)

**Guard:**

- `guard.blocked-count-15m` — guard blocks in 15m window
- `guard.repeat-trigger-count-24h` — repeated guard triggers (same rule, same session) in 24h
- `guard.triggered-count-24h` — total guard triggers in 24h (watch-only)
- `guard.warned-count-24h` — total guard warnings in 24h (watch-only)

**Project:**

- `project.active-count` — observable count of projects currently pushing; not a health target by itself
- `project.blocked-count` — true blocked projects only
- `project.stale-active-count`
- `project.invalid-format-count` — projects with invalid `project.md` format
- `project.health.finding-count` — project-steward health findings (active projects with structural issues)
- `project.owner-incomplete-count` — active projects with no open work (steward signal)
- `project.owner-judgment-needed-count` — project tasks needing owner judgment (steward signal)
- `project.task-parser-error-count` — project task parser errors (steward signal)
- `project.reconcile.event-latency-ms` — latency from project event to reconciler action (**retired** — legacy project handler disabled 2026-06-15; see KE-2011. DB status set to 'retired' as of 2026-06-17.)
- `project.reconcile.launched-count` — reconciler-launched actions (**retired** — see above)
- `project.reconcile.trigger-count` — reconciler invocations (**retired** — see above)

**Scout:**

- `scout.downstream-reference-files-7d` — files referencing scout knowledge (7d)
- `scout.knowledge-practice-loaded` — whether scout knowledge practice is loaded (boolean)
- `scout.knowledge-preamble-coverage` — fraction of KE entries with preamble coverage
- `scout.sourced-artifacts-24h` — scout-sourced artifacts (24h)

**Session:**

- `session.empty-assistant-stop-count-1h` — sessions ending with empty assistant response (1h)
- `session.finish-blocked-uncommitted-count-24h` — finish blocked by uncommitted changes (24h raw count)
- `session.finish-blocked-unresolved-count-24h` — unresolved finish-blocked dirty exits (24h strict)
- `session.planner-timeout-rate-6h` — project planner interruption/timeout reliability
- `session.provider-error-count-1h` — provider errors at any turn (1h)

**Escalation:**

- `escalation.pending-count` — open escalation backlog that still needs owner closure

### Retired From Active Alerting

These metrics were useful while investigating specific questions, but they are
not critical runtime-health signals now: `system.real-output-24h`,
`project.blocked-rate-7d`, `v2.*`,
`capability.session-trace-completeness`,
`capability.self-directed-iteration-rate-24h`,
`capability.process-uptime-h`, `capability.concurrent-session-max-1h`,
`capability.tool-preset-drift-count`, and dynamic
`agent.<name>.low-quality-streak` rows.

Retiring a metric means: keep DB history, mark the metric `retired`, resolve any
open alert for it, and stop measuring it in `metrics-snapshot.ts`.

### All-Green ≠ Healthy: Known Structural Blind Spots (KE-726)

**Reading the dashboard:** if any prioritized metric is red, treat it as a signal to investigate that layer. **All-green is necessary but not sufficient** — see below before treating green as evidence of healthy production.

The "all green → healthy" reading was falsified at 2026-05-03 20:17Z: every prioritized metric was green at the moment the system had been producing zero real project iterations for 7h. Each metric has a floor or counting rule that prevents it from alerting in a specific failure mode the metric _names_:

- `project.iterations-24h` — formerly had an unreachable floor and counted closed-project ghost iterations. It now counts only active project iterations and is watch-only because zero active iterations can be healthy when every project is waiting on valid watch conditions.
- `project.active-count` — formerly required `>=1`, which encouraged fake active projects. It is now observability only: zero active projects is healthy when waiting projects have clear resume signals.
- `project.blocked-over-6h` — now counts only true `blocked` projects. `waiting` is a normal watch state and should not page by itself.
- `project.stale-active-count` — registry `threshold=2`, alert_op=`>`. Demands ≥3 simultaneous stale-active projects to fire, but with `active-count` capped near 1 in practice this metric cannot breach in the failure mode it describes. **Not currently in the prioritized set** despite being the most direct signal for KE-724-class drift.
- `system.real-output-24h` — can distinguish "system completely dark" from "system alive" but not "substance" from "plumbing."

Read this dashboard as a liveness check on plumbing plus a first-pass quality
signal, not proof of substance. Confirm direction with session transcripts,
project journals, and `project.iteration` events before concluding the system is
producing meaningful work.

### Evaluator LLM Lane Signals

`eval.llm-coverage-lag-h` and `eval.llm-evals-24h` are deliberately separate.
The lag metric catches lane death and is urgent. The count metric catches
sampling starvation and is advisory. A low count is not proof that evaluator
should create more reviews; evaluator should first check whether there were
eligible recent sessions, whether `eval-llm-scan` ran, and whether model/runtime
failures or skip rules prevented useful deep evaluation.

## Pipeline

```
metrics-snapshot handler
  -> upserts built-in metric rows
  -> measures events, sessions, projects, and output
  -> records values to metrics + metric_snapshots
  -> custom metric section runs source_query/source_command metrics
  -> alerts are represented in metric_alerts
  -> metric.breach routes to the resolved metric owner
     -> project metric with no explicit owner: infer owner from project.owner
     -> project owner: project.owner.requested with metric context
     -> non-project owner: owner heartbeat/alert path
  -> owner auto-handlers handle known metric patterns or project feedback
  -> metric-alert-reactor is the generic fallback for unhandled alerts
```

`project-steward` is another producer for project health signals. It scans
project docs/tasks read-only and emits `project.health.finding` events (the
former `project.health.checked` periodic snapshot was removed in commit
73d989fdb, 2026-06-10 — see ruflo-learning-loop iter-13). It records/evaluates
project metrics such as
`project.health.finding-count`, `project.task-parser-error-count`, and
`project.owner-judgment-needed-count`. Active projects with no tasks are owner
judgment findings, not missing workflow findings. The steward does not mutate
project files.

Project-health metric alerts follow the default project feedback convention when
they are tied to a project. The metric breach wakes the project owner with the
original metric context; the owner reviews task-tree state, project facts, and
recent events before deciding whether to repair the plan, create work, calibrate
the metric, record an exception, or escalate. Generic metric-alert triage is the
fallback for unhandled or unknown metrics, not the first consumer for known
project reconciliation signals.

Waiting projects may depend on project-scoped watch metrics. Metrics named in
the project's wait/watch contract (`resume_condition`, `wait_reason`, or
`## Watch Conditions`) must stay active and fresh enough to make the wait
condition observable. The project-steward treats disabled, missing, or stale
owner-scoped contract metrics as project health findings so the project owner
can repair the watch or revise the wait condition. Historical notes and weak
signals outside that contract do not make the project active by themselves.

The usual path is owner/context-driven: agents see metric state and unresolved
alerts, known owner auto-handlers can act first, and the generic alert reactor
only handles the remaining cases. `metric-alert-reactor` forks an owner directly
only for P0 or unhandled P1/P2 alerts after the configured grace period.

Agents handling an alert must follow
[manual/metric-alerts.md](../2b-manual/metric-alerts.md): judge the alert, choose one
operation, and either investigate then fix, calibrate, downgrade, upgrade or
escalate, resolve stale state, or document an exception.

## Alert Rules

- `alert_op: "<"` — alert when `current < threshold`.
- `alert_op: ">"` — alert when `current > threshold`.

Owner convention:

1. `metrics.owner` if set.
2. `projects.owner` when `metrics.owner` is empty and `metrics.project` points
   to a project row.
3. Metric id prefix if it matches an agent name.
4. `may` by default.

System-wide `project.*` metrics with no `metrics.project` stay owned by `may`.
Project-scoped metrics should usually leave `metrics.owner` empty or set it to
the project owner, so the resolver targets `projects.owner`. If a project metric
declares another owner, that owner wins and is responsible for preserving the
project context or handing the issue back to the project owner when needed.

Ownership routing is runtime behavior, not an agent triage operation. Agents
should not manually reroute alerts by editing `metrics.owner`; if routing is
wrong, fix `metrics.project`, the project row's `owner`, or the resolver code.

Default project feedback:

- `metric.breach` with `data.project` or a metric row `project` field resolves
  to the metric owner. If no explicit metric owner is set, the owner is inferred
  from the project row.
- When the resolved owner is the project owner, the default wake event is
  `project.owner.requested`.
- The event carries `metricId`, current value, threshold, priority, direction,
  snapshot time, alert id, and any recent trend points available.
- The project owner decides what the signal means. The runtime does not create
  task-tree branches, mark tasks blocked, or page a human except for P0.
- `metric.recovered` follows the same project owner path so stale alert context
  can be closed or annotated instead of silently disappearing.
- App-local `metricIds` subscriptions are optional escape hatches for metrics
  that need deterministic custom handling. They are not required for ordinary
  project feedback.

Some built-ins also define handler-local alert config in
`metrics-snapshot.ts` for rate, sustained, or stall semantics.

## Custom Metrics

Agents can add domain metrics by inserting rows with a query or command:

```sql
INSERT INTO metrics (id, name, owner, type, source_query, threshold, alert_op, status)
VALUES (
  'scout.avg-quality-7d',
  'Scout average quality (7d)',
  'scout',
  'gauge',
  'SELECT avg(quality) FROM evaluations WHERE agent = "scout" AND createdAt > strftime(''%s'',''now'')*1000 - 604800000',
  0.4,
  '<',
  'active'
);
```

The snapshot handler runs custom `source_query` / `source_command` rows and
records their values.

## Balanced Pairs (for project metrics)

Every project should track at least 2 metrics on different dimensions:

```
Activity  → "Am I doing the work?"
Impact    → "Is the work making a difference?"
```

Without both, agents optimize pathologically. Examples:

| Project                         | Activity metric      | Impact metric              |
| ------------------------------- | -------------------- | -------------------------- |
| Knowledge pipeline (scout)      | artifacts sourced    | downstream reference files |
| System health (evaluator)       | sessions evaluated   | triage closure rate        |
| Feature delivery (aks-explorer) | iterations completed | test pass rate             |

Anti-gaming: if activity is high but impact is low, the agent is busy but not effective. The impact metric catches it.

### Cadence & Phase Awareness

Metrics are **slow-moving signals**. Don't chase them daily.

- **Check weekly**, note direction not absolute value
- **Match to phase**: during experiments, activity metrics may stall (that's fine — you're building evidence). During deployment, watch impact closely.
- **One action per heartbeat, not three.** If multiple metrics are off, pick the one that matters most for your current phase. Chasing all simultaneously causes thrashing.
- **Override signals with judgment:** A metric dip right after deploying a new intervention is expected (lagging indicator). Don't panic-react.

## Metric Lifecycle

Metrics evolve — meeting a target is not done:

1. **Create** — define in project.md with target
2. **Measure** — metrics-snapshot handler records automatically
3. **Alert** — breach triggers heartbeat attention
4. **Raise target** — target met consistently? Raise the bar or add dimensions
5. **Graduate** — move to watch-only (requires human approval)

A metric at target is a signal the bar is too low. Never coast.

## Implementation

- **Source of truth**: `metrics` table in DB. This doc is design rationale.
- **Snapshot handler:** `agents/may/handlers/metrics-snapshot.ts` — auto-registers, measures every 5min, emits `metric.breach` events when `breached && !openAlert`
- **Alert reactor:** `agents/may/handlers/metric-alert-reactor.ts` — consumes `metric.breach` events. P0 forks the owner directly. P1+ remain visible for heartbeat/project/steward handling.
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts`
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others

## Proposal: Default Metric Feedback Routing (2026-06-14)

### Problem

`metric.breach` is useful because it says "something changed enough to deserve
judgment." The failure mode is losing that context:

1. Bare `"metric.breach"` app subscriptions can catch unrelated metrics.
2. Converting the breach into a generic heartbeat loses metric id, current
   value, threshold, trend, alert id, and project context.
3. Creating synthetic alert tasks by default adds process noise. The real owner
   usually needs to review the task tree and decide whether the right response
   is a task change, a metric calibration, a domain fix, or an escalation.

### Design: Built-In Feedback First

Metric breach routing should work without app-specific configuration.

```text
metrics-snapshot
  -> metric.breach { metricId, project?, owner?, current, threshold, priority, trend }
  -> default metric feedback router
     -> resolve owner from metric.owner, project.owner, metric prefix, or may
     -> resolved project owner: project.owner.requested with metric context
     -> resolved non-project owner: owner heartbeat/alert context
     -> no owner: may generic alert reactor
  -> owner judges the signal and closes the loop
```

The metric owner is the event target. For project metrics, the default owner
should be the project owner because the task tree is the durable project
thinking surface. A breached metric should feed that thinking; it should not
require a new metric-specific workflow or task lane before the project can
react.

The owner receives a compact packet:

- metric id, name, owner, project, priority, direction, current value, target,
  threshold, alert operation, alert id, snapshot time, and recent trend.
- related project link, task tree summary, and dashboard link when available.
- original event id so the event trace can explain how the owner was woken.

### Runtime Routing Contract

`metrics-snapshot` does not choose an app handler directly. It records metric
state through the metric service. The metric service resolves the metric owner,
creates or closes the `metric_alerts` row, and emits an owner-targeted event:

```json
{
  "type": "metric.breach",
  "owner": "agent:<resolved-owner>",
  "data": {
    "metricId": "...",
    "project": "...",
    "alertId": 123,
    "current": 0,
    "threshold": 1,
    "target": 3,
    "priority": "P1"
  }
}
```

The project-app loader then offers metric events to an app when the event owner
matches the app owner. Project context remains in the payload, but it is not a
second routing authority. If the owner app turns the signal into
`project.owner.requested`, that wake uses the original metric packet as context.
The legacy project reconciler should not subscribe directly to `metric.breach`
or `metric.recovered`; otherwise the same alert can produce two owner wakes.
Project reconciliation should happen because the owner app judged the metric
signal or because a project event was emitted.

When a metric event is offered to the owner app, the loader emits a durable
receipt:

```json
{
  "type": "metric.feedback.routed",
  "owner": "agent:<resolved-owner>",
  "data": {
    "metricId": "...",
    "alertId": 123,
    "project": "...",
    "appId": "...",
    "route": "owner-app"
  }
}
```

This receipt proves delivery to the owner path. It is not a judgment and does
not resolve the alert. The generic `metric-alert-reactor` treats a recent routed
receipt as evidence that the owner path is active and defers fallback triage
during the grace window. If the alert remains open with no judgment or recovery
after the grace window, the reactor may still run fallback triage.

This means `aks-rp-e2e.app` and `evaluation.app` do not need explicit
`metricIds` subscriptions for ordinary feedback. Their owner receives the event
because the metric owner resolves to `aks-explorer` or `evaluator`.

### Owner Behavior

The owner handles the breach as part of normal project judgment:

- If the metric reveals missing work, add or repair meaningful tasks.
- If the metric reveals broken execution, create a diagnosis/fix task near the
  relevant branch.
- If the metric is stale, noisy, or miscalibrated, fix the metric definition or
  record an accepted exception.
- If the breach is an ownership-boundary blocker or P0, escalate to the human
  with the context needed to act.
- When `metric.recovered` arrives, annotate or close the relevant context.

The runtime must not decide the project response. It only records the signal,
wakes the right owner, and preserves enough context for the owner to decide.

### Optional Specialization

Apps may still register explicit metric handlers when they add real value:

- deterministic remediation for a known infrastructure metric.
- expensive analysis that should run only for a small metric set.
- app-local metrics that are not project-scoped and cannot be inferred.

In those cases, `metricIds` filtering is an escape hatch, not the common path.
Bare catch-all `metric.breach` subscriptions should be avoided unless the
handler is the platform default router or generic fallback.

### Task Tree

Do not require every app to add a `metric-alerts` lane. The default path is:
metric breach -> owner review -> owner updates the existing project/task tree.

A project may create a standing task such as `project-health-feedback` when it
helps the owner keep recurring metric work visible. That task should represent
real project thinking and repeated review, not one child per alert by default.

### What This Prevents

- Metrics from one domain waking the wrong app.
- Loss of metric context through generic tick conversion.
- Duplicate standalone investigations for the same breach.
- Alert-task clutter that hides the actual project plan.
- Human notifications that do not include enough context to approve, reject, or
  steer the work.
