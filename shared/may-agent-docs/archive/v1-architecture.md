# V1/V2 Design: Agent Growth System

> **Archive**. This was the original V2 design document written before implementation.
> Many ideas were adopted (callAgent, agents tool, convention files, agent growth).
> Some were changed during implementation:
> - The Chat Loop section describes ephemeral per-message sessions — replaced by
>   persistent ChatSession (see [Session Model](../architecture/session-model.md)).
> - `followUp()` and `send()` were removed — replaced by `manager.input()`.
> - Session kinds (`chat`/`job`/`call`) were added (not in original design).
> - System prompt assembly was simplified further (see [System Prompt](../architecture/system-prompt.md)).
> - Notification queue was removed (not "gone" as stated — it was removed during V2 cleanup).
>
> For current architecture, see the files in `docs/architecture/`.

## Vision

Create agents, grow them through coaching, fork to experiment safely, build a
team of powerful specialists. The system is an agent development lifecycle —
create, run, coach, fork, verify, promote — not just an orchestration layer.

## Core Model

### Agent

An agent is a directory:

```
agents/<name>/
  agent.json       # model, tools, description
  SOUL.md          # identity, mission, values
  DOMAIN.md        # domain expertise, protocols
  TOOLS.md         # tool usage guide
  LESSONS.md       # accumulated learnings
  skills/          # discoverable SKILL.md files
  knowledge/       # reference docs (read on demand)
  workflows/       # multi-step patterns (.ts)
  workspace/       # persistent working files
```

This is the complete, portable unit. Same definition runs standalone or in a
team. No code changes needed — just load and run.

### Session

A session is one run of an agent on a task. Linear: start → work → done.

```
run(agent, task) → session runs → result
```

A session holds:
- An `Agent` instance (pi-agent-core) with messages in memory
- JSONL log on disk (for crash recovery)
- Output directory (deliverables)

Sessions run to completion and are archived. No idle state, no wake-up,
no persistent sessions. If you need more work from the same agent, start
a new session.

### Agent Cooperation: `callAgent`

One primitive:

```typescript
callAgent(name: string, task: string, options?: {
  onEvent?: (event: AgentEvent) => void;  // streaming visibility
  signal?: AbortSignal;                    // cancellation
  timeout?: number;                        // ms, abort if exceeded
}): Promise<TaskResult>
```

Synchronous from the caller's perspective — the tool call blocks until the
child agent finishes. The child agent runs in-process as a new Agent instance.

```
May calls callAgent("tech-lead", "implement feature X")
  tech-lead calls callAgent("coder", "write the code")
    coder works, returns result
  tech-lead calls callAgent("qa", "review the changes")
    qa reviews, returns result
  tech-lead returns combined result
May gets result, continues
```

This is a call stack. Simple, debuggable, no async machinery.

**What `TaskResult` contains:**

```typescript
interface TaskResult {
  status: "done" | "error";
  response: string;       // last assistant message text
  sessionId: string;
  duration: string;
  error?: string;
}
```

### Concurrency: Multiple Sessions

If the system needs to do two things at once, start two sessions.

```
Session 1: May → tech-lead → coder    (sync chain, doing work)
Session 2: Cron → heartbeat check     (independent, concurrent)
Session 3: May → peek at session 1    (lightweight, fast)
```

Each session is a synchronous call chain. Sessions run concurrently.
No async primitives within a session. No mailboxes, no event routing.

### Monitoring: peek / steer / cancel

Any session can observe another running session.

**Same process (normal):** read directly from the Agent instance in memory.

```typescript
// See what the agent has done so far
peek(sessionId): AgentMessage[]
  → activeSessions.get(sessionId).agent.state.messages

// Redirect mid-task (injected between tool calls)
steer(sessionId, message): void
  → activeSessions.get(sessionId).agent.steer(message)

// Abort
cancel(sessionId): void
  → activeSessions.get(sessionId).agent.abort()
```

`peek` reads a JavaScript array — zero IO cost. `steer` uses pi-agent-core's
built-in steering queue. `cancel` uses the abort signal.

**Different process (rare):** read JSONL from disk, steer via file or socket.

### The agents Tool

What the LLM sees:

