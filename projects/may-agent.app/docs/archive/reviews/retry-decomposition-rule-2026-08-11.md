# Retry/Recovery Decomposition Rule (stable-responsibility anchoring)

**Historical context:** [Choosing the Right Mechanism](../../1-principles/code-vs-data.md). Retained rationale and evidence; this record does not define the current contract.

> **Archived 2026-08-16.** This is a historical task-tree cleanup record, not
> the current recovery contract. The canonical
> [Task Resource Engine](../../2a-design/task-resource-engine.md) now reuses the
> same task identity for execution recovery and does not create repair tasks.

Status: adopted rule for May-agent.app task-tree owners
Owner: arc (design), tech-lead (enforcement)
Origin: `reconcile-successor-chain-task-bloat-20260811`

## Problem observed (2026-08-11)

The canonical projection at `/app/projects/may-agent.app/.state/tasks/tree.json`
contained four serial child-on-child chains created purely by retries:

| Responsibility (chain root)                                | Depth | Live frontier                                                                           |
| ---------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `fix-atomic-orphan-process-group-recovery-20260810`        | 22    | `verify-external-reaper-loader-fixture-20260811`                                        |
| `provider-auth-fallback-hardening-20260810`                | 12    | `ops/authorize-supervisor-model-credential-restore-20260810` (human approval Condition) |
| `restore-lease-cas-regressions-and-fence-residue-20260811` | 6     | `complete-residue-cas-gate-and-verification-20260811`                                   |
| `implement-restart-aware-deploy-receipts-20260811`         | 4     | `apply-recovered-deploy-receipts-and-verify-20260811`                                   |

Every intermediate node had `phase=waiting`, `readiness=child-blocked`, exactly
one child, and no independent acceptance beyond its parent's. Each is pure
bookkeeping: it cannot converge on its own, it duplicates its parent's outcome,
and it inflates depth by one per retry. 39 of 52 nodes were of this shape.

## Root cause

When an owner attempt cannot finish, the natural move is
"create a child that finishes the remaining work and return waiting". Applied at
the _current leaf_ instead of at the _responsibility_, this makes chain depth a
function of retry count, not of real decomposition.

## Rule

1. **Anchor retries at the responsibility, not the leaf.** A retry/recovery task
   is a direct child of the nearest ancestor that owns an independently
   reconcilable outcome ("the stable responsibility"), typically the chain root.
   It is never a child of the attempt that just failed.
2. **One live frontier per responsibility.** A stable responsibility should have
   at most one live retry child at a time. If a new attempt is needed, close or
   roll up the superseded attempt before or while creating the successor.
3. **A new child must add acceptance.** If the proposed child's outcome and
   acceptance are a restatement of the parent's, do not create it — do the work,
   or return waiting on the parent with an exact Condition.
4. **Depth budget.** Retry/recovery lineage under one responsibility may not
   exceed depth 2 (responsibility → attempt). Reaching depth 3 is a signal to
   reconcile: relocate the live frontier up and close superseded predecessors.
5. **Preserve durable evidence when collapsing.** Closing a superseded
   predecessor must carry its evidence into the close summary or into the
   surviving frontier task; Conditions and acceptance of the live frontier are
   never dropped.
6. **Externally blocked leaves are not bloat.** A leaf blocked on a real
   Condition (for example human approval) stays live; only its redundant
   single-child ancestors are collapsible.

## Detector (bounded guard, read-only)

A chain node is redundant-collapsible when all hold:
`item_type == task` AND `phase == waiting` AND `readiness.state == child-blocked`
AND `len(children) == 1` AND it is not a chain root (its parent is also a task in
the same lineage).

```bash
python3 - <<'PY'
import json
t=json.load(open('/app/projects/may-agent.app/.state/tasks/tree.json'))
ts=t['tasks']
bad=[i for i,n in ts.items()
     if n.get('item_type')=='task' and n.get('phase')=='waiting'
     and (n.get('readiness') or {}).get('state')=='child-blocked'
     and len(n.get('children') or [])==1
     and (ts.get(n.get('parent_id')) or {}).get('item_type')=='task']
print(len(bad)); [print(' ',b) for b in sorted(bad)]
PY
```

Verification (2026-08-11, pre-reconciliation): the detector reports the
single-child waiting predecessors of the four chains above. Post-reconciliation
the count must drop to the number of legitimately nested responsibilities, and
must not include any node whose child is the live frontier already reparented to
its chain root.

## Application

Owners returning `waiting` after a failed attempt: set `parentId` to the stable
responsibility id, and include a `close-task` action for the superseded attempt
in the same reconciler action batch.

## Reconciliation log (2026-08-11, `collapse-residual-retry-chain-predecessors-20260811`)

Detector re-run against the canonical projection reported **28** redundant
single-child waiting predecessors, not the 37 assumed in the carrier task input.
The gap is explained by prior partial reconciliation: the provider-auth frontier
`ops/authorize-supervisor-model-credential-restore-20260810` was already
reparented to its chain root `provider-auth-fallback-hardening-20260810`, while
the pgid frontier `finish-orphaned-setsid-reaper-fixture-20260811` was still
nested at depth 19 and `phase=running`.

Collapse therefore requires two steps per chain, not one:

1. `update-task` the live frontier's `parentId` to the stable responsibility
   root (acceptance, outputs, and Conditions untouched);
2. `close-task` the emptied predecessors strictly bottom-up with exact
   `expectedGeneration`.

The reconciler action batch is capped at 16 actions, so a 30-node collapse must
be split across a parent batch and a direct child task. Collapse work is
therefore itself bounded per chain.

## Immutability rule (2026-08-11, `reconcile-successor-chain-task-bloat-20260811`)

A completed task receipt is immutable. A collapse batch must never emit
`update-task` or `close-task` against a task whose phase is already terminal —
the handler rejects the whole result (observed rejection: "cannot mutate
completed task finish-orphaned-setsid-reaper-fixture-20260811"). Before
authoring a batch, re-read the canonical projection at
`/app/projects/may-agent.app/.state/tasks/tree.json` and recompute the frontier
from live phases (`running`, `pending`, `attention`, `waiting`); frontier ids
recorded in an earlier session's evidence are advisory only.

Standing rule for retry/recovery decomposition:

- A retry attaches as a **direct child of the stable responsibility root**, never
  as a child of the previous attempt.
- The previous attempt is closed in the same batch with exact
  `expectedGeneration`, unless already terminal (then it is simply omitted).
- Chain depth under any responsibility root should stay <= 2. A projection with
  a single-child waiting node whose only child is also single-child is a
  reconciliation defect and is what the redundant-collapsible detector counts.
