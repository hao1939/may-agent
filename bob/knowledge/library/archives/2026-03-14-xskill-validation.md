# Synthesis: XSkill & P114 Experience Replay
**Date:** 2026-03-14
**Source:** arXiv:2603.12056 (XSkill)
**Related Principles:** P114 (Experience Replay), P52 (Skill over Agent), P121 (Dual-Track Learning)

## The Insight
The XSkill paper (Jiang et al., ICML 2026) provides rigorous theoretical and empirical validation for our **Dual-Track Learning** architecture (P121).

It explicitly bifurcates agent knowledge into two distinct streams:
1. **Experiences (Tactical/Specific)**: "Concise, action-level tactical guidance for tool selection and error recovery." (e.g., "When using `grep` on large files, use `head` first.")
2. **Skills (Strategic/General)**: "Structured, task-level workflows and reusable tool templates." (e.g., "How to perform a security audit.")

## Validation of Our Architecture
Our current system maps 1:1 to this framework:

| XSkill Component | Bob System Component | Implementation |
|------------------|----------------------|----------------|
| **Experiences** | **P114 Experience Replay** | `ERROR_LOG.md`, `LESSONS.md` (JSON/Markdown logs of failures and fixes) |
| **Skills** | **P52 Skill Library** | `agents/shared/skills/*.md` (Structured Markdown workflows) |
| **Accumulation** | **Meta-Loop / Synthesis** | Bob's periodic synthesis of `ERROR_LOG` into `LESSONS` or new Skills |
| **Retrieval** | **Active Recall (P110)** | `grep` based retrieval before complex tasks |

## Critical Gaps Identified
While our structure aligns, XSkill highlights two gaps in our implementation:

1. **Visual Grounding**: XSkill relies heavily on *visual* context for experience retrieval. We are text-only. This limits our ability to detect "visual" state failures (e.g., UI layout bugs), though less relevant for backend coding.
2. **Dynamic Injection**: XSkill injects adapted knowledge as *reference*, not instruction. Our `experience-replay` skill effectively does this (by reading logs), but we lack the "Cross-Rollout Critique" step where successful and failed trajectories are compared to *generate* the experience. currently, we rely on the agent to self-report errors.

## Actionable Recommendations
1. **Formalize the Split**: Ensure `agents/shared/skills/` remains "Strategic/Workflow" only. tactical "don't do X" knowledge belongs in `LESSONS.md` or `ERROR_LOG.md`.
2. **Automate Critique**: We need a process (Evaluator?) that compares failed vs successful sessions to generate `LESSONS.md` entries, rather than relying on the agent's own error logging (which can be hallucinated or skipped).
