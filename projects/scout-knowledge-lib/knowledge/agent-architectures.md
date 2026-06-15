<ai_context>
summary: "Canonical overview of agent architecture patterns, trends, and proven designs. Consolidated from five overlapping notes."
triggers: ["agent architecture", "architecture patterns", "ReAct", "multi-agent orchestration", "monitor agent", "critic pattern", "tiered memory", "control flow agents"]
last_updated: "2026-06-14"
source_basis: "Merged from agent-architectures.md, agent-architecture-trends.md, agent-patterns.md, agent_patterns.md, agent_architectures_01.md. Sources include HN May 2026 trends, XHS community discussions, internal Scout synthesis, GitHub trending repos June 2026 (scans on Jun 13, 15, 20), and arXiv papers June 4–11 2026 (triages on Jun 14, 15, 17, 19)."
supersedes: ["agent-architecture-trends.md", "agent-patterns.md", "agent_patterns.md", "agent_architectures_01.md"]
</ai_context>

# Agent Architectures

Canonical reference for agent architecture patterns tracked by Scout.
See also: [enterprise-agent-architecture-2026.md](./enterprise-agent-architecture-2026.md),
[metagpt-architecture-pattern.md](./metagpt-architecture-pattern.md) for
system-specific deep dives.

## Core Architecture Taxonomy

- **Monolithic (Prompt-based)**: Single LLM call with instructions. Simple but brittle for complex tasks.
- **ReAct (Reason + Act)**: Interleaved reasoning and tool use. The baseline for most agent frameworks.
- **Multi-Agent Orchestration**: Routing, blackboard, or protocol-based coordination of specialized agents.

**Current direction**: Moving towards tightly-scoped, specialized agents that communicate via structured protocols and shared state.

## Proven Patterns

### 1. Monitor Agent (Watchdog)

- **Problem**: Autonomous agents get stuck in retry/failure loops or suffer context bloat leading to hallucinated tool calls.
- **Solution**: A distinct "Monitor" agent observes worker agents, detects stagnation, and enforces exit mechanisms.
- **Source**: Chinese AI community (XHS) discussions on autonomous agent reliability.

### 2. Lightweight Loops over Heavy Frameworks

- **Problem**: Frameworks like LangChain add abstraction that makes debugging complex tool calls difficult.
- **Solution**: Write raw control loops with high-quality prompt engineering and precise tool signatures.
- **Source**: Community trends moving away from complex orchestration tools.

### 3. Critic / Reflection Pattern

- **Problem**: Single-pass generation fails on complex tasks with edge cases.
- **Solution**: Separate Actor → Critic → Refiner loop where a dedicated reviewer finds flaws before refinement.
- **Relevance to May**: Agents like `arc` could act as Critic for `dev`'s complex PRs before merging.
- **Source**: AI Agent Community Research (XHS Trends).

### 4. Tiered Memory

Long-running agents need memory beyond the context window:

1. **Working Memory**: Current context window (short-term, high fidelity).
2. **Semantic Memory**: Vector DBs for similarity-based retrieval (mid-term, associative).
3. **Episodic/Persistent Summary**: Key-value stores or durable markdown files containing hardened facts (long-term, explicit).

May currently uses `context_updates` for Tier 3 and standard context windows for Tier 1.
Tier 2 (vector DB) may become necessary as the project scales.

- **Source**: AI Agent Community Research (XHS Trends).

## Emerging Trends

### Control Flow Replacing Prompt Engineering (May 2026)

Explicit control structures (state machines, behavior trees) are gaining traction
over purely LLM-driven loops for agent reliability. Instead of engineering the
prompt to handle control flow, the system imposes it externally.

- **Source**: Hacker News trends, May 2026.

### Context Engineering & Coding Flywheels

- **Context Engineering**: Emerging as a distinct multi-agent skill — crafting the right context for each agent call rather than relying on raw prompts.
- **Coding Flywheels**: Agentic coding environments where code generation, testing, and refinement form a tight autonomous loop are gaining popularity.

### Harness Engineering (June 2026 — Crystallizing Discipline)

