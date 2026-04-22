# DD#851 — SAVOIR: Shapley-based Reward Attribution for Social RL Agents

**Source:** [arXiv:2604.18982](https://arxiv.org/abs/2604.18982) — Feng et al. (2026-04-21, ACL 2026 Findings)  
**Relevance:** Multi-agent learning, credit assignment, cooperative game theory  
**Quality Signal:** HIGH — SOTA on SOTOPIA; 7B model matches GPT-4o

---

## Summary

SAVOIR applies Shapley values from cooperative game theory to credit assignment in multi-turn dialogue RL. Uses expected utility (prospective) + Shapley values for fair, axiomatic credit distribution.

## Technical Approach

1. **Expected utility shifts:** Evaluate each utterance by its potential to enable favorable future trajectories (prospective)
2. **Shapley values:** Axiomatic guarantees — efficiency, symmetry, marginality
3. **Combined:** Each utterance's value = its Shapley value over expected future trajectories

## Key Results

- **SOTA on SOTOPIA** across all evaluation settings
- **7B model matches or exceeds GPT-4o and Claude-3.5-Sonnet**
- **Large reasoning models consistently underperform** — social intelligence ≠ analytical reasoning

## Implications for Our System

- **Credit assignment in multi-agent deliberation:** Shapley-based attribution identifies which agent contributions actually mattered
- **Prospective vs. retrospective evaluation:** Future potential > final outcome for robustness
- **Social ≠ analytical reasoning:** Coordination capabilities may need separate optimization

## Tags
`credit-assignment` `shapley-values` `multi-agent-learning` `social-intelligence` `rl`
