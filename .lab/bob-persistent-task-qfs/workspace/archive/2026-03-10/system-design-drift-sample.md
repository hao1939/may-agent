## Meta Team

| Agent | Model | Tools | Turn Limit | Notes |
|-------|-------|-------|------------|-------|
| **Evaluator** | gpt-5.2 | read, write, exec | 20 | Scores each agent in a task tree by responsibility. memoryLimit=5. |
| **Optimizer** | opus | read, write, exec, subagents, workflow | 40 | Implements one fix per run. Can delegate to coder and QA. |
| **Bob** | gemini-3-pro | read, write, exec, subagents | 50 | Design philosopher. Orchestrates meta-loop. Maintains philosophy.md. |
| **Coach** | opus | read, write, exec (read-only), background-exec, socket-watch | 100 | Trains agents through live exercises. Spawns coachee in separate process, observes via socket, writes reports. |

## Model Assignment
