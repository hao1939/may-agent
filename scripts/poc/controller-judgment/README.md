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
does not score source settlement for its judgment-only delegate/ask/wait cases.

Run development before the held-back transfer set; do not tune the contract to
transfer answers. Each case starts a fresh agent with ordinary work and fixture
evidence, using the real direct-agent executor. It has no coding, task-control,
subscription or delegation tool. The agent returns a judgment; code supplies
identities, persists accepted answers and failure reports through production Task
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

`delegate`, `ask` and `wait` are judgment-only cases in this harness; their
admission, interface and wait transitions are not exercised. `give-up` records an accepted non-success
outcome without closing the Task. Its unfinished input now retains a retry deadline; this one-decision harness does not run that retry. Delegation execution and return are exercised by the shared-loop harness below. Likewise,
discussion cases test the agent's choice, not concurrent inbox availability.
Each `run.ts` case stops after one decision. The fixture closes its controller on
a dispatch error, so invalid output is visible. The underlying agent executor retains
its normal bounded finish/provider handling; inspect all calls in the transcript.
Private artifacts and temporary SQLite remain outside the checkout for review;
do not publish raw transcripts or endpoint errors.

## Common Task loop through live workers

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

Add `--nested` to request a reviewer who obtains an independent measurement
from another worker before assessing it. This exercises A → B → C → B → A,
using the same May App mapping and Task controller at each step. No extra App
is installed for the test. The human specifies the need for independent
measurement; the models choose the typed admissions, acceptance criteria and
judgments. This does not test whether a model would choose that decomposition
without being asked.

```sh
bun scripts/poc/controller-judgment/shared-loop.ts --live --nested --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/nested-loop-development
bun scripts/poc/controller-judgment/shared-loop.ts --live --nested --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/nested-loop-transfer --value 0.78
```

The nested trial checks the exact C admission/result as well as B's return to
A. It allows ten dispatches within the same six-minute experiment limit.
Recorded waits remain readable but do not trigger a caller attempt. An exact
answer or owner closure returns to a typed caller. The first accepted failure
also returns through the saved input link, leaving that input unfinished and
its caller's wait unsatisfied while the worker retries. Input-backed Topic
follow-up selects the same first report; repeated failures do not add caller
input. The owner-repair probes below exercise this feedback and its limits.
A pending wait is preserved once its typed
input is durably published; the worker need not obtain a synchronous receipt
from the parent process. Publication does not claim that execution succeeded.

For adoption and owner decisions, use `--natural` without `--nested`. Its human
ask mentions a slow source and further questions, but gives no instruction to
delegate or create background work. The same critical-path gates apply. A direct
blocking source read fails the responsive-delegation gate; inspect that failure
as an App judgment result rather than a broken Task claim.

Add `--withdraw` to ask the human-facing Task to cancel the linked measurement
while its worker is executing. The fixture releases source output after owner
closure and reopens SQLite. It checks withdrawal rather than fulfillment, exact
Task closure, no accepted late result, no new child attempt after reopen, and
continued human interaction. It does not test recursive child cancellation or
withdrawal after multiple paid failures.

Alternatively add `--correction` to change the decision threshold from 0.90 to
0.95 while the sample is being collected. The same Request must retain its new
scope, with no replacement Task or second source read. The reply must name the
new threshold; review its comparison and explanation in the retained report.
The model's existing App instructions and tool catalog remain unchanged.

```sh
bun scripts/poc/controller-judgment/shared-loop.ts --live --natural --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/natural-loop
bun scripts/poc/controller-judgment/shared-loop.ts --live --natural --withdraw --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/owner-withdrawal
bun scripts/poc/controller-judgment/shared-loop.ts --live --natural --correction --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/owner-correction
```

## Capability and owner-help probes

The same shared-loop harness can use an unfamiliar release manifest without
changing May's App input mapping or role instructions:

```sh
bun scripts/poc/controller-judgment/shared-loop.ts --live --scenario manifest --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/manifest-loop
bun scripts/poc/controller-judgment/shared-loop.ts --live --scenario owner-repair --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/owner-repair-loop
bun scripts/poc/controller-judgment/shared-loop.ts --live --nested --scenario owner-repair --app-root /path/to/paired-app-checkout --model MODEL --out /tmp/nested-repair-loop --value 0.78
```

The manifest case checks a total of 3200 compressed bytes and the component
missing a license, discussion while source work is pending, and recall after
reopen. This tests use of the general `goal` input for unfamiliar work; it does
not certify every App mapping or automatic executor selection.

The owner-repair case holds the source until the human's discussion is answered,
then returns HTTP 503 until the human-facing Task has handled the worker's
accepted failure report. Only then does the fixture restore the source and send
ordinary human input asking to continue the same assignment. The gate requires
the original Request and worker to stay open, a useful problem report, the exact
answer, unchanged Task identities and recall after reopen. It allows twelve
dispatches within six minutes and records failed reads and time to owner feedback.
Add `--nested` to owner repair to exercise collector → reviewer → human feedback
with an eighteen-dispatch experiment allowance. An unfinished acquisition must
return its first blocker and later answer through the original input. If the
reviewer explicitly requested a one-shot diagnostic, that answer remains intact:
repair must lead to fresh input on the same collector and an exact later answer.
The report records which path actually ran; passing one does not prove the other.
These are experiment bounds, not product retry limits. Manifest still uses one
worker; neither scenario combines with withdrawal or correction. Reports include
failure evidence; a failed trial remains a finding to investigate.

## Managed recovery with human input

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

## Earlier follow-through trial

The early `follow-through.ts` harness (available at Host revision `9d34e90b`)
tested three fresh judgments: delegate measurement, answer an intervening
question, then assess the returned value across SQLite reopen. It used raw
worker child creation and an experimental judgment schema. That contract and
harness are retired; the shared-loop trials above now exercise typed App input,
A → B → C → B → A, and human discussion through production admission.

The early results remain historical evidence, not validation of the current
protocol. `run.ts` still records delegate/ask/wait judgments for inspection;
only answer and failure judgments settle actual Task state there. Use the
shared-loop harness for execution and return behavior. Coverage boundaries
are listed in [test coverage ownership](../../../test/README.md).

## Recovery and backoff

`bun scripts/poc/controller-judgment/backoff.ts` probes whether a normal wake
can bypass the controller's retry delay. It uses the real controller and real
timers without a model or database. It exits nonzero if either the ordinary
retry or the wake-during-cooldown case runs early. The initial source failed the
second case before dispatch timers were enforced. Both cases now pass: ordinary
wakes respect the controller's existing retry deadline. Task state separately
enforces its durable deadline before claiming an actual attempt. This small
dispatch probe adds no evidence about model judgment or cross-process recovery.

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

### Explicit coordination follow-up

The structural-wait retirement candidate repeats the live nested `owner-repair`
scenario with `gpt-5.6-sol` and a 0.78 measurement. It passed in 128.7 seconds
with 13 Task dispatches and one failed source read. First-blocker feedback
reached the human in 40.2 seconds; owner repair, the same three Tasks, exact
answer, Request closure and recall after reopen passed. This is one isolated
trial, not a latency or reliability guarantee.

The portable runtime matrix also covers live delivery, a lost notification,
restart and owner cancellation for A → B → C → B → A with intervening discussion.
The old-source `task-state-cutover.ts` trial now retires an actual implicit child
wait written by the old Host, restoring its original ask without inventing a
child answer. Installation adoption remains a separate operational step.
