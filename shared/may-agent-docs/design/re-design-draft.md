# may-agent: Architecture Re-Design Draft

## Overview

may-agent is a multi-agent orchestration system built on top of [pi-agent-core](https://github.com/mariozechner/pi-agent-core). It turns a single-agent runtime into an autonomous, persistent, multi-agent system that builds knowledge and improves its own execution over time.

Two halves: **Infrastructure** (the runtime, what makes agents work) and **Agent Layer** (what agents are, know, and produce).

---

# Part 1: Infrastructure

The runtime that makes everything work. Agents don't touch this code — they interact with it through tools and conventions.

```
┌─────────────────────────────────────────────────┐
│  L7  Web UI / Notifications                     │  Human interface
├─────────────────────────────────────────────────┤
│  L6  Project Automation                         │  Long-running goals
├─────────────────────────────────────────────────┤
│  L5  Gym — Agent Testing                        │  Measurement + feedback
├─────────────────────────────────────────────────┤
│  L4  Metrics System                             │  Steering — what to work on
├─────────────────────────────────────────────────┤
│  L3  Handlers + Workflows + Guards              │  Autonomy + execution + safety
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
- Event types: `session_start`, `session_end`, `fork`, `message`, `metric`, `notification`, etc. (24 types)

**Key insight**: This is the coordination primitive. Agent A finishing emits `session_end`. A handler sees it and starts Agent B. No agent-to-agent coupling needed.

---

## L3: Handlers + Workflows + Guards

**What**: The autonomy layer. Handlers receive events, workflows implement the response, guards enforce safety.

```
Event (timer / bus / agent request)
  → Handler (entry point — receives event, decides what to do)
    → Workflow (implementation — the actual logic)
      → Guards (reactive checks — can warn, block, or inject steps)
```

### Handlers — Event interface

Handlers are entry points that receive events and decide what to do. They are the *interface* between events and action.

- **Timer-driven** — fire periodically (heartbeats, project scans, metric snapshots)
- **Event-driven** — react to bus events (metric breach, session end, etc.)
- **Agent-driven** — the `workflow` tool is itself a handler for "agent requested a workflow"
- **Auto-pause** — pause agents that keep failing, probe for recovery

### Workflows — Implementation

Workflows are the actual logic that runs. They can be:

- **Pure JS** — `metrics-snapshot` measures all metrics, no LLM. Fast and cheap.
- **Session orchestration** — `master-worker` creates persistent reviewer + worker sessions via `createSession`. `verify-wrap` ensures work gets verified.
- **Context collection** — `bob-heartbeat` gathers metrics, projects, alerts, and structures them into an agent prompt.

**Shared workflows** (`agents/shared/workflows/`) are available to all agents.  
**Agent-specific workflows** (`agents/<name>/workflows/`) are custom to one agent.

Workflows are both infrastructure and a knowledge artifact — agents create and improve them (see Agent Self-Evolution).

### Guards — Reactive safety

Guards are checks that run during workflow execution. They observe workflow events (`step_done`, `step_start`) and can:

- **Warn** — log a concern but let the workflow continue
- **Block** — stop the workflow (e.g., secret leak detected, cost limit exceeded)
- **Inject a step** — add an extra agent session (e.g., "you wrote files without verifying — now read them back")

**10 guards currently** (`agents/shared/guards/`):
- `build-check` — warn if coding steps don't confirm build/test success
- `no-secret-leak` — block if output contains API keys
- `cost-limit` — block at 60 total turns (emergency brake)
- `read-before-edit` — warn when editing files not read first
- `verify-after-write` — inject read-back step after writes
- `milestone-quality` — flag vague milestones
- etc.

Guards sit between skills (advisory) and workflows (enforced) in the enforcement spectrum. They are also an agent extension point — agents write new guards based on failure patterns.

**Design rules** (from KE-182): max 3 related guards, gates must produce the solution (not just describe the problem), only gate low baselines (≤50%), prefer 2-phase investigate→fix.

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

## L5: Gym — Agent Testing

**What**: Scenario-based testing that measures agent capability and provides fast feedback for skill/workflow improvement.

**Provides**:
- **435+ scenarios** — realistic coding tasks with automated scoring. Each has: task description, environment files, success criteria (JS scorer), metadata (categories, tags, tier).
- **Automated runner** — run scenarios against any agent, collect pass/fail + transcripts
- **Adapters** — decoupled from agent runtime. Works with may-agent, Claude Code, or any CLI agent.
- **Discrimination testing** — do scenarios distinguish good behavior from bad? (measures scenario quality itself)
- **Results DB** — SQLite storage of all runs for trend analysis

**How gym fits the system**:

```
Coach writes skill
  → Gym measures: do agents follow it?
    → Failures reveal patterns
      → Coach rewrites skill
        → Re-measure
```

Gym is the **fast feedback loop** (minutes) vs metrics (hours/days). When coach writes a skill or optimizer creates a workflow, gym scenarios test whether it actually improves agent behavior before deploying to production.

**Relationship to metrics**: Gym pass rates feed into metrics like `gym.pass-rate` and `gym.scenario-discrimination`. The gym is the measurement instrument; metrics track the trend.

---

## L6: Project Automation

**What**: Long-running, multi-iteration projects with milestone tracking. The execution arm of continuous metrics.

**Provides**:
- **Project files** — `project.md` defines goal, milestones, status, owner, linked metric
- **Health monitor** — handler scans projects, diagnoses health, decides action (launch/reactivate/escalate)
- **Workflows** — pluggable iteration strategies (e.g., master-worker: persistent reviewer + worker sessions)
- **Milestone tracking** — auto-detect completion, stall detection, escalation

**Relationship to metrics**: A continuous metric like "improve coder quality from 0.6 to 0.9" doesn't have a single action. The project is where the multi-step work happens. The metric tracks whether it's working.

**Flow**:
1. Project handler runs periodically, scans all `project.md` files
2. Diagnoses each: active → launch workflow, blocked → attempt reactivation, stalled → escalate
3. Workflow creates persistent sessions (L1) for worker + reviewer
4. Iterate until milestones complete or blocked

---

## L7: Observability + Human Interface

**What**: See what's happening, interact with the system.

**Provides**:
- **Web UI** — dashboard (sessions, projects, metrics), project detail with comment box
- **Session digest** — summarize what happened in a session
- **Notifications** — Telegram, web push
- **CLI** — `may --status`, `may --run-workflow`, manual triggers

---

# Part 2: Agent Layer

What agents are, what they know, what they produce, and how they evolve.

The critical design principle: **agents extend their own capabilities**. They don't just execute tasks — they build tools, workflows, skills, knowledge, and handlers that make the system better over time. The infra provides the extension points; agents fill them in.

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
| **Manage schedule** | `cron` | Create/edit own timer entries |

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

Markdown documents that teach agents *how* to do something well (`agents/shared/skills/`, 78 skills).

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

---

## Agent Self-Evolution — How agents extend the system

Agents don't just use the infrastructure — they extend it. The infra provides **five extension points** that agents fill in by writing code and docs:

### 1. Custom Tools (`agents/<name>/tools/*.ts`)

Agents can create their own tools — TypeScript files that get auto-loaded at startup. A tool gives the agent a new capability it didn't have before.

**How it works**: Agent writes a `.ts` file in its `tools/` directory, exports a factory function. The loader picks it up on restart.

**Example**: An agent that frequently parses specific log formats could create a `parse-logs` tool instead of doing it with bash every time.

### 2. Workflows (`agents/<name>/workflows/*.ts` + `agents/shared/workflows/*.ts`)

Agents create and improve execution patterns. When an agent discovers that a certain sequence of steps produces better results, it encodes that as a workflow.

**How it works**: Agent writes a workflow `.ts` file with an `execute()` function. Other agents can invoke it via the `workflow` tool. Shared workflows are available to all agents.

**Examples in practice**:
- Optimizer created `verify-wrap` after finding agents ship without testing → now used 1,300+ times
- Tech-lead created `verified-coder` for code changes that need review
- Coach created `training-sprint` for structured skill training sessions
- QA created `vet-skill` for validating skill documents

### 3. Skills (`agents/shared/skills/*.md`)

Agents (primarily coach) write advisory documents that teach other agents how to do things well.

**How it works**: Coach analyzes session failures → identifies patterns → writes skill → measures improvement via gym scenarios. Skills are read on-demand by agents when relevant.

**Feedback loop**: Gym scenarios test whether agents follow skills → failures trigger skill rewrites → re-measure → iterate.

### 4. Handlers (`agents/may/handlers/*.ts`)

Agents create automated handlers for recurring patterns. A handler is a JS function that runs on a cron schedule or reacts to events — no LLM needed.

**How it works**: Agent writes a handler `.ts` file, registers it with a timer or event trigger. The handler runs periodically or reactively, doing work in pure JS (fast, cheap, reliable).

**43 handlers currently**, covering:
- **Auto-fix**: `session-recovery.ts` (restart stuck sessions), `zombie-cleanup.ts` (kill orphan processes), `watchdog.ts` (detect stalled agents)
- **Measurement**: `metrics-snapshot.ts` (auto-measure all metrics), `evaluation-sync.ts` (sync session quality scores)
- **Maintenance**: `agents-auto-commit.ts` (commit agent file changes), `workspace-compaction.ts` (clean old workspace files), `daily-cleanup.ts`
- **Intelligence**: `context-learn.ts` (extract lessons from sessions), `metric-alert-reactor.ts` (auto-respond to metric breaches), `analyze-failures.ts`
- **Orchestration**: `project.ts` (drive project iterations), `escalation.ts` (manage escalation chains)

**Key insight**: Handlers are how agents make heartbeats more efficient. Instead of the LLM spending tokens to detect and fix a recurring issue, a handler does it in JS for zero cost. When an agent notices it's doing the same thing every heartbeat, the right move is to write a handler for it.

### 5. Knowledge Base (`agents/shared/knowledge/`)

Agents build durable knowledge — entries, hypotheses, experiments — that inform all future decisions.

**How it works**: Bob synthesizes findings from sessions and research into knowledge entries. Hypotheses get tested via experiments. Confirmed results become entries that other agents reference.

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
  If agents still fail: write a workflow (enforced — code controls)
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

Each step moves work from expensive (LLM reasoning) to cheap (code execution). The system's operational cost decreases as agents encode more patterns into handlers, workflows, and tools.

---

## Agent Knowledge Tiers — What agents need to know

Not all agents need to understand the infrastructure. Two tiers:

### User Tier (all agents)

**Knows nothing about infra.** The system is designed so it just works:

- **Tools** — self-describing. The tool schema and description tell the agent what to provide. No tutorial needed.
- **Metrics** — heartbeat injects `✅ on target / 📉 regressing / 🔴 breached`. Agent sees red, investigates. No "metric system" knowledge needed.
- **Projects** — `project.md` is self-evident markdown. Agent reads it, does the work, updates status. Handler manages lifecycle invisibly.
- **Heartbeats** — agent wakes up with context already injected (metrics, projects, alerts, inbox). It sees information and acts. Doesn't need to know how heartbeats work.
- **Persistence, compaction, guards, error retry** — completely invisible. Agent never thinks about these.

**If agents need a tutorial to use something, the infra isn't presenting it naturally enough.**

### Builder Tier (agents that extend or coordinate the system)

Knows the extension points and coordination patterns:

- **How to extend the system** — when and how to write handlers, workflows, skills, tools, and knowledge. The evolution cycle: manual → skill → workflow → handler → tool.
- **How to coordinate** — `fork` vs `call` vs `notify`, escalation chain, who does what, agent roster.
- **How to create projects and metrics** — for agents that set direction, not just follow it.

Builder knowledge is needed by agents like may, bob, tech-lead, optimizer, coach — agents that improve the system itself. Most agents only need User tier.

---

## Agent Heartbeat — The decision loop

Every agent has a periodic heartbeat (timer → handler → session):

1. **Timer fires** every N minutes
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

**What makes it self-improving**: As the loop runs, agents don't just do work — they notice inefficiencies and encode solutions as handlers (auto-fix), workflows (enforce quality), skills (teach patterns), and tools (new capabilities). Each cycle through the loop, the system gets a little cheaper and more reliable.

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

## Workflow Engine — Unified Execution

All workflows execute through one engine (`src/lib/workflow-tool.ts`), regardless of who triggers them.

### Two callers, one engine

| Caller | Entry point | How |
|--------|-------------|-----|
| **Agent** (tool) | `workflow.run("verify-wrap", task)` | `createWorkflowTool()` → agent tool |
| **System** (handler) | Project handler launches project workflows | `runWorkflowDirect()` → same engine |

Both paths get: guards, step tracking, WorkflowRun persistence, resume, `createSession`.

### Two session patterns

| Pattern | API | Use case |
|---------|-----|----------|
| **One-shot** | `ctx.runAgent(name, task)` | Fresh session per step. Stateless. Each call = new session. |
| **Persistent** | `ctx.createSession(opts)` → `handle.prompt(msg)` | Accumulates conversation history. Each `prompt()` = new session with prior context prepended. |

Both are tracked as workflow steps. Both fire guards on completion.

**Why persistent sessions exist**: `master-worker` needs a reviewer that remembers prior iterations. Instead of feeding the full conversation each time manually, `createSession` accumulates history automatically. Under the hood, each `prompt()` still creates a new agent session (via `manager.callAgent`) — the "persistence" is simulated by prepending conversation history to each prompt.

### WorkflowContext

Every workflow's `execute(ctx)` receives:

```
ctx.task           — the original task string
ctx.agent          — caller agent name
ctx.runAgent()     — one-shot session (new session per call)
ctx.createSession()— persistent session (accumulated history)
ctx.runFunction()  — run JS, no LLM cost
ctx.runWorkflow()  — nested workflow
ctx.summarize()    — rich handoff summary from TaskResult
ctx.done()         — mark workflow complete
ctx.escalate()     — bail out, return to agent
ctx.emit()         — event bus
ctx.getDb()        — SQLite
ctx.log()          — diagnostics
ctx.notify()       — human notification
```

### Guard lifecycle

```
workflow_start        → guards notified (logging only)
  runAgent/prompt()   → step_done event → guards can warn/block/inject
  runFunction()       → step_done event → guards can warn/block/inject
workflow_done         → guards notified (final checks)
```

Guards fire on every step, including each `prompt()` on persistent sessions. A guard can:
- **warn** — message injected into next agent's task
- **block** — workflow stops immediately
- **inject step** — extra agent session runs (e.g., verify-after-write)

### Step tracking

Every `runAgent`, `prompt()`, and `runFunction` is recorded as a `WorkflowStep` in a `WorkflowRun` record (persisted to `.state/workflows/`). This enables:
- **Resume** — replay completed steps from archived session data after crash
- **Observability** — web UI shows workflow run with all steps
- **Tracing** — `subagents.trace(workflowRunId)` shows the full session tree

