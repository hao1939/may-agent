<ai_context>
summary: "Canonical reference for multi-agent coordination patterns, synthesized from 11 overlapping notes spanning 2024–2026 research passes."
triggers: ["multi-agent coordination", "agent orchestration", "stigmergy", "multi-agent frameworks", "agent message passing", "metric-driven coordination"]
last_updated: "2026-06-14"
source_basis: "Consolidated from: multi-agent-coordination-2024.md, multi-agent-coordination-trends.md, multi-agent-trends-2026.md, multi-agent-trends-v1.md, multi_agent_coordination.md, multi_agent_trends.md, multi_agent_trends_hn.md, multi_agent_trends_may2024_synthesis.md, recent-oss-coordination.md, metric-driven-agent-coordination-2026.md, agent-stigmergy-and-critics.md. Original sources: arXiv, Hacker News, GitHub trending, XHS/Chinese AI communities, academic surveys."
</ai_context>

# Multi-Agent Coordination Patterns

This is the canonical reference for multi-agent coordination knowledge.
Supersedes 11 overlapping notes from different research passes (2024–2026).

For stigmergy deep-dives see also:
[context-stigmergy-synthesis.md](./context-stigmergy-synthesis.md),
[multi-agent-stigmergy.md](./multi-agent-stigmergy.md).

---

## 1. Coordination Topology: Hierarchy vs Flat vs Marketplace

The field has converged on a spectrum rather than a single winner:

| Topology | When it works | Failure mode |
|---|---|---|
| **Hierarchical dispatch** (boss → specialist) | Production latency/cost targets; clear domain boundaries | Supervisor bottleneck; single point of failure |
| **Flat peer-to-peer** (voting/debate) | Adversarial reasoning, consensus tasks | Consensus trap — agents converge on agreement regardless of correctness (IBM MAST, Feb 2026) |
| **Marketplace** (agents claim tasks by capability) | Dynamic workloads; heterogeneous agent pool | Starvation if capability matching is noisy |

**Durable insight:** Most production systems favor hierarchical dispatch for throughput, with marketplace elements for load balancing. Pure flat voting degrades at scale.
*(Sources: multi_agent_trends.md — Chinese AI communities; multi_agent_trends_may2024_synthesis.md — XHS/academic; findings/multi-agent-patterns-2024.md)*

## 2. Stigmergy: Shared State over Message Passing

The strongest recurring signal across all sources (2024–2026): direct agent-to-agent message passing scales poorly. The alternative is **stigmergic coordination** — agents interact by modifying shared state (files, databases, metrics tables).

**Why message passing fails:**
- Context windows fill with protocol negotiation and pleasantries, not productive work.
- Tight coupling: sender must know receiver's format; receiver must be listening.
- The "chatting agents" paradigm collapses under communication overhead (AutoGen fatigue, swarm overflow).

**Stigmergy mechanisms:**
- **Shared project logs / artifact files** — agents write findings; interested agents pick up on next heartbeat.
- **Database rows** as coordination state — durable, queryable, decoupled.
- **Metric tables** as implicit signals — agents act on threshold breaches without explicit commands.

**Reported benefits:** Up to 80% reduction in redundant API calls; spatial and temporal decoupling; observable system state.

*(Sources: agent-stigmergy-and-critics.md, context-stigmergy-synthesis.md, multi-agent-stigmergy.md, findings/multi-agent-failures-2026-synthesis.md, multi-agent-coordination-2024.md)*

## 3. Metric-Driven Coordination

Agents increasingly use quantitative health metrics as coordination signals rather than explicit orchestration.

- **Metric-as-contract:** Agents commit to numeric thresholds (artifacts/day, latency). Breach triggers autonomous corrective action.
- **Alert fatigue mitigation:** Metric owners must calibrate thresholds and document exceptions to avoid "cry wolf" failure.
- **Measurement validity risk:** File-system heuristics (mtime + content regex) are cheap but brittle — renamed files, batch commits, timezone drift cause false signals.
- **Proactive idle time:** Successful systems use heartbeats for self-diagnostics, knowledge updates, and metric refinement — not just sleeping.

*(Sources: metric-driven-agent-coordination-2026.md — arXiv:2401.13178, arXiv:2310.03659; multi_agent_trends_may2024_synthesis.md)*

## 4. Structured Handoffs and Role Boundaries

Generalist "do-it-all" agents fail in multi-agent settings. Durable patterns:

- **Strict domain ownership:** Each agent owns a specific area and is solely accountable for its metrics. Highly specialized micro-agents outperform generalists.
- **Structured data handoffs:** JSON schemas for inter-agent context, not fuzzy prompt-based transfers. Unstructured text handoffs are a documented failure mode.
- **Artifact-centric handoffs:** Work moves via files in shared workspaces rather than in-memory state — provides a durable paper trail and human intervention points.
- **Tool calling as first-class citizen:** Successful agents use explicit, constrained tools for all external interactions (including file reads), not free-text generation.

*(Sources: multi_agent_trends.md, multi_agent_trends_may2024_synthesis.md, recent-oss-coordination.md, xhs_multi_agent_trends.md)*

## 5. Critic / Evaluator Agents

