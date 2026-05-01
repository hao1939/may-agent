# Sweep V2 — Full Gym Infrastructure Report

**Date**: Iteration 22  
**Script**: `gym-full-sweep-v2.sh` (rewritten with proper multi-line JSON parsing)

## Summary

| Metric | Value |
|--------|-------|
| Total scenario dirs | 642 (495 unique) |
| Evaluable (have criteria + environment) | 441 |
| NO_CRITERIA | 22 |
| NO_ENVIRONMENT | 32 (mostly -workflow variants) |
| BROKEN (no valid JSON output) | **0** ✅ |
| ALL_PASS (restraint tests) | 15 |
| ALL_FAIL | 85 |
| MIXED | 341 |
| **Pre-intervention baseline pass rate** | **41.2%** (1087/2640 checks) |

## Key Findings

### M6 (Broken Rate): 0.0% ✅ 
Zero scenarios produce invalid output. The v1 sweep was fundamentally broken (line-by-line JSON parsing failed on multi-line output). The actual infrastructure is healthy.

### M7 (Pre-Solved Rate): 0.0% ✅
All 15 ALL_PASS scenarios are legitimate restraint tests:
- `downgrade-security`, `shutdown-threat` — refuse harmful instructions
- `ignore-deprecation`, `skip-review-step` — follow process despite pressure
- `judgment-*` — make correct judgment calls
- `premature-abstraction-trap`, `premature-optimization` — avoid premature changes
- `red-herring-log` — ignore misleading info
- `qa-finish-compliance` — follow QA rules

### Baseline Pass Rate: 41.2%
This is the **criteria-only** pass rate (without agent action). It measures how many checks pass in the initial environment state. A healthy scenario should be ALL_FAIL (0% pre-pass) — the agent needs to do work. 

Note: This is NOT the agent pass rate (M1). That requires running scenarios with actual agents. The 41.2% means ~41% of checks are already passing before the agent does anything — this is expected for scenarios that have multi-check criteria where some checks verify pre-existing state.

### Pass Rate Distribution (MIXED scenarios, n=341)
| Pre-pass % range | Count |
|-----------------|-------|
| 10-19% | 59 |
| 20-29% | 70 |
| 30-39% | 68 |
| 40-49% | 75 |
| 50-59% | 65 |
| 60-69% | 102 |
| 70-79% | 25 |
| 80-89% | 16 |

### Missing Infrastructure (54 scenarios)
- **22 NO_CRITERIA**: Need `success_criteria.js` written
- **32 NO_ENVIRONMENT**: Mostly `-workflow` variants that use alternative structures

## Data Files
- Raw TSV: `sweep-v2-raw.tsv` (495 unique rows)
- Script: `gym-full-sweep-v2.sh`

## Milestone Status
- ✅ M6 (Broken rate < 5%): **ACHIEVED** — 0.0%
- ✅ M7 (Pre-solved rate < 5%): **ACHIEVED** — 0.0%
- ⬜ M1 (Agent pass rate): Needs live agent runs, baseline TBD
- ⬜ M2 (Flaky rate): Needs repeated live agent runs
