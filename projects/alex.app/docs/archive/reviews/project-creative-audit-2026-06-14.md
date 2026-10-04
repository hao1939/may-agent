# Project Creative Audit — 2026-06-14

**Historical context:** [Projects](../../2a-design/projects.md). Retained rationale and evidence; this record does not define the current contract.

This historical review came from the retired project discussion log. It is
evidence, not current design or runtime status authority.

## Audit

- Project: `projects/may-agent.app`
- Trigger: `project.health.finding`
- Selection reason: targeted by event; project was active, recently changed,
  and had no parser-visible tasks
- Audit session: `s_1781442480067_44`

The audit reported seven findings covering a resolved guard-failure pattern,
schema mismatches, stale workflow references, and unenforced budgets.

## Owner response

1. The FM-3.4 guard-waste finding was already resolved by
   `persistent-task:skip`; no retrospective task was needed.
2. `budget.sessionsPerDay` was decorative. The owner deferred general budget
   enforcement because no budget incident existed.
3. The obsolete `proposed` and `ready` tree states had already been removed.
4. The phantom `platform-signal-intake-loop` workflow had been superseded by
   the then-current project planner.
5. Repeated hourly review was accepted at the time; no change was made.
6. The project did exist in the projects table; the audit query was too narrow.
7. The orphaned `event-native-project-task-loops-review` task was superseded by
   V3 loader work, and its parent workstream was closed.

Later architecture replaced the project discussion loop with App-owned Tasks
and Events. Current behavior is defined by `app.ts` and the Tier-2 documents.
