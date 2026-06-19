# Proposal: Chat Agent vs Task Agent Separation

## Context

The may-agent system has two fundamentally different session types running
through the same code path (`manager.run()` → `executeSession()` → delete):

1. **Chat sessions** — human↔agent conversation, ongoing REPL
2. **Job sessions** — bounded task execution, start→work→finish→cleanup

The chat session creates a new `Agent` instance per human message because
`executeSession()` deletes the session from memory when the agent finishes
responding. This makes chat feel cold — each turn replays the transcript
into a fresh agent instead of continuing a live conversation.

## Two Session Types, Two Code Paths

| | Chat session | Job session |
|---|---|---|
| **Lifecycle** | REPL — agent stays alive between messages | Bounded — start, work, finish, cleanup |
| **Owner** | `ChatSession` class | `SubagentManager` |
| **Agent instance** | Created once, kept alive, handles compaction | Created per task, destroyed on completion |
| **System prompt** | Situational: who you're talking to, system state, conversation history | Task-specific: context packet, acceptance criteria, tools |
| **Tools** | System overview, steering, delegation, status checks | Domain-specific: coding, file I/O, spec runner, DB queries |
| **Memory** | Agent transcript + compaction + system state reads | Stateless — context packet rebuilt each time |
| **Finish** | Never finishes — goes idle, waits for next message | Calls `finish()`, session archived |

These don't need to share `manager.run()`, the same prompt builder, or
the same tool set. They share only the underlying `Agent` class from
pi-agent-core.

## Agent Directory Split

**`agents/` = chat agents (human-facing)**

Only May lives here. May is the human's deputy — she answers questions,
takes actions, delegates to task agents, reports back.

```
agents/
  may/              ← the chat agent
    AGENTS.md       ← identity: "you are Hao's deputy"
    context.md      ← learned preferences, system knowledge
    heartbeat.md    ← periodic self-check guidance
```

**`projects/*.app/agents/` = task agents (project-facing)**

Each task agent is owned by a project-app. The app assigns work through
the task tree. The agent does bounded tasks and reports back.

```
projects/
  may-agent.app/agents/
    dev/            ← platform implementation
    arc/            ← system analysis, KE entries
  evaluation.app/agents/
    evaluator/      ← session evaluation
  aks-rp-e2e.app/agents/
    aks-explorer/   ← AKS test execution
  scout-knowledge-lib.app/agents/
    scout/          ← research and knowledge
```

## Chat Session Design

`ChatSession` owns the Agent directly — no `manager.run()`:

```typescript
class ChatSession {
  private agent: Agent;           // long-lived, never destroyed

  constructor() {
    this.agent = new Agent({
      initialState: { systemPrompt, model, tools },
      // compaction via transformContext
    });
  }

  handleInput(message: string) {
    this.agent.prompt(message);   // same agent, same transcript
  }
}
```

**System prompt** — built for human conversation:
- Who May is (identity)
- What the human cares about (from context.md)
- Current system state summary (projects, metrics, alerts)
- NOT the full task-tree packet — that's for job sessions

**Tools** — for human interaction:
- System status (agents, sessions, metrics, projects)
- Trigger actions (start spec run, advance project, escalate)
- Delegate to task agents (fork/call)
- Read project state (task trees, evidence, knowledge)
- NOT `finish()` — chat doesn't finish

**Memory** — the system state IS the memory:
- Task trees record decisions
- Project.json records status
- Metrics record measurements
- The conversation transcript is temporary — important decisions flow into
  the system through normal channels (task updates, events, config changes)
- Compaction summarizes old turns when context fills

**Continuity across restarts** — when the daemon restarts:
- Transcript is persisted to JSONL (existing mechanism)
- On restart, load transcript into fresh Agent (existing mechanism)
- Inject fresh system state summary (new)
- The conversation continues with warm context

## Migration: dev and arc → may-agent.app

`dev` and `arc` currently live in `agents/` with heartbeats. They should
move to `may-agent.app/agents/` as task agents:

1. Create `projects/may-agent.app/agents/dev/` and `agents/arc/`
2. Move agent.json, AGENTS.md, context.md, workflows/
3. Add to may-agent.app schedules or let planner dispatch them
4. Disable heartbeat-dev and heartbeat-arc cron entries
5. Remove `agents/dev/` and `agents/arc/` (keep last-eval.md stubs)

After migration, `agents/` contains only `may/` — the one chat agent.

## Ownership and Escalation

May serves two roles through separate sessions:

```
Chat-May  ← persistent REPL, always responsive to human
Job-May   ← background work via may-agent.app workflows
```

Same agent identity, same AGENTS.md, same context.md. Different sessions.
They never block each other.

**Escalation chain:**

```
Worker can't resolve
  → problem-solver investigates
  → planner judges (project owner)
  → planner can't resolve
  → escalates to May (job session via may-agent.app)
  → Job-May reviews, judges, acts
  → Job-May can't resolve
  → writes finding to task tree / emits escalation for human
  → Chat-May surfaces it when human asks or proactively mentions it
  → human decides via chat
  → decision flows back down
```

**Nothing blocks the chat session except the human's own conversation.**
Escalations, platform reviews, metric judgments, and ops health reviews
all run as may-agent.app job sessions. The chat REPL stays idle and
responsive.

The chat session is the **top of the escalation chain** — where
unresolvable issues land and human decisions enter the system. There is
only one chat agent because there is one human at the top.

**may-agent.app stays as-is** — it owns May's background work through
schedules and workflow handlers (platform-review, ops-health-review,
metric-alert-triage). The only change is the chat session is separated
out as its own lifecycle, not another `manager.run()` call.

## What This Is Not

- Not building a new chat framework — reusing pi-agent-core Agent as-is
- Not replacing the manager — job sessions still use `manager.run()`
- Not removing may-agent.app — it still owns May's background job work
- Not adding memory infrastructure — system state is the memory
- Not changing the agent model — still LLM + tools + context

## Implementation Order

1. Separate `ChatSession` to own Agent directly (no `manager.run()`)
2. Build chat-specific system prompt (situational, not task-oriented)
3. Build chat-specific tool set (status, steering, delegation)
4. Add compaction support (via pi-agent-core `transformContext`)
5. Migrate dev and arc to may-agent.app/agents/
6. Remove heartbeat-dev and heartbeat-arc
7. Clean `agents/` to contain only `may/`
