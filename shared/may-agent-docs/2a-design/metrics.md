# Metrics & Alerts

## Overview

Metrics are **the system's vital signs**. They measure system health, execution
quality, and progress toward project goals. They are how the system *sees itself*.

The primary question is not "did we evaluate enough sessions?" The primary
question is "is the system completing useful work, and when it fails, does the
right owner act on the failure?" Coverage metrics are kept as liveness/meta
signals only.

Metrics do not directly drive work. The unified work model is:

- A metric breaches → the breach is recorded as state and emitted as an event.
- The owning agent sees the signal in a work context: explicit project, implicit heartbeat project, steward audit, or P0 alert task.
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

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `handler.success-rate` | Are handlers working? | `handler.completed / (completed + failed)` from events (6h) | 0.95 | 0.80 | below |
| `handler.heartbeat-coverage` | Are heartbeat sessions happening broadly? | `COUNT(DISTINCT agent)` from heartbeat sessions (2h) | 5 | 3 | below |
| `agent.heartbeat-dark-count-2h` | Did any scheduled heartbeat agent go dark? | enabled heartbeat cron agents with no heartbeat session in 2h | 0 | 0 | above |
| `agent.config-invalid-count-1h` | Did runtime skip an agent due to invalid config? | durable `agent.config_invalid` events (1h) | 0 | 0 | above |
| `session.error-rate-6h` | Is anything failing? | `error+interrupted / total` from sessions (6h). The `error='Clean start (fresh)'` exclusion (KE-797) is **non-functional** because `sessions.error` is nearly always NULL (KE-1558, KE-1878); the COALESCE fallback makes all interrupted sessions count as errors (KE-1778). **Known distortion:** aks-explorer generates nearly all `interrupted` sessions (~9–15% of terminal total depending on window); the true error-only rate is typically 1–5%, but the metric includes interruptions and reports ~0.09–0.12 (see KE-1644, KE-1778). Fix requires src/ change (ORDER-010). | 0.10 | 0.30 | above |
| `session.first-turn-error-count-1h` | Is the provider/model failing before the agent can act? | recent error/interrupted sessions whose first assistant transcript row has `stopReason=error` or provider error text | 0 | 15 | above |
| `message.delivery-failed-count-1h` | Are inter-agent messages failing to route? | `message.delivery_failed` events (1h) | 0 | 0 | above |
| `evaluator.stale-running-session-count` | Is work hanging? | running/idle non-evaluator sessions older than stale cutoff | 0 | 0 | above |

### Quality / Output

| ID | What it answers | Source | Target | Threshold | Alert |
|----|-----------------|--------|--------|-----------|-------|
| `session.failed-triage-rate-3h` | Are failures being acted on? | failed/interrupted sessions with `needs_improvement` evaluation (3h) | 1.00 | 0.80 | below |
| `eval.llm-coverage-lag-h` | Has the LLM evaluation lane gone silent? | hours since latest `evaluatedByHeuristic=0` evaluation | 1 | 4 | above |
| `eval.llm-evals-24h` | Did enough sessions get deep evaluation recently? | count of non-evaluator `evaluatedByHeuristic=0` evaluations (24h) | 4 | 1 | below |
| `evaluator.low-quality-rate-24h` | Is evaluated work frequently `needs_improvement` or low-scoring? (dashboard-only, P3) | `needs_improvement`/`low_quality` verdicts or low quality/efficiency scores / all evaluations (24h) | 0.10 | 0.80 | above |
| `evaluator.substantive-low-quality-rate-24h` | Of *substantive* evaluations, are quality failures frequent? | substantive needs-improvement count / substantive evaluations (24h) | 0.10 | 0.30 | above |
| `system.real-output-24h` | Is the system producing? | `git log` substantive files changed (24h) | 100 | 30 | below | **retired** |
| `project.iterations-24h` | How much active-project work happened? | active project.iteration events (24h) | 0 | 0 | watch-only |
| `project.blocked-over-6h` | Is work stuck on true blockers? | `COUNT(*)` from projects where blocked >6h | 0 | 4 | above |
| `metric.stale-active-count` | Is measurement coverage stale? | active metrics without a recent snapshot | 0 | 8 | above |
| `metric.structurally-pinned-count` | Are any metrics stuck at a single value? | active metrics with coefficient of variation = 1 over 7d snapshots (KE-938/939/940) | 0 | 0 | above |
| `capability.status-reality-mismatch-count` | Does runtime state match durable facts? | stale projects, stale metrics, orphan terminal sessions, missing heartbeat agents | 0 | 3 | above |
| `capability.zombie-session-count` | Are sessions stuck alive? | running/idle sessions older than stale cutoff | 0 | 2 | above |

### Additional Built-In Metrics

These are measured but not in the prioritized tables above.

**Handler / Infrastructure:**
- `handler.completed-count` — completions in 6h
- `handler.failed-count` — failures in 6h
- `handler.p95-duration` — 95th percentile handler duration in 6h
- `handler.fires-per-hour` — handler starts in 1h
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
- `project.reconcile.event-latency-ms` — latency from project event to reconciler action
- `project.reconcile.launched-count` — reconciler-launched actions
- `project.reconcile.trigger-count` — reconciler invocations

**Scout:**
- `scout.downstream-reference-files-7d` — files referencing scout knowledge (7d)
- `scout.knowledge-practice-loaded` — whether scout knowledge practice is loaded (boolean)
- `scout.knowledge-preamble-coverage` — fraction of KE entries with preamble coverage
- `scout.sourced-artifacts-24h` — scout-sourced artifacts (24h)

**Session:**
- `session.empty-assistant-stop-count-1h` — sessions ending with empty assistant response (1h)
- `session.finish-blocked-uncommitted-count-24h` — finish blocked by uncommitted changes (24h raw count)
- `session.finish-blocked-unresolved-count-24h` — unresolved finish-blocked dirty exits (24h strict)
- `session.provider-error-count-1h` — provider errors at any turn (1h)

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

The "all green → healthy" reading was falsified at 2026-05-03 20:17Z: every prioritized metric was green at the moment the system had been producing zero real project iterations for 7h. Each metric has a floor or counting rule that prevents it from alerting in a specific failure mode the metric *names*:

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
  -> metric.breach wakes the metric owner path
  -> owner auto-handlers handle known metric patterns
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

Project-health metric alerts follow the owner auto-handler convention. The
metrics are owned by `may`; May's project handler is the typed auto-handler for
known project metrics (`project.health.finding-count`,
`project.owner-judgment-needed-count`, and `project.owner-incomplete-count`).
Those metric events wake project reconciliation with the original metric
context. Generic metric-alert triage is the fallback for unhandled or unknown
metrics, not the first consumer for known project reconciliation signals.

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
Project-scoped metrics route to the project owner only when they do not declare
their own `metrics.owner`.

Ownership routing is runtime behavior, not an agent triage operation. Agents
should not manually reroute alerts by editing `metrics.owner`; if routing is
wrong, fix `metrics.project`, the project row's `owner`, or the resolver code.

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

| Project | Activity metric | Impact metric |
|---------|----------------|---------------|
| Knowledge pipeline (scout) | artifacts sourced | downstream reference files |
| System health (evaluator) | sessions evaluated | triage closure rate |
| Feature delivery (aks-explorer) | iterations completed | test pass rate |

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
- **DB schema:** `src/lib/db/schema.ts`
- **Retention**: snapshots kept 30 days, pruned after each measurement run
- **Error isolation**: each metric measured independently — one failure doesn't block others
