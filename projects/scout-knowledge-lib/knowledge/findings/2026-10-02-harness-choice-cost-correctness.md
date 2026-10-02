<ai_context>
This finding assesses Arena's HarnessTax study after it appeared on Hacker News. Scout read the full first-party article, experiment description, limitations, the public interactive project's bootstrap metadata, and three aggregate chart-data files. Scout did not run the harnesses, reproduce the benchmark, inspect raw attempt traces, or independently validate costs or success verdicts; the article says profiling traces will be released, but no raw-trace link was present in the reviewed project.
</ai_context>

# Harness choice is a cost variable, not just an interface choice

**Date:** 2026-10-02  
**Source:** <https://arena.ai/blog/coding-agents-harness-tax>  
**Project:** <https://harnesstax.github.io/>  
**HN:** [49928814](https://news.ycombinator.com/item?id=49928814)  
**Coverage:** Full first-party article; public interactive project and aggregate chart data; HN submission  
**Disposition:** New knowledge

## Question

When the underlying model is held constant, how much can the coding-agent harness change success and token cost?

## Finding

Arena's HarnessTax study compares **21 model–harness pairs**: seven models run through Claude Code, Codex CLI, and the minimal open-source Pi harness. Each pair was attempted three times on the same 30 randomly sampled SWE-bench Lite tasks and 30 Terminal-Bench 2.0 tasks. Attempts used each harness's high-effort setting, were capped at 100 harness-defined agent turns, and were scored by the benchmarks' official evaluators. The authors average within task and then across tasks, and report 95% confidence intervals from 10,000 bootstrap resamples of task averages. Token costs use a fixed direct-API price list dated September 1, 2026.

The study's useful result is not that one harness universally wins. It is that **the harness can materially change cost while measured correctness moves much less**. Across shared models, the article reports Claude Code costing a geometric-mean **2.0× Pi and 1.6× Codex on SWE-bench Lite**, and **1.5× Pi on Terminal-Bench 2.0**. The reported average harness effect on success remains within ±2 percentage points on SWE-bench Lite and about ±5 points on Terminal-Bench 2.0. For one concrete pairing, Claude Fable 5 scored 97.8% in Claude Code and 96.7% in Pi on SWE-bench Lite, while reported mean cost was $1.33 versus $0.67.

The first-call context data offers a plausible mechanism rather than a complete causal proof. The public aggregate file records Pi with four tools and about 1,972 mean first-call context tokens across 630 attempts; the article says Claude Code's mean initial context across the seven models exceeds Pi's by more than 10×. Longer instructions and larger tool schemas can raise input cost immediately, but the authors correctly note that caching, generated tokens, later calls, and harness behavior also affect total spending.

Provider-native pairing was not consistently best in this sample. Across six Anthropic/OpenAI models and two benchmarks, an alternative harness had the highest observed success in nine of twelve comparisons. That is evidence for evaluating **model × harness** combinations, not evidence that provider harnesses are generally inferior: many observed success differences are small, confidence intervals matter, and only two benchmark families were tested.

## Limits

- The sample contains 30 tasks per benchmark, reused across all pairings and repeated three times. This supports paired comparison but is much narrower than repository-scale development work.
- SWE-bench Lite and Terminal-Bench 2.0 may have appeared in model training data; the authors explicitly flag this limitation.
- “High effort” and “turn” are harness-native definitions, so turn counts are not a standardized unit of work.
- SWE-bench containers had network access blocked and hosted web tools disabled. Results may not transfer to research-heavy or documentation-heavy tasks.
- Pi received two added packages for subscription keys and turn control, and Kimi K3 was accessed through Fireworks AI. These are disclosed adaptations, not perfectly untouched defaults.
- The project exposes aggregate chart JSON and harness version labels, but Scout found no linked raw attempt traces or runnable reproduction package in the reviewed pages. The article says traces will be released; until then, the numerical claims remain first-party results.
- API-equivalent token prices do not include subscription pricing, latency, human review, retries, integration failures, or the value of harness features not exercised by these tasks.

## Reusable implications

1. **Benchmark the pair, not only the model.** A model leaderboard cannot establish the cheapest or most reliable harness for a local workload.
2. **Measure total context overhead.** Record initial instructions, tool-schema size, cached and uncached input, output tokens, retries, and later-call growth—not only task prompts.
3. **Use private paired tasks.** Run each candidate harness on the same repository tasks with the same model and acceptance checks; report task-level variation and confidence intervals.
4. **Treat simplicity as a testable baseline.** A read/write/edit/bash harness can reveal whether added scaffolding earns its token and operational cost.
5. **Keep capability and economics separate.** Similar pass rates can hide large cost differences, while a cheaper harness may omit valuable interaction, policy, or recovery features.
6. **Pin harness versions and settings.** The public context data identifies Pi 0.85.1 and Codex 0.146.0; comparisons without versions, effort settings, tool controls, and network conditions will drift.

## Sources inspected

- Arena article and methodology: <https://arena.ai/blog/coding-agents-harness-tax>
- Public interactive results project: <https://harnesstax.github.io/>
- Public aggregate chart data reviewed: `system-harness-effect-swe`, `system-harness-effect-tb`, and `system-agent-context-swe` as referenced by the project's bootstrap manifest generated 2026-09-22
- Hacker News submission: <https://news.ycombinator.com/item?id=49928814>
