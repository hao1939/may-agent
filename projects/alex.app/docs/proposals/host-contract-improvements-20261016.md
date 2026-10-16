# Strengthen Host contracts while keeping Apps free to evolve

**Status:** Direction accepted, implementation in progress; reviewed 2026-10-17.
Principles and contract refinements are integrated into their owning documents.
Database contention is fixed in merged [Host PR #370](https://github.com/hao1939/may-agent/pull/370).
The observer-accounting change is merged in [Host PR #371](https://github.com/hao1939/may-agent/pull/371) at `0fa9a8a12`; earlier local verification applies to `21abd7b9b`. Receipt expiry is merged in [Host PR #372](https://github.com/hao1939/may-agent/pull/372). The common code/retry/agent flow is accepted below; its implementation gaps and order are recorded in [Remaining gaps and fix order](#remaining-gaps-and-fix-order). Other later steps remain open.
Installation state is recorded in the linked dated rollout evidence; source
verification alone does not establish deployment.

**Parent:** [Keep the Host boring and let Apps change](host-stability-and-app-extensibility-20261005.md).
That proposal owns release compatibility and boundary verification. This one
derives contract refinements and focused implementation work from the October 16
source review and [two-week commit review](../archive/reviews/host-two-week-design-review-20261016.md).

**Supports:** [May's purpose](../1-principles/purpose.md): carry work to useful
results with less human rescue, keep it steerable, and avoid unnecessary cost.
Responsive controls, retained obligations and trustworthy failure evidence
support those outcomes. Apps need room to improve their methods independently.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first),
[Host mechanics and App meaning](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics),
[agents handle variety; code makes known work efficient](../1-principles/design-philosophy.md#agents-handle-variety-code-makes-known-work-efficient),
and [safe retry](../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions).
Repair existing owners and remove duplicated bookkeeping. Accept delayed
projections and occasional repeated consideration; protect accepted work,
ownership and external effects. Extra machinery must earn its cost.

## Direction and value

Use one recovery flow: **code handles known work; infra retries recoverable
failures; unresolved problems return to the responsible agent.** The agent
repairs, chooses another approach or escalates. Preserve the same Task, useful
work and effect identities. Record outcomes and recovery cost for later audit.
A known schema mismatch can go straight to judgment; it need not consume
identical retries. This is the [shared contract](../2a-design/system-boundary.md#retry-and-recovery-ownership),
not a new recovery framework or a Host-selected model fallback.

Keep the current Task, Event, Condition and execution-adapter model. The recurring
weakness is that a sound rule is implemented in one path while another path
retains a different assumption. Several valuable fixes also removed rules that
made independent facts depend on each other. More Host policy would recreate
those problems.

The first proposal covered five remaining mechanical gaps. The commit review
adds explicit requirements for usable context, correctable results, App-owned
execution policy, fair recovery scans and compatibility across execution paths.
These mostly preserve recent fixes; they are not five more feature projects.
The [coverage review](../archive/reviews/host-two-week-design-review-20261016.md#coverage-and-priority)
separates implemented lessons, open defects and unverified concerns.

## Accepted choices and their owners

The [two-week review](../archive/reviews/host-two-week-design-review-20261016.md)
retains the examples and reasoning behind these choices. Current rules live in
the linked principles and contracts; this proposal tracks implementation gaps.

| Choice | Value | Current authority |
| --- | --- | --- |
| Preserve independent facts; enforce only the needed precondition | Accept partial work and permit useful continuation without losing obligations | [Scoped agent judgment](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge), [Task attempts](../2a-design/task-attempts.md) |
| Let the owner of a fact acknowledge it | Recover the same obligation without false acceptance or another ledger | [One authority](../1-principles/core-principles.md#one-authority-for-each-resource), [Events](../2a-design/events.md) |
| Make existing context, correction and execution usable before adding rescue policy | Repair the broken feedback path instead of repeating its failure | [Fix the layer that failed](../1-principles/core-principles.md#fix-the-layer-that-failed), [Task execution guide](../2b-manual/task-execution-guide/SKILL.md) |
| Apps compose strategy; Host maintains the execution contract | Apps can improve methods without a Host policy change | [Host/App boundary](../2a-design/system-boundary.md), [Runtime recovery](../2a-design/runtime.md#recovery) |
| Return unresolved work to agent judgment through ordinary feedback | Keep useful work moving when the code path cannot handle the case | [Common recovery flow](../2a-design/system-boundary.md#retry-and-recovery-ownership), [Result admission](../2a-design/execution-contributions.md#result-admission) |
| Bound total work and preserve a path to finish | Keep controls responsive and retain useful partial results | [Review rule](../1-principles/core-principles.md#review-rule), [Storage](../2a-design/storage.md), [Task lifecycle](../2a-design/task-resource-engine.md#one-lifecycle-baseline) |
| Preserve the same contract across alternate paths | Worker relay, restart and reload keep accepted work and meaning intact | [Review rule](../1-principles/core-principles.md#review-rule), [Design authoring](../2b-manual/design-authoring/SKILL.md) |

## Contract coverage

**Agents decide what to do; Host executes and keeps the durable account.** The
labels below organize review; they are not new APIs, stored states or registries.

| Contract | Host must provide | App/agent remains free to choose | Existing owner and status |
| --- | --- | --- | --- |
| C1 — Work and usable context | Retain exact admitted input, covered contributions and independent Conditions; expose current scope, pending work and readable evidence with honest missing/truncated states | Interpret intent, gather domain context, accept scoped results, continue or wait | [Task attempts](../2a-design/task-attempts.md); recent context/partial-result fixes to preserve and verify across supported workers |
| C2 — Facts and attention | Distinguish retained observation, required delivery and eligibility to execute; preserve separate progress/failure facts and the caller's declared interest | Choose relevant facts, immediate or deferred progress, explicit help requests and investigation policy | [Execution feedback](../2a-design/execution-feedback.md), [Events](../2a-design/events.md); #351 established attention separation, ordinary-observer accounting is merged in #371 |
| C3 — Acceptance and replay | Let each operation owner record its own acceptance; recover unfinished delivery using saved identity, scope and timing; do not substitute a global receipt for pending App admission | Reuse results, revise authorized work or choose a different recovery operation | [Events](../2a-design/events.md), [Storage](../2a-design/storage.md); retain #336/#364/#366/#367; restart-independent expiry merged in #372 |
| C4 — Execution and recovery | Restore safe execution of the same Task, preserve accepted effects and diagnostic evidence, retain the declared procedure and expose unresolved ownership or exhaustion | Compose workflow/agent calls, choose repair or escalation, decide useful recovery work | [Host/App boundary](../2a-design/system-boundary.md), [Task lifecycle](../2a-design/task-resource-engine.md); preserve #344/#360, clarify private recovery confirmation |
| C5 — Responsiveness and finishing | Bound synchronous work and nested allowances; make knowable result errors correctable before exit, revalidate at fenced commit, retain partial evidence and cancel owned work correctly | Allocate useful work within supported budgets and choose what partial result to submit | [Runtime](../2a-design/runtime.md), [Task attempts](../2a-design/task-attempts.md); retain #289/#308/#335; contention fixed in merged #370; query profiling still open |
| C6 — Extension and failure visibility | Preserve promised facts across relays, recovery and supported adapters; contain absent capabilities; expose failures without requiring an improvement App to keep Host operating | Rename/move Apps, evolve schemas and procedures, select reviewers and act on evidence | [Host/App boundary](../2a-design/system-boundary.md), [Metrics](../2a-design/metrics.md); no universal extension registry or Host diagnosis policy |

An ordinary example ties these together. An agent publishes a partial report,
requests review and continues testing. New input remains accountable without
invalidating the report. If the worker fails, Host preserves those facts,
establishes safe execution ownership and retries the declared procedure. The
next worker sees what is unfinished. The caller can defer progress attention
while a required Condition change still wakes it. Neither a replayed report nor
a failed presentation may erase accepted work or change the execution strategy.

Host does not judge a metric breach or automatically create a domain repair.
Apps own that interpretation and use ordinary work/escalation. Existing failure
records and metric transitions support later audit; sample collection stays
cheap. A broken or unavailable improvement App must not prevent mechanical Host
recovery, though it can delay semantic investigation and human escalation.

## Implementation order

The owning contracts and stale retry/source-status prose have been updated.
Preserve already-fixed behavior and keep runtime changes independently reviewable:

| Step | Change and contract | Value / evidence |
| --- | --- | --- |
| 1 | Bound serving-path SQL waits; preserve operation-owned retry (C3/C5) | Merged #370; source verification complete, rollout not established |
| 2 | Apply observation semantics through ordinary producers and relays (C2/C6) | Merged #371; earlier local verification and merge revision are distinguished above |
| 3 | Expire delivery receipts from durable status/timing (C3) | Merged #372 uses the existing durable admission marker and saved timing; rollout not established |
| Next | Return unresolved work to agent judgment (C1/C4/C5/C6) | App adoption plus focused Host completion feedback, as specified below; does not wait for query profiling or private recovery cleanup |
| 4 — Host #376; review pending | One private recovery success meaning across callers (C4/C6) | Unconfirmed recovery retains ownership and reports failure; session evidence does not claim Task requeue. Backend and live adoption limits are recorded in the [trial](../archive/reviews/host-recovery-evidence-20261017.md) |
| 5 | Profile metric queries; optimize or contain demonstrated cost (C5) | Synthetic blocking shown; installed query impact remains unmeasured |

The [original evidence](../archive/reviews/host-contract-review-20261016.md)
pins the tests and probes. The [commit review](../archive/reviews/host-two-week-design-review-20261016.md)
adds source-history reasoning, not new runtime measurements. The details below
specify the intended corrections and their trials.

### Return unresolved work to agent judgment

**Status:** Accepted flow; optional-report Host fix is
[Host PR #373](https://github.com/hao1939/may-agent/pull/373) at `791abcc11`, based on
Host main `0fa9a8a12`. Local CI and both GitHub checks passed; review and deployment
remain separate. The
[source review](../archive/reviews/agent-judgment-and-code-paths-20261016.md)
reproduced late App-reader rejection and hidden requirements on optional
finish diagnostics. Requiring a report is useful; requiring complete findings
in every report is the schema-design mistake. Existing same-invocation correction
and workflow agent calls already provide most of the mechanism. Alex's candidate `cc24d7290a` improves
guidance and evidence reuse; it does not close all of these boundaries.

**Value:** finish useful work without another human intervention or full restart
for every unfamiliar format. Accept occasional agent recovery; add automation
when repeated cost justifies it. Code and agents satisfy the same contribution
contract; switching method preserves acceptance and effect rules. Content/schema
evolution should use interpretation when needed, without routinely migrating
history or adding version-specific readers. See
[contract evolution](../2a-design/execution-contributions.md#same-contract-as-content-evolves).
The [common contribution contract](../2a-design/execution-contributions.md#common-contract-for-code-and-agents)
is the normative rule for both methods. This proposal tracks its implementation,
not a second contract. Start with one App result boundary, then align generic
Host completion and prove the recovery route.

**First slice — shared App acceptance is activated.** The evaluator judgment was
the concrete case: its schema accepted blank text that the reader rejected, while
the reader accepted missing/non-array verification and unknown fields that the
schema rejected. One App-owned schema/admission helper now serves both review
workflows and code-produced judgments; historical evidence and report reuse
remain separate from new admission. See the [activation record](../archive/reviews/judgment-contract-20261017.md).
Full parity also needs the actual tool validator: the October 17 probe found
implicit conversion before App checks. Do not claim end-to-end equivalence from
a shared reader alone.

#### Remaining gaps and fix order

The earlier review covered Apps main `9d94b5a42a` and Host `21abd7b9b`.
The optional-report follow-up uses Host main `0fa9a8a12`. These are source findings,
not deployment or incidence claims. The [dated follow-up](../archive/reviews/agent-judgment-and-code-paths-20261016.md#october-17-optional-report-refinement)
records the smaller fix and its trials. App adoption can proceed independently;
for Host work, remove hidden finish requirements before changing validator
normalization. A stricter validator alone does not make incomplete work usable.

| Order / owner | Gap and impact | Smallest fix | Evidence needed to finish |
| --- | --- | --- | --- |
| 1 — Alex App; activated | Schema and reader disagreed, causing late rejection or silently changed data | One new-judgment schema/admission helper now serves both reviews and code-produced judgments; historical reads/publication reuse remain | Paired schema/reader checks and source/activation evidence are recorded in the [October 17 rollout](../archive/reviews/judgment-contract-20261017.md); real-validator parity is slice 3 |
| 2 — Host/finish; merged #373 and deployed | Optional fields became mandatory in hidden runtime checks, causing unnecessary correction turns | Removed hidden `verification_facts` and `blockers` requirements. Kept one declared report schema and the existing Task decision paths | Scripted reports finish in one reply for all statuses; waiting/continuation survives. Full source CI passed; the [rollout record](../archive/reviews/judgment-contract-20261017.md) identifies the installation |
| 3 — Host/model validator; merged #374 and deployed locally | The tool path converted types before validation and echoed full rejected arguments; code checks could disagree and correction costs grew | Check the visible structured finish schema in Pi's supported `prepareArguments` hook before conversion. Reuse that check for direct execution and captured-finish recovery. Return concise failures with original arguments retained | Real model-tool validation and code checks agree on declared acceptance, including explicitly permitted representations; rejected reports remain correctable. The [trial](../archive/reviews/agent-judgment-and-code-paths-20261016.md#october-17-report-validation) records source checks; the [rollout record](../archive/reviews/recovery-contract-20261017.md#host-374-and-activation-boundary) records paired compatibility and healthy deployment of `e982e7537`. Live savings remain unmeasured |
| 4 — App recovery; offline routes verified | A late rejection or setup/admission failure must reach usable owned work | Connected trials use existing owner calls/feedback and `previousAttempt`; original bytes, stable envelopes and reload protection remain. No additional production defect was demonstrated | The [October 17 recovery trials](../archive/reviews/recovery-contract-20261017.md) prove executable feedback, preserved identity and restart behavior. Live judgment quality/cost remain under observation; scripted interpretation is not model-quality evidence |
| 5 — Alex audit; natural audit observed, App follow-up fix verified | Prior audits omitted correction effort; the next audit counted it but misused reporting parameters and repeated stale rollout status. Four natural reviews corrected harmless no-action messages | App guidance now specifies numeric reporting parameters and current deployment evidence. The shared App schema accepts a bounded explanation on `none`, retaining its bytes without requesting attention. No Host change is needed | The [natural observation](../archive/reviews/review-followup-observation-20261017.md) records the audit's quiet disposition and ten useful published reviews, four with corrections; real-runner and publication-retry trials verify the App fix. Exact-target live delivery, the 50-review observation and measured savings remain open. Activation is recorded separately |

The goal is consistent acceptance with low correction cost, not stricter types.
Use one App-owned normalization/admission helper for both producers. With the
existing API, expose all accepted representations in the supplied schema, then
canonicalize through that helper. A text-or-number identifier can become text
without a model correction; a text-only declaration must not acquire an unrelated
Host conversion policy. Scope slice 3 to structured finish reports and test both
rejection outside the declared shape and intended normalization within it.
Report usefulness remains an App judgment: a converted `"42"` summary is not
automatically useful. Broader tool normalization remains outside this slice.

**App adoption — Alex owns meaning and the next action.**

1. Use one App-owned definition and admission helper for newly generated judgments.
   Reuse it in `task-outcome-review.ts`, `metric-review.ts` and their new-output
   reader; code-produced judgments go through it too.
   Express known structural requirements, including nonblank text, in the schema
   seen by the model. Require only what every report must contain; make
   potentially unavailable findings/evidence optional and keep completion judgment
   separate. Do not warn or retry for every optional omission. The reader must
   handle the same optional fields; an App can add a useful advisory in existing
   summary/facts when requested information is missing. Preserve original historical
   reports; route formats the current reader cannot handle through ordinary agent interpretation. A migration
   or separate legacy reader is not required. A reader must not add a hidden
   structural hurdle after finish or silently coerce invalid new data into success.
   Keep the agent's instructions linked to the contract and pass the shared schema
   through the existing call rather than maintaining another schema in the prompt.
2. In the existing workflow, call the responsible agent when a reader or operation
   cannot handle the case after its supported mechanical recovery. Supply the
   assignment, original input/reference, exact failure, useful work and effect
   status. The agent may interpret a legacy report or choose another method.
   Both paths meet the caller's current contribution contract; use its declared
   schema where structured output is required, and supported evidence or inability
   reports otherwise. Already-running agents receive ordinary tool feedback.
3. Keep this within the current invocation/attempt while allowance remains.
   Across attempts, inspect existing `previousAttempt` and accepted work before
   repeating the procedure. If the procedure cannot start, use its declared
   caller/operational route. Do not add a recovery Task per error, an App retry
   controller, or a field asking Host to switch executors.

The interpretation trial uses a valid ordinary `message`/`goal` envelope carrying
unfamiliar content as evidence. Also test incompatible input rejected before
destination admission and a procedure that fails before its workflow runs. The
first returns the original reference and rejection to its existing caller; the
second preserves the admitted Task and reaches its caller/declared operational
owner. Verify the feedback is usable for the next authorized action, not merely
logged. A missing recipient remains an unresolved delivery; Host does not invent
an agent. These trials do not weaken admission or silently convert a denied typed
action into work. Retained publication and follow-up decisions keep their effect
protection.

Some early recovery already works: Alex routes selector load/execution failures
to ordinary owned work, and Host retains failure outcomes. Preserve that path.
For schema evolution, include a pending inbox admission whose old content fails
the new schema. Current reload/admission checks can stop it before an interpreter
runs. Do not remove those checks merely because the design permits interpretation;
prove preserved identity, authority and delivery first, or retain a compatible
envelope while changing only its content.

**Host completion feedback — generic support for any App.**

1. Honor the existing declared report schema. The report remains required when
   requested; fields that can be unavailable are optional in that schema for both
   code and agents. Do not add status-specific exceptions or make every caller's
   fields optional in Host. Missing optional information is ordinary reporting;
   the App judges fulfillment and may include an advisory in existing facts.
   Remove the hidden generic requirements for `verification_facts` on success and
   `blockers` on failure/blocked. Keep both fields available, update their model
   descriptions, and preserve checks on supplied deliverable paths. Express the
   existing nonblank-summary requirement in the visible schema.
2. Prove the existing return path before changing adapters. A valid structured
   agent report already completes its invocation even if its outer finish status
   says partial/blocked/failure. Task reports can retain useful work with
   `state: waiting` and `continue: true`; no new partial state or adapter branch is
   needed. Common helper results retain output/facts on all authored statuses.
   Actual execution failure or cancellation remains distinct: retain evidence
   through existing references without automatically admitting its proposed
   actions. Do not remove those fences to make a failed run look accepted.
3. Align the real caller-result validator with the App's declared accepted shapes,
   including inputs to its shared normalization. Demonstrate that intended
   normalization finishes without another model reply, as well as that an
   undeclared conversion cannot produce different acceptance for code and agents.
   The pinned validator converts values before ordinary tool callbacks;
   a post-conversion App check cannot establish equivalence. Its supported
   `prepareArguments` hook runs before conversion: validate the model-visible
   report schema there and return the original values. Captured-finish recovery
   must use the same preparation before its existing schema/semantic checks.
   Return concise validation failures and retain original evidence by reference.
   Use the existing tool-error and execution-record boundaries for rejection and
   correction facts. Bound the number and size of error details and keep the
   original arguments in their tool call. Ordinary non-finish tools keep their
   existing normalization. No dependency edit, diagnostic parser, new warning
   system or retry policy is needed.

Prefer schemas for deterministic shape checks. If an App needs a demonstrated
pure semantic admission check, extend the existing internal `validateOutput`
capability to workflow calls, preserving feedback before finish. Do not introduce
that public option merely to fix whitespace. Its trial must cover every supported
dispatch/relay path; an in-memory callback alone is not a cross-worker contract.
Final authority/freshness checks still run at settlement.

**Audit reuses the current loop.** Retain rejected proposals, repair effort,
final outcome and linked execution evidence. Begin with bounded reads of existing
records; add a mechanical observation only where a demonstrated gap prevents
that read. Alex's existing periodic audit chooses no change for a transient,
legacy or low-value exception, or chooses guidance/code improvement for a useful
pattern. Samples do not commission reviews. A successful correction remains a
successful contribution, independently of its cost.

**Implementation order and compatibility:** Alex can align its schemas and
exercise ordinary interpretation now. The Host changes above are focused patches
under one shared contract, each with its own source verification. Before changing
finish admission, check direct agents, managed workflow calls, captured-finish
recovery and every consumer that treats `done` as an available domain result.
Update their behavior together; an optional field change alone is insufficient.
Keep the new inability-report behavior inactive in Apps until the compatible
Host is installed: interpretation cannot add a missing runtime capability.
This protocol rollout is separate from content/schema evolution, which needs no
retained Task, original input or report rewriting. Changes to caller schemas stay
App-owned; interpretation uses the same acceptance boundary and needs no new Host
policy branch. Keep existing useful readers, but do not require a new compatibility
adapter for every schema change.

**Decisive trials:** use the real runner/validator with synthetic model responses
for mechanics; reserve any real-model interpretation trial for a separately
authorized bounded environment or naturally due work.

| Situation | Required outcome |
| --- | --- |
| Known code path succeeds | No recovery-model call |
| Retryable operation recovers | Same operation identity; no recovery-model call or duplicate effect |
| Schema/check rejects a proposal | Exact feedback reaches the active agent; correction is accepted without repeating completed work |
| Code and agent handle equivalent contributions | Same acceptance, authority and effect checks apply to both; malformed output from either remains correctable evidence |
| Shared judgment fixtures include blank/missing/wrong-type/unknown fields | Original values pass or fail identically through the actual model tool and App reader, including relayed schemas; no implicit type repair or extra post-finish hurdle |
| Contribution satisfies its declared evidence requirements | Code and agent can complete without an additional agent-only evidence field or gratuitous tool call |
| Current code cannot interpret a legacy input | Ordinary agent interpretation can satisfy the current contract or report missing evidence; original history and accepted effects remain unchanged, with no bulk migration or new Task |
| Input rejected before admission; procedure fails before it runs | Original input/failure reaches the existing caller or operational owner; no invented destination acceptance, replacement Task or success from logging alone |
| New content schema encounters a pending older input during reload/replay | Stable envelope permits interpretation with original identity/effects intact, or rollout remains explicitly blocked; no dropped pending work or blind guard removal |
| Agent cannot produce the domain result | Honest existing blocked/error result reaches caller without fabricated output or Task convergence |
| Valid partial output accompanies blocked/failed execution | Both agent and workflow paths retain the contribution for caller judgment; unfinished obligations and cancellation/settlement fences remain intact |
| Publication succeeded before later failure | Retry reuses the publication and retains any independent unfinished obligation |
| Deadline, cancellation, denied authority or unavailable owner | Existing fences/bounds apply; unresolved work and undelivered feedback remain visible |
| Audit sees recovered exceptions | Can retain no-change disposition or reuse an existing improvement Task; no per-sample review loop |

No universal maximum number of agent judgments follows from the
legacy-input trial. Each decision remains subject to the existing attempt bound,
Task retry policy and a useful next step. Completion quality, cost per delivered
result and owner intervention decide improvement; first-format validity is only
an efficiency measure. Source tests do not prove model judgment or live savings.

### 1. Keep database contention off the serving loop

**Owner:** Host persistence and the existing owner of each operation.
**Contracts:** [Storage](../2a-design/storage.md), [Runtime](../2a-design/runtime.md).

The source candidate removes the serving helper's extra synchronous retries.
SQLite retains its existing short lock wait. Unsaved input fails to its caller;
accepted work keeps its existing recovery owner and original identity. Recovery
also yields between retained inputs, so a batch cannot accumulate short waits
into one long event-loop turn. Worker retry behavior and repeatable
schema/definition installation keep their separate budgets.

The [implementation trial](../archive/reviews/host-contention-fix-20261016.md)
records the caller audit, real two-connection failure/recovery test and full
verification result. It also states the limits: no live control-latency or
throughput comparison, no claim of a 50 ms end-to-end bound, and no token-savings
measurement. #370 is merged; rollout has not been established here.

This implements a focused part of
[responsive recovery](responsive-host-recovery-20261002.md); that proposal still
owns broader isolation and end-to-end latency work.

### 2. Account for observer facts at publication

**Owner:** Host observer adapter and Event delivery accounting.
**Contracts:** [Events](../2a-design/events.md), [Metrics](../2a-design/metrics.md).

An ordinary observer returns a fact and advances its snapshot successfully.
Without a second declaration, its unconsumed fact can later count as unhandled
work. Resource observers already use the existing observation convention.

Carry that convention through ordinary observer publication, worker relay and
recovery. A fact with no interested consumer is valid history. Once a durable
consumer is required, failure to deliver remains a failure. Use the existing
producer contract to express this distinction; Apps should not maintain a second
list of harmless event names, and metrics should not guess from names.

The source candidate saves the private `EVENT_RECORD_ONLY` intent in the Event
row, restores it on producer retry and journal recovery, and marks ordinary
observer output at its producer boundary. A storage-only receipt cannot replace
a known failed required attempt or an independent consumer's acceptance; an
uninspected observation timeout remains correctable on actual no-work inspection. App admission still
acknowledges its own inspection. Old rows default to no declaration; historical
failures are not rewritten. The [implementation trial](../archive/reviews/observer-delivery-intent-20261016.md)
records the changes, failed probes, verification and limits.

The candidate also removes the two metric-failure name exclusions whose producers
already declare record-only intent. Remaining legacy exclusions still need their
producer review. An arbitrary input or control operation must not inherit
passive-fact semantics.

**Trial:** publish unconsumed facts from two different App observers, route a
fact to actionable work, fail a required consumer, then exercise worker delivery
and restart. Harmless facts must not raise failure counts; failed required
delivery must. Duplicate fact consideration is acceptable. Explicit routes still
decide which facts become work; the fix must not create model calls by itself.

### 3. Make receipt expiry survive restart

**Owner:** Host Event receipt bookkeeping.
**Contract:** [Events](../2a-design/events.md).

The baseline used process start time to select some pending receipts. The
same unresolved Event timed out during a long run yet remained pending after
restart. Independent App admission recovery could still complete it. The source
candidate removes that process cutoff and uses the existing non-null admission
marker or pending plan to establish tracked delivery, with the saved timestamp
and TTL determining expiry. No schema field, migration or new scheduler is needed. Land the refined observer
receipt handling in #371 before rolling out expiry; together they must recover a
late uninspected observation without concealing a known required-consumer failure.
The [implementation trial](../archive/reviews/event-receipt-expiry-20261016.md)
records reproduction, source verification and compatibility limits.

Determine expiry from the saved receipt's status and durable timing information.
Prefer existing timestamps and policy; add a persisted field only if they cannot
express the obligation. A compatibility cutoff for old pre-contract observations
must be fixed and durable, rather than renewed at every startup.

Keep global acceptance, each required delivery and pending App admission as
independent facts. Preserve terminal evidence under the current retry contract.
Repairing a receipt must not replay arbitrary effectful subscribers or cancel
admission recovery. Expiry reports an unresolved boundary; it does not decide
whether the underlying assignment is still useful.

**Trial:** compare the same receipt at the same age with and without restart;
cover publication before routing, a saved admission plan, global acceptance with
App admission still pending, and legacy observations. Verify both truthful
timeout evidence and eventual admission through the existing recovery path.

### 4. Give execution recovery one mechanical meaning

**Owner:** Host Task runtime and its existing private execution adapters.
**Contracts:** [Task lifecycle](../2a-design/task-resource-engine.md),
[Runtime](../2a-design/runtime.md), [Task attempts](../2a-design/task-attempts.md).

**Rule: Host keeps records faithful to execution reality and performs supported
automatic recovery. When that fails, the responsible agent decides what to do.**
The [recovery ownership contract](../2a-design/system-boundary.md#retry-and-recovery-ownership)
owns this boundary. The internal recovery result must expose what Host established;
it must not substitute a bookkeeping result for an agent's recovery decision.

**Source finding and [candidate #376](https://github.com/hao1939/may-agent/pull/376):** startup silently skipped a `false` recovery
result; terminal-session retry could ignore it and release the old attempt.
Controller claim replacement already rejected it. The session artifact also
claimed the Task was requeued before that separate transition had happened.
The [October 17 trial](../archive/reviews/host-recovery-evidence-20261017.md)
reproduces these differences. The candidate keeps the private boolean, makes the
shared caller boundary reject unconfirmed recovery, and records only established
session facts, including a committed finish whose optional summary is absent.
Missing authoritative metadata reports its specific failure;
optional damaged history still permits otherwise safe recovery. This is source
regression evidence, not an observed live overlapping-worker incident. Review and
deployment remain separate.

The recovery operation should establish the exact retained attempt and that old
execution cannot interfere, perform the required durable transition, and leave
retained failure/effect evidence available for ordinary retry. Its caller should
have one mechanical success meaning. Backend-specific checks stay in the adapter.

Separate information by the authority it provides:

| Evidence | What recovery must do |
| --- | --- |
| Ownership, exact Task/attempt binding, live process authority | Establish or repair it using authoritative evidence; uncertainty must not authorize replacement |
| Accepted input, contributions and operation/effect identities | Preserve them through recovery and reject stale settlement |
| Optional transcript, checkpoint or derived session view | Reuse when available; incompleteness alone must not prevent otherwise safe retry |
| Uncertain external effect | Preserve uncertainty for capability reconciliation or App judgment; Task retry cannot make arbitrary effects safe |

Keep recovery on the ordinary Task retry path and use existing handoff/context
for evidence. Do not add a second lifecycle, a public recovery registry, or App
instructions to inspect Host session files. If ownership cannot be established,
record that uncertainty and the failed recovery operation accurately. After
supported automatic recovery fails, deliver the evidence to the responsible agent
through existing feedback or its declared operational route, even if the original
execution cannot resume. The agent chooses repair, another method, waiting or
escalation. Host executes the authorized choice and records the observed outcome.
The Task and accepted work stay accountable after automatic retries stop.

**Trial coverage:** startup, controller claim replacement and terminal-session
retry now share positive-confirmation behavior. Existing and extended tests cover
missing optional history, missing authority, failed drain, later confirmed cleanup
and mismatched Task references. A connected trial takes an injected unconfirmed
drain result through persisted `handler.failed`, declared App admission and a scripted
agent's accepted waiting decision. Original ownership remains intact until cleanup
is confirmed. No new result type or public recovery API was needed.

**Remaining evidence:** these tests exercise the shared session adapter and a
controlled adapter response, not a different live executor's process behavior or
model judgment. The trial injects failure of the bounded process drain; the controller's
separate dispatch retry loop still uses its existing capped backoff and is not
exhausted or redesigned here. App policy determines which failures deserve
investigation and when. A missing recipient must remain visibly undelivered;
saving an error alone does not establish a completed handoff. Preserve that
distinction when verifying adoption, and avoid exporting backend mechanics to Apps.

The accepted tradeoff is repeating affordable uncommitted work. Preserving every
execution step is optional; accepted contributions and protected effects remain
durable. This keeps recovery simple and allows Apps to change their procedure.

### 5. Measure metric-query cost before adding isolation

**Owners:** App for query meaning and query repair; Host for execution containment.
**Contract:** [Metrics](../2a-design/metrics.md).

A read-only connection protects data but a synchronous query still blocks the
serving process. Yielding between queries cannot interrupt a single slow query.
First collect current durations and plans through existing diagnostics. Optimize
a demonstrated query or justified index at its owner, then measure again.

If supported queries still violate the serving budget, reuse an existing worker
execution pattern with bounded concurrency and execution time. Keep scheduling,
metric state and breach policy at their current owners. A timeout must actually
stop or isolate the expensive work; a timer around synchronous SQL cannot do so.

**Trial:** combine a deliberately expensive query with concurrent control requests,
then test cancellation, worker failure and the next scheduled sample. Late or
failed collection is acceptable and must be reported honestly. Missing data must
not become an invented zero or a false recovery. Measure worker/connection costs
before adopting isolation; no new metric daemon is proposed.

### Defaults, compatibility and smaller follow-ups

Use one meaning for acceptance, retryability and exhaustion across mechanisms;
their numeric budgets can differ. Preserve the current Task default of three
consecutive unsuccessful attempts with 30/60-second backoff, supported explicit
unlimited policy and owner retry. Exhaustion stops automatic attempts, retaining
the obligation and failure evidence for later action. It does not abandon the
assignment. New input and an owner's new recovery decision remain distinct from
silently resetting the same failed retry series.

The stale unlimited/250 ms guidance has been corrected in
[principles](../1-principles/core-principles.md#contain-failures-keep-default-capabilities-simple)
and the [Task contract](../2a-design/task-resource-engine.md). Do not change working
retry policy to match obsolete prose or copy another retry rule into every guide.

Two narrower follow-ups merit separate evidence:

- **Backup restore:** test damaged/empty databases, WAL sidecars and concurrent
  openers. Restoring older state over an existing database belongs to explicit
  maintenance, with original files and recovery point preserved. Automatic
  bootstrap of an absent database is a separate convention. Potential loss is
  serious, but loss was not reproduced; a failing authority test raises priority.
- **Model fallback:** retain the narrow temporary adapter behavior. Document an
  intentional shipped default; add trusted configuration only for a concrete
  capability/cost requirement. No general model router is justified here.

Most changes should require no App API migration. Receipt compatibility and
private recovery-adapter updates need explicit tests. Retained Tasks, Event IDs,
operation identities and accepted results survive rollout. Refresh the reviewed
source before implementation; do not assume October 16 findings remain open.

## Verification and adoption

Use the existing boundary tests and paired App/SDK compatibility check described
by the [parent proposal](host-stability-and-app-extensibility-20261005.md#first-tranche-acceptance).
Add the missing transition tests at each affected owner; do not duplicate a
second suite or run every lifecycle test for every documentation edit.

Choose the relevant contrasting paths for each changed contract:

| Boundary under change | Contrast to exercise | What must remain true |
| --- | --- | --- |
| Delivery | Live and recovered; producer and parent worker; before commit and lost acknowledgment after commit | Same accepted identity and scope; independent unfinished receipts; required failures visible |
| Work/results | New input during execution; partial result; invalid finish followed by correction; later failure | Uncovered work remains, valid contributions survive, knowable mistakes can be corrected without a fresh attempt |
| Recovery/procedure | Startup and controller; another backend; App workflow with nested agent call | One mechanical recovery rule; optional history is optional; the next attempt still runs the declared procedure |
| Timing/cost | Contention, many historical rows, continuous new arrivals, slow child and cancellation | Bounded serving work; older pending work gets revisited; finishing/cleanup fits the owning allowance |
| Evolution | Reload, stale retained references, missing App/backend and paired SDK/App migration | Accepted work remains traceable; unsupported capability is visible; unrelated work continues |

This is a way to select tests, not a demand for a Cartesian product of all cases.
Reuse production validators and adapters. A fixture that replaces the disputed
boundary with a successful stub cannot establish that boundary's correctness.
Keep one representative Task trial combining partial work, incoming input,
independent review, failure/restart and return through saved communication context;
extend existing trials where possible instead of building another harness.

For each fix, demonstrate a second ordinary consumer using the same mechanism.
An App must be able to change its input, observation, workflow or recovery
strategy through supported declarations without a Host source edit. A genuinely
new provider protocol may need a focused adapter extension; private hooks do not
become a promise that Apps can install arbitrary execution backends.

Test removal too: a missing consumer/backend leaves affected work visible while
unrelated Tasks proceed. Avoid a special branch for an App/event name, a hidden
required artifact, or configuration without a concrete consumer.

Implement in the order above, with metric profiling and the restore trial able
to inform priority alongside the focused fixes. Each change should show the
violated promise, before/after failure trial, tradeoff and owning documentation.
Integrate implemented rules into the linked contracts and affected manual/skill;
leave this proposal holding only remaining choices.

After rollout, retain exact Host/SDK/App revisions and compare responsiveness,
pending age, failure visibility and useful recovered work under comparable load.
Monitor retry volume so shorter waits do not create a busy loop. Claim token
savings only from measured App runs. Source tests establish covered mechanics;
deployment and improved agent outcomes need their own evidence.
