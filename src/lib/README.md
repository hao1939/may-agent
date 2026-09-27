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
coverage is described in the [test guide](../../test/README.md). Gym's direct
execution and script consumers are listed in the
[script guide](../../scripts/README.md#gym-compatibility-boundary); inspect them
before changing an entry path.

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

## Agent cooperation tools

`manager-agents-tool.ts` offers bounded `call` and `fork` using a `task`
description, optional context files, success criteria and a selected skill.
A fork remains owned by its live caller. Durable outcomes use App Tasks.
`sessions` returns full session IDs usable by `peek` and permitted `cancel`
operations; only display text is shortened.

`tools/message-tool.ts` records messages through declared App routes. Its
priority describes the message for the receiver; it does not schedule a helper.
Neither tool offers duplicate-detection controls. Tool parameter types are
inferred from their schemas so model discovery and implementation share one
contract. Old `agents.message`/`agents.send` calls receive a correction pointing
to the supported tools.
