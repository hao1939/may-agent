# may-agent: Architecture Re-Design Draft

## Overview

may-agent is a multi-agent orchestration system built on top of [pi-agent-core](https://github.com/mariozechner/pi-agent-core). It turns a single-agent runtime into an autonomous, persistent, multi-agent system that builds knowledge and improves its own execution over time.

Two halves: **Infrastructure** (the runtime, what makes agents work) and **Agent Layer** (what agents are, know, and produce).

---

# Part 1: Infrastructure

The runtime that makes everything work. Agents don't touch this code — they interact with it through tools and conventions.

```
┌─────────────────────────────────────────────────┐
│  L6  Web UI / Notifications                     │  Human interface
├─────────────────────────────────────────────────┤
│  L5  Project Automation                         │  Long-running goals
├─────────────────────────────────────────────────┤
│  L4  Metrics System                             │  Steering — what to work on
├─────────────────────────────────────────────────┤
│  L3  Scheduling + Handlers + Workflows          │  Autonomy + execution patterns
├─────────────────────────────────────────────────┤
│  L2  Event Bus                                  │  Glue
├─────────────────────────────────────────────────┤
│  L1  Session Management                         │  Production-grade agents
├─────────────────────────────────────────────────┤
│  L0  Agent Runtime (pi-agent-core)              │  Single agent + tools
└─────────────────────────────────────────────────┘
```

Each layer depends only on layers below it.

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
- Event types: `session_start`, `session_end`, `fork`, `message`, `metric`, `notification`, etc.

**Key insight**: This is the coordination primitive. Agent A finishing emits `session_end`. A handler sees it and starts Agent B. No agent-to-agent coupling needed.

---

## L3: Scheduling + Handlers + Workflows

**What**: Three capabilities that together give the system autonomy.

### Scheduling + Handlers

Cron fires handlers on timers or bus events. Handlers are plain functions with a context.

- **Periodic execution** — heartbeats, project scans, auto-commit, session sync
- **Event-driven triggers** — handlers subscribe to bus events via `on:` field in cron config
- **Auto-pause** — pause agents that keep failing, probe for recovery

**How coordination works**:
1. Agent emits event (or handler detects a condition)
2. Cron dispatches to subscribed handlers
3. Handler starts a new agent session via `manager.run()`
4. Session completion emits `session_end` → more handlers can react

### Workflows — Execution Patterns

Reusable multi-step execution strategies. Two usage paths:

1. **Agent-invoked** (via `workflow` tool): An agent *chooses* a workflow to structure its work. E.g., optimizer runs `verify-wrap` to ensure work gets verified, bob runs `deliver-or-report` to structure a research output.

2. **System-invoked** (via project handler): The project automation layer launches workflows to drive project iterations. E.g., `master-worker` workflow creates persistent reviewer + worker sessions.

**What workflows provide**:
- **Shared execution patterns** — `verify-wrap`, `implement-and-verify`, `coaching-feedback`, etc.
- **Agent-specific workflows** — each agent can have custom workflows
- **Guards** — workflow-level safety checks that can inject steps or block execution
- **Step tracking** — each workflow run records steps, enabling resume after crash
- **Heartbeats** — every agent's heartbeat is itself a workflow that collects context and structures the periodic check-in

Workflows are both infrastructure and a knowledge artifact (see Part 2).

---

## L4: Metrics System

**What**: The steering mechanism. Metrics give the system direction with minimal human input.

**Core principle**: *"When a measure becomes a target, it ceases to be a good measure."* (Goodhart's Law). Metrics are signals to investigate, not numbers to chase.

**Provides**:
- **Unified goal tracking** — everything is a metric with an owner, current value, and target
- **Three metric types** that drive different agent behaviors:
  - **One-off** (task completion): binary done/not-done → agent executes and marks done
  - **Continuous** (improve a number): diagnose → hypothesize → act → measure → iterate
  - **Health** (maintain threshold): monitor → alert when breached → fix → resume
- **Automatic measurement** — metrics can be auto-measured (SQL query), command-measured (shell), or manual
- **Alerts** — threshold breaches create alerts, surfaced in heartbeats and web UI
- **Time-series history** — every measurement recorded as a snapshot for trend analysis

**How metrics drive the system**:

```
Human sets metric          Agent heartbeat reads metric       Agent acts
  ┌──────────┐              ┌──────────────────┐              ┌────────────┐
  │ owner    │              │ "quality.coder   │              │ Fork work  │
  │ target   │──snapshot──► │  current: 0.6    │──judgment──► │ or         │
  │ priority │   handler    │  target:  0.9    │              │ Escalate   │
  │ threshold│              │  trend:  ↗ slow" │              │ or         │
  └──────────┘              └──────────────────┘              │ Investigate│
                                                              └────────────┘
```

**Evolution levels** (current → future):
- **Level 1** (now): Metrics as signals — agents read and apply judgment
- **Level 2**: Metrics trigger work — breach auto-dispatches a fix
- **Level 3**: Agents propose their own metrics
- **Level 4**: Cross-metric correlations emerge, system learns leading indicators

---

## L5: Project Automation

**What**: Long-running, multi-iteration projects with milestone tracking. The execution arm of continuous metrics.

**Provides**:
- **Project files** — `project.md` defines goal, milestones, status, owner, linked metric
- **Health monitor** — handler scans projects, diagnoses health, decides action (launch/reactivate/escalate)
- **Workflows** — pluggable iteration strategies (e.g., master-worker: persistent reviewer + worker sessions)
- **Milestone tracking** — auto-detect completion, stall detection, escalation

**Relationship to metrics**: A continuous metric like "improve coder quality from 0.6 to 0.9" doesn't have a single action. The project is where the multi-step work happens. The metric tracks whether it's working.

**Flow**:
1. Project handler (L3) runs on cron, scans all `project.md` files
2. Diagnoses each: active → launch workflow, blocked → attempt reactivation, stalled → escalate
3. Workflow creates persistent sessions (L1) for worker + reviewer
4. Iterate until milestones complete or blocked

---

## L6: Observability + Human Interface

**What**: See what's happening, interact with the system.

**Provides**:
- **Web UI** — dashboard (sessions, projects, metrics), project detail with comment box
- **Session digest** — summarize what happened in a session
- **Notifications** — Telegram, web push
- **CLI** — `may --status`, `may --run-workflow`, manual triggers

---

# Part 2: Agent Layer

What agents are, what they know, what they produce, and how they improve.

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
| **Manage schedule** | `cron` | Create/edit own cron entries |

---

## Agent Knowledge — What agents build

Agents don't just execute tasks — they build durable knowledge. Sessions are ephemeral; knowledge persists.

### Knowledge Base

The accumulated understanding the system has built (`agents/shared/knowledge/`):

- **Knowledge Entries** (360+) — Confirmed findings with evidence, connections, and star ratings. The core intellectual output. (`KE-001` through `KE-396`)
- **Hypotheses** (107) — Testable claims with probability estimates, supporting/refuting evidence, and linked experiments.
- **Experiments** (196) — Designed interventions to test hypotheses. Status: designed → running → complete.
- **Library** — Deep-dives, papers, external research.
- **INDEX.md** — Master catalog connecting everything.

**How it's used**: Agents read knowledge to inform decisions. Bob synthesizes new entries. Coach uses entries to design training. Experiments move hypotheses toward confirmation or refutation.

### Skills — Advisory execution patterns

Markdown documents that teach agents *how* to do something well (`agents/shared/skills/`, 55 skills).

Examples:
- `creating-projects/skill.md` — how to set up a project.md
- `escalation/skill.md` — when and how to escalate
- `coder-edit-discipline/skill.md` — edit patterns that avoid regressions
- `budget-before-act/skill.md` — estimate cost before doing work

**Enforcement**: Advisory. Agent reads when relevant, applies judgment. Nothing prevents ignoring the guidance.

**How they evolve**: Coach analyzes session failures → identifies patterns → writes or updates skills → measures improvement via gym scenarios.

### Workflows — Enforced execution patterns

Executable TypeScript that structures an agent's work into defined steps (`agents/shared/workflows/` + `agents/<name>/workflows/`).

Examples:
- `verify-wrap` — do work, then verify it works (prevents ship-without-test)
- `implement-and-verify` — implement, test, fix failures
- `coaching-feedback` — structured review with specific feedback format
- `master-worker` — persistent reviewer + worker for project iterations

**Enforcement**: Enforced. Once an agent runs `verify-wrap`, the code ensures verification happens — the agent can't skip it.

**How they evolve**: Agents themselves create and improve workflows. When optimizer discovers that "verify-then-ship" reduces regressions, it encodes that as a workflow. Other agents adopt it.

### The Knowledge Spectrum

```
Knowledge          Skills              Workflows
(what we know)     (how to do it)      (enforced process)
     │                  │                    │
 Findings,         Markdown docs,       Executable code,
 hypotheses,       read on-demand,      agent invokes,
 experiments       agent applies        code controls
                   judgment             execution
     │                  │                    │
     ▼                  ▼                    ▼
 Durable output    Learned practices    Guaranteed quality
```

All three are knowledge artifacts that evolve over time. Skills that agents keep failing to follow may get promoted to enforced workflows. Workflow patterns that prove universal may get simplified into skills. Knowledge entries inform which skills and workflows are needed.

---

## Agent Heartbeat — The decision loop

Every agent has a periodic heartbeat (cron → workflow → session):

1. **Cron fires** every N minutes
2. **Heartbeat workflow** (JS) collects context: metrics, projects, alerts, inbox, recent sessions
3. **Agent session** starts with context injected into the prompt
4. **Agent decides**: read metrics → assess priorities → fork work / escalate / investigate / create project
5. **Agent finishes** with structured status

The heartbeat is how agents stay autonomous — they periodically wake up, see what matters, and act.

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

**Human's role**: Set metrics, approve P0/P1, review escalations. The system does everything else — agents observe metrics, decide what to work on, execute via workflows, build knowledge, and the next measurement cycle picks up the results.

---

## Multi-Agent Coordination

### Three mechanisms

1. **`agents.call`** — synchronous: A calls B, A blocks until B finishes, gets result back. The most common pattern — agents dispatch focused work sessions and use the result.
2. **`agents.fork`** — asynchronous: A triggers B, A continues. Fire-and-forget.
3. **Event + handler** — fully decoupled: agent emits event, handler reacts by starting sessions.

### Current Agent Roster

| Agent | Tools | Role |
|---|---|---|
| **may** | coding, agents, notify, cron, system-status | Supervisor — routes work, monitors system |
| **bob** | coding, agents, notify, system-status, checkpoint, workflow | Primary worker — research, implementation |
| **tech-lead** | coding, agents, notify, workflow, checkpoint | Architecture, code review |
| **optimizer** | coding, agents, notify, workflow, checkpoint | Performance, efficiency |
| **qa** | coding, workflow, checkpoint | Testing, quality |
| **coach** | *(minimal)* | Agent skill development, training |
| **evaluator** | coding | Session quality evaluation |
| **judge** | coding | Evaluation arbitration |
| **scout** | *(minimal)* | Discovery, exploration |
| **master** | claude-code, gemini-cli, codex | External AI tool orchestration |
| **amy/amy-kimi** | coding/scrape | Research, alternative models |

---

## Simplification Opportunities

### Remove

| What | Why |
|---|---|
| `WorkflowContext.runAgent/runFunction/runWorkflow/summarize` | Old per-iteration pattern, replaced by `createSession` |

### Clarify

| What | Question |
|---|---|
| `agents.call` vs `agents.fork` | Both are used heavily. Keep both, but document when to use which. |
| Old `project.ts` workflow (905 lines) | Can be replaced by `master-worker.ts` (474 lines) — all active projects already use master-worker |
