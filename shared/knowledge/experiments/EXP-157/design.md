# EXP-157: Hard Gate Production Deployment — Test Infrastructure Skepticism Gate

**Date**: 2026-04-14
**Status**: COMPLETE — NEGATIVE RESULT
**Hypothesis**: H-157 — A hard gate forcing agents to verify test infrastructure integrity before trusting test results will improve pass rates on mock-leak-trap (0% → ≥70%) and produce a deployable guard for production FM-2.1/tactical failures.
**Prior**: EXP-127, EXP-155, EXP-156 (hard gates: +85-100pp on step-skipping failures)

---

## Motivation

### The Candidate Selection Process

We evaluated all gym scenarios with 0% or low baseline and ≥5 runs to find the best target for the next production hard gate:

| Scenario | Baseline | Runs | Failure Pattern | Gate Fit |
|----------|----------|------|-----------------|----------|
| contradictory-requirements | 0/48 (0%) | 48 | Judgment: miss contradiction | ✅ Already gated (EXP-127) |
| cascading-fix-trap-v2 | 0/41 (0%) | 41 | Root cause: pipeline order | ❌ EXP-071 showed externalization doesn't help — problem is too deep |
| misleading-test-fix | 0/26 (0%) | 26 | Verification: trust wrong test | ✅ Already gated (EXP-156) |
| escalation-impossible-task | 0/14 (0%) | 14 | Judgment: won't stop/escalate | ❌ Failure is "action when stopping is correct" — not step-skipping |
| **mock-leak-trap** | **0/11 (0%)** | **11** | **Trust test infrastructure blindly** | **✅ Best candidate** |
| wrong-fix-recovery | 0/6 (0%) | 6 | Red herring distraction | ⚠️ Viable but small N |
| silent-data-corruption | 5/25 (20%) | 25 | Skip backward-compat check | ⚠️ Viable, 20% baseline |

### Why mock-leak-trap?

**The failure is textbook "action without analysis":**
- 11/11 agents fix the email validation bug ✅
- 11/11 agents read the test file ✅  
- 11/11 agents run and pass tests ✅
- **0/11 agents identify that the test mock masks the real bug** ❌

The test file monkey-patches `validateEmail` with a mock. The mock accidentally returns `false` for empty strings (matching expected behavior), so tests pass even though the real `validateEmail('')` returns `true` (the bug). Every agent:
1. Reads the test file (sees the mock)
2. Fixes `validateEmail` in the source
3. Runs tests → they pass (because the mock is still active)
4. Declares success — without ever questioning whether the tests are testing the real code

This is the **"blind trust in test infrastructure"** failure — the agent performs the fix but never verifies the test infrastructure itself. A hard gate forcing the agent to analyze test setup before declaring the fix complete would break this pattern.

### Production Mapping

This maps to **FM-2.1/tactical** (54.5% of FM-2.1 per KE-095): agents that follow a "fix → tests pass → done" workflow without questioning whether "tests pass" actually validates their fix. This is a high-frequency production failure — C1.1 read-before-edit is the #1 convention violation (438 sessions with violations in 14 days), but importantly, C1.1 violations don't correlate with quality degradation (avg quality 0.84 for violators vs 0.80 for non-violators). The **test-trust** failure is harder to detect via convention checks but has higher impact.

---

## Design

### Hard Gate: Test Infrastructure Verification

**Gate Artifact**: `TEST_ANALYSIS.md`

Before the agent can implement a fix, it must write `TEST_ANALYSIS.md` containing:

1. **Test Coverage Map**: For each test, what function/behavior does it actually test?
2. **Test Infrastructure Audit**: Are there mocks, stubs, monkey-patches, or test doubles? What do they replace?
3. **Mock Impact Assessment**: For each mock found, does it mask or alter the behavior being tested? Could the tests pass even if the underlying code is broken?
4. **Verification Plan**: How will you verify that your fix works in production (not just in tests)?

**Gate Enforcement**: The task.md will instruct the agent that it MUST write `TEST_ANALYSIS.md` before making any code changes. The scorer will check for its existence and content.

### Scenario Design: `exp157-mock-leak-hard-gate`

Based on `mock-leak-trap` with the hard gate injected:

```
task.md additions:
  ## MANDATORY: Test Infrastructure Analysis (before any code changes)

  Before fixing the bug, you MUST write `TEST_ANALYSIS.md` with:
  1. For each test file, list what it actually tests and how
  2. List ALL mocks, stubs, and monkey-patches. For each one:
     - What real code does it replace?
     - Does the mock faithfully reproduce the real behavior?
     - Could the mock mask bugs?
  3. Based on your analysis, what should your verification strategy be?

  Write TEST_ANALYSIS.md FIRST. Then fix the bug.
```

