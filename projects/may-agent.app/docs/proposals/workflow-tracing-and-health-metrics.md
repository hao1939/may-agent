# Workflow tracing by default and useful health metrics

**Design status:** Draft for review, September 11, 2026.
**Implementation status:** First bounded source slice in Host #143, at
`1526e063`, is under review. It implements the evidence foundation and basic
outcome observations, not the complete proposal or deployed behavior. The
[candidate section](#first-implementation-candidate) states what remains.

## The idea

Every workflow run should be understandable on its own. When it fails, open
that run to see what it tried, what completed, where it failed, and the related
debugging evidence. That information belongs with the run, not in a separate
incident system.

Metrics summarize those same records to reveal health and recurring problems.
Host observations supply facts that workflows cannot, such as disk headroom
or available worker capacity.

```text
Core: execution + authoritative state
  -> retained run facts and linked evidence -> supported reads
                                                 |
                         Replaceable capabilities read these facts
                            |                    |
                       Run inspection       Metrics + Host observations
                                                 |
                                            Health views
                                                 |
                                    Human / App investigation
```

The runner records, metric code calculates, and interfaces present. Humans and
Apps investigate and decide what to do. These are ordinary modules using
existing capabilities, not new services. **Default capability does not mean
core responsibility.** Execution must remain correct and its retained evidence
readable without metric collection, dashboards or an investigator installed.

### Apply our philosophy

The [philosophy](../1-principles/design-philosophy.md) asks what useful outcome
we gain and whether it is worth the total cost. Here, enough means a person or
App can understand a failed run, choose a worthwhile response, and check whether
later comparable work succeeds with less waste. A perfect trace or a green
dashboard is not the goal.

- Reuse execution evidence; do not add a second error store or work lifecycle.
- Keep **balanced measurement, with failure-focused investigation**. Successful
  outcomes establish the baseline; failures and expensive recovery guide where
  to look next. An absence of errors does not prove useful work happened.
- Keep predictable recording in code and uncertain diagnosis with humans/Apps.
  Neither collection nor viewing requires a model call.
- Start with the smallest useful view. Pay for more detail or automation only
  when it helps a real investigation enough to justify its ongoing cost.

This is the narrower continuation of the
[archived error-handling discussion](../archive/reviews/error-handling-and-conversation-discussion-20260910.md).
It does not require the earlier core collector or an `onError` subscriber
before failure evidence becomes available. App consolidation and automatic
investigation remain outside this proposal.

## Expected experience

For a workflow that prepares and uploads a report:

1. The run shows its purpose, source identity, input summary and current state.
2. Preparation succeeds; its output remains linked to that step.
3. Upload fails; the run retains the original error and useful diagnostics.
4. Opening the run explains that sequence without searching unrelated logs.
5. A local retry that succeeds leaves the run successful, while retaining the
   failed operation and its cost. A later run is a separate execution and does
   not erase an earlier run's failure.
6. The overview shows successful and unsuccessful executions, work still in
   progress, and recovery cost. Selecting a measurement opens matching records
   with the same filters and time window.

Recording history and calculating these measurements require no LLM calls.
An agent can inspect the evidence later when investigation needs judgment.

## 1. Keep evidence with the workflow run

A workflow definition describes reusable code; a run records one execution.
The enclosing Task, when present, still owns the desired outcome. Tracing adds
no new Task state, retry controller or completion authority; see the
[workflow contract](../2a-design/workflows.md).

“With the run” means linked and retrievable by its identity, not copying every
session, log and artifact into a large JSON file. Reuse existing run, session,
Task-attempt and artifact records.

| Evidence | What to retain by default |
| --- | --- |
| Identity and purpose | Run ID, App/agent-scoped workflow identity and captured source identity; exact parent and Task/attempt links when present |
| Input | Safe summary and permitted structured input or artifact reference; show omissions |
| Progress | Runtime-managed steps and child executions, relationships, start/end times and outcomes |
| Result | Execution outcome, summary, partial outputs and artifact references |
| Failure | Original observed error, failing boundary, bounded diagnostics and linked child evidence |
| Cost | Measured duration and available usage; unavailable cost stays unknown |
| Evidence quality | Missing, truncated, redacted, expired or incomplete information |

### Automatic baseline, small author additions

Trace the execution the Host already manages: workflow start/end, agent calls
and nested workflows. Authors should not catch every exception, maintain
execution counters or add tracing boilerplate to every workflow.

Ordinary TypeScript helpers are not automatically visible as meaningful steps.
For a helper such as “upload report,” first use scoped logging and artifacts.
If those cannot expose a useful boundary, add one small named-step wrapper to
the existing context. It records execution only: no retries, caching,
checkpoints or scheduling. Its exact API remains an implementation choice.

Optional annotations explain domain facts, such as the selected provider or
records processed. They cannot overwrite Host-recorded identity, status or
timing. Repeated invocations have distinct evidence; concurrent steps use
explicit relationships and timestamps rather than an invented serial order.

### Failure, retry and restart

Record evidence as execution proceeds, not only in a final hook. A crash can
leave the last detail incomplete. Existing Host recovery settles execution
state; the trace exposes retained facts and gaps without inventing a successful
step, its end time or the cause of the crash.

Preserve distinctions between an exception, blocked work and interruption.
Cancellation remains identifiable in the reason where the current vocabulary
represents it as interruption. A successful negative finding is a domain result,
not an execution error. Workflow completion is not Task acceptance.

Keep local step retries within their run, with each invocation distinguishable.
A later workflow execution has a new run ID and exact links to related attempts
where known. Nested runs are children, not retries. Do not infer relationships
by matching workflow names or error text.

Final run outcomes and encountered operation failures answer different questions.
A successful run can contain failed operations; an error repeated in its child,
parent summary and log is not three independent incidents. Use recorded execution
relationships where they establish the origin. Otherwise show affected runs and
the attribution limit, not an invented unique-incident count or root cause.

Required execution persistence and optional debug detail are different. Failure
to store accepted state remains a runtime failure. A broken debug attachment
or metric sample must not mask the original error, change an accepted result,
or stop unrelated work. Show observation failure through the remaining
diagnostic path without recursive logging or retry storms. Complete evidence
cannot be guaranteed when all storage is unavailable.

## 2. Calculate metrics from recorded facts

Reuse the existing [metric capability](../2a-design/metrics.md), source
measurement and history. Workflows should not maintain parallel success/failure
counters. Events may prompt refresh, but counts come from records, not the
number of event deliveries.

Each definition states, in plain language:

- its stable ID, name, owner and question;
- source, scope, calculation, unit and window;
- included/excluded outcomes and denominator, when relevant;
- expected cadence, freshness and coverage limits;
- how to inspect supporting records; and
- an optional warning rule and the evidence worth investigating.

Use existing fields and documentation first. Extend the supplied capability
only when a real consumer needs a missing field. Apps do not gain raw storage
access or a new general query API through this proposal.

### Useful initial health questions

| Question | Measurements | Source |
| --- | --- | --- |
| Is execution reliable? | Successful runs and their share; error, blocked and interrupted counts/shares alongside total activity | Workflow runs |
| Is recovery hiding trouble? | Repeated attempts and measured retry cost, where exact relationships exist | Runs, Task attempts and step evidence |
| Is work useful? | App-accepted outcomes and available verification evidence; do not infer quality from run completion | App-owned Task/results and acceptance evidence |
| Is work moving? | Pending/running/waiting counts; oldest eligible work not started | Current Task and scheduling state |
| Is execution slow? | Run duration; queue delay where eligibility/enqueue timing exists | Execution and scheduling timestamps |
| Can the Host work? | Worker capacity, disk headroom and last health observation | Direct Host observations |
| Can we trust the overview? | Last successful sample, collection errors and coverage limits | Measurement status and retained source range |

Ship only measurements whose source and meaning have been verified. Dependency
waits and intentional pauses are not automatically scheduling faults. Domain
quality belongs with the App that can verify it; workflow activity does not
prove useful outcomes.

### Example: finished workflow outcomes

For a selected App/agent/workflow, take runs that finished in the selected window.
Show the total and the `done`, `error`, `blocked` and `interrupted` counts, each
as a share of that same total. Ten finished runs with six done, two errors, one
blocked and one interrupted mean 60% successful execution and 20% execution
errors, with the remaining outcomes visible. Success is not `1 - error rate`.
An intentional cancellation is still distinguishable; it is not relabeled as
an error just because it is outside `done`.

If one of those six successful runs needed an upload retry, it stays among the
six. Its failed upload remains in the operation evidence and recovery summary,
not as another failed workflow run. Running work is shown separately from this
finished cohort. With no eligible runs, show “no finished executions” and no
percentage; missing outcome/timing evidence is a coverage gap, not zero failures.

The top-level overview counts top-level runs. A per-workflow view can include
that workflow's nested invocations. A failed parent and its failed child are
not two independently failed Tasks. The drill-down carries the same scope,
outcome filters and window as the calculation.

Changing a metric's meaning requires a new ID or an explicit cutover, not
silently mixing history. Keep workflow-run rates distinct from Task success
rates and retain failures after eventual success.

### Honest summaries

Do not count duplicate observations twice or sum overlapping rolling-window
samples as new occurrences. Duration is wall-clock time, not CPU or monetary
cost. Parent duration overlaps child duration; usage should count underlying
calls once, not both parent totals and child totals. Reused results are not
new execution. Missing cost, timestamps or source coverage remain unknown.

Host observations complement traces; do not manufacture workflows for them.
A Host cannot prove its own availability while down. A remote reader can show
its last observation is stale; an independent uptime probe is optional later
work, not something an internal heartbeat alone provides.

## 3. Present health with a path back to evidence

Start with existing metric and execution views: an overview and a per-workflow
breakdown of activity, outcome distribution, duration and available cost. Show
window/sample count, trend where available, last measurement and evidence link.
These balanced views remain useful even when nothing is failing. Opening a run
shows its history and linked artifacts; expired detail is explicit.

The UI reads shared calculations; it does not implement a second metric formula.
Run links can reuse the existing trace view without requiring a graph redesign.
No single opaque score claims the whole system is healthy.

### Give failures a useful investigation path

Use filters and groupings over the same evidence, not a separate incident store.
Start with work that cannot progress, recurring failures, expensive recovery,
or errors first observed after a change. These are investigation prompts, not
a new automatic ranking or response engine. Rare consequential failures can
matter more than frequent harmless ones; intentional waits are not faults.

Group by recorded App/agent/workflow identity, operation and stable error code when
available. Keep representative run links, observed counts, affected work and
available cost beside each group. If a stable code is absent, show the original
bounded error and leave the cause unknown. Similar wording or timing alone does
not establish a shared root cause or prove which change introduced it.

Keep successful examples and total executions available for comparison. The
question is not just “what failed?” but “under which conditions does this fail,
what does recovery cost, and does it stop the intended result?” Do not turn an
expected negative check into an execution error. App verification explains
whether a normally completed run actually produced useful work.

An alert means “inspect this evidence,” not permission to retry, fix or deploy.
Existing App routes may react when useful; a new investigation Task is not
required for recording or viewing failures.

## Core and replaceable component boundary

Follow the existing [architecture](../2a-design/architecture.md) and
[Host/App boundary](../2a-design/system-boundary.md). Host versus App describes
responsibility; core versus replaceable capability describes dependencies.
An external component may run inside the Host process and repository. It does
not require another service, App, event channel or plugin framework.

| Responsibility | Home |
| --- | --- |
| Truthful execution state, identity/attempt links, boundary failure evidence, bounded cleanup/recovery and canonical reads | Existing core Work and State responsibilities; executors supply details through their execution contract |
| Extra step/domain context and verbose diagnostics | Workflow/executor annotations and artifacts using the supported recording path |
| Metric definitions, calculation, sampling, history and optional threshold evaluation | Supplied replaceable metric/reporting capability, wired by composition; reuse existing storage/maintenance and timing contracts |
| Source-specific health probes | Existing Host instrumentation or replaceable observers; expose facts, not domain conclusions |
| Run views, dashboards and export | Replaceable readers of supported evidence and metric reads |
| Domain success criteria, diagnosis, alert response and whether to repair | Owning App or human; normal authorized work, never a second controller |

The core must not import concrete metric definitions, collectors, dashboards
or investigation policy, or wait for them to settle work. Trusted Host reporting
gets narrowly supplied reads; Apps keep the SDK boundary and do not acquire
raw storage access. Metric history is an observation, not another authority
for execution outcome. Shared storage does not make its consumers core.

**Removal test:** start without metric/reporting components. Work must still be
admitted, run, settle and recover, and retained execution evidence must remain
available through canonical reads. No new samples or alerts are expected;
remaining readers show unavailable/stale measurement, not healthy zero. Removing
only a dashboard does not disable collection. Removing investigation does not
remove evidence or complete blocked work. Work explicitly requiring the absent
capability cannot pretend to succeed; unrelated execution remains independent.
Test supported absence at startup; arbitrary hot-unloading is not required.

For extension, add an annotation/artifact, a metric definition, a source observer
or another reader in its existing home. Keep shared fields stable and domain
details optional; definitions belong with their responsible code or App, not a
global domain catalog. Propose selected baseline metrics in the normal install
without per-workflow setup, but do not promote them to mandatory core dependencies.
This target does not claim the current metric wiring already passes the removal
test; verify it before changing the accepted placement contract.

## Cost, privacy and retention

Costs are storage, writes, query work and maintenance, not additional model
calls. Keep default records small and link existing transcripts and outputs.
Do not create a new record for every token or internal operation. Extra verbose
logging is opt-in.

Capture useful permitted context, not credentials, environment dumps,
authorization headers or complete personal configuration. Apply safe field
selection and redaction before storage, including errors and artifacts; hiding
secrets in the UI is insufficient. Free-form debug text is not guaranteed
secret-free. Existing access boundaries apply to reads and exports.

Set explicit byte and retention limits through existing Host storage maintenance,
including attachments and metric history. Preserve state needed for correctness;
expiring debug detail must not break active work or erase accepted output.
Summaries may outlive detailed logs, with drill-down availability stated.
Bounded retention cannot promise indefinite recalculation of old metrics.

Measure bytes/writes per run, storage growth, query time, workflow latency and
impact on conversation/control responses before selecting production limits.
Use bounded indexed reads; a row limit alone does not bound scan cost. Reuse
normal snapshot timing and avoid scanning transcripts for basic counts. Add
incremental aggregation only if measured query cost justifies it. This draft
does not claim a proven performance budget or retention duration.

## Existing implementation and focused gaps

Source reviewed at Host `0bedd93a9eb2`:

| Existing home | Starting point / gap to inspect |
| --- | --- |
| `src/lib/db/workflows.ts` | Run records, entry hash, Task binding, parent/resume links, artifacts and step sessions exist. Reuse them; an entry hash alone does not identify all imported dependencies. |
| `src/lib/workflow-tool.ts` | Run boundaries, child calls and terminal failures are recorded. Scoped logs forward message text to runtime logging; verify run correlation and retained debug detail before claiming a self-contained trace. |
| `src/lib/workflow.ts`, execution/trace reads | Workflow/session trace types and result reads exist. Verify access to partial outputs and child errors without unrelated searches. |
| `src/lib/metrics.ts`, `src/app/metric-source-measurement.ts` | Definitions, history and source measurement exist. Per-source exceptions currently become skipped IDs without their error explanation in the returned result. |
| `src/app/adapters/reporting/metric-read.ts`, `src/app/composition/reporting.ts` | Metric reads/definition installation use optional reporting. The narrow read omits sample time and coverage; expose only what the health consumer needs. |

These are source observations, not a live health audit. The
[earlier PoC](../archive/reviews/default-error-metrics-poc-20260909.md) tested
recomputation and metric failure containment, not this workflow-first proposal.
Do not promote its patch unchanged or reorganize directories first.

## First trial and acceptance

After review, use a disposable installation and a controlled workflow that
prepares output, calls a child execution and fails during upload. Inspect the
existing trace first, then fill only the gaps that prevent understanding it.

The first slice is one usable run view, a success/error/blocked/interrupted
summary, visible local retry evidence, duration and measurement freshness/failure.
Reuse existing reads and metric code; fill evidence gaps before adding views.
Other health sources can follow independently. Verify:

1. Success, error, blocked result and interruption retain distinct evidence;
   a failed run shows its failing boundary, original error and partial output.
2. Local retry, later Task attempt and nested workflow remain distinct. Later
   success retains failures; duplicate observations do not inflate counts.
3. Killing a worker mid-run and restarting retains available evidence and lets
   existing recovery expose an honest outcome without invented details.
4. Debug/metric write failure does not mask the original error or change an
   accepted result. Collection recovery reads retained facts and shows gaps.
5. A mixed-outcome fixture produces the documented window, counts and denominator,
   including no-data and expired-detail cases. Drill-down selects the same cohort.
6. Synthetic secret-bearing inputs/errors are omitted or redacted before storage;
   large diagnostics are bounded and linked correctly.
7. Compare current tracing and the candidate on the same workload, including
   many short steps. Report incremental latency, storage and query cost; verify
   conversation/control responsiveness during collection.
8. With optional measurement/reporting absent, these work and restart cases
   retain truthful outcomes and readable evidence. A metric failure or absence
   cannot block unrelated execution or become a healthy-looking zero; a request
   explicitly requiring the missing measurement cannot claim success.

Accept the slice when a reviewer can explain a failure from the run, distinguish
successful recovery from failure-free execution, reconcile metrics with records
and assess measured overhead and component removal. Choose concrete sampling,
byte and retention limits from the trial before default rollout. Full CI and
deployment verification remain separate gates.

Then use it on one real problem: inspect representative failed and successful
runs, decide whether the disruption warrants a fix, make the smallest appropriate
change, and compare equivalent work before/after. Check useful outcomes as well
as failure frequency, time, cost and human intervention where recorded. Fewer
executions, suppressed errors or missing observations are not proof of improvement.
Stop expanding instrumentation when the evidence is sufficient to make that
decision; add detail only when an actual investigation is blocked by its absence.

Before implementation, review whether this slice is sufficient and which health
questions deserve the next investment. On acceptance, update the owning Workflow,
Metrics, Architecture and relevant storage/read contracts together. This draft does not
authorize deployment, a new App, an error framework, a telemetry queue, a new
tracing backend or automatic repair.

## First implementation candidate

Host [PR #143](https://github.com/hao1939/may-agent/pull/143), at `1526e063`,
keeps this first PR independently useful:

- Ordinary workflow errors return a run ID only when its terminal error record
  and artifact are readable. Setup failures share the existing finalization
  boundary. Missing or failed persistence returns the error without a misleading
  evidence link. Run inspection includes stored outcomes, reasons, timing,
  exact child links and step-session evidence.
- `ctx.log` retains known-secret-redacted, bounded diagnostics in the run's own
  artifact directory, even without a runtime logger or metrics. The log sink is
  optional and cannot replace the original execution error. Interruption retains
  its reason; existing restart recovery retains the diagnostic snapshot.
- `GET /api/loop-trace?workflowRunId=<id>` adds `workflowEvidence`; the existing
  manager trace exposes the same evidence. This is an API/read improvement, not
  a claim that the browser dashboard renders the new fields yet.
- The optional source sampler supplies four `workflow.<outcome>-count-24h`
  observations for done/error/blocked/interrupted top-level runs. Each carries
  its actual observation time and eligible sample size. Nested failures remain
  inspectable without inflating parent outcomes. The queries use an indexed
  retained, finished-time cohort; no workflow updates these counters.
- Metric reads expose the latest retained sample's value, timestamp, sample
  size, note and cadence. Definition edits and late older samples cannot make
  it appear fresh. Missing samples are unknown. Source failures retain a bounded
  explanation in the existing Event journal (`metric.measurement.failed`),
  linked to the metric and snapshot-trigger event when present. They leave
  previous observations intact, without a new error store or automatic alert.
  Journal write failure is logged and does not stop other sources; normal Event
  retention applies, so this is not an independent permanent audit store.

Candidate bounds are 16 KiB per diagnostic snapshot, 2,000 characters per message
and 100 linked executions per read, with explicit truncation. Diagnostic snapshots
are best-effort: an available snapshot is not a completeness guarantee after a
crash or write failure. Existing secret patterns are not a general PII guarantee;
authors must still avoid logging secrets or personal configuration. No live data
was used for validation.

Local `bun run ci` passed at that revision: 2,693 passed, three installation-only
skips and zero failures, including browser tests (121 seconds for the test phase).
Hosted checks and review remain
the PR's gate. Regression tests fail if diagnostic persistence and failed-run
identity are removed; no killed live worker or deployed installation was used.

Review follow-up adds a scheduled query/command failure test that closes and
reopens the database, verifies bounded redacted explanations, and checks that
the last valid sample remains unchanged. A diagnostic-storage failure test
verifies that other sources continue. The existing real workflow steering test
now reopens storage and checks the exact multiline reason and returned run ID;
removing the interruption-reason write reproduces its failure. Current-head
local and hosted validation are recorded on the PR.

The subsequent setup-evidence fix at `1526e063` covers failed run insertion, a required
startup-event sink that also rejects the failure notification, and failed
terminal persistence. All three regression cases fail on `b071e651`. The fix
finalizes startup failures through the existing error path, preserves the
original startup reason, and omits a run link when terminal evidence is absent
or unreadable. A storage outage can still leave an incomplete row for existing
restart recovery; this adds no new recovery mechanism or durability claim.
Canonical design checks pass using the example checker's merged core paths.

A local synthetic trial used 40 runs with 20 messages each: median logging time
was 0.06 ms without persistence versus 12.75 ms with persistence, with 2,614 bytes
retained per run. Four outcome queries over 100,000 stored runs (10,000 in-window)
took 6.07 ms median and 9.50 ms p95 using the covering time-range index. This is
logger/query microbenchmark evidence, not whole-workflow or deployed latency.

Remaining: complete input/partial-output capture and artifact-retention review;
full failure injection and responsiveness measurement; exact historical cohort
drill-down and per-workflow UI; duration/cost/recovery summaries; source coverage
gaps and additional Host/App health facts. Four independent samples are not an
atomic dashboard snapshot: compare their times before combining them, and do not
sum rolling-window samples. No automatic investigation, repair or new controller
was introduced. Land compatible Host source before relying on the new fields;
these documentation changes do not activate or deploy it.
