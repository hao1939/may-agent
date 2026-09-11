# Controller judgment experiment

This is an opt-in model experiment, outside CI. It asks whether a small App
judgment contract is usable with process handled by code. It does **not**
prove the complete common Task lifecycle or its migration.

Run from the Host checkout with an authorized, configured model endpoint:

```sh
bun scripts/poc/controller-judgment/run.ts --live --model MODEL --out /tmp/controller-development --scenarios scripts/poc/controller-judgment/development.json
bun scripts/poc/controller-judgment/run.ts --live --model MODEL --out /tmp/controller-transfer --scenarios scripts/poc/controller-judgment/transfer.json
```

Use `--host-contract` to exercise the actual Task protocol and SDK result schema
on the same answer/give-up cases. Select cases from the committed fixtures:

```sh
bun scripts/poc/controller-judgment/run.ts --live --host-contract --model MODEL --out /tmp/controller-host-development --scenarios scripts/poc/controller-judgment/development.json --cases answer-from-returned-evidence,affordable-give-up
bun scripts/poc/controller-judgment/run.ts --live --host-contract --model MODEL --out /tmp/controller-host-transfer --scenarios scripts/poc/controller-judgment/transfer.json --cases reject-returned-measurement
```

This mode changes instructions and result admission; it still uses the direct
executor, fixture evidence and restricted tools. It does not test the full
managed adapter, installed App or cross-App dependency calls. A valid `stopped`
judgment must survive `finish(status: "failure")` as completed execution and
be accepted as evidence; the continuing-Task design also requires a later attempt for unfinished work. Check `settlementPass` as well as
`decisionPass`; either failing makes the experiment exit nonzero. The harness
does not score source settlement for its judgment-only ask/wait cases.

Run development before the held-back transfer set; do not tune the contract to
transfer answers. Each case starts a fresh agent with ordinary work and fixture
evidence, using the real direct-agent executor. It has no coding, task-control,
subscription or delegation tool. The agent returns a judgment; code supplies
identities, persists accepted results or admits a child through production Task
functions, and releases the production controller slot. There are no workers
delegated to perform this development task and no live App/production changes.

For a returned-result case, code settles a synthetic measurement through the
real reconciler, closes/reopens SQLite, reads the exact accepted attempt and
supplies its evidence through the same context reader used by real Task
executors. The child stays open. This experimental branch removes the parent
liveness block: a supported answer is accepted while the child remains open.
The previous source produced `acceptedState: waiting` for those same cases.

Read `report.json` and the local transcripts. `decisionPass` scores only the
choice of action; inspect response accuracy and usefulness separately. Reports
include duration, attempted tools, provider usage, source settlement and SQLite
paths. Provider cost metadata is not a verified bill. A nonzero exit indicates
a bad/invalid action choice, rejected source settlement or experiment failure. A zero exit does not certify
all lifecycle gates. No response-to-user delivery or deployed May agent is used.

`ask` and `wait` are judgment-only cases in this harness; their interface and
wait transitions are not exercised. `give-up` records an accepted non-success
outcome without closing the Task. Its unfinished input now retains a retry deadline; this one-decision harness does not run that retry. Delegation admits a real child
but does not run that child or route its result in this harness. Likewise,
discussion cases test the agent's choice, not concurrent inbox availability.
Each `run.ts` case stops after one decision. Controller callbacks have no automatic
retry here, so invalid output is visible. The underlying agent executor retains
its normal bounded finish/provider handling; inspect all calls in the transcript.
Private artifacts and temporary SQLite remain outside the checkout for review;
do not publish raw transcripts or endpoint errors.

## Managed Conversation recovery

For the critical shared loop with actual App policy and live worker execution:

```sh
bun scripts/poc/controller-judgment/shared-loop.ts --live --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/shared-loop-development
bun scripts/poc/controller-judgment/shared-loop.ts --live --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/shared-loop-transfer --value 0.78
```

Run the first before the second without tuning to the second measurement.
The trial copies `may.app`'s declaration/seed, May's role instructions and shared
common sense into temporary state. The only configuration changes select the
model and limit tool presets to local coding and finish; no installed Apps,
optional skills or CLI delegation are provided. Both A (human interaction) and
B (measurement) use the normal Task controller, real workers and live model.
The HTTP fixture holds B's observation until A answers an intervening discussion.
Code checks the accepted Request, exact outcome return, open Tasks and retained
context after runtime/SQLite reopen. The model chooses delegation and all replies.

Read the final and resumed answers to assess judgment, including the minimum
comparison. A passing mechanical gate does not score every sentence. Reports
retain source revisions/hashes, dispatches, model steps, tool calls/errors,
usage metadata, events and local transcripts. The eight-dispatch and six-minute
limits bound the experiment, not Task lifetime. This uses a reduced tool catalog
and a controlled observation source; it does not certify full installation,
transport delivery, operational migration or every recovery case. Raw reports
and provider logs remain local.

`managed-conversation.ts` uses actual human-event admission, a stable Conversation
Task, the installed controller, `SubagentManager`, model/tool execution, and
Conversation settlement. Its only domain tool reads a synthetic measurement or
appends a record in temporary storage. A repeated write really creates another
record, so the trial can detect duplicate effects.

```sh
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/conversation-empty --fault empty
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/conversation-effect --fault after-effect
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/conversation-restart --fault attempt-loss --value 0.78
```

