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

`requests.ts` is a compatibility facade for database helpers, not the owner of
Conversation Requests. New internal callers use the corresponding `db/` module.
`index.ts` is a broad compatibility export and also re-exports the App loader;
internal code imports the owning module directly to avoid loader cycles.

Detailed tests live beside their source. Cross-component execution and process
coverage is described in the [test guide](../../test/README.md). Gym's direct
execution and script consumers are listed in the
[script guide](../../scripts/README.md#gym-compatibility-boundary); inspect them
before changing an entry path.
