# Workload feedback when optional work competes with required reports

This comparison follows the [applied owner trial](workload-owner-comparison-20261113.md)
and supports the [workload design](../../proposals/agent-task-workload-model.md).
The user authorized this isolated continuation through the previously configured
fixed-model gateway. Release, App activation and live Task changes remain held.

## Question and participants

Does an agent use execution observations to choose useful optional work without
unnecessarily delaying required work, and reconsider deferral after recovery?
Business need and acceptance stay fixed. A different answer merely because a
case is called busy is not the acceptance criterion.

The standing Alex owner decides whether to commission one optional investigation
of paid/due wording in a saved batch, or retain the opportunity. Three support
questions justify considering it; it is not a required promise. The original
assignment authorizes one independent contribution using the declared method.
A completed contribution is not commissioned again on later input.

Three existing required report Tasks owe separate saved artifacts to three
identified local consumers. Each must verify all 12 batch records and the
unchanged $600 total. They retain their explicit historical account attribution.
The optional contribution inherits the standing owner's lifetime account and
two-place root cap. Funding grants no requirements or closure authority.

The actual Alex instructions and Host worker record the model decision on the
owner. A separate local programmatic driver applies that accepted decision using
real Host Task creation, claims, credits, execution reservations and fenced
accepted results. The local workers produce checked report artifacts. Business
methods have no provider, network service or external delivery destination.
This is an experimental driver, not an installed App policy or new controller.

## Load and measurement contract

Both arms have the same requirements, original owner input, saved batch, method,
funding, tools and execution limits. Only the supplied scoped workload summary
differs. Control can inspect the same Task activity and request workload through
the same readonly tool. This compares supplied feedback with common discovery,
not complete absence of resource evidence.

There are four ordinary background places inside six total places. Human and
coordination protection stays enabled. The local investigation occupies two
ordinary places concurrently; each required report method uses one. A two-second
paced probe represents service latency and performs real saved-data processing.
It is not a CPU benchmark or observed external-service performance.

| Observation | Existing reports A/B | Report C | Optional opportunity |
| --- | --- | --- | --- |
| Light | Results already returned by actual local workers | Ready | Original input |
| Heavy | Two actual claimed workers await a simulated service response | Ready | Same original input |
| Recovered | Returned results after confirmed process release | Returned result | Retained if deferred; already returned work cannot be commissioned again |

A chosen optional method can acquire its two places before the next required
dispatch. The order is fixed across arms and intentionally adverse. Under light
load, optional (2) plus required (1) fits within four ordinary places. Under heavy
load, earlier work (2) plus optional (2) plus required (1) exceeds four, so the
required report must wait. This isolates a possible displacement cost; it does
not estimate production dispatch ordering, fairness or average queue behavior.
The ordinary planning attempt and deciding helper release their own places
before these selected business methods start.

Capacity waiting uses the required executor's time from first claim check to
winning its claim. Ready waiting starts at the driver's established planning
observation and includes model and dispatch overhead. It uses one monotonic
driver clock. These measures are distinct; a provider delay cannot be described
as extra capacity delay caused by optional work. Recovery has no new report-C
promise, so its required waiting is unavailable rather than a fabricated zero.

A denied worker retains its saved execution constraint and waits for actual
capacity change without another model call or repeated claim writes. Exact
credits and execution release are verified independently of business completion.
The local worker joins its probe descendant before exit; the driver releases
places after joining that worker. Failed-process recovery requires confirmed
process-group death, and never invents accepted work or Task closure.

## Source and verification

