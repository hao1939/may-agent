# Offline Host state operations

These commands are explicit maintenance operations, not startup recovery. They
must be run against a stopped Host with a reviewed, installation-specific plan.
They do not scan for candidates or choose state to repair.

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

## Withdraw the remaining state of an explicitly retired App

`retire-app-state.ts` is an offline operator tool for the final, reviewed
withdrawal of an App's remaining responsibility. It does not decide which work
is worth doing, transfer ownership, or claim that an outcome was fulfilled.
App removal alone never authorizes cancellation. First retain the owner's
exact disposition and any independently continuing work in other Apps.

The plan names every nonterminal Task and every unfinished inbox row of one
retired App (at most 1,000 combined). Tasks must have no current attempt. Each
Task includes the exact stored `resource_json` and `trigger_json`; each inbox
entry includes the complete raw `SELECT * FROM app_inbox_items` row. Reasons
must identify the reviewed withdrawal decision, not a phase-based heuristic.
Do not commit these private preimages or installation data.

A retained Task is terminal when its legacy completion receipt names the same
or a newer generation. Such Tasks are excluded from the nonterminal census and
must not be in the plan. A revised Task newer than its receipt remains in the census.

```ts
// JSON plan shape; strings contain exact stored bytes, not reserialized resources.
{
  id: "reviewed-withdrawal-v1",
  appId: "retired-example",
  quiesced: true,
  appRetired: true,
  tasks: [{ taskId: "exact-task", resourceJson: "<exact stored resource_json>",
    triggerJson: null, reason: "Outcome explicitly withdrawn unfulfilled; retained decision reference" }],
  inputs: [{ row: { /* complete exact raw inbox row, including null columns */ },
    reason: "Historical caller chain explicitly withdrawn; retained decision reference" }]
}
```

Only legacy inbox rows with `pending` or `handling` status, no result and no
Task/Conversation admission or target are supported. Their parent, source,
original event, session, wait, recovery and body remain unchanged. Withdrawal
sets status to `done`, handling to `stopped`, and result to null; increments the
lease generation; clears scheduling/lease fields; and records terminal times.
A retained session wait is historical evidence, not proof of quiescence.

Missing inbox links alone do not prove absence of admission. The transaction
also checks durable admissions using canonical and historical input keys and
the retained request identity. Any admission, including an accepted answer
whose inbox link was never projected, refuses withdrawal without changing state.

An input-only plan can inspect an App that never activated Task resource
authority, without creating metadata or activating a seed. The complete Task
census still applies: omitting existing nonterminal Tasks is rejected. Plans
that include Tasks require active resource authority for canonical cancellation.

Tasks use canonical human cancellation with exact generation/resource-version
fences and control receipts. Original accepted attempts are retained. The
current Task projection records withdrawal; it does not replace the original
accepted attempt's evidence. Canonical cancellation removes executable triggers,
unlinks Conditions, and may prune now-unreferenced Conditions of this App.
**Archive their exact preimages before applying.** No Condition is observed as
satisfied. Other Apps' Tasks, Conditions and inputs are outside this operation.

All census checks, preimage checks and mutations share one transaction. Dry-run
executes the real cancellation and inbox writes, then rolls everything back.
A SHA-256 of the full parsed plan is recorded in terminal reasons and scopes
control receipt keys, including App identity. Different Apps can reuse plan and
Task ids without colliding. Exact replay returns `already-retired`; changed
plans, partial/foreign decisions, new work or
changed terminal versions fail closed. Keep the plan unchanged, including JSON
property and array order, for replay.
Constructed terminal reasons are trimmed consistently with canonical Task
cancellation; trailing whitespace in a reviewed reason does not break replay.

### Retirement procedure

1. Ensure the reviewed App is retired in installation configuration and absent
   from loaded definitions. Stop and quiesce the Host and **all** its workers.
   The plan booleans and CLI flags are trusted operator acknowledgements; this
   tool cannot establish process quiescence or inspect installation definitions.
   Paused scheduling and expired leases are insufficient.
2. Create and verify an offline backup using the approved Host backup procedure,
   including SQLite's WAL where applicable. Record restoration instructions.
   Preserve exact original Task, input, Condition and accepted-attempt evidence,
   disposition references and independently continuing obligations.
3. While stopped, save and review the exact private plan against the full census.
   A preparation snapshot taken earlier must be reread and checked for changes.
4. Run the exact plan while the Host remains stopped:

```sh
bun scripts/operations/retire-app-state.ts \
  --state-dir /path/to/stopped/state --plan /path/to/private-plan.json \
  --confirm-quiesced --confirm-app-retired --dry-run
```

5. Review `would-retire` and rerun without `--dry-run`. Verify the terminal
   census, stopped/null-result inputs, retained evidence, and unchanged state
   of independently continuing Apps before restarting the Host.
6. On mismatch, investigate; do not weaken the plan to make it pass. If apply
   verification fails before restart, retain the stopped state and use the
   recorded backup procedure. After new work is accepted, never restore an old
   snapshot blindly; stop again and review recovery with the newer evidence.

The operation is never invoked by startup, definition removal or background
reconciliation. It does not require reloading retired controllers. Ship and
review the Host tool before using it on a live installation's stopped state.
