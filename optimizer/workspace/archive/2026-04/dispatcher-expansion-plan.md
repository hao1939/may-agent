# Dispatcher Expansion Plan — Bob & Coach

**Date**: 2026-04-06
**Author**: Optimizer
**Status**: Ready for deployment
**Prerequisite**: EXP-034 results (optimizer dispatcher: all 8 success criteria met)

---

## 1. Current State & Cost Baseline (7-day averages)

### Heartbeat Metrics

| Agent | HBs/7d | Avg Ops | Avg Cost | Avg Turns | Avg Min | Error Rate | HB Cost/Day |
|-------|--------|---------|----------|-----------|---------|------------|-------------|
| **Optimizer** (POST) | 8/13h | **9.0** | **$0.15** | **12.8** | **1.7** | **0%** | **$3.57** |
| Bob | 120 | 26.2 | $2.78 | 39.1 | 18.6 | 12.5% (15 errs) | $47.26 |
| Coach | 85 | 30.5 | $1.91 | 37.9 | 13.3 | 11.8% (10 errs) | $23.13 |

### Error Breakdown

| Agent | Turn-Limit (30) | Turn-Limit (40) | Timeout | Other |
|-------|-----------------|-----------------|---------|-------|
| Bob | 4 | 5 | 4 | 2 |
| Coach | 1 | 8+1 | 0 | 0 |

**Both agents show the same pathology as optimizer pre-dispatcher**: turn-limit errors from trying to do work inside heartbeats. Bob additionally has timeout errors from long research sessions.

### Ops Distribution (heartbeats)

| Agent | ≤10 ops | 11-20 | 21-30 | 31-40 | 40+ |
|-------|---------|-------|-------|-------|-----|
| Bob | 38 (32%) | 11 (9%) | 25 (21%) | 15 (13%) | 31 (26%) |
| Coach | 23 (27%) | 6 (7%) | 12 (14%) | 16 (19%) | 28 (33%) |

**Key insight**: ~26-33% of heartbeats exceed 40 ops. These are the sessions that should be forks. Another ~13-19% are in the 31-40 danger zone. Together, ~39-52% of heartbeats are at risk of turn-limit errors.

---

## 2. Projected Savings

### Conservative Estimates (based on optimizer's actual results)

Optimizer achieved: 94% heartbeat cost reduction ($2.63 → $0.15/session).

For Bob and Coach, assume **90% heartbeat cost reduction** (slightly less because their work may be harder to decompose):

| Agent | Current HB Cost/Day | Projected HB Cost/Day | Savings/Day |
|-------|--------------------|-----------------------|-------------|
| Optimizer (actual) | $31.35 | $3.57 | $27.78 |
| **Bob** | **$47.26** | **~$4.73** | **~$42.53** |
| **Coach** | **$23.13** | **~$2.31** | **~$20.82** |
| **Total** | **$101.74** | **~$10.61** | **~$91.13** |

**Annual projection: ~$91/day × 365 = ~$33,262/year from heartbeat overhead alone.**

### Work Session Cost Impact

Dispatcher heartbeats fork focused work sessions when there's substantive work. These cost money too, but:
- Work sessions complete successfully (no turn-limit kills)
- Work sessions produce better quality output (optimizer: 5.0/5 vs 3.4/5)
- Work sessions use only the context they need (not full heartbeat context reload)
- Net daily cost drops ~65-83% (optimizer actual: 70% total cost reduction)

### Error Rate Impact

| Agent | Current Error Rate | Projected Error Rate | Change |
|-------|-------------------|---------------------|--------|
| Optimizer (actual) | 12.2% → 0% | — | -12.2pp |
| Bob | 12.5% | ~0% | -12.5pp |
| Coach | 11.8% | ~0% | -11.8pp |

---

## 3. Design Decisions

### Bob-Specific Adaptations

Bob's unique challenge: **open-ended research and synthesis**. His heartbeat currently does deep reading and connecting — activities that feel hard to decompose. The dispatcher handles this by:

1. **OBSERVE phase focuses on knowledge base changes** — new experiments, library additions, hypothesis status changes. Quick `ls -lt` and `git log` commands, not deep reading.
2. **Fork boundaries are clear**: writing any hypothesis file, synthesizing across sources, processing experiment results, Bayesian scoring — these are all discrete, completable tasks.
3. **The "connect dots" work IS forkable**: "Synthesize EXP-034 results into knowledge base" is a well-scoped work session, not an amorphous research task.
4. **Bob's 32% of heartbeats that use ≤10 ops**: these are already lean. The dispatcher pattern won't penalize these — they'll be even leaner (5-9 ops for pure triage).

### Coach-Specific Adaptations

Coach's unique challenge: **workflow integration**. Coach already uses `workflow.run()` for growth-cycles and training-sprints. The dispatcher handles this by:

1. **Gym scenarios are ALWAYS forked**: even "just one quick baseline" costs 15-25 ops. The heartbeat must not run scenarios.
2. **Workflow calls go in work sessions**: `workflow.run("growth-cycle", ...)` inside a forked `[WORK SESSION]`, not inside the heartbeat.
3. **Error pattern scanning stays inline**: a quick 1-2 op database query to check for new patterns is fine in the heartbeat. The investigation of those patterns gets forked.
4. **Coach's Option menu (A-F) maps cleanly**: Options A-D each become a forkable work session. Options E-F (workflows) become forkable sessions that run the workflow.

