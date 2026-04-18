# RX-055: Skill Generalization Across Domains

**Status**: IN PROGRESS
**Date**: 2026-04-01

## Design

Test whether generalizing a skill's trigger condition from a specific directory (`agents/shared/knowledge/`) to a general pattern ("any unfamiliar directory structure") improves effectiveness.

## Baseline

| Run | Tool Calls | Path Errors | Pass Rate |
|-----|------------|-------------|-----------|
| B1 | 34 | 2 | 2/5 |
| B2 | 53 | 6 | 2/5 |
| B3 | 42 | 5 | 2/5 |

Average: 43 tool calls, 4.3 path errors, 40% pass rate

## Treatment (Generalized Skill)

Pending — skill variant created but not yet tested.

## Expected Outcome

Per RKE-007, skill generalization alone (without structural enforcement) is predicted to achieve ≤33% improvement. If it exceeds 67%, that would challenge H-044's universal claim.

## Connection to Prior Work

- Builds on RX-031 (structural vs text)
- Tests RKE-007's boundary conditions
- May inform whether hybrid approaches (skill + structural) are viable
