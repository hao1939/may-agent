# Coach Todo — 2026-08-03 (Post-Project Cleanup)

## Current State: All Projects Closed

All 6 projects have been completed/closed:
- **documentation-gen**: closed ✅ (7/7 milestones)
- **evaluation-revival**: closed ✅ (15/17 milestones — 2 descoped)
- **workflow-reliability**: closed ✅ (9/12 milestones — 3 descoped)
- **agent-memory-learning**: closed ✅ (14/14 milestones)
- **coach-quality**: closed ✅ (17/19 milestones — 2 descoped)
- **skill-workflow-audit**: closed ✅ (18/18 milestones)

## Open Experiments — Need Closure

### EXP-530: Structural Verification Gate — NEEDS MEASUREMENT
- **Deployed**: 2026-07-01 to master-worker.ts
- **Last check**: Only 3 sessions (insufficient data as of 2026-05-25)
- **Action**: Measure latest worker sessions. Close with results.

### EXP-540: Structural Path Normalization — NEEDS MEASUREMENT
- **Deployed**: 2026-05-25 to master-worker.ts
- **Action**: Measure tech-lead C7.1 pass rate. Close with results.

### ~~EXP-440: QA Finish-Call Compliance — CLOSED NEGATIVE (2026-05-03)~~
- **Result**: 14.3% pass rate, WORSE than 25% baseline. Text rules don't fix procedural behaviors.
- **Closure**: `EXP-440-closure.md` written. Reinforces KE-480.

## P1: Next Actions

1. **Close stale experiments** (~~EXP-440~~, 530, 540) — EXP-440 closed; 530/540 need more data
2. **Gym regression run** — last run was 2026-04-09, overdue by months
3. **Skill audit** — 12 skills deployed, verify they're still referenced and useful
4. **New experiment design** — candidate: test judgment scenario (conflicting-requirements-tradeoff) that was designed but never baselined

### EXP-700: Parallel Tool Calls — CLOSED INCONCLUSIVE (2029-08-03)
- **Results**: `EXP-700-baseline-results.md`
- **Finding**: Skill shows 0pp quality improvement, ~20% duration reduction (proxy only). Transcript data unavailable for direct parallelism measurement.
- **Recommendation**: Don't deploy. Not enough signal.

### EXP-720: Few-Shot Injection in master-worker.ts — IN PROGRESS
- **Problem**: Few-shot injection proven 100% (18/18) but only in implement-and-verify.ts. master-worker.ts (93% of compute) has NO few-shot injection.
- **Hypothesis**: ≥20% of worker tasks match few-shot patterns; integration → ≥15pp quality improvement on matched tasks
- **Design**: `agents/coach/workspace/EXP-720-fewshot-master-worker-integration-design.md`
- **Status**: Phase 1 coverage audit in progress

### EXP-710: Task Timeout Pressure — BACKLOG
- **Problem**: Agents take 55-99s on tasks that could complete in <40s with efficient reading. No quality gate penalizes slow completion.
- **Hypothesis**: A "timeout-aware" skill that explicitly states "complete within N tool-call blocks" → measurable block reduction without quality loss.
- **Status**: DESIGN NEEDED

## P2: Backlog

- Harder gym scenarios needed (all current at ceiling)
- Few-shot module exists but NOT integrated into production
- Strict workflow gates proven (100% on sycophancy) but not deployed
- EXP-109 Phase 3 (clustering) never completed

## Proven Mechanisms (Ready for Production)

| Mechanism | Effect Size | Evidence | Status |
|-----------|------------|---------|--------|
| Forced externalization | +74pp (judgment) | 19/19 across 7 scenarios | Deployed |
| Task-level few-shot | 100% (18/18) | 7 scenario types | NOT integrated |
| Strict workflow gates | 100% (sycophancy) | 15/15 runs | Not deployed |
| Cross-reference discovery | 0%→100% | 6/6 across 2 agents | Skill deployed |

## Key Research Findings (Reference)

- SOUL.md text changes don't fix judgment failures (0/18) — use workflow enforcement
- Never stack interventions — 2+ degrades by 12-15pp (KE-123)
- Few-shot examples harm discovery tasks — -67pp (KE-133)
- Analysis gates HARM — agents feel done after writing analysis, skip fix (KE-180)
- Hard gate rules: artifact=solution, product-quality metrics, 2-phase for multi-step (KE-182)

---
*Historical items from previous todo preserved in [todo-archive.md](./todo-archive.md)*
