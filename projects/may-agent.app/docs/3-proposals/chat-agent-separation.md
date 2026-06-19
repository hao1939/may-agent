# Proposal: Chat Agent vs Task Agent Separation

## Context

The may-agent system has two fundamentally different execution lifecycles
partly sharing the same session runner (`manager.run()` → `executeSession()` →
terminal result):

1. **Chat sessions** — human↔agent conversation, ongoing REPL
2. **Job sessions** — bounded task execution, start→work→finish→cleanup

The current chat path often behaves like a sequence of bounded turns because
`executeSession()` produces a terminal result and the manager removes the live
session from memory when that turn completes. This makes chat feel cold: the
next human message may replay transcript into a fresh `Agent` instead of
continuing a live conversation.

The fix is not to make chat untracked. The fix is to separate **chat
execution** from **job execution** while keeping chat inside the same session,
event, persistence, and UI tracking model.

## Two Session Types, Two Code Paths

| | Chat session | Job session |
|---|---|---|
| **Lifecycle** | REPL — agent stays alive between messages | Bounded — start, work, finish, cleanup |
| **Owner** | `ChatRuntime` / `ChatSession` | `SubagentManager` |
| **Agent instance** | Created once, kept alive, handles compaction | Created per task, destroyed on completion |
| **System prompt** | Situational: who you're talking to, system state, conversation history | Task-specific: context packet, acceptance criteria, tools |
| **Tools** | System overview, steering, delegation, status checks | Domain-specific: coding, file I/O, spec runner, DB queries |
| **Memory** | Agent transcript + compaction + system state reads | Stateless — context packet rebuilt each time |
| **Finish** | No `finish()` tool — turn goes idle, session waits for next message | Calls `finish()`, session archived |

These do not need to share the job runner, the same prompt builder, or the same
tool set. They should still share the same durable tracking surface:

- `sessions` row and disk transcript
- `session.start`, `session.idle`/turn-complete, `session.error`, and
  cancellation events
- op counts, last activity, source/channel metadata, and UI visibility
- restart recovery through persisted transcript plus fresh system state

In short: **chat bypasses job execution, not observability.**

## Agent Directory Model

### `agents/` — human-facing and system-level agents

The target end-state is one root human-facing agent: May. May is the human's
deputy. She oversees the whole system, handles escalations, and talks to the
human. She does not own any project directly — each project has its own owner
agent.

```
agents/
  may/              ← root human-facing/system-level agent
    AGENTS.md       ← identity: "you are Hao's deputy"
    context.md      ← learned preferences, system knowledge
```

Treat "only May in `agents/`" as a migration goal, not an immediate invariant.
New durable project agents should be app-local. Existing standalone global
agents should be migrated, archived, or explicitly justified.

### `projects/*.app/agents/` — task agents

Each app declares the agents it needs. An app can have multiple agents
with different models for different roles — the planner dispatches to the
right agent based on what the task needs.

```
projects/
  may-agent.app/agents/
    platform-owner/   ← opus — deep platform reasoning, project ownership
    platform-dev/     ← sonnet — fast implementation work
  evaluation.app/agents/
    evaluator/        ← gpt-5.4 — evaluation scoring
  aks-rp-e2e.app/agents/
    aks-explorer/     ← opus — spec/replay design and execution
  scout-knowledge-lib.app/agents/
    scout/            ← opus — research and knowledge synthesis
```

An app chooses how many agents it needs and which models they use. Deep
reasoning tasks go to opus. Fast bulk work goes to sonnet. Adversarial
review goes to a different model for independent perspective. This is a
project-local decision — infra just runs whatever agent the app declares.

### What about dev, arc, and others?

The current `agents/` directory has many standalone agents (dev, arc, amy,
bob, coach, judge, master, optimizer, qa, tech-lead). These should be
assessed:

- **Active and project-useful** → move to the app that uses them
  (e.g., dev → may-agent.app/agents/platform-dev/)
- **Retired / inactive** → archive or remove
- **Shared utility** → if genuinely needed by multiple apps, the app that
  dispatches can call any registered agent by name. The agent identity
  can live in whichever app most often uses it.

