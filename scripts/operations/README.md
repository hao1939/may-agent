# Offline Host state operations

These commands use reviewed, installation-specific plans. Existing-state
maintenance requires a stopped Host and is not startup recovery. New-state
initialization publishes only into a genuinely unused state path. These commands
do not scan for candidates or choose business work to repair.

## Initialize workload policy for a new installation

`initialize-workload-state.ts` creates a complete Host database with trusted
credit and execution declarations before the first ordinary opener can start
work. Its destination must not exist; the parent directory must already exist.
It refuses an existing empty directory, database, backup, recovery file or
session history. Never delete or move retained state to make it look new: this
command does not adopt historical obligations or executions.

Save a private plan. Recipient identities are resolved installation-relative
definition directories or explicit programmatic Host identities, not call aliases
or absolute release paths. Each App needs an explicit new-root concurrency default;
exact future root limits may be supplied in `limits` and take precedence. Known
standing/coordination funding uses the existing installed-policy declarations.

```json
{
  "version": 1,
  "host": { "slots": 4, "backgroundSlots": 2 },
  "apps": [{
    "appId": "example",
    "sponsor": { "appId": "example", "agent": "owner" },
    "dailyCredits": 10,
    "rootCredits": 5,
    "rootExecutionSlots": 2
  }],
  "limits": [{
    "scope": {
      "kind": "agent",
      "recipient": { "kind": "directory", "id": "projects/example.app/agents/owner" }
    },
    "slots": 2
  }]
}
```

Run this command from the reviewed standalone Host checkout with frozen
dependencies and the supported Bun version. It is not a compiled-daemon flag.

```sh
bun scripts/operations/initialize-workload-state.ts \
  --new-state-dir /path/to/unused-state --plan /path/to/private-installation.json
```

Shared Host limits cover the entire installation. Use an isolated configured
installation for the first pilot, or review coverage for every App, recipient
and execution method that will remain enabled. Enabling one App's feedback does
not make enforcement App-local. Unconfigured independent creation is retained
with `sponsor-policy`; retained unattributed claims defer with `adoption-required`
before taking a place or spending an attempt. A funded contribution can still
use its creator's account across Apps. Other enabled work is not promised to
continue without configuration and, for retained Tasks, explicit adoption.

Review installed App declarations and the resources required by their methods
before starting the Host at that path. A coordination workflow with an inline
model helper needs two simultaneous places across Host, recipient and root,
and enough protected credits for creation, attempt and helper. Its installed
coordination declaration must match the App's exact Task, owner, workflow and
timeout. A free Host place cannot override missing or full narrower limits.

The initializer validates bounded declarations and uses the existing accounting
stores in private staging state. It closes SQLite in single-file journal mode,
then publishes exclusively without replacing a competing opener's file. On a
race or interruption, inspect the destination; never overwrite it to retry.
An existing database may be the successful result of the first invocation or
belong to another opener. The tool does not infer a safe replay from emptiness.

Task/App admission, seeded resources, claims and helpers continue through their
ordinary authority and deferral paths. Unbound direct and persistent sessions
remain unsupported under installed execution limits; Task-based Conversations
use the canonical Task engine. Missing policy does not grant free starts.
Initialization does not validate arbitrary App business methods, activate App
source, launch a model, restart a service or establish model judgment quality.
Retained installations still require an explicit adoption/cutover protocol.

The receiving App's declared agent owns input before Task creation. Its scoped
workload read includes a separate five-item `unadmittedInputs` page with its own
`inputCursor`; Task-page counts and agent filters do not cover that demand.
Inspect exact evidence and the saved caller route through the existing trusted
Inbox item read (`GET /api/app-inbox/:id`). A saved funding hold is pending
admission, not an accepted business result, rejection or caller delivery. Policy
installation, an authorized funding change, exact Task creation/adoption or a
due UTC grant can wake existing admission recovery. A declared bounded owner
review may consider a changed hold; it cannot grant funding or end the input
without the App's existing authority. Oversized identities are counted as omitted
and require exact Inbox inspection; unavailable or omitted evidence cannot prove
an empty workload. Keep operator inspection available outside budgeted methods.

## Install workload policy on retained, cleaned state

`install-retained-workload-state.ts` installs policy and explicit future Task
attribution in one transaction on an existing Host database. It is an offline
operation for state whose old executions have already been cleaned. It does not
import live execution, drain descendants, close Tasks, reconstruct past spending,
change an existing allowance, or provide an online activation barrier.

The operator must establish exclusion **before** using the command:

1. Disable ingress and every launcher or automatic restart path, including
   maintenance/liveness supervisors. Stop the Host, all Task workers and all
   other processes or installations that can open this state. App pause and an
   empty runnable queue do not establish this condition.
