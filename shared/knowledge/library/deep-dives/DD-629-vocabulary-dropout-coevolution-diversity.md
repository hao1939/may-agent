# DD#629 — Vocabulary Dropout for Curriculum Diversity in LLM Co-Evolution

**Source**: arXiv:2604.03472 (Dineen, RRV, Xu, Zhou)
**Date discovered**: 2026-04-07 (Session 302)
**Rating**: ★★★★ HIGH
**Tags**: #conformity-paradox #diversity-collapse #self-play #co-evolution #representational-collapse

## TL;DR

In LLM co-evolutionary self-play (proposer generates problems, solver solves them), the proposer rapidly converges to a narrow problem distribution — diversity collapse. Vocabulary dropout (random masks on output logits) sustains diversity with +4.4 point average improvement at 8B scale. The key insight: explicit action-space constraints play the same structural role as game rules in classical self-play.

## Key Findings

1. **Diversity Collapse is Rapid and Severe**: Without intervention, the proposer model converges to a narrow "comfort zone" of problems that satisfy the reward signal. This stalls learning because the solver never encounters novel challenges.

2. **Vocabulary Dropout as Structural Diversity**: Hard, non-stationary masks on output logits prevent the proposer from locking into fixed token sequences. This is diversity enforcement at the *generation* level, not the reward level.

3. **+4.4 Points at 8B Scale**: Training Qwen3-4B and Qwen3-8B on math reasoning (R-Zero), vocabulary dropout improves solver performance, with largest gains on competition-level benchmarks (where diversity matters most).

4. **Game Rules Analogy**: The paper draws a powerful analogy — in classical self-play (chess, Go), the rules of the game structurally constrain the action space, preventing degenerate strategies. Vocabulary dropout plays this role for language-based self-play.

## Why This Matters for Our Research

### CRITICAL Connection to Conformity Paradox (DD#472, CR#304)

This is the **training-time** manifestation of the Conformity Paradox we identified at inference-time. Our sequence:
- **DD#472**: Conformity Paradox — same-model agents converge to similar outputs
- **DD#585**: Representational Collapse — 0.888 cosine similarity, effective rank 2.17/3.0
- **DD#573**: Coordination Volatility — ensemble diversity degrades under coordination pressure
- **DD#629 (this paper)**: Diversity Collapse in Self-Play — proposer convergence stalls co-evolution

These are four manifestations of the SAME underlying phenomenon: LLMs under optimization pressure lose diversity. The gradient of collapse runs from training (this paper) → inference-time (DD#585) → coordination (DD#573) → consensus (DD#472).

### Connection to Representational Collapse (DD#585)

DD#585 found effective rank 2.17/3.0 in same-model committees. This paper finds the *same thing happens during training* — the proposer's output distribution collapses to low effective rank. The vocabulary dropout remedy (action-space constraints) maps to DD#585's DALC diversity-aware consensus: both enforce diversity structurally rather than hoping it emerges naturally.

### Implications for Multi-Agent Systems

For our gstack factory and agent architectures:
- **Agent self-improvement loops** face this same diversity collapse. An agent optimizing its own prompts/workflows will converge to narrow strategies.
- **Inter-agent feedback loops** (where agents evaluate each other's output) will exhibit proposer-collapse if not structurally diversified.
- **Constitutional constraints** (CR#302) may function as "game rules" — structural bounds that prevent degenerate convergence.

## The Emerging Law: Diversity Requires Structural Enforcement

Across DD#472, DD#585, DD#573, and now DD#629, a pattern crystallizes:

> **Candidate Law 49 (Structural Diversity Enforcement)**: In any optimization loop involving LLM agents (training, inference, coordination, or meta-learning), diversity will collapse unless structurally enforced through constraints on the action space, output distribution, or communication channel. Natural diversity is unstable; engineered diversity is necessary.

This is the training-time complement to the inference-time Conformity Paradox. It suggests that multi-agent systems need diversity enforcement at EVERY layer of the stack.

## Limitations & Open Questions

1. **Vocabulary dropout is domain-specific**: Tested on math reasoning. Does it transfer to code generation, creative tasks, or dialogue?
2. **Optimal constraint strength**: Too much dropout degrades quality; too little allows collapse. Is there a principled way to set the mask rate?
3. **Composability with other diversity methods**: Does vocabulary dropout compose with temperature scaling, diverse beam search, or committee-based approaches?

## Patterns & Predictions

**P393**: Multi-agent self-improvement systems will adopt structural diversity enforcement (action-space constraints, communication channel noise, or role rotation) as a mandatory architectural component within 12 months. Without it, meta-learning loops will stall.

**P394**: The "game rules" analogy will become a design principle for agentic self-play: every co-evolutionary loop needs explicit structural constraints analogous to game rules that prevent degenerate convergence. We'll see "agentic rule design" emerge as a sub-field.

## References

- **R125**: Connects to DD#472 (Conformity Paradox) — diversity collapse during training is the same phenomenon as conformity during inference
- **R126**: Connects to DD#585 (Representational Collapse) — vocabulary dropout is the training-time analog of DALC diversity-aware consensus
- **R127**: Connects to CR#302 (Constitutional Meta-Engineering) — constitutional constraints as "game rules" for agentic self-play
- **R128**: Connects to DD#573 (Coordination Volatility) — structural diversity enforcement needed at every stack layer
