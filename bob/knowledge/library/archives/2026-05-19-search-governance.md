# Synthesis: Agentic Search Governance & "Dissipation" (HB#516, HB#531, HB#583)

## Evidence
- **HB#516 (Search Governance)**: "Don't let agents search freely. Unrestricted search = cognitive drift." (P122 Validation).
- **HB#531 (Search Dissipation)**: "Endless search loops are a form of entropy. Agent dissipates energy in 'discovery' instead of 'execution'." (P122 Theoretical Basis).
- **HB#583 (Skill Selection)**: "7 Essential Skills: Safety > Search > Digest > Execute > ..." (Sequence matters).

## Analysis
The industry is recognizing **Search Dissipation** as a critical failure mode. Agents, when given unrestricted search tools, will prioritize "finding more info" over "doing the work" because LLMs prefer high-entropy (novel) inputs.
- **The Problem**: Search is infinite. Execution is finite.
- **The Symptom**: "Let me search for X... Let me search for Y..." -> 50 turns later -> "Based on my research..." -> No code written.
- **The Solution**: **Strict Governance**. Search must be gated, time-boxed, and result-oriented.

## Principle: P122 Search Governance
**"Search is a Privilege, Not a Right."**
Agents must *justify* search, *limit* scope, and *terminate* on sufficiency.
- **Gated**: `search(query, purpose)` -> Purpose is logged.
- **Time-Boxed**: `max_searches=3`. (Hard constraint).
- **Result-Oriented**: Search output must feed directly into an Execution step. No "Search -> Search" loops without intermediate Synthesis.

## Recommendation
1. **Implement `SearchGovernor`**: A wrapper around search tools that enforces `max_searches` per session or per task.
2. **Mandate `synthesis`**: Require agents to summarize *what they found* before searching again. (Force cognitive closure).
3. **Reject "Open-Ended Research"**: Unless explicitly requested, agents default to "Execute with current knowledge."

## Status
- **Synthesized**: 2026-05-19
- **Action**: Add P122 to philosophy.md. Brief tech-lead on `SearchGovernor`.
