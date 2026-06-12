# Task Tree Engine Design

## Purpose

The task tree is a project's structured understanding: how the goal decomposes,
which claims are verified, which branches were replaced, and where work is
blocked. It is not a TODO list or an attempt log.

The tree is managed exclusively by tools. No direct JSON editing.

## Node Lifecycle

```
proposed → ready → active → claimed → accepted
                                    → rejected → superseded
                              → superseded (with replacement)
```

Every node is exactly one of:
- **proposed** — planned, not yet dispatchable (may have `depends_on`)
- **ready** — dispatchable (all `depends_on` accepted)
- **active** — currently being worked on
- **claimed** — worker finished, result + evidence attached, awaiting verification
- **accepted** — planner verified the claim
- **rejected** — planner rejected the claim (needs rework or supersede)
- **superseded** — replaced by better understanding (links to replacement)
- **blocked** — concrete external blocker identified
- **decomposed** — not a leaf; children represent the work

Nodes that are not one of these states indicate a tree integrity violation.

## Structural Invariants

The tool enforces these on every mutation:

1. Every node has exactly one parent (except root).
2. Node IDs are unique across the entire tree.
3. `ready` only when all `depends_on` nodes are `accepted`.
4. `active` only when dispatched (at most one active worker per node).
5. `claimed` must have `result` and `evidence` fields.
6. `superseded` must have `supersededBy` (replacement node IDs) and `reason`.
7. `blocked` must have `blocker` with `condition` and `category`.
8. `decomposed` nodes have children; leaf nodes do not.
9. Parent status is derived, never set directly:
   - All children accepted → parent auto-accepts
   - Any child rejected → parent needs review
   - Any child blocked → parent shows blocked
10. `superseded` and `accepted` nodes are immutable.
11. No node may reference a non-existent node in `depends_on`, `supersededBy`,
    or `children`.
12. No circular dependencies in `depends_on`.
13. No circular parent-child relationships.

## Tool API

```typescript
// Core mutations
tree.create(parentId, task)                    // add a leaf under parent
tree.decompose(nodeId, children)               // convert leaf to parent
tree.claim(nodeId, result, evidence)            // worker reports result
tree.verify(nodeId, verdict, reason)            // planner accepts/rejects
tree.supersede(nodeId, reason, replacementIds)  // replace with better work
tree.block(nodeId, blocker)                     // mark blocked with condition
tree.unblock(nodeId, reason)                    // clear blocker

// Cleanup
tree.archive(nodeId)           // collapse accepted subtree to summary
tree.prune(nodeId, reason)     // remove irrelevant subtree

// Queries
tree.status()                  // compact summary: what's done, next, blocked
tree.next()                    // dispatchable leaves ordered by priority
tree.stale(olderThan)          // nodes untouched for too long
tree.check()                   // integrity validation (returns violations)
```

No `tree.editRaw()`. No direct file writes. The tool owns the JSON.

## Integrity Checker

`tree.check()` validates the full tree and returns violations:

### Structural checks
- Every `children` reference points to an existing node.
- Every `depends_on` reference points to an existing node.
- Every `supersededBy` reference points to an existing node.
- No circular dependencies.
- No orphan nodes (every non-root node has a parent).
- No duplicate node IDs.
- Root node exists and is reachable.

### State checks
- `ready` nodes: all `depends_on` are `accepted`.
- `claimed` nodes: `result` and `evidence` are non-empty.
- `superseded` nodes: `supersededBy` and `reason` are non-empty.
- `blocked` nodes: `blocker.condition` is non-empty.
- `decomposed` nodes: have at least one child.
- Leaf nodes: have no children.
- `active` nodes: at most one per `conflict_scope`.

### Derived state checks
- Parent with all children `accepted`: parent should be `accepted` or
  `decomposed` (pending rollup).
- Parent with any child `rejected`: parent should be flagged for review.
- Parent with any child `blocked`: parent should reflect blocked state.

### Staleness checks
- `proposed` nodes older than 7 days without activity.
- `active` nodes older than 24 hours without progress.
- `blocked` nodes older than 14 days without review.

### Design compliance checks
- No node in an undefined state.
- No `unknown`, `maybe-later`, or empty-string status.
- No superseded chain longer than 3 (should be collapsed).
- No parent with more than 15 children (should be grouped).
- No tree depth greater than 5 (should be flattened).
- Total visible (non-archived) nodes should not exceed 50.

The checker runs:
- On every mutation (fast path: check only affected nodes + parents)
- On demand via `tree.check()` (full scan)
- As part of `bun run check` for the project

## Outdated and Orphan Task Handling

### Superseded by better understanding

When a task is replaced by a different approach:

```typescript
tree.supersede("test-ms-via-cli", {
  reason: "CLI has default-payload bug, REST is the proven path",
  replacementIds: ["test-ms-via-rest"],
});
```

The tool:
1. Sets node status to `superseded`
2. Records `supersededBy` and `reason`
3. Makes node immutable
4. If node has non-terminal children, cascades: each becomes `superseded`
   with reason `parent-superseded`

### Orphaned by parent changes

When a parent is superseded, all non-terminal children are automatically
superseded with `reason: "parent-superseded"`. No orphans.

