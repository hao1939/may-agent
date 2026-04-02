# Deep-Dive #377: REDEREF — Training-Free Probabilistic Control for Multi-Agent LLM Collaboration

**Source:** arXiv:2603.13256 (cs.CL, cs.AI, cs.ET, cs.MA)
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-17

## One-Line Summary
A lightweight training-free controller combining Thompson sampling, reflection-driven re-routing, evidence-based selection, and memory-aware priors that reduces token usage 28%, agent calls 17%, and time-to-success 19% in multi-agent recursive delegation — proving that simple probabilistic control outperforms random or greedy routing.

## Core Contribution

### REDEREF Architecture — Four Components

1. **Belief-Guided Delegation (Thompson Sampling):** Maintains per-agent success beliefs (Beta distributions) and samples to prioritize agents with historically positive marginal contributions. Exploration-exploitation balance is automatic. No training required — pure online Bayesian updating.

2. **Reflection-Driven Re-routing:** After each delegation round, a calibrated LLM judge (or programmatic verifier) evaluates whether the response satisfies quality criteria. If not, re-routes to next-best agent rather than retrying same agent.

3. **Evidence-Based Selection:** Instead of averaging outputs (which dilutes quality — validates DD#245 Teams-Hold-Experts-Back), selects the single best response based on evidence quality. Selection > aggregation in knowledge-asymmetric settings.

4. **Memory-Aware Priors:** Bootstraps initial beliefs from cached agent performance profiles, eliminating cold-start inefficiency. Connects to SSGM provenance tracking and A-MAC admission control.

### Key Findings

- **Recursive retry alone saturates task success** — brute-force retrying eventually succeeds, but wastes resources.
- **Belief-guided routing reduces overhead by 17-28%** compared to random recursive delegation — same success rate, dramatically fewer resources.
- **Graceful degradation** — when agents or judges degrade, REDEREF adapts by updating beliefs and shifting routing. No catastrophic failure mode.
- **Training-free** — no fine-tuning, no gradient computation, no dataset construction. Pure inference-time optimization.

## Connection to Portfolio

### Validates 5+ Prior Findings

1. **CR#62 (Reasoning Compute Allocation):** REDEREF implements allocation dominance (R1) at the inter-agent level — routing quality matters more than agent count. 28% token savings = 28% better allocation.

2. **CR#170 (Multi-Level Compute Allocation Stack):** Fills the agent-routing layer with a concrete, training-free implementation. Thompson sampling is the cheapest possible routing mechanism with formal exploration-exploitation guarantees.

3. **DD#281 (AMRO-S Bio-Inspired Routing):** AMRO-S uses ant colony optimization for routing; REDEREF uses Thompson sampling. Both achieve significant routing improvements over random/round-robin, confirming that **routing is a high-leverage optimization lever**. AMRO-S achieves 4.7× speedup with pheromone-based routing; REDEREF achieves ~1.2× with Bayesian routing. Different optimality regimes: AMRO-S better for concurrent workloads, REDEREF better for sequential recursive delegation.

4. **DD#245 (Teams Hold Experts Back):** REDEREF's evidence-based selection (not averaging) directly addresses the "integrative compromise" failure mode. When you select the best response rather than averaging, expert knowledge is preserved.

5. **GUS Law 19 (Minimum Sufficient Coordination):** Thompson sampling naturally converges to routing only to agents that demonstrably contribute — producing minimal coordination overhead. Agents with no marginal value are automatically deprioritized.

### Novel Contribution

**Proposed Principle 127: Bayesian Routing Sufficiency** — For multi-agent delegation tasks, training-free Bayesian routing (Thompson sampling) provides most of the benefit of learned routing at zero training cost, with automatic exploration-exploitation balance and graceful degradation.

**Proposed Prediction P180:** Training-free probabilistic routing will become standard infrastructure in production MAS within 12 months, because it provides significant efficiency gains (15-30%) with zero overhead, no training data requirements, and no model-specific dependencies. It is the "free lunch" of multi-agent orchestration.

## Why This Matters for Our System

Our current routing is effectively fixed (May dispatches to specific agents based on task type). REDEREF suggests we could benefit from:
1. **Tracking agent success rates by task type** — which agent actually produces better outcomes for code vs. research vs. review tasks
2. **Thompson sampling for ambiguous task routing** — when multiple agents could handle a task, sample based on performance beliefs
3. **Evidence-based selection** when multiple agents produce candidate solutions — pick the best, don't try to merge

Immediate applicability: LOW (our system is too small for routing to be a bottleneck). But as we scale to more agents or more concurrent tasks, this becomes relevant.

## Limitations
- Under review (13 pages) — peer review pending
- "Split-knowledge tasks" may not generalize to all MAS architectures
- The 28% token reduction is against random recursive delegation baseline — a well-designed fixed routing could narrow this gap
- No comparison against learned routing methods (which would require training)

## Assessment
Clean, practical paper that demonstrates the power of simple probabilistic methods in MAS. The key insight — that Bayesian routing is sufficient for most multi-agent coordination efficiency — is elegant and immediately actionable. Validates the portfolio's emphasis on coordination quality over agent quantity.

**Relevance:** 8/10. Connects to CR#62, CR#170, DD#281, DD#245, GUS Law 19.
