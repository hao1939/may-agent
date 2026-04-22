# EXP-200: Recognition Scaffold for Relational Bugs

## Hypothesis
A workflow step that forces coder to enumerate all data flow relationships before fixing will close the recognition gap on cascading-fix-trap-v2 (0% → ≥50%).

## Background
- cascading-fix-trap-v2 baseline: 0/89 (0%) — coder never discovers relational bugs
- With ROOT_CAUSE_ANALYSIS.md provided: 15/15 (100%) — coder CAN fix when told
- Gap is recognition, not implementation (KE-054, prove-the-loop case study)
- Text skills failed: 0/26 across two variants (EXP-195, EXP-198)

## Design

### Treatment: "Investigate-First" workflow variant
Create `cascading-fix-trap-v2-investigate` scenario where task.md instructs:
1. Run tests first to see what fails
2. Before fixing anything, trace the data flow: for each failing test, identify which functions touch the data and in what order
3. Write your findings in a scratch note (not graded, just forces enumeration)
4. Then fix

This is lighter than providing the root cause analysis — it forces the agent to DO the recognition work, not skip it.

### Control
Standard cascading-fix-trap-v2 (already have 89 runs at 0%)

### Comparison
- cascading-fix-trap-v2-f1 (25/65 = 38%) — has some lexical hints
- cascading-fix-trap-v2-moderate-hint (9/19 = 47%) — moderate hints

### Sample Size
N=15 per condition (sufficient given 0% baseline — any improvement is signal)

### Success Criteria
- Pass rate ≥ 30% → Promising, iterate
- Pass rate ≥ 50% → Strong signal, promote to skill/workflow
- Pass rate < 10% → Recognition scaffold insufficient, need tool augmentation

## Execution Plan
1. Create scenario variant with investigate-first instructions
2. Run N=15 gym trials
3. Compare to baseline and existing variants
4. Write up results

## Results (2026-04-22)

### Treatment: cascading-fix-trap-v2-investigate (N=15)
- Overall pass: **0/15 (0%)** — same as baseline
- all-tests-pass: **15/15 (100%)** — agent always makes tests pass
- pipeline-order-fixed: **0/15 (0%)** — agent never reorders pipeline
- grade-threshold-fixed: **15/15 (100%)**

### Analysis
The investigate-first instructions successfully get the agent to pass all tests (vs baseline which also passes tests but fails structural checks). However, the agent consistently finds **workaround fixes** that compensate for the wrong pipeline order rather than reordering the pipeline itself.

This is a deeper finding than expected:
1. The agent CAN make all 23 tests pass — the implementation ability is there
2. Even when explicitly told to trace data flow and check step ordering, the agent finds a compensation path
3. The f1 variant (ROOT_CAUSE_ANALYSIS.md with explicit "swap steps 3 and 4") only gets 38% — even being TOLD the fix isn't enough

### Conclusion
**REJECT** investigate-first as an intervention for this scenario. The recognition gap is more precisely a **preference for value-level fixes over structural fixes**. The agent prefers to adjust values to match expectations rather than restructure the pipeline, even when the structural fix is simpler.

### Next Steps
The intervention that works needs to be even more direct than "investigate first" — it needs to specifically block workaround paths. The rootcause variant (100%) provides the analysis AND says "do NOT apply workarounds." The moderate-hint (47%) gives lighter hints.

The actual lever is: **explicitly forbid workarounds + name the structural fix pattern.** This is closer to a hard gate than a soft scaffold.

## Status: COMPLETED — REJECTED
