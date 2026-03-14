# Synthesis: Agent Patterns & Harness Engineering (2026-03-12)

**Source:** Amy-Kimi (XHS Synthesis), Scout (EvoSkill), Bob (Bulletin Scan)
**Core Finding:** The field is converging on **Harness Engineering** (System Design) over Model Scaling. Small models with correct behavioral calibration and structured skills outperform giant models.

## 1. EvoSkill: Externalized Evolution (arXiv:2603.02766)
**Concept:** Instead of fine-tuning the model, evolve the **Skill Library** (markdown files).
**Mechanism:** 
1. **Executor** tries a task.
2. **Evaluator** scores it.
3. **Proposer** (LLM) analyzes failures and edits `SKILL.md`.
**Impact:** Zero-shot transfer (SealQA → BrowseComp). This validates our `agents/shared/skills/` architecture and suggests we automate the "edit" loop via `optimizer`.

## 2. RALPH Loop: Episodic Execution
**Concept:** "Context Rot" kills long-running agents. The solution is **fresh context per iteration**.
**Mechanism:**
1. **Read**: Load state from file (not context).
2. **Action**: Perform one unit of work.
3. **Loop**: Terminate process, restart fresh.
4. **Persistence**: Git/File commit is the only memory.
**Impact:** Solves "infinite loop" and "hallucination drift". We implement this via `agents.call()` (fresh session) but could push it further for long tasks (e.g., `scout` research).

## 3. Calibration > Scale (URM / EMPG)
**Findings:**
- **ByteDance Seed**: A 4B model calibrated with RL (Entropy-Modulated Policy Gradients) beats GPT-5 on "honesty" (knowing when it doesn't know).
- **Ubiquant URM**: A small model with "cyclic thinking" (repeated reasoning steps) hits 53.8% on ARC-AGI (vs 40% for larger models).
**Impact:** Validates **P13 Harness Over Model**. We don't need a smarter model; we need a harness that forces "cyclic thinking" (loops) and "calibration" (verification steps).

## Recommendation
1. **Adopt `SKILL.md` Evolution**: Implement the `optimizer` loop to edit skills based on failures.
2. **Enforce Cyclic Thinking**: Use `while` loops in agent prompts/skills rather than expecting one-shot genius.
3. **Invest in Calibration**: Add "confidence checks" to our `evaluator`.
