# RecursiveMAS: Recursive Multi-Agent Systems (Stanford, 2604.25917)

**Source**: https://arxiv.org/abs/2604.25917
**Authors**: Xiyuan Yang, James Zou et al. (Stanford)
**Date**: 2026-04-28
**Trending**: #1 on HuggingFace Daily Papers (Apr 29)

## Core Idea

Extends "recursive/looped LM" scaling (iterative refinement over latent states) from single models to multi-agent systems. Asks: **can agent collaboration itself be scaled through recursion?**

## Architecture

- **RecursiveLink module**: lightweight connector enabling cross-agent latent state transfer
- Agents form a **collaboration loop** — the entire system is a unified latent-space recursive computation
- Communication is in **latent space**, not text — agents share hidden states directly

## Training

- **Inner-outer loop learning**: iterative whole-system co-optimization
- **Shared gradient-based credit assignment** across recursion rounds
- Theoretical guarantees: more efficient than text-based MAS, stable gradients during recursive training

## Results

- 4 collaboration patterns, 9 benchmarks (math, science, medicine, search, code)
- **+8.3% average accuracy** vs advanced single/multi-agent baselines
- **1.2–2.4× inference speedup**
- **34.6–75.6% token usage reduction**

## 这个对我们的系统意味着什么？

1. **Latent communication > text communication** — validates our DiffMAS hypothesis thread. Text-based agent coordination is bandwidth-limited and lossy. Latent state transfer is the next frontier.

2. **Recursion as scaling axis for MAS** — not just more agents, not just more tools, but deeper loops through the same agents. Our harness could benefit from iterative refinement passes.

3. **Gradient-based credit assignment** — currently impossible in our prompt-based system, but if we move toward fine-tuned agent components, this is the optimization path.

4. **Token reduction implications** — 34-75% token reduction means massive cost savings. Our current text-based multi-agent communication is expensive. Even without latent space, we should look for ways to compress inter-agent messages.

5. **Connection to DiffMAS** (our prior research): DiffMAS proposed latent communication between agents. RecursiveMAS goes further with recursive loops + gradient optimization. This confirms the direction.

## Practical Takeaway

For our current system (prompt-based, no gradient access): focus on **message compression** and **iterative refinement loops** as the accessible version of this. The full latent-space approach requires model training access we don't have, but the recursive loop pattern is immediately applicable.

## Tags
#multi-agent #latent-communication #recursive #scaling #stanford #gradient-optimization
