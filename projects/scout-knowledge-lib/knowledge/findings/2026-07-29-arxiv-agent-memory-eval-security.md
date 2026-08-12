---
title: "arXiv Agent Signals: Memory Valuation, Cross-Benchmark Eval, Security Harnesses, Hierarchical Skills"
date: 2026-07-29
last_updated: 2026-07-29
source_platform: arxiv
query: "cat:cs.AI AND abs:agent"
tags: [agent-memory, agent-evaluation, agent-security, agent-skills, arxiv, academic]
---

# arXiv Agent Signals — 2026-07-28 Batch

Four papers from the 2026-07-28 arXiv batch with direct AI-agent infrastructure relevance.

## 1. MemLens — Value-Aware Memory Management for LLM Agents

Source: https://arxiv.org/abs/2607.25992

**Key idea:** Treats agent memory records as first-class data objects with Shapley-style
value attribution. Provides an interactive analytics dashboard exposing the full memory
lifecycle: evaluation → value-aware storage → memory-assisted response. Users can inspect
memory values, visualize hierarchical structures, and compare strategies by quality,
latency, and token cost.

**Why it matters:** Extends the agent-memory maturation signal tracked in the library
(MemTX, ConsistencyGate, EverMemOS). MemLens adds an economics lens — which memories
are worth keeping? — bridging memory management and cost optimization. The Shapley
approach gives principled per-record attribution rather than heuristic eviction.

## 2. Messier — Cross-Benchmark Agent Evaluation Corpus (957K Records)

Source: https://arxiv.org/abs/2607.25891

**Key idea:** Unified corpus of 957,253 evaluation records spanning 30 benchmarks,
714 agents, 11,891 tasks, and 74,205 verifiers. Standardizes by model, scaffold,
environment, task, verifier, and aggregation rule with SOC/NAICS occupational
classifications.

**Findings:** Function-calling benchmarks are saturated; programming improves fastest;
enterprise workflows remain hardest. Strict all-pass aggregation in multi-verifier tasks
can obscure progress and alter agent rankings. Capability scales correlate with Epoch's
ECI at Spearman ρ = 0.81.

**Why it matters:** First large-scale meta-evaluation infrastructure for agents. Enables
domain-specific capability tracking without re-running benchmarks. The saturation signal
on function-calling confirms the library's observation that tool-use is commoditizing.

## 3. SHarD — Distributable Security Harness for AI Coding Agents

Source: https://arxiv.org/abs/2607.25890

**Key idea:** Embeds OS sandboxing, skill scanning, and tool restriction into a single
distributable harness (built on Pi agent harness). Achieves 100% adjusted OWASP Top 10
score for agentic applications, matching direct commercial agent security configs.

**Why it matters:** Validates the "security as harness layer" pattern — security controls
can be wrapped around arbitrary agents rather than built into each one. Relevant to the
library's agent-harness and agent-security threads.

## 4. HiSkill — Hierarchical Skill Graphs for LLM Agents

Source: https://arxiv.org/abs/2607.25853
Repo: https://github.com/BUPT-GAMMA/HiSkill

**Key idea:** Organizes agent trajectories into a directed graph with skill nodes,
AtomicOp nodes, and typed edges (decomposition, temporal, compatibility, support,
recovery). At inference, retrieves a task-relevant subgraph for guided execution.
Outperforms baselines while reducing token consumption.

**Why it matters:** Addresses the gap between high-level skill abstractions and
executable action grounding. The hierarchical graph structure with recovery edges is
a practical pattern for agent skill reuse in long-horizon tasks.
