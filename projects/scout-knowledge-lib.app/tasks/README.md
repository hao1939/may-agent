# Scout Knowledge Library Task Tree

`tasks/seed.json` declares only the standing desired state used to initialize a
new Scout app. After initialization,
`.state/tasks/state.json` is the sole mutable task authority.

`.state/tasks/tree.json` is a generated human/agent read projection. Do not
edit it and never use it as mutation or bootstrap input after cutover.

The domain workspace is `../scout-knowledge-lib/`. Runtime traces and temporary
planner notes belong in `.state/` and should not become project understanding.

Use stable `maintain` tasks for recurring responsibilities and finite `achieve`
tasks only for bounded work that needs durable tracking. Use tasks to represent:

- what the library is trying to improve
- what quality signal or user steering triggered work
- which note/index/report changed
- what remains blocked or intentionally deferred

Do not represent every schedule tick as a task. A tick only wakes Scout to
reconcile the matching stable task. Event IDs, timestamps, health packets, and
current observations stay in trigger/status state rather than task input.

Human and external waits use exact Conditions. They are not tasks owned by a
fake `human` agent. Workflows belong to Scout under
`agents/scout/workflows/` and return the shared May-agent handler contract.

See `design/scout-knowledge-library-process.md` for the complete Scout-specific
task, Condition, path, and cutover model.
