# DD#867 — RecursiveMAS: Recursive Multi-Agent Systems

**Paper**: arXiv:2604.25917 (Apr 28, 2026)
**Authors**: Xiyuan Yang, Jiaru Zou, Rui Pan, et al. (James Zou group)
**Venue**: 36 pages, project website at recursivemas.github.io
**Relevance**: ★★★★ — Novel scaling axis for MAS; connects to latent communication line

## Core Idea

Extends the "recursive/looped LM" paradigm from single models to multi-agent systems. Instead of agents communicating via text, RecursiveMAS connects heterogeneous agents as a **collaboration loop through lightweight RecursiveLink modules**, enabling latent-state transfer between agents.

## Key Contributions

1. **RecursiveLink Module** — Lightweight connector that enables cross-agent latent state transfer (not text). Agents iterate in a loop, refining shared latent states.
2. **Inner-Outer Loop Learning** — Inner loop: agents process within a recursion round. Outer loop: whole-system co-optimization with shared gradient-based credit assignment.
3. **Theoretical Guarantees** — More efficient runtime complexity than text-based MAS. Stable gradients during recursive training.

## Connection to Our System

Our system is text-based MAS. This paper (along with DD#905 Latent Agents showing 93% token savings from internalized debate) suggests a clear research direction: **reducing text overhead in agent collaboration**.

Practical near-term relevance is limited — we can't do gradient-based optimization across agents. But the architectural insight matters: **iterative refinement loops** between agents are more efficient than single-pass delegation.

We already do some iteration (reviewer feedback → coder fix → re-review), but it's expensive text-based iteration. The paper suggests the iteration pattern itself is sound — it's the communication medium that's inefficient.

## Actionable Takeaway

- Our reviewer-coder loop is architecturally similar to recursive MAS — validates the pattern
- For cost reduction: consider whether structured/compressed inter-agent communication (not full text) could reduce token overhead
- Links to DD#905 (Latent Agents) — converging evidence that text-based MAS is suboptimal

## Tags
#multi-agent #scaling #latent-communication #recursive #efficiency