---

## 4. Rollout Plan

### Phase 1: Bob (Days 1-3)

**Day 1: Deploy**
- Replace `agents/bob/heartbeat.md` with dispatcher version
- Monitor first 3-4 heartbeats for correct dispatcher behavior
- Check: does Bob fork when encountering substantive work?

**Days 2-3: Stabilize**
- Target: ≥6 heartbeats under dispatcher mode
- Success criteria:
  - Heartbeat ops < 20 (avg)
  - Error rate = 0%
  - At least 1 work session successfully forked and completed
  - Cost/heartbeat < $0.80

**Rollback trigger**: If >2 heartbeats fail to dispatch correctly (do work inline despite the instructions), revert and investigate.

### Phase 2: Coach (Days 3-5)

**Day 3: Deploy** (after Bob stabilizes)
- Replace `agents/coach/heartbeat.md` with dispatcher version
- Monitor first 3-4 heartbeats

**Days 4-5: Stabilize**
- Same success criteria as Bob
- Additional check: does Coach correctly fork workflow sessions?

### Phase 3: Monitor (Days 5-10)

Track these metrics daily for both agents:

| Metric | Target |
|--------|--------|
| Heartbeat error rate | 0% |
| Heartbeat avg ops | < 15 |
| Heartbeat avg cost | < $0.50 |
| Work session completion rate | > 85% |
| Total daily cost (per agent) | < 50% of baseline |
| Quality score (heartbeats) | ≥ 4.5/5 |
| Quality score (work sessions) | ≥ 4.0/5 |

### Monitoring Query

```sql
-- Run daily during Phase 3
SELECT s.agent,
  SUM(CASE WHEN s.task LIKE '%heartbeat%' THEN 1 ELSE 0 END) as hb_count,
  SUM(CASE WHEN s.task LIKE '%WORK SESSION%' THEN 1 ELSE 0 END) as ws_count,
  ROUND(AVG(CASE WHEN s.task LIKE '%heartbeat%' THEN s.opCount END), 1) as hb_avg_ops,
  ROUND(AVG(CASE WHEN s.task LIKE '%heartbeat%' THEN json_extract(e.usage,'$.cost') END), 2) as hb_avg_cost,
  SUM(CASE WHEN s.task LIKE '%heartbeat%' AND s.status='error' THEN 1 ELSE 0 END) as hb_errors
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.startedAt > ? -- 24h ago
  AND s.agent IN ('bob', 'coach')
GROUP BY s.agent
```

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Agent ignores dispatcher pattern, does work inline | Explicit "DO NOT" instructions + structural enforcement (role reminder at bottom) |
| Work sessions fail/get stuck | Next heartbeat should detect via agents.list/peek and retry |
| Fork-and-forget (orphaned work sessions) | Heartbeat Step 1 includes check for running sessions |
| Too many concurrent forks | Design limits to 1 substantive fork per heartbeat |
| Research work is "too amorphous" to fork | All examples use specific, completable objectives |
| Coach workflow.run() needs full context | Work session task description includes explicit read/context instructions |

---

## 6. Expected Outcome

### Before Dispatcher (current, 7-day baseline)

| Metric | Bob | Coach | Combined |
|--------|-----|-------|----------|
| HB cost/day | $47.26 | $23.13 | $70.39 |
| Total cost/day | $53.24 | $44.10 | $97.34 |
| Errors/day | ~2.1 | ~1.4 | ~3.5 |
| Quality | 3.7/5 | 3.4/5 | — |

### After Dispatcher (projected)

| Metric | Bob | Coach | Combined |
|--------|-----|-------|----------|
| HB cost/day | ~$4.73 | ~$2.31 | ~$7.04 |
| Total cost/day | ~$18 | ~$15 | ~$33 |
| Errors/day | ~0 | ~0 | ~0 |
| Quality | ≥4.5/5 | ≥4.5/5 | — |

### Net Impact (3-agent total including optimizer)

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| HB cost/day (3 agents) | $101.74 | ~$10.61 | **~$91.13/day** |
| Total cost/day (3 agents) | ~$132.65 | ~$45.24 | **~$87.41/day** |
| Errors/day (3 agents) | ~3.5+ | ~0 | **~3.5 fewer/day** |
| Annual savings | — | — | **~$31,900** |

---

## 7. Files Produced

- `agents/optimizer/workspace/proposed-bob-heartbeat.md` — Drop-in replacement for `agents/bob/heartbeat.md`
- `agents/optimizer/workspace/proposed-coach-heartbeat.md` — Drop-in replacement for `agents/coach/heartbeat.md`
- `agents/optimizer/workspace/dispatcher-expansion-plan.md` — This document

### Deployment Commands

```bash
# Phase 1: Bob
cp agents/optimizer/workspace/proposed-bob-heartbeat.md agents/bob/heartbeat.md
cd agents && git add bob/heartbeat.md && git commit -m "feat(bob): convert heartbeat to dispatcher mode (EXP-034 expansion)"

# Phase 2: Coach
cp agents/optimizer/workspace/proposed-coach-heartbeat.md agents/coach/heartbeat.md
cd agents && git add coach/heartbeat.md && git commit -m "feat(coach): convert heartbeat to dispatcher mode (EXP-034 expansion)"
```
