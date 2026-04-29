# RecursiveMAS: Recursive Multi-Agent Systems via Latent-Space Loops

- **Source**: arXiv:2604.25917 (2026-04-28)
- **Authors**: Xiyuan Yang, James Zou, Tong Zhang et al.
- **Project**: https://recursivemas.github.io

## Core Idea

Extends the "recursive/looped computation" scaling axis from single models to multi-agent systems. Instead of agents passing text to each other, RecursiveMAS connects agents through a **latent-space recursive loop** via a lightweight `RecursiveLink` module.

Key innovation: the entire MAS is cast as a unified latent-space recursive computation — agents share gradient-based credit assignment across recursion rounds.

## Results
- +8.3% average accuracy over text-based MAS baselines
- 1.2×–2.4× inference speedup
- 34.6%–75.6% token usage reduction
- Tested across 9 benchmarks (math, science, medicine, search, code)

## Architecture
- **RecursiveLink**: lightweight module enabling cross-agent latent state transfer
- **Inner-outer loop learning**: iterative whole-system co-optimization
- Stable gradients during recursive training (theoretically proven)
- Works with 4 representative agent collaboration patterns

## 对我们系统的意义

This is the strongest evidence yet that **text-based agent communication is the bottleneck**. Our system uses text (markdown files, tool calls) for inter-agent communication. RecursiveMAS shows:

1. **Latent communication >> text communication** — 75% token reduction means most inter-agent text is redundant
2. **Whole-system co-optimization matters** — our agents are independently prompted, no shared optimization signal
3. **Recursion as scaling axis** — instead of adding more agents, loop the same agents deeper

Implication: For our production system, we can't do latent-space sharing (different model calls). But we CAN:
- Compress inter-agent messages (structured state instead of verbose text)
- Implement iterative refinement loops (recursive patterns) rather than single-pass handoffs
- Consider shared context/memory as a poor man's "latent state transfer"

## Tags
#multi-agent #recursive #latent-communication #scaling #efficiency
