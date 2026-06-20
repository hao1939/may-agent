# Proposal: System Operations Model

## Context

Over the past two days we fixed 6 problems manually that the system should have
caught or recovered from autonomously. The monitoring infrastructure exists
(metrics-snapshot, session-recovery, escalations) but the gaps are in
**connecting signals to actions** and **preventing accumulation**.

Problems we fixed manually:

1. Evaluator created 300+ standalone projects from unscoped metric.breach
2. May woke repeatedly from redundant legacy handler overlap
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

LEGACY AGENT HEARTBEATS (no app):
  none for may-agent.app; tech-lead/dev/arc are app-local and heartbeat-disabled
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

- Duplicate dispatch had no static lifecycle check
- Planner timeout rate has no metric (it's an interrupted session — same bucket
  as everything else)
- Escalation accumulation has no metric (count grows silently)
- Problem-solver result quality has no structured contract (unknown vs resolved
  vs escalated)

The system has metrics for some things, but it needs a cleaner split between
static integrity checks for structural mistakes and runtime metrics for
recurring live behavior.

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

### Observation vs Action

Separate observing from acting:

```text
Observer = collect facts, detect signals, build packets, record evidence
Actor    = judge signals, change state, run workflows, fix code, notify humans
```

Observation is always safe and should be always on. Acting is gated by owner,
urgency, confidence, and reversibility.

Observers:

- run deterministic checks, metrics, and scans
- collect enough context for an owner to understand the signal
- emit events, findings, packets, and evidence
- may run frequently because they do not mutate project strategy

Actors:

- are the responsible owner app, owner workflow, or explicitly approved
  deterministic repair
- decide whether a signal is noise, a real problem, an accepted exception, or a
  request for human judgment
- mutate task trees, files, config, sessions, alerts, or external systems
- must close the loop with result, evidence, or escalation

This split lets the system be proactive without becoming jumpy. When unsure,
observe and preserve context first; act only when the signal is owned and the
expected closure is clear.

### Concrete changes

**1. Consolidate overlapping handlers**

Disable only after the migration gate is proven:

- `daily-alert-review` → replaced by `may-agent.app` `daily-ops-digest`
  schedule. The digest writes a runtime report, notifies the human with
  context, emits `project.ops_digest.created`, and wakes the project owner
  when open/noisy conditions need judgment.
- `closed-loop-steward` → candidate replacement is metric-alert-reactor plus
  may-agent.app owner review, but keep enabled until alert-closure judgment
  replays prove no loss.
- `project-creative-audit` → candidate replacement is project-steward plus app
  owner review, but keep enabled until semantic fallback replays prove no loss.

Keep:

- `metric-alert-reactor` as the generic P0 fallback
- `project-steward` as the read-only scanner

Move to evaluation.app:

- `coaching-consumer` — evaluation domain work
- `feedback-echo-sync` — evaluation domain work

**2. Static Checks First**

Before adding runtime metrics, classify each failure mode:

| Failure                            | Right tool                                  | Why                                                         |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| Unscoped metric.breach routing     | Static app manifest check                   | Event subscription is declarative — check at load time      |
| Duplicate subscribeToBus lifecycle | Unit test + static ownership rule           | Structural bug, not runtime drift                           |
| Handler overlap                    | Static schedule/ownership check             | Declared handlers should have one clear owner and purpose   |
| Planner timeout rate               | Runtime metric                              | Recurring runtime behavior, varies with tree size           |
| Daemon heartbeat stale             | Runtime metric/watchdog                     | Only runtime can observe liveness                           |
| Regex false escalations            | Structured output contract + tests          | Fixed by removing the guess; test the contract              |
| Event routing gap                  | Static manifest check                       | Every event has a handler, adapter, or terminal declaration |
| Duplicate task creation            | Static dedup test + planner context quality | Information problem, not runtime drift                      |

Static checks to add (run at `bun run check` / app integrity):

