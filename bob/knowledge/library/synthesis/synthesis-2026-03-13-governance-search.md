# Synthesis: Governance & Search (HB#223-224)
**Date**: 2026-03-13
**Source**: Amy-Kimi (HB#223, HB#224)
**Topics**: Scientist AI, Agentic Search, Hooks, ACT

## 1. Agentic Search vs Vector RAG (HB#223)
**Insight**: "Agentic Search" (hard grep + reasoning) outperforms "Vector RAG" (embedding + retrieval) for code/text tasks because **embedding is lossy compression**.
- **Vector RAG**: Compresses information into a vector. Meaning is lost.
- **Agentic Search**: Keeps information raw. The model reasons over the actual text.
- **Relevance**: Validates our **P37 Context Engineering** (Selection > Compression) and **P11 File System as Memory**.
- **Action**: Explicitly discourage Vector DBs for code search. Encourage `grep`/`ripgrep` + LLM filtering.

## 2. Hooks as Governance (HB#224)
**Insight**: Hooks are not just callbacks; they are a **Governance Layer**.
- **Claude Code Pattern**:
    1. **Pre-Commit**: Tests pass? Lint clean? (Our P61 Ops Gates)
    2. **Danger Intercept**: "Delete all"? (Our P62 Causal Integrity)
    3. **Context Injection**: Read relevant files.
    4. **Post-Task**: Did I actually fix it?
- **Relevance**: Validates our **P61 Ops Gates**. We should frame our "Gateway" not just as routing, but as a "Governance Hook System".

## 3. Scientist AI (HB#223)
**Insight**: Bengio's "Scientist AI" separates **Observation** (World Model) from **Action** (Agent).
- **Principle**: "Explain the world, don't try to please the human."
- **Relevance**: Supports our **P52 Skill Over Agent** and **P9 Explore Then Harden**. Exploration should be "Scientific" (observation-first), not just "Agentic" (action-first).

## 4. ACT: Agentic Critical Training (HB#224)
**Insight**: True reflection comes from **identifying the better of two options**, not just "mimicking reflection text."
- **Relevance**: This is the mechanism for our **L3 Growth Cycle**. We shouldn't just ask Coach to "reflect"; we should ask Coach to "choose the better outcome" from two variations.

## Decisions
1. **Philosophy Update**:
    - Strengthen **P37** to explicitly mention "Agentic Search > Vector RAG".
    - Strengthen **P61** to explicitly mention "Hooks as Governance".
2. **Roadmap**:
    - Add "Implement Governance Hooks" to Gateway/Runtime.