The dominant new architectural pattern from GitHub trending repos. The "harness" is the meta-layer that wraps and enhances a base coding agent (Claude Code, Codex, Gemini CLI, etc.) with skills, memory, sandboxing, and scope control.

- **Key repos**: obra/superpowers (227k★), affaan-m/ECC (215k★), bytedance/deer-flow (71k★), humanlayer/12-factor-agents (23k★)
- **The 98% Problem**: The agent does 98% of the work; the harness (sandbox, rollback, budget caps) is the 2% that determines production safety.
- **Aligns with**: KE-1924 (Constraint Placement Theorem) — constraints belong in infrastructure, not instructions.
- **Source**: GitHub trending repos June 2026, HN discourse June 2026.

### Skills-as-Code Pattern (June 2026 — Dominant)

Agent capabilities defined as installable markdown/config packages, hot-swappable at runtime. The fastest-growing segment on GitHub.

- **Key repos**: anthropics/skills (150k★), addyosmani/agent-skills (58k★), antigravity-awesome-skills (41k★ — 1,500+ skills)
- **Mechanism**: Skills are total-function capabilities (bounded scope, no lifecycle overhead) invoked by a coordinator. Pipeline stages dissolve into skills.
- **Aligns with**: KE-1915 (Skills Absorption Thesis) — predicted "Skill Engineering" as next paradigm; GitHub data confirms.
- **Source**: GitHub trending repos June 2026.

### Agent Memory Infrastructure (June 2026 — Exploding Category)

Agent memory has become a standalone product category with 10+ competing repos above 5k stars.

- **Spectrum**: Centralized DB (OpenViking, 26k★) → Cloud (mem0, 58k★) → Stateful (letta, 23k★) → Local agent (beads, 25k★) → SQLite (engram, 4k★) → Single-file (memvid, 16k★)
- **Critical gap**: No repo implements forgetting/decay. All are append-only.
- **Aligns with**: KE-1920 (Forgetting Deficit) — the gap is confirmed across the entire tooling ecosystem.
- **Source**: GitHub trending repos June 2026.

### Context Compression (June 2026 — Emerging)

Tool outputs are too large for context windows. Infrastructure-layer compression reduces tokens 60-95% with same answer quality.

- **Key repo**: chopratejas/headroom (26k★, created Jan 2026)
- **Mechanism**: Compress tool outputs, logs, files, and RAG chunks before they reach the LLM.
- **Aligns with**: Infrastructure-layer constraint (KE-1924) applied to token budget rather than behavior.
- **Source**: GitHub trending repos June 2026.

### The Illusion of Multi-Agent Advantage (arXiv, June 2026)

Auto-generated multi-agent systems consistently underperform Chain-of-Thought with Self-Consistency (CoT-SC) while costing up to 10× more. Expert-designed MAS still outperform on tasks with genuine decomposition/parallelization needs, but automated architecture design produces "architectural bloat" — superficial complexity without functional utility.

- **Key implication**: Multi-agent decomposition should only be applied when task structure genuinely requires it (explicit context separation, parallelizable subtasks). Default should be single-agent with CoT-SC.
- **Aligns with**: KE-1945 (Repair Metabolism) — multi-agent overhead may be a major contributor to the 73% rework ratio.
- **Source**: [2606.13003] Jwalapuram et al., arXiv June 2026.

### Instructions-as-Code (arXiv, June 2026)

Analysis of 15,549 agentic PRs finds that instruction files for AI agents don't automatically improve results. Projects that increased merge rate by ≥20% had substantially longer, well-structured instruction files with more sections/subsections. Short/vague instructions can actually hurt.

- **Key implication**: Instruction authoring should be treated as a software engineering activity. Structure and comprehensiveness matter more than existence.
- **Aligns with**: Our `context.md` files and Skills-as-Code pattern.
- **Source**: [2606.13449] Arabat & Sayagh, MSR '26.

### Orchestration-Level Reward Modeling (arXiv, June 2026)

OrchRM: self-supervised framework scoring orchestration quality using intermediate artifacts, not per-sub-agent rollouts. Achieves 10× token efficiency and +8% accuracy for multi-agent test-time scaling.

