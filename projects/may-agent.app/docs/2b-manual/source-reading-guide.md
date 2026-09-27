# Reading the May source

This guide follows one piece of work through the system, then offers deeper
routes for the parts you want to review. It describes Host source at
`1ff18acc` (2026-09-27, including #252 and #253). This is a
source guide; the running binary and installed App definitions have their own
release identities.

Start with the [System Model](../2a-design/system-model.md). Keep the
[Host source map](../../../may-agent/src/app/README.md) beside this guide for
file lookup. The model owns the concepts; this guide explains where to inspect
their implementation.

## What the system does

May turns human requests and observed changes into work that can continue
across multiple executions. Apps decide what work means and what counts as a
useful answer. The Host stores the assignment and evidence, runs an agent or
workflow, and preserves unfinished work through waits and failures.

The capabilities worth reviewing are:

| Capability | What it provides | Main source home |
| --- | --- | --- |
| Extensible Apps | Input contracts, ownership, selected executors, routes and schedules | SDK declarations; `src/app/core/apps/` |
| Durable work | Current assignment, accepted results, pending input, waits, attempts and explicit closure | `src/app/core/tasks/` and `core/state/` |
| Agent and workflow execution | Instructions, context, tools, model calls, procedure steps and execution evidence | `src/lib/` and `src/app/adapters/executors/` |
| Conversation and cooperation | Human discussion, accepted asks, delegation and correlated answers | `src/app/conversations/`, inbox and Task state |
| Events and recovery | Relevant wakes, timer input, missed-change discovery and paced retry | Events, Task recovery and producer adapters |
| Inspection and control | Shared Task reads, evidence, Stop/close controls, console, HTTP and Telegram | Core reads, transport, HTTP and client packages |

Evaluation and Gym use these capabilities to assess and improve work. Their
judgment, selection rules and approval policy live in Apps. The Host does not
contain an automatic rule that every completed Task must be evaluated or changed.

## The repository boundaries

Paths in the table below are relative to `projects/may-agent/`.

| Location | Read it as |
| --- | --- |
| `packages/sdk/src/` | The contract App and workflow authors use |
| `src/app/core/` | Admission, events, state and Task mechanics |
| `src/app/adapters/` | Implementations connected to those mechanics: executors, Git workspaces, producers and reporting |
| `src/app/composition/` | Wiring: which implementations this Host uses and how they start/stop |
| `src/lib/` | Hosted execution, model/tool integration and lower-level persistence; it contains substantial behavior despite its broad name |
| `src/app/http/`, `src/app/transport/`, `packages/control/`, `packages/terminal/`, `packages/webui/` | Human/client surfaces over shared capabilities |
| `test/`, adjacent `*.test.ts` | Cross-component examples and focused contract tests |
| `scripts/`, `container/`, `.github/workflows/` | Build, checks, release and operational tooling |

Outside that repository, `may-agent.app/docs/` is the common design home.
`may.app`, `scout-knowledge-lib.app`, `evaluation.app` and `gym.app` own their
domain behavior. The agent named May is declared under
[may.app/agents/may](../../../may.app/agents/may/); the Host loads agent
definitions rather than hard-coding that personality into the Task engine.

Core, adapters and composition describe responsibility and import direction.
They do not imply separate services or processes. See
[Architecture](../2a-design/architecture.md) for the four core responsibilities.

## First pass: follow one Task

Allow roughly an hour to skim this route. Read the named types and functions
first; follow their callees when a responsibility is unclear. Several files are
large, so reading them from top to bottom obscures the main path.

```text
human / another App / schedule / observer
                  |
         declared route + admission
                  |
       saved input attached to a Task
                  |
      queue hint -> capacity -> current claim
                  |
       bounded agent / workflow / executor
                  |
          proposed result + evidence
                  |
       validation + fenced state commit
                  |
     accepted result / wait / paced retry
                  |
        exact caller feedback + future wakes
```

The arrows combine events and ordinary function calls. A local `await` waits
for one bounded operation; a durable wait saves what must happen and releases
the Task's execution capacity. The Task remains available until its owner closes it.

### 1. Understand what an App declares

Read [app.ts](../../../may-agent/packages/sdk/src/app.ts): `AppDefinition`,
`AppTaskAttachment`, `AppTaskPolicy`, and `defineApp`. Then read
[task.ts](../../../may-agent/packages/sdk/src/task.ts): `TaskIntent`, `Condition`
and `TaskReconcileResult`.

An App declares input and maps it to an existing Task or a desired assignment.
Its `agent` selects a default executor. A Task's intent can select an agent,
workflow or registered executor. `defineApp()` itself simply returns the
declaration; Host loading and admission perform validation.

Use the [checked quickstart](sdk-quickstart.md) as a small example before opening
a production App with many routes.

**Review question:** where does App judgment end, and what does the Host promise
to preserve regardless of which App made the decision?

### 2. See how input acquires a durable owner

Read [app-inbox-host.ts](../../../may-agent/src/app/core/inbox/app-inbox-host.ts),
starting with `AppInboxHost.admit()`. Follow ordinary input through the App's
`task` mapping and Task attachment; Conversation input uses `admitConversation`.
Then inspect `admitTaskInput` in
[state/inbox.ts](../../../may-agent/src/app/core/state/inbox.ts).

The input receipt and exact Task link let a caller later receive the answer
to its own input. This inbox admits and correlates work; it does not execute a
second agent loop. Mapping failures retain an input that recovery can revisit.

**Review question:** if admission is repeated, or fails halfway through, which
identity survives and prevents a second unrelated assignment?

### 3. Read the stored model before its transitions

Read `AppTaskResource`, `AppTaskAttempt` and `AppTaskCondition` in
[app-task-state.ts](../../../may-agent/src/app/core/tasks/app-task-state.ts).
Inspect `readTask`, `readAttempt` and `commit` in
[app-task-resource-store.ts](../../../may-agent/src/app/core/state/app-task-resource-store.ts).

The desired assignment is in `spec`; current observations are in `status`.
`generation` identifies assignment revisions. `resourceVersion` detects
concurrent writes. Attempt identity records the execution that produced evidence.
A fence is a check that a writer still has authority over the version and
execution it is trying to change.

Accepted evidence, failure facts, open Conditions and pending input can coexist.
The scheduling `phase` alone cannot tell you whether the user's whole ask is done.

**Review question:** which transaction protects the fact you are reviewing,
and what happens when another writer changes it first?

### 4. Follow dispatch into an attempt

Skim [app-task-capability.ts](../../../may-agent/src/app/core/tasks/app-task-capability.ts)
for the Host-facing operations. Follow `AppTaskController.enqueue()` and dispatch
in [controller.ts](../../../may-agent/src/app/core/tasks/controller.ts), then
open `runTaskAttempt()` in
[attempt-runner.ts](../../../may-agent/src/app/core/tasks/attempt-runner.ts).

Find its call to `claimObservedAppTask()`, then the executor call. The queue is
a scheduling hint; the durable Task and current claim decide whether execution
is allowed. [host-capacity.ts](../../../may-agent/src/app/core/scheduling/host-capacity.ts)
owns the shared capacity slots.

**Review question:** what prevents two wakes from running competing attempts,
and where is capacity released after either success or failure?

### 5. Follow one agent execution and its context

For the complete path from authored instructions to system text, tool schemas
and transformed messages, use the [prompt assembly map](../proposals/agent-prompt-assembly-review-20260927.md#how-the-current-prompt-reaches-the-model).
It also distinguishes the initial request, current Task brief and later
compaction/recovery input.

Read `runTaskExecutorAttempt()` in
[attempt-execution.ts](../../../may-agent/src/app/core/tasks/attempt-execution.ts),
then the managed-agent adapter in
[managed-agent.ts](../../../may-agent/src/app/adapters/executors/managed-agent.ts).
Continue through [manager.ts](../../../may-agent/src/lib/manager.ts),
`prepareAgentExecution()` in
[agent-execution.ts](../../../may-agent/src/lib/agent-execution.ts), and
`createAgentRun()` in [agent-runner.ts](../../../may-agent/src/lib/agent-runner.ts).

The manager owns hosted sessions. Preparation binds instructions, tools and
context. The runner performs the bounded model/tool loop. A session result is
evidence returned to the Task engine; its existence does not establish Task acceptance.

Before reading provider details, inspect `createTaskDecisionContext()` in
[task-decision-context.ts](../../../may-agent/src/lib/task-decision-context.ts).
It shows the current understanding, obligations, pending input and links that
the model receives. The deeper context route below explains freshness.

**Review question:** can the agent see what remains to do, what already succeeded,
what failed, and where to read omitted detail?

### 6. Follow the result back into durable state

Return to `runTaskAttempt()` after the executor returns. Follow result validation,
verification, dependency admission and settlement. In
[app-task-reconciler.ts](../../../may-agent/src/app/core/tasks/app-task-reconciler.ts),
read these functions in order:

1. `claimObservedAppTask()` — obtain the execution authority.
2. `completeAppTask()` — accept an outcome for the work considered.
3. `deferAppTask()` — retain waits and any continuation/review requirements.
4. `failAppTaskAttempt()` — retain failure evidence and pace another attempt.
5. `closeAppTask()` — apply an authorized end to the Task's lifetime.

Each uses the same resource store. Trace an accepted result through
`AppInboxHost.refreshTaskResults()` and `completeTaskInput()` to see how the
exact caller receives it. Feedback projection can be retried without undoing
the accepted Task outcome.

**Review question:** if the agent finishes but settlement fails, what is accepted,
what remains pending, and what evidence does the next attempt receive?

## Deeper routes

### Context: what is fresh, what is a snapshot?

| Context | Producer | When to trust it |
| --- | --- | --- |
| Assignment, input batch, previous attempt, children and waits supplied to execution | [attempt-execution.ts](../../../may-agent/src/app/core/tasks/attempt-execution.ts), [app-task-context.ts](../../../may-agent/src/app/core/tasks/app-task-context.ts) | Describes what was supplied to that attempt; later observations may differ |
| `TASK.md`, `context.json`, `catalog.json` | `prepareTaskWorkspaceContext()` in [task-workspace-context.ts](../../../may-agent/src/lib/task-workspace-context.ts) | Discovery files written for the attempt; they are not the writable authority for Task state |
| Managed agent's decision brief | [task-decision-context.ts](../../../may-agent/src/lib/task-decision-context.ts), connected by `transformContext` in `agent-execution.ts` | Refreshed for model requests; failures and omitted data are marked, with links for deeper reads |
| Human discussion and accepted asks | [conversations/context.ts](../../../may-agent/src/app/conversations/context.ts) | Bounded messages plus Request and canonical Task observations; older discussion is available through the context tool |
| Permission to apply an effect | Claim/freshness checks in `app-task-reconciler.ts` and the storage transaction | Checked at the write boundary; a prompt snapshot alone cannot grant it |

Read the brief's coverage metadata as carefully as its text. Reading an event
does not fulfill its requested work. A failed refresh does not erase the last
known facts or make them current. Larger evidence stays linked rather than
being copied into every prompt. The managed-agent transform is one executor
integration; inspect a native executor's adapter before assuming identical refresh behavior.

### Conversation: same execution, additional product records

Start with the [Conversation source guide](../../../may-agent/src/app/conversations/README.md).
Then follow `prepareConversationTaskTurn()` in
[composition/conversation-task-turn.ts](../../../may-agent/src/app/composition/conversation-task-turn.ts)
to [turn-agent.ts](../../../may-agent/src/app/conversations/turn-agent.ts) and
[state/conversation-task-turns.ts](../../../may-agent/src/app/core/state/conversation-task-turns.ts).

A Turn runs under a Task claim. Its accepted decision commits the reply, Request
updates and authorized effects together. The Request records the human ask;
the Task records execution responsibility. Ending a Turn or accepting a child
result does not itself close the Request. Stop addresses the observed Turn;
Task closure has a different scope.

For a concrete walkthrough, trace: human asks for a paper review → May explains
the handoff → Scout's Task accepts a result → the exact result returns as input
to May → May judges whether it fulfills the accepted ask. Follow the Task/input
references at each boundary rather than selecting the newest result by time.

### Workflows and cooperation

Read `TaskAttempt`, `TaskExecutor` and `WorkflowContext` in
[SDK workflow.ts](../../../may-agent/packages/sdk/src/workflow.ts). Follow
[executors/workflow.ts](../../../may-agent/src/app/adapters/executors/workflow.ts)
to `runWorkflowDirect()` and `createWorkflowRunner()` in
[workflow-tool.ts](../../../may-agent/src/lib/workflow-tool.ts).

A workflow orchestrates operations inside an execution boundary. It uses the
shared Task context, event and result rules. A workflow's local `await` is not a
persisted continuation that automatically resumes at the same JavaScript line
after a process crash. Read [workflow authoring](workflow-authoring.md) for how
to keep progress discoverable and return a durable wait when appropriate.

For durable cooperation, trace `TaskAppDependency` through
[dependency-admission.ts](../../../may-agent/src/app/core/tasks/dependency-admission.ts)
and [input-result.ts](../../../may-agent/src/app/core/inbox/input-result.ts).
For a bounded helper, inspect
[manager-agents-tool.ts](../../../may-agent/src/lib/manager-agents-tool.ts).
Current source still offers `call` and `fork`; a fork belongs to its live caller.
Those calls do not establish another durable Task lifecycle. The
[message tool](../../../may-agent/src/lib/tools/message-tool.ts) uses declared
App routes. Inspect the result promise and ownership of each capability, not
just its action name.

### Events, waiting and recovery

Read [events/interface.ts](../../../may-agent/src/app/core/events/interface.ts)
and [events/bus.ts](../../../may-agent/src/app/core/events/bus.ts), then
[app-inbox-runtime.ts](../../../may-agent/src/app/composition/app-inbox-runtime.ts)
for how routes, admission and recovery connect. The
[producer guide](../../../may-agent/src/app/adapters/producers/README.md) explains
schedules and observers.

Follow [app-task-recovery.ts](../../../may-agent/src/app/core/tasks/app-task-recovery.ts),
[startup-recovery.ts](../../../may-agent/src/app/core/tasks/startup-recovery.ts)
and [session-recovery.ts](../../../may-agent/src/app/adapters/executors/session-recovery.ts).
Task-bound execution recovers through the Task. Session files retain diagnostic
evidence; they do not independently authorize replay or completion.

Review three boundaries: input saved before a missed wake; execution ended before
settlement; outcome accepted before caller notification. Each should retain
enough identity and evidence for the existing recovery path. Code handles
bookkeeping and eligibility; an agent must still diagnose uncertain failures.
Retry alone cannot guarantee a useful diagnosis or repair arbitrary broken code.

### Wiring, interfaces and delivery

After the lifecycle is familiar, read `runAppRuntime()` in
[app-runtime.ts](../../../may-agent/src/app/app-runtime.ts) and
`createTaskExecutionBackends()` in
[composition/task-execution.ts](../../../may-agent/src/app/composition/task-execution.ts).
Use the [composition guide](../../../may-agent/src/app/composition/README.md)
to follow startup, reload and shutdown. This shows how capabilities are selected
without putting provider details into the reconciler.

Follow [app-read.ts](../../../may-agent/src/app/core/reads/app-read.ts) into the
[HTTP guide](../../../may-agent/src/app/http/README.md) and
[control package](../../../may-agent/packages/control/README.md) for user-facing
reads and commands. Follow [scripts](../../../may-agent/scripts/README.md) and
[CONTRIBUTING](../../../may-agent/CONTRIBUTING.md) when reviewing release/deployment.
Source checkout, compiled binary, image and installed definition release are
separate things to verify.

## Read tests as examples

Start with a named scenario and its assertions, then follow the production calls.
These are good examples of boundaries that have mattered in real fixes:

| Question | Executable example |
| --- | --- |
| Does saved input run after a missed wake? | [conversation-runtime.test.ts](../../../may-agent/src/app/core/tasks/conversation-runtime.test.ts): `Conversation admission survives reopen and runs without an ingress wake` |
| Can a bad handoff be corrected using retained input? | Same file: `invalid handoff is repairable after reopen and only complete referenced input creates the worker assignment` |
| Do failures preserve unfinished work? | [app-task-reconciler.test.ts](../../../may-agent/src/app/core/tasks/app-task-reconciler.test.ts): `retains all input through repeated failure and becomes eligible when backoff expires` |
| Do new dependency decisions preserve older waits? | [app-task-runtime.test.ts](../../../may-agent/src/app/core/tasks/app-task-runtime.test.ts): `explains rejected dependencies, preserves existing waits, and admits a corrected input` |
| What does the model see when context changes? | [task-decision-context.test.ts](../../../may-agent/src/lib/task-decision-context.test.ts) |
| Are state changes atomic and version checked? | [app-task-resource-store.test.ts](../../../may-agent/src/app/core/state/app-task-resource-store.test.ts), [conversation-task-turns.test.ts](../../../may-agent/src/app/core/state/conversation-task-turns.test.ts) |

See the [test guide](../../../may-agent/test/README.md) for the separate ownership
of daemon, worker-death, reopen and UI coverage. A mocked executor test proves
Host handling of that result; it does not prove that a real model reliably makes
the right judgment. Model trials and App evaluation answer that separate question.

## Then inspect the actual Apps

Open the declaration first, follow its selected agent instructions, then read
the specific workflow/observer named by the route you care about.

| App | Start here | Focus |
| --- | --- | --- |
| May | [may.app/app.ts](../../../may.app/app.ts) | Conversation, team assignment, review and human decisions |
| Scout | [scout-knowledge-lib.app/app.ts](../../../scout-knowledge-lib.app/app.ts) | Source discovery, knowledge processing, stored results and library maintenance |
| Evaluation | [evaluation.app/app.ts](../../../evaluation.app/app.ts) | Which work to assess, what evidence is sufficient and who receives findings |
| Gym | [gym.app/app.ts](../../../gym.app/app.ts) | Candidate improvement, comparison and evidence for an adoption decision |

For the improvement loop, trace one exact output between these Apps and check
its consumer. A declaration of an event or schedule alone does not prove the
whole loop is making progress. The
[learning-loop design](../2a-design/practice-learning-loop.md) describes the
integration; live reports and retained execution evidence show its actual behavior.

## Names and details to watch

- `completeAppTask()` accepts an outcome. `closeAppTask()` ends availability for
  future execution. `converged` is therefore not synonymous with closed.
- `app.task` is the input-to-Task mapping. `app.tasks` declares Task policy.
  Neither is a second controller.
- `AppInboxItem` tracks admitted input; `AppConversationRequest` retains an
  accepted human ask until an explicit closure decision. Input handling can
  finish before that ask is fulfilled.
- `app-task-store.ts` contains snapshot/mutation helpers; the resource store owns
  canonical persistence. `src/lib/requests.ts` is a historical database facade.
- `manager.ts` owns hosted execution and factual health observations. Evaluation
  eligibility belongs to the Evaluation App.
- Parent/child organization does not automatically establish a dependency,
  subscribe to results or grant change authority. Follow the explicit links.

On the first pass, leave offline cutovers, provider protocols, UI rendering and
historical compatibility code for later. They matter when reviewing those
boundaries, but they make the main lifecycle harder to see.

For each change you review, ask: **who owns this fact; where is it saved; what
wakes its owner; what does the agent see; which write accepts the outcome; and
what remains if the next step fails?** Those questions connect the design to
the implementation without requiring you to memorize every helper.
