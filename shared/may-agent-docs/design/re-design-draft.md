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

## L4: Project Automation

**What**: Long-running, multi-iteration projects with milestone tracking.

**Provides**:
- **Project files** — `project.md` defines goal, milestones, status, owner
- **Health monitor** — handler scans projects, diagnoses health, decides action (launch/reactivate/escalate)
- **Workflows** — pluggable iteration strategies (e.g., master-worker: persistent reviewer + worker sessions)
- **Milestone tracking** — auto-detect completion, stall detection, escalation

**Flow**:
1. Project handler (L3) runs on cron, scans all `project.md` files
2. Diagnoses each: active → launch workflow, blocked → attempt reactivation, stalled → escalate
3. Workflow creates persistent sessions (L1) for worker + reviewer
4. Iterate until milestones complete or blocked

**Key files**: `workflow-defs.d.ts` (context interface), handler in `agents/may/handlers/project.ts`, workflows in `agents/shared/workflows/`

---

## L5: Observability + Human Interface

**What**: See what's happening, interact with the system.

**Provides**:
- **Web UI** — dashboard (sessions, projects, metrics), project detail with comment box
- **Session digest** — summarize what happened in a session
- **Notifications** — Telegram, web push
- **CLI** — `may --status`, `may --run-workflow`, manual triggers

**Key files**: `web.ts`, `session-digest.ts`, `session-subscribers.ts`

---

## Agent SDK: How Agents Interact with the System

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
| **Observe system** | `system-status` | L3 | Read-only dashboard of sessions + health |
| **Manage schedule** | `cron` | L3 | Create/edit own cron entries |

### Agent Identity (Convention Files)

Not tools, but injected into the system prompt:

| File | Purpose |
|---|---|
| `SOUL.md` | Identity, personality, values |
| `DOMAIN.md` | Domain expertise and knowledge |
| `TOOLS.md` | How to use available tools effectively |
| `LESSONS.md` | Learned behaviors (editable by coach) |
| `knowledge/INDEX.md` | Reference material |

### Heartbeat Pattern

Every agent has a heartbeat workflow (L3 cron → L1 session):
1. Cron fires every N minutes
2. JS handler collects context: metrics, projects, alerts, inbox
3. Creates an agent session with context injected into the prompt
4. Agent reads context, decides what to do, acts, finishes

---

## Multi-Agent Coordination Model

### Current: Mixed (sync calls + events)

Today agents can both:
- **`agents.call`** — synchronous: A calls B, A blocks until B finishes
- **`agents.fork`** — async: A triggers B, A continues

Plus handlers react to bus events.

### Target: Events Only

All coordination through the event bus:

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

**Benefits**: No blocking, no call-depth tracking, no infinite-loop prevention needed. Agents are decoupled. The handler layer decides scheduling and concurrency.

---

## Simplification Opportunities

### Remove

| What | Lines | Why |
|---|---|---|
| `agents.call` (sync coordination) | ~200 | Replace with `fork` + event handler |
| `workflow` tool (in-session workflow orchestration) | 923 | Projects now driven by handler, not by agent invoking workflows |
| `WorkflowContext.runAgent/runFunction/runWorkflow/summarize` | ~110 | Old pattern, replaced by `createSession` |

### Keep

| What | Lines | Why |
|---|---|---|
| Session management (L1) | ~7,200 | Core value — persistence, guards, compaction |
| Event bus (L2) | ~150 | The coordination primitive |
| Cron + handlers (L3) | ~1,900 | Autonomy — nothing runs without this |
| Project automation (L4) | ~700 | Long-running goals |
| Observability (L5) | ~2,950 | Humans need to see what's happening |

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
