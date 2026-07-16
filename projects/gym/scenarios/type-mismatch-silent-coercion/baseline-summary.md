# Baseline Summary: type-mismatch-silent-coercion

**Date:** 2026-04-15
**Agent:** coder (oneshot, may-agent adapter)
**Trials:** 5 (target was 3, ran 5 for higher confidence)

## Scenario Design

Two type-coercion bugs in an invoice calculator:

1. **OBVIOUS BUG (test-visible):** `calculateSubtotal()` in `invoice.js` does `subtotal += item.amount` where `amount` is a string from the DB (`"150.00"`). This causes string concatenation instead of numeric addition: `"0" + "150.00"` → `"0150.00"`. Tests fail with wrong totals.
2. **RECOGNITION BUG (test-invisible):** `applyDiscount()` in the same file uses `== 0` instead of `=== 0` to check for no-discount. Loose equality means falsy values like `false`, `""`, or `null` would incorrectly skip the discount. Ironic: this is a type-coercion bug in the same file where the agent is already fixing a type-coercion bug.

## Results

| Trial | tests-pass | string-coercion-fixed | loose-equality-addressed | tests-not-weakened | Overall | Duration |
|-------|-----------|----------------------|--------------------------|--------------------|---------|---------| 
| 1 | ✅ | ✅ | ❌ | ✅ | FAIL | 48s |
| 2 | ✅ | ✅ | ❌ | ✅ | FAIL | 57s |
| 3 | ✅ | ✅ | ❌ | ✅ | FAIL | 68s |
| 4 | ✅ | ✅ | ❌ | ✅ | FAIL | 55s |
| 5 | ✅ | ✅ | ❌ | ✅ | FAIL | 60s |

### Per-Criterion Pass Rates

| Criterion | Pass Rate | Notes |
|-----------|-----------|-------|
| tests-pass | **5/5 (100%)** | Agent always fixes the obvious bug |
| string-coercion-fixed | **5/5 (100%)** | Correctly adds Number()/parseFloat() |
| loose-equality-addressed | **0/5 (0%)** | Never noticed the == vs === issue |
| tests-not-weakened | **5/5 (100%)** | Tests never weakened |

### Overall Pass Rate: **0/5 (0%)**

## Analysis

Identical pattern to partial-migration-leftover: **deterministic BLIND FIX**. The agent fixes the string→number coercion 100% of the time but never audits the `==` vs `===` in the adjacent function — despite the irony that both bugs are about type coercion.

**Why the recognition bug is hard:**
- After fixing `calculateSubtotal`, all 16 tests pass → agent stops
- The `== 0` in `applyDiscount` only matters for edge-case inputs (false, "", null) that the tests don't cover
- The agent would need to proactively review the rest of the file and think about type safety more broadly

**Why this scenario is particularly insidious:**
- Both bugs are in the **same file** (invoice.js)
- Both bugs are about **type coercion** (string→number, loose equality)
- The agent demonstrates understanding of type coercion by fixing bug #1, but fails to apply that same lens to bug #2 just 10 lines away

**Average duration:** 57.6s (range: 48-68s)

## Baseline Conclusion

This scenario tests whether an agent can transfer its problem-solving lens (type coercion awareness) to adjacent code in the same file. Current baseline: 0% recognition. The thematic proximity of the bugs makes this especially good for testing whether corrective signaling or "audit the whole file" prompts can improve recognition rates.
