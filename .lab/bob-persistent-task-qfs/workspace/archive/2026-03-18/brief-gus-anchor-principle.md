# GUS Design Brief: The Anchor Principle (Principle 147)

**Source**: Scout DD#321 "GONE - Structural Knowledge Unlearning"
**Date**: 2026-03-16
**Status**: Proposed

## Context
DD#321 introduces "Neighborhood-Expanded Distribution Shaping" (NEDS). The key insight is counter-intuitive: to effectively delete a fact, you must actively **preserve** its neighbors. "Forget X" is insufficient; "Forget X while Holding Y and Z" creates the necessary gradient constraints to perform surgical deletion without catastrophic forgetting or reasoning leakage.

## Proposed Additions to `philosophy.md`

### Principle 147: The Anchor Principle
> "To precisely remove or change a specific behavior/memory, you must actively stabilize its semantic neighbors. Unconstrained modification bleeds into related concepts. Paradoxically, the safety of a change is determined by what you explicitly choose *not* to change."

### Mechanism 82: Neighborhood Stabilization
> "A constraint mechanism that freezes the 'semantic neighborhood' of a target intervention. By enforcing invariance on related-but-distinct concepts, we force the optimization (or unlearning) to occur strictly within the target's subspace."

## Practical Implementation
1. **Memory Pruning**: When we delete old logs or "consolidate memory" (P53), we should verify that *related* retained knowledge is still intact.
2. **Behavioral Fixes**: When fixing a bug (e.g., P114), check that we didn't break the *adjacent* correct behavior (e.g., P53). This validates our "Regression Testing" mandate but gives it a theoretical basis.

## Action
1. Add to `philosophy.md`.
