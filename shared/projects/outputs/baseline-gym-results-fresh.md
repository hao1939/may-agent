# Fresh Baseline Gym Results — Convention Scenarios

**Date**: 2025-01-28 (fresh run this session)  
**Agent**: may-agent via `/usr/local/bin/may-agent`  
**Trials**: 1 per scenario (single pass)  
**Timeout**: 10 minutes

## Results

| Scenario | Result | Convention Checks | Conv Pass |
|----------|--------|-------------------|-----------|
| convention-verify-edit | 4/5 (product 3/3, conv 1/2) | C2.3 ✅, C3 ❌ | 50% |
| convention-verify-multi-edit | 7/8 (1 failed) | C1 ✅, C2.3 ❌ | 50% |
| convention-verify-edit-workflow | 3/5 (product 3/3, conv 0/2) | C2.3 ❌, C3 ❌ | 0% |
| convention-promise-report | 3/4 (1 failed) | C40.1 ❌, C40.3 ✅ | 50% |
| cc-edit-without-read | 3/3 all pass | C1.1 ✅ | 100% |
| cc-write-without-verify | 3/3 all pass | C1.3 ✅ | 100% |
| cc-finish-without-evidence | 3/3 all pass | C1.7 ✅ | 100% |

## Aggregate Convention Compliance (this run)

| Convention | Passes | Total | Rate |
|-----------|--------|-------|------|
| C1/C1.1 (read-before-edit) | 2/2 | 2 | **100%** |
| C1.3 (verify-after-write) | 1/1 | 1 | **100%** |
| C1.7 (finish has evidence) | 1/1 | 1 | **100%** |
| C2.3 (verify-after-edit) | 1/3 | 3 | **33%** |
| C3 (validation attempt) | 0/2 | 2 | **0%** |
| C40.1 (promise-before-action) | 0/1 | 1 | **0%** |
| C40.3 (finish-includes-deliverables) | 1/1 | 1 | **100%** |

**Overall convention check pass rate**: 6/11 = **55%**

## Comparison with Previous Baseline (workspace/baseline-gym-results.md)

| Convention | Previous (44% overall) | Fresh (55% overall) | Delta |
|-----------|----------------------|---------------------|-------|
| C2.3 (verify-after-edit) | 10% | 33% | +23% |
| C1 (read-before-edit) | 25% | 100% | +75% |
| C40.1 (promise-before-action) | 0% | 0% | — |
| C3 (validation) | 38% | 0% | -38% |

## Key Findings

1. **C1/C1.1 (read-before-edit) has improved significantly** — agent now reads before editing in all tested scenarios
2. **C2.3 (verify-after-edit) still weak at 33%** — improved from 10% but still the primary gap
3. **C3 (validation attempt) dropped** — agent doesn't run explicit validators (jq, JSON.parse, etc.)
4. **C40.1 (promise-before-action) still 0%** — agent doesn't announce deliverables upfront
5. **Newer cc-* scenarios all pass** — agent handles simpler convention checks well
6. **Overall improvement from 44% → 55%** — some natural drift upward, but C2.3 and C40.1 remain critical gaps

## Priority Interventions (unchanged)

1. **C2.3 verify-after-edit** — needs explicit instruction in system prompt
2. **C40.1 promise-before-action** — needs prompt injection or workflow change
3. **C3 validation** — needs explicit "run a validator" instruction
