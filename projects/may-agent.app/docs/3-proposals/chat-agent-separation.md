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

`ChatSession` owns the live `Agent` execution directly — no job-style
`manager.run()` / `executeSession()` terminal cycle for each turn.

It still registers and updates a normal session record. The distinction is:

- the session registry owns identity, persistence, events, and observability
- `ChatSession` owns the long-lived in-memory `Agent` and turn delivery
- the job manager still owns bounded job/call sessions

```typescript
class ChatSession {
  private agent: Agent;           // long-lived, never destroyed
  private sessionId: string;      // normal tracked session

  constructor() {
    this.sessionId = sessions.create({ kind: "chat", autoClose: "never" });
    this.agent = new Agent({
      initialState: { systemPrompt, model, tools },
      transformContext,  // compaction when context grows
    });
  }

  handleInput(message: string) {
    sessions.markRunning(this.sessionId);
    this.agent.prompt(message);   // same agent, same transcript
    sessions.markIdle(this.sessionId);
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

- `chat.start.requested` creates or binds a chat session
- `session.steer.requested` targets an existing session
- `project.comment.created` gives project-local owners context
- `project.owner.requested` wakes a project owner when judgment is needed
- `escalation.created` crosses an ownership boundary
- `runtime.restart.requested`, `runtime.reload.requested`, and similar events
  handle runtime controls

Chat tools may provide ergonomic wrappers around these events, but the durable
record should be the event, not an untracked in-memory method call.

## What This Is Not

- Not building a new chat framework — reusing pi-agent-core Agent as-is
- Not removing the session manager — job sessions still use `manager.run()`,
  and chat still uses session tracking
- Not adding memory infrastructure — system state is the memory
- Not changing the agent model — still LLM + tools + context
- Not removing may-agent.app — it still exists as the platform project,
  just with its own owner agent instead of May

## Implementation Order

1. Introduce `ChatRuntime` / revised `ChatSession` that owns a long-lived
   `Agent` directly while still creating/updating a tracked `kind: "chat"`
   session.
2. Add chat turn states/events: running → idle, visible error/recovery, source
   channel, op count, and last activity.
3. Build chat-specific system prompt: identity, user preferences, fresh system
   state, and conversation summary; no task-tree packet unless requested.
4. Build chat-specific tool preset: status, steering, delegation, event emit,
   project/task reads; no `finish()` and no broad mutation tools by default.
5. Add compaction support through pi-agent-core `transformContext`.
6. Verify restart recovery: persisted transcript reloads, fresh system summary
   injects, and failed recovery produces an explicit event/notification.
7. Create `platform-owner` agent in may-agent.app and transfer may-agent.app
   ownership away from May.
8. Route Deputy-May system judgments through infra handlers, but route concrete
   may-agent platform repair into may-agent.app/platform-owner.
9. Migrate dev/arc to may-agent.app or assess for retirement; disable their
   standalone heartbeats only after replacement coverage exists.
10. Assess remaining `agents/` (amy, bob, coach, judge, master, optimizer, qa,
    tech-lead) for migration, retirement, or explicit temporary global status.
11. Shrink `agents/` toward only `may/` once migration evidence is clean.
