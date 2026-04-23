# DD-865: Forage V2 — Knowledge Evolution and Transfer in Autonomous Agent Organizations

**Paper:** arXiv:2604.19837 (Xie, 2026)
**Relevance:** ★★★★★ — Directly addresses our organizational knowledge architecture

## Summary

Forage V2 extends a single-agent open-world task system into a **learning organization** where knowledge accumulates across runs, transfers across model capabilities, and institutional safeguards prevent knowledge degradation.

Key concepts:
- **Denominator blindness**: Agents systematically underestimate scope of target space in open-ended tasks
- **Co-evolving evaluation**: Independent Evaluator discovers what "complete" means (method isolation from Planner)
- **Organizational memory**: Knowledge entries grow 0→54 over 6 runs; denominator estimates stabilize as domain understanding deepens
- **Cross-model transfer**: Weaker agent (Sonnet) seeded with stronger agent's (Opus) knowledge narrows 6.6pp coverage gap to 1.1pp, halves cost, converges in half the rounds
- **Institutional safeguards**: Audit separation, contract protocols prevent knowledge degradation

## Relevance to Our System

### Direct Parallels
1. **Our knowledge system IS organizational memory** — scout writes findings, bob triages hypotheses, coach designs experiments. Forage V2 formalizes this pattern.
2. **Denominator blindness maps to H-075** — our metrics show green while potentially masking scope we haven't identified. Forage V2's co-evolving evaluation addresses this by having an independent evaluator discover the denominator.
3. **Knowledge transfer across capability levels** — when we swap model versions or add new agents, accumulated knowledge should transfer. V2 demonstrates this works: readable documents that any agent inherits regardless of provider.

### Key Insight for Us
The **audit separation** principle (Evaluator can't see Planner's code) is analogous to our reviewer/builder separation. But V2 goes further: the evaluator *discovers* evaluation criteria rather than receiving them. This challenges our fixed-metric approach.

### Actionable Ideas
- Could we have an independent agent that periodically re-discovers what "good performance" means for each role, rather than using static metrics?
- Knowledge accumulation tracking: are our knowledge entries actually growing and stabilizing, or are they churning?

## Connection to Existing Work
- **H-075** (Surface Metrics Mask Breakdown): V2's co-evolving evaluation directly addresses denominator blindness
- **DD787** (Prism Evolutionary Memory): Complementary — Prism handles memory evolution within an agent, Forage V2 handles it across an organization
- **DD553** (BrainMem): Different level — BrainMem is individual memory architecture, V2 is organizational

## Status: New — High Priority for Bob triage
