# Project App V2

## Status

Historical proposal for embedded `projects/<name>/.app/` apps. V3 is now the
target design for portable domain projects such as `aks-rp-e2e`; use
`project-app-v3.md` as the source of truth for sibling `*.app/` project apps.

## Thesis

May-agent is an event runtime. Each project is an event-driven app.

Only the runtime control plane is standardized:

```text
projects/<name>/.app/
```

Everything outside `.app/` is the project's domain workspace. Its layout should
match the project's goal, not a global folder template.

## Goals

- Remove the complex global project brain.
- Make project behavior project-owned.
- Use events as the only activation path.
- Standardize the runtime adapter boundary under `.app/`.
- Use `.app/app.ts` as the app declaration and handler, not `app.yaml`.
- Let domain workspaces be goal-shaped and portable outside May-agent.

## Non-Goals

- Immediate migration of every existing project.
- Forcing one domain folder layout across all projects.
- Removing the shared event bus, session dispatcher, cron scheduler, or HTTP
  runtime.
- Encoding project behavior in static YAML.
- Making the runtime understand AKS, evaluation, platform maintenance, or any
  other project domain.

## Core Model

```text
May-agent runtime = event delivery + schedules + intents + hard safety limits
Project app       = project-specific event handler and behavior
.app/             = May-agent runtime control plane
Domain workspace  = project-owned knowledge, inputs, work, evidence, outputs
```

The runtime routes events. The project app owns meaning.

```text
schedule / comment / metric / UI request
  -> event
  -> project app onEvent()
  -> intents
  -> runtime validates and executes intents
  -> sessions/workflows emit more events
```

State changes should be consequences of events, not polling decisions.

For long-running project work, the project app should use two simple event
loops: a sequential planner loop and parallel worker loops. The app requests
planning by emitting `project.planning.requested`; the planner updates the
task tree and emits `project.task.execution.requested` for dispatchable leaves.
Each worker handles one requested leaf and emits `project.task.completed`.
Completion may wake the planner again. `project.execution.requested` is legacy
terminology; planning is the durable coordinator event.

The agent is the brain. Workflow code should not contain the project strategy,
domain judgment, replan policy, or branch-repair decision tree. Workflow code
only wakes the right agent session, supplies current context, exposes safe
task-tree primitives, and enforces hard invariants such as locking,
dispatchability, lease ownership, and event emission. Task-tree processing code
should be tools for the LLM, not the workflow.

For task-tree apps, the live shape is:

```text
project.planning.requested
  -> thin planner workflow
  -> project-owner agent session
  -> task-tree tools / direct reviewed tree edits
  -> planner workflow dispatches ready leaves

project.task.execution.requested
  -> thin worker workflow claims one ready leaf
  -> task-owned agent session
  -> domain work + task-tree completion tool
  -> worker workflow emits project.task.completed
```

This keeps the reusable code small and auditable. The reusable code answers
"is this task lockable, dispatchable, completed, or stale?" The agent answers
"what should this project do next?"

For task-based projects, `.app/tasks/tree.json` is more than a queue. It is the
project's structured understanding: how the goal is currently decomposed, which
claims have been verified, which branches were replaced, and where work is
actually blocked. It should not become an attempt log. Runtime runs, retries,
planner executions, and transient failures belong in infrastructure history,
workflow runs, `.app/*-runs.jsonl` when useful, and linked evidence artifacts.
If a branch no longer represents the current understanding, mark it
`superseded` with a reason and add replacement work under the right domain
container instead of adding another root-level runtime-shaped task.

Blocked work is still part of that loop. A blocked leaf should trigger a
project-local blocked-review task that decides whether the blocker is real,
stale, too coarse, missing evidence, locally unblockable, unsafe, or genuinely
external. The app should only wait passively after that review confirms no safe
local unblock, split, correction, or evidence-gathering task remains.

The app must not accept `no_work`, "no safe local work", or "waiting" as a
terminal agent answer. Those phrases are ambiguous project state. The handler or
execution workflow should convert them into concrete state: a ready follow-up
task, a blocked task with exact resume condition, a human-question task with one
specific question, or a superseded task linked to its replacement. A project may
pause on a concrete blocked/input frontier; it should not pause on a vague
no-op.

