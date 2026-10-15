# Project/App Evaluation

**Design status:** Accepted.
**Implementation status:** Implemented; coverage and publication durability are
calibrated through bounded operational checks.

`evaluation.app` currently evaluates completed sessions. Session aftermath
answers whether one worker session did useful work. That is necessary, but it is
not enough to judge whether a whole Agent App is healthy.

Project/app evaluation answers the bigger owner-facing question:

> Is this Agent App moving toward its goal, or does a human need to intervene?

Its purpose is to produce an independent, evidence-backed finding. It does not
take ownership of fixing the target project.

## Responsibility Boundary

The simple rule is:

```text
each app exists to achieve its own domain goal
the target App owns the work
evaluation.app audits whether the app is working correctly
review result goes to the target owner
the owner resolves or records the exact wait
```

Each target App must:

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
- check whether project posture, task resources, metrics, workflow runs, and UI-facing
  reports agree with each other;
- write a plain review result and recommendation to the target owner;
- notify the human only when the owner needs a concrete human decision or the
  app is not self-correcting.

The target owner decides whether and how to remediate the finding. A later
evaluation may report that the condition persists, changed, or disappeared,
but rechecking does not transfer remediation ownership to `evaluation.app`.

The same path applies when the target is `evaluation.app` itself:

```text
review evaluation.app
  -> write the result
  -> send owner feedback to evaluation.app
  -> evaluation owner resolves, waits, or escalates
```

There is no separate self-review branch. A review failure is just another input
that asks for a review of `evaluation.app`.

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

These are audit questions, not work assigned to `evaluation.app` on the
target's behalf.

## Cross-owner and human waits

An App asks another owner for help through one linked child request. A task that
needs an external fact records one exact Condition and ends its bounded attempt.
Neither a sent notification nor an old `escalation.*` event is completion.

```text
source request or task
  -> linked child App request, or exact Condition
  -> responsible owner or May handles the request
  -> correlated result or observed fact wakes the source
  -> source App accepts, continues, or records a new exact wait
```

Evaluation reads public App/request/task projections and bounded `query_db`
results. It never opens private task persistence or treats raw SQL as an App
capability. Historical `escalation.*`, `message.created`, and approval events
may support causality, but current responsibility lives in the linked request,
task, dependency, or Condition.

A healthy cross-owner wait has:

- one accountable source request or task;
- one exact child request or Condition identity;
- a concrete requested action or observable fact;
- bounded evidence explaining why local work cannot continue safely;
- a correlated result or an observer capable of changing the Condition; and
- source state that consumes the result instead of equating transport delivery
  with domain completion.

The evaluator reports duplicate asks, vague owner requests, Conditions with no
observer, repeated unchanged retries, orphaned dependencies, or results the
source App did not consume. It does not require legacy escalation open/close
pairs and does not ask a human to assign an owner already declared by the App.

## What We Learned

From `aks-rp-e2e.app`, the useful pattern is not more machinery. The useful
pattern is separation of responsibilities:

```text
app organizes work
workflows execute reusable experience
task resources record durable desired and observed state
metrics/watchdog detect process failure
owner sees raw facts plus judgment
```

The failure mode we saw is also important: a target app can have watchdogs,
metrics, planners, and recovery loops, yet still sit with stale waiting or
attention work,
misleading progress, or repeated recovery churn. If the target app could always
recognize and fix that itself, the issue would already be fixed.

Therefore project/app evaluation must be independent and owner-facing. It sends
the result to the target owner and may also notify the human when a human
decision or intervention is the right next step.

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
  -> owner receives the recommendation
  -> human is notified only when useful
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

## Task Reconciliation

`evaluation.app` follows the shared task schema in
`projects/alex.app/docs/2a-design/task-resource-engine.md`. It does
not define an evaluation-specific task kind or lifecycle.

