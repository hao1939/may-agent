# Task Tree Engine Design

## Purpose

The task tree is a project's structured understanding: how the goal decomposes,
which claims are verified, which branches were replaced, and where work is
blocked. It is not a TODO list or an attempt log.

The tree is managed exclusively by tools. No direct JSON editing.

## Core Design Principle

> The tool enforces structure and computes projections. The planner makes
> project judgments. The worker only claims executable leaves and submits
> evidence.

## Node Lifecycle

```
backlog → active → review → accepted
                          → backlog      (planner reworks)
                          → blocked      (planner confirms external blocker)
                          → superseded   (planner replaces with better work)
```

### Persisted statuses

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `backlog` | Work to be done | Planner creates or reworks it |
| `active` | Worker is executing | Worker claims it |
| `review` | Worker finished, claim needs verification | Worker submits it |
| `accepted` | Planner verified the claim | Planner accepts it |
| `blocked` | Concrete external blocker confirmed by planner | Planner sets it |
| `superseded` | Replaced by better understanding | Planner replaces it |
| `decomposed` | Not a leaf; children represent the work | Planner decomposes it |

### Derived predicates (computed by tools, never persisted)

| Predicate | Meaning |
|-----------|---------|
| `ready` / `runnable` | Backlog leaf + all depends_on accepted + no conflict overlap |
| `dependency-blocked` | Backlog but depends_on not yet accepted |
| `conflict-blocked` | Backlog but conflict_scope overlaps with active task |
| `stale` | Untouched beyond staleness threshold |
| `needs-decomposition` | Backlog leaf that is too large for a single worker session |
| `rollup-hint` | All children accepted — planner should review for parent accept |
| `blocked-hint` | A child is blocked — planner should review parent state |
| `frontier` | Next actionable work |
| `kanban-lane` | Which Kanban column this node belongs to |

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
- Triggers archive of completed subtrees
- Owns all tree shape mutations

### Tool
- Enforces structural invariants on every mutation
- Computes derived predicates (readiness, rollup hints, Kanban, staleness)
- Projections are read-only — the tool does not mutate parent status
  based on child state. It computes rollup hints; the planner applies
  parent transitions.
- Auto-collapses superseded chains (structural cleanup, not judgment)
- Archives accepted subtrees only when planner triggers or integrity
  check triggers with explicit summary

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
9. `superseded` and `accepted` are immutable.
10. No references to non-existent nodes.
11. No circular dependencies.

## Rollup and Parent Status

Parent status is NOT automatically mutated by the tool. The tool computes
rollup hints; the planner decides:

| Hint | Tool computes | Planner decides |
|------|---------------|-----------------|
| All children `accepted` | `rollup-hint: all-accepted` | Accept parent, or keep decomposed if more work needed |
| Any child `blocked` | `blocked-hint: child-blocked` | Block parent, rework the child, or supersede |
| Mix of statuses | No hint | Keep decomposed |

This keeps the planner as the brain. The tool never makes project judgments.

## Tool API

```typescript
// Planner mutations
tree.create(parentId, task)                    // add backlog leaf
tree.decompose(nodeId, children)               // split leaf into children
tree.accept(nodeId, reason)                    // verify and accept claim
tree.rework(nodeId, reason)                    // review → back to backlog
tree.supersede(nodeId, reason, replacementIds) // replace with better work
tree.block(nodeId, blocker)                    // confirm external blocker
tree.unblock(nodeId, reason)                   // clear blocker

// Worker mutations
tree.claim(nodeId)                             // backlog → active
tree.submit(nodeId, result, evidence)          // active → review

// Cleanup (planner-triggered)
tree.archive(nodeId, summary)                  // collapse accepted subtree
tree.prune(nodeId, reason)                     // remove irrelevant subtree

// Derived queries (tool-owned projections)
tree.status()                  // compact summary
tree.next()                    // runnable backlog leaves
tree.readiness(nodeId)         // why this task is or isn't ready
tree.kanban()                  // Kanban projection with readiness badges
tree.rollup(nodeId)            // parent rollup hints
tree.stale(olderThan)          // untouched nodes
tree.check()                   // integrity validation
```

## Kanban Projection

`tree.kanban()` computes lanes and readiness badges. The UI renders without
recomputing.

| Lane | Source |
|------|--------|
| Backlog | `backlog` nodes |
| In Progress | `active` nodes |
| Review | `review` nodes |
| Blocked | `blocked` nodes |
| Done | `accepted` nodes (recent, not yet archived) |
| Archive | `superseded` + archived accepted |

Only leaf nodes appear as cards. `decomposed` parents are structural — they
appear in the tree view, not the Kanban.

Backlog cards include readiness badges:

| Badge | Meaning |
|-------|---------|
| `runnable` | Ready to dispatch |
| `dependency-blocked` | Waiting on another task |
| `conflict-blocked` | Conflict scope overlap with active task |
| `stale` | Untouched beyond threshold |
| `needs-decomposition` | Too large for single worker session |

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

### Archive accepted subtrees (planner-triggered)

When the planner decides a subtree is complete:

```typescript
tree.archive("managedsystem-pool", {
  summary: "9/9 paths pass, 8 evidence refs",
});
```

Children move to `tasks/archive.json`. The parent keeps the summary.
`tree.status()` hides archived details; `tree.detail(nodeId)` retrieves them.

### Collapse superseded chains (tool-automatic)

A → B → C collapses to C with note "supersedes A, B". Intermediate nodes move
to archive. This is structural cleanup — no judgment needed.

### Archive location

Live tree: `tasks/tree.json` — current thinking, ≤50 visible nodes.
Archive: `tasks/archive.json` — collapsed accepted subtrees and superseded
chains with evidence links. Detail retrievable via `tree.detail(nodeId)`.

The live tree should always be readable by a human in under a minute.

### Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Max visible nodes | 50 | Checker warns |
| Max children per parent | 15 | Checker warns, planner groups |
| Max depth | 5 | Checker warns, planner flattens |
| Max superseded chain | 3 | Tool auto-collapses |

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

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique node identifier |
| `goal` | yes | What this task accomplishes |
| `status` | yes | backlog, active, review, accepted, blocked, superseded, decomposed |
| `parent_id` | yes (except root) | Parent node ID |
| `children` | yes | Child node IDs (empty for leaves) |
| `created_at` | yes | ISO timestamp |
| `updated_at` | yes | ISO timestamp |
| `depends_on` | no | Node IDs that must be accepted first |
| `result` | no | Worker result (required at review) |
| `evidence` | no | Evidence refs (required at review) |
| `supersededBy` | no | Replacement node IDs (required when superseded) |
| `reason` | no | Why superseded/blocked/reworked |
| `blocker` | no | `{ condition, category }` (required when blocked) |
| `conflict_scope` | no | Mutex group for parallel dispatch |
| `archived` | no | True when subtree is collapsed |
| `archive_summary` | no | Human-readable summary of archived subtree |
| `priority` | no | Dispatch priority within backlog |

## Integration

The tree integrity checker runs as part of `bun run check`:

```
format → whitespace → compile → wiring → schema → tree → typecheck
```

Fails on structural violations. Warns on staleness and limit thresholds.
Emits rollup hints for planner attention.
