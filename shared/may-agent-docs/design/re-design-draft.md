# may-agent: Architecture Re-Design Draft

## Overview

may-agent is a multi-agent orchestration system built on top of [pi-agent-core](https://github.com/mariozechner/pi-agent-core). It turns a single-agent runtime into an autonomous, persistent, multi-agent system.

This document describes the layered architecture — what each layer provides and how agents interact with it.

---

## Layer Stack

```
┌─────────────────────────────────────────────────┐
│  L6  Web UI / Notifications                     │  Human interface
├─────────────────────────────────────────────────┤
│  L5  Project Automation                         │  Long-running goals
├─────────────────────────────────────────────────┤
│  L4  Metrics System                             │  Steering — what to work on
├─────────────────────────────────────────────────┤
│  L3  Scheduling + Handlers                      │  Autonomy
├─────────────────────────────────────────────────┤
│  L2  Event Bus                                  │  Glue
├─────────────────────────────────────────────────┤
│  L1  Session Management                         │  Production-grade agents
├─────────────────────────────────────────────────┤
│  L0  Agent Runtime (pi-agent-core)              │  Single agent + tools
└─────────────────────────────────────────────────┘
```

Each layer depends only on layers below it.

**The key insight**: Without L4, agents have tools and autonomy but no direction. The metrics system is what makes the system self-steering — it tells agents *what matters*, *where we are*, and *what needs attention*, with minimal human input.

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

**Key files**: `manager.ts`, `persistence.ts`, `compaction.ts`, `completion.ts`, `tools/*.ts`

---

## L2: Event Bus

**What**: Single pub/sub bus. Everything emits events, anything can subscribe.

**Provides**:
- Decoupled communication — components interact through events, not direct calls
- Event types: `session_start`, `session_end`, `fork`, `message`, `metric`, `notification`, etc.

**Key insight**: This is the coordination primitive. Agent A finishing emits `session_end`. A handler sees it and starts Agent B. No agent-to-agent coupling needed.

**Key file**: `event-bus.ts`

---

## L3: Scheduling + Handlers

**What**: Cron fires handlers on timers or bus events. Handlers are plain functions with a context.

**Provides**:
- **Periodic execution** — heartbeats, project scans, auto-commit, session sync
- **Event-driven triggers** — handlers subscribe to bus events via `on:` field in cron config
- **Auto-pause** — pause agents that keep failing, probe for recovery
- **Handler context** — gives handlers access to DB, notifications, event dispatch without importing internals

**How coordination works**:
1. Agent emits event (or handler detects a condition)
2. Cron dispatches to subscribed handlers
3. Handler starts a new agent session via `manager.run()`
4. Session completion emits `session_end` → more handlers can react

This replaces synchronous agent-to-agent calls with event-driven orchestration.

**Key files**: `cron.ts`, `handler-context.ts`, `auto-pause.ts`

---

## L3.5: Workflows — Execution Patterns

**What**: Reusable multi-step execution strategies that agents invoke during sessions AND that the system uses to drive projects.

**Two usage paths**:

1. **Agent-invoked** (via `workflow` tool): An agent *chooses* a workflow to structure its work. E.g., optimizer runs `verify-wrap` to ensure work gets verified, bob runs `deliver-or-report` to structure a research output. Agents can also *create and improve* workflows — they are both users and authors.

2. **System-invoked** (via project handler): The project automation layer launches workflows to drive project iterations. E.g., `master-worker` workflow creates persistent reviewer + worker sessions.

**Provides**:
- **Shared execution patterns** — `verify-wrap`, `implement-and-verify`, `coaching-feedback`, etc. in `agents/shared/workflows/`
- **Agent-specific workflows** — each agent can have custom workflows in `agents/<name>/workflows/`
- **Guards** — workflow-level safety checks that can inject steps or block execution
- **Step tracking** — each workflow run records steps, enabling resume after crash
- **Heartbeat workflows** — every agent's heartbeat is itself a workflow (`*-heartbeat.ts`) that collects context and structures the agent's periodic check-in

**Key insight**: Workflows are not just infrastructure — they are a *knowledge artifact*. When optimizer discovers that "verify-then-ship" reduces regressions, it encodes that as a workflow. Other agents adopt it. The system's execution quality improves without changing any infra code.

**Key files**: `workflow-tool.ts` (agent-facing tool), `workflow.ts` (types + guards), `workflow-defs.d.ts` (project workflow context), `agents/shared/workflows/` and `agents/*/workflows/`

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

1. **Human/May defines metrics** — owner, target, priority, measurement method
2. **Snapshot handler** (L3) runs periodically, measures all auto/command metrics, writes snapshots
3. **Heartbeat** injects metric status into agent's context — agent sees what's on-target, regressing, or breached
4. **Agent decides what to do** — using metrics as one input alongside their own judgment
5. **Projects (L5) are the execution mechanism** — continuous metrics often have an associated project that drives the work

**Evolution levels** (current → future):
- **Level 1** (now): Metrics as signals — agents read and apply judgment
- **Level 2**: Metrics trigger work — breach auto-dispatches a fix
- **Level 3**: Agents propose their own metrics
- **Level 4**: Cross-metric correlations emerge, system learns leading indicators

**Data model**: `metrics`, `metric_snapshots`, `metric_alerts`, `research_log` tables in SQLite (`may.db`)

---

## L5: Project Automation

**What**: Long-running, multi-iteration projects with milestone tracking. The execution arm of continuous metrics.

**Provides**:
- **Project files** — `project.md` defines goal, milestones, status, owner, linked metric
- **Health monitor** — handler scans projects, diagnoses health, decides action (launch/reactivate/escalate)
- **Workflows** — pluggable iteration strategies (e.g., master-worker: persistent reviewer + worker sessions)
- **Milestone tracking** — auto-detect completion, stall detection, escalation

**Relationship to metrics**: A continuous metric like "improve coder quality from 0.6 to 0.9" doesn't have a single action. The project is where the multi-step work happens — diagnose, hypothesize, implement, measure. The metric tracks whether it's working.

**Flow**:
1. Project handler (L3) runs on cron, scans all `project.md` files
2. Diagnoses each: active → launch workflow, blocked → attempt reactivation, stalled → escalate
3. Workflow creates persistent sessions (L1) for worker + reviewer
4. Iterate until milestones complete or blocked

**Key files**: `workflow-defs.d.ts` (context interface), handler in `agents/may/handlers/project.ts`, workflows in `agents/shared/workflows/`

---

## L6: Observability + Human Interface

**What**: See what's happening, interact with the system.

**Provides**:
- **Web UI** — dashboard (sessions, projects, metrics), project detail with comment box
- **Session digest** — summarize what happened in a session
- **Notifications** — Telegram, web push
- **CLI** — `may --status`, `may --run-workflow`, manual triggers

**Key files**: `web.ts`, `session-digest.ts`, `session-subscribers.ts`

---

## Agent Knowledge Architecture

Agents don't just execute — they build and consume knowledge. Three tiers:

### Knowledge Base — What agents know

**What**: Structured research output — the accumulated understanding the system has built.

**Structure** (`agents/shared/knowledge/`):
- **Entries** (360+) — `KE-001` through `KE-396`. Each is a confirmed finding with evidence, connections to other entries, and star rating. The core intellectual output.
- **Hypotheses** (107) — Testable claims with probability estimates, supporting/refuting evidence, and linked experiments.
- **Experiments** (196) — Designed interventions to test hypotheses. Each has status (designed → running → complete), results, and conclusions.
- **Library** — Deep-dives, papers, external research.
- **INDEX.md** — Master catalog connecting everything.

**How agents use it**: Agents read knowledge to inform decisions. Bob synthesizes new entries. Coach uses entries to design skills. Experiments move hypotheses toward confirmation or refutation. The knowledge base is the *durable output* — sessions are ephemeral, knowledge persists.

### Skills — How agents should do things (advisory)

**What**: Markdown documents that teach agents *how* to do something well. Read on-demand, not injected into every prompt.

**Structure** (`agents/shared/skills/`, 55 skills):
- `creating-projects/skill.md` — how to set up a project.md
- `escalation/skill.md` — when and how to escalate
- `coder-edit-discipline/skill.md` — edit patterns that avoid regressions
- `budget-before-act/skill.md` — estimate cost before doing work
- etc.

**Enforcement level**: Advisory. The agent reads the skill when relevant, applies judgment. Nothing prevents the agent from ignoring the guidance. Skills are "here's how to do X well."

**How they evolve**: Coach analyzes session failures → identifies patterns → writes or updates skills → measures improvement via gym scenarios. Skills are a knowledge artifact that encodes learned best practices.

### Workflows — How agents must do things (enforced)

**What**: Executable TypeScript that structures an agent's work into defined steps. The agent invokes a workflow and the code controls the execution sequence.

**Enforcement level**: Enforced. Once an agent runs `verify-wrap`, the code ensures verification happens — the agent can't skip it. Workflows are "here's the enforced process for X."

**Examples**:
- `verify-wrap` — do work, then verify it actually works (prevents ship-without-test)
- `implement-and-verify` — implement, test, fix failures
- `coaching-feedback` — structured review with specific feedback format
- `master-worker` — persistent reviewer + worker sessions for projects

**The spectrum**:

```
Advisory ◄─────────────────────────────────► Enforced
 │                                              │
 Skills (markdown)              Workflows (executable code)
 "here's how"                   "here's the process"
 Agent chooses to follow        Code controls execution
 Coach writes/updates           Agents create/improve
 Measured via gym               Measured via session outcomes
```

Both encode learned execution patterns. Skills are faster to create and iterate (just markdown). Workflows are stronger guarantees but more expensive to build. The system naturally promotes patterns: a skill that agents keep failing to follow may get upgraded to a workflow that enforces it.

---

Agents interact with the system **only through tools**. Tools are configured per agent in `agent.json`:

```jsonc
{
  "name": "bob",
  "model": "opus",
  "tools": ["coding", "agents", "notify", "finish", "system-status", "checkpoint"]
}
```

### Tool Capabilities by Layer

| Capability | Tool Preset | Layer | What Agent Can Do |
|---|---|---|---|
| **Read/write/edit/bash** | `coding` | L0 | Work on files |
| **Web fetch** | `scrape` | L0 | Fetch web content |
| **Background commands** | `background-exec` | L0 | Run long commands async |
| **External AI CLIs** | `claude-code`, `gemini-cli`, `codex` | L0 | Shell out to other AI tools |
| **Signal completion** | `finish` | L1 | Structured turn end with status + summary |
| **Save progress** | `checkpoint` | L1 | Crash recovery mid-session |
| **Coordinate** | `agents` | L2 | Fork (async), list, peek at other agents |
| **Notify** | `notify` | L2 | One-way FYI to another agent |
| **Run workflow** | `workflow` | L3.5 | Invoke execution patterns (verify-wrap, etc.) |
| **Observe system** | `system-status` | L3 | Read-only dashboard of sessions, metrics, health |
| **Manage schedule** | `cron` | L3 | Create/edit own cron entries |

### Agent Identity + Context

Injected into the system prompt at session start:

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, personality, values |
| `DOMAIN.md` | Domain expertise and knowledge |
| `TOOLS.md` | How to use available tools effectively |
| `LESSONS.md` | Learned behaviors (editable by coach) |
| `knowledge/INDEX.md` | Reference material |

Available on-demand (agent reads via tools when needed):

| Resource | Purpose |
|---|---|
| `agents/shared/skills/` | 55 skill docs — advisory best practices |
| `agents/shared/knowledge/` | 360+ knowledge entries, 107 hypotheses, 196 experiments |
| `agents/<name>/workflows/` | Agent-specific execution patterns |
| `agents/shared/workflows/` | Shared execution patterns |

### Heartbeat Pattern

Every agent has a heartbeat workflow (L3 cron → L1 session):
1. Cron fires every N minutes
2. JS handler collects context: metrics, projects, alerts, inbox
3. Creates an agent session with context injected into the prompt
4. Agent reads context, decides what to do, acts, finishes

---

## Multi-Agent Coordination Model

### Current: Three mechanisms

1. **`agents.call`** — synchronous: A calls B, A blocks until B finishes, gets result back. Used heavily — may/bob dispatch work sessions to other agents this way.
2. **`agents.fork`** — asynchronous: A triggers B, A continues. Fire-and-forget.
3. **Event + handler** — fully decoupled: agent emits event, handler reacts by starting sessions.

All three are actively used. `agents.call` is the most common coordination pattern today (agents dispatch focused work sessions and use the result).

### Target: Simplify but keep both sync and async

The event bus (L2) is the cleanest coordination model. But `agents.call` serves a real need — when an agent needs to delegate a subtask and *use the result* in its current reasoning. Forcing everything through events would add complexity (callback handlers, correlation IDs, state machines) rather than remove it.

```
Agent A                    Event Bus                Handler              Agent B
   │                          │                       │                    │
   ├─ fork(B, task) ─────────►│                       │                    │
   │                          ├─ session_start ───────►│                    │
   │  (A continues or ends)   │                       ├─ manager.run(B) ──►│
   │                          │                       │                    │
   │                          │◄── session_end ───────┤◄───── finish() ────┤
   │                          │                       │                    │
   │                          ├─ notify(A, result) ───►│                    │
```

---

## The Autonomous Loop

The layers combine into a self-steering cycle that runs with minimal human input:

```
  Human sets direction (metrics + priorities)
        │
        ▼
  ┌─ L4 Metrics ────────────────────────────────────┐
  │  "quality.coder = 0.6, target = 0.9"            │
  └──────────┬───────────────────────────────────────┘
             │ snapshot handler measures
             ▼
  ┌─ L3 Heartbeat ──────────────────────────────────┐
  │  Agent sees: metric regressing, project stalled  │
  │  Agent decides: fork work, escalate, investigate │
  └──────────┬───────────────────────────────────────┘
             │ fork/event
             ▼
  ┌─ L5 Project ────────────────────────────────────┐
  │  Worker runs workflow (L3.5), reviewer checks   │
  │  Milestone completed → metric re-measured        │
  └──────────┬───────────────────────────────────────┘
             │ next snapshot
             ▼
        Loop back to metrics
```

**Human's role**: Set metrics, approve P0/P1, review escalations. The system does everything else.

---

## Simplification Opportunities

### Remove

| What | Lines | Why |
|---|---|---|
| `agents.call` (sync coordination) | ~200 | Replace with `fork` + event handler |
| `WorkflowContext.runAgent/runFunction/runWorkflow/summarize` | ~110 | Old pattern, replaced by `createSession` |

### Keep

| What | Lines | Why |
|---|---|---|
| Session management (L1) | ~7,200 | Core value — persistence, guards, compaction |
| Event bus (L2) | ~150 | The coordination primitive |
| Cron + handlers (L3) | ~1,900 | Autonomy — nothing runs without this |
| Workflow tool + workflows (L3.5) | ~1,200 | Agents actively use this (1,300+ invocations) — also a knowledge artifact they improve |
| Metrics system (L4) | ~400 | Steering — tells agents what matters |
| Project automation (L5) | ~700 | Long-running goals, execution arm of metrics |
| Observability (L6) | ~2,950 | Humans need to see what's happening |

---

## Current Agent Roster

| Agent | Tools | Role |
|---|---|---|
| **may** | coding, agents, notify, cron, system-status | Supervisor — routes work, monitors system |
| **bob** | coding, agents, notify, system-status, checkpoint, workflow | Primary worker — research, implementation |
| **tech-lead** | coding, agents, notify, workflow, checkpoint | Architecture, code review |
| **optimizer** | coding, agents, notify, workflow, checkpoint | Performance, efficiency |
| **qa** | coding, workflow, checkpoint | Testing, quality |
| **coach** | *(minimal)* | Agent skill development |
| **evaluator** | coding | Session quality evaluation |
| **judge** | coding | Evaluation arbitration |
| **scout** | *(minimal)* | Discovery, exploration |
| **master** | claude-code, gemini-cli, codex | External AI tool orchestration |
| **amy/amy-kimi** | coding/scrape | Research, alternative models |
