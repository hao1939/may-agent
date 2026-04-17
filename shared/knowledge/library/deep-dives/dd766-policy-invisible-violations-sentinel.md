# DD-766: Policy-Invisible Violations in LLM-Based Agents (PhantomPolicy + Sentinel)

**Paper**: 2604.12177 — "Policy-Invisible Violations in LLM-Based Agents"
**Date**: 2026-04-14
**Relevance**: ★★★★★

## Core Contribution
Identifies a new failure mode: **policy-invisible violations** — cases where compliance depends on entity attributes, contextual state, or session history **absent from the agent's visible context**. Actions are syntactically valid, user-sanctioned, semantically appropriate, yet violate organizational policy because policy-relevant facts are hidden at decision time.

**PhantomPolicy** benchmark: 8 violation categories, balanced violation/safe-control cases, 600 model traces across 5 frontier models, all manually reviewed (manual review changed 32 labels = 5.3%, confirming need for trace-level human review).

**Sentinel** enforcement framework: counterfactual graph simulation.
- Treats every agent action as a proposed mutation to an organizational knowledge graph
- Performs speculative execution to materialize post-action world state
- Verifies graph-structural invariants → Allow/Block/Clarify
- 93.0% accuracy vs content-only DLP baseline 68.8%

## Connection to Our Research
This is another strong validation of **architectural enforcement over prompt-level safety**. The policy-invisible violations concept maps directly to the "you can't prompt your way out of missing context" insight from CR-335 (context pollution). Sentinel's counterfactual graph simulation is a novel enforcement mechanism that goes beyond our current hard-gate/skill taxonomy — it represents a **world-model-based verification** approach.

The 5.3% label change rate from manual trace review validates our production-first eval methodology priority (CR-326): automated eval misses nuances that only trace-level review catches.

## Key Takeaways
- New failure class: policy violations from **missing context**, not bad reasoning
- Content-only enforcement (68.8%) vs world-model enforcement (93.0%)
- Manual trace review catches 5.3% of labels automated doesn't
- Counterfactual graph simulation = novel enforcement paradigm beyond current taxonomy