```
Tool: agents
Parameters:
  action: "call" | "list" | "cancel" | "peek" | "steer"
  agent:     string  (for "call")
  task:      string  (for "call")
  sessionId: string  (for "cancel", "peek", "steer")
  message:   string  (for "steer")
```

Five actions. `call` blocks and returns the result. `list` shows available
agents. `peek`/`steer`/`cancel` operate on running sessions.

---

## The Chat Loop

### V1: Persistent session with idle/wake cycle

In v1, May has **one persistent session** that lives for the process lifetime:

```
Startup → createChatSession("may", "Ready") → session lives forever

Human types → is May busy?
  busy  → steer(sid, message)      inject between tool calls
  idle  → followUp(sid, message)   wake the session

May needs work done → run(agent, task)   fire-and-forget, async
Child finishes → notification → followUp(sid, result)   wake May
```

This requires: idle/wake state machine, notification queue + fs.watch + drain
timer, `followUp` mechanism, persistent session that survives restarts,
`steer` vs `followUp` routing logic. ~800 lines of infrastructure.

### V2: Chat loop with ephemeral sessions

The chat loop is a **code-level UI loop** (~50 lines), not an agent session.
Each human message starts a fresh May session. May uses sync `callAgent`
freely — no special async treatment.

```
┌─────────────────────────────────────────────────┐
│ Chat Loop (code, not an agent)                  │
│                                                 │
│   read input → start May session → show output  │
│              ↘ peek/steer/cancel running ones    │
└─────────────────────────────────────────────────┘
```

**One request = one May session:**

```
Human: "fix the login bug"
  → Chat loop starts May session 1 (background)
  → May reasons → callAgent("tech-lead", ...) → blocks, doing work
  → Chat loop shows streaming output via onEvent callback
  → May finishes → chat loop shows result
```

**Concurrent requests — second message while first is running:**

```
  0:00  Human: "fix the login bug"
        → May session 1 starts → callAgent("tech-lead",...) → working

  3:00  Human: "what's the status?"
        → May session 2 starts (lightweight)
        → May sees session 1 running → peek(session1) → returns status
        → Session 2 done (2 seconds)

  5:00  Human: "cancel that, try a different approach"
        → May session 3 starts
        → May cancels session 1 → callAgent("tech-lead", new approach)
        → Session 3 now doing the real work

  8:00  Session 3 finishes → result displayed
```

Each session is independent. Most "second requests" are lightweight — status
checks, cancellations, steering — and finish in seconds because they only
call `peek`/`steer`/`cancel`, not `callAgent`.

### Conversation context

In v1, May's persistent session accumulates all messages — she sees the full
conversation history. In v2, each session is fresh.

Two mechanisms provide continuity:

**Short-term: rolling transcript.** The chat loop keeps a buffer of recent
human/May exchanges and passes them as context to each new session:

```typescript
const chatHistory: Array<{role: "human" | "may", text: string}> = [];

function onInput(message: string) {
  chatHistory.push({ role: "human", text: message });

  const recentContext = chatHistory.slice(-10)
    .map(m => `${m.role}: ${m.text}`)
    .join("\n");

  const sessionId = startSession("may", {
    task: message,
    context: recentContext,
  });

  onSessionDone(sessionId, (result) => {
    chatHistory.push({ role: "may", text: result.response });
  });
}
```

**Long-term: memory.** May's system prompt includes recent task summaries
from `.state/memory/may.jsonl`. She knows what happened yesterday without
needing the transcript.

The transcript is ephemeral (lost on restart). Memory persists across
restarts. Together they cover both "what did you just say" and "what did
we do last week."

### Built-in commands (no LLM)

Some inputs don't need May's reasoning:

- `status` — list all running sessions with agent names and durations
- `cancel` / `cancel <id>` — cancel a session
- `reload` — reload agent configs

These are handled directly by the chat loop. Fast, free, no LLM call.

Everything else starts a May session for intelligent routing.

### Cancellation and course correction

When the human wants to change direction, the new May session cancels the
running one and starts fresh:

```
  0:00  Human: "fix the login bug"
        → Session 1: May → tech-lead → coder (writing code)

  3:00  Human: "cancel that, try a different approach"
        → Session 2: May cancels session 1 (abort propagates through chain)
        → Session 2: May starts fresh → callAgent("tech-lead", new approach)
```