```text
event wake
  -> resolve one task intent
  -> generic reconciler claims task + generation
  -> explicit workflow, otherwise evaluator owner
  -> structured result + evidence
  -> generic reconciler validates and applies actions
  -> observed state and reconciliation event
```

Task resources record desired outcomes and observed state. Their generated tree
shows relationships; it is neither the queue nor a mutation surface. App code
is not a second planner. Known evaluation processes are explicit workflows. The
evaluator owner judges novel or ambiguous evaluator-local work. Both return the
shared structured result and neither edits Host task persistence directly.

`session.end` is a high-rate fact with one exact session identity. Evaluation
resolves failed or interrupted sessions, May sessions, and direct sessions to
bounded `runtime/session-aftermath/<session>` work with normal task-level
concurrency. Successful workflow-internal sessions remain facts unless an
explicit `evaluation.session.requested` input selects them. That explicit input
uses the same task identity. Durable Event recovery is sufficient; Evaluation
does not run a second scanner that can race the exact task.

### Evaluation Task Schema

Every evaluation task has:

- a stable, collision-safe identity and parent;
- one desired outcome;
- observable acceptance criteria;
- `achieve` or `maintain` mode;
- inherited or explicit ownership;
- an optional explicit workflow binding and stable configuration;
- optional durable outputs and true task dependencies; and
- observed generation, phase, attempt, summary, and evidence maintained by the
  reconciler.

Wake observations do not belong in task intent. Metric values, timestamps,
review reasons, messages, and event bodies remain in the trigger packet. A
standing task's input contains only stable configuration. This prevents each
scheduled sample or metric transition from creating a false desired-state
generation.

### Durable Responsibilities

The seed tree contains only standing `maintain` responsibilities:

| Task                       | Desired state                                                             | Current convergence evidence                                                                               |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `evaluation-system`        | Independent evaluation stays useful and reliable.                         | Session, project-audit, delivery, and reliability lanes satisfy their postconditions.                      |
| `session-audit`            | Eligible terminal sessions have trustworthy, traceable evaluations.       | Evaluation records or structured skips cover the eligible terminal-session frontier.                       |
| `project-app-audit`        | Every watched app has a current independent assessment.                   | Each target fingerprint and due report state are current.                                                  |
| `finding-delivery`         | Findings reach owners and useful human decisions without duplicates.      | New actionable findings have one delivery; unchanged findings create none.                                 |
| `evaluator-reliability`    | Evaluation's own process remains bounded and operable.                    | Known work uses declared workflows; exceptions have bounded work or exact Conditions.                      |
| `pipeline-health`          | Coverage, throughput, review delivery, and anomalies remain observable.   | The App-owned coverage source, deep-evaluation frontier, and explicit metric/review-failure facts remain current. |
| `criteria-and-calibration` | Criteria remain versioned and calibrated against concrete samples.        | Accepted calibration is reflected in criteria and regression evidence.                                     |
| `drift-detection`          | Comparable cohorts reveal meaningful quality drift.                       | Claims name cohorts, windows, criteria version, and samples; absent evidence creates no speculative work.  |
| `system-integrity`         | Evaluator-local routing, ownership, state, and reports remain consistent. | Each concrete defect has one bounded repair and observable postcondition.                                  |

Retired concepts, completed migrations, dated incidents, and one-off repairs
are not seed tasks. They are bounded `achieve` work and leave the live graph
after their result is absorbed.

The named responsibilities are an ownership map, not a requirement that every
box execute after every child transition. A purely aggregating parent is a
structural group. An executable oversight parent runs only when a schedule,
changed anomaly fingerprint, or explicit review request gives it a decision to
make. `pipeline-health`, `evaluator-reliability`, and `project-app-audit` must
not consume evaluator sessions merely to repeat unchanged child state.

### Runtime Tasks

