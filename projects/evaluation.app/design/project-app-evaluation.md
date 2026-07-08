# Project/App Evaluation

Status: implemented first pass

`evaluation.app` currently evaluates completed sessions. Session aftermath
answers whether one worker session did useful work. That is necessary, but it is
not enough to judge whether a whole project app is healthy.

Project/app evaluation answers the bigger human-facing question:

> Is this project app moving toward its goal, or does a human need to intervene?

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
  -> evaluation.app samples target state, events, metrics, and outputs
  -> evaluator judges health, progress, and risk
  -> durable report is written
  -> human is notified when useful
```

The target app remains responsible for its domain work. `evaluation.app` is the
outside reviewer.

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

## First Target

Start with `aks-rp-e2e.app`:

```text
targetProject: aks-rp-e2e.app
targetAppDir: /app/projects/aks-rp-e2e.app
targetDomainDir: /app/projects/aks-rp-e2e
```

The first review asks whether the target is really moving these lanes:

- spec verification loop;
- feature reference loop;
- feature compact loop;
- pipeline/live-test execution path;
- app-ops recovery and escalation path.

## Evaluation Questions

Each project/app review should answer:

- Is the target moving toward its stated goal?
- Are active tasks producing new evidence, or just cycling?
- Are loop counters improving over time?
- Are blocked items valid waits, or stale parking?
- Are overdue waits decreasing?
- Are failures converted into repair work, exact waits, or useful escalation?
- Are escalations exact, watched, and still actionable?
- Are claimed outputs real and verified?
- Are suspicious outputs detected, such as live tests passing too quickly?
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
- target git status when output depends on committed or pushed changes;
- recent human steering events;
- previous project/app evaluation reports for trend comparison.

The raw fact packet should be saved with the report or referenced from it. The
human must be able to disagree with evaluator judgment by inspecting the facts.

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
- loop status and trend
- recent repeated signals
- output evidence and suspicious output

Evaluator judgment:
- what looks healthy
- what looks abnormal
- why the target app has or has not handled it sufficiently
- whether this is new, repeated, improving, or getting worse

Notification:
- notify: yes/no
- dedupe key
- reason
- message to human
```

The report is the primary human artifact. The sidecar facts file keeps the raw
packet available without making the markdown hard to read. Events point to the
report.

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

`evaluation.project.review.requested` includes:

```json
{
  "targetProject": "aks-rp-e2e.app",
  "targetAppDir": "/app/projects/aks-rp-e2e.app",
  "targetDomainDir": "/app/projects/aks-rp-e2e",
  "reason": "scheduled"
}
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
  -> review each configured target
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

1. Add `project-health-loop` every 30 minutes.
2. Compare with previous reports.
3. Notify only on trend, severity, or unresolved repeated issue.
4. Add project-health task tree lane only for maintaining the evaluator itself,
   not for individual target reviews.

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
