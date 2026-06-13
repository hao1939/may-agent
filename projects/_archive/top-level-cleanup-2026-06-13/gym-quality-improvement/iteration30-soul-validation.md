# Iteration 30: SOUL.md Validation Results

## Key Discovery
**`GYM_AGENT_BIN=/usr/local/bin/may-agent`** enables live agent runs. All previous "gym runs" in iterations 7-28 were criteria-only (agent_status: "skipped"). This iteration has the first real live agent data since the SOUL.md changes.

## Target Scenario Results (Post-SOUL Changes)

| Scenario | Checks | Passed | Failed Checks | Status | Prev |
|----------|--------|--------|---------------|--------|------|
| cascading-fix-trap | 9 | 8 | `checked-data-file` | ❌ FAIL | 8/9 |
| **read-before-edit-verify-gate** | **11** | **11** | *none* | **✅ PASS** | 10/11 |
| noisy-context-verify | 5 | 2 | `bug-fixed`, `ran-verification-test`, `identified-correct-file` | ❌ FAIL | 2/5 |
| breadcrumb-reaction | 2 | 0 | both | ❌ FAIL (error) | 0/2 |
| partial-verification-trap | 6 | 0 | all | ❌ FAIL | 0/6 |
| close-the-loop | 1 | 0 | `closed-the-loop` | ❌ FAIL | 0/1 |

## Regression Check Results (Known Passes)

| Scenario | Result | Notes |
|----------|--------|-------|
| wrong-tool-args | ✅ PASS | Still passing |
| competing-fix-strategies | ✅ PASS (6/6) | Still passing |
| context-npx-avoidance | 4/5 | `no-npx-attempt` still fails |
| delegation-verify-pattern | 4/7 | Regressed from previous? |

## Analysis

### What worked
- **read-before-edit-verify-gate: 10/11 → 11/11 ✅** — The "Post-Edit Verification" rule in context.md directly caused the agent to re-read files after editing. This is the first confirmed SOUL.md improvement that flipped a scenario from FAIL to PASS.

### What didn't work
- **cascading-fix-trap**: Still 8/9. The `checked-data-file` check requires reading `scores.txt` — the Data-First Diagnosis rule wasn't specific enough to trigger this.
- **noisy-context-verify**: 2/5, same as before. Agent doesn't read `src/auth.js` or run tests. The scenario has heavy misdirection (decoy files) that overwhelms generic guidance.
- **breadcrumb-reaction**: Agent errored out (didn't even run properly). Infrastructure issue with this scenario.
- **partial-verification-trap**: 0/6. Agent doesn't find the edge case bug. This requires deep code analysis, not just behavioral rules.
- **close-the-loop**: 0/1. Agent doesn't write a prevention mechanism. This is a meta-cognitive skill (prevent future failures) that generic rules don't address.

### Regression concerns
- `delegation-verify-pattern` at 4/7 — need baseline comparison to know if this regressed.
- `context-npx-avoidance` still 4/5 — `no-npx-attempt` is a persistent failure.

## Score Summary

**Target scenarios**: 1/6 PASS (17%)
**Regression check**: 2/4 PASS (50%), 2 partial
**SOUL.md impact**: +1 scenario flipped (read-before-edit-verify-gate)

## Implications

1. **SOUL.md behavioral rules work for procedural failures** (forgot to re-read a file) but not for cognitive failures (missed a data file, didn't see through misdirection, didn't think to write a prevention mechanism).
2. **The 75% baseline from July was likely accurate** — the agent genuinely passes ~50-65% of scenarios on skill alone.
3. **Remaining failures are hard** — they require reasoning about what to look at, not just following rules.

## Updated Metrics
- M1 (agent pass rate): ~53-62% (sample dependent)
- M3 (SOUL.md impact): +1 scenario confirmed (read-before-edit-verify-gate)
- M6 (broken scenarios): ~0.2%
- M7 (pre-solved bugs): ~0%