| Event                                              | Task                                  | Mode       | Observable postcondition                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| eligible `session.end`                             | `runtime/session-aftermath/<session>` | `achieve`  | The concrete ended session has a durable evaluation or structured skip.                                                                                                                                           |
| `evaluation.session.requested`                     | `runtime/session-aftermath/<session>` | `achieve`  | The explicitly requested session has a durable evaluation or structured skip.                                                                                                                                     |
| `evaluation.deep.requested`                        | `runtime/deep-eval/<session>`         | `achieve`  | The exact session has one workflow-traced deep judgment.                                                                                                                                                          |
| new evaluator-owned metric breach or recovery      | `runtime/owner-review`                | `maintain` | The exact metric transition is reviewed from bounded reconciliation context without a broad pipeline rescan. Repeated updates for the same open alert stay as facts but do not wake another expensive owner turn. |
| `evaluation.deep.scan`                             | `runtime/deep-eval-scan`              | `maintain` | One candidate reviewed or no candidate currently exists.                                                                                                                                                          |
| `evaluation.project.review.requested`              | `runtime/project-audit/<target>`      | `maintain` | Target fingerprint is current and any due report and feedback are persisted.                                                                                                                                      |
| `evaluation.tick`                                  | `runtime/owner-review`                | `maintain` | Revision-checked actions are atomically applied, or a justified no-op is recorded.                                                                                                                                |

An `achieve` task leaves the live graph after outcome absorption and keeps a
bounded completion reference for deduplication. A converged `maintain` task
remains standing and can be woken again.

### Execution Policy

Task outcome and acceptance remain independent of the executor:

- deterministic evidence collection, persistence, metrics, and delivery use
  the named Evaluation workflows;
- `runtime/owner-review` and addressed free-form Evaluation requests use the
  resumable `codex-goal` executor with the selected `evaluator` role; and
- the manual executor trial actions create separate read-only `achieve` Tasks
  with identical outcome, acceptance, and input: one selects `codex-goal` and
  one selects the `executor-trial` workflow.

The trial Tasks are evidence, not production authority. They cannot mutate the
target, do not share a Task identity, and are compared only after both results
have independently crossed the normal Task result boundary. This prevents a
race between two reconcilers. The pair holds goal semantics constant, not the
whole Task spec: `workflow` and `executor` are intentionally different
execution-relevant spec fields. A valid comparison therefore checks the same
outcome, acceptance, and input while recording handler selection separately.

The first paired canary used frozen key `6651ccb82bfa` against
`evaluation.app`. Both candidates independently identified the same wording
error above and converged without actions. After an equivalent 51-second ready
wait, the workflow Task completed in 79.3 seconds (77.8 seconds provider time)
and the Codex Task in 106.5 seconds (106.3 seconds provider time). Codex emitted
four semantic intermediate updates and reported 107,190 goal tokens; the
workflow's six model turns recorded 279,609 aggregate model tokens. Those token
counters come from different adapters and are useful observations, not yet a
normalized cost comparison.

Codex receives the current Task, bounded direct-child facts, durable events,
declared outputs, and the selected evaluator instructions. Its thread is
working memory for one Task, not another owner or status authority. Runtime
admits its structured result through the same generation fence and App action
validation used by every executor. Reverting this canary changes only the
Task's executor selection; it does not migrate Task identity or state.

### Conditions And Failures

A handler that must wait on an external fact records an exact Condition and
returns `waiting`; the bounded run then ends. The Condition owns its observer,
freshness, next check, owner, and fallback. A Condition change wakes affected
tasks.

An attempt failure does not prove the desired outcome impossible or justify a
generic blocked task. A workflow calls an agent directly for judgment; an
unavailable named workflow produces a visible failure and paced retries of
the declared procedure. The App routes its failure evidence to owned repair.
Supervision repairs only broken mechanical
invariants such as lost delivery or a dead attempt; it does not repeat
evaluation judgment.

## Self-Recovery Contract

Every Agent App should own the first attempt to recover its own process
failures. The minimum contract is:

