<ai_context>
summary: task-tree-engine.md and project-execution-engine.md define different status vocabularies for task tree nodes. The tree-engine uses {backlog, active, review, accepted, blocked, superseded, decomposed} while the execution-engine uses {proposed, ready, active, decomposed, claimed_done, accepted, rejected, blocked, superseded}. Live tree.json data uses statuses from both plus undocumented "done" and persisted "ready". Neither doc cross-references the other.
triggers: task tree, status vocabulary, design doc contradiction, tree.json, project-execution-engine, task-tree-engine
</ai_context>

# KE-1858: Task Tree Status Vocabulary Split Between Two Design Docs

**Status**: open
**Discovered**: 2026-06-12
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc contradiction + runtime drift

## Observation

Two design docs define the task tree node lifecycle with **incompatible** status sets:

### task-tree-engine.md (created 2026-06-12)

```
backlog → active → review → accepted
                          → backlog (rework)
                          → blocked
                          → superseded
```

Statuses: `backlog, active, review, accepted, blocked, superseded, decomposed`
- Uses `backlog` for unstarted work
- Uses `review` for worker-submitted claims awaiting verification
- No `proposed`, no `rejected`, no `claimed_done`, no `ready` (explicitly says "ready is not persisted")

### project-execution-engine.md (updated 2026-06-11)

```
proposed → ready → active → claimed_done → accepted
                                         → rejected
                          → blocked
                          → superseded
                          → decomposed
```

Statuses: `proposed, ready, active, decomposed, claimed_done, accepted, rejected, blocked, superseded`
- Uses `proposed` instead of `backlog`
- Uses `claimed_done` instead of `review`
- Has `rejected` (no equivalent in tree-engine)
- Lists `ready` as a persisted status in its lifecycle diagram

### Live tree.json data (aks-rp-e2e, 2026-06-12)

| Status | Count |
|--------|-------|
| accepted | 605 |
| superseded | 137 |
| decomposed | 3 |
| active | 3 |
| done | 2 |
| ready | 1 |
| blocked | 1 |

Notable: **no `backlog`, no `proposed`, no `review`, no `claimed_done`** — the two most distinctive statuses from each doc are absent from actual data. The runtime uses `done` (undocumented in both docs) and persists `ready` (which task-tree-engine.md explicitly says should not be persisted).

### platform project tree.json

| Status | Count |
|--------|-------|
| decomposed | 7 |
| proposed | 4 |
| accepted | 4 |
| ready | 3 |

Uses `proposed` (execution-engine vocabulary) and persisted `ready`.

## Evidence

- `task-tree-engine.md` lines 14–30: lifecycle diagram and status table
- `project-execution-engine.md` lines 270–300: task lifecycle state machine
- `aks-rp-e2e.app/tasks/tree.json`: `grep '"status":' | sort | uniq -c`
- `platform/tasks/tree.json`: same grep

## Implication

1. **No single source of truth** for task status vocabulary. An agent reading one doc will use terminology the other doc doesn't recognize.
2. **Runtime doesn't match either doc** — `done` appears in data but neither design doc. `ready` is persisted despite tree-engine saying it shouldn't be.
3. The two docs don't cross-reference each other. A reader of `task-tree-engine.md` wouldn't know `project-execution-engine.md` exists with a different model.
4. The `backlog` vs `proposed` and `review` vs `claimed_done` splits mean the Tool API in task-tree-engine.md (`tree.claim()` takes backlog→active, `tree.submit()` takes active→review) wouldn't work with the execution-engine's vocabulary.

## Recommendation

These docs should be reconciled. Options:
1. **Converge**: Pick one vocabulary and update both docs. The execution-engine vocabulary is richer (has `proposed` and `rejected`), but the tree-engine vocabulary is cleaner.
2. **Layer**: task-tree-engine.md is the tool spec (what the code enforces), project-execution-engine.md is the workflow spec (what planners/workers follow). Make this relationship explicit and map statuses between them.
3. **Fix the runtime**: Eliminate `done` (should be `accepted`) and stop persisting `ready` (derive it as tree-engine specifies).

The most actionable first step is adding cross-references between the docs noting the vocabulary difference, so future readers know both exist.
