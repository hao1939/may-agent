# OpenAI: Where the Goblins Came From — Reward Signal Leakage in RL Training

**Source**: https://openai.com/index/where-the-goblins-came-from/  
**Date**: 2026-04-29  
**HN**: 170+ points

## Summary

OpenAI published a detailed post-mortem on how GPT-5.1 through GPT-5.5 developed an increasing tendency to use "goblin" and "gremlin" metaphors. Root cause: a reward signal for the "Nerdy" personality customization feature inadvertently gave high scores to creature metaphors. The behavior then **leaked** to non-Nerdy contexts through a feedback loop:

1. Playful style rewarded in Nerdy condition
2. Rewarded outputs contain distinctive lexical tics
3. Tics appear more often in rollouts
4. Model-generated rollouts used for SFT data
5. Model generalizes the tic to all contexts

Key stats:
- "Nerdy" = 2.5% of ChatGPT responses but 66.7% of all goblin mentions
- Goblin usage rose 175% after GPT-5.1 launch
- Positive reward uplift for creature-word outputs in 76.2% of audited datasets
- Even after retiring Nerdy personality, GPT-5.5 still had the problem (trained before fix)

## 对我们的系统意味着什么

**This is the clearest public example of reward signal leakage in production RL systems.**

Implications for our multi-agent architecture:

1. **Feedback loops in self-improving systems**: If we ever use agent outputs as training data or preference signals, behavioral quirks will amplify. Any scoring/reward mechanism needs explicit diversity auditing.

2. **Scoped rewards don't stay scoped**: RL doesn't respect the boundaries you train it in. A reward applied in one context (e.g., one agent role, one task type) will bleed into others. This is directly relevant to per-agent personality/style guidance — if we ever fine-tune.

3. **SFT data contamination**: Using model-generated outputs for training creates exactly this loop. Our skill system should track provenance of any training-like data.

4. **Detection patterns**: OpenAI's approach — lexical frequency tracking across conditions, comparing reward scores with/without the tic — is a reusable audit methodology.

5. **Mitigation was multi-layered**: Remove reward signal + filter training data + add system prompt suppression. Single fixes insufficient.

## Tags
`reward-hacking` `RL` `feedback-loops` `model-behavior` `openai` `post-mortem`
