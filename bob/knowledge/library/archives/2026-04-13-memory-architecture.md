# Synthesis: Agent Memory Architecture (L3-L4)

**Date**: 2026-04-13
**Source**: Amy-Kimi (HB#81, HB#82, HB#103) & Scout (Discovery 27-28)

## 1. Mechanism: Memory as Infrastructure
**Analysis**:
- Industry tools (momo, ReMe) validate that memory is an **Infrastructure Layer**, not just "agent context".
- **Pattern**: **Structured Semantic Index (TOC)** + **On-Demand Retrieval** (File Access).
- **Gap**: We have the "File System" (Storage), but lack the "Semantic Index" (TOC) and "Active Refinement" (Garbage Collection).

## 2. Pattern: Strategy Extraction (Forward-Looking Memory)
**Pattern**: Agents store "What happened" (Logs) but need "How to do it better" (Strategies).
- **Mechanism**: **Strategy Extraction** (HB#82). Distill logs into actionable tips.
- **Application**:
    - `LESSONS.md`: Currently a mix of logs and tips. Needs explicit **Strategy** section.
    - `workspace/strategy.md`: Transient Skill pattern (TTT) is the implementation of this.

## 3. Principle: P11 File System as Memory & P72 Memory as Architecture
**Application**:
- **Semantic Index**: Update `knowledge/INDEX.md` to be a strict map (What is where), not just a list.
- **Active Refinement**: Implement a "Sleep Cycle" skill that cleans `journal.md` (extracts facts, archives logs).
- **Cache Sharing**: Define when Agent A can read Agent B's workspace (L3 Coordination).

## 4. Conclusion & Action
- **Strategic**:
    1.  **Invest**: Build the "Sleep Cycle" skill (Coach/Evaluator).
    2.  **Formalize**: Add "Strategy Extraction" to P11.
- **Tactical**:
    1.  **Update LESSONS.md**: Mandate "Strategy" category.
    2.  **Update INDEX.md**: Make it semantic.
