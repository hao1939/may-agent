# DD#899 — AEL: Agent Evolving Learning for Open-Ended Environments

**Paper:** arXiv:2604.21725 (Xu et al., Apr 2026)
**Relevance:** ★★★ HIGH — Directly addresses our agent self-improvement architecture

## Key Insight

The bottleneck in agent self-improvement is **self-diagnosing how to use experience**, not adding architectural complexity. AEL demonstrates a "less is more" pattern where memory + reflection alone produce 58% improvement, but every additional mechanism (planner evolution, per-tool selection, skill extraction, credit assignment) **degrades** performance.

## Architecture

Two-timescale framework:
1. **Fast timescale:** Thompson Sampling bandit selects which memory retrieval policy to use per episode
2. **Slow timescale:** LLM-driven reflection diagnoses failure patterns → injects causal insights into decision prompts

## Critical Ablation Result

Nine-variant ablation on sequential portfolio task (208 episodes):
- Memory + reflection: **+58% over stateless baseline**
- Adding planner evolution: **degrades**
- Adding per-tool selection: **degrades**
- Adding cold-start init: **degrades**
- Adding skill extraction: **degrades**
- Adding credit assignment (3 variants): **all degrade**

Sharpe ratio 2.13±0.47, lowest variance among LLM approaches.

## Connection to Our System

**Direct relevance to our knowledge/memory architecture:**

1. **Retrieval policy selection via bandit** — We currently use fixed retrieval. AEL's Thompson Sampling approach to choosing *which* retrieval strategy to apply per-task could improve how agents pull from the knowledge base. Different tasks may need different retrieval: sometimes recent memories, sometimes similar-task memories, sometimes abstract principles.

2. **"Less is more" warning** — We keep adding mechanisms (hypotheses, deep-dives, cross-references, coaching). AEL suggests that memory + reflection may be sufficient, and additional layers could hurt. This challenges our current direction of increasing architectural complexity.

3. **Causal insight injection** — Their slow-timescale reflection that produces causal insights (not just pattern matches) maps to what bob's hypotheses should be doing: diagnosing *why* something failed, not just recording *that* it failed.

4. **Stateless problem** — "Each task is solved from scratch" is exactly our agent problem. Sessions are stateless; context.md and knowledge are our memory. AEL validates this approach but says the key is retrieval policy, not memory size.

## Actionable for Bob

- Consider implementing bandit-based retrieval selection for agent knowledge lookup
- The "less is more" ablation should inform EXP design — test whether removing complexity improves outcomes
- Hypothesis: our agents might perform better with fewer, higher-quality knowledge entries + smart retrieval vs. large KB with fixed retrieval

## Tags
`agent-learning` `memory-retrieval` `self-improvement` `less-is-more` `thompson-sampling`
