<ai_context>
summary: "Canonical reference for agent evaluation patterns: live benchmarks, execution-trace verification, reviewer agents, operational metrics (MTBF, CPT, context efficiency), and XHS community trends."
triggers: ["evaluation", "benchmark", "reviewer agent", "feedback", "Agent-Eval-Agent", "evaluator agent", "gym", "MTBF", "context efficiency", "trajectory"]
last_updated: "2026-06-14"
source_basis: "Consolidated from agent-evaluation.md, agent-evaluation-trends.md, agent-evaluation-trends-updated.md, xhs-eval-synthesis-2024.md, and xhs_eval_trends_may2024.md. Original sources: synthesis of 2024–2026 evaluation research and XHS community posts."
</ai_context>

# Agent Evaluation Patterns

Agent evaluation is evolving from static post-hoc benchmarks to live,
execution-based verification and continuous operational metrics. This note
consolidates durable evaluation patterns and dated XHS trend observations.

## Durable Patterns

### Beyond Static Benchmarks
Standard LLM benchmarks (MMLU, GSM8k, static SWE-bench) are inadequate for
autonomous agents. They test isolated reasoning, not long-horizon action, tool
use, or error recovery. Evaluation is shifting toward:

1. **Live, Evolving Benchmarks:** Benchmarks regularly updated based on public
   workflow demand to prevent overfitting to static test sets (e.g.,
   Claw-Eval-Live).
2. **Dynamic Gym Environments:** Continuous simulation environments where
   agents must maintain state over time, replacing single-turn pass/fail tests.
3. **Environment-Based Testing:** Interactive environments (WebArena,
   SWE-bench) where the agent navigates a stateful system with real tool use.

### Execution-Trace Verification
Grading goes beyond the final answer. It requires recording execution traces,
audit logs, and post-run workspace artifacts to verify *how* the task was
executed.

- **Deterministic vs. Semantic Grading:** Use deterministic checks where
  evidence is sufficient (e.g., did a file change as expected?), reserving
  LLM-as-a-judge only for semantic dimensions.
- **Trajectory Analysis:** Evaluate the sequence of tool calls, reflection
  steps, and adaptations — not just task success/failure.

### Agent-Eval-Agent (Agent-as-a-Judge)
Using one LLM or specialized agent to evaluate the trajectory and outputs of
another. More scalable than manual human review; critical as multi-agent systems
grow too complex for traditional unit tests.

### Inference-Time Feedback (Reviewer Agent)
Separate execution and review: a secondary **reviewer agent** evaluates
provisional tool calls *prior* to execution (e.g., "Reinforced Agent" pattern).

When introducing a reviewer agent, track:
- **Helpfulness**: % of base agent errors that feedback corrects.
- **Harmfulness**: % of correct responses that feedback degrades.

This separation allows optimizing the reviewer independently (via prompt
engineering or stronger models like o3-mini for reasoning).

## Operational Metrics

These metrics reflect the shift from "did the agent pass?" to "how well does
the agent operate continuously?"

| Metric | What It Measures |
|---|---|
| **MTBF** (Mean Time Between Failures) | How long an agent operates autonomously without human intervention or fatal error loops. |
| **Cost-Per-Task (CPT)** | Production cost efficiency. Prominent in Chinese AI community evaluation. |
| **Context Window Efficiency** | Token-to-action ratio. Agents accomplishing the same task with fewer retrieved tokens are rated higher. |
| **HITL Friction** | How often the agent asks for help vs. how often it should have asked but guessed wrong. |
| **Stigmergy Quality** | How well agents leave context for each other, measured by the success rate of the *next* agent picking up the task. |

## XHS Community Observations (2024)

Dated trend observations from the Chinese AI community on XHS:

- **Domain-specific integration tests** replacing isolated benchmark tests.
- **Operational memory tests**: how well agents recall context over 50+ turns.
- **"Vibe checks"** and qualitative HITL feedback becoming standardized metrics.
- **Graceful tool degradation**: agents evaluated not just on correct tool
  usage, but on behavior when tools fail or APIs timeout.
- Community heavily prioritizing robustness and stateful interaction over raw
  LLM capabilities.

## Related Notes
- [Agent Self-Correction Trends 2026](./agent-self-correction-trends-2026.md)
- [Agent Error Recovery and Resilience](./agent-error-recovery.md)
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md)