- task state exists and unfinished work is visible;
- owner/planner wake exists for judgment and work creation;
- App-owned metric breaches can be routed to the accountable App first;
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
source because it has exercised many failure modes, but every Agent App can
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

- mutate the target's Host-owned task state;
- dispatch target app workers;
- decide target domain truth;
- silently fix target project state;
- hide raw facts behind evaluator conclusions;
- notify on every metric breach without judgment.

It may:

- emit a human-facing notification;
- send owner feedback through the target owner's normal request path;
- recommend a target-app action;
- record that the target app's own recovery path is not trustworthy.

## Watched Targets

Project/app review identifies a target by its stable App name only. The
workflow does not receive absolute App or domain paths; its bounded evaluator
inspection discovers public evidence through read-only tools. Standing coverage
currently includes:

```text
aks-rp-e2e.app
may-agent.app
scout-knowledge-lib.app
gym.app
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

One bounded evaluator-agent call collects and judges current public evidence:

- the target's canonical App declaration;
- its generated task projection and public project readout;
- recent relevant metrics, events, workflow results, and pipeline evidence;
- Git revision/status when a finding depends on source state; and
- the previous Evaluation-owned project-health report.

The workflow passes only canonical input, reconciliation context, and the exact
wake fact. It does not assemble a host-private fact packet, read task storage,
run raw SQL, or receive global runtime paths. The evaluator agent may use its
read-only inspection and `query_db` tools, but it must not mutate the target,
send messages, or create work. Its structured `observations` and source
revisions are written beside the report so a target owner can challenge the
judgment. Conflicting or unavailable evidence produces `watch` with an exact
verification gap, not an invented target defect.

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
Requested human action: none | watch | decide | approve | provide-input

Public observations:
- link to the structured sidecar, `<timestamp>.facts.json`
- bounded task, metric, runtime, source-revision, and prior-report evidence
- the exact evaluator execution identity and terminal status

Evaluator judgment:
- what looks healthy
- what looks abnormal
- why the target app has or has not handled it sufficiently
- whether the target app first tried to recover itself, and whether that path is
  trustworthy
- whether escalation use is exact, watched, efficient, and tied back to project
  progress
- whether this is new, repeated, improving, or getting worse

Owner finding delivery:
- target owner
- recommendation
- report path
- what the owner should review, fix, wait on, or prove already handled

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

The report is the primary owner artifact. The sidecar keeps the bounded public
observations and judgment available without making the markdown hard to read.
Events point to the report. Human notification is optional addressed delivery,
not the closure path.

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
- `concern`: target App is not clearly handling the issue; owner action is
  warranted.
- `urgent`: project output is materially at risk or repeatedly misleading; the
  target owner needs prompt action.
- `blocked-on-human`: progress requires a human decision, approval, credential,
  or capacity decision.

## Owner Feedback And Notification Policy

An owner finding is emitted for a non-`ok` review when the concern family is
new, severity increases, an explicit review requests it, or an unchanged
finding remains after the one-hour retry window. Delivery means only that the
target App durably received `project.owner.requested`; it does not mean the
owner accepted or repaired the finding. The owner judges it, proves it is
already handled, turns it into work, or records an exact wait.

Human delivery is stricter. `evaluation.human_decision.requested` is emitted
only for `concern`, `urgent`, or `blocked-on-human` when the structured action
is exactly `decide`, `approve`, or `provide-input`. The May App translates that
fact into one correlated inbox request. `watch`, routine awareness, target
ownership, evaluator uncertainty, and failed evaluator execution never create
human work. Every target already has a declared App owner, so `assign-owner` is
normalized to owner feedback rather than human notification.

## Events

Use explicit facts with one actionable authority each:

```text
evaluation.review_failed
evaluation.project.review.requested
evaluation.project.review_started
evaluation.project.reviewed
evaluation.project.review_failed
evaluation.human_decision.requested
```

`evaluation.review_failed` is emitted when the evaluation review process itself
fails, for example when the reviewer session ends with provider/runtime
unavailability before producing a judgment. It is not a target-project quality
verdict. The event is adapted into `evaluation.project.review.requested` with
`targetProject: "evaluation.app"` and `reason: "review-failed"`. That keeps
review failures on the same path as every other app review:

```text
evaluation.review_failed
  -> evaluation.project.review.requested(targetProject=evaluation.app)
  -> project-health-evaluator
  -> owner feedback to evaluation.app
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

