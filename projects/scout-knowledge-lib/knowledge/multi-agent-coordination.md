<ai_context>
summary: "Canonical reference for multi-agent coordination patterns, synthesized from 11 overlapping notes spanning 2024–2026 research passes."
triggers: ["multi-agent coordination", "agent orchestration", "stigmergy", "multi-agent frameworks", "agent message passing", "metric-driven coordination"]
last_updated: "2026-07-18"
source_basis: "Consolidated from: multi-agent-coordination-2024.md, multi-agent-coordination-trends.md, multi-agent-trends-2026.md, multi-agent-trends-v1.md, multi_agent_coordination.md, multi_agent_trends.md, multi_agent_trends_hn.md, multi_agent_trends_may2024_synthesis.md, recent-oss-coordination.md, metric-driven-agent-coordination-2026.md, agent-stigmergy-and-critics.md. Original sources: arXiv (incl. batch 7 — ConMem, Orchestra-o1; session-state Jul 18 — RCEA, Concurrency Anomalies), Hacker News, GitHub trending, XHS/Chinese AI communities, academic surveys."
</ai_context>

# Multi-Agent Coordination Patterns

This is the canonical reference for multi-agent coordination knowledge.
Supersedes 11 overlapping notes from different research passes (2024–2026).

*(Stigmergy satellite notes — context-stigmergy-synthesis.md,
multi-agent-stigmergy.md — have been superseded into this file.)*

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

1. **Consensus trap:** Agents converge on agreement regardless of correctness — the #1 failure mode even in strong models. Now precisely measured: CARA metrics ([2606.08457]) show debate **reduces detectable contradictions** while simultaneously **decreasing reasoning chain similarity**. Agents appear to agree more but reason less consistently ("Consistency Illusion"). The **Grounded Debate Protocol** (GDP) — requiring agents to commit to named facts and take explicit stances — produces alignment improvements (Cohen's d +1.43 to +1.99) **without additional LLM calls**.
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
- **Bureaucracy-as-Architecture — Edict / 三省六部 (16k★, GitHub):** Maps the Tang Dynasty imperial bureaucracy to multi-agent orchestration. Crown Prince (太子) triages → Secretariat (中书省) plans → Chancellery (门下省) reviews with veto power ("封驳" seal-and-reject) → Department of State (尚书省) dispatches → Six Ministries (六部) execute in parallel. The Chancellery veto is compliance-by-construction: no task dispatches without institutional review. "比 CrewAI 多一层制度性审核" (one additional layer of institutional review). Source: https://github.com/cft0808/edict
- **Orchestration Reward Modeling (OrchRM):** Self-supervised framework scoring orchestration quality using intermediate artifacts from multi-agent executions. 10× token efficiency and +8% accuracy. Trains reward models at the orchestration level, not per-sub-agent. *(arXiv [2606.13598])*
- **Coordination as Distinct Bottleneck (Alem):** Open-ended multi-agent benchmark ([2606.08340]) shows **individual task competence does not imply coordination competence**. 13 frontier LLMs average ~6% normalized return. GPT-5.4-High achieves strong base-task reward but much lower coordination reward. Communication is the largest contributor to coordination; memory and reasoning help only when maintaining multi-step plans. *(arXiv [2606.08340])*
- **Multiagent Confidence Protocols:** First method for producing and evaluating a single aggregated confidence for multi-agent system outputs. Calibrated Bayesian fusion across heterogeneous debating pairs is substantially more discriminative than best single agent. *(arXiv [2606.13591])*
- **Deterministic Orchestration (Microsoft Conductor):** LLM decides *what* to do; routing and dispatch are deterministic. Compliance-by-construction applied to workflow orchestration. Source: https://opensource.microsoft.com/blog/2026/05/14/conductor-deterministic-orchestration-for-multi-agent-ai-workflows/
- **Relation-Aware Memory for Multi-Agent Coordination (ConMem, arXiv June 2026):** Training-free framework that distills historical trajectories into **structured memory cards** organized in a **relation-aware memory graph**. At runtime, retrieves cards by task needs and coordinates through the graph to resolve strategy conflicts and recover dependencies. Prunes 50%+ of expanded candidates and reduces planning overhead by 80%+. Key insight: memory *organization* (structured cards with explicit relations and conflict resolution) matters more than memory volume. Flat file storage without dependency/conflict relationships misses the key coordination primitive. *(arXiv [2606.08702], Tan, Chen, Huang, Su, Chen, Jun 2026)*
- **Omnimodal Agent Orchestration (Orchestra-o1, arXiv June 2026):** Orchestration framework for collaboration across text, image, audio, and video. Introduces modality-aware task decomposition, online sub-agent specialization, and parallel sub-task execution (+10.3% over second-best). **Decision-Aligned Group Relative Policy Optimization (DA-GRPO)** trains the orchestrator's decision-making, not the sub-agents' capabilities. Key insight: "train the orchestrator, not the workers" — improvement comes from the coordination layer. Orchestra-o1-8B achieves SotA against all existing open-source omnimodal agents. *(arXiv [2606.13707], Zhang et al., Jun 2026)*
- **Role-Contract Expectation Alignment — RCEA (arXiv June 2026):** Training method combining failure-aware supervised fine-tuning (learns from failed executions) with contract-grounded reinforcement learning (dense step-level signals derived from explicit execution contracts between role-specialized agents). Agents coordinate through **explicit execution contracts**, not implicit prompt-based expectations. The "failure-aware" component uses counterfactual/failure data for improvement — structurally different from success-only training. Key insight: coordination quality depends on contract explicitness, not prompt engineering. *(arXiv [2606.17246], GeoDisaster benchmark, Jun 2026)*
- **Verified Concurrency for Multi-Agent State (arXiv June 2026):** First machine-checked consistency hierarchy (L0⊂L1⊂L2⊂L3⊂L4) for multi-agent runtimes. Four formally characterizable concurrency anomalies: stale-generation, phantom-tool, causal-cascade, tool-effect reordering. Verified in TLA+ with 274 Verus obligations. Reproduces bugs in ByteDance deer-flow and LangGraph ToolNode. Key insight: multi-agent state sharing without isolation guarantees produces the same failure classes as concurrent databases — formal isolation levels are needed. *(arXiv [2606.17182], Jun 2026)*

