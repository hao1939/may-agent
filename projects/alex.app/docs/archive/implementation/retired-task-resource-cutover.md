# Retired Task resource cutover procedure

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical procedure; not a current operating instruction.
**Version boundary:** Host commit `5468985506931b5f6695fc98a75014dd48f8c731`
removed the completed JSON cutover path and `scripts/cutover-task-resources.ts`.
The procedure below describes source before that removal; it does not establish
which old release is safe for a particular retained installation.

Current authorities are [Storage](../../2a-design/storage.md),
[Task Resource Engine](../../2a-design/task-resource-engine.md), and
[Operations and Recovery](../../2b-manual/app-operations-recovery.md). Current
Host source requires resource authority. Do not restore a second mutable JSON
writer or run these commands against today's release. An installation that
still needs migration requires an explicitly reviewed compatible release and
its state-revision evidence.

## Preserved earlier procedure

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
