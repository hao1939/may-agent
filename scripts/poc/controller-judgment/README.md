# Controller judgment experiment

This is an opt-in model experiment, outside CI. It asks whether a small App
judgment contract is usable with process handled by code. It does **not**
implement or prove the proposed common Task lifecycle.

Run from the Host checkout with an authorized, configured model endpoint:

```sh
bun scripts/poc/controller-judgment/run.ts --live --model MODEL --out /tmp/controller-development --scenarios scripts/poc/controller-judgment/development.json
bun scripts/poc/controller-judgment/run.ts --live --model MODEL --out /tmp/controller-transfer --scenarios scripts/poc/controller-judgment/transfer.json
```

Run development before the held-back transfer set; do not tune the contract to
transfer answers. Each case starts a fresh agent with ordinary work and fixture
evidence, using the real direct-agent executor. It has no coding, task-control,
subscription or delegation tool. The agent returns a judgment; code supplies
identities, persists accepted results or admits a child through production Task
functions, and releases the production controller slot. There are no workers
delegated to perform this development task and no live App/production changes.

For a returned-result case, code settles a synthetic measurement through the
real reconciler, closes/reopens SQLite, reads the exact accepted attempt and
supplies its evidence to the model. The child stays open. The result checks a
real source boundary: current maintained parents are still forced to wait while
any child is live. A good answer with `acceptedState: waiting` is a lifecycle
gap, not a passed end-to-end result-return test.

Read `report.json` and the local transcripts. `decisionPass` scores only the
choice of action; inspect response accuracy and usefulness separately. Reports
include duration, attempted tools, provider usage, source settlement and SQLite
paths. Provider cost metadata is not a verified bill. A nonzero exit indicates
a bad/invalid action choice or experiment failure. A zero exit does not certify
all lifecycle gates. No response-to-user delivery or deployed May agent is used.

`ask`, `wait` and `give-up` are judgment-only cases in this first slice; their
production state transitions are not exercised. Delegation admits a real child
but does not run that child or route its result in this harness. Likewise,
discussion cases test the agent's choice, not concurrent inbox availability.
Every case stops after one decision. Controller callbacks have no automatic
retry here, so invalid output is visible. The underlying agent executor retains
its normal bounded finish/provider handling; inspect all calls in the transcript.
Private artifacts and temporary SQLite remain outside the checkout for review;
do not publish raw transcripts or endpoint errors.

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
