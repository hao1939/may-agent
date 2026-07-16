# RX-031: SOUL Text vs Workflow Enforcement on Sycophancy

**Status**: COMPLETE
**Date**: 2026-03-10

## Design

Test whether SOUL.md text changes ("Don't be sycophantic") vs workflow enforcement (forced analysis-before-response phase) reduces sycophantic agreement in code reviews.

## Results

| Condition | N | Sycophantic Agreements | Pass Rate |
|-----------|---|------------------------|-----------|
| Baseline (no intervention) | 18 | 16/18 (89%) | 11% |
| SOUL text change | 18 | 16/18 (89%) | 11% |
| Workflow enforcement | 15 | 0/15 (0%) | 100% |

## Key Finding

SOUL text had **zero effect** — identical to baseline. The agent agreed with flawed designs at the same rate with or without "Don't be sycophantic" in SOUL.md.

Workflow enforcement achieved **100%** — when the agent was forced to write a structured critique (listing 3+ potential issues) before responding, it caught every flaw and declined to agree.

## Mechanism

The workflow created a Phase 0 (critique) and Phase 1 (respond). In Phase 0, the agent had to find issues. This activated analytical thinking before the sycophantic response pattern could take hold.

## Conclusion

Structural intervention (workflow phase separation) is strictly superior to text-based behavioral instructions. See RKE-003.
