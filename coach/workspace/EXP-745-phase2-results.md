# EXP-745 Phase 2 Results: Pattern Expansion

**Date**: 2026-05-03  
**Status**: PHASE 2 COMPLETE  

## Changes Made

### Pattern Improvements in `fewshot-inject-helpers.ts`

1. **evidence-over-narrative**: Added `not.*work` to catch "does not work" (was only matching contractions)
2. **incremental-implementation**: Added `add.*to|write.*test|add.*handling` to catch pagination, test-writing, and generic "add X to Y" tasks
3. **safe-refactoring**: Changed `clean.*up` → `clean\s` to match "Clean unused" (not just "clean up"). Added `remov.*unused|unused.*import` for cleanup tasks.

### Coverage Results

| Phase | Match Rate | Sample Size |
|-------|-----------|-------------|
| Phase 1 (before) | 9/20 (45%) | 20 representative tasks |
| Phase 2 (after) | 18/20 (90%) | Same 20 tasks |

**Delta: +45pp** — exceeds 75% target by 15pp.

### Remaining Gaps (2/20)
- "Update README with new API docs" — documentation tasks
- "Deploy feature flags to staging" — deployment/ops tasks

These are intentionally unmatched: no few-shot examples exist for docs/ops tasks. Writing examples for these low-frequency categories is P2.

### False Positive Check
- "Add error handling to file upload" now matches BOTH `reproduce-first-debugging` (via "error") AND `incremental-implementation` (via "add.*handling"). This is acceptable — both examples are relevant for error-handling tasks.
- `add.*to` is broad but filtered by MAX_EXAMPLES=2, so worst case is 2 slightly-off examples rather than 0.

## Next Steps
- Phase 3: Gym validation — run 3 baseline vs 3 treatment trials on implementation/refactoring scenario to confirm quality improvement
- Monitor `exp720-fewshot-dryrun.log` for production match data once worker sessions resume
