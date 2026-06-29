<ai_context>
summary: "Canonical overview of agent architecture patterns, trends, and proven designs. Consolidated from five overlapping notes."
triggers: ["agent architecture", "architecture patterns", "ReAct", "multi-agent orchestration", "monitor agent", "critic pattern", "tiered memory", "control flow agents"]
last_updated: "2026-10-31"
source_basis: "Merged from agent-architectures.md, agent-architecture-trends.md, agent-patterns.md, agent_patterns.md, agent_architectures_01.md. Sources include HN May 2026 trends, XHS community discussions, internal Scout synthesis, GitHub trending repos June 2026 (scans on Jun 13, 15, 20), and arXiv papers June 2–16 2026 (triages on Jun 14, 15, 17, 19, batch 6/7, session-state Jul 18, runtime-hardening Jul 22). Batch 6 sourcing: Intelligence Entropy, Strained Coherence, Cold-Start Safety Gap, Decision-Aware Memory Cards, IntentKV, MemoPilot, Bayesian-Agent. Session-state sourcing (Jul 18): Concurrency Anomalies, TokenPilot, CacheWise, Insight Governance, SaliMory. Runtime hardening sourcing (Jul 22): Cordon semantic transactions, CoAgent advisory concurrency, Looking Is Not Picking readout bottleneck, PreAct run compilation, SkillWeaver compositional routing, ADE stabilization framework. Jul 22 GitHub scan: Loop Engineering, Architectural Laziness (ponytail 30k★), Cross-Vendor Orchestration, Memory Lifecycle narrowing. §Process Harness & §Architecture Gradient extracted to agent-runtime-hardening.md (2026-10-31)."
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

- **Key repos**: obra/superpowers (231k★), affaan-m/ECC (216k★), bytedance/deer-flow (71k★), humanlayer/12-factor-agents (23k★)
- **The 98% Problem**: The agent does 98% of the work; the harness (sandbox, rollback, budget caps) is the 2% that determines production safety.
- **Aligns with**: KE-1924 (Constraint Placement Theorem) — constraints belong in infrastructure, not instructions.
- **Sub-discipline emerging**: **Loop Engineering** — designing agent execution
  cycles with explicit cost accounting, retry budgets, and abort conditions.
  cobusgreyling/loop-engineering (353★) provides `loop-audit`, `loop-init`,
  `loop-cost` CLI tools. Where harness engineering wraps the agent, loop
  engineering structures its inner cycle. Validates the Compilation Threshold
  thesis: practitioners are building cost-awareness into execution loops.
- **Source**: GitHub trending repos June–July 2026, HN discourse June 2026.

### Architectural Laziness (July 2026 — Explosive Growth)

DietrichGebert/ponytail (49,647★ as of Jun 23, from 4.5k→30k→50k in 11 days)
encodes a design principle: "Makes your AI agent think like the laziest senior
dev in the room." The optimal session is the one that doesn't run. Optimizing
for NOT doing work — the cheapest code is the code you don't write. Benchmark:
**54% less code, 20% cheaper, 27% faster** on real Claude Code sessions
(Haiku 4.5, n=4, 12 feature tasks).

- **Why it resonates**: ponytail is the fastest-growing philosophy repo in
  agent history. It's the Abstention Advantage crystallized as open-source:
  structural inaction is more valuable than marginal action.
- **Aligns with**: Abstention Advantage synthesis, Compilation Threshold
  ("38% of budget is LLM reasoning about deterministic answers").
- **Source**: GitHub trending repos Jun–Jul 2026 (star velocity tracked
  across seven scans; 50K confirmed via GitHub API 2026-06-23).

### The Skill Cambrian Explosion (June 2026 — Phase Transition)

Agent capabilities are propagating as installable Markdown files (SKILL.md),
not framework APIs. 40+ skill repos created in June 2026 alone. The format is
cross-vendor: works with Claude Code, Codex, Cursor, and others.

