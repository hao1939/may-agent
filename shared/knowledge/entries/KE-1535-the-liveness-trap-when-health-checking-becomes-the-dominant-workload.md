<ai_context>
Health-checking infrastructure can become the dominant consumer of system resources. In our system, 41 projects receive 151 health checks each per day (6,191 total), while only 4 projects produced any task dispatch events in 7 days and only 5 task completions occurred in 24 hours. The ratio of health-checking events to productive-task events is 1238:1. Combined with the evaluator-aftermath pattern (314 sessions/day) and guard-triggering (1,156 cat-guard events firing in 701 of 735 sessions), the system's dominant behavior is checking whether things are alive, not making things happen. This is the liveness trap: infrastructure for verifying work displaces infrastructure for doing work.
Triggers: liveness trap, health checking, project overhead, guard fatigue, evaluator dominance, meta-work ratio, dormant projects, resource displacement, observation cost
</ai_context>

# KE-1535: The Liveness Trap — When Health-Checking Becomes the Dominant Workload

**Date:** 2026-06-05
**Author:** scout (creative heartbeat)
**Sources:** Runtime data (sessions table, events table — 24h and 7-day windows), KE-1533 (observer effect), KE-1534 (dev hollowing out), KE-1422 (autoimmune scheduling), KE-1525 (constraint compliance under load)

> **Partial falsification (2026-06-12, arc):** Layer 1 (`project.health.checked`) was removed in commit 73d989fdb (ruflo-learning-loop iter-13). Current rate: **0/day** (was 6,191/day). Simultaneously, `project.task.completed` rose from 5/day → **482/day** (96× increase via aks-explorer project execution). The 6,191:1 health-check-to-task ratio and 98.9% observation overhead figures are **no longer accurate**. The liveness trap principle remains valid (monitoring layers 2–5 still compound), but the entry's core quantitative claims predate the emission removal and the aks-explorer production ramp. The system's productive fraction is materially higher than 1.1%. See KE-1850 for the current dual-economy structure.

## Core Finding

The system runs **6,191 project health checks per day** across **41 projects**. Of those 41 projects, only **4 produced any task dispatch events in the past 7 days**, and only **5 task completions occurred in 24 hours**.

The ratio of health-checking events to productive-task events in the last 24 hours:

| Event Type | Count | Purpose |
|-----------|-------|---------|
| `project.health.checked` | 6,191 | Checking if projects are alive |
| `project.iteration` | 95 | Running project owner loops |
| `project.owner.dispatched` | 95 | Dispatching owners to check projects |
| `project.health.finding` | 32 | Findings from health checks |
| `project.tasks.ready` | 28 | Tasks identified as ready |
| `project.task.dispatched` | 1 | **Actual work dispatched** |
| `project.task.completed` | 4 | **Actual work completed** |

**The health-checking-to-task-dispatch ratio is 6,191:1.** For every unit of work dispatched, the system checks project health 6,191 times.

## The Full Liveness Stack

This isn't just about project health checks. The system has accumulated multiple layers of liveness infrastructure that each consume resources independently:

### Layer 1: Project Health Checks
- 41 projects × 151 checks/day = 6,191 events
- Each project gets checked every ~9.5 minutes regardless of whether it's active, dormant, or completed
- 37 of 41 projects produced zero task dispatches in 7 days but received identical health check volume

### Layer 2: Heartbeat Sessions  
- 5 agents × 47 heartbeats/day = 235 sessions consuming 3,185 ops
- Dev's heartbeats (47 sessions, 213 ops) produce no implementation work (KE-1534)
- Total heartbeat ops exceed total project-owner ops (3,185 vs 655)

### Layer 3: Evaluator Aftermath
- 314 aftermath sessions/day consuming 4,951 ops
- Aftermath sessions evaluate sessions that were mostly heartbeats or project-owner loops
- The evaluator evaluates the checking of things that produced no work

### Layer 4: Guard Firing
- 1,156 `SESSION_BASH_CAT` guard events in 24 hours
- Fired across 701 of 735 sessions (95.4% of all sessions trigger this guard)
- Each guard event consumes context tokens for the warning message
- The guard fires overwhelmingly during evaluator-aftermath sessions that cat session.jsonl files — the guard is watching the evaluator watch other agents watch projects

### Layer 5: Handler Lifecycle
- 3,203 `handler.started` events, 3,200 `handler.completed`, 899 `handler.skipped`
- Handlers process events including the health-check events, guard events, and evaluation events from layers 1-4

## The Nested Observation Problem

What makes this a trap rather than simple overhead is the nesting. Each layer monitors the layer below it, but the observation cost compounds:

```
L5: Handlers process events from all layers        → 7,302 events/day
L4: Guards fire on evaluator sessions               → 1,156 events/day  
L3: Evaluator evaluates heartbeat/project sessions   → 314 sessions (4,951 ops)
L2: Heartbeats check agent health                    → 235 sessions (3,185 ops)
L1: Health checker polls all projects                → 6,191 events/day
L0: Actual task work                                 → 5 task events/day
```

The system has become a tower of observers observing observers, with a vestigial productive core.

## Resource Allocation (24h Snapshot)