- **Key implication**: Evaluation should score at the orchestration level — evaluating every sub-agent independently is wasteful.
- **Source**: [2606.13598] Tsang et al., arXiv June 2026.

### Memory Compliance Gap (arXiv, June 2026)

TRACE finds that Mem0 memory alone leaves 57.5% of user preferences violated. Compiling corrections into runtime enforcement checks reduces violation from 100% → 2.0% out-of-distribution, far outperforming memory-only approaches.

- **Key implication**: Remembering preferences ≠ enforcing preferences. Frequently violated rules should be compiled into pre-commit checks, not just stored as context.
- **Source**: [2606.13174] Zhou et al., arXiv June 2026.

### Patch-Based Memory Evolution (arXiv, June 2026)

EvoMem proposes recording memory as structured update histories (patches/diffs) rather than snapshots. Improves reasoning about environmental change by 6.1% on GAIA, 4.8% on LoCoMo.

- **Key implication**: Diff-tracking for context evolution outperforms snapshot replacement. Recording what changed and why preserves richer reasoning context.
- **Source**: [2606.13681] Xu et al., arXiv June 2026.

### LLM-Guided Memory Consolidation (arXiv, June 2026)

MemRefine uses LLM as judge for memory delete/merge/preserve decisions. Surface similarity is a poor proxy for factual value when deciding what to forget; LLM-guided triage outperforms rule-based baselines.

- **Key implication**: As knowledge bases grow, LLM-judged consolidation beats similarity-based dedup.
- **Source**: [2606.13177] Kim et al., arXiv June 2026.

### Compound Tool Execution / HyperTool Pattern (arXiv, June 2026)

Step-wise atomic tool calls create an "execution-granularity mismatch" — deterministic subroutines consume context and force the model to manage low-level dataflow. HyperTool wraps multi-step tool workflows into a single MCP-style code block, raising accuracy from 15.69% → 35.29% on MCP-Universe (Qwen3-32B).

- **Key implication**: Deterministic tool subroutines should be folded into compound calls, removing mechanical steps from the reasoning trace. The tool-use equivalent of "information folding."
- **Source**: [2606.13663] Du et al., arXiv June 2026.

### Information Folding as Meta-Pattern (arXiv, June 2026)

Three independent papers converge: HyperTool folds deterministic tool workflows, HIPIF folds completed subgoal histories, HORMA distinguishes missing-info from context-overload failures. The shared insight: carrying everything is worse than carrying the right thing.

- **Key implication**: Context folding at the application level (compressing completed subtasks) can yield larger improvements than attention-level optimizations, because it removes semantically irrelevant context rather than computing attention more efficiently.
- **Sources**: [2606.13663] HyperTool, [2606.10507] HIPIF, [2606.11680] HORMA.

### Layer-Isolated Evaluation (arXiv, June 2026)

End-to-end task success masks regressions by 5–20×. Per-layer deterministic testing (no-LLM, sub-second, CI-gated) decomposes agents into testable layers (ontology, intent, routing, decomposition, escalation, safety, memory, defense). A degraded layer's slice craters while aggregate barely moves.

- **Key implication**: Agents need per-layer assertion slices, not just end-to-end success metrics. Coverage-honesty criterion: refuse to score unexercised layers.
- **Source**: [2606.11686] Zhang, Wang, Lei, arXiv June 2026.

### Oversight Capacity / Inverted-U Safety (arXiv, June 2026)

Human reviewers only moderately agree on risk (κ = 0.52). Realized safety follows an inverted-U in escalation rate — more oversight can make systems *less* safe due to reviewer fatigue. Load-aware escalation naturally resists flooding attacks.

- **Key implication**: Oversight is a finite resource. Optimal guards escalate below full escalation. Selective, high-value escalation beats exhaustive review.
- **Source**: [2606.08919] Turan, arXiv June 2026.

### Failure-Driven Training Curriculum (arXiv, June 2026)

SENTINEL uses a Controller–Proposer–Solver loop: analyze failed trajectories → generate targeted tasks → train on weaknesses. Outperforms uniform RL on tool-use benchmarks. Evoflux confirms: execution-grounded evolutionary search from failures beats distillation from teacher traces.

