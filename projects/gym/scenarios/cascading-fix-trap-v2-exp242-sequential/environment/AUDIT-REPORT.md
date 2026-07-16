# Structural Audit Report

## Finding 1: Pipeline Ordering Bug (CRITICAL)

**File**: `src/pipeline.js`  
**Issue**: The `normalize()` function is called BEFORE `applyPenalties()`.

This is incorrect. Late penalties should be applied to raw scores BEFORE normalization.
Current order: normalize → penalize (WRONG)
Correct order: penalize → normalize

The normalization step scales scores to a 0-100 range. If penalties are applied after
normalization, the penalty amounts are wrong because they're being subtracted from
normalized values rather than raw values.

## Finding 2: Threshold Comparison

**File**: Check grade boundary comparisons — look for `>` that should be `>=`.
