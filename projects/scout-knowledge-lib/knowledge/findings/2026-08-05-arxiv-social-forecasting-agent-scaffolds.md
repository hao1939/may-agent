# SocietyBench: Agent Scaffolds Do Not Automatically Improve Social-World Forecasting

Date: 2026-08-05
Last_updated: 2026-08-05
Source: https://arxiv.org/abs/2608.04009
Project: https://co-minder.github.io/SocietyBench
Tags: agent-evaluation, forecasting, benchmarks, agent-scaffolds, calibration, temporal-reasoning

## Summary

The new arXiv paper **SocietyBench** evaluates a capability that most agent benchmarks barely touch: forecasting how a real social event will evolve over time. The benchmark converts real-world event histories into **counterfactual timelines** by anonymizing named entities and shifting dates, then asks models to answer forecast questions at multiple cutoff points.

The notable result is not only that frontier models are still limited, but that **three agent frameworks built on the same base model fail to improve on that base model**. On the released evaluation, the strongest of six frontier LLMs reaches **75.0 / 100** against a trivial **50-point** anchor, and the benchmark scores models separately on **probability calibration** and **temporal accuracy**.

## Key Details

- **Benchmark target**: social-world forecasting rather than task completion, bug fixing, browsing, or GUI control.
- **Construction pipeline**: a one-line event topic is expanded into a date-indexed timeline built from web news and social-media posts across **five platforms**.
- **Memorization control**: before evaluation, the benchmark **replaces named entities** and **shifts all dates by a per-event constant**, preserving structure while reducing simple pretraining lookup.
- **Evaluation shape**: **five heterogeneous events** and **125 prediction points** across **Chinese and English** editions.
- **Dual metrics**: each forecast is scored on two orthogonal **100-point axes** — **probability calibration** and **temporal accuracy**.
- **Headline performance**: the strongest of **six frontier LLMs** reaches **75.0 / 100** versus a **50** trivial anchor.
- **Important agent result**: **three agent frameworks** on a shared base model **do not outperform that base model**.

## Why It Matters

Most current agent evaluation rewards systems that can retrieve information, call tools, or persist long enough to finish a task. SocietyBench isolates a different question: can an agent form a **calibrated, time-sensitive world model** about a social process whose surface labels have been stripped away?

That matters because many "deep research" or orchestration layers implicitly assume that more tool use and more process will generally improve performance. SocietyBench is evidence that this does **not** automatically transfer to forecasting-like work. If the task is primarily about:

1. separating trend signal from event noise,
2. estimating what happens next rather than finding what already happened,
3. and staying calibrated under ambiguous timelines,

then an agent scaffold may add overhead without adding the missing capability.

## Scout Take

The non-obvious signal is that **agent wrappers may be benchmark-local optimizations**. They help on surfaces dominated by search, tool execution, or long task control, but SocietyBench suggests they may contribute little when the core bottleneck is **calibrated temporal modeling of a changing social world**.

For Scout's library, this is a useful correction to the current agent narrative: not every important agent capability is a "can it finish the workflow?" capability. A serious evaluation stack likely needs a separate class of tests for **forecasting, calibration, and time-aware sensemaking**, and those tests may show much smaller gains from today's agent scaffolds than coding or browsing benchmarks do.
