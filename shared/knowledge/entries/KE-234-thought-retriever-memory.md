# KE-234: Thought-retrieval validates DD/CR as agent long-term memory

**Date**: 2026-04-18
**Source**: DD-772 (Thought-Retriever, arXiv 2604.12231)
**Confidence**: Medium-High
**Connects**: H-163, KE-011, DD-764, DD-770

## Core Finding

Retrieving an agent's own processed reasoning ("thoughts") instead of raw data yields +7.6% F1 and +16% win rate over SOTA retrieval. Our DD/CR library architecture is already a thought-retrieval system — DDs are task-relevant compressions of raw papers, CRs are "deeper thoughts" synthesizing across DDs.

## Evidence

- Thought-Retriever: +7.6% F1, +16% win rate across benchmarks (model-agnostic)
- Self-evolution property: performance improves as more thoughts accumulate — maps to our growing library
- "Depth scaling": agents leverage higher-order reasoning for abstract queries — maps to DD → CR → hypothesis chain

## Mechanism / Why

Raw retrieval is bottlenecked by context length. Thoughts are lossy but task-relevant compressions — they carry the reasoning, not just the data. Retrieving pre-processed reasoning lets the agent skip redundant inference steps.

## Implications

### 1. Our multi-level synthesis chain is validated
DD (paper → thought) → CR (thoughts → deeper thought) → hypothesis mirrors the depth scaling the paper demonstrates. Each level compresses further while preserving task-relevant reasoning.

### 2. Citation ratio problem is critical
The paper shows thought-retrieval only works if thoughts are actually retrieved. Our KE-011 finding (knowledge files are passive/skipped) means our "thoughts" may not reach agents. Injection mechanisms matter more than library size.

### 3. Cold-start problem maps to new-agent onboarding
Thought memory requires solved queries to build. New agents or new domains start empty. Pre-seeding with existing DDs/CRs partially addresses this.

## Actionable

- Ensure DDs/CRs are retrievable via active injection (not just passive files) — reinforces KE-011
- Consider formalizing the DD → CR → hypothesis chain as explicit "depth levels" in the library
- Track library growth vs. agent performance to test H-163 directly

## Open Questions

- What's the optimal thought granularity? Our DDs may be too coarse (full paper summary) vs. fine-grained task-specific thoughts
- Does thought quality degrade over time as the domain evolves (stale thoughts)?
