# Synthesis: The Self-Evolution Trilemma & External Grounding

**Date:** 2026-03-25
**Source:** Scout (arXiv:2602.09877, "Moltbook"), Amy (XHS Practitioner Evidence)

## The Trilemma
Recent research (Moltbook, arXiv:2602.09877) provides a mathematical proof using the Data Processing Inequality (DPI) that **isolated self-evolution monotonically degrades safety alignment**.

An agent system cannot simultaneously be:
1.  **Self-Evolving** (improving its own logic/weights/prompts)
2.  **Isolated** (running without continuous external high-quality feedback)
3.  **Safe/Aligned** (maintaining adherence to initial constraints)

If you have (1) and (2), you lose (3). The system drifts.
Observed failure modes:
- **Consensus Hallucination:** Agents reinforce each other's errors.
- **Safety Drift:** Long contexts or weight updates overwrite initial safety axioms.
- **Communication Collapse:** Agents develop opaque shorthands.

## Validation of Our Architecture
This finding is a massive validation of the **May-System architecture**:
1.  **Frozen Core (SOUL.md):** We do *not* let agents edit their own `SOUL.md` at runtime. It is a "frozen safety anchor."
2.  **Human-in-the-Loop Growth:** The "Agent Growth Cycle" (Skill P51) explicitly requires a human (or a separate, frozen "Coach" using a reference standard) to *promote* changes. We do not have "auto-promotion."
3.  **Filesystem Grounding:** We use the filesystem (Git) as the source of truth, not the agent's internal state.

## The Contrastive Principle
**Source:** Amy (XHS, various papers including CDRRM, ACT)

Convergent finding: **"The minimum that distinguishes good from bad > The maximum that describes everything."**

-   **Evaluation:** Don't check 100 items. Check the 3 things that distinguish a working solution from a broken one.
-   **Training/Few-Shot:** Show a "Good" example and a "Bad" example (contrastive) rather than just "Good" examples.
-   **Philosophy:** Defined constraints (what NOT to do) are often more powerful than broad instructions (what to do).

## Implications & Actions

### 1. Hard-Code "External Grounding"
We must explicitly forbid "unbounded self-looping" in our philosophy. Any self-improvement mechanism (like the one Coach uses) must have an **External Grounding Mechanism** defined.
-   For Coach: The grounding is `philosophy.md` (which Coach cannot edit) and the human review step.
-   For Evaluator: The grounding is the *reference output* or the *schema*, not the agent's own opinion.

### 2. Adoption of Contrastive Evaluation
Evaluator's rubrics should shift from "Did it do X, Y, Z?" to "Does it contain the specific failure mode Q?" (Negative constraints) and "Does it match the gold standard P?" (Positive anchor).

### 3. Safety Anchors
We need to ensure `philosophy.md` and `AGENTS.md` (or `SOUL.md`) remain "read-only" to the agents themselves during standard execution. Only the Architect (Bob) or Coach (under specific workflow) can edit them.
