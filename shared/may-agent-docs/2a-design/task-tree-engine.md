# Task Tree Engine Design

## Purpose

The task tree is a project's structured understanding: how the goal decomposes,
which claims are verified, which branches were replaced, and where work is
blocked. It is not a TODO list or an attempt log.

The tree is managed exclusively by tools. No direct JSON editing.

## Node Lifecycle

```
backlog → active → review → accepted
                          → backlog      (rework)
                          → blocked      (real external blocker)
                          → superseded   (replaced by better understanding)
```

Four durable statuses, one derived:

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `backlog` | Work to be done | Planner creates it |
| `active` | Worker is executing | Worker claims it |
| `review` | Worker finished, claim needs verification | Worker submits it |
| `accepted` | Planner verified the claim | Planner accepts it |
| `blocked` | Concrete external blocker identified | Planner or worker |
| `superseded` | Replaced by better understanding | Planner replaces it |
| `decomposed` | Not a leaf; children represent the work | Planner decomposes it |

**`ready` is not persisted.** It is derived by the tool:

```
ready = backlog leaf
      + all depends_on are accepted
      + no conflict_scope overlap with active tasks
      + not blocked
```

The tool computes readiness on demand via `tree.next()` and
`tree.readiness(taskId)`. No stale-ready bugs.

## Roles

### Worker
- Asks for one runnable backlog leaf via `tree.next()`
- Marks it `active`
- Executes the task
- Submits to `review` with result + evidence
- Does NOT replan, decompose, or create sibling tasks

### Planner
- Reviews `review` tasks and decides: accept, rework, block, supersede, or
  decompose further
- Creates new `backlog` tasks
- Supersedes outdated branches
- Rolls up parent status
- Owns all tree mutations except active/review transitions

### Tool
- Enforces invariants on every mutation
- Computes derived state (readiness, parent rollup, Kanban projection)
- Runs integrity checks
- Archives completed subtrees

## Structural Invariants

The tool enforces on every mutation:

1. Every node has exactly one parent (except root).
2. Node IDs are unique.
3. `active` must have been `backlog` with computed readiness satisfied.
4. `review` must have `result` and `evidence` fields.
5. `accepted` can only come from `review` (planner verified).
6. `superseded` must have `supersededBy` and `reason`.
7. `blocked` must have `blocker` with `condition` and `category`.
8. `decomposed` nodes have children; leaf nodes do not.
9. Parent status is derived:
   - All children accepted → parent auto-accepts
   - Any child blocked → parent reflects blocked
   - Mix of backlog/active/review → parent stays decomposed
10. `superseded` and `accepted` are immutable.
11. No references to non-existent nodes.
12. No circular dependencies.

## Tool API

```typescript
// Planner mutations
tree.create(parentId, task)                    // add backlog leaf
tree.decompose(nodeId, children)               // split leaf into children
tree.accept(nodeId, reason)                    // verify and accept claim
tree.rework(nodeId, reason)                    // reject → back to backlog
tree.supersede(nodeId, reason, replacementIds) // replace with better work
tree.block(nodeId, blocker)                    // mark with concrete blocker
tree.unblock(nodeId, reason)                   // clear blocker

// Worker mutations
tree.claim(nodeId)                             // backlog → active
tree.submit(nodeId, result, evidence)          // active → review

// Cleanup
tree.archive(nodeId)                           // collapse accepted subtree
tree.prune(nodeId, reason)                     // remove irrelevant subtree

// Derived queries (tool-owned, not recomputed by UI)
tree.status()                  // compact summary
tree.next()                    // runnable backlog leaves (readiness computed)
tree.readiness(nodeId)         // why this task is or isn't ready
tree.kanban()                  // Kanban projection
tree.stale(olderThan)          // untouched nodes
tree.check()                   // integrity validation
```

## Kanban Projection

The Kanban board is a read-only projection from tree state. The tool computes
it via `tree.kanban()`. The UI renders it without recomputing counts.

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

## Readiness Computation

`tree.next()` returns runnable tasks, computed fresh each call:

```typescript
function isReady(node): boolean {
  if (node.status !== "backlog") return false;
  if (node.children.length > 0) return false;        // not a leaf
  for (dep of node.depends_on) {
    if (tasks[dep].status !== "accepted") return false; // dependency unmet
  }
  for (active of activeTasks) {
    if (active.conflict_scope === node.conflict_scope) return false;
  }
  return true;
}
```

No persisted `ready` state. No stale readiness. The tool always computes
from current tree state.

`tree.readiness(nodeId)` explains why a task is or isn't ready:

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

### Derived state checks
- Parent with all children `accepted`: should auto-accept or be pending rollup.
- Parent with any child `blocked`: should reflect blocked.

### Design compliance checks
- No undefined or ambiguous statuses.
- No `no_work`, `waiting`, `unknown`, `maybe-later`, or empty status.
- No superseded chain longer than 3 (auto-collapse).
- No parent with more than 15 children (should group).
- No depth greater than 5 (should flatten).
- Total visible (non-archived) nodes should not exceed 50.

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
`parent-superseded`.

### Stale by time

`tree.stale(olderThan)` returns untouched nodes. The planner reviews each:
- Still relevant → touch
- Irrelevant → prune
- Blocked → add concrete blocker

### No fake terminal states

The tool rejects ambiguous states. If work cannot proceed:
- Concrete blocker → `tree.block(nodeId, { condition, category })`
- Wrong approach → `tree.supersede(nodeId, reason, replacements)`
- Needs rethinking → `tree.rework(nodeId, reason)` (back to backlog)
- Genuinely done → `tree.accept(nodeId, reason)`

"No work", "waiting", or vague "rejected" are not valid. The planner must
express why as concrete backlog, a concrete blocker, or a supersession.

## Compaction

### Archive accepted subtrees

When a parent and all children are `accepted`:

```typescript
tree.archive("managedsystem-pool");
```

Collapses to summary. Children move to archive. `tree.status()` hides details;
`tree.detail(nodeId)` shows them.

### Collapse superseded chains

A → B → C becomes just C with note "supersedes A, B". Intermediate nodes
archive automatically.

### Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Max visible nodes | 50 | Checker warns |
| Max children per parent | 15 | Checker warns, planner groups |
| Max depth | 5 | Checker warns, planner flattens |
| Max superseded chain | 3 | Auto-collapse |

## Data Structure

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
    "feature-b": {
      "id": "feature-b",
      "goal": "Feature B coverage",
      "status": "decomposed",
      "parent_id": "goal",
      "children": ["fb-spec-1", "fb-spec-2"],
      "created_at": "2026-06-05T...",
      "updated_at": "2026-06-12T..."
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
    },
    "fb-spec-2": {
      "id": "fb-spec-2",
      "goal": "Feature B negative cases",
      "status": "backlog",
      "parent_id": "feature-b",
      "children": [],
      "depends_on": ["fb-spec-1"],
      "created_at": "2026-06-10T...",
      "updated_at": "2026-06-10T..."
    }
  },
  "archive": {}
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
| `archive_summary` | no | Metrics for archived subtrees |
| `priority` | no | Dispatch priority within backlog |

## Integration

The tree integrity checker runs as part of `bun run check`:

```
format → whitespace → compile → wiring → schema → tree → typecheck
```

Fails on structural violations. Warns on staleness and limit thresholds.

## Open Questions

- Should the archive be in the same file or separate?
- How should the tree relate to domain-specific models (e.g. model.json)?
  Recommendation: the tree is for project-level work coordination; domain
  models track domain knowledge. They may reference each other but are not
  projections of each other.
- What is the maximum tree.json size before agent context becomes a concern?
