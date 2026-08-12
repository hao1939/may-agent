<ai_context>
summary: "OrchBench: simulation-based benchmark that evaluates multi-agent orchestration plans without executing workers. DAG-based deterministic simulator measures quality, makespan, and token cost at 1.3% token cost / 10.3% wall-clock of real execution. Key finding: preserving task-critical information matters more than agent count; parallelism benefits diminish as coordination failures accumulate."
triggers: ["orchestration", "multi-agent benchmark", "orchestration evaluation", "coordination failures", "agent parallelism", "OrchBench"]
date: "2026-07-29"
source_basis: "arXiv 2607.25656v1 (OrchBench, 2026-07-28)"
</ai_context>

# OrchBench: Evaluating Multi-Agent Orchestration Plans via Deterministic Simulation

Source: https://arxiv.org/abs/2607.25656

## What It Is

OrchBench is a simulation-based benchmark for evaluating multi-agent orchestration
plans **in isolation** — without invoking actual worker agents. Starting from
real-world tasks, it constructs directed acyclic graphs (DAGs) encoding task
dependencies with controlled sizes and degrees of parallelism. A deterministic
simulator scores the resulting plan on result quality, makespan, and token cost.

## Key Results

- Simulated scores correlate strongly with Claude Code execution quality scores
  (Pearson r = 0.816)
- Requires only **1.3% of tokens** and **10.3% of wall-clock time** vs. real execution
- Core finding: **preserving task-critical information across agent boundaries is
  more important than increasing agent count**
- Benefits of parallelism **diminish as coordination failures accumulate**

## Why It Matters

This directly validates the [Coordination Tax](../the-coordination-tax.md) thesis
from a different angle. The Coordination Tax shows that planning overhead grows
superlinearly relative to productive work; OrchBench quantifies the complementary
phenomenon — that adding more agents hits diminishing returns because coordination
failures accumulate. Together they frame a structural ceiling on multi-agent scaling.

The simulation approach itself is notable as agent-infra: evaluating orchestration
plans without full execution enables faster iteration on coordination strategies.
The 0.816 correlation with real execution at ~1% token cost suggests orchestration
plan quality is largely predictable from structural properties alone.

## Connection to Library

- **Coordination Tax**: Direct empirical support — more agents ≠ more throughput
- **SpecBox / Speculative Scheduling**: Complementary latency optimization approach
- **Typed Revision Contracts**: Information preservation across agent boundaries
  echoes the "checkpoint verified states" pattern
