# Connected recovery to the original human promise — 2026-11-12

**Supports:** [Connected recovery acceptance](../../proposals/unified-agent-recovery-20261017.md).
**Status:** Disposable HTTP, control-socket, SQLite and real-worker experiments.
The initial trials use a local scripted provider; the separately authorized
[real-model follow-up](#real-model-follow-up) uses external model calls. No
production Host source, installed routing, live state or deployment changed.

## Result and design consequence

Existing Tasks, requests, Conditions and normal recovery timers can carry a
workflow access failure through executable help to the original result and its
human promise. The successful case repairs access with the agent's real Bash
tool, resumes the same original Task after ordinary backoff, returns its verified
sample to both callers, and fulfills the original Conversation Request only
when its answer is delivered.

With repair unavailable, the original Task exhausts its two-attempt allowance.
Its request remains unanswered, the human sees a blocker explanation, and the
original Conversation Request stays open. One repair Task retains the next
responsible owner, requested action and a future review deadline. Exhaustion
reaches that same repair Task rather than creating replacement work.

This supports the existing recovery model for the declared fixture route. It
does not justify a separate recovery service. Keep optional runtime prerequisites
inside the business operation, route its actual failure fact to capable help,
and preserve the exact original obligation and return path.

## Participants and path actually exercised

| Participant | Responsibility and evidence |
| --- | --- |
| Human-facing `sample` App / `owner` agent | Accepts one HTTP message, opens `sample-promise`, requests the original work, explains its blocker, consumes its actual result and publishes the answer through scoped communication. |
| `worker` App / `worker` agent | Owns one `work` Task. Its `sample` workflow cannot load while a fixture access file is absent. Once access exists, it reads the original sample file, checks that its value is 42 and returns that result. |
| `repair` App / `repair` agent | A declared subscription admits worker reconciliation failures to one stable `work` Task. It restores access through the real tool or retains an owned blocker. Its request explicitly targets the original worker Task and waits for that Task's result. |
| Host | Performs ordinary admission, subprocess execution, failure reports, request delivery, backoff, result acceptance and Conversation communication. No between-step harness recovery calls advance the chain. |

```text
HTTP human input -> Conversation Task and open promise
  -> original worker request -> unavailable workflow
  -> failure to saved caller + declared repair subscription
  -> repair tool + addressed request to original Task
  -> ordinary scheduled retry -> verified original sample
  -> original caller and repair caller receive the answer
  -> Conversation answer and fulfillment of the original promise
```

The App declarations remain independently loadable. The access check sits at
the top level of the business workflow module, whose import fails before its
procedure runs. This differs from a failure while importing the shared App
catalog: the [bootstrap trial](recovery-bootstrap-trial-20261112.md) still owns
that negative contrast and its `handler.failed` route.

The harness creates the synthetic source and the original sample, leaves access
absent, starts the runtimes and submits the human ask once. After admission it
observes, with one deliberate process restart in the restart contrast below.
It does not repair the file, emit failure/success notices, force
retry deadlines, manually reconcile work or deliver a synthetic return.
Provider choices are scripted; the tools, process boundary, storage, timers,
admission and return implementation are production code.

## Observed outcomes

The original connected revision recorded:

| Case | Elapsed from fixture setup | Provider calls (`sample` / `repair`) | Original worker | Human promise |
| --- | --- | --- | --- | --- |
| Repair available | 35.38 s | 3 / 3 | One failed attempt, then verified convergence on the same Task/generation | Answer readable over HTTP; original input done; Request fulfilled |
| Repair unavailable | 35.10 s | 3 / 2 | Two failed attempts; original allowance exhausted | Blocker readable over HTTP; original Request remains open |

In the successful case access was repaired and its addressed request admitted
within a few seconds. Most elapsed time was the original 30-second execution
backoff. A repair-ready request did not erase that allowance or retry deadline.
This experiment does not establish that immediate retry would be preferable.

Both cases retain one worker Task and one repair Task. All original worker
attempts use the same Task identity and generation. The original request receipt
retains the Conversation Task as its creator. Repair returns to that exact
worker Task; it neither closes the original obligation nor replaces its owner.

The successful path uses three Conversation-agent provider calls and three
repair-agent calls, including the repair tool's follow-up. The unavailable
workflow makes no model call. The unresolved contrast uses three Conversation
calls and two repair calls through the second failure/exhaustion notice. These
are scripted HTTP request counts, not measured external model tokens or costs.

The observation waits for final reconciliation events as well as saved state.
Reading a fulfilled promise before its worker's event relay has drained would
end the experiment too early. Success also requires the original input to be
done, the worker and repair Tasks to converge, and the answer to be readable
through the HTTP Conversation adapter.

## Follow-up: restart at the committed repair handoff

The extended harness runs its registry, bus, Inbox, Task controllers, control
socket and HTTP adapter in a dedicated fixture Host process. That process starts
real Task workers with the same scripted model provider. This keeps the original
success/unresolved cases and the new restart case on the same execution path.

After the repair agent has performed its tool operation and saved its addressed
request and wait, the harness stops the fixture Host gracefully and waits for
exit code zero. It starts another process against the same source and database,
with a new PID, bus, registry and runtime. It submits no further human input or
repair result. Ordinary startup and the retained retry timer carry the work.

The trial checks that the original Task generation, failed-attempt reference,
failure count and retry deadline survive. Original and repair request receipts,
the repair Condition links and the open promise are identical after startup.
The same worker Task completes; both callers receive its answer, the human
receives exactly one final message, and the original promise is fulfilled.
The repair command runs once in total. This establishes orderly restart at a
committed handoff, not crash recovery during an active tool or uncertain effect.

At the extended revision, the connected cases took 35.40 s (repair), 35.57 s
(unresolved) and 35.43 s (restart), measured from fixture setup. Provider calls
remained 3/3, 3/2 and 3/3 respectively. Restart added no model invocation and
did not repeat the repair command. These are fixture observations, not a
representative performance benchmark.

## Follow-up: admission contention and its actual next wake

The earlier App-inbox lock diagnostic now has a focused reproduction. A canonical
`session.end` fact is saved before parent delivery. A second real SQLite connection
holds the WAL writer slot while the ordinary persisted-event fanout reaches the
App-inbox route. Its no-work acknowledgement fails under the serving connection's
short busy wait, and the original row keeps `app_admission_pending = 1`.

After releasing the lock, the harness observes only. The existing default
60-second recovery timer rereads the journal and clears that same marker. It
does not call `scanNow`, redelivery, restart or a fake clock. A temporary query
observer forwards real queries unchanged and waits for the initial empty startup
scan before injecting contention; it neither changes results nor advances work.

The event's original payload/envelope remain unchanged. Live observers see it
once, and recovery creates no Inbox input or Task. Clearing this no-work marker
does not claim a business result or global delivery acceptance. This establishes
the recovery path for the reproduced `session.end` case; it is not replay evidence
for every historical `session.start` diagnostic or work-bearing route.
The final run cleared the marker after 62.76 seconds of measured wall time,
with one recorded subscriber failure and one live notification.

The owning source is `src/app/composition/app-inbox-runtime.ts`: the no-work
route acknowledges the marker, and `recoverInputs` retries retained markers
through the existing journal. No Host correction was needed for these contrasts.
Earlier contention tests exercised real locks but manually restarted or delivered
afterward; they did not demonstrate this normal timer carrying the recovery.

## Reproduction and verification

- Production Host base: `a84c6918ed404cc9793c98930df815a00551544e`.
- Original connected harness: `1319a2ca41d908ef3d821120b8bec8aa6005df71`.
- Extended harness: `dbea3ce91301529516e687f5a609da0dfae6677d`.
- Linked experiment branch: `experiment/recovery-bootstrap-20261112`.
- Checkout: `/home/hao/workspace-worktrees/may-recovery-bootstrap-20261112`.
- Harnesses: `test/integration/connected-recovery-trial.test.ts` and
  `test/integration/admission-contention-timer-trial.test.ts`; process driver
  `test/integration/fixtures/connected-recovery-host.ts`.
- Runtime: Node 24.20.0 and Bun 1.3.14.

```sh
bun install --frozen-lockfile
bun test test/integration/connected-recovery-trial.test.ts test/integration/admission-contention-timer-trial.test.ts test/integration/recovery-bootstrap-trial.test.ts src/app/adapters/discovery/app-definitions.test.ts src/app/core/apps/registry.test.ts src/app/composition/direct-event-recovery.test.ts
bun run check
bunx --no-install eslint test/integration/connected-recovery-trial.test.ts test/integration/admission-contention-timer-trial.test.ts test/integration/fixtures/connected-recovery-host.ts
```

The experiment stays on a linked branch; it adds no permanent CI requirement
or production behavior. Logs, the expanded type-check configuration and checksums
are retained under `/home/hao/workspace-archive/recovery-bootstrap-20261112/`.

At the original harness revision, the selected four-file run passed **21 tests,
103 assertions, zero failures** in **73.67 seconds**. Ordinary Host type checking,
targeted ESLint and whitespace checks passed. The full App design command passed
with zero errors and its 15 existing layout warnings; the four changed documents
have no missing relative link targets. These are selected checks, not a full
Host CI or image validation claim.

At the extended revision, the six-file selection passed **34 tests,
189 assertions, zero failures** in **174.27 seconds**, including the three
connected cases, the real default-timer case and the owning direct-event
recovery suite. Host type checking, targeted ESLint, whitespace and App design
checks passed again. The deliberate lock cases log expected write failures;
their assertions require retained identity and actual subsequent recovery.

Expanded checking includes the reused `task-worker-scenario.ts` fixture, which
ordinary Host type checking excludes. Its ten existing diagnostics remain;
the new harness adds none. Do not describe that expanded check as clean.

Earlier failed runs were harness corrections: the input validator initially
called the wrong capability, the unresolved Condition lacked a typed subject,
and a placeholder continuation lacked progress facts. Correcting these scripts
changed no Host behavior. Exploratory runs and final verification also logged
an App-inbox durable-route `database is locked` diagnostic on `session.start`
or `session.end`. The original outcome still returned. The follow-up above now
reproduces and verifies ordinary timer recovery for a no-work `session.end`;
the individual earlier rows were in already-disposed temporary environments.
The first timer-trial script used a legacy flat event shape, which the canonical
session writer did not persist. Correcting it to the real producer's envelope
made the intended contention boundary observable; no source fix was needed.

## Limits of the scripted trials

- Autonomous diagnosis or useful repair choice by a real model. The provider
  receives the real prompt, but deliberately supplies predetermined decisions.
- Installed May/Alex route coverage, live deployment, browser presentation or
  whether a person actually read the HTTP-visible answer.
- Recovery when an App catalog, essential storage or all usable model access
  is unavailable. Only the business workflow is unavailable in this chain.
- A human-owned Condition, its actual reply adapter, and resumption after that
  reply. This contrast chooses the repair App as the next responsible owner.
- Abrupt crash during an active operation, work-bearing admission failure,
  explicit recovery after exhaustion, descendant cleanup uncertainty, or
  sustained quiet behavior after repeated
  unchanged notices. The unresolved run ends after exhaustion is consumed;
  it does not reach the repair Task's next review deadline.
- Workload funding/enforcement, representative traffic, control latency or
  token cost. The fixture uses Host capacity three and one concurrent Task
  per App; it supplies no installed budget policy.

The separately authorized follow-up below tests real decisions. Installed
routes and actual human-action replies remain separate acceptance work.

## Real-model follow-up

The user authorized a bounded external-model trial. It reuses the same HTTP
ingress, disposable Host subprocess, Task workers, SQLite, tools, retry and
caller paths. The local gateway forwards the actual managed-agent prompts and
tool definitions to `gpt-5.6-sol`; it supplies no decisions or tool arguments.
The worker's business workflow still verifies the original sample. Conversation
and repair agents choose their own reads, tool actions, waits and results.

Representative instructions preserve the creator's acceptance, ordinary retry,
exact caller return and the original human promise. A local service runbook
defines the missing prerequisite and repair authority. The negative case
explicitly withholds restoration authority. Neither case permits the agents to
read the original sample directly, bypass the verifier or change its acceptance.
These are synthetic Apps with representative policy, not the complete installed
May/Alex definitions or routing catalogue.

### Observed outcomes and failed iterations

| Trial | Provider requests | Trial clock through final observation | Result |
| --- | --- | --- | --- |
| Initial repair, 16-call ceiling | 16 forwarded; 15 responses completed before shutdown | 49.9 s | Helper repaired access and the original worker converged, but the ceiling stopped caller consumption. Original promise stayed open. Failed trial; completed-response usage is incomplete. |
| Ambiguous destination | 9 | 70.3 s, stopped deliberately after an ineffective wait | Agent chose `sample` instead of verifier `worker`, accepted the routing error as unavailability and waited. No worker Task was admitted. Failed trial. |
| Exact verifier route | 16 (`sample` 9 / `repair` 7) | 86.2 s | All three Tasks converged and the original promise was fulfilled, but two answer messages reached the human adapter. The one-answer assertion failed. |
| Missing restoration authority, exact route | 22 (`sample` 15 / `repair` 7) | 90.0 s | Passed. Access stayed absent, the worker exhausted two attempts, and Conversation and repair Tasks waited. Original promise stayed open; one owned authorization Condition retained a requested action and future review. |
| Exact route plus communication clarification | 19 (`sample` 11 / `repair` 8) | 81.0 s | Passed, including the unchanged one-answer assertion. Real Bash repaired and verified access, ordinary retry resumed the same worker Task, both callers consumed its result, and the original human input was answered and promise fulfilled. |

The first ceiling was too small for this model's tool-driven reads and
corrections; later runs allow at most 32 forwarded requests per case. This is
an experimental bound, not a new Task recovery policy. All later cases retain
the 300-second observation deadline, 120-second worker bound, 90-second provider
request timeout and 8,192 generated-token limit per provider request.

Both successful cases used three Conversation attempts, two repair attempts
and two original worker attempts. The unavailable business workflow made no
model call. One worker Task and one repair Task were reused throughout. The
repair case made one actual repair Bash call; the unresolved case made none.
No human or harness action advanced either successful chain after its initial
HTTP input. The deliberately stopped wrong-route run is not included in that
statement.

### Small corrections at the demonstrated boundaries

1. **Destination meaning:** the phrase “App worker” did not reliably establish
   a callable destination. Put the exact `{appId:"worker", input:...}` in the
   business input and owner instructions. No Host routing heuristic was added.
2. **Communication effects:** the agent published an answer with `tasks.apply`,
   then returned another answer in final `response`. These have distinct effect
   identities. Clarify that `response` sends a message; after an already accepted
   delivery, summarize it and omit `response`. The existing
   [Conversation contract](../../2a-design/conversation-execution.md) and
   [execution guide](../../2b-manual/task-execution-guide/SKILL.md) now explain
   this across immediate application and final settlement. No suppression rule,
   extra lifecycle state or relaxed one-answer assertion was added.

The successful repair run also corrected one invalid Topic selection using
ordinary tool feedback. The unresolved run corrected two rejected results:
an App-request-only Condition option on an authorization Condition, and an
invalid Topic reference. These corrections establish usable error feedback in
these runs, not error-free agent behavior.

### Usage, source and reproduction

The final repair run reported **198,610 prompt tokens and 4,913 completion
tokens** across its 19 provider responses. The unresolved run reported
**242,965 prompt tokens and 6,806 completion tokens** across 22 responses.
Prompt totals include repeated and cached input; they are not unique context
size or a billed-cost calculation. Tariffs are not established, and the
fixture's model-price metadata must not be used to claim zero cost.
The communication clarification fixed the demonstrated duplication in one
follow-up; it did not reduce calls versus the previous repair run. These few
runs are not a reliability or efficiency comparison. Across all five iterations,
82 requests were forwarded and 81 responses completed with recorded usage:
857,310 prompt tokens and 21,062 completion tokens. One interrupted response
has no complete usage record, so this is not the full experiment's billed cost.

All runs retain production Host base `a84c6918ed404cc9793c98930df815a00551544e`.
Experiment commits on `experiment/recovery-bootstrap-20261112`:

- `96654d48025a861a2f6f4177e602cc48f63f1ab4`: real forwarding and explicit
  limits; the initial run used the preceding 16-call setting before this commit.
- `5ed7a77690eb1c9f466142550a40d73b0f496bc5`: exact verifier destination;
  owns the duplicate-answer failure and passing unresolved contrast.
- `9033249e35409b8b42d15d302d24abb93e05f737`: communication clarification;
  owns the passing refined repair case.

From that linked worktree, provide a compatible model endpoint and credential
in the environment and choose a fresh local evidence directory:

```bash
mkdir -p "$RECOVERY_EVIDENCE_DIR"
MAY_RECOVERY_REAL_TRIAL=1 bun test test/integration/connected-recovery-trial.test.ts
```

The opt-in requires `RECOVERY_MODEL_BASE_URL`, `LITELLM_API_KEY` and
`RECOVERY_EVIDENCE_DIR`. `-t 'human promise: repair$'` selects only the repair
case. Without opt-in, the same file uses only the scripted local provider.
The experiment stays off permanent CI. Credentials remain in the gateway's
environment and authorization headers, are stripped from Host/worker child
environments, and are not written to evidence.

Local evidence alongside the earlier records includes
`real-recovery-summary.json`, `real-recovery-sha256.json`, provider-run and
verification logs, retained failed-run logs, and per-case model/state
records. The summary distinguishes attempted gateway calls, forwarded requests,
completed responses, usage, actual tool calls, rejected calls, Task phases,
promise state, runtime events and Host diagnostics. The two successful real
cases recorded no `subscriber.failed` event.

The extended scripted path still passed **3 tests, 41 assertions, zero failures**
in **109.23 seconds**. The final refined repair passed **1 test, 13 assertions**;
the earlier exact-route run contained **1 pass / 1 failure, 21 assertions**, with
its unresolved case passing and duplicate-answer repair failing. Host type
checking, targeted ESLint, whitespace and App design checks passed. App design
retains its 15 existing layout warnings. Expanded fixture checking retains the
same ten existing diagnostics in `task-worker-scenario.ts`, with none in the
new harness. These are targeted checks, not full CI or image validation.

The follow-up below tests selected accepted declarations and the human reply
adapter. Installed capable execution, recovery when essential Host dependencies
fail, explicit resumption after exhaustion, sustained quietness through the
future review, high-load behavior and broad model reliability remain separate.

## Human-reply follow-up

The production Telegram adapter now carries a human-owned Condition through
presentation, reply correlation, owner judgment and the original outcome in
disposable state. Its provider HTTP transport points only to a local fixture;
no real Telegram message, credential or external model is used. Agent decisions
are scripted. This is mechanical evidence, not another real-model trial.

The initial ask still enters through HTTP/control ingress. The original worker
cannot load its workflow while access is absent. Its saved caller receives the
failure and asks the human to choose a sample profile through one ordinary
human-owned `sample-choice` Condition. The repair App has no subscription in
this variation; the existing capable caller handles the choice itself.

The adapter renders the current requested action and saves its complete delivery
receipt. The harness then supplies three ordinary Telegram-shaped replies:

| Reply | Observed disposition |
| --- | --- |
| `not sure` to generation 1 | Reaches the original Conversation Task. The owner judges it insufficient, retains the promise and replaces the ask with generation 2; access remains absent. |
| `local` to the old generation-1 card | Retains the old display identity and reaches the same Task, but fails the production matcher against the current Condition. The owner keeps the current ask; access remains absent. |
| `local` to the generation-2 card | Carries the exact Task, Task generation, Condition ID and Condition generation. It matches the canonical Condition; the owner uses the actual Bash tool to configure the disposable profile, verifies its file contents and retires the Condition with generation 2. |

An ordinary directly admitted reply does not automatically change the saved
Condition to `true`: the exact event can be available in the attempt while the
Condition remains `unknown`. The owner judges and consumes that evidence. The
owning Telegram E2E test already exercises this behavior; the trial's initial
expectation of automatic observation was wrong. The human-surface contract and
Task execution guide now say this explicitly. Reply receipt, sufficient answer,
verified external effect and original outcome remain distinct facts. This
business choice is not a formal approval and grants no broader authority.

The original worker then resumes under its existing 30-second execution backoff,
reads and verifies sample 42, and returns it through the original request. The
caller publishes exactly one final answer, fulfills the original promise, and
converges. Both HTTP Conversation reads and the local Telegram transport see
that answer. No extra repair Task is admitted, the original Task generations
stay 1, all human Conditions are retired, and the actual tool operation runs once.

The final combined run observed **37.56 seconds** from human-fixture setup,
**7 scripted provider calls**, **6 Conversation attempts** and **2 worker
attempts** (one failed, one converged). The unavailable workflow makes no model
call. These request counts carry no external token usage or inference-cost claim.

Failed iterations are retained alongside the passing evidence:

- The fake Telegram API initially omitted `editMessageReplyMarkup`; production
  uses it to retire a turn's controls. The local transport fixture now supports it.
- The decision script assumed the original human input stayed in every bounded
  input page. It now reads that retained input by its saved identity while
  inspecting each newly admitted reply independently.
- The script incorrectly required a directly admitted receipt to have already
  changed the Condition to `true`; it now checks the actual input through the
  production matcher and consumes it under the existing owner contract.
- The caller fixture initially had no coding tools, so requests for Bash never
  created the profile and the 16-call ceiling stopped the loop. The capable
  caller now explicitly has coding tools, and a failed tool effect fails the
  experiment immediately rather than repeating an unchanged command.

The corrections change only the linked experiment and clarify existing
guidance. No production Host source or live Task state was changed.

## Accepted-release route probe

The same branch copies the accepted definition release into a temporary root,
imports the actual May, Alex and Scout manifests, and drives their subscriptions
through the real Event journal, Inbox admission plan and Task admission. It
waits for the durable admission plan to complete: Event acceptance alone can
precede actual Task admission. An initial fixture assertion stopped at that
earlier journal receipt; its failed log is preserved.

The selected release is
`587aaea7378a13ecd8d464629bb3304d01c03a30-definitions-v5`, with source commit
`587aaea7378a13ecd8d464629bb3304d01c03a30`. Its manifest SHA-256 values are:

| Manifest | SHA-256 |
| --- | --- |
| May | `bf147e9406fa3dfe32a0072c5e01eebe861423cfc1dd3188f31ee4ff70ba7c7e` |
| Alex | `e03a0aa9cc971c3ea32366e24a1d9a8e5d27afec176e7aa0e29da4b70c8abba0` |
| Scout | `0fbf19cb6cbbd32352bd3c327db063c766a29284c80377531ec66da6b74f1270` |

Workspaces, schedules, observers and metrics are disabled in the in-memory
fixture declarations. Actual input schemas, subscription selectors, translation
and Task mapping remain. A startup barrier prevents all business execution.
Failure facts are supplied by the harness using the source producer's envelope;
they are not incidents observed in the running installation. The probe proves
selected routing and durable admission against this Host source, not a capable
repair recipient, the installed binary or the effective live environment.

| Simulated fact | Observed route and admitted work |
| --- | --- |
| Alex selector `retrying`, `incomplete`, `exhausted`, automatic review off | Three notices join the same `alex/runtime/selector-recovery`, generation 1, owned by Alex with no workflow. |
| Pre-attempt `handler.failed` from `app-task-controller` for May, Alex or Scout | No matching subscription, retained operational input or recovery Task in these three declarations. The unaddressed Event can be accepted in the journal with no admission plan. |
| Ordinary Scout exhaustion, automatic review off | Alex's broad reconciliation subscription translates to `null`; no input or recovery work is admitted. |
| Same exhaustion, automatic review on | An Evaluator Task using `task-outcome-review` is admitted. This is evaluation, not demonstrated repair. |
| May input-admission failure from the declared Inbox producer | A review message reaches May's Conversation Task. |
| Explicit Scout owner request, `repair-index` | The declared input joins `library-maintenance` with `knowledge-planner`. |

Ten observations cover these contrasts. Automatic review is deliberately toggled
for the two policy cases; no claim is made about its current live setting.
Working-tree Alex declarations now differ from this accepted release. They are
not used or validated by this probe and were not activated.

The adoption gap is concrete: a controller can fail before an attempt exists,
while the installation's attempt-review routes do not supply executable help.
Keep its correction in the responsible App's declarations, reuse ordinary owned
work, and verify a recipient that can start despite the failed prerequisite.
After exhaustion, a verified repair still needs an authorized retry decision.
The next connected acceptance run must exercise that actual App route through
the original obligation's result; neither generic broadcast subscription nor
admitted recovery work alone establishes that outcome.

A subsequent source review found a mismatch in the working-tree candidate:
Alex's `taskInputForEvent` filters out `handler.failed` unless `willRetry` is
false. In the checked Host base, `src/app/core/tasks/controller.ts` sets
`willRetry = !this.closed` in `recordFailure`, with dispatch backoff capped at
30 seconds. An active controller does not exhaust that retry path. The current
App unit case deliberately ignores `willRetry: true`, and the added deployment
case exercises attempt exhaustion using manual reconciliation and retry-deadline
advancement. Neither establishes help for the active pre-attempt controller
failure. This is a source-contract finding, not another executed trial. The
next correction must allow owned diagnosis under the actual producer's behavior
without multiplying recovery Tasks or replacing mechanical retry policy.

## Follow-up reproduction and checks

Both extensions are retained on `experiment/recovery-bootstrap-20261112` in the
existing linked Host worktree at
`f8ccb277a30bd252273d55398dd38295e73f047a`, still on production Host base
`a84c6918ed404cc9793c98930df815a00551544e`. The accepted-release probe requires an explicit
`RECOVERY_ACCEPTED_DEFINITIONS` path; without it the installation-specific test
skips. The human mode is explicitly selected and cannot combine with real-model
forwarding. From that worktree:

```bash
MAY_RECOVERY_HUMAN_TRIAL=1 RECOVERY_ACCEPTED_DEFINITIONS=/path/to/accepted-release \
  bun test test/integration/connected-recovery-trial.test.ts test/integration/accepted-recovery-routes.test.ts
```

The final combined run passed **2 tests / 48 assertions / zero failures** in
**41.01 seconds**. The preexisting repair variation separately passed **1 test /
13 assertions**, and the three owning Telegram files passed **62 tests / 423
assertions**. Host type checking, targeted ESLint and whitespace checks passed.
Expanded fixture type checking retains the same ten preexisting diagnostics in
`task-worker-scenario.ts`, with none in the new or changed harness files.
App design checks passed with zero errors and the same 15 existing layout warnings.
Full CI and image validation were not run for this experiment-only extension.

Local evidence includes `human-routes-verified.log`, `human-loop-first.log`
through `human-loop-fifth.log`, `human-loop-final.log`, both accepted-route
iterations, owning-test/type/lint logs, and the extracted summary and hashes.
It retains actual replies, saved Conditions and matching input, Task attempts,
promise disposition, ten routing/admission plans and the failed iterations.

## Controller-failure policy correction

App source commit `3fe56f5afc4d75f781b684b9ae6f0c20bbdaaf63`, on
`fix/alex-controller-failure-evidence-20261112` from base `7305af0252`, removes
the `willRetry: false` filter from Alex's existing controller-failure route.
The source producer and reconciliation-stage checks remain. Retry status stays
in the exact failure evidence, and the message asks Alex to check whether the
original work has already recovered before intervening. The stable investigation
identity, original requirements, caller relationships and recovery self-loop
exclusions remain. The owning boundary and operations guide distinguish retry
scheduling from owner judgment.

The existing App-policy test now checks retrying, non-retrying and older notices
without that optional field against one investigation identity. Unrelated
producers/stages remain excluded. One additional regression in
`projects/alex.app/recovery-contract.test.ts` uses the real Host controller and
Alex declaration, with scripted agent decisions and a disposable access file:

1. The original Task cannot pass a fixture prerequisite before claim. The actual
   controller emits `handler.failed` with `willRetry: true`; no original attempt
   exists yet.
2. Alex begins the declared investigation. While it runs, a normal dispatch retry
   fails again. Both notices are admitted to the same recovery Task.
3. The scripted agent invokes the actual write tool, verifies restored access,
   and requests the original result through an addressed ordinary request.
4. The normal controller retry finishes the original work on generation 1 and
   returns sample 42. The assigning input receives that result, and Alex consumes
   it before converging. There is one repair and no explicit retry command.

The harness injects the failed prerequisite at the real controller boundary; it
does not inject failure events, advance retry deadlines or manually run later
steps. The fixture starts the queued controllers once. This proves routing,
execution and return for the same-App contrast. It does not prove a separate
recipient can start under a shared catalog/Git failure, real-model judgment,
sustained quietness under unchanged notices, or installed activation.

Both regressions failed under the old filter. After the correction, the three
owning App/deployment suites passed **34 tests / 291 assertions / zero failures**
in **35.61 seconds**. The design check passed with zero errors and one existing
layout warning in the isolated checkout. No external model, live mutation,
definition reload, deployment, full CI or image validation was performed.
The checked Host source was `0fc8ceba3ec51e827ee2cdaca8461be1f208e0ab`.

The first wider test run exposed fixture prerequisites: a fresh checkout lacks
the selected installation's two ignored `.disabled` markers, so the discovery
test saw five active Apps instead of three. Empty markers were added only in
the isolated checkout. The long worktree path also overflowed the model-surface
check's catalog because skill locations are absolute. Moving the same checkout
to the shorter local path `/tmp/acr12` passed the unchanged catalog limit;
no prompt, limit or test assertion was relaxed. Both failures are retained in
the local `controller-policy-*` logs beside the passing verification.

## Independent Alex controller trial

The correction is committed to local Apps `main` as
`5aacdaee9255b979eab1a49cf4c41c0eec16a8d5`. No remote PR, App activation,
Host deployment or live Task mutation was performed. The isolated source
regression remains at `3fe56f5afc4d75f781b684b9ae6f0c20bbdaaf63`.

The extended experiment at `cb5ea5558145f5f65e2f72d63b8000104db40a18` on
`experiment/recovery-bootstrap-20261112` copies Alex's exact business declaration
and its source dependencies into a disposable installation. An exact source
comparison runs before a fixture wrapper disables Git workspace preparation,
schedules, observers and metrics. All copied role profiles remain in accepted
catalog validation; their model references use the local scripted provider.
The Host experiment retains base `a84c6918ed404cc9793c98930df815a00551544e`;
App source regressions use checked Host `0fc8ceba3ec51e827ee2cdaca8461be1f208e0ab`.

A synthetic caller submits its original obligation through the real HTTP/control
interfaces. The original worker's disposable prerequisite check fails at the
controller's execution boundary before claim. That check affects this operation;
it does not make the accepted App declarations unloadable. Alex starts through
the real Task-worker subprocess using the complete accepted catalog and the
actual subscription, input schema and Task mapping. Normal retries produce
multiple `willRetry: true` notices, whose admitted Alex inputs join one
`runtime/recovery/worker-work-792f8677f1b4` investigation. Its decision brief
contains the original failure evidence.

In the authorized contrast, Alex's scripted decision invokes the actual Bash
tool to restore the prerequisite and verifies its contents. It makes an ordinary
request explicitly addressed to the original worker Task. Normal dispatch retry
runs that worker's workflow on generation 1; both the original assigning request
and Alex's request receive verified sample 42. Alex consumes the original result,
and the caller delivers one answer and fulfills its existing human promise.
There is one repair command and no explicit retry command. Convergence is checked;
this trial does not claim guarded Task closure.

In the missing-authority contrast, Alex performs no repair command. It retains
an owned Condition with the action to obtain service-owner authorization, restore
access and notify the original work, and a future review time. An ordinary
addressed request sends that blocker to the original caller Task. The caller
reports the owner, action and next review through its saved Conversation while
leaving the original promise open. The original Task stays pending without an
observed attempt or invented successful result; the access file remains absent.
Authority here is a supplied business constraint respected by scripted choices,
not a demonstrated technical permission barrier or model judgment.

The first blocked contrast retained a Condition without delivering its impact
to the caller. That was insufficient acceptance. The return exercise exposed two
existing contracts: a Conversation-only declaration cannot receive an App Task
request without a declared Task handler, even with an exact target; and an
addressed App input carries no new human communication context. The fixture
caller now declares its addressed Task route and reads the existing Conversation
through the ordinary read implementation, then communicates using the original
accepted input. No Host routing or communication authority was changed.

One stricter run rejected any controller failure from Alex. A repeated notice
raced its claim and produced an expected stale-fence rejection after Alex had
already started. That assertion incorrectly coupled independent startup with
absence of all transient conflicts. Final acceptance permits ordinary Host
retries and requires the delivered outcome/blocker and retained identities.
Earlier setup failures from incomplete copied dependencies or unadapted model
references are retained with the failure logs; the final fixture validates the
full supplied catalog rather than bypassing it.

The final combined independent/startup run passed **6 tests / 65 assertions /
zero failures** in **16.06 seconds**. It includes the negative shared-module
contrast: if another accepted App's top-level module cannot load, the recipient
also cannot start. The existing scripted repair, missing-authority and orderly
restart contrasts passed **3 tests / 41 assertions / zero failures** in
**115.94 seconds**. Their parallel run retained SQLite contention diagnostics;
passing final outcomes do not establish absence of transient contention.
The affected App suites on local `main` passed **34 tests / 291 assertions /
zero failures** in **35.31 seconds**. Host source type checking, targeted ESLint
and whitespace checks passed. Expanded experiment type checking retains the ten
preexisting diagnostics in `task-worker-scenario.ts`, with none in the changed
files. App design checking passed with zero errors and 15 existing warnings.

Reproduce from the linked Host experiment worktree, with an explicit corrected
Alex source directory:

```bash
RECOVERY_ALEX_SOURCE=/path/to/apps/projects/alex.app \
  bun test test/integration/connected-recovery-trial.test.ts \
    test/integration/recovery-bootstrap-trial.test.ts
```

`alex-independent-controller-summary.json`, final/contrast logs, setup and
assertion failures, type/lint logs and SHA-256 inventory are retained under the
external `recovery-bootstrap-20261112` evidence directory. No external model,
provider credential, production adapter send, full CI or image validation was
used for this extension. The scripted caller is representative, not the installed
May declaration. The trial proves independent operation-specific recovery and
honest caller feedback; it does not prove sustained quietness under unchanged
notices, arbitrary catalog/Git/storage failure repair or installed adoption.
The next adoption check must use the selected accepted App release and verify
its original work and caller result, preserving the shared-catalog limitation.