Key ecosystem layers:
- **Platform registry**: anthropics/skills (154K★, 18K forks) — the canonical skill repo
- **Skill collections**: BuilderIO/skills (2,450★), guard-skills (877★)
- **Domain skills**: baoyu-design (1,778★), effective-html (1,129★), security-audit-skill (358★)
- **Meta-skills**: luban-skill (464★, skill polishing), lazyskills (75★, first skill manager TUI)
- **Platform exports**: xcode27-skills (103★, Apple official), alpaca-skills (87★)

The installation model is radical: `cp SKILL.md .` — zero dependency management,
composition by concatenation. Git is the version control, GitHub is the registry.
Prediction: `skills.json` manifest or equivalent within 3 months; first skill-layer
supply-chain incident within 6 months.

- **Source**: GitHub API search Jun 23: 40+ repos matching "agent skill" created
  since 2026-06-01. See scan #107 for full table.

### Cross-Vendor Agent Orchestration (July 2026 — Emerging)

Deliberate model mixing: one model for planning, another for execution, with
the repo as shared memory. architect-loop (492★) uses Claude Fable 5 as
architect and GPT-5.5 Codex as builder. FableCodex (254★) and fable-mode
(450★) implement Fable-style multi-stage planning as portable skills.

- **Key insight**: "Repo as memory" sidesteps the entire memory infrastructure
  category — the codebase itself is the persistent state. Models are
  interchangeable components selected by strength.
- **Aligns with**: Substrate Inversion (intelligence in the loop architecture,
  not the model).
- **Source**: GitHub trending repos June–July 2026.

### Skills-as-Code Pattern (June 2026 — Dominant)

Agent capabilities defined as installable markdown/config packages, hot-swappable at runtime. The fastest-growing segment on GitHub.

- **Key repos**: anthropics/skills (150k★), addyosmani/agent-skills (58k★), antigravity-awesome-skills (41k★ — 1,500+ skills)
- **Mechanism**: Skills are total-function capabilities (bounded scope, no lifecycle overhead) invoked by a coordinator. Pipeline stages dissolve into skills.
- **Aligns with**: KE-1915 (Skills Absorption Thesis) — predicted "Skill Engineering" as next paradigm; GitHub data confirms.
- **Source**: GitHub trending repos June 2026.

### Agent Memory Infrastructure (June 2026 — Exploding Category)

Agent memory has become a standalone product category with 10+ competing repos above 5k stars.

- **Spectrum**: Centralized DB (OpenViking, 26k★) → Cloud (mem0, 58k★) → Stateful (letta, 23k★) → Local agent (beads, 25k★) → SQLite (engram, 4k★) → Single-file (memvid, 16k★)
- **Critical gap (narrowing)**: Mainstream repos remain append-only, but memory
  lifecycle tooling is now an emerging sub-category. YourMemory (245★,
  Ebbinghaus-curve decay, claims +16pp over Mem0 on LoCoMo). icarus-memory-infra
  (289★, provenance + supersession + rollback). memwatch (28★, staleness
  detection + auto-expiry). Memory-Like-A-Tree (124★, confidence-based decay).
  The forgetting gap is shifting from "zero implementations" to "lifecycle
  wrappers emerging around append-only stores."
- **Aligns with**: KE-1920 (Forgetting Deficit) — gap persists in mainstream
  (mem0, cognee, letta) but lifecycle tooling is the emerging bridge.
  The Eternal Present synthesis predicted provenance and expiry as the
  first temporal primitives to appear; confirmed by icarus and memwatch.
- **Source**: GitHub trending repos June–July 2026 (six consecutive scans).

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

### Practitioner Local Model Inflection (HN, June 2026)

Two simultaneous HN front-page stories (~2,500pts combined, 654 comments)
confirm a practitioner migration from cloud APIs to local models for coding:

