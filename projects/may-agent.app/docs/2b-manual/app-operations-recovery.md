# Agent App operations and recovery

Durable request correlation and task state are authoritative. Tasks own App
work; events trigger review and are not work queues to replay manually.

## Normal restart

Restart the daemon normally. Startup:

1. loads and validates every `app.ts` into one immutable registry snapshot;
2. prepares input routes and the task controller from that same snapshot;
3. republishes the generation only after every consumer accepts it;
4. repairs request correlation and runs bounded indexed recovery for ready,
   changed, due, or expired tasks;
5. interrupts stale task execution evidence and requeues the same Task through
   normal bounded Host capacity; it does not directly resume every old task
   session outside the dispatcher;
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

## Unfinished request

Inspect the request, linked task, exact dependency, and delivery record. The
request may remain open while its task is pending, running, waiting, or in
attention. Recovery must preserve its request id, source, input, idempotency
key, and task link; only the task controller may restart App work.

If a task attempt died, let bounded recovery interrupt that execution evidence
and requeue the same Task. If its dependency completed while the daemon was
offline, startup recovery will wake the same Task. Do not resume its old
session, insert another request row, or mark the original complete by hand.

## Task recovery

Task attempts carry generation, resource-version, session, workspace, and
lease fences. After process restart, the task reconciler interrupts the old
attempt and starts any replacement through normal bounded Host capacity. The
session remains execution evidence; it is not independently resumed by the
generic session manager. A task in `attention` is already the durable review
obligation and does not need a synthetic owner-inbox event.

For a state-shape migration:

1. pause the App lifecycle;
2. let current attempts drain;
3. audit and dry-run against the exact state revision;
4. apply with that expected revision;
5. verify task/Condition integrity;
6. resume the App.

The revision guard must fail closed if state changes between review and apply.

### Whole-App JSON to resource rows

Use the guarded cutover command only after the running daemon contains the
resource-backed runtime bridge. Replace the example paths with the canonical
App directory and the daemon's actual persistence directory:

```bash
bun scripts/cutover-task-resources.ts inspect \
  --app-dir /app/projects/gym.app --persist-dir /app/.state

bun scripts/cutover-task-resources.ts pause \
  --app-dir /app/projects/gym.app --persist-dir /app/.state \
  --reason "resource-row cutover"
```

Keep inspecting until `runningAttemptIds` is empty. Then stop the daemon, prove
that it is stopped through the deployment supervisor, and inspect once more.
Use the `sourceRevision` from that final offline inspection—not the revision
printed before attempts drained:

```bash
bun scripts/cutover-task-resources.ts activate \
  --app-dir /app/projects/gym.app --persist-dir /app/.state \
  --expected-revision SHA256_FROM_FINAL_INSPECT \
  --confirm-daemon-stopped --resume
```

Start the same reviewed Runtime release. It discovers `authority=resources`
and must not recreate or mutate `state.json`. Verify resource-backed task
list/get, one normal reconciliation, restart recovery, and the indexed safety
query before selecting the next App.

The command fails closed when the source is not paused, an attempt still runs,
the source revision changed, shadow comparison differs, or resource authority
is already active. Before activation, recovery is simply to leave or resume
the one paused JSON authority. After activation, roll forward: the old JSON
remains paused evidence and must never be resumed as a second authority.
Neither path deletes historical state.

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
