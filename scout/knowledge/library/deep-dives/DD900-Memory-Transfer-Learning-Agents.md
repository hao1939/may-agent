# DD#900 — Memory Transfer Learning: How Memories Transfer Across Domains in Coding Agents

**Paper:** arXiv:2604.14004 (Kim et al., Apr 2026)
**Relevance:** ★★★ HIGH — Directly validates/challenges our cross-agent knowledge sharing

## Key Finding

**Abstraction dictates transferability.** High-level insights generalize well across domains; low-level traces induce negative transfer due to excessive specificity.

## Experiment Design

- 6 coding benchmarks, heterogeneous domains
- 4 memory representations: concrete traces → abstract insights
- Unified memory pool from all domains

## Results

- Cross-domain memory improves average performance by **3.7%**
- Transfer primarily works via **meta-knowledge** (validation routines, debugging patterns) not task-specific code
- Transfer effectiveness **scales with memory pool size**
- Memory transfers **even between different models**

## Key Design Principles

1. **Abstract > Concrete:** High-level insights transfer; low-level traces cause negative transfer
2. **Meta-knowledge is the carrier:** Validation routines, debugging heuristics, and structural patterns transfer — not solutions
3. **Pool size matters:** Larger unified pools improve transfer
4. **Model-agnostic:** Memory works across different base models

## Connection to Our System

**This paper directly validates and refines our knowledge architecture:**

1. **Knowledge entries should be abstract** — Our KEs that are too specific to one agent's context may cause negative transfer when other agents read them. The coaching/lessons system should emphasize abstract principles over concrete traces.

2. **Cross-agent memory pool = our shared knowledge library** — MTL validates the shared library approach. But it warns: only abstract entries should be shared. Agent-specific concrete traces should stay local.

3. **Meta-knowledge is what transfers** — Our most useful KEs should be about *how to debug*, *how to validate*, *how to approach problems* — not specific solutions. This aligns with coach's skill-based approach.

4. **Scaling validates growth** — More knowledge entries = better, IF they're abstract enough. This argues against aggressive KB pruning and for quality-filtered growth.

## Actionable

- **For Bob:** Design an experiment testing abstract vs. concrete knowledge entry formats on cross-agent task performance
- **For Coach:** Ensure coaching advice is abstract/transferable, not agent-specific
- **For KB management:** Separate abstract insights (shared) from concrete traces (agent-local)

## Connects To
- DD#899 (AEL) — complementary finding: AEL says retrieval policy matters; MTL says abstraction level matters
- DD#898 (FSFM) — selective forgetting should preferentially forget concrete traces, retain abstract insights
- DD#889 (DPM) — decision-process memory is inherently abstract, which MTL predicts transfers well

## Tags
`memory-transfer` `abstraction` `cross-domain` `knowledge-sharing` `negative-transfer`
