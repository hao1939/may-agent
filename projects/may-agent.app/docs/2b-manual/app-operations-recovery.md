# App operations and recovery

Durable request correlation and task state are authoritative. Tasks own App
work; events trigger review and are not work queues to replay manually.

## Normal restart

Restart the daemon normally. Startup:

1. loads and validates every `app.ts` into one immutable registry snapshot;
2. prepares input routes and the task controller from that same snapshot;
3. republishes the generation only after every consumer accepts it;
4. opens the human interfaces and App input handler;
5. starts bounded indexed Task recovery in a parent-owned worker without
   blocking those interfaces;
6. interrupts stale task execution evidence and requeues the same Task through
   normal bounded Host capacity; it does not directly resume every old task
   session outside the dispatcher;
7. starts Task controllers after recovery settles; later indexed checks retry
   any failed recovery work.

Do not recreate requests, task ticks, or Condition events merely because the
process restarted.

## Failed App reload

A rejected definition or consumer preparation leaves the complete previous
registry generation active. Fix `app.ts` or the referenced agent/workflow and
reload again. Never install only one side of an App/task generation.

Check that:

- `app.ts` is the only declaration;
- the App id and default agent are stable;
- schemas and selectors pass definition validation;
- referenced workflows exist under the selected agent;
- the configured workspace is available.

## Unfinished request

Inspect the request, linked task, exact dependency, and result projection. The
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

## Quiet-runtime proof

Measure idle Host cost only through a window that is actually quiet:

```bash
cd /app/projects/may-agent
bun scripts/sample-runtime-quiet.ts \
  --socket /app/.state/instances/background/may.sock \
  --state-dir /app/.state \
  --seconds 30
```

The sampler keeps one control-socket connection and reads `/proc` and SQLite in
read-only mode. It rejects the window when an agent, Task attempt, workflow,
daemon child process, durable event, Task version, session activity, or run
record appears. Process diagnostics are requested only at the endpoints;
one-second activity checks do not repeatedly reconnect to or profile the
daemon. A rejected window is execution evidence, not an idle-performance
failure; wait for real quiescence and sample again. Judge the idle CPU/RSS
target only from `validQuietWindow: true` output.

An older deployed Runtime that does not expose `diagnostics.pid` may be sampled
temporarily with `--pid <actual-daemon-pid>`. Do not use a retained identity PID
without confirming that `/proc/<pid>/cmdline` is the running daemon.

## Runtime deployment target

A correlated Runtime deployment must name an existing **Host Operations App**
Task with `appId: may-agent`. A May human request is not deployment authority,
even when May routed the request. Before
building or restarting, the deploy preflight reads that exact `{appId, taskId}`
from the Host database (`$STATE_DIR/may.db`, normally `/app/.state/may.db`) and
verifies that `app_task_store_meta.authority` is `resources`. The read is
query-only. A missing database, missing resource authority, wrong App, or stale
Task fails closed before any artifact or process changes.

The archive build passes its validated source commit explicitly into the
compiler. `may-agent --version` must work without a source checkout and report
that embedded short commit; the deployment receipt remains the authoritative
full source-commit/artifact-hash binding. The same archive stages an explicit
versioned UI release. The supervisor activates binary, Console, SDK, and UI as
one set and restores the prior set on failed readiness; the build must not
write through an archive-relative path into retained `.state`.

An in-container deploy may reuse the root-owned supervisor restarter only when
it is byte-identical to the staged restarter. A changed restarter requires the
root-capable deployment path and fails before activation; it must never be
silently reused or patched by an unprivileged Runtime attempt. A failed
restarter launch settles its receipt and removes the activation markers, so a
later supervisor start cannot accidentally activate that failed request.

The retained App-local `.state/tasks/state.json` is migration evidence after
cutover. Deployment must not consult, recreate, or mutate it.

### Read-only deployment verification

Verification of an exact live commit is not another deployment attempt. Begin
with the requested source commit, correlation, or Host Operations Task and
inspect only matching JSON receipts under
`/app/projects/may-agent/.state/deploy-receipts/`. The terminal receipt is the
authoritative binding among `sourceCommit`, `artifactSha`, the loaded artifact,
health, and the originating `{project, taskId, correlation}`. Internal
activation markers and their disappearance are not completion evidence.

A successful proof requires `phase: succeeded`,
`loadedArtifactSha == artifactSha`, `health: healthy`, and
`duplicateDeploy: false`. Cross-check that receipt against
`bundle/may-agent.provenance.json`, the SHA-256 of the live container's
`/usr/local/bin/may-agent`, the three long-lived supervisor services
(`may-agent`, `may-agent-web`, and `may-agent-maintenance`), and
`http://127.0.0.1:${WEB_PORT:-8080}/api/readiness`. A requested receipt is an
exact wait; a failed or rolled-back receipt is a terminal disposition. Stop
when these bounded facts answer the request—do not scan the workspace, inspect
unrelated worktrees, or tail broad logs as a substitute for receipt evidence.

## Adapter uncertainty

An App result remains readable even when an adapter send fails or its provider
outcome is uncertain. Never rerun the selected agent or reopen the Task merely
to resend an already-produced result. Inspect adapter/provider diagnostics or
ask the human to read the shared Conversation through another surface.

## Escalation boundary

Escalate only when recovery cannot safely infer the next state: conflicting
durable authorities, a non-resumable active external operation, corrupted
state, or a required human decision. Include exact ids, revisions, and observed
evidence. "The daemon restarted" is not itself a blocker.