2. Retain the operating evidence for the installation's process/container/cgroup
   identities, confirmed exits and absence of remaining members. Include model
   and CLI descendants and confirmed persisted Bash-group cleanup. Prevent any
   runtime from reopening the state throughout planning, dry run and apply; for
   a container installation, expose its stopped state only to the maintenance
   environment. A portable command cannot prove this installation-wide exclusion.
3. Resolve incomplete execution through the existing confirmed recovery paths
   before this operation. If that requires running a Host, complete recovery and
   repeat the stop/exclusion procedure. Take a consistent offline backup after
   cleanup. Never delete markers, group records or reservations, or edit Task
   phases to make the installation checks pass.

The command additionally refuses any unreleased execution reservation or running
attempt, including execution belonging to an ended Task. It scans every retained
session, refusing active/start/group artifacts, missing/corrupt metadata, running
sessions and live detached owners even when their metadata is terminal. It never
cleans up those artifacts. These checks are conservative prerequisites, not proof
that a start has not passed admission before writing its first artifact.
`--confirm-quiesced` records the external operating contract; it cannot establish
that contract. Do not run this command against a serving installation.

Save a reviewed private plan. `policy` has the same declaration format as fresh
initialization. Every selected Task needs its exact current generation and
resource version; every retained root needs its own fenced adoption and explicit
root execution limit. Creation defaults apply only to future roots. For example:

```json
{
  "version": 1,
  "policy": {
    "version": 1,
    "host": { "slots": 4, "backgroundSlots": 2 },
    "apps": [{
      "appId": "example",
      "sponsor": { "appId": "example", "agent": "owner" },
      "dailyCredits": 10,
      "rootCredits": 5,
      "rootExecutionSlots": 2
    }],
    "limits": [
      { "scope": { "kind": "agent", "recipient": {
        "kind": "directory", "id": "projects/example.app/agents/owner"
      } }, "slots": 2 },
      { "scope": { "kind": "root", "root": {
        "appId": "example", "taskId": "retained-work"
      } }, "slots": 1 }
    ]
  },
  "adoptions": [{
    "task": { "appId": "example", "taskId": "retained-work" },
    "generation": 2,
    "resourceVersion": 7,
    "root": {
      "root": { "appId": "example", "taskId": "retained-work" },
      "sponsor": { "appId": "example", "agent": "owner" },
      "purpose": "ordinary",
      "credits": 5,
      "renewal": "lifetime"
    },
    "adoptionId": "workload-installation:retained-work:v1",
    "reason": "Attribute future work under reviewed installation policy"
  }]
}
```

Explicitly list each contribution with the same root descriptor. No structural
parent or old creator is used to infer funding, and no historical creation,
attempt or helper charge is invented. Adoption records cost zero; actual future
starts consume the existing shared allowance. Omitted retained Tasks stay
unattributed and defer future execution rather than receiving free work. Existing
caller obligations, accepted results and business closure records are preserved.
Protected coordination must match its exact ordinary eligibility policy and have
an explicit protected root/recipient limit covering its complete method.

From a reviewed standalone source checkout with frozen dependencies, while the
external exclusion remains in force:

```sh
bun scripts/operations/install-retained-workload-state.ts \
  --state-dir /path/to/isolated-state --plan /path/to/private-installation.json \
  --confirm-quiesced --dry-run
```

Review the successful dry-run result, then execute the same command without
`--dry-run`, before allowing any runtime access. Dry run executes the validation
transaction and rolls it back. A failed apply rolls back policy, limits, bindings,
adoption receipts and recovery wakes together. Retain the plan and result with
the external stop/exclusion evidence. This command neither upgrades the schema
nor starts a service; starting the integrated Host remains a separately authorized
operation. Unbound direct/persistent sessions remain unsupported under limits.

Existing exact policies/adoption records can be retained; this command cannot
amend their attribution or allowances. A stale resource fence refuses the plan;
inspect the current state and make a new reviewed plan rather than forcing replay.
Do not roll back a subsequently running installation by restoring an old database:
that would erase newer obligations and spending. Online activation, historical
live-execution import and enforcement withdrawal need their own protocols.

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

## Withdraw workload enforcement on retained, cleaned state

`withdraw-workload-enforcement.ts` ends the installation's workload credit and
shared execution enforcement. Use the same external stop, launcher exclusion,
descendant cleanup and consistent-backup procedure required for retained-state
installation above. Keep that exclusion throughout inspect, review, dry run and
apply. The command performs the same conservative file/session and SQL execution
checks; neither those checks nor `--confirm-quiesced` establishes a start barrier.
It refuses live reservations and running attempts, including ended-Task execution.

From the reviewed source checkout with frozen dependencies, inspect the isolated
state and retain the returned configuration digest:

```sh
bun scripts/operations/withdraw-workload-enforcement.ts \
  --state-dir /path/to/isolated-state --confirm-quiesced --inspect
```

