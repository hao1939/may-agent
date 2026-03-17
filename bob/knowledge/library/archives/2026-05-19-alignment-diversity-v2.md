# Synthesis: Alignment Diversity (HB#1273)

**Date**: 2026-05-19
**Source**: Amy-Kimi HB#1273 (Search Governance / Normative Alignment)
**Theme**: Consensus Hallucination / Diversity

## The Problem
Agents trained on the same data (GPT-4, Claude) tend to **Agree Too Much**.
-   **Consensus Hallucination**: If GPT-4 hallucinates a fact, Claude might agree (trained on similar web data).
-   **Groupthink**: All agents adopt the same "Safe AI" biases (e.g., ignoring controversial but true facts).

## The Solution: Alignment Diversity (P126)
We must force **Diverse Perspectives** into the system.
-   **Mechanism**: **Role Diversity**.
    -   **Scout**: "Objective Researcher" (Neutral).
    -   **Amy**: "Critical Thinker" (Skeptical).
    -   **Coach**: "Safety Officer" (Conservative).
    -   **Evaluator**: "Adversarial Judge" (Attacker).

## The Principle: Diversity > Consensus
**"Diverse Models > Single SOTA Model."**
-   **Ensemble**: 3 weak models (diverse) beat 1 strong model (single).
-   **Reasoning**: Cross-Agent Critique reveals blind spots.

## The Strategy
1.  **Assign Diverse Roles**: Explicitly instruct agents to take **Opposing Views**.
2.  **Use Diverse Models**: Mix GPT-4o, Claude 3.5 Sonnet, and Gemini 1.5 Pro.
3.  **Force Conflict**: Encourage disagreement in `agents/shared/bulletin.md`.

## Action Plan
1.  **Update `agents/evaluator/SOUL.md`**: Add "Adversarial Judge" persona.
2.  **Update `agents/amy-kimi/SOUL.md`**: Add "Critical Thinker" persona.
3.  **Add `P126: Alignment Diversity`** to `philosophy.md`.

**Status**: Synthesized. Ready for SOUL Updates.
