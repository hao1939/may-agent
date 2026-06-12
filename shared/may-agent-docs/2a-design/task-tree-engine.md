# Task Tree Engine Design

## Purpose

The task tree is a project's shared thinking surface: how the agent
understands the goal, how it wants the project to be done, which claims are
verified, which branches were replaced, and where work is blocked. It is not a
TODO list, scheduler queue, or attempt log.

The tree is also the main human steering surface. A human should be able to
review any branch, understand why it exists, and attach feedback directly to
that context. The planner consumes that feedback when it updates the tree.

Accepted tasks are durable project knowledge. They record understanding,
milestones, and facts the agent can reuse later; they are not merely completed
work to hide as soon as execution finishes.

The tree is managed exclusively by tools. No direct JSON editing.

## Core Design Principle

> The tool enforces structure and computes projections. The planner makes
> project judgments. The worker only claims executable leaves and submits
> evidence.

## Node Lifecycle

> **Cross-reference**: `project-execution-engine.md` defines a different status
> vocabulary (`proposed`, `ready`, `claimed_done`, `rejected`) for the same task
> tree. This doc (task-tree-engine) is the **tool spec** — what the tree library
> enforces. The execution-engine doc is the **workflow spec** — what planners
> and workers follow. Mapping: `backlog` here = `proposed`/`ready` there;
> `review` here = `claimed_done` there. See KE-1858 for the full comparison.

```
backlog → active → review → accepted
                          → backlog      (planner reworks)
                          → blocked      (planner confirms external blocker)
                          → superseded   (planner replaces with better work)
```

### Persisted statuses

| Status       | Meaning                                                   | Who sets it                   |
| ------------ | --------------------------------------------------------- | ----------------------------- |
| `backlog`    | Work to be done                                           | Planner creates or reworks it |
| `active`     | Worker is executing                                       | Worker claims it              |
| `review`     | Worker finished, claim needs verification                 | Worker submits it             |
| `accepted`   | Planner verified the claim; durable project understanding | Planner accepts it            |
| `blocked`    | Concrete external blocker confirmed by planner            | Planner sets it               |
| `superseded` | Replaced by better understanding                          | Planner replaces it           |
| `decomposed` | Not a leaf; children represent the work                   | Planner decomposes it         |

### Derived predicates (computed by tools, never persisted)

| Predicate             | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `ready` / `runnable`  | Backlog leaf + all depends_on accepted + no conflict overlap    |
| `dependency-blocked`  | Backlog but depends_on not yet accepted                         |
| `conflict-blocked`    | Backlog but conflict_scope overlaps with active task            |
| `stale`               | Untouched beyond staleness threshold                            |
| `needs-decomposition` | Backlog leaf that is too large for a single worker session      |
| `rollup-hint`         | All children accepted — planner should review for parent accept |
| `blocked-hint`        | A child is blocked — planner should review parent state         |
| `frontier`            | Next actionable work                                            |
| `kanban-lane`         | Which Kanban column this node belongs to                        |

## Roles

### Worker

- Asks for one runnable backlog leaf via `tree.next()`
- Claims it (`backlog → active`)
- Executes the task
- Submits to `review` with result + evidence
- If the worker encounters an obstacle, it submits `review` with
  `result: "blocked_claim"` and evidence of the blocker. The planner
  decides whether it is a real external blocked, local rework,
  superseded, or accepted partial progress.
- Does NOT set blocked directly, replan, decompose, or create siblings

### Planner

- Reviews `review` tasks and decides: accept, rework (back to backlog),
  block (confirm external), supersede, or decompose further
- Creates new `backlog` tasks
- Supersedes outdated branches
- Applies parent transitions based on tool rollup hints
- Records accepted knowledge summaries and evidence
- Triggers archive of low-value detail while preserving useful milestones
- Owns all tree shape mutations
- Creates or links visible problem-solving tasks when failures/blockers appear,
  and reconciles `project.problem.resolved` / `project.problem.escalated` events
  back into affected task branches

Planner wakeups should start with a deterministic quick-refill pass: assign
already-ready, clear, dependency-satisfied, non-conflicting leaves up to worker
capacity and dispatch `project.task.assigned` immediately. This does not make
new project judgments; it only executes work the planner already marked ready.
If quick refill fills capacity and there is no pending review or high-priority
human steering, the wake may finish without an owner-agent planning session.
If human steering, review work, or unclear tree state exists, the owner-agent
planning session still runs after quick refill.