- Every app event has a route, handler, or explicit external/terminal classification
- Every handler declares emitted events; emitted events are handled or terminal
- No duplicate cron lifecycle ownership: creator owns create/load/subscribe/start
- Metric registry and metrics doc agree on id, owner, priority, threshold
- Active metric has owner, priority, threshold, source, and closure path
- No retired/orphaned handler/metric still active in cron.json
- Task tree schema integrity: parent links, unique IDs, valid states, no orphans

**3. Runtime monitoring and proactive metrics**

Runtime monitoring is for live behavior: things static checks cannot know,
things that drift after startup, and unexpected symptoms that should make the
system more solid after investigation.

Use two layers:

1. **Active metrics** for important live conditions that should be watched
   continuously.
2. **Ops health packet observations** for broader symptoms that may be
   one-off, exploratory, or not yet worth making into permanent metrics.

Active metrics should stay small and proactive:

| Metric                                         | Priority | Rationale                                                                                 |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `runtime.daemon-heartbeat-stale`               | P0       | Only runtime knows if process is alive                                                    |
| `runtime.project-app-schedule-orphan-count-1h` | P1       | Only runtime can prove scheduled project-app events are producing owner/workflow progress |
| `session.planner-timeout-rate-6h`              | P1       | Varies with tree size, model response time                                                |
| `escalation.pending-count`                     | P1       | Accumulation is a runtime pattern                                                         |

Temporary (retire after static coverage proves the fix):

- `handler.duplicate-dispatch-rate` — validate the cron lifecycle fix, then retire

Ops health packet observations may include:

- recent `handler.failed`, `subscriber.failed`, and `message.delivery_failed`
  events
- unhandled or unknown event types observed at runtime
- repeated dispatch symptoms for the same event/handler pair
- stale queues, stale pending escalations, or missing closure signals
- abnormal task-tree/project-state drift reported by project-steward
- recent human-facing delivery failures or dropped conversation replies

These observations let the system be proactive without permanently expanding
the metric registry. When an observation repeats or needs an alert threshold,
promote it to an active metric with owner, priority, threshold, source, closure
path, and retirement condition when appropriate.

Do not add these as permanent metrics yet:

- `event.loop-detected-count` — static manifest check covers declared loops;
  runtime packet can still surface unexpected loop symptoms
- `event.unhandled-count` — static manifest check covers declared app events;
  runtime packet can still surface dynamic unhandled events
- `task.no-progress-duration` — project-steward already surfaces stale tasks
- `conversation.unclosed-human-reply-count` — keep as packet observation until
  repeated
- `problem.unknown-result-rate-24h` — structured contract + test covers this

**4. Add signal-gated ops review**

Keep the existing platform-review schedule for design/planning work. Add a
separate `ops-health-review` schedule that builds a deterministic health packet
as an observer. It only wakes the project owner, tech-lead, when there is a
meaningful signal that needs judgment or closure.

**5. may-agent.app task tree: ops-health branch**

Add a durable `ops-health` branch. It is not a permanent active lane —
it is a place for finite review/repair tasks. When a task completes, its
findings and decisions roll up into the branch context. New tasks are
created only when a real signal demands investigation or repair.

Example tasks (finite, created when signal demands):

- `add-static-integrity-checks`: implement the static checks listed above
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
    ops-health-review (1h)   — deterministic health packet and signal gating
    daily-ops-digest (24h)   — deterministic daily alert report and human summary

  task tree:
    platform-design/         — existing: SDK, conventions, project-app design
    ops-health/              — new: liveness, planner efficiency, handler hygiene
    ui-improvements/         — existing: project task UI fixes
