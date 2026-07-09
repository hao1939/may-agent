# Project/App Evaluation

Status: implemented first pass

`evaluation.app` currently evaluates completed sessions. Session aftermath
answers whether one worker session did useful work. That is necessary, but it is
not enough to judge whether a whole project app is healthy.

Project/app evaluation answers the bigger human-facing question:

> Is this project app moving toward its goal, or does a human need to intervene?

## Responsibility Boundary

The simple rule is:

```text
each app exists to achieve its own domain goal
project app owns the work
evaluation.app audits whether the app is working correctly
```

Each project app must:

- understand and push its own goal forward;
- run its own domain work;
- catch its own metric breaches, failed workflows, stale tasks, blocked work,
  and suspicious outputs;
- turn each problem into repair work, an exact wait, a retry with changed
  conditions, a completed result, or a human escalation;
- keep raw state visible enough that another app can tell whether the loop is
  closing.

`evaluation.app` must:

- stay outside the target app's domain judgment;
- check whether the target app noticed its own issues;
- check whether the target app reacted with useful recovery work instead of
  silent drift, repeated churn, or vague blockers;
- check whether the target app uses escalation correctly and efficiently;
- check whether project-state, task tree, metrics, workflow runs, and UI-facing
  reports agree with each other;
- notify the human only when the app is not self-correcting, the process is not
  trustworthy, or a concrete human decision is needed.

`evaluation.app` may inspect domain artifacts, but only as process evidence. It
should not decide whether the domain result is correct. For example, it should
not decide whether an AKS feature behaves correctly, but it may say a claimed
live-test pass is suspicious if the run finished too quickly to have created the
expected real resources.

In practical terms:

- the target app asks "what domain work should happen next?";
- the target app tries to fix its own process failures first;
- `evaluation.app` asks "did the target app notice, react, and close the loop?";
- `evaluation.app` asks "did the target app use escalation as a useful tool,
  not as a parking lot or noise generator?";
- `evaluation.app` reports to the human when the target app is not closing the
  loop or when a human decision is actually needed.

## Escalation Evaluation

Escalation is an infrastructure ability. It lets an app ask for human,
platform, credential, environment, or ownership help when local work cannot
truthfully continue.

The mental model is:

```text
escalation is not done
escalation is an active wait with an outside owner
```

The lifecycle is:

```text
local recovery exhausted
  -> escalation.created
  -> routed/message-created/approval-requested delivery proof
  -> linked blocked/wait task carries the live wait
  -> watcher rechecks next_check_at/fallback_at
  -> returned answer creates escalation.resolved or escalation.dismissed
  -> target app converts the answer into work, refreshed wait, done, or terminal finding
```

Events record facts. The task tree records the live state. `handled`,
`routed`, or `message.created` are useful delivery facts, but they do not mean
the target project is unblocked.

The escalation itself does not need to be routed to `evaluation.app` as a work
item. `evaluation.app` can read the runtime database and target app artifacts:

- `escalation.created`;
- `escalation.resolved`;
- `escalation.dismissed`;
- `escalation.resume_failed`;
- target app approval or human-message events;
- target app task-tree waits that reference an escalation, approval, owner
  decision, or human/operator ask;
- target app local dispatch logs such as `approval-dispatch-runs.jsonl`.

The evaluator is not judging the domain answer inside the escalation. It is
judging whether the app is using the escalation mechanism well.

A good escalation has:

- exact owner or target surface;
- exact requested action;
- exact reason why local recovery is exhausted or unsafe;
- affected task/spec/feature/run ids;
- delivery proof, such as routed event, message, approval request, or local
  dispatch log;
- linked blocked/wait task, so the project does not lose the wait;
- `waitingFor`, resume condition, observer/check method, next check, and
  fallback;
- closure when the answer arrives, or replacement when the ask becomes stale.

The allowed healthy states are:

- waiting with a linked exact wait and future next check/fallback;
- resolved and converted back into work, done, or a terminal finding;
- dismissed because the ask is duplicate, wrong, superseded, or no longer
  needed;
