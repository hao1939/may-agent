# Task Tree Engine Design

## Purpose

The task tree is the project owner's durable thinking map. It shows how the
project is understood, how the goal is decomposed, what work is active, what was
learned, and where humans can steer the project.

For the compact end-to-end app/project control-loop model, see
`app-project-integrity.md`. This document is the task-tree schema and tool
contract beneath that mechanism.

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

Only `done` is final. Every other state must have an active driver that moves
the task toward `done` or records the exact wake condition needed to continue.

```text
Every non-done task must either:
1. be actively executing,
2. be owner-reviewable now,
3. have a concrete event or resume condition that will wake the owner later, or
4. be invalid and repaired by owner review.
```

| State     | Driver                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `backlog` | Owner assigns if runnable. If not runnable, owner repairs dependency, splits, asks, or records a terminal `done` disposition.          |
| `active`  | Worker emits `project.task.completed`; stale-active watchdog requeues or wakes owner.                                                  |
| `review`  | Owner accepts to `done`, rejects to `backlog`, creates follow-up/problem work, or records a precise blocker.                           |
| `blocked` | Owner periodically rechecks, unblocks, creates problem-solving work, sends/escalates an ask, or records a terminal `done` disposition. |
| `done`    | Final project knowledge. It may be rolled up or compacted, but not worked again as open work.                                          |

Worker sessions are runtime attempts, not durable task identity. A first
assignment may use a stable task session id for traceability, but a retry after
an error review or stale active attempt should use a fresh task session and keep
the old id in `session_history`. This prevents a task from looping through a
terminal/error session while preserving the owner-visible handoff trail.

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
- drives every non-done task toward a final state or exact next wake condition
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

## Blocked Frontier Review

`blocked` is not a final state and not a trash can. It means the owner
confirmed a real blocker and recorded an exact resume condition. A blocked task
can stay blocked temporarily, but every owner review should try to push it
toward final state: solve the local cause, create follow-up work, escalate or
send the external ask, or accept a terminal/product/environment disposition as
`done` when the project has enough evidence.

When blocked-task metrics, watchdogs, human steering, or focus reviews show that
blocked work is dominating the frontier, the project should wake the owner for a
blocked-frontier review before escalating to a human. The task-tree packet should
include structural blocked-frontier context, not only a capped leaf list:

- total blocked leaf count
- largest blocked parent groups
- repeated blocker signatures
- sample task ids and blocker text for each group

This is still only tool output. It does not decide the blocker semantics. It
helps the owner see whether the live tree has one real blocker represented by
many leaves, or many independent waits.

The owner reviews the blocked groups plus dependency-waiting leaves and chooses
one of these actions:

- create or link one visible problem/unblock task for a local, tooling,
  environment, or runner root cause
- unblock or requeue tasks whose resume condition is now satisfied
- convert proven terminal/product/environment dispositions to `done` with
  evidence and retest condition
- escalate only when another owner or human must provide input or take action
- keep a true external wait blocked only after making the ask/send-ready state,
  owner, resume condition, and next review trigger explicit

Two common false blockers should be challenged during owner review:

- **Response-await without send proof.** A task cannot passively wait for a
  reply if the tree also says the ask was not sent, handed off, or escalated.
  The owner should create the concrete send/handoff/escalation work, or replace
  the passive wait with the task that performs that action.
- **Exact-source overblocking.** Missing perfect handwritten source is not
  automatically a real blocker. If the project can still make truthful bounded
  progress with source-equivalent evidence, a draft spec, an evidence ceiling,
  or a replay that clearly marks the uncertainty, the owner should create that
  work instead of freezing the branch.

Blocked-frontier review should burn down noise, not merely touch one leaf. If
many leaves share one real external wait, the owner keeps or creates one
family-level wait that carries the affected task ids, owner, resume condition,
and next review trigger. Duplicate child waits can then be marked `done` with a
replacement/cancelled resolution only after the family-level wait preserves their
meaning. If the wait is locally fixable, the owner creates one problem/unblock
task instead of keeping many blocked leaves. If the result is terminal, the owner
marks the leaf done with the evidence and retest condition.

Dependency-waiting backlog is part of the same review. If the dependency is
missing, already done, stale, or blocked by a locally fixable problem, the owner
repairs the branch instead of leaving the task invisible behind a dependency
edge. If the dependency is a true source-holder/operator/product wait, the owner
keeps the dependency blocked and ensures the outgoing ask or resume condition is
clear.

Workers do not decide this. The owner decides what the blocker means, and the
task-tree tool only preserves the structure.

Large or long-running projects should also schedule a regular blocked-frontier
owner review. This is not a separate controller and it should not auto-retry
blocked leaves. It is just a periodic owner wake with the current tree packet:
the owner rechecks whether resume conditions changed, creates problem-solving
work for locally fixable blockers, escalates or sends asks for external
blockers, accepts terminal dispositions when evidence is sufficient, and moves
to unrelated runnable work only after the sampled blockers have a clear path
toward closure.

## Live Tree Hygiene

The live task tree should stay focused and readable. It is the project owner's
current thinking surface, not a permanent transcript of every retry, repair,
rerun, and intermediate note. Full execution history belongs in runtime traces,
journals, archives, and domain evidence files.