### Problem Solver

The problem solver is a focused worker for blockers and failures. It is woken by
`project.problem.requested`, investigates one stable `problemKey`, and emits
`project.problem.resolved` or `project.problem.escalated`.

It can:

- inspect affected tasks, run artifacts, domain files, and runtime/session
  evidence
- fix local runner, replay, test, or app defects
- verify that the fix removes the blocker, or prove that the blocker is external
- produce exact resume conditions and affected-task recommendations

It cannot:

- accept tasks or roll up parents
- reshape task branches
- assign/retry task leaves directly
- mark the project complete

The planner owns the durable tree decision after the solver reports back.

Problem-solving tasks are normal visible tree nodes, usually under the affected
lane or a small problem-solving branch. Use one shared node for one shared root
cause:

```json
{
  "id": "staging-arm-auth-unavailable-20260612",
  "kind": "problem_solver",
  "status": "active",
  "context": {
    "problemKey": "aks-rp-e2e:staging-arm-auth-unavailable",
    "affectedTasks": [
      "ms-create-time-staging-execute-20260612",
      "wi-upgrade-survival-staging-execute-20260612"
    ]
  },
  "goal": "Diagnose why staging replay workers cannot acquire ARM credentials, fix local runner environment when possible, or escalate with exact resume conditions.",
  "outputs": [".state/problem-runs.jsonl", "tasks/tree.json"],
  "acceptance": [
    "Root cause classified",
    "Affected tasks have a retry, supersede, or escalation path"
  ]
}
```

This keeps problem resolution large and loud without introducing another
planner.

### Tool

- Enforces structural invariants on every mutation
- Computes derived predicates (readiness, rollup hints, Kanban, staleness)
- Projections are read-only — the tool does not mutate parent status
  based on child state. It computes rollup hints; the planner applies
  parent transitions.
- Auto-collapses superseded chains (structural cleanup, not judgment)
- Archives accepted detail only when the planner asks for compaction with an
  explicit knowledge summary

## Structural Invariants

The tool enforces on every mutation:

1. Every node has exactly one parent (except root).
2. Node IDs are unique.
3. `active` must have been `backlog` with computed readiness satisfied.
4. `review` must have `result` and `evidence` fields.
5. `accepted` can only transition from `review` (planner verified).
6. `superseded` must have `supersededBy` and `reason`.
7. `blocked` must have `blocker` with `condition` and `category`.
8. `decomposed` nodes have children; leaf nodes do not.
9. `superseded` and accepted knowledge claims are immutable. Tool-owned
   archival metadata may be added without changing the accepted claim.
10. No references to non-existent nodes.
11. No circular dependencies.

## Rollup and Parent Status

Parent status is NOT automatically mutated by the tool. The tool computes
rollup hints; the planner decides:

| Hint                    | Tool computes                 | Planner decides                                       |
| ----------------------- | ----------------------------- | ----------------------------------------------------- |
| All children `accepted` | `rollup-hint: all-accepted`   | Accept parent, or keep decomposed if more work needed |
| Any child `blocked`     | `blocked-hint: child-blocked` | Block parent, rework the child, or supersede          |
| Mix of statuses         | No hint                       | Keep decomposed                                       |

This keeps the planner as the brain. The tool never makes project judgments.

## Accepted Knowledge

An `accepted` node means the planner verified the worker claim and turned it
into project knowledge. Accepted nodes should answer:

- What did we learn or prove?
- What evidence supports the claim?
- What can future work reuse?
- Does this close the parent branch, or does it reveal more work?

Useful accepted nodes stay visible in the live tree as milestones. Examples:

- a golden path that future features should reuse
- a feature behavior verified by real staging execution
- a reusable runner/script pattern
- a project decision that changes how future tasks should be planned

Low-value accepted detail should be archived. Examples:

- mechanical subtasks after their parent summary captures the result
- repeated execution attempts
- obsolete rework branches
- raw logs already linked from evidence

Accepted knowledge fields:

```json
{
  "status": "accepted",
  "summary": "REST add-existing ManagedSystem pool lifecycle passed on staging.",
  "evidence": ["runs/managedsystem-rest-add-existing/run.json"],
  "reusable_for": [
    "managedsystem delete lifecycle",
    "managedsystem immutability checks"
  ],
  "accepted_at": "2026-06-12T...",
  "accepted_by": "planner"
}
```

