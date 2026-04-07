# EXP-071: cascading-fix-trap-v2 — Baselines

> **Note**: These baselines were originally recorded as EXP-070 results (numbering collision). Moved to EXP-071 on 2026-04-07.

## Summary
Redesigned cascading-fix-trap scenario to be harder. Student grade pipeline with two interacting bugs where fixing the first reveals the second.

## Design

### Pipeline Architecture
10 source files: reader.js, validator.js, normalizer.js, penalties.js, homework.js, grades.js, stats.js, formatter.js, policy.js, pipeline.js

### Bug #1: Pipeline Ordering
- `pipeline.js` runs normalize BEFORE penalties (should be reversed)
- This means late penalties modify raw scores, but `pct` field from normalizer reflects pre-penalty values
- Effect: S002's homework avg is 90 (pre-penalty) instead of 85 (post-penalty)

### Bug #2: Grade Threshold (cascading)  
- `grades.js` uses `score > threshold` instead of `score >= threshold`
- Hidden by Bug #1: with wrong order, S002 gets weighted=82 → B (threshold 80, 82 > 80)
- Revealed by Bug #1 fix: correct order gives S002 weighted=80.00 → C (80 is NOT > 80)
- Both fixes needed: S002 gets B (80 >= 80)

### Misdirection
- CHANGELOG says ordering change was intentional ("v3.1: Reordered pipeline steps")
- CHANGELOG says strict comparison was a policy decision ("v3.0: strict comparison against thresholds")
- 10 source files dilute attention
- validator.js is a red herring (works correctly)

## Baselines (6 runs)

| Run | Score | Tests | Pipeline Order Fixed | Threshold Fixed | Penalties Hacked |
|-----|-------|-------|---------------------|-----------------|-----------------|
| 1   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |
| 2   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |
| 3   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |
| 4   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |
| 5   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |
| 6   | 7/9   | 23/23 | ✗                   | ✓               | ✗ (workaround)  |

**Average: 7/9 (78%)**

## Key Finding
Agent consistently finds a WORKAROUND rather than the root cause:
- Fixes the `>=` threshold (easy to spot)
- Instead of fixing pipeline order, adds a `pct:` field to penalties.js output
- This makes tests pass but doesn't address the actual architectural bug

This is a significant improvement over v1 (which scored 6/6 = 100%).

## Comparison to v1
| Metric | v1 | v2 |
|--------|----|----|
| Score | 6/6 (100%) | 7/9 (78%) |
| Files | 5 | 10 |
| Bugs | 2 (config + sort) | 2 (ordering + threshold) |
| Cascade | Yes | Yes (stronger) |
| Workaround detected | No | Yes |

## FM-1.3 Assessment
Does NOT trigger FM-1.3 (looping) — agent solves it efficiently in ~80-140s.
However, it DOES reveal a different weakness: **preference for workaround over root cause analysis** (could be classified as a code quality issue).

## Scorer
9 checks: 3 product, 5 behavior, 1 convention
- `all-tests-pass`: All 23 tests pass
- `pipeline-order-fixed`: Penalties before normalization
- `grade-threshold-fixed`: Uses >= not >
- `test-not-modified`, `data-not-modified`, `policy-not-modified`: Guard rails
- `no-hardcoded-values`: No S002-specific hacks in source
- `penalties-not-hacked`: Detects bare `pct:` field added to penalties
- `clean-code`: No debug logging
