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
be accepted without automatic retry. Check `settlementPass` as well as
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
outcome without closing the Task or retrying it automatically. Delegation admits a real child
but does not run that child or route its result in this harness. Likewise,
discussion cases test the agent's choice, not concurrent inbox availability.
Each `run.ts` case stops after one decision. Controller callbacks have no automatic
retry here, so invalid output is visible. The underlying agent executor retains
its normal bounded finish/provider handling; inspect all calls in the transcript.
Private artifacts and temporary SQLite remain outside the checkout for review;
do not publish raw transcripts or endpoint errors.

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
