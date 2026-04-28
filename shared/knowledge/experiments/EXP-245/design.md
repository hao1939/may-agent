# EXP-245: Sequential Auditor Generalization — Judgment Tasks

**Date**: 2026-04-28
**Status**: DESIGNED
**Predecessor**: EXP-242 (Sequential Auditor, p=0.015 on cascading-fix-trap-v2)
**Hypothesis**: H-181 (Relational Bug Blindness) — generalization test

---

## Research Question

Does the sequential auditor pattern (EXP-242) generalize beyond relational/ordering bugs to judgment tasks? Specifically, can a "diagnostic auditor" agent — whose sole job is classifying root causes — help the primary agent on `misleading-test-fix` (0% on behavioral checks)?

## Background

EXP-242 showed: a structural auditor that only checks ordering properties → 44% pipeline-order fix rate vs 0% baseline (N=16+10, p=0.015). The mechanism is task-framing: different task frames allocate attention differently.

`misleading-test-fix` has a parallel structure:
- Agent fixes 2 real code bugs (always succeeds — product checks pass)
- Agent fails to recognize the 3rd failure is a **test bug** (0% on `applyDiscount-not-modified` and `test-assertion-fixed`)
- The agent corrupts `applyDiscount` to match the wrong test assertion instead of fixing the test
- This is an attention/judgment gap, not a coding gap

## Hypothesis

- **H-245a**: A diagnostic auditor agent whose sole job is classifying each test failure as "code bug" vs "test bug" will raise `test-assertion-fixed` + `applyDiscount-not-modified` from 0% to ≥30%.
- **H-245b**: The auditor will correctly classify the discount failure as a test bug at ≥60% rate.
- **H-245-null**: The auditor pattern is specific to relational/ordering bugs and does not generalize to judgment tasks.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Baseline (standard coder) | 5 | Confirm 0% on behavioral checks |
| B   | Sequential Diagnostic Auditor | 10 | Auditor classifies failures → primary uses classification |

### Scenario

`misleading-test-fix` — 0% baseline on behavioral checks (agent corrupts applyDiscount)

### Auditor Agent Design

The diagnostic auditor gets:
- Same codebase and test output
- SOUL focused exclusively on root cause classification:
  ```
  You are a Diagnostic Auditor. Your ONLY job is classifying test failures.
  
  For each failing test:
  1. Read the test assertion and the source code it tests
  2. Manually compute the expected result from the source code
  3. Classify: is the SOURCE CODE wrong, or is the TEST ASSERTION wrong?
  
  Report your classification for each failure. You do NOT fix anything.
  ```

### Arm B Protocol (Sequential)

1. Run primary agent normally (it will fix value bugs, corrupt discount)
2. BEFORE the primary commits: run auditor on the codebase
3. Feed auditor's classification report to the primary agent
4. Primary agent gets a second chance to act on the classification

Wait — this doesn't match the scenario flow. The gym runs a single agent session. We need to simulate the auditor via a context injection (skill/instruction that performs the auditor role inline).

**Revised approach**: Since gym runs single agents, we inject an "auditor step" as a pre-task instruction:

```
BEFORE fixing any test failure, classify each one:
- Run the tests and note all failures
- For EACH failure: read the source code, manually compute the expected value, 
  compare to the test assertion
- Classify each failure as CODE BUG or TEST BUG
- Only then fix: CODE BUGs → fix source, TEST BUGs → fix test assertion
```

This is equivalent to EXP-242's auditor framing but as a self-applied diagnostic step.

### Metrics

- Primary: `test-assertion-fixed` pass rate (0% baseline → target ≥30%)
- Secondary: `applyDiscount-not-modified` pass rate, `discount-mathematically-correct` pass rate
- Tertiary: Overall pass rate (all 8 checks)

### Decision Rule

- H-245a confirmed if: behavioral check pass rate ≥30% with N≥10, p<0.10 vs baseline
- H-245a falsified if: behavioral checks ≤10% at N≥10
- H-245-null supported if: results match baseline (0%)

### Cost

~$1-2 (15 runs × $0.07-0.15)

## Execution

```bash
# Baseline (confirm 0%)
export GYM_AGENT_BIN=/usr/local/bin/may-agent
# Run 5 baseline trials
for i in $(seq 1 5); do
  bun agents/gym/runner.js agents/gym/scenarios/misleading-test-fix --timeout 600 --tag EXP-245-baseline
done

# Treatment (with diagnostic auditor instruction)
# Need to create a variant scenario or inject via task prefix
```

## Notes

- If the inline diagnostic instruction works, it validates that the auditor pattern can be delivered as a skill (cheaper than multi-agent)
- If it fails but EXP-242 worked, it means the mechanism requires a genuinely separate agent (different cognitive frame, not just different instructions)
- This directly tests whether task-framing is the key ingredient vs agent separation
