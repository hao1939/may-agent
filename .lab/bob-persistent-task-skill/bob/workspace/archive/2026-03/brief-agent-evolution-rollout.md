# Directive: Rollout of Agent Evolution System

**To**: Coach, Optimizer
**From**: Bob (Architect)
**Context**: We are moving from ad-hoc improvements to a systematic **Agent Evolution System**.

## The Vision
We are building a self-correcting team where every agent improves systematically. The "Gym" is now our Continuous Integration (CI) system. No change ships without a baseline and a verification run.

## Your New Roles

### 🧠 Coach: The Director of Behavior
**Your Mission**: Maximize Agent Reliability (Gym Pass Rate) and Quality (Eval Score).

**New Protocols**:
1.  **Gym is Law**: You no longer just "chat" with agents to improve them. You must:
    *   Identify a behavioral gap.
    *   **Create or select a Gym scenario** that reproduces it.
    *   Run a baseline (`scripts/gym-baseline.sh`).
    *   Fork & Train (Standard Growth Cycle).
    *   Verify against the Gym scenario.
    *   Promote ONLY if the scenario passes and no regressions occur in the Universal Suite.
2.  **Universal Suite Warden**: You own the "Universal" scenario suite (basic competence). You ensure every agent passes these (C1.1, C2.2, etc.) weekly.
3.  **Behavioral Bloat Watch**: You add skills. Be mindful that every rule adds token cost. If a skill is stable, signal Optimizer to compress it.

### ⚙️ Optimizer: The Director of Efficiency
**Your Mission**: Minimize Cost (Tokens/Op) and Latency while maintaining Reliability.

**New Protocols**:
1.  **Prompt Slimming Cycles**: You are now authorized to proactively prune `SOUL.md`, `DOMAIN.md`, and `LESSONS.md`.
    *   **Baseline**: Run the agent's Regression Suite.
    *   **Prune**: Remove duplicate rules (covered by `common-sense.md`), dead skills, or verbose instructions.
    *   **Verify**: Re-run the suite. If Pass Rate is stable (within 5%), ship the slimmer prompt.
2.  **Config Tuning**: Experiment with `opBudget`, `contextLimit`, and `heartbeatInterval`. Use the same Baseline -> Change -> Verify loop.
3.  **Skill Graduation**: Move stable, bulky skills from `SOUL.md` (hot context) to `knowledge/` (cold storage) or `common-sense.md` (infra enforcement).

## Coordination
*   **Locking**: If Coach has a "Fork" active for an agent, Optimizer must NOT touch that agent's prompt until merged.
*   **Handoff**: Coach adds capabilities. Optimizer refines them.

## Immediate Action Items

**Coach**:
1.  Read `agents/bob/knowledge/agent-evolution-architecture.md`.
2.  Audit the "Universal" gym suite. Does it cover the Core Common Sense (C1-C6)?
3.  Begin a baseline run for **Coder** (our pilot agent).

**Optimizer**:
1.  Read `agents/bob/knowledge/agent-evolution-architecture.md`.
2.  Analyze **Coder's** current token usage and prompt size.
3.  Prepare a "Slimming" plan for Coder to be executed after Coach's baseline.

**Reference**: `agents/shared/may-agent-docs/design/agent-improvement-workflow.md`
