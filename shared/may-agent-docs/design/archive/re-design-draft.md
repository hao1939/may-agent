# may-agent: Architecture Design

## Overview

may-agent is a multi-agent orchestration system built on top of [pi-agent-core](https://github.com/mariozechner/pi-agent-core). It turns a single-agent runtime into an autonomous, persistent, multi-agent system that builds knowledge and improves its own execution over time.

Two halves: **Infrastructure** (the runtime, what makes agents work) and **Agent Layer** (what agents are, know, and produce).

---

# Part 1: Infrastructure

The runtime that makes everything work. Agents don't touch this code — they interact with it through tools and conventions.

```
┌─────────────────────────────────────────────────────────┐
│  Applications (all driven by events, all use the core)  │
│  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐  │
│  │ Metrics  │ │ Projects │ │  Gym  │ │ Web UI / CLI │  │
│  └──────────┘ └──────────┘ └───────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│  L3  Handlers + Workflows + Guards                      │
├─────────────────────────────────────────────────────────┤
│  L2  Event Bus                                          │
├─────────────────────────────────────────────────────────┤
│  L1  Session Management                                 │
├─────────────────────────────────────────────────────────┤
│  L0  Agent Runtime (pi-agent-core)                      │
└─────────────────────────────────────────────────────────┘
```

**L0–L3** are the core stack — strict vertical dependencies.  
**Applications** are peers built on the core. They interact with each other through data (metrics feed heartbeats, gym feeds metric snapshots, projects use workflows) but don't form a hierarchy.

Everything above L2 is event-driven: timers, bus events, and agent requests all flow through the same event → handler → workflow pipeline.

---

## L0: Agent Runtime

**What**: pi-agent-core `Agent` class. Prompt in, tool calls out, message accumulation.

**Provides**: One agent, one conversation, tool execution loop.

**Does NOT provide**: Persistence, scheduling, multi-agent, safety guards.

---

## L1: Session Management

**What**: Wraps L0 to make agents production-usable.

**Provides**:
- **Persistence** — sessions survive restarts, messages saved to disk
- **Compaction** — automatic context window management for long conversations
- **Tool guards** — invisible safety layer (prevent hallucinated paths, dedup reads, enforce edit discipline, commit safety, verification depth)
- **Error handling** — classify errors, retry infra failures, detect shallow outputs
- **Multi-agent registry** — register agents with different prompts, tools, models, budgets
- **Request tracking** — SQLite-backed record of every agent invocation

---

## L2: Event Bus

**What**: Single pub/sub bus. Everything emits events, anything can subscribe.

**Provides**:
- Decoupled communication — components interact through events, not direct calls
- 24 event types: `session_start`, `session_end`, `fork`, `message`, `metric`, `notification`, etc.

**Key insight**: This is the coordination primitive. Agent A finishing emits `session_end`. A handler sees it and starts Agent B. No agent-to-agent coupling needed.

---

## L3: Handlers + Workflows + Guards

**What**: The autonomy layer. Everything is event-driven: timer ticks, bus events, and agent tool calls all enter through handlers.

```
Event (timer tick / bus event / agent tool call)
  → Handler (entry point — receives event, decides what to do)
    → Workflow (implementation — orchestrates agents)
      → Guards (reactive checks — can warn, block, or inject steps)
```

### Handlers — Event interface

Handlers are the single entry point for all automation. They receive events and decide what to do.

- **Timer-driven** — fire periodically (heartbeats, project scans, metric snapshots)
- **Event-driven** — react to bus events (metric breach, session end, etc.)
- **Agent-driven** — the `workflow` tool is itself a handler for "agent requested a workflow"

All handlers are registered in `cron.json` — convention over configuration. Each entry specifies a timer schedule or event trigger, and which handler file to run.

### Workflows — Implementation

Workflows are the logic that handlers (or agents) invoke. They orchestrate agent sessions through a unified engine.

Three types:
- **Pure JS** — `metrics-snapshot` measures all metrics, no LLM. Fast and cheap.
- **Session orchestration** — `master-worker` creates persistent reviewer + worker sessions. `verify-wrap` ensures work gets verified.
- **Context collection** — `bob-heartbeat` gathers metrics, projects, alerts into an agent prompt.

**Shared workflows** (`agents/shared/workflows/`) are available to all agents.
**Agent-specific workflows** (`agents/<name>/workflows/`) are custom to one agent.

### Workflow Engine — Unified Execution

All workflows execute through one engine (`src/lib/workflow-tool.ts`), regardless of who triggers them.

**Two callers, one engine:**

| Caller | Entry point | How |
|--------|-------------|-----|
| **Agent** (tool) | `workflow.run("verify-wrap", task)` | `createWorkflowTool()` → agent tool |
| **System** (handler) | Project handler launches project workflows | `runWorkflowDirect()` → same engine |

Both paths get: guards, step tracking, WorkflowRun persistence, resume, `createSession`.

**Two session patterns:**

| Pattern | API | Use case |
|---------|-----|----------|
| **One-shot** | `ctx.runAgent(name, task)` | Fresh session per step. Stateless. |
| **Persistent** | `ctx.createSession(opts)` → `handle.prompt(msg)` | Accumulates conversation history across prompts. |

Both are tracked as workflow steps. Both fire guards on completion.

**WorkflowContext** — every workflow's `execute(ctx)` receives:

```
ctx.task            — the original task string
ctx.agent           — caller agent name
ctx.runAgent()      — one-shot session (new session per call)
ctx.createSession() — persistent session (accumulated history)
ctx.runFunction()   — run JS, no LLM cost
ctx.runWorkflow()   — nested workflow
ctx.summarize()     — rich handoff summary from TaskResult
ctx.done()          — mark workflow complete
ctx.escalate()      — bail out, return to agent
ctx.emit()          — event bus
ctx.getDb()         — SQLite
ctx.log() / notify()— diagnostics / human notification
```

### Guards — Reactive safety

Guards are checks that run during workflow execution. They observe workflow events and can:

- **Warn** — log a concern, injected into next agent's task
- **Block** — stop the workflow immediately (e.g., secret leak, cost limit)
- **Inject a step** — add an extra agent session (e.g., "verify after write")

**Guard lifecycle:**
```
workflow_start        → guards notified
  runAgent/prompt()   → step_done → guards can warn/block/inject
  runFunction()       → step_done → guards can warn/block/inject
workflow_done         → guards notified (final checks)
```

**10 guards currently** (`agents/shared/guards/`): build-check, no-secret-leak, cost-limit, read-before-edit, verify-after-write, milestone-quality, etc.

**Design rules** (from KE-182): max 3 related guards, gates must produce the solution, only gate low baselines (≤50%), prefer 2-phase investigate→fix.

---

## Applications

All built on the L0–L3 core. All event-driven — they're handlers and workflows, not separate systems.

### Metrics

**What**: The steering mechanism. Metrics give the system direction with minimal human input.

**Core principle**: *"When a measure becomes a target, it ceases to be a good measure."* (Goodhart's Law). Metrics are signals to investigate, not numbers to chase.

**How it works**:
- Each metric has: owner, current value, target, threshold, measurement method
- **Three types**: one-off (task completion), continuous (improve a number), health (maintain threshold)
- **Auto-measurement**: `metrics-snapshot` handler runs periodically, measures via SQL query or shell command
- **Alerts**: threshold breaches create alerts, surfaced in heartbeats and web UI
- **Time-series**: every measurement recorded as a snapshot for trend analysis

```
Human sets metric  →  Handler measures  →  Heartbeat reads  →  Agent acts
```

### Projects

**What**: Long-running, multi-iteration goals with milestone tracking.

**How it works**:
- `project.md` defines goal, milestones, status, owner, workflow
- Project handler scans all projects periodically, diagnoses health
- Actions: launch workflow (active), reactivate (blocked), escalate (stalled)
- Workflows (e.g., `master-worker`) create persistent sessions for iteration

**Relationship to metrics**: A continuous metric like "improve quality from 0.6 to 0.9" needs multi-step work. The project is where that work happens. The metric tracks whether it's working.

### Gym

**What**: Scenario-based testing for agent capability measurement.

**How it works**:
- 435+ scenarios with task descriptions, environment files, success criteria (JS scorer)
- Automated runner: run scenarios against any agent, collect pass/fail + transcripts
- Adapters decouple from agent runtime — works with may-agent, Claude Code, or any CLI agent
- Results feed into metrics (`gym.pass-rate`, `gym.scenario-discrimination`)

**Role in the system**: Fast feedback loop (minutes) vs metrics (hours/days). When coach writes a skill, gym tests whether agents follow it before deploying to production.

### Web UI / CLI

**What**: See what's happening, interact with the system.

- **Web UI** — dashboard (sessions, projects, metrics), project detail with comment box, inline session transcripts
- **Notifications** — Telegram, web push
- **CLI** — `may --status`, `may --run-workflow`, manual triggers

---

# Part 2: Agent Layer

What agents are, what they know, what they produce, and how they evolve.

The critical design principle: **agents extend their own capabilities**. The infra provides extension points; agents fill them in.

---

## Agent Definition

Each agent is defined by `agents/<name>/agent.json`:

```jsonc
{
  "name": "bob",
  "model": "opus",
  "tools": ["coding", "agents", "notify", "finish", "system-status", "checkpoint", "workflow"]
}
```

### Identity — Who the agent is

Injected into the system prompt at every session start:

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, personality, values, methodology |
| `DOMAIN.md` | Domain expertise and knowledge |
| `TOOLS.md` | How to use available tools effectively |
| `LESSONS.md` | Learned behaviors (editable by coach) |

**Shared behavioral docs** — injected into all agents:
- `common-sense.md` — 85 lines of "how to think" (verify before claiming done, read before editing, etc.)
- `standing-orders.md` — direct orders from the operator (ORDER-001 through ORDER-009)

### Tools — What the agent can do

| Capability | Tool Preset | What It Enables |
|---|---|---|
| **Read/write/edit/bash** | `coding` | Work on files — the core capability |
| **Web fetch** | `scrape` | Fetch web content |
| **Background commands** | `background-exec` | Run long commands async |
| **External AI CLIs** | `claude-code`, `gemini-cli`, `codex` | Shell out to other AI tools |
| **Signal completion** | `finish` | Structured turn end with status + summary |
| **Save progress** | `checkpoint` | Crash recovery mid-session |
| **Coordinate** | `agents` | Call (sync), fork (async), list, peek at other agents |
| **Notify** | `notify` | One-way FYI to another agent |
| **Run workflow** | `workflow` | Invoke and create execution patterns |
| **Observe system** | `system-status` | Read-only dashboard of sessions, metrics, health |
| **Manage schedule** | `cron` | Create/edit own timer entries |

---

## Agent Knowledge — What agents build

Agents don't just execute tasks — they build durable knowledge. Sessions are ephemeral; knowledge persists.

### Knowledge Base

The accumulated understanding the system has built (`agents/shared/knowledge/`):

- **Knowledge Entries** (360+) — confirmed findings with evidence, connections, and star ratings
- **Hypotheses** (107) — testable claims with probability estimates
- **Experiments** (196) — designed interventions to test hypotheses
- **Library** — deep-dives, papers, external research

### The Knowledge Spectrum

```
Knowledge       Skills            Guards              Workflows
(what we know)  (how to do it)    (reactive checks)   (enforced process)
     │               │                 │                    │
 Findings,      Markdown docs,    Code that warns/     Executable code,
 hypotheses,    read on-demand,   blocks/injects       agent invokes,
 experiments    agent applies     during workflows     code controls
                judgment                               execution
     │               │                 │                    │
     ▼               ▼                 ▼                    ▼
 Durable output Learned practices Safety net          Guaranteed quality
```

All four are knowledge artifacts that evolve over time. Skills that agents keep failing to follow may get promoted to guards or workflows. Knowledge entries inform which skills, guards, and workflows are needed.

- **Skills** (78) — advisory markdown docs (`agents/shared/skills/`). Agent reads when relevant, applies judgment.
- **Guards** (10) — reactive code checks. Fire during workflows, can warn/block/inject.
- **Workflows** — enforced executable patterns. Once invoked, code controls execution.

---

## Agent Self-Evolution — How agents extend the system

The infra provides **five extension points** that agents fill in:

### 1. Custom Tools (`agents/<name>/tools/*.ts`)
Agent writes a tool file → auto-loaded at startup → new capability.

### 2. Workflows (`agents/shared/workflows/*.ts`)
Agent encodes a successful execution pattern → other agents invoke it via `workflow` tool.

### 3. Skills (`agents/shared/skills/*.md`)
Coach writes advisory doc → gym measures whether agents follow it → iterate.

### 4. Handlers (`agents/may/handlers/*.ts`)
Agent writes a handler for a recurring pattern → runs in pure JS for zero LLM cost. 43 handlers currently.

### 5. Knowledge Base (`agents/shared/knowledge/`)
Bob synthesizes findings → hypotheses tested via experiments → confirmed results inform all future decisions.

### The Evolution Cycle

```
  Agent encounters problem repeatedly
        │
        ▼
  First: handle manually in sessions (expensive, LLM tokens)
        │
        ▼
  Then: write a skill doc (advisory — teach other agents)
        │
        ▼
  If agents still fail: write a guard or workflow (enforced)
        │
        ▼
  If it's recurring/mechanical: write a handler (automated — no LLM)
        │
        ▼
  If it needs a new capability: write a custom tool
        │
        ▼
  Result: system gets cheaper, faster, more reliable over time
```

Each step moves work from expensive (LLM reasoning) to cheap (code execution).

---

## Agent Knowledge Tiers

Not all agents need to understand the infrastructure. Two tiers:

### User Tier (all agents)

**Knows nothing about infra.** The system is designed so it just works:

- **Tools** — self-describing. The tool schema tells the agent what to provide.
- **Metrics** — heartbeat injects `✅ on target / 📉 regressing / 🔴 breached`. Agent sees red, investigates.
- **Projects** — `project.md` is self-evident markdown. Agent reads it, does the work, updates status.
- **Heartbeats** — agent wakes up with context already injected. It sees information and acts.
- **Persistence, compaction, guards, error retry** — completely invisible.

**If agents need a tutorial to use something, the infra isn't presenting it naturally enough.**

### Builder Tier (agents that extend the system)

Knows the extension points and coordination patterns:

- **How to extend** — when and how to write handlers, workflows, skills, tools, knowledge. The evolution cycle.
- **How to coordinate** — `fork` vs `call` vs `notify`, escalation chain, agent roster.
- **How to create projects and metrics** — for agents that set direction, not just follow it.

---

## Agent Heartbeat — The decision loop

Every agent has a periodic heartbeat (timer → handler → session):

1. **Timer fires** every N minutes
2. **Heartbeat workflow** (JS) collects context: metrics, projects, alerts, inbox, recent sessions
3. **Agent session** starts with context injected into the prompt
4. **Agent decides**: assess priorities → fork work / escalate / investigate / create project
5. **Agent finishes** with structured status

---

## The Autonomous Loop

Everything combines into a self-steering cycle:

```
  Human sets direction (metrics + priorities)
        │
        ▼
  ┌─ Metrics ───────────────────────────────────────┐
  │  "quality.coder = 0.6, target = 0.9"            │
  └──────────┬──────────────────────────────────────┘
             │ snapshot handler measures
             ▼
  ┌─ Heartbeat ─────────────────────────────────────┐
  │  Agent sees: metric regressing, project stalled  │
  │  Agent decides: fork work, escalate, investigate │
  └──────────┬──────────────────────────────────────┘
             │ fork/event/workflow
             ▼
  ┌─ Execution ─────────────────────────────────────┐
  │  Work session (with workflow for quality)        │
  │  → builds knowledge, updates code, runs tests   │
  │  → milestone completed → project updated        │
  └──────────┬──────────────────────────────────────┘
             │ next snapshot
             ▼
        Loop back to metrics
```

**Human's role**: Set metrics, approve P0/P1, review escalations. The system does everything else.

**What makes it self-improving**: As the loop runs, agents encode solutions as handlers (auto-fix), workflows (enforce quality), skills (teach patterns), and tools (new capabilities). Each cycle, the system gets cheaper and more reliable.

---

## Multi-Agent Coordination

### Three mechanisms

1. **`agents.call`** — synchronous: A calls B, waits for result.
2. **`agents.fork`** — asynchronous: A triggers B, continues.
3. **Event + handler** — fully decoupled: agent emits event, handler reacts.

### Agent Roster

| Agent | Role |
|---|---|
| **may** | Supervisor — routes work, monitors system |
| **bob** | Primary worker — research, implementation |
| **tech-lead** | Architecture, code review |
| **optimizer** | Performance, efficiency |
| **qa** | Testing, quality |
| **coach** | Agent skill development, training |
| **evaluator** | Session quality evaluation |
| **judge** | Evaluation arbitration |
| **scout** | Discovery, exploration |
| **master** | External AI tool orchestration |
| **amy/amy-kimi** | Research, alternative models |
