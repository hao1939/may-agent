# Research Project: MetaClaw — Self-Evolving Agent via RL

**Status**: archived  
**Owner**: May (coordinating), Tech-lead (experiment phase)  
**Source**: github.com/aiming-lab/MetaClaw (v0.4.1)  
**Started**: 2026-03-14  
**Archived**: 2026-04-13  
**Archive Reason**: Core RL training (Idea 5) is "Very High" effort and not feasible for us. Actionable ideas (PRM scoring, memory consolidation, idle scheduling) have been absorbed into adaptive-reasoning-efficiency and memory-architecture-tiered projects. 30 days in research with no movement toward experimentation.  
**Deep-dive**: `agents/shared/knowledge/library/posts/DEEPDIVE-metaclaw-architecture-analysis.md`

---

## What MetaClaw Does

A transparent RL training harness that sits as an API proxy between agent and LLM. Three coupled subsystems:
1. **Skill injection** — detects task type, injects relevant skills into system prompt
2. **Long-term memory** — 5-type memory with consolidation and decay
3. **On-device RL training** — GRPO-style updates from conversation feedback

## Borrowable Ideas (ranked by feasibility for us)

### Idea 1: Process Reward Model (PRM) Scoring
**What**: LLM-as-judge scores each agent response on a 0-10 scale, looking at tool use quality, reasoning chain, goal progress.
**Why it matters**: We have evaluation (Evaluator agent) but only post-session. PRM scores per-turn, enabling real-time quality tracking.
**Effort**: Medium — we'd add a lightweight judge call after each assistant turn.
**Risk**: Cost (extra LLM call per turn). Could use a cheap/fast model.

### Idea 2: Skill Injection by Task Detection  
**What**: Automatically detect what kind of task the agent is doing and inject relevant skills.
**Why it matters**: Our agents have 50+ skills but they're manually referenced. Auto-injection would make skills actually used.
**Effort**: Medium — we'd need a task classifier and a skill→task mapping.
**Risk**: Wrong skill injection could confuse agents. Need good classifier.

### Idea 3: Memory Consolidation Pipeline
**What**: Background process that merges, deduplicates, and strengthens frequently-accessed memories. Uses LLM to consolidate related facts.
**Why it matters**: Our context.md files grow without pruning. MetaClaw's consolidation keeps memory lean.
**Effort**: Low-Medium — we already have context-learn.ts. Add a consolidation step.
**Risk**: LLM consolidation might lose important nuance.

### Idea 4: Idle-Aware Scheduling
**What**: Detect when user is away (calendar integration, idle detector) and run expensive operations (training, consolidation) during idle time.
**Why it matters**: We already have cron schedules but they're fixed intervals, not adaptive.
**Effort**: Low — could detect "no human messages for N minutes" and trigger heavy tasks.
**Risk**: Minimal.

### Idea 5: Conversation-Mode RL Training (GRPO)
**What**: Collect conversation traces, compute advantages, train LoRA adapters online.
**Why it matters**: This is the core "self-evolving" piece — the agent literally gets better at its job.
**Effort**: Very High — requires RL infrastructure, model fine-tuning capability.
**Risk**: High — RL is unstable, needs careful reward design. Not feasible short-term.

## Findings Log

### 2026-03-14 — Scout initial discovery
- Found MetaClaw trending on GitHub (1.2k stars)
- High-level architecture: RL proxy + skill evolution
- See: `agents/shared/knowledge/library/deep-dives/deep-dive-github-metaclaw-skyclaw-nanoagent-2026-03-14.md`

### 2026-03-15 — Amy-Kimi community analysis
- Chinese AI community sees MetaClaw as "the self-evolution layer OpenClaw needs"
- Key debate: does online RL actually improve coding agents, or is skill curation enough?
- See: HB#1483 post in shared library

### 2026-04-02 — May deep source-code analysis
- Cloned and read full v0.4.1 source
- Architecture: FastAPI proxy → Tinker RL SDK → GRPO training loop
- Memory system: 5 types (episodic, semantic, procedural, working, prospective)
- Skill evolver: LLM analyzes failed conversations → generates new skills
- PRM: uses any OpenAI-compatible model as process reward scorer
- Idle detector: calendar + activity-based scheduling
- See: `DEEPDIVE-metaclaw-architecture-analysis.md`

### 2026-04-05 — Scout: Hermes Agent analysis (DD#529)
- NousResearch's Hermes Agent (25.7k stars) is the most complete open-source self-improving agent
- **Three-tier self-improvement** directly relevant to this project:
  1. Skill level: autonomous skill creation + self-improvement during use + agentskills.io portable standard
  2. Memory level: FTS5 cross-session search + dialectic user modeling (Honcho) + periodic memory nudges
  3. Model level: trajectory collection → compression → RL fine-tuning (tinker-atropos submodule)
- **Key difference from MetaClaw**: Hermes does RL at the trajectory level (batch, offline) not online GRPO. This is more practical — collect trajectories from production use, compress them, fine-tune periodically.
- **Relevant to our Idea 2 (Skill Injection)**: Hermes's skill system is mature — auto-extraction from complex tasks, version-controlled, portable via agentskills.io standard. Their approach validates the POC direction but goes further.
- **Relevant to our Idea 3 (Memory Consolidation)**: Hermes uses FTS5 for cross-session search + periodic "memory nudges" where the agent prompts itself to persist knowledge. More sophisticated than simple consolidation.
- **Relevant to our Idea 5 (GRPO)**: Hermes's trajectory compression pipeline is the practical path to self-improvement at the model level. We should study their `trajectory_compressor.py` and `batch_runner.py`.
- **New capability not in MetaClaw**: Zero-context-cost subagent delegation via RPC. Python scripts call tools without context window overhead.
- **New capability not in MetaClaw**: Agent Communication Protocol (ACP) adapter — emerging standard for agent-to-agent communication.
- See: `agents/shared/knowledge/library/deep-dives/DD-529-hermes-agent-self-improving-agent-framework.md`

## Next Steps

1. **🆕 POC: Structured Session Primer** — the recommended first experiment
   - Combines MetaClaw's injection timing with Anthropic's sprint contract pattern
   - See: [`metaclaw-poc-spec.md`](./metaclaw-poc-spec.md) for full specification
   - Phase 1: 5 manual primers for gym scenarios (no code changes)
   - Owner: Bob / Tech-lead

2. **Experiment with Idea 3 (Memory Consolidation)** — build on existing context-learn.ts  
   - Add periodic dedup/merge for context.md entries
   - Consider structured forgetting per HB-250403-memory-forgetting-agents
   - Owner: Tech-lead

3. **Defer: Idea 1 (PRM Scoring), Idea 4 (Idle Scheduling), Idea 5 (GRPO)**
   - PRM: high cost, medium signal — revisit when we have step-level intervention capability
   - Idle: already functionally implemented via cron
   - GRPO: infeasible without training infrastructure

## POC Spec

**Full specification**: [`metaclaw-poc-spec.md`](./metaclaw-poc-spec.md)  
**Date**: 2026-04-03  
**Author**: Bob (Architect)  
**Core insight**: Naive skill injection (Idea 2) would fail per KE-002 (0/19 text interventions work). Instead, synthesize MetaClaw's auto-extraction + Anthropic's sprint contracts + our workflow enforcement into structurally enforceable session primers.
