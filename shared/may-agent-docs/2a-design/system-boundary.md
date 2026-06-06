# Infra Surface Design

**Status**: Accepted direction, mostly implemented across the core infra
surface. Keep this as the north-star while folding stable pieces into
`architecture.md`, `sdk.md`, `events.md`, `metrics.md`, `cron.md`, and
`../1-principles/work-model.md`.

This doc reframes may-agent around a simpler split:

```
Infra provides primitives.
Agents build patterns.
```

The goal is to keep the daemon small and stable while allowing heartbeat,
project, workflow, evaluator, and alert-handling patterns to evolve without
turning infra into a pile of special cases.

## Core Insight

May-agent is an event-driven agent control plane with metrics as observable
signals.

Everything important should fit this shape:

```
event -> owner/context resolution -> work execution -> evidence -> events/metrics
```

Events move the system. Metrics observe the system. Agents judge and act.

## Infra vs Agent Patterns

Infra should know only the primitives that are mechanically enforceable and
stable across all patterns.

| Infra primitive | Meaning |
|---|---|
| Event | Something happened. Append-only fact and routing input. |
| Metric | Observable signal. It may indicate drift, progress, failure, or stale measurement. |
| Alert | Metric/event signal that needs owner attention. |
| Session mechanics | Session id, transcript, status, persistence, resume, cancel, hierarchy. |
| Work execution | Start a bounded work unit and return evidence. The unit can be one agent session or a workflow that pre-orchestrates sessions/functions. |
| Query/projection | Safe read access to events, sessions, metrics, projects, and alerts. |
| Guard | Mechanical detector around tools or workflow execution. It emits risk/weakness signals and may warn, repair, or block when justified. |
| Socket control | Universal command/event ingress and realtime event stream. |
| Agent loading | Discover agent definitions, build tool/workflow/handler surfaces, and apply reloads without changing active sessions. |
| Recovery | Durable state cleanup, stale session handling, crash recovery. |

Agent patterns are conventions built from these primitives.

| Agent pattern | Meaning |
|---|---|
| Session | One bounded attempt to move a goal forward. Infra owns mechanics; agents own meaning. |
| Heartbeat | Recurring agent-owned reassessment of signals, context, inbox, and open work. |
| Project | Durable goal/context/plan/evidence container across sessions. |
| Workflow | Known procedure that gathers context, runs steps, and dispatches agents. It is pre-orchestrated sessions, not a separate kind of intelligence. |
| Alert triage | Owner judgment over a metric/event signal. |
| Evaluation | Review a session, learn from good and bad work, emit signals for later action. |
| Knowledge learning | Convert evidence into durable context, skills, workflows, or guards. |

Infra should not hardcode "heartbeat logic" or "project logic" beyond generic
session metadata and event routing. Heartbeats and projects are agent patterns.

## Control Plane Shape

```
Adapters
CLI / Web UI / Telegram / timers
        |
        v
Universal Control Interface
Unix socket: accept events, stream events, expose small status surface
        |
        v
Infra Kernel
Event bus + event store + metrics + session registry + guards + recovery
        |
        v
Agent Bridge
infra event -> agent run
agent/tool/session event -> infra event
        |
        v
pi-coding-agent runtime
LLM loop, tools, sessions
```

The daemon kernel should stay boring:

- persist events,
- route events,
- record/evaluate metrics,
- run/resume/cancel sessions and workflow-composed session trees,
- run guards as detectors with explicit intervention modes,
- expose control socket,
- maintain projections for UI/query.

The kernel should not decide:

- what a heartbeat means,
- how a project should progress,
- whether a metric is "really bad",
- what "done" means for a durable goal,
- how an agent should investigate.

Those are pattern-level decisions owned by agents and workflows.

## Event And Metric Semantics

Events are movement:

- timer fired,
- Telegram reply arrived,
- project comment created,
- metric breached,
- session started,
- session ended,
- agent made a decision.

Metrics are signals:

- "this may need attention",
- "this may validate a change",
- "this may be stale",
- "this may be a bad threshold",
- "this may be an accepted exception."

