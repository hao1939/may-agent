# Agent Evaluation: Recent Trends

Based on a recent scan of arXiv papers on "agent evaluation" and "llm", here are the key findings:

1.  **Shift towards Live and Stateful Environments:** There is a strong push to move away from static, single-turn evaluations to live, evolving workflows. Benchmarks like Claw-Eval-Live and ClawMark emphasize multi-turn, multi-day interactions where the environment (like APIs or simulated coworkers) changes independently of the agent. This tests an agent's ability to adapt to external updates, which is currently a major failure point.

2.  **In-Loop Inference-Time Feedback:** Researchers are exploring ways to evaluate and correct agent actions *during* execution, rather than just post-hoc. The "Reinforced Agent" approach introduces a secondary reviewer agent that evaluates provisional tool calls before execution. This separation of concerns allows for systematic improvement of execution reliability without retraining the base agent.

3.  **Efficiency via Diversity-Guided Simulation:** Traditional linear Monte Carlo rollouts are inefficient for evaluating multi-turn agents. Methods like DIVERT use snapshot-based execution and diversity-inducing branching to explore underexplored interaction paths more efficiently, discovering more failures per token.

4.  **Triage and Abstention:** Evaluating whether an agent knows *when not to act* is becoming critical. The Support-State Triage Audit highlights that agents often overcommit to tasks they cannot complete. Providing explicit categorical decision paths (e.g., preflight checks) significantly improves an agent's ability to correctly diagnose task blockers and defer appropriately.

Overall, the field is maturing from basic capability testing to robustness, stateful adaptation, and execution safety in complex, dynamic environments.