# Hosted execution source map

This directory implements hosted sessions, bounded agent calls and workflows.
It is internal Host code. Apps use `@may-agent/sdk`; control clients use
`@may-agent/control`. The [Host source map](../app/README.md) covers admission,
Task scheduling, durable state and capability selection.

## Follow one execution

```text
app/core/tasks/attempt-execution.ts      selected Task executor and context
  app/adapters/executors/managed-agent.ts
    manager.ts                          hosted session ownership and controls
      agent-execution.ts                context, instructions, tools and guards
        agent-runner.ts                 bounded model/tool loop
```

Paths beginning with `app/` are relative to `src/`; other paths are beside this
guide. `app/direct-agent.ts` also uses the prepared execution path for direct
calls. A returned session result is execution evidence; the Task reconciler
owns acceptance of Task results.

## Find the owner

| Change | Start here |
| --- | --- |
| Session start, resume, stop and hosted result access | `manager.ts`; `manager-agents-tool.ts` exposes its agent tool |
| Model execution and tool binding | `agent-execution.ts`, then `agent-runner.ts` |
| Task context supplied to the model | `task-decision-context.ts`; `task-workspace-context.ts` writes the discovery entry |
| Context compaction | `compaction.ts`; preparation connects the transform in `agent-execution.ts` |
| Workflow loading, steps and agent calls | `workflow-tool.ts`; `workflow.ts` holds internal types; `workflow-payload.ts` prepares inputs |
| Execution results and retained evidence | `execution-result.ts`, `workflow-facts.ts`, `artifacts.ts` |
| Session transcripts and metadata files | `persistence.ts` |
| SQLite connection, schema and queries | Focused modules in `db/`; `db.ts` adapts Bun/Node SQLite |

| Event persistence | `db-writer.ts`; Task resource operations remain in `app/core/state/` |
| Coding tools and skills | `tools/`, `skills.ts` |
| Host maintenance capabilities | `app/adapters/maintenance/context.ts` and `handler-loader.ts` |

Ordinary serving-path SQLite operations use the connection's 50 ms busy wait
without extra synchronous sleeps. Unsaved input fails to its caller; already
accepted work keeps its Event/Task identity for the existing recovery owner.
Receipt repair does not replay committed effects. Isolated Task workers retain
their bounded retry schedule. Repeatable schema/metric-definition installation
uses the separate initialization retry helper; it is not an ordinary delivery
allowance. Session/workflow artifacts remain evidence if a SQL projection fails.

Observer facts need no consumer unless a declared route uses them. Their trusted
record-only intent is saved with the Event and restored on keyed retry and journal
recovery; it is not an App routing option or proof of delivery. Missing historical
intent stays unclassified. Storage-only acceptance cannot erase a failed receipt
or replace another consumer's acceptance. App admission acknowledges its own
inspection independently, in the same transaction. See the observer-delivery,
persisted-event and worker-boundary regressions for these failure paths.

`session-subscribers.ts` contains the digest and last-session writers registered
by `app/daemon-events.ts`. Completion suggestions stay in the saved result;
they do not rewrite guidance or enter future prompts automatically. The retired
context updater and unregistered file-read tracker are removed. Historical
`file_reads` rows remain readable by the project history view.

Manager health reads describe sessions, process ownership and workflow runs.
They do not select work for evaluation. Evaluation eligibility and exclusions
belong to the Evaluation App; agent names carry no Host health policy.
The agents tool consumes the existing typed manager interface directly, with
read-only views of the agent and active-session maps.

`requests.ts` is a compatibility facade for database helpers, not the owner of
Conversation Requests. New internal callers use the corresponding `db/` module.
`index.ts` is a broad compatibility export and also re-exports the App loader;
internal code imports the owning module directly to avoid loader cycles.

Detailed tests live beside their source. Cross-component execution and process
coverage is described in the [test guide](../../test/README.md). External direct-execution consumers use the documented adapter in the
[script guide](../../scripts/README.md#external-execution-consumers); review
their contract before changing an entry path.

## Context timing

| Source | When read | Purpose |
| --- | --- | --- |
| `app/adapters/executors/task-context.ts` | Attempt starts | Bind the exact Task/attempt and its scoped capabilities; keep the supplied assignment, events, waits and related work |
| `task-workspace-context.ts` | Once per attempt | Write `TASK.md`, the supplied snapshot and capability catalog as discovery links |
| `agent-execution.ts` | Execution preparation | Combine identity, explicit context preparation, skills and tools; preserve the original assignment for evidence |
| `task-decision-context.ts` | Before each model call, after compaction | Refresh current Task facts and append a disposable brief with links to larger detail |

A refresh failure keeps the last successful read, or the attempt-start snapshot,
with its scope and failure visible. A generation mismatch does not substitute new
requirements into the old attempt. Reading a message does not acknowledge it;
result admission still checks current authority and accounts for handled input.
The brief does not accumulate in the saved transcript. The source guide describes
these existing roles; it does not introduce another context store or controller.

Pi's provider context carries instructions and tool declarations in system
messages. `restoreAgentMessages` restores prior work under the current
invocation's instructions and tools, including transcripts saved before this
format existed. `compaction.ts` replays system messages without summarizing
them; only conversation history becomes a lossy summary. Provider integrations
read the effective prompt and tools with Pi's transcript helpers. Progress and
returned execution history continue to expose work messages, not system setup.

An accepted `finish` ends the invocation through Pi's `finishTurn` hook. Tools
remaining in that assistant batch are blocked, and queued steering or follow-up
input remains available for a later invocation. A rejected finish remains
correctable in the current invocation.

`isOverflowError` accepts the provider name for provider-specific errors. A
bodyless HTTP 400/413 alone does not prove a context overflow; Pi recognizes
that response for Cerebras only. Explicit token-limit errors still work without
a provider name.

## Agent cooperation tools

`manager-agents-tool.ts` offers bounded `call` and `fork` using a `task`
description, optional context files and success criteria.
A fork remains owned by its live caller. Durable outcomes use App Tasks.
`sessions` returns full session IDs usable by `peek` and permitted `cancel`
operations; only display text is shortened.

Use `agents({ action: "follow-up", sessionId, content })` to correct that
running helper. The manager verifies live caller ancestry and matching Task
attempt bindings, then queues literal input through existing steering. It does
not interpret skill commands, restart a finished helper, extend its allowance,
or create another Task. Acceptance means queued for consideration: inspect the
returned contribution before claiming the correction was handled. Cancellation
and the finish boundary can still end execution before queued input is considered.

This updates the caller's instructions for one helper. Requirement changes that
must survive failure belong in durable Task input. Existing Task feedback already
notifies active helpers; callers do not need to forward every update manually.

`tools/message-tool.ts` records messages through declared App routes. Its
priority describes the message for the receiver; it does not schedule a helper.
The loader checks destinations against current installed App owners with a
message handler, including peer Apps in a scoped worker. These addresses come
from the published App registry independently of Task-runtime installation, so
non-background senders retain the same destinations. Configured private
agents are not automatically inboxes. Unavailable targets return an error and
available destinations before publishing `message.created`. App input schema
validation and durable admission remain with the ordinary routing path; address
availability is not a promise of acceptance or eventual completion.
Neither tool offers duplicate-detection controls. Tool parameter types are
inferred from their schemas so model discovery and implementation share one
contract. Old `agents.message`/`agents.send` calls receive a correction pointing
to the supported tools.
