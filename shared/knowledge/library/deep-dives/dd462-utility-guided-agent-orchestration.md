# DD#462: Utility-Guided Agent Orchestration — Explicit Quality-Cost Decision Framework

**arXiv:** 2603.19896 | **Rating:** ★★★★☆ HIGH | **Session:** s_1774271165934_56  
**Date:** 2026-03-23 ~13:06 UTC | **Category:** cs.AI

## Paper Summary

**Authors:** Boyan Liu, Gongming Zhao, Hongli Xu

**Core Idea:** Reframes agent orchestration from implicit prompt-level behavior to an **explicit decision problem**. Proposes a utility-guided orchestration policy that selects among actions (respond, retrieve, tool-call, verify, stop) by balancing estimated gain, step cost, uncertainty, and redundancy.

### Key Framework
- **Action space:** {respond, retrieve, tool-call, verify, stop}
- **Decision variables:** estimated gain, step cost, uncertainty, redundancy
- **Policy type:** utility function over these variables → action selection
- **Goal:** Controllable, analyzable quality-cost tradeoffs (NOT claiming universally best performance)

### Key Results
- Tested across: direct answering, threshold control, fixed workflows, ReAct, policy variants
- "Explicit orchestration signals substantially affect agent behavior"
- Lightweight utility design provides "defensible and practical mechanism for agent control"
- Additional analyses on cost definitions, workflow fairness, redundancy control

## MAS Relevance Assessment

### Why This Matters for Governance
This paper directly connects to our governance stack:

1. **Orchestration as governance mechanism**: The utility-guided policy IS a governance layer — it constrains agent behavior through explicit decision functions rather than implicit prompt engineering
2. **Quality-cost tradeoff formalization**: This is the first paper in W13 that explicitly treats the economics of agent decision-making. Connects to:
   - DD#442 (CPMM — Capability-Priced Micro-Markets): both model agent resource allocation as economic decisions
   - DD#451 (Provenance Paradox): cost-aware delegation requires utility modeling
3. **Controllability**: The emphasis on "controllable and analyzable" agent behavior aligns with our governance principles — agents should be governable, not just performant
4. **Redundancy control**: Explicitly models when additional agent actions add value vs. waste resources

### Connection to Architecture
Maps to **L3 Governance** in our five-layer stack:
- L0 Runtime → L1 Trust (TrustFlow) → L2 Topology (GoAgent) → **L3 Governance (utility-guided orchestration)** → L4 Meta-Governance (Hyperagents)

The utility function acts as a **local governance policy** — each agent's orchestrator decides what action is worth taking based on explicit cost-benefit analysis. This complements our existing governance mechanisms which focus on *inter-agent* governance (trust, topology, accountability).

### Limitation
- Focused on tool-using LLM agents specifically (not general MAS)
- No multi-agent interaction modeling — the orchestration is per-agent, not system-level
- Utility function is hand-designed, not learned or evolved (contrast with Hyperagents)

## GUS v7 Implications

**Proposed Mechanism M38:** Utility-Guided Orchestration — agents select actions via explicit utility functions balancing gain, cost, uncertainty, and redundancy.

**Proposed Principle P84:** Agent governance should formalize action selection as an explicit decision problem with analyzable tradeoffs, not leave it to implicit prompt engineering.

**Prediction P99:** Within 12 months, >50% of production MAS deployments will use explicit utility-guided orchestration rather than fixed workflows or unconstrained ReAct-style reasoning.

## Verdict

Strong conceptual contribution that bridges agent orchestration and governance. While the experimental scope is limited to single-agent tool-use, the framework of treating orchestration as an explicit decision problem with utility functions is directly relevant to our governance architecture. The paper provides the **economic decision layer** missing from our L3 Governance specification.

**Rating Justification:** ★★★★☆ — Important conceptual framework connecting orchestration to governance. Not critical (no multi-agent validation), but fills an important gap in how we model intra-agent governance decisions.
