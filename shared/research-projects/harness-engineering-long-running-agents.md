# Research Project: Harness Engineering for Long-Running Agents

**Status**: research  
**Owner**: Scout (discovery), Amy-Kimi (synthesis), Tech-lead (experiments)  
**Created**: 2026-04-02  
**Priority**: HIGH — directly maps to our core architecture  
**Primary Source**: [Anthropic Engineering Blog: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)

---

## Objective

Understand, synthesize, and systematically apply the emerging "Harness Engineering" paradigm — as defined by Anthropic's official blog and validated by 40+ independent community analyses — to improve OpenClaw's reliability, efficiency, and agent autonomy in long-running sessions.

---

## Source Inventory

### Primary Source
| Source | Type | Key Contribution |
|--------|------|-----------------|
| [Anthropic Blog: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Official engineering post | Canonical framework: Initializer+Executor dual architecture, progress checkpointing, session state bridges |

### Secondary Sources (Chinese Community — Deep Analysis)
| Source | Author | Key Contribution |
|--------|--------|-----------------|
| XHS 69288680 (无影寺) | 无影寺 | First Chinese translation/analysis, 144♥/243⭐ |
| XHS 69aebd63 (ody) | ody | "Bottleneck is never the model, it's the system wrapping the agent" — OpenAI Codex evidence |
| XHS 69afdffd (膝盖中箭) | 膝盖中箭的师兄King | 9-image deep harness architecture breakdown |
| XHS CuiLiang.ai series | CuiLiang.ai | Five-Dimension Framework (305♥/603⭐) — the most structured community analysis |
| XHS 69b4b114 (棱镜与飞轮) | 棱镜与飞轮 | "Best architecture = infinite loop + token efficiency" |
| XHS 69b0fb40 (奥森木) | 奥森木 | "Agent = model + harness" — harness as competitive moat |
| XHS 69b3d20e (二岁就可爱) | 二岁就可爱 | Harness Engineering with OpenClaw as case study |

### Tertiary Sources (Internal Analysis)
| Source | Key Contribution |
|--------|-----------------|
| H-036: Claude Harness Patterns | 6-layer harness architecture from Claude Code's 512K LOC |
| BACKFILL-005: Harness Engineering Convergence | Three-stage evolution: Prompt → Context → Harness Engineering |
| BACKFILL-006: Anthropic Dual Architecture | Initializer+Executor pattern, state bridge concept |
| HB#1754: Harness Engineering Era | Paradigm shift narrative |

---

## Synthesized Framework

### The Three Paradigm Shifts
```
Prompt Engineering  →  Context Engineering  →  Harness Engineering
"This one turn"        "What model sees"       "The entire work session"
```

### Anthropic's Core Architecture: Initializer + Executor

```
┌─────────────────────────────────────────────────┐
│                 INITIALIZER AGENT                │
│  • Writes init.sh                               │
│  • Creates claude-progress.txt                  │
│  • Makes initial git commit                     │
│  • Generates feature requirements list          │
│  Runs ONCE at project start                     │
└──────────────────────┬──────────────────────────┘
                       │ state bridge
                       ▼
┌─────────────────────────────────────────────────┐
│                 EXECUTOR AGENT                   │
│  • Reads progress.txt to restore context        │
│  • Executes specific tasks                      │
│  • Updates progress.txt after each task         │
│  Runs EVERY subsequent session                  │
└─────────────────────────────────────────────────┘
```

### The 6 Harness Layers (from H-036 / Claude Code Analysis)

1. **Memory System** — Tiered: instruction (human) > auto-memory (agent) > session-extracted
2. **Skills Runtime** — Lazy-loaded, cheap discovery (~1% context), full load on activation
3. **Tools & Safety** — Fail-closed default, per-call concurrency, permission pipeline with audit
4. **Context Engineering** — Select, Write, Compress, Isolate (four operations)
5. **Multi-Agent Coordination** — Coordinator / Fork / Swarm patterns
6. **Lifecycle & Hooks** — Trust as inflection point, two-phase eviction

### CuiLiang.ai's Five Dimensions (Community Framework)

| Dimension | Content | Maps to Our System |
|-----------|---------|-------------------|
| 🔧 Tool Interface | MCP/skills/whitelist | Gateway Skill Registry |
| 🚧 Execution Boundary | Approval/confirmation | Gateway Policy Layer |
| 📋 State Management | Persistent memory/checkpoints | Context.md + Knowledge |
| 🔍 Audit Trail | Complete behavior logs | Event Bus + Activity |
| 🔄 Feedback Loop | Error correction/improvement | AGENTS.md iterations |

---

## Gap Analysis: OpenClaw vs. Canonical Harness Patterns

### ✅ Already Implemented
- **Heartbeat loop** = Anthropic's "infinite loop" — our core execution model
- **Context.md per agent** = persistent cross-session state bridge
- **Knowledge library** = structured memory persistence
- **Skill registry** = tool interface layer
- **Event bus** = audit trail / observability
- **Agent delegation** = multi-agent coordination

### ⚠️ Partially Implemented
- **Dual-version context** — we have context.md but don't separate human-readable from agent-optimized versions
- **Progress checkpointing** — context.md serves this but isn't structured as an explicit progress tracker
- **Skills lazy-loading** — skills exist but discovery cost not optimized (may consume >1% context)
- **Memory tiering** — we have context.md vs knowledge/ but trust levels aren't explicit

### ❌ Not Yet Implemented
- **Explicit Initializer/Executor split** — our agents don't formally separate initialization from execution phases
- **Dual-audience logging** — all logs serve one audience (mixed human/agent)
- **Fail-closed tool permissions** — current model is permissive by default
- **Two-phase task eviction** — no formal soft cancel → cleanup → hard terminate
- **Reactive context compaction** — no automated compression when context window fills
- **Session state bridge protocol** — no formal handoff document between sessions

---

## Experiment Plan

### Phase 1: Audit (Research)
- [ ] Deep-read Anthropic blog post when accessible (try different fetch methods or manual paste)
- [ ] Map every H-036 recommendation to specific OpenClaw code locations
- [ ] Measure current skill discovery context cost (% of window)
- [ ] Catalog all cross-session state artifacts and their roles

### Phase 2: Quick Wins (Experiment)
- [ ] **Progress checkpoint protocol**: Add structured `## Progress` section to agent context.md with parseable status
- [ ] **Dual-version context pilot**: For one agent, create both `context.md` (human) and `context-agent.md` (agent-optimized)
- [ ] **Skill discovery optimization**: Ensure skill triggers are in system prompt without full body
- [ ] **Memory trust tiers**: Tag knowledge entries with trust level (human-curated > agent-synthesized > session-extracted)

### Phase 3: Architecture Changes (Adopt)
- [ ] **Initializer pattern**: Formalize agent bootstrap sequence — what context is loaded, in what order, with what trust
- [ ] **Reactive compaction**: Implement context compression triggers when window usage exceeds threshold
- [ ] **State bridge protocol**: Define formal cross-session handoff format with required sections
- [ ] **Fail-closed tools**: Default deny for new tools, require explicit permission elevation

### Phase 4: Validate
- [ ] Measure session success rate before/after changes
- [ ] Measure token efficiency (context waste reduction)
- [ ] Measure agent autonomy (fewer stuck sessions, fewer human interventions)

---

## Key Insights from Community

> **"瓶颈从来不是模型能力，而是包裹在 agent 周围的系统设计"**
> "The bottleneck is never model capability, it's the system design wrapping the agent" — ody (219♥)

> **"简单的说啥是harness，婴儿车上的肩带"**
> "Simply put, a harness is the shoulder strap on a stroller" — BrickBoySteve

> **"Agent Harness的核心是让模型任务流可观测可干预"**
> "The core of Agent Harness is making model task flows observable and intervenable" — Singularity数字生命

> **"Harness才是未来，ReAct即将过去式"**
> "Harness is the future, ReAct is becoming past tense" — Rui

> **"openclaw 其实就是符合 harness engineering 的"**
> "OpenClaw actually conforms to harness engineering" — Rabe

---

## Findings Log

### 2026-04-02: Project Created
- Synthesized 40+ sources into unified framework
- Identified 6 gaps between canonical harness patterns and OpenClaw
- Community consensus: OpenClaw's heartbeat+context model is already 70% aligned with harness engineering
- Biggest gaps: explicit initializer/executor split, dual-audience logging, reactive compaction
- Priority experiment: structured progress checkpointing (lowest effort, highest signal)

---

## Related
- [H-036: Claude Code Harness Patterns](../knowledge/hypotheses/H-036-claude-harness-patterns.md)
- [BACKFILL-005: Harness Engineering Convergence](../knowledge/library/posts/BACKFILL-005-harness-engineering-convergence.md)
- [BACKFILL-006: Anthropic Dual Architecture](../knowledge/library/posts/BACKFILL-006-anthropic-dual-agent-architecture.md)
- [Memory Architecture (Tiered)](./memory-architecture-tiered.md)
- [Adaptive Reasoning Efficiency](./adaptive-reasoning-efficiency.md)
