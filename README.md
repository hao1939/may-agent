# may-agent

A persistent, multi-session sub-agent manager built on [pi-agent-core](https://github.com/nicokoenig/pi-mono). **may-agent** turns LLM agents into **feature units** — long-lived capabilities that own a domain, accumulate knowledge and memory across tasks, and can be orchestrated by a parent agent or used standalone.

## Why may-agent?

Running one-off LLM prompts is easy. Building agents that **remember**, **evolve**, and **coordinate** is hard. may-agent provides:

- **Persistent identity** — each agent has a name, domain, knowledge base, tools, and workspace that survive across tasks and process restarts.
- **Cross-session memory** — task outcomes are automatically logged and injected into future sessions so agents learn from past work.
- **Non-blocking multi-session** — run multiple agents (or multiple tasks on the same agent) concurrently. Poll progress, steer mid-run, or `await` completion.
- **Session persistence & resume** — conversations are streamed to disk as JSONL. If the process crashes, `resume()` picks up where it left off.
- **Parent-agent orchestration** — expose the entire manager as a single tool (`createTool()`) so a coordinating agent can dispatch, monitor, and collect results from sub-agents.

## Architecture Overview

```
SubagentManager
  ├── register()        ← define agents (name, domain, model, tools, knowledge)
  ├── run()             ← start a task → returns sessionId (non-blocking)
  ├── progress()        ← read conversation so far
  ├── steer()            ← redirect a running session
  ├── cancel()          ← abort a session
  ├── result()          ← get final output
  ├── waitFor()         ← await completion
  ├── resume()          ← restart interrupted sessions after crash
  └── createTool()      ← expose as a tool for a parent agent
```

### Six Layers of State

| Layer | Location | Lifetime | Purpose |
|-------|----------|----------|---------|
| **Knowledge** | `<agentDir>/knowledge/` | Permanent, mutable | Domain expertise (loaded via `systemPromptFiles`) |
| **Tools** | `<agentDir>/tools/` | Permanent, mutable | Reusable scripts the agent creates and maintains |
| **Workspace** | `<agentDir>/workspace/` | Permanent, mutable | Working files, drafts, temp data |
| **Memory** | `<persistDir>/memory/` | Permanent, append-only | Task outcomes across all sessions |
| **Session** | `<persistDir>/sessions/<id>/` | Archived after task | Conversation trace (JSONL) |
| **Output** | `<persistDir>/sessions/<id>/output/` | Archived with session | Task deliverables |

The top three layers are **caller-managed** (your directory structure). The bottom three are **manager-managed** (automatic persistence).

## Installation

```bash
npm install may-agent
```

> **Requirements:** Node.js ≥ 20. Peer dependencies: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`.

## Quick Start

### Standalone Usage

```typescript
import { SubagentManager, createReadTool, createWriteTool, createExecTool } from "may-agent";
import { Claude } from "@mariozechner/pi-ai";

const manager = new SubagentManager({ persistDir: "./state" });

// 1. Register an agent
manager.register({
  name: "researcher",
  description: "Deep research on technical topics",
  domain: "academic research",
  systemPromptFiles: [
    "./agents/researcher/knowledge/domain.md",
    "./agents/researcher/tools/INDEX.md",
  ],
  workspace: "./agents/researcher/workspace",
  tools: [createReadTool(), createWriteTool(), createExecTool()],
  model: Claude.Sonnet,
  apiKey: process.env.ANTHROPIC_API_KEY,
  memoryLimit: 20,
});

// 2. Run a task (non-blocking, returns immediately)
const sessionId = manager.run("researcher", "Find recent papers on multi-agent RL");

// 3. Check progress
const messages = manager.progress(sessionId, 5); // last 5 messages

// 4. Steer mid-run
manager.steer(sessionId, "Focus on cooperative settings, not competitive");

// 5. Wait for completion and get the result
const result = await manager.waitFor(sessionId);
console.log(result.lastAssistantText);
console.log(result.outputDir); // "./state/sessions/history/<id>/output/"
```

### As a Parent-Agent Tool

Let a coordinating agent manage sub-agents through a single tool:

```typescript
import { Agent } from "@mariozechner/pi-agent-core";

const manager = new SubagentManager({ persistDir: "./state" });
manager.register({ name: "researcher", /* ... */ });
manager.register({ name: "writer",     /* ... */ });

const orchestrator = new Agent({
  initialState: {
    systemPrompt: "You coordinate specialized agents to complete complex tasks.",
    model: Claude.Sonnet,
    tools: [manager.createTool()],
  },
  getApiKey: () => process.env.ANTHROPIC_API_KEY,
});

// The orchestrator can now list agents, run tasks, check status,
// read progress, get results, and cancel sessions — all through
// the "subagents" tool.
await orchestrator.prompt("Research transformer architectures, then write a summary report.");
```

### Resuming After a Crash

```typescript
const manager = new SubagentManager({ persistDir: "./state" });

// Re-register agents (tools and apiKey are not persisted — must be re-supplied)
manager.register({ name: "researcher", tools: [...], apiKey: "...", /* ... */ });

// Resume all sessions that were "running" when the process died
const resumed = manager.resume();
console.log(`Resumed ${resumed.length} sessions`);
```

## API Reference

### `SubagentManager`

The core class. Manages agent registration, session lifecycle, persistence, and recovery.

```typescript
new SubagentManager(opts?: { persistDir?: string })
```

If `persistDir` is provided, all state (registry, sessions, memory) is persisted to disk. Without it, everything is in-memory only.

#### Agent Registration

| Method | Description |
|--------|-------------|
| `register(def: SubagentDefinition): void` | Register (or update) an agent definition. |

#### Session Lifecycle

| Method | Returns | Description |
|--------|---------|-------------|
| `run(name, task)` | `string` | Start a task on a registered agent. Returns `sessionId`. Non-blocking. |
| `waitFor(sessionId)` | `Promise<TaskResult \| null>` | Wait for a session to finish, then return the result. |
| `cancel(sessionId)` | `void` | Abort a running session. |
| `resume()` | `SessionInfo[]` | Resume all interrupted sessions (after process restart). |

#### Session Interaction

| Method | Returns | Description |
|--------|---------|-------------|
| `progress(sessionId, limit?)` | `AgentMessage[]` | Get recent messages from a session. |
| `steer(sessionId, message)` | `"steered" \| "queued" \| "not_running"` | Inject guidance into a running session. |
| `subscribe(sessionId, fn)` | `() => void` | Subscribe to real-time agent events. Returns unsubscribe function. |

#### Query

| Method | Returns | Description |
|--------|---------|-------------|
| `status()` | `SessionInfo[]` | List active (running) sessions. Completed sessions are removed from memory; use `result()` or `progress()` to access them. |
| `sessions(name)` | `SessionInfo[]` | List sessions filtered by agent name. |
| `result(sessionId)` | `TaskResult \| null` | Get the result of a completed session. `null` if still running or not found. |

#### Path Accessors

| Method | Returns | Description |
|--------|---------|-------------|
| `getWorkspacePath(name)` | `string \| undefined` | Workspace directory for an agent. |
| `getMemoryPath(name)` | `string \| undefined` | Path to an agent's memory JSONL file. |
| `getOutputPath(sessionId)` | `string \| undefined` | Output directory for a session (active or archived). |

#### Parent-Agent Integration

| Method | Returns | Description |
|--------|---------|-------------|
| `createTool()` | `AgentTool` | Create a tool that exposes `list`, `run`, `status`, `progress`, `result`, and `cancel` actions to a parent agent. |

---

### `SubagentDefinition`

Configuration for registering an agent.

```typescript
interface SubagentDefinition {
  name: string;              // Unique agent identifier
  description: string;       // What this agent does (visible to parent agents)
  domain: string;            // Domain of expertise

  // System prompt (choose one)
  systemPrompt?: string;           // Direct system prompt string
  systemPromptFiles?: string[];    // Files loaded and concatenated at session start

  workspace?: string;        // Persistent working directory
  tools: AgentTool[];        // Tools available to the agent
  model: Model<any>;         // LLM model to use
  apiKey?: string;           // API key (not persisted to disk)
  timeoutMs?: number;        // Session timeout
  memoryLimit?: number;      // Max recent memory entries in system prompt (default: 20)
}
```

### `SessionInfo`

Runtime information about a session.

```typescript
interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "done" | "error" | "interrupted";
  startedAt: number;
  endedAt?: number;
  runtime: string;           // Human-readable, e.g. "4m12s"
  outputDir: string;
  error?: string;
}
```

### `TaskResult`

Result of a completed session.

```typescript
interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;  // Final assistant response
  messages: AgentMessage[];          // Full conversation history
  duration: string;                  // Human-readable duration
  outputDir: string;                 // Where deliverables were written
  error?: string;
}
```

### Built-in Tools

may-agent ships with three tool factories for common agent capabilities:

```typescript
import { createReadTool, createWriteTool, createExecTool } from "may-agent";