Metrics do not judge. The owner agent judges using goal, context, facts,
history, and causal theory. P0 metrics can directly wake an owner. Lower
priority metrics should be visible through heartbeat/project context unless a
specific workflow subscribes to them.

## Guard Semantics

Guards are mechanical detectors with optional intervention. Their default value
is observability: a guard trigger should become a durable signal that later
review can connect to agent weakness, missing context, workflow prompt problems,
or tool-surface confusion.

Default path:

```
guard fires -> guard.triggered -> default guard handler records metrics/projection
```

Blocking remains a guard/runtime intervention for high-confidence,
high-impact risk. The default handler should not decide whether to block.

Current state: workflow and tool-level guard triggers emit durable
`guard.triggered` events with owner/session/workflow context where available.
Guard metrics separate actionable short-window block health from 24h watch
signals. See [guards.md](guards.md).

## Agent Bridge

The bridge is the explicit boundary between infra and agent behavior.

It has two directions.

### Infra -> Agent

```
event
  -> resolve owner/project/context
  -> build task
  -> runAgent(agent, task, opts)
     or runWorkflow(workflow, task, opts)
```

Examples:

- `timer.tick` -> heartbeat workflow builds live context -> run owner.
- `project.comment.created` -> project handler builds project context -> run owner.
- `metric.breach` P0 -> alert workflow builds alert context -> run owner.
- `metric.breach` P1/P2 -> persisted signal -> owner sees it in next heartbeat/project pass.

`runAgent` and `runWorkflow` should feel like the same operation:

```
runAgent(agent, task, opts)       -> one agent session
runWorkflow(workflow, task, opts) -> pre-orchestrated sessions/functions
```

Both take a task and options, create traceable execution, emit lifecycle events,
and return a result with evidence. A workflow is not a privileged infra concept;
it is a reusable orchestration pattern around sessions.

Shared result shape:

```ts
interface ExecutionResult {
  id: string;
  kind: "session" | "workflow";
  status: "done" | "error" | "interrupted" | "blocked" | "escalated";
  summary: string;
  traceId: string;
  evidence?: Record<string, unknown>;
}
```

`TaskResult` and `WorkflowResult` can carry richer details, but they should map
to this shape. This keeps tracing, diagnostics, UI, and tests simple.

Resume should follow the same symmetry:

```
resumeSession(sessionId, opts)  -> continue/recover one session
resumeWorkflow(runId, opts)    -> continue/recover a pre-orchestrated session tree
```

Both are diagnostic operations as much as execution operations. They should:

- inspect durable state first,
- preserve the original id/run lineage,
- emit recovery/resume events,
- return a clear status,
- expose where the resumed trace can be inspected,
- explain why resume was possible or impossible.

Workflow resume should not be a special opaque replay. It should use the same
trace model as sessions: parent links, workflow run id, completed steps,
current/failed step, child session ids, interruption/block reason, and next
recoverable action.

### Agent -> Infra

```
pi-coding-agent event
  -> normalize system event
  -> persist
  -> update projections/metrics
  -> notify subscribers
```

Examples:

- tool call -> `tool_call`
- finish -> `session.end`
- message tool -> `message.created`
- workflow step -> `workflow`
- evaluation result -> metric/event/project update

The bridge should be explicit in code so routing, ownership, and context
construction are not scattered across Telegram, Web UI, cron handlers, and
manager glue.

## Socket Boundary

The Unix socket is the universal write/control interface.

Adapters should be thin:

```
CLI action      -> socket event
Web UI action   -> socket event
Telegram update -> socket event
Timer tick      -> event
```

Socket-local commands should stay minimal:

- `subscribe`
- `status`

Everything else should be an event frame:

```json
{ "type": "project.comment.created", "source": "web-ui", "owner": "agent:may", "data": { "projectPath": "projects/x", "comment": "..." } }
{ "type": "input", "sessionId": "s_123", "message": "continue" }
{ "type": "metric.threshold_changed", "source": "metrics", "owner": "agent:may", "data": { "metricId": "m", "to": 0.8 } }
```

Socket `ok` means the event was accepted into the transport. It does not mean
all subscribers finished.

