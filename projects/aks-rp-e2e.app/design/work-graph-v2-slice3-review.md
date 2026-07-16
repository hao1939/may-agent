# Work Graph V2 Slice 3 Review — Atomic review-action canary

Status: first command canary implemented and fixture-tested; not runtime-reloaded

## Canary boundary

Only a fully structured `task-tree-followup` uses V2. It must provide:

```text
idBase + parentId + owner + goal + outputs + acceptance + conflictScopes
```

The owner and optional workflow cannot change across this canary command. The
source must be an ordinary review leaf with matching task revision and attempt.
Incomplete `task-tree-followup` actions continue through the existing bounded
app-ops path, preserving current capability while producers learn the stricter
contract.

## One command

`work.applyReview.v2` performs under one task-tree lock and one atomic tree save:

```text
validate source/revision/attempt/action
  -> create exact successor at the requested id
  -> attach successor to the requested existing parent
  -> close the reviewed source
  -> record the stable command key
```

The successor starts as backlog. Normal planner refill may assign it after the
command; the existing assignment outbox then supplies the durable dispatch.
The command itself does not create an assignment, so it cannot split a tree
transition from an assignment outbox write.

Stable command key:

```text
work.apply-review:<task>:<revision>:<attempt>:task-tree-followup
```

Replay returns the same successor. A different payload or decision for the
same key is rejected. The bounded root registry retains the latest 100 command
records, while the successor also carries its command key so replay survives
source-task compaction and registry aging.

## Observed behavior change

The egress-style fixture now creates the exact domain successor directly and
then allows ordinary refill to assign it. It creates no `ops-apply-*` task.

The previous incomplete storage-CSI fixture still creates an app-ops apply task
because its review action only contains prose and no exact successor contract.
This is deliberate compatibility, not fallback inference.

## Problems resolved

- source closure and successor creation cannot be partially applied in the
  task tree;
- duplicate reviewed-event delivery cannot create duplicate successors;
- stale revision/attempt cannot create a successor;
- an invalid parent, owner override, workflow override, or incomplete contract
  leaves the source in review;
- source compaction no longer destroys command replay identity.

## Remaining risks and limits

- The root command registry is a bounded compatibility ledger; a later slice
  should move command facts to the durable audit store once a transactional
  tree/outbox boundary exists.
- Other review action kinds still use legacy multi-write planner branches.
- App-specific completion invariants are not generalized inside the command;
  this canary excludes durable/controller/spec-loop-followup sources.
- This does not yet split fix-forward, wait, and artifact review into separate
  phase revisions.

Verification:

```text
work command unit tests: 3 pass
planner regression suite: 97 pass
targeted bundle: pass
```