`evaluation.project.review.requested` is a task subscription. It resolves
directly to the stable `runtime/project-audit/<target>` intent and does not
create an inbox item. Its stable configuration contains only:

```json
{
  "targetProject": "aks-rp-e2e.app",
  "reason": "scheduled"
}
```

The task input persists only `targetProject`; changing reason and other wake
details remain in the reconciliation trigger. Absolute App/domain paths and
legacy wrapper shapes are not part of the contract.

`evaluation.project.reviewed` includes:

```json
{
  "targetProject": "aks-rp-e2e.app",
  "verdict": "concern",
  "reportPath": "reports/project-health/aks-rp-e2e.app/20260708T000000Z.md",
  "summary": "Overdue blocked work is not burning down.",
  "requestedHumanAction": "none",
  "notify": false,
  "dedupeKey": "aks-rp-e2e.app:overdue-blocked-frontier:spec-loop"
}
```

`evaluation.project.review_failed` is operational evidence about an incomplete
inner evaluator execution. That workflow attempt returns blocked, writes no
successful report/cursor, and emits neither target-owner feedback nor May work.

`evaluation.human_decision.requested` includes the dedupe key, exact requested
action, short message, and report path. A canonical May App subscription
translates it into one addressed inbox request.

Finding delivery to the target app uses the target owner's normal request path:

```text
project.owner.requested(target=<target owner>)
```

The owner request is the routine finding-delivery path. Human delivery exists
only when a concrete decision/input is required. Neither delivery nor a handled
transport status proves acceptance or repair.

Every non-`ok` owner request must carry enough structure to return the finding
to the output that caused it:

```json
{
  "mainConcern": "what is wrong",
  "affectedArtifacts": ["task, workflow, file, result, or state surface"],
  "recommendedChange": "the concrete correction for the owner to judge",
  "verification": ["observable conditions proving the correction worked"]
}
```

The evaluator does not mutate the target's Host-owned task state and does not decide that the
recommendation was accepted. The target owner may create repair work, link an
existing correction, or reject the finding with evidence. A later review may
call the finding resolved only after the named artifact or relevant output
changed and the verification condition was observed. An unchanged report,
notification, task refresh, or message acknowledgement is not improvement.

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

The scheduled loop is a sampling baseline. It catches slow-moving problems
that no single event makes obvious. Each trigger runs one bounded read-only
evaluator inspection; the resulting semantic fingerprint suppresses unchanged
report publication and delivery until a meaningful delta or daily baseline.

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
  every 2 hours
  -> run one bounded public-evidence inspection
  -> compare the structured judgment/observation fingerprint
  -> write a report only on a delta or daily baseline
  -> send owner feedback for new/severity/actionable findings
  -> notify human only if policy says notify