Cancel-and-retry is the primary correction mechanism. The new session starts
with full context: the rolling transcript includes the original request and
the cancellation, and partial work from session 1 is on disk (files, git diff).

**What about mid-task steering?** ("change approach without cancelling")

In V2, steering a blocked agent doesn't propagate down the call chain. If May
is blocked inside `callAgent("tech-lead", ...)`, steering May queues until
tech-lead returns — too late. You can steer the leaf agent (e.g., coder)
directly if you know its session ID, but this is awkward.

In practice, cancel-and-retry is simpler and more reliable than trying to
redirect a running chain mid-task. If a task is going the wrong way, start
fresh. The partial work is still on disk — the new session can read it and
build on it rather than starting from zero.

### What's eliminated

| V1 | V2 |
|---|---|
| Persistent session (lives forever) | Ephemeral sessions (per request) |
| `steer` vs `followUp` routing | Always start new session |
| Idle/wake state machine | No idle state |
| Notification queue + drain | Sync `callAgent` returns directly |
| `resumeChatSession` on restart | Nothing to resume |
| `waitForIdle` prompt timing | Session done → prompt |

---

## Workflows

Workflows are TypeScript functions that call `callAgent` in sequence:

```typescript
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const code = await ctx.callAgent("coder", ctx.task);
  if (code.status === "error") return ctx.escalate("coder failed");

  const review = await ctx.callAgent("qa", "review: " + code.response);
  if (review.response.includes("FAIL")) {
    const fix = await ctx.callAgent("coder", "fix: " + review.response);
    const reReview = await ctx.callAgent("qa", "re-review: " + fix.response);
    return ctx.done(reReview.response);
  }

  return ctx.done(review.response);
}
```

No special framework. `ctx.callAgent` is just `callAgent` with session tracking
for crash-safe replay: step results are checkpointed, replayed on restart.

---

## Safety Guards

**Timeout:** `callAgent` accepts an optional `timeout` (milliseconds). If the
child agent doesn't finish in time, it's aborted and the call returns an error
result. Default: none (agent runs until done). Configured per-agent in
agent.json or per-call.

**Call depth limit:** The session runner tracks call depth globally. When
agent A calls agent B calls agent C, depth = 3. If depth exceeds `maxCallDepth`
(default: 10), the call returns an error instead of starting the child. This
prevents recursive loops (A → B → A → B → ...) without requiring per-agent
configuration.

---

## Cron and Detached Execution

Cron jobs may need to run independently of the main process — a scheduled
task shouldn't block the process, and should survive a restart.

This is an **application concern**, not agent cooperation. `callAgent` is
always in-process and sync. Cron is separate:

```
Agent cooperation:  callAgent("coder", task)    ← in-process, sync
Cron execution:     spawn detached process       ← OS-level, independent
```

The cron runner spawns a separate Node.js process that loads the agent
definition and runs it standalone. Same agent, same tools, same knowledge —
just a different process. The two never interact through `callAgent`.

Detached processes use the JSONL persistence layer for crash recovery and
write results to the same `.state/` directory. The main process can observe
detached sessions by reading their JSONL files from disk.

---

## Crash Recovery

**Session level:** Messages are appended to JSONL as they arrive. On restart,
reload messages into an Agent instance, continue the agent loop. pi-agent-core
handles the continuation (sees existing messages, picks up where it left off).

**Workflow level:** Step results are saved as JSON. On restart, completed steps
return cached results; execution resumes from the first missing step.

**Simplification from v1:** No notification queue, no undelivered messages file,
no drain timer, no dead-letter retry. Sync calls mean the parent is blocked
waiting — when it resumes, the child result is either available (completed
before crash) or the child is re-run.

---

## Agent Growth Loop

This is the new layer — what v1 doesn't have. See `v2-agent-growth.md` for
full details on fork/coach/verify/promote.

### Create

Define an agent: write agent.json + knowledge files. Or have the coach
create one programmatically.

### Run

Run the agent on tasks. Sessions accumulate memory (past task summaries
injected into future system prompts). The agent builds experience.

### Coach

The coach agent observes other agents and makes them better by directly
editing their configuration and knowledge. For risky changes, the coach
forks the agent to `.lab/`, experiments safely, and promotes if successful.