- **Model convergence**: Qwen 3.6 27B (dense, reliable) and Qwen 3.6 35B-A3B
  (MoE, fast) dominate. Gemma 4 26B-31B is secondary. Hardware: M5 Max 128GB,
  RTX 3090/6000, Strix Halo 128GB. Throughput: 50-160 tok/s.
- **Replacement rates**: 80-100% for application code (web, Django, React).
  Near-0% for systems/infra work (Ansible, Helm, underdocumented APIs).
- **The harness is the differentiator**: Every successful migration report
  mentions Pi harness, OpenCode, or custom wrappers — not the model.
  schmuhblaster: "I managed to boost [Qwen 35B] significantly with my own
  custom harness." Hybrid setups (Opus for plans, local for execution) common.
- **SpaceX/Cursor $60B acquisition** (988pts, 226c) validates harness-as-product
  at scale, but HN community already migrating away from Cursor to Claude Code,
  Codex, or local setups.
- **Key implication**: Model capability is commoditizing. The harness layer is
  where differentiation concentrates. This is the strongest practitioner
  evidence for the Harness Engineering thesis.
- **Source**: HN, two stories, June 2026. findings/2026-06-18-hn-scan-31.md.

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

### Tool Deference as Structural Property (arXiv, June 2026)

When LLM agents are equipped with callable tools (e.g., a GNN for node
classification), they agree with raw tool output 97.6–99.2% of the time —
the agent becomes a "tool parrot" that bypasses its own reasoning. **Critically,
deference increases with model capability**: agreement rises from 0.60 (1.5B)
to 0.98 (7B). The per-node oracle beats the deferring agent by 0.09–0.22.

- **Key implication**: Tool deference is not a weak-model artifact — it's a
  structural property that *worsens* with capability. A selective-invocation
  gate (structural, compiled) is required; expecting agents to "use judgment"
  via prompting fails precisely where it matters most. Behavioral governance
  over tool outputs is unreliable in both directions: agents either collapse
  into tools (deference) or override intended policies with internal biases
  (seen in social simulation evaluations, [2606.12369]).
- **Source**: [2606.14476] Wang & Vemuri, arXiv June 2026.

### Workspace + Skill Paradigm — "From Chatbot to Digital Colleague" (arXiv, June 2026)

The LLM transition from conversational generators to persistent autonomous
systems is now formally named in the academic literature. The framework
organizes along two dimensions:

1. **Cognitive core**: fast thinking (next-token) → inference-time CoT →
   reflection → process supervision → RL.
2. **Tool-augmented execution**: ad-hoc tool calling → persistent Workspaces
   + reusable Skills + verification loops + governance.

The "Workspace + Skill" paradigm is explicitly named as the bridge from
episodic to colleague-like behavior. Data shifts from instruction-response
pairs to State-Action-Observation (SAO) trajectories. Evaluation shifts from
static benchmarks to sandboxed, auditable, self-evolving ecosystems.

- **Key implication**: This is a naming event for patterns already tracked
  across OpenClaw/Niuma (XHS), harness engineering (GitHub), and our
  synthesis library. The SAO trajectory format converges with HarnessFix's
  HTIR and SkillAudit's paired trajectory methods — all treating
  trajectories as first-class data.
- **Source**: [2606.14502] Zhang, Liu, Zhu, Wang, Chen, arXiv June 2026.

### Harness Repair as Distinct Discipline — HarnessFix (arXiv, June 2026)

HarnessFix introduces trace-guided diagnosis and repair for agent harnesses,
adding a **repair** stage to the harness engineering lifecycle (which now spans
design → learning → repair → audit). Key innovation: compiles raw execution
traces into a **Harness-aware Trace Intermediate Representation (HTIR)** that
normalizes fragmented trajectory evidence, captures step-level provenance,
and attributes failures to responsible layers. Generates scoped repair patches.

