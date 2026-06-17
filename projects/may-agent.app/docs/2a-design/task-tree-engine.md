# Task Tree Engine Design

## Purpose

The task tree is the project owner's durable thinking map. It shows how the
project is understood, how the goal is decomposed, what work is active, what was
learned, and where humans can steer the project.

It is not a scheduler queue, retry log, or workflow attempt history. Runtime
attempts belong in infra traces. Domain facts belong in the domain workspace.
The task tree links to both, but its job is to keep the project reasoning
reviewable.

Done tasks stay useful. They are milestones, decisions, verified outputs, or
process knowledge that the project owner and future workers can reuse. Noisy
attempt detail should be archived or linked out, not preserved as live tree
branches.

The tree is managed exclusively through task-tree tools. Direct JSON edits are
for migration and repair only.

## Core Principle

> The project owner is the brain. The task-tree tool enforces structure and
> computes projections. Workers execute assigned leaves and return evidence.

Workflow code should wake owners and workers, pass compact context, and emit
events. It should not encode project strategy, task decomposition policy, retry
policy, or domain truth.

## Persisted State Model

A task has exactly one persisted `state`:

| State     | Meaning                                                                    | Who sets it                       |
| --------- | -------------------------------------------------------------------------- | --------------------------------- |
| `backlog` | Work exists but is not currently executing.                                | Owner                             |
| `active`  | A worker/session owns this task execution.                                 | Assignment tool / worker workflow |
| `review`  | Worker returned a claim; owner must judge result, evidence, and next step. | Worker                            |
| `done`    | Owner accepted the result as durable project understanding.                | Owner                             |
| `blocked` | Owner confirmed a real external blocker with an exact resume condition.    | Owner                             |

Only these five values are valid persisted states.

The word `state` is canonical. Older files may still use `status` during
migration; tools may read `status` as compatibility input, but new writes should
write `state`.

## Not States

Keep the lifecycle small. These concepts are important, but they are not
persisted states:

| Concept             | Representation                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Ready/runnable      | Computed from `backlog` leaf + dependencies done + no active conflict.                       |
| Decomposed          | Structural: `children.length > 0`; optional tag or kind may explain branch type.             |
| Proposed            | `backlog` with context such as `approval.state` or `priority`.                               |
| Accepted            | `done`; acceptance details live in `done_at`, `done_by`, `summary`, `evidence`.              |
| Failed              | `review` with `result: "failed"` and evidence; owner decides rework, block, or done-partial. |
| Superseded/replaced | `state: "done"` with `resolution: "replaced"` and `replaced_by`, or archive if low value.    |
| Cancelled           | `state: "done"` with `resolution: "cancelled"` and reason.                                   |
| Waiting/no_work     | Invalid. Convert to concrete `backlog`, exact `blocked`, or `done` with a clear resolution.  |

This keeps the tree readable and prevents the workflow from circling through
control states instead of solving the project.

## Lifecycle

```text
backlog -> active -> review -> done
                         -> backlog   (rework, split, retry, or follow-up)
                         -> blocked   (real external blocker)

blocked -> backlog       (resume condition satisfied)
backlog -> done          (rare owner-recorded fact, milestone, or cancellation)
```

Parent nodes use the same five states. A parent with children is not in a
special "decomposed" state. Its state is the owner's current rollup judgment for
that branch:

- `backlog`: branch has open child work or needs more decomposition.
- `active`: branch is currently being driven through active child work.
- `review`: child results require owner rollup before the branch is trusted.
- `done`: owner rolled up the branch into durable understanding.
- `blocked`: the whole branch is stopped by a confirmed external blocker.

The tool computes parent hints; it does not mutate parent state by itself.

## Roles

### Project Owner

The owner owns all project judgment:

- decomposes tasks and creates backlog leaves
- reviews `review` claims
- rolls up parent branches
- records done summaries and evidence links
- decides whether a failure means rework, retry, split, replacement, or block
- confirms real external blockers
- assigns runnable backlog leaves
- folds human steering and problem-solver results into the tree