### Growth Log

Per-agent version history in `GROWTH.md`. The coach appends entries.
Simple markdown. No database.

---

## System Prompt Assembly

Assembled fresh per session from the agent directory:

```
1. Runtime environment (project root, paths, agent files)
2. SOUL.md        — identity, mission, values
3. DOMAIN.md      — domain expertise, protocols
4. TOOLS.md       — tool usage guide
5. Shared knowledge (philosophy.md, team.md, etc.)
6. Skills         — discovered from skills/ directories
7. LESSONS.md     — accumulated learnings (changes often, near end)
8. Session context (session ID)
9. Memory         — recent task history (last N entries)
10. Workspace info
```

Stable content first (cache-friendly), volatile content last.

---

## Persistence Layout

```
.state/
  memory/<agent>.jsonl          # task summaries (append-only)
  sessions/<id>/
    meta.json                   # session metadata
    session.jsonl               # conversation (append-only)
    output/                     # deliverables
  sessions/history/<id>/        # archived completed sessions
  workflows/<runId>.json        # workflow step checkpoints
```

---

## What's Removed from V1

| Removed | Why |
|---|---|
| 11-action subagents tool | Replaced by 5-action agents tool |
| `run` + `waitFor` async pattern | Replaced by sync `call` |
| `delegate` (separate from `call`) | Same thing, one name |
| `progress` / `result` / `status` actions | `peek` covers all |
| Notification queue | Sync calls return results directly |
| Undelivered messages + drain + dead-letter | Gone with notifications |
| Idle / wake state machine | Sessions run to completion |
| `followUp` mechanism | No idle sessions to wake |
| `autoClose` modes | One mode: complete and archive |
| Persistent (chat) sessions | Start new sessions instead |
| `trace` / `health` actions | Separate diagnostic tools, not agent cooperation |
| Detached process management | Same-process by default; separate process is app concern |

## What's Kept from V1

| Kept | Why |
|---|---|
| Agent definition format | Portable, self-contained, proven |
| pi-agent-core Agent class | The engine |
| Session JSONL persistence | Crash recovery |
| Memory (task summaries) | Continuity across sessions |
| Compaction | Long sessions need context management |
| Coding tools (bash, read, edit, write) | Agents need to interact with the world |
| Agent loader (agent.json → registered agent) | Config-driven setup |
| Workflows (TypeScript functions) | Codified cooperation patterns |
| System prompt assembly | Multi-source prompt building |
| Skills discovery | SKILL.md standard |
| Event bus (for UI) | Decouples rendering from agent logic |
| Console / socket UI | Human needs to see what's happening |

## What's New

| New | Purpose |
|---|---|
| `callAgent` — single sync cooperation primitive | Simplifies all agent-to-agent interaction |
| `peek` / `steer` / `cancel` — monitoring tools | Observe and intervene in running sessions |
| Chat loop with concurrent May sessions | Human stays responsive during long tasks |
| Coach tools (edit config, fork, verify) | Direct agent improvement |
| Fork / verify / promote flow | Safe experimentation |
| Growth log | Track agent improvement over time |

---

## Architecture Summary

```
┌──────────────────────────────────────────┐
│            Growth Loop                    │
│  create → coach → fork → verify → grow   │
│  (coach tools, verification, growth log)  │
├──────────────────────────────────────────┤
│          Agent Cooperation                │
│  callAgent (sync) + peek/steer/cancel     │
│  workflows = sequential callAgent calls   │
├──────────────────────────────────────────┤
│          Chat Loop                        │
│  human input → May sessions (concurrent)  │
│  transcript for context, /commands        │
├──────────────────────────────────────────┤
│          Session Runner                   │
│  run task → persist → complete → archive  │
│  concurrent sessions for parallelism      │
├──────────────────────────────────────────┤
│          Agent Definition                 │
│  agent.json + SOUL/DOMAIN/TOOLS/LESSONS   │
│  skills, knowledge, workspace             │
├──────────────────────────────────────────┤
│          Infrastructure                   │
│  pi-agent-core, persistence, compaction   │
│  crash recovery, cron, UI, event bus      │
└──────────────────────────────────────────┘
```
