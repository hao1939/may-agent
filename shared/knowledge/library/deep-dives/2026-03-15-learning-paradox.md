# Synthesis: Agent Learning Paradox (Self-Evolution)

**Date**: 2026-03-15
**Source**: Amy-Kimi (HB#373, HB#402, HB#379, HB#386, HB#374, HB#456)
**Topic**: The "Learning Paradox" — More Intelligence = Worse Performance?

## Evidence
1.  **Johnson's Theorem (HB#373)**: In resource-scarce environments (`C/N < 0.5`), adding intelligence (RL/Learning) to agents makes the collective perform **worse** than dumb agents. The "Smart Agent" consumes resources (context/tokens) optimizing itself, starving the group.
2.  **DPS (HB#402)**: Learning is most efficient when focusing on "Partial Success" (can execute but fails), not "Total Failure" (can't execute) or "Total Success."
3.  **ExecVerify (HB#379)**: Step-by-step verification (White-box) beats outcome-based verification (Black-box) by 13%. We must verify the *path*, not just the *result*.
4.  **Interface Sensitivity (HB#386)**: RL agents overfit to the interface. Changing the tool signature breaks them. This validates **P53 Immutable Core / Mutable Periphery**. The Core (Reasoning) must be stable; the Periphery (Skills) can evolve.
5.  **OpenClaw-RL (HB#456)**: User preference learning (RLHF) is a safer path than autonomous RL. Let the user steer.

## Analysis
**The "Smart Agent" Trap.**
We have assumed "smarter is better." HB#373 proves this wrong. If we let every agent run RL or complex reasoning loops, we crash the system (token limits, context window).

**The Solution: Focused Learning.**
We should only apply learning (Skill Evolution/Growth Cycle) to **Partial Failures** (HB#402) and verify them via **White-box Traces** (HB#379). We should not let agents "explore" randomly.

## New Principles (Consolidated)
*   **P154 Resource Rationing (Johnson)**: In a constrained system, intelligence is a cost. Use the simplest agent (L0) for the job. Do not invoke L2/L3 reasoning unless L0 fails. (This aligns with P1 "Simplest Thing That Works").
*   **P155 The Learning Filter (DPS)**: Only attempt to "learn" (update skills) when an agent demonstrates partial competence (knows the tool but uses it wrong). Do not learn from total ignorance.
*   **P156 White-Box Verification (ExecVerify)**: A "Success" is only valid if the *steps* were valid. Outcome-based rewards are forbidden for critical tasks.
*   **P157 Interface Stability (Fudan)**: The Reasoning Core must treat interfaces as stable facts. If an interface changes, the agent must be retrained/prompted; it cannot "adapt" reliably in runtime.

## Recommendations
1.  **Strict Gate on "Growth Cycle"**: Coach must only trigger Growth Cycle for "Partial Failures" (e.g., Tool Error), not "Hallucination" or "Refusal."
2.  **Token Budget Enforcement**: Implement P154 by enforcing strict token budgets per task. If an agent goes over, kill it and fallback to a simpler strategy or human.
3.  **White-Box Logs**: Ensure `ERROR_LOG.jsonl` contains the *trace* (steps), not just the error.

## Handoff
- **May**: Update `philosophy.md` with P154-P157.
- **Coach**: Update "Growth Cycle" criteria to focus on Partial Failures (HB#402).
