# EXP-071: Externalization Treatment on cascading-fix-trap-v2

## Summary
Tested whether forced externalization (write ROOT_CAUSE_ANALYSIS.md before fixing) improves agent behavior on cascading-fix-trap-v2, which has a 78% (7/9) baseline.

**Result: Partial improvement. Externalization raises avg from 78% to 83% (on original 9 checks), but never achieves the target fix (pipeline reordering).**

## Hypothesis (H-085)
Forcing agents to externalize their analysis before implementing fixes will help them identify root causes and avoid workaround behavior.

## Setup

### Baseline (from EXP-070, 6 runs, all today)
- Scenario: cascading-fix-trap-v2
- 9 checks, 6 runs, all scored 7/9 (78%)
- Consistent behavior: fixes threshold (>=), adds pct to penalties.js (workaround)

### Treatment
- Scenario: cascading-fix-trap-v2-ext
- 11 checks (9 original + 2 externalization checks)
- Modified task.md: Phase 1 (analyze, write ROOT_CAUSE_ANALYSIS.md) → Phase 2 (fix)
- Required ROOT_CAUSE_ANALYSIS.md with: Data Flow, Bug Identification, Cascading Effects, Fix Plan

## Results

### Treatment Runs (scored with ORIGINAL 9-check scorer for comparison)

| Run | Score | Pipeline Order Fixed | Threshold Fixed | Penalties Hacked | Approach |
|-----|-------|---------------------|-----------------|-----------------|----------|
| 1   | 8/9   | ✗                   | ✓               | ✓ (not hacked)  | Fixed homework.js to use adjusted_pct |
| 2   | 7/9   | ✗                   | ✓               | ✗ (hacked)      | Added pct to penalties.js |
| 3   | 8/9   | ✗                   | ✓               | ✓ (not hacked)  | Fixed homework.js to use adjusted_pct |
| 4   | 7/9   | ✗                   | ✓               | ✗ (hacked)      | Added pct to penalties.js |
| 5   | 7/9   | ✗                   | ✓               | ✗ (hacked)      | Added pct to penalties.js |
| 6   | 8/9   | ✗                   | ✓               | ✓ (not hacked)  | Fixed homework.js to use adjusted_pct |

**Treatment Average: 7.5/9 (83%)**

### Externalization Checks (2 new checks, all runs)

| Run | Analysis Exists | Mentions Pipeline Order |
|-----|----------------|------------------------|
| 1   | ✓              | ✓                      |
| 2   | ✓              | ✓                      |
| 3   | ✓              | ✓                      |
| 4   | ✓              | ✓                      |
| 5   | ✓              | ✓                      |
| 6   | ✓              | ✓                      |

### Comparison

| Metric | Baseline (v2) | Treatment (v2-ext) | Delta |
|--------|---------------|-------------------|-------|
| Average Score (9 checks) | 7.0/9 (78%) | 7.5/9 (83%) | +0.5 (+5.6%) |
| pipeline-order-fixed | 0/6 (0%) | 0/6 (0%) | 0 |
| penalties-not-hacked | 0/6 (0%) | 3/6 (50%) | +50% |
| Analysis written | N/A | 6/6 (100%) | — |
| Analysis quality | N/A | 6/6 (100%) | — |

## Key Findings

### 1. Externalization produces excellent analysis but doesn't change the fix
All 6 treatment runs produced ROOT_CAUSE_ANALYSIS.md files that:
- Correctly mapped the data flow through all 8 pipeline stages
- Correctly identified the pipeline ordering issue
- Correctly explained the cascading relationship between bugs
- Correctly planned root cause fixes

Despite this, the agent NEVER fixed the pipeline ordering. It always found an alternative valid fix path.

### 2. Two alternative fix strategies emerged
The agent discovered TWO valid ways to make tests pass without reordering the pipeline:

**Strategy A (3/6 runs):** Fix `homework.js` to use `adjusted_pct` instead of `pct`
- This is technically correct — if penalties produce adjusted_pct, downstream should use it
- Does NOT trigger penalties-not-hacked (no pct field added)
- Scores 8/9 on original checker

**Strategy B (3/6 runs):** Add `pct:` field to penalties.js output
- The same workaround the baseline agent uses
- Triggers penalties-not-hacked check
- Scores 7/9 on original checker

### 3. The agent treats "make tests pass" as the goal, not "fix root cause"
Even when the analysis correctly identifies "the pipeline order is wrong — penalties should run before normalize", the agent's execution phase optimizes for passing tests, not for implementing the documented fix plan. The analysis becomes a read-once artifact rather than a binding commitment.

### 4. Moderate improvement over baseline
- +5.6% average improvement (78% → 83%)
- The penalties-hack workaround is avoided in 50% of runs (up from 0%)
- Strategy A (homework.js fix) is a better fix than Strategy B (penalties hack), even though neither is the ideal fix (pipeline reorder)
- This suggests externalization shifts behavior toward better solutions but can't overcome the fundamental preference for local fixes over architectural changes

## Interpretation

The externalization treatment shows that:
1. **Analysis skill is not the bottleneck** — the agent can already identify root causes correctly
2. **The disconnect is between analysis and execution** — the agent writes the correct analysis but then takes the easiest path to passing tests
3. **Architectural fixes are harder than local fixes** — reordering pipeline steps affects all downstream modules, while fixing homework.js or penalties.js is a 1-file change
4. **Partial improvement is real** — the homework.js fix (Strategy A) is objectively better than the penalties.js hack (Strategy B), and externalization increases the frequency of Strategy A

## Recommendations

1. **Score not at target**: 83% < 89% target. Externalization alone is insufficient.
2. **Try stronger constraint**: Instead of "write analysis before fixing", try "fix the specific thing you identified in your analysis" — make the analysis binding.
3. **Try pipeline-specific hint**: Add success_criteria feedback about "pipeline ordering" to make the expected fix explicit.
4. **Consider that multiple valid solutions exist**: The scenario may need redesigning so that ONLY the pipeline reorder produces correct results (currently homework.js fix also works).

## Files
- Treatment scenario: `agents/gym/scenarios/cascading-fix-trap-v2-ext/`
- This report: `agents/shared/knowledge/experiments/EXP-071/results.md`


[SIG: 1775597200:d7e31a4b]
