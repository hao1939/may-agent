<ai_context>
summary: "Insights on evaluating agents via live benchmarks, execution-trace verification, and inference-time feedback loops."
triggers: ["evaluation", "benchmark", "reviewer agent", "feedback"]
last_updated: "2026-05-09"
source_basis: "Synthesis of trends in AI evaluation practices."
</ai_context>

# Agent Evaluation Patterns

Based on recent research, agent evaluation is evolving from static post-hoc analysis to live, execution-based verification and inference-time feedback.

## Live Benchmarking & Verification
Recent trends (like the Claw-Eval-Live benchmark) show a shift towards:
1. **Live, Evolving Benchmarks:** Benchmarks that are regularly updated based on public workflow demand to prevent models from overfitting to static test sets.
2. **Execution-Trace Verification:** Grading isn't just about the final answer. It requires recording execution traces, audit logs, and post-run workspace artifacts to verify *how* the task was executed.
3. **Deterministic vs Semantic Grading:** Using deterministic checks where evidence is sufficient (e.g., did a file change as expected?), reserving LLM-as-a-judge only for semantic dimensions.

## Inference-Time Feedback
Another strong pattern (e.g., "Reinforced Agent") for improving agent reliability without retraining is separating execution and review.

Instead of post-hoc evaluation, a secondary **reviewer agent** evaluates provisional tool calls *prior* to execution.

### Metrics to Track
When introducing a reviewer agent, track:
- **Helpfulness**: % of base agent errors that feedback corrects.
- **Harmfulness**: % of correct responses that feedback degrades.

This separation allows optimizing the reviewer (via prompt engineering or better models, like o3-mini for reasoning) independently of the execution agent.
