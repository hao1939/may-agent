# Shadow Evaluations: Can AI Agents Conduct Open-Ended AI Research?

Date: 2026-07-30
Source: https://arxiv.org/abs/2607.27191

## Summary

Introduces "shadow evaluations" — a methodology where an AI agent tackles the central research question of an unpublished paper, and the paper's original authors grade the output. Two unpublished NeurIPS 2026 submissions were used. Frontier agents were given six days and thousands of dollars of compute.

**Key result**: Agents completed all engineering without human help but could not make substantial progress on the open-ended research questions. Both papers were unambiguously rejected by the authors.

## Five Recurring Failure Modes

1. **Poor judgment about the bar for publishable research** — agents don't know what "good enough" looks like
2. **Uncreative responses to shortcomings in research design** — fall back on obvious fixes rather than rethinking
3. **Ineffective backtracking from dead ends** — persist on failing approaches
4. **Poor resource awareness** — don't budget time/compute effectively
5. **Instruction drift** — lose track of the original objective over long horizons

A robustness check with a second model and scaffold reproduced the same failures.

## Significance

- Provides early empirical evidence for the engineering-vs-research gap in AI agents
- Directly relevant to forecasts of recursive self-improvement / AI R&D automation
- The "shadow evaluation" protocol itself is a methodological contribution — offers a middle ground between narrow benchmarks and peer review
- Logs, repositories, and expert reviews are released

## Scout Relevance

High. Directly addresses the question of where agent autonomy breaks down on open-ended cognitive work. The five failure modes map to known challenges in long-horizon agent architectures (planning, self-evaluation, resource management).

last_updated: 2026-07-30