Read path should stay pragmatic:

- Writes/control go through socket/events.
- Realtime observation uses socket event stream.
- Historical/dashboard reads can use DB projections directly.

Do not turn the socket into a large query API until there is a clear need.

Current state:

- `packages/control` owns the protocol, client helpers, and server core.
- The daemon socket is shared by the running instance. It is not one socket per
  agent, even though the legacy filename still includes the interface agent.
- Web UI steering and CLI send already use the control client package.
- The server removes stale socket files when it can prove no process owns them.
- Clients should use the convention daemon socket path:
  `<persistDir>/instances/<instance>/<interfaceAgent>.sock`.
- If that socket cannot be connected, fail clearly and trigger/log recovery. Do
  not scan/rank other candidates as a normal path.
- Selected adapter/control events (`input`, `steer`, `cancel*`, `resume`,
  `reload`, `restart`, `shutdown`) are persisted so comparable actions leave
  durable traces across CLI, Web UI, Telegram, and operator emits.
- Telegram is still attached inside the daemon process. Treat that as acceptable
  until the control client is reliable; do not split the process first.

## Agent Loading Boundary

Agent loading is an infra boundary, not a side effect of daemon startup. Its
job is to turn files into runtime definitions.

Default flow:

```
discover agent dirs
  -> read/validate agent.json
  -> build AgentDefinition
  -> build ToolSet from presets + local tools
  -> register definition with manager
  -> attach cron entries and handler resolver
  -> emit loader evidence
```

Reload is the same flow applied again. It updates definitions for future
sessions; active sessions keep the tools, prompt, model, and runtime context
they already started with. Reload should not silently mutate in-flight work.

Loading contract:

| Source | Owner | Reload trigger | Active-session effect | Failure response |
|---|---|---|---|---|
| `agent.json` | agent loader | explicit reload command/event | none; future sessions use the new definition | skip that agent, emit loader evidence |
| `AGENTS.md` and always-loaded prompt files | agent loader | explicit reload command/event | none; future sessions use the new prompt | skip/mark invalid if required files cannot load |
| local tools under `tools/` | agent loader | explicit reload command/event | none; future sessions see the new toolset | skip bad tool, emit loader evidence |
| handler files under `handlers/` | handler loader | each handler invocation | none; next invocation imports fresh code | fail that event, emit handler failure evidence |
| `cron.json` | cron runner | file watch or explicit cron reload | unchanged timers are preserved | skip bad entries, keep valid entries running |
| workflows under `workflows/` | workflow runner | each workflow invocation/resume | running workflow keeps persisted state; next step imports current workflow code | fail/resume with diagnostic evidence |

Hot-reload should stay narrow. Handlers and workflows can reload at invocation
boundaries because they are short-lived execution units. Agent definitions,
prompt inputs, and local tools reload only on explicit reload because they shape
the session contract.

The loader should not decide project behavior, heartbeat meaning, or alert
judgment. It should only assemble capabilities and register them.

Target module shape:

| Module | Responsibility |
|---|---|
| `agent-discovery` | find candidate agent directories and config paths |
| `agent-config` | parse/validate `agent.json`, resolve conventions |
| `toolset-loader` | map tool presets and local tools to `AgentTool[]` |
| `heartbeat-loader` | generate conventional heartbeat cron entries |
| `handler-loader` | attach handler resolvers and hot-reload wrapper |
| `agent-registry-loader` | orchestrate discovery -> definition -> manager registration |

Keep these as `src/app/loader/*` modules first. Create a package only if this
surface becomes useful outside the daemon and has no app-specific imports.

## Public Surfaces

There should be two stable public surfaces:

1. Agent tools for LLM sessions.
2. Infra SDK for TypeScript workflows and handlers.

The control client is the external adapter surface for CLI/Web UI/Telegram.
Workflow and handler contexts may expose different handles (`ctx.*` vs
`ctx.sdk.*`), but they should converge on the same underlying SDK semantics.

### 1. Agent Tool Surface

This is what the LLM sees. It should be safe and task-oriented.

Examples:

