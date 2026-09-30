# Metric follow-through through existing Conditions

**Status:** Source implementation and scripted integration validation. No rollout
or model-backed judgment claim.

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

The agent discovers May's `metric-evidence` resource observer through the
existing `tasks` contract tool. It chooses the expected predicate and review
interval; the tool produces an ordinary Condition. The observer reads retained
samples and exposes value, measuredAt, sampleId and freshness. It does not
collect samples, judge health, calculate another trend or register another watch.
For metrics where zero means recovery, an example predicate is
`{field:"value",equals:0,freshness:"fresh"}`. Stale zero is not fresh recovery.
For a strictly newer fresh sample, use
`{field:"measuredAt",gt:baselineMeasuredAt,freshness:"fresh"}`. The installed
Condition operators are `gt`, `gte`, `lt` and `lte`; `greaterThan` is not an
operator. The observer resource is the bare metric ID, without a `metric:`
prefix. The live observation contract supplies these examples to the agent.

An `observe` disposition requires the metric's returned or retained Condition.
An `investigate` disposition needs actual work or a wait: ordinary dependencies
commission independent work and generate their existing completion Conditions;
`continue:true` keeps useful work in this Task; `reviewAt` sets an explicit Task
checkpoint. A Condition alone never submits a repair. Missing linked work is an
evidence gap, not permission to invent a replacement.

## Entry paths and continued work

`metric-response` remains the common read/preparation helper for direct alerts
and Evaluation report intake. A bounded call inside an existing Task returns the
complete composed result for `finish().result`. There is no Task ID or date to
copy separately. Existing Tasks keep their chosen executor and requirements.

Conversation cannot retain Conditions. The caller supplies its current Topic,
Request updates and optional exact May Task to the helper along with the review.
The helper returns an ordinary Conversation `followUp`, carrying that review in
`goal.data.context.metricResponse`. No disposition is claimed by Conversation.
A new goal selects the `metric-follow-through` workflow. Its first attempt saves
the selected decision mechanically. A fresh single handoff to an existing metric
workflow does the same; mixed input and later observation/deadline wakes ask May
to judge the full current assignment. Original input and continued obligations
are context, not instructions to replay the first decision.

Several episodes can join the same investigation after scope judgment. Exact
missing or closed targets stay unresolved under existing admission rules; late
observations never reopen work. Another App uses its own input contract. No new
Task per report, metric-specific Request identity, replacement Task policy or
retry loop is introduced. A returned result still needs caller judgment before
fulfilling a Request. Recovery cannot settle an independent implementation or
approval requirement.

## One authority for live deadlines

Accepted Task facts still supply the existing `metric_dispositions` view. New
version 1 facts bind `linkedTask` to the owning Task and mark unresolved decisions
with `followThrough:"task"`. They omit nextReviewAt. The existing read projection
already supports this optional field; no Host schema or storage change is needed.

`metric-response` and report intake read current Task obligations and each saved
Condition's `observation.reviewAt`, including renewed checkpoints. All waits are
shown with their state; satisfied Conditions and closed Tasks have no live
Condition deadline. A legacy fact's date remains historical. It is never used
as a fallback timer. Omitting unchanged Conditions retains their Host-owned wait.

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

The timer case deliberately waits for the real 60-second minimum checkpoint.
Other cases cover fresh evidence available before admission, quiet/stale samples,
restart without replay, failed publication, independent approval, shared episodes,
missing work, invalid Conditions, commissioned dependencies, owner closure and
automatic return to an open Request. Mixed new requirements go to agent judgment.
These establish mechanics, not model decision quality or deployment readiness.

The final May App run passed 146 tests with one existing Scout test skipped and
zero failures (640 assertions, about 70 seconds). The ten focused helper tests
also passed after final test-type refinements. Strict type checking covered the
App and new integration fixtures; formatting, design examples/integrity, App
boundary checks and the May bundle build passed. Source baseline:
`a77359843e3e533158b943091090b590255cd3d3`, paired with unchanged Host
`e8b56e17e7f7dc3c5575b8df3861a1dfc69948fa`.