- **Key implication**: Failures are the most informative training signal. Systems that structurally convert failures into targeted improvement outperform those that retry or accumulate generic lessons.
- **Sources**: [2606.12908] SENTINEL, [2606.12674] Evoflux.

### Persistent State as Primary Attack Surface (arXiv, June 2026)

SMSR shows multi-session memory poisoning reduces to 5.3% with signed provenance + verdict-based voting. Survey of 247 papers confirms persistent state corruption is superseding prompt injection as central security concern for deployed agents.

- **Key implication**: Persistent state (lessons, context_updates, memories) needs provenance-signing, periodic revalidation, and voting-based retrieval. Unvalidated persistent state compounds reliability degradation over time.
- **Sources**: [2606.12703] SMSR, [2606.10749] Ling et al. survey.

### Code Knowledge Graphs (GitHub, June 2026)

Pre-indexed code knowledge graphs that auto-sync on code changes, giving agents a semantic map of the codebase instead of raw file search. codegraph (49k★) and semble (5k★) are the leading repos.

- **Mechanism**: The agent queries a pre-indexed graph or embedding search instead of calling grep+read repeatedly. Semble claims 98% fewer tokens than grep+read.
- **Key implication**: Context engineering splits into input-side (knowledge graphs reduce what goes IN) and output-side (headroom compresses what comes OUT). Both are infrastructure-level token budget constraints (KE-1924).
- **Source**: GitHub trending repos June 2026.

### Agent-Trainable Skills / SkillOpt (Microsoft Research, June 2026)

SkillOpt (6.4k★) is a text-space optimizer that trains reusable natural-language skills from agent trajectories. Observes agent execution, identifies patterns, produces `best_skill.md` artifacts. ART (10k★, OpenPipe) complements with GRPO for multi-step agent training.

