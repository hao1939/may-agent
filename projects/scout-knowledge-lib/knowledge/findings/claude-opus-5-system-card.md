# Claude Opus 5 System Card Released

Date: 2026-07-24
Source: https://www.anthropic.com/claude-opus-5-system-card
HN: https://news.ycombinator.com/item?id=49038433

## Summary

Anthropic released the Claude Opus 5 system card. This is the next flagship model in the Claude family, following Opus 4. The system card details capabilities, safety evaluations, and alignment properties of the model.

## Relevance to AI Agents

- New frontier model releases directly affect agent capabilities — Opus-class models are commonly used as the backbone for agentic coding and research workflows.
- System cards reveal safety evaluation methodology, which informs how agent builders should think about deploying these models in autonomous loops.
- Worth tracking whether Opus 5 introduces new agentic benchmarks or tool-use evaluations.

## Leaderboard Performance

As of 2026-07-25, Opus 5 reached #1 on the [Artificial Analysis Intelligence Leaderboard](https://artificialanalysis.ai/models) (HN: https://news.ycombinator.com/item?id=49040741). This confirms it as the current frontier model for agent workloads.

## SlopCodeBench Results (2026-07-28)

Source: https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/benchmarking-opus-5-on-slop-code-bench.md
HN: https://news.ycombinator.com/item?id=49076391

[SlopCodeBench](https://arxiv.org/html/2603.24755v1) (UW Madison, March 2026) is an unsaturated long-horizon coding benchmark where models evolve a codebase across multiple checkpoints with requirements revealed incrementally — closer to real software engineering than single-shot benchmarks.

### Key results (subset of 17 checkpoints across 3 problems):
- **Opus 5**: 24% strict pass rate (4/17 checkpoints)
- **Opus 4.8**: 6% (1/17)
- **Sonnet 5**: 6% (1/17)
- Prior paper: Opus 4.6 got 17%, GPT-5.4 got 11%

### Agent-relevant insights:
- No model completed any full challenge without accumulating defects — even the "easy" problem.
- Opus 5 wrote **5× more functions** than Opus 4.8 on the same challenges, suggesting increasing verbosity/complexity as a failure mode.
- The benchmark confirms that for iterative, evolving codebases, current frontier models "can't be relied on to run lights-off without steering."
- Pattern: **incremental-requirement benchmarks expose agent brittleness** that single-shot evals miss. Agent builders should expect regression accumulation in long autonomous runs.

## Tags

frontier-models, anthropic, claude, safety, system-card, benchmarks, coding-agents, benchmarks-unsaturated
