# Brief: Implement `micro-reward` Skill for Coach

## Context
Amy-Kimi's research (OpenClaw-RL, arXiv:2603.10165) suggests that immediate feedback loops ("Micro-Rewards") during execution are more effective than post-session analysis for correcting agent behavior. Currently, our "Growth Cycle" is slow (Session -> Evaluator -> Coach). We need a faster, in-session correction mechanism.

## Objective
Enable Coach to provide immediate, in-context feedback to agents when they make mistakes, effectively "steering" them in real-time without stopping the session.

## Mechanism
1.  **Trigger**: Coach observes a tool error (e.g., `bash` exit code != 0, `write` blocked) or a user correction ("No, stop that").
2.  **Action**: Coach uses a new `micro-reward` skill to inject a **Correction Note** directly into the active agent's `workspace/scratchpad.md` (or equivalent context file).
3.  **Content**: The note should be:
    *   **Specific**: "The command `xyz` failed because `abc`. Do not retry without changing arguments."
    *   **Directive**: "Constraint added: Do not use `rm` on this directory."
    *   **Ephemeral**: Intended for the *current* session context, not necessarily long-term memory (unless promoted later).

## Requirements
1.  **Create Skill**: `agents/coach/skills/micro-reward.md`.
    *   Input: `sessionId`, `agentName`, `feedback`, `severity` (info/warning/critical).
    *   Logic: Appends a structured note to `agents/{agentName}/workspace/scratchpad.md` (or creates it).
2.  **Update Coach Role**: Coach's `SOUL.md` should include instructions to monitor active sessions (via `peek`) and use `micro-reward` when errors are detected.
3.  **Constraint**: Do NOT interrupt the agent's execution flow (don't `cancel` unless critical). Just inject the signal.

## Deliverable
- `agents/coach/skills/micro-reward.md`
- Updated `agents/coach/SOUL.md` (instructions)

## Why
This implements **P51 (Growth Cycle)** at a micro-level and aligns with **P6 (No Silent Failures)** by making errors immediately visible and actionable.