The goal: shrink `agents/` toward only May. Everything else should be
project-local unless it has a clearly documented system-level reason to remain
global during migration.

## May's Two Roles

May is the human's deputy — responsible for the whole system, not one
project. She serves two roles through separate sessions:

```
Chat-May     ← persistent REPL, always responsive to human
Deputy-May   ← system-wide judgment via infra handlers (escalation,
               metric triage, ops health)
```

Same agent identity, same AGENTS.md. Different sessions that never block
each other.

**May does not own any project.** Each project has its own domain-specific
owner agent. may-agent.app's owner is `platform-owner`, not May. May is
everyone's boss — she oversees, steers, escalates, and talks to the human.

**May's background work is system-level judgment, not platform project
ownership.** Escalation routing, metric breach routing, failed delivery
handling, and session recovery are infra concerns because they apply to every
project. Deputy-May may judge those signals and decide who owns the next step.

Platform diagnosis and platform repair are still project work. When a signal is
about may-agent itself, Deputy-May should usually route the concrete fix into
`may-agent.app` for `platform-owner` rather than trying to do all repair inside
generic infra handlers.

### Escalation chain

```
Worker can't resolve
  → problem-solver investigates (project-local)
  → planner judges (project owner agent)
  → planner can't resolve
  → escalates to May (infra escalation handler)
  → Deputy-May reviews and judges (job session)
  → if platform repair is needed, route to may-agent.app/platform-owner
  → Deputy-May can't resolve
  → surfaces in chat as notification / proactive mention
  → human decides via Chat-May
  → decision flows back down
```

**Nothing blocks the chat session except the human's own conversation.**
Escalations and ops signals run as Deputy-May job sessions dispatched by infra
handlers. They can create project-local work, update escalation state, notify
the human, or ask Chat-May to continue the conversation, but they never block
the chat REPL.

## Chat Session Design

`ChatSession` owns the human input loop. The runtime creates one persistent
chat session through the manager, but the manager routes `kind: "chat"` /
`autoClose: "never"` through a chat-turn path instead of the job-style
`executeSession()` terminal cycle.

It still registers and updates a normal session record. The distinction is:

- the session registry owns identity, persistence, events, and observability
- the manager owns the long-lived in-memory `Agent` and turn delivery for chat
  sessions
- the job manager still owns bounded job/call sessions

```typescript
class ChatSession {
  private sessionId: string | null = null; // normal tracked session

  async handleInput(message: string) {
    if (!this.sessionId) {
      this.sessionId = manager.run("may", message, {
        kind: "chat",
        autoClose: "never",
      });
      return;
    }

    manager.send(this.sessionId, message); // same Agent, same transcript
    await manager.waitForIdle(this.sessionId);
  }
}
```

**System prompt** — built for human conversation:
- Who May is (identity from agents/may/AGENTS.md)
- What the human cares about (from agents/may/context.md)
- Current system state summary (projects, metrics, alerts)
- NOT task-tree packets — that's for job sessions

**Tools** — for human interaction:
- System status (agents, sessions, metrics, projects)
- Trigger actions (start spec run, advance project, escalate)
- Delegate to task agents (fork/call any registered agent)
- Read project state (task trees, evidence, knowledge)
- Emit canonical human intent events (`project.comment.created`,
  `project.owner.requested`, `session.steer.requested`,
  `runtime.restart.requested`, etc.)
- NOT `finish()` — chat doesn't finish
- NOT broad coding/file mutation tools by default — concrete changes should
  normally be delegated to project/task agents

**Memory** — system state is the source of truth:
- Task trees record decisions
- Project.json records status
- Metrics record measurements
- The chat transcript is persisted supporting context, not the project source
  of truth
- Important decisions flow into the system through normal channels (task
  updates, events, config, project comments)
- Compaction summarizes old turns when context fills

