# Strengthen Host contracts while keeping Apps free to evolve

**Status:** Direction accepted, implementation in progress, 2026-10-16.
Principles and contract refinements are integrated into their owning documents.
Database contention is fixed in merged [Host PR #370](https://github.com/hao1939/may-agent/pull/370).
The observer-accounting change is published in [Host PR #371](https://github.com/hao1939/may-agent/pull/371); local CI and GitHub checks passed, and review remains pending. Later steps remain open.
No deployment is established by this document.

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
and [safe retry](../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions).
Repair existing owners and remove duplicated bookkeeping. Accept delayed
projections and occasional repeated consideration; protect accepted work,
ownership and external effects. Extra machinery must earn its cost.

## Direction and value

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
| Bound total work and preserve a path to finish | Keep controls responsive and retain useful partial results | [Review rule](../1-principles/core-principles.md#review-rule), [Storage](../2a-design/storage.md), [Task lifecycle](../2a-design/task-resource-engine.md#one-lifecycle-baseline) |
| Preserve the same contract across alternate paths | Worker relay, restart and reload keep accepted work and meaning intact | [Review rule](../1-principles/core-principles.md#review-rule), [Design authoring](../2b-manual/design-authoring/SKILL.md) |

## Contract coverage

**Agents decide what to do; Host executes and keeps the durable account.** The
labels below organize review; they are not new APIs, stored states or registries.

| Contract | Host must provide | App/agent remains free to choose | Existing owner and status |
| --- | --- | --- | --- |
| C1 — Work and usable context | Retain exact admitted input, covered contributions and independent Conditions; expose current scope, pending work and readable evidence with honest missing/truncated states | Interpret intent, gather domain context, accept scoped results, continue or wait | [Task attempts](../2a-design/task-attempts.md); recent context/partial-result fixes to preserve and verify across supported workers |
| C2 — Facts and attention | Distinguish retained observation, required delivery and eligibility to execute; preserve separate progress/failure facts and the caller's declared interest | Choose relevant facts, immediate or deferred progress, explicit help requests and investigation policy | [Execution feedback](../2a-design/execution-feedback.md), [Events](../2a-design/events.md); #351 established attention separation, ordinary-observer accounting is verified in #371, awaiting review |
| C3 — Acceptance and replay | Let each operation owner record its own acceptance; recover unfinished delivery using saved identity, scope and timing; do not substitute a global receipt for pending App admission | Reuse results, revise authorized work or choose a different recovery operation | [Events](../2a-design/events.md), [Storage](../2a-design/storage.md); retain #336/#364/#366/#367 and correct restart-dependent expiry |
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
Preserve already-fixed behavior and make separate runtime changes in this order:

| Step | Change and contract | Value / evidence |
| --- | --- | --- |
| 1 | Bound serving-path SQL waits; preserve operation-owned retry (C3/C5) | Merged #370; source verification complete, rollout not established |
| 2 | Apply observation semantics through ordinary producers and relays (C2/C6) | PR #371 retains original intent and independent receipts; local/GitHub checks passed, awaiting review |
| 3 | Expire delivery receipts from durable status/timing (C3) | Restart must not hide overdue delivery; permanent loss was not demonstrated |
| 4 | Trial one private recovery success meaning across callers/backends (C4/C6) | Consistent safe retry without adding optional-artifact gates |
| 5 | Profile metric queries; optimize or contain demonstrated cost (C5) | Synthetic blocking shown; installed query impact remains unmeasured |

The [original evidence](../archive/reviews/host-contract-review-20261016.md)
pins the tests and probes. The [commit review](../archive/reviews/host-two-week-design-review-20261016.md)
adds source-history reasoning, not new runtime measurements. The details below
specify the intended corrections and their trials.

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
a failed delivery or an independent consumer's acceptance. App admission still
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

Current expiry uses process start time to select some pending receipts. The
same unresolved Event can time out during a long run yet remain pending after
restart. Independent App admission recovery may still complete it.

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

**Proposed rule: Host restores the ability to execute the same durable Task;
the App chooses useful recovery work.**

The current private recovery boolean describes reconciliation of a session
projection. Some callers also use it as permission to release old ownership.
Those meanings need a defined relationship. Merged #363 improved claim handling;
startup now also requires a positive result after #368. Terminal-session retry
still treats the result differently. Failed process drain and known
unsafe ownership already throw. This is not evidence of a demonstrated overlapping
worker incident, and adding a blanket `false` gate could strand recoverable work.

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
retain a specific failure reason and use the existing bounded retry/attention
path. The Task stays accountable after automatic retries stop.

**Trial before settling the internal API:** exercise startup, controller claim
replacement and terminal-session retry with missing optional history, missing
authority, failed drain, confirmed cleanup and mismatched Task references. Run
the same contract with another supported backend whose artifacts differ. A test
adapter can first isolate semantics, but does not prove real-backend integration.
Safe recovery must enable progress; unestablished ownership must not release it.
Choose the smallest internal return/error shape that passes these cases, then
update every caller together. Do not export backend mechanics to Apps.

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
