<ai_context>
summary: "PeakBench separates whether tool calls may run concurrently from whether finite infrastructure can safely admit them. Its 300 synthetic executable workflows show that strong dependency planning weakly predicts scheduling safety; explicit CPU/memory profiles usually improve model schedules, but a deterministic resource scheduler remains the stronger control boundary."
triggers: ["parallel tool calls", "resource-aware scheduling", "capacity admission", "PeakBench", "tool orchestration", "resource overflow", "MCP workflow"]
last_updated: "2026-08-26"
source_basis: "arXiv 2608.24509v1 and its released source, retrieved 2026-08-26"
</ai_context>

# Parallelizable does not mean admissible

**Date:** 2026-08-26  
**Source type:** arXiv paper and released source  
**Status:** New empirical signal; benchmark evidence is synthetic and simulation-bound

A scheduler for agent tools has two different questions to answer:

1. **Logical eligibility:** Are prerequisites satisfied, and may these calls run concurrently?
2. **Physical admission:** Given current capacity, how many eligible calls should start now?

PeakBench makes that split explicit. It contains 300 executable workflows—150 easy, 100 medium, and 50 hard—synthesized around tools and domains sampled from API/MCP benchmarks. The authors run calls in a containerized sandbox, perturb execution order to infer prerequisites and feasible concurrent groups, and record duration plus CPU, memory, GPU, network, and disk-I/O profiles. Evaluation then separates dependency recovery (graph edit distance and edge F1) from scheduling over an oracle dependency graph (latency, capacity-violation area, and strict mean resource utilization).

## What the results add

Across eight API models, better dependency extraction only weakly predicted safer physical scheduling. Without resource telemetry, models often reduced violations by inserting broad delays, trading away latency. Supplying the paper's Resource-Aware Scheduling Context (RASC) usually produced more targeted staggering: all eight models reduced latency, seven reduced capacity-violation area, and six improved strict utilization relative to their own no-profile schedules.

The ablation is particularly operationally useful. On the reported DeepSeek-V4-Flash setting, duration alone left feasibility unchanged at 74.9%; CPU and memory profiles raised it to 87.6%, while the full profile reached 87.8%. This suggests that merely estimating call duration does not expose the contention relation that matters.

But the model is not the whole scheduler. The paper's best deterministic resource-constrained rule achieved slightly lower violation area than the best RASC result (2.925 versus 2.938), while RASC achieved higher strict utilization and similar latency. The authors therefore frame RASC as a diagnostic/context baseline, not a replacement for an external optimizer.

## Reusable architecture pattern

Treat an agent-produced dependency graph as an **eligibility plan**, not an execution permit:

- validate prerequisite and data-flow edges;
- attach measured or conservatively estimated resource envelopes to calls;
- let an external admission controller compare the ready set with live capacity;
- stagger, queue, or reject calls when envelopes overlap unsafely;
- record dependency errors separately from capacity violations so remediation targets the correct layer.

This is a useful correction to the idea that orchestration is only routing. A model may correctly discover parallelism while still being unable to govern its physical realization. Resource admission belongs in the harness even when logical planning belongs in the model.

## Evidence boundaries

- The authors explicitly say the 300 workflows do **not** reproduce the full distribution of real user requests; they are benchmark-seeded, LLM-synthesized stress cases.
- Scheduling is replayed in a simulator under three derived machine profiles, so the results do not establish production behavior under noisy co-tenancy, dynamic autoscaling, retries, or drifting call footprints.
- Main model comparisons use public APIs and paper-defined prompts; this is a benchmark result, not an independent replication.
- Resource metadata helps most models but is not self-enforcing: one model slightly worsened violation area under RASC, and deterministic scheduling remains a necessary comparison and likely enforcement boundary.

Source: https://arxiv.org/abs/2608.24509v1  
Repo: https://github.com/Czzzk/Staggering-the-Peaks