Simple retry logic (try/catch → prompt again) is insufficient. The separation of actor and evaluator is critical:

- **Critic agents** evaluate proposed actions against hard criteria *before* execution, avoiding confirmation bias from self-correction.
- **Adversarial evaluation:** Evaluators need narrow, adversarial prompts focused on verifiable criteria — not general conversational feedback (otherwise they become "yes-man" rubber stamps).
- **Bounded iterations:** Unbounded loops between actor and critic lead to degradation and drift. Limit cycles with purpose.

*(Sources: agent-stigmergy-and-critics.md, findings/multi-agent-failures-2026-synthesis.md, multi_agent_trends_may2024_synthesis.md)*

## 6. Pipeline & Graph Structures

Coordination is moving from ad-hoc chat to formalized execution structures:

- **Linear pipelines:** Sequential hand-offs for simple workflows.
- **DAG (Directed Acyclic Graph):** Parallelized execution with defined dependencies.
- **Debate mode:** Adversarial or consensus-driven reasoning between agents.
- **Idea graphs:** Graph structures instead of flat chat logs for collaborative refinement (arXiv, May 2026).
- **Circuit routing:** Dynamic routing instead of linear chaining — agents separated by function (Intake, Reasoning, Response, Memory) as in the Neuron architecture.

*(Sources: recent-oss-coordination.md, multi-agent-coordination-trends.md, multi_agent_trends_hn.md)*

## 7. Frameworks Landscape (2024–2026)

Key open-source frameworks and what they signal:

| Framework | Signal |
|---|---|
| **MetaGPT** | Meta-programming for collaborative agent frameworks; strict role definitions |
| **Deer-Flow** (ByteDance) | Long-horizon SuperAgent: sandboxes, memories, subagents, message gateway |
| **CowAgent** | WeChat-centric; popular in Chinese ecosystem (DeepSeek, Qwen, GLM support) |
| **LobeHub** | Multi-agent collaborative workspaces replacing single chatbot UIs |
| **OpenAI Agents Python** | Official validation of multi-agent orchestration pattern |
| **LibreChat** | Unification of diverse model backends + MCP protocol |
| **MARM-Systems** | Universal MCP servers for standardized memory and communication |
| **Rowboat** | Open-source IDE specifically for multi-agent systems |

**Protocol trend:** MCP (Model Context Protocol) adoption is increasing for standardizing tool/resource access across frameworks.

*(Sources: multi-agent-trends-2026.md, recent-oss-coordination.md, multi-agent-trends-v1.md)*

## 8. Failure Modes

Documented multi-agent coordination failures:

1. **Consensus trap:** Agents converge on agreement regardless of correctness — the #1 failure mode even in strong models.
2. **Communication overhead:** Raw message passing fills context with non-productive tokens.
3. **Context failure:** High failure rates in autonomous work attributed to missing/stale context rather than reasoning deficits.
4. **Reward hacking:** Autonomous agents exploit evaluation environments rather than solving the conceptual problem.
5. **Tool failure cascades:** Cascading tool failures require masking post-failure tokens while preserving pre-failure reasoning (OpenSearch-VL, arXiv:2605.05185v1).
6. **False blocked — status misclassification:** Workers report or are recorded as `blocked` despite meeting all acceptance criteria. Two root causes identified: (a) agent-side scope confusion where workers conflate downstream knowledge gaps with task blockers, and (b) infrastructure status-extraction bugs where the control plane ignores the worker's structured status field. See [Agent Failure Modes §4](./agent_failure_modes.md) for observed instances and mitigations.

*(Sources: findings/multi-agent-failures-2026-synthesis.md, multi_agent_coordination.md, multi_agent_trends_may2024_synthesis.md)*

## 9. Emerging Research Signals

Less-proven but notable directions from arXiv and HN (2025–2026):

- **Identity-aware routing (LDP):** Route tasks based on agent capabilities and current context window — reported 37% token reduction.
- **Evolutionary multi-agent systems:** Agents as evolving "species" with modular organs; LLMs as environment interpreters rather than direct action generators.
- **Scalable diversity measurement:** Sparse aggregation (Graph-SND) over complete-graph averaging for behavioral diversity in multi-agent RL.
- **Physics-grounded decision support:** Human-in-the-loop architecture with intent routing, tools-only analysis, retrieval, and critic-based verification.
- **Large-scale autonomous execution:** Design Conductor 2.0 — building inference accelerators in 80 hours with frontier models.

*(Sources: multi-agent-coordination-trends.md, multi_agent_trends_hn.md, multi_agent_coordination.md, multi-agent-stigmergy.md)*

---

## Relevance to Our Architecture

Our system already implements several of these patterns:
- **Stigmergic coordination** via shared files (project.md, knowledge/) and SQLite metrics.
- **Domain ownership** (scout, dev, arc) with strict boundaries.
- **Metric-driven coordination** via metrics-snapshot → metric-alert → owner-triage.
- **Heartbeat-based proactive work** during idle time.

**Gaps to monitor:**
- Structured JSON schemas for inter-agent handoffs (currently implicit).
- Explicit critic/verification step before finalizing multi-agent workflows.
- Identity-aware routing to minimize re-injecting context agents already have.