```

### What This Is Not

- Not a new `system-ops.app` — may-agent.app already owns the platform. Adding
  a second app creates coordination overhead for no boundary benefit.
- Not more handlers on may's cron — the problem is too many handlers with no
  shared judgment. The app provides the shared judgment.
- Not replacing infra with app logic — infra still measures and recovers. The
  app judges and plans.
- Not making every observation actionable — the system can record weak signals
  without waking an actor until the signal repeats, becomes urgent, or needs
  closure.

### Signal-Gated Review Cadence

The ops-health-review runs hourly as a **deterministic observer** (no LLM).
It builds a compact health packet from DB queries, recent events, active metric
state, and static/integrity check summaries. The handler itself is pure code —
no agent session consumed.

May only wakes (LLM session) when the packet crosses a meaningful threshold:

- P0 metric breached (immediate)
- P1 metric breached with no owner action for >1h
- Escalation pending >1h with no resolution
- Daemon heartbeat stale >5min
- Repeated packet observation suggests an unexpected runtime issue

All other states are logged for observability but do not trigger a session.
Daily ops-digest is the scheduled rollup for non-urgent patterns. May reviews
whether packet observations should become static checks, regression tests,
active metrics, accepted exceptions, or finite ops-health tasks.

### Metric Priority Classification

Each active operational metric has an explicit priority:

| Metric                                         | Priority | Action                                                         |
| ---------------------------------------------- | -------- | -------------------------------------------------------------- |
| `runtime.daemon-heartbeat-stale`               | P0       | Immediate human escalation                                     |
| `runtime.project-app-schedule-orphan-count-1h` | P1       | Owner review within 1h; confirms project apps are self-driving |
| `session.planner-timeout-rate-6h`              | P1       | Owner review within 1h                                         |
| `escalation.pending-count`                     | P1       | Owner review within 1h                                         |

Temporary metric while the cron lifecycle fix is being validated:

| Metric                            | Priority | Action                                               |
| --------------------------------- | -------- | ---------------------------------------------------- |
| `handler.duplicate-dispatch-rate` | P1       | Owner review if it repeats after the static/unit fix |

P0 = immediate owner wake + possible human escalation.
P1 = owner review soon (next health packet with signal).
Temporary metrics must have an explicit retirement condition.

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
  and disabled in May cron after replay proof
- `closed-loop-steward` → replaced by ops-health-review + metric-alert-reactor
- `project-creative-audit` → replaced by project-steward + may-agent.app review
- `coaching-consumer` → migrate to evaluation.app
- `feedback-echo-sync` → migrate to evaluation.app

### Problem Solver Result Contract

Problem-solver outcomes should be structured workflow results, not text
matching. After the problem-solver fix, every problem-solver workflow must emit
one explicit result event:

- `project.problem.resolved` → counted as resolved
- `project.problem.escalated` → counted as escalated
- `project.problem.unknown` → counted as unknown

This is a contract plus regression-test concern. Do not add
`problem.unknown-result-rate-24h` as a permanent metric unless unknown outcomes
repeat after the structured contract is in place.

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

1. Refine proposal with ownership, priority, signal gating, and closure semantics ← done
2. Add app/static integrity checks and wire them into `bun run check`
3. Add the small active runtime metrics to `metrics-snapshot.ts`
4. Add a cheap deterministic health-packet builder (handler, no LLM)
5. Route only meaningful breaches to may-agent.app owner (signal-gated)
6. Create the `ops-health` task branch in may-agent.app task tree
7. Migrate overlapping handlers one by one after replay tests prove coverage

### Implementation Status

- Static integrity checks, active runtime metrics, and `ops-health-review` are
  implemented and wired into `may-agent.app`.
- `daily-alert-review` is replaced by the project-local `daily-ops-digest`
  schedule. Replay coverage in `workflows/daily-ops-digest.test.ts` proves that
  an open/noisy alert set writes a report, notifies the human with context, and
  wakes tech-lead with the digest signal. The old global May cron entry is
  disabled.
- `closed-loop-steward`, `project-creative-audit`, `coaching-consumer`, and
  `feedback-echo-sync` remain enabled until their replacements pass the same
  migration gate.
