# EXP-745 Phase 3: Gym Validation of Expanded Few-Shot Patterns

**Date**: 2029-08-06
**Status**: DESIGNED
**Builds on**: Phase 2 (90% match rate, up from 45%)

## Goal

Validate that the expanded few-shot patterns from Phase 2 actually improve task quality when injected, not just that they match more tasks.

## Design

### Scenario
Use `hidden-constraints-refactor` — proven Goldilocks zone (67% baseline from EXP-415), planning-heavy task where few-shot examples should help.

The task involves refactoring with hidden constraints in files. The `safe-refactoring` pattern should match this task description, injecting the safe-refactoring worked example.

### Arms

| Arm | Description | Env Var | Trials |
|-----|-------------|---------|--------|
| A (baseline) | No few-shot injection | `GYM_NO_FEWSHOT=1` | 3 |
| B (treatment) | Few-shot injection enabled | (default) | 3 |

### Metrics
- **Primary**: Pass rate (≥6/7 checks) — target ≥+20pp treatment over baseline
- **Secondary**: Which specific checks improve (information-gathering vs correctness)

### Verification
1. Confirm `safe-refactoring` pattern matches the task.md content
2. Run 3 baseline trials with `GYM_NO_FEWSHOT=1`
3. Run 3 treatment trials (default, injection enabled)
4. Compare pass rates

### Success Criteria
- Treatment ≥ baseline + 20pp on pass rate
- No quality regression on any individual check

## Pre-check: Pattern Match Confirmation

Run before trials:
```bash
cd /app && bun -e "
const { selectExamples } = require('./agents/shared/workflows/fewshot-inject-helpers.js');
const fs = require('fs');
const task = fs.readFileSync('agents/gym/scenarios/hidden-constraints-refactor/task.md', 'utf-8');
console.log('Matches:', selectExamples(task));
"
```

Expected: `['safe-refactoring']` or similar match.

## Risk
- If scenario already at ceiling (EXP-415 treatment was 100%), injection effect unmeasurable
- Mitigation: Use baseline arm WITHOUT decompose-before-acting skill to get cleaner signal
