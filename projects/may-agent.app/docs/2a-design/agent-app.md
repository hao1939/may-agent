# Agent App Contract

**Design status:** Accepted.
**Implementation status:** Implemented.

An Agent App packages one accountable owner, optional supporting agents,
domain context, and optional autonomous hosting. The app organizes capability;
it does not implement a second agent runtime or scheduler.

```text
Agent      = independently runnable capability and judgment
Workflow   = reusable process owned by one agent
Agent App  = owner + supporting agents + domain organization
Task       = optional durable desired and observed work state
Host       = optional events, schedules, watchers, tasks, persistence, recovery
```

The public unit is the app. The execution unit remains an agent.

See [Projects](projects.md) for durable project posture,
[Task Resource Engine](task-resource-engine.md) for optional task autonomy, and
[Workflows](workflows.md) for reusable process ownership.

## Package layout

```text
projects/<id>.app/
  app.ts
  project.json
  agents/
    <agent>/
      agent.json
      AGENTS.md
      workflows/
  watchers/             # optional autonomous observation
  tasks/seed.json       # optional boot-only task desired state
  .state/               # runtime-owned state
```

Workflows live under the agent that owns the experience. New code does not
discover app-root workflow registries or owner-entry wrappers.

## Manifest

Only identity and ownership are fundamental. Hosting attachments are optional:

```ts
type ProjectApp = {
  id: string;
  version: 1;
  owner: string;
  description: string;

  workspace?: {
    kind: "git" | "local";
    repo?: string;
    localPath: string;
    branch?: string;
  };

  budget?: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };

  schedules?: ScheduleDeclaration[];
  tasks?: TaskAttachment;
  events?: EventSelector[];
  actions?: Record<string, AppAction>;
  onEvent?: AppObservationHandler;
};
```

An app without tasks installs no task controller, task recovery, or task
resync. An app without schedules installs no Cron entries. Direct and Gym
execution load only the requested agent preparation; they do not attach the
autonomous host.

App IDs and owner-agent IDs are independent. Existing mappings remain valid;
same-name identity is not required.

## Ownership boundaries

| Component                           | Owns                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `app.ts`                            | App identity, owner, optional workspace/budget, event correlation, schedules, actions, and deterministic observations. |
| `project.json` and domain artifacts | Durable goal, posture, strategy, and domain context.                                                                   |
| Agent                               | Identity, instructions, skills, tool policy, private context, judgment, and learned workflows.                         |
| Workflow                            | How one known repeatable process is performed and verified.                                                            |
| Watcher                             | Polling/replay of an external level and emission of semantic observations.                                             |
| Autonomous host                     | Event delivery, schedules, queues, attempts, concurrency, persistence, recovery, metrics, and interfaces.              |
| Task runtime                        | Canonical task/Condition mutation, claims, result admission, receipts, and projections.                                |

Agents and workflows do not edit task storage directly. Infrastructure does
not decide app strategy or domain meaning.

## Shared agent execution

Direct, Gym, session, workflow, and autonomous execution use the same prepared
agent definition and model/tool loop:

```text
model + prompt + context + supplied tools
  -> agent run
  -> result + neutral execution notifications
```

The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or
recovery. Infrastructure may wrap the same run to persist transcripts, emit
events, enforce timeouts, or collect evaluation evidence. A supplied tool may
use a database or remote service behind its explicit capability interface.

## Task correlation

When tasks are attached, the app declares one correlation surface:

```ts
tasks: {
  accepts: EventSelector[];
  resolve(event): ProjectAppTaskIntent | null;
  resyncIntervalMs?: number;
}
```

`tasks.accepts` selects untargeted semantic events that may declare or revise
desired task state. `tasks.resolve` returns one stable task intent or `null`.
It is pure and cheap: it identifies work but does not execute it or mutate
storage.

Targeted task wakes, Condition observations, recovery, and passive resync do
not need app-specific routes. They enqueue stable IDs into the same app
controller. The queue never carries copied task specs.

## Handler convention

Task ownership resolves from the task, nearest explicit ancestor, then app
owner. The resolved owner must be a runnable agent.

```text
task.workflow present
  -> resolve agents/<owner>/workflows/<workflow>.ts

task.workflow absent
  -> run the resolved owner directly
```

A workflow may return `needs-owner`; the runtime then hands the same task to
that owner once. An unavailable named workflow records `HandlerUnavailable`
before sequential owner fallback. It is not silently treated as an originally
unbound task.

The exact result, Condition, acceptance, attempt, and completion contracts are
owned by [Task Resource Engine](task-resource-engine.md), not repeated here.

## Events, actions, schedules, and watchers

`events` selects deterministic app-level observations for `onEvent`. This path
may update a read model or translate a signal; it does not execute project work
or bypass task admission.

The host handles `project.action.invoked` once by resolving the named action,
validating parameters, calling its event factory, and emitting the returned
semantic event. Apps do not redispatch that envelope in `onEvent`.

Schedules emit semantic events. Cron owns time; it does not own task
reconciliation.

A watcher owns an external provider level:

```text
provider state -> watcher -> semantic event -> app/Condition correlation
```

It may poll, retry, and replay current external state. It does not invoke an
agent, know task IDs, or mutate task storage.

## Workspace and paths

The workspace binding names the portable domain project. Infrastructure
resolves agent, app, domain, and execution paths before a run. Handlers use
those resolved paths instead of deriving one root from another or relying on
the process working directory.

Task output admission permits only declared app/domain roots. Tool policy and
process isolation remain responsible for actual filesystem enforcement.

## State and lifecycle

For apps with tasks:

- `.state/tasks/state.json` is the sole mutable task authority;
- `.state/tasks/tree.json` is a generated disposable read projection; and
- `tasks/seed.json` initializes an empty runtime once.

When `project_lifecycle` is `paused`, the host installs no schedules,
controller, task event routing, recovery, or resync for that app. Pause and
resume are explicit journaled control operations, not conclusions inferred
from the amount of open work.

## Integrity invariants

1. Loading an app package does not itself start model work.
2. Direct and Gym execution do not require autonomous infrastructure.
3. One app has one current root owner and optional supporting agents.
4. Every workflow belongs to one agent and runs with that agent's preparation.
5. Tasks, schedules, watchers, events, actions, and budgets are optional host
   attachments.
6. Each task-enabled app has one resolver, one controller, and one
   deduplicating key queue.
7. Selectors cannot route one project's event into another app.
8. Actions translate once, and inbox work is acknowledged only after accepted
   handling.
9. App loading is atomic: a failed reload leaves the previous installation
   active.
10. Read projections never become mutation authority.

Focused tests cover owner-only loading, hosted/direct preparation parity,
scoped selectors, action translation, concurrency, restart recovery,
Condition wakeup, receipt wakeup, and workflow-to-owner fallback.
