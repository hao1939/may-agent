# Diagnostic Report: EXP-157 Completion Illusion & Next Steps

**Date**: 2026-04-14
**Author**: Coach
**Trigger**: EXP-157 COMPLETE — NEGATIVE RESULT (p = 0.004)

---

## 1. Error Pattern Diagnosis

### What happened in EXP-157

EXP-157 tested a hard externalization gate on the mock-leak-trap scenario. The gate required agents to write `TEST_ANALYSIS.md` documenting any test infrastructure issues before fixing the bug.

**Result**: Treatment 0/10 (0%) vs baseline 4/5 (80%) — the gate **caused a -80pp regression** (Fisher's exact p = 0.004).

### Error Pattern: Completion Illusion (KE-180)

**Classification**: This is NOT a standard agent failure mode (FM-*). It is a **method-induced failure** — the coaching intervention itself created the problem.

**Mechanism**:
1. Agent reads test file, correctly identifies mock masking the real bug ✅
2. Agent writes `TEST_ANALYSIS.md` with perfect analysis ✅  
3. **Writing the analysis satisfies the cognitive "I handled it" signal** ❌
4. Agent moves to fixing `validateEmail`, considers mock "already addressed"
5. Mock never gets fixed — 0/10 treatment runs fixed the mock

**Without the gate**: Agent notices mock while working, has no analysis document to point to as "evidence of addressing it," so actually fixes it (4/5 = 80%).

**Root cause**: The gate artifact (TEST_ANALYSIS.md) was a **standalone analysis document** — it described the problem without producing the fix. Prior successful gates (EXP-127 ANALYSIS.md, EXP-155 FINDINGS.md, EXP-156 DIAGNOSIS.md) all produced artifacts that **were** the analytical step, directly changing the agent's subsequent action.

### Pattern Taxonomy

| Aspect | Classification |
|--------|---------------|
| Error type | Method-induced regression (not agent failure) |
| Mechanism | Completion illusion — writing substitutes for acting |
| Analogues | Psychological "announcement effect" — stating intentions reduces follow-through |
| Severity | Critical — -80pp, worse than doing nothing |
| Scope | Applies to any analysis-only gate artifact |

---

## 2. Differential Diagnosis: Why Prior Hard Gates Worked But This One Failed

| Experiment | Artifact | What Writing Forces | Outcome |
|-----------|----------|-------------------|---------|
| EXP-127 | ANALYSIS.md (contradictory-req) | Agent must identify contradiction + propose alternatives → can't propose alternatives without recognizing contradiction | +100pp ✅ |
| EXP-155 | FINDINGS.md (hidden-dep) | Agent must list bugs with file:line evidence → Phase 2 reads and fixes listed bugs | +85pp ✅ |
| EXP-156 | DIAGNOSIS.md (misleading-test) | Agent must hand-calculate expected values → discovers test is wrong DURING writing | +100pp ✅ |
| EXP-RECOGNITION | REVIEW.md | Agent lists inconsistencies → Phase 2 explicitly fixes everything listed | +90pp ✅ |
| **EXP-157** | **TEST_ANALYSIS.md** (mock-leak) | Agent describes mock masking → **no Phase 2 references it, no fix is embedded** | **-80pp ❌** |

**The design test** (from KE-182): "Does writing this artifact PRODUCE the fix, or merely DESCRIBE the problem?"
- EXP-127/155/156/RECOGNITION: Writing IS the thinking step; fix follows naturally → PRODUCE
- EXP-157: Writing describes what's wrong; fix is a separate unstated action → DESCRIBE

---

## 3. Method Selection

### Rejected Methods

| Method | Why Rejected |
|--------|-------------|
| #1 SOUL Guard | 0/13 text methods improved behavior; would just add noise |
| #3 LESSONS | Same text-level authority problem |
| #12 Subtractive Fix | Nothing to remove — problem is gate DESIGN, not agent text |
| #13 Micro-Edit | Agent already performs well (80%) without intervention; text won't help |
| #14 Task Structuring | Partial (33%) — insufficient for production deployment |

### Selected Method: #15 Workflow Enforcement (2-Phase Investigate→Fix)

**Rationale**: The completion illusion occurs because writing an analysis document in the same session as the fix creates a false sense of completion. Method #15's two-phase mechanical separation prevents this:

- **Phase 1**: Investigate test infrastructure. Write `FIXED_TESTS.md` containing corrected test code (not analysis — the fix itself).
- **Phase 2**: Read `FIXED_TESTS.md`. Apply the corrected test code. Fix the underlying bug.

This follows KE-182 Rule 1 (artifact is part of the solution) and Rule 4 (2-phase investigate→fix).

### Why This Addresses the Root Cause

The completion illusion has a specific failure chain:
1. Agent writes analysis → "I handled it" signal → doesn't act

The Method #15 fix breaks this chain at two points:
- **Point A**: The artifact is `FIXED_TESTS.md` (solution), not `TEST_ANALYSIS.md` (description). Writing the corrected tests IS the fix — there's nothing left to "handle later."
- **Point B**: Phase 2 is a separate session that explicitly reads the artifact as a TODO. Even if Phase 1 induced some completion feeling, Phase 2 starts fresh with a concrete action list.

### Alternative: Redesigned Gate (No Workflow)

If workflow overhead is a concern, an alternative is redesigning the gate artifact:
- **Current (failed)**: "Write TEST_ANALYSIS.md describing test issues"
- **Redesigned**: "Write FIXED_TESTS.md containing corrected test code (mock removed, real assertions added)"

This eliminates the completion illusion by making the artifact actionable — the agent must produce the corrected code, not just describe the problem. However, this is lower-confidence than Method #15 because it relies on the agent copying from its own artifact back into the codebase (single-session, still susceptible to distraction).

---

## 4. Experimental Design: EXP-158 (Proposed)

### Goal
Test whether a solution-producing gate (FIXED_TESTS.md) eliminates the completion illusion, either alone or with 2-phase workflow enforcement.

### Design

**Scenario**: `mock-leak-trap` (same as EXP-157, baseline now 80%)

**Arms**:
| Arm | Configuration | N | Purpose |
|-----|--------------|---|---------|
| A | Baseline (no gate) | 5 | Confirm baseline still ~80% |
| B | Solution gate: "Write FIXED_TESTS.md with corrected test code" | 10 | Test Rule 1 (artifact = solution) |
| C | 2-phase: Phase 1 write FIXED_TESTS.md → Phase 2 apply and fix bug | 10 | Test Rule 1 + Rule 4 (2-phase) |

### Predictions

| ID | Prediction | Confidence |
|----|-----------|------------|
| P-158a | Arm B ≥ 60% (solution gate alone beats EXP-157's 0%) | 75% |
| P-158b | Arm C ≥ 80% (2-phase matches or beats baseline) | 85% |
| P-158c | Arm C > Arm B by ≥ 20pp | 60% |

### Success Criteria
- H-158 confirmed if Arm B or C ≥ 70% (demonstrating completion illusion is eliminated)
- If Arm B ≈ Arm C, the simpler solution gate is sufficient (no workflow needed)
- If Arm B < 40% but Arm C ≥ 70%, 2-phase is necessary to overcome residual illusion

### Minimum Viable Result
Even if this experiment shows the redesigned gate merely MATCHES baseline (80%), that's still a +80pp improvement over EXP-157's analysis gate (0%). It proves the KE-182 design rules are correct.

---

## 5. Broader Implications

### For Production Gate Deployment

The DESIGN-ch2-production-gates.md document is ON HOLD after EXP-163 showed process-vs-product confound. EXP-157 adds a second hold reason: **analysis-only gates are harmful**. Any production deployment must:

1. Use solution-producing artifacts (Rule 1)
2. Use 2-phase investigate→fix structure (Rule 4)
3. Measure product quality independently of process compliance (Rule 6)
4. Only target low-baseline tasks (Rule 2)

### For the Method Catalog

Method #15 (Workflow Enforcement) should be updated with a caveat:
- The two-phase pattern is confirmed effective across 5+ scenarios
- BUT the Phase 1 artifact must be **actionable** (solution, checklist, corrected code), not **descriptive** (analysis, report, assessment)
- The failed EXP-157 was technically a 1-phase gate, not a 2-phase workflow — but the artifact-type lesson applies to both

### For the KE-182 Decision Tree

The decision tree's Step 3 ("Can the gate artifact BE the analytical step?") should be strengthened:
- Current: "If NO → Redesign"
- Proposed: "If NO → **STOP. Do not deploy.** Analysis-only gates cause -80pp regression. Redesign artifact to produce the solution itself."

---

## 6. Priority Assessment

| Priority | Action |
|----------|--------|
| **P0** | Do NOT deploy test-trust-guard.ts (EXP-157 design) |
| **P1** | Design EXP-158 to validate KE-182 design rules experimentally |
| **P2** | Update method catalog with completion illusion caveat |
| **P2** | Update DESIGN-ch2-production-gates.md with EXP-157 lesson |

---

## Summary

**Error pattern**: Completion illusion — analysis-only gate artifacts cause -80pp regression by substituting writing-about-the-problem for fixing-it.

**Selected method**: #15 Workflow Enforcement with solution-producing artifacts (FIXED_TESTS.md, not TEST_ANALYSIS.md), structured as 2-phase investigate→fix.

**Next experiment**: EXP-158 — test solution gate vs analysis gate vs 2-phase on mock-leak-trap to validate the KE-182 design rules experimentally.
