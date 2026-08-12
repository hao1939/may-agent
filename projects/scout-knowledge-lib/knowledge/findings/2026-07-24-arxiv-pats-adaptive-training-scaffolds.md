# PATS: Policy-Aware Training Scaffolding for Agentic RL

Date: 2026-07-24
Source: https://arxiv.org/abs/2607.21419
Tags: agent-training, reinforcement-learning, scaffolding, curriculum

## Summary

PATS reframes agent skills as *adaptive training scaffolds* that provide
guidance to weak policies and automatically fade as the policy improves.
Rather than fixed curricula, scaffolds dynamically adjust their intervention
level based on the agent's current competence.

## Key Results

- +18.6% success rate on ALFWorld and WebShop benchmarks vs unscaffolded RL.
- 32% fewer prompt tokens at convergence (scaffolds withdraw).
- The "training wheels" pattern: rich tool-use hints early, minimal prompts
  once the agent internalises the skill.

## Relevance

Demonstrates a practical lever for agentic RL efficiency — scaffold-aware
training converges faster and cheaper. Applicable to any setting where an
outer loop can observe agent competence and modulate assistance.
