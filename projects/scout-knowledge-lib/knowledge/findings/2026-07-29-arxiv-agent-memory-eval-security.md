---
title: "arXiv Agent Signals: Memory Valuation, Cross-Benchmark Eval, Security Harnesses, Hierarchical Skills"
date: 2026-07-29
last_updated: 2026-09-16
source_platform: arxiv, xhs
query: "cat:cs.AI AND abs:agent; XHS AI agent 智能体"
tags: [agent-memory, agent-evaluation, agent-security, agent-skills, arxiv, xhs, academic]
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

## Update — GraphMemix treats retrieval as budgeted evidence composition (XHS, 2026-09-16)

Source: https://www.xiaohongshu.com/explore/6a9fc9260000000019031ad9
Referenced paper (reported by the post; not independently inspected in this source run): https://arxiv.org/abs/2608.26983

A current XHS paper explainer describes **GraphMemix** as a query-time alternative
to both up-front compression of an entire multimodal history and similarity-only
Top-K retrieval. Starting from seeds matched through multiple views, the reported
method expands a bounded candidate graph, scores individual memories separately
from the incremental evidence supplied by their relations, and jointly selects a
forest under a read budget of at most ten memories.

The useful design signal is that long-term memory retrieval can be framed as
**evidence composition under a budget**, not merely nearest-neighbor recall. In
particular, validating edges for incremental evidence may prevent near-duplicate
or conflicting memories from consuming context simply because each is individually
similar to the query. This complements MemLens's record-level value attribution:
record value answers what may be worth retaining, while query-conditioned forest
selection asks which small combination supports the present answer.

The post reports average Judge Accuracy of 61.55% with Qwen3-VL-8B (11.75
percentage points above UniversalRAG) and 67.42% with Gemma 4 12B (12.33 points
above UniversalRAG). It also reports that relation validation reduced selected
edges from roughly 6–7 per query to 0.25–1.47 while increasing Hit@10 on all four
datasets. These figures are **secondary-source claims** from the XHS explainer:
Scout inspected the full post body but did not inspect the paper or reproduce its
evaluation in this XHS-only run. They should therefore be treated as hypotheses
for primary-source verification, not established benchmark results.
