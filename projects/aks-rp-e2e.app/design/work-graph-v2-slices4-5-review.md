# Work Graph V2 Slices 4–5 Review — Phase and exact-run Condition canary

Status: source-complete for revisioned fix-forward canary; not runtime-reloaded

## Phase transition

For a revisioned fix-forward review whose structured result says
`nextAction=exact-wait`, the planner no longer reuses the fix-forward contract
in place.

```text
fix-forward revision N / attempt A
  -> work.revise-phase
  -> spec-result-review revision N+1 / no active attempt
  -> exact pipeline Condition open
```

Revision `N+1` has one result contract: `SPEC_RESULT_REVIEW`. Its goal, inputs,
outputs, and acceptance refer only to terminal artifact inspection. The prior
phase is referenced by:

```text
.state/task-reviewer-runs.jsonl#<task>:<revision>:<attempt>
```

It is not copied into the current artifact-review payload. The run
`172459471` replay passes this transition from revision 2 to revision 3.

Legacy revision-0 exact waits retain their existing in-place behavior until
they drain or are explicitly migrated.

## Condition authority

The migrated wait creates a top-level `ProjectConditionV2`:

```text
id       = condition:pipeline:ado:<runId>:terminal
causeKey = pipeline:ado:<runId>:terminal
subject  = exact task id + revision
```

The task blocker remains only as a compatibility projection for existing UI,
health, and operator readout. The snapshot prefers the registry and suppresses
the duplicate blocker candidate.

The watchdog behavior is split by authority:

- revision-0 blocker: legacy terminal harvesting and reviewer re-emission;
- revisioned Condition: exact observation/resolve commands.

For a nonterminal run, the bounded fallback probe updates Condition observation
facts and the blocker projection without changing the WorkItem revision. For a
terminal run, resolution validates backend, run id, task id, and task revision,
then atomically resolves the Condition and moves the artifact-review WorkItem
to backlog. Normal planner refill creates its new artifact-review attempt.
There is no synthetic completion and redo cycle.

## Safety properties now tested

- wrong run/revision cannot resolve the Condition;
- duplicate terminal resolution is idempotent;
- one exact run Condition cannot silently attach to a second subject;
- fallback polling refreshes observation state without revising work intent;
- a resolved Condition that still has a blocked subject is a typed snapshot
  invariant with stable recovery key;
- the compatibility blocker preserves operator-visible wait metadata;
- artifact review at revision 3 is accepted with `SPEC_RESULT_REVIEW` and no
  repeated `FIX_FORWARD_RESULT` requirement;
- old-revision completion cannot overwrite revision 3 through the Slice 2
  correlation boundary.

## Remaining limits

- Exact-run Conditions currently support one verification WorkItem containing
  all named specs. Broad fan-out/shared Conditions are intentionally rejected.
- Health and selected metrics still read the compatibility blocker; migrating
  those consumers is Slice 6.
- Only revisioned fix-forward exact-run waits use the registry. Other pipeline,
  GitHub, approval, credential, capacity, and environment waits remain legacy.
- Fallback expiry still reaches existing watchdog/owner policy; supervisor
  ownership moves in Slices 7–8.

Verification added in these slices:

```text
phase/command tests:                    4 pass
Condition command tests:                1 pass
snapshot registry/invariant tests:      2 focused cases
watchdog event/fallback tests:           2 focused cases
revision-3 artifact reviewer test:       1 focused case
```
