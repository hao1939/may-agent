# Scout Knowledge Library Task Tree

`tree.json` is the project app's durable understanding of how Scout should
maintain the knowledge library.

The domain workspace is `../scout-knowledge-lib/`. Runtime traces and temporary
planner notes belong in `.state/` and should not become project understanding.

Use tasks to represent durable thinking:

- what the library is trying to improve
- what quality signal or user steering triggered work
- which note/index/report changed
- what remains blocked or intentionally deferred

Do not represent every schedule tick as a task. A tick only wakes Scout to
review this tree and choose the smallest useful maintenance step.