Run the lower-value case without changing instructions. `empty` injects an empty
initial assistant response. `after-effect` injects the known stream-terminal
failure after the record commits. `attempt-loss` loses the managed result before
Task settlement, reopens SQLite and reinstalls the runtime; the normal recovery
timer supplies another attempt with the saved failure and session reference.
The harness does not construct a recovery prompt or supply a previous report.

The gate checks actual fault injection, one recorded value, one input and Task,
a stored answer containing the value, retained Request updates, no legacy
execution, and no additional work from a quiet review tick. The restart case
also checks two attempts and the exact earlier failed session in the new context.
Inspect the answer's comparison with the minimum separately; a passing mechanical
gate does not score all prose or prove general agent judgment. Reports retain
model steps, tool errors, stream calls, usage metadata and elapsed time; backend
internal retries and billing are not independently measured.

This is the real managed **in-process** path with a synthetic App, not a Task
worker subprocess, installed May App, or transport-delivery trial. Child chains,
input during background waits, full migration and retirement of the old owner
still need their own proof. The trial bounds its own model calls, attempts and
elapsed time; those fixture limits are not a Task lifetime policy.

## Follow-through across attempts

The separate `follow-through.ts` trial uses three fresh model executions under
one production Task controller: request independent measurement, explain a
threshold while measurement waits, then assess the returned value. Between the
explanation and result, it closes/reopens SQLite and replaces the controller.
Code creates the child identity, runs a deterministic measurement fixture,
routes the accepted result and supplies the original ask through `continuedInputs`.
The model does not copy admission keys, poll, subscribe or redeclare a wait.

```sh
bun scripts/poc/controller-judgment/follow-through.ts --live --model MODEL --out /tmp/follow-through-development --value 0.92
bun scripts/poc/controller-judgment/follow-through.ts --live --model MODEL --out /tmp/follow-through-transfer --value 0.78
```

Run the second case without changing the contract or instructions. Both use a
0.90 minimum, so the assessment must differ. The gate checks an exact original
caller answer, an unchanged intervening answer, three model decisions and no
ready recovery work. An explanation must use a null assessment; delegation and
give-up cannot include an assessment. A loose optional-field schema previously
allowed unsupported placeholder scores despite correct prose, so the fixture
now validates distinct decision shapes and tests intermediate outcomes too.

This is an experimental App judgment schema mapped to real Task state
operations. It is not the installed App or the full managed Task adapter. The
measurement executor is deterministic fixture code, not another model. There
are no real Conversation, Topic or Request records in this trial, and no
transport delivery or inbox cutover. Passing it proves the exercised Task
follow-through and model judgment, not the complete unified lifecycle.

The first trial required exact evidence IDs in model output. Models sometimes
returned useful citations with extra text, failing that bookkeeping rule. The
refined contract leaves evidence correlation to code and asks the model only
for its decision and explanation. Retained references identify evidence given
to the judgment; they do not assert that every fact was independently verified.

Remaining acceptance: actual Conversation -> A -> B execution and result return,
non-success dispositions, exact assignment reuse, human input during a wait,
Stop and pause, missed notifications, quiet timers, migration with one execution
owner, and a measured reduction in source paths. Compare against the current
contract on the same work before claiming simpler or more reliable operation.

## Recovery and backoff

`bun scripts/poc/controller-judgment/backoff.ts` probes whether a normal wake
can bypass the controller's retry delay. It uses the real controller and real
timers without a model or database. It exits nonzero if either the ordinary
retry or the wake-during-cooldown case runs early. The current source fails the
second case: a timer schedules a retry, but does not fence earlier queue input.
This controller-only dispatch probe still exposes that early callback. The Task
state boundary now enforces a durable retry deadline before claiming an actual
attempt, so an early callback cannot execute a cooling Task. Dispatch failures
that cannot persist Task state remain a separate retry-timer gap; this script
is retained unchanged and still exits nonzero. Do not count it as passing.

`app-task-retry.test.ts` exercises file-backed SQLite reopen and the actual due
scheduler/controller, including an early wake, no capacity held while waiting,
accepted failure followed by success on the original input, owner revision and
closure, and rollback of the failure transition. Common-lifecycle tests cover
24 failed Tasks without unblock batches and seven consecutive failures without
a failure-count stop. An overdue-deadline case in that 24-Task test exposed and
fixed the existing scheduler's deferral to its long safety scan.

The `stopped` result label remains a legacy SDK spelling in this experiment.
It now means an accepted unsuccessful attempt report; it does not answer the
original ask or withdraw the assignment. Recovery keeps the input and earlier
waits, records its next eligible time and notifies the parent. Domain judgment
remains with App instructions; owner closure is separate.

For a real-model continuation trial:

```sh
bun scripts/poc/controller-judgment/continuing-failure.ts --live --model MODEL --out /tmp/may-continuing-failure
```

This requires model credentials and spends tokens. The worker uses the actual
Task protocol/schema and a read-only tool to inspect a synthetic observation.
It first reports an unavailable source. The fixture repairs the source and
reopens SQLite; the ordinary recovery scheduler invokes a fresh model attempt
without a new ask or unblock. The second attempt must read the current file
and answer the original question. `--value 0.78` varies the outcome against the
same 0.90 minimum. Reports include source revision/dirty state, attempted tools,
provider usage and correlation checks. This is direct-agent execution under
the controller, not the full installed managed Conversation runtime. Model
compliance must be measured separately from deterministic storage tests.
