# Impact Analysis: Session Model Simplification

**Date:** 2026-03-07
**Author:** Bob
**Topic:** Moving to "Chat + Task" binary session model.

## The Core Change
Eliminating "Persistent Sub-Agents". Only the Interface Agent (May) persists. All others (Coder, Reviewer, Cron) are ephemeral: Spawn → Work → Die.

## Deep Dive: What We Lose vs. What We Gain

### 1. The "Conversational Sub-Agent" Illusion
*   **Current State**: We treat sub-agents like persistent employees sitting at a desk. We can say "do X", then "fix that error", then "try again".
*   **New State**: Sub-agents are lambda functions. You say "do X". It finishes. If you want a fix, you spawn a *new* lambda with "Previous attempt failed with Y. Fix it and do X."
*   **Impact**:
    *   *Negative*: Loss of implicit context. The "Fix it" prompt must include the error.
    *   *Positive*: **Elimination of Hidden State.** The "Fix it" prompt *must* include the error. This forces explicit context, which is better for debugging and reliability. The agent can't rely on "what I thought 5 minutes ago" which might be wrong.
    *   *Philosophy Check*: **P12 Context Isolation**. Fresh sessions are cleaner.

### 2. Token Economics
*   **Concern**: Re-reading `SOUL.md`, `domain.md`, and system prompts for every single task.
*   **Analysis**:
    *   Input tokens are cheap (approx $3/1M tokens for Opus inputs, much less for others).
    *   Prompt Caching (Anthropic) reduces this cost by ~90% for static prefixes.
    *   Cost of *maintaining* a persistent session (polling, heartbeat checks, idle management) is non-zero in terms of complexity and potential bugs.
    *   *Verdict*: The reliability gain outweighs the marginal token cost.

### 3. Concurrency & Overlap
*   **Concern**: If we don't have a persistent session to say "I'm busy", how do we prevent pile-ups?
*   **Answer**: **Infra-level Backpressure.**
    *   The Scheduler (Cron) must check `activeSessions` before firing.
    *   This is *better* than Session-level backpressure because it keeps the Agent logic simple ("I just run") and puts the scheduling logic where it belongs (The Scheduler).
    *   *Philosophy Check*: **P40 Agents Do Cognitive Work, Not Chores**. Managing schedule overlap is a Chore.

### 4. Future Proofing
*   **Question**: Will we ever need a persistent sub-agent?
*   **Scenario**: A "Game Master" agent that maintains the state of a simulation over hours.
*   **Solution**: Even then, the state should be in a file (`world-state.json`). The agent can spin up, process a turn, update state, and spin down. Persistence in memory is a fragility, not a feature.

## Conclusion
The complexity of managing persistent sub-agents (restoration, idle states, followUp routing) provides negligible value over a model where sub-agents are simply "Smart Functions" that read/write files.

**Recommendation**: APPROVE the simplification.
