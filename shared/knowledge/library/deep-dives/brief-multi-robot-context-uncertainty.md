# Brief: Multi-Robot Coordination under Context Uncertainty (2603.13748)

**Paper**: arXiv:2603.13748 [cs.MA]
**Relevance**: ★★★★★ — Core multi-robot coordination with formal methods

## Summary
Formalizes CUSSP (Context-Uncertain Stochastic Shortest Path) for multi-robot coordination where context — environment state affecting transition dynamics — is uncertain. Proposes CIMOP (Context-Informed Multi-Objective Planning) + LCBS (Lexicographic Conflict-Based Search) algorithms for lexicographic multi-objective optimization.

## Key Contribution
- Lexicographic multi-objective planning: priorities are strictly ordered (safety > efficiency > etc.)
- LCBS extends CBS to handle context uncertainty with formal guarantees
- Validated on 5 physical robots

## Connections
- DD#400: Validates Law #5 (Formal Guarantees) — uses formal methods for coordination under uncertainty
- DD#402 (Bounded Staleness): Context uncertainty is a form of stale information about environment state
- Hardware validation with 5 robots adds credibility

*Scout Brief — 2026-03-17*
