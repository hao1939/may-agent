# App contract migration notes — archived September 10, 2026

**Historical context:** [App Contract](../../2a-design/agent-app.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical sequence, not the current execution model. The original
“all human messages” and “one execution path” migration wording predates the
bounded conversational frontend. Read [App Contract](../../2a-design/agent-app.md)
and [Message Lifecycle](../../2a-design/message-lifecycle.md) for current behavior.

## Contract migration progress

The code moves to this model in one direction while preserving restartable
work:

1. **Done:** add the pure `task(input)` contract and a Runtime admission method
   that atomically links each caller request to its task before any App attempt.
2. **Done:** route actions, input schedules, subscriptions, and human messages through
   that method; keep exact task and Condition wakes direct.
3. **Done for Task-based input:** run durable agent/workflow work from the Task
   controller and let request storage observe accepted results. Bounded
   conversational turns use the separate frontend path described above.
4. **Done:** replace `complete`, `task`, `delegate`, `analyze`, and May
   `continue` dispositions with first-attempt convergence, typed task changes,
   and bounded Runtime dependency capabilities.
5. **Done:** port every current App manifest to the one Task contract.
   The request owner worker, separate execution concurrency, delivery gate, and
   compatibility SDK types are removed.
6. **Done:** expose bounded Task list/get reads through the shared scoped SDK,
   agent tool, control socket, and HTTP adapters. Admission, restart,
   concurrency, dependency, and Conversation projection behavior have focused
   regression proof.

At every step there remains one authoritative task and at most one App
execution path for newly migrated input. Compatibility may translate old
declarations at load time, but it must not run both paths for the same input.
Remaining Runtime and App cleanup is tracked in
[design-implementation-convergence.md](../../proposals/design-implementation-convergence.md).
