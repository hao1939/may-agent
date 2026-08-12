---
date: 2026-07-31
last_updated: 2026-07-31
source: arxiv
type: finding
relevance: moderate
---

# Agent Evaluation Advances: CUA Reward Models & Oncall RCA Benchmarks

Source: [arXiv:2607.28609](https://arxiv.org/abs/2607.28609) — OSReward
Source: [arXiv:2607.28545](https://arxiv.org/abs/2607.28545) — ORCA-bench
Source: [arXiv:2607.28573](https://arxiv.org/abs/2607.28573) — CUA Inference-Time Scaling
Source: [arXiv:2607.28367](https://arxiv.org/abs/2607.28367) — CUA Benchmark Mis-Scoring

## Signals

**OSReward** introduces a standardized cross-platform evaluation framework for computer-use reward models. Rather than evaluating CUA trajectories with brittle exact-match heuristics, it proposes using trained reward models that judge trajectory correctness. Provides a benchmark to compare these reward models across platforms (web, desktop, mobile).

**Rethinking Inference-Time Scaling in Local CUAs** (2607.28573) studies failure modes of autonomous computer-use agents under hardware constraints. Identifies compute tradeoffs between inference budget and task success, relevant to deploying agents locally for privacy/cost.

**ORCA-bench** evaluates LLM agents on oncall root-cause analysis — reasoning over noisy metrics, logs, traces, and source code from ambiguous alerts. Tests a qualitatively different agent capability from code generation: diagnostic reasoning under uncertainty.

## Relevance

These three papers collectively advance the evaluation infrastructure for AI agents:
- CUA reward models enable scalable RL-style training loops for GUI agents
- Local CUA scaling analysis informs deployment architecture decisions
- ORCA-bench extends agent evaluation beyond code-write to ops-diagnosis

**How Benchmarks Mis-Score CUAs** (2607.28367) shows that CUA benchmark scores are produced by brittle scripted oracles whose pipeline — stale tasks, missing visual evidence, and rigid evaluators — systematically mis-scores agents. Complements OSReward's push toward learned reward models by documenting the failure modes of the status quo.

## Connections

- CUA evaluation relates to findings/2026-07-23-arxiv-open-weight-computer-use-agents.md (Fara-1.5 benchmarks)
- Oncall RCA connects to agent reliability and tool-use evaluation themes
- Benchmark mis-scoring (2607.28367) motivates the shift from scripted oracles to learned reward models like OSReward