The planner owns task-tree mutation and project reasoning. It reviews completed
task results, verifies claims, repairs or supersedes bad branches, rolls up
parents, creates parent-review or blocked-review tasks when needed, promotes
clear proposed leaves to ready, and emits worker requests up to the allowed
capacity. Planning/replan/review behavior stays serialized. In implementation,
the planner workflow is only the session adapter; the project-owner agent makes
those planning decisions using task-tree tools.

The worker owns only one task execution. It claims exactly one requested leaf
under the task-tree lock, executes that task, writes task-local attempt/result
evidence, releases the lease, and emits `project.task.completed`. The worker
must not reshape the tree, create sibling branches, roll up parents, or emit
planner wake events directly. The app event layer or workflow trigger mapping
turns `project.task.completed` into the next planner wake. In implementation,
the worker workflow is only the lease/session adapter; the task-owned agent
does the work and records completion through a task-tree completion primitive.

Parallel work should use the native event mechanism. The planner emits
`project.task.execution.requested` for each dispatchable ready leaf up to
`max_concurrent`; worker handlers run in parallel when their `conflict_scope`
and output paths do not overlap. Because `.app/tasks/tree.json` remains the
canonical project-local task state, each worker save must merge that worker's
task branch into the latest tree snapshot under a project tree lock.
Parallelism must not allow a later worker save to overwrite another independent
worker's accepted, blocked, or replanned branch.

For aggressive project-push apps, an accepted frontier replan is not itself a
stop condition when it produced child work, those children are now settled, and
the project root remains blocked or rejected. The planner should create the
next frontier replan on the next wake so the agent keeps searching for safe
local/domain work until it reaches a concrete blocked replan, a concrete
human/input question, a satisfied project goal, or an infra guard.

Shared project execution visibility belongs in the platform UI. Any project
that exposes `.app/tasks/tree.json` should be readable through the generic platform
project Kanban and task-tree projection. This makes planning, execution,
review, blocked state, and rollup audit reusable across projects without
copying a Kanban implementation into every domain workspace.

Project-local UI may live under `.app/ui/`, but it should focus on the
project's domain workflow: AKS feature selection and replanning for
`aks-rp-e2e`, platform runtime/read-model operations for `platform`, evaluation
surfaces for evaluator projects, and so on. Project-local UI can link to the
shared Kanban, but the generic task board is not a domain artifact.

For task-based project apps, the shared UI should render `.app/tasks/tree.json` as a
human review surface rather than exposing only raw JSON:

- A Kanban projection for execution state: Backlog, In Progress,
  Review, Blocked, and Done.
- A tree projection for decomposition and rollup audit.
- A current-state banner that says what the project is working on, what is
  ready, what needs review, or which concrete blocked/input frontier is next.

The Kanban board is a projection, not a second source of truth. The execution
engine still owns task mutation and verification. The board should show leaf
workflow cards only: proposed, ready, active, claimed, rejected, blocked,
accepted, or superseded work. `decomposed` parent tasks are structural feature
or rollup nodes, so they stay in the tree projection rather than appearing as
Backlog cards.

Backlog is fed by planning. Frontier replans and domain planners should create
ordinary next-work leaves as `proposed`; the planner promotes clear proposed
leaves to `ready` before dispatch only when `depends_on` is satisfied.
`ready` means dispatchable now. A task waiting for another task stays
`proposed` with `depends_on`; a task waiting on a real external/human/environment
condition stays `blocked` with a concrete `blocker`. Active serialized planners stay in
the Planning lane, not In Progress. In Progress is for ordinary active worker
tasks, where parallel execution is expected when conflict scopes allow it.

For throughput, planners should batch. Frontier replans should create 5-10
proposed ordinary leaves when enough safe local work exists. Domain planners
should create 3-7 proposed leaves for the selected feature-learning loop. If
the safe local frontier is smaller, the planner should create all concrete safe
leaves and record why the batch is smaller. A Kanban page should warn when
Planning is active while Backlog and Ready are both empty, because parallel
execution cannot start until planning produces backlog.