- `query_db` read-only, bounded, schema-aware,
- `message`,
- `workflow`,
- `finish`,
- file/edit/bash tools,
- future `metrics` tool only if agents need first-class metric creation/recording.

Agents should not be taught to open SQLite directly from bash. When live data is
needed, prefer workflow-collected context or a safe query tool.

### 2. Infra SDK

For TypeScript workflows and handlers:

```ts
sdk.runAgent(agent, task)
sdk.runWorkflow(name, task)
sdk.emit(type, data, envelope?)
sdk.metrics.*
sdk.query.*
sdk.message(...)
sdk.escalate(reason, opts?)
sdk.log(...)
```

Workflow contexts add workflow-local conveniences:

```ts
ctx.runFunction(label, fn)
ctx.done(summary)
ctx.escalate(reason, context?) // local terminal workflow result; no event unless a boundary promotes it
ctx.task
ctx.agent
```

Handler contexts add handler-local conveniences:

```ts
ctx.triggerNow(entryName)
```

These are not separate APIs. They are context-specific handles over the same
infra capabilities.

Default convention:

```
event/timer -> handler -> workflow -> sessions/functions/metrics
```

Handlers bridge events to workflows. They may do deterministic preflight,
normalization, dedup, and skip checks, but they should not encode long prompts,
project logic, or direct agent orchestration. When judgment/action is needed,
dispatch a workflow.

Direct handler logic is reserved for mechanical infra work:

- metric snapshot collection,
- event projection updates,
- cleanup/recovery state repair,
- reload/restart/shutdown,
- dispatch dedup bookkeeping,
- simple skip/no-op checks.

Raw `sdk.runAgent(...)` from a handler should be exceptional. Prefer
`sdk.runWorkflow(...)`, and let the workflow call `ctx.runAgent(...)` so trace,
guards, function steps, and context collection stay consistent.

### 3. Control Client

For CLI, Web UI, Telegram, and other external adapters:

```ts
client.emitEvent(event)
client.subscribe(filter)
client.status()
```

Adapters translate external input/output. They should not know how to run
projects, resume heartbeats, or mutate internal tables.

## SDK Boundary

Yes, the system needs an SDK.

The SDK is the stable facade between infra primitives and agent-owned pattern
code. It prevents handlers/workflows from importing random infra internals and
lets the infra move without breaking agent code.

The SDK should be small. `runAgent` and `runWorkflow` intentionally sit next to
each other because both are execution calls:

```ts
interface InfraSDK {
  emit(event: SystemEventInput): void;

  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;

  metrics: MetricAPI;
  query: QueryAPI;

  message(target: string, content: string, opts?: MessageOpts): void;
  escalate(reason: string, opts?: EscalationOpts): void;

  log(level: "info" | "warn" | "error", message: string): void;

  paths: {
    root: string;
    agents: string;
    persist: string;
  };
}
```

They should share the same option vocabulary where possible: source,
project/session parentage, timeout, request id, and trace metadata. The return
types can differ in detail, but both should answer the same questions:

- what ran,
- what status it ended with,
- what evidence/output it produced,
- where the trace can be inspected.

If the two APIs drift semantically, the model becomes harder to understand.

The same applies to resume:

```ts
resumeSession(sessionId: string, opts?: ResumeOpts): Promise<TaskResult>;
resumeWorkflow(runId: string, opts?: ResumeOpts): Promise<WorkflowResult>;
```

Resume APIs should be designed for diagnostics, not just retry. A caller should
be able to tell whether the work was resumed, requeued, already terminal,
blocked by guard, missing state, or unsafe to continue.

Metric API:

```ts
interface MetricAPI {
  define(def: MetricDefinition): void;
  record(id: string, value: number, opts?: RecordOpts): void;
  alert(id: string, message: string, opts?: AlertOpts): void;
  resolveAlert(alertId: number, reason?: string): void;
  evaluate(id?: string): MetricEvaluationResult[];
  list(filter?: MetricFilter): Metric[];
}
```

Query API:

