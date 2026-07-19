# AKS task state

The live task graph is stored only at `.state/tasks/tree.json`.

It contains:

- `resources`: desired task specs and observed reconciliation status;
- `conditions`: typed external facts that waiting tasks need;
- `attempts`: durable runtime execution records;
- `taskTriggers`: the latest correlated event for each task;
- `receipts`: bounded completion memory for absorbed achieve tasks; and
- `tasks`: a derived human/UI projection of the live relationships.

The graph tracks and explains work. It does not assign sessions, maintain an
outbox, select a reviewer, or schedule workers. The app controller owns those
runtime mechanics.

Create desired work through the app resolver or a handler action. Bind a
repeatable process with `workflow: "name"`; the runtime discovers
`workflows/name.ts`. Otherwise the task runs through its resolved owner, with
the app owner as the final fallback.

Handlers return structured state, evidence, actions, and typed Conditions.
They never edit the graph directly. Completed achieve tasks are removed from
the live graph after an atomic receipt is written. Reusable experience belongs
in workflows, skills, design, domain models, and evidence—not in a mutable task
archive.

`tasks/seed.json` is initialization input only. There is no checked-in
`tasks/tree.json` mirror.