The tree should preserve the accepted backbone of project understanding. It
should archive noisy detail, not erase what the project has learned.

Accepted knowledge is immutable after acceptance. Later work can supersede it
with better understanding, but should not silently rewrite the original claim.

## Tool API

```typescript
// Planner mutations
tree.create(parentId, task); // add backlog leaf
tree.decompose(nodeId, children); // split leaf into children
tree.accept(nodeId, reason, knowledge); // verify and accept claim
tree.rework(nodeId, reason); // review → back to backlog
tree.supersede(nodeId, reason, replacementIds); // replace with better work
tree.block(nodeId, blocker); // confirm external blocker
tree.unblock(nodeId, reason); // clear blocker

// Worker mutations
tree.claim(nodeId); // backlog → active
tree.submit(nodeId, result, evidence); // active → review

// Cleanup (planner-triggered)
tree.archive(nodeId, summary); // collapse low-value accepted detail
tree.prune(nodeId, reason); // remove irrelevant subtree

// Derived queries (tool-owned projections)
tree.status(); // compact summary
tree.next(); // runnable backlog leaves
tree.readiness(nodeId); // why this task is or isn't ready
tree.kanban(); // Kanban projection with readiness badges
tree.rollup(nodeId); // parent rollup hints
tree.stale(olderThan); // untouched nodes
tree.check(); // integrity validation
```

## Tree UI and Kanban Projection

The tree view is the primary human/agent reasoning surface. It should show:

- the task goal or claim as the primary text
- the reason this branch exists
- accepted knowledge summaries and evidence links
- child status summaries for decomposed parents
- task-linked human feedback controls
- derived readiness only as a badge on backlog leaves

Task IDs, leases, conflict scopes, and scheduler details are secondary
metadata. They should not dominate the tree view.

Human feedback from the tree UI should wake the planner directly. Over
`/api/events`, keep the durable project event payload under `data`:

```json
{
  "type": "project.planning.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "urgency": "high",
  "data": {
    "project": "aks-rp-e2e",
    "reason": "human-steering",
    "params": {
      "task_id": "project",
      "action": "reflect_and_add_missing_work",
      "comment": "Review this branch and add missing Go-test discovery work.",
      "context": {
        "ui": "kanban"
      }
    }
  }
}
```

Do not route explicit task-tree steering through a generic comment transport.
Discussion streams may keep an audit copy, but the planner wakeup event is the
control path. Human steering should use high urgency; routine watchdog/refill
wakes can stay normal urgency.

The planner must treat recent high-priority human steering as pending planner
input, not only as the current trigger event. A watchdog/refill wake may be the
event that starts the planner, but the planner prompt should still surface
pending high-priority human steering before routine refill work. If the user
points out a missing root task or lane, the planner must either create the task
under the requested parent or record an explicit refusal/blocker in the tree.

Kanban is a workflow projection, not the source of truth.

`tree.kanban()` computes lanes and readiness badges. The UI should prefer the
tool-owned projection. If the persisted projection is stale relative to the
current tree, the UI must show a stale-projection warning before using a
tree-derived display fallback. The fallback is a display repair, not a new
source of truth; the task-tree tool still owns the canonical projection.

| Lane        | Source                                      |
| ----------- | ------------------------------------------- |
| Backlog     | `backlog` nodes                             |
| In Progress | `active` nodes                              |
| Review      | `review` nodes                              |
| Blocked     | `blocked` nodes                             |
| Done        | `accepted` nodes                            |

Superseded nodes and archived accepted detail are tree history, not workflow
state. They belong in the tree view for understanding how thinking evolved,
not in the Kanban board which shows current actionable work.

Only leaf nodes appear as cards. `decomposed` parents are structural — they
appear in the tree view, not the Kanban.

The project Kanban page should present three surfaces together:

- Project health metrics: flow, knowledge coverage, live execution, and
  hygiene signals from the registered metric system.
- Current workflow projection: leaf task cards by lane, with compact readiness
  and blocker context.
- Task tree context: the planner's reasoning tree, accepted knowledge, evidence,
  child status summaries, and task-local feedback.

Human interaction should be close to context. The page should provide:

- project-level steering near metrics for refill, execution review, alert
  triage, and next-move feedback
- task-level steering on the selected tree node for split, audit, challenge,
  unblock, escalation, or rework