```

The default interval is **2 hours**. That is the baseline safety net for slow
stalls and repeated churn. Faster reaction should come from manual review or
target signals, not from making the scheduled loop noisy.

The workflow keeps a small Evaluation-owned generated cursor:

```text
.state/project-health/targets/<targetProject>.json
```

It records last report and facts paths, last verdict, notification dedupe key,
semantic fingerprint, and owner-feedback state. It is ignored Evaluation-owned
workflow state under `.state`, not a second task authority.

There is one durable maintain task per target, not a task node per review. The
cursor only suppresses duplicate artifacts and delivery; task intent remains
the durable desired-work authority.

### Event Trigger

The same workflow should also run immediately for important target signals:

```text
metric.breach(targetProject=aks-rp-e2e.app)
project.output.claimed(targetProject=aks-rp-e2e.app)
project.loop.progress.changed(targetProject=aks-rp-e2e.app)
```

The first implementation does not need all these event types. It can start with
metric breaches and manual review, then add more as the target apps expose
cleaner signals.

### Manual Trigger

Manual review should be available as an action:

```text
review-agent-app target=aks-rp-e2e.app
```

Manual review always writes a report. It should notify only if the evaluator
judges notification is needed; otherwise it returns the report path and verdict
to the requester.

Human notification and target-owner feedback are separate. A manual review that
still finds a non-`ok` condition sends the structured finding back to the target
owner even when human notification is deduplicated. This makes an explicit
review useful for recovery without repeating Telegram noise.

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

- `aks-rp-e2e.app:overdue-waiting-frontier:spec-loop`
- `aks-rp-e2e.app:false-live-pass:compact-feature`
- `aks-rp-e2e.app:orphaned-owner-dependency:capacity`
- `aks-rp-e2e.app:loop-no-progress:feature-compact`

Repeat notification only when:

- severity increases;
- the issue remains unresolved past the review window;
- new evidence changes the requested human action;
- human acknowledged the prior notification but the project did not act;
- the same fingerprint appears after it was previously marked recovered.

Target-owner feedback uses a shorter safety rule. Suppress an unchanged concern
for one hour so concurrent reviews do not create duplicate work, then send it
again if the condition still exists. Explicit manual review bypasses this owner
feedback delay. Dedupe prevents simultaneous duplicate work; it must not
permanently silence a finding whose prior remediation completed without changing
the measured condition.

## Closure

A finding is closed when later public observations show one of:

- public observations recover and remain recovered for the configured window;
- target app creates credible active repair work and progress follows;
- target app records a valid exact Condition or linked child request with an
  owner and observable resume path;
- target app proves the concern was a false positive;
- a human or child owner returned a correlated result and the source reflected it;
- an obsolete ask was superseded or dismissed and the source state reflects it.

Silent disappearance is not closure. The next report must say why the concern is
closed or downgraded.

The evaluator must distinguish an absent owner/wait path from an exact wait
whose formal closure is missing. Both go to the target's already-declared App
owner. Only a concrete external decision or input may additionally address May.

## Implementation

The canonical implementation is complete for this workflow slice:

1. `evaluation.project.review.requested` resolves directly to one stable
   maintain task per target.
2. The workflow consumes canonical input/reconciliation/workspace capabilities
   and performs one bounded evaluator-agent inspection without raw SQL, task
   storage, prompt parsing, or global runtime paths.
3. Reports and sidecars live under `reports/project-health/`; dedupe cursor data
   lives under ignored `.state/project-health/` and is read back after writing.
4. Non-`ok` findings use `project.owner.requested`; concrete human decisions use
   `evaluation.human_decision.requested` and the May App subscription.
5. Incomplete evaluator results block the attempt and remain evaluator-local;
   they do not blame a target App or manufacture a successful review.
6. Standing schedules cover every configured target, including `gym.app`.
7. The App declares one bounded trailing-3h coverage query; Runtime measures it
   on the shared Host cadence without creating a Task or calling an agent.

Follow-on work is operational calibration: verify target-owner reactions from
later public evidence, add precise target event fast paths only when they have
one canonical routing authority, and tune the sampling interval from measured
cost and latency rather than adding another queue or watcher.

## Open Review Questions

- Should `watch` verdicts create reports only, or also lightweight UI entries?
- Should the two-hour sampling interval change after measured evaluator cost and
  finding latency are available?
- Which target-App facts should trigger immediate review next:
  metrics only, dependency failures too, or output claims too?
