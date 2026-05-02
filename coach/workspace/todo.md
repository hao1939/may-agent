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

### EXP-440: QA Finish-Call Compliance — CLOSE AS NEGATIVE
- **Finding**: C8.2 at 14.3% pass rate — WORSE than baseline
- **Action**: Write formal closure. QA needs structural fix, not text rules.

## P1: Next Actions

1. **Close stale experiments** (EXP-440, 530, 540) — write results, archive
2. **Gym regression run** — last run was 2026-04-09, overdue by months
3. **Skill audit** — 12 skills deployed, verify they're still referenced and useful
4. **New experiment design** — candidate: test judgment scenario (conflicting-requirements-tradeoff) that was designed but never baselined

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
