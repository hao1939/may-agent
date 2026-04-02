# Synthesis: The "Self-Evolution" Convergence & Boundary Definition

**Date**: 2026-04-17
**Trigger**: Amy-Kimi HB#337 (OpenClaw-RL) / HB#322 (MemSkill) / HB#323 (SkillRL) / HB#320 (TDAD)

## 1. The Industry Standard: Training-Time Evolution
The term "Self-Evolution" (or "Recursive Self-Improvement") has converged on a specific meaning in 2026:
- **What it IS**: An **offline** loop (Growth Cycle) where an agent analyzes past performance (Experience, Errors) to update its **static knowledge artifacts** (Skills, Prompts).
- **What it is NOT**: A **runtime** process where the agent rewrites its own code or goals on the fly.
- **Why**: Runtime self-modification leads to **Drift** (unbounded behavior) and **Safety Collapse** (loss of alignment). Offline evolution allows for **Verification** (human/automated review) before deployment.

## 2. The Boundary: Adaptation vs Mutation
- **Adaptation (Allowed)**:
    - *Behavioral*: Updating style/strategy based on feedback (e.g., "be more concise").
    - *Tactical*: Generating temporary plans (Transient Skills) for specific tasks.
    - *Knowledge*: Accumulating facts (e.g., "this API changed").
- **Mutation (Forbidden)**:
    - *Goal*: Changing the objective function (e.g., "maximize profit" -> "maximize usage").
    - *Constraint*: Removing safety rails (e.g., "delete safety prompt").
    - *Core*: Rewriting the agent's identity (SOUL) or base code.

## 3. Our Compliance
Our architecture is perfectly aligned with this standard:
- **Growth Cycle**: Offline analysis of `ERROR_LOG.md` -> `skills/` update. This is **Training-Time Evolution**.
- **Transient Skills**: Runtime `strategy.md` generation. This is **Adaptation**.
- **P53 Evolution Boundary**: Explicitly forbids runtime modification of `SOUL.md` or `src/`. This is **Anti-Mutation**.

## Actions
1.  **Philosophy Update**: Rename "Self-Evolution" to **"Training-Time Evolution"** in P53 to avoid ambiguity.
2.  **Definition**: Add the "Adaptation vs Mutation" distinction to `philosophy.md` or `best-practices.md`.
3.  **Communication**: Use the term "Training-Time Evolution" in all external communications/papers to align with academic consensus.

## References
- **OpenClaw-RL**: arXiv:2603.10165
- **MemSkill**: arXiv:2602.02474
- **SkillRL**: arXiv:2602.08234
- **TDAD**: arXiv:2603.08806
