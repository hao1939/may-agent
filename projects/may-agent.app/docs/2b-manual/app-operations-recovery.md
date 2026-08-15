# Agent App operations and recovery

The durable App Inbox and task state are authoritative. Events trigger review;
they are not work queues to replay manually.

## Normal restart

Restart the daemon normally. Startup:

1. loads and validates every `app.ts` into one immutable registry snapshot;
2. prepares Inbox routes and optional task controllers from that same snapshot;
3. republishes the generation only after every consumer accepts it;
4. reclaims expired Inbox leases and rescans unfinished items;
5. recovers task attempts from their persisted task/session fences;
6. enables outward delivery after transports are attached.

Do not recreate requests, task ticks, or Condition events merely because the
process restarted.

## Failed App reload

A rejected definition or consumer preparation leaves the complete previous
registry generation active. Fix `app.ts` or the referenced agent/workflow and
reload again. Never install only one side of an App/task generation.

Check that:

- `app.ts` is the only declaration;
- the App id and owner are stable;
- schemas and selectors pass definition validation;
- referenced workflows exist under the resolved owner;
- the configured workspace is available.

## Unfinished Inbox item

Inspect the item, its owner execution, exact dependency, and delivery record.
An item may legitimately be pending, handling, or waiting on one App, task, or
session dependency. Recovery must preserve its request id, source, input,
idempotency key, and dependency.

If an owner execution died, allow lease recovery to reclaim the item. If its
dependency completed while the daemon was offline, startup rescan will wake the
same item. Do not insert another Inbox row or mark the original complete by
hand.

## Task recovery

Task attempts carry generation, resource-version, session, workspace, and
lease fences. Recover the existing attempt when its session is resumable;
otherwise let the task reconciler release or mark that exact attempt for
attention. A task in `attention` is already the durable review obligation and
does not need a synthetic owner-inbox event.

For a state-shape migration:

1. pause the App lifecycle;
2. let current attempts drain;
3. audit and dry-run against the exact state revision;
4. apply with that expected revision;
5. verify task/Condition integrity;
6. resume the App.

The revision guard must fail closed if state changes between review and apply.

## Delivery uncertainty

An App result and its outward delivery are separate durable facts. Retry only a
delivery that has no confirmed attempt or whose transport contract explicitly
permits retry. Never rerun the App owner simply to resend an already-produced
result.

## Escalation boundary

Escalate only when recovery cannot safely infer the next state: conflicting
durable authorities, a non-resumable active external operation, corrupted
state, or a required human decision. Include exact ids, revisions, and observed
evidence. "The daemon restarted" is not itself a blocker.
