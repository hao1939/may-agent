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

## Arm B: Selective Skills (Treatment)
**Pending** — need to create lab configs with trimmed skill sets.

## Analysis Notes

- conflicting-evidence is very hard (0% with all skills) — may not show improvement with selective loading since baseline is 0. Consider swapping for an easier judgment scenario.
- cascading-error is too easy (100%) — ceiling effect, can't show improvement. Consider swapping for a harder debugging scenario.
- sql-injection has good variance (67%) — ideal for detecting treatment effects.

### Revised Scenario Selection (if needed)
For better sensitivity, want scenarios in 30-70% pass rate range. May need 2 more runs to confirm, then decide on swaps.
