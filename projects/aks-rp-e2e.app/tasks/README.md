# AKS task state

The Host keeps the sole mutable task authority internally at
`.state/tasks/state.json`. App code, workflows, and agents do not read or write
that file. They use the scoped task resource API or the generated read
projection.

`.state/tasks/tree.json` is a generated, disposable schema-v2 projection for
people, agents, queries, and UI. It contains current groups and tasks, exact
Conditions, readiness, compact dependency-satisfaction facts, and bounded
current-attempt information. It does not contain full attempt or receipt maps.
It is never restored into canonical task state.

The graph tracks and explains work. It does not assign sessions, maintain an
outbox, select a reviewer, or schedule workers. The app controller owns those
runtime mechanics.

Create desired work through the app resolver or a handler action. Bind a
repeatable process with `workflow: "name"`; the runtime discovers
`workflows/name.ts`. Otherwise the task runs through its resolved owner, with
the app owner as the final fallback.

Handlers return structured state, evidence, actions, and typed Conditions.
They never edit task storage or its projection directly. Completed achieve
tasks are removed from the live graph after an atomic receipt is written.
Reusable experience belongs
in workflows, skills, design, domain models, and evidence—not in a mutable task
archive.

`tasks/seed.json` is initialization input for structural groups only. Standing
task intent is defined once in `task-loops.ts` and materialized by semantic
ticks. There is no checked-in `tasks/tree.json` mirror.