Results: +15.2–50.0% improvement over initial harnesses on SWE-Bench Verified,
Terminal-Bench 2.0, GAIA, and AppWorld — outperforming human-designed and
self-evolution baselines.

The ETCLOVG layer taxonomy (Environment, Tools, Context, Lifecycle,
Observability, Verification, Governance) maps remarkably to our synthesis
series — each synthesis identified pathologies in one or more of these layers.

- **Key implication**: Outcome-based self-improvement produces "broad,
  indirect, or poorly scoped changes"; trace-guided diagnosis produces
  targeted repairs. HTIR — a machine-analyzable intermediate representation
  of trajectories — is the critical primitive our system currently lacks.
- **Source**: [2606.06324] Chen, Wang, Liu, Wang, Wang, arXiv June 2026.

### Communication Policy as Evolvable Design Dimension (arXiv, June 2026)

Communication Policy Evolution (CPE) formalizes communication behavior as a
"critical yet underexplored design dimension" for LLM agents. Establishes
textual and UI-based policies, evaluates across diverse environments. Two
settings: User-Agent (external) and Planner-Executor (internal coordination).

Without model modification, CPE achieves best task success through prompt-level
evolution alone. Text-based interaction facilitates task performance; structured
UI improves response quality and persona compliance.

- **Key implication**: If communication policy is a tunable parameter (not a
  fixed cost), coordination overhead may be partially addressable through
  policy optimization rather than architectural restructuring. Challenges the
  Coordination Tax's apparent inevitability. The Planner-Executor setting
  maps directly to our planner→worker pattern.
- **Source**: [2606.14314] Ma, Qiu, Yao, Wu, Lu, arXiv June 2026.

### Multi-Agent Orchestration as CLI Composition (arXiv, June 2026)

"Agents All the Way Down" ([2606.11869]) writes down the undocumented practice
of building custom AI agents end-to-end as a methodology. Core corollary:
**multi-agent orchestration is just CLI composition**. The Turtle pattern
(harvest agent output → fold into CLI → ship) is the "fold, don't carry"
meta-pattern applied to agent productization. Framework-free by construction.
Built and validated in ~10 days by one developer with an AI pair-programmer.

- **Key implication**: CLI-composition means compiled interfaces with zero
  ambiguity, deterministic routing, and typed I/O — all properties that
  soft governance (prompt-based routing) lacks. Challenges the assumption
  that multi-agent systems need frameworks at all.
- **Source**: [2606.11869] Forment, Pereira, García-Peñalvo, Casañ Guerrero.

### "Agent Is the Software" Paradigm Shift (arXiv, June 2026)

Formalizes the distinction: in traditional software, code carries pre-written
decision logic; in agentic software, the agent itself IS the software and
decision logic is generated at runtime. Argues this constitutes a fundamental
restructuring of what software is, not just "using LLMs as tools."

- **Key implication**: If agents are software with runtime decision logic,
  then understanding patterns of that logic (our syntheses) is equivalent to
  understanding software architecture. The non-deterministic runtime decision
  generation is precisely why the Compilation Gradient matters.
- **Source**: [2606.05608] Cao, arXiv June 2026.

### Intelligence Entropy — Degradation as Physical Constraint (arXiv, June 2026)

Systematic analysis of 40,000+ controlled trials and 100,000+ production
interactions. Identifies 22 intrinsic properties across six lifecycle layers
(foundation semantics, inter-agent transmission, memory persistence, task
execution, feedback correction, systemic evolution). System entropy — loss of
output consistency, task accuracy, cross-session coherence — increases
monotonically: **S(t) = S₀ · e^(α·t)**.

The six lifecycle layers map to observed pathologies: foundation semantics
(prompt mass), inter-agent transmission (coordination tax), memory persistence
(context accumulation), task execution (session floor), feedback correction
(evaluation mirage), systemic evolution (meta-escalation ratchet).

