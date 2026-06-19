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

## Agent Directory Model

### `agents/` — the chat agent only

One agent: May. The human's deputy. She oversees the whole system,
handles escalations, talks to the human. She does not own any project
directly — each project has its own owner agent.

```
agents/
  may/              ← the only root agent
    AGENTS.md       ← identity: "you are Hao's deputy"
    context.md      ← learned preferences, system knowledge
```

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

The goal: `agents/` contains only May. Everything else is project-local.

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

**May's background work is system-level, not project-level.** Escalation
handling, metric triage, and ops health reviews run through infra handlers
(metric-alert-reactor, escalation, session-recovery) because they're
system-wide responsibilities. They don't need to route through
may-agent.app workflows — they're the default owner path in the
ownership chain.

### Escalation chain

```
Worker can't resolve
  → problem-solver investigates (project-local)
  → planner judges (project owner agent)
  → planner can't resolve
  → escalates to May (infra escalation handler)
  → Deputy-May reviews, judges, acts (job session)
  → Deputy-May can't resolve
  → surfaces in chat as notification / proactive mention
  → human decides via Chat-May
  → decision flows back down
```

**Nothing blocks the chat session except the human's own conversation.**
Escalations and ops signals run as Deputy-May job sessions dispatched by
infra handlers — completely separate from the chat REPL.

## Chat Session Design

`ChatSession` owns the Agent directly — no `manager.run()`:

```typescript
class ChatSession {
  private agent: Agent;           // long-lived, never destroyed

  constructor() {
    this.agent = new Agent({
      initialState: { systemPrompt, model, tools },
      transformContext,  // compaction when context grows
    });
  }

  handleInput(message: string) {
    this.agent.prompt(message);   // same agent, same transcript
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
- NOT `finish()` — chat doesn't finish

**Memory** — the system state IS the memory:
- Task trees record decisions
- Project.json records status
- Metrics record measurements
- The conversation transcript is temporary — important decisions flow
  into the system through normal channels (task updates, events, config)
- Compaction summarizes old turns when context fills

**Continuity across restarts** — when the daemon restarts:
- Transcript is persisted to JSONL (existing mechanism)
- On restart, load transcript into fresh Agent (existing mechanism)
- Inject fresh system state summary (new)
- The conversation continues with warm context

## What This Is Not

- Not building a new chat framework — reusing pi-agent-core Agent as-is
- Not replacing the manager — job sessions still use `manager.run()`
- Not adding memory infrastructure — system state is the memory
- Not changing the agent model — still LLM + tools + context
- Not removing may-agent.app — it still exists as the platform project,
  just with its own owner agent instead of May

## Implementation Order

1. Separate `ChatSession` to own Agent directly (no `manager.run()`)
2. Build chat-specific system prompt (situational, not task-oriented)
3. Build chat-specific tool set (status, steering, delegation)
4. Add compaction support (via pi-agent-core `transformContext`)
5. Create `platform-owner` agent in may-agent.app, transfer ownership
6. Migrate dev/arc to may-agent.app or assess for retirement
7. Disable heartbeat-dev and heartbeat-arc
8. Move Deputy-May background work from may-agent.app workflows to
   infra escalation/ops handlers
9. Assess remaining `agents/` (amy, bob, coach, etc.) for migration
   or retirement
10. Clean `agents/` to contain only `may/`
