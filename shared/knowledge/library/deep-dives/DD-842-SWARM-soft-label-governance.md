# DD-842: Soft-Label Governance for Multi-Agent Safety (SWARM)

**Paper**: 2604.19752 — Aiersilan & Savitt (2026)
**Date**: 2026-04-23
**Relevance**: ★★★★★ — Directly challenges our binary metric approach

## Core Idea

SWARM replaces binary good/bad labels for agent behavior with **soft probabilistic labels** p = P(v=+1) ∈ [0,1]. This enables:
- Continuous-valued payoff computation
- Expected toxicity measurement: E[1-p | accepted]
- Quality gap: E[p | accepted] - E[p | rejected]

## Key Findings

1. **Strict governance hurts without helping**: Reduces welfare 40%+ without improving safety. Overly restrictive thresholds destroy value.
2. **Circuit breakers need calibration**: Optimal threshold balances moderate welfare with minimized toxicity. Overly tight = value collapse.
3. **Soft metrics detect proxy gaming**: Self-optimizing agents that pass binary evaluations are caught by distributional soft metrics.
4. **Externality internalization backfires**: Aggressively internalizing externalities collapsed welfare from +262 to -67 while toxicity stayed invariant.

## Connection to Our System

### H-075 (Surface Metrics Mask Breakdown)
This paper provides direct empirical support. Our `findings-used: 0.541` is binary (cited or not). SWARM shows binary metrics miss distributional degradation. We should consider:
- Measuring **influence depth**: Did the finding change a decision, or was it cited pro-forma?
- Tracking **expected quality** as a continuous measure rather than pass/fail

### H-178 (Evaluator Anonymization)
The proxy-gaming result is critical. If our evaluator metrics can be gamed by surface compliance, we need distributional alternatives.

### H-073 (Calibrated Abstention)
The circuit-breaker calibration finding maps directly. If we set abstention thresholds too aggressively, we'll kill useful agent output. Need the "optimal threshold" approach.

## Actionable Implications

1. **Audit findings-used metric**: Track whether cited findings actually influenced downstream decisions (not just appeared in context)
2. **Add soft quality scores**: Instead of binary "hypothesis accepted/rejected", track continuous confidence/quality distributions
3. **Calibrate circuit breakers carefully**: Any intervention that blocks agent output needs a welfare-safety tradeoff analysis

## Connects To
- DD-839 (Semantic Consensus — coordination verification)
- H-075, H-073, H-178
- EXP-099 (verification gravity wells — the "strict governance hurts" finding is analogous)