- **Key implication**: Silent failure is not a software bug but a **physical
  constraint** — Intelligence Entropy. The exponential growth formulation
  means the question isn't whether degradation happens but how fast α is.
  Systems without deterministic governance at each lifecycle boundary
  accumulate disorder. The empirical α parameter is measurable and
  comparable across architectures.
- **Source**: [2606.08162] Liu, arXiv June 2026.

### Strained Coherence — Pre-Failure Detection Signal (arXiv, June 2026)

Agents emit detectable pre-failure signals: they verbalize a tension in
their reasoning then proceed to fail anyway. A trajectory-reading judge
identifies spans where agents name a problem but optimize a proxy.

- Flagged trajectories fail **94% vs 46% unflagged** (47-point gap, p=0.003).
- First flag appears at **median 83–84% of elapsed trajectory time** —
  a narrow but actionable intervention window.
- Signal survives paraphrasing; model-general but requires verbalized
  reasoning (zero-think trajectories lack substrate for detection).
- **Key implication**: Mid-session monitoring for "I know this is wrong but
  I'll continue" language provides a high-precision failure predictor. The
  late timing (83%) means abort-not-correct is the realistic intervention.
- **Source**: [2606.07889] Pandya, Zhang, Lyu, arXiv June 2026.

### Cold-Start Safety Gap — Positional Vulnerability (arXiv, June 2026)

Agents are **most vulnerable at session start** and become substantially
safer after regular tasks prime safety-relevant representations. SODA
benchmark across 7 models from 4 families: safety improves **9–52%** with
warm-up tasks (0→20 preceding regular tasks). Regular tasks are the primary
driver, not the agent's prior responses.

- **Key implication**: Session start is a vulnerability window. Standardized
  warm-up operations may provide safety priming that context file loading
  alone cannot. The Session Floor's overhead might paradoxically serve as
  safety priming — a surprising benefit of fixed per-session cost.
- **Source**: [2606.07867] Sun, Liu, Weng, arXiv June 2026.

### Decision-Aware Memory Cards — Counterfactual Context (arXiv, June 2026)

Instead of retrieving memory by semantic similarity, scores memory by
predicted **action-shift** — would including this memory change the agent's
decision? Counterfactual-inspired compression selects context that maximizes
behavioral change, not textual relevance.

- **Key implication**: Before loading knowledge into agent context, the right
  question is "would this change the decision?" not "is this relevant?" Most
  semantically relevant context doesn't change actions — it's padding.
  Connects to Less-Context-Is-More principle and prompt mass problem.
- **Source**: [2606.08151] arXiv June 2026.

### IntentKV — Decision-Aware KV Cache Pruning (arXiv, June 2026)

Reduces KV cache by **77.8%** by pruning tokens based on their contribution
to downstream decisions rather than attention weight alone. Intent-aware
pruning preserves decision-critical context while discarding tokens that
are attended but non-influential.

- **Key implication**: Most attended-to context doesn't influence decisions.
  This confirms the decision-aware memory principle at the infrastructure
  level — relevance ≠ influence. Compression that targets influence
  rather than relevance achieves much higher ratios.
- **Source**: [2606.IntentKV] arXiv June 2026.

### MemoPilot — RL Over Memory Operations (arXiv, June 2026)

Treats memory read/write/update as a learnable policy rather than a
hard-coded retrieval pipeline. RL optimizes when to write, what to retain,
and when to consolidate — the memory management policy itself evolves with
task experience.

- **Key implication**: Hard-coded memory policies (always append, retrieve
  top-k) are suboptimal. Memory management is itself a learnable skill that
  should evolve. Connects to the forgetting deficit — the system needs
  learnable forgetting, not just learnable retrieval.
- **Source**: [2606.MemoPilot] arXiv June 2026.

### Bayesian-Agent — Posterior-Guided Skill Evolution (arXiv, June 2026)