- direct `project.planning.requested` events for explicit human steering, with
  selected task id, UI source, and free-form comment in `data.params`

Backlog cards include readiness badges:

| Badge                 | Meaning                                 |
| --------------------- | --------------------------------------- |
| `runnable`            | Ready to dispatch                       |
| `dependency-blocked`  | Waiting on another task                 |
| `conflict-blocked`    | Conflict scope overlap with active task |
| `stale`               | Untouched beyond threshold              |
| `needs-decomposition` | Too large for single worker session     |

## Readiness Computation

`tree.next()` returns runnable tasks, computed fresh each call:

```typescript
function isReady(node): boolean {
  if (node.status !== "backlog") return false;
  if (node.children.length > 0) return false;
  for (dep of node.depends_on) {
    if (tasks[dep].status !== "accepted") return false;
  }
  for (active of activeTasks) {
    if (active.conflict_scope === node.conflict_scope) return false;
  }
  return true;
}
```

No persisted ready state. No stale readiness.

`tree.readiness(nodeId)` explains why:

```json
{
  "ready": false,
  "reasons": [
    "depends_on 'setup-cluster' is not accepted (status: active)",
    "conflict_scope 'staging-cluster' has active task 'run-spec-a'"
  ]
}
```

## Integrity Checker

`tree.check()` validates the full tree:

### Structural checks

- Every reference (children, depends_on, supersededBy) points to existing node.
- No circular dependencies or parent-child cycles.
- No orphan nodes.
- No duplicate IDs.
- Root exists and is reachable.

### State checks

- `review` nodes have `result` and `evidence`.
- `accepted` nodes have `summary` and evidence references, unless the accepted
  node is a pure rollup with `archive_summary`.
- `superseded` nodes have `supersededBy` and `reason`.
- `blocked` nodes have `blocker.condition`.
- `decomposed` nodes have children.
- Leaves have no children.

### Rollup hints

- Parent with all children `accepted`: emit `rollup-hint` for planner.
- Parent with any child `blocked`: emit `blocked-hint` for planner.

### Design compliance checks

- No undefined or ambiguous statuses.
- No `no_work`, `waiting`, `unknown`, `maybe-later`, `ready`, or empty status.
- No superseded chain longer than 3 (tool auto-collapses).
- No parent with more than 15 children (warn, planner should group).
- No depth greater than 5 (warn, planner should flatten).
- Total visible (non-archived) nodes should not exceed 50 (warn).

### Staleness checks

- `backlog` nodes older than 7 days.
- `active` nodes older than 24 hours.
- `blocked` nodes older than 14 days.

## Outdated and Orphan Handling

### Superseded by better understanding

```typescript
tree.supersede("test-ms-via-cli", {
  reason: "CLI default-payload bug, REST is the proven path",
  replacementIds: ["test-ms-via-rest"],
});
```

Cascades: non-terminal children become `superseded` with reason
`parent-superseded`. This is structural cleanup, not judgment — the planner
already decided to supersede the parent.

### Stale by time

`tree.stale(olderThan)` returns untouched nodes. The planner reviews each:

- Still relevant → touch
- Irrelevant → prune
- Blocked → add concrete blocker

### No fake terminal states

The tool rejects ambiguous states. If work cannot proceed, the planner must
express why:

- Concrete blocker → `tree.block(nodeId, { condition, category })`
- Wrong approach → `tree.supersede(nodeId, reason, replacements)`
- Needs rework → `tree.rework(nodeId, reason)` (back to backlog)
- Done → `tree.accept(nodeId, reason)`

"No work", "waiting", or vague states are integrity violations.

## Compaction

### Archive accepted detail (planner-triggered)

When the planner decides an accepted subtree is complete and the child detail
is no longer useful as live project understanding:

```typescript
tree.archive("managedsystem-pool", {
  summary:
    "ManagedSystem pool REST lifecycle knowledge accepted; 9/9 paths pass, 8 evidence refs",
});
```

Children move to `tasks/archive.json`. The parent keeps the accepted knowledge
summary, evidence refs, and reusable-for hints. `tree.status()` hides archived
details; `tree.detail(nodeId)` retrieves them.

Do not archive a useful milestone just because it is done. Archive only when a
short accepted summary preserves the knowledge better than the full subtree.

### Collapse superseded chains (tool-automatic)

