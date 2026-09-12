# Return problems to the caller

**Status:** Proposal refined through three isolated mechanics trials; not a deployed contract.
**Baseline:** Host `8026aff97585edd7f728fa4ce360fdde71bc740a` (PR #164).

## The idea

Do what you safely can. Return the relevant facts and any needed decision to
your caller. Keep the responsibility open until its owner closes it.

The caller owns the requested outcome; the worker remains responsible for its
assignment. Reporting a problem does not transfer that responsibility, fulfill
the request, cancel the Task, or grant permission to change another Task.
The caller can itself return a problem if the needed decision exceeds its authority.

```text
caller asks worker
  -> worker does bounded work
  -> worker returns a useful answer, or reports a problem
  -> caller judges the effect on its own assignment
  -> existing work continues, waits, or is revised/closed by its owner
```

This is normal input and feedback, not an escalation subsystem. Reserve
"escalation" for the owner's decision to ask someone with different authority
to decide or act. That boundary may exist within one App. An ordinary dependency
on another App is not automatically an escalation.

## What we keep

- Local, bounded repair when authorized, safe and worthwhile.
- Exact admitted input and caller correlation, independent of structural parents.
- Task-owned responsibility; workflow/attempt-owned output, errors and debug evidence.
- Accepted answers separate from unsuccessful attempts and owner closure.
- Exact Conditions, durable feedback and recovery through the existing return path.
- Code for facts, persistence, fencing and delivery; agents for diagnosis and choices.
- Compact outward explanations and evidence references, not duplicated transcripts.

No new queue, escalation record, recovery supervisor, session-resume authority,
semantic error classifier or mandatory human approval step is proposed.
Metrics observe retained executions; they do not decide what to retry or close.

## The concrete gaps

At the baseline, an accepted `stopped` result records the input's first report
and schedules the same Task after backoff. A `waiting` result cannot report to
its caller through that path. Conversely, `stopped` cannot declare Conditions.
An agent cannot directly express "please arrange access; I will wait for the
access event" as one accepted result that both reports and waits.

Thrown execution failures and rejected results preserve attempt evidence and
retry, but do not bind that evidence to the exact input's caller-report pointer.
The caller can receive no report even though execution repeatedly fails before
an agent produces a valid result.

Only the first accepted blocker per input is returned. That suppresses repeated
notifications but can hide a later different need. This is an explicit limitation,
not proof of complete progress reporting.

The current [Task design](../2a-design/task-resource-engine.md#result-contract)
still describes `stopped` as cancellation and implicit parent notification.
That predates #158/#164. Current source retains the assignment and retries;
structural parents do not imply a return route. These sections must be aligned
before promotion; this proposal does not silently adopt their obsolete behavior.

## Small candidate contract

Separate two questions, without adding Task phases:

1. **What should the caller know?** A selected report from this attempt.
2. **When can this work continue?** The existing wait, retry or answer disposition.

In the refined experiment, a waiting result may set `report: true`. Its existing
summary, result and evidence form the report; there is no second message payload.
Omission means an ordinary quiet wait. An explicit report requires evidence and
means "return this new decision-relevant update", including after an earlier
failure. Do not repeat the flag just to acknowledge an unchanged checkpoint.

Illustrative candidate, not a currently released SDK example:

```ts
return {
  state: "waiting",
  report: true,
  summary: "Access is missing. Please arrange access; I will retry after confirmation.",
  evidence: ["workflow-run:sample-run"],
  conditions: [{
    id: "access-restored",
    type: "sample.access.changed",
    subject: "resource:sample",
    expected: { field: "available", equals: true },
    owner: "app:sample",
    reviewAfterMs: 300_000,
  }],
};
```

The worker owns its Condition. Its caller receives the report and retains its
own wait for the requested answer; it does not copy the worker's Conditions.
A Condition observes a fact, not whether a message was delivered. An adapter,
observer or authorized action must actually produce the awaited fact.

At a failed execution boundary, save the failure's attempt reference against
the exact input and expose a factual report through the same caller route.
Do not fabricate an accepted agent result, trust invalid proposed actions, or
declare the task impossible. Keep failure details on the attempt/workflow.
The existing retry policy remains; the prototype does not change its timing.
An internal tool error repaired inside the same bounded execution need not
become another caller wake.

An answer still refers to its exact accepted attempt. Reading later Task state
must never substitute another input's result. A report keeps the input open;
owner closure remains distinct from success.

## Noise, ownership and cost

The first trial retained the existing first-report-per-input rule. It hid an
actionable access request after an earlier execution failure. The refined rule is:

- Automatically return the first failed attempt; automatic retries remain quiet.
- A waiting result with `report: true` deliberately selects a new report.
- Keep the selected attempt reference on the existing input admission, separate
  from its answer reference. Preserve all earlier attempt evidence.
- Increment a small report revision there, in the same state transaction.
  The caller's existing Condition remembers the observed revision. Duplicate or
  older deliveries cannot replace a newer report or wake it again.

An attempt ID alone failed the delayed-notification test: it distinguishes
reports but cannot order them. One monotonic number on the existing input is
sufficient; there is no report queue, acknowledgment lifecycle or retained ID set.
Agents do not manage these revisions or infer them from timestamps.

This is a latest-selected-report contract, not delivery of every past update.
A new selected report may supersede an undelivered older one; history retains
both. A final answer or owner closure takes precedence over pending reports.
An explicit repeated report can still wake the caller: deciding whether it is
useful belongs to the agent, not a Host prose-comparison engine.

Waiting releases execution capacity and prevents retry attempts until a
matching fact, new relevant input or existing review checkpoint. It does not
promise zero work forever: checkpoint reviews still cost something. An open
commitment is not permission to blindly repeat side effects. Read the provider's
operation state or use its idempotency contract before repeating ambiguous work.

Missing caller information is not authority to choose a global supervisor or
May. Retain visible evidence for the owning App's existing review path. A caller
report is also not evidence that a human saw it; human presentation belongs to
the conversation/interface capability.

## What previous experiments taught us

The [nested caller-feedback PoC](controller-poc-deeper-review.md#nested-caller-feedback-poc)
initially failed because a diagnostic answer was treated as enough for a wider
assignment, and a passive human Condition never communicated the need for help.
Improved App guidance made blocker, human repair and same-worker answer succeed.
The successful trial took 13 dispatches: capability, not low outage cost, was proved.

An [older recovery review](../archive/implementation/2026-05-20-legacy-cleanup-resume-path.md#why-tests-didnt-catch-the-no-op-resume)
found tests that asserted escalation creation while the actual resume operation
was a no-op. Our experiment must prove the original requested outcome, not just
that an event was emitted.

## Focused PoC

Use an isolated checkout, synthetic App, scripted executors and temporary
file-backed SQLite. Exercise actual result admission, execution, caller feedback,
Condition routing and runtime/database reopen. No installed App, provider account,
human transport, model call or deployment is part of this first experiment.

1. Record baseline failures for report-plus-wait and runtime-failure feedback.
2. Add only the candidate SDK/result and saved-report changes needed for those cases.
3. Verify ordinary waits remain quiet; report-plus-wait returns useful facts without
   answering the input, closing the Task or rerunning work before its checkpoint.
4. Lose notification and reopen runtime/storage; recover the same report once.
5. Supply the exact awaited fact; complete the original work and return its exact
   answer through the same request. Unrelated Tasks and inputs stay untouched.
6. Exercise thrown failure and rejected output. Neither may create accepted
   success or apply proposed effects; both should expose factual failure evidence.
7. Probe first-report suppression, then delayed old notifications after a new report.

Measure executed worker/caller attempts and duplicate wakes, not a presumed
token saving. Scripted decisions establish mechanics only. A later model-backed
trial must independently show that agents choose this contract naturally and
that the caller acts usefully without extra manual bookkeeping.

## Review and promotion gates

Prefer the existing path plus better guidance if the experiment shows it is sufficient.
Otherwise promote only the demonstrated missing primitive. Before a production PR:
resolve first-report semantics, trace all affected human/Task consumers, verify
stale/closure/transaction races, align canonical docs and agent protocol, and run
the complete Host gate. Model-backed adoption and deployment remain separate.

## Experiment record

Local branch: `poc/caller-feedback-wait-20260912`, based on the revision above.
Candidate commit: `0882cad717b3e2ff162a0133e9ea8bba7f53e606` (local, not pushed).
The portable experiment extends `src/app/core/tasks/app-task-runtime.test.ts`
under `caller feedback PoC`, reusing its real runtime/SQLite fixtures. Run it in
that checkout with:

```sh
bun install --frozen-lockfile
bun test src/app/core/tasks/app-task-runtime.test.ts --test-name-pattern 'caller feedback PoC'
```

The same experiment was also applied to a separate checkout of unchanged
baseline production code. It passed the quiet-wait and existing stopped-then-wait
controls, and failed all four candidate scenarios because no report was available.
An initial fixture mistake called live routing with controllers disabled; using
the production Condition tracker directly fixed the control. That fixture failure
is not counted as a product defect.

| Scenario | Baseline | Refined candidate | Worker / caller attempts in candidate |
| --- | --- | --- | --- |
| Ordinary quiet wait, then answer | Pass | Pass | 2 / 2 |
| Existing stop report, next attempt waits, then answer | Pass | Pass | 3 / 3 |
| Report and wait together, then answer | No report | Pass | 2 / 3 |
| Thrown execution failure, then retry answers | No report | Pass | 2 / 3 |
| Rejected output proposing a Task action, then valid answer | No report | Pass; proposed action not applied | 2 / 3 |
| Failure, then new actionable wait report, then answer | No initial report | Pass; both reports reach caller | 3 / 4 |

All scenarios deliberately lose live report/answer notifications before
publication and use saved-state recovery. Runtime and file-backed SQLite reopen
before feedback recovery and after the final answer. The changed-report scenario
also reopens after selecting the second report. Duplicate recovery does not add
caller attempts. A delayed first report cannot replace the second observation.
The exact requested score, `0.92`, returns to the original input. Neither Task
is cancelled or replaced, and a mismatched access event cannot resume the worker.

During each wait, ten explicit recovery/dispatch probes over 100 seconds of
controlled time execute zero further worker attempts. This is before the
five-minute review checkpoint. It is not a wall-clock soak or proof of zero
checkpoint cost. Compared with the existing stop-then-wait approach, reporting
and waiting together saves **one worker attempt** in this fixture, not a measured
percentage of provider cost or system-wide latency.

Trial history matters:

1. First-report-only candidate: six checks passed, but one was a characterization
   proving the later actionable report stayed hidden. That is a design limitation,
   not successful delivery of the second report.
2. Explicit report plus attempt-ID deduplication: passed the sequential checks;
   adding delayed old delivery exposed an extra caller wake (five pass, one fail).
3. Explicit report plus stored revision: all six checks pass, including the
   second report and rejection of delayed older feedback.

The first candidate's focused regression run passed 365 checks across SDK,
reconciliation, runtime, retry, inbox and Conversation state. Final candidate
`bun run ci` passed **2,873 tests**, with **three installation-only skips and
zero failures**, across 291 files (139.38 seconds for tests). Host/SDK type checks,
App-boundary validation and ESLint passed. Canonical `bun run check:may-design`
passed with zero errors/warnings; that check validates existing examples, not
complete alignment of the candidate's behavior with all documentation.
The [portable evidence summary](evidence/caller-feedback-poc-20260912.json)
retains revisions, scenarios, failed trial findings, counts and limitations.

### What is not proved or implemented

- Scripted executors make all judgments. No live model, actual provider failure,
  process-kill recovery, installed App, console or Telegram was exercised.
- Automatic controllers are disabled for deterministic dispatch. Tests invoke the
  actual runtime, recovery and Condition tracker; they do not prove timer latency,
  worker-process transport or scheduling fairness under load.
- Typed caller feedback is the tested return path. Topic-linked Conversation
  discovery still selects accepted `converged`/`stopped` results and has **not**
  been extended for waiting reports or runtime-error reports. This is a concrete
  integration gap, not just an unrun UI test.
- The prototype allows explicit new reports on `waiting`, not on later `stopped`
  outcomes. It is not a general-purpose progress/reporting API.
- Reporting a thrown exception is proved; arbitrary process death, admission
  failure, verification rejection and unavailable workflow paths need their own
  contract checks before claiming all failure boundaries.
- Managed-agent protocol text and canonical Task docs are not yet aligned with
  the candidate. Schema availability alone does not prove natural agent adoption.
- A report points to full attempt/workflow evidence; the runtime-failure summary
  is truncated to 1,024 characters. Safe presentation and evidence access still
  need review across the actual caller and human boundaries.
- No production upgrade, compatibility cutover or PR publication occurred.

### Recommendation after the PoC

The mechanism is useful and can reuse existing work state. Keep the report/wait
separation and explicit agent choice. The first-only rule is too restrictive for
the demonstrated failure-to-actionable-wait sequence; revision-based delivery
is a small justified addition, not an escalation framework.

Next align the Conversation consumer and compact agent guidance, then run one
bounded model-backed trial where the agent discovers a prerequisite problem,
reports it, waits, and uses ordinary caller feedback to finish the same assignment.
Keep the mechanics checks; do not claim that a scripted successful answer proves
the agent understood the user's goal. Promotion is a separate reviewed change.