Maintains effectiveness posteriors over skills, conditioned on context.
Updates with session outcomes. Skills with consistently negative posteriors
are retired; high-posterior skills are applied more aggressively. Achieves
SOP-Bench improvement from 80% → 95%.

- **Key implication**: Skills/lessons should have tracked effectiveness
  priors that update with evidence. "This lesson helped in context X" is
  Bayesian updating over skill utility. Connects to the Knowledge Asymmetry
  — KEs that never influence behavior should decay, not accumulate.
- **Source**: [2606.08348] arXiv June 2026.

### Verified Concurrency Anomalies in Multi-Agent State (arXiv, June 2026)

Multi-agent LLM systems sharing state through memory stores, vector indices,
and tool registries produce four formally characterizable concurrency anomalies
— structural analogues of classical database isolation failures:

1. **Stale-generation** — agent reads outdated state, generates based on it
2. **Phantom-tool** — tool registry changes between plan and execute
3. **Causal-cascade** — downstream agent acts on retracted upstream result
4. **Tool-effect reordering** — concurrent tool calls commit in wrong order

First machine-checked consistency hierarchy (L0⊂L1⊂L2⊂L3⊂L4) for multi-agent
runtimes, verified in TLA+ with 274 Verus obligations. Reproduces a silent
lost update in **ByteDance's deer-flow** (formalized as L0→L1 refinement fix)
and tool-effect reordering in **LangGraph's ToolNode** (fixed by L3
commit-order sequencer). Three deployed Rust runtimes realize L0-L1; L2 runs
live across three model families.

- **Key implication**: Provides precise vocabulary for failures previously
  classified as "overhead" or "waste." Our Ghost Metabolism (sessions acting on
  retracted state) is exactly stale-generation + causal-cascade. The
  consistency hierarchy suggests moving from L0 (no isolation) to L1
  (serializable session state) would eliminate ghost recoveries structurally.
- **Source**: [2606.17182] arXiv June 2026.

### Cache-Efficient Context Management — TokenPilot (arXiv, June 2026)

Text pruning/eviction to reduce context **breaks prompt cache continuity**.
The critical tradeoff is text sparsity vs. prompt cache continuity — existing
approaches save tokens but invalidate the cache, making "savings" net-negative.

TokenPilot uses dual-granularity architecture:
- **Global: Ingestion-Aware Compaction** — stabilizes prompt prefixes and
  eliminates environmental noise at the ingestion gate (not after)
- **Local: Lifecycle-Aware Eviction** — monitors residual utility of context
  segments, offloads only when task relevance expires

Results: 61% cost reduction (isolated) and **87% cost reduction in continuous
mode** on Claw-Eval, maintaining competitive task performance throughout.

- **Key implication**: Confirms the Verification Inversion thesis implemented:
  gate quality at input, not output. The 87% continuous-mode savings quantify
  gains from prefix-stable session architecture. "Lifecycle-aware eviction"
  maps to session-floor analysis — content should be evicted based on task
  phase, not age.
- **Connects to**: Cold Start Tax (prefix reuse = warm sessions), Verification
  Inversion (input gating > output evaluation), Prompt Mass Problem (input
  costs dominate; compaction at ingestion is the fix).
- **Source**: [2606.17016] arXiv June 2026. Code: github.com/zjunlp/LightMem2.

### KV-Cache for Coding Agent Workloads — CacheWise (arXiv, June 2026)

Coding agent sessions are fundamentally different from chat workloads: they
execute as **long-running closed-loop sessions** where generations alternate
with tool calls, repeatedly reuse large prefixes, and create sustained
KV-cache pressure that conventional serving policies handle poorly.

First empirical characterization of real-world coding agent serving traces.
Prefix-aware scheduling + reuse-aware eviction from tool-call metadata yields
**2–2.6× fewer KV-cache evictions** and **3.5× improvement in total agent
session completion time**.

