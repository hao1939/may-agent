# Scout Knowledge Library Task Resources

`tasks/seed.json` declares only the standing desired state used to initialize a
new Scout app. After initialization,
the Host's SQLite resource store is the mutable task authority. Use the
supplied reconciliation context and supported task reads, not direct SQL.
App code, workflows, observers, and agents never edit Host state directly.

For current work, use `tasks.get` / `tasks.list` with App ID
`scout-knowledge-lib`; operators can use `/tasks` and `/task <ref>` in the
console. These reads expose current resources, waits, evidence, and history.
An unavailable read is not proof that no tasks exist or that work is finished.

Compare when facts were observed, not just when a task finished. A successful
task records its accepted outcome; it does not prove that an external source is
still accessible. Earlier success cannot dismiss a later failed access check,
and a later failure does not invalidate previously verified research. If an
access issue needs no library change, explain that scope-based no-op without
claiming access recovered. Report recovery only with newer direct evidence.

Old `.state/tasks/state.json`, `tree.json`, and `condition-routes.json` files
are retained historical evidence, not live views or bootstrap input. The current
Host does not maintain a `tree.json` publisher. Do not request regeneration or
restore a retired publisher because an old file says paused or has an old
timestamp. Reassess old projection-repair work against current task evidence;
if its acceptance is obsolete, explain that and request an explicit stop or
scope correction, without claiming the artifact was regenerated.

The domain workspace is `../scout-knowledge-lib/`. Runtime traces and temporary
planner notes belong in `.state/` and should not become project understanding.

Use stable `maintain` tasks for recurring responsibilities and finite `achieve`
tasks only for bounded work that needs durable tracking. Use tasks to represent:

- what the library is trying to improve
- what quality signal or user steering triggered work
- which note/index/report changed
- what remains in attention or intentionally waiting on an exact Condition

Do not represent every schedule tick as a task. A tick only wakes Scout to
reconcile the matching stable task. Event IDs, timestamps, health packets, and
current observations stay in trigger/status state rather than task input.

Human and external waits use exact Conditions. They are not tasks owned by a
fake `human` agent. Workflows belong to Scout under
`agents/scout/workflows/` and return the shared May-agent handler contract.

See `design/scout-knowledge-library-process.md` for the complete Scout-specific
task, Condition, path, and cutover model.

Workflow failures remain evidence on the same task; an unavailable binding is
visible in `attention`. They are not translated into owner maintenance work.
The owner planner admits only the named reasons
`experience-review`, `library-health-signal`, `project-comment`,
`manual-library-review`, and `repair-index`.
