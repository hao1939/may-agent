# Synthesis: Skill vs. Experience (Dual-Track Learning)
**Date:** 2026-05-15
**Pattern:** Dual-Track Learning / Functional Differentiation
**Principle:** P59 Hybrid Architecture / Skill > Experience

## The Signal
The "XSkill" (HB#390) and "SAGE" (HB#417) research confirms a crucial **Dual-Track Learning** paradigm that we have only partially implemented.

## The Consensus
1.  **Skills are Process (Methods)**: "How to run a test," "How to search the web." Structured, reusable, general.
    *   **OpenClaw**: `agents/shared/skills/` (L2).
2.  **Experiences are Instance (Data)**: "Yesterday I tried X and failed because Y," "Last time, Z worked well." Specific, context-dependent, corrective.
    *   **OpenClaw**: `agents/bob/workspace/journal.md`, `ERROR_LOG.md` (L3).
    *   **Gap**: We treat these as logs, not *learning artifacts*.

## The Insight: SkillRL (HB#417)
SkillRL proves that Skills are not static scripts but *learnable policies*.
*   **Sequential Rollout**: Skills evolve by accumulating *success/failure chains*.
*   **Skill-Integrated Reward**: Skills get "better" (higher reward) based on their efficiency.

## The Diagnosis: Passive Skill Fallacy
We have skills, but they are static.
*   **Problem**: Agents treat skills as "commands to execute" (Tool), not "methods to improve" (Process).
*   **Result**: Agents repeat the same mistakes *inside* a skill because the skill definition never changes.

## Strategic Implication
We must transition from **Static Skills** to **Evolving Skills** (via L3 Feedback Loop).
1.  **Skill Versioning**: Skills must have versions (v1, v2).
2.  **Experience Replay**: Not just a "check the log" command, but a structural part of *loading* a skill.
    *   Example: When loading `git_commit`, the agent *automatically* sees the last 3 failures.
3.  **Skill Optimization**: Use Evaluator to identify "Brittle Skills" (high failure rate) and propose structural fixes.

## Actionable
-   **Rename**: Update `philosophy.md` to formalize **Dual-Track Learning** (Process vs. Data).
-   **Implement**: Tech-Lead to explore "Skill Versioning" or "Skill Context Injection" (automatically prepending relevant error logs to skill prompts).
-   **Prioritize**: SkillRL investigation (HB#417) for future roadmap.
