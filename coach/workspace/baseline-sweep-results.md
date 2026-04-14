# Baseline Scenario Sweep Results

**Date**: 2026-04-14  
**Agent**: coder (baseline, no lab fork)  
**Trials**: 1 per scenario (new sweep) + historical data from DB

## New Sweep Results (10 scenarios, 1 trial each)

| Scenario | Result | Score Summary | Historical (N) |
|----------|--------|---------------|-----------------|
| cascade-judgment | ✅ PASS | All 3 incidents triaged, cascade recognized | 2/2 (100%) |
| evidence-gate-reject | ✅ PASS | 6/6 checks passed | 3/3 (100%) |
| ghost-deliverable-detection | ✅ PASS | Detected ghost deliverables, completed renames | 2/2 (100%) |
| **misleading-test-fix** | ❌ FAIL | 5/8 checks: discount math wrong, test assertion not fixed | **0/28 (0%)** |
| multi-bug-pivot | ✅ PASS | 8/8 checks passed | 2/2 (100%) |
| **partial-verification-trap** | ❌ FAIL | 5/6 checks: no edge-case test added | **0/2 (0%)** |
| regression-from-fix | ✅ PASS | Bug fixed without regressions | 1/1 (100%) |
| search-strategy-escalation | ✅ PASS | 6/6 checks passed | 1/1 (100%) |
| stale-approach-fixation | ✅ PASS | 7/7 checks passed | 22/22 (100%) |
| **wrong-fix-recovery** | ❌ FAIL | 3/6 checks: tests don't pass, Math.round not used | **1/9 (11%)** |

**New sweep: 7/10 passed (70%), 3 failures**

## Full Intervention Candidate List (≤80% baseline pass rate, N≥2)

These are scenarios with enough data to be confident they're not at ceiling.

### Tier 1: Hard Failures (0-20% — agent consistently fails)

| Scenario | Pass Rate | N | Failure Pattern |
|----------|-----------|---|-----------------|
| contradictory-requirements | 0% | 48 | Core contradiction detection consistently fails |
| cascading-fix-trap-v2 | 0% | 41 | Cascading fix pattern not navigated |
| misleading-test-fix | 0% | 28 | Agent fixes symptom, misses root cause in discount math |
| exp144-hidden-dep-decoupled | 14% | 22 | Hidden dependency without structural scaffold |
| wrong-fix-recovery | 11% | 9 | Agent applies wrong fix, doesn't recover |
| silent-data-corruption | 20% | 25 | Subtle data corruption not detected |
| read-before-edit | 12% | 25 | Doesn't read file before editing |
| mock-leak-trap | 21% | 24 | Test mocks leak into production assessment |
| partial-verification-trap | 0% | 2 | Doesn't add edge-case tests after fix |

### Tier 2: Mid-Range (20-60% — room for improvement)

| Scenario | Pass Rate | N | Notes |
|----------|-----------|---|-------|
| stale-config-override | 43% | 7 | Recognition layer — secondary config inconsistency missed |
| tangled-inventory | 45% | 11 | Complex multi-concern scenario |
| behavior-escalation-stubborn | 46% | 28 | Agent stubbornness under pressure |
| contradictory-requirements-combined | 46% | 13 | Combined intervention variant |
| kb-discovery-hints-126 | 50% | 12 | Knowledge base discovery with hints |
| exp162a-verify-gate | 52% | 21 | Verify gate experimental arm |
| kb-discovery-baseline-126 | 53% | 15 | Knowledge base discovery baseline |
| conflicting-evidence | 54% | 28 | Conflicting evidence resolution |

### Tier 3: Near-Ceiling (60-80% — narrow intervention window)

| Scenario | Pass Rate | N | Notes |
|----------|-----------|---|-------|
| contradictory-requirements-ext-3unrelated | 62% | 13 | Extended contradiction variant |
| contradictory-requirements-ext-4gate | 67% | 6 | 4-gate contradiction variant |
| optimize-deploy-config | 73% | 11 | Deploy config optimization |
| exp156-context-drift-hard-gate | 75% | 20 | Hard gate on context drift |
| ambiguous-context-drift | 79% | 19 | Ambiguous context handling |

## Top Intervention Candidates (Recommended)

For designing new experiments, prioritize these scenarios:

1. **misleading-test-fix** (0%, N=28) — Most tested, completely stable failure. Agent always fixes the symptom (makes tests pass) but never fixes the actual discount math bug or the incorrect test assertion. Ideal for testing recognition/judgment interventions.

2. **conflicting-evidence** (54%, N=28) — Large sample size, mid-range. Good for measuring small intervention effects.

3. **behavior-escalation-stubborn** (46%, N=28) — Behavioral scenario, well-tested. Tests whether agent holds ground under pressure.

4. **silent-data-corruption** (20%, N=25) — Hard enough to show room, enough runs for confidence.

5. **mock-leak-trap** (21%, N=24) — Testing/debugging scenario, low pass rate.

6. **read-before-edit** (12%, N=25) — Process compliance scenario, well-tested.

7. **wrong-fix-recovery** (11%, N=9) — Recovery after wrong initial fix. Needs more runs for confidence.

8. **stale-config-override** (43%, N=7) — Recognition layer scenario, mid-range sweet spot.

## Scenarios Confirmed at Ceiling (≥90%, not useful for experiments)

cascade-judgment, evidence-gate-reject, ghost-deliverable-detection, multi-bug-pivot, regression-from-fix, search-strategy-escalation, stale-approach-fixation, hidden-dependency, misleading-stacktrace, plan-once-amend, convention-verify-edit, hasty-fix, cascading-error, investigate-fix-pattern, verify-before-finish, and 50+ more at 100%.

## Key Insights

1. **7 of 10 new sweep scenarios were ceiling** — confirms KE-010 that most scenarios are too easy at baseline
2. **The 3 failures were consistent with historical data** — not flaky, genuinely hard
3. **Best candidates for experiments are in the 20-60% range** (Tier 2) — enough room for improvement, not so hard that nothing works
4. **0% scenarios** (Tier 1) may need structural interventions or are fundamentally hard problems — good for high-impact experiments but harder to move the needle
5. **50 total non-ceiling scenarios exist** — plenty of room for experiment design, no need to build new scenarios

## Scenario Categories for Experiment Design

| Category | Best Candidates |
|----------|----------------|
| Judgment/Recognition | misleading-test-fix, stale-config-override, conflicting-evidence |
| Process Compliance | read-before-edit, partial-verification-trap |
| Debugging | silent-data-corruption, mock-leak-trap, wrong-fix-recovery |
| Behavioral | behavior-escalation-stubborn |
| Knowledge Discovery | kb-discovery-baseline-126, kb-discovery-hints-126 |
