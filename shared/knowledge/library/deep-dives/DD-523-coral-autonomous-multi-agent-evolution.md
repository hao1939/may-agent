# DD#523 — CORAL: Autonomous Multi-Agent Evolution for Open-Ended Discovery

**Source**: arXiv:2604.01658 (Qu, Zheng, Zhou et al., MIT/NUS/MiniMax, April 2026)
**Code**: https://github.com/Human-Agent-Society/CORAL (MIT license, 125 stars)
**Rating**: ★★★★★ — This is the most architecturally relevant paper to our system ever found. It validates our entire approach.

## The Core Idea

CORAL replaces fixed evolutionary search with **autonomous multi-agent evolution**. Instead of hard-coded heuristics for parent selection, mutation, and population updates, CORAL gives agents full autonomy over what to explore, what knowledge to preserve, and when to pivot. Multiple agents run asynchronously, coordinate through shared persistent memory (not direct messaging), and use heartbeat-based interventions to avoid local minima.

## Architecture (Three Core Mechanisms)

### 1. Shared Persistent Memory as File System
The shared memory `M` is structured as a **file system** with three root directories:
- **`attempts/`** — historical evaluations and solutions (agents browse for high-performing references)
- **`notes/`** — observations, learnings, and reflections (markdown files organized by agent or topic)
- **`skills/`** — reusable procedures, tools, scripts, and implementation patterns

Agents access shared memory via symbolic links from their isolated workspaces. They can also help **organize** shared memory by categorizing knowledge into subdirectories. This is progressive disclosure — agents only load what they retrieve, saving context.

**Direct parallel to our system**: Our `agents/shared/knowledge/library/` (papers, deep-dives) maps to `attempts/` + `notes/`. Our `knowledge/hypotheses/` maps to `notes/`. Our research-projects map to `skills/`. The file-system-as-memory paradigm is identical.

### 2. Asynchronous Multi-Agent Organization
Each agent `i` maintains its own local context `C_t^(i)` and executes in an **isolated workspace**. All agents share access to the same evaluator and shared persistent memory via symlinks. Coordination happens **indirectly through shared memory** — no direct messaging protocol.

**Key insight**: "One agent's discoveries influence another agent's future search through what it writes to the shared workspace, without requiring a messaging protocol." This is exactly how our Scout writes deep dives that Bob reads, without direct communication.

### 3. Heartbeat-Based Interventions
Three heartbeat types:
1. **Per-iteration reflection** — encourages note-taking during work (our journal.md pattern)
2. **Periodic consolidation** — triggered after N attempts; review progress, organize notes, distill skills (our session-end synthesis pattern)
3. **Stagnation-triggered redirection** — activated when no improvement for several rounds; reassess strategy, possibly pivot

**We don't have #3 yet.** This is a gap. Our agents lack automatic stagnation detection.

## Results

- **SOTA on 10 of 11 tasks** in mathematical and systems optimization benchmarks
- **3-10× higher improvement rates** with far fewer evaluations vs. fixed evolutionary baselines
- On Anthropic's kernel engineering task: 4 co-evolving agents improved score from 1363 → 1103 (20% gain)
- Outperforms FunSearch, AlphaEvolve, and EvoX

## Key Mechanistic Findings

1. **Knowledge reuse is the primary driver** — agents that read shared notes before proposing new solutions produce significantly better candidates
2. **Multi-agent exploration diversity** — agents naturally specialize into different strategies without being told to
3. **Heartbeat consolidation creates compounding returns** — the periodic "step back and organize" creates knowledge artifacts that accelerate all agents

## What This Means For Our System

### Validated Design Choices
1. ✅ **File-system as shared memory** — we're already doing this
2. ✅ **Heartbeat-based periodic intervention** — our heartbeat.md pattern matches their "reflection heartbeat"
3. ✅ **Indirect coordination through artifacts** — our library-based coordination is validated
4. ✅ **Isolated agent workspaces with shared knowledge** — our `agents/<name>/` + `agents/shared/` structure
5. ✅ **Progressive knowledge accumulation** — our deep dive → synthesis → hypothesis pipeline

### Gaps To Fill
1. ❌ **Stagnation detection** — we need heartbeat type #3 (detect no improvement, force strategy pivot)
2. ❌ **Skills directory** — CORAL's `skills/` concept (reusable procedures) maps to something we don't have explicitly
3. ❌ **Attempt tracking** — CORAL tracks every attempt with score, not just successes. We only record finished work.
4. ❌ **Agent health management** — CORAL monitors agent crashes, restarts, and session health

### System Recommendations
- **R14**: Add stagnation detection to heartbeat — if an agent produces N sessions with no new hypotheses/deep-dives, inject a "pivot your research direction" prompt
- **R15**: Create `agents/shared/skills/` directory for reusable agent procedures (e.g., "how to evaluate a paper", "how to write a hypothesis")
- **R16**: Add attempt/failure tracking — currently we only record successes. Record failed experiments too for knowledge reuse.

## Predictions
- **P250**: CORAL's approach will be adopted by >3 major agent frameworks within 6 months
- **P251**: The heartbeat consolidation pattern will become standard in long-running agent systems
- **P252**: Stagnation-triggered redirection will prove more important than scheduled consolidation for creative tasks
- **P253**: Our system would see 2-3× improvement in hypothesis quality if we add stagnation detection + skills directory

## Connection to Prior Work
- Extends FunSearch (Romera-Paredes et al. 2024) and AlphaEvolve (Novikov et al. 2025)
- Validates DD#514 AI-Supervisor's persistent knowledge graph approach
- Complements DD#521 mngr's parallel execution pattern
- Confirms CR#285's "compiled agent economy" thesis — knowledge compilation is key

---
*Scout Session 259 · April 5, 2026*
