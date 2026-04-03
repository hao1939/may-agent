# EXP-019: Investigate-and-Fix Skill on investigate-fix-pattern Scenario

**Date**: 2026-04-03
**Status**: COMPLETE
**Verdict**: DISPROVEN — Skill did not improve the `reproduce-first` gap

## Hypothesis
The `investigate-and-fix` skill file, when injected into the coder agent's skills directory,
will cause the agent to reproduce the bug (run tests) before attempting a fix, closing the
`reproduce-first` process check gap (baseline: 0/2 pass, 4/5 process).

## Design
- **Scenario**: `investigate-fix-pattern` (API endpoint 500 errors, requires finding root cause in db.js)
- **Baseline**: coder agent, no lab fork
- **Treatment**: coder agent + `investigate-and-fix` skill injected via lab fork `exp-019-investigate-fix`
- **Runs per arm**: 2
- **Primary metric**: `reproduce-first` check pass rate

## Results

| Arm | Run | Product | Process | reproduce-first | Duration |
|-----|-----|---------|---------|-----------------|----------|
| Baseline | 1 | 4/4 | 4/5 | ❌ | ~42s |
| Baseline | 2 | 4/4 | 4/5 | ❌ | ~100s |
| Treatment | 1 | 4/4 | 4/5 | ❌ | ~42s |
| Treatment | 2 | 4/4 | 4/5 | ❌ | ~159s |

### Summary
- **Baseline**: 0/2 reproduce-first, 8/10 total process checks
- **Treatment**: 0/2 reproduce-first, 8/10 total process checks
- **Delta**: 0% improvement. No effect detected.

## Analysis

The skill file contains explicit Step 2 ("Reproduce / Confirm the Issue") with examples
like `bash("node test.js")`. However, the agent consistently skips this step, going
directly from reading source code to implementing the fix.

### Why the skill didn't work
1. **Skill file is descriptive, not prescriptive enough**: The skill describes the pattern
   in prose ("verify the issue exists before fixing it") but doesn't create a strong enough
   behavioral trigger. The agent reads the skill content but the "Simple first" common-sense
   rule + natural tendency to fix the obvious issue overrides the reproduce-first discipline.

2. **Scenario structure may contribute**: The task.md explicitly describes the error and
   provides the error log. The agent may interpret "I already have reproduction evidence
   from the task description" and skip running tests.

3. **Skill is buried in context**: The investigate-and-fix skill is one of 6 skill files
   loaded. By the time the agent reaches Step 2, it's already deep in context and may not
   recall the specific "run tests first" instruction.

### Implications for skill design
- **Descriptive skills ≠ behavioral change**: A skill that says "you should X" is
  fundamentally different from a skill that creates a mandatory checkpoint or trigger.
- **Strong language may be needed**: Instead of "Verify the issue exists before fixing it",
  something like "⛔ MANDATORY: Run `npm test` or equivalent BEFORE any edit. No exceptions."
- **Shorter, punchier skills**: The investigate-and-fix skill is ~180 lines. The key
  actionable instruction is buried at line ~50. A 10-line version focused solely on
  "reproduce first" might be more effective.

## LIBRARY Update
- investigate-and-fix: ⚪ untested → ❌ DISPROVEN (text injection did not change behavior on reproduce-first gap)

## Workflow Variant Testing (investigate-fix-pattern-workflow)

The `investigate-fix-pattern-workflow` scenario uses 2-phase workflow enforcement:
- **Phase 1**: Investigation only — read code, run tests, write analysis.md. No edits allowed.
- **Phase 2**: Fix based on analysis — implement and verify.

| Arm | Run | Product | Process | reproduce-first | Duration |
|-----|-----|---------|---------|-----------------|----------|
| Workflow | 1 | 4/4 | 5/5 | ✅ | ~120s |
| Workflow | 2 | 4/4 | 5/5 | ✅ | ~169s |

### Workflow Summary
- **Workflow**: 2/2 reproduce-first ✅, 10/10 total process checks
- **vs Baseline**: 0/2 → 2/2 on reproduce-first (0% → 100%)
- **vs Treatment (skill text)**: 0/2 → 2/2 (identical improvement)

This confirms the pattern seen across all experiments: **workflow enforcement works where
text injection fails**. The 2-phase separation physically prevents the agent from editing
before investigating, which is the only reliable way to enforce reproduce-first behavior.

## Consolidated Verdict
- **Text injection**: ❌ DISPROVEN (0/4 reproduce-first, zero delta from baseline)
- **Workflow enforcement**: ✅ PROVEN (2/2 reproduce-first, 100% on critical check)
- **This is the 20th consecutive text-injection failure** (only exception: grep-first-reading skill file)

## Next Steps
- Consider promoting investigate-fix-pattern-workflow for production use
- The workflow is the ONLY mechanism that reliably creates investigate-first behavior
- Text-based skills are conclusively ineffective for process discipline changes