The task tree must still be domain-shaped. For a research or exploration
project, the top-level tree should represent the repeated learning system, not
the latest set of artifacts. In `aks-rp-e2e`, that means a feature-learning
loop: maintain the model, maintain a prioritized feature queue, run the same
reference/input/expectation/evidence/gap/replay/model-update pattern for each
feature, and synthesize cross-feature findings. Recent failures, external blockers,
and bug reports attach inside that loop as evidence or feature-specific work.

In test-driven learning projects, the project-local UI and task tree should
share one test-spec contract. A test spec is reviewable only when it shows:

- scenario and scope;
- a surface-independent spec identity that names product behavior, not the
  current environment or client surface;
- ordered `testLifecycle` from fixture/setup through action, observation, and
  cleanup;
- concrete operations;
- product assertions, not shallow transport facts;
- execution variants for environment/client-surface differences such as
  staging, standalone, REST, CLI, generated client, or source e2e suite when
  they exercise the same product lifecycle and assertions;
- visible environment and user-surface badges so reviewers can scan where a
  spec has evidence and through which surface it was exercised;
- a test-case matrix when repeated parameter or negative-validation cases share
  the same lifecycle and assertion pattern;
- execution strategy, dependencies, live-run context, and forbidden surfaces;
- run artifacts and evidence with duplicate references removed;
- non-goals for adjacent behavior.

The project-local UI should render that contract as the normal test-spec card.
The task tree should use it as acceptance criteria. Missing lifecycle, weak
assertions, duplicate artifacts, or mixed adjacent scenarios become ordinary
domain tasks under the affected feature, not hidden UI bugs and not new
top-level project-control branches.

For `aks-rp-e2e`, the feature queue is an execution conveyor. When one selected
feature is accepted or externally blocked, the project app should return to the
queue and schedule the next safe local feature before deciding the project is
blocked. A rollup review can close the current batch, but it must not freeze the
project while `evidence/archive/feature-learning-queue.md` still lists safe
local feature-learning work.

`platform` is the second adoption project. It proves that the v2 layout is not
AKS-specific: `.app/` holds runtime control-plane files, `.app/tasks/tree.json`
holds shared execution state, root `project.md` remains the obvious project
goal, and the domain workspace keeps the code repo, proposals, outputs, and
served UI artifacts. Platform also owns the shared Project Kanban API/UI so
other projects can reuse task-tree visibility without losing their own
domain-specific `/ui` surfaces.

## Runtime Control Plane

The proposed standard runtime boundary is:

```text
projects/<name>/
  .app/
    app.ts              # required: app declaration and event handler
    project.md          # required: human-readable goal, state, plan, blockers
    tasks/              # optional: project task tree and task UI state
    discussion.jsonl    # optional: append-only project comment stream
    journal.jsonl       # optional: append-only app-local workflow trace
    archive/            # optional: retired runtime files kept for audit only
    agents/             # optional project-local agents
    workflows/          # optional project-local workflows
    workflows/lib/       # optional safe tool primitives for workflows/agents
    scripts/             # optional app-local CLI tools for agent sessions
    handlers/           # optional helper modules for app.ts
    ui/                 # optional project-local runtime UI assets
```

`.app/` contains May-agent coupling. It should be possible to understand the
domain workspace without reading `.app/`.

The files currently named `project.md`, `discussion.md`, `journal.md`, project
local agents, and project workflows are runtime control-plane files. In the v2
model they move under `.app/`; live discussion and journal streams become JSONL
instead of Markdown.

Do not add `.app/events/` or `.app/runs/`. May-agent infrastructure owns event,
run, session, and intent observability. A project app may keep a compact local
journal when it helps its own handler reason, but that journal is not the source
of truth for runtime delivery.

## Control-Plane State Files

`.app/project.md` is intentionally Markdown. It is the prominent, readable
project frame: goal, current state, plan, blockers, next action, and links into
the domain workspace. Agents should be able to open one file and understand why
the project exists and what state it is in.

`.app/discussion.jsonl` and `.app/journal.jsonl` are intentionally JSONL. They
are append-only streams that are easier for handlers, UIs, and LLM tools to
parse without brittle Markdown markers.

Recommended discussion records:

```jsonl
{"id":"c_20260530_001","ts":"2026-05-30T04:00:00Z","author":"human","kind":"comment","text":"Run the selected replan when auth is ready.","source":"may-ui"}
{"id":"c_20260530_002","ts":"2026-05-30T04:10:00Z","author":"aks-explorer","kind":"reply","text":"Blocked: Azure CLI unavailable in workspace.","refs":["evidence/archive/iteration190-live-selected-two-path-blocker.md"]}
```

Recommended journal records:

```jsonl
{"ts":"2026-05-30T04:05:00Z","iteration":190,"actor":"aks-explorer","kind":"step","status":"started","summary":"Processing two-path ManagedSystem live-run request."}
{"ts":"2026-05-30T04:07:00Z","iteration":190,"actor":"aks-explorer","kind":"result","status":"blocked","summary":"ARM token precondition failed because az is unavailable.","refs":["evidence/archive/iteration190-live-selected-two-path-blocker.md"]}
{"ts":"2026-05-30T04:08:00Z","iteration":190,"actor":"workflow","kind":"discussion_ack","through":"c_20260530_001"}
```

Acknowledgement is a journal record, not a mutation of discussion. This keeps
human comments immutable and lets the app decide what has been processed.

For `project.comment.created`, the HTTP/runtime layer emits the event; the
project app decides whether to append the comment into `.app/discussion.jsonl`
and what session, workflow, or no-op should follow. That preserves the
event-first model without requiring a global project comment handler to know the
project's file layout.

## Domain Workspace

Only `.app/` is standardized. The domain workspace is intentionally flexible.

Every project should have a root `README.md` or `index.md` that explains its
domain layout, but the runtime must not require specific domain folders.

For projects that produce executable knowledge, the domain workspace should
make the product chain visible. In `aks-rp-e2e`, the reusable chain is:

```text
source anchor -> feature -> spec -> suite -> replay -> run -> model update
```

This is not a global folder mandate. It is an example of the domain layout
following the project goal: learn AKS behavior contracts, generate runnable
tests, execute them, diagnose results, and update the model.

Recommended generic roles:

| Role             | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| Domain identity  | Stable project goal, scope, non-goals, success criteria          |
| Current truth    | Latest conclusions, frontier, blockers, and next domain question |
| Sources / inputs | Requirements, external references, datasets, specs, examples     |
| Domain model     | Structured representation of the project domain                  |
| Work area        | Active investigations, drafts, replays, experiments              |
| Evidence         | Raw logs, traces, captures, generated run output                 |
| Outputs          | Accepted deliverables and polished results                       |
| Decisions        | Durable commitments, no-rerun decisions, ADR-style records       |
| Reviews          | Human or agent critique, audits, challenge findings              |

Those roles can map to different folder names per project. A research project,
execution project, product project, and evaluation project should not be forced
into the same tree.

## app.ts

Use `.app/app.ts`, not `app.yaml`.

Rationale:

- One source of truth.
- Type checking.
- No config/implementation drift.
- Can reuse helpers and SDK types.
- Can be tested as a module.
- Complex project behavior can stay in code instead of a second declarative
  language.

`app.ts` must be side-effect free at import time. Runtime discovery should be
able to import every app safely.

Allowed at top level:

- Static imports.
- Pure helper definitions.
- `defineProjectApp(...)`.

Not allowed at top level:

- Filesystem mutation.
- Network calls.
- Cloud commands.
- Session dispatch.
- Long computation.

Real work happens inside `onEvent`, workflows, or helper functions called from
those entry points.

Example:

```ts
import { defineProjectApp } from "@may-agent/sdk/project-app";

export default defineProjectApp({
  id: "aks-rp-e2e",

  schedules: [
    {
      id: "learning",
      cron: "0 * * * *",
      event: {
        type: "project.tick",
        source: "timer",
        owner: "agent:aks-explorer",
        data: { project: "aks-rp-e2e", lane: "learning" },
      },
    },
  ],

  events: [
    "project.tick",
    "project.comment.created",
    "metric.recovered",
    "coverage.gap.detected",
    "project.action.requested",
  ],

  async onEvent(ctx, event) {
    if (event.type === "project.comment.created") {
      return ctx.startSession({
        agent: "aks-explorer",
        task: "Handle the new project comment and update project state.",
      });
    }

    if (event.type === "project.tick" && event.data.lane === "learning") {
      return ctx.startSession({
        agent: "aks-explorer",
        task: "Run the regular learning lane.",
      });
    }

    if (
      event.type === "project.action.requested" &&
      event.data.action === "replan"
    ) {
      return ctx.startSession({
        agent: "aks-explorer",
        task: "Handle the replan request from the project UI and write evidence.",
      });
    }

    return ctx.noop("event not relevant");
  },
});
```