The owner should keep moving until available worker capacity is filled or the
tree records exact blockers explaining why it cannot be filled.

### Worker

The worker receives one owner-created assignment:

- verifies it owns the current active task/attempt
- works only that task
- writes or links evidence
- emits a completion claim into `review`

The worker must not reshape sibling branches, roll up parents, mark a task
done, create planning/control tasks, or decide project strategy.

### Problem Solver

The problem solver is a focused worker for failures and blockers. It is woken by
problem events, investigates one root cause, and returns evidence. It may fix
local runner, replay, app, or environment defects. It does not mutate durable
task meaning.

The owner reconciles the solver result into the affected task branches.

## Tool Responsibilities

The task-tree tool provides safe primitives:

```typescript
// Owner mutations
tree.create(parentId, task); // add backlog leaf or branch
tree.decompose(nodeId, children); // add children and keep parent state valid
tree.rework(nodeId, reason); // review -> backlog
tree.markDone(nodeId, summary); // review/backlog -> done
tree.block(nodeId, blocker); // review/backlog -> blocked
tree.unblock(nodeId, reason); // blocked -> backlog
tree.replace(nodeId, replacementIds); // done + resolution/replaced_by metadata

// Assignment / worker mutations
tree.assign(nodeId, assignment); // backlog -> active
tree.submit(nodeId, result, evidence); // active -> review

// Read-only projections
tree.summary();
tree.next();
tree.readiness(nodeId);
tree.kanban();
tree.rollup(nodeId);
tree.check();
```

The tool enforces structure and computes projections. It should reject invalid
states and invalid transitions. It should not infer project strategy.

The project root should stay focused on durable project responsibilities, but
that is owner judgment, not a hard tool decision. The task-tree tool manages
schema, frame, layout, links, locks, derived projections, and safe mutations. It
does not decide whether task content belongs under a specific branch.

`tree.check()` must validate tree shape, not only JSON shape:

- exactly one root, matching `root_task_id`
- every child pointer and `parent_id` agrees both ways
- no missing child, parent, dependency, or active-task references
- no persisted legacy states such as `ready`, `accepted`, or `decomposed`
- root, parent, child, dependency, and active-task references are internally
  consistent

## Derived Projections

Derived predicates are computed fresh and never persisted as state:

| Predicate             | Meaning                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `runnable`            | Backlog leaf; all dependencies are done; no conflict with active work. |
| `dependency-blocked`  | Backlog leaf waiting for dependency completion.                        |
| `conflict-blocked`    | Backlog leaf conflicts with active work.                               |
| `needs-decomposition` | Backlog leaf appears too broad for one worker session.                 |
| `rollup-hint`         | Children suggest the owner should review parent state.                 |
| `stale`               | Task has not moved within the configured threshold.                    |

Example readiness:

```typescript
function isRunnable(node): boolean {
  if (node.state !== "backlog") return false;
  if (node.children.length > 0) return false;
  for (const dep of node.depends_on ?? []) {
    if (tasks[dep].state !== "done") return false;
  }
  for (const active of activeTasks) {
    if (active.conflict_scope === node.conflict_scope) return false;
  }
  return true;
}
```

## Rollup

Parent state is owner judgment, not an automatic aggregate. The tool only emits
hints:

| Hint                         | Owner decision                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| All children `done`          | Mark parent `done`, or add remaining backlog if the branch is not actually complete. |
| Any child `review`           | Review child evidence before trusting the branch.                                    |
| Any child `blocked`          | Confirm branch blocker, create local unblock/retry work, or move to unrelated work.  |
| Child mix is stale/confusing | Rewrite, split, archive, or replace the branch.                                      |

When a parent becomes `done`, it must carry a useful summary of what the branch
proved or learned. Do not hide useful milestones. Archive only low-value
mechanical detail after the parent summary preserves the understanding.

## Human Steering

Human feedback should attach to the closest relevant task node and wake the
owner directly with a context-rich event:

```json
{
  "type": "project.owner.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "urgency": "high",
  "data": {
    "project": "aks-rp-e2e",
    "reason": "human-steering",
    "params": {
      "task_id": "project",
      "comment": "Review this branch and add missing Go-test discovery work.",
      "context": {
        "ui": "kanban"
      }
    }
  }
}
```

Do not require comments or discussion entries as an intermediate control path.
Discussion streams may keep an audit copy, but the owner wake event is what
moves the project.

## Kanban Projection

Kanban is a workflow projection of the tree, not a second source of truth.
Only leaf tasks should appear as cards. Branch nodes appear in the tree view.

| Lane        | Source                                      |
| ----------- | ------------------------------------------- |
| Backlog     | `backlog` leaf tasks, with readiness badges |
| In Progress | `active` leaf tasks                         |
| Review      | `review` leaf tasks                         |
| Blocked     | `blocked` leaf tasks                        |
| Done        | `done` leaf tasks and visible milestones    |

Readiness badges may show why a backlog card is runnable, dependency-blocked,
conflict-blocked, stale, or too large. There is no `ready` lane and no persisted
`ready` state.

Collapsed tree nodes should show child counts by the five states so a human can
hide detail without losing branch health.

## Focus Plans

A focus plan is a normal task branch that exposes mid-term strategy. It is not a
separate planning system and not a workflow-control branch.

```json
{
  "id": "focus-20260613-rest-execution-feedback",
  "kind": "focus_plan",
  "state": "backlog",
  "goal": "For the next 24h, prioritize REST replay execution and evidence feedback over broad new feature discovery.",
  "context": {
    "horizon": "24h or until done",
    "approval": {
      "state": "requested",
      "escalation_id": "esc_..."
    },
    "success_criteria": [
      "At least 5 live REST runs started",
      "Runner/spec failures classified",
      "Model paths updated from evidence"
    ],
    "progress_review": {
      "state": "on_track",
      "reviewed_at": "2026-06-13T12:00:00Z"
    }
  },
  "children": ["execution-and-verification", "model-feedback"]
}
```

Focus progress states such as `on_track`, `off_track`, `completed`, `stale`, and
`blocked` belong under `context.progress_review.state`; they are not task
lifecycle states.

## Integrity Checks

`tree.check()` validates:

- every task has one valid `state`
- no persisted `ready`, `proposed`, `accepted`, `superseded`, or `decomposed`
  task state remains after migration
- every reference points to an existing node
- no parent-child cycle or dependency cycle exists
- root exists and is reachable
- leaves have empty `children`
- child tasks point back to the correct `parent_id`
- `active` tasks have assignment/session context
- `review` tasks have result and evidence or a clear claim packet
- `done` tasks have a summary, resolution, or archive summary
- replaced tasks have `resolution: "replaced"` and `replaced_by`
- `blocked` tasks have `blocker.condition`, owner, and resume condition
- dependencies reference tasks whose `state` must become `done`
- visible tree size/depth/child-count limits are warnings, not hidden policy

The checker reports rollup and liveness hints; it does not fix project meaning.

## Data Structure

```json
{
  "version": 2,
  "project": "example",
  "updated_at": "2026-06-12T00:00:00Z",
  "root_task_id": "goal",
  "tasks": {
    "goal": {
      "id": "goal",
      "goal": "Project goal description",
      "state": "backlog",
      "parent_id": null,
      "children": ["feature-a", "feature-b"],
      "created_at": "2026-06-01T00:00:00Z",
      "updated_at": "2026-06-12T00:00:00Z"
    },
    "feature-a": {
      "id": "feature-a",
      "goal": "Feature A lifecycle",
      "state": "done",
      "summary": "Feature A lifecycle is verified by staging REST replay.",
      "evidence": ["runs/feature-a-basic/run.json"],
      "reusable_for": ["Feature A negative cases", "Feature A cleanup checks"],
      "parent_id": "goal",
      "children": [],
      "created_at": "2026-06-01T00:00:00Z",
      "updated_at": "2026-06-10T00:00:00Z"
    },
    "fb-spec-1": {
      "id": "fb-spec-1",
      "goal": "Feature B basic behavior",
      "state": "backlog",
      "parent_id": "feature-b",
      "children": [],
      "depends_on": [],
      "created_at": "2026-06-10T00:00:00Z",
      "updated_at": "2026-06-10T00:00:00Z"
    }
  }
}
```

