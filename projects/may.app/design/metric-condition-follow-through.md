# Metric follow-through through existing Conditions

**Supports:** [Evidence-driven improvement](../../alex.app/docs/2a-design/system-model.md#improve-from-evidence-and-make-problems-actionable).
**Choice basis:** [Agent decisions and mechanical execution](../../alex.app/docs/1-principles/code-vs-data.md).

**Status:** Source implementation with Host integration coverage. The receiving-owner
judgment and #295 companion changes were activated on October 3 in App release
`2b9e2d5b7e1c8740d0de7127748833e454b5c874`, paired with Host
`8fa6eddc2f540ae0bf68ff1327b773397661a986`. See the
[rollout evidence](token-efficiency-proposal-20261002.md#october-3-rollout-verification).
Activation does not prove that every older sample Condition was retired or
establish sustained token savings.
The October 4 completed-Conversation review and admission corrections below
have source regression coverage and an offline recovery rehearsal. They have
not been deployed; the stopped installation's backlog remains pending.

The old helper prepared a metric fact, then asked the agent to save its next
review time, create work and copy its Task ID separately. The observed failure
was an accepted “review later” fact without an actual scheduled wait. Fix the
composition rather than introduce another work lifecycle.

## Agent decides; code carries the decision

The agent returns `review: { task, decisions }`. `task` is the existing ordinary
Task result; `decisions` supplies each metric/episode, disposition, reason,
evidence and nextAction when unresolved. App code validates the response and
adds the metric facts with the actual owning Task identity. It returns one
ordinary result. Host accepts that result and its Conditions together.

## Samples are evidence; status changes request attention

The existing metric service collects samples and evaluates the declared alert
rule in code. A new breach episode invites investigation. Samples within that
episode and repeated breach notifications do not commission another review.
Several metrics may reuse one investigation after the agent checks its scope.
A `metric.recovered` event can update an existing investigation through a
Condition bound to both metric ID and alert ID. Recovery of the metric alone
never fulfills the original work.

When only passive collection remains, the agent records `no-change` and finishes
the review. The collector remains responsible for detecting the next breach.
There is no periodic model call to decide whether a newer timestamp is useful.

For an investigation, the agent chooses useful work or a real return path:
repair results, human decisions, a relevant status change, or a deliberate
checkpoint for actual outstanding work. `requests` commission work; a separate
caller Condition observes its result. `continue:true` keeps useful work in the
current Task. Host settlement validates its accepted result and retained waits.
A Condition never submits a repair, and missing linked work is an evidence gap
rather than permission to invent replacement work.

The metric result composer rejects `may.metric.state` Conditions in proposed
results and retained waits that were not explicitly retired. This is May's
investigation policy; the generic Host Condition engine still executes declared
observations. The metric observer remains available for explicitly requested
measurement work outside automated investigation follow-through.

## Reuse repeated metric calculations

May owns the SQL meaning of its reliability metrics. The unresolved-recovery
and failed-attempt queries use a query-local materialized cohort when both the
aggregate and evidence examples need the same rows. This removes duplicate
calculation without a persistent cache, schema change or change to alert policy.
Source-query collection remains outside the Host metric-state write transaction.

The [October 4 SQL audit](../../alex.app/docs/archive/reviews/sql-query-audit-20261004.md#implementation-and-integrated-trial)
records identical-result comparisons and costs. The source change requires the
ordinary App release/reload path; a checkout update does not establish that the
saved live metric definitions changed.

## Adopting the policy for existing work

An existing investigation gets one owner judgment through its next ordinary
wake. The agent rereads the complete requirement and uses generation-fenced
`retire-condition` actions for obsolete sample waits, including satisfied ones.
Omission alone is insufficient because Host retains Conditions. The result must
preserve independent repair requests, approvals and unanswered requirements;
only the agent judges whether its review is complete.

A previously saved handoff can still carry an `observe` plan with a sample
Condition. Like any incoming plan, it reaches the receiving owner as context
for current judgment. New handoffs are validated before creating follow-through
work. The legacy disposition spelling stays readable; it cannot bypass the sample-wait
check. Retirement commits through normal Task settlement, so restart preserves
both the change and unrelated obligations. There is no direct database migration
or silent inference of completion.

Composition is repeatable: a complete helper result may contain the metric facts
it just generated. The helper accepts exact copies of the current code-bound
decisions and emits each once. Conflicting, stale or fabricated metric facts
are rejected; `decisions` remains the source for the current judgment. Preparing
a result never claims that the Host has accepted it.

## Entry paths and continued work

`metric-response` remains the common read/preparation helper for direct alerts
and Evaluation report intake. A bounded call inside an existing Task returns the
complete composed result for `finish().result`. There is no Task ID or date to
copy separately. Existing Tasks keep their chosen executor and requirements.

Conversation finishes the review it considered; independent Requests and waits
can remain open. For a completed `no-change` or `recovered` review, the agent
supplies `task.state: converged` to `metric-response` with its Conversation
context. The helper returns summary and disposition facts directly, plus the
chosen response and Request updates. It creates no follow-up or investigation
link. Acceptance of that Conversation result records the decision. The helper
rejects Task effects or a target supplied with this completed form rather than
silently dropping requested work.

For remaining metric work, the caller supplies a waiting review, its current
Topic/Request updates and an optional exact ordinary May Task whose scope fits.
Do not target the current Conversation Task. The helper returns an ordinary
Conversation `followUp`, carrying the review in
`goal.data.context.metricResponse`. Preparing this handoff claims no accepted
disposition. Host checks target input compatibility before admission, identifying
Conversation Tasks by saved Conversation bindings rather than executor names.
Conversation input and ordinary Task input are not interchangeable.
A new goal selects the `metric-follow-through` workflow. Each eligible attempt
asks the owning agent to judge the full current assignment, including the
handed-off review, all pending input, retained waits and previous attempt feedback.
The caller's suggested Task result is context; it does not decide whether the
receiving Task should work, wait or finish. For example, “investigate these failed
deliveries” may arrive with a suggested wait but no Condition. The receiver can
inspect the deliveries now or choose a real return route.

If settlement rejects a result, Host preserves its unhandled input and supplies
the failure on the next attempt. The workflow reaches the agent again instead
of copying the same rejected plan. Code still binds the metric facts to this
Task and Host still owns admission, retries and backoff; no replay registry or
new retry loop is needed. A rejected decision cannot publish an accepted metric
disposition or fulfill its caller's Request.

This adds one owner judgment for an initial handoff that previously copied the
plan without a model call. It gives the receiving owner responsibility for the
assignment and allows correction. It does not make metric samples or unchanged
waiting Conditions eligible for another attempt. Host-connected regressions
cover current work replacing a suggested wait, correction after a real rejected
settlement, retained input identity, quiet samples across restart, and delivery
of the eventual repair result. Scripted judgments prove execution mechanics,
not live agent quality or net token savings.

Several episodes can join the same investigation after scope judgment. Exact
missing or closed targets stay unresolved under existing admission rules; late
observations never reopen work. Another App uses its own input contract. No new
Task per report, metric-specific Request identity, replacement Task policy or
retry loop is introduced. A returned result still needs caller judgment before
fulfilling a Request. Recovery cannot settle an independent implementation or
approval requirement.

## One authority for live deadlines

Accepted Task facts still supply the existing `metric_dispositions` view. A
completed Conversation review omits `linkedTask`; it created no investigation.
Investigation version 1 facts bind `linkedTask` to the owning Task and mark unresolved decisions
with `followThrough:"task"`. They omit nextReviewAt. The existing read projection
already supports this optional field; no Host schema or storage change is needed.

`metric-response` and report intake read current Task obligations. New Hosts
separate code-only Condition recovery from the agent's Task `reviewAt` decision;
Conditions retain their state without a recurring model-review deadline. The
reader tolerates absent `observation.reviewAt`; dates supplied by older Hosts
remain compatibility evidence. A legacy disposition fact's date is never a
fallback timer. Omitting unchanged Conditions retains their Host-owned wait.

The [Task contract](../../alex.app/docs/2a-design/task-resource-engine.md#conditions)
owns the Host revision and rollout requirement. Explicit repair checkpoints use
Task `reviewAt`; missed delivery recovery does not require an agent checkpoint.

## SQL cost review

The October 17 candidate sets the metric-query target to **under 100 ms** through
`metric.source-query-worst-ms`, the Host's passive maximum duration for SQL sources
actually attempted in one collection pass. May supplies `threshold: 100` and
`alertOp: ">="`; Host supplies the execution observation without an alert default.
The existing metric-breach route asks Alex to review one alert episode. Collection
alone stays quiet. No cancellation, restart, extra schedule or per-query metric
registry is added.

Install the corresponding Host collector and inclusive comparison support before
activating this definition. The paired portable trial uses actual source collection,
App definitions and Alex's event route: 99 ms is healthy; 100 ms breaches once;
repeated 100 ms and no-query passes do not create another transition; 80 ms
recovers the gauge. These timings are controlled fixture inputs, not a live
performance benchmark. The later pass can contain different sources, so recovery
does not establish that the previous slow source ran again or was repaired.
Missing collection never becomes a zero; source failures remain separate facts.

Both the new cost note and the existing all-SQL sample retain available bounded
query-plan evidence. The all-SQL adapter checks plan identity, shape and capture
window; invalid optional evidence does not discard the timing sample. Existing
Host plan capture still starts at 1,000 ms, so 100 ms breaches can lack a plan.
See the [Host contract](../../alex.app/docs/2a-design/metrics.md) and
[October 17 evidence](../../alex.app/docs/archive/reviews/metric-query-cost-20261017.md).
This candidate has not been activated or shown to reduce live query cost.

The October 2 source candidate adds `may.daemon-sql-time-percent` to May's
existing five-minute metric collection. It compares retained daemon heartbeat
counters over ten minutes, separating process lifetimes so a restart cannot look
like negative cost. Missing or stale samples remain unknown. The initial policy
requests attention above 25% SQL wall time for three consecutive samples; these
overlapping windows indicate sustained load, not three independent incidents.

Use the ordinary Evaluation review and May disposition path. When cost warrants
investigation, read `status` with `diagnostics: true` for average/worst cost and
recent top query shapes by total time, latency and frequency. Rankings are bounded
and process-local; inspect untracked counters and window timestamps. Many fast
queries can matter as much as one slow query. A lifetime maximum alone does not
prove a new incident, and high SQL time does not authorize cancellation or restart.
Routine healthy samples need no human message. Reuse an existing investigation
when its scope fits.

Deploy the Host counters before loading this metric definition. Portable tests
exercise the metric through the existing collector, including restart and stale
coverage; they do not prove that a live agent has diagnosed or repaired a query.

The October 3 App candidate adds the independent
`may.daemon-sql-recent-worst-call-ms` gauge without changing the aggregate gauge.
Its source command reads the existing diagnostic status socket and selects only
current/previous five-minute rankings. The retained note binds PID, process SQL
`since`, diagnostic measurement time, window bounds, masked fingerprint/shape,
call count, total, average and worst milliseconds, plus bounded coverage and
untracked-call evidence. It retains at most six ranked shapes and rejects notes
above 4,000 characters. Missing, expired or empty rankings fail collection;
they never record zero. The scalar is the worst call in those recent windows,
not the process-lifetime maximum.

Initial May policy collects on the existing five-minute opportunity and breaches
above 1,000 ms. One synchronous daemon SQLite call above one second can delay the
control path and is four times the rollout's 250 ms ordinary-read target, so a
single recent breach is worth Evaluation judgment; it is not a Host timeout,
restart rule or proof of an incident. The metric service keeps one alert episode,
so repeated samples do not commission work. A new breach should trigger the
existing review immediately while non-breaching routine discovery is daily or
less frequent. Evaluation owns that review cadence and breach deduplication; May
reuses the existing accountable investigation and verifies a fresh comparable
observation. Collection still runs every five minutes and adds no scheduler.

The command embeds the script path resolved from `import.meta.dir` while loading
the App definition. Installed generations therefore retain their pinned release
script instead of depending on the collector's working directory or mutable
`/app/projects/may.app`. Activation must still verify the exact installed command,
a successful diagnostic read and the first retained sample.

The rollout acceptance is a complete example: a real sample and breach reaches
Evaluation, its exact report reaches May, an accepted owner decision links the
repair, and a comparable post-application sample verifies the effect. Retain those
ordinary identities in the accountable Task's evidence. An alert or patch alone
does not close this loop; a justified no-change decision is also valid. Applying
a proposed improvement keeps its existing human approval boundary.

Exact metric events should retain their subject through review selection. Periodic
bounded discovery remains useful when events were missed. The October 2 trial
found that the current App drops the subject and can examine unrelated metrics
first; May's assigned Task is preparing a correction. Acceptance must include two
different metric signals plus a scheduled wake during active review, retained
deadlines and shared allowance, incomplete reads, and reuse of accepted owner work.
This is an App selection repair, not a new Host registry or work lifecycle.

## Validation and limits

The preceding PoC is retained on `poc/metric-condition-follow-through`, commit
`7f86505ecbeb144b165a9b724161dce429f05530`. It demonstrated the fact-only gap and
existing Host observation/restart behavior with scripted decisions. Its harness
is not shipped as a second implementation.

Production composition tests live in `scripts/metric-follow-through.test.ts`.
They call the shipped workflow, App mapper and Condition tool with real Host
Task/Conversation storage, event delivery and resource observation, temporary
SQLite and synthetic samples. Only model calls and source measurements are
scripted; no provider, installation state or credentials are needed. The fixture
substitutes a registered executor that invokes the shipped workflow directly.
The focused unit tests also exercise the actual declared workflow selection.

```sh
bun test ./metric-follow-through.test.ts ./agents/may/workflows/metric-response.test.ts
bun test ./scripts/metric-follow-through.test.ts --timeout 80000
```

The timer case deliberately waits for a real agent-selected repair deadline.
The current regressions cover repeated fresh/stale samples without agent calls,
repair and exact recovery-status return, replay after restart, failed publication,
independent approvals, shared breach episodes, missing work, invalid Conditions,
commissioned requests and owner closure. An old sample-driven wait is seeded as
an accepted result, then retired by a scripted owner decision; repeated samples
stay quiet across restart while the original approval still returns. A separate
case checks an older handed-off plan reaches judgment instead of replay.
These establish mechanics, not unscripted model judgment or live adoption.

The initial May App run passed 146 tests with one existing Scout test skipped and
zero failures (640 assertions, about 70 seconds). The ten focused helper tests
also passed after final test-type refinements. Strict type checking covered the
App and new integration fixtures; formatting, design examples/integrity, App
boundary checks and the May bundle build passed. Source baseline:
`a77359843e3e533158b943091090b590255cd3d3`, paired with unchanged Host
`e8b56e17e7f7dc3c5575b8df3861a1dfc69948fa`.

The October 1 follow-up reproduced two rejected native decisions without new
model calls: a correct retained approval and a helper result returned through
composition again. Both unchanged outputs pass the corrected helper. Host
integration tests verify new human/external waits, an omitted approval after
metric recovery, and atomic rejection when a Task has no return route or tries
to retire its last one. The full App suite passed 147 tests, with the existing
Scout skip and no failures. Type checks, bundle build and common design checks
also passed. This verifies acceptance mechanics; it does not establish optimal
review cadence or long-running model behavior.

The October 3 breach-policy revision passed the full May App suite: 160 tests,
one existing Scout test skipped, zero failures (754 assertions). App type checks,
bundle build, changed-TypeScript formatting and design/example/App-boundary
checks passed against Host/SDK `f2eb4b87683ee92b048bb9fc8fe627fd76d0b4ac`. The
design check retains its existing unclassified-root-`reports` warning. No live
Task, Condition, installation or notification was changed by these tests.