- expired but already represented by active recovery, follow-up, reroute, or
  repair work.

Bad escalation use includes:

- vague "human please look" asks;
- duplicate asks for the same unresolved blocker;
- escalation without a linked blocked/wait task;
- blocked task that claims external dependency but no escalation/owner path
  exists;
- stale escalation with no recheck or fallback;
- using escalation before trying obvious local diagnosis;
- continuing to retry unchanged work after escalation already proved a human or
  infrastructure decision is required;
- treating a sent escalation as final success instead of waiting for a returned
  signal or recording a valid exact wait.
- treating `handled` as resolved;
- letting `escalation.routed` or `message.created` remain pending forever
  without a linked wait/fallback.

The project/app health report should therefore say:

- how many escalation/approval signals exist in the review window;
- how many are open, stale, resolved, dismissed, expired, or failed to resume;
- whether approval dispatch actually created human-visible messages;
- whether blocked waits are linked to escalation/owner paths when needed;
- whether routed/handled events have an actual project-state closure path;
- whether escalation is reducing uncertainty and work, or just accumulating.

Efficient escalation does not mean "few escalations." It means the app escalates
only when escalation is the right next tool, makes the ask exact, watches the
answer, and converts the result back into project progress.

The evaluator should grade escalation use by asking:

- Was escalation necessary, or could the app still do local diagnosis/repair?
- Was the ask exact enough that the recipient can answer without re-triage?
- Was the ask delivered?
- Is there one linked wait that carries the escalation id or equivalent packet
  path?
- Does that wait have next check/fallback behavior?
- If the answer arrived, did the target app consume it?
- If the answer did not arrive, did the app follow up once, reroute, or record a
  longer explicit wait rather than repeatedly sending the same ask?

## What We Learned

From `aks-rp-e2e.app`, the useful pattern is not more machinery. The useful
pattern is separation of responsibilities:

```text
app organizes work
workflows execute reusable experience
task tree records durable state
metrics/watchdog detect process failure
human sees raw facts plus judgment
```

The failure mode we saw is also important: a target app can have watchdogs,
metrics, planners, and recovery loops, yet still sit with stale blocked work,
misleading progress, or repeated recovery churn. If the target app could always
recognize and fix that itself, the issue would already be fixed.

Therefore project/app evaluation must be independent and human-facing. It may
send structured feedback to the target app, but it must not depend on the target
app to handle that feedback before notifying the human.

## Mental Model

`evaluation.app` has two evaluation layers:

```text
Session evaluation
  -> Did this one session produce useful work?

Project/app evaluation
  -> Is this app/project producing the output it exists to produce?
```

For project/app evaluation:

```text
target app runs work
  -> target app first tries to catch and fix its own metric breaches, failures, and stalls
  -> evaluation.app samples target state, events, metrics, and outputs
  -> evaluator judges health, progress, and risk
  -> durable report is written
  -> human is notified when useful
```

The target app remains responsible for its domain work. `evaluation.app` is the
outside reviewer.

Metric breaches follow the same boundary. The target app is the first owner of
its own metric breach:

```text
target metric breach
  -> target app handles, recovers, waits, or escalates
```

`evaluation.app` must not rely on receiving every target metric event. A breach
event can be a useful fast wake-up, but it is not the source of truth. The
reliable path is scheduled sampling:

```text
scheduled project/app review
  -> read target metrics, task state, events, loop state, outputs, and recent reports
  -> judge whether the target app handled its own signals well
  -> notify human only when the target is not self-correcting or human action is useful
```

If the target app catches and fixes a breach, `evaluation.app` should usually
report `ok` or `watch`. If the same breach pattern keeps recurring without
burning down, or the target app hides/loses the signal, `evaluation.app` should
report `concern` or higher. If the target app does not expose enough state for
the evaluator to tell whether the breach was handled, that lack of
observability is itself a project/app concern.

## Self-Recovery Contract

Every project app should own the first attempt to recover its own process
failures. The minimum contract is:

- task state exists and unfinished work is visible;
- owner/planner wake exists for judgment and work creation;
- project-owned metric breaches can be routed to the project app first;
- a scheduled observer checks progress without human polling;
- stuck work has a fallback path, such as watchdog, health review, stall review,
  or owner review;
- issues the app cannot finish alone can be reported to a human;
- unfinished work has an active, review, runnable, exact-wait, or escalation
  path.

`evaluation.app` does not enforce this by fixing the target. It records whether
the contract looks `strong`, `partial`, or `weak`, then reports when unfinished
work exists without enough self-recovery.

The useful reusable pattern is not owned by one app. `aks-rp-e2e.app` is a good
source because it has exercised many failure modes, but every project app can
teach the shared app-maintenance pattern:

```text
scheduled observer
  -> app-owned metric/watchdog signal
  -> owner/planner wake
  -> worker/reviewer/problem/stall fallback
  -> exact wait, repair work, done state, or human escalation
```

When one app handles a failure well, the useful lesson should be portable to
the others. When one app fails to close the loop, that failure should improve
the shared pattern.

Apps do not copy each other's domain logic. They copy and refine the recovery
shape only when their own work can stall or silently drift.

The evaluator must follow the same rule. It may use any app as an example, but
it must not treat one app's file names or domain loops as required for every
app. The fact packet should discover the target app's own loop/run artifacts
and report missing generic capabilities, not missing app-specific filenames.

## Non-Goals

Project/app evaluation must not become a second planner for the target app.

It should not:

- mutate the target task tree;
- dispatch target app workers;
- decide target domain truth;
- silently fix target project state;
- hide raw facts behind evaluator conclusions;
- notify on every metric breach without judgment.

It may:

- emit a human-facing notification;
- emit `learning.feedback` or another target-scoped feedback event;
- recommend a target-app action;
- record that the target app's own recovery path is not trustworthy.

## Watched Targets

Start with `aks-rp-e2e.app` because it has the richest ops pattern and the
largest unfinished surface:

```text
targetProject: aks-rp-e2e.app
targetAppDir: /app/projects/aks-rp-e2e.app
targetDomainDir: /app/projects/aks-rp-e2e
```

Project/app review should cover all active project apps:

```text
aks-rp-e2e.app
may-agent.app
scout-knowledge-lib.app
evaluation.app
```

For `aks-rp-e2e.app`, the review asks whether the target is really moving these
lanes:

- spec verification loop;
- feature reference loop;
- feature compact loop;
- pipeline/live-test execution path;
- app-ops recovery and escalation path.

## Evaluation Questions

Each project/app review should answer:

- Is the target moving toward its stated goal?
- Are active tasks producing new evidence, or just cycling?
- Are loop counters improving over time, or is the app hiding repeated churn?
- Did the target app detect its own metric breaches, workflow failures, stale
  tasks, blocked work, and suspicious outputs before evaluation had to point
  them out?
- Are blocked items valid waits, or stale parking?
- Are overdue waits decreasing?
- Are failures converted into repair work, exact waits, or useful escalation?
- Are escalations exact, watched, and still actionable?
- Is escalation being used at the right time: after bounded local recovery, not
  too early and not too late?
- Are escalations closing, being replaced with clearer waits, or piling up?
- Are claimed outputs backed by credible process evidence?
- Are suspicious outputs detected by the target app itself, such as live tests
  passing too quickly?
- Are repeated watchdog/metric/recovery paths finding the same issue?
- Does the UI/project readout match raw task/runtime facts?
- What should the human do, if anything?

For `aks-rp-e2e.app`, the evaluator should not decide whether an AKS behavior is
correct. It should decide whether the AKS verification app is running a credible
process and producing trustworthy verification output.

## Inputs

The evaluator reads raw facts first:

- target task tree;
- target project-state readout;
- loop state files and counters;
- recent planner, watchdog, reviewer, worker, and stall-review runs;
- recent workflow/pipeline runs and artifacts;
- registered metrics and recent breach/recovery events;
- open blocked waits and overdue waits;
- open escalations and their owner/resume/fallback state;
- recent escalation lifecycle events from the runtime DB;
- approval dispatch/message records that prove an escalation was actually sent
  to the intended human/operator surface;