- **Communication Toxicity Gradient (Jun 2026):** Five independent papers (2606.21666, 2606.22844, 2606.22203, 2606.23664, 2606.23416) converge on the finding that information sharing in MAS follows a NON-MONOTONIC value curve. Full-broadcast synchronization increases hallucination 34% above no-sync baseline (p=0.0022). Compressed memory sharing causes "context collapse." LLM coupling gain gamma (0.15-0.43) creates model-prior artifacts masquerading as consensus. The implication: **communication admission control** — minimum viable communication to avoid contamination while preventing drift — is more important than communication bandwidth. Pull-based, verified, selective sharing (our stigmergy pattern) is structurally protective. *(arXiv 2606.21666, 2606.22844, 2606.22203; see findings/2026-06-23-hn-scan-111.md)*
- **The Cost-Belief Stack (Jun 2026):** Bayesian Control for Coding Agents (2606.24453) proves orchestration is sequential hypothesis testing — a belief state over candidate correctness dominates fixed retry/verify rules across 9 benchmarks. ReM-MoA (2606.24437) proves structured cross-layer reasoning memory sustains multi-agent scaling where prior MoA variants degrade with depth. Together with SSVP (2606.21666), these form a three-layer primitive: belief controller (cost/correctness decisions) → reasoning memory (ranked traces, diversity routing) → selective sync (divergence-gated broadcast). Missing any layer produces a specific documented failure mode. *(arXiv 2606.24453, 2606.24437; see findings/2026-06-26-hn-scan-141.md)*