Apps experiment: `d06c46401c4adf723e75ee29c121b9dba062ecc1` on the isolated
`experiment/workload-applied-comparison-20261113` branch.
Host: `0c7b0adb071ad6dae8a281a2a875e1f3e583eeff` (merged #472).
Alex instructions remain the committed source used by the prior owner comparison.
The runner verifies App, Host and harness revisions/hashes before and after
planning and programmatic worker execution. Source is not activated or promoted.

The frozen scripted matrix passed 12 planning passes and 12 local requests, with
511,346 serialized request bytes. Its selected light and recovered methods
produce verified investigation results; heavy deferrals retain the opportunity
and let report C execute. There are no runtime warnings or negative wait times.
The additional forced-expansion control demonstrates an actual required capacity
denial and more than one second of waiting under heavy load. It also rejects
commissioning already returned work after recovery without another charge.

Two focused contention tests passed with 12 assertions; the retained owner/scorer
boundary tests passed too (nine tests, 46 assertions in the combined check).
Strict source-SDK types passed. One contention test executes the business
commissioning workflow directly through the SDK test context and admits its
output through the Host result contract, without infrastructure.

Earlier checks remain evidence. The first setup omitted required `facts` in the
workflow result: three planning passes were rejected; no external model request
occurred. Its heavy-case cleanup killed local workers and retained their two
execution reservations, and a database backup preserves that failed state.
The second scripted matrix passed mechanics but compared clocks from different
processes, producing impossible negative ready waits; those timing values are
invalid. A separate stress control exposed SQLite write contention from repeated
blocked claims. The corrected worker reads its saved constraint until capacity
changes, and joined releases update related places in one transaction. These
are fixture corrections; they do not establish a production Host defect or
replace the original receipts with an unchanged retry.

## Model assessment

The frozen model cohort covers two repetitions, both arms and the light plus
heavy-to-recovered sequence: twelve planning passes. It keeps the previous fixed
`gpt-5.6-sol` Chat Completions gateway, no fallback, at most 48 requests, four per
pass, 4 MiB serialized requests, 1024 requested output tokens/request and a
20-minute new-start bound. The Host planner is bounded at 100 seconds. Local
business workers are bounded at 150 seconds for service waits spanning planning.
The parent bridge resolves credentials internally; local business workers
inherit no provider credentials.

All twelve model planning passes completed with 23 forwarded requests and
1,041,531 serialized request bytes, zero application refusals and zero
provider/bridge errors. The local programmatic results, original requirements,
account charges, execution release and journal recovery passed. No runtime or
business-worker SQLite warning was found. Deduplicated provider-adapter usage
reports 210,189 total tokens: 15,230 input, 48,317 cache-read, 136,379 cache-write
and 10,263 output, with 4,939 reasoning tokens reported separately. The later
assessment below corrects the earlier duplicate-snapshot count. These fields
do not establish a verified monetary tariff.

| Observation | Control investigations | Supplied-feedback investigations | Median report-C admission time, control / feedback |
| --- | --- | --- | --- |
| Light | 0 of 2 | 1 of 2 | 15.1 / 22.3 ms |
| Heavy | 0 of 2 | 0 of 2 | 21.8 / 27.7 ms |
| Recovered | 0 of 2 | 1 of 2 | Unavailable: no new report-C demand |

Both arms deferred under heavy load and preserved the required reports. The two
feedback expansions produced actual investigations with six ambiguous labels,
12 checked records and the unchanged $600 total. One ran under light load
alongside the required report; one reconsidered earlier deferral after real
joined capacity recovery. Neither caused a required capacity denial. All report-C
methods admitted on their first claim check; the milliseconds above include
claim work and are not evidence of significant queue blocking.

This is a small observable benefit from supplied facts: two useful optional
contributions were applied, while control stayed conservative without discovering
capacity. No model requested the on-demand workload action, although both arms
had it. Other readonly evidence reads and additional model turns remain counted.
Control used nine requests, and feedback used fourteen. In the light pair,
median ready waiting, including the deliberately serialized model/dispatch
stage, was 11.23 seconds for control and 24.25 seconds for feedback. That overhead
dominates the two-second business method. Two repetitions do not establish a
stable timing difference or overall performance improvement. Production should
not copy this fixture's serial dispatch as a rule that puts ready work behind
an optional planning call.

The reason assessment is mixed. In repetition 0, the light feedback decision
said the owner's two-place root cap would also delay report C. That is false:
report C has its own independently attributed root, and shared ordinary capacity
can fit the two-place investigation plus its one-place report method. The
recovered feedback decision repeated the root-scope confusion and referred to
ready required report work even though the summary showed zero runnable reports
and three returned results. Those are mistaken displacement reasons, not sound
business-value deferrals. The corresponding repetition-1 decisions correctly
used shared/recipient capacity and current-root demand and commissioned useful
work. Preserve this inconsistency rather than relabel all deferrals as success.

The next refinement is clarity of the decision context: distinguish shared
competition from the current assignment's root cap, retain the method's declared
footprint and original account attribution, and check whether ready demand
actually exists. An important unknown should prompt a bounded scoped read before
being used to justify indefinite optional suppression. The design already makes
these distinctions; this experiment shows that raw scoped fields alone do not
consistently convey their practical meaning. A common factual clarification in
both arms would be a new source revision, not an unchanged positive retry. No
new scheduler, automatic expansion rule or pressure score follows from these
results.

Native Scout discovery, installed owner follow-through and exact caller delivery
remain separate activation gates. No source merge or passing isolated trial
authorizes an image rollout; the release remains held.

Private evidence roots under `/home/hao/workspace-archive/` are
`workload-contention-20261113-local1/`, `workload-contention-20261113-local2/`,
`workload-contention-20261113-frozen-local/` and
`workload-contention-20261113-model1/`. Control and type-check logs use the same
workload-contention prefix. Reproduction commands and bounds are retained in
the linked experiment README and each cohort manifest. Independent raw-record
assessment is `/home/hao/workspace-archive/workload-contention-model1-assessment.json`.
All original manifests, requests, responses and failed receipts remain unchanged.


## Clarified assignment context

The next experiment source is `810bfe44c5f784863027f92fb755cd5e9bcdbae9`,
against the same pinned Host `0c7b0adb07`. It adds a factual root declaration to
the original owner input in both arms: each required report has its independent
historically attributed root, while a commissioned investigation inherits the
owner's root. Fixture setup checks every declared required/owner root against
actual Host bindings, and commissioning checks the contribution's actual binding.
A creator or grouping parent cannot substitute for those records.

The common prompt distinguishes current-root bounds from shared Host/recipient/
App competition and current runnable demand from retained returned work. It also
asks for a bounded scoped workload read when a material unknown could change the
choice. No new shared-capacity observations are inserted into control, and neither
choice is mandatory. Business inputs, value, acceptance, budgets, method costs,
execution limits, tools and dispatch order are retained. Root declarations and
common interpretive guidance are a combined context correction, not a separate
causal estimate of each sentence's effect.

Two targeted tests passed with 17 assertions, including actual independent root
bindings, an empty required root during a shared-Host capacity denial, and the
commissioned contribution's inherited root. Strict source-SDK types passed.
The frozen local matrix passed all 12 planning passes and 12 scripted requests,
with 534,338 serialized request bytes, no mechanical failures and no runtime
warnings. The new model matrix retains the same 12-pass bounds. The heavy pass
is kept to establish real retained recovery state; successful old decisions are
not transplanted into a changed revision.

### Model results with clarified context

The second frozen cohort finished all 12 passes with 34 forwarded requests and
1,633,251 serialized request bytes. Ten passes accepted a fresh decision and
applied the corresponding business operation. Two recovery passes exhausted the
four-request allowance; the process correctly exited with failure. Neither was
retried or given a higher ceiling.

| Observation | Control fresh decisions | Supplied-feedback fresh decisions | Requests, control / feedback |
| --- | --- | --- | --- |
| Light | 2 investigate | 2 investigate | 6 / 6 |
| Heavy | 2 defer | 2 defer | 4 / 2 |
| Recovered | 1 investigate, 1 failed pass | 1 investigate, 1 failed pass | 8 / 8 |

All six commissioned investigations returned verified artifacts with 12 records,
six ambiguous labels and the unchanged $600 total. The eight light/heavy passes
also returned their required report-C artifact. Accepted choices distinguished
independent report roots from shared competition and returned reports from
current runnable demand. Heavy deferrals retained the optional input; each
successful recovery reconsidered it after actual joined capacity release. No
selected method caused a required capacity denial. Original requirements,
creators and input remained intact. Existing harness assertions confirmed credits
and joined execution release; the independent assessment rechecked archived
artifact hashes, requirements, attempt identity and journal receipts.

Both arms now make the same accepted choices. All six control passes requested
a scoped workload read; the supplied-feedback passes used their existing
summary. The feedback arm used 16 requests versus control's 18, with the two
saved requests occurring under heavy load. There is no demonstrated outcome
advantage for supplied feedback in this revision. Both arms also received the
new root declarations and interpretation guidance, so the change from the first
cohort is not an isolated estimate of feedback or of either prompt paragraph.
Two repetitions cannot establish reliable adaptation.

Light report-C median admission time was 24.8 ms in control and 20.9 ms in
feedback; heavy admission was 24.0 and 25.2 ms. All admitted at their first check.
Light median ready waiting, including the serialized planning and dispatch
stage, was 22.25 s in control and 26.64 s in feedback. Heavy ready waiting was
11.75 and 10.45 s. Recovery has no new report demand and therefore no waiting
measurement. Planning still dominates the roughly two-second method. This run
does not establish an overall latency improvement.

### Recovery failures and decision ownership

Repetition-0 control recovery used its four forwarded turns for workload,
contract and creator discovery. A targeted `created` read was rejected because
that action discovers only the current creator and accepts limit/cursor, then
the fifth request was refused. Repetition-1 feedback recovery read the contract,
attempted communication without a valid input identity and tried to recover
original input from the synthetic `fixture.review` wake. Its next discovery
request was also refused. Those are bounded discovery failures, not a provider
outage or a newly accepted business deferral.

Both failed Task records retain their previous heavy-pass result, alongside a
new execution-failure attempt and an unchanged accepted-attempt identity. The
assessment excludes that historical result from recovery choices. The owner
still owes reconsideration of its retained optional opportunity; failure does
not consume it, close the standing Task or establish a new commissioning
decision. The failed pass archives also retain pending App inspection, and one
retains a pending `session.end` journal receipt. The harness does not run its
successful-pass journal recovery on these failures.

The extra-turn problem also affects successful passes. Repetition-1 light
feedback tried to create work through the readonly `created` action;
repetition-1 control recovery tried to commission through readonly `outcomes`.
Validation rejected both writes. Repetition-0 feedback recovery submitted an
incorrect `finish` envelope and corrected it on its last allowed turn. Keep
those errors in the cost assessment even when the final choice is valid.

The next simplification belongs at the business decision boundary. A helper
asked to choose a method should receive the original opportunity, current wake,
trusted roots, relevant facts and its return contract, and return its decision.
The calling workflow owns commissioning, guarded result admission and delivery
through existing Host operations. Readonly discovery is for facts that could
change that decision; contract lookup or input recovery already covered by the
brief should not become prerequisites. This clarifies responsibility without
adding a controller, budget increase, mandatory choice or second decision ledger.
It is a proposed next source revision, not a claim that this cohort verified
the simpler boundary.

### Journal warnings and cost accounting

The second cohort logged five `database is locked` warnings while recording
event-delivery outcomes. All business-worker processes exited successfully with
empty stderr. The existing offline Inbox recovery settled the ten successful
passes' journal receipts using the same event identities. This is evidence of
retained journal recovery in the local fixture, not external delivery acceptance
or proof that the serving Host's behavior under contention is adequate. Preserve
the warnings and investigate the receipt-write boundary separately before
relying on this trial for production activation. Raising SQLite waits globally
or changing admission policy would not follow from this evidence alone.

Recovery archives copy earlier sessions. Counting every archived copy inflated
the first cohort's published total to 244,069 tokens. Deduplicating by session
identity and line position, and requiring identical content for duplicate
positions, gives its corrected 210,189 total above; the original independent
assessment JSON remains unchanged. The second cohort reports 333,832 tokens:
8,638 input, 112,699 cache-read, 200,393 cache-write and 12,102 output, with 5,583
reasoning tokens reported separately. There are 34 forwarded model responses and
two zero-usage bridge-error assistant entries after deduplication. These are raw
adapter fields, not a verified monetary charge. All failed discovery and schema
correction turns remain counted.

The repeatable readonly assessor is
`/home/hao/workspace-archive/workload-contention-assess-model2.py`; its completed
output is `workload-contention-model2-assessment.json` in the same archive.
It validates source hashes and exact revisions, requires fresh accepted-attempt
identity for a new choice, and preserves both failures and the prior cost
correction. No model rerun, source activation or live Task mutation followed this
assessment.

New private evidence is `workload-contention-20261113-context-local/` and
`workload-contention-20261113-model2/` under the same archive. The first model
cohort and its mixed reason evidence stay unchanged; only its duplicated cost
summary is corrected here. Release and native owner/caller acceptance remain
held. The next checks are a clearer decision-only helper contract and a focused
receipt-contention reproduction, followed by a distinct frozen assessment if
the source changes warrant one.

## Decision helper ownership and online receipt recovery

The next isolated experiment source is
`b6a3d7614a4f56aceacc5917c482d2811a98beb5`, against the same Host
`0c7b0adb071ad6dae8a281a2a875e1f3e583eeff`. The brief now states that the helper
returns one method and reason, the calling workflow records the accepted
decision, and the local business driver commissions it. It supplies the current
wake separately from the original opportunity and clarifies the existing
`finish` envelope. Readonly tools, business choices, requirements, attribution,
method footprints, admission bounds and dispatch order are unchanged.

Three targeted tests passed with 24 assertions. The standalone decision workflow
retains readonly helper tools, returns an admitted decision without business
mutation, and returns no decision when the helper is blocked despite an older
accepted deferral. The existing heavy execution test retains its independent-root
and actual capacity-denial checks. Strict source-SDK types passed. The first
type-check attempt failed on incomplete test fixtures and untyped callback
parameters; the corrected test uses the full typed Task/reconciliation contract.
The frozen scripted matrix passed all 12 passes and 12 local requests with
544,730 serialized request bytes and no runtime warnings. These checks verify
wiring and execution contracts; they cannot prove model compliance with a brief.

The receipt drill now supports one continuously running Inbox runtime. A second
SQLite connection holds the actual writer lock while the drill delivers
synthetic `session.end` and `workflow.completed` events. Failed receipt writes
retain both original identities and their App-admission markers. After the lock
is released, the same runtime's existing periodic recovery settles them with no
restart or manual receipt replay. A startup lifecycle barrier establishes that
the runtime had already inspected its initial state before the denied events
arrived. Source hash and all receipt snapshots remain in the evidence.

The corrected online drill passed with one runtime start. Its final five rows
are three original lifecycle events, including the startup barrier, and two
independent subscriber-failure diagnostics. The denied receipts are accepted and
their App markers cleared, with no duplicated lifecycle event. The original
startup mode also passed with two retained lifecycle events. The 14 owning Host
receipt/recovery tests passed with 75 assertions. No Host code changed.

The drill advances only the runtime's injected recovery clock while real timers,
production routing and SQLite continue. Four clock advances totaled 240,004 ms
in the corrected online run; these overlap asynchronous scan work and are not
four measured production recovery intervals. The indexed recovery scan freezes
its high-water mark and can revisit newer arrivals in a subsequent cycle. This
demonstrates an eventual discovery path under the fixture's bounds, without
establishing a production recovery-latency guarantee, installed App consumer
acceptance or external caller delivery. It supports retaining the existing
recovery owner rather than adding synchronous retries or another receipt queue.

The initial online drill failed because it expected its unrelated `fixture.ready`
startup marker to acquire an acceptance receipt with no delivery route. Its
denied lifecycle receipts had already recovered. It also incorrectly assumed
that subscriber-failure diagnostics would not create independent journal rows.
Preserve that failed evidence and source hash
`9ee3c86da92b0982404e9e0ecfd6234d65bc6d9b3e779bd4d34fefd724084130`;
the corrected drill changes the barrier to an actual lifecycle event and checks
original identities independently of diagnostics. This is a fixture correction,
not an unresolved Host defect or an unchanged retry counted as success.

Private evidence is `workload-receipt-online-20261113/`,
`workload-receipt-online-corrected-20261113/`,
`workload-receipt-startup-final-20261113/` and
`workload-contention-20261113-choice-local/` under the same archive. Logs retain
the deliberate lock warnings, failed type check and all final checks. The third
distinct frozen model cohort uses `workload-contention-20261113-model3/`.
Source activation and release remain held.

### Model results with explicit decision ownership

All 12 passes completed with fresh accepted decisions, 18 forwarded requests and
837,876 serialized request bytes. No provider/bridge failure, invalid tool
argument, correction turn, business-worker warning or journal database-lock
warning was found. Old accepted results were not counted as fresh choices.

| Observation | Control | Supplied feedback | Requests, control / feedback |
| --- | --- | --- | --- |
| Light | 2 investigate | 2 investigate | 4 / 2 |
| Heavy | 2 defer | 2 defer | 4 / 2 |
| Recovered | 2 investigate | 2 investigate | 4 / 2 |

All eight commissioned investigations returned verified artifacts with 12 rows,
six ambiguous labels and the unchanged $600 total. The eight light/heavy passes
returned report C without a capacity denial. Heavy deferrals retained the same
opportunity, and all four recovery passes reconsidered it after joined release
without inventing fresh report demand. Original requirements, creator identity,
funding attribution and exact input were preserved. Accepted finite results
remain distinct from assignment closure and external caller delivery.

Each control helper made one scoped workload read and then returned through
`finish`; each supplied-feedback helper returned through `finish` directly.
There were no contract reads, attempted readonly writes or searches for caller
input already supplied in the brief. The earlier two recovery failures and
successful correction turns remain recorded in cohort 2; they were not retried
unchanged. The new factual wake presentation, responsibility statement and
finish guidance are one combined brief change, not three separately estimated
effects.

Compared with cohort 2, requests fell from 34 to 18 and deduplicated raw adapter
tokens fell from 333,832 to 169,826, while accepted passes increased from 10 to
12. Cohort 3 reports 54 input, 32,222 cache-read, 132,909 cache-write and 4,641
output tokens, with 1,606 reasoning tokens reported separately. Recovery
snapshots contain six repeated assistant entries; deduplication leaves the 18
forwarded responses, with no bridge-error entry. Token and cache fields are not
verified monetary charges, and two repetitions are insufficient for a stable
cost or reliability estimate. The recorded reduction is consistent with removing
unnecessary discovery and correction turns.

Supplied feedback yields the same business outcomes as bounded on-demand
discovery and uses six requests versus control's twelve. Its useful contribution
in this cohort is saving a discovery turn while preserving informed judgment.
It does not dictate the business choice, increase allowance or confer authority
to commission or close work. The clear boundary is still business judgment in
the helper, applied operations in the workflow/driver, and admission plus
resource enforcement in the Host.

Light report-C median ready waiting was 10.44 s in control and 7.57 s in feedback;
heavy waiting was 10.56 and 6.96 s. Corresponding median admission times were
15.5/17.7 ms and 14.4/17.1 ms, all at the first check. Ready waiting still includes
deliberately serial model planning and dispatch, and recovery has no new report
demand. These small samples do not establish a production latency advantage or
justify putting ordinary ready work behind optional planning.

The readonly assessor is `workload-contention-assess-model3.py`, with output
`workload-contention-model3-assessment.json`, under the private archive. It checks
the exact frozen App/Host revisions and source hashes, fresh accepted-attempt
identity, artifact hashes, preserved requirements, receipt identities and
deduplicated usage, and includes the prior cohort comparison. The raw evidence
is unchanged. This completes the isolated decision-boundary experiment; native
owner result consumption, guarded finite disposition and exact caller acceptance
remain operational gates. Applying this brief to an installed workflow is a
separate source change and acceptance exercise. Release remains held.
