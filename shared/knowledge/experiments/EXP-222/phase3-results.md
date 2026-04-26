# EXP-222 Phase 3: Gym Run Results

**Date**: 2026-08-09
**Status**: IN-PROGRESS

## Arm A: Control (All Skills, ~56 skills, ~70K tokens)

### Judgment: conflicting-evidence
| Run | Pass | Checks | Duration | Notes |
|-----|------|--------|----------|-------|
| 1 | FAIL | 1/7 | 111.5s | Missed conflict identification, db-port, env preservation |
| 2 | FAIL | 3/7 | 124.7s | Got fix-summary + identifies-conflict + 1 other, but missed core fixes |
| 3 | FAIL | 2/7 | 125.0s | Missed conflict identification |

**Control pass rate: 0/3 (0%)**

### Debugging: cascading-error
| Run | Pass | Checks | Duration | Notes |
|-----|------|--------|----------|-------|
| 1 | PASS | full | 61.2s | Traced root cause cleanly |
| 2 | PASS | full | 41.9s | Traced root cause cleanly |
| 3 | PASS | full | 95.7s | Traced root cause cleanly |

**Control pass rate: 3/3 (100%)**

### Code Quality: sql-injection-in-query-builder
| Run | Pass | Checks | Duration | Notes |
|-----|------|--------|----------|-------|
| 1 | PASS | full | 31.0s | Fixed null AND SQL injection |
| 2 | PASS | full | 66.0s | Fixed null AND SQL injection |
| 3 | FAIL | partial | 54.5s | Fixed null but missed SQL injection (BLIND FIX) |

**Control pass rate: 2/3 (67%)**

### Control Summary
| Scenario | Pass Rate | Mean Duration |
|----------|-----------|---------------|
| conflicting-evidence (judgment) | 0% (0/3) | 120.4s |
| cascading-error (debugging) | 100% (3/3) | 66.3s |
| sql-injection (code quality) | 67% (2/3) | 50.5s |
| **Overall** | **56% (5/9)** | **79.1s** |

### Control Addendum (runs 4-5, sql-injection only)
| Run | Pass | Checks | Duration | Notes |
|-----|------|--------|----------|-------|
| 4 | PASS | full | 34.6s | Fixed null AND SQL injection |
| 5 | FAIL | 3/4 | 53.4s | Fixed null + SQL injection but weakened tests (9 < 23) |

**Updated sql-injection control: 3/5 (60%)**

## Arm B: Selective Skills (Treatment)
**Method**: Temporarily reduced shared skills from 56 → 7 (coder-edit-discipline, file-safety, verification, tool-discipline, error-handling, README, LIBRARY). Ran via `exp222-selective-run.sh`.

### Code Quality: sql-injection-in-query-builder
| Run | Pass | Checks | Duration | Notes |
|-----|------|--------|----------|-------|
| 1 | PASS | full | 37.9s | Fixed null AND SQL injection |
| 2 | FAIL | 3/4 | 29.2s | BLIND FIX — missed SQL injection |
| 3 | PASS | full | 44.8s | Fixed null AND SQL injection |
| 4 | PASS | full | 25.2s | Fixed null AND SQL injection |
| 5 | PASS | full | 45.2s | Fixed null AND SQL injection |

**Treatment pass rate: 4/5 (80%)**
**Treatment mean duration: 36.5s** (vs control 47.2s)

## Analysis

### sql-injection Results
| Arm | Pass Rate | Mean Duration |
|-----|-----------|---------------|
| Control (all 56 skills) | 3/5 (60%) | 47.2s |
| Treatment (7 skills) | 4/5 (80%) | 36.5s |

**Effect size**: +20pp (60% → 80%)
**Duration reduction**: -22.7% (47.2s → 36.5s)

### Statistical Significance
Fisher's exact test (1-tailed): p = 0.50 for the 3/5 vs 4/5 comparison.
**NOT statistically significant** at N=5 — we can detect only ≥60pp differences at this sample size.

### Interpretation
- Direction is consistent with hypothesis (fewer irrelevant skills → better performance)
- Duration reduction is meaningful (-22.7%) suggesting less context = faster processing
- The treatment group had 0 test-weakening failures (0/5) vs control 1/5 — possibly fewer skills means less "clever" but destructive refactoring
- Need larger N (≥15 per arm pooled across scenarios) to confirm

### Verdict
**PROMISING but INCONCLUSIVE** — +20pp in the right direction with meaningful speed gains, but N=5 is too small for significance. Recommend:
1. Run treatment on 2 more scenario types to pool results
2. If pooled effect ≥20pp across 3 scenarios (N=15), declare validated
3. If pooled effect <10pp, declare null
