# Agent Runtime and Infrastructure Boundary

**Design status:** Accepted boundary
**Implementation status:** Neutral runner, shared execution preparation, and
direct Gym adapter implemented; direct/hosted definition and tool loading
convergence is tracked separately.
**Scope:** Separate agent execution from May's durable and autonomous runtime

## Review at a Glance

| Question | Proposal |
|---|---|
| What was wrong? | `SubagentManager` mixed generation with files, SQLite, EventBus, and recovery. |
| What changed? | One infrastructure-neutral runner is wrapped by optional durable sessions. |
| What stays? | EventBus, SQLite projections, session files, recovery, daemon, workflows, and interfaces. |
| How does Gym run? | It calls the same runner directly, without starting autonomous infrastructure. |
| Main safety rule | No duplicated model loop and no `standalone`/`infra` behavior flag. |

The first boundary is enforced in source: `src/lib/agent-runner.ts` imports the
Pi runtime only, and `SubagentManager` constructs every model/tool loop through
that handle. A focused dependency test prevents EventBus, SQLite, persistence,
project, metric, or scheduler imports from entering the runner.

## Decision

An agent must be capable without May's infrastructure.

The agent execution boundary is:

```text
agent definition + prompt/context + tools -> run -> result
```

The agent runner does not import or call May's `EventBus`, SQLite helpers,
session persistence, scheduler, metrics, projects, or task system.

May's infrastructure may wrap the same runner to add durable sessions,
recovery, events, database projections, scheduling, and control surfaces:

```text
event / human input / benchmark scenario
                 |
                 v
        prepare agent input
                 |
                 v
             agent run
                 |
                 v
     persist and publish observations
```

There is one agent implementation. Gym calls it directly. The autonomous May
runtime wraps it. This proposal does not introduce a standalone mode, profile,
or second execution engine.

## Why This Change

The accepted storage design says that infrastructure resolves context before
`agent.run`, then observes and persists the run outside the agent generation
flow. The current implementation does not yet enforce that boundary.

`src/lib/manager.ts` currently combines:

- model and tool execution;
- prompt and tool-policy construction;
- steering and cancellation;
- session directory and transcript writes;
- session registry updates;
- direct SQLite reads and writes;
- May `EventBus` publication;
- restart recovery;
- workflow recovery and evaluation lookups; and
- session queries and parent/child coordination.

As a result, `SubagentManager` can run without the daemon, but it cannot run
without May's persistence infrastructure. The core library also imports an
application-layer event type, which reverses the intended dependency direction.

The problem is not that durable sessions or the event system exist. They are
valuable infrastructure. The problem is that agent capability currently
depends on them.

## Design Principles

1. **Capability is intrinsic; autonomy is composed.** A model, instructions,
   context, and tools are sufficient to run an agent. Infrastructure decides
   when to run it and what to do with its result.
2. **One runner.** Direct, Gym, one-shot, chat, workflow, and autonomous runs
   use the same execution primitive.
3. **No private context API inside generation.** Infrastructure prepares
   context before a run. New information reaches an active agent through its
   ordinary tools or steering.
4. **Observation is not infrastructure coupling.** The runner may expose the
   underlying Pi runtime observations. Callers decide whether to save or route
   them.
5. **Files remain session truth when durability is enabled.** The optional
   session wrapper persists `meta.json` and the transcript incrementally.
   SQLite remains a bounded projection, not agent state.
6. **No behavior rewrite.** Extraction should preserve current prompt, tool,
   finish, compaction, steering, and cancellation semantics before further
   simplification.

## Target Structure

```text
src/lib/agent-runner.ts
  Pure agent execution boundary
  Depends on Pi, model, tools, and caller-supplied hooks

src/lib/session-runtime.ts
  Optional durable-session wrapper
  Owns session ids, transcript files, meta.json, resume, and recovery

src/lib/manager.ts
  Temporary compatibility facade over session-runtime
  Shrinks as callers migrate; does not contain the model loop

src/app/agent-runtime-adapter.ts
  Connects durable session callbacks to EventBus
  Enriches observations with owner, trace, project, and workflow identity

src/app/*
  Existing autonomous runtime, SQLite projections, schedules, loaders,
  transports, HTTP, and operational services
```

These are responsibility boundaries, not a request to create many framework
classes. Prefer small functions and plain interfaces.

## Agent Runner Contract

The exact names may change during implementation, but the public shape should
remain this small:

```ts
export interface AgentRunInput {
  definition: SubagentDefinition;
  prompt: string;
  history?: AgentMessage[];
  systemPrompt?: string;
  tools?: AgentTool[];
  beforeToolCall?: BeforeToolCallHook;
  transformContext?: TransformContext;
  completion?: {
    requireFinish?: boolean;
    outputSchema?: TSchema;
  };
}

export interface AgentRunHandle {
  result: Promise<AgentRunResult>;
  steer(message: AgentMessage): void;
  cancel(): void;
  subscribe(listener: (event: AgentEvent) => void): () => void;
}

export function runAgent(input: AgentRunInput): AgentRunHandle;
```

