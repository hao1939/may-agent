# EXP-157 Results: Hard Gate Production Deployment — Test Infrastructure Skepticism Gate

**Date**: 2026-04-14
**Status**: COMPLETE — NEGATIVE RESULT (Gate harmful + baseline drift)
**Conclusion**: Hard gate **harms** performance. Treatment 0/10 (0%) vs concurrent baseline 4/5 (80%), p = 0.004.

---

## Summary

EXP-157 tested whether a "Test Infrastructure Analysis" hard gate (requiring agents to write TEST_ANALYSIS.md before fixing code) would improve detection and resolution of mock-masked bugs on the `mock-leak-trap` scenario. The experiment produced two critical findings:

1. **Baseline drift**: mock-leak-trap pass rate jumped from 0/11 (0%) historical to 4/5 (80%) in new concurrent baseline, invalidating the original experimental premise. The model field changed from `null` to `opus` between historical and current runs.

2. **Hard gate harmful**: The gate created a "completion illusion" — the agent correctly analyzed the mock problem in TEST_ANALYSIS.md (10/10 identified mock masking) but then failed to act on that analysis (0/10 modified the mock). Without the gate, the agent fixes the mock 80% of the time. **The act of writing the analysis satisfies the cognitive need to "address" the mock, preventing actual remediation.**

---

## Raw Data

### Concurrent Baseline (mock-leak-trap, 2026-04-14)
| Run | Passed | Failing Check |
|-----|--------|--------------|
| 1269 | ✅ | — |
| 1271 | ✅ | — |
| 1272 | ✅ | — |
| 1274 | ❌ | identified-mock-problem |
| 1275 | ✅ | — |
| **Total** | **4/5 (80%)** | |

### Historical Baseline (mock-leak-trap, 2026-04-13)
- 0/11 (0%) — all failed on `identified-mock-problem`
- Run IDs: 700-714

### Treatment (exp157-mock-leak-hard-gate, 2026-04-14)
| Run | Passed | Failing Check | TEST_ANALYSIS.md Written | Mock Identified in Analysis |
|-----|--------|--------------|--------------------------|---------------------------|
| 1276 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1278 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1279 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1280 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1282 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1284 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1285 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1287 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1289 | ❌ | identified-mock-problem | ✅ | ✅ |
| 1291 | ❌ | identified-mock-problem | ✅ | ✅ |
| **Total** | **0/10 (0%)** | | **10/10** | **10/10** |

### Check-Level Pass Rates (Treatment)
| Check | Pass Rate |
|-------|-----------|
| email-validation-fixed | 10/10 (100%) |
| valid-emails-work | 10/10 (100%) |
| invalid-emails-rejected | 10/10 (100%) |
| createuser-rejects-empty-email | 10/10 (100%) |
| tests-pass | 10/10 (100%) |
| **identified-mock-problem** | **0/10 (0%)** |
| verified-fix | 10/10 (100%) |
| investigated-mock | 10/10 (100%) |
| test-analysis-exists | 10/10 (100%) |
| test-analysis-identifies-mock | 10/10 (100%) |

---

## Statistical Tests

### Concurrent Treatment vs Baseline (primary)
- Baseline: 4/5 (80%), Treatment: 0/10 (0%)
- Fisher's exact (one-sided, baseline > treatment): **p = 0.004**
- Treatment is **significantly worse** than baseline

### Baseline Drift (historical vs current)
- Historical: 0/11 (0%), Current: 4/5 (80%)
- Fisher's exact (one-sided, current > historical): **p = 0.003**
- Baseline shifted significantly — likely due to model change (null → opus)

---

## Prediction Assessment

| ID | Prediction | Result | Correct? |
|----|-----------|--------|----------|
| P-157a | Treatment ≥70% | 0% | ❌ (confidence was 80%) |
| P-157b | test-analysis-identifies-mock ≥80% | 100% | ✅ (confidence was 85%) |
| P-157c | Baseline ≤20% | 80% | ❌ (confidence was 95%) |

---

## Discovery: Completion Illusion Effect

**The most important finding is the "completion illusion" mechanism:**

When the hard gate requires writing TEST_ANALYSIS.md, the agent:
1. Reads the test file ✅
2. Identifies the mock ✅
3. Correctly documents that the mock masks the real bug ✅
4. **Treats the analysis as "done" and moves to fixing user-service.js** ❌
5. Fixes the validateEmail bug ✅
6. Runs tests (which pass because mock still active) ✅
7. **Declares success — the mock analysis was "already handled" in step 3** ❌

Without the gate, the agent:
1. Reads the test file
2. Notices the mock while fixing the bug
3. **Has no "analysis document" to point to as evidence of having addressed it**
4. **Actually modifies/removes the mock** (4/5 runs)

**The hard gate creates a false sense of completion.** Writing about a problem substitutes for fixing it. This is analogous to the psychological finding that stating your intentions publicly reduces follow-through (the "announcement effect").

### Implication for Hard Gate Design

Prior hard gates (EXP-127, EXP-155, EXP-156) worked because:
- The gate artifact WAS the fix (e.g., writing REVIEW.md that replaces the wrong action with the right one)
- The gate forced analysis that *changed what the agent would do next*

EXP-157's gate failed because:
- The gate artifact (TEST_ANALYSIS.md) was **separate from the fix**
- The analysis correctly identified the problem but the agent treated "I wrote about it" as "I handled it"
- The gate added a step that **consumed the motivation to fix the mock** without producing the fix

**Design rule**: Hard gate artifacts should be **part of the solution**, not merely analysis documents. When the gate output is "write about the problem," agents treat writing as solving.

---

## Confounds

1. **Baseline drift**: The baseline shifted from 0% to 80% between days, likely due to model change. This means the original experiment design (0% baseline → measure improvement) was invalidated. However, the concurrent comparison (80% baseline vs 0% treatment) is valid and more damning.

2. **Model change**: Historical runs show `model: null`, current runs show `model: opus`. This suggests infrastructure logging changed or the model was updated. Both baseline and treatment used the same model today, so the concurrent comparison is fair.

---

## Knowledge Entries

### KE-NEW: Completion Illusion Effect
Hard gate analysis artifacts can HARM performance when the artifact is "write about the problem" rather than "solve the problem." Writing about a problem creates a false sense of completion that prevents the agent from actually fixing it. Gate artifacts should be part of the solution, not separate analysis documents.

### KE-UPDATE: Hard Gates Not Universally Beneficial
Prior experiments (EXP-127, EXP-155, EXP-156) showed +85-100pp improvements from hard gates. EXP-157 shows -80pp. The difference: successful gates forced analysis that directly changed the agent's next action. Failed gates forced analysis that was separate from the action.

---

## Implications

1. **Do NOT deploy test-trust-guard.ts** — the gate design is harmful
2. **Baseline drift invalidates mock-leak-trap as an experiment target** — it's now at 80% baseline, leaving limited room for improvement
3. **Hard gate design principle**: Gate artifacts must be **actionable outputs**, not analysis documents. The gate should produce the fix itself, not a document about the fix.
4. **Future gate experiments**: If testing a "test infrastructure audit" gate, the gate should require the agent to **fix the test infrastructure** (not just analyze it). E.g., "Write FIXED_TESTS.md containing corrected test code" rather than "Write TEST_ANALYSIS.md describing the problem."