## Intent Model

Project apps should return intents. The runtime validates and executes them.

Examples:

```ts
return [
  { type: "start-session", agent: "may", task: "Review current evidence." },
  {
    type: "emit",
    event: {
      type: "coverage.gap.detected",
      source: "agent:aks-explorer",
      owner: "agent:aks-explorer",
      data: { project: "aks-rp-e2e" },
    },
  },
  { type: "write-app-state", patch: { lastTick: Date.now() } },
  { type: "noop", reason: "event not relevant to this project app" },
];
```

The runtime may reject intents that violate hard limits, safety rules, or
capability boundaries.

Project UI requests follow the same containment rule as timer, comment, and
metric events. The browser can request behavior by emitting an event; the app
turns that event into validated intents. Read-only domain computations should
usually be published as artifacts or explicit view models instead of hidden
HTTP function calls.

Project code should use runtime path helpers instead of raw relative paths:

```ts
ctx.projectPath("model/tools/replan-feature-paths.ts"); // domain workspace
ctx.appPath("journal.jsonl"); // .app/ control plane
```

## Runtime Responsibilities

The runtime is a small project-app runner, not a global project brain.

It should:

1. Discover `projects/*/.app/app.ts`.
2. Import and validate each app declaration.
3. Register schedules and event subscriptions.
4. Deliver matching events to app handlers.
5. Execute validated intents.
6. Enforce hard global limits: concurrency, budgets, kill switches, auth and
   mutation limits.
7. Record generic event/session/intent observability.
8. Serve project files, project UI assets, and HTTP event ingress.

It should not:

- Interpret project domain state.
- Decide what progress means.
- Replan project-specific work.
- Know project-specific task semantics.
- Encode AKS/evaluator/platform-specific logic.
- Maintain a central set of project lifecycle special cases.

## Status And State

Project domain status may still exist, but it is app-owned state. A project app
should expose its readable status in `.app/project.md`; it may additionally use
`.app/state.json` only when it needs compact machine-owned scratch state.

Common domain statuses can remain useful:

```text
active
waiting
blocked
paused
closed
```

The runtime should not become a second interpreter of project domain status.
Runtime containment state is separate and named `lifecycle`, not `status`.
The runtime may apply universal containment rules to `lifecycle`, such as not
delivering scheduled ticks to closed apps unless the app explicitly opts into
reopen events.

Do not use domain `status: closed` for a project that still has reviewable
blocked work. Use `active` with blocked task-tree frontier, or `blocked` if the
UI needs a prominent label. Reserve `closed` for an intentional terminal
administrative state.

## Comments, Metrics, And UI Requests

Comments, metric events, timer ticks, and project UI requests all become events.

Examples:

```text
project.comment.created
project.tick
metric.breach
metric.recovered
project.action.requested
coverage.gap.detected
```

The project app decides how to handle each delivered event. If a comment should
wake an owner session, that behavior lives in `.app/app.ts`. If a metric should
be ignored while an external blocker is unresolved, that decision also lives in
`.app/app.ts`.

Event subscriptions should use selectors, not only event-type strings, when the
event type can fan out broadly:

```ts
events: [
  { type: "project.comment.created", project: "aks-rp-e2e" },
  {
    type: "project.action.requested",
    project: "aks-rp-e2e",
    actionNames: ["execute-run"],
  },
  { type: "metric.recovered", metricIds: ["aks-rp-e2e.frontier-ready"] },
  { type: "coverage.gap.detected", project: "aks-rp-e2e" },
];
```

String subscriptions remain shorthand for project-scoped events generated by the
app's own schedules.

