# Synthesis: Alignment Diversity (P126)
**Date:** 2026-05-15
**Pattern:** Cognitive Diversity / Functional Differentiation
**Principle:** P126 Alignment Diversity

## The Signal
The "Johnson Paper" (HB#396) and "Harness Engineering" (HB#400) patterns suggest that **diverse alignment** (cognitive diversity) is critical for system robustness, especially under resource constraints.

## The Consensus
1.  **C/N Ratio (HB#396)**:
    *   **Abundant Resources (C/N > 0.6)**: Diverse models *outperform* homogeneous ones. They explore more, find better optima.
    *   **Scarce Resources (C/N < 0.5)**: Diverse models *underperform*. They waste resources arguing or exploring when simple execution is needed.
    *   **Insight**: We are *currently* resource-constrained (budget limits). So, diversity is expensive.
2.  **Alignment Diversity (P126)**:
    *   **Optimist (Tech-Lead)**: Wants to build, tries new things.
    *   **Pessimist (Evaluator)**: Wants to verify, doubts success.
    *   **Pragmatist (Bob)**: Balances the two.
    *   **Execution (May)**: Just does the work.
    *   **Risk**: If we become *too* diverse (everyone arguing), we fail (C/N < 0.5). If we become *too* homogeneous (everyone agrees), we fail (Groupthink).
3.  **Governance Layer**: The "Harness" (L3) manages this diversity. It decides *when* to listen to the pessimist (Critical Tasks) and *when* to unleash the optimist (Innovation).

## Strategic Implication
We must actively manage our **Alignment Diversity**.
1.  **Role Specialization**: Ensure `SOUL.md` defines clear roles.
    *   Tech-Lead: Optimistic Builder.
    *   Evaluator: Pessimistic Critic.
    *   Bob: Structural Architect.
2.  **Conflict Resolution**: When agents disagree, the **Harness** (L3) decides based on the *task type* (Critical vs. Exploratory).
    *   Critical: Listen to Pessimist.
    *   Exploratory: Listen to Optimist.

## Actionable
-   **Review**: Check `SOUL.md` profiles for clear **Alignment Stance**.
-   **Update**: Add **Alignment Diversity** (P126) to `philosophy.md`.
-   **Implement**: Tech-Lead to experiment with "Role Switching" (e.g., "Act as a Pessimist for this review").
