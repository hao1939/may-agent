---
title: "Agent harness cost is a model-pair property, and failed runs dominate the bill"
source: hn
date: 2026-11-17
last_updated: 2026-11-17
type: finding
tags: [hn, coding-agents, agent-harnesses, evaluation, inference-cost, verification]
relevance: high
---

# Agent harness cost is a model-pair property, and failed runs dominate the bill

## Finding

A current Hacker News submission points to Runta's FrontierHarness Eval v1.1, a producer-run comparison of 22 harness configurations, five open-weight models, 62 terminal tasks, and four attempts per cell. The article reports 27,280 runs and 83 billion tokens. Its most reusable result is not a universal harness ranking: the economical harness changed materially with the model, while most inference spend went to runs that did not pass.

Runta reports that the median harness moved 11 of 22 cost-rank positions between models. Codex CLI ranked first in cost per task with GLM-5.3 but 16th with Kimi-K3; DeepSeek Harness: Creator moved from first with Muse to 21st with GLM-5.3 Flash. A two-way analysis attributes 92.8% of cross-cell cost variation to the model, 2.3% to a harness-wide effect, and 4.9% to the model–harness pair plus noise. With the model fixed, the highest-cost harness used 1.8 to 5.0 times the cost per task of the lowest-cost harness. In within-model shuffles, the observed spreads exceeded all 300 shuffled spreads, which the article reports as p = 0.003.

The article also reports that higher spend did not reliably buy higher pass rates. Within each model, the rank correlation between cost per task and pass rate ranged from -0.39 to +0.22. Across scored runs, 64.5% of list-price inference cost went to non-passing trials: 52.7% to failures and 11.8% to timeouts. Among the five selected best-value harnesses, 68% to 82% of failed trials ended with a confident final answer rather than reaching the time limit. This makes premature or false completion a cost-control problem as well as a correctness problem.

The proposed mechanism is trajectory length rather than prompt size. Across the 22 harnesses, steps per successful run had a reported rank correlation of +0.51 with cost per pass (p = 0.015), while starting prompt tokens, tool count, and cache-hit rate had correlations near zero. Each additional step resends accumulated context, so even highly cached trajectories continue to accrue cost. The smallest starting prompt was therefore not among the cheapest successful configurations.

## Reusable implications

- **Benchmark model–harness pairs, not harnesses in isolation.** A harness selected on one model can move far down the cost ranking after a model switch. Adoption checks should pin model, provider, harness version, settings, task distribution, pricing basis, and rerun count.
- **Treat failed-run cost as a first-class operational metric.** Report spend by pass, failure, timeout, and unresolved outcome. Aggregate cost per task hides whether budget is buying successful work or financing confident false completion.
- **Bind completion claims to external evidence.** Because many failed runs stopped voluntarily with a final answer, harnesses need protected checks that can reject unsupported completion before the run settles. The evaluation did not test such an intervention, so its savings remain a hypothesis.
- **Optimize trajectory growth before shaving the initial prompt.** First-request size can be operationally important, but this dataset says repeated full-context steps were more predictive of cost. Step count, context growth, tool-call loops, and early failure detection deserve separate telemetry.
- **Keep quality and cost verdicts separate.** A lower-cost harness is not automatically better, and a higher pass rate may be statistically uncertain. Each model–harness cell needs pass uncertainty, cost accounting, audit exclusions, and task-level evidence rather than one composite rank.

## Relation to existing Scout knowledge

This finding extends [Harness Benchmarks Need Separate Quality and Cost Resolution Verdicts](./2026-11-10-harness-benchmarks-separate-quality-cost-resolution.md), which showed that a saturated task set could fail to resolve quality differences while still exposing metered cost differences. FrontierHarness v1.1 adds a much larger producer-run matrix and shows that the cost ordering itself depends strongly on the selected model. It also complements [A minimal coding session is a necessary harness baseline, not a universal architecture](./2026-10-01-minimal-harness-mle-ablation.md): both identify repeated context and long trajectories as cost drivers, but the new matrix warns against generalizing one harness's economics across model backends.

Disposition: **new knowledge**. Existing Scout notes discuss harness cost, comparability, prompt overhead, and model–harness confounds, but a library search found no prior record of FrontierHarness v1.1, its 27,280-run matrix, the reported cross-model cost-rank movement, or the 64.5% failed-run cost share.

## Evidence and limitations

Scout read the complete public Runta article and the associated HN item. Runta and its partner Baseten produced and hosted the evaluation, so this is interested producer evidence rather than independent replication. Costs are estimates from reported tokens multiplied by Baseten list prices, not audited invoices. All five models are open-weight models served by one provider; closed models, different providers, private task distributions, and other pricing or caching rules can change the ordering. Harnesses ran at default settings and maximum reasoning effort, which approximates one usage mode but does not isolate every implementation difference. Audits assigned zero reward to 216 trials flagged for reward hacking, including 163 online lookups. Scout did not inspect all trial traces, rerun the experiments, verify token accounting, reproduce the bootstrap or shuffle analyses, or independently validate the reward-hacking labels.

At observation time, HN item 50532191 had 13 points and two comments. The author disclosed Runta's involvement in the thread; HN supplies discovery and limited discussion provenance, not independent corroboration.

## Sources

- **Primary report:** https://runta.com/blog/introducing-frontierharness-eval-v1-1/
- **HN:** https://news.ycombinator.com/item?id=50532191
