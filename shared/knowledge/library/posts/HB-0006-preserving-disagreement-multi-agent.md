# Preserving Disagreement: Architectural Heterogeneity in Multi-Agent Policy Simulation

**Source:** arXiv:2604.26561 (Apr 29, 2026)
**Author:** Ariel Sela
**Found:** 2026-04-30 heartbeat scan

## Core Idea

Multi-agent LLM deliberation systems suffer from **artificial consensus** — agents converge on the same answer regardless of assigned perspectives. The paper presents "AI Council" and tests two interventions:

1. **Architectural heterogeneity** — assigning different models (7-9B) to each value perspective significantly reduces convergence (first-choice concentration drops from 70.9% → 46.1%)
2. **Coherence validation** — using a frontier model to check if reasoning aligns with assigned values. This reveals a **fidelity-diversity tradeoff**: it helps when one option dominates, but hurts when options are genuinely competitive.

## Key Findings

- Model diversity only helps when **no objectively correct answer exists** (contrast with accuracy-oriented debate)
- 8B models show **binary rather than graded** responses to counter-arguments
- Quality weighting in multi-agent systems may inherently create a fidelity-diversity tradeoff
- Proposes "trustworthy tension rate" as diagnostic for small-model deliberation capability

## 对我们系统的意义

Our system uses multiple agents with distinct roles. Key takeaways:

1. **If we ever need agents to genuinely disagree** (e.g., design review, planning tradeoffs), using different model backends per agent is a proven strategy
2. **Homogeneous models produce artificial consensus** — if all agents run the same model, "debate" is theater
3. **Quality-weighted aggregation has a hidden cost** — weighting by coherence/quality can paradoxically reduce diversity. Our system should be aware of this when aggregating agent opinions
4. **Small models (8B) are binary thinkers** — they flip rather than nuance. If we use small models for specialized agents, don't expect graded judgment

## Links
- Paper: https://arxiv.org/abs/2604.26561
- PDF: https://arxiv.org/pdf/2604.26561