A → B → C collapses to C with note "supersedes A, B". Intermediate nodes move
to archive. This is structural cleanup — no judgment needed.

### Archive location

Live tree: `tasks/tree.json` — current thinking, active work, and accepted
knowledge milestones, ideally ≤50 visible nodes.
Archive: `tasks/archive.json` — collapsed low-value accepted detail and
superseded chains with evidence links. Detail retrievable via
`tree.detail(nodeId)`.

The live tree should always be readable by a human in under a minute.

### Limits

| Limit                   | Value | Enforcement                     |
| ----------------------- | ----- | ------------------------------- |
| Max visible nodes       | 50    | Checker warns                   |
| Max children per parent | 15    | Checker warns, planner groups   |
| Max depth               | 5     | Checker warns, planner flattens |
| Max superseded chain    | 3     | Tool auto-collapses             |

## Data Structure

### tasks/tree.json (live thinking)

```json
{
  "version": 1,
  "project": "example",
  "updated_at": "2026-06-12T...",
  "root_task_id": "goal",
  "tasks": {
    "goal": {
      "id": "goal",
      "goal": "Project goal description",
      "status": "decomposed",
      "parent_id": null,
      "children": ["feature-a", "feature-b"],
      "created_at": "2026-06-01T...",
      "updated_at": "2026-06-12T..."
    },
    "feature-a": {
      "id": "feature-a",
      "goal": "Feature A full lifecycle",
      "status": "accepted",
      "summary": "Feature A lifecycle is verified by staging REST replay.",
      "evidence": ["runs/feature-a-basic/run.json"],
      "reusable_for": ["Feature A negative cases", "Feature A cleanup checks"],
      "archived": true,
      "archive_summary": "4 tasks accepted, 8 evidence refs",
      "parent_id": "goal",
      "children": [],
      "created_at": "2026-06-01T...",
      "updated_at": "2026-06-10T..."
    },
    "fb-spec-1": {
      "id": "fb-spec-1",
      "goal": "Feature B basic behavior",
      "status": "backlog",
      "parent_id": "feature-b",
      "children": [],
      "depends_on": [],
      "created_at": "2026-06-10T...",
      "updated_at": "2026-06-10T..."
    }
  }
}
```

### tasks/archive.json (collapsed detail)

```json
{
  "feature-a-spec-1": {
    "goal": "Feature A basic behavior",
    "status": "accepted",
    "parent_id": "feature-a",
    "archived_at": "2026-06-10T...",
    "evidence": ["run_123.json"]
  }
}
```

## Node Fields

| Field             | Required          | Description                                                        |
| ----------------- | ----------------- | ------------------------------------------------------------------ |
| `id`              | yes               | Unique node identifier                                             |
| `goal`            | yes               | What this task accomplishes                                        |
| `status`          | yes               | backlog, active, review, accepted, blocked, superseded, decomposed |
| `parent_id`       | yes (except root) | Parent node ID                                                     |
| `children`        | yes               | Child node IDs (empty for leaves)                                  |
| `created_at`      | yes               | ISO timestamp                                                      |
| `updated_at`      | yes               | ISO timestamp                                                      |
| `depends_on`      | no                | Node IDs that must be accepted first                               |
| `result`          | no                | Worker result (required at review)                                 |
| `evidence`        | no                | Evidence refs (required at review)                                 |
| `summary`         | no                | Accepted knowledge summary or review result summary                |
| `reusable_for`    | no                | Future tasks/branches that can reuse this knowledge                |
| `accepted_at`     | no                | ISO timestamp when planner accepted the claim                      |
| `accepted_by`     | no                | Planner/owner that accepted the claim                              |
| `supersededBy`    | no                | Replacement node IDs (required when superseded)                    |
| `reason`          | no                | Why superseded/blocked/reworked                                    |
| `blocker`         | no                | `{ condition, category }` (required when blocked)                  |
| `conflict_scope`  | no                | Mutex group for parallel dispatch                                  |
| `archived`        | no                | True when subtree is collapsed                                     |
| `archive_summary` | no                | Human-readable summary of archived subtree                         |
| `priority`        | no                | Dispatch priority within backlog                                   |

## Integration

The tree integrity checker runs as part of `bun run check`:

```
format → whitespace → compile → wiring → schema → tree → typecheck
```

Fails on structural violations. Warns on staleness and limit thresholds.
Emits rollup hints for planner attention.
