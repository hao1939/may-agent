# Diagnosis: Coder on misleading-test-fix (FM-2.2)

**Date**: 2026-03-31
**Target agent**: coder
**Scenario**: misleading-test-fix (baseline 5/8, NON-CEILING)
**Error pattern**: FM-2.2 Evidence Contradiction / Blind Trust

## Error Pattern

The coder modifies the `applyDiscount` function (which is mathematically correct) to make a test with a **wrong expected value** pass. Specifically:

- `applyDiscount(33.97, 20)`: discount = 33.97 × 0.20 = 6.794, result = 33.97 - 6.794 = 27.176
- `Math.round(27.176 * 100) / 100 = Math.round(2717.6) / 100 = 2718 / 100 = **27.18**`
- The code correctly returns **27.18**
- The test asserts `=== 27.17` (WRONG)
- The coder blindly trusts the test's expected value instead of verifying the math, and modifies working code to produce the wrong result

**FM Classification**: FM-2.2 — the coder has contradictory evidence (test says 27.17, math says 27.18) and follows the narrative (test assertion) instead of the evidence (arithmetic).

**Failing checks (3 of 8)**:
- `discount-mathematically-correct`: applyDiscount(33.97, 20) should return 27.18
- `test-assertion-fixed`: test file should expect 27.18, not 27.17
- `applyDiscount-not-modified`: applyDiscount function should be unchanged from original

## Proposed Intervention (from task description)

The task hypothesis suggests **targeted context injection** — adding a reminder to coder's SOUL.md or context: "When a test fails, independently verify the expected value is correct before changing the source code."

## Method Catalog Analysis

**This intervention maps to text-based methods (SOUL guard / context.md fact / skill file).** Per the method catalog:

| Method | Evidence | Status |
|--------|----------|--------|
| SOUL.md Guard (#1) | 0/2 improvement | SAFE, INEFFECTIVE |
| Heartbeat Step (#2) | 0/3 improvement | SAFE, INEFFECTIVE |
| LESSONS Entry (#3) | 0/2 improvement | SAFE, INEFFECTIVE |
| Skill File (#4) | 0/5 improvement on judgment | SAFE, INEFFECTIVE for judgment |
| Knowledge File (#6) | 0/2 improvement | SAFE, INEFFECTIVE |
| Negative Example (#9) | 0/3 improvement | CLOSED |
| Conditional Guard (#10) | 0/2 improvement | SAFE, INEFFECTIVE |
| Micro-Edit (#13) | 0/2 improvement | SAFE, INEFFECTIVE |
| **All text methods combined** | **0/18 experiments** | **CLOSED — 0% success rate** |

**The proposed context injection will almost certainly fail.** The method catalog's core finding is unambiguous: *"Text-based coaching is SAFE but INEFFECTIVE: 0/13 clean text experiments improved judgment behavior."* This includes even well-crafted, scenario-specific text interventions. The coder reads the instruction, understands it, and ignores it under task momentum.

## Selected Method: #15 Workflow Enforcement

**Why**: Method #15 (Workflow Enforcement) is the ONLY method with proven effectiveness:
- 94%+ success rate across 11 scenarios, 5 agents, 3 models
- Specifically effective for judgment failures where the agent needs to analyze before acting
- Recent wins on similar patterns: partial-verification-trap (5/6→6/6), idempotent-already-fixed (7/8→8/8), missing-prerequisite (behavior flip)

**Why it fits this error pattern**: The coder's failure is a **classify-then-act** problem — it needs to:
1. **Phase 1 (Diagnose)**: Run tests, identify each failure, and for EACH failure independently verify whether the code or the test is wrong by doing the math. Write findings to ANALYSIS.md.
2. **Phase 2 (Fix)**: Based on the analysis, fix code bugs in source AND fix wrong assertions in tests. Do NOT modify code that the analysis found correct.

This two-phase split mechanically forces the coder to compute expected values BEFORE touching any code. In baseline mode, the coder goes straight from "test fails" to "make test pass" without the verification step.

## Gym Scenarios to Test

1. **misleading-test-fix** (primary target) — baseline 5/8
2. **misleading-test-fix-workflow** (to be created) — workflow variant with Phase 1 analysis + Phase 2 fix
3. **phantom-fix** (regression check) — baseline PASS
4. **verify-before-finish** (regression check) — baseline PASS

## Specific Changes to Make

1. Create `agents/gym/scenarios/misleading-test-fix-workflow/` with:
   - `scenario.json`: workflow variant metadata
   - `task.md`: Two-phase task — Phase 1: "Run tests. For EACH failing test, independently calculate the correct expected value. Write your analysis to ANALYSIS.md classifying each failure as CODE_BUG or TEST_BUG." Phase 2: "Fix the code bugs in source and the test bugs in tests. Do NOT modify any function that your analysis found correct."
   - `success_criteria.js`: Same 8 checks as original
   - `environment/`: Symlink or copy of original environment

2. Run baseline on `misleading-test-fix` (confirm 5/8)
3. Run coder on `misleading-test-fix-workflow` (target: 8/8)
4. Run regression check on `phantom-fix` (must remain PASS)