The runner owns:

- construction of the Pi `Agent`;
- starting and awaiting generation;
- tool execution;
- in-memory message state;
- structured finish validation and result extraction;
- steering and cancellation; and
- caller-supplied compaction and tool-call hooks.

The runner does not own:

- agent discovery or registration;
- filesystem paths or session directories;
- transcript or metadata persistence;
- database access;
- event routing or delivery;
- trace, project, workflow, or task identity;
- restart recovery; or
- scheduling and interfaces.

Prefer exposing Pi's existing agent events rather than inventing a second
runtime event taxonomy. If a small normalized type is necessary, it must
describe only execution facts such as messages and tool calls. It must not
contain May routing, delivery, database, metric, project, or task semantics.

## Durable Session Wrapper

The durable session runtime wraps `runAgent` and owns May's session mechanics:

```ts
export interface SessionRuntimeCallbacks {
  onStarted?(session: SessionSnapshot): void;
  onObservation?(sessionId: string, event: AgentEvent): void;
  onIdle?(session: SessionSnapshot, result: AgentRunResult): void;
  onEnded?(session: SessionSnapshot, result: AgentRunResult): void;
}
```

It may:

- allocate and resolve session ids;
- append messages to `session.jsonl` as they occur;
- update `meta.json` and active markers;
- reconstruct history for resume;
- keep live run handles for steering and cancellation;
- maintain parent/child session mechanics; and
- report lifecycle changes through callbacks.

Incremental transcript persistence is important for crash recovery. It remains
outside the agent runner by subscribing to run observations. The design does
not require waiting until the run ends before saving messages.

The session runtime must not write SQLite. Session files are authoritative.
Database projection belongs to the app adapter and existing event persistence
path.

## Infrastructure Adapter

The app adapter translates session callbacks and runner observations into May
events:

```text
SessionRuntime.onStarted    -> session.start
Agent message observation  -> text / tool lifecycle events
SessionRuntime.onIdle       -> session.idle
SessionRuntime.onEnded      -> session.end
```

The adapter adds infrastructure context that the runner does not need:

- owner;
- trace and causal parent;
- project and workflow identifiers;
- delivery metadata; and
- event source.

`DbWriter` continues to subscribe to the `EventBus` and maintain bounded
SQLite projections. This direction is allowed:

```text
app adapter -> session runtime -> agent runner
     |
     +------> EventBus -> DbWriter -> SQLite
```

This direction is not allowed:

```text
agent runner -> EventBus / DbWriter / SQLite
```

## Context and Steering

Infrastructure prepares the initial task and context before starting a run.
The runner receives ordinary prompt text, message history, instructions, and
tools; it does not fetch May-specific context.

While a run is active:

- human corrections;
- task mutations;
- changed priorities; and
- newly available evidence

reach the agent through steering or an ordinary supplied tool. The app may
query its database to construct that steering message, but the agent runner
does not make that database query.

This preserves agent power: the agent can still investigate through its tools
and can receive live changes without knowing how May stores or routes them.

## Usage Shapes

### Direct or Gym execution

```ts
const run = runAgent({ definition, prompt, tools });
const result = await run.result;
```

No state directory, SQLite database, `EventBus`, cron loop, or daemon is
created. The benchmark evaluates the same result and transcript shape used by
the autonomous runtime.

### Durable one-shot execution

```ts
const sessionId = sessions.run(definition, prompt);
const result = await sessions.waitFor(sessionId);
```

The transcript and session metadata are persisted, but scheduling and the full
daemon are unnecessary.

### Autonomous app execution

```text
event -> resolve owner and context -> sessions.run(...)
      -> session callbacks -> EventBus -> projections/notifications
```

No autonomous behavior runs merely because an agent is loaded. An agent waits
until a human, test, workflow, timer, or event starts or steers a run.

## Migration Plan

Each phase should be independently reviewable and keep the existing runtime
working.

### Phase 1: Characterize current behavior

Add focused tests around the current execution behavior before moving code:

- prompt and system-prompt assembly;
- tool selection and read-only policy;
- structured and prose completion;
- message observations;
- steering and cancellation;
- timeout behavior; and
- compaction behavior.

Do not change event or persistence behavior in this phase.

### Phase 2: Extract the runner

Move Pi `Agent` construction and bounded execution into `agent-runner.ts`.
`SubagentManager` calls the new runner but otherwise behaves as before.