- task-tree linkage between blocked waits and escalation/owner paths;
- target git status when output depends on committed or pushed changes;
- recent human steering events;
- previous project/app evaluation reports for trend comparison;
- target app metric snapshots and recent metric history, even when no metric
  breach event was routed to `evaluation.app`;
- target app self-recovery contract: task state, owner wake, metric handling,
  scheduled observers, fallback/watchdog path, human escalation/reporting path,
  and unfinished-work frontier;
- target app discovered loop/run artifacts under its own `.state` directory,
  without requiring AKS-specific artifact names.

The raw fact packet should be saved with the report or referenced from it. The
human must be able to disagree with evaluator judgment by inspecting the facts.
When the report shows metrics, distinguish the target app's own readout from
runtime DB metrics. If runtime metric query returns no rows but the target app's
project-state readout contains counters, the report should say both facts
plainly instead of showing only `metrics: none`.

## Report Contract

Each review writes a durable report under:

```text
reports/project-health/<target-project>/<timestamp>.md
```

The report should have this shape:

```text
Project: aks-rp-e2e.app
Verdict: ok | watch | concern | urgent | blocked-on-human
Main concern: one sentence
Requested human action: none | watch | decide | approve | provide-input | assign-owner

Raw facts:
- link to the full raw facts sidecar, `<timestamp>.facts.json`
- concise task counts and trend
- active/review/runnable state
- blocked/overdue/escalation counts
- escalation/approval usage: open, stale, closed, failed dispatch, task linkage
- loop status and trend
- recent repeated signals
- output evidence and suspicious output
- self-recovery contract status and missing/weak pieces

Evaluator judgment:
- what looks healthy
- what looks abnormal
- why the target app has or has not handled it sufficiently
- whether the target app first tried to recover itself, and whether that path is
  trustworthy
- whether escalation use is exact, watched, efficient, and tied back to project
  progress
- whether this is new, repeated, improving, or getting worse

Notification:
- evaluator requested notification: yes/no
- final notification sent: yes/no
- dedupe key
- reason
- message to human

Human action:
- exact action requested
- what the human should decide or provide
- what the target app should do after the human action
```

The report is the primary human artifact. The sidecar facts file keeps the raw
packet available without making the markdown hard to read. Events point to the
report.

The report must distinguish evaluator judgment from notification delivery. If
the evaluator says "notify" but dedupe suppresses the notification, the report
must say that plainly and explain why. Otherwise a human cannot tell whether the
concern was hidden intentionally or accidentally.

The requested human action must be concrete. Avoid stopping at "approve" or
"decide" without saying what to approve or decide and what should happen next.
The report should read like:

```text
Approve or reject the current focus direction. If approved, the target app
should proceed with that focus. If rejected, provide the replacement focus.
```

## Verdicts

- `ok`: raw facts show useful progress and no meaningful human action.
- `watch`: mildly abnormal, but already represented by active work or a valid
  exact wait.
- `concern`: target app is not clearly handling the issue; human should know.
- `urgent`: project output is materially at risk or repeatedly misleading.
- `blocked-on-human`: progress requires a human decision, approval, credential,
  capacity decision, or ownership assignment.

## Notification Policy

Notify only when a human can usefully act or should be aware that the target app
is not self-correcting.

`watch` is normally report-only. A `watch` verdict should not notify just
because the evaluator says "keep watching"; the next scheduled report is the
watch mechanism. Notify only for `concern`, `urgent`, `blocked-on-human`, or a
concrete human action such as `approve`, `decide`, `assign-owner`, or
`provide-input`.

Notify for:

- project not moving while unfinished work remains;
- blocked or overdue blocked count remains high across multiple samples;
- same recovery/watchdog/metric pattern repeats without reduction;
- active work is zero or near-zero while loops still have non-terminal work;
- suspicious output, such as a live test passing too quickly to have created
  real resources;
