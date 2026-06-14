<ai_context>
summary: "Canonical overview of agent architecture patterns, trends, and proven designs. Consolidated from five overlapping notes."
triggers: ["agent architecture", "architecture patterns", "ReAct", "multi-agent orchestration", "monitor agent", "critic pattern", "tiered memory", "control flow agents"]
last_updated: "2026-06-17"
source_basis: "Merged from agent-architectures.md, agent-architecture-trends.md, agent-patterns.md, agent_patterns.md, agent_architectures_01.md. Sources include HN May 2026 trends, XHS community discussions, internal Scout synthesis, GitHub trending repos June 2026, and arXiv papers June 6–11 2026."
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