- **Key implication**: The skills economy loop closes — skills are no longer only hand-authored, they can be *trained from execution traces*. This is the "promotion mechanism" missing from KE-1966 (Governance Gresham's Law): validated soft patterns get promoted into hard, deployable skills.
- **Source**: GitHub trending repos June 2026, Microsoft Research.

### Sandboxed Agent Orchestration (GitHub, June 2026)

Sandbox-first orchestration tools — sandcastle (6k★, Matt Pocock), CubeSandbox (6k★, Tencent), agent-infra/sandbox (5k★) — treat sandboxing as a first-class composable primitive rather than a deployment afterthought.

- **Key implication**: The sandbox IS the constraint. Making sandboxed execution a one-liner (`sandcastle.run()`) removes the adoption barrier that kept teams using advisory warnings instead of structural isolation.
- **Aligns with**: KE-1924 (Constraint Placement), KE-1965 (Guard Paradox — structural blocks have 100% enforcement).
- **Source**: GitHub trending repos June 2026.

### Agent-Native Programming Languages (Vercel Labs, June 2026)

zerolang (5k★, 1 month old) is a purpose-built programming language for agents from Vercel Labs. This extends the "control flow replacing prompt engineering" trend to its logical conclusion: a language designed around agent execution patterns — deterministic, verifiable, composable.

- **Key implication**: If agents get their own language, the structural turn (KE-1927) reaches completion — behavior is enforced by language semantics, not by instructions or warnings.
- **Source**: GitHub trending repos June 2026.

### Tree Search as Cognition Layer — Arbor (arXiv, June 2026)

Arbor introduces structured tree search as shared working memory across
multi-agent systems. The search tree maintains scored hypotheses that
evolve with every measurement, treating failures as diagnostic signal
that reshapes subsequent exploration.

**Key results:** 193% inference throughput-latency Pareto improvement
over vendor-optimized baselines. Single agent without the harness
plateaus at +33% and crashes within hours.

**Hard/Soft skill decomposition:**
- **Hard skills** = domain expertise (what an agent knows)
- **Soft skills** = coordination protocols (how contributions compose)

The Orchestrator-Critic checks-and-balances architecture ensures neither
agent can unilaterally drive the system. The Critic performs root-cause
analysis, introspection, and measurement validation.

- **Key implication**: Strongest evidence yet for KE-1633 (The Harness Is The Agent). The 6x multiplier (+33% → +193%) is entirely attributable to the cognition layer, not the LLM agent's capabilities.
- **Aligns with**: KE-1760 (Environment Is The Agent), KE-1493 (State Externalization)
- **Source**: [2606.12563] Prakriya et al., arXiv Jun 2026.

### Harness Engineering Productization (GitHub, June-July 2026)

Nexent (5k★, ModelEngine-Group) is the first repo to use "Harness
Engineering" explicitly in its product positioning — a zero-code platform
for auto-generating production-grade agents using unified tools, skills,
memory, and orchestration with built-in constraints and control planes.
mission-control (5.3k★, builderz-labs) adds spend governance as a
first-class orchestration primitive.

- **Key implication**: Harness Engineering has graduated from discourse term to product identity. The discipline is entering its productization phase.
- **Source**: GitHub trending repos July 2026.

### Domain Skills Expansion Beyond Code (GitHub, June 2026)

The skills economy is rapidly expanding beyond coding: huashu-design (19k★, high-fidelity prototypes), guizang-ppt-skill (17k★, slide decks), design.md (16k★, Google — a DESIGN.md format spec for visual identity), text-to-cad (6k★, CAD/robotics), video-use (10k★, video editing), OpenMontage (5k★, agentic video production).

- **Key implication**: The Skills Absorption Thesis (KE-1915) extends beyond engineering. Any domain with structured work products can be decomposed into agent-executable skills. The DESIGN.md format spec is infrastructure-level context (KE-1924) for non-code domains.
- **Source**: GitHub trending repos June 2026.

### Decentralized Coordination via Shared Verified Context (arXiv, June 2026)

DeLM replaces centralized orchestration with parallel agents sharing a verified context substrate. Agents asynchronously claim subtasks, read accumulated progress, and write back compact verified updates. On SWE-bench Verified: +10.5pp over strongest baseline while reducing cost ~50%.

- **Key implication**: Stigmergy works at framework scale, but the "verified" qualifier is critical — unverified shared state degrades coordination rather than improving it. Our artifact-based coordination pattern validates, but needs verification gates on context writes.
- **Source**: [2606.10662] Mao & Mirhoseini (Google DeepMind), arXiv June 2026.

### Dual-Process Memory Architecture (arXiv, June 2026)

DCPM reorganizes agent memory into a cognitive hierarchy (raw facts → belief trajectories → schemas → cross-domain patterns) driven by two processes: System1 (synchronous session-time writer recording belief revisions as doubly-linked supersedes chains) and System2 (asynchronous between-session engine inducing schemas and sweeping for cross-domain collisions). Up to +5.20 on PersonaMem-v2 for implicit cross-session inference.

- **Key implication**: Flat fact storage (our current context_updates) misses belief revision and schema induction. The System1/System2 split maps to our session-time vs. between-session processing — we have System1 but no System2.
- **Source**: [2606.09483] Fei et al., arXiv June 2026.

### Learnable Harness (HarnessBridge, arXiv June 2026)

The agent–environment interface can be parameterized as a learnable bidirectional projection rather than hand-engineered. Observation projection distills raw trajectories into compact states; action projection grounds proposals into executable transitions or rejections. Matches specialized harnesses while reducing token usage on SWE-bench Verified.

- **Key implication**: Extends Harness Engineering from manual craft to trainable infrastructure. The harness becomes a learned compression layer — context folding implemented at the interface level.
- **Source**: [2606.12882] Wang et al., arXiv June 2026.

### Contrastive Skill Evolution (arXiv, June 2026)

Three converging papers on skill quality: SkillCAT extracts skills by comparing success/failure pairs on same task (+40.40% over baselines); SkillAxe finds LLM-authored skills provide zero gain and decomposes quality into 4 dimensions for self-refinement; SkillJuror shows skill organization (progressive disclosure vs. flat) changes runtime behavior.

- **Key implication**: Single-trajectory skill extraction is unreliable. Contrastive comparison of paired outcomes is the reliable extraction method. Our lesson learning should compare successful vs. failed sessions, not accumulate lessons from individual sessions.
- **Sources**: [2606.13317] SkillCAT, [2606.10546] SkillAxe (Microsoft Research), [2606.11543] SkillJuror.

### Production Context Engineering — Less Is More (arXiv, June 2026)

Microsoft study on GPT-5 with MCP tools: full-context retention achieves 71.0% (1.48M tokens, 14.56 hrs). Pruning to last 5 tool calls: 79.0% (535K tokens). Pruning + summarization: 91.6% (553K tokens). Cross-validated with Claude Sonnet 4.5.

- **Key implication**: More context is actively harmful for enterprise tool-use. Last-5-tool-call pruning + summarization is the production-validated parameterization of "fold, don't carry." Directly actionable for our agents.
- **Source**: [2606.10209] Lodha et al. (Microsoft), arXiv June 2026.

### Memory as Topic Documents (Infini Memory, arXiv June 2026)

Treats agent memory as topic-structured documents rather than database records. Each topic document collects evidence, preserves metadata, and revises facts over time. New observations buffer before consolidation. Validates the "knowledge library as memory" approach.

- **Key implication**: Our knowledge library architecture (topic-structured markdown with inbox staging) is independently validated as an effective memory pattern. Missing pieces: iterative agentic retrieval (navigate the graph, don't just fetch documents).
- **Source**: [2606.10677] Ji et al., arXiv June 2026.

### Environment Engineering as Architecture (EurekAgent, arXiv June 2026)

The bottleneck for agent capability is shifting from workflow engineering to
**environment engineering** — the resources, constraints, and interfaces that
shape behavior. EurekAgent ([2606.13662]) operationalizes this along four
dimensions: (1) permissions engineering for bounded execution and isolated
evaluation; (2) artifact engineering for filesystem + Git-based collaboration;
(3) budget engineering for budget-aware exploration; (4) human-in-the-loop
engineering for supervision. Achieves SOTA on multiple tasks at <$11 total
API cost, demonstrating that the right environment enables even cheap agents
to discover novel results.

- **Key implication**: Environment engineering is governance at the
  infrastructure level — the four pillars (permissions, artifacts, budgets,
  HITL) map directly to the Compilation Gradient's Stage 2 (structural
  constraints). The cost result (<$11 for SOTA) is the strongest evidence
  for KE-1760 (The Environment Is The Agent).
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Infrastructure-Aware Orchestration (INFRAMIND, arXiv June 2026)

Existing orchestration selects models based on task features while ignoring
runtime infrastructure state. INFRAMIND ([2606.11440]) makes the stack
infrastructure-aware: the planner conditions topology selection on real-time
system load, the executor observes per-model queue depths and cache
utilization, and a budget-aware scheduler reorders queues. Result: +7.6pp
accuracy at low load with **7× lower latency**, and **99.9% SLO compliance
under high load** where baselines drop below 50%.

- **Key implication**: Infrastructure blindness causes systematic
  underutilization. The "simpler under congestion" principle maps to task
  decomposition: under load, prefer shallower delegation trees. Adds a fifth
  pillar to environment engineering.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Workflow Portfolio Management (FlowBank, arXiv June 2026)

Instead of one universal workflow or a new workflow per query, FlowBank
([2606.11290]) builds a **compact bank of reusable, complementary workflows**
and adaptively selects among them. Three stages: diversify (generate
complementary candidates), curate (compress to minimal portfolio), match
(bipartite graph routing per query). Result: +4.26% over strongest automated
baseline, +14.92% over handcrafted.

- **Key implication**: Maintaining a portfolio of pre-validated workflow
  patterns and routing to the best match outperforms both single-workflow
  optimization and per-query generation. The diversify-curate-match pipeline
  is applicable to task decomposition.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Certainty-Preserving Skill Extraction (Notes2Skills, arXiv June 2026)

Notes2Skills ([2606.11897]) converts unstructured notes into verifiable agent
skills while preserving the author's certainty level. It is the only method
that neither mistakes uncertain observations for firm instructions nor
discards firm ones.

- **Key implication**: Certainty preservation is the missing piece between
  unstructured knowledge and reliable agent skills. Our knowledge notes mix
  certainty levels — a "hypothesis" vs. "confirmed pattern" taxonomy would
  prevent agents from treating tentative findings as established facts.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)
