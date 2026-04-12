# EXP-151 Phase 1: Trial Progress Tracker

**Started**: 2026-04-12 18:25 UTC  
**Target**: 180 trials (30 per cell × 6 cells)  
**Method**: gym-batch.sh with --variants baseline,coder-minimal-exp096

---

## Trial Matrix

| Cell | Bucket | Condition | Scenarios | Target N | Completed | Pass Rate |
|------|--------|-----------|-----------|----------|-----------|-----------|
| 1 | Easy | Full | E1,E2,E3 | 30 | 0 | — |
| 2 | Easy | Minimal | E1,E2,E3 | 30 | 0 | — |
| 3 | Medium | Full | M1,M2,M3 | 30 | 0 | — |
| 4 | Medium | Minimal | M1,M2,M3 | 30 | 0 | — |
| 5 | Hard | Full | H1,H2,H3 | 30 | 0 | — |
| 6 | Hard | Minimal | H1,H2,H3 | 30 | 0 | — |

## Scenario Key

| Code | Scenario | Bucket | Calibrated Rate |
|------|----------|--------|-----------------|
| E1 | mock-leak-trap | Easy | 100% (8/8) |
| E2 | investigate-fix-pattern | Easy | 89% (8/9) |
| E3 | wrong-fix-recovery | Easy | 78% (7/9) |
| M1 | contradictory-requirements-ext-3unrelated | Medium | 50% (4/8) |
| M2 | contradictory-requirements-ext-4gate | Medium | 67% (4/6) |
| M3 | kb-integration-discovery-fewshot | Medium | 33% (2/6) |
| H1 | contradictory-requirements | Hard | 0% (0/12) |
| H2 | escalation-impossible-task | Hard | 0% (0/11) |
| H3 | context-proof-build-xref | Hard | 0% (0/6) |

## Execution Plan

### Priority Order
1. **Easy + Hard buckets first** — highest confidence calibration, most interpretable
2. **Medium bucket later** — fragile calibration, may need adjustments

### Batch Strategy
- Use `gym-batch.sh` with `--variants baseline,coder-minimal-exp096`
- Run 5 trials per scenario per condition initially (= 30 per bucket pair)
- Check interim results before scaling to full N=30/cell

### Implementation Details
- **Full overhead**: `--agent coder` (no --lab flag, baseline variant)
- **Minimal overhead**: `--agent coder --lab coder-minimal-exp096`
- All runs recorded to `gym_runs` table in may.db
- lab_fork field distinguishes conditions: `NULL`/empty = Full, `coder-minimal-exp096` = Minimal

---

## Batch Run Log

### Batch 1: Easy Bucket (2026-04-12)
- **Command**: `gym-batch.sh --scenario mock-leak-trap --scenario investigate-fix-pattern --scenario wrong-fix-recovery --agent coder --variants baseline,coder-minimal-exp096 --trials 5`
- **Status**: PENDING
- **Results**: TBD

### Batch 2: Hard Bucket (pending)
- **Status**: NOT STARTED

---

## Interim Analysis Checkpoints

After each 30 trials (per bucket pair), check:
1. Are Easy baseline rates matching calibration (>70%)?
2. Are Easy minimal rates also high? (If minimal is already high, overhead effect on Easy may be null)
3. Are Hard rates still at floor? (Expected: both conditions ~0%)
4. Any anomalies requiring investigation?

## Notes
- The `coder-minimal-exp096` lab fork was created for EXP-096; reused here as the "minimal overhead" condition
- It has a stripped SOUL.md (~12 lines) with no skills, no guards, no workflow requirements
- The base `coder` agent has full SOUL.md (~42 lines) with 7 skills, constraints, and methodology sections
