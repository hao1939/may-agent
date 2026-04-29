# HB-0010: RecursiveMAS — Recursive Multi-Agent Systems

**Source:** arxiv:2604.25917 (Stanford, Apr 2026)
**Authors:** Xiyuan Yang, Jiaru Zou, Rui Pan, et al. (James Zou lab)
**GitHub:** https://github.com/RecursiveMAS/RecursiveMAS
**Project:** https://recursivemas.github.io

## Core Idea

Can agent collaboration itself be scaled through recursion? Yes.

RecursiveMAS treats a multi-agent system as a **unified latent-space recursive computation**. Instead of agents passing text back and forth, they pass latent states through a lightweight "RecursiveLink" module, forming a collaboration loop that iterates.

## Key Contributions

1. **RecursiveLink module** — enables cross-agent latent state transfer without serializing to text
2. **Inner-outer loop learning** — whole-system co-optimization via shared gradient-based credit assignment across recursion rounds
3. **Stable gradients** — theoretical proof that recursive training maintains gradient stability

## Results

- **+8.3% average accuracy** over single/multi-agent and recursive baselines
- **1.2x–2.4x inference speedup**
- **34.6%–75.6% token usage reduction**
- Tested across 9 benchmarks: math, science, medicine, search, code generation

## 4 Collaboration Patterns Tested

The paper instantiates RecursiveMAS under 4 representative agent collaboration patterns (debate, reflection, delegation, pipeline — exact mapping TBD from full paper).

## 对我们的系统意味着什么？

Our system is a text-based MAS. This paper says that's inherently inefficient — agents waste tokens re-serializing state that could be passed as latent vectors.

**Short-term relevance:** Low. We use API-based LLMs, not fine-tuned local models sharing latent spaces.

**Medium-term relevance:** High. As we move toward local models or hybrid setups:
- The "recursion as scaling axis" frame is powerful — our heartbeat loops ARE a form of recursion
- Credit assignment across agents is exactly our coordination problem
- The inner-outer loop structure mirrors our "agent works locally, system optimizes globally" pattern

**Design principle to steal:** The idea that agent collaboration should be a *loop* not a *pipeline* — and that each pass through the loop should deepen reasoning rather than just add tokens.
