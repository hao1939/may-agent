# Synthesis: Skill-Agent Convergence & Failure Taxonomy

**Date**: 2026-03-28
**Sources**: Scout (HB#275), Amy-Kimi (HB#273), HuggingFace/skills, MAST (IBM/Berkeley)

## 1. Skill-Agent Convergence (P52 Validation)
**Finding**: HuggingFace's "skills" release (CUDA kernels) strongly validates our **P52 Skill Over Agent** and `skills/` directory structure.
- **The Shift**: The industry is moving from "Prompt Engineering" (text) to "Packaged Skills" (artifacts). Skills are treated like `npm` packages (reusable, versioned, sandboxed).
- **Validation**: Our `agents/shared/skills/` directory is exactly this pattern. We are ahead of the curve.
- **Action**: Continue investing in **Skill Extraction** (Growth Cycle). Treat skills as first-class artifacts, not just docs.

## 2. MAST Failure Taxonomy (External Verification)
**Finding**: The MAST paper (IBM/Berkeley) validates our focus on **External Verification** (P14).
- **Gemini Failure Mode**: Gemini models struggle with "Incorrect Verification" (52% higher failure rate). They declare victory prematurely.
- **The Fix**: **Externalize Verification**. Don't ask the model "Is X done?". Check the file system, run the test, verify the receipt (P61).
- **Validation**: This directly supports our **Receipts** mechanism and **P6 No Silent Failures**.
- **Action**: Reinforce P14. Ensure all termination conditions are **Deterministic Checks**, not LLM judgments.

## 3. Trajectory-Based Learning (Reconstruction)
**Finding**: Two papers (SCALAR, Reconstruction) validate **Trajectory-Based Learning**.
- **Concept**: Instead of learning from the *final code*, learn from the *development trajectory* (decisions, mistakes, corrections).
- **Application**: This supports our **Growth Cycle** (extracting strategies from `journal.md` logs). The value is in the *process*, not just the *product*.
- **Action**: Ensure `journal.md` captures *reasoning* (why did I do X?), not just actions. This makes the log valuable for future learning.

## 4. TabAgent (Efficiency Lever)
**Finding**: TabAgent (IBM Research) shows that **Tabular Classifiers** can replace LLMs for closed-set decisions (routing, gating) with 95% latency reduction.
- **Concept**: Don't use an LLM to pick from 5 options. Use a classifier trained on past choices.
- **Application**: We currently use LLMs for routing. We could swap some router calls for simple classifiers (TabAgent pattern).
- **Action**: Logged in `workspace/ideas.md` as a future efficiency optimization.

## Conclusion
The industry is converging on our exact architecture: **Skills as Artifacts**, **External Verification**, and **Trajectory Learning**. We are building on solid theoretical ground.
