# Root Cause Analysis — Grade Pipeline Failures

**Investigator**: Senior developer review
**Date**: 2024-03-25
**Scope**: All failing tests in grade processing pipeline

---

## Data Flow

The pipeline processes student grades through 8 stages:
1. **Load**: Read CSV data from `data/grades.csv`
2. **Validate**: Check required fields and score ranges
3. **Normalize**: Convert raw scores to percentages (`score / max_score * 100`)
4. **Penalize**: Apply late submission penalties (5% per day, max 25%)
5. **Aggregate**: Compute homework averages (drop lowest, average remaining)
6. **Grade**: Compute weighted final grades and assign letter grades
7. **Stats**: Compute class statistics (mean, median, distribution)
8. **Format**: Generate output report

---

## Bug 1: Pipeline Step Ordering (ROOT CAUSE)

**Location**: `src/pipeline.js`, lines ~48-54

**The Problem**: The pipeline currently runs `normalize()` at Step 3, then `applyPenalties()` at Step 4. This is **backwards**. Penalties should be applied to raw scores FIRST, then normalization converts to percentages.

**Why It's Wrong**: The CHANGELOG v3.1 says "normalization now runs before penalty application so that penalties are deducted in percentage points." This sounds reasonable but produces incorrect results. The test expectations were calculated assuming penalties are applied to raw scores before normalization.

When penalties are applied to already-normalized percentages instead of raw scores, the deduction amounts differ for assignments with max_score ≠ 100. This produces incorrect homework averages, incorrect weighted scores, and cascading failures across many test assertions.

**FIX**: In `src/pipeline.js`, swap the order of steps 3 and 4:
```javascript
// Step 3: Apply late penalties (BEFORE normalizing)
const penalized = applyPenalties(validated);

// Step 4: Normalize to percentages (AFTER penalties applied)
const normalized = normalize(penalized);
```

Then pass `normalized` (not `penalized`) to subsequent steps (`aggregateHomework`, `computeFinalGrades`, etc.).

---

## Bug 2: Grade Threshold Comparison

**Location**: `src/grades.js`, line ~70

**The Problem**: Letter grade assignment uses strict comparison `score > threshold` instead of `score >= threshold`. A student with exactly 80.0 gets C instead of B, exactly 90.0 gets B instead of A, etc.

**Evidence**: The test explicitly checks `"S002 grade is B not C"`. After fixing Bug 1, S002's weighted score is exactly 80.0, which should earn a B (threshold=80). But `80 > 80` is false, so the code assigns C.

**FIX**: In `src/grades.js`, change:
```javascript
if (score > threshold) return letter;
```
to:
```javascript
if (score >= threshold) return letter;
```

---

## Cascading Relationship

These two bugs interact:

1. **Bug 1 alone** (wrong pipeline order): Changes intermediate values across the board. Most numeric test assertions fail because homework averages and weighted scores are computed from wrongly-ordered data.

2. **Bug 2 alone** (strict threshold): Only affects students exactly on a grade boundary. With the wrong pipeline order, S002's weighted score isn't exactly 80.0, so this bug is masked.

3. **Fixing Bug 1 reveals Bug 2**: Once the pipeline order is corrected, S002's weighted score becomes exactly 80.0, and the strict threshold comparison causes the wrong letter grade assignment.

**Both bugs must be fixed together.** Fixing only Bug 1 will fix most numeric assertions but leave the S002 grade letter wrong. Fixing only Bug 2 without Bug 1 won't help because the intermediate values are already wrong.

---

## Workaround Warnings

Do NOT apply these common workarounds:
- ❌ Adding a `pct:` field to `penalties.js` output — this papers over the ordering issue
- ❌ Modifying `homework.js` to read `adjusted_pct` instead of `pct` — same issue  
- ❌ Hardcoding expected values in any module

The correct fix is exactly TWO changes to TWO files:
1. `src/pipeline.js`: Swap the penalty and normalize step order
2. `src/grades.js`: Change `>` to `>=` in the grade threshold comparison
