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
retired App (at most 1,000 combined, including admission preimages below).
Tasks must have no current attempt. Each Task includes the exact stored
`resource_json` and `trigger_json`; each inbox
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
Task/Conversation attachment or target are supported. Their parent, source,
original event, session, wait, recovery and body remain unchanged. Withdrawal
sets status to `done`, handling to `stopped`, and result to null; increments the
lease generation; clears scheduling/lease fields; and records terminal times.
A retained session wait is historical evidence, not proof of quiescence.

Missing inbox links alone do not prove absence of admission. The transaction
also checks durable admissions using canonical and historical input keys and
the retained request identity. By default any admission, including an accepted
answer whose inbox link was never projected, refuses withdrawal without
changing state.

For an explicitly withdrawn, unanswered legacy caller, the operator can add
`admissionWithdrawal` to that input entry. This is a separate reviewed decision
to end the caller's requirement unfulfilled; a Task's cancellation or completion
alone does not authorize it. Preserve all independent continuing obligations.

```ts
admissionWithdrawal: {
  decision: "withdraw-unfulfilled",
  rows: [{ app_id: "retired-example", task_id: "<exact admission key>",
    admission_json: "<exact stored admission_json bytes>" }]
}
```

The rows must be the complete exact census of that input's durable admissions,
including historical aliases and retained request identities. Different Task
and generation bindings may coexist; the operation never chooses one as the
answer authority. Every binding must name retained Task/receipt/cancellation
authority at least as new as its generation, with no current Task attempt.
Bound answers, accepted converged attempts, completion receipts or `closed`
terminal decisions (including prior closures archived by reopen) at the admitted
generation, and a converged Task whose `status.observedGeneration` matches that
generation refuse withdrawal, even after its requirements advance. A legacy Task
may be the only retained answer payload, even when both result bindings are
missing. Newer converged attempts also refuse withdrawal when their accepted
`inputKeys` explicitly include this exact admission key. Those answers require
separate exact cutover/settlement. An unrelated newer result cannot answer the
older input and remains preserved when that unanswered caller is withdrawn.

Retirement has two independent proof obligations: the withdrawn caller has no
retained answer authority, and cancellation cannot destroy the only retained
outcome. Neither can be inferred from a current phase, a missing inbox link or
a missing attempt reference. The relevant records have different meanings:

| Record | Authority in retirement |
| --- | --- |
| Task `metadata.generation` | Current desired requirements; not the generation of every retained observation. |
| Task `status.observedGeneration` | Controller acknowledgement. Revisions can retain it; explicit retry can rewind it while keeping the accepted attempt and payload. |
| Admission Task/generation/key | The exact caller requirement. Every alias remains; retirement never selects one. |
| Attempt `taskGeneration` and accepted `inputKeys` | The accepted contribution's generation and explicit caller scope. Newer unrelated outcomes do not fulfill an older caller. |
| Attempt `acceptedResult` | Retained accepted summary, response and result, including waiting and incomplete reports. |
| Attempt `summary` | Retained execution/controller diagnostic. An incomplete report can retain a decorated summary here and a different original summary in `acceptedResult`. |
| Task `status.summary/response/result` | A projection that cancellation replaces. A pending, waiting or attention phase can still hold the only historical payload. |
| Completion receipt or `closed` terminal decision | Legacy completion authority, including the closure archived in a reopen control receipt. Same-generation completion requires separate caller settlement; a later cancellation does not erase it. A `cancelled` decision records withdrawal instead. |

By default, `assertRetainedRetirementOutcome` verifies every planned Task's
projected values independently of phase. Any retained summary, response, result,
observed-attempt reference or accepted phase requires a resolvable, completed,
accepted observed attempt belonging to that exact Task. Its own generation must
be valid and no newer than the desired generation; controller acknowledgement
is not a replacement for attempt identity. Missing, dangling, foreign or
inconsistent provenance refuses the transaction. A fresh Task without outcome
evidence needs no manufactured acceptance record.

Every present response/result must match the retained accepted payload. The
summary must match either the accepted summary or the same attempt's retained
summary. This recognizes canonical incomplete-report diagnostics without parsing
or whitelisting text prefixes, weakening payload checks or claiming fulfillment.
Ambiguous legacy/controller-only projections require separate exact cutover;
retirement never reconstructs an acceptance record or picks a latest attempt.

For a reviewed legacy projection whose acceptance identity cannot be established,
the Task entry can explicitly request archival preservation instead:

```ts
legacyObservation: {
  decision: "preserve-unverified",
  reason: "Original acceptance identity is unavailable; preserve the exact observation without assigning fulfillment"
}
```

This changes only the preservation proof for that Task. Canonical cancellation
and an exact copy of its original `resourceJson` and `triggerJson` commit in the
same transaction. The cancellation control receipt retains those bytes, the
reviewed preservation reason, and kind `unverified-legacy-observation` under
`retainedObservation`. Whitespace, legacy fields, payloads and references are
preserved verbatim. Missing or changed archival evidence, including during
replay, refuses the transaction; a failed write rolls back cancellation and
caller withdrawal together. The original plan remains necessary for replay.

An observation is historical evidence, not an accepted attempt, completion,
answer or reconstructed identity. This option creates no acceptance records,
selects no alias, and changes none of the caller-answer checks above. A known
answer still requires separate settlement even when its Task is archived.
Absent this explicit per-Task decision, missing accepted provenance still
refuses retirement. All original attempts, admissions and prior terminal
authority remain unchanged. Preserve original Conditions in the offline backup
as required below; Task archival does not replace that backup.

The selected proof runs on the original reviewed Task preimages during exact replay,
so a previous cancellation cannot conceal missing or changed outcome history.
Replay also fences terminal response and facts. All refusal paths and dry-runs
leave the complete transaction unchanged.

Withdrawal retains every admission byte, Task completion receipt and accepted
attempt. The inbox row becomes stopped with a null result, preserving its caller
chain and original wait as history. It does not publish an answer, fabricate
fulfillment, reattach an alias, delete admission authority, or satisfy caller
Conditions. Missing, added, changed, duplicated or foreign admissions reject
the whole transaction, including during replay. The full plan digest binds this
explicit withdrawal decision and all its admission preimages.

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
