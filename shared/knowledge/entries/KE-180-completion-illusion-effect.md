# KE-180: Completion Illusion Effect — Analysis Gates Can Harm Performance

**Created**: 2026-04-14
**Source**: EXP-157 (Hard Gate Production Deployment — Test Infrastructure Skepticism)
**Status**: Active
**Confidence**: High (p = 0.004, N = 15, effect size = -80pp)

## Finding

Hard gate artifacts that require **writing analysis documents** (separate from the fix) can HARM performance compared to no gate. When an agent writes about a problem, it treats "I wrote about it" as "I handled it," creating a **completion illusion** that prevents actual remediation.

## Evidence

- **Baseline (no gate)**: 4/5 (80%) — agent naturally identifies and fixes mock masking bug
- **Treatment (TEST_ANALYSIS.md gate)**: 0/10 (0%) — agent writes perfect analysis identifying mock masking, then does NOT fix the mock
- **Fisher's exact**: p = 0.004 (baseline > treatment, one-sided)
- **Gate compliance**: 10/10 wrote TEST_ANALYSIS.md, 10/10 correctly identified mock masking in analysis

## Mechanism

Without gate:
1. Agent reads test file, notices mock while working
2. Has no "analysis artifact" to point to → must actually fix the mock to address it
3. Fixes mock 80% of the time

With analysis gate:
1. Agent writes TEST_ANALYSIS.md identifying mock masking ✅
2. Analysis document satisfies cognitive need to "address" the mock problem
3. Agent moves to fixing validateEmail, considers mock "already handled"
4. Mock never gets fixed ❌

## Design Rule

Hard gate artifacts must be **part of the solution**, not separate analysis documents:

| Gate Type | Example | Effect |
|-----------|---------|--------|
| ✅ Solution gate | "Write FIXED_TESTS.md with corrected test code" | Forces the fix into the artifact |
| ✅ Decision gate | "Write APPROACH.md describing what you will do" | Changes next action |
| ❌ Analysis gate | "Write TEST_ANALYSIS.md describing the problem" | Substitutes for action |

## Relationship to Prior Findings

- **Extends KE-179** (hard gate generalization): Not all hard gates are beneficial. Analysis-only gates are a failure mode.
- **Consistent with KE-129** (forced ext. mechanism): Forced externalization works when it changes what the agent DOES, not just what it KNOWS.
- **Analogous to**: Psychological "announcement effect" — stating intentions reduces follow-through.

## Implications

1. **Do NOT deploy test-trust-guard.ts** as designed
2. If redesigning: require the agent to produce corrected test code, not analysis
3. Guard design should produce actionable output, not diagnostic reports
4. Prior successful gates worked because artifacts WERE the fix (REVIEW.md, APPROACH.md, DELIVERABLES_CHECKLIST.md)
