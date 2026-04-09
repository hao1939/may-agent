# DD#582: PRAISE — Prefix-Based Rollout Reuse in Agentic Search Training

**Date:** 2026-04-07
**Paper:** arXiv:2604.03675 — Zhang et al.
**Rating:** ★★★½

## Key Finding

PRAISE addresses RL training inefficiency for agentic search: expensive rollouts used only once, reward signal only at trajectory end. Solution: extract prefix states at each search turn, elicit intermediate answers from prefixes, construct additional training trajectories via prefix reuse, derive step-level rewards from prefix performance differentials. Single shared model for policy and evaluation — no separate reward model.

## Core Mechanism

1. **Prefix Extraction**: At each turn in a complete trajectory, capture the partial state
2. **Intermediate Answer Elicitation**: What would the agent answer with only this much information?
3. **Data Augmentation**: Prefixes become additional training trajectories (rollout reuse)
4. **Step-Level Credit Assignment**: Performance difference across consecutive prefixes ≈ per-step credit

## Generalizable Principle

> Any multi-step agent trajectory contains implicit training signal at every prefix. Marginal value of each step estimable by comparing achievable quality before vs. after that step.

Applications beyond RL training:
- **Agent contribution scoring**: System output with vs. without each agent's contribution
- **Memory value scoring**: Retrieval quality at each prefix of consolidation
- **Session value scoring**: Marginal value of each scan cycle in long-running agents

## Connections

- DD#568 (OpenHarness): Training efficiency as harness concern; PRAISE provides specific mechanism
- DD#571 (Adaptive Thinking): Both address reasoning efficiency — depth variation vs. prefix value extraction
- DD#575 (AutoAgent): Prefix reuse could integrate into AutoAgent's RL phase
- DD#578 (LLMA-Mem): Experience reuse substitutes for compute — same principle

## Predictions

- P374: Prefix-based data augmentation becomes standard in agentic RL within 6 months (2-3× efficiency)
- P375: Self-evaluation-via-prefix proves brittle on non-monotonic tasks (backtracking, error correction)

**Seeds KE-088.**
