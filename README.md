# may-agent

Infrastructure for running a team of cooperating LLM agents. Built on [pi-agent-core](https://github.com/badlogic/pi-mono/tree/main/packages/agent) and [pi-ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai).

## What Is This For

Running a single LLM prompt is easy. Running a team of agents that delegate to each other, survive crashes, manage long conversations, and improve over time is hard. may-agent handles the infrastructure so you can focus on defining what each agent does rather than how the plumbing works.

The framework doesn't prescribe agent behavior or strategy — it provides the primitives (sessions, persistence, tools, workflows, evaluation) and gets out of the way.

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────┐
│                   Event Bus                         │
│         (text, tool calls, workflow, eval)           │
├──────────┬──────────────────────────────┬────────────┤
│ Console  │       Socket (JSON-line)     │  Custom    │
└──────────┴──────────────────────────────┴────────────┘
       ▲                                     ▲
       │            events                   │
┌──────┴─────────────────────────────────────┴─────────┐
│                 SubagentManager                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │  Agent   │  │  Agent   │  │  Agent   │  ...        │
│  │ (coder)  │  │  (qa)    │  │ (eval)   │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │ session      │ session     │ session          │
│       ▼              ▼             ▼                  │
│  ┌──────────────────────────────────────────┐        │
│  │           Session Layer                   │        │
│  │  run → steer/progress → complete → archive│       │
│  └──────────────────────────────────────────┘        │
├───────────────────────────────────────────────────────┤
│                Persistence Layer                      │
│  registry.json │ session.jsonl │ memory.jsonl │ runs  │
└───────────────────────────────────────────────────────┘
```

### Layers

The **SubagentManager** is the central hub. It owns the agent registry, spawns sessions, manages their lifecycle, and exposes everything through a uniform API.

**Agent definitions** describe what an agent is — name, model, tools, knowledge files, turn budget, memory limit. Definitions are registered at startup and persist in a registry file.

**Sessions** are where work happens. A session is a single conversation between an agent and its LLM. Sessions run non-blocking, produce a stream of events, and can be steered, cancelled, or waited on. Every message is persisted to JSONL as it arrives.

**Tools** are how agents interact with the world. The manager provides factory functions that produce tools with built-in safety guardrails. A special `subagents` tool lets agents delegate to each other, creating parent-child session trees.

**Persistence** is append-only JSONL for sessions and memory, JSON for registry and workflow runs. Everything needed to reconstruct state after a crash lives on disk.

**Events** flow from sessions through a push-based bus to UI backends. The bus decouples agent activity from rendering — attach a console, a socket server, a web UI, or all of them.

### Session Lifecycle

Sessions have two modes:

**Ephemeral** sessions are the default. They run a task, produce a result, and are removed from active memory. Session data stays on disk. Good for one-off tasks delegated by a supervisor.

**Persistent** sessions stay alive after completing a task. They transition to an idle state and can be woken with new messages, maintaining conversational continuity across tasks. Used for supervisor agents that need to remember what happened across multiple delegations.

```
run() → running → complete → archive (ephemeral)
                           → idle → send() → running → ... (persistent)
```

Cancel cascades depth-first through the session tree — cancelling a supervisor cancels all its children.

### Delegation Model

Agents delegate to each other through the `subagents` tool exposed by `createTool()`. A supervisor agent sees this as a single tool with actions:

- **delegate** — start a task and wait for the result (synchronous)
- **run** / **waitFor** — start a task and collect the result later (async)
- **progress** — read the conversation so far
- **steer** — redirect a running session
- **cancel** — abort a session
- **trace** — visualize the session tree

Parent-child relationships are tracked automatically via session IDs. This enables cascading cancel, tree-wide evaluation, and structured traces.

### Knowledge & Prompt Assembly

System prompts are not static strings. They're assembled fresh per session from multiple sources:

1. **System prompt files** — domain docs, lessons, tool descriptions loaded from disk
2. **Memory entries** — summaries of past sessions, injected for continuity
3. **Skills** — discovered from SKILL.md files in configured directories
4. **Project structure** — directory tree so agents know what exists
5. **Runtime context** — workspace path, output path, turn budget

Because files are read at session start, changes to knowledge files take effect immediately — no restart needed.

### Persistence & Crash Recovery

Three persistence mechanisms work together:

**Session JSONL** — every message (user, assistant, tool result) is appended to a JSONL file as it arrives. On crash, `resumeAgent()` reads these back, repairs broken sequences (dangling tool calls, duplicate messages), and resumes the agent loop.

**Registry** — agent definitions and session metadata stored in `registry.json`. Atomic writes (temp file + rename) prevent corruption.

**Workflow runs** — workflow execution records stored as JSON files. On crash, the workflow engine replays completed steps from cached results and resumes from the first missing step.

### Context Management

Long-running sessions hit context window limits. Two mechanisms handle this:

**Compaction** triggers when token usage exceeds a configurable threshold (default 70% of context window). It structurally summarizes old messages — no LLM calls, fast and deterministic. Preserved across compaction rounds: the original task, key facts (files read/written, commands executed), and the agent's most recent reasoning block. Multiple rounds accumulate; oldest sections are trimmed first. Summary budget is capped at 15% of the context window.

**Overflow recovery** handles the case where compaction wasn't enough (or isn't enabled). When a session hits the context window hard limit, the system extracts structured progress (task, actions taken, files touched, last reasoning) into a markdown document that a new session can pick up from.

### Workflow System

Workflows are predefined multi-step coordination patterns written as TypeScript files. A workflow context provides:

- **runAgent()** — delegate to an agent and get a TaskResult
- **summarize()** — produce a structured handoff between steps (files modified, commands run, errors, agent response)
- **runWorkflow()** — compose sub-workflows (nestable up to configurable depth)
- **emit()** — send progress events to the event bus
- **done() / escalate()** — signal completion or failure

Humans can steer workflows mid-execution — the workflow engine checks a steering queue before each step and interrupts if redirected.

Workflow execution is crash-safe: step results are persisted as workflow run records. On resume, completed steps return cached results; execution picks up from the first missing step.

### Tool Safety

Built-in tools (read, write, exec) come with guardrails that prevent common agent failure modes:

- **Truncation tracking** — the read tool tracks which files were truncated. If the agent tries to overwrite a file it only partially read, the write tool warns before proceeding. Repeated full-file reads also trigger warnings.
- **Path correction** — LLMs hallucinate absolute paths. The tools detect common patterns and rewrite them to the correct project-relative paths.
- **Sandboxing** — exec blocks commands that access paths outside the project root.
- **Git guards** — warns on blanket `git add -A`/`.` (shows what would be staged), shows remaining dirty tree after commits.
- **Meta-recursion blocking** — prevents agents from trying to run the agent system itself via exec.
- **Error hints** — recognizes common failure patterns (tsc errors, test failures, ENOENT) and adds actionable context to help the agent recover.

### Evaluation

The evaluation system scores completed agent sessions on efficiency and quality:

- **Failure chain extraction** — identifies patterns of repeated failures (error → recovery attempt → error again) that indicate wasted effort
- **Token usage tracking** — aggregates input/output/cache tokens and cost across sessions
- **Per-agent attribution** — in a task tree (supervisor → coder → QA), each agent is scored by its own responsibilities. Vague delegation is the supervisor's fault; path guessing is the coder's fault.
- **Task-tree evaluation** — the evaluator sees the full delegation tree and produces per-agent scores rather than a single aggregate score

### Memory

Per-agent memory is stored as JSONL. Runtime/session context can inject recent summaries when needed, but long-lived memory is not part of the cached system prompt. The system prompt stays limited to shared common sense, the agent's `AGENTS.md`, and generated runtime facts.

### Event System

All activity flows through a push-based event bus. Event types:

- **text** — streaming text from an agent
- **tool_call / tool_result** — tool invocations and their outcomes
- **session.start / session.end** — session lifecycle
- **workflow** — workflow progress (start, step_start, step_done, done, escalated)
- **eval** — evaluation results
- **info / prompt** — system messages

The control surface is a Unix socket with a small local protocol. Socket-local
commands stay limited to `subscribe` and `status`; adapter actions such as
`input`, `steer`, `cancel`, `reload`, and `trigger.<handler>` are normalized
into daemon events. CLI, Web UI, and Telegram are thin adapters over that same
event path.

## Usage

1. Create a `SubagentManager` with a persistence directory
2. Register agents — each with a name, model, tools, and knowledge files
3. Run tasks — the manager returns a session ID immediately (non-blocking)
4. Interact — steer sessions, check progress, wait for results, cancel
5. Delegate — give a supervisor agent the `createTool()` output so it can manage sub-agents through tool calls
6. Define workflows — write TypeScript files that orchestrate multi-agent sequences
7. Resume on crash — call `resumeAgent()` after restart to pick up where you left off

## Project Structure

```
src/lib/
  manager.ts        Core orchestrator — registration, sessions, lifecycle
  tools/            Tool factories with safety guardrails
  persistence.ts    JSONL storage, registry, memory, archival
  compaction.ts     Context window management
  evaluation/       Session quality scoring and failure chain extraction
  workflow-tool.ts  Workflow execution engine with replay-based resume
  workflow.ts       Workflow types and context
  handoff.ts        Structured context transfer between workflow steps

src/app/
  may.ts            Application runner (agent registration, startup, UI)
  event-bus.ts      Event types and bus
  ui/console.ts     Console renderer
  interface-startup.ts  Console/socket interface startup

packages/
  control/          Socket protocol, client, and server core
  webui/            Standalone Web UI package
```

### Persistence Layout

```
<persistDir>/
  registry.json              Agent definitions + session metadata
  memory/<agent>.jsonl        Per-agent task history
  sessions/<id>/session.jsonl Conversation messages (append-only)
  # sessions stay in sessions/<id>/ after completion (no archiving)
  workflows/<runId>.json      Workflow execution records
```

### Recommended Agent Layout

```
agents/
  shared/
    common-sense.md          Shared always-loaded behavioral fundamentals
    may-agent-docs/          Architecture and operator docs
  <agent>/
    agent.json               Operational config
    AGENTS.md                Identity and stable operating contract
    heartbeat.md             Heartbeat-only guidance
    knowledge/INDEX.md       On-demand reference routing
    knowledge/*.md           Domain docs and long-form references
    skills/*.md              On-demand or explicitly adopted skills
    workflows/               Multi-step coordination patterns (.ts)
    workspace/               Scratch/runtime working files
```

## Requirements

Node.js ≥ 20. Peer dependencies: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`.

## License

MIT
