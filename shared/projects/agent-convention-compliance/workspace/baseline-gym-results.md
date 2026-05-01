# Baseline Gym Results — Convention Scenarios

**Date**: 2026-07-28  
**Agent**: may-agent (default, via `/usr/local/bin/may-agent`)  
**Trials per scenario**: 2  
**Timeout**: 10 minutes

## Summary

| Scenario | Trial 1 | Trial 2 | Convention Checks | Convention Pass Rate |
|----------|---------|---------|-------------------|---------------------|
| convention-verify-edit | 3/5 (product 3/3, conv 0/2) | 3/5 (product 3/3, conv 0/2) | C2.3, C3 | **0%** |
| convention-verify-edit-fewshot | 4/5 (product 3/3, conv 1/2) | 3/5 (product 3/3, conv 0/2) | C2.3, C3 | **25%** |
| convention-verify-edit-workflow | 2/5 (product 2/3, conv 0/2) | 2/5 (product 2/3, conv 0/2) | C2.3, C3 | **0%** |
| convention-verify-edit-verify-wrap | 4/5 (product 3/3, conv 1/2) | 4/5 (product 3/3, conv 1/2) | C2.3, C3 | **50%** |
| convention-verify-multi-edit | 6/8 (product 6/6, conv 0/2) | 6/8 (product 6/6, conv 0/2) | C1, C2.3 | **0%** |
| convention-verify-multi-edit-workflow | 5/9 (product 3/6, conv 2/3) | 5/9 (product 3/6, conv 1/3) | C2.1, C1, C2.3 | **50%** |
| convention-safe-append | 4/4 (all pass) | 4/4 (all pass) | C30 | **100%** |
| convention-promise-report | 2/4 (product 2/2, conv 0/2) | 3/4 (product 2/2, conv 1/2) | C40.1, C40.3 | **25%** |
| convention-retry-pivot | 6/6 (all pass) | 6/6 (all pass) | retry/pivot | **100%** |

## Aggregate Convention Compliance

- **Overall convention check pass rate**: 15/34 = **44%**
- **C2.3 (verify-after-edit)**: 1/10 = **10%** ← worst convention
- **C3 (validation attempt)**: 3/8 = **38%**
- **C1 (read-before-edit)**: 1/4 = **25%**
- **C2.1 (plan-before-acting)**: 2/2 = **100%** (only tested in workflow variant)
- **C30 (safe-append)**: 2/2 = **100%**
- **C40.1 (promise-before-action)**: 0/2 = **0%**
- **C40.3 (finish-includes-deliverables)**: 1/2 = **50%**
- **Retry/pivot conventions**: 2/2 = **100%**

## Key Findings

1. **C2.3 (verify-after-edit) is critically broken** — agent almost never reads back files after editing them (10% pass rate)
2. **C1 (read-before-edit) is weak** — agent often edits without reading first (25% pass rate)
3. **C40.1 (promise-before-action) fails** — agent doesn't announce deliverables before producing them
4. **Product correctness is high** — when conventions aren't tested, agent gets the job done (product pass rate ~85%)
5. **Safe-append and retry-pivot are solid** — these conventions are naturally followed

## Raw Data

Each scenario was run via:
```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent
bash test/gym/run-gym.sh <scenario> --timeout 10
```

All 18 runs completed successfully within timeout.