**Continuity across restarts** — when the daemon restarts:
- Transcript is persisted to JSONL (existing mechanism)
- On restart, load transcript into fresh Agent (existing mechanism)
- Inject fresh system state summary (new)
- The conversation continues with warm context
- The session remains visible as the same chat session when recoverable; if it
  cannot be recovered, the daemon emits a visible recovery/failure event rather
  than silently dropping the next human message

## Event Boundary

Chat-May should not be a privileged side channel that mutates runtime state
directly. Human intent should still enter the system as canonical events:

- `human.input.received` is the unified ingress event for free-form human input
  from Telegram, web UI, terminal, socket, or future channels
- `chat.start.requested` creates or binds a chat session
- `session.steer.requested` targets an existing session
- `project.comment.created` gives project-local owners context
- `project.owner.requested` wakes a project owner when judgment is needed
- `escalation.created` crosses an ownership boundary
- `runtime.restart.requested`, `runtime.reload.requested`, and similar events
  handle runtime controls

Chat tools may provide ergonomic wrappers around these events, but the durable
record should be the event, not an untracked in-memory method call.

Transport adapters should only understand channel mechanics: Telegram reply
ids, web auth, socket framing, terminal lines, attachments. They should not
decide backend behavior. The adapter emits `human.input.received` with channel
metadata and an optional target:

```typescript
human.input.received {
  actor: "human:hao",
  text: string,
  conversation: {
    channel: "telegram" | "web-ui" | "console" | "socket",
    channelThreadId?: string,
    channelMessageId?: number,
    replyToInputId?: string,
  },
  target?: {
    owner?: string,
    agent?: string,
    sessionId?: string,
    projectPath?: string,
    taskId?: string,
  }
}
```

The input router converts that raw input event into typed intent events. If the
UI already knows the intent, it may emit the typed event directly. The point is
not to collapse every semantic action into one event; the point is to keep
transport-specific code out of backend decision paths.

## CLI Agent Delegation

May can delegate hard problems to external CLI agents (Claude Code, Codex)
without the human leaving the conversation. The result comes back through
May, not a separate terminal tab.

CLI delegation is not a new may-agent agent type. It is a durable subprocess
runner with structured outputs and normal events.

### Pattern

```
Human asks hard question
  → May starts a durable CLI task with focused prompt and safety mode
  → May tells human "investigating..."
  → Chat stays responsive for other messages
  → CLI finishes → cli.task.completed event
  → event routes to the conversation owner
  → May reads result, summarizes, presents in chat
```

### Events

CLI tasks use the same event model as all other work:

```
cli.task.started    { taskId, tool, mode, cwd, promptPath, resultPath, sourceSessionId }
cli.task.completed  { taskId, tool, resultPath, exitCode, summary }
cli.task.failed     { taskId, tool, resultPath, error, exitCode }
cli.task.orphaned   { taskId, tool, pid, reason }
```

`cli.task.completed` is routed to May or the conversation owner. May then
presents the result in the chat. The chat session does not subscribe to every
CLI event directly.

### Tracking

CLI tasks are tracked like any other work:
- Persisted before process spawn: task id, command, cwd, pid, prompt path,
  result path, source session, timeout, and status
- Visible in a CLI task read model and linked from sessions/tasks/UI
- Duration, terminal state, stdout/stderr tail, and structured result recorded
- Pair tracker detects orphans (started but never completed)
- Ops health metrics cover them
- Restart recovery marks dead in-flight processes as `cli.task.orphaned`
  instead of silently losing them

Existing `background_exec` is useful for interactive process control, but CLI
delegation needs a dedicated durable runner because May should be able to
restart and still know which delegated tasks were running, completed, failed,
or orphaned.

### When to use which CLI

| Need | Default |
|------|---------|
| Quick question or explanation | May answers directly |
| Bounded investigation or review | Use configured read-only CLI worker |
| Patch/fix proposal | Use configured workspace-write CLI worker in isolated workspace/worktree |
| Project-owned work | Prefer project owner/task agent; CLI only if explicitly useful |

May chooses the CLI from policy and current availability, not hard-coded vendor
preference. Codex should use `codex exec` for non-interactive automation, with
JSONL or schema output when the result is consumed by code. Claude Code should
use its non-interactive/scriptable mode with the same runner contract.