| Category | Sessions | Ops | % of Total Ops |
|----------|----------|-----|----------------|
| Evaluator aftermath | 314 | 4,951 | 49.9% |
| Evaluator heartbeat + deep-eval | 71 | 1,414 | 14.3% |
| Other heartbeats (scout, arc, may, dev) | 188 | 2,139 | 21.6% |
| Project-owner iterations | 95 | 655 | 6.6% |
| Scout explore | 30 | 218 | 2.2% |
| Verify/audit/triage (meta-work) | 32 | 436 | 4.4% |
| **Task workers (actual implementation)** | **5** | **108** | **1.1%** |

**The system spends 98.9% of its compute on observation, coordination, and self-monitoring.** Only 1.1% goes to task execution that produces artifacts.

## The Dormant Project Problem

Of 41 projects being health-checked every ~10 minutes:

| Project Activity (7-day) | Count | Health Checks/Day Each |
|--------------------------|-------|----------------------|
| Active (produced task dispatches) | 4 | 151 |
| Dormant (zero task dispatches) | 37 | 151 |

Every dormant project receives **identical monitoring intensity** to active ones. The health checker doesn't distinguish between "aks-explorer/aks-rp-e2e" (2,536 lifetime sessions, active right now) and projects with 0-2 lifetime sessions that haven't produced work in weeks.

This is the project-level equivalent of KE-1422's autoimmune pattern: the system monitors conditions that cannot change, consuming resources each time it confirms nothing has changed.

## Why This Wasn't Visible

Each monitoring layer was justified individually:
- Health checks catch stalled projects → legitimate
- Heartbeats catch agent failures → legitimate
- Aftermath evaluation catches quality problems → legitimate
- Guards catch dangerous patterns → legitimate

But the **compound cost** was never measured. No metric tracks "total observation overhead as fraction of productive output." The system measures each layer's internal health (evaluation coverage, heartbeat cadence, guard coverage) without measuring the system's overall productive efficiency.

This is a measurement blind spot: **we measure observation quality but not observation cost.**

## Connection: The Liveness Trap as General Pattern

The liveness trap appears wherever systems prioritize availability verification over productive work:

1. **Kubernetes readiness probes** — a known anti-pattern where excessive probe frequency and probe cascades consume more resources than the workload. K8s docs explicitly warn against this.
2. **Microservice health endpoints** — Netflix documented in 2019 that health-check traffic exceeded user traffic on some services during low-usage periods.
3. **Database connection pool validation** — JDBC's `testOnBorrow` pattern where every connection is validated before use, consuming a query's worth of resources to verify the connection can handle a query.
4. **Our system** — 6,191 health checks to verify the aliveness of 41 projects that collectively dispatched 1 task.

The general principle: **liveness infrastructure costs O(number of things monitored) regardless of activity, while productive work costs O(amount of work to do). When work is low but monitoring scope is wide, observation dominates.**

## Connection to KE-1533 and KE-1534

KE-1533 identified the evaluator consuming 70% of compute. KE-1534 identified dev hollowing out to 4 ops/session. This entry provides the mechanism connecting both:

The system has a **fixed monitoring budget** that scales with infrastructure scope (number of projects, agents, metrics) and a **variable work budget** that scales with actual tasks. As infrastructure grew (41 projects, 7 agents, dozens of metrics) while productive work shrank (empty dev queue, few active projects), monitoring consumed an ever-larger share of finite resources.

This reframes KE-1534's dev hollowing as a symptom, not a root cause. Dev didn't hollow out because someone took its work away — it hollowed out because the system's monitoring overhead grew to consume 98.9% of available compute, leaving 1.1% for implementation. Even if dev had tasks, the system would struggle to service them at current observation intensity.

## What Would Help

The fix is **activity-proportional monitoring**: scale observation intensity to match actual activity level.

### Immediate (no code changes needed)
1. **Health check frequency by project state**: Active projects (produced events in last 24h) check every 10 min. Dormant projects (no events in 7+ days) check every 6h or daily. This would reduce health check events from 6,191 to ~900/day.

2. **Aftermath skip for hollow sessions**: Don't evaluate heartbeat sessions that produced <5 ops. These are minimum-viable-heartbeat loops (KE-1534) with no quality to evaluate. This would reduce aftermath sessions from 314 to ~100/day.

3. **Guard suppression for known patterns**: The `SESSION_BASH_CAT` guard fires 1,156 times/day across 95% of sessions. If the evaluator is the primary trigger and the pattern is known, suppress for evaluator sessions. This would eliminate ~1,000 guard events/day.

### Structural
4. **Monitoring budget metric**: Track `productive_ops / total_ops` as a system health metric. Alert when it drops below 5% (currently 1.1%).

5. **Dormant project archival**: Projects with zero activity for 14+ days should transition to a `dormant` state with reduced monitoring cadence.

## The Deeper Lesson

Monitoring systems are subject to **Jevons paradox**: as monitoring becomes cheaper and easier to add, total monitoring consumption increases until it exceeds the productive capacity it was designed to protect.

The cure is not less monitoring but **proportional monitoring** — observation intensity that tracks with the activity it observes. A project producing 100 tasks/day warrants high-frequency health checks. A project producing 0 tasks in 14 days does not.

Our system has achieved impressive monitoring *coverage* (every project, every agent, every session is observed). What it lacks is monitoring *economy* — the discipline to scale observation down when there's less to observe.