## Project-Local Agents

Project-local agents move under `.app/agents/`:

```text
projects/<name>/
  .app/
    agents/
      <agent>/
        agent.json
        AGENTS.md
        heartbeat.md
        workspace/
```

The runtime discovers them as app-local capabilities. Their coding root should
remain the containing project root so they can work with the domain workspace,
while their agent identity and runtime files stay under `.app/`.

## Goal-Shaped Layout Example: aks-rp-e2e

`aks-rp-e2e` is not a generic note-taking project. Its domain is:

- AKS input space.
- Expected behavior space.
- Handwritten e2e coverage.
- Evidence from staging/standalone runs.
- Replay design and execution.
- Replanning for higher-density coverage.
- Coverage model and generated views.

A goal-shaped layout is:

```text
projects/aks-rp-e2e/
  README.md
  project.md

  model/
    knowledge-map/
    tools/

  features/
    managedsystem-pool.yaml
    ...

  specs/
    managedsystem-rest-add-existing.json
    ...

  suites/
    managedsystem-add-immutability-delete-combined.yaml
    ...

  replays/
    lib/
    managedsystem-rest-add-existing.ts
    vpa-upgrade-survival-runtime.ts
    ...

  runs/
    index.jsonl
    executions/
    requests/
    model-update-proposals/

  evidence/
    archive/

  reports/
    current.md
    ...

  decisions/
    domain-workspace-v3.md
    ui/

  .app/
    app.ts
    project.md
    tasks/tree.json
    discussion.jsonl
    journal.jsonl
    archive/
    decisions/replans/
    agents/aks-explorer/
    runner/
    ui/
    workflows/
```

Possible migration from the current layout:

| Current                                     | V2 role                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `project.md`                                | `.app/project.md`                                                              |
| `discussion.md`                             | `.app/archive/discussion.md`; live stream continues in `.app/discussion.jsonl` |
| `journal.md`                                | `.app/archive/journal.md`; live trace continues in `.app/journal.jsonl`        |
| `journal.raw.md`                            | `.app/archive/journal.raw.md`                                                  |
| `agents/`                                   | `.app/agents/`                                                                 |
| `workflows/`                                | `.app/workflows/`                                                              |
| `knowledge-map/`                            | `model/`                                                                       |
| `capability-model/`                         | `model/tools/`                                                                 |
| project task breakdowns                     | `.app/tasks/tree.json` and `.app/tasks/README.md`                              |
| `sources/feature-packets/`                  | `features/`                                                                    |
| `scenarios/test-specs/`                     | `specs/`                                                                       |
| `scenarios/run-plans/`                      | `suites/`                                                                      |
| `probes/`, `probe-lib/`                     | `replays/`                                                                     |
| `scenarios/execution/`                      | `replays/execution/`                                                           |
| `evidence/test-runs/`                       | `runs/`                                                                        |
| `outputs/*.json`, raw logs                  | `evidence/archive/`                                                            |
| polished `outputs/*.md` summaries           | `reports/`                                                                     |
| durable domain decisions/status commitments | `decisions/`                                                                   |
| execution replans                           | `.app/decisions/replans/`                                                      |
| May UI integration                          | `.app/ui/` if runtime UI, or `model/views/` if domain viewer                   |

The exact tree should be chosen by the project owner. The important rules are
that AKS domain knowledge is not hidden inside May-agent runtime files, and
May-agent execution state is not mixed into the domain product.

## Migration Plan

### Phase 0: Do not add an HTTP action bridge

Do not add a generic `/api/projects/action` bridge. A hardcoded HTTP action
registry puts project-domain execution inside the runtime adapter and bypasses
the event-first model.

Project UI activation should use canonical event ingress:

```text
POST /api/events
```

with `type: "project.action.requested"` and the project-specific request under
`data`.

When the UI is intentionally waking an already-defined project workflow rather
than asking the project app to interpret a domain action, it may emit that typed
workflow event directly. Example: the `aks-rp-e2e` feature page's Trigger Test
button emits `project.planning.requested` with `reason:
"feature-test.requested"` and the exact spec/target under `data.params`. It
must not create a discussion entry as a hidden transport fallback.