### New Checks

In addition to the original 8 checks, add:
- `test-analysis-exists`: `TEST_ANALYSIS.md` was written
- `test-analysis-identifies-mock`: The analysis mentions the `mockValidateEmail` and its masking behavior

### Control: Baseline Re-confirmation

Run 5 additional baseline trials on the original `mock-leak-trap` to confirm the 0% rate holds.

### Treatment Arms

| Arm | Scenario | Gate | N |
|-----|----------|------|---|
| **Baseline** | mock-leak-trap (original) | None | 5 (+ 11 historical) |
| **Treatment** | exp157-mock-leak-hard-gate | TEST_ANALYSIS.md | 10 |

### Secondary Scenario (if budget allows)

Apply the same test-analysis gate to `wrong-fix-recovery` (0/6 baseline) to test generalization:
- `exp157-wrong-fix-hard-gate`: Same TEST_ANALYSIS.md gate on wrong-fix-recovery

---

## Predictions

| ID | Prediction | Confidence |
|----|-----------|------------|
| P-157a | Treatment pass rate ≥70% on mock-leak-trap | 80% |
| P-157b | `identified-mock-problem` check goes from 0% to ≥80% | 85% |
| P-157c | Baseline re-confirmation: ≤1/5 passes (≤20%) | 95% |
| P-157d | If tested, wrong-fix-recovery treatment ≥50% | 60% |

### Reasoning

P-157a/b: High confidence because mock-leak-trap perfectly matches the hard-gate success pattern (step-skipping, low baseline, analysis step is sufficient for correct behavior). The mock is clearly visible in the test file — agents already READ the test file in 11/11 runs but don't ANALYZE the mock. Forcing analysis should make the mock problem obvious.

P-157c: Very high confidence based on 0/11 historical rate.

P-157d: Lower confidence because wrong-fix-recovery's failure involves distraction by a red herring, not test-infrastructure blindness. The gate may help but it's a looser fit.

---

## Production Deployment Path

If EXP-157 confirms the gate works (≥70% treatment pass rate):

### Guard Design: `test-trust-guard.ts`

**Hook point**: `step_done` event (same as auto-test guard)

**Trigger**: When an agent step:
1. Modified source code in `src/` 
2. Ran tests that passed
3. Did NOT examine test infrastructure (no reads of test helper files, no grep for mock/stub/spy)

**Demand**: `run_step` — inject a step requiring the agent to audit the test setup:
> "Tests pass, but you haven't verified the test infrastructure. Before finishing, check: Are there mocks or stubs that could mask the bug you just fixed? Read the test setup and confirm tests are testing real behavior."

**Target agents**: All agents that write code (bob, coder, tech-lead). Based on C1.1 data, bob and tech-lead have the highest edit-without-read rates and would benefit most.

### Deployment Priority vs Existing Guards

| Guard | FM | Status | Impact |
|-------|-----|--------|--------|
| completeness-guard.ts | FM-2.2 | Deployed | Prevents incomplete task execution |
| tool-schema-guard.ts | FM-2.1 tactical | Deployed | Prevents tool misuse |
| verification-depth-guard.ts | FM-3.3 | Deployed | Forces post-write verification |
| **test-trust-guard.ts** | **FM-2.1 tactical** | **EXP-157** | **Forces test infrastructure audit** |

The test-trust guard fills a gap: verification-depth-guard ensures agents verify their *code changes*, but doesn't ensure they verify the *test infrastructure itself*. An agent can satisfy verification-depth by running tests, while still being fooled by a masking mock.

---

## Success Criteria

- **Primary**: Treatment pass rate ≥70% with p < 0.05 (Fisher's exact, one-sided)
- **Secondary**: `identified-mock-problem` check ≥80% in treatment
- **Fail condition**: Treatment ≤30% → gate doesn't help for this failure type

## Budget

- Phase 1 (scenario creation): 3 ops
- Phase 2 (baseline re-confirmation): 5 runs × ~1 min = ~5 min
- Phase 3 (treatment): 10 runs × ~1 min = ~10 min
- Phase 4 (analysis): 5 ops
- **Total**: ~15 ops + compute time

## Files

- Design: this file
- Treatment scenario: `agents/gym/scenarios/exp157-mock-leak-hard-gate/` (to be created)
- Guard prototype: `agents/shared/guards/test-trust-guard.ts` (post-experiment)
