# Offline Host state operations

These commands are explicit maintenance operations, not startup recovery. They
must be run against a stopped Host with a reviewed, installation-specific plan.
They do not scan for candidates or choose state to repair.

## Initialize reviewed creator metadata on legacy Tasks

`initialize-legacy-task-creators.ts` is a one-time offline operation for a finite,
reviewed batch of resource-backed Tasks created before creator metadata existed.
It does not discover candidates. Keep the installation-specific manifest private;
do not commit Task IDs, provenance, state paths or receipts.

The manifest has this portable shape (example values only):

```json
{
  "schemaVersion": 1,
  "appId": "example",
  "expectedEntryCount": 2,
  "creator": { "appId": "example" },
  "entries": [
    {
      "appId": "example",
      "taskId": "legacy-one",
      "expectedGeneration": 1,
      "expectedResourceVersion": 7,
      "legacySpecHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "provenance": { "reviewedEvidence": "private receipt reference" }
    },
    {
      "appId": "example",
      "taskId": "legacy-two",
      "expectedGeneration": 1,
      "expectedResourceVersion": 9,
      "legacySpecHash": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "provenance": { "reviewedEvidence": "private receipt reference" }
    }
  ]
}
```

The legacy spec hash is SHA-256 over the stable, recursively key-sorted JSON of
the complete stored `resource.spec`; use the exported `legacyTaskSpecHash` helper
when preparing and independently reviewing a manifest. Provenance must be
retained in every entry, but the operation never reads it to derive creator
authority. The App-only `creator` is explicit reviewed data.

The operation validates all entries inside one `BEGIN IMMEDIATE` transaction.
It rejects count mismatch, duplicate/missing Tasks, cross-App entries, changed
generation/resource-version/spec pins, running Tasks or attempts, conflicting
App or Task creators and mixed initialized/uninitialized batches. Apply changes
only absent creators, increments each listed Task's resource version once and
advances the App store revision once. It does not alter generation, spec, status,
attempts, Conditions, admissions, triggers, cancellation, relations or unrelated
rows. Exact replay of the same fully initialized manifest returns
`already-initialized` without writing.

Procedure:

1. Stop and quiesce the Host and **all** Task workers. Pausing one App is not
   sufficient. Confirm the processes are stopped independently.
2. Create and verify an offline backup using the installation-approved SQLite
   procedure. Never copy a live database separately from its WAL.
3. Through supported read-only tooling, re-read every manifested Task and review
   exact IDs, App, generation, resource version, complete stored spec hash,
   creator absence and retained provenance. Any mismatch requires a new review,
   not a broadened manifest.
4. Run the full validation as a rollback-only dry run while everything remains
   stopped:

```sh
bun run operate:initialize-legacy-task-creators -- \
  --state-dir /path/to/stopped/state --manifest /path/to/private-manifest.json \
  --confirm-host-and-workers-stopped --dry-run
```

5. Review `would-initialize`, then run the exact command without `--dry-run`.
   Accept only `initialized` or exact replay `already-initialized`.
6. Before restart, read back every listed Task and verify only App-only creator
   and resource-version bookkeeping changed. Keep the Host stopped and restore
   the approved backup if this verification fails; do not improvise raw SQL.
7. Restart through the normal operator path. Let retained App inbox input recover
   once, then verify ordinary App-only revision adopted the complete desired
   outcome/acceptance/input/outputs and execution selection while preserving
   unrelated obligations. Initializer success alone is not rollout proof.

## Recover one malformed direct Conversation Task input

`recover-malformed-conversation-input.ts` repairs the narrow case where a
system-origin App inbox row was already admitted with `targetTaskId` equal to a
Conversation executor instead of entering through `conversationId`.

The operation fails closed unless all of these still match the plan inside one
`BEGIN IMMEDIATE` transaction:

- inbox id, App, source, input body, original event, direct target, original
  idempotency key, handling state, Task wait and exact `task:<inputId>` admission;
- Task resource version, generation and lack of a current attempt;
- the target is the current stable Task for the supplied Conversation; and
- exactly one executable Task trigger exists for that saved input, its
  admission has no accepted result, and the recovery idempotency key is unused.

On apply it terminal-fails that inbox row without a result, removes only its
Task admission, trigger event and input wait, and uses the normal Conversation
admission primitive to save the retained message under a distinct recovery
idempotency key. The corrected row retains the original event id as provenance.
Failed attempts, accepted Task results, Task-wide retry diagnostics, other
trigger events, other admissions, Conversation identity and Task lineage are
retained. All changes commit or roll back together. Repeating an exact completed
repair, including the original tuple, returns `already-repaired`.

Dry-run executes the same validation and mutations, including canonical
Conversation admission, and then deliberately rolls back the transaction. It
therefore detects collisions and routing errors that apply would detect.

### Procedure

1. Stop and quiesce the Host and all Task workers. Do not merely pause an App.
2. Create and verify an offline backup using the installation's approved Host
   backup procedure. Do not copy a live SQLite file or separate it from its WAL.
   Record the backup identity and restoration procedure before continuing.
3. Read the exact inbox and Task resource through supported read-only tooling.
4. Copy the reviewed retained input into a private plan file (do not commit
   installation data):

```json
{
  "quiesced": true,
  "malformed": {
    "appId": "example",
    "inputId": "app_exact",
    "taskId": "conversation_exact",
    "originEventId": 123,
    "idempotencyKey": "original-v1",
    "taskAdmissionKey": "task:app_exact",
    "source": { "kind": "system", "id": "reviewed-source" },
    "input": { "kind": "message", "data": { "message": "retained verbatim message" } }
  },
  "taskFence": {
    "resourceVersion": 42,
    "generation": 1,
    "currentAttemptId": null
  },
  "recovery": {
    "conversationId": "example:primary",
    "idempotencyKey": "original-v1:offline-recovery-v1"
  }
}
```

5. While the Host remains stopped, dry-run the exact plan:

```sh
bun run operate:recover-malformed-conversation-input -- \
  --state-dir /path/to/stopped/state --plan /path/to/private-plan.json \
  --confirm-quiesced --dry-run
```

6. Review `would-repair`, then rerun the exact command without `--dry-run`.
   Restart only after the command returns `repaired` or `already-repaired`.
7. Let the retained natural retry deadline pace the corrected Conversation
   input. Do **not** invoke generic Task retry: it can restore the old failed
   attempt's malformed event. Through normal Host reads, verify the old row is
   terminal failed with no result and the recovery-key row is consumed by the
   same Conversation Task.

A mismatch is not permission to weaken or edit the plan until it passes. Re-read
current state and investigate why it changed. Never run this operation against a
live or merely presumed-idle database. If apply verification fails **before**
restart, keep the Host stopped and use the recorded, approved offline backup
restoration procedure; do not improvise a reverse mutation or raw SQL repair.
After the Host has restarted or accepted any new work, do not blindly restore the
old snapshot because that would erase newer evidence; stop again and escalate the
observed state for a new reviewed recovery decision.