Save a reviewed private plan using that exact digest, a unique operation identity
and the reason for withdrawal:

```json
{
  "version": 1,
  "operationId": "end-workload-pilot-v1",
  "reason": "End the reviewed workload pilot",
  "expectedConfigurationDigest": "<64 lowercase hex characters returned by inspect>"
}
```

The digest fences all installed credit policies, execution limits and root caps.
A changed declaration requires fresh inspection and review. Dry-run the plan:

```sh
bun scripts/operations/withdraw-workload-enforcement.ts \
  --state-dir /path/to/isolated-state --plan /path/to/private-withdrawal.json \
  --confirm-quiesced --dry-run
```

Review its result, then apply the same command without `--dry-run`, keeping
external exclusion in force. The command opens an existing ordinary database;
it does not upgrade schema, start a service or reload App definitions.

Withdrawal commits one durable installation receipt and clears only workload
funding/execution holds, waking their canonical Task and saved Inbox input paths.
It retains policies, root attribution, credits already spent, execution receipts,
accepted results, caller links, business closure, workspace prerequisites, pauses
and exhausted retry authority. A failure rolls back the receipt and every wake;
dry run rolls back the complete transaction. Exact command replay is read-only
under the same offline prerequisites. A conflicting command is rejected.

Subsequent runtime opens using this integrated source observe withdrawal from
shared SQLite state. New Task
creation, claims and helpers incur no new workload charges/reservations; ordinary
Host/App scheduling, Task authority, permissions, timeouts and cleanup still
apply. Workload feedback marks the former credit/shared execution limits
unavailable instead of reporting historical caps as active capacity. Unbound
execution returns to its ordinary unconfigured-policy path.

This path is one-way. Reinstalling limits or policy cannot reactivate enforcement
after withdrawal: work performed afterward has an explicit accounting gap and
requires a separately reviewed adoption protocol. Never delete the withdrawal
receipt, erase accounting rows or restore an older database after newer work
starts to simulate reactivation. Continue using a withdrawal-aware Host revision;
a binary predating this protocol cannot honor its receipt and must not reopen
withdrawn state. Retain the command, receipt and external
stop/cleanup evidence. Runtime start and App activation remain separate authorized
operations; portable source checks do not prove live exclusion or model behavior.


## Convert retired Task contracts

`convert-task-contracts.ts` is an explicit offline upgrade from the retired
Conversation executor and `tasks.resolve` admission route to common Task execution.
It is never called by startup. Use matching current App source, including
`conversation.mode: "task"` and ordinary event subscriptions, in a reviewed checkout.

Keep the Host, every worker and every launcher stopped and excluded throughout
inspection, backup, dry run and apply. Use the same external exclusion and
consistent SQLite/WAL backup procedure documented above. The confirmation flag
and conservative file/SQL checks cannot establish process exclusion. First use the
previous Host's normal recovery to confirm cleanup of running attempts, execution
reservations, session markers and descendants. Pending Conversation settlements or
frozen Conversation admission commands must be settled with that Host first.

From the new Host checkout, with frozen dependencies:

```sh
bun scripts/operations/convert-task-contracts.ts \
  --state-dir /path/to/stopped/state \
  --projects-root /path/to/matching/new/projects --confirm-quiesced
```

This defaults to a transaction rolled back after exercising the real conversion.
Review its Task/route counts and compare the retained inputs, Requests and accepted
results with the backup. Add `--apply` to commit the same conversion while still
stopped. Repeating an applied conversion changes nothing.

The transaction translates linked Conversation Tasks from executor `conversation`
to `agent`, increments resource versions and preserves generation, accepted
history, readiness, waits, Requests and input identities. It translates unresolved
legacy event routes through the matching App's ordinary subscriptions using the
original saved event envelope, preserving exact Condition targets. Missing,
ambiguous, invalid or orphan state rejects the entire operation; nothing is
silently dropped. A current subscription returning null deliberately declines an
event; existing Condition targets still remain. Frozen ordinary Task intents and
terminal history remain evidence and are not reinterpreted.

Inspect results before separately authorized activation of the matching Host and
Apps. Convert only while the launcher barrier remains in force. If validation or
conversion fails, investigate with the prior source and backup. Do not start a
partially upgraded pair, restore old state after accepting new work, or run this
operation against a serving installation. Runtime preparation refuses retained
old contracts before consuming a new execution attempt.

Removed capabilities have no hidden fallback: dynamic `cron.json` handlers and
the cron tool must move into App schedules/observers; workflow `resume` and helper
`sessionId` reuse are unavailable. Task retry starts the current method afresh,
with saved evidence for inspecting prior effects. This is not an exactly-once
external-effect guarantee. Fixed retention, watchdogs, metrics, active session
steering, transcripts, cancellation and stale-result fencing remain.
