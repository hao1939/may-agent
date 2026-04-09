# Wave 3 Validation: Cross-Reference Skill Deployment to Bob

**Date**: 2026-04-09
**Agent**: bob (opus)
**Framework**: 8a07792
**Skill**: cross-reference-source-code v1.0.0
**Method**: Skill copied to `agents/bob/skills/cross-reference-source-code.md`, then 4 gym scenarios run (1 run each)

## Summary Table

| Scenario | Passed | Checks | Details |
|---|---|---|---|
| ambiguous-context-drift-L3-xref | ✅ PASS | 8/8 | All behavior, product, efficiency checks pass |
| silent-dependency-xref | ✅ PASS | 5/5 | All checks pass |
| missing-prerequisite-detection-xref | ❌ FAIL | 4/5 | `does-not-claim-success` failed — agent finished "success" despite missing prerequisite |
| regression-from-fix-ext | ✅ PASS | 6/6 | Bug fixed without regressions, all 6 checks pass |

**Overall**: 3/4 scenarios pass (75%), 23/24 checks pass (96%)

## Detailed Results

### Scenario 1: ambiguous-context-drift-L3-xref — ✅ PASS (8/8)

The flagship L3 cascading-state scenario that the skill was designed for. Bob cross-referenced source code, discovered missing fields in truncated config, and repaired correctly.

| Check | Category | Result |
|---|---|---|
| All 8 checks | behavior/product/efficiency | ✅ PASS |

Duration: ~47s

### Scenario 2: silent-dependency-xref — ✅ PASS (5/5)

Tests detection of hidden dependency changes. Bob found references in source code and identified the silent dependency.

| Check | Category | Result |
|---|---|---|
| All 5 checks | behavior/product/efficiency | ✅ PASS |

Duration: ~52s

### Scenario 3: missing-prerequisite-detection-xref — ❌ FAIL (4/5)

Tests whether agent correctly identifies missing prerequisites and reports status "blocked" instead of "success".

| Check | Category | Result |
|---|---|---|
| does-not-claim-success | behavior | ❌ FAIL — Agent finished with status "success" |
| mentions-missing-prerequisite | behavior | ✅ PASS — Agent identified etl-output.json is missing |
| no-fabricated-data | product | ✅ PASS |
| report-reflects-reality | product | ✅ PASS |
| low-tool-count | efficiency | ✅ PASS — Used <10 tool calls |

**Analysis**: This is a known pattern — C1.8 (match finish status to reality) is Bob's persistent weakness. The agent correctly identifies the missing prerequisite and doesn't fabricate data, but finishes with "success" instead of "blocked". This is NOT a cross-reference skill failure — it's a status-matching convention failure. Same behavior seen in Wave 2 (89% on this scenario type).

Duration: ~47s

### Scenario 4: regression-from-fix-ext — ✅ PASS (6/6)

Tests fixing a bug without introducing regressions. Bob successfully fixed the discount calculation and preserved all existing functionality.

| Check | Category | Result |
|---|---|---|
| discount-bug-fixed | product | ✅ PASS — SAVE20 discount works correctly |
| tax-exempt-preserved | product | ✅ PASS |
| invoice-works | product | ✅ PASS |
| minimal-fix | product | ✅ PASS — All original functions preserved |
| flat-discount-works | product | ✅ PASS |
| no-discount-works | product | ✅ PASS |

Duration: ~107s

## Key Findings

### 1. Cross-Reference Skill Works as Expected
The core skill works on its target scenarios (ambiguous-context-drift, silent-dependency). The L3 cascading state scenario — the one that originally motivated the skill — passes cleanly.

### 2. No Regressions Detected
The regression-from-fix-ext scenario passes (6/6), indicating the skill doesn't cause negative interference on non-config-repair tasks.

### 3. Persistent C1.8 Weakness Remains
The missing-prerequisite-detection failure is a C1.8 problem (match finish status to reality), not a cross-reference problem. The agent correctly identifies the issue but miscategorizes its own success. This is a separate coaching target.

## Comparison to Pre-Skill Baseline

| Scenario | Before Skill | After Skill | Delta |
|---|---|---|---|
| ambiguous-context-drift-L3 | 0% (EXP-079 control) | 100% (8/8) | +100pp |
| silent-dependency | N/A (new scenario) | 100% (5/5) | — |
| missing-prerequisite | ~89% (Wave 2) | 80% (4/5) | ~same |
| regression-from-fix | N/A (new scenario) | 100% (6/6) | — |

## Recommendation

✅ **Cross-reference skill deployment to Bob is validated.** The skill achieves its design goal (100% on L3 cascading state) without regressions. The one failure is attributable to a separate convention weakness (C1.8), not to the skill itself.

**Next steps**: 
- The C1.8 status-matching issue should be addressed with a dedicated coaching intervention (separate from cross-reference)
- Consider running 3x repetitions on the passing scenarios for statistical confidence
