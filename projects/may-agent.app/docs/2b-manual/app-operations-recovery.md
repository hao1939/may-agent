# App operations and recovery

Durable request correlation and task state are authoritative. Tasks own App
work; events trigger review and are not work queues to replay manually.

## Normal restart

Restart the daemon normally. Startup:

1. loads and validates enabled Apps' `app.ts` files into one immutable registry snapshot;
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

## Disable an App

Place an empty `.disabled` file directly in `projects/<name>.app/`, then restart.
Remove the file and restart to enable the App again.
No additional configuration or command is needed.

The marker skips the App before importing its code, including its App-local
agents. Its routes, schedules, observers and Task controller are not installed.
Existing Tasks and history are retained; disabling is not cancellation or
deletion. Global agents remain independent.

The marker belongs to the local installation, not a versioned App code
snapshot; keep it out of Git. There is no filesystem watcher: changes take
effect on restart or a successful `/reload`. Reload still rejects removing an
App with unfinished Tasks, requests or admission commands and keeps the prior
generation; use restart to leave that work saved but inactive. This marker
does not add a hot-stop mechanism.

App selection is captured when preparing a generation. Its agents, message
targets, admission workers, recovery and Task attempts use that accepted
selection with the matching source snapshot. Later marker edits must not
change those workers, including after a rejected reload. The selection is
internal generation data, not another installation configuration file.

**Availability:** Implemented on `feat/app-disable-marker`, not in `v0.2.0`.
Use a Host build containing the change before relying on the marker.

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
generic session manager. A Task in `attention` retains the durable obligation;
that alone does not prove its owner was notified or acted. Inspect the reason
and existing declared owner/parent route, then repair the prerequisite or obtain
an authorized decision for that same Task. Do not create a replacement Task or
invent an owner-inbox event merely because it is waiting for attention. The
[controller proposal](../proposals/task-controller-pattern.md) tracks the
remaining end-to-end decision-route proof.

For a state-shape migration:

1. pause the App lifecycle;
2. let current attempts drain;
3. audit and dry-run against the exact state revision;
4. apply with that expected revision;
5. verify task/Condition integrity;
6. resume the App.

The revision guard must fail closed if state changes between review and apply.

### Retained pre-resource installations

Current Host source requires SQLite Task resource authority. It does not contain
the former `cutover-task-resources.ts` command or a mutable whole-App JSON
fallback. A normal restart never imports or activates legacy state implicitly.

If retained state still needs that migration, stop at the compatibility boundary
and identify a reviewed migration release and exact source revision. Preserve
both stores; do not resume historical JSON as a second authority. The
[retired procedure](../archive/implementation/retired-task-resource-cutover.md)
records the removal boundary and earlier steps, not a current command to run.

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

A correlated Runtime deployment in this installation must name an existing
maintenance App Task with `appId: may-agent`. This restriction is enforced by
the current scripts; it is not a universal App role. A May human request is not deployment authority,
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
with the requested source commit, correlation, or maintenance Task and
inspect only matching JSON receipts under
`/app/projects/may-agent/.state/deploy-receipts/`. The terminal receipt is the
authoritative binding among `sourceCommit`, `artifactSha`, the loaded artifact,
health, and the originating `{project, taskId, correlation}`. Internal
activation markers and their disappearance are not completion evidence.

The [deployment-boundary candidate (#179)](https://github.com/hao1939/may-agent/pull/179) moves receipt interpretation out of the
generic Task executor. Its restarter attaches the settled `deploymentReceipt`
to a `deployment.settled` fact with canonical
`target: { appId, taskId }`. This is operation evidence, not a replaceable timer
tick. When that best-effort wake is lost, the maintenance App
can run `bun scripts/deploy-receipt.ts read-task RECEIPT_DIR may-agent TASK_ID`
from reviewed Host source (or invoke the staged `bundle/deploy-receipt.ts`).
Use the actual configured receipt directory, including an installation override.
This command only reads, matches both App and Task, and returns the latest
receipt or `null`. Invalid/unreadable evidence fails visibly; it is not absence
or authority to deploy. Adoption requires the maintenance-agent guidance and
Host source together; this document does not claim the running image changed.

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

### Retained local rollout receipt: 2026-09-19

The authorized in-container rollout after Host PRs #200, #202, and #203 merged
used maintenance Task `may-agent/runtime/platform-owner-review` and correlation
`merged-7fc90f57-20260919T1027Z`. Its terminal receipt at
`/app/projects/may-agent/.state/deploy-receipts/merged-7fc90f57-20260919T1027Z.json`
binds source `7fc90f57829ad6a8ddd48eb3de8489e527314cf5` to artifact and loaded SHA-256
`7be9003df66f53d748132101a677277a86048e21b18d751e260d81375403e1bf`, with
`phase: succeeded`, `health: healthy`, and `duplicateDeploy: false`. A second
receipt, correlation `merged-7fc90f57-20260919T1029Z`, records an unnecessary
successful deployment of the same source and artifact 31 seconds later. Each
receipt's `duplicateDeploy: false` is scoped to its own correlation; it does not
prove there was no equivalent deployment under another correlation. Before
choosing a new correlation after a restart, inspect existing exact source, Task,
and artifact receipts and verify a match instead of deploying again.

Independent read-back is retained at
`/app/.state/review-pilots/host-release-20260919/merged-7fc90f57-live-verification.json`.
It confirms matching bundle provenance and live binary hash, readiness, all
three long-lived services running, and the unchanged container start time
`2026-09-15T15:11:36.651441173Z`. This receipt supersedes the earlier staged
PR #199 deployment record for current live identity and proves binary, Console,
SDK, and UI adoption.

The separate quiesced repair evidence is retained under
`/app/.state/review-pilots/host-release-20260919/offline-recovery-7fc90f57/`.
Its terminal `apply-receipt.json` records `status: repaired`, malformed input
`app_3b2c919d-052d-4764-999a-efed0596f57f`, replacement input
`app_62aff70d-b868-4965-8317-61f1994171c4`, and the unchanged Conversation Task
`conversation_ec854e2f09f1c38566a25857_successor_2`. The backup quick-check,
quiesced fence, snapshot hashes, and pre-restart verification are retained in
that directory. They prove the bounded state repair, not
that normal pacing has consumed the replacement input; accepted Task state must
be read before claiming corrected consumption.

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
