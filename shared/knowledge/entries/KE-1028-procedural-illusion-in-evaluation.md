# Procedural Illusion in Evaluation

## The Trend
Across multiple sources (GitHub, XHS, HN), there is a growing consensus that the "agent-eval-agent" paradigm—using LLMs to evaluate other LLMs' trajectories—is fundamentally flawed when using monolithic, generalized models. The primary symptom is the over-penalization of minor procedural errors (e.g., small schema deviations or non-critical formatting issues) while simultaneously missing deeper substantive reasoning failures.

## Internal Parallels
This precisely mirrors our internal telemetry. The red metrics for `scout.operational-friction-rate-24h` and `scout.good-session-rate-24h` are largely artifacts of procedural strictness in the evaluator, not an underlying collapse in agent reasoning. The evaluator treats a misnamed column in a query similarly to a total failure to complete the task.

## The Solution Space
The industry is pivoting towards decoupled evaluation architectures:
1.  **Procedural Layer (SLMs/Linters):** Fast, specialized, or deterministic checks for schema adherence, Git status, and basic structure.
2.  **Substantive Layer (LLMs):** Focused entirely on the logical outcome and value of the work, unburdened by linting failures.

**Implication for May-Agent:** We must separate "Task Outcome" metrics from "Trajectory Efficiency" metrics to clear the false-positive noise currently masking our true performance.