- **Key implication**: Infrastructure-level evidence for the Cold Start Tax.
  High-abstention agents (97.7% quick-exit rate) create exactly this pattern:
  many sessions sharing large prefixes (context.md, task tree), executing
  briefly, terminating. The 3.5× completion time improvement suggests session
  throughput is severely degraded by naive cache management.
- **Connects to**: Cold Start Tax (prefix reuse infrastructure), Session Floor
  (fixed overhead from re-prefill), Evaluation Mirage (evaluator sessions
  share 95%+ prefix content).
- **Source**: [2606.16824] arXiv June 2026.

### Insight Governance — Verbal RL with Knowledge Lifecycle (arXiv, June 2026)

Verbal RL (learning from world feedback by extracting rules as context) faces
a **retention-forgetting dilemma**: retaining stale insights causes negative
transfer, discarding them causes catastrophic forgetting when conditions recur.
Accumulated experience either **degrades performance below zero-shot** or
dramatically improves it, depending entirely on whether a curation loop
governs insight lifecycle. Accepted at ICML 2026 RLxF Workshop.

Three-layer architecture:
- **Rules** — distilled experience from world outcomes
- **Evidence** — logs tracking each rule's reliability across episodes
- **Skills** — govern which rules to apply, resolve conflicts, decide when
  to abstain

Four requirements: outcome-driven evaluation, persistent structured evidence,
non-monotonic knowledge lifecycle, compositional governance.

- **Key implication**: Formal theory for Abstention Decay and Knowledge
  Asymmetry. Our KE entries are "rules" without "evidence logs" or "skills"
  governance. They accumulate monotonically (context.md grows, no pruning).
  The paper predicts this will eventually degrade performance below the
  no-knowledge baseline. The three-layer architecture is a concrete design
  pattern for knowledge lifecycle management.
- **Key quote**: "Existing methods invest heavily in experience extraction
  while underinvesting in insight governance."
- **Source**: [2606.17591] arXiv June 2026 (ICML RLxF Workshop).

### Stage-Wise Process Reward for Memory — SaliMory (arXiv, June 2026)

Standard RL creates a **credit assignment bottleneck** in multi-stage memory
pipelines. SaliMory uses hierarchical stage-wise process reward +
reward-decomposed contrastive refinement, providing isolated supervision for
each memory operation (filtering, consolidation, cue-driven recall).

Results: Memory-attributed failures cut by **1/3**, end-to-end accuracy >10%
over SOTA, good personalization rate more than doubled.

- **Key implication**: Concrete implementation of the Verification Inversion
  thesis — reward the filtering, reward the consolidation, reward the recall,
  *separately*. Our system currently evaluates only the final session output,
  missing intermediate quality signals. Each processing stage should have
  its own reward signal.
- **Connects to**: Verification Inversion (evaluate each pipeline stage),
  Representation Gap (improvement needs different lens than execution),
  Evaluation Mirage (single-score evaluation hides stage-specific failures).
- **Source**: [2606.04120] arXiv June 2026.

## Runtime Hardening (June 2026 — Emerging Layer)

→ **Extracted to companion note**: [Agent Runtime Hardening](./agent-runtime-hardening.md)

8 named patterns covering effect containment, advisory concurrency, run
compilation, compositional skill routing, entropy stabilization, harness
evolution, and false-success detection. Sources: Cordon [2606.17573], CoAgent
[2606.15376], Looking Is Not Picking [2606.16364], PreAct [2606.17929],
SkillWeaver [2606.18051], ADE [2606.18065], Harness Updating [2605.30621],
False-Success Detection [2606.09863].

## Process Harness & Composition Governance (June 2026)

→ **Extracted to companion note**: [Agent Runtime Hardening](./agent-runtime-hardening.md)

Two patterns formalizing the "deterministic engine + policy-governed agents" concept:
CUGA FLO process harness ([2606.27188]) and NOVA architecture gradient ([2606.27243]).
See companion note for full descriptions.