createReadTool()          // Read file contents
createWriteTool()         // Write files (creates parent dirs)
createExecTool(cwd?)      // Execute shell commands (optional working directory)
```

### Persistence Utilities

Lower-level exports for custom persistence workflows:

```typescript
import {
  RegistryStore,              // Manages registry.json (agent configs + session status)
  appendSessionMessage,       // Append a message to session JSONL
  readSessionMessages,        // Read all messages from session JSONL
  appendMemoryEntry,          // Append to agent memory
  readMemoryEntries,          // Read recent memory entries
  archiveSession,             // Move session to history
} from "may-agent";
```

## Persistence Layout

When `persistDir` is set, may-agent writes the following structure:

```
<persistDir>/
  ├── registry.json               # Agent configs + session status
  ├── memory/
  │   ├── researcher.jsonl        # Task history for "researcher"
  │   └── writer.jsonl            # Task history for "writer"
  └── sessions/
      ├── <sessionId>/            # Active session
      │   ├── session.jsonl       # Conversation (append-only)
      │   └── output/             # Task deliverables
      └── history/
          └── <sessionId>/        # Archived (completed) session
              ├── session.jsonl
              └── output/
```

## Recommended Agent Directory Layout

While may-agent doesn't enforce this structure, it's designed to work with it:

```
<agentDir>/
  ├── knowledge/              # Domain expertise → systemPromptFiles
  │   ├── domain.md
  │   ├── patterns.md
  │   └── user-preferences.md
  ├── tools/                  # Reusable scripts the agent creates
  │   ├── INDEX.md            # Agent-maintained manifest
  │   └── ...
  └── workspace/              # Working directory → workspace
```

## Design

See [docs/design.md](./docs/design.md) for the full architecture document, including the six-layer state model, evolution patterns, and restart recovery flow.

## License

MIT