This phase should be primarily a code move with parity tests. It must not add a
second code path based on an `infra`, `standalone`, or `profile` flag.

### Phase 3: Extract durable session mechanics

Move transcript writes, `meta.json`, active markers, resume, and live session
handles into `session-runtime.ts`. Keep `SubagentManager` as a compatibility
facade so callers can migrate gradually.

### Phase 4: Move EventBus translation outward

Replace the manager's `EventBus` dependency with plain session callbacks.
Create the app adapter and verify that it emits the same lifecycle and tool
events with the same trace relationships.

At the end of this phase, no file in the runner or session runtime imports
`src/app/event-bus.ts`.

### Phase 5: Remove direct database access

Move manager database reads to the app/query services that request them. Remove
direct session-row writes and rely on the event-to-projection path. Where a
recovery operation needs durable metadata, read authoritative session files.

At the end of this phase, neither the runner nor session runtime imports
`requests.ts`, `db/*`, `DbWriter`, or a SQLite type.

### Phase 6: Use the direct runner in Gym

Make Gym's agent execution adapter call the exported runner directly. Keep a
separate Gym scenario option for durable-session integration tests only when a
scenario explicitly needs persistence or recovery.

### Phase 7: Remove compatibility residue

After callers migrate:

- rename or reduce `SubagentManager` to a thin exported alias/facade;
- delete obsolete manager event-bridging and database code;
- remove stale compatibility imports; and
- update README and runtime documentation.

Do not combine this cleanup with workflow, task-tree, HTTP, or scheduler
redesign.

## Acceptance Criteria

The boundary is complete only when all of the following are true:

1. A test agent can produce a result without a state directory.
2. Direct execution creates no SQLite database or session files.
3. The agent runner has no imports from `src/app`, `persistence.ts`,
   `requests.ts`, `db/*`, or the project/task SDK.
4. The durable wrapper uses the same runner; no generation logic is duplicated.
5. Direct and durable runs given the same deterministic model, prompt, and
   tools produce the same messages and terminal result.
6. Durable execution still persists messages incrementally and can recover an
   interrupted session.
7. Event-wrapped execution preserves session, tool, trace, parent, workflow,
   and project observability.
8. Task mutation reaches a live run through steering.
9. Existing chat, workflow, one-shot, cancellation, and restart tests pass.
10. An automated import-boundary test prevents core-to-infrastructure imports
    from returning.

## Import Boundary Enforcement

Add a small test or lint rule rather than relying on convention:

```text
agent-runner.ts may import:
  Pi packages, agent types, result helpers, neutral hooks

agent-runner.ts may not import:
  src/app/**, persistence, requests, db, metrics, projects, task trees

session-runtime.ts may additionally import:
  persistence and filesystem session helpers

session-runtime.ts may not import:
  EventBus, DbWriter, SQLite, scheduler, HTTP, projects, task trees
```

## Non-Goals

- Removing the `EventBus` from May's autonomous runtime.
- Removing durable sessions or crash recovery.
- Replacing filesystem session truth with in-memory state.
- Adding an agent profile or standalone runtime mode.
- Rewriting Pi or maintaining a May-specific model loop.
- Changing prompts, agent identities, tools, workflows, or task semantics.
- Splitting the repository into new packages before the boundary is proven.
- Refactoring the HTTP server, task tree, or workflow engine in the same change.

## Rejected Alternatives

### Make `EventBus` optional in the existing manager

This is the current shape. It permits operation without event delivery but
still requires persistence and database behavior. Optional coupling remains
coupling.

### Rename `EventBus` to `EventSink`

Injecting the same May event contract under a generic name does not separate
agent execution from infrastructure. Only neutral run observations belong at
the runner boundary.

### Add `standalone: true`

A flag creates two behaviors inside one large manager and makes every future
feature decide whether infrastructure is available. Composition gives a
smaller and more testable boundary.

### Create a second lightweight runner for Gym

That would allow benchmark behavior to diverge from production. Gym must test
the same runner that the autonomous runtime uses.

### Persist only after completion

This weakens crash recovery. The durable wrapper should subscribe and append
messages during execution without putting persistence inside the runner.

## Review Questions

Reviewers should focus on these decisions:

1. Is model/tool execution the correct smallest reusable boundary?
2. Are any proposed runner inputs actually infrastructure concepts that should
   be prepared outside it?
3. Are session files sufficient for authoritative recovery after direct DB
   access is removed from the session runtime?
4. Does the callback boundary preserve all required observability without
   recreating an event bus in the core?
5. Can current chat and workflow behavior use the same runner without adding
   modes or duplicated execution paths?
6. Does the migration sequence keep every commit deployable and reversible?

Approval of this proposal authorizes boundary extraction and migration only.
It does not authorize unrelated subsystem rewrites.