Human task-tree steering follows the same rule. A Kanban/task-tree feedback box
should emit `project.planning.requested` directly with `reason:
"human-steering"` and structured task context under `data.params` when crossing
`/api/events`:

```json
{
  "type": "project.planning.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "urgency": "high",
  "data": {
    "project": "aks-rp-e2e",
    "reason": "human-steering",
    "action": "task-feedback",
    "params": {
      "task_id": "project",
      "comment": "Reflect on this branch and add missing Go-test discovery work.",
      "context": {
        "ui": "kanban"
      }
    }
  }
}
```

Top-level `project`, `reason`, or `params` are not enough for HTTP ingress:
they may be accepted by the HTTP route but lost from the durable event payload.
Use `urgency: "high"` for explicit human steering so it is not delayed behind
routine scheduler/watchdog wakes.

Do not wrap explicit planner steering in `project.comment.created` or
`project.task.steer`. Those events may remain compatibility/audit aliases, but
the canonical control event is `project.planning.requested`.

### Phase 1: Runtime support

1. Add `defineProjectApp` and `standardProjectApp` to `@may-agent/sdk`.
2. Add project-app runner to the daemon: discover `projects/*/.app/app.ts`,
   import, validate, register schedules and event subscriptions.
3. Add `POST /api/events` as canonical HTTP event ingress.
4. Add intent validation and execution.
5. Add budget tracking to runtime observability. Do not mirror event/run/session
   history into per-project `.app/events/` or `.app/runs/` folders.

### Phase 2: Exemplar migration

6. Migrate `aks-rp-e2e` as the first project-app:
   - Create `.app/app.ts` with schedules and event handlers for comments,
     timer ticks, replan requests, and execution requests.
   - Move runtime files (`project.md`, `agents/`, `workflows/`) into `.app/`.
   - Move task-tree state into `.app/tasks/`.
   - Archive legacy Markdown streams under `.app/archive/` and create live
     `.app/discussion.jsonl` and `.app/journal.jsonl` streams.
   - Reshape domain workspace around goal (model/, features/, specs/, suites/,
     replays/, runs/, evidence/archive/, reports/, decisions/).
   - Move `ui/` into `.app/ui/`.
7. Add tests that import `.app/app.ts` and validate side-effect-free declarations.

### Phase 3: Prove it

8. Run `aks-rp-e2e` as a project-app for at least 2 weeks.
9. Validate: UI requests become events, scheduled ticks fire, budget enforces,
   comments route correctly, domain workspace is understandable without `.app/`.
10. Fix gaps discovered during the proving period.
11. Only after the exemplar is solid: consider migrating other projects.
12. Keep legacy reconciler indefinitely as the default — it works for simple
    projects that don't need app-level behavior.

## Budget Declaration

The app declaration should include resource limits. The runtime enforces these
without understanding why the project chose them.

```ts
export default defineProjectApp({
  id: "aks-rp-e2e",
  budget: {
    sessionsPerDay: 10,
    tokensPerDay: 500_000,
    maxConcurrent: 2,
  },
  // ...
});
```

When budget is exhausted, the runtime stops delivering scheduled ticks and
rejects `start-session` intents. Comment events still deliver (so a human can
override or increase the budget).

## Intent Contract

`onEvent` always returns an array of intents. The runtime validates and executes
them in order.

```ts
async onEvent(ctx: ProjectAppContext, event: EventEnvelope): Promise<Intent[]>
```

V1 intent types:

| Intent            | Meaning                                          |
| ----------------- | ------------------------------------------------ |
| `start-session`   | Launch an agent session with a task              |
| `emit`            | Emit an event into the bus                       |
| `write-app-state` | Patch `.app/state.json`                          |
| `noop`            | Explicit no-op with a reason (for observability) |

Future intent types (not v1):

| Intent           | Meaning                                    |
| ---------------- | ------------------------------------------ |
| `start-workflow` | Launch a named workflow                    |
| `schedule-once`  | Schedule a one-shot event at a future time |
| `escalate`       | Signal to human/operator                   |

The runtime may reject intents that violate budget, safety rules, or capability
boundaries. Rejected intents are logged with the rejection reason.

