# Reading the May source

**Supports:** [Architecture](../2a-design/architecture.md). Connects contract owners to source paths and the evidence needed to review a change.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

Start with one Task, follow its agent execution, then choose the part you want
to review. The broader source map was checked against Host `7f349322`
(2026-09-27, through #256). The execution section follows the candidate in the
[September 28 review](../archive/reviews/task-execution-readability-20260928.md).
It describes source; the running binary and activated App definitions
have separate release identities.

Read the [System Model](../2a-design/system-model.md) for the concepts. Keep the
[Host source map](../../../may-agent/src/app/README.md) beside this guide for
file lookup. Paths such as `src/lib/` below are relative to `projects/may-agent/`.

## Choose a reading route

| What you want to understand | Start here |
| --- | --- |
| The core system and one complete piece of work | [Follow one Task](#follow-one-task) |
| What actually runs after a Task is claimed | [Read the attempt's main path](#4-read-the-attempts-main-path) |
| How the final model input is built | [Follow the agent and its context](#follow-the-agent-and-its-context) |
| How to inspect progress, tool calls and new input | [Trace a running execution](#trace-a-running-execution) |
| Where to add an App capability or change Host mechanics | [Find the extension owner](#find-the-extension-owner) |
| Conversation, workflows, recovery or deployment | [Choose a deeper route](#choose-a-deeper-route) |

For a first pass, read the named types and functions, then follow their callees
when a responsibility is unclear. Reading every large file from top to bottom
makes the main path harder to see.

## Keep the responsibilities clear

Apps decide what work means, how to do it and what counts as a useful outcome.
The Host admits input, stores state, schedules bounded execution, checks result
contracts and preserves unfinished work through waits and failures.

Three records appear throughout the call chain:

| Record | What it answers |
| --- | --- |
| Task | What is wanted, what is currently understood, and what work remains? |
| Attempt | Who claimed this execution, which assignment did it observe, and what did it report? |
| Session | What did this agent invocation receive, do and return? |

One Task can have many attempts. An attempt can use agent sessions, workflow
steps or another executor. A successful session supplies evidence; the Task
still needs to accept the outcome. Current progress, failure evidence, waits
and pending input can coexist. Reading only a scheduling `phase` loses that detail.

The source layout follows those responsibilities:

| Location | Read it as |
| --- | --- |
| `packages/sdk/src/` | Public App, Task and workflow contracts |
| `src/app/core/` | Admission, events, state, scheduling and Task transitions |
| `src/app/adapters/` | Executor, workspace, producer and reporting implementations |
| `src/app/composition/` | Selection, wiring, activation and cleanup of implementations |
| `src/lib/` | Hosted sessions, model/tool integration and persistence helpers |
| `src/app/http/`, `src/app/transport/`, `packages/control/`, `packages/terminal/`, `packages/webui/` | Human/client surfaces over shared capabilities |
| Adjacent `*.test.ts`, `test/` | Focused contracts and cross-component examples |
| `scripts/`, `container/`, `.github/workflows/` | Checks, build, release and operational tooling |

Common design lives outside the Host in `may-agent.app/docs/`. Domain behavior
lives in `may.app`, `scout-knowledge-lib.app`, `evaluation.app` and `gym.app`.
For example, [May's agent definition](../../../may.app/agents/may) belongs to
May's App; the Host loads it. Evaluation selection and Gym's improvement
judgment are also App capabilities.

## Follow one Task

```text
input or observed change
  -> declared route and durable admission
  -> saved Task input / desired state
  -> queue hint, capacity and current execution claim
  -> agent / workflow / other executor
  -> proposed result and evidence
  -> validation and fenced state commit
  -> accepted progress, wait or paced retry
  -> exact caller feedback and future reconciliation
```

Events carry meaningful changes; ordinary calls perform local reads and writes.
Admission saves the relevant resource change before the owner reacts. A small
setter or explicit control can complete its write synchronously. This does not
require every local operation to become a separate asynchronous event handler.

### 1. Read the App contract

Start with [SDK app.ts](../../../may-agent/packages/sdk/src/app.ts):
`AppDefinition`, `AppTaskAttachment`, `AppTaskPolicy` and `defineApp`. Then read
[SDK task.ts](../../../may-agent/packages/sdk/src/task.ts): `TaskIntent`,
`Condition` and `TaskReconcileResult`. The [checked quickstart](sdk-quickstart.md)
is a smaller example than a production App.

The App's `task` mapping attaches input to existing work or supplies a desired
assignment. `agent` selects its default executor; an intent can select an agent,
workflow or registered executor. `tasks` declares Task policy. `defineApp()`
returns a declaration; loading and admission perform validation.

**Check:** which decision belongs to this App, and which guarantee must work for
every App?

### 2. Follow input to its durable owner

In [app-inbox-host.ts](../../../may-agent/src/app/core/inbox/app-inbox-host.ts),
start at `AppInboxHost.admit()`. Follow the App mapping and Task attachment;
Conversation input uses the supplied `admitConversation` capability. Then read
`admitTaskInput()` in [state/inbox.ts](../../../may-agent/src/app/core/state/inbox.ts).

The receipt retains the exact input-to-Task link. That lets the caller receive
the answer to its own input. Admission does not run another agent loop. Failed
mapping retains the input for recovery; subscribed-event translation has an
earlier admission record described in the recovery route below.

**Check:** if this step fails or repeats, what retains ownership and prevents
an unrelated duplicate assignment?

### 3. Read the state before its transitions

Read `AppTaskResource`, `AppTaskAttempt` and `AppTaskCondition` in
[app-task-state.ts](../../../may-agent/src/app/core/tasks/app-task-state.ts),
then `readTask`, `readAttempt` and `commit` in
[app-task-resource-store.ts](../../../may-agent/src/app/core/state/app-task-resource-store.ts).

`spec` holds the desired assignment; `status` holds current observations.
`generation` identifies assignment revisions; `resourceVersion` detects
concurrent writes. A claim identifies the current execution. A fence checks
that a writer still has authority over the assignment and execution it changes.
The resource store owns canonical SQLite persistence; `app-task-store.ts`
provides snapshot and mutation helpers.

**Check:** where is the authoritative fact, and which transaction protects it?

### 4. Read the attempt's main path

Follow `AppTaskController.enqueue()`, `pump()` and `run()` in
[controller.ts](../../../may-agent/src/app/core/tasks/controller.ts).
[app-task-runtime.ts](../../../may-agent/src/app/core/tasks/app-task-runtime.ts)
wires its reconciliation callback. Execution may cross a worker boundary, but
both paths reach [attempt-runner.ts](../../../may-agent/src/app/core/tasks/attempt-runner.ts):

```text
runTaskAttempt()
  claimObservedAppTask()          acquire authority or explain why not ready
  runClaimedTask()
    prepare workspace/context
    runTaskExecutorAttempt()     open context, event observation and lease renewal
      executeTaskHandler()       invoke the selected handler once
                                 close attempt subscriptions/timer on every exit
    examine its report
    validate, finalize and commit the appropriate outcome
```

`runClaimedTask()` is the main reading target. Follow its workspace preparation,
then jump to `executeTaskHandler()` to see selection of Conversation, workflow,
registered executor or managed agent. Return to the result branches afterwards.
Preparation failure returns through `finishUnsuccessfulAttempt()` before the
handler runs. Each result branch settles its report or returns a rejection.

In [attempt-execution.ts](../../../may-agent/src/app/core/tasks/attempt-execution.ts),
`runTaskExecutorAttempt()` surrounds dispatch once. `runTaskAgent()`,
`runTaskWorkflow()` and `runRegisteredTaskExecutor()` connect the concrete
backends using that open `TaskAttempt`. Conversation uses it too. Core-private
`TaskHandlerInput` still includes the claim and runtime options; adapter-facing
`TaskAgentInput` and `TaskWorkflowInput` in `execution.ts` receive scoped
capabilities and read-only App declarations. Read the bounded-execution contract in
[SDK workflow.ts](../../../may-agent/packages/sdk/src/workflow.ts) alongside them.

The execution choices differ in method, not Task ownership:

| Selected handler | What runs | Source to follow |
| --- | --- | --- |
| Managed agent | A model/tool loop with the selected agent's instructions and current Task brief | `runTaskAgent()` → `adapters/executors/managed-agent.ts` → `manager.ts` |
| Workflow | An authored bounded procedure, which can call agents and tools | `runTaskWorkflow()` → `adapters/executors/workflow.ts` → `workflow-tool.ts` |
| Registered executor | An installed function accepting `TaskAttempt`, including native CLI adapters | `runRegisteredTaskExecutor()` → the entry in `opts.executors`; `daemon-agents.ts` installs `codex-goal` |
| Conversation | Human context and a decision proposal for the same Task settlement | `opts.conversations.execute()` → `composition/task-execution.ts` → `conversations/turn-agent.ts` |

These are alternatives for an attempt. A workflow calling an agent as a helper
retains its enclosing execution scope; it does not claim another Task merely
to run a step. Follow a new Task only when work is explicitly delegated through
App input. Workspace preparation precedes the shared dispatch scope; result
validation and durable settlement follow it.

The surrounding time code has distinct purposes:

| Where | Why it exists |
| --- | --- |
| Controller and `host-capacity.ts` | Queue work and release capacity in `finally` |
| `runTaskExecutorAttempt()` | Renew the current execution lease; remove its timer/listeners on exit |
| `ExecutionScope` in `src/lib/execution-scope.ts` | Bound an invocation and propagate cancellation/deadlines |
| `reportTiming` and session usage records | Observe queue wait, elapsed time and usage |
| The zero-delay yield in `runClaimedTask()` | Let other event-loop work run after synchronous state writes |

Read claim → execute → settle first, then these bounds. A local `await` joins a
bounded operation. A durable wait records what must happen, ends the attempt
and releases capacity; it does not keep that JavaScript call suspended forever.

**Check:** what prevents competing attempts, and who cleans up after every exit?

### 5. Follow settlement and caller feedback

Back in `runClaimedTask()`, follow the branch matching the returned state:

| Report | Follow |
| --- | --- |
| `converged` | `establishTaskAcceptance()`, workspace finalization, then `completeAppTask()` or `completeConversationTaskTurn()` |
| `waiting` | Fence/finalize workspace, `admitWaitingConditions()`, `deferAppTask()`, then recover already-saved feedback |
| `incomplete` | `reportAppTaskFailure()` retains partial facts and unfinished work |
| Failure or rejected result | `finishUnsuccessfulAttempt()` and `failAppTaskAttempt()` |

The canonical transitions live in
[app-task-reconciler.ts](../../../may-agent/src/app/core/tasks/app-task-reconciler.ts).
Existing waits survive omission from later reports. New input can make a
successful result progress rather than full convergence. A failed settlement
retains evidence without treating the proposed effects as accepted.

Trace `AppInboxHost.refreshTaskResults()` to `completeTaskInput()` for exact
caller feedback. Projection can retry without undoing the accepted outcome.
`completeAppTask()` accepts an outcome; `closeAppTask()` ends the Task's
availability for further execution. These are separate decisions.

**Check:** if execution finishes but the next write fails, what is accepted,
what remains pending and what can the next attempt inspect?

## Follow the agent and its context

For a managed Task agent, the source path is:

```text
attempt-execution.ts: runTaskAgent()
  adapters/executors/managed-agent.ts: executeTaskAgent()
    manager.ts: callAgentDefinition() / callAgent()
      runDefinition()
        agent-execution.ts: prepareAgentExecution()
        agent-runner.ts: createAgentRun()
      startManagedExecution() -> executeSession()
        agent.prompt() -> model/tool loop
```

The [managed-agent adapter](../../../may-agent/src/app/adapters/executors/managed-agent.ts)
supplies assignment data and the Task result schema. The
[manager](../../../may-agent/src/lib/manager.ts) owns session identity,
persistence and execution lifetime. [Preparation](../../../may-agent/src/lib/agent-execution.ts)
binds the model's inputs. The thin [runner](../../../may-agent/src/lib/agent-runner.ts)
wraps `Agent` from `@earendil-works/pi-agent-core`; that dependency implements
the actual model/tool loop.

### Inspect all three model inputs

| Model input | Follow in `agent-execution.ts` | What contributes |
| --- | --- | --- |
| System instructions | `resolveSystemPrompt()` | Shared guidance, agent `AGENTS.md`, skill catalog and environment; then bundled Host instructions, execution references and completion requirements |
| Tools and their schemas | `resolveTools()` | Loaded capabilities, execution binding and the caller's output schema on `finish` |
| Messages | `prepareExecution()` and `transformContext` | Prepared request, selected skill, model/tool history, steering; compaction followed by current observations and Task brief |

Read the short [execution-instructions.md](../../../may-agent/src/lib/execution-instructions.md)
for Host-wide guidance, then [SDK task-contract.ts](../../../may-agent/packages/sdk/src/task-contract.ts)
for result semantics. The old `appTaskAgentProtocol` and `assignment-guidance.ts`
were removed. Role and domain methods belong in App guidance; schema meanings
and tool behavior belong beside their contracts.

Request preparation has an explicit order: an App's optional
`contextPreparation` transforms the full request; otherwise the Host uses the
supplied shorter `contextPrompt` or the full request. An explicitly selected
skill wraps that prepared request. System instructions, actual tools and the
output schema are assembled independently. A custom `systemPrompt` replaces
convention-based role assembly but still receives the Host execution instructions.

### Distinguish assignment, current facts and history

| Material | Owner and lifetime |
| --- | --- |
| Original invocation assignment | Bounded managed session `meta.json`, linked from execution context; a helper retains its own contribution |
| `TASK.md`, `context.json`, `catalog.json` | [task-workspace-context.ts](../../../may-agent/src/lib/task-workspace-context.ts): attempt discovery files and links |
| Current Task decision brief | [task-decision-context.ts](../../../may-agent/src/lib/task-decision-context.ts): refreshed before managed model calls, after compaction |
| Transcript and compacted snapshot | [persistence.ts](../../../may-agent/src/lib/persistence.ts): execution history and saved compaction context |
| Authority to accept an effect | Current claim and state transaction, checked at the write boundary |

Read the brief's freshness and omission markers. A failed refresh retains scoped
last-known facts; a changed generation is not silently adopted by the old
attempt. Reading an event does not fulfill its request. Shared Task background
does not expand a helper's assignment or replace its caller's result schema.

The managed brief is a disposable provider view, not another copy appended to
the transcript. Native CLI executors build their own context; inspect their
adapters before assuming the same refresh behavior. Compatibility persistent
chat also has a distinct path: it refreshes observations as message data and
does not pin its first turn as every later turn's assignment.

For the full authoring order and limits, use
[System Prompt Assembly](agent-convention.md#system-prompt-assembly).

## Trace a running execution

Follow exact references from Task → attempt → session or workflow run. Choosing
the latest session by agent name can select unrelated work.

1. Read current Task state through
   [app-read.ts](../../../may-agent/src/app/core/reads/app-read.ts), including
   pending input, obligations, waits and the current attempt.
2. For a managed session, inspect `<persistDir>/sessions/<sessionId>/meta.json`
   for its assignment, Task binding and caller links; `session.jsonl` for
   messages and tool results; `session-compact.jsonl` for a saved compaction
   snapshot when present. `appendSessionMessage()` writes transcript messages.
3. In `manager.ts`, read `executeSession()` for execution and result collection,
   and `bridgeEvents()` for model/tool observations. Useful observation points
   are `message_end`, `tool_execution_start` and `tool_execution_end`.
4. Follow [observeTaskFeedback()](../../../may-agent/src/lib/task-execution-context.ts)
   through the manager's `withExecutionScope()` and `send()` to `agent.steer()`.
   A live hint enters the execution loop; it does not interrupt an arbitrary
   tool synchronously or acknowledge the durable input. A missed hint leaves
   the input available for normal reconciliation.
5. Return to Task settlement to see whether the session's result was accepted.
   Session status alone cannot establish fulfillment of the human ask.

To debug what the model actually saw, inspect `prepared.systemPrompt`,
`prepared.tools` and the messages after `transformContext`, at the runner's
`streamFn` boundary. The ordinary transcript omits the disposable current brief
and is not a complete capture of every provider request. Existing integration
tests use a fixture provider at that boundary without operating live Apps.

## Find the extension owner

| Intended change | App entry point | Host code to read |
| --- | --- | --- |
| Role, judgment or communication style | `agents/<name>/AGENTS.md`; situational methods in skills | `resolveSystemPrompt()` and `src/lib/skills.ts` |
| New action | `agents/<name>/tools/<capability>.ts`, default-exporting a named tool factory | [agent-local-tools.ts](../../../may-agent/src/app/loader/agent-local-tools.ts), [toolset-loader.ts](../../../may-agent/src/app/loader/toolset-loader.ts) |
| Procedure combining actions/agents | App workflow with explicit inputs and result contract | `adapters/executors/workflow.ts`, `src/lib/workflow-tool.ts` |
| Smaller request presentation | Optional `agent.json.contextPreparation` module | [agent-definition.ts](../../../may-agent/src/app/loader/agent-definition.ts), `prepareExecution()` |
| New input, schedule or observed change | App declaration and its mapping to owned work | SDK `app.ts`, admission and producer adapters |
| Persistence, fencing, execution or delivery guarantee | Common Host mechanism and matching SDK contract | Core contract, adapter implementation and composition wiring |

There is no `AppDefinition.tools` field. `agent.json.tools` selects Host presets;
local tools are discovered from the agent's directory. The loader currently
reports and skips failed factories, so check activation and the prepared toolset.
An App request preparer changes request presentation; it does not replace Host
instruction assembly, tool binding or Task authority.

Use the [extension convention](agent-convention.md#how-to-extend) for exact module
shapes and the [ownership design](../2a-design/agents.md#extending-capabilities-without-changing-the-execution-mechanism)
for the boundary. New capabilities normally fit these existing entry points.
A change to a shared guarantee belongs in infrastructure and its common design.

## Choose a deeper route

| Area | Reading path and central question |
| --- | --- |
| Conversation | [Source guide](../../../may-agent/src/app/conversations/README.md) → `core/tasks/execution.ts` (`AppInputResolver`) → `composition/conversation-task-turn.ts` → `conversations/context.ts` and `turn-agent.ts` → `core/state/conversation-task-turns.ts`. Core derives the input contract, prepares data-only targets and settles effects; context and model execution supply evidence and judgment. Does the answer fulfill the saved ask? |
| Workflow and cooperation | SDK `TaskAttempt`/`WorkflowContext` → [workflow adapter](../../../may-agent/src/app/adapters/executors/workflow.ts) → `runWorkflowDirect()`/`createWorkflowRunner()` in [workflow-tool.ts](../../../may-agent/src/lib/workflow-tool.ts). Which operations are bounded helpers, and which require durable delegated work? |
| Delegation and return | [dependency-admission.ts](../../../may-agent/src/app/core/tasks/dependency-admission.ts) → [input-result.ts](../../../may-agent/src/app/core/inbox/input-result.ts). Follow the exact input answer; a parent link alone creates no wait or feedback subscription. |
| Event admission | [events/interface.ts](../../../may-agent/src/app/core/events/interface.ts) → [events/bus.ts](../../../may-agent/src/app/core/events/bus.ts) → [app-inbox-runtime.ts](../../../may-agent/src/app/composition/app-inbox-runtime.ts). What is saved before translation, and what remains if translation fails? |
| Task recovery | [app-task-recovery.ts](../../../may-agent/src/app/core/tasks/app-task-recovery.ts) → [startup-recovery.ts](../../../may-agent/src/app/core/tasks/startup-recovery.ts) → [session-recovery.ts](../../../may-agent/src/app/adapters/executors/session-recovery.ts). What restores eligibility without mistaking session evidence for accepted work? |
| Startup and interfaces | `runAppRuntime()` in [app-runtime.ts](../../../may-agent/src/app/app-runtime.ts) → [composition guide](../../../may-agent/src/app/composition/README.md) → [HTTP](../../../may-agent/src/app/http/README.md)/[control](../../../may-agent/packages/control/README.md). Do all surfaces read and change the same resource? |
| Release and activation | [Scripts](../../../may-agent/scripts/README.md) and [CONTRIBUTING](../../../may-agent/CONTRIBUTING.md). Which source, binary, image and captured App definition are actually active? |

For event failures before a Task exists, inspect
[app-event-admission-store.ts](../../../may-agent/src/app/core/state/app-event-admission-store.ts)
and `recoverAdmissionPlans()` in composition. Unresolved translation retains its
responsible route for retry; an already translated command is retained for
replay. Task retry cannot recover input that was never durably routed.

For cooperation, the current [agents tool](../../../may-agent/src/lib/manager-agents-tool.ts)
still offers bounded `call` and `fork`; the fork remains owned by its live caller.
The [message tool](../../../may-agent/src/lib/tools/message-tool.ts) uses declared
App routes. Neither a helper call nor a local workflow `await` creates a durable
continuation that resumes at the same JavaScript line after a crash. See
[workflow authoring](workflow-authoring.md).

Review recovery at three boundaries: input saved before a missed wake; execution
ended before settlement; accepted outcome before caller feedback. Code preserves
identity, evidence and retry eligibility. Agents diagnose uncertain failures;
retry alone does not guarantee a useful diagnosis.

## Read tests as examples

Start with a scenario and its assertions, then follow production calls. These
examples exercise the boundaries above:

| Question | Executable example |
| --- | --- |
| Can translation failure recover through the same route? | [app-event-translation.test.ts](../../../may-agent/src/app/composition/app-event-translation.test.ts): translation failures followed by database reopen and repair |
| Does saved human input survive a missed wake? | [conversation-runtime.test.ts](../../../may-agent/src/app/core/tasks/conversation-runtime.test.ts): `Conversation admission survives reopen and runs without an ingress wake` |
| Do new dependencies preserve older waits? | [app-task-runtime.test.ts](../../../may-agent/src/app/core/tasks/app-task-runtime.test.ts): `explains rejected dependencies, preserves existing waits, and admits a corrected input` |
| Can App preparation change the brief while retaining execution controls? | [agent-execution.test.ts](../../../may-agent/src/lib/agent-execution.test.ts): `replaces only the task brief, retaining current execution controls and original input` |
| What reaches the model after compaction and refresh failure? | [task-decision-context.test.ts](../../../may-agent/src/lib/task-decision-context.test.ts) and [integration coverage](../../../may-agent/test/integration/task-decision-context.test.ts) |
| Does a helper retain its own assignment and schema? | [task-workflow-context.test.ts](../../../may-agent/test/integration/task-workflow-context.test.ts) |
| Are Host instructions included in the built binary? | [execution-instructions-build.test.ts](../../../may-agent/test/integration/execution-instructions-build.test.ts) |
| Are state changes atomic and version checked? | [app-task-resource-store.test.ts](../../../may-agent/src/app/core/state/app-task-resource-store.test.ts), [conversation-task-turns.test.ts](../../../may-agent/src/app/core/state/conversation-task-turns.test.ts) |

The [test guide](../../../may-agent/test/README.md) maps process, restart and UI
coverage. Fixture-provider tests prove context and handling mechanics. Paired
model trials and App evaluation address whether those mechanics produce better
judgment in real work.

## Then inspect the Apps

Open the declaration, follow its selected agent guidance, then inspect the
workflow or observer for the behavior you care about.

| App | Entry point | Focus |
| --- | --- | --- |
| May | [may.app/app.ts](../../../may.app/app.ts) | Conversation, team assignment, review and human decisions |
| Scout | [scout-knowledge-lib.app/app.ts](../../../scout-knowledge-lib.app/app.ts) | Discovery, knowledge processing and committed results |
| Evaluation | [evaluation.app/app.ts](../../../evaluation.app/app.ts) | Selection, sufficient evidence and delivery of findings |
| Gym | [gym.app/app.ts](../../../gym.app/app.ts) | Candidate improvement, comparison and adoption evidence |

Trace one paper-review input from May to Scout, then follow its exact answer
back to May's saved Request. For the [learning loop](../2a-design/practice-learning-loop.md),
follow one result through Evaluation and Gym to an adoption decision. A declared
schedule alone does not establish that the whole loop is progressing.

During review, ask: **who owns the fact, where is it saved, what wakes its owner,
what does the agent see, which write accepts the outcome, and what survives if
the next step fails?**