- escalation exists without exact owner, wait, fallback, or response path;
- target app claims settled state while raw facts show important unfinished work;
- target app keeps creating vague blockers instead of exact waits or work;
- evaluator cannot trust the target app's own self-recovery path.

Do not notify for:

- a transient issue already represented by credible active work;
- a future-dated exact wait with owner, watcher, fallback, and clear resume
  condition;
- a one-off metric breach that recovered and left no output risk;
- evaluator uncertainty that can be resolved by the next scheduled sample.

## Events

Use explicit evaluation events:

```text
evaluation.project.review.requested
evaluation.project.reviewed
evaluation.project.notification.requested
```

Target metric events are optional fast-path inputs. When `evaluation.app`
receives a watched target's metric breach or recovery event, it may request a
project/app review, but correctness must not depend on that event being routed
to evaluation:

```text
metric.breach | metric.recovered
  -> optional evaluation.project.review.requested
  -> same scheduled-review workflow and report contract
```

The scheduled review remains mandatory because the target app may consume,
recover, or suppress its own metric events before `evaluation.app` sees them.

`evaluation.project.review.requested` includes:

```json
{
  "targetProject": "aks-rp-e2e.app",
  "targetAppDir": "/app/projects/aks-rp-e2e.app",
  "targetDomainDir": "/app/projects/aks-rp-e2e",
  "reason": "scheduled"
}
```

Runtime delivery may wrap those fields under `data.params` when the event is
dispatched to a workflow. The evaluator must normalize both shapes:

```text
params.targetProject
data.targetProject
data.params.targetProject
```

`evaluation.project.reviewed` includes:

```json
{
  "targetProject": "aks-rp-e2e.app",
  "verdict": "concern",
  "reportPath": "reports/project-health/aks-rp-e2e.app/20260708T000000Z.md",
  "summary": "Overdue blocked work is not burning down.",
  "requestedHumanAction": "assign-owner",
  "notify": true,
  "dedupeKey": "aks-rp-e2e.app:overdue-blocked-frontier:spec-loop"
}
```

`evaluation.project.notification.requested` includes the same dedupe key plus a
short human message and report path.

Optional feedback to the target app should be separate:

```text
learning.feedback
```

Feedback is useful, but the human-facing review is the closure path.

## Trigger Model

Project/app review should be triggerable in several ways. The review workflow is
the same; only the reason and urgency differ.

```text
scheduled loop
  -> evaluation.project.review.requested(reason=scheduled)

target app abnormal signal
  -> evaluation.project.review.requested(reason=metric-breach | escalation | stuck-loop)

target app output signal
  -> evaluation.project.review.requested(reason=output-completed | suspicious-output)

human action
  -> evaluation.project.review.requested(reason=manual)
```

The scheduled loop is the baseline. It catches slow-moving problems that no
single event makes obvious.

Event-driven triggers provide faster review when a concrete signal appears:

- target process metric breaches;
- target recovery/watchdog loop repeats the same fingerprint;
- target creates or changes an escalation;
- target loop reports no progress after a grace window;
- target output claims pass/done but the evidence looks suspicious;
- target app emits a project-state or project-health changed event;
- human requests review from UI or chat.

The trigger should not decide the verdict. It only starts the review. The
evaluator still reads raw facts and decides whether the result is `ok`, `watch`,
`concern`, `urgent`, or `blocked-on-human`.

### Loop Trigger

Use a durable scheduled loop for each watched target:

```text
project-health-loop
  every 30 minutes
  -> review each configured target project app
  -> write report
  -> notify only if policy says notify
```

The default interval is **30 minutes**. That is the baseline safety net for slow
stalls and repeated churn. Faster reaction should come from manual review or
target signals, not from making the scheduled loop noisy.

The loop should keep a small state file:

```text
.state/project-health/targets/<targetProject>.json
```

It records last report path, last verdict, last notification dedupe key, last
sampled counters, and unresolved concern fingerprints.

This is not a task tree node per review. It is loop state, similar to how other
durable loops track cursor/progress.

### Event Trigger