## UI Integration

Project-specific UI lives under `.app/ui/`:

```text
.app/
  ui/
    index.html          # project panel served at /projects/<name>/ui/
    kanban/
      index.html        # task tree / progress / steering page
    quality-panel.js    # domain-specific visualization
    styles.css          # optional
```

The runtime serves `.app/ui/` statically at `/projects/<name>/ui/`. The UI calls
read-model endpoints or project artifacts for state. For side-effecting behavior
it emits canonical events through `/api/events`; no project-specific API
endpoints are needed.

If the HTTP adapter serves project-root static files, keep a root `ui` symlink
to `.app/ui`. That preserves the readable public path while keeping runtime UI
source under the `.app` control plane.

Example UI request:

```json
{
  "type": "project.action.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "data": {
    "projectPath": "projects/aks-rp-e2e",
    "action": "replan",
    "params": {
      "selectedPathIds": ["path.managedsystem.rest-add-existing.minimal-rest"]
    }
  }
}
```

The runtime imports the app and delivers matching events. The app decides
whether the request should start a session, run a workflow, update app state, or
noop.

## Event Delivery Rules

The runtime delivers ALL events to matching apps. The app decides to noop.

Universal runtime rules (not app-owned):

1. **Budget enforcement** — don't execute `start-session` intents past budget.
2. **Closed app containment** — deliver comment/nudge events to closed apps
   (they may reopen), but do NOT deliver scheduled ticks unless the app
   explicitly declares `tickWhenClosed: true`.
3. **Concurrency cap** — don't start sessions past `maxConcurrent`.

Everything else is app logic. "Should a metric breach reopen this project?" is
a question only the app can answer.

## Standard App Helper

Most projects need the same basic behavior: comments launch an owner session,
ticks drive work, metrics trigger review. Provide a `standardProjectApp()`
compatibility helper that expands to ordinary app declarations and visible
handlers:

```ts
import { standardProjectApp } from "@may-agent/sdk/project-app";

export default standardProjectApp({
  id: "platform",
  policy: "stable-watch",
  budget: { sessionsPerDay: 5, tokensPerDay: 300_000 },

  // Override only what's different from defaults
  onComment(ctx, comment) {
    // Custom: route to tech-lead instead of project owner
    return ctx.startSession({ agent: "tech-lead", task: comment.text });
  },

  // Default onTick, onMetric, onNudge behavior inherited
});
```

This prevents every project from re-implementing "comment → launch owner" and
allows simple projects to migrate with ~5 lines of `app.ts`. It must not hide
new lifecycle semantics in the runtime; it is an SDK convenience for project
apps that choose the old behavior explicitly.

## Optional App State Scratchpad

The minimal design does not require `.app/state.json`. Prefer `.app/app.ts` for
behavior, `.app/project.md` for readable project state, and runtime
infrastructure for event/run/session records.

If an app truly needs small machine-owned scratch state that is neither human
project state nor infra observability, it may use `.app/state.json` with a
standardized envelope:

```json
{
  "_runtime": {
    "lifecycle": "active",
    "lastEvent": "2026-05-30T10:00:00Z",
    "budget": { "sessionsToday": 3, "tokensToday": 120000 }
  },
  "app": {
    // App-owned state — opaque to runtime
  }
}
```

The `_runtime` key is written by the runtime when this optional file exists
(budget counters, last delivered event timestamp). The `app` key is written by
`write-app-state` intents. The runtime never reads or interprets `app`.

`.app/project.md` remains the required human-readable project frame. Event
delivery rules come from runtime lifecycle state and app decisions; the runtime
does not parse `project.md` for domain status.

## Open Questions

- What is the minimal `ProjectAppContext` API?
- How should event subscription matching be expressed for typed payloads?
- Should `standardProjectApp` support task dispatch (the current `## Tasks`
  pattern), or should that be a separate helper?
- How should the migration shim handle projects that have both legacy
  `project.md` tasks and a new `.app/app.ts`?
- What safety rules are universal runtime rules versus app-owned rules?

## Final Principle

```text
Stable event runtime.
Project-owned app logic.
Goal-shaped domain workspace.
No global project brain.
```