### Tool shape

```typescript
// May's chat tools include:
{
  name: "run-cli-agent",
  description: "Delegate a task to Claude Code or Codex CLI",
  parameters: {
    tool: "claude" | "codex",
    mode: "investigate" | "review" | "patch",
    prompt: string,          // what to investigate or implement
    cwd: string,             // working directory
    files?: string[],        // relevant files to focus on
    sandbox?: "read-only" | "workspace-write",
    timeoutMs?: number,
    outputSchema?: string,   // JSON schema path/name for structured result
    worktree?: string,       // required or auto-created for patch mode
  }
}
```

The tool writes the prompt and task record first, spawns the CLI, emits
`cli.task.started`, and returns `{ taskId, status: "running", resultPath }`
immediately. May continues the conversation. When the CLI finishes, the runner
writes a structured result file and emits `cli.task.completed` or
`cli.task.failed`.

For Codex, the command shape should be based on non-interactive execution:

```bash
codex exec --json --sandbox read-only -o "$RESULT_PATH" "$PROMPT" \
  > "$EVENTS_JSONL"
```

`$RESULT_PATH` stores the final response. `$EVENTS_JSONL` stores the streamed
Codex event log for progress, tool calls, and diagnostics.

For patch mode, use `--sandbox workspace-write` only in an isolated workspace
or worktree. The result should include the diff summary, changed files,
verification commands, and any remaining risk. Raw stdout/stderr is supporting
evidence, not the primary result format.

## What This Is Not

- Not building a new chat framework — reusing pi-agent-core Agent as-is
- Not removing the session manager — job sessions still use `manager.run()`,
  and chat still uses session tracking
- Not adding memory infrastructure — system state is the memory
- Not changing the agent model — still LLM + tools + context
- Not removing may-agent.app — it still exists as the platform project,
  just with its own owner agent instead of May
- Not making CLI agents a new agent type — they're tools May invokes,
  tracked via events like any other work

## Implementation Order

1. ✅ Route `kind: "chat"` / `autoClose: "never"` through the manager's chat-turn
   path so successful turns move running → idle instead of emitting terminal
   `session.end`.
2. ✅ Add chat turn states/events: running → idle, visible error/recovery, source
   channel, op count, and last activity.
3. ✅ Build chat-specific system prompt: identity, user preferences, fresh system
   state, and conversation summary; no task-tree packet unless requested.
   Current implementation injects a compact fresh system packet at chat turn
   start; deeper conversation-summary tuning can follow from real usage.
4. ✅ Build chat-specific tool preset: status, steering, delegation, event emit,
   project/task reads, CLI delegation; no `finish()` and no broad mutation
   tools by default. Current implementation filters persistent chat away from
   terminal/mutation/lifecycle tools while keeping read/status/delegation tools.
5. ✅ Add compaction support through pi-agent-core `transformContext`.
6. ⚠️ Verify restart recovery: persisted transcript reloads, fresh system summary
   injects, and failed recovery produces an explicit event/notification.
   Current implementation prefers compact snapshots during resume and refreshes
   the chat prompt on every turn; recovery still needs an end-to-end restart
   scenario with notification verification.
7. Add durable CLI delegation runner: persist task before spawn, run Claude
   Code / Codex in non-interactive mode, write structured result files, emit
   `cli.task.*` events, recover orphans after restart, and present results in
   chat.
8. Create `platform-owner` agent in may-agent.app and transfer may-agent.app
   ownership away from May.
9. Route Deputy-May system judgments through infra handlers, but route concrete
   may-agent platform repair into may-agent.app/platform-owner.
10. Migrate dev/arc to may-agent.app or assess for retirement; disable their
    standalone heartbeats only after replacement coverage exists.
11. Assess remaining `agents/` (amy, bob, coach, judge, master, optimizer, qa,
    tech-lead) for migration, retirement, or explicit temporary global status.
12. Shrink `agents/` toward only `may/` once migration evidence is clean.