The same workflow should also run immediately for important target signals:

```text
metric.breach(targetProject=aks-rp-e2e.app)
escalation.created(targetProject=aks-rp-e2e.app)
project.output.claimed(targetProject=aks-rp-e2e.app)
project.loop.progress.changed(targetProject=aks-rp-e2e.app)
```

The first implementation does not need all these event types. It can start with
metric breaches and manual review, then add more as the target apps expose
cleaner signals.

### Manual Trigger

Manual review should be available as an action:

```text
review-project-app target=aks-rp-e2e.app
```

Manual review always writes a report. It should notify only if the evaluator
judges notification is needed; otherwise it returns the report path and verdict
to the requester.

### Trigger Priority

If several triggers arrive close together, dedupe by target and reason family:

- keep the highest urgency reason;
- run one review;
- include all coalesced reasons in the report;
- do not run separate evaluator sessions for every metric row.

## Dedupe

Notification dedupe key:

```text
targetProject + concernFamily + topEvidenceFingerprint
```

Examples:

- `aks-rp-e2e.app:overdue-blocked-frontier:spec-loop`
- `aks-rp-e2e.app:false-live-pass:compact-feature`
- `aks-rp-e2e.app:escalation-without-owner:capacity`
- `aks-rp-e2e.app:loop-no-progress:feature-compact`

Repeat notification only when:

- severity increases;
- the issue remains unresolved past the review window;
- new evidence changes the requested human action;
- human acknowledged the prior notification but the project did not act;
- the same fingerprint appears after it was previously marked recovered.

## Closure

A finding is closed when the next reports show one of:

- raw facts recover and remain recovered for the configured window;
- target app creates credible active repair work and progress follows;
- target app records a valid exact wait with owner, watcher, fallback, and
  resume condition;
- target app proves the concern was a false positive;
- human acknowledged the issue and an exact wait/escalation records that state;
- escalation is resolved or dismissed and the target state reflects the result.

Silent disappearance is not closure. The next report must say why the concern is
closed or downgraded.

## Implementation Plan

Phase 1: read-only report

1. Add `project-health-evaluator` workflow. Done.
2. Add action `review-project-app`. Done.
3. Add event handler for `evaluation.project.review.requested`. Done.
4. Start with manual and scheduled runs for `aks-rp-e2e.app`. Done.
5. Write markdown report under `reports/project-health/`. Done.
6. Emit `evaluation.project.reviewed`. Done.

Phase 2: notification

1. Add dedupe store under `.state/project-health/`.
2. Emit `evaluation.project.notification.requested` for concern/urgent reports.
3. Route notification to the human-facing transport.
4. Include report path, raw facts summary, judgment, and requested action.

Phase 3: schedule and trend

1. Add `project-health-loop` every 30 minutes for each configured target.
2. Compare with previous reports.
3. Notify only on trend, severity, or unresolved repeated issue.
4. Add project-health task tree lane only for maintaining the evaluator itself,
   not for individual target reviews.

Phase 3.5: self-recovery coverage

1. Add a read-only self-recovery contract packet to every project/app report.
   Done.
2. Schedule project-health review for every active project app, not only
   `aks-rp-e2e.app`. Done.
3. Use the reports to decide which recovery lessons should be applied across
   apps.
4. Keep this observational first: no target task-tree mutation or auto-fix from
   `evaluation.app`.
5. Generalize fact collection so app-specific loop/run files are discovered
   when present but are not treated as required for other apps. Done.

Phase 4: feedback loop

1. Optionally emit target-scoped `learning.feedback`.
2. Track whether the target app reacts.
3. Notify if feedback is ignored and the issue persists.

## Open Review Questions

- Which human notification channel should receive
  `evaluation.project.notification.requested` first?
- Should `watch` verdicts create reports only, or also lightweight UI entries?
- How long should an issue stay unresolved before repeat notification?
- Should target configuration live in `app.ts`, `project.json`, or a small
  `config/project-targets.json` file?
- Which target-app events should trigger immediate review in the first version:
  metrics only, escalations too, or output claims too?
