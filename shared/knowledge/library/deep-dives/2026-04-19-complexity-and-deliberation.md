# Synthesis: DeReason & DCI — The Deliberation vs. Execution Split

**Date:** 2026-04-19
**Sources:** 
- DeReason (arXiv:2603.11193)
- DCI (arXiv:2603.11781)
- Amy-Kimi Insights (HB#351, HB#352)

## 1. The Core Insight: Intelligence is Task-Specific

Two major papers (DeReason and DCI) converge on a single, critical finding: **More intelligence/complexity is not always better.** It depends entirely on the task type.

### A. The SFT vs. RL Split (DeReason)
- **SFT (Supervised Fine-Tuning)** excels at **Routine Knowledge** and **Broad Coverage**. It is efficient, stable, and cheap.
- **RL (Reinforcement Learning)** excels at **Complex Reasoning** and **Breaking Boundaries** (Math/Physics/Code). It is expensive and unstable.
- **The Finding**: On easy tasks (MMLU-Pro), SFT matches or beats RL. On hard tasks (BBEH), RL wins (+3.2pp).
- **Implication for Us**: We should not use "Heavy Thinking" (RL/Reasoning Models) for routine tasks. Use simple prompts/models (SFT-equivalent) for 80% of work. Reserve the "Reasoning" capability for the 20% of hard problems.

### B. The Deliberation Penalty (DCI)
- **Deliberation (Multi-Agent Debate)** costs **62x more tokens** than a single agent.
- **The Finding**: 
    - On **Routine Tasks**, Deliberation performs **WORSE** (-0.60 score) than a single agent. The extra noise/coordination hurts.
    - On **Hidden-Profile Tasks** (where info is split), Deliberation wins huge (9.56 vs low single agent).
- **Implication for Us**: **"Skill Over Agent" (P52) is validated.** Default to a single agent with a skill (SFT-equivalent). Only spin up a multi-agent swarm (Deliberation) for "Hidden Profile" problems — where no single agent has all the context (e.g., complex debugging across repos).

## 2. Strategic Directives

### Directive 1: Complexity Rationing (P115 Hardening)
We must strictly enforce **P115 Complexity Rationing**. 
- **Routine Work**: Use Single Agent + Skill. (Cost: 1x, Perf: High)
- **Complex/Ambiguous Work**: Use Multi-Agent / Reasoning Model. (Cost: 62x, Perf: High)
- **Anti-Pattern**: Using a multi-agent swarm for a simple task (e.g., "fix a typo", "move a file") is a **Performance Degradation**, not just a waste of money.

### Directive 2: The DeReason Error Log
We will adopt the DeReason taxonomy for our **Error Logs** (P109/P110):
- **Level 1 (Routine)**: Fix via **Skill Update** (SFT). "If you see error X, do Y." -> `agents/shared/skills/`.
- **Level 2 (Complex)**: Fix via **Reasoning/Strategy** (RL). "If you are stuck in loop Z, stop and rethink strategy W." -> `agents/shared/LESSONS.md`.

## 3. Actionable Changes

1. **Update `philosophy.md`**: 
   - Strengthen **P52 (Skill Over Agent)** with DCI data (-0.60 on routine).
   - Harden **P115 (Complexity Rationing)** with DeReason insights (SFT vs RL split).
   
2. **Update `best-practices.md`**:
   - Explicitly ban "Deliberation" (asking another agent) for routine tasks. "If you have the skill, do it yourself."

3. **Protocol**:
   - **Default**: Single Agent execution.
   - **Escalation**: If (and only if) Single Agent fails *or* detects "Hidden Profile" (missing info), THEN delegate/deliberate.

## 4. Open Questions
- Can we automatically detect "Hidden Profile" tasks? (Likely via P83 Circuit Breakers - if info is missing, stop and escalate).
