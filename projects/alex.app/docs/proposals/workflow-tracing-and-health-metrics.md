# Workflow tracing by default and useful health metrics

**Supports:** [Metrics And Alerts](../2a-design/metrics.md). Makes workflow evidence and health observations affordable and useful to an owning reviewer.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#simple-first); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** SQLite-first direction and bounded page refinement agreed;
remaining expansion below is for review, September 11, 2026.
**Implementation status:** First bounded source slice merged in Host #143 as
`939698ad`, from reviewed head `1526e063`. It implements the evidence foundation and basic
outcome observations, not the complete proposal or deployed behavior. The
[first candidate](#first-implementation-candidate) records that evidence. The
page refinement is implemented in Host #147 (`374a99db`), not yet merged or
deployed; [page candidate](#page-refinement-candidate) records its verification
and remaining scope.

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

### Keep the next step small

Keep SQLite for run evidence and metric history, and improve the existing
Overview/Live, Metrics and trace pages. Use standard counter, gauge and histogram
meanings without installing Prometheus or Grafana. The current rolling outcome
counts are gauges; duration initially comes from recorded timestamps.

A Prometheus client can later supply standard recording/export where it saves
code. It is not a history store and is not required for these pages. Keep it
inside optional reporting, not in core or every workflow. The owning
[metric contract](../2a-design/metrics.md#metric-semantics-and-persistence)
defines storage, type semantics and the client boundary. Do not build another
metric framework, queue or service to prepare for a possible future backend.

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

The [Web UI contract](../2a-design/webui.md#overview-metrics-and-run-inspection)
owns the page split. Reuse the current routes and SQLite-backed reads:

- **Overview (`/`, currently Live):** a last-24h finished top-level execution
  summary, all four outcomes and their shared denominator. Show running
  executions and current queued/running/waiting Tasks separately, followed by
  recent failures, explicit attention items and collection problems. Add only
  Host facts with verified sources; no composite health score.
- **Metrics (`/metrics`):** selected time window and recorded App/workflow
  filters; a comparable workflow table with finished count, successful share,
  error/blocked/interrupted counts, mean duration and slowest run. State the
  duration population and exclusions; keep per-outcome filtering available so
  quick failures do not masquerade as faster successful work. Below it, a
  searchable measurement list leads to definition, history and evidence.
- **Run details:** render the existing `workflowEvidence` read, including
  exact outcome/reason, steps, children, bounded logs and artifact links.
  Expired, missing or truncated detail remains visible. No new incident page.

Keep three questions distinct: when was the last observation, did collection
fail, and did a configured rule match? A stale sample may also breach a rule.
No alert means no open alert, not proven health. Zero executions has no success
percentage; a failed read must not appear as zero executions.

Reporting calculates summary and breakdown from a shared bounded read with
fixed `[start, end)` bounds and the same scope. The four independently sampled
24h metrics are useful trend observations, not an exact combined dashboard
cohort. A drill-down freezes the selection's time window rather than moving
"now" on every click. If late settlement or retention changes the records,
refresh counts with the detail and show the coverage change; saving another
immutable cohort store is not part of this design.

Graph positions use actual sample times. Show units, window, sample size and
gaps; do not space irregular samples evenly or carry old values across a
collection outage. Fetch detail/history on selection, not every metric's chart
at page load. Names, errors and notes must render safely as text. Both pages
consume shared calculations and source freshness, not their own formulas,
cached `current` values or definition-edit timestamps.

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

Source baseline is Host `e1a0005e`, including merged #143. Page candidate
`374a99db` fills the reporting/UI gaps as follows:

| Existing home | Present capability / remaining gap |
| --- | --- |
| `src/lib/db/workflows.ts` | Run records, entry hash, Task binding, parent/resume links, artifacts and step sessions exist. Reuse them; an entry hash alone does not identify all imported dependencies. |
| `src/lib/workflow-tool.ts`, `workflow-diagnostics.ts`, `workflow-evidence.ts` | Failure identity, bounded retained logs and linked evidence now exist. Input/partial-output coverage and artifact retention still need review. |
| `src/lib/metrics.ts`, `src/app/metric-source-measurement.ts` | Scalar snapshots and retained source-error events exist. Counter resets and structured histograms are not implemented. |
| `src/app/adapters/reporting/metric-read.ts`, `workflow-metrics.ts`, `src/app/composition/reporting.ts` | Optional reporting exposes sample time/size/note/cadence and four rolling outcome gauges. Their independent queries are not one atomic summary. |
| `src/app/adapters/reporting/workflow-health.ts`, `metric-observations.ts`, HTTP reads | Candidate supplies shared outcome snapshots, deterministic latest observations, retained collection errors and bounded history. No new collector or SDK storage access. |
| `packages/webui/static/pages/live.js`, `metrics.js`, `system.js` | Candidate replaces cached health claims and index-spaced graphs, and renders run evidence. The bounded Task list is not a global Task-state aggregate; per-outcome duration and recovery-cost summaries remain deferred. |

These are source observations, not a live health audit. The
[earlier PoC](../archive/reviews/default-error-metrics-poc-20260909.md) tested
recomputation and metric failure containment, not this workflow-first proposal.
Do not promote its patch unchanged or reorganize directories first.

## Bounded implementation: one useful page refinement

The evidence foundation is merged; Host #147 implements this bounded scope:

1. Supply shared outcome-summary reads and truthful metric observations to HTTP
   consumers. Keep source errors separate from last good samples. Use bounded
   indexed queries, explicit filters and a deterministic latest-sample tie-break.
2. Refine the existing Overview and Metrics pages as above, and render the
   existing run evidence. Start with counts, duration and sample history; defer
   monetary estimates, automated failure ranking and new metric types.
3. Verify with synthetic records: the six-done/two-error/one-blocked/one-interrupted
   cohort, nested runs, later success, no data, stale/failed collection, equal
   sample timestamps, late samples, expired evidence and safe text rendering.
   Check consistent drill-down and irregular-time graphs in the real browser.
4. Measure query cost and page request count. Page entry must not fetch every
   metric's history, and absence of reporting must not break unrelated execution
   or turn missing measurements into healthy zeroes.

No service, production dependency, schema-wide metric framework or deployment
is needed just to implement that slice. The wider evidence/cost checks below
remain rollout gates, not a reason to implement every future metric now.

## Page refinement candidate

Host [PR #147](https://github.com/hao1939/may-agent/pull/147), head `374a99db`,
implements the bounded page scope above. It is not merged or deployed.

- Overview exposes balanced finished outcomes, current running executions,
  recent errors, a bounded all-App Task list and measurement coverage.
- Metrics compares recorded App/workflow/source groups and pages matching run
  evidence with fixed time bounds. Outcome filters leave the overall denominator
  intact. Duration means elapsed time, not CPU, financial cost or Task success.
- Observations expose sample time, missing/stale/unknown freshness, collection
  errors and alert policy separately. History uses actual timestamps and visible
  gaps. Only unchanged supplied workflow sources get a sample-time run link.
- Existing trace detail renders run outcome/reason, source, linked executions,
  step sessions, artifacts and bounded diagnostics, including missing detail.

The owning [Metrics](../2a-design/metrics.md#bounded-reporting-reads) and
[Web UI](../2a-design/webui.md#overview-metrics-and-run-inspection) contracts
record exact semantics and interactive limits. Reporting stays outside core;
storage additions are a workflow end-time index and two open-alert indexes.
No metric client, service,
new sampler or lifecycle is introduced. The unchanged scalar metric API does
not gain monotonic counters or histograms merely because those types are useful.

Local `bun run ci` passed on exact head `374a99db`: 2,712 tests passed, three
installation-only checks skipped and zero failed (114.03 seconds for tests),
plus type, boundary and lint checks. The browser test exercises served code
against a synthetic file-backed HTTP installation, including Overview to
selected errors to exact run evidence, irregular history, safe text rendering,
unavailable Task reads and collection failure. Entry makes no per-metric history
requests. Tests also reconcile the real sampler's sample-time selection with
raw records, cover equal-time pagination and exercise the real Task socket read.
Final review fixed alert truncation at `a481ea32`: an older alert was hidden
when the global list hit its cap. The 503-alert regression fails before the
fix; exact detail now selects that metric's latest alert, while a truncated
list leaves unobserved alert state unknown. That revision passed its three
HTTP/browser checks. Hosted Quality and Container passed on `374a99db` in
[run 34565073074](https://github.com/hao1939/may-agent/actions/runs/34565073074),
including the actual image build and isolated smoke execution. Design integrity,
checked examples and canonical App-boundary checks passed. Merge and deployment
remain separate.

Review follow-up `24fffb42` fixes the separate Overview 20-alert cap and missing
alert-query indexes. HTTP and browser tests distinguish no alerts, exactly 20
and more than 20; the 503-alert case keeps unseen alert state unknown. A schema
test verifies both ordered partial indexes, no temporary sort, and repeatable
upgrade of retained rows. The regressions failed before the fixes; all 11
affected checks and the full local/hosted gates passed on that revision.

Review follow-up `1b25e8ff` keeps raw threshold observations, disabled-rule policy
and retained alerts separate. Project, agent and Host cards reuse one warning
rule; disabling future evaluation no longer hides existing alerts or presents a
raw comparison as an effective breach. Route changes also clear trace evidence
and invalidate delayed success/error responses, reusing the existing generation
check and removing deferred trace loads. The real-browser regressions failed
before the fixes. All 15 affected HTTP/browser/asset checks pass, covering six
policy/alert/value combinations, generic Events, other tabs, newer run selection
and event trace links. Full local and hosted checks passed on that revision.

Review follow-up `2408b519` preserves anchors in the shared link handler and
passes the API time window to the legacy health chart. The existing browser
journey now verifies the clicked run's hash and visible trace, plus sparse
samples' positions within the actual returned 24-hour window. Each regression
failed before its fix; all 15 focused checks and full local/hosted CI passed on
that revision.

Review follow-up `374a99db` makes agent and project subsets honor definition-list
truncation. Each affected surface warns about partial metric data, labels subset
counts as shown and preserves visible breaches; omitted definitions no longer
imply no owned metrics or no problems. It reuses the existing flag without new
reads or endpoints. A real-browser regression covers exactly 500 definitions,
501 with an omitted breached definition, empty/partially represented owners and
projects, and a visible breach. Exact-ID reads still find the omitted definition.
The regression failed before the fix; all 16 focused checks and full local/hosted
CI pass. The source is ready for review, not merged or deployed.

A local probe extracted the actual joined alert queries from the HTTP source.
With 200,000 resolved and 1,000 open synthetic alerts, median query times before
and after indexing were 8.45/0.024 ms for Overview, 9.03/0.98 ms for global
Metrics and 7.76/0.48 ms for exact metric detail. Plans changed from alert-table
scans and temporary sorting to the respective partial indexes. This is
in-memory query evidence, not deployed latency or a constant-time claim for
arbitrarily many unresolved alerts or project joins.

A synthetic in-memory trial used 100,000 runs, 500 metric definitions,
100,000 samples and 10,000 collection failures. Median/p95 query time was
26/36 ms for the top-level workflow report, 49/60 ms including nested runs and
2.9/5.7 ms for the metric list (about 15 KB and 367 KB for the first and last
responses). These are local query measurements, not deployed latency, browser
performance or whole-system overhead guarantees.

The bounded source slice is implemented; the complete proposal is not.
Remaining rollout evidence includes artifact/input/partial-output coverage,
failure injection and conversation/control responsiveness under collection.
Retained history can change after late settlement or pruning. The Task list
does not compute global counts or oldest eligible work; workflow groups use
recorded source identity, not invented agent attribution. Per-outcome duration,
aggregate retry/cost analysis, additional verified Host observations, histogram
storage and Prometheus export should follow only a demonstrated investigation
need. Neither CI nor this query trial replaces deployment verification.

## Trial and acceptance

Use a disposable installation and a controlled workflow that
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

Before expanding implementation, review whether this slice is sufficient and
which health questions deserve the next investment. Update owning contracts
when their behavior changes; preserve explicit implementation gaps. This proposal does not
authorize deployment, a new App, an error framework, a telemetry queue, a new
tracing backend or automatic repair.

## First implementation candidate

Host [PR #143](https://github.com/hao1939/may-agent/pull/143) merged as `939698ad`
from verified head `1526e063`. The first slice is independently useful:

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
  retained, finished-time cohort; no workflow maintains parallel outcome totals.
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
Hosted Quality and Container passed on that exact head before merge.
Regression tests fail if diagnostic persistence and failed-run
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

At the first-slice merge, browser consumption and shared cohort/duration reads
were still missing; the [page candidate](#page-refinement-candidate) now supplies
them and records the remaining input/partial-output, retention, failure-injection,
responsiveness and cost/coverage gaps. Four independent samples are not an atomic
dashboard snapshot; the candidate uses a shared retained-cohort read and does
not sum rolling windows. No automatic investigation, repair or new controller
was introduced. Only the first source slice is merged; deployment of compatible
Host code and browser assets remains separate. These documents do not activate it.

### Prometheus client compatibility check

On September 11, 2026, an isolated test of `@prometheus-io/client@0.16.1`
passed under Node `24.20.0` and Bun `1.3.14`. It used a private registry and
verified counter increments and negative-increment rejection, a decreasing
gauge, histogram bucket/count/sum results, and JSON/text exposition. Observing
0.2 and 2.5 seconds with bounds 1 and 5 produced cumulative bucket counts
1/2/2 (including infinity), count 2 and sum 2.7. A fresh child process started
with a zero counter: the client itself retained no history.

This supports using the library for a concrete recording/export need, not a
claim of production Bun coverage, durable collection or measured overhead.
Default process collectors, worker aggregation and service deployment were not
tested. No dependency was added to May. The
[client decision](../2a-design/metrics.md#prometheus-client-useful-helper-not-the-database)
keeps this reuse available without adding a second state store now.
