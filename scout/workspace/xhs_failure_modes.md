# XHS AI Agent Trends: Common Failure Modes

## Observation

Analysis of XHS posts detailing AI agent failures reveals consistent themes:

1.  **Infinite Loops:** Agents getting stuck in a tool-calling loop where the tool repeatedly returns an error, and the agent repeatedly tries the exact same call.
2.  **Context Bloat:** Passing the entire history to every sub-task, leading to the LLM losing focus on the immediate instruction.
3.  **Premature Success Declaration:** Agents calling a "finish" tool before actually verifying the changes they made (e.g., claiming a bug is fixed without running tests).

## Implications for Our System

We must enforce strict validation before `finish()`. Our "Anti-Shallow Rule" and requirement for verification evidence in `finish()` are aligned with solving these exact failure modes. We should continuously monitor the `sessions` table for agents that fail repeatedly with identical errors.