*(Sources: multi-agent-coordination-trends.md, multi_agent_trends_hn.md, multi_agent_coordination.md, multi-agent-stigmergy.md, findings/2026-07-17-arxiv-github-hn-triage.md, findings/2026-06-15-arxiv-agent-triage-batch7.md, findings/2026-07-18-arxiv-session-state-triage.md, findings/2026-06-23-hn-scan-111.md)*

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
- **Communication admission control:** Add divergence check / "nothing changed" short-circuit at trigger level (not session level) to prevent metric-alert cascades from amplifying failures (see Cytokine Storm, Coordination Tax).
- **Memory validity gates:** Shared knowledge should carry provenance and episodic context to prevent context collapse during cross-agent reads (see RaMem pattern, 2606.22844).
- **Non-compositional system dynamics:** Single-agent evaluation structurally cannot predict multi-agent system behavior. 2606.07552v2 proves that identical per-decision behavior produces radically different system outcomes when accumulated through shared memory in multi-agent interaction (p ≈ 0.001). A memory-free isolation probe (960 calls) shows zero per-agent behavioral change (Friedman p = 0.45); the effect is entirely emergent from memory × interaction. Implication: agent-level safety certification is necessary but insufficient — system-level evaluation is required. *(arXiv 2606.07552v2; see findings/2026-06-27-hn-scan-195.md)*
- **Trust phase transition at scale (Jun 2026):** Mathematical proof (2606.27039) that when agent population N >> memory capacity L, decentralized peer-to-peer accountability collapses via non-linear phase transition. Re-encounter probability drops as O(L/N), destroying reciprocity-based trust. Exhibits irreversible hysteresis — once norms decay, restoration is super-linear. Norms drift to whatever the formal enforcement floor provides. Combined with Codex adoption data (2606.26959) showing 5× population growth in 6 months, this proves the adoption-trust divergence is structural, not a temporary gap. *(arXiv 2606.27039, 2606.26959; see findings/2026-06-28-arxiv-scan-198.md)*
- **Cooperation through transparency (Jun 2026):** Parametric open-source games (2606.27068, ICML NExT-Game) prove a sharp coupling threshold: when agents can inspect each other's internal parameterizations, selfish gradient ascent switches from defection to cooperation. The cooperation condition is governed by the ratio of cross-player to self-player sensitivity. Suggests multi-agent protocols should include parameter/policy transparency as a design requirement. Counter-mechanism to the Opacity Spiral. *(arXiv 2606.27068; see findings/2026-06-28-arxiv-scan-198.md)*
- **Learnable communication topology (Jun 2026):** QueenBee Planner (2606.27492, SIGDIAL 2026) treats inter-agent communication topology as a retrievable and self-improving design skill. An outer LLM planner generates temporal communication DAGs (who→whom, which round, merging, final answer). Execution traces are distilled into Preserve/Modify/Avoid rules with held-out acceptance gates to prevent lucky-run crystallization. Result: RMSE 12.53→7.87 (37% improvement) while reducing messages and token cost. Systems that treat topology as fixed architectural choice leave ~37% performance on the table. Safeguards mandatory: variance-aware credit, insight falsification, structural deduplication. *(arXiv 2606.27492; see findings/2026-11-02-arxiv-scan-254.md)*
- **Gradient-based attribution for error sourcing (Jun 2026):** GBC/AgentChord (2606.28187, SIGDIAL 2026) models multi-agent systems as computational graphs with gradient-based connection weights quantifying each agent's token-level influence on downstream agents. Enables precise identification of error sources and targeted prompt optimization. Higher attribution quality associated with greater optimization effectiveness. *(arXiv 2606.28187; see findings/2026-06-29-hn-arxiv-scan-252.md)*
- **Cooperation laws from failure reflection (Jun 2026):** LLawCo (2606.28182) enables agents to reflect on past failures to extract misaligned behavioral patterns, derive high-level cooperation laws (e.g., "Talk when necessary," "Wait for partner"), and incorporate them via SFT. Average success rate +4.5% on PARTNR-Dialog and +6.8% on TDW-MAT. Laws are explicit and auditable. *(arXiv 2606.28182; see findings/2026-06-29-hn-arxiv-scan-252.md)*