## Node Fields

| Field             | Required        | Description                                                                                |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `id`              | yes             | Unique task id.                                                                            |
| `goal`            | yes             | What this task accomplishes or records.                                                    |
| `state`           | yes             | One of `backlog`, `active`, `review`, `done`, `blocked`.                                   |
| `parent_id`       | yes except root | Parent task id.                                                                            |
| `children`        | yes             | Child task ids; empty for leaves.                                                          |
| `created_at`      | yes             | ISO timestamp.                                                                             |
| `updated_at`      | yes             | ISO timestamp.                                                                             |
| `depends_on`      | no              | Task ids that must be `done` before this leaf is runnable.                                 |
| `result`          | no              | Worker claim when state is `review`.                                                       |
| `evidence`        | no              | Evidence references.                                                                       |
| `summary`         | no              | Done/review summary or branch rollup.                                                      |
| `resolution`      | no              | `completed`, `replaced`, `cancelled`, or another explicit owner resolution for done tasks. |
| `replaced_by`     | no              | Replacement task ids when `resolution` is `replaced`.                                      |
| `blocker`         | no              | Confirmed external blocker with condition, owner, and resume condition.                    |
| `conflict_scope`  | no              | Mutex group for parallel dispatch.                                                         |
| `session`         | no              | Primary task session and handoff summary.                                                  |
| `context`         | no              | Compact task-owned working context.                                                        |
| `context_ref`     | no              | Spillover file for large task-owned context.                                               |
| `archived`        | no              | True when low-value detail has been collapsed.                                             |
| `archive_summary` | no              | Human-readable summary of archived subtree.                                                |
| `tags`            | no              | Optional labels such as `focus_plan`, `milestone`, or `needs-review`.                      |

## Migration

Existing apps may still contain older `status` values. Migrate task data with a
small audited tool, not by hand-editing large JSON files.

Mapping:

| Old field/value            | New representation                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `status`                   | Rename to `state`. Keep read compatibility temporarily.                                                                              |
| `accepted`                 | `state: "done"`, preserve `accepted_at/by` or migrate to `done_at/by`.                                                               |
| `done`                     | Keep `state: "done"`.                                                                                                                |
| `ready`                    | `state: "backlog"`; readiness is computed.                                                                                           |
| `proposed`                 | `state: "backlog"`; approval/proposal detail stays in `context`.                                                                     |
| `decomposed` with children | Choose branch state from owner rollup: usually `backlog`, `active`, `review`, `done`, or `blocked`; structure comes from `children`. |
| `decomposed` leaf          | Invalid old data. Convert to `backlog` unless evidence proves it is `done` or `blocked`.                                             |
| `superseded`               | `state: "done"`, `resolution: "replaced"`, `replaced_by: [...]`, `reason`.                                                           |
| `cancelled`                | `state: "done"`, `resolution: "cancelled"`, `reason`.                                                                                |

Parent migration guidance:

- all children done and parent has a useful summary: parent `done`
- any child active and branch is currently being driven: parent `active`
- any child review and branch needs owner rollup: parent `review`
- any child blocked and no unrelated child work can progress: parent `blocked`
- otherwise parent `backlog`

After migration, run `tree.check()` and compare `tree.kanban()` counts with the
UI. The UI should read counts directly from the task-tree tool projection.

## App Integration

The tree integrity checker should run as part of each app's `bun run check`.

Recommended order:

```text
format -> syntax -> typecheck -> app integrity -> task tree integrity -> tests
```

The check should fail on invalid states, broken references, and impossible
transitions. It may warn on staleness, depth, and tree-size limits.
