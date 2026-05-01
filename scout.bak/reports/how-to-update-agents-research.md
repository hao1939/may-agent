# How to Update Agents Effectively — External Research Report

**Scout Report** | 2026-04-18 | Research on external agent-update mechanisms

---

## Executive Summary

Researched two major open-source projects for patterns on how to update/evolve agents:

1. **OpenClaw** (360k★) — Self-hosted AI gateway with hot-reloadable agent configuration
2. **EvoHarness** (ryanli-me) — Automated agent harness evolution via tree search

Key finding: **There are two fundamentally different problems** that "updating agents" can mean:

| Problem | Mechanism | Example |
|---------|-----------|---------|
| **Runtime config updates** | File-watching, layered config, skill precedence | OpenClaw |
| **Behavioral optimization** | Tree search, eval-gated proposals, fragility tracking | EvoHarness |

---

## 1. OpenClaw: Runtime Agent Updates Without Restart

### Architecture
- Gateway process hosts one or many agents
- Each agent is fully isolated: own workspace, session store, auth profiles, memory files
- Config at `~/.openclaw/openclaw.json`, workspaces at `~/.openclaw/workspace-<agentId>`

### How Agent "Updates" Work

**Skills (hot-reloadable capabilities):**
- Skills = folders with `SKILL.md` (YAML frontmatter + instructions)
- Loaded from 6 locations with strict precedence: workspace > project `.agents/skills` > personal `~/.agents/skills` > managed `~/.openclaw/skills` > bundled > extraDirs
- **Skills watcher auto-refreshes** — drop a new skill folder, agent picks it up
- Gating at load time: requires bins on PATH, env vars, config flags, OS checks
- Per-agent allowlists: `agents.list[].skills` replaces defaults entirely (no merge)
- ClawHub registry for install/update: `openclaw skills install <slug>`

**Memory (self-updating knowledge):**
- `MEMORY.md` — long-term durable facts, loaded every session
- `memory/YYYY-MM-DD.md` — daily notes, today+yesterday auto-loaded
- `DREAMS.md` — optional "dreaming" consolidation pass
- **Dreaming sweep** promotes short-term → long-term via scoring gates (recall frequency, query diversity, score threshold)
- Memory flush before compaction prevents context loss
- Semantic search (hybrid vector + keyword) across all memory

**Personality/behavior (file-based, immediate):**
- `SOUL.md` — personality guide
- `AGENTS.md` — agent instructions
- `USER.md` — user preferences
- Changes take effect next session (no restart needed)

**Multi-agent routing:**
- Bindings route messages to agents by channel/account/peer
- Most-specific-wins deterministic routing
- Cross-agent QMD memory search for shared knowledge

### Key Pattern: Layered Overrides
```
extraDirs (lowest) → bundled → managed → personal → project → workspace (highest)
```
This means you can update agents at any level — global defaults, per-machine, per-project, or per-workspace — and the most specific always wins.

---

## 2. EvoHarness: Automated Agent Behavioral Evolution

### The Problem It Solves
Agent harnesses (prompts, tools, bootstrap code) are manually tuned. Prior work (Meta-Harness) used linear hill climbing: 8 iterations, 7 wasted, 1 useful. EvoHarness replaces this with **tree search + parallel proposals**.

### Core Mechanism

**Surface Decomposition** — Break the agent into independently-editable parts:
| Surface | Risk | Notes |
|---------|------|-------|
| System prompt | LOW | Most room for improvement |
| Tool definitions | LOW | Description strings are the lever |
| Env bootstrap | LOW | Additive changes safe |
| Completion logic | HIGH | 3/4 attempts regressed in Meta-Harness |

**Proposal → Prescreen → Eval → Gate pipeline:**
1. **Proposer** (Claude Code agent) reads full execution traces of failing tasks, greps for patterns, proposes ONE change to ONE surface
2. **Prescreen** runs proposal on 3 failing tasks ($9). Any flip? Continue. No flip? PRUNE.
3. **Full eval** runs on all failing tasks + 5 canary (passing) tasks ($75)
4. **Gatekeeper** accepts only if: more tasks pass AND regressions ≤ 1

**Tree Search with Thompson Sampling:**
- Each accepted change = new branch in evolution tree
- Branches can be merged (combine prompt change + bootstrap change)
- Thompson sampling (Beta distribution) balances explore vs exploit
- Weak branches naturally die; strong ones get extended

**Fragility Tracking** (key innovation):
```
Edit 1: system_prompt → ACCEPTED → fragility 0.0
Edit 2: system_prompt → REJECTED → fragility 0.5 (MEDIUM)
Edit 3: system_prompt → REJECTED → fragility 0.67 (HIGH)
```
Proposer sees risk ratings and avoids fragile surfaces. Meta-Harness tried `completion_logic` 3 times with no stop mechanism; EvoHarness would flag HIGH after first rejection.

**Research Notebook** (memory across iterations):
- `findings.md` — what worked
- `dead_ends.md` — what failed (DO NOT REPEAT)
- `surface_risk.md` — auto-updated fragility scores
- Each new proposer reads all of this before investigating

### Results
- Meta-Harness: 8 iterations, 1 improvement, ~$2,400
- EvoHarness: 2 iterations, 2 improvements, ~$400
- 3.6x cheaper per iteration (incremental eval: only re-run failing tasks)

---

## 3. Patterns Applicable to Our System

### From OpenClaw → Our agent updates:
1. **Layered skill/config precedence** — We could adopt workspace > project > personal > shared precedence for agent instructions
2. **File-watching for hot reload** — Skills watcher pattern: drop a file, agent picks it up next turn
3. **Dreaming/consolidation** — Automatic promotion of daily observations to durable memory with quality gates
4. **Per-agent skill allowlists** — Control which capabilities each agent can use

### From EvoHarness → Our agent optimization:
1. **Surface decomposition** — Identify which parts of our agents are safe to change vs fragile
2. **Fragility tracking** — Track rejection rate per surface, auto-escalate risk ratings
3. **Research notebook pattern** — `findings.md` + `dead_ends.md` prevents repeating failed approaches
4. **Prescreen before full eval** — Cheap filter before expensive validation
5. **Thompson sampling for branch selection** — Balance exploring new approaches vs exploiting known-good ones

### Synthesis for our codebase:
Our agents already have some of these patterns:
- `agents/<name>/context.md` ≈ OpenClaw's MEMORY.md
- `agents/<name>/prompt.md` ≈ OpenClaw's SOUL.md + system prompt surface
- Heartbeat sessions ≈ OpenClaw's dreaming sweeps (but manual, not scored)

**Gaps we could fill:**
- No fragility tracking on prompt/instruction changes
- No dead_ends memory (we can repeat failed approaches)
- No formal surface decomposition (what's safe vs fragile to change)
- No prescreen/gatekeeper for behavioral changes

---

## Sources
- https://github.com/openclaw/openclaw (360k★)
- https://docs.openclaw.ai/tools/skills
- https://docs.openclaw.ai/concepts/memory
- https://docs.openclaw.ai/concepts/multi-agent
- https://github.com/ryanli-me/EvoHarness
- EvoHarness DESIGN.md and README.md (full text analyzed)
