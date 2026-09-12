# Return problems to the caller

**Status:** Isolated mechanics and bounded live-agent adoption tested; not a deployed contract.
**Review:** [Host PR #169](https://github.com/hao1939/may-agent/pull/169).
**Baseline:** Host `8026aff97585edd7f728fa4ce360fdde71bc740a` (PR #164).
**Current integration base:** Host `f6a11d1c` (PR #172); the original published candidate used #167.

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

The [Task design](../2a-design/task-resource-engine.md#result-contract) previously
described `stopped` as cancellation and implicit parent notification. The
follow-up below corrects those pre-#158/#164 sections: source retains the
assignment and retries; structural parents do not imply a return route.
The canonical page distinguishes that merged baseline from this unmerged candidate.

## Small candidate contract

Separate two questions, without adding Task phases:

1. **What should the caller know?** A selected report from this attempt.
2. **When can this work continue?** The existing wait, retry or answer disposition.

In the reviewed candidate, a `waiting` or unsuccessful retrying result (`stopped`
on #169, renamed `incomplete` by #168) may set `report: true`. Its existing
summary, result and evidence form the report; there is no second message payload.
Omission means an ordinary quiet wait, or retention of the first failure report
while retrying. An explicit report requires non-empty evidence and
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
- A waiting or unsuccessful retrying result with `report: true` deliberately
  selects a new report. Reporting does not determine wait versus retry timing.
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

Local branch: `poc/caller-feedback-wait-20260912`. The original trials used the
baseline above; the main integration below records the current rebased revision.
Initial Task-to-Task candidate: `0882cad717b3e2ff162a0133e9ea8bba7f53e606`.
Conversation/live-trial extension: `9584ea5965c992c53e6ef6987467f28d267a0657`.
Owner-schema follow-up: `590b02444b11e393a0657b0459461139de91a85b`.
These were local-only revisions at that stage; publication of the rebased
candidate is recorded below.
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

- The six original Task-to-Task scenarios use scripted judgments. Their automatic
  controllers are disabled for deterministic dispatch. Tests invoke the
  actual runtime, recovery and Condition tracker; they do not prove timer latency,
  worker-process transport or scheduling fairness under load.
- The follow-through trial below exercises managed models and Conversation reply
  storage, not an installed May App, console/Telegram delivery, actual provider
  outage or process-kill recovery. Its source and repair event are synthetic.
- The original prototype allowed explicit updates only on `waiting`. The review
  refinement below extends that flag to unsuccessful retrying results; it is
  still not a general-purpose progress/reporting API.
- Reporting a thrown exception is proved; arbitrary process death, admission
  failure, verification rejection and unavailable workflow paths need their own
  contract checks before claiming all failure boundaries.
- Compact managed-agent guidance describes the candidate, and canonical Task docs
  describe the merged baseline separately. The main integration below verifies
  shared failure handling; broader failure-boundary checks remain separate.
- A report points to full attempt/workflow evidence; the runtime-failure summary
  is truncated to 1,024 characters. Safe presentation and evidence access still
  need review across the actual caller and human boundaries.
- No production upgrade or compatibility cutover occurred. The later PR
  publication does not promote this candidate to deployed behavior.

### Recommendation after the PoC

The mechanism is useful and can reuse existing work state. Keep the report/wait
separation and explicit agent choice. The first-only rule is too restrictive for
the demonstrated failure-to-actionable-wait sequence; revision-based delivery
is a small justified addition, not an escalation framework.

The Conversation return path and compact agent guidance are now included in the
isolated candidate. Keep these small additions and the focused contract checks;
do not introduce a separate escalation service. Promotion remains a reviewed
change, including canonical design alignment and remaining boundary checks.

### Conversation follow-through

The first extension found two outdated filters: Conversation discovery selected
only converged/stopped results, and the runtime adapter rejected waiting and
execution-error reports before admission. Both now use saved report selection.
Task callers and Conversation reuse one factual-failure projection; an error
never becomes an accepted agent result merely to make delivery work.

Recovery selects the latest report still relevant to an unanswered, open input.
An answer or owner closure prevents newly admitting an obsolete report. Existing
Conversation inputs remain history, including a report already admitted before
an answer; no extra queue or delivery lifecycle is introduced.

Seventy focused checks pass across Conversation state/runtime and agent protocol.
They include report/wait → reply asking for help → runtime/storage reopen → exact
repair fact → answer from the same Task → explicit fulfillment of the original
Request. Repeated execution failures produce one report, not a new answer or
repeated human-facing work. A state test also loses intermediate reports and
rejects older notifications after a newer selection, answer or closure.

The first full regression run exposed an old expectation that six failed
executions must remain invisible to Conversation. That test now checks one
factual report from the first failure, no accepted answer, unchanged Request
ownership, and the existing atomic reply/Request-closure behavior. This is an
intentional contract update, not an unrelated flaky-test workaround.

### Bounded live adoption

The existing managed-Conversation harness now has a `caller-feedback` mode.
It uses the normal controller, managed worker, finish schema, durable input,
Conversation result storage and temporary file-backed SQLite. The human asks
for the measurement App; models choose the handoff details, waiting report,
explanation, continuation and Request fulfillment. No fixture supplies the
agent's `report: true` result or final answer.

The first live trial passed but exposed an unnecessary fixture capability:
the older recovery harness offered a value-recording tool, which the worker
used although this assignment only needed a read. The refined trial removes
that tool and unrelated recording guidance. Keep the fixture as narrow as the
question; do not add a Host-wide tool restriction from this observation.

The read-only development trial returned a denied-access report, asked the human
for help, retained the original Request and worker through reopen, then returned
the measured `0.92` against minimum `0.90` after repair. It made one denied read
and one successful read, with no writes. The model correctly explained the
`0.02` passing margin. Four Conversation attempts and two worker attempts used
eight model-stream starts and about 50.3 seconds. This demonstrates adoption in
this fixture, not a general cost or reliability estimate.

The first lower-value transfer trial correctly returned `0.78`, below the
`0.90` minimum by `0.12`, and preserved the original work. Its automated gate
passed, but manual review found an incorrect help judgment: May said the human
need not act and sent the worker to repair access. The fixture had called the
measurement App the source owner without distinguishing who could change
permissions. It took three worker attempts and two denied reads. Do not count
that run as successful human-help behavior.

The revised source observation states the missing domain fact explicitly:
only the human requester can restore permissions; the App only reads. This is
fixture/domain knowledge, not a new Host classifier or mandatory human routing.
The next trial exposed an invalid agent-authored Condition owner. The actual
error report reached May, which asked the same worker to correct it; the worker
then reported the human permission blocker. The harness incorrectly inspected
the earlier error reply before the matching waiting report had settled and
exited nonzero. It now waits for that exact attempt's Conversation input. Keep
both the invalid result and failed trial in the evidence, not just the retry.

This reveals a small existing usability gap: the finish schema describes
Condition `owner` as a nonempty string, while result normalization requires
`human` or `kind:identity`. The follow-up below aligns the field's schema and
guidance without another escalation lifecycle. The earlier trials intentionally
retain their validation failures and error feedback in the evidence.

With the exact-report gate and clarified source facts, both final trials passed
using unchanged prompts/code; only the measured value changed:

| Trial | Human help and final answer, manually reviewed | Worker / Conversation attempts | Model-stream starts | Time |
| --- | --- | --- | --- | --- |
| Development, `0.92` | Correctly asks requester to restore access; reports `0.02` above `0.90` | 3 / 5 | 11 | 63.5 s |
| Transfer, `0.78` | Correctly asks requester to restore access; reports `0.12` below `0.90` | 3 / 5 | 11 | 64.7 s |

Both naturally encountered the invalid Condition owner, recovered through factual
feedback, then returned a newer actionable waiting report and the original
answer. Each made two denied reads and one successful read, with no writes.
The comparison Request was fulfilled in both: a below-minimum sample is an
unfavorable measurement, not failure to perform the requested comparison.
The complete portable suite passed **2,877 tests**, with **three installation-only
skips and zero failures** (143.22 seconds). Final type, boundary and lint checks,
the live harness's standalone type check, and canonical design checks passed.
The last harness-only refinements were verified by the two live trials; they
did not change the product code exercised by the full suite.

Repair supplies both ordinary human input and the source's exact access-restored
fact. The human message alone is not claimed to satisfy a Condition. Successful
measurement fulfills the human Request; the worker Task stays open and its exact
accepted answer survives another runtime/database reopen. No cancellation is
used to fake successful completion.

Run at the retained experiment checkpoint `2433b88c` on
`poc/caller-feedback-wait-20260912`, with explicit model authority and configured
endpoint. These are experiment-branch commands, not a supported main surface
after [PoC retirement](poc-retirement-and-knowledge-20260912.md). Keep this source
for audit; a later production rebase must not restore `scripts/poc/` on main:

```sh
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/caller-feedback-development --fault caller-feedback
bun scripts/poc/controller-judgment/managed-conversation.ts --live --model MODEL --out /tmp/caller-feedback-transfer --fault caller-feedback --value 0.78
```

The limits are 180 seconds, eight Conversation calls and 24 model-stream starts.
They bound this experiment, not Task lifetime. Conversation calls exclude worker
attempts; dispatch profiles can also include no-op checks and must not be counted
as attempts. Raw transcripts, configuration and temporary state remain private;
the evidence summary keeps only portable findings and counts.

### Owner-schema and design follow-up

The smallest source correction is a shared owner-format pattern in the SDK's
schema and normalizer, plus a field description. Existing `human` shorthand,
canonical `kind:identity` values and surrounding-whitespace trimming remain
supported. No owner lookup, identity system, repair authority or new routing is
added. The runtime's existing defensive check remains unchanged.

A regression first failed because the tool schema admitted invalid owner text.
It now compares schema/admission across 13 valid and invalid values. An actual
prepared finish-tool check rejects a prose owner before executing finish, then
accepts its correction in the same execution. This establishes a bounded place
to correct the format; it does not promise every model will choose correctly.

One further local-model trial passed both the mechanical gate and manual review:
May asked the human requester to restore access, waited, and reported `0.92`
against `0.90` after repair, correctly fulfilling the original Request. It used
two worker attempts, four Conversation attempts, eight model-stream starts,
one denied read and one successful read, with no writes. Unlike the previous
final pair, it needed no extra failed Task attempt for owner correction. The
same input's accepted answer survived reopen; the worker stayed open.

The trial took 85.4 seconds while the full suite was also running. Fewer attempts
in this one sample are not proof of lower latency, cost or a general reliability
rate. Earlier unsuccessful trials remain in the evidence.

At this exact follow-up, `bun run ci` passed **2,879 tests**, with **three
installation-only skips and zero failures**, across 291 files (151.23 seconds
for tests). Type, boundary and lint checks passed. The focused SDK/finish/protocol
run passed 38 tests. The live trial's saved source patch exactly matches the
committed follow-up diff. Canonical design checks passed after their first run
caught a 901-line contract; removing duplicated history brought it below the
existing 900-line limit without weakening that check.

Canonical Task documentation now reflects open Tasks after acceptance, paced
unfinished failures rather than finite stop, explicit input-return links instead
of parent subscriptions, and the possible executor cost of Condition checkpoints.
It does not promote `waiting.report` or execution-error caller returns to released
behavior.

At the end of the owner-schema follow-up, main contained #163 and #167 after
this PoC's base. #167 consolidated the failure transition this candidate extends.
The integration below addresses that overlap; no push or deployment has occurred.

### Integration with current main

Rebased the three local PoC commits onto fetched main `38a048da` (#167).
Integrated tip, including the added boundary checks: `2433b88c92547025459b50f82bd00f1278bddf50`.
The previous tip `590b0244` remains on `audit/caller-feedback-pre-main-20260912`
for audit, so the earlier live-trial revisions remain inspectable.

The conflict was in the expected failure transition. Keep main's shared
`failAppTaskAttempt()` and its thin diagnostic wrapper. Save the exact input's
report pointer inside that same fenced transaction, except for an internal
workflow-to-agent handoff. Do not restore the duplicate failure implementation.
Retry deadlines, preserved/replaced diagnostic evidence and handoff semantics
remain main's behavior. The other two commits replayed unchanged.

The rebased candidate passed 242 focused checks covering Task/Conversation
feedback, result admission and retry. The expanded retry file then passed 18
checks, including the new handoff boundary. Those checks establish that:

- an internal handoff selects no caller report; a subsequent agent failure does;
- input arriving during execution is not attributed to that attempt's failure;
- a later failure reports newly considered input but does not replace an older
  input's first report;
- report selection rolls back with failed attempt/retry-state persistence; and
- a late failure after owner closure cannot change the saved admission.

One bounded live trial on the integrated runtime used the lower value `0.78`.
Manual review confirmed the human-help request and final comparison: `0.78`
is `0.12` below `0.90`. May fulfilled the measurement Request, not the minimum
requirement, and did not cancel the worker. The exact original answer survived
runtime/storage reopen. Counts were two worker and four Conversation attempts,
eight model-stream starts, one denied read and one successful read, with no
writes, in 54.4 seconds. This is a synthetic mechanism/adoption check, not an
installed-service or reliability-rate claim.

The live runtime and harness were unchanged from rebased `887513d6`; uncommitted
changes were documentation and retry tests only. Later edits strengthened the
rollback/closure assertions, so the final diff differs from the live trial's
recorded patch hash. Full-suite evidence is recorded separately. Source
publication, hosted image checks and deployment still require their normal
review and authority.

Final `bun run ci` on this integration passed **2,905 tests**, with **three
installation-only skips and zero failures**, across 292 files (213.22 seconds
for tests). Type, App-boundary and lint checks passed. The opt-in live harness's
standalone type check and canonical design checks also passed. No failing gate
was bypassed or retried to conceal a failure. The added tests and documentation
are committed locally; the Host branch is clean and includes the fetched main.

### PR publication and integration order

Published the clean integrated Host revision `2433b88c` as draft
[PR #169](https://github.com/hao1939/may-agent/pull/169). Copilot review was
requested and recorded by GitHub; its review is pending. Hosted Quality and
Container checks passed in
[CI run 34697270384](https://github.com/hao1939/may-agent/actions/runs/34697270384):
Quality in 2m54s and Container in 2m7s. Container built and smoke-tested the
actual image; it was not skipped or published.
Publication is not merge or deployment approval. The source, synthetic fixtures
and guide are published; local runtime state, raw transcripts and configuration
are not.

Draft [PR #168](https://github.com/hao1939/may-agent/pull/168) independently
removes Task modes and renames `stopped` to `incomplete`. It overlaps this
candidate's schema, report selection and fixtures, but does not replace the
report/wait behavior. Keep each PR scoped. Whichever lands second must rebase,
preserve saved-report compatibility and rerun the contract and full CI checks;
do not merge both without that integration review. No change was made to #168.

Existing quiet waits need no executable App change. Land the reviewed Host/SDK
contract before enabling `report: true` in Apps. Existing saved report pointers
without a revision read as revision 1. No migration was run, and older Host
code is not claimed to understand the candidate's waiting/error report pointers;
an installation rollback therefore needs its own state/consumer review. The
remaining promotion limits above still apply.

### Review refinement: one report choice for waits and retries

The #169 review confirmed two defects: an empty explicit report passed the
finish schema but failed later admission, and recovery treated an already
observed legacy report as new. Fix those at their existing boundaries: separate
quiet/reported waits in the schema and SDK type, require non-empty evidence for
reported waits, and interpret an already-blocked legacy observation as revision 1.
This needs neither a migration nor another compatibility layer.

The review also identified a contract gap: after an execution failure, a worker
could share a changed diagnosis only by choosing to wait. The candidate now
passes explicit `report: true` from an unsuccessful result through the same
selected-report function used by waits. The same Task remains eligible for
paced retry. No flag means no replacement of its existing failure report.
Agents judge whether the update matters; code does not compare report prose.

Regressions reproduced the original failures before the changes. They exercise
the real prepared finish tool, SDK schema/admission and compile-time types,
file-backed legacy observation recovery, and the runtime sequence: execution
error → explicit changed retrying report → quiet ordinary retry → original
answer. That sequence reopens runtime/storage, preserves the first attempt's
evidence and rejects delayed or duplicate report notifications. These are
portable mechanical checks; no new live-model or deployment evidence is claimed.

Integration order: #172's independent script fixes first, then reviewed #169,
then #174's PoC retirement. The #168 → #170 → #171 → #173 cleanup stack has its
own dependency order. Whichever side integrates second must preserve this
contract while adopting `incomplete`, `facts`, Conversation/input names and the
claim/execute/settle layout; do not add aliases for unmerged vocabulary. #174
must also retire #169's new caller-feedback README and preserve its findings
here. Do not restore `scripts/poc/` to resolve integration conflicts.

#172 is now merged. The review candidate is Host `65c5e9f2`, rebased onto
`f6a11d1c` without conflicts. Previous reviewed source `2433b88c` remains on
`audit/caller-feedback-pre-review-20260912` for audit and experiment reproduction.
The focused run passed 268 tests; Host/SDK type checks, boundary/lint checks and
canonical design checks passed. Full rebased-source and hosted checks are
recorded on the PR once complete. Neither source rebasing nor verification
changes the installation.
