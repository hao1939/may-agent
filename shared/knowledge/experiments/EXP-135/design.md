# EXP-135: Guard Rate Escalation Analysis — Skill Degradation or Task Mix Change?

**Status**: COMPLETED
**Date**: 2026-04-11
**Author**: Coach
**Channel**: Observational (production data analysis)
**Tests**: H-100 (Skill-Guard Divergence)
**Connected**: EXP-134 (guard recovery audit), EXP-110 (guard production impact), KE-106 (structural enforcement)

---

## Motivation

EXP-134 found that the FM-3.3 finish guard activation rate increased dramatically over three periods:

| Period | Sessions | FM-3.3 blocks | Rate |
|---|---|---|---|
| **Early** (Mar 24-31) | 1,626 | 94 | 5.8% |
| **Mid** (Apr 1-6) | 988 | 199 | 20.1% |
| **Late** (Apr 7-11) | 2,257 | 782 | 34.6% |

EXP-134 confirmed 99.7% of these are true positives (genuine unverified finish attempts). But it left a critical confound unresolved: **Is the increase in guard rate caused by behavioral degradation (agents getting worse at verifying) or by a shift in task mix (more complex, write-heavy sessions in later periods)?**

This distinction matters for H-100:
- If the increase holds **within task types** → agents are genuinely degrading → H-100 strengthened
- If the increase is **explained by task mix shift** → the guard catches more because there's more to catch → null for H-100

## Research Questions

1. **Task mix shift**: Did the proportion of write-heavy task types (work sessions, cron jobs) change across periods?
2. **Agent composition shift**: Is the guard rate increase driven by one agent (e.g., bob) becoming more dominant?
3. **Within-type guard rate**: Controlling for task type, does the guard rate still increase?
4. **Within-agent guard rate**: Controlling for agent identity, does the guard rate still increase?
5. **Write complexity**: Did sessions become more write-heavy over time (more edits/writes per session)?

## Hypotheses

**H-EXP135a** (Skill Degradation): The guard rate increase holds within task types AND within agents, even after controlling for write complexity. This would mean agents are genuinely getting worse at remembering to verify.

**H-EXP135b** (Task Mix): The guard rate increase is fully or primarily explained by a shift toward more write-heavy task types, more write-heavy agents, or more complex sessions.

## Method

### Phase 1: Task Type Classification

Classify all sessions into types based on task string patterns:
- `[heartbeat]` — periodic heartbeat sessions
- `[WORK SESSION]` — dedicated work sessions (more complex, more writes)
- `[cron:*]` — cron-triggered jobs (various types)
- `checkpoint` — simple checkpoint calls
- `other` — everything else

### Phase 2: Period-Level Analysis

For each period (Early/Mid/Late):
1. Task type distribution (% of each type)
2. Agent distribution (% of each agent)
3. Mean opCount per session (proxy for write complexity)
4. Guard rate overall and by task type

### Phase 3: Controlled Guard Rate

Compute guard rate within each (task_type, period) cell. If the guard rate increases within task types, task mix is not the explanation.

### Phase 4: Agent-Controlled Analysis

Same as Phase 3 but controlling for agent instead of task type.

### Phase 5: Write Complexity Control

Use opCount (operation count) from the sessions table as a proxy for session complexity. Compare mean opCount across periods and check if guard rate correlates with opCount rather than time.

## Data Sources

- `.state/may.db` — sessions table (task, agent, startedAt, opCount)
- `.state/sessions/*.jsonl` — for FM-3.3 guard block detection (grep for "blocked [FM-3.3]")
- Period boundaries: Early (Mar 24-31), Mid (Apr 1-6), Late (Apr 7-11)

## Predictions

### If H-EXP135a (Skill Degradation):
- Within-heartbeat guard rate increases Early→Late
- Within-work-session guard rate increases Early→Late
- Within-agent guard rates increase for most agents
- H-100 P(H) should increase

### If H-EXP135b (Task Mix):
- Guard rate within each task type stays roughly constant
- The mix shifts toward work sessions and complex cron jobs
- The overall increase is a Simpson's paradox artifact
- H-100 evidence is weaker than EXP-134 suggested

## Success Criteria

- [ ] Guard rate computed within each (task_type × period) cell
- [ ] Guard rate computed within each (agent × period) cell
- [ ] Write complexity (opCount) analyzed across periods
- [ ] Clear verdict on H-EXP135a vs H-EXP135b
- [ ] H-100 probability updated

## Tags
`guard-analysis`, `behavioral-degradation`, `task-mix`, `simpson-paradox`, `H-100`, `production-data`
