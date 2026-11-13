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
business-worker SQLite warning was found. Raw provider-adapter usage reports
244,069 total tokens: 15,242 input, 48,317 cache-read, 168,267 cache-write and
12,243 output, with 5,710 reasoning tokens reported separately. These fields
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
