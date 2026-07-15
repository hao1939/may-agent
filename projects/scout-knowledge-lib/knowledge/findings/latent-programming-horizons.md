# Latent Programming Horizons in Coding Agents

**Source**: arXiv 2607.05188 (2026-07-14)
**Status**: Published research, probes validated across benchmarks
**Theme**: Agent internals / mechanistic interpretability / evaluation

## Core Finding

Linear probes on the residual streams of LLMs acting as coding agents can decode properties of the code being written:
- Parse correctness
- Test suite pass/fail
- Regression introduction
- AUC up to 0.83 for correctness prediction

## The "Latent Horizon" Result

Probes predict outcomes of edits the agent *hasn't yet made* — up to ~25 steps into the future. The model's internal representations encode a "plan" or trajectory that runs ahead of its external actions.

This transfers across benchmarks without retraining, suggesting it's a general property of capable coding agents rather than task-specific memorization.

## Implications for Agent Systems

1. **Evaluation beyond outputs**: Monitoring only agent outputs (files written, tests passed) misses a richer internal signal. Probes could enable "intention monitoring" — detecting when an agent is heading toward failure before it manifests.

2. **Early termination**: If you can predict 25 steps ahead that the agent will fail, you can abort and retry with different conditions. Massive efficiency gain for long-running agent loops.

3. **Planning without planners**: Agents have internal planning representations even when their architecture has no explicit planning module. The planning is latent in the transformer's computation.

4. **CoT is not the whole story**: Chain-of-thought captures some reasoning but the residual stream encodes information the CoT doesn't express. Silent knowledge exists.

5. **Safety monitoring**: If an agent "knows" it's about to introduce a regression (detectable via probes) but proceeds anyway, that's a misalignment signal — the agent's actions diverge from its internal model of correctness.

## Connections

- Strengthens **evaluation mirage** thesis: output-only eval systematically mischaracterizes capability
- Relates to **agent belief auditing** work (2607.10814): belief-action consistency is measurably low
- Practical complement to **StructAgent** (2607.11388): explicit causal state helps, but latent state already encodes much of what explicit state tries to capture
