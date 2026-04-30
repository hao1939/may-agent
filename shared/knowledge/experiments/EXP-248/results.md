# EXP-248: Results

**Status**: COMPLETE — FALSIFIED
**Run date**: 2026-04-30
**Runner**: agents/test/gym/run-gym.sh

## Summary

Belief-state externalization (metacognitive prompt before verification) has NO measurable effect on FM-3.3 gravity well rate. H-248-null confirmed. Two of three scenarios showed ceiling effects (already 100% pass), and the one scenario with actual failures (partial-verification-trap) showed no improvement with the intervention.

## Data

| Scenario | Arm | N | Pass rate | Notes |
|----------|-----|---|-----------|-------|
| fm33-verify-broken | A (baseline) | 5 | 5/5 (100%) | 6/6 checks each |
| fm33-verify-broken | B (treatment) | 5 | 5/5 (100%) | 6/6 checks each |
| compound-edit-verification | A (baseline) | 5 | 5/5 (100%) | 7/7 checks each |
| compound-edit-verification | B (treatment) | 5 | 5/5 (100%) | 7/7 checks each |
| partial-verification-trap | A (baseline) | 5 | 0/5 (0%) | 1/6 checks each |
| partial-verification-trap | B (treatment) | 5 | 0/5 (0%) | 1/6 or 0/6 checks |

## Analysis

1. **Ceiling effect on two scenarios**: fm33-verify-broken and compound-edit-verification are already solved by baseline agents (100% pass). These scenarios no longer discriminate — likely fixed by existing verification guards deployed since EXP-099.

2. **No effect on hard scenario**: partial-verification-trap consistently fails in both arms. The belief externalization prompt does not help the agent solve compound verification problems. The failure mode here appears to be ability-based (can't trace dependency chains) rather than belief-corruption-based.

3. **Slight degradation signal**: One treatment trial scored 0/6 vs baseline's consistent 1/6, suggesting the extra metacognitive overhead may slightly harm performance on hard tasks (consistent with KE-091: forced verification guards harm complex tasks).

## Conclusion

**FALSIFIED** — H-248a rejected. Belief-state externalization does not reduce FM-3.3 gravity well rate.

Key insight: The "gravity well" failure mode in partial-verification-trap is NOT caused by corrupted beliefs that could be surfaced through metacognition. It's caused by inability to trace multi-file dependency chains — a capability gap, not a metacognitive gap.

## Followups

- Update hypothesis scorecard: H-072 → P=0.15 (was higher)
- The partial-verification-trap scenario is a good discriminator — 0% baseline pass rate suggests it needs a structural intervention (decomposition, not prompting)
- Consider EXP for dependency-chain decomposition: force agent to enumerate all consumers of a changed value before verifying
