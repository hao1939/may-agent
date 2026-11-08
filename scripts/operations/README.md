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

Subsequent runtime opens observe withdrawal from shared SQLite state. New Task
creation, claims and helpers incur no new workload charges/reservations; ordinary
Host/App scheduling, Task authority, permissions, timeouts and cleanup still
apply. Workload feedback marks the former credit/shared execution limits
unavailable instead of reporting historical caps as active capacity. Unbound
execution returns to its ordinary unconfigured-policy path.

This path is one-way. Reinstalling limits or policy cannot reactivate enforcement
after withdrawal: work performed afterward has an explicit accounting gap and
requires a separately reviewed adoption protocol. Never delete the withdrawal
receipt, erase accounting rows or restore an older database after newer work
starts to simulate reactivation. Retain the command, receipt and external
stop/cleanup evidence. Runtime start and App activation remain separate authorized
operations; portable source checks do not prove live exclusion or model behavior.