Large projects should periodically tidy the tree during normal owner rollup:

1. Review completed child work.
2. Summarize durable understanding on the parent.
3. Keep useful milestone children visible.
4. Archive low-value done leaves that are fully represented by the parent
   summary and evidence links.
5. Continue planning from the cleaner tree.

This is an owner decision. The task-tree tool provides safe mechanics and
integrity checks, but it must not decide which project facts matter.

### What Stays Live

Keep these nodes in the live tree:

- active work
- backlog work
- review work awaiting owner judgment
- blocked work with an exact blocker and resume condition
- done milestone tasks that carry durable knowledge
- branch parents that summarize completed work and remaining gaps
- done leaves referenced by active dependencies

### What Can Be Archived

After parent rollup preserves the useful meaning, archive low-value done leaves
such as:

- duplicate retry leaves
- superseded attempts
- mechanical "write note" or "rerun after repair" leaves
- repeated source-narrowing or cleanup steps whose final conclusion is already
  captured on the parent
- transient worker process detail that is already available in session/runtime
  traces

Archiving is not deletion of knowledge. The archive must keep the original task
records recoverable, and the parent must link to the archive path and record how
many children were folded away.

### Rollup Summary Contract

Before archiving completed child leaves under a parent, the owner should make
the parent summary answer:

- what was proven or learned
- which evidence files or model/spec/replay artifacts now carry the durable
  result
- which gaps remain open
- which blockers remain, with exact resume condition
- what the next useful action is

This summary is what future planner and worker sessions should read first. They
should not need to rediscover the same context by scanning dozens of historical
children.

### Tool Contract

The task-tree tool may provide branch-aware hygiene operations such as:

```typescript
tree.rollup(parentId, summary);
tree.compactDone(parentId, { archiveDoneChildren: true });
```

In command form, the normal owner path is:

```bash
bun run task-tree rollup-parent <parent-id> \
  --summary "what the parent now knows and what remains" \
  --archive-done <child-id> \
  --archive-done <child-id>
```

This command does not decide what matters. The owner agent decides the summary
and which completed children are low-value enough to fold away. The command only
performs the safe archive operation.

The planning packet may include structural hygiene data such as safe done leaf
counts and parent-level compaction candidates. This is not an instruction to
compact. It is only a visibility aid so the owner can notice a noisy branch and
decide whether the parent already carries enough durable meaning to fold old
children away.

For oversized legacy trees, a batch compaction command may exist:

```bash
bun run task-tree compact-done --limit 200
```

Batch compaction is for recovery from already-noisy trees. Normal project
progress should compact while rolling up a parent after child review.

Batch compaction must run bottom-up. It should choose the deepest safe done
leaf group under one parent, archive that group, repair the immediate parent,
then recompute the tree. If that parent becomes a safe done leaf, compact that
parent next before jumping sideways to another branch. This matters because the
parent may become compactable only after its lower-level detail has been folded
away. A batch command that grabs arbitrary done leaves across the whole tree
produces a noisy and misleading shape.

The tool should enforce only structural safety:

- never archive active, review, backlog, or blocked leaves
- never archive a done leaf that is still referenced by a dependency unless the
  dependency is first rewritten by the owner
- never archive children unless the parent keeps a summary and archive link
- preserve parent/child integrity, root integrity, and kanban projections
- write each archive to a unique path, even when multiple rollups happen in the
  same second
- write an audit journal entry with archive path, count, parent id, and reason

The tool should not inspect domain content to decide whether a child is
important. If the owner has not provided a useful parent summary, the tool should
refuse the archive operation.

### Planner Behavior

Planner wakes should keep the packet small enough for reliable reasoning. The
planner workflow may run cheap structural repair before building the packet. If
the tree is too large, done-leaf count is high, or the planner recently timed
out, the owner should be asked to do a bounded hygiene pass before deeper
planning.

The hygiene pass is still project work:

- it should be visible as owner rollup, not hidden background deletion
- it should prefer branch-by-branch compaction over arbitrary global pruning
- it should leave the live tree more focused on current goals and blockers
- it should not block urgent active worker completions or human steering

Useful metrics for triggering hygiene:

- total task count
- done leaf count
- archived done leaf count
- planning packet size
- planner timeout count

These metrics are signals. A breach should wake the owner with a compact
request such as: "tidy the task tree before continuing planning." The owner
still decides the actual rollup.

### Project Hygiene Checks

`tree.check()` stays structural. It should validate the tree frame, links,
states, references, and projections. It should not understand domain-specific
truth such as whether an AKS feature path is truly terminal.

Project apps may add warning-level hygiene checks that combine task-tree context
with domain model state. These checks should not block generic task-tree
operations, but they should wake the owner when the tree and domain model appear
misaligned.

Example for `aks-rp-e2e`:

- a backlog or blocked retry task references a model path
- the referenced model path has `terminal=true` or `verdictFinal=true`
- the task goal/blocker says the path should be retried, reopened, or
  reverified

That should produce a project hygiene warning, not a tree integrity failure:

```text
model verdict may be stale; owner should reconcile the model path before retry
planning
```

This catches domain issues such as stale terminal verdicts preventing legitimate
retry work, while preserving the core rule that the task-tree tool manages
structure and the project owner decides meaning.

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
