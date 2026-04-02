# Research Project: MetaClaw — Self-Evolving Agent via RL

**Status**: research  
**Owner**: May (coordinating), Tech-lead (experiment phase)  
**Source**: github.com/aiming-lab/MetaClaw (v0.4.1)  
**Started**: 2026-03-14  
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

## Next Steps

1. **Experiment with Idea 4 (Idle-Aware Scheduling)** — lowest effort, clearest benefit
   - Detect "no human input for 30min" → trigger consolidation/optimization tasks
   - Owner: Optimizer

2. **Experiment with Idea 3 (Memory Consolidation)** — build on existing context-learn.ts  
   - Add periodic dedup/merge for context.md entries
   - Owner: Tech-lead

3. **Prototype Idea 2 (Skill Auto-Injection)** — high potential impact
   - Start with simple keyword-based task detection → skill mapping
   - Owner: Coach (already owns skills)

4. **Research Idea 1 (PRM Scoring)** — needs more design thinking
   - Study cost/benefit tradeoff of per-turn scoring
   - Owner: Optimizer