### Stale by time

`tree.stale(olderThan)` returns nodes that haven't been touched:
- The planner reviews each stale node
- Still relevant → touch (update `updatedAt`)
- No longer relevant → `tree.prune(nodeId, reason)`
- Blocked → `tree.block(nodeId, blocker)` with concrete condition

### The rule

Every node must be one of:
- Dispatchable (proposed/ready)
- In progress (active/claimed)
- Terminal (accepted/rejected/superseded)
- Explicitly blocked with a concrete condition

Ambiguous states like "unknown", "maybe later", "no work", "waiting" are
integrity violations. The tool rejects them.

## Compaction

### Archive accepted subtrees

When a parent and all children are `accepted`:

```typescript
tree.archive("managedsystem-pool");
```

Before:
```
✓ ManagedSystem Pool (decomposed, 4 children)
  ✓ REST add-existing (accepted, 3 evidence)
  ✓ Mode immutability (accepted, 2 evidence)
  ✓ Delete existing (accepted, 2 evidence)
  ✓ Single pool constraint (accepted, 1 evidence)
```

After:
```
✓ ManagedSystem Pool [archived: 4 accepted, 8 evidence refs]
```

Children move to `archive` section. Parent keeps summary metrics.
`tree.status()` hides archived details. `tree.detail(nodeId)` shows them.

### Collapse superseded chains

```
A superseded by B, B superseded by C
→ collapse to: C (supersedes A, B)
```

Intermediate nodes move to archive.

### Prune rejected-and-replaced

If a task was rejected and its replacement was accepted, the rejected node is
pure history. Archive it automatically.

### Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Max visible nodes | 50 | Integrity checker warns |
| Max children per parent | 15 | Integrity checker warns, planner should group |
| Max depth | 5 | Integrity checker warns, planner should flatten |
| Max superseded chain | 3 | Auto-collapse |

## Data Structure

```json
{
  "version": 1,
  "projectId": "example",
  "updatedAt": "2026-06-12T...",
  "root": "goal",
  "nodes": {
    "goal": {
      "id": "goal",
      "title": "Project goal",
      "status": "decomposed",
      "children": ["feature-a", "feature-b"],
      "createdAt": "2026-06-01T...",
      "updatedAt": "2026-06-12T..."
    },
    "feature-a": {
      "id": "feature-a",
      "title": "Feature A full lifecycle",
      "status": "accepted",
      "archived": true,
      "archiveSummary": { "accepted": 3, "evidenceRefs": 5 },
      "parent": "goal",
      "children": [],
      "createdAt": "2026-06-01T...",
      "updatedAt": "2026-06-10T..."
    },
    "feature-b": {
      "id": "feature-b",
      "title": "Feature B coverage",
      "status": "decomposed",
      "parent": "goal",
      "children": ["fb-spec-1", "fb-spec-2"],
      "createdAt": "2026-06-05T...",
      "updatedAt": "2026-06-12T..."
    },
    "fb-spec-1": {
      "id": "fb-spec-1",
      "title": "Feature B basic behavior",
      "status": "ready",
      "parent": "feature-b",
      "children": [],
      "depends_on": [],
      "createdAt": "2026-06-10T...",
      "updatedAt": "2026-06-10T..."
    },
    "fb-spec-2": {
      "id": "fb-spec-2",
      "title": "Feature B negative cases",
      "status": "proposed",
      "parent": "feature-b",
      "children": [],
      "depends_on": ["fb-spec-1"],
      "createdAt": "2026-06-10T...",
      "updatedAt": "2026-06-10T..."
    }
  },
  "archive": {}
}
```

## Node Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique node identifier |
| `title` | yes | Human-readable description |
| `status` | yes | Current state (see lifecycle) |
| `parent` | yes (except root) | Parent node ID |
| `children` | yes | Child node IDs (empty for leaves) |
| `createdAt` | yes | ISO timestamp |
| `updatedAt` | yes | ISO timestamp (updated on every mutation) |
| `depends_on` | no | Node IDs that must be accepted before this is ready |
| `result` | no | Worker result (required when claimed) |
| `evidence` | no | Evidence refs (required when claimed) |
| `supersededBy` | no | Replacement node IDs (required when superseded) |
| `reason` | no | Why superseded/rejected/pruned |
| `blocker` | no | `{ condition, category }` (required when blocked) |
| `conflict_scope` | no | Mutex group for parallel dispatch |
| `archived` | no | True when subtree is collapsed |
| `archiveSummary` | no | Metrics for archived subtrees |
| `priority` | no | Dispatch priority within ready set |

## Integration with `bun run check`

The project check pipeline should include tree integrity:

```
format → whitespace → compile → wiring → schema → tree → typecheck
```

`tree` step runs `tree.check()` and fails if any violation is found.
Warnings for staleness and limit thresholds. Errors for structural violations.

## Open Questions

- Should the archive be in the same file or a separate `archive.json`?
- Should `tree.status()` output be the same format as `bun run status` or
  separate?
- How should the tree relate to domain-specific models (like `model.json` in
  aks-rp-e2e)? Should it be a projection, a parallel structure, or independent?
- What is the maximum tree.json file size before it becomes a performance
  concern for agents reading it?
