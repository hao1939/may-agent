<ai_context>
Scout knowledge file: XHS AI Agent Trends: Common Failure Modes
</ai_context>

# XHS AI Agent Trends: Common Failure Modes

## Observation

Analysis of XHS posts detailing AI agent failures reveals consistent themes:

1.  **Infinite Loops:** Agents getting stuck in a tool-calling loop where the tool repeatedly returns an error, and the agent repeatedly tries the exact same call. Also, agents "looping and agreeing with each other" instead of moving the task forward (echo chambers).
2.  **Context Bloat:** Passing the entire history to every sub-task, leading to the LLM losing focus on the immediate instruction.
3.  **Premature Success Declaration:** Agents calling a "finish" tool before actually verifying the changes they made (e.g., claiming a bug is fixed without running tests).
4.  **Message Passing Overhead:** Relying on direct message passing between agents instead of shared databases or state (stigmergy), leading to fragility and "going back to simple pipelines".

## Implications for Our System

We must enforce strict validation before `finish()`. Our "Anti-Shallow Rule" and requirement for verification evidence in `finish()` are aligned with solving these exact failure modes. We should continuously monitor the `sessions` table for agents that fail repeatedly with identical errors. We should also strongly encourage Stigmergy (shared databases/state) over direct message passing to avoid coordination overhead.
