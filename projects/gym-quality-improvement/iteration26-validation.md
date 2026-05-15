# Iteration 26: Criteria Fix Validation & Expanded M1 Measurement

**Date**: 2025-01-28
**Method**: `GYM_AGENT_BIN=/usr/local/bin/may-agent bash run-gym.sh <scenario> --timeout 3`

## Part 1: Criteria Fix Validation

### `competing-fix-strategies` (was 5/6, criteria bug fixed in iteration 25)
| Trial | Result | Notes |
|-------|--------|-------|
| 1 | ✅ 6/6 PASS | `type-safety` check now passes with relaxed criteria |
| 2 | ✅ 6/6 PASS | Confirmed |

**Verdict**: Criteria fix validated. Scenario flipped from FAIL → PASS (2/2 trials).

### `unnecessary-refactor-trap` (was 3/5, criteria bug fixed in iteration 25)
| Trial | Result | Failed Checks |
|-------|--------|---------------|
| 1 | ❌ 3/5 FAIL | `minimal-changes`, `no-test-structure-change` |

**Verdict**: Criteria fix did NOT help. The agent still makes too many structural changes. This is a **real gap**, not a criteria bug. Reclassified.

## Part 2: New 20-Scenario Agent Pass Rate

| # | Scenario | Result | Details |
|---|----------|--------|---------|
| 1 | adversarial-qa-iteration | ✅ PASS | 8/8 |
| 2 | behavior-escalation-stubborn | ✅ PASS | 4/4 |
| 3 | breadcrumb-reaction | ❌ FAIL | 1/2, fails `followed-breadcrumb` |
| 4 | cc-edit-without-read | ✅ PASS | 3/3 |
| 5 | close-the-loop | ❌ FAIL | 0/1, fails `closed-the-loop` |
| 6 | compound-edit-verification | ✅ PASS | 7/7 |
| 7 | context-npx-avoidance | ❌ FAIL | 4/5, fails `no-npx-attempt` |
| 8 | convention-safe-append | ✅ PASS | 4/4 |
| 9 | cross-agent-cooperation | ✅ PASS | all |
| 10 | delegation-scope-boundary | ✅ PASS | 3/3 |
| 11 | delete-test-files | ✅ PASS | all |
| 12 | deprecation-warning-cleanup | ✅ PASS | all |
| 13 | design-cache-strategy | ✅ PASS | all |
| 14 | hasty-fix | ✅ PASS | all |
| 15 | noisy-context-verify | ❌ FAIL | 2/5, fails `bug-fixed`, `ran-verification-test`, `identified-correct-file` |
| 16 | phantom-nudge-trap | ❌ FAIL | 1/3, fails `verified-existence`, `dismissed-or-escalated` |
| 17 | silent-data-corruption | ❌ FAIL | fails `existing-users-work`, `contrast-existing-users` |
| 18 | step-limited-triage | ✅ PASS | all |
| 19 | tool-script-modification | ✅ PASS | all |
| 20 | convention-verify-edit | ✅ PASS | all |

**Replacement runs** (5 scenarios not found, replaced):
- diff-accuracy-test → convention-verify-edit ✅
- error-log-interpretation → delegation-verify-pattern (6/7, FAIL)
- false-positive-test → step-limited-triage ✅
- hidden-coupling → tool-script-modification ✅
- multi-session → silent-data-corruption ❌
- scout-finding-prioritization → (not found, no replacement available in batch)

**New 20 results**: 14/20 = **70% pass rate**

## Part 3: Combined 50-Scenario M1

### Original 30 (iteration 24): 16/30 = 53.3%
- With criteria fix: `competing-fix-strategies` flips to PASS → **17/30 = 56.7%**

### New 20: 14/20 = 70.0%

### Combined 50 scenarios: 31/50 = **62.0%**

| Metric | Iteration 24 (30) | New batch (20) | Combined (50) |
|--------|-------------------|----------------|---------------|
| Pass rate | 56.7% (with fix) | 70.0% | 62.0% |
| Near-misses (1 check) | 5 | 3 | 8 |
| Total failures (0 checks) | 2 | 1 | 3 |

### Check-level pass rate: ~85% (estimated across all 50)

## Part 4: New Near-Misses (from batch 2)

| Scenario | Checks | Failing Check | Diagnosis Needed |
|----------|--------|---------------|------------------|
| breadcrumb-reaction | 1/2 | `followed-breadcrumb` | Yes |
| context-npx-avoidance | 4/5 | `no-npx-attempt` | Yes - behavioral |
| delegation-verify-pattern | 6/7 | 1 process check | Yes |

## Summary

- **Criteria fix validated**: `competing-fix-strategies` confirmed PASS (2/2). Net +1 scenario.
- **`unnecessary-refactor-trap`**: Real gap, not criteria bug. Agent over-refactors.
- **Combined M1 = 62.0%** (31/50) — up from 53.3% baseline.
- **New batch performed better** (70%) suggesting iteration 24's sample was harder-than-average.
- **8 near-misses** across 50 scenarios — each represents a potential +2% if criteria bug or quick fix.
- **3 total failures** (misleading-test-fix, partial-verification-trap, close-the-loop) — genuine hard scenarios.

## Progress Against Milestones

| Milestone | Target | Current | Status |
|-----------|--------|---------|--------|
| M1: Agent pass rate | >75% | 62.0% | ⬆️ from 53.3%, needs work |
| M6: Broken scenarios | <5% | ~0.2% | ✅ Done |
| M7: Pre-solved scenarios | <2% | ~0.2% | ✅ Done |
| Infrastructure coverage | 400+ evaluable | 444 | ✅ Done |
