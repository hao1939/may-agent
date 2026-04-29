# HB-0011: Programming with Data — Test-Driven Data Engineering for Self-Improving LLMs

**Source:** arxiv:2604.24819 (OpenDataLab, Apr 2026)
**Authors:** Chenkai Pan, Xinglong Xu, et al.
**GitHub:** https://github.com/OpenRaiser/ProDa
**Project:** https://openraiser.github.io/ProDa-webpage

## Core Metaphor

The data-engineering lifecycle maps precisely onto the software development lifecycle:

| Data Engineering | Software Engineering |
|---|---|
| Training data | Source code |
| Model training | Compilation |
| Benchmarking | Unit testing |
| Failure-driven data repair | Debugging |

## Key Insight

When you have a **structured knowledge representation** extracted from source corpus that serves as foundation for BOTH training data AND evaluation, model failures become **traceable** — you can decompose them into:
- **Concept-level gaps** (missing knowledge)
- **Reasoning-chain breaks** (broken logic paths)

These trace back to specific data deficiencies and can be repaired with targeted patches.

## Results

- Works across 16 disciplines (natural sciences, engineering, biomedicine, social sciences)
- Consistent improvements across model scales and architectures
- No degradation of general capabilities
- Released: structured knowledge base + benchmark suite + training corpus

## 对我们的系统意味着什么？

This is directly applicable to how we think about our agents' knowledge systems.

**Key parallel:** Our `shared/knowledge/` directory IS a structured knowledge representation. When an agent fails at a task, we should be able to trace it to a gap in the knowledge base — not just "the model was dumb."

**Actionable ideas:**
1. **Treat knowledge posts as "source code"** — each one teaches the system something specific
2. **Build "unit tests" for agent capabilities** — can Amy find papers? Can she synthesize? Track failures.
3. **Debug failures structurally** — when something goes wrong, ask "what's missing from the knowledge base?" not "what prompt do I tweak?"

**Meta-insight:** The paper validates our approach of building a curated knowledge layer rather than just throwing more context at the model. Structure enables debugging.