```ts
interface QueryAPI {
  sql(sql: string, params?: unknown[]): unknown[];
  session(id: string): SessionView | null;
  project(id: string): ProjectView | null;
  metrics(filter?: MetricFilter): MetricView[];
  alerts(filter?: AlertFilter): AlertView[];
  events(filter?: EventFilter): EventView[];
  heartbeatContext(filter: HeartbeatContextFilter): HeartbeatContext;
  closedLoopStewardContext(filter?: ClosedLoopFilter): ClosedLoopContext;
}
```

`getDb()` is a compatibility escape hatch, not the normal read interface for
judgment/context code. A safe query facade gives us bounded reads, schema
validation, fewer guessed columns, and a cleaner mental model.

Current state: the SDK exposes `query` and `metrics` as first-class surfaces,
with targeted helpers for alert triage, closed-loop stewardship, project
runtime context, workflow runs, heartbeat live context, and evaluator
session-review context. New judgment/context code should add targeted query
helpers rather than guessing SQLite schema. Mechanical projection/snapshot
handlers may keep direct DB access when it is simpler and well-tested.

## Ownership

Ownership resolution is an infra utility. Judgment is not.

Infra may answer:

```
who owns this metric/event/project/session?
```

Default convention:

1. explicit event/metric owner,
2. project owner,
3. metric/event id prefix when it matches an agent,
4. `agent:may` fallback.

Infra should not answer:

```
is this alert real?
should it be downgraded?
should this project continue?
was this session valuable?
```

Those require agent judgment.

## Failure Model

The happy path is not enough. Infra should make failure visible, bounded, and
recoverable where possible. It should avoid silent drops.

Failure handling should follow convention over configuration. Every component
gets a default failover path without local wiring:

```
detect failure
  -> preserve durable state if possible
  -> emit failure event with trace/owner
  -> retry/recover when mechanically safe
  -> route to resolved owner
  -> fallback to may
  -> escalate to human only when may cannot safely continue
```

Components may override severity or retry limits only when the default is
provably wrong.

| Failure | Intended response | Signal |
|---|---|---|
| Event bus subscriber throws | Catch subscriber error, continue other subscribers, then emit a durable failure signal. Persistence subscriber should run first. | `subscriber.failed`, `infra.bus.subscriber-failed-count-1h`. |
| Event persistence fails | Do not pretend the event is durable. Emit/log persistence failure sentinel; surface as P0/P1 infra metric. | `infra.persist-failed`, persistence failure metric. |
| Event backlog or slow subscriber | Keep emit path bounded; measure handler/subscriber duration; alert on sustained backlog/latency. | handler duration/backlog metric. |
| Handler throws | Mark handler failed, keep scheduler alive, expose failure in handler metrics. | `handler.failed`, `handler.success-rate`. |
| Workflow step times out | Mark step/session interrupted or error, preserve partial trace, let workflow decide retry/escalate when safe. | workflow step result + session status. |
| Workflow blocked by guard | Preserve completed steps and block reason; emit guard signal; route to owner or next recovery path. | `workflow.blocked`, `guard.triggered`. |
| `resumeWorkflow` sees corrupted/partial state | Inspect durable state first; resume only when lineage and next step are clear. Otherwise return diagnostic status and escalate/requeue rather than replay blindly. | `workflow.resume_failed` with reason. |
| Session resume sees missing/corrupt transcript | Preserve original session id/state; inject recovery context only when safe; otherwise mark interrupted/error with reason. | session status + recovery event. |
| Owner resolution is ambiguous or wrong | Prefer explicit owner, then project owner, then convention, then `may`. If owner is invalid, route to `may` and emit routing anomaly. | `routing.owner_invalid` / metric. |
| Metric source/query fails | Record metric measurement failure without updating value as success; keep last known value distinguishable from fresh measurement. | metric measurement error event/metric. |
| Adapter/socket client disconnects mid-command | Event acceptance is separate from subscriber completion. If event was accepted, trace it; if frame invalid, reject locally. | socket `ok`/`error`, event trace. |

Default failover conventions:

- **Retry** idempotent operations with bounded backoff.
- **Recover** when durable state identifies one safe next action.
- **Requeue** work when the prior execution failed before side effects or has a clear continuation point.
- **Route** failures to the resolved owner by default.
- **Fallback to `may`** when owner resolution fails, owner config is invalid, or the owning agent cannot be started.
- **Escalate to human** only when `may` cannot safely continue, state is corrupt, or replay could duplicate side effects.
- **Drop** only invalid external frames that were never accepted as events.

Every failure path should produce a queryable signal with enough trace context
to answer: what failed, who owned it, what was preserved, and what should happen
next.

## What To Avoid

- Do not add socket commands for every product action.
- Do not make cron a long-term memory store.
- Do not hardcode project/heartbeat behavior into daemon internals.
- Do not expose raw DB writes to agents or adapters.
- Do not create separate routing paths for Telegram, Web UI, and CLI.
- Do not let metrics become targets or automatic decisions.
- Do not grow the SDK into a pattern framework.

## Current Code Mapping

Existing pieces already align with this direction:

| Design concept | Current code |
|---|---|
| Event bus | `src/app/event-bus.ts` |
| Metrics API | `src/lib/metrics.ts` |
| Handler SDK | `src/lib/sdk.ts`, `src/lib/sdk-impl.ts`, `src/lib/handler-context.ts` |
| Agent import boundary | `@may-agent/sdk` package |
| Workflow context | `src/lib/workflow.ts`, `src/lib/workflow-tool.ts` |
| Runtime context | `src/lib/runtime-ctx.ts` |
| Socket protocol | `packages/control/src/protocol.ts` |
| Socket server/client | `packages/control/src/server.ts`, `packages/control/src/client.ts` |
| App entry/runtime | `src/app/may.ts`, `src/app/app-runtime.ts`, `src/app/runtime-exit-modes.ts` |
| Daemon surface | `src/app/daemon.ts` stable barrel over daemon submodules |
| Daemon lifecycle | `src/app/daemon-lifecycle.ts` |
| Daemon event subscribers | `src/app/daemon-events.ts` |
| Daemon agent startup | `src/app/daemon-agents.ts` |
| Daemon session startup | `src/app/daemon-sessions.ts` |
| Daemon loops | `src/app/daemon-loops.ts` |
| Agent loading | `src/app/agent-loader.ts`, `src/app/loader/*` |
| Telegram adapter | `src/app/transport/telegram.ts` |
| Telegram transport/reply/outbound helpers | `src/app/transport/telegram-client.ts`, `src/app/transport/telegram-reply-router.ts`, `src/app/transport/telegram-outbound.ts` |
| HTTP/Web API adapter | `src/app/http/server.ts` |
| WebUI source assets | `packages/webui/static/*` generated into project `ui/` directories |
| Agent patterns | agent/project workflows, project docs, heartbeat docs |

The main gap is not a missing grand architecture. The remaining work is keeping
the already-shipped boundaries boring:

- keep execution inspection using the shared result/trace shape consistently,
- keep `getDb()` limited to mechanical infra code and explicit compatibility
  paths,
- avoid further module splits unless a concrete sub-concern changes
  independently or still obscures behavior,
- fold stable behavior into the shorter architecture/manual docs so agents do
  not learn stale patterns.

The live-human Telegram smoke is now covered by runtime evidence and the
`scripts/telegram-reply-smoke.ts` inspector.

## Migration Direction

Keep this incremental.

1. Keep design docs current with implementation so agents do not chase stale
   gaps.
2. Add targeted `query` helpers only when a workflow/handler needs a bounded
   context bundle.
3. Keep `getDb()` for compatibility and mechanical infra work.
4. Make new adapter actions daemon events.
5. Make new judgment/action trigger entries workflow-backed handlers by default.
6. Validate every boundary refactor with one real runtime event and trace.
7. Fold stable behavior into `architecture.md`, `sdk.md`, `events.md`,
   `metrics.md`, `cron.md`, and `../1-principles/work-model.md`.

## Implementation Checklist

See [system-boundary-tracker.md](system-boundary-tracker.md) for the
canonical implementation tracker. Do not create another parallel tracker.

The target principle:

```
Infra moves facts and runs sessions.
Agents interpret facts and evolve patterns.
```
