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

**2. Static Checks First**

Before adding runtime metrics, classify each failure mode:

| Failure | Right tool | Why |
|---------|-----------|-----|
| Unscoped metric.breach routing | Static app manifest check | Event subscription is declarative — check at load time |
| Duplicate subscribeToBus lifecycle | Unit test + static ownership rule | Structural bug, not runtime drift |
| Handler overlap vs budget | Static schedule/budget check | Declared intervals × handlers vs sessionsPerDay |
| Planner timeout rate | Runtime metric | Recurring runtime behavior, varies with tree size |
| Daemon heartbeat stale | Runtime metric/watchdog | Only runtime can observe liveness |
| Regex false escalations | Structured output contract + tests | Fixed by removing the guess; test the contract |
| Event routing gap | Static manifest check | Every event has a handler, adapter, or terminal declaration |
| Duplicate task creation | Static dedup test + planner context quality | Information problem, not runtime drift |

Static checks to add (run at `bun run check` / app integrity):
- Every app event has a route, handler, or explicit external/terminal classification
- Every handler declares emitted events; emitted events are handled or terminal
- No duplicate cron lifecycle ownership: creator owns create/load/subscribe/start
- App schedule budget fits declared sessionsPerDay
- Metric registry and metrics doc agree on id, owner, priority, threshold
- Active metric has owner, priority, threshold, source, and closure path
- No retired/orphaned handler/metric still active in cron.json
- Task tree schema integrity: parent links, unique IDs, valid states, no orphans

**3. Runtime metrics (small active set)**

Only add metrics for things that are genuinely runtime-variable and not
catchable by static checks:

| Metric | Priority | Rationale |
|--------|----------|-----------|
| `runtime.daemon-heartbeat-stale` | P0 | Only runtime knows if process is alive |
| `session.budget-violation-count` | P1 | Budget is declared but not enforced; violations accumulate at runtime |
| `session.planner-timeout-rate-6h` | P1 | Varies with tree size, model response time |
| `escalation.pending-count` | P1 | Accumulation is a runtime pattern |

Temporary (retire after static coverage proves the fix):
- `handler.duplicate-dispatch-rate` — validate the cron lifecycle fix, then retire

Do NOT add (either static-checkable or premature):
- `event.loop-detected-count` — static manifest check covers this
- `event.unhandled-count` — static manifest check covers this
- `task.no-progress-duration` — project-steward already surfaces stale tasks
- `conversation.unclosed-human-reply-count` — not yet a proven failure mode
- `problem.unknown-result-rate-24h` — structured contract + test covers this
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

**4. may-agent.app task tree: ops-health branch**

Add a durable `ops-health` branch. It is not a permanent active lane —
it is a place for finite review/repair tasks. When a task completes, its
findings and decisions roll up into the branch context. New tasks are
created only when a real signal demands investigation or repair.

Example tasks (finite, created when signal demands):
- `add-static-integrity-checks`: implement the 8 static checks listed above
- `add-daemon-heartbeat-metric`: add runtime.daemon-heartbeat-stale to snapshot
- `migrate-daily-alert-review`: prove replacement, then disable handler
- `investigate-planner-timeout-46pct`: one-time analysis of timeout cause

The branch stays in backlog when all child tasks are done and no active
signal demands new work. It becomes active only when the health packet
surfaces a problem that needs owner judgment.

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

### Budget-Safe Review Cadence

The ops-health-review runs hourly as a **deterministic handler** (no LLM).
It builds a compact health packet from DB queries and compares against
thresholds. The handler itself is pure code — no agent session consumed.

May only wakes (LLM session) when the packet crosses a meaningful threshold:
- P0 metric breached (immediate)
- P1 metric breached with no owner action for >1h
- Escalation pending >1h with no resolution
- Daemon heartbeat stale >5min

All other states are silent. The packet is logged for observability but does
not trigger a session. Daily ops-digest is the one scheduled LLM wake for
non-urgent rollup.

### Metric Priority Classification

Each operational metric has an explicit priority:

| Metric | Priority | Action |
|--------|----------|--------|
| `runtime.daemon-heartbeat-stale` | P0 | Immediate human escalation |
| `handler.duplicate-dispatch-rate` | P0 | Immediate owner wake |
| `event.unhandled-count` | P1 | Owner review within 1h |
| `session.budget-violation-count` | P1 | Owner review within 1h |
| `session.planner-timeout-rate-6h` | P1 | Owner review within 1h |
| `escalation.pending-count` | P1 | Owner review within 1h |
| `problem.unknown-result-rate-24h` | P2 | Visible in health rollup |
| `event.loop-detected-count` | P2 | Visible in health rollup |
| `task.no-progress-duration` | P2 | Visible in health rollup |
| `conversation.unclosed-human-reply-count` | P2 | Visible in health rollup |

P0 = immediate owner wake + possible human escalation.
P1 = owner review soon (next health packet with signal).
P2 = visible in daily rollup only.

### Handler Migration Gate

Do not disable overlapping handlers until the replacement is proven.
For each handler migration, require:

1. Which signal replaces it (metric, event, or app schedule)
2. Who owns the signal (which app or infra handler)
3. What task/event closes the loop (how does the owner act)
4. One replay/regression test showing the new path works for the exact
   failure class the handler was designed to catch
5. The replacement has either a static check or replay test proving the
   old failure mode is covered — not just "the new handler exists"

Migration order (each step must pass the gate before the next):
- `daily-alert-review` → replaced by may-agent.app daily-ops-digest schedule
- `closed-loop-steward` → replaced by ops-health-review + metric-alert-reactor
- `project-creative-audit` → replaced by project-steward + may-agent.app review
- `coaching-consumer` → migrate to evaluation.app
- `feedback-echo-sync` → migrate to evaluation.app

### "Problem Unknown" Metric Source

`problem.unknown-result-rate-24h` comes from structured workflow outcomes,
not text matching. After the problem-solver fix (explicit `PROBLEM_RESULT`
declaration), the source is the event type field:
- `project.problem.resolved` → counted as resolved
- `project.problem.escalated` → counted as escalated
- `project.problem.unknown` → counted as unknown

The metric is `unknown_count / total_count` from the events table. No regex,
no heuristic, no fragile text rules.

### Verification: Replay Real Incidents

Each scenario that failed during our manual review becomes a test case:

1. **Duplicate cron subscription** — given two subscribeToBus calls on same
   cron, verify only one dispatch per event
2. **Planner timeout loop** — given a planning_update session that times out,
   verify the task it was creating is not duplicated on next wake
3. **Stale blocked task** — given a task blocked >6h, verify ops-health
   surfaces it within 1h
4. **No ready/active task after restart** — given empty frontier after daemon
   restart, verify the metric fires and reaches the owner
5. **Telegram reply dropped** — given daemon-heartbeat-stale, verify human
   escalation within 5min
6. **Metric breach not routed to owner** — given a metric.breach event,
   verify it reaches the owning app within one measurement cycle

### Implementation Order

1. Refine proposal with ownership, priority, budget, and closure semantics ← done
2. Add missing operational metric definitions to `metrics-snapshot.ts`
3. Add a cheap deterministic health-packet builder (handler, no LLM)
4. Route only meaningful breaches to may-agent.app owner (signal-gated)
5. Create the `ops-health` task lane in may-agent.app task tree
6. Migrate overlapping handlers one by one after replay tests prove coverage
