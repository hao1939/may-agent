# Proposal: System Operations Model

## Context

Over the past two days we fixed 6 problems manually that the system should have
caught or recovered from autonomously. The monitoring infrastructure exists
(metrics-snapshot, session-recovery, escalations) but the gaps are in
**connecting signals to actions** and **preventing accumulation**.

Problems we fixed manually:
1. Evaluator created 300+ standalone projects from unscoped metric.breach
2. May burned 47 sessions/day (6 budget) from redundant legacy handler
3. Scout heartbeat double-dispatch from subscribeToBus called twice
4. Planner 46% timeout rate with no actionable surfacing
5. Daemon crash with no internal detection (telegram stopped responding)
6. Problem-solver 300+ false escalations from regex guessing

## Current System

```
PURE INFRA (domain-neutral, runs forever on may's cron):
  metrics-snapshot (5min)   — measures everything, emits breach/recovered
  db-retention (60min)      — prunes old data
  session-recovery (5min)   — resumes crashed sessions
  escalation (event)        — routes escalations to owners

OBSERVATION (read-only, emits signals):
  project-steward (30min)   — project health scan → project.health.finding
  metric-alert-reactor (5min) — generic fallback for unhandled alerts

OVERLAPPING / UNCLEAR:
  closed-loop-steward (10min)  — overlaps metric-alert-reactor
  project-creative-audit (6h)  — overlaps project-steward
  daily-alert-review (24h)     — overlaps closed-loop-steward
  coaching-consumer (6h)       — evaluation domain?
  feedback-echo-sync (60min)   — evaluation domain?

AGENT HEARTBEATS (no app):
  heartbeat-dev (30min)
  heartbeat-arc (30min)
```

## What's Missing

The monitoring/recovery system has two structural gaps:

### Gap 1: No system-level health owner

`may-agent.app` owns "platform design and conventions" but not "is the system
running correctly right now?" The 4h platform-review schedule is too infrequent
for operational health. Meanwhile 5 overlapping handlers (metric-alert-reactor,
closed-loop-steward, project-creative-audit, daily-alert-review, coaching-consumer)
all try to observe system health from slightly different angles, with no shared
state and no clear owner.

### Gap 2: Signals exist but don't reach the right owner fast enough

`metrics-snapshot` fires every 5min and measures everything. `session-recovery`
runs every 5min. But:
- Session budget violations have no metric (47/day vs 6 budget)
- Duplicate dispatch has no metric
- Planner timeout rate has no metric (it's an interrupted session — same bucket
  as everything else)
- Escalation accumulation has no metric (count grows silently)
- Problem-solver result quality has no metric (unknown vs resolved vs escalated)

The metrics exist for some things but not for the operational patterns that
actually cause waste.

## Proposal: System Operations as may-agent.app's Core Responsibility

Don't create a new app. Make `may-agent.app` own operational health as its
primary job, not a side effect of a 4h review.

### Principle: infra observes, app judges

```
INFRA (handlers):
  metrics-snapshot    → measures, emits metric.breach
  session-recovery    → resumes crashed sessions
  escalation          → routes to owners
  project-steward     → scans project health, emits findings
  db-retention        → prunes old data

APP (may-agent.app):
  receives metric.breach, project.health.finding, escalation signals
  owns the task tree for operational improvements
  judges: is this noise, a real problem, or a known issue?
  acts: creates tasks, fixes config, escalates to human
```

This is the same pattern as aks-rp-e2e.app (infra runs specs, app judges
results) and evaluation.app (infra runs aftermath, app judges quality).

### Concrete changes

**1. Consolidate overlapping handlers**

Disable and replace:
- `closed-loop-steward` → redundant with metric-alert-reactor + may-agent.app
  owner review
- `project-creative-audit` → redundant with project-steward + app owner review
- `daily-alert-review` → becomes a may-agent.app schedule (daily digest, not a
  separate handler)

Keep:
- `metric-alert-reactor` as the generic P0 fallback
- `project-steward` as the read-only scanner

Move to evaluation.app:
- `coaching-consumer` — evaluation domain work
- `feedback-echo-sync` — evaluation domain work

**2. Add missing operational metrics**

Add to `metrics-snapshot.ts`:
- `session.budget-violation-count`: apps with sessions/day exceeding declared
  budget
- `session.planner-timeout-rate-6h`: interrupted planner sessions / total
  planner sessions
- `escalation.pending-count`: unresolved escalations older than 1h
- `problem.unknown-result-rate-24h`: problem-solver sessions returning
  "unknown" / total

These are cheap DB queries. They make invisible waste visible.

**3. Increase may-agent.app review cadence for ops signals**

Change the platform-review schedule from 4h to 1h for the operational health
lane. The 4h cadence is fine for design/planning work but too slow for
operational issues (47 sessions burned before anyone noticed).

Or: add a separate `ops-health-review` schedule at 1h that only checks
operational metrics, distinct from the 4h design review.

**4. may-agent.app task tree: standing operational tasks**

Add a durable `ops-health` lane with standing tasks:
- `session-budget-compliance`: monitor and fix budget violations
- `escalation-hygiene`: triage and resolve pending escalations
- `planner-efficiency`: track and improve planner timeout rates
- `handler-consolidation`: retire redundant handlers

These are not one-shot tasks — they're ongoing process ownership, like
scout's `ongoing-research` lane.

### What This Looks Like

```
may-agent.app
  schedules:
    platform-review (4h)     — design, conventions, SDK work
    ops-health-review (1h)   — operational metrics, budget, escalations
    daily-ops-digest (24h)   — daily summary to human

  task tree:
    platform-design/         — existing: SDK, conventions, project-app design
    ops-health/              — new: session budgets, planner efficiency, handler hygiene
    ui-improvements/         — existing: project task UI fixes
```

### What This Is Not

- Not a new `system-ops.app` — may-agent.app already owns the platform. Adding
  a second app creates coordination overhead for no boundary benefit.
- Not more handlers on may's cron — the problem is too many handlers with no
  shared judgment. The app provides the shared judgment.
- Not replacing infra with app logic — infra still measures and recovers. The
  app judges and plans.

### Implementation Path

1. Add operational metrics to `metrics-snapshot.ts` (session budget, planner
   timeout rate, escalation count)
2. Add `ops-health-review` schedule to `may-agent.app/app.ts` (1h)
3. Add `ops-health` lane to `may-agent.app/tasks/tree.json`
4. Disable `closed-loop-steward`, `project-creative-audit`, `daily-alert-review`
5. Migrate `coaching-consumer` and `feedback-echo-sync` to evaluation.app
6. Verify: may-agent.app catches the problems we fixed manually within 1h
