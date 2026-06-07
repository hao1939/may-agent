<ai_context>
takeaway: The project-execution-engine design doc specifies "Maximum horizontal retries per task: 3" (added in response to KE-1580) but the runtime only enforces this for interrupted control-loop rework recovery (MAX_INTERRUPTED_CONTROL_REWORK_ATTEMPTS=3 at line 125). The planning loop itself has no retry cap — it creates fresh runs indefinitely via createPlanningLoopRun(), superseding old ones. Result: 171 planning loop runs in the aks-rp-e2e task tree (160 superseded, 9 decomposed, 1 accepted, 1 active) and 733 total tasks (285 rework/review, 190 superseded). The interrupt storm since June 5 (0% interrupted before, 40-78% after) is not caused by missing retry limits on individual tasks — those are working — but by the meta-level loop: each planning run proposes tasks → tasks get interrupted → recovery creates rework → rework gets superseded → engine creates a fresh planning run → cycle repeats. The design doc's horizontal retry limit is correctly implemented for leaf tasks but the planning loop itself is exempt from any retry budget. This is the structural gap between "task retry is capped" and "the loop that creates tasks is uncapped."
triggers: planning loop, meta-retry, horizontal retry, design-runtime gap, aks-explorer, interrupt storm, task tree bloat, superseded, KE-1580 update, project-execution-engine, circuit breaker
</ai_context>

# KE-1654: The Planning Loop Meta-Retry Gap — Design Doc Says 3 Retries, Runtime Allows 171

**Created**: 2026-06-07
**Agent**: arc (heartbeat coherence audit)
**Type**: Design-runtime contradiction
**Confidence**: High — measured from task tree JSON, runtime source, design doc, and session DB
**Connects**: KE-1580 (horizontal retry churn), KE-1574 (rework depth limit), KE-1572 (interrupt storm phase transition), KE-1566 (rework recursion trap)

---

## The Contradiction

**Design doc** (`shared/may-agent-docs/2a-design/project-execution-engine.md` lines 1205-1209):

> Maximum horizontal retries per task: 3. When a rework-review task is reset to `ready` (via the isReviewTask guard) for a 4th time, mark it as `blocked` [...] instead of retrying. This prevents horizontal retry churn where the same task loops without new information (KE-1580).

**Runtime** (`projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts`):

- `MAX_INTERRUPTED_CONTROL_REWORK_ATTEMPTS = 3` (line 125) — enforced only in `recoverStalledPlanningLoopRework()` (line 1468), which supersedes rework-review tasks after 3 interrupted attempts and creates a **fresh planning loop run**.
- `createPlanningLoopRun()` (line 1329) creates new planning runs with no ordinal cap or total-run limit.
- Result: the individual task retry limit works, but every superseded rework triggers a fresh planning run, which proposes new tasks, which get interrupted, which create new rework, which triggers another fresh planning run.

## Evidence

### Task tree state (aks-rp-e2e/tasks/tree.json)

| Metric | Value |
|--------|-------|
| Total tasks | 733 |
| Planning loop runs | 171 (160 superseded, 9 decomposed, 1 accepted, 1 active) |
| Rework/review tasks | 285 |
| Superseded tasks | 190 |
| Total task attempts | 776 |
| Interrupted attempts | 252 |

### Session impact (aks-explorer)

| Window | Total | Interrupted | Rate |
|--------|-------|-------------|------|
| Jun 1-4 (pre-storm) | 1,083 | 0 | 0% |
| Jun 5 | 218 | 87 | 39.9% |
| Jun 6 | 304 | 163 | 53.6% |
| Jun 7 (today, partial) | 18 | 14 | 77.8% |

In the last 24h alone: 176 interrupted sessions consuming 4,570 ops and 14.7 hours of compute.

### Lifetime totals

- 3,412 total aks-explorer sessions across 11 active days
- 265 interrupted (7.8% lifetime, but 55% in last 24h — the storm is recent and worsening)
- 6,636 ops in interrupted sessions (29.5% of 22,491 total ops)

## The Structural Gap

The design doc's retry limits address the **leaf level** correctly:
1. ✅ Rework depth limit (max 2) prevents vertical recursion
2. ✅ Horizontal retry limit (max 3) prevents infinite reset loops on individual tasks

But neither limit constrains the **meta-level loop**:

```
Planning run N → proposes tasks → tasks interrupted → rework created
→ rework interrupted 3x → superseded → fresh planning run N+1
→ proposes same/similar tasks → cycle repeats
```

Each planning run is a fresh task with a fresh attempt counter. The 3-retry limit resets every time the engine creates a new run. The loop has iterated 171 times.

## What Would Fix It

The design doc should add a meta-level constraint. Options:

1. **Planning loop run budget**: After N consecutive planning runs where no proposed task reaches `accepted`, mark the planning loop itself as `blocked` with diagnostic summary.
2. **Cooldown timer**: After superseding a planning run, require a minimum interval (e.g., 30 minutes) or an external trigger before creating the next run.
3. **Interrupt pattern detection**: If the last K planning runs all ended with the same tasks being interrupted, stop creating new runs and emit a diagnostic event.

The key insight: the per-task retry limit is necessary but not sufficient. The system also needs a per-loop retry limit.

## Relationship to evaluator.substantive-low-quality-rate-24h

The evaluator's red metric (0.37, threshold 0.30) is dominated by aks-explorer sessions. The evaluator heartbeat (session s_1780794512656_572) correctly identified aks-explorer as the root-cause upstream driver: 201 low-quality evaluations from aks-explorer (175 interrupted, 14 error, 12 done). This KE documents the structural mechanism producing those interrupted sessions.

---

*Filed from arc heartbeat coherence audit, 2026-06-07. This is a design-reality gap: the design doc states a constraint the runtime doesn't fully enforce at the loop level.*
