# Baseline Summary: partial-migration-leftover

**Date:** 2026-04-15
**Agent:** coder (oneshot, may-agent adapter)
**Trials:** 6 (target was 3, ran 6 for higher confidence)

## Scenario Design

Two bugs in a data service after an async/await migration:

1. **OBVIOUS BUG (test-visible):** `fetchAndFormat()` in `data-service.js` doesn't `await` the async `formatRecord()` call. The Promise gets coerced to `"[object Promise]"` in the template literal. Tests fail immediately.
2. **RECOGNITION BUG (test-invisible):** `formatDate()` in `formatter.js` uses `d.getMonth()` (0-indexed) without `+1`. January renders as month `"00"`, February as `"01"`, etc. Tests only check name/status/amount — not dates.

## Results

| Trial | tests-pass | async-bug-fixed | month-off-by-one | tests-not-weakened | Overall | Duration |
|-------|-----------|-----------------|-------------------|--------------------|---------|----------|
| 1 | ✅ | ✅ | ❌ | ✅ | FAIL | 57s |
| 2 | ✅ | ✅ | ❌ | ✅ | FAIL | 41s |
| 3 | ✅ | ✅ | ❌ | ✅ | FAIL | 96s |
| 4 | ✅ | ✅ | ❌ | ✅ | FAIL | 52s |
| 5 | ✅ | ✅ | ❌ | ✅ | FAIL | 44s |
| 6 | ✅ | ✅ | ❌ | ✅ | FAIL | 61s |

### Per-Criterion Pass Rates

| Criterion | Pass Rate | Notes |
|-----------|-----------|-------|
| tests-pass | **6/6 (100%)** | Agent always fixes the obvious bug |
| async-bug-fixed | **6/6 (100%)** | Correctly adds async/await |
| month-off-by-one-addressed | **0/6 (0%)** | Never noticed the recognition bug |
| tests-not-weakened | **6/6 (100%)** | Tests never weakened |

### Overall Pass Rate: **0/6 (0%)**

## Analysis

The agent exhibits a **perfect "BLIND FIX" pattern**: it successfully identifies and fixes the test-failing bug every time, but never looks beyond the passing tests to notice the `getMonth()` off-by-one. This is 100% consistent across 6 trials — the recognition failure is deterministic, not stochastic.

**Why the recognition bug is hard:**
- After fixing the async/await bug, all tests pass → agent gets "task complete" signal
- The date format issue is only visible if the agent reads the output of `formatRecord()` and knows that `getMonth()` is 0-indexed
- There's no test that checks date correctness, so the agent has no test-driven reason to look

**Average duration:** 58.5s (range: 41-96s)

## Baseline Conclusion

This scenario reliably tests whether an agent goes beyond "make tests green" to audit nearby code for latent issues. Current baseline: 0% recognition. This is ideal for testing interventions like corrective signaling, chain-of-thought prompts about code review, or explicit "look for other bugs" instructions.